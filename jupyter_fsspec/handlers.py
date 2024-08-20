import json
import os
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from jupyter_core.paths import jupyter_config_dir
import tornado
from tornado.escape import json_decode
import fsspec
import mimetypes
import base64
import yaml

class ConfigManager:
    _config = None

    @staticmethod
    def load_config():
        if ConfigManager._config is None:
            base_dir = jupyter_config_dir()
            config_path = os.path.join(base_dir, 'jupyter-fsspec.yaml')
            try:
                with open(config_path, 'r') as file:
                    ConfigManager._config = yaml.safe_load(file)
            except Exception as e:
                raise RuntimeError(f"Failed to load config file: {e}")
        return ConfigManager._config

    @staticmethod
    def get_config():
        if ConfigManager._config is None:
            ConfigManager.load_config()
        return ConfigManager._config

class ConfigHandler(APIHandler):
    @tornado.web.authenticated
    async def get(self):
        try:
            config_data = ConfigManager.get_config()
            self.finish(config_data)
        except Exception as e:
            self.set_status(500)
            self.finish({'Error': str(e)})

class FileHandler:
    def __init__(self, fs_url: str):
        self.fs = fsspec.filesystem(fs_url)

    def read_file(self, path: str, mode: str = 'rb'):
        with self.fs.open(path, mode) as file:
            return file.read()

    def write_file(self, path: str, content: bytes, mode: str = 'wb'):
        with self.fs.open(path, mode) as file:
            file.write(content)

    def delete_file(self, path: str):
        return self.fs.delete(path, recursive=False)
    
    # Add PUT/PATCH

    def list_files(self, path: str):
        return self.fs.ls(path)

    def is_dir(self, path: str):
        return self.fs.isdir(path)
    
    def is_file(self, path: str):
        return self.fs.isfile(path)

    # Advanced File Operation
    def copy_file(self, src_path: str, dest_path: str, recursive: bool = False):
        self.fs.copy(src_path, dest_path, recursive)

    def move_file(self, src_path: str, dest_path: str, recursive: bool = False):
        self.fs.mv(src_path, dest_path, recursive)

    def get_info(self, path: str, recursive: bool = False):
        return self.fs.info(path)

# Check existing Fsspec remote source key/secret api handling
class S3FileHandler(FileHandler):
    def __init__(self):
        super().__init__('s3')

    # Override methods specific to S3
    def list_files(self, path: str):
        return self.glob(f'{path}/**')

# TODO: Dynamic Registration of new backend handlers
class FileHandlerFactory:
    _handlers_cache = {}

    @staticmethod
    def get_handler(source_name: str):
        config = ConfigManager.get_config()
        source_config = next((source for source in config.get('source', []) if source['name'] == source_name), {})
        backend = source_config.get('type')
        print(f"backend is: {backend}")
        path = source_config['path']
        print(f"path is: {path}")
        cache_key = f"{backend}-{source_config.get('name')}"
        print(f"cache_key is: {cache_key}")
        if cache_key in FileHandlerFactory._handlers_cache:
            return FileHandlerFactory._handlers_cache[cache_key]
    
        handler = None
        print('in FileHandlerFactorys get_handler method')
        if backend == 's3':
            # TODO: Determine method for key and secret reading
            '''
            access_key = os.getenv(source_config['access_key_env'])
            secret_key = os.getenv(source_config['secret_key_env'])
            handler = S3FileHandler(access_key, secret_key)
            '''
            handler = S3FileHandler(backend)
        elif backend == 'local':
            handler = FileHandler(backend)

        FileHandlerFactory._handlers_cache[cache_key] = handler
        return handler

class FsspecHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        fsSource_name = self.get_argument('name')
        print(f"fsSource_name is: {fsSource_name}")
        item_path = self.get_argument('path')
        print(f"item_path is: {item_path}")
        config = ConfigManager.get_config()
        print(f"config is: {config}")
        fsSource_config = next((source for source in config.get('source', []) if source['name'] == fsSource_name), {})
        print(f"fsSource_config is: {fsSource_config}")
        fsSource_path = fsSource_config['path']
        print(f"fsSource_path is: {fsSource_path}")
        handler = FileHandlerFactory.get_handler(fsSource_name)
        print(f"handler is: {handler}")

        if item_path != '':
            path = item_path
        else:
            path = fsSource_path

        print(f"decided path is: {path}")
        if handler.is_dir(path):
            print('its a directory')
            files = handler.list_files(path)
            print(f"files are: {files}")
            # TODO: update this 
            tree_info = []
            for entry in files:
                entry_info = handler.get_info(entry)
                tree_info.append(entry_info)
            # TODO: just make it a fs.ls(detail=True) call to get the same information as info() gives!
            self.set_header("Content-Type", "application/json")
            self.finish(json.dumps({"files": tree_info}))
        elif handler.is_file(path):
            # TODO: Modify to only send file metadata unless file contents requested.
            print(f'its a file at path: {path}')
            content = handler.read_file(path)
            print(f"content is: {content}")
            mime_type, _ = mimetypes.guess_type(path)
            print(f"mime_type is: {mime_type}")
            metadata = handler.get_info(path)
            print(f"file metadata: {metadata}")

            if (mime_type and mime_type.startswith('text')):
                content_str = content.decode('utf-8')
            else:
                content_str = base64.b64encode(content).decode('utf-8')

            response_data = {
                'content': content_str,
                'metadata': metadata,
                'mime_type': mime_type
            }

            self.set_header("Content-Type", "application/json")
            self.finish(json.dumps(response_data))
        else:
            print('its an error')
            self.set_status(404)
            self.write({'error': 'Path does not exist or is not a file/directory'})
        
        # TODO: clean up => update this finish call in appropriate section(s)
        #content = self.fs.ls(path)
        #self.finish(json.dumps({"files": files}))

    @tornado.web.authenticated
    def post(self):
        source_name = self.get_argument('name')
        action = self.get_argument('action')
        config = ConfigManager.get_config()
        source_config = next((source for source in config.get('source', []) if source['name'] == source_name), {})
        path = source_config['path']
        handler = FileHandlerFactory.get_handler(path)

        if action == 'write':
            content = self.get_argument('content')
            handler.write_file(path, content.encode('utf-8'))
            self.write({'status': 'success'})
        elif action == 'copy':
            dest_path = self.get_argument('content')
            handler.copy_file(path, dest_path, recursive=False)
            self.write({'status': 'success'})
        elif action == 'move':
            dest_path = self.get_argument('content')
            handler.move_file(path, dest_path, recursive=False)
            self.write({'status': 'success'})

    # TODO: def delete
    @tornado.web.authenticated
    def delete(self):
        # data = json_decode(self.request.body)
        source_name = self.get_argument('name')
        # action = self.get_argument('action')
        config = ConfigManager.get_config()
        source_config = next((source for source in config.get('source', []) if source['name'] == source_name), {})
        path = source_config['path']

        handler = FileHandlerFactory.get_handler(path)
        handler.delete_file(path, recursive=False)
        self.write({'status': 'success'})


#====================================================================================
# Update the handler in setup
#====================================================================================
def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_fsspec_config = url_path_join(base_url, "jupyter_fsspec", "fsspec-config")
    route_fsspec = url_path_join(base_url, "jupyter_fsspec", "fsspec")
    handlers = [(route_fsspec, FsspecHandler), (route_fsspec_config, ConfigHandler)]
    web_app.add_handlers(host_pattern, handlers)
