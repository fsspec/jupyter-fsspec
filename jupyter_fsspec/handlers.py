from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import json
import traceback
import asyncio

from .file_manager import FileSystemManager
from .utils import parse_range


class BaseFileSystemHandler(APIHandler):
    def initialize(self, fs_manager):
        self.fs_manager = fs_manager

    def validate_fs(self, request_type, key, item_path):
        """Retrieve the filesystem instance and path of the item

        :raises [ValueError]: [Missing required key parameter]
        :raises [ValueError]: [Missing required parameter item_path]
        :raises [ValueError]: [No filesystem identified for provided key]

        :return: filesystem instance and item_path 
        :rtype: fsspec filesystem instance and string 
        """

        if not key:
                raise ValueError("Missing required parameter `key`")

        fs = self.fs_manager.get_filesystem(key)

        if not item_path:
            if type != 'range' and request_type == 'get':
                item_path = self.fs_manager.filesystems[key]["path"]
            else:
                raise ValueError("Missing required parameter `item_path`")

        if fs is None:
            raise ValueError(f"No filesystem found for key: {key}")
        
        return fs, item_path

class FsspecConfigHandler(APIHandler):
    """

    Args:
        APIHandler (_type_): _description_
    """
    def initialize(self, fs_manager):
        self.fs_manager = fs_manager

    @tornado.web.authenticated
    def get(self):
        """Retrieve filesystems information from configuration file.

        :return: dict with filesystems key and list of filesystem information objects
        :rtype: dict
        """
        try:
            self.fs_manager.check_reload_config()
            file_systems = []

            for fs in self.fs_manager.filesystems:
                fs_info = self.fs_manager.filesystems[fs]
                instance = {"key": fs, 'name': fs_info['name'], 'protocol': fs_info['protocol'], 'path': fs_info['path'], 'canonical_path': fs_info['canonical_path'] }
                file_systems.append(instance)
            self.set_status(200)
            self.write({'status': 'success', 'description': 'Retrieved available filesystems from configuration file.', 'content': file_systems})
            self.finish()
        except Exception as e:
            traceback.print_exc()
            self.set_status(404)
            self.write({"response": {"status": "failed", "error": "FILE_NOT_FOUND", "description": f"Error loading config: {str(e)}"}})
            self.finish()


#====================================================================================
# Handle Move and Copy Requests
#====================================================================================
class FileActionHandler(BaseFileSystemHandler):
    def initialize(self, fs_manager):
        self.fs_manager = fs_manager

    # POST /jupyter_fsspec/files/action?key=my-key&item_path=/some_directory/file.txt
    async def post(self):
        """Move or copy the resource at the input path to destination path.

        :param [key]: [Query arg string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [Query arg string path to file or directory to be retrieved]
        :param [action]: [Request body string move or copy]
        :param [content]: [Request body property file or directory path]

        :return: dict with a status, description and (optionally) error
        :rtype: dict
        """
        key = self.get_argument('key')
        request_data = json.loads(self.request.body.decode('utf-8'))
        req_item_path = request_data.get('item_path')
        action = request_data.get('action')
        destination = request_data.get('content')
        response = {"content": None}

        fs, item_path = self.validate_fs('post', key, req_item_path)
        fs_instance = fs["instance"]

        try:
            if action == 'move':
                fs_instance.mv(item_path, destination)
                response["description"] = f"Moved {item_path} to {destination}."
            else:
                if fs_instance.async_impl:
                    # if provided paths are not expanded fsspec expands them
                    # for a list of paths: recursive=False or maxdepth not None
                    await fs_instance._copy(item_path, destination)
                else:
                    fs_instance.copy(item_path, destination)
                response["description"] = f"Copied {item_path} to {destination}."
            response["status"] = "success"
            self.set_status(200)
        except Exception as e:
            self.set_status(500)
            response["status"] = "Failed"
            response["description"] = str(e)

        self.write(response)
        self.finish()

