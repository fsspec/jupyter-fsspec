from pathlib import Path
from unittest.mock import patch
import pytest
import fsspec
from jupyter_fsspec.file_manager import FileSystemManager


pytest_plugins = ['pytest_jupyter.jupyter_server', 'jupyter_server.pytest_plugin',
                   'pytest_asyncio']

@pytest.fixture(scope='function', autouse=True)
def setup_config_file(tmp_path: Path):
    config_dir = tmp_path / "config"
    config_dir.mkdir(exist_ok=True)

    yaml_content = """sources:
  - name: "TestSourceAWS"
    path: "/path/to/set1"
    type: "s3"
    additional_options:
      anon: false
      key: "my-access-key"
      secret: "my-secret-key"
  - name: "TestSourceDisk"
    path: "."
    type: "local"
  - name: "TestDir"
    path: "/Users/rosioreyes/Desktop/test_fsspec"
    type: "local"
  - name: "TestEmptyLocalDir"
    path: "/Users/rosioreyes/Desktop/notebooks/sample/nothinghere"
    type: "local"
  - name: "TestMem Source"
    path: "/my_mem_dir"
    type: "memory"
  - name: "TestDoesntExistDir"
    path: "/Users/rosioreyes/Desktop/notebooks/doesnotexist"
    type: "local"
    """
    yaml_file = config_dir / "jupyter-fsspec.yaml"
    yaml_file.write_text(yaml_content)

    with patch('jupyter_core.paths.jupyter_config_dir', return_value=str(config_dir)):
        print(f"Patching jupyter_config_dir to: {config_dir}")
        yield


@pytest.fixture(scope='function')
def fs_manager_instance(setup_config_file):
    fs_manager = FileSystemManager(config_file='jupyter-fsspec.yaml')
    fs_info = fs_manager.get_filesystem_by_type('memory')
    key = fs_info['key']
    fs = fs_info['info']['instance']
    mem_root_path = fs_info['info']['path']

    if fs:
        if fs.exists('/my_mem_dir/test_dir'):
            fs.rm('/my_mem_dir/test_dir', recursive=True)
        if fs.exists('/my_mem_dir/second_dir'):
            fs.rm('/my_mem_dir/second_dir', recursive=True)

        fs.touch('/my_mem_dir/file_in_root.txt')
        with fs.open('/my_mem_dir/file_in_root.txt', 'wb') as f:
            f.write("Root file content".encode())

        fs.mkdir('/my_mem_dir/test_dir', exist_ok=True)
        fs.mkdir('/my_mem_dir/second_dir', exist_ok=True)
        # fs.mkdir('/my_mem_dir/second_dir/subdir', exist_ok=True)
        fs.touch('/my_mem_dir/test_dir/file1.txt')
        with fs.open('/my_mem_dir/test_dir/file1.txt', "wb") as f:
            f.write("Test content".encode())
            f.close()
    else:
        print("In memory filesystem NOT FOUND")

    if fs.exists('/my_mem_dir/test_dir/file1.txt'):
        file_info = fs.info('/my_mem_dir/test_dir/file1.txt')
        print(f"File exists. size: {file_info}")
    else:
        print("File does not exist!")
    return fs_manager

@pytest.fixture
def jp_server_config(jp_server_config):
    return {
        "ServerApp": {
            "jpserver_extensions": {
                "jupyter_fsspec": True
            }
        }
    }
