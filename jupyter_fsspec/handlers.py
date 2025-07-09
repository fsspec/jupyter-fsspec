import asyncio
import base64
import binascii
import traceback
import json
import logging
import tornado
from contextlib import contextmanager


from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join

from jupyter_fsspec.file_manager import FileSystemManager
from jupyter_fsspec.models import (
    GetRequest,
    PostRequest,
    DeleteRequest,
    TransferRequest,
    Direction,
)
from jupyter_fsspec.utils import parse_range
from jupyter_fsspec.exceptions import JupyterFsspecException


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@contextmanager
def handle_exception(
    handler,
    status_code=500,
    default_msg="Unkown server error occurred",
):
    try:
        yield
    except Exception as e:
        error_message = f"{type(e).__name__}: {str(e)}" if str(e) else default_msg
        logger.error(error_message)
        traceback.print_exc()

        handler.set_status(status_code)
        handler.write(
            {
                "status": "failed",
                "description": error_message,
                "error_code": type(e).__name__,
            }
        )

        handler.finish()
        raise JupyterFsspecException


class JupyterFsspecHandler(APIHandler):
    def check_xsrf_cookie(self):
        if self.request.headers.get("X-JFS-Client") == "non-browser":
            return  # Skip XSRF check for non-browser client
        super().check_xsrf_cookie()


class FsspecConfigHandler(APIHandler):
    """

    Args:
        APIHandler (_type_): _description_
    """

    def initialize(self, fs_manager):
        self.fs_manager = fs_manager

    @tornado.web.authenticated
    async def get(self):
        """Retrieve filesystems information from configuration file.

        :return: dict with filesystems key and list of filesystem information objects
        :rtype: dict
        """
        file_systems = []

        try:
            with handle_exception(self):
                self.fs_manager.check_reload_config()
        except JupyterFsspecException:
            return

        for fs in self.fs_manager.filesystems:
            fs_info = self.fs_manager.filesystems[fs]
            instance = {
                "key": fs,  # name of filesystem
                "name": fs_info["name"],
                "protocol": fs_info["protocol"],
                "path": fs_info["name"],
                "prefix_path": fs_info["path"],
                "canonical_path": fs_info["canonical_path"],
                "kwargs": fs_info["kwargs"],
            }
            if fs_info.get("error", None):
                instance["error"] = fs_info["error"]
            file_systems.append(instance)

        self.set_status(200)
        self.write(
            {
                "status": "success",
                "description": "Retrieved available filesystems from configuration file.",
                "content": file_systems,
            }
        )
        await self.finish()


# ====================================================================================
# Handle Move and Copy Requests
# ====================================================================================
class FileActionHandler(JupyterFsspecHandler):
    def initialize(self, fs_manager):
        self.fs_manager = fs_manager

    # POST /jupyter_fsspec/files/action?key=my-key&item_path=/some_directory/file.txt
    @tornado.web.authenticated
    async def post(self):
        """Move or copy the resource at the input path to destination path.

        :param [key]: [Query arg string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [Query arg string path to file or directory to be retrieved]
        :param [action]: [Request body string move or copy]
        :param [content]: [Request body property file or directory path]

        :return: dict with a status, description and (optionally) error
        :rtype: dict
        """
        request_data = json.loads(self.request.body.decode("utf-8"))
        try:
            with handle_exception(
                self, status_code=400, default_msg="Error processing request payload."
            ):
                post_request = PostRequest(**request_data)
        except JupyterFsspecException:
            return

        key = post_request.key
        req_item_path = post_request.item_path
        action = post_request.action
        destination = post_request.content

        response = {}

        fs, item_path = self.fs_manager.validate_fs("post", key, req_item_path)
        fs_instance = fs["instance"]
        is_async = fs_instance.async_impl

        try:
            if action == "move":
                try:
                    with handle_exception(self):
                        (
                            await fs_instance._mv(item_path, destination)
                            if is_async
                            else fs_instance.mv(item_path, destination)
                        )
                except JupyterFsspecException:
                    return

                response["description"] = f"Moved {item_path} to {destination}."
            else:
                # if provided paths are not expanded fsspec expands them
                # for a list of paths: recursive=False or maxdepth not None
                try:
                    with handle_exception(self):
                        (
                            await fs_instance._copy(item_path, destination)
                            if is_async
                            else fs_instance.copy(item_path, destination)
                        )
                except JupyterFsspecException:
                    return

                response["description"] = f"Copied {item_path} to {destination}."
            response["status"] = "success"
            self.set_status(200)
        except Exception as e:
            traceback.print_exc()
            logger.error(f"Error calling move/copy handler: {e}")
            self.set_status(500)

        self.write(response)
        await self.finish()


