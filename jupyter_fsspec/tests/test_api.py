import json
import pytest
from tornado.httpclient import HTTPClientError
# TODO: Testing: different file types, received expected errors


async def test_get_config(setup_config_file_fs, jp_fetch):
    response = await jp_fetch("jupyter_fsspec", "config", method="GET")
    assert response.code == 200

    json_body = response.body.decode("utf-8")
    body = json.loads(json_body)
    assert body["status"] == "success"
    assert (
        body["description"]
        == "Retrieved available filesystems from configuration file."
    )
    assert len(body["content"]) == 4


@pytest.mark.no_setup_config_file_fs
async def test_no_config(no_config_permission, jp_fetch):
    with pytest.raises(HTTPClientError) as exc_info:
        await jp_fetch("jupyter_fsspec", "config", method="GET")
    assert exc_info.value.code == 500


@pytest.mark.no_setup_config_file_fs
async def test_malformed_config(malformed_config, jp_fetch):
    with pytest.raises(HTTPClientError) as exc_info:
        await jp_fetch("jupyter_fsspec", "config", method="GET")
    assert exc_info.value.code == 500


@pytest.mark.no_setup_config_file_fs
async def test_bad_config_info(bad_info_config, jp_fetch):
    with pytest.raises(HTTPClientError) as exc_info:
        await jp_fetch("jupyter_fsspec", "config", method="GET")
    assert exc_info.value.code == 500


@pytest.mark.no_setup_config_file_fs
async def test_empty_config(empty_config, jp_fetch):
    fetch_config = await jp_fetch("jupyter_fsspec", "config", method="GET")
    assert fetch_config.code == 200

    json_body = fetch_config.body.decode("utf-8")
    body = json.loads(json_body)
    assert body["status"] == "success"
    assert len(body["content"]) == 0


async def test_get_files_memory(fs_manager_instance, jp_fetch):
    fs_manager = fs_manager_instance
    mem_fs_info = fs_manager.get_filesystem_by_protocol("memory")
    mem_key = mem_fs_info["key"]
    mem_fs = mem_fs_info["info"]["instance"]
    mem_item_path = mem_fs_info["info"]["path"]
    assert mem_fs is not None

    # Read directory
    assert mem_fs.exists(mem_item_path)
    dir_response = await jp_fetch(
        "jupyter_fsspec",
        "files",
        method="GET",
        params={"key": mem_key, "item_path": mem_item_path},
        allow_nonstandard_methods=True,
    )

    assert dir_response.code == 200
    json_body = dir_response.body.decode("utf-8")
    body = json.loads(json_body)
    assert body["status"] == "success"
    assert len(body["content"]) == 3

    # Read File
    filepath = "/my_mem_dir/test_dir/file1.txt"
    assert mem_fs.exists(filepath)
    file_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        method="GET",
        params={"key": mem_key, "item_path": filepath},
    )
    assert file_res.code == 200

    file_json_body = file_res.body.decode("utf-8")
    file_body = json.loads(file_json_body)
    assert file_body["status"] == "success"
    assert file_body["content"] == "Test content"

    # GET file byte range
    range_filepath = "/my_mem_dir/test_dir/file1.txt"
    # previously checked file exists
    range_file_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        method="GET",
        headers={"Range": "0-8"},
        params={"key": mem_key, "type": "range", "item_path": range_filepath},
    )
    assert range_file_res.code == 200

    range_json_file_body = range_file_res.body.decode("utf-8")
    range_file_body = json.loads(range_json_file_body)
    assert range_file_body["status"] == "success"
    assert range_file_body["content"] == "Test con"


async def test_post_files(fs_manager_instance, jp_fetch):
    fs_manager = fs_manager_instance
    mem_fs_info = fs_manager.get_filesystem_by_protocol("memory")
    mem_key = mem_fs_info["key"]
    mem_fs = mem_fs_info["info"]["instance"]
    assert mem_fs is not None

    # Post new file with content
    filepath = "/my_mem_dir/test_dir/file2.txt"
    # File does not already exist
    assert not mem_fs.exists(filepath)
    file_payload = {"item_path": filepath, "content": "This is test file2 content"}
    file_response = await jp_fetch(
        "jupyter_fsspec",
        "files",
        method="POST",
        params={"key": mem_key},
        body=json.dumps(file_payload),
    )
    assert file_response.code == 200

    file_json_body = file_response.body.decode("utf-8")
    file_body = json.loads(file_json_body)
    assert file_body["status"] == "success"
    assert file_body["description"] == "Wrote /my_mem_dir/test_dir/file2.txt."
    assert mem_fs.exists(filepath)

    # Post directory
    newdirpath = "/my_mem_dir/test_dir/subdir/"
    # Directory does not already exist
    assert not mem_fs.exists(newdirpath)
    dir_payload = {"item_path": newdirpath}
    dir_response = await jp_fetch(
        "jupyter_fsspec",
        "files",
        method="POST",
        params={"key": mem_key},
        body=json.dumps(dir_payload),
    )
    assert dir_response.code == 200
    dir_body_json = dir_response.body.decode("utf-8")
    dir_body = json.loads(dir_body_json)

    assert dir_body["status"] == "success"
    assert dir_body["description"] == "Wrote /my_mem_dir/test_dir/subdir/."


