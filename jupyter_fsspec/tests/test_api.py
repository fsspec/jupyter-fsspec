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
    assert len(body["content"]) == 5


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
    fs_manager = await fs_manager_instance
    mem_key = "TestsMemSource"
    mem_fs_info = fs_manager.get_filesystem(mem_key)
    mem_fs = mem_fs_info["instance"]
    mem_item_path = mem_fs_info["path"]
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
    assert len(body["content"]) == 3

    # Read File
    filepath = "test_dir/file1.txt"
    assert mem_fs.exists(filepath)
    file_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "contents",
        method="GET",
        params={"key": mem_key, "item_path": filepath},
    )
    assert file_res.code == 200
    assert file_res.body == b"Test content"

    # GET file byte range
    range_filepath = "test_dir/file1.txt"
    # previously checked file exists
    range_file_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "contents",
        method="GET",
        headers={"Range": "0-8"},
        params={"key": mem_key, "type": "range", "item_path": range_filepath},
    )
    assert range_file_res.code == 200
    assert range_file_res.body == b"Test con"


async def test_get_empty_memory(fs_manager_instance_empty_mem, jp_fetch):
    fs_manager = await fs_manager_instance_empty_mem
    mem_key = "empty_test_mem"
    mem_fs_info = fs_manager.get_filesystem(mem_key)
    mem_fs = mem_fs_info["instance"]
    mem_item_path = mem_fs_info["path"]
    assert mem_fs is not None

    # Read empty directory
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
    assert len(body["content"]) == 0


async def test_post_files(fs_manager_instance, jp_fetch):
    fs_manager = await fs_manager_instance
    mem_key = "TestsMemSource"
    mem_fs_info = fs_manager.get_filesystem(mem_key)
    mem_fs = mem_fs_info["instance"]
    assert mem_fs is not None

    # Post new file with content
    filepath = "test_dir/file2.txt"
    # File does not already exist
    assert not mem_fs.exists(filepath)
    content = "Héllo".encode()

    file_response = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "contents",
        method="POST",
        params={"key": mem_key, "item_path": filepath},
        body=content,
    )
    assert file_response.code == 201
    assert mem_fs.exists(filepath)
    assert mem_fs.cat_file(filepath) == content

    content = b""

    file_response = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "contents",
        method="POST",
        params={"key": mem_key, "item_path": filepath},
        body=content,
    )
    assert file_response.code == 201
    assert mem_fs.exists(filepath)
    assert mem_fs.cat_file(filepath) == content


async def test_delete_files(fs_manager_instance, jp_fetch):
    fs_manager = await fs_manager_instance
    mem_key = "TestsMemSource"
    mem_fs_info = fs_manager.get_filesystem(mem_key)
    mem_fs = mem_fs_info["instance"]
    assert mem_fs is not None

    # Delete file
    filepath = "/test_dir/file1.txt"
    assert mem_fs.exists(filepath)

    file_payload = {"key": mem_key, "item_path": filepath}
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
    dirpath = "/test_dir"
    assert mem_fs.exists(dirpath)

    dir_payload = {"key": mem_key, "item_path": dirpath}
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
    fs_manager = await fs_manager_instance
    mem_key = "TestsMemSource"
    mem_fs_info = fs_manager.get_filesystem(mem_key)
    mem_fs = mem_fs_info["instance"]
    assert mem_fs is not None

    # replace entire file content
    filepath = "test_dir/file1.txt"
    file_payload = {
        "key": mem_key,
        "item_path": filepath,
        "content": "Replaced content",
    }
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
    assert file_body["description"] == "Updated file test_dir/file1.txt."

    # replacing directory returns error
    dirpath = "test_dir"
    dir_payload = {"key": mem_key, "item_path": dirpath, "content": "new_test_dir"}
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
    fs_manager = await fs_manager_instance
    mem_key = "TestsMemSource"
    mem_fs_info = fs_manager.get_filesystem(mem_key)
    mem_fs = mem_fs_info["instance"]
    assert mem_fs is not None

    # rename file
    filepath = "test_dir/file1.txt"
    file_payload = {
        "key": mem_key,
        "item_path": filepath,
        "content": "test_dir/new_file.txt",
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
        == "Renamed test_dir/file1.txt to test_dir/new_file.txt."
    )
    assert not mem_fs.exists(filepath)
    assert mem_fs.exists("test_dir/new_file.txt")

    # rename directory
    dirpath = "second_dir"
    dir_payload = {
        "key": mem_key,
        "item_path": dirpath,
        "content": "new_dir",
    }
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
    assert dir_body["description"] == "Renamed second_dir to new_dir."
    assert not mem_fs.exists(dirpath)
    assert mem_fs.exists("new_dir")


# TODO:
async def xtest_action_same_fs_files(fs_manager_instance, jp_fetch):
    fs_manager = await fs_manager_instance
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


