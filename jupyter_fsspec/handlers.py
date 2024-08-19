import json
import os
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
from tornado.escape import json_decode
import fsspec
import mimetypes
import base64

class RouteHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({
            "data": "This is /jupyter_fsspec/hello endpoint!"
        }))

class ListFileHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        fs = fsspec.filesystem('local')
        path = "./"
        files = fs.ls(path)
        self.finish(json.dumps({"files": files}))

class ReadFileHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        path = self.get_argument('path', None)
        full_path = os.path.abspath(path)
        print(f"full_path: {full_path}")
        print(f"path is: {path}")
        fs = fsspec.filesystem('local')
        with fs.open(path, 'rb' if path.endswith('.pdf') else 'r') as f:
            content = f.read()

        mime_type, _ = mimetypes.guess_type(path)

        if isinstance(content, bytes):
                content = base64.b64encode(content).decode('utf-8')

        self.finish(json.dumps({"content": content, "mime_type": mime_type}))


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

    def list_files(self, path: str):
        return self.fs.ls(path)

    def is_dir(self, path: str):
        return self.fs.isdir(path)
    
    def is_file(self, path: str):
        return self.fs.isfile(path)

    def copy_file(self, src_path: str, dest_path: str, recursive: bool = False):
        self.fs.copy(src_path, dest_path, recursive)

    def move_file(self, src_path: str, dest_path: str, recursive: bool = False):
        self.fs.mv(src_path, dest_path, recursive)

    def get_info(self, path: str, recursive: bool = False):
        return self.fs.info(path)

class S3FileHandler(FileHandler):
    def __init__(self):
        super().__init__('s3')

    # Override methods specific to S3
    def list_files(self, path: str):
        return self.glob(f'{path}/**')

class FileHandlerFactory:
    @staticmethod
    def get_handler(backend: str):
        print('in FileHandlerFactorys get_handler method')
        if backend == 's3':
            return S3FileHandler()
        else:
            print('returning FileHandler with backend  ', backend)
            return FileHandler(backend)


class FsspecHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        path = self.get_argument('path')
        backend = self.get_argument('backend', 'local')
        handler = FileHandlerFactory.get_handler(backend)
        
        print('file path: ', path)
        print('backend: ', backend)

        if handler.is_dir(path):
            print('its a directory')
            files = handler.list_files(path)
            print(f"files are: {files}")
            # TODO: update this 
            # self.write({'type': 'directory', 'files': files})
            tree_info = []
            for entry in files:
                entry_info = handler.get_info(entry)
                tree_info.append(entry_info)
            # TODO: just make it a fs.ls(detail=True) call to get the same information as info() gives!
            self.finish(json.dumps({"files": tree_info}))
        elif handler.is_file(path):
            print('its a file')
            content = handler.read_file(path)
            # TODO: update this 
            # self.write({'type': 'file', 'content': content.decode('utf-8')})
            self.finish(json.dumps({"file": content}))
        else:
            print('its an error')
            self.set_status(404)
            self.write({'error': 'Path does not exist or is not a file/directory'})
        
        # TODO: clean up => update this finish call in appropriate section(s)
        #content = self.fs.ls(path)
        #self.finish(json.dumps({"files": files}))

    @tornado.web.authenticated
    def post(self):
        data = json_decode(self.request_body)
        action = data.get('action', 'write')
        path = data['path']
        backend = data.get('backend', 'local')
        recursive = data.get('recursive', False)

        handler = FileHandlerFactory.get_handler(backend)

        if action == 'write':
            content = data['content']
            handler.write_file(path, content.encode('utf-8'))
            self.write({'status': 'success'})
        elif action == 'copy':
            dest_path = data['dest_path']
            handler.copy_file(path, dest_path, recursive=recursive)
            self.write({'status': 'success'})
        elif action == 'move':
            dest_path = data['dest_path']
            handler.move_file(path, dest_path, recursive=recursive)
            self.write({'status': 'success'})

    # TODO: def delete
    @tornado.web.authenticated
    def delete(self):
        data = json_decode(self.request.body)
        path = data['body']
        backend = data.get('backend', 'local')
        recursive = data.get('recursive', False)

        handler = FileHandlerFactory.get_handler(backend)
        handler.delete_file(path, recursive=recursive)
        self.write({'status': 'success'})


#====================================================================================
# Update the handler in setup
#====================================================================================
def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "jupyter_fsspec", "hello")
    route_fsspec = url_path_join(base_url, "jupyter_fsspec", "fsspec")
    handlers = [(route_pattern, RouteHandler), (route_fsspec, FsspecHandler)]
    web_app.add_handlers(host_pattern, handlers)
