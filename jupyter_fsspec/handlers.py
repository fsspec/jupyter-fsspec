from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import json

from .file_manager import FileSystemManager
from .utils import parse_range

fs_manager = FileSystemManager('jupyter-fsspec.yaml')

class BaseFileSystemHandler(APIHandler):
    fs_manager = fs_manager

    def validate_fs(self, request_type):
        """Retrieve the filesystem instance and path of the item

        :raises [ValueError]: [Missing required key parameter]
        :raises [ValueError]: [No filesystem identified for provided key]
        :raises [ValueError]: [No filesystem identified for provided key]

        :return: filesystem instance and item_path 
        :rtype: fsspec filesystem instance and string 
        """
        key = self.get_argument('key', None)
        item_path = self.get_argument('item_path', None)

        if not key:
                raise ValueError("Missing required parameter `key`")

        fs = fs_manager.get_filesystem(key)

        if not item_path:
            if type != 'range' and request_type == 'get':
                item_path = fs_manager.filesystems[key]["path"]
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
            self.write({'status': 'success', 'description': 'Retrieved available filesystems from configuration file.', 'content': file_systems})
            self.finish()
        except Exception as e:
            # TODO: update error messaging here to appropriately handle other types of exceptions.
            self.set_status(404)
            self.write({"response": {"status": "failed", "error": "FILE_NOT_FOUND", "description": f"Error loading config: {str(e)}"}})
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

        :return: dict with either list of files or file information under the `files` key-value pair and `status` key for request info  
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
            fs_type = fs['type']

            if fs_type == 'memory':
                print (f"accessed memory filesystem")
                result = fs_manager.accessMemoryFS(key, item_path)
                self.set_status(result['status_code'])
                self.finish(result['response'])
                return

            if not item_path:
                if type != 'range':
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
                self.finish(result['response'])
                return
            else:
                result = fs_manager.read(key, item_path)

            self.set_status(result["status_code"])
            self.write(result['response'])
            self.finish()
            return
        except Exception as e:
            print("Error requesting read: ", e)
            self.set_status(500)
            self.write({"status": "failed", "error": "ERROR_REQUESTING_READ", "description": f"Error occurred: {str(e)}"})
            self.finish()

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
            self.write(result['response'])
            self.finish()
        except Exception as e:
            print(f"Error requesting post: ", e)
            self.set_status(500)
            self.write({"status": "failed", "error": "ERROR_REQUESTING_POST", "description": f"Error occurred: {str(e)}"})
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
            self.write(result['response'])
            self.finish()
        except Exception as e:
            self.set_status(500)
            self.write({"status": "failed", "error": "ERROR_REQUESTING_PUT", "description": f"Error occurred: {str(e)}"})
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
            self.write(result['response'])
            self.finish()
        except ValueError as e:
            self.set_status(400)
            self.write({"status": "failed", "error": "MISSING_PARAMETER", "description": f"{str(e)}"})
            self.finish()
        except Exception as e:
            self.set_status(500)
            self.write({"status": "failed", "error": "ERROR_REQUESTING_DELETE" , "description": f"Error occurred: {str(e)}"})
            self.finish()

class FileReadHandler(BaseFileSystemHandler):
    # GET
    # /files
    def get(self):
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
        # GET /jupyter_fsspec/files?key=my-key&item_path=/some_directory/file.txt
        # GET /jupyter_fsspec/files?key=my-key&item_path=/some_directory/file.txt&type=range
            # content header specifying the byte range
        try:
            key = self.get_argument('key')
            item_path = self.get_argument('item_path')
            type = self.get_argument('type', default='default')

 
            fs, item_path = self.validate_fs('get')

            if type == 'find':
                result = fs_manager.read(key, item_path, find=True)
            elif type == 'range': # add check for Range specific header
                range_header = self.request.headers.get('Range')
                start, end = parse_range(range_header)

                result = fs_manager.open(key, item_path, start, end)
                self.set_status(result["status_code"])
                self.set_header('Content-Range', f'bytes {start}-{end}')
                self.finish(result['response'])
                return
            else:
                result = fs_manager.read(key, item_path)

            self.set_status(result["status_code"])
            self.write(result['response'])
            self.finish()
            return
        except Exception as e:
            print("Error requesting read: ", e)
            self.set_status(500)
            self.send_response({"status": "failed", "error": "ERROR_REQUESTING_READ", "description": f"Error occurred: {str(e)}"})

