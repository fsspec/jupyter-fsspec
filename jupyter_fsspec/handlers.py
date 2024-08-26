from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import json

from .file_manager import FileSystemManager

fs_manager = FileSystemManager('jupyter-fsspec.yaml')

class FsspecConfigHandler(APIHandler):
    """

    Args:
        APIHandler (_type_): _description_
    """
    @tornado.web.authenticated
    def get(self):
        """_summary_

        Parameters
        ----------
            None

        Returns
        ----------
        Object:
            filesystems: []
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
        """_summary_

        Parameters
        ----------
            Query Parameters: 
                key: [String]
                item_path: [String]

        Returns
        ----------
        Object with two keys 

        Raises
        ----------
            ValueError: _description_
            ValueError: _description_
        """
        try:
            key = self.get_argument('key')
            item_path = self.get_argument('item_path')

            if not key:
                raise ValueError("Missing required parameter `key`")
            # if not item_path:
                # raise ValueError("Missing required parameter `item_path`")
                
            fs = fs_manager.get_filesystem(key)

            if not item_path:
                item_path = fs_manager.filesystems[key]["path"]

            if fs is None:
                raise ValueError(f"No filesystem found for key: {key}")

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
    # move action: key, item_path, dest_path -> backend function deals with it being folder/file differences 
    # copy action: key, item_path, dest_path -> backend function deals with it being folder/file differences
    @tornado.web.authenticated
    def post(self):
        """_summary_

        Parameters
        ----------

        Returns
        ----------

        Raises
        ----------
            ValueError: _description_
            ValueError: _description_
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
        """_summary_

        Parameters
        ----------

        Returns
        ----------

        Raises
        ----------
            ValueError: _description_
            ValueError: _description_
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
        """_summary_

        Parameters
        ----------

        Returns
        ----------

        Raises
        ----------
            ValueError: _description_
            ValueError: _description_
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
