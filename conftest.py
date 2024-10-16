from pathlib import Path
from unittest.mock import patch
import pytest
import fsspec
from jupyter_fsspec.file_manager import FileSystemManager

pytest_plugins = ['pytest_jupyter.jupyter_server', 'jupyter_server.pytest_plugin',
                   'pytest_asyncio']

@pytest.fixture(scope='function', autouse=True)
def setup_config_file_fs(tmp_path: Path):
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
  - name: "TestDir"
    path: "/Users/someuser/Desktop/test_fsspec"
    type: "local"
  - name: "TestEmptyLocalDir"
    path: "/Users/someuser/Desktop/notebooks/sample/nothinghere"
    type: "local"
  - name: "TestMem Source"
    path: "/my_mem_dir"
    type: "memory"
    """
    yaml_file = config_dir / "jupyter-fsspec.yaml"
    yaml_file.write_text(yaml_content)

    with patch('jupyter_fsspec.file_manager.jupyter_config_dir', return_value=str(config_dir)):
        print(f"Patching jupyter_config_dir to: {config_dir}")
        fs_manager = FileSystemManager(config_file='jupyter-fsspec.yaml')

    return fs_manager

@pytest.fixture(scope='function')
def fs_manager_instance(setup_config_file_fs):
    fs_manager = setup_config_file_fs
    fs_info = fs_manager.get_filesystem_by_type('memory')
    key = fs_info['key']
    fs = fs_info['info']['instance']
    mem_root_path = fs_info['info']['path']

    if fs:
        if fs.exists(f'{mem_root_path}/test_dir'):
            fs.rm(f'{mem_root_path}/test_dir', recursive=True)
        if fs.exists(f'{mem_root_path}/second_dir'):
            fs.rm(f'{mem_root_path}/second_dir', recursive=True)

        fs.touch(f'{mem_root_path}/file_in_root.txt')
        with fs.open(f'{mem_root_path}/file_in_root.txt', 'wb') as f:
            f.write("Root file content".encode())

        fs.mkdir(f'{mem_root_path}/test_dir', exist_ok=True)
        fs.mkdir(f'{mem_root_path}/second_dir', exist_ok=True)
        # fs.mkdir(f'{mem_root_path}/second_dir/subdir', exist_ok=True)
        fs.touch(f'{mem_root_path}/test_dir/file1.txt')
        with fs.open(f'{mem_root_path}/test_dir/file1.txt', "wb") as f:
            f.write("Test content".encode())
            f.close()
    else:
        print("In memory filesystem NOT FOUND")

    if fs.exists(f'{mem_root_path}/test_dir/file1.txt'):
        file_info = fs.info(f'{mem_root_path}/test_dir/file1.txt')
        print(f"File exists. size: {file_info}")
    else:
        print("File does not exist!")
    return fs_manager

@pytest.fixture(params=['memory', 'local', 's3'])
def filesystem_type(request):
    return request.param

@pytest.fixture(scope="function")
def populated_file_system(filesystem_type):
    fs_manager = FileSystemManager(config_file='jupyter-fsspec.yaml')
    fs_type = filesystem_type
    print(f"fs_manager: {fs_manager}")
    fs_info = fs_manager.get_filesystem_by_type(fs_type)
    key = fs_info['key']
    fs = fs_info['info']['instance']
    root_path = fs_info['info']['path']
    print(f"key: {key}")
    print(f"fs: {fs}")
    print(f"root_path: {root_path}")
    if fs:
        # Delete any existting directories
        # Populate the filesystem
        # mkdir => root_path + 'rootA'
        # mkdir => root_path + 'rootB'
        # touch => root_path + 'file1.txt'
        # touch => root_path + 'rootA' + 'file_in_rootA.txt'
        print(f'valid filesystem: {fs}')
    else:
        print(f"invalid filesystem: {fs}")
    return {"fs_type": fs_type, "fs_manager": fs_manager}


@pytest.fixture(scope='function')
def fs_manager_instance_parameterized(populated_file_system):
    fs_ret = populated_file_system
    fs_type = fs_ret['fs_type']
    fs_manager = fs_ret["fs_manager"]
    fs_info = fs_manager.get_filesystem_by_type(fs_type)
    key = fs_info['key']
    fs = fs_info['info']['instance']
    root_path = fs_info['info']['path']
    print(f"root_path is: {root_path}")
    print(f"fs value is: {fs}")
    # fs_info = fs_manager.get_filesystem_by_type('local')
    # key = fs_info['key']
    # fs = fs_info['info']['instance']
    # local_root_path = fs_info['info']['path']

    if fs:
        #TODO: Update file creation FOR PATHS!!!
        if fs.exists(f'{root_path}/test_dir'):
            print(f"{root_path}/test_dir EXISTS!!!!")
            # fs.rm(f'{root_path}/test_dir', recursive=True)
        if fs.exists(f'{root_path}/second_dir'):
            print(f"{root_path}/second_dir EXISTS!!!!")
            # fs.rm('/my_dir/second_dir', recursive=True)

        fs.touch(f'{root_path}/file_in_root.txt')
        with fs.open(f'{root_path}/file_in_root.txt', 'wb') as f:
            f.write("Root file content".encode())

        # fs.mkdir('/my_dir/test_dir', exist_ok=True)
        # fs.mkdir('/my_dir/second_dir', exist_ok=True)
        # # fs.mkdir('/my_dir/second_dir/subdir', exist_ok=True)
        # fs.touch('/my_dir/test_dir/file1.txt')
        # with fs.open('/my_dir/test_dir/file1.txt', "wb") as f:
        #     f.write("Test content".encode())
        #     f.close()
    else:
        print(f"Filesystem of type {fs_type} NOT FOUND")

    if fs.exists(f'{root_path}test_dir/file1.txt'):
        file_info = fs.info(f'/{root_path}/test_dir/file1.txt')
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