#====================================================================================
# Handle Move and Copy Requests Across filesystems
#====================================================================================
class FileTransferHandler(BaseFileSystemHandler):
    def initialize(self, fs_manager):
        self.fs_manager = fs_manager

    # POST /jupyter_fsspec/files/action?key=my-key&item_path=/some_directory/file.txt
    def post(self):
        """Upload/Download the resource at the input path to destination path.

        :param [key]: [Query arg string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [Query arg string path to file or directory to be retrieved]
        :param [action]: [Request body string move or copy]
        :param [content]: [Request body property file or directory path]

        :return: dict with a status, description and (optionally) error
        :rtype: dict
        """
        key = self.get_argument('key')
        request_data = json.loads(self.request.body.decode('utf-8'))
        req_item_path = request_data.get('item_path')
        action = request_data.get('action')
        destination = request_data.get('content')
        # dest_fs_key = request_data.get('destination_key')
        # dest_fs_info = self.fs_manager.get_filesystem(dest_fs_key)
        # dest_path = dest_fs_info["path"]

        response = {"content": None}

        fs, item_path = self.validate_fs('post', key, req_item_path)
        fs_instance = fs["instance"]

        try:
            if action == 'upload':
                # upload     fs_instance.put(local_path, remote_path)
                fs_instance.put(item_path, destination)
                response["description"] = f"Uploaded {item_path} to {destination}."
            else: # download
                # download   fs_instance.get(remote_path, local_path)
                fs_instance.get(destination, item_path)
                response["description"] = f"Downloaded {destination} to {item_path}."

            response["status"] = "success"
            self.set_status(200)
        except Exception as e:
            self.set_status(500)
            response["status"] = "failed"
            response["description"] = str(e)

        self.write(response)
        self.finish()

#====================================================================================
# Handle Rename requests (?seperate or not?)
#====================================================================================
class RenameFileHandler(BaseFileSystemHandler):
    def initialize(self, fs_manager):
        self.fs_manager = fs_manager

    def post(self):
        key = self.get_argument('key')

        request_data = json.loads(self.request.body.decode('utf-8'))
        req_item_path = request_data.get('item_path')
        content = request_data.get('content')
        response = {"content": None}

        fs, item_path = self.validate_fs('post', key, req_item_path)
        fs_instance = fs["instance"]
        # expect item path to end with `/` for directories
        # expect content to be the FULL new path 
        try:
            # when item_path is a directory, if recursive=True is not set, 
            # path1 is deleted and path2 is not created
            fs_instance.rename(item_path, content, recursive=True)
            response["status"] = "success"
            response["description"] = f"Renamed {item_path} to {content}."
            self.set_status(200)
        except Exception as e:
            self.set_status(500)
            response["status"] = "failed"
            response["description"] = str(e)

        self.write(response)
        self.finish()

