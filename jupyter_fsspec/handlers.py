from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import json

from .file_manager import FileSystemManager
from .utils import parse_range

fs_manager = FileSystemManager('jupyter-fsspec.yaml')

class FsspecConfigHandler(APIHandler):
    """

    Args:
        APIHandler (_type_): _description_
    """
    @tornado.web.authenticated
    def get(self):
        """Retrieve filesystems information from configuration file.

        :return: dict with filesystems key and list of filesystem information objects
        :rtype: dict
        """
        try:
            file_systems = [];
            for fs in fs_manager.filesystems:
                fs_info = fs_manager.filesystems[fs]
                instance = {"key": fs, 'name': fs_info['name'], 'type': fs_info['type'], 'path': fs_info['path'] }
                file_systems.append(instance)

            self.set_status(200)
            self.write({'filesystems': file_systems})
            self.finish()
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": f"Error loading config: {str(e)}"})
            self.finish()

class FileSystemHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        """Retrieve list of files for directories or contents for files.

        :param [key]: [Query arg string corresponding to the appropriate filesystem instance]
        :param [item_path]: [Query arg string path to file or directory to be retrieved], defaults to [root path of the active filesystem]
        :param [type]: [Query arg identifying the type of directory search or file content retrieval
        if type is "find" recursive files/directories listed; if type is "range", returns specified byte range content], defaults to [empty string for one level deep directory contents and single file entire contents]

        :raises [ValueError]: [Missing required key parameter]
        :raises [ValueError]: [No filesystem identified for provided key]

        :return: dict with either list of files or file information under the `files` key-value pair and `status` key for reuest info  
        :rtype: dict
        """
        try:
            key = self.get_argument('key')
            item_path = self.get_argument('item_path')
            type = self.get_argument('type')

            if not key:
                raise ValueError("Missing required parameter `key`")
            # if not item_path:
                # raise ValueError("Missing required parameter `item_path`")
                
            fs = fs_manager.get_filesystem(key)

            if not item_path:
                if type is not 'range':
                    item_path = fs_manager.filesystems[key]["path"]
                else:
                    raise ValueError("Missing required parameter `item_path`")

            if fs is None:
                raise ValueError(f"No filesystem found for key: {key}")

            if type == 'find':
                result = fs_manager.read(key, item_path, find=True)
            elif type == 'range': # add check for Range specific header
                range_header = self.request.headers.get('Range')
                start, end = parse_range(range_header)

                result = fs_manager.open(key, item_path, start, end)
                self.set_status(result["status_code"])
                self.set_header('Content-Range', f'bytes {start}-{end}')
                self.finish(result["data"])
                return
            else:
                result = fs_manager.read(key, item_path)

            self.set_status(result["status_code"])
            self.write({"status": result["status"], "files": result["body"]})
            self.finish()
        except Exception as e:
            print("Error requesting read: ", e)
            self.set_status(500)
            self.write({"status": "Error", "message": f"Error occurred: {str(e)}"})
            self.finish()

    #TODO: add actions: write, move, copy (separate functions)
    @tornado.web.authenticated
    def post(self):
        """Create directories/files or perform other directory/file operations like move and copy

        :param [key]: [request body property string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [request body property string path to file or directory to be retrieved], defaults to [root path of the active filesystem]
        :param [content]: [request body property either file content, directory name, or destination path for advanced move and copy functions]
        :param [action]: [query parameter ], defaults to ["write" string value for creating a directory or a file]

        :raises [ValueError]: [Missing either of required parameters key or item_path]
        :raises [ValueError]: [No filesystem identified for provided key]
        :raises [ValueError]: [Required parameter does not match operation.]

        :return: dict with request status indicator
        :rtype: dict
        """
        try:
            action = self.get_argument('action')
            print(f"action is: {action}")
            request_data = json.loads(self.request.body.decode('utf-8'))

            key = request_data.get('key')
            item_path = request_data.get('item_path')

            if not (key) or not (item_path):
                raise ValueError("Missing required parameter `key` or `item_path`")

            content = request_data.get('content').encode('utf-8')

            fs = fs_manager.get_filesystem(key)
            if fs is None:
                raise ValueError(f"No filesystem found for key: {key}")

            if action == 'move':
                print(f"move")
                src_path = item_path
                dest_path = content.decode('utf-8')
                print(f"dest_path is: {dest_path}")
                if not fs_manager.exists(key, dest_path):
                    raise ValueError('Required parameter `content` is not a valid destination path for move action.')
                else:
                    fs_manager.move(key, src_path, content)
                    result = {"status_code": 200, "status": "success!"}
            elif action == 'copy':
                print('copy')
            else: # assume write
                result = fs_manager.write(key, item_path, content)

            self.set_status(result["status_code"])
            self.write({"status": result["status"]})
            self.finish()
        except Exception as e:
            print(f"Error requesting post: ", e)
            self.set_status(500)
            self.write({"status": "Error", "message": f"Error occurred: {str(e)}"})
            self.finish()

    @tornado.web.authenticated
    def put(self):
        """Update 

        :param [key]: [request body property string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [request body property string path to file to be retrieved]
        :param [content]: [request body property with file content]

        :raises [ValueError]: [Missing either of required parameters key or item_path]
        :raises [ValueError]: [No filesystem identified for provided key]

        :return: dict with request status indicator
        :rtype: dict
        """
        try:
            request_data = json.loads(self.request.body.decode('utf-8'))

            key = request_data.get('key')
            item_path = request_data.get('item_path')

            if not (key) or not (item_path):
                raise ValueError("Missing required parameter `key` or `item_path`")

            content = request_data.get('content')

            fs = fs_manager.get_filesystem(key)
            if fs is None:
                raise ValueError(f"No filesystem found for key: {key}")

            result = fs_manager.update(key, item_path, content)

            self.set_status(result["status_code"])
            self.write({"status": result["status"]})
            self.finish()
        except Exception as e:
            self.set_status(500)
            self.write({"status": "Error", "message": f"Error occurred: {str(e)}"})
            self.finish()

    @tornado.web.authenticated
    def delete(self):
        """Delete the resource at the input path.

        :param [key]: [request body property string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [request body property string path to file or directory to be retrieved]

        :raises [ValueError]: [Missing either of required parameters key or item_path]
        :raises [ValueError]: [No filesystem identified for provided key]

        :return: dict with request status indicator
        :rtype: dict
        """
        try:
            request_data = json.loads(self.request.body.decode('utf-8'))

            key = request_data.get('key')
            item_path = request_data.get('item_path')

            if not (key) or not (item_path):
                raise ValueError("Missing required parameter `key` or `item_path`")

            fs = fs_manager.get_filesystem(key)
            if fs is None:
                raise ValueError(f"No filesystem found for key: {key}")

            result = fs_manager.delete(key, item_path)
            self.set_status(result["status_code"])
            self.write({"status": result["status"]})
            self.finish()
        except ValueError as e:
            self.set_status(400)
            self.write({"error": f"{str(e)}"})
            self.finish()
        except Exception as e:
            self.set_status(500)
            self.write({"status": "Error", "message": f"Error occurred: {str(e)}"})
            self.finish()

#====================================================================================
# Update the handler in setup
#====================================================================================
def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_fsspec_config = url_path_join(base_url, "jupyter_fsspec", "config")
    route_fsspec = url_path_join(base_url, "jupyter_fsspec", "fsspec")
    handlers = [(route_fsspec_config, FsspecConfigHandler), (route_fsspec, FileSystemHandler)]
    web_app.add_handlers(host_pattern, handlers)