# ====================================================================================
# Handle Move and Copy Requests Across filesystems
# ====================================================================================
class FileTransferHandler(JupyterFsspecHandler):
    def initialize(self, fs_manager):
        self.fs_manager = fs_manager

    # POST /jupyter_fsspec/files/action?key=my-key&item_path=/some_directory/file.txt
    @tornado.web.authenticated
    async def post(self):
        """Upload/Download the resource at the input path to destination path.

        :param [key]: [Query arg string used to retrieve the appropriate filesystem instance]
        :param [local_path]: [Request body string path to file/directory to be retrieved]
        :param [remote_path]: [Request body string path to file/directory to be modified]
        :param [action]: [Request body string upload or download]

        :return: dict with a status, description and (optionally) error
        :rtype: dict
        """
        request_data = json.loads(self.request.body.decode("utf-8"))
        try:
            with handle_exception(
                self, status_code=400, default_msg="Error processing request payload."
            ):
                transfer_request = TransferRequest(**request_data)
        except JupyterFsspecException:
            return

        key = transfer_request.key
        local_path = transfer_request.local_path  # source
        remote_path = transfer_request.remote_path  # destination
        dest_fs_key = transfer_request.destination_key
        dest_fs_info = self.fs_manager.get_filesystem(dest_fs_key)
        dest_path = dest_fs_info["canonical_path"]
        fs_info = self.fs_manager.get_filesystem(key)
        path = fs_info["canonical_path"]

        response = {}

        try:
            if transfer_request.action == Direction.UPLOAD:
                logger.debug("Upload file")
                fs, remote_path = self.fs_manager.validate_fs(
                    "post", dest_fs_key, remote_path
                )
                fs_instance = fs["instance"]
                try:
                    with handle_exception(self):
                        (
                            await fs_instance._put(
                                local_path, remote_path, recursive=True
                            )
                            if fs_instance.async_impl
                            else fs_instance.put(
                                local_path, remote_path, recursive=True
                            )
                        )
                except JupyterFsspecException:
                    return
                response["description"] = f"Uploaded {local_path} to {remote_path}."
            else:
                logger.debug("Download file")
                fs, dest_path = self.fs_manager.validate_fs("post", key, path)
                fs_instance = fs["instance"]

                try:
                    with handle_exception(self):
                        (
                            await fs_instance._get(
                                remote_path, local_path, recursive=True
                            )
                            if fs_instance.async_impl
                            else fs_instance.get(
                                remote_path, local_path, recursive=True
                            )
                        )
                except JupyterFsspecException:
                    return

                response["description"] = f"Downloaded {remote_path} to {local_path}."

            response["status"] = "success"
            self.set_status(200)
        except Exception as e:
            traceback.print_exc()
            logger.error(f"Error uploading/downloading file: {e}")
            self.set_status(500)

        self.write(response)
        await self.finish()


# ====================================================================================
# Handle Rename requests (?seperate or not?)
# ====================================================================================
class RenameFileHandler(JupyterFsspecHandler):
    def initialize(self, fs_manager):
        self.fs_manager = fs_manager

    @tornado.web.authenticated
    async def post(self):
        request_data = json.loads(self.request.body.decode("utf-8"))
        try:
            with handle_exception(
                self, status_code=400, default_msg="Error processing request payload."
            ):
                post_request = PostRequest(**request_data)
        except JupyterFsspecException:
            return

        key = post_request.key
        req_item_path = post_request.item_path
        content = post_request.content
        response = {}

        fs, item_path = self.fs_manager.validate_fs("post", key, req_item_path)
        fs_instance = fs["instance"]
        # expect item path to end with `/` for directories
        # expect content to be the FULL new path
        try:
            # when item_path is a directory, if recursive=True is not set,
            # path1 is deleted and path2 is not created
            try:
                with handle_exception(self):
                    (
                        await fs_instance._rename(item_path, content, recursive=True)
                        if fs_instance.async_impl
                        else fs_instance.rename(item_path, content, recursive=True)
                    )
            except JupyterFsspecException:
                return

            response["status"] = "success"
            response["description"] = f"Renamed {item_path} to {content}."
            self.set_status(200)
        except Exception as e:
            traceback.print_exc()
            logger.error(f"Error renaming file: {e}")
            self.set_status(500)

        self.write(response)
        await self.finish()