@pytest.mark.no_setup_config_file_fs
async def test_hdfs_config(hdfs_config, jp_fetch):
    fetch_config = await jp_fetch("jupyter_fsspec", "config", method="GET")
    assert fetch_config.code == 200
    config_json = fetch_config.body.decode("utf-8")
    config = json.loads(config_json)
    content = config["content"]
    assert len(content) == 1
    item = content[0]
    assert item["error"]
    assert (
        item["error"]["short_traceback"]
        == "ModuleNotFoundError: No module named 'pyarrow'"
    )


async def test_upload_download(fs_manager_instance, jp_fetch):
    fs_manager = await fs_manager_instance
    remote_key = "TestSourceAWS"
    remote_fs_info = fs_manager.get_filesystem(remote_key)
    remote_fs = remote_fs_info["instance"]
    remote_root_path = remote_fs_info["path"]
    assert remote_fs is not None

    local_key = "TestDir"
    local_fs_info = fs_manager.get_filesystem(local_key)
    local_fs = local_fs_info["instance"]
    local_root_path = local_fs_info["path"]
    assert local_fs is not None

    # upload file [local to remote]
    local_upload_filepath = f"{local_root_path}/file_loc.txt"
    file_exists = await local_fs._exists(local_upload_filepath)
    assert file_exists

    upload_file_payload = {
        "key": local_key,
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
        == f"Uploaded {local_upload_filepath} to {remote_root_path}."
    )

    uploaded_filepath = remote_root_path + "file_loc.txt"

    remote_file_items = await remote_fs._ls(remote_root_path)
    assert uploaded_filepath in remote_file_items
    assert len(remote_file_items) == 3

    all_remote = await remote_fs._find(remote_root_path)
    assert len(all_remote) == 4

    # upload dir [local to remote]
    upload_dirpath = local_root_path + "/nested/"
    assert local_fs.exists(upload_dirpath)
    upload_dir_payload = {
        "key": remote_key,
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
        updir_body["description"] == f"Uploaded {upload_dirpath} to {remote_root_path}."
    )

    remote_file_items = await remote_fs._ls(remote_root_path)
    # TODO:  remote_root_path + "/nested"
    assert f"{remote_root_path}.keep" in remote_file_items
    assert f"{remote_root_path}.empty" in remote_file_items

    # download file [other to remote] #remote_root_path that we want to download.
    download_filepath = f"{remote_root_path}bucket-filename1.txt"
    file_present = await remote_fs._exists(download_filepath)
    assert file_present
    download_file_payload = {
        "key": remote_key,
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
        == f"Downloaded {download_filepath} to {local_root_path}."
    )

    downloaded_filepath = local_root_path + "/bucket-filename1.txt"
    local_file_list = local_fs.ls(local_root_path)
    assert downloaded_filepath in local_file_list

    # download dir [other to local]
    download_dirpath = f"{remote_root_path}/some/"
    download_dir_payload = {
        "key": remote_key,
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
        == f"Downloaded {download_dirpath} to {local_root_path}."
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

    # download entire remote to local
    download_sync_payload = {
        "key": remote_key,
        "destination_key": local_key,
        "remote_path": remote_root_path,
        "local_path": local_root_path,
        "action": "download",
    }
    download_sync_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "transfer",
        method="POST",
        params={"key": remote_key},
        body=json.dumps(download_sync_payload),
    )
    download_sync_body_json = download_sync_res.body.decode("utf-8")
    download_sync_body = json.loads(download_sync_body_json)
    assert download_sync_body["status"] == "success"
    assert (
        download_sync_body["description"]
        == f"Downloaded {remote_root_path} to {local_root_path}."
    )
    new_local_files = local_fs.find(local_root_path)
    assert (
        len(new_local_files) == 10
    )  # pulls in individual items in remote root dir into local

    current_remote_files = await remote_fs._find(remote_root_path)
    print(f"current_remote_files: {current_remote_files}")

    # try uploading entire local to remote
    upload_sync_payload = {
        "key": local_key,
        "destination_key": remote_key,
        "remote_path": remote_root_path,
        "local_path": local_root_path,
        "action": "upload",
    }
    upload_sync_res = await jp_fetch(
        "jupyter_fsspec",
        "files",
        "transfer",
        method="POST",
        params={"key": local_key},
        body=json.dumps(upload_sync_payload),
    )
    upload_sync_body_json = upload_sync_res.body.decode("utf-8")
    upload_sync_body = json.loads(upload_sync_body_json)
    assert upload_sync_body["status"] == "success"
    assert (
        upload_sync_body["description"]
        == f"Uploaded {local_root_path} to {remote_root_path}."
    )
    new_remote_files = await remote_fs._find(remote_root_path)
    assert len(new_remote_files) == 16  # aggregate- dumps local root dir into remote


# TODO: Fix Event loop closed error (unclosed session); Dirty state between tests with s3