async def test_delete_files(fs_manager_instance, jp_fetch):
    fs_manager = fs_manager_instance
    mem_fs_info = fs_manager.get_filesystem_by_protocol("memory")
    mem_key = mem_fs_info["key"]
    mem_fs = mem_fs_info["info"]["instance"]
    assert mem_fs is not None

    # Delete file
    filepath = "/my_mem_dir/test_dir/file1.txt"
    assert mem_fs.exists(filepath)

    file_payload = {"item_path": filepath}
    response = await jp_fetch(
        "jupyter_fsspec",
        "files",
        method="DELETE",
        params={"key": mem_key},
        body=json.dumps(file_payload),
        allow_nonstandard_methods=True,
    )
    assert response.code == 200
    json_body = response.body.decode("utf-8")
    body = json.loads(json_body)

    assert body["status"] == "success"
    assert body["description"] == f"Deleted {filepath}."
    assert not mem_fs.exists(filepath)

    # delete directory
    dirpath = "/my_mem_dir/test_dir"
    assert mem_fs.exists(dirpath)

    dir_payload = {"item_path": dirpath}
    dir_response = await jp_fetch(
        "jupyter_fsspec",
        "files",
        method="DELETE",
        params={"key": mem_key},
        body=json.dumps(dir_payload),
        allow_nonstandard_methods=True,
    )
    assert dir_response.code == 200
    dir_json_body = dir_response.body.decode("utf-8")
    dir_body = json.loads(dir_json_body)

    assert dir_body["status"] == "success"
    assert dir_body["description"] == f"Deleted {dirpath}."
    assert not mem_fs.exists(dirpath)


async def test_put_files(fs_manager_instance, jp_fetch):
    # PUT replace entire resource
    fs_manager = fs_manager_instance
    mem_fs_info = fs_manager.get_filesystem_by_protocol("memory")
    mem_key = mem_fs_info["key"]
    mem_fs = mem_fs_info["info"]["instance"]
    assert mem_fs is not None

    # replace entire file content
    filepath = "/my_mem_dir/test_dir/file1.txt"
    file_payload = {"item_path": filepath, "content": "Replaced content"}
    file_response = await jp_fetch(
        "jupyter_fsspec",
        "files",
        method="PUT",
        params={"key": mem_key},
        body=json.dumps(file_payload),
    )
    assert file_response.code == 200

    file_body_json = file_response.body.decode("utf-8")
    file_body = json.loads(file_body_json)
    assert file_body["status"] == "success"
    assert file_body["description"] == "Updated file /my_mem_dir/test_dir/file1.txt."

    # replacing directory returns error
    dirpath = "/my_mem_dir/test_dir"
    dir_payload = {"item_path": dirpath, "content": "new_test_dir"}
    with pytest.raises(HTTPClientError) as exc_info:
        await jp_fetch(
            "jupyter_fsspec",
            "files",
            method="PUT",
            params={"key": mem_key},
            body=json.dumps(dir_payload),
        )
    assert exc_info.value.code == 500


async def test_rename_files(fs_manager_instance, jp_fetch):
    fs_manager = fs_manager_instance
    mem_fs_info = fs_manager.get_filesystem_by_protocol("memory")
    mem_key = mem_fs_info["key"]
    mem_fs = mem_fs_info["info"]["instance"]
    assert mem_fs is not None

    # rename file
    filepath = "/my_mem_dir/test_dir/file1.txt"
    file_payload = {
        "item_path": filepath,
        "content": "/my_mem_dir/test_dir/new_file.txt",
    }
    file_response = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "rename",
        method="POST",
        params={"key": mem_key},
        body=json.dumps(file_payload),
    )
    assert file_response.code == 200

    file_body_json = file_response.body.decode("utf-8")
    file_body = json.loads(file_body_json)
    assert file_body["status"] == "success"
    assert (
        file_body["description"]
        == "Renamed /my_mem_dir/test_dir/file1.txt to /my_mem_dir/test_dir/new_file.txt."
    )
    assert not mem_fs.exists(filepath)
    assert mem_fs.exists("/my_mem_dir/test_dir/new_file.txt")

    # rename directory
    dirpath = "/my_mem_dir/second_dir"
    dir_payload = {"item_path": dirpath, "content": "/my_mem_dir/new_dir"}
    dir_response = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "rename",
        method="POST",
        params={"key": mem_key},
        body=json.dumps(dir_payload),
    )
    assert dir_response.code == 200

    dir_body_json = dir_response.body.decode("utf-8")
    dir_body = json.loads(dir_body_json)
    assert dir_body["status"] == "success"
    assert (
        dir_body["description"]
        == "Renamed /my_mem_dir/second_dir to /my_mem_dir/new_dir."
    )
    assert not mem_fs.exists(dirpath)
    assert mem_fs.exists("/my_mem_dir/new_dir")