#====================================================================================
# CRUD for FileSystem
#====================================================================================
class FileSystemHandler(BaseFileSystemHandler):
    def initialize(self, fs_manager):
        self.fs_manager = fs_manager

    # GET
    # /files
    async def get(self):
        """Retrieve list of files for directories or contents for files.

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
        key = self.get_argument('key')
        req_item_path = self.get_argument('item_path')
        type = self.get_argument('type', default='default')

        fs, item_path = self.validate_fs('get', key, req_item_path)

        fs_instance = fs["instance"]
        response = {"content": None}

        try:
            if fs_instance.async_impl:
                isdir = await fs_instance._isdir(item_path)
            else:
                isdir = fs_instance.isdir(item_path)

            if type == 'range':
                range_header = self.request.headers.get('Range')
                start, end = parse_range(range_header)
                if fs_instance.async_impl:
                    result = await fs_instance._cat_ranges([item_path], [int(start)], [int(end)])
                    if isinstance(result, bytes):
                        result = result.decode('utf-8')
                    response["content"] = result
                else:
                    #TODO:
                    result = fs_instance.cat_ranges([item_path], [int(start)], [int(end)])
                    if isinstance(result[0], bytes):
                        result = result[0].decode('utf-8')
                    response["content"] = result
                self.set_header('Content-Range', f'bytes {start}-{end}')
            elif isdir:
                if fs_instance.async_impl:
                    result = await fs_instance._ls(item_path, detail=True)
                else:
                    result = fs_instance.ls(item_path, detail=True)

                detail_to_keep = ["name", "type", "size", "ino", "mode"]
                filtered_result = [{info: item_dict[info] for info in detail_to_keep if info in item_dict} for item_dict in result]
                response["content"] = filtered_result
            else:
                if fs_instance.async_impl:
                    result = await fs_instance._cat(item_path)
                    if isinstance(result, bytes):
                        result = result.decode('utf-8')
                    response["content"] = result
                else:
                    result = fs_instance.cat(item_path)
                    if isinstance(result, bytes):
                        result = result.decode('utf-8')
                    response["content"] = result
            self.set_status(200)
            response["status"] = "success"
            response["description"] = f"Retrieved {item_path}."
        except Exception as e:
            self.set_status(500)
            response["status"] = "failed"
            response["description"] = str(e)
        self.write(response)
        self.finish()

   # POST /jupyter_fsspec/files?key=my-key
        # JSON Payload
            # item_path=/some_directory/file.txt
            # content
    async def post(self):
        """Create directories/files or perform other directory/file operations like move and copy

        :param [key]: [Query arg string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [Query arg string path to file or directory to be retrieved]
        :param [content]: [Request body property file content, or directory name]

        :return: dict with a status, description and (optionally) error
        :rtype: dict
        """
        key = self.get_argument('key')
        request_data = json.loads(self.request.body.decode('utf-8'))
        req_item_path = request_data.get('item_path')
        content = request_data.get('content')

        fs, item_path = self.validate_fs('post', key, req_item_path)
        fs_instance = fs["instance"]
        response = {"content": None}

        try:
            # directory expect item_path to end with `/`
            if item_path.endswith('/'):
                #content is then expected to be null
                if fs_instance.async_impl:
                    await fs_instance._mkdir(item_path, exists_ok=True)
                else:
                    fs_instance.mkdir(item_path, exists_ok=True)
            else:
                # file name expected in item_path
                if fs_instance.async_impl:
                    await fs_instance._touch(item_path)
                    if content:
                        if not isinstance(content, bytes):
                            content = str.encode(content)
                        await fs_instance._pipe(item_path, content)
                else:
                    fs_instance.touch(item_path)
                    if content:
                        if not isinstance(content, bytes):
                            content = str.encode(content)
                        fs_instance.pipe(item_path, content)

            self.set_status(200)
            response["status"] = "success"
            response["description"] = f"Wrote {item_path}."
        except Exception as e:
            self.set_status(500)
            response["status"] = "failed"
            response["description"] = str(e)
        self.write(response)
        self.finish()

    # PUT /jupyter_fsspec/files?key=my-key&item_path=/some_directory/file.txt
        # JSON Payload
            # content 
    async def put(self):
        """Update ENTIRE content in file.

        :param [key]: [Query arg string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [Query arg string path to file or directory to be retrieved]
        :param [content]: [Request body property file content]

        :return: dict with a status, description and (optionally) error
        :rtype: dict
        """
        key = self.get_argument('key')
        request_data = json.loads(self.request.body.decode('utf-8'))
        req_item_path = request_data.get('item_path')
        content = request_data.get('content')

        fs, item_path = self.validate_fs('put', key, req_item_path)
        fs_instance = fs["instance"]
        response = {"content": None}

        if not isinstance(content, bytes):
            if isinstance(content, str):
                content = content.encode('utf-8')
            else:
                raise TypeError("Unsupported type, cannot convert to bytes")

        try:
            if fs_instance.async_impl:
                isfile = await fs_instance.isfile(item_path)
            else:
                isfile = fs_instance.isfile(item_path)

            if not isfile:
                raise FileNotFoundError(f"{item_path} is not a file.")

            if fs_instance.async_impl:
                await fs_instance._pipe(item_path, content)
            else:
                fs_instance.pipe(item_path, content)
            response["status"] = "success"
            response["description"] = f"Updated file {item_path}."
            self.set_status(200)
        except Exception as e:
            self.set_status(500)
            response["status"] = "failed"
            response["description"] = str(e)

        self.write(response)
        self.finish()

    async def patch(self):
        # Update PARTIAL file content 
        key = self.get_argument('key')
        request_data = json.loads(self.request.body.decode('utf-8'))
        req_item_path = request_data.get('item_path')
        offset = request_data.get('offset')
        content = request_data.get('content')

        fs, item_path = self.validate_fs('patch', key, req_item_path)
        fs_instance = fs["instance"]

        #TODO: offset
        response = {"content": None}

        try:
            if fs_instance.async_impl:
                isfile = await fs_instance.isfile(item_path)
            else:
                isfile = fs_instance.isfile(item_path)

            if not isfile:
                raise FileNotFoundError(f"{item_path} is not a file.")

            if fs_instance.async_impl:
                original_content = await fs_instance._cat(item_path)
            else:
                original_content = fs_instance.cat(item_path)
    
            new_content = (original_content[:offset] + content + 
                        original_content[offset + len(content):])
            
            if fs_instance.async_impl:
                await fs_instance._pipe(item_path, new_content)
            else:
                fs_instance.pipe(item_path, new_content)
            self.set_status(200)
            response["status"] = "success"
            response["description"] = f"Patched file {item_path} at offset {offset}."
        except Exception as e:
            self.set_status(500)
            response["status"] = "failed"
            response["description"] = str(e)

        self.write(response)
        self.finish()


    # DELETE /jupyter_fsspec/files?key=my-key&item_path=/some_directory/file.txt
    async def delete(self):
        """Delete the resource at the input path.

        :param [key]: [Query arg string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [Query arg string path to file or directory to be retrieved]

        :return: dict with a status, description and (optionally) error
        :rtype: dict
        """
        key = self.get_argument('key')
        request_data = json.loads(self.request.body.decode('utf-8'))
        req_item_path = request_data.get('item_path')

        fs, item_path = self.validate_fs('delete', key, req_item_path)
        fs_instance = fs["instance"]
        response = {"content": None}
        
        try:
            if fs_instance.async_impl:
                await fs_instance._rm(item_path)
            else:
                fs_instance.rm(item_path)
            self.set_status(200)
            response["status"] = "success"
            response["description"] = f"Deleted {item_path}."
        except Exception as e:
            self.set_status(500)
            response["status"] = "failed"
            response["description"] = str(e)

        self.write(response)
        self.finish()


def setup_handlers(web_app):
    host_pattern = ".*$"

    fs_manager = FileSystemManager.create_default()

    base_url = web_app.settings["base_url"]
    route_fsspec_config = url_path_join(base_url, "jupyter_fsspec", "config")

    route_files = url_path_join(base_url, "jupyter_fsspec", "files")
    route_file_actions = url_path_join(base_url, "jupyter_fsspec", "files", "action")
    route_rename_files = url_path_join(base_url, "jupyter_fsspec", "files", "rename")
    route_fs_file_transfer = url_path_join(base_url, "jupyter_fsspec", "files", "transfer")

    handlers = [
        (route_fsspec_config, FsspecConfigHandler, dict(fs_manager=fs_manager)),
        (route_files, FileSystemHandler, dict(fs_manager=fs_manager)),
        (route_rename_files, RenameFileHandler, dict(fs_manager=fs_manager)),
        (route_file_actions, FileActionHandler, dict(fs_manager=fs_manager)),
        (route_fs_file_transfer, FileTransferHandler, dict(fs_manager=fs_manager)),
    ]

    web_app.add_handlers(host_pattern, handlers)
