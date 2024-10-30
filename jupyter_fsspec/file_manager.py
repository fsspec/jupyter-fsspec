from jupyter_core.paths import jupyter_config_dir
import fsspec
from fsspec.utils import infer_storage_options
from fsspec.registry import known_implementations
import os
import yaml
import hashlib
import urllib.parse

class FileSystemManager:
    def __init__(self, config_file):
        self.filesystems = {}
        self.base_dir = jupyter_config_dir()
        self.config_path = os.path.join(self.base_dir, config_file)

        self.config = self.load_config()
        self.async_implementations = self._asynchronous_implementations()
        self.initialize_filesystems()

    def _encode_key(self, fs_config):
        # fs_path = fs_config['path'].strip('/')
        fs_name = fs_config['name']
        # combined = f"{fs_config['type']}|{fs_path}"
        combined = f"{fs_name}"
        encoded_key = urllib.parse.quote(combined, safe='')
        return encoded_key

    def _decode_key(self, encoded_key):
        combined = urllib.parse.unquote(encoded_key)
        # fs_type, fs_path = combined.split('|', 1)
        fs_name = combined
        # return fs_type, fs_path
        return fs_name
   
    @staticmethod
    def create_default():
        return FileSystemManager(config_file='jupyter-fsspec.yaml')

    # os.path.exists(config_path)
    def load_config(self):
        config_path = self.config_path
        if not os.path.exists(config_path):
            self.create_config_file()

        try:
            with open(config_path, 'r') as file:
                config = yaml.safe_load(file)
            return config
        except yaml.YAMLError as e:
            print(f"Error parsing configuration file: {e}")
            return None

    def hash_config(self, config_content):
        yaml_str = yaml.dump(config_content)
        hash = hashlib.md5(yaml_str.encode('utf-8')).hexdigest()
        return hash

    def create_config_file(self):
        config_path = self.config_path

        placeholder_config = {
            "sources": [
                {
                    "name": "Sample",
                    "path": "/test"
                },
                {
                    "name": "test2",
                    "path": "memory://mytests"
                }
            ]
        }

        try:
            with open(config_path, 'w') as config_file:
                yaml_content = yaml.dump(placeholder_config, config_file)

            print(f"Configuration file created at {config_path}")
        except Exception as e:
            print(f"Error creating configuration file")

    def _get_protocol_from_path(self, path):
        storage_options = infer_storage_options(path)
        protocol = storage_options.get('protocol', 'file')
        return protocol

    def _asynchronous_implementations(self):
        async_filesystems = []

        for protocol, impl in known_implementations.items():
            try:
                fs_class = fsspec.get_filesystem_class(protocol)
                if fs_class.async_impl:
                    async_filesystems.append(protocol)
            except Exception:
                pass
        return async_filesystems
    
    def _async_available(self, protocol):
        if protocol in self.async_implementations:
            return True
        else:
            return False

    def initialize_filesystems(self):
        new_filesystems = {}

        for fs_config in self.config['sources']:
            key = self._encode_key(fs_config)
            fs_name = fs_config['name']
            fs_path = fs_config['path']
            options = fs_config.get('additional_options', {})
            fs_type = fs_config.get("type", None)

            if fs_type == None:
                fs_type = self._get_protocol_from_path(fs_path)

            # Init filesystem
            try:
                fs_async = self._async_available(fs_type)
                fs = fsspec.filesystem(fs_type, asynchronous=fs_async, **options)

                if fs_type == 'memory':
                    if not fs.exists(fs_path):
                        fs.mkdir(fs_path)

                # Store the filesystem instance
                new_filesystems[key] = {"instance": fs, "name": fs_name, "type": fs_type, "path": fs_path}
            except Exception as e:
                print(f'Error initializing filesystems: {e}')

        self.filesystems = new_filesystems

    def check_reload_config(self):
        new_content = self.load_config()
        hash_new_content = self.hash_config(new_content)
        current_config_hash = self.hash_config(self.config)

        if current_config_hash != hash_new_content:
            self.config = new_content
            self.initialize_filesystems()

    def get_all_filesystems(self):
        self._initialize_filesystems()

    def get_filesystem(self, key):
        return self.filesystems.get(key)
    
    def get_filesystem_by_type(self, fs_type):
        for encoded_key, fs_info in self.filesystems.items():
            if fs_info.get('type') == fs_type:
                return {'key': encoded_key, 'info': fs_info} 
        return None