# TODO: Implement update functionality
# PATCH partial update without modifying entire data
async def xtest_patch_file(fs_manager_instance, jp_fetch):
    # file only
    fs_manager = fs_manager_instance
    mem_fs_info = fs_manager.get_filesystem_by_protocol("memory")
    mem_key = mem_fs_info["key"]
    mem_fs = mem_fs_info["info"]["instance"]
    assert mem_fs is not None

    # replace partial file content
    filepath = "/my_mem_dir/test_dir/file1.txt"
    file_payload = {"item_path": filepath, "content": " and new"}
    file_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        method="PATCH",
        params={"key": mem_key},
        body=json.dumps(file_payload),
    )
    assert file_res.code == 200


# TODO:
async def xtest_action_same_fs_files(fs_manager_instance, jp_fetch):
    fs_manager = fs_manager_instance
    # get_filesystem_by_protocol(filesystem_protocol_string) returns first instance of that filesystem protocol
    mem_fs_info = fs_manager.get_filesystem_by_protocol("memory")
    mem_key = mem_fs_info["key"]
    mem_fs = mem_fs_info["info"]["instance"]
    assert mem_fs is not None

    # Copy
    copy_filepath = "/my_mem_dir/test_dir/file1.txt"
    copy_file_payload = {
        "item_path": copy_filepath,
        "content": "/my_mem_dir/file_to_copy.txt",
        "action": "copy",
    }
    copy_file_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "action",
        method="POST",
        params={"key": mem_key},
        body=json.dumps(copy_file_payload),
    )

    cfile_body_json = copy_file_res.body.decode("utf-8")
    cfile_body = json.loads(cfile_body_json)
    assert cfile_body["status"] == "success"
    assert (
        cfile_body["description"]
        == "Copied /my_mem_dir/test_dir/file1.txt to /my_mem_dir/file_to_copy.txt."
    )

    # Copy directory
    copy_dirpath = "/my_mem_dir/test_dir"
    copy_dir_payload = {
        "item_path": copy_dirpath,
        "content": "/my_mem_dir/second_dir",
        "action": "copy",
    }
    copy_dir_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "action",
        method="POST",
        params={"key": mem_key},
        body=json.dumps(copy_dir_payload),
    )

    cdir_body_json = copy_dir_res.body.decode("utf-8")
    cdir_body = json.loads(cdir_body_json)
    assert cdir_body["status"] == "success"
    assert (
        cdir_body["description"]
        == "Copied /my_mem_dir/test_dir to /my_mem_dir/second_dir."
    )

    # Move file
    move_filepath = "/my_mem_dir/test_dir/file1.txt"
    move_file_payload = {
        "item_path": move_filepath,
        "content": "/my_mem_dir/new_file",
        "action": "move",
    }
    move_file_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "action",
        method="POST",
        params={"key": mem_key},
        body=json.dumps(move_file_payload),
    )
    assert move_file_res.code == 200

    mfile_body_json = move_file_res.body.decode("utf-8")
    mfile_body = json.loads(mfile_body_json)
    assert mfile_body["status"] == "success"
    assert (
        mfile_body["description"]
        == "Moved /my_mem_dir/test_dir/file1.txt to /my_mem_dir/new_file.txt"
    )

    # Move directory
    move_dirpath = "/my_mem_dir/test_dir"
    move_dir_payload = {
        "item_path": move_dirpath,
        "content": "/my_mem_dir/second_dir",
        "action": "move",
    }
    move_dir_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "action",
        method="POST",
        params={"key": mem_key},
        body=json.dumps(move_dir_payload),
    )

    mdir_body_json = move_dir_res.body.decode("utf-8")
    mdir_body = json.loads(mdir_body_json)
    assert mdir_body["status"] == "success"
    assert (
        mdir_body["description"]
        == "Moved /my_mem_dir/test_dir to /my_mem_dir/second_dir"
    )


