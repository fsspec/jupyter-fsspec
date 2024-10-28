import json
import os
import pytest

from tornado.httpclient import HTTPClientError
# TODO: Testing: different file types, received expected errors

async def test_get_config(jp_fetch):
    response = await jp_fetch("jupyter_fsspec", "config", method="GET")
    assert response.code == 200

    json_body = response.body.decode('utf-8')
    body = json.loads(json_body)
    assert body['status'] == 'success'

async def test_get_files_memory(fs_manager_instance, jp_fetch):
    fs_manager = fs_manager_instance
    mem_fs_info = fs_manager.get_filesystem_by_type('memory')
    mem_key = mem_fs_info['key']
    mem_fs = mem_fs_info['info']['instance']
    mem_item_path = mem_fs_info['info']['path']
    assert mem_fs != None

    # Read directory
    assert mem_fs.exists(mem_item_path) == True
    dir_payload = {"item_path": mem_item_path}
    dir_response = await jp_fetch("jupyter_fsspec", "files", method="GET", params={"key": mem_key}, body=json.dumps(dir_payload), allow_nonstandard_methods=True)
    
    assert dir_response.code == 200
    json_body = dir_response.body.decode('utf-8')
    body = json.loads(json_body)
    assert body['status'] == 'success'
    assert len(body['content']) == 3

    # Read File
    filepath = "/my_mem_dir/test_dir/file1.txt"
    assert mem_fs.exists(filepath) == True
    file_payload = {"item_path": filepath}
    file_res = await jp_fetch("jupyter_fsspec", "files", method="GET", params={"key": mem_key}, body=json.dumps(file_payload), allow_nonstandard_methods=True)
    assert file_res.code == 200
    
    file_json_body = file_res.body.decode('utf-8')
    file_body = json.loads(file_json_body)
    assert file_body['status'] == 'success'
    assert file_body['content'] == "Test content"

    # GET file byte range
    range_filepath = "/my_mem_dir/test_dir/file1.txt"
    # previously checked file exists
    range_file_payload = {"item_path": range_filepath}
    range_file_res = await jp_fetch("jupyter_fsspec", "files", method="GET", headers={"Range": "0-8"}, params={"key": mem_key, "type": "range"}, body=json.dumps(range_file_payload), allow_nonstandard_methods=True)
    assert range_file_res.code == 206

    range_json_file_body = range_file_res.body.decode('utf-8')
    range_file_body = json.loads(range_json_file_body)
    assert range_file_body['status'] == 'success'
    assert range_file_body['content'] == 'Test cont'

async def test_post_files(fs_manager_instance, jp_fetch):
    fs_manager = fs_manager_instance
    mem_fs_info = fs_manager.get_filesystem_by_type('memory')
    mem_key = mem_fs_info['key']
    mem_fs = mem_fs_info['info']['instance']
    assert mem_fs != None

    # Post new file with content
    filepath = "/my_mem_dir/test_dir/file2.txt"
    # File does not already exist
    assert mem_fs.exists(filepath) == False
    file_payload = { "item_path": filepath, "content": "This is test file2 content"}
    file_response = await jp_fetch("jupyter_fsspec", "files", method="POST", params={"key": mem_key}, body=json.dumps(file_payload))
    assert file_response.code == 200

    file_json_body = file_response.body.decode('utf-8')
    file_body = json.loads(file_json_body)
    assert file_body['status'] == 'success'
    assert file_body['description'] == 'Wrote /my_mem_dir/test_dir/file2.txt'
    assert mem_fs.exists(filepath) == True

    # Post directory
    newdirpath = "/my_mem_dir/test_dir/subdir"
    # Directory does not already exist
    assert mem_fs.exists(newdirpath) == False
    dir_payload = {"item_path": "/my_mem_dir/test_dir", "content": "subdir"}
    dir_response = await jp_fetch("jupyter_fsspec", "files", method="POST",  params={"key": mem_key}, body=json.dumps(dir_payload))
    assert dir_response.code == 200
    dir_body_json = dir_response.body.decode('utf-8')
    dir_body =  json.loads(dir_body_json)

    assert dir_body['status'] == 'success'
    assert dir_body['description'] == 'Wrote /my_mem_dir/test_dir/subdir/'

