import pytest
import fsspec
from pathlib import Path
import os
import yaml
from jupyter_fsspec.file_manager import FileSystemManager
from pathlib import PurePath
from unittest.mock import patch

# Test FileSystemManager class and file operations

# ============================================================
# Test FileSystemManager config loading/read
# ============================================================
@pytest.fixture
def config_file(tmp_path):
    config = {
        'sources': [{
            'name': 'inmem',
            'path': '/mem_dir',
            'type': 'memory'
        }]
    }
    config_path = tmp_path / 'config.yaml'
    with open(config_path, 'w') as file:
        yaml.dump(config, file)
    return config_path

# @pytest.fixture
# def mock_filesystem(config_file):
#     fs_test_manager = FileSystemManager(config_file)
#     file_systems = fs_test_manager.filesystems
#     return file_systems



# test that the file systems are created
def test_filesystem_init(config_file):
    fs_test_manager = FileSystemManager(config_file)

    assert fs_test_manager is not None
    # assert 'memory' in fs_test_manager.filesystems

    # Validate in-memory filesystem
    in_memory_fs = fs_test_manager.get_filesystem(fs_test_manager._encode_key({
        'name': 'inmem',
        'path': '/mem_dir',
        'type': 'memory'
    }))

    assert in_memory_fs is not None
    # TODO:
    # assert any('memory' in key for key in fs_test_manager.filesystems)
    # assert in_memory_fs['type'] == 'memory'
    # assert in_memory_fs['path'] == '/mem_dir'

# test key encoding/decoding
def test_key_decode_encode(config_file):
    fs_test_manager = FileSystemManager(config_file)

    fs_test_config = {
        'name': 'mylocal',
        'type': 'local',
        'path':  str(config_file.parent)
    }

    # TODO: update _encoded_key
    encoded_key = fs_test_manager._encode_key(fs_test_config)
    decoded_name = fs_test_manager._decode_key(encoded_key)

    assert decoded_name == fs_test_config['name'] 


# ============================================================
# Test FileSystemManager file operations
# ============================================================
@pytest.fixture
def mock_config():
    mock_config = {
        'sources': [{
            'type': 'memory',
            'name': 'test_memory_fs',
            'path': '/test_memory'
        }]
    }
    return mock_config

@pytest.fixture
def fs_manager_instance(mock_config):
    fs_test_manager = FileSystemManager.__new__(FileSystemManager)
    fs_test_manager.config = mock_config
    fs_test_manager.filesystems = {}
    fs_test_manager._initialize_filesystems()
    return fs_test_manager

@pytest.fixture
def populated_fs_manager(mock_config, fs_manager_instance):
    key = fs_manager_instance._encode_key(mock_config['sources'][0])

    dir_path = 'test_memory'
    dest_path = 'test_dir'
    file_path = f'{dir_path}/{dest_path}/test_file_pop.txt'
    file_content = b"This is a test for a populated filesystem!"

    fs_manager_instance.write(key, dir_path, dest_path)

    fs_manager_instance.write(key, file_path, file_content)

    second_file_path = f'{dir_path}/second_test_file_pop.txt'
    second_file_content = b"Second test for a populated filesystem!"
    fs_manager_instance.write(key, second_file_path, second_file_content)
    return fs_manager_instance, key

# TODO: update config path for tests
def xtest_file_read_write(mock_config, fs_manager_instance):
    key = fs_manager_instance._encode_key(mock_config['sources'][0])

    #write
    item_path = '/test_memory/my_file.txt'
    content = b"Hello, this is a test!"

    write_result = fs_manager_instance.write(key, item_path, content)
    assert write_result['status_code'] == 200

    #read
    read_result = fs_manager_instance.read(key, item_path)
    assert read_result['status_code'] == 200
    assert read_result['response']['content'] == content.decode('utf-8')

def xtest_file_update_delete(populated_fs_manager):
    key = fs_manager_instance._encode_key(mock_config['sources'][0])

def xtest_directory_read_write(mock_config, fs_manager_instance):
    key = fs_manager_instance._encode_key(mock_config['sources'][0])

    #write
    item_path = 'test_memory'
    dest_path = 'my_test_subdir'

    write_result = fs_manager_instance.write(key, item_path, dest_path)
    assert write_result['status_code'] == 200

    #read
    read_result = fs_manager_instance.read(key, item_path)
    content_list = read_result['response']['content']
    assert read_result['status_code'] == 200

    dir_name_to_check = '/' + item_path + '/my_test_subdir'
    subdir_exists = any(item['name'] == dir_name_to_check and item['type'] == 'directory' for item in content_list)
    assert subdir_exists

def xtest_directory_update_delete(populated_fs_manager):
    key = fs_manager_instance._encode_key(mock_config['sources'][0])

    #update

    #delete