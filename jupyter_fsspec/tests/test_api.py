import json
import pytest
import fsspec
from tornado.httpclient import HTTPClientError
# TODO: Testing: different file types, received expected errors


async def test_get_config(jp_fetch):
    response = await jp_fetch("jupyter_fsspec", "config", method="GET")
    assert response.code == 200

    json_body = response.body.decode("utf-8")
    body = json.loads(json_body)
    assert body["status"] == "success"


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


def get_boto3_client():
    from botocore.session import Session

    # NB: we use the sync botocore client for setup
    session = Session()

    endpoint_uri = "http://127.0.0.1:%s/" % "5555"
    return session.create_client("s3", endpoint_url=endpoint_uri)


@pytest.mark.asyncio
async def xtest_async_s3_file_operations(s3_client, s3_fs_manager_instance, jp_fetch):
    # s3_client = get_boto3_client()
    s3_client = s3_client
    # boto3.set_stream_logger('botocore', level='DEBUG')
    # s3_client.create_bucket(Bucket='my-test-bucket')

    # endpoint_uri = "http://127.0.0.1:%s/" % "5555"

    # fs = fsspec.filesystem('s3', asynchronous=True, anon=False, client_kwargs={'endpoint_url': endpoint_uri})
    fs = s3_fs_manager_instance

    # ==================================================================
    # contents = await fs._ls('s3://my-test-bucket/')
    # print(f"contents: {contents}")
    # await fs._pipe_file('s3://my-test-bucket/test.txt', b"Hi Test MOTO server!")
    # content = await fs._cat_file('s3://my-test-bucket/test.txt')
    # print(content)
    # assert content == b'Hi Test MOTO server!'

    # contents = await fs._ls('s3://my-test-bucket/')
    # print(f"contents: {contents}")
    # ==================================================================
    fs_manager = s3_fs_manager_instance
    print(f"fs_manager is: {fs_manager}")

    fs_info = fs_manager.get_filesystem_by_protocol("s3")
    key = fs_info["key"]
    fs = fs_info["info"]["instance"]
    item_path = fs_info["info"]["path"]
    assert fs is not None

    # Read directory
    assert fs.exists(item_path)
    dir_response = await jp_fetch(
        "jupyter_fsspec",
        "files",
        method="GET",
        params={"key": key, "item_path": item_path},
    )

    assert dir_response.code == 200
    json_body = dir_response.body.decode("utf-8")
    body = json.loads(json_body)
    assert body["status"] == "success"


@pytest.mark.asyncio
async def xtest___async_s3_file_operations(mock_s3_fs):
    # s3_client = boto3.client('s3', endpoint_url=os.getenv("AWS_S3_ENDPOINT_URL"))
    s3_client = get_boto3_client()
    # boto3.set_stream_logger('botocore', level='DEBUG')
    s3_client.create_bucket(Bucket="my-test-bucket")

    endpoint_uri = "http://127.0.0.1:%s/" % "5555"

    fs = fsspec.filesystem(
        "s3",
        asynchronous=True,
        anon=False,
        client_kwargs={"endpoint_url": endpoint_uri},
    )

    contents = await fs._ls("s3://my-test-bucket/")
    print(f"contents: {contents}")
    await fs._pipe_file("s3://my-test-bucket/test.txt", b"Hi Test MOTO server!")
    content = await fs._cat_file("s3://my-test-bucket/test.txt")
    print(content)
    assert content == b"Hi Test MOTO server!"

    contents = await fs._ls("s3://my-test-bucket/")
    print(f"contents: {contents}")


# TODO: Test transfer endpoint
async def xtest_file_transfer(fs_manager_instance_parameterized, jp_fetch):
    fs_manager = fs_manager_instance_parameterized
    fs_info = fs_manager.get_filesystem_by_protocol("memory")
    fs = fs_info["info"]["instance"]
    assert fs is not None

    # # copy file
    # copy_filepath = f'{fs_root_path}/test_dir/file1.txt'
    # copy_file_payload = {"item_path": copy_filepath, "content": "/my_local_dir/", "destination_key": "", "action": "copy"}
    # copy_file_res = await jp_fetch("jupyter_fsspec", "files", "transfer", method="POST", params={"key": mem_key}, body=json.dumps(copy_file_payload))

    # cfile_body_json = copy_file_res.body.decode('utf-8')
    # cfile_body = json.loads(cfile_body_json)
    # assert cfile_body["status"] == 'success'
    # assert cfile_body['description'] == f'Copied {fs_root_path}/test_dir/file1.txt to /my_local_dir/file1.txt'

    # copy dir

    # move file

    # move dir