async def test_delete_files(fs_manager_instance, jp_fetch):
    fs_manager = fs_manager_instance
    mem_fs_info = fs_manager.get_filesystem_by_type('memory')
    mem_key = mem_fs_info['key']
    mem_fs = mem_fs_info['info']['instance']
    assert mem_fs != None

    # Delete file
    filepath = '/my_mem_dir/test_dir/file1.txt'
    assert mem_fs.exists(filepath) == True

    file_payload = {"item_path": filepath}
    response = await jp_fetch("jupyter_fsspec", "files", method="DELETE", params={"key": mem_key}, body=json.dumps(file_payload), allow_nonstandard_methods=True)
    assert response.code == 200
    json_body = response.body.decode('utf-8')
    body = json.loads(json_body)

    assert body['status'] == 'success'
    assert mem_fs.exists(filepath) == False

    #delete directory
    dirpath = "/my_mem_dir/test_dir"
    assert mem_fs.exists(dirpath) == True

    dir_payload = {"item_path": dirpath}
    dir_response = await jp_fetch("jupyter_fsspec", "files", method="DELETE", params={"key": mem_key}, body=json.dumps(dir_payload), allow_nonstandard_methods=True)
    assert dir_response.code == 200
    dir_json_body = response.body.decode('utf-8')
    dir_body = json.loads(dir_json_body)

    assert dir_body['status'] == 'success'
    assert mem_fs.exists(dirpath) == False

async def test_put_files(fs_manager_instance, jp_fetch):
    # PUT replace entire resource
    fs_manager = fs_manager_instance
    mem_fs_info = fs_manager.get_filesystem_by_type('memory')
    mem_key = mem_fs_info['key']
    mem_fs = mem_fs_info['info']['instance']
    assert mem_fs != None

    # replace entire file content
    filepath = '/my_mem_dir/test_dir/file1.txt'
    file_payload = {"item_path": filepath, "content": "Replaced content"}
    file_response = await jp_fetch("jupyter_fsspec", "files", method="PUT", params={"key": mem_key}, body=json.dumps(file_payload))
    assert file_response.code == 200

    file_body_json = file_response.body.decode('utf-8')
    file_body = json.loads(file_body_json)
    assert file_body["status"] == 'success'
    assert file_body['description'] == 'Wrote /my_mem_dir/test_dir/file1.txt'

    # replacing directory returns error
    dirpath = '/my_mem_dir/test_dir'
    dir_payload = {"item_path": dirpath, "content": "new_test_dir"}
    with pytest.raises(HTTPClientError) as exc_info:
        await jp_fetch("jupyter_fsspec", "files", method="PUT", params={"key": mem_key}, body=json.dumps(dir_payload))
    assert exc_info.value.code == 409

async def test_rename_files(fs_manager_instance, jp_fetch):
    fs_manager = fs_manager_instance
    mem_fs_info = fs_manager.get_filesystem_by_type('memory')
    mem_key = mem_fs_info['key']
    mem_fs = mem_fs_info['info']['instance']
    assert mem_fs != None

    # rename file
    filepath = '/my_mem_dir/test_dir/file1.txt'
    file_payload = {"item_path": filepath, "content": "new_file"}
    file_response = await jp_fetch("jupyter_fsspec", "files", "rename", method="POST", params={"key": mem_key}, body=json.dumps(file_payload))
    assert file_response.code == 200

    file_body_json = file_response.body.decode('utf-8')
    file_body = json.loads(file_body_json)
    assert file_body["status"] == 'success'
    assert file_body['description'] == 'Renamed /my_mem_dir/test_dir/file1.txt to /my_mem_dir/test_dir/new_file.txt'


    # rename directory
    dirpath = '/my_mem_dir/second_dir'
    dir_payload = {"item_path": dirpath, "content": "new_dir"}
    dir_response = await jp_fetch("jupyter_fsspec", "files", "rename", method="POST", params={"key": mem_key}, body=json.dumps(dir_payload))
    assert dir_response.code == 200

    dir_body_json = dir_response.body.decode('utf-8')
    dir_body = json.loads(dir_body_json)
    assert dir_body["status"] == 'success'
    assert dir_body['description'] == "Renamed /my_mem_dir/second_dir to /my_mem_dir/new_dir"

