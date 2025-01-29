from jupyter_core.paths import jupyter_config_dir
import fsspec
from fsspec.utils import infer_storage_options
from fsspec.registry import known_implementations
import os
import sys
import yaml
import hashlib
import urllib.parse
import traceback
import logging

logging.basicConfig(level=logging.WARNING, stream=sys.stdout)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class FileSystemManager:
    def __init__(self, config_file):
        self.filesystems = {}
        self.base_dir = jupyter_config_dir()
        logger.debug(f"Using Jupyter config directory: {self.base_dir}")
        os.makedirs(self.base_dir, exist_ok=True)
        self.config_path = os.path.join(self.base_dir, config_file)

        self.config = self.load_config()
        self.async_implementations = self._asynchronous_implementations()
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

    # os.path.exists(config_path)
    def load_config(self):
        config_path = self.config_path
        result = {"sources": []}

        try:
            if not os.path.exists(config_path):
                logger.debug(
                    f"Config file not found at {config_path}. Creating default file."
                )
                self.create_config_file()

            with open(config_path, "r") as file:
                config_loaded = yaml.safe_load(file)
            if config_loaded is not None and "sources" in config_loaded:
                result = config_loaded
        except FileNotFoundError:
            logger.error(
                f"Config file was not found and could not be created at {config_path}."
            )
        except yaml.YAMLError as e:
            logger.error(f"Error parsing configuration file: {e}")
        # TODO: Check for permissions / handle case for OSError
        # except OSError as oserr:
        except Exception:
            traceback.print_exc()
            logger.error("Error occured when loading the config file.")

        return result

    def hash_config(self, config_content):
        yaml_str = yaml.dump(config_content)
        hash = hashlib.md5(yaml_str.encode("utf-8")).hexdigest()
        return hash

    def create_config_file(self):
        config_path = self.config_path
        os.makedirs(os.path.dirname(config_path), exist_ok=True)

        placeholder_config = {
            "sources": [
                {"name": "test", "path": "memory://mytests"},
                {"name": "test1", "path": "/testing", "protocol": "memory"},
            ]
        }

        config_documentation = """# This file is in you JUPYTER_CONFIG_DIR.\n# Multiple filesystem sources can be configured\n# with a unique `name` field, the `path` which\n# can include the protocol, or can omit it and\n# provide it as a seperate field `protocol`. \n# You can also provide `args` such as `key` \n# and `kwargs` such as `client_kwargs` to\n# the filesystem. More details can be found at https://jupyter-fsspec.readthedocs.io/en/latest/#config-file."""

        try:
            yaml_content = yaml.dump(placeholder_config, default_flow_style=False)
            commented_yaml = "\n".join(
                f"# {line}" for line in yaml_content.splitlines()
            )

            full_content = config_documentation + "\n\n" + commented_yaml
            with open(config_path, "w") as config_file:
                config_file.write(full_content)

            logger.debug(f"Configuration file created at {config_path}")
        except Exception as e:
            logger.error("Error creating configuration file: ", e)

    def _get_protocol_from_path(self, path):
        storage_options = infer_storage_options(path)
        protocol = storage_options.get("protocol", "file")
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

        # Init filesystem
        try:
            for fs_config in self.config["sources"]:
                fs_name = fs_config.get("name", None)
                fs_path = fs_config.get("path", None)
                fs_protocol = fs_config.get("protocol", None)
                args = fs_config.get("args", [])
                kwargs = fs_config.get("kwargs", {})

                if not fs_name:
                    logger.error("Skipping configuration: Missing 'name'")
                    continue
                if fs_protocol is None:
                    if fs_path:
                        fs_protocol = self._get_protocol_from_path(fs_path)
                    else:
                        logger.error(
                            f"Skipping '{fs_name}': Missing 'protocol' and 'path' to infer it from"
                        )
                        continue

                # TODO: support for case no path
                if not fs_path:
                    logger.error(
                        f"Filesystem '{fs_name}' with protocol 'fs_protocol' requires 'path'"
                    )

                key = self._encode_key(fs_config)

                # Add: _is_protocol_supported? Or rely on fsspec?
                fs_async = self._async_available(fs_protocol)
                fs = fsspec.filesystem(
                    fs_protocol, asynchronous=fs_async, *args, **kwargs
                )

                if fs_protocol == "memory":
                    if not fs.exists(fs_path):
                        fs.mkdir(fs_path)

                # Store the filesystem instance
                new_filesystems[key] = {
                    "instance": fs,
                    "name": fs_name,
                    "protocol": fs_protocol,
                    "path": fs._strip_protocol(fs_path),
                    "canonical_path": fs.unstrip_protocol(fs_path),
                }
                logger.debug(
                    f"Initialized filesystem '{fs_name}' with protocol '{fs_protocol}'"
                )

        except Exception as e:
            traceback.print_exc()
            print(f"Error initializing filesystems: {e}")

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

    def get_filesystem_by_protocol(self, fs_protocol):
        for encoded_key, fs_info in self.filesystems.items():
            if fs_info.get("protocol") == fs_protocol:
                return {"key": encoded_key, "info": fs_info}
        return None

    def get_filesystem_protocol(self, key):
        filesystem_rep = self.filesystems.get(key)
        print(f"filesystem_rep: {filesystem_rep}")
        return filesystem_rep["protocol"] + "://"
