import pytest
import yaml
import os
from pydantic import ValidationError
from pathlib import Path
from jupyter_fsspec.file_manager import FileSystemManager
from unittest.mock import patch


@pytest.fixture
def config_file(tmp_path):
    config = {"sources": [{"name": "inmem", "path": "memory://mem_dir"}]}
    config_path = tmp_path / "config.yaml"
    with open(config_path, "w") as file:
        yaml.dump(config, file)
    return config_path


@pytest.fixture
def empty_config_file(tmp_path):
    config = {}
    config_path = tmp_path / "config.yaml"
    with open(config_path, "w") as file:
        yaml.dump(config, file)
    return config_path


@pytest.fixture(scope="function")
async def setup_config_dir(tmp_path: Path):
    config_dir = tmp_path / "config"
    config_dir._mkdir(exist_ok=True)

    yaml_file = config_dir / "jupyter-fsspec.yaml"
    yaml_file.write_text("")

    with patch(
        "jupyter_fsspec.file_manager.jupyter_config_dir", return_value=str(config_dir)
    ):
        print(f"Patching jupyter_config_dir to: {config_dir}")
        yield config_dir


@pytest.fixture
def mock_config():
    mock_config = {
        "sources": [
            {"protocol": "memory", "name": "test_memory_fs", "path": "/test_memory"}
        ]
    }
    return mock_config


@pytest.fixture
def invalid_mock_config():
    mock_config = {
        "sources": [
            {"protocol": "memory", "nme": "test_memory_fs", "pah": "/test_memory"}
        ]
    }
    return mock_config


@pytest.fixture(scope="function")
def bad_yaml_config(tmp_path: Path):
    config_dir = tmp_path / "config"
    config_dir.mkdir(exist_ok=True)

    yaml_content = """sources:
  - nme: "TestSourceAWS"
  path: s3://my-test-bucket/"
    kwargs:
      anon: false
      key: "my-access-key"
      secret: "my-secret-key"
    """
    yaml_file = config_dir / "jupyter-fsspec.yaml"
    yaml_file.write_text(yaml_content)
    return yaml_file


# ===============================
# Test FileSystemManager
# ===============================
def test_filesystem_init(setup_config_dir, config_file):
    fs_manager = FileSystemManager(config_file)

    assert fs_manager is not None
    assert "inmem" in fs_manager.filesystems

    # Validate in-memory filesystem
    in_memory_fs = fs_manager.get_filesystem(fs_manager._encode_key({"name": "inmem"}))

    assert in_memory_fs is not None
    assert in_memory_fs["protocol"] == "memory"
    assert in_memory_fs["path"] == "mem_dir"


def test_key_decode_encode(setup_config_dir, config_file):
    fs_manager = FileSystemManager(config_file)

    fs_test_config = {
        "name": "mylocal",
        "protocol": "local",
        "path": str(config_file.parent),
    }

    encoded_key = fs_manager._encode_key(fs_test_config)
    decoded_name = fs_manager._decode_key(encoded_key)

    assert decoded_name == fs_test_config["name"]


def test_load_config_empty(setup_config_dir, empty_config_file):
    with patch.object(FileSystemManager, "__init__", lambda self: None):
        fs_manager = FileSystemManager()

        fs_manager.filesystems = {}
        fs_manager.base_dir = setup_config_dir
        fs_manager.config_path = empty_config_file

        loaded_config = fs_manager.load_config(handle_errors=True)
        assert loaded_config == {}
        fs_manager.config = loaded_config

        fs_manager.initialize_filesystems()
        assert fs_manager.filesystems == {}


def test_load_populated_config(setup_config_dir, config_file):
    with patch.object(FileSystemManager, "__init__", lambda self: None):
        fs_manager = FileSystemManager()

        fs_manager.filesystems = {}
        fs_manager.base_dir = setup_config_dir
        fs_manager.config_path = config_file

        loaded_config = fs_manager.load_config(handle_errors=True)
        assert loaded_config == {
            "sources": [{"name": "inmem", "path": "memory://mem_dir"}]
        }
        fs_manager.config = loaded_config

        fs_manager.initialize_filesystems()
        assert len(fs_manager.filesystems) == 1
        mem_instance_info = fs_manager.filesystems["inmem"]
        assert mem_instance_info["name"] == "inmem"
        assert mem_instance_info["protocol"] == "memory"
        assert mem_instance_info["path"] == "mem_dir"
        assert mem_instance_info["canonical_path"] == "memory://inmem"

        mem_fs_instance = mem_instance_info["instance"]
        assert len(mem_fs_instance.ls("/")) == 5


def test_check_reload_config(setup_config_dir, config_file):
    with patch.object(FileSystemManager, "__init__", lambda self: None):
        fs_manager = FileSystemManager()
        fs_manager.config_path = config_file
        fs_manager.config = {}

        fs_manager.check_reload_config()

        assert len(fs_manager.filesystems) == 1
        mem_instance_info = fs_manager.filesystems["inmem"]
        assert mem_instance_info["name"] == "inmem"
        assert mem_instance_info["protocol"] == "memory"
        assert mem_instance_info["path"] == "mem_dir"
        assert mem_instance_info["canonical_path"] == "memory://inmem"

        mem_fs_instance = mem_instance_info["instance"]
        assert len(mem_fs_instance.ls("/")) == 5


def test_error_validate_config(invalid_mock_config):
    with pytest.raises(ValidationError) as exc:
        FileSystemManager.validate_config(invalid_mock_config)
    exc_msg = str(exc.value)
    assert "2 validation errors for Config" in exc_msg
    assert "sources.0.name" in exc_msg
    assert "sources.0.path" in exc_msg


def test_empty_initialize_filesystems(caplog):
    with patch.object(FileSystemManager, "__init__", lambda self: None):
        fs_manager = FileSystemManager()
        fs_manager.config = {}
        fs_manager.initialize_filesystems()

    assert "Initialized filesystem" not in caplog.text


def test_error_create_config_file(setup_config_dir, config_file):
    os.chmod(config_file, 0o44)
    with patch("os.access", return_value=False):
        with pytest.raises(PermissionError) as exc:
            fs_manager = FileSystemManager(config_file)
            fs_manager.create_config_file()

    expected_exc_msg = f"[Errno 13] Permission denied: '{config_file}'"
    assert expected_exc_msg == str(exc.value)
    os.chmod(config_file, 0o755)


def test_error_retrieve_config_content(bad_yaml_config):
    with pytest.raises(yaml.YAMLError) as exc:
        fs_manager = FileSystemManager(bad_yaml_config)
        fs_manager.retrieve_config_content()

    partial_exc_msg = "expected <block end>, but found '?'"
    assert partial_exc_msg in str(exc.value)