class FileContentsHandler(JupyterFsspecHandler):
    def initialize(self, fs_manager):
        self.fs_manager = fs_manager

    @tornado.web.authenticated
    async def get(self):
        request_data = {k: self.get_argument(k) for k in self.request.arguments}
        try:
            with handle_exception(
                self, status_code=400, default_msg="Error processing request payload."
            ):
                get_request = GetRequest(**request_data)
        except JupyterFsspecException:
            return

        key = get_request.key
        req_item_path = get_request.item_path

        try:
            with handle_exception(self):
                fs, item_path = self.fs_manager.validate_fs("get", key, req_item_path)
        except JupyterFsspecException:
            return

        fs_instance = fs["instance"]
        is_async = fs_instance.async_impl

        if "Range" in self.request.headers:
            # TODO: check size of read before executing
            range_header = self.request.headers["Range"]
            start, end = parse_range(range_header)
            self.set_header("Content-Range", f"bytes {start}-{end}")
        else:
            # TODO: this reads whole file in one shot and can kill process
            start = end = None

        logger.debug("Get contents %s (%s %s)", item_path, start, end)
        try:
            with handle_exception(self):
                result = (
                    await fs_instance._cat_file(item_path, start, end)
                    if is_async
                    else fs_instance.cat_file(item_path, start, end)
                )
        except JupyterFsspecException:
            return

        self.set_header("Content-Length", str(len(result)))
        self.set_header("Content-Type", "application/octet-stream")
        self.set_status(200)
        self.write(result)
        await self.finish()

    @tornado.web.authenticated
    async def post(self):
        body = self.request.body
        request_data = {k: self.get_argument(k) for k in self.request.arguments}
        key = request_data["key"]
        item_path = request_data["item_path"]

        fs, item_path = self.fs_manager.validate_fs("post", key, item_path)
        fs_instance = fs["instance"]

        try:
            with handle_exception(self):
                await fs_instance._pipe_file(item_path, body)
        except JupyterFsspecException:
            return

        self.set_status(201)
        await self.finish()


# ====================================================================================
# CRUD for FileSystem
# ====================================================================================
class FileSystemHandler(JupyterFsspecHandler):
    def initialize(self, fs_manager):
        self.fs_manager = fs_manager

    async def process_content(self, content):
        """Determine correct content encoding before writing to storage."""

        if content:
            try:
                content = base64.b64decode(content)
            except (binascii.Error, UnicodeDecodeError) as e:
                logger.error(f"Error decoding base64: {e}")
                raise
        return content

    # GET
    # /files
    @tornado.web.authenticated
    async def get(self):
        """Retrieve list of files for directories

        :param [key]: [Query arg string corresponding to the appropriate filesystem instance]
        :param [item_path]: [Query arg string path to file or directory to be retrieved], defaults to [root path of the active filesystem]
        :param [type]: [Optional query arg identifying the type of directory search or file content retrieval
        if type is "find" recursive files/directories listed;
        if type is "range", returns specified byte range content;
        defaults to "default" for one level deep directory contents and single file entire contents]

        :return: dict with a status, description and content/error
            content being a list of files, file information
        :rtype: dict
        """
        # GET /jupyter_fsspec/files?key=my-key&item_path=/some_directory/of_interest
        # GET /jupyter_fsspec/files?key=my-key
        #  item_path: /some_directory/file.txt
        # GET /jupyter_fsspec/files?key=my-key&item_path=/some_directory/file.txt&type=range
        # content header specifying the byte range
        request_data = {k: self.get_argument(k) for k in self.request.arguments}
        try:
            with handle_exception(
                self, status_code=400, default_msg="Error processing request payload."
            ):
                get_request = GetRequest(**request_data)
        except JupyterFsspecException:
            return

        key = get_request.key
        req_item_path = get_request.item_path
        refresh = get_request.refresh

        fs, item_path = self.fs_manager.validate_fs("get", key, req_item_path)

        fs_instance = fs["instance"]
        response = {}

        try:
            with handle_exception(self):
                is_async = fs_instance.async_impl
                result = (
                    await fs_instance._ls(item_path, detail=True, refresh=refresh)
                    if is_async
                    else fs_instance.ls(item_path, detail=True, refresh=refresh)
                )
        except JupyterFsspecException:
            return

        detail_to_keep = ["name", "type", "size", "ino", "mode"]
        filtered_result = [
            {info: item_dict[info] for info in detail_to_keep if info in item_dict}
            for item_dict in result
        ]
        response["content"] = filtered_result
        root_path = self.fs_manager.name_to_prefix[key]
        mapped_result = self.fs_manager.map_paths(root_path, key, filtered_result)
        response["content"] = mapped_result
        self.write(response)
        await self.finish()

    # PUT /jupyter_fsspec/files?key=my-key&item_path=/some_directory/file.txt
    # JSON Payload
    # content
    @tornado.web.authenticated
    async def put(self):
        """Update ENTIRE content in file.

        :param [key]: [Query arg string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [Query arg string path to file or directory to be retrieved]
        :param [content]: [Request body property file content]

        :return: dict with a status, description and (optionally) error
        :rtype: dict
        """
        request_data = json.loads(self.request.body.decode("utf-8"))
        try:
            with handle_exception(
                self, status_code=400, default_msg="Error processing request payload."
            ):
                post_request = PostRequest(**request_data)
        except JupyterFsspecException:
            return

        key = post_request.key
        req_item_path = post_request.item_path
        content = post_request.content

        fs, item_path = self.fs_manager.validate_fs("put", key, req_item_path)
        fs_instance = fs["instance"]
        is_async = fs_instance.async_impl
        response = {}

        if not isinstance(content, bytes):
            if isinstance(content, str):
                content = content.encode("utf-8")
            else:
                raise TypeError("Unsupported type, cannot convert to bytes")

        try:
            try:
                with handle_exception(self):
                    isfile = (
                        await fs_instance._isfile(item_path)
                        if is_async
                        else fs_instance.isfile(item_path)
                    )
            except JupyterFsspecException:
                return

            if not isfile:
                raise FileNotFoundError(f"{item_path} is not a file.")

            try:
                with handle_exception(self):
                    (
                        await fs_instance._pipe(item_path, content)
                        if is_async
                        else fs_instance.pipe(item_path, content)
                    )
            except JupyterFsspecException:
                return

            response["status"] = "success"
            response["description"] = f"Updated file {item_path}."
            self.set_status(200)
        except Exception as e:
            traceback.print_exc()
            logger.error(f"Error calling put handler: {e}")
            self.set_status(500)

        self.write(response)
        await self.finish()

    # DELETE /jupyter_fsspec/files?key=my-key&item_path=/some_directory/file.txt
    @tornado.web.authenticated
    async def delete(self):
        """Delete the resource at the input path.

        :param [key]: [Query arg string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [Query arg string path to file or directory to be retrieved]

        :return: dict with a status, description and (optionally) error
        :rtype: dict
        """
        request_data = json.loads(self.request.body.decode("utf-8"))
        try:
            with handle_exception(
                self, status_code=400, default_msg="Error processing request payload."
            ):
                delete_request = DeleteRequest(**request_data)
        except JupyterFsspecException:
            return

        key = delete_request.key
        req_item_path = delete_request.item_path

        fs, item_path = self.fs_manager.validate_fs("delete", key, req_item_path)
        fs_instance = fs["instance"]
        is_async = fs_instance.async_impl
        response = {}

        try:
            try:
                with handle_exception(self):
                    (
                        await fs_instance._rm(item_path)
                        if is_async
                        else fs_instance.rm(item_path)
                    )
            except JupyterFsspecException:
                return

            self.set_status(200)
            response["status"] = "success"
            response["description"] = f"Deleted {item_path}."
        except Exception as e:
            traceback.print_exc()
            logger.error(f"Error calling delete handler: {e}")
            self.set_status(500)

        self.write(response)
        await self.finish()


