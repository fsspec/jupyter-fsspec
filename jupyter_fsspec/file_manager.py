from jupyter_core.paths import jupyter_config_dir
import fsspec
import os
import yaml
import urllib.parse 
from datetime import datetime
from pathlib import PurePath

class FileSystemManager:
    def __init__(self, config_file):
        base_dir = jupyter_config_dir()
        self.config_path = os.path.join(base_dir, config_file)
        try:
            with open(self.config_path, 'r') as file:
                self.config = yaml.safe_load(file)
        except Exception as e:
            print(f"Error loading configuration file: {e}")
            return None

        self.filesystems = {}
        self._initialize_filesystems()

    def _encode_key(self, fs_config):
        fs_path = fs_config['path'].strip('/')

        combined = f"{fs_config['type']}|{fs_path}"
        encoded_key = urllib.parse.quote(combined, safe='')
        return encoded_key

    def _decode_key(self, encoded_key):
        combined = urllib.parse.unquote(encoded_key)
        fs_type, fs_path = combined.split('|', 1)
        return fs_type, fs_path
    
    def read_config(self):
        try:
            with open(self.config_path, 'r') as file:
                self.config = yaml.safe_load(file)
        except Exception as e:
            print(f"Error loading configuration file: {e}")
            return None

    def _initialize_filesystems(self):
        self.read_config()

        for fs_config in self.config['sources']:
            key = self._encode_key(fs_config)

            fs_type = fs_config['type']
            fs_name = fs_config['name']
            fs_path = fs_config['path']
            options = fs_config.get('additional_options', {})

            # Init filesystem
            fs = fsspec.filesystem(fs_type, **options)
            if fs_type == 'memory':
                if not fs.exists(fs_path):
                    fs.mkdir(fs_path)

            # Store the filesystem instance
            self.filesystems[key] = {"instance": fs, "name": fs_name, "type": fs_type, "path": fs_path}

    def get_all_filesystems(self):
        self._initialize_filesystems()

    def get_filesystem(self, key):
        return self.filesystems.get(key)
    
    def get_filesystem_by_type(self, fs_type):
        for encoded_key, fs_info in self.filesystems.items():
            if fs_info.get('type') == fs_type:
                return {'key': encoded_key, 'info': fs_info} 
        return None

    # ===================================================
    # File/Folder Read/Write Operations
    # ===================================================
    # write directory
    # write file with content
    # write empty file at directory
    # write to an existing file
    def write(self, key, item_path: str, content, overwrite=False): # writePath
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']

        if fs.isdir(item_path):
            if overwrite:
                return {"status_code": 409, "response": {"status": "failed", "description": f"Failed: Path {item_path} already exists."}}
            if isinstance(content, bytes):
                content = content.decode('utf-8')
            new_dir_path = str(PurePath(item_path) / content) + '/'

            if fs.exists(new_dir_path):
                return {"status_code": 409, "response": {"status": "failed", "description": f"Failed: Path {item_path} already exists."}}
            else:
                fs.mkdir(new_dir_path, create_parents=True)
            return {"status_code": 200, "response": {"status": "success", "description": f"Wrote {new_dir_path}"}}
        else:
            # TODO: Process content for different mime types correctly
            if not isinstance(content, bytes):
                content = content.encode()

            if fs.exists(item_path) and not overwrite:
                return {"status_code": 409, "response": {"status": "failed", "description": f"Failed: Path {item_path} already exists."}}
            else:
                with fs.open(item_path, 'wb') as file:
                    file.write(content);
            return {"status_code": 200, "response": {"status": "success", "description": f"Wrote {item_path}"}}


    def read(self, key, item_path: str, find: bool = False): # readPath
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']

        if not fs.exists(item_path):
            return {"status_code": 404, "response": {"status": "failed", "error": "PATH_NOT_FOUND", "description": f"Path {item_path} does not exist."}}
        
        if fs.isdir(item_path) and find:
            # find(): a simple list of files
            content = []
            dir_ls = fs.find(item_path, maxdepth=None, withdirs=True, detail=False)
            for path in dir_ls:
                content.append(path)
        elif fs.isdir(item_path):
            content = []
            dir_ls = fs.ls(item_path)
            for path in dir_ls:
                if not isinstance(path, str): #TODO: improve
                    path = path['name']

                info = fs.info(path)

                if isinstance(info.get('created'), datetime):
                    info['created'] = info['created'].isoformat()
                content.append(info)
        else:
            with fs.open(item_path, 'rb') as file:
                content = file.read()
            content = content.decode('utf-8')
            # TODO: Process content for different mime types for request body eg. application/json
        return {"status_code": 200, "response": {"status": "success", "description": f"Read {item_path}", "content": content}}

    # TODO: remove
    def accessMemoryFS(self, key, item_path):
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']
        content = 'Temporary Content: memory fs accessed'
        return {"status_code": 200, "response": {"status": "success", "description": f"Read {item_path}", "content": content}}

    def update(self, key, item_path, content): #updateFile
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']
        
        if fs.isdir(item_path):
            return {"status_code": 400, "response": {"status": "failed", "error": "INVALID_PATH", "description": f"Directory Path {item_path} is not a valid argument."}}
        else:
            bcontent = content.encode('utf-8')
            with fs.open(item_path, 'wb') as file:
                file.write(bcontent);
        return {"status_code": 200, "response": {"status": "success", "description": f"Updated {item_path}."}}


    def delete(self, key, item_path): # deletePath
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']

        if not fs.exists(item_path):
            return {"status_code": 404, "response": {"status": "failed", "error": "PATH_NOT_FOUND", "description": f"Path {item_path} does not exist."}}

        if fs.isdir(item_path):
            fs.delete(item_path) #TODO: await fs._rm() Do not want recursive=True
        else:
            fs.delete(item_path, recursive=False)
        return {"status_code": 200, "response": {"status": "success", "description": f"Deleted {item_path}."}}

    def move(self, key, item_path, dest_path): # movePath
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']
        if not fs.exists(item_path):
            return {"status_code": 404, "response": {"status": "failed", "error": "PATH_NOT_FOUND", "description": f"Path {item_path} does not exist."}}

        if fs.isdir(item_path):
            fs.mv(item_path, dest_path, recursive=True)
        else:
            _, item_extension = os.path.splitext(item_path)
            _, dest_extension = os.path.splitext(dest_path)

            if not dest_extension:
                dest_path = dest_path + item_extension

            fs.mv(item_path, dest_path, recursive=False)
        return {"status_code": 200, "response": {"status": "success", "description": f"Moved {item_path} to {dest_path}"}}
    
    def move_diff_fs(self, key, full_item_path, dest_key, full_dest_path): # movePath
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']
        dest_fs_obj = self.get_filesystem(dest_key)
        dest_fs =dest_fs_obj['instance']

        if not fs.exists(full_item_path):
            return {"status_code": 404, "response": {"status": "failed", "error": "PATH_NOT_FOUND", "description": f"Path {full_item_path} does not exist"}}

        if fs.isdir(full_item_path):
            if not dest_fs.exists(full_dest_path):
                return {"status_code": 404, "response": {"status": "failed", "error": "PATH_NOT_FOUND", "description": f"Path {full_dest_path} does not exist"}}
            fsspec.mv(full_item_path, full_dest_path, recursive=True)
        else:
            fsspec.mv(full_item_path, full_dest_path, recursive=False)
        return {"status_code": 200, "response": {"status": "success", "description": f"Moved {full_item_path} to path: {full_dest_path}"}}

    def copy(self, key, item_path, dest_path): # copyPath
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']

        if not fs.exists(item_path):
            return {"status_code": 404, "response": {"status": "failed", "error": "PATH_NOT_FOUND", "description": f"Path {item_path} does not exist"}}

        if fs.isdir(item_path):
            fs.copy(item_path, dest_path, recursive=True)
        else:
            _, item_extension = os.path.splitext(item_path)
            _, dest_extension = os.path.splitext(dest_path)
            
            if not dest_extension:
                dest_path = dest_path + item_extension
            fs.copy(item_path, dest_path, recursive=False)
        return {"status_code": 200, "response": {"status": "success", "description": f"Copied {item_path} to {dest_path}"}}

    def copy_diff_fs(self, key, full_item_path, dest_key, full_dest_path): # copyPath
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']

        if not fs.exists(full_item_path):
            return {"status_code": 404, "response": {"status": "failed", "error": "PATH_NOT_FOUND", "description": f"Path {full_item_path} does not exist"}}

        if fs.isdir(full_item_path):
            fs.copy(full_item_path, full_dest_path, recursive=True)
        else:
            fs.copy(full_item_path, full_dest_path, recursive=False)
        return {"status_code": 200, "response": {"status": "success", "description": f"Copied {full_item_path} to path: {full_dest_path}"}}

    def open(self, key, item_path, start, end):
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']

        if not fs.exists(item_path):
            return {"status_code": 404, "response": {"status": "failed", "error": "PATH_NOT_FOUND", "description": f"Path {item_path} does not exist."}}

        with fs.open(item_path, 'rb') as f:
            f.seek(start)
            if end is None:
                data = f.read()  # eof
            else:
                data = f.read(int(end) - int(start) + 1)
        content = data.decode('utf-8')
        return {"status_code": 206, "response": {"status": "success", "description": f"Partial content read from: {item_path}", "content": content}}


    def rename(self, key, item_path, dest_path):
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']

        if not fs.exists(item_path):
            return {"status_code": 404, "response": {"status": "failed", "error": "PATH_NOT_FOUND", "description": f"Path {item_path} does not exist"}}

        dir_root_path = os.path.dirname(item_path)

        # directory
        if fs.isdir(item_path):
            new_dest_path = dir_root_path + '/' + dest_path
            if fs.exists(new_dest_path):
                return {"status_code": 403, "response": {"status": "failed", "error": "PATH_NOT_FOUND", "description": f"Path {new_dest_path} already exist"}}
            else:
                fs.rename(item_path, new_dest_path)
        # file
        else:
            # check for dest_path file extension? if not infer, reassign dest_path
            _, item_extension = os.path.splitext(item_path)
            _, dest_extension = os.path.splitext(dest_path)
            
            if not dest_extension:
                dest_path = dest_path + item_extension
            new_dest_path = dir_root_path + '/' + dest_path
            fs.rename(item_path, new_dest_path)

        return {"status_code": 200, "response": {"status": "success", "description": f"Renamed {item_path} to {new_dest_path}"}} 

    # ===================================================
    # File/Folder Management Operations
    # ===================================================
    def get_info(self, key, item_path: str, recursive: bool = False):
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']
        return fs.info(item_path)

    def exists(self, key, item_path: str):
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']

        if not fs.exists(item_path):
            return False
        else:
            return True