# TODO: Test count files; Upload/download no more than expected
async def test_upload_download(fs_manager_instance, jp_fetch):
    fs_manager = fs_manager_instance
    remote_fs_info = fs_manager.get_filesystem_by_protocol("s3")
    remote_key = remote_fs_info["key"]
    remote_fs = remote_fs_info["info"]["instance"]
    remote_root_path = remote_fs_info["info"]["path"]
    assert remote_fs is not None

    local_fs_info = fs_manager.get_filesystem_by_protocol("local")
    local_key = local_fs_info["key"]
    local_fs = local_fs_info["info"]["instance"]
    local_root_path = local_fs_info["info"]["path"]
    assert local_fs is not None

    # upload file [local to remote]
    local_upload_filepath = f"{local_root_path}/file_loc.txt"
    assert local_fs.exists(local_upload_filepath)
    upload_file_payload = {
        "local_path": local_upload_filepath,
        "remote_path": remote_root_path,
        "destination_key": remote_key,
        "action": "upload",
    }
    upload_file_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "transfer",
        method="POST",
        params={"key": local_key},
        body=json.dumps(upload_file_payload),
    )

    upfile_body_json = upload_file_res.body.decode("utf-8")
    upfile_body = json.loads(upfile_body_json)

    assert upfile_body["status"] == "success"
    assert (
        upfile_body["description"]
        == f"Uploaded {local_upload_filepath} to s3://{remote_root_path}."
    )

    uploaded_filepath = remote_root_path + "/file_loc.txt"

    remote_file_items = await remote_fs._ls(remote_root_path)
    assert uploaded_filepath in remote_file_items

    # upload dir [local to remote]
    upload_dirpath = local_root_path + "/nested/"
    assert local_fs.exists(upload_dirpath)
    upload_dir_payload = {
        "local_path": upload_dirpath,
        "remote_path": remote_root_path,
        "destination_key": remote_key,
        "action": "upload",
    }
    upload_dir_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "transfer",
        method="POST",
        params={"key": remote_key},
        body=json.dumps(upload_dir_payload),
    )

    updir_body_json = upload_dir_res.body.decode("utf-8")
    updir_body = json.loads(updir_body_json)
    assert updir_body["status"] == "success"
    assert (
        updir_body["description"]
        == f"Uploaded {upload_dirpath} to s3://{remote_root_path}."
    )

    remote_file_items = await remote_fs._ls(remote_root_path)
    # TODO:  remote_root_path + "/nested"
    assert "my-test-bucket/.keep" in remote_file_items
    assert "my-test-bucket/.empty" in remote_file_items

    # download file [other to remote] #remote_root_path that we want to download.
    download_filepath = "my-test-bucket/bucket-filename1.txt"
    file_present = await remote_fs._exists(download_filepath)
    assert file_present
    download_file_payload = {
        "remote_path": download_filepath,
        "local_path": local_root_path,
        "destination_key": remote_key,
        "action": "download",
    }
    download_file_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "transfer",
        method="POST",
        params={"key": remote_key},
        body=json.dumps(download_file_payload),
    )

    download_file_body_json = download_file_res.body.decode("utf-8")
    download_file_body = json.loads(download_file_body_json)
    assert download_file_body["status"] == "success"
    assert (
        download_file_body["description"]
        == f"Downloaded s3://{download_filepath} to {local_root_path}."
    )

    downloaded_filepath = local_root_path + "/bucket-filename1.txt"
    local_file_list = local_fs.ls(local_root_path)
    assert downloaded_filepath in local_file_list

    # download dir [other to local]
    download_dirpath = f"{remote_root_path}/some/"
    download_dir_payload = {
        "remote_path": download_dirpath,
        "local_path": local_root_path,
        "destination_key": remote_key,
        "action": "download",
    }
    download_dir_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "transfer",
        method="POST",
        params={"key": remote_key},
        body=json.dumps(download_dir_payload),
    )

    download_dir_body_json = download_dir_res.body.decode("utf-8")
    download_dir_body = json.loads(download_dir_body_json)
    assert download_dir_body["status"] == "success"
    assert (
        download_dir_body["description"]
        == f"Downloaded s3://{download_dirpath} to {local_root_path}."
    )

    files_in_local = local_fs.ls(local_root_path)
    local_flat_file1 = local_root_path + "/bucket-filename1.txt"
    local_flat_file2 = local_root_path + "/bucket-filename2.txt"
    local_flat_file3 = local_root_path + "/bucket-filename3.txt"
    assert local_flat_file1 in files_in_local
    assert local_flat_file2 in files_in_local
    assert local_flat_file3 in files_in_local
    # TODO: subdir creation in local
    # downloaded_dirpath = local_root_path + '/some'
    # new_local_items = local_fs.ls(downloaded_dirpath)
    # assert downloaded_dirpath in new_local_items
