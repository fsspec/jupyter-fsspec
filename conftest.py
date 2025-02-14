from pathlib import Path
from unittest.mock import patch
import pytest
import os
from moto.moto_server.threaded_moto_server import ThreadedMotoServer
from jupyter_fsspec.file_manager import FileSystemManager

PORT = 5555
ENDPOINT_URI = "http://127.0.0.1:%s/" % PORT


pytest_plugins = [
    "pytest_jupyter.jupyter_server",
    "jupyter_server.pytest_plugin",
    "pytest_asyncio",
]


@pytest.fixture(scope="function")
def setup_tmp_local(tmp_path: Path):
    local_root = tmp_path / "test"
    local_root.mkdir()
    nested_dir = local_root / "nested"
    nested_dir.mkdir()
    nested_file1 = nested_dir / ".empty"
    nested_file1.touch()
    nested_file2 = nested_dir / ".keep"
    nested_file2.touch()
    local_file = local_root / "file_loc.txt"
    local_file.touch()

    local_empty_root = tmp_path / "empty"
    local_empty_root.mkdir()

    yield [local_root, local_empty_root]


@pytest.fixture(scope="function")
def setup_config_file_fs(tmp_path: Path, setup_tmp_local):
    tmp_local = setup_tmp_local[0]
    empty_tmp_local = setup_tmp_local[1]
    config_dir = tmp_path / "config"
    config_dir.mkdir(exist_ok=True)

    yaml_content = f"""sources:
  - name: "TestSourceAWS"
    path: "s3://my-test-bucket/"
    kwargs:
      anon: false
      key: "my-access-key"
      secret: "my-secret-key"
      client_kwargs:
        endpoint_url: "{ENDPOINT_URI}"
  - name: "TestDir"
    path: "{tmp_local}"
    protocol: "local"
  - name: "TestEmptyLocalDir"
    path: "{empty_tmp_local}"
    protocol: "local"
  - name: "TestMem Source"
    path: "/my_mem_dir"
    protocol: "memory"
    """
    yaml_file = config_dir / "jupyter-fsspec.yaml"
    yaml_file.write_text(yaml_content)

    with patch(
        "jupyter_fsspec.file_manager.jupyter_config_dir", return_value=str(config_dir)
    ):
        print(f"Patching jupyter_config_dir to: {config_dir}")
        fs_manager = FileSystemManager(config_file="jupyter-fsspec.yaml")

    yield fs_manager


@pytest.fixture(scope="function")
def fs_manager_instance(setup_config_file_fs, s3_client):
    fs_manager = setup_config_file_fs
    fs_info = fs_manager.get_filesystem_by_protocol("memory")
    mem_fs = fs_info["info"]["instance"]
    mem_root_path = fs_info["info"]["path"]

    if mem_fs:
        if mem_fs.exists(f"{mem_root_path}/test_dir"):
            mem_fs.rm(f"{mem_root_path}/test_dir", recursive=True)
        if mem_fs.exists(f"{mem_root_path}/second_dir"):
            mem_fs.rm(f"{mem_root_path}/second_dir", recursive=True)

        mem_fs.touch(f"{mem_root_path}/file_in_root.txt")
        with mem_fs.open(f"{mem_root_path}/file_in_root.txt", "wb") as f:
            f.write("Root file content".encode())

        mem_fs.mkdir(f"{mem_root_path}/test_dir", exist_ok=True)
        mem_fs.mkdir(f"{mem_root_path}/second_dir", exist_ok=True)
        # mem_fs.mkdir(f'{mem_root_path}/second_dir/subdir', exist_ok=True)
        mem_fs.touch(f"{mem_root_path}/test_dir/file1.txt")
        with mem_fs.open(f"{mem_root_path}/test_dir/file1.txt", "wb") as f:
            f.write("Test content".encode())
            f.close()
    else:
        print("In memory filesystem NOT FOUND")

    if mem_fs.exists(f"{mem_root_path}/test_dir/file1.txt"):
        mem_fs.info(f"{mem_root_path}/test_dir/file1.txt")
    else:
        print("File does not exist!")
    return fs_manager


def get_boto3_client():
    from botocore.session import Session

    session = Session()
    return session.create_client(
        "s3",
        endpoint_url=ENDPOINT_URI,
        aws_access_key_id="my-access-key",
        aws_secret_access_key="my-secret-key",
    )


@pytest.fixture(scope="function")
def s3_base():
    server = ThreadedMotoServer(ip_address="127.0.0.1", port=PORT)
    server.start()
    if "AWS_SECRET_ACCESS_KEY" not in os.environ:
        os.environ["AWS_SECRET_ACCESS_KEY"] = "my-accesss-key"
    if "AWS_ACCESS_KEY_ID" not in os.environ:
        os.environ["AWS_ACCESS_KEY_ID"] = "my-secret-key"

    print("server up")
    yield
    print("moto done")
    server.stop()


@pytest.fixture(scope="function")
def s3_client(s3_base):
    client = get_boto3_client()

    bucket_name = "my-test-bucket"
    client.create_bucket(Bucket=bucket_name, ACL="public-read")
    client.put_object(
        Body=b"Hello, World1!", Bucket=bucket_name, Key="bucket-filename1.txt"
    )
    client.put_object(
        Body=b"Hello, World2!", Bucket=bucket_name, Key="some/bucket-filename2.txt"
    )
    client.put_object(
        Body=b"Hello, World3!", Bucket=bucket_name, Key="some/bucket-filename3.txt"
    )

    yield client
    client.close()


@pytest.fixture
def jp_server_config(jp_server_config):
    return {"ServerApp": {"jpserver_extensions": {"jupyter_fsspec": True}}}
