from jupyter_core.paths import jupyter_config_dir
from pydantic import BaseModel
from typing import Optional, Dict, List
from fsspec.utils import infer_storage_options
from fsspec.registry import known_implementations
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


class Source(BaseModel):
    name: str
    path: str
    protocol: Optional[str] = None
    args: Optional[List] = None
    kwargs: Optional[Dict] = None


class Config(BaseModel):
    sources: List[Source]


def handle_exception(default_return=None):
    def decorator(func):
        def closure(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                logger.error(f"Error : {func.__name__}: {e}.")
                return default_return

        return closure

    return decorator


@handle_exception(
    default_return={"operation_success": False, "error": "Error validating config"}
)
def validate_config(config_loaded):
    Config.model_validate(config_loaded)
    return {"operation_success": True, "validated_config": config_loaded}


class FileSystemManager:
    def __init__(self, config_file):
        self.filesystems = {}
        self.base_dir = jupyter_config_dir()
        logger.info(f"Using Jupyter config directory: {self.base_dir}")
        self.config_path = os.path.join(self.base_dir, config_file)

        config = self.load_config()
        self.config = config.get("config_content", {})

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

    @handle_exception(
        default_return={"operation_success": False, "error": "Error reading config."}
    )
    def retrieve_config_content(self, config_path):
        with open(config_path, "r") as file:
            config_content = yaml.safe_load(file)

        if not config_content:
            return {"operation_success": True, "config_content": {}}

        validation_result = validate_config(config_content)
        if not validation_result.get("operation_success"):
            raise ValueError(validation_result["error"])

        config_validated = validation_result.get("validated_config", {})
        return {"operation_success": True, "config_content": config_validated}

    @handle_exception(
        default_return={"operation_success": False, "error": "Error loading config."}
    )
    def load_config(self):
        config_path = self.config_path
        config_content = {"sources": []}

        if not os.path.exists(config_path):
            logger.debug(
                f"Config file not found at {config_path}. Creating default file."
            )

            file_creation_result = self.create_config_file()

            if not file_creation_result.get("operation_success"):
                print(f"inner file_creation_result: {file_creation_result}")
                return file_creation_result

        config_content = self.retrieve_config_content(config_path)

        return config_content

    def hash_config(self, config_content):
        yaml_str = yaml.dump(config_content)
        hash = hashlib.md5(yaml_str.encode("utf-8")).hexdigest()
        return hash

    @handle_exception(
        default_return={"operation_success": False, "error": "Error writing config."}
    )
    def write_default_config(self, path):
        placeholder_config = {
            "sources": [
                {"name": "test", "path": "memory://mytests"},
                {"name": "test1", "path": "/testing", "protocol": "memory"},
            ]
        }

        config_documentation = """# This file is in you JUPYTER_CONFIG_DIR.\n# Multiple filesystem sources can be configured\n# with a unique `name` field, the `path` which\n# can include the protocol, or can omit it and\n# provide it as a seperate field `protocol`. \n# You can also provide `args` such as `key` \n# and `kwargs` such as `client_kwargs` to\n# the filesystem. More details can be found at https://jupyter-fsspec.readthedocs.io/en/latest/#config-file."""

        yaml_content = yaml.dump(placeholder_config, default_flow_style=False)
        commented_yaml = "\n".join(f"# {line}" for line in yaml_content.splitlines())

        full_content = config_documentation + "\n\n" + commented_yaml
        with open(path, "w") as config_file:
            config_file.write(full_content)

        logger.info(f"Configuration file created at {path}")
        return {"operation_success": True, "message": "Wrote default config."}

    @handle_exception(
        default_return={
            "operation_success": False,
            "error": "Error creating config file.",
        }
    )
    def create_config_file(self):
        config_path = self.config_path
        config_dir = os.path.dirname(config_path)

        logger.debug(f"Ensuring config directory exists: {config_dir}.")
        os.makedirs(config_dir, exist_ok=True)

        if not os.access(config_dir, os.W_OK):
            raise PermissionError(f"Config directory was not writable: {config_dir}")

        write_result = self.write_default_config(config_path)
        if not write_result.get("operation_success"):
            raise IOError(f"{write_result.get('error', 'Unkown error')}.")

        return {
            "operation_success": True,
            "message": f"Config file created at {config_path}",
        }

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
        return protocol in self.async_implementations

    @handle_exception(
        default_return={
            "operation_success": False,
            "error": "Error initializing filesystems.",
        }
    )
    def initialize_filesystems(self):
        new_filesystems = {}
        config = self.config

        if config == {}:
            self.filesystems = new_filesystems
            return

        # Init filesystem
        for fs_config in config.get("sources", []):
            fs_name = fs_config.get("name", None)
            fs_path = fs_config.get("path", None)
            fs_protocol = fs_config.get("protocol", None)
            args = fs_config.get("args", [])
            kwargs = fs_config.get("kwargs", {})

            if fs_protocol is None:
                if fs_path:
                    fs_protocol = self._get_protocol_from_path(fs_path)
                else:
                    logger.error(
                        f"Skipping '{fs_name}': Missing 'protocol' and 'path' to infer it from"
                    )
                    continue

            # TODO: support for case no path
            # if not fs_path:
            #     logger.error(
            #         f"Filesystem '{fs_name}' with protocol 'fs_protocol' requires 'path'"
            #     )

            key = self._encode_key(fs_config)

            # Add: _is_protocol_supported? Or rely on fsspec?
            fs_async = self._async_available(fs_protocol)
            fs = fsspec.filesystem(fs_protocol, asynchronous=fs_async, *args, **kwargs)

            if fs_protocol == "memory" and not fs.exists(fs_path):
                fs.mkdir(fs_path, exists_ok=True)

            # Store the filesystem instance
            new_filesystems[key] = {
                "instance": fs,
                "name": fs_name,
                "protocol": fs_protocol,
                "path": fs._strip_protocol(fs_path),
                "canonical_path": fs.unstrip_protocol(fs_path),
            }
            logger.debug(
                f"Initialized filesystem '{fs_name}' with protocol '{fs_protocol}' at path '{fs_path}'"
            )

        self.filesystems = new_filesystems

    def check_reload_config(self):
        load_config = self.load_config()

        if not load_config.get("operation_success"):
            print(f"load_config was not succes but is: {load_config}")
            return load_config

        new_content = load_config.get("config_content", {})
        hash_new_content = self.hash_config(new_content)
        current_config_hash = self.hash_config(self.config)

        if current_config_hash != hash_new_content:
            self.config = new_content
            self.initialize_filesystems()

        return new_content

    def get_filesystem(self, key):
        return self.filesystems.get(key)

    # TODO: Update to pull full dict with all filesystems
    def get_filesystem_by_protocol(self, fs_protocol):
        for encoded_key, fs_info in self.filesystems.items():
            if fs_info.get("protocol") == fs_protocol:
                return {"key": encoded_key, "info": fs_info}
        return None

    def get_filesystem_protocol(self, key):
        filesystem_rep = self.filesystems.get(key)
        if not filesystem_rep:
            return None
        return filesystem_rep["protocol"] + "://"