def setup_handlers(web_app):
    host_pattern = ".*$"

    allow_abs_path = web_app.settings.get("jupyter_fsspec_allow_abs", True)
    fs_manager = FileSystemManager.create_default(allow_absolute_paths=allow_abs_path)

    base_url = web_app.settings["base_url"]
    route_fsspec_config = url_path_join(base_url, "jupyter_fsspec", "config")

    route_files = url_path_join(base_url, "jupyter_fsspec", "files")
    route_file_actions = url_path_join(base_url, "jupyter_fsspec", "files", "action")
    route_rename_files = url_path_join(base_url, "jupyter_fsspec", "files", "rename")
    route_fs_file_transfer = url_path_join(
        base_url, "jupyter_fsspec", "files", "transfer"
    )
    contents = url_path_join(base_url, "jupyter_fsspec", "files", "contents")

    handlers = [
        (route_fsspec_config, FsspecConfigHandler, dict(fs_manager=fs_manager)),
        (route_files, FileSystemHandler, dict(fs_manager=fs_manager)),
        (route_rename_files, RenameFileHandler, dict(fs_manager=fs_manager)),
        (route_file_actions, FileActionHandler, dict(fs_manager=fs_manager)),
        (route_fs_file_transfer, FileTransferHandler, dict(fs_manager=fs_manager)),
        (contents, FileContentsHandler, dict(fs_manager=fs_manager)),
    ]

    web_app.add_handlers(host_pattern, handlers)


async def main():
    port = 9898  # or from CLI args
    # mock login to bypass tornado auth
    APIHandler.get_current_user = lambda *_, **__: "tester"
    app = tornado.web.Application(base_url=".*")
    app.settings["jupyter_fsspec_allow_abs"] = True
    setup_handlers(app)

    app.listen(port)
    shutdown = asyncio.Event()
    try:
        await shutdown.wait()
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass


if __name__ == "__main__":
    import fsspec

    # make sure memFS contains something
    m = fsspec.filesystem("memory")
    m.pipe_file("mytests/afile", b"hello")
    print("http://127.0.0.1:9898/")
    asyncio.run(main())
