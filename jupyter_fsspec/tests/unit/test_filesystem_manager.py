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

    encoded_key = fs_test_manager._encode_key(fs_test_config)
    decoded_type, decoded_path = fs_test_manager._decode_key(encoded_key)

    # Ensure both paths are absolute by adding leading slash if missing
    decoded_path = '/' + decoded_path.lstrip('/')  # Normalize decoded path
    fs_test_config['path'] = '/' + fs_test_config['path'].lstrip('/')  # Normalize original path

    assert decoded_path == fs_test_config['path']  # Compare as strings
    assert decoded_type == fs_test_config['type']


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


def test_file_read_write(mock_config, fs_manager_instance):
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

def test_directory_read_write(mock_config, fs_manager_instance):
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







# ============================================================
# OLD Test FileSystemManager file operations
# ============================================================
# provide the file system with all needed information like key, path etc
# def generate_fs():
#     fs_test_config = {
#         'name': 'mylocal',
#         'type': 'local',
#         'path':  str(config_file.parent)
#     }

# create file
#TODO: create fs_manager fixture to include for these tests?
# def test_create_file(config_file):
#     fs_test_manager = FileSystemManager(config_file)
#     filesystems = fs_test_manager.filesystems

#     for key in filesystems.keys():
#         fs_path = filesystems[key]['path']

#         file_path = 'test_create_file.txt'
#         complete_file_path = str(PurePath(fs_path) / file_path)
#         content = b'testing file content'

#         fs_test_manager.write(key, complete_file_path, content)

#         fs_info = fs_test_manager.get_filesystem(key)
#         fs = fs_info['instance']
#         assert fs.exists(complete_file_path), "File should exist"

#         file_content = fs.cat(complete_file_path)
#         assert file_content == content, "File content should match expected content."


# create directory
# def test_create_dir(config_file):
#     fs_test_manager = FileSystemManager(config_file)
#     filesystems = fs_test_manager.filesystems

#     for key in filesystems.keys():
#         fs_path = filesystems[key]['path']

#         dir_name = 'testing_dir_name'

#         fs_test_manager.write(key, fs_path, dir_name)
#         complete_file_path = str(PurePath(fs_path) / dir_name) + '/'

#         fs_info = fs_test_manager.get_filesystem(key)
#         fs = fs_info['instance']
#         assert fs.exists(complete_file_path), "Directory should exist"



# read file
# TODO: use memory filesystem and mock_filesystem dict
# def test_read_file_success(memory_filesystem):
#     mock_filesystem = {
#         '/dir1': {},
#         '/dir1/file1.txt': 'Content of file1.',
#         '/dir1/file2.txt': 'Content of file2.',
#         '/dir2': {},
#         '/dir2/subdir': {},
#         '/dir2/subdir/file3.txt': 'Content of file3 in subdir of dir2.'
#     }

#     with patch(fsspec.filesystem)
# def populate_filesystem(filesystem, structure, base_path='/'):
#     for name, content in structure.items():
#         path = f"{base_path.rstrip('/')/{name}}"

#         if isinstance(content, dict):
#             filesystem.mkdir(path)
#             populate_filesystem(filesystem, content, base_path=path)
#         else:
#             if isinstance(content, bytes):
#                 filesystem.pipe(path, content)
#             else:
#                 filesystem.pipe(path, content.encode())

# @pytest.fixture
# def populated_filesystem(mock_filesystem):
#     directory_structure = {
#         'dir1': {
#             'file1.txt': 'Content of file1 in dir1.',
#             'file2.txt': 'Content of file2 in dir1.',
#         },
#         'dir2': {
#             'subdir': {
#                 'file3.txt': 'Content of file3 in subdir of dir2.',
#                 'file4.txt': 'Content of file4 in subdir of dir2.',
#             },
#         },
#         'fileOne.txt': 'This is content of fileOne in root dir.',
#         'fileTwo.txt': 'This is content of fileTwo in root dir.',
#         'binaryfile.bin': b'\x00\x01\x02'
#     }

#     key, fs_info = next(iter(mock_filesystem.items()))
#     fs_path = fs_info['path']
#     fs = fs_info['instance'] 
#     populate_filesystem(fs, directory_structure, fs_path)

#     return fs, key, fs_path


# def test_read_file(config_file):
#     fs_test_manager = FileSystemManager(config_file)
#     filesystems = fs_test_manager.filesystems

#     for key in filesystems.keys():
#         fs_path = filesystems[key]['path']

#         fs_info = fs_test_manager.get_filesystem(key)
#         fs = fs_info['instance']
# def test_read_file(populated_filesystem):
#     fs, key, item_path = populated_filesystem
#     content = fs.read()


# # read directory
# def test_read_dir_success(config_file):
#     fs_test_manager = FileSystemManager(config_file)

#     fs = fs_test_manager.filesystems
#
#
#
#
#
#
#
#





# # write file
# def test_write_file_success(config_file):
#     fs_test_manager = FileSystemManager(config_file)

#     fs = fs_test_manager.filesystems
#
#
#
#
#
#
#
#

# # delete file
# def test_delete_file_success(config_file):
#     fs_test_manager = FileSystemManager(config_file)

#     fs = fs_test_manager.filesystems


# # delete directory
# def test_delete_dir_success(config_file):
    # fs_test_manager = FileSystemManager(config_file)

    # fs = fs_test_manager.filesystems