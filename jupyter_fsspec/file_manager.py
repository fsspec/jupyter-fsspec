from jupyter_core.paths import jupyter_config_dir
from .models import Source, Config
from fsspec.utils import infer_storage_options
from fsspec.core import strip_protocol
from fsspec.implementations.asyn_wrapper import AsyncFileSystemWrapper
import fsspec
import os
import sys
import yaml
import hashlib
import urllib.parse
import logging

logging.basicConfig(level=logging.WARNING, stream=sys.stdout)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class FileSystemManager:
    def __init__(self, config_file):
        self.filesystems = {}
        self.name_to_prefix = {}
        self.base_dir = jupyter_config_dir()
        logger.info(f"Using Jupyter config directory: {self.base_dir}")
        self.config_path = os.path.join(self.base_dir, config_file)
        self.config = self.load_config(handle_errors=True)
        self.initialize_filesystems()

    def _encode_key(self, fs_config):
        # fs_path = fs_config['path'].strip('/')
        fs_name = fs_config["name"]
        # combined = f"{fs_config['protocol']}|{fs_path}"
        # combined = f"{fs_name}"
        # encoded_key = urllib.parse.quote(combined, safe='')
        return fs_name

    def _decode_key(self, encoded_key):
        combined = urllib.parse.unquote(encoded_key)
        # fs_protocol, fs_path = combined.split('|', 1)
        fs_name = combined
        # return fs_protocol, fs_path
        return fs_name

    @staticmethod
    def create_default():
        return FileSystemManager(config_file="jupyter-fsspec.yaml")

    @staticmethod
    def validate_config(config_loaded):
        Config.model_validate(config_loaded)

    def retrieve_config_content(self):
        config_path = self.config_path

        with open(config_path, "r") as file:
            config_content = yaml.safe_load(file)

        if not config_content:
            return {}

        self.validate_config(config_content)

        return config_content

    def load_config(self, handle_errors=False):
        config_path = self.config_path

        try:
            if not os.path.exists(config_path):
                logger.debug(
                    f"Config file not found at {config_path}. Creating default file."
                )
                self.create_config_file()
            config_content = self.retrieve_config_content()
            return config_content
        except Exception as e:
            if handle_errors:
                logger.error(f"Error loading configuration file: {e}")
                return {}
            raise

    @staticmethod
    def hash_config(config_content):
        yaml_str = yaml.dump(config_content)
        hash = hashlib.md5(yaml_str.encode("utf-8")).hexdigest()
        return hash

    def create_config_file(self):
        config_path = self.config_path
        config_dir = os.path.dirname(config_path)

        logger.debug(f"Ensuring config directory exists: {config_dir}.")
        os.makedirs(config_dir, exist_ok=True)

        config_path = self.config_path
        placeholder_config = {
            "sources": [
                {"name": "test", "path": "memory://"},
                {"name": "test1", "path": "memory://testing"},
            ]
        }

        config_documentation = """# This file is in you JUPYTER_CONFIG_DIR.\n# Multiple filesystem sources can be configured\n# with a unique `name` field, the `path` which\n# can include the protocol, or can omit it and\n# provide it as a seperate field `protocol`. \n# You can also provide `args` such as `key` \n# and `kwargs` such as `client_kwargs` to\n# the filesystem. More details can be found at https://jupyter-fsspec.readthedocs.io/en/latest/#config-file."""

        yaml_content = yaml.dump(placeholder_config, default_flow_style=False)
        commented_yaml = "\n".join(f"# {line}" for line in yaml_content.splitlines())

        full_content = config_documentation + "\n\n" + commented_yaml
        with open(config_path, "w") as config_file:
            config_file.write(full_content)

        logger.info(f"Configuration file created at {config_path}")

    @staticmethod
    def _get_protocol_from_path(path):
        storage_options = infer_storage_options(path)
        protocol = storage_options.get("protocol", "file")
        return protocol

    def initialize_filesystems(self):
        new_filesystems = {}
        name_to_prefix = {}

        # Init filesystem
        for fs_config in self.config.get("sources", []):
            config = Source(**fs_config)
            fs_name = config.name
            fs_path = config.path  # path should always be a URL
            args = config.args
            kwargs = config.kwargs

            fs_protocol = self._get_protocol_from_path(fs_path)
            split_path_list = fs_path.split("://", 1)
            protocol_path = split_path_list[0] + "://"
            prefix_path = "" if len(split_path_list) <= 1 else split_path_list[1]

            key = self._encode_key(fs_config)

            canonical_path = protocol_path + key
            logger.debug("fs_protocol: %s", fs_protocol)
            logger.debug("prefix_path: %s", prefix_path)
            logger.debug("canonical_path: %s", canonical_path)

            fs_class = fsspec.get_filesystem_class(fs_protocol)
            if fs_class.async_impl:
                fs = fsspec.filesystem(fs_protocol, asynchronous=True, *args, **kwargs)
            else:
                sync_fs = fsspec.filesystem(fs_protocol, *args, **kwargs)
                fs = AsyncFileSystemWrapper(sync_fs)
            logger.debug("fs_path: %s", fs_path)

            # Store the filesystem instance
            new_filesystems[key] = {
                "instance": fs,
                "name": fs_name,
                "protocol": fs_protocol,
                "path_url": fs_path,
                "path": prefix_path,
                "canonical_path": canonical_path,
            }

            name_to_prefix[fs_name] = prefix_path
            logger.debug(
                f"Initialized filesystem '{fs_name}' with protocol '{fs_protocol}' at path '{fs_path}'"
            )

        logger.debug("path prefix: %s", name_to_prefix)
        self.filesystems = new_filesystems
        self.name_to_prefix = name_to_prefix

    # Same as client.py
    def split_path(self, path):
        key, *relpath = path.split("/", 1)
        return key, relpath[0] if relpath else ""

    def map_paths(self, root_path, key, file_obj_list):
        protocol = self.get_filesystem_protocol(key)
        logger.debug("protocol: %s", protocol)
        logger.debug("initial root path: %s", root_path)

        if not root_path and not (protocol == "file://"):
            return file_obj_list

        if protocol == "file://":
            root = strip_protocol(root_path)
        else:
            root = self.name_to_prefix[key]
        logger.debug("filesystem root: %s", root)

        # TODO: error handling for relative_path
        for item in file_obj_list:
            if "name" in item:
                file_name = item["name"]
                split_paths = file_name.split(root, 1)
                logger.debug("split file name: %s", split_paths)
                relative_path = (
                    split_paths[1] if len(split_paths) > 1 else split_paths[0]
                )
                item["name"] = key + relative_path
        return file_obj_list

    def check_reload_config(self):
        new_config_content = self.load_config()
        hash_new_content = self.hash_config(new_config_content)
        current_config_hash = self.hash_config(self.config)

        if current_config_hash != hash_new_content:
            self.config = new_config_content
            self.initialize_filesystems()

        return new_config_content

    def validate_fs(self, request_type, key, item_path):
        if not key:
            raise ValueError("Missing required parameter `key`")

        fs = self.get_filesystem(key)

        if fs is None:
            raise ValueError(f"No filesystem found for key: {key}")

        # TODO: Add test for empty item_path => root
        if item_path == "":
            if request_type == "get":
                item_path = "" if fs["protocol"] == "file://" else fs["path"]
                return fs, item_path
            else:
                raise ValueError("Missing required parameter `item_path`")

        # fs has prefix_path and name(key)
        # prefix_path is the path URL without the protocol
        prefix_path = fs["path"]

        # check item_path includes name(key) => remove it
        key_slash = key + "/"
        if key_slash in item_path:
            item_path = item_path.replace(key_slash, "")
        elif key in item_path:
            item_path = item_path.replace(key, "")

        # check item_path includes prefix_path
        if (prefix_path not in item_path) and (
            fs["protocol"] == "file" or fs["protocol"] == "memory"
        ):
            item_path = prefix_path + "/" + item_path

        return fs, item_path

    def get_filesystem(self, key):
        return self.filesystems.get(key)

    def get_filesystem_protocol(self, key):
        filesystem_rep = self.filesystems.get(key)
        return filesystem_rep["protocol"] + "://"