class FileWriteHandler(APIHandler):
    # POST /jupyter_fsspec/files?key=my-key&item_path=/some_directory/file.txt
        # JSON Payload
            # content
    def post(self):
        """Create directories/files or perform other directory/file operations like move and copy

        :param [key]: [Query arg string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [Query arg string path to file or directory to be retrieved]
        :param [content]: [Request body property file content, or directory name]

        :return: dict with a status, description and (optionally) error
        :rtype: dict
        """
        key = self.get_argument('key')
        item_path = self.get_argument('item_path')
        request_data = json.loads(self.request.body.decode('utf-8'))
        content = request_data.get('content')

        fs, item_path = self.validate_fs('post')

        result = fs_manager.write(key, item_path, content)

        self.set_status(result["status_code"])
        self.write(result['response'])
        self.finish()

    # PUT /jupyter_fsspec/files?key=my-key&item_path=/some_directory/file.txt
        # JSON Payload
            # content
    def put(self):
        """Update content in file.

        :param [key]: [Query arg string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [Query arg string path to file or directory to be retrieved]
        :param [content]: [Request body property file content]

        :return: dict with a status, description and (optionally) error
        :rtype: dict
        """
        key = self.get_argument('key')
        item_path = self.get_argument('item_path')
        request_data = json.loads(self.request.body.decode('utf-8'))
        content = request_data.get('content')

        fs, item_path = self.validate_fs('put')

        result = fs_manager.write(key, item_path, content)

        self.set_status(result["status_code"])
        self.write(result['response'])
        self.finish()

class FileDeleteHandler(APIHandler):
    # DELETE /jupyter_fsspec/files?key=my-key&item_path=/some_directory/file.txt
    def delete(self):
        """Delete the resource at the input path.

        :param [key]: [Query arg string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [Query arg string path to file or directory to be retrieved]

        :return: dict with a status, description and (optionally) error
        :rtype: dict
        """
        key = self.get_argument('key')
        item_path = self.get_argument('item_path')

        fs, item_path = self.validate_fs('delete')

        result = fs_manager.delete(key, item_path)

        self.set_status(result["status_code"])
        self.write(result['response'])
        self.finish()

class FileActionHandler(APIHandler):
    # POST /jupyter_fsspec/files/action?key=my-key&item_path=/some_directory/file.txt
    def post(self):
        """Move or copy the resource at the input path to destination path.

        :param [key]: [Query arg string used to retrieve the appropriate filesystem instance]
        :param [item_path]: [Query arg string path to file or directory to be retrieved]
        :param [action]: [Request body string move or copy]
        :param [content]: [Request body property file or directory path]

        :return: dict with a status, description and (optionally) error
        :rtype: dict
        """
        key = self.get_argument('key')
        item_path = self.get_argument('item_path')
        request_data = json.loads(self.request.body.decode('utf-8'))
        action = request_data.get('action')
        destination = request_data.get('content')

        fs, item_path = self.validate_fs('post')

        if action == 'move':
            result = fs_manager.move(key, item_path, destination)
        elif action == 'copy':
            result = fs_manager.copy(key, item_path, destination)
        else:
            result = {"status_code": 400, "response": {"status": "failed", "error": "INVALID_ACTION", "description": f"Unsupported action: {action}"}}

        self.set_status(result["status_code"])
        self.write(result['response'])
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
    
    route_files = url_path_join(base_url, "jupyter_fsspec", "files")
    route_files_actions = url_path_join(base_url, "jupyter_fsspec", "files", "action")

    handlers_refactored = [
        (route_fsspec_config, FsspecConfigHandler),
        (route_files, FileReadHandler),
        (route_files, FileWriteHandler),
        (route_files, FileDeleteHandler),
        (route_files_actions, FileActionHandler)
    ]

    web_app.add_handlers(host_pattern, handlers_refactored)
    web_app.add_handlers(host_pattern, handlers)