# TODO: Implement update functionality
# PATCH partial update without modifying entire data 
async def test_patch_file(fs_manager_instance, jp_fetch):
    #file only
    fs_manager = fs_manager_instance
    mem_fs_info = fs_manager.get_filesystem_by_type('memory')
    mem_key = mem_fs_info['key']
    mem_fs = mem_fs_info['info']['instance']
    assert mem_fs != None

    # replace partial file content
    filepath = '/my_mem_dir/test_dir/file1.txt'
    old_content = 'Test content'
    file_payload = {"item_path": filepath, "content": " and new"}
    file_res = await jp_fetch("jupyter_fsspec", "files", method="PATCH", params={"key": mem_key}, body=json.dumps(file_payload))
    assert file_res.code == 200

async def test_action_same_fs_files(fs_manager_instance, jp_fetch):
    fs_manager = fs_manager_instance
    mem_fs_info = fs_manager.get_filesystem_by_type('memory')
    mem_key = mem_fs_info['key']
    mem_fs = mem_fs_info['info']['instance']
    assert mem_fs != None

    # Copy
    copy_filepath = '/my_mem_dir/test_dir/file1.txt'
    copy_file_payload = {"item_path": copy_filepath, "content": "/my_mem_dir/file_to_copy.txt", "action": "copy"}
    copy_file_res = await jp_fetch("jupyter_fsspec", "files", "action", method="POST", params={"key": mem_key}, body=json.dumps(copy_file_payload))

    cfile_body_json = copy_file_res.body.decode('utf-8')
    cfile_body = json.loads(cfile_body_json)
    assert cfile_body["status"] == 'success'
    assert cfile_body['description'] == 'Copied /my_mem_dir/test_dir/file1.txt to /my_mem_dir/file_to_copy.txt'

    # Copy directory
    copy_dirpath = '/my_mem_dir/test_dir'
    copy_dir_payload = {"item_path": copy_dirpath, "content": "/my_mem_dir/second_dir", "action": "copy"}
    copy_dir_res = await jp_fetch("jupyter_fsspec", "files", "action", method="POST", params={"key": mem_key}, body=json.dumps(copy_dir_payload))

    cdir_body_json = copy_dir_res.body.decode('utf-8')
    cdir_body = json.loads(cdir_body_json)
    assert cdir_body["status"] == 'success'
    assert cdir_body['description'] == 'Copied /my_mem_dir/test_dir to /my_mem_dir/second_dir'

    # Move file
    move_filepath = '/my_mem_dir/test_dir/file1.txt'
    move_file_payload = {"item_path": move_filepath, "content": "/my_mem_dir/new_file", "action": "move"}
    move_file_res = await jp_fetch("jupyter_fsspec", "files", "action", method="POST", params={"key": mem_key}, body=json.dumps(move_file_payload))
    assert move_file_res.code == 200

    mfile_body_json = move_file_res.body.decode('utf-8')
    mfile_body = json.loads(mfile_body_json)
    assert mfile_body["status"] == 'success'
    assert mfile_body['description'] == 'Moved /my_mem_dir/test_dir/file1.txt to /my_mem_dir/new_file.txt'

    # Move directory
    move_dirpath = '/my_mem_dir/test_dir'
    move_dir_payload = {"item_path": move_dirpath, "content": "/my_mem_dir/second_dir", "action": "move"}
    move_dir_res = await jp_fetch("jupyter_fsspec", "files", "action", method="POST", params={"key": mem_key}, body=json.dumps(move_dir_payload))
    
    mdir_body_json = move_dir_res.body.decode('utf-8')
    mdir_body = json.loads(mdir_body_json)
    assert mdir_body["status"] == 'success'
    assert mdir_body['description'] == 'Moved /my_mem_dir/test_dir to /my_mem_dir/second_dir'

#TODO: Test xaction endpoint
async def xtest_xaction_diff_fs(fs_manager_instance, jp_fetch):
    pass