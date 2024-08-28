from jupyter_core.paths import jupyter_config_dir
import fsspec
import os
import yaml
import urllib.parse 
from pathlib import PurePath

class FileSystemManager:
    def __init__(self, config_file):
        base_dir = jupyter_config_dir()
        config_path = os.path.join(base_dir, config_file)
        try:
            with open(config_path, 'r') as file:
                self.config = yaml.safe_load(file)
        except Exception as e:
            raise RuntimeError(f"Failed to load config file: {e}")
        
        self.filesystems = {}
        self._initialize_filesystems()

    def _encode_key(self, fs_config):
        fs_path = fs_config['path'].strip('/')

        combined = f"{fs_config['type']}|{fs_config['name']}|{fs_path}"
        encoded_key = urllib.parse.quote(combined, safe='')
        return encoded_key

    #TODO: verify
    def _decode_key(self, encoded_key):
        combined = urllib.parse.unquote(encoded_key)
        fs_type, fs_name, fs_path = combined.split('|', 2)
        return fs_type, fs_name, fs_path

    def _initialize_filesystems(self):
        for fs_config in self.config['sources']:
            key = self._encode_key(fs_config)

            fs_type = fs_config['type']
            fs_name = fs_config['name']
            fs_path = fs_config['path']
            options = fs_config.get('additional_options', {})

            # Init filesystem
            fs = fsspec.filesystem(fs_type, **options)

            # Store the filesystem instance
            self.filesystems[key] = {"instance": fs, "name": fs_name, "type": fs_type, "path": fs_path}

    def get_filesystem(self, key):
        return self.filesystems.get(key)

    # ===================================================
    # File/Folder Read/Write Operations
    # ===================================================
    def write(self, key, item_path: str, content): # writePath
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']

        if fs.exists(item_path) and not fs.isdir(item_path):
            return {"status_code": 409, "status": f"Failed: Path {item_path} already exists."}

        if fs.isdir(item_path):
            content = content.decode('utf-8')
            new_dir_path = str(PurePath(item_path) / content) + '/'
            print(f"new_dir_path is: {new_dir_path}")
            if fs.exists(new_dir_path):
                return {"status_code": 409, "status": f"Failed: Path {item_path} already exists."}
            fs.mkdir(new_dir_path, create_parents=True)
            return {"status_code": 200, "status": f"Success: Wrote {new_dir_path}."}
        else:
            # TODO: Process content for different mime types correctly
            with fs.open(item_path, 'wb') as file:
                file.write(content);
            return {"status_code": 200, "status": f"Success: Wrote {item_path}."}


    def read(self, key, item_path: str, find: bool = False): # readPath
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']

        if not fs.exists(item_path):
            return {"status_code": 404, "status": f"Failed: Path {item_path} does not exist."}
        
        if fs.isdir(item_path) and find:
            content = []
            dir_ls = fs.find(item_path, maxdepth=None, withdirs=True, detail=False)
            for path in dir_ls:
                content.append(fs.info(path))
        elif fs.isdir(item_path):
            content = []
            dir_ls = fs.ls(item_path)
            for path in dir_ls:
                content.append(fs.info(path))
        else:
            with fs.open(item_path, 'rb') as file:
                content = file.read()
            content = content.decode('utf-8')
            # TODO: Process content for different mime types for request body eg. application/json
        return {"status_code": 200, "status": f"Success: Read {item_path}.", "body": content}


    def update(self, key, item_path, content): #updateFile
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']
        
        if fs.isdir(item_path):
            return {"status_code": 400, "status": f"Failed: Path {item_path} is not a valid argument."}
        else:
            bcontent = content.encode('utf-8')
            with fs.open(item_path, 'wb') as file:
                file.write(bcontent);
        return {"status_code": 200, "status": f"Success: Updated {item_path}."}


    def delete(self, key, item_path): # deletePath
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']

        if not fs.exists(item_path):
            return {"status_code": 404, "status": f"Failed: Path {item_path} does not exist."}

        if fs.isdir(item_path):
            fs.delete(item_path, recursive=True) #TODO: await fs._rm()
        else:
            fs.delete(item_path, recursive=False)
        return {"status_code": 200, "status": f"Success: Deleted {item_path}."}


    def move(self, key, item_path, dest_path): # movePath
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']

        if not fs.exists(item_path):
            return {"status_code": 404, "status": f"Failed: Path {item_path} does not exist."}
        
        if fs.isdir(item_path):
            print(f"directory") 
            fs.mv(item_path, dest_path, recursive=True)
        else:
            print(f"file")
            fs.mv(item_path, dest_path, recursive=False)
        return {"status_code": 200, "status": f"Success: Moved {item_path} to path: {dest_path}."}
    
    def copy(self, key, item_path, dest_path): # copyPath
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']

        if not fs.exists(item_path):
            return {"status_code": 404, "status": f"Failed: Path {item_path} does not exist."}
        
        if fs.isdir(item_path):
            fs.copy(item_path, dest_path, recursive=True)
        else:
            fs.copy(item_path, dest_path, recursive=False)
        return {"status_code": 200, "status": f"Success: Copied {item_path} to path: {dest_path}."}

    def open(self, key, item_path, start, end):
        fs_obj = self.get_filesystem(key)
        fs = fs_obj['instance']

        with fs.open(item_path, 'rb') as f:
            f.seek(start)
            if end is None:
                data = f.read()  # eof
            else:
                data = f.read(int(end) - int(start) + 1)
        return {"status_code": 206, "status": "Partial content success", "data": data.decode('utf-8')}

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
