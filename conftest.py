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
    real_tmp = tmp_path / "test"
    real_tmp.mkdir()
    nested_dir = real_tmp / "nested"
    nested_dir.mkdir()
    nested_file1 = nested_dir / ".empty"
    nested_file1.touch()
    nested_file2 = nested_dir / ".keep"
    nested_file2.touch()
    local_file = real_tmp / "file_loc.txt"
    local_file.touch()

    root_dir = Path(os.getcwd())

    # Create symlink inside of root pointing to tmp
    link_path = root_dir / "tmp_symlink"
    if link_path.exists():
        link_path.unlink()
    link_path.symlink_to(real_tmp, target_is_directory=True)

    local_empty_root = tmp_path / "empty"
    local_empty_root.mkdir()

    yield [real_tmp, local_empty_root]

    try:
        if link_path.exists() or link_path.is_symlink():
            link_path.unlink()
    except Exception as e:
        print(f"Warning: failed to remove symlink {link_path}: {e}")


@pytest.fixture(scope="function")
def no_config_permission(tmp_path: Path):
    config_dir = tmp_path / "config"
    config_dir.mkdir(exist_ok=True)
    os.chmod(config_dir, 0o44)

    with patch(
        "jupyter_fsspec.file_manager.jupyter_config_dir", return_value=str(config_dir)
    ):
        print(f"Patching jupyter_config_dir to: {config_dir}")
    yield config_dir

    os.chmod(config_dir, 0o755)
    config_dir.rmdir()


@pytest.fixture(scope="function")
def malformed_config(tmp_path: Path):
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
    """
    yaml_file = config_dir / "jupyter-fsspec.yaml"
    yaml_file.write_text(yaml_content)

    with patch(
        "jupyter_fsspec.file_manager.jupyter_config_dir", return_value=str(config_dir)
    ):
        print(f"Patching jupyter_config_dir to: {config_dir}")


@pytest.fixture(scope="function")
def bad_info_config(tmp_path: Path):
    config_dir = tmp_path / "config"
    config_dir.mkdir(exist_ok=True)

    yaml_content = f"""sources:
  - nme: "TestSourceAWS"
    path: s3://my-test-bucket/"
    kwargs:
      anon: false
      key: "my-access-key"
      secret: "my-secret-key"
      client_kwargs:
        endpoint_url: "{ENDPOINT_URI}"
    """
    yaml_file = config_dir / "jupyter-fsspec.yaml"
    yaml_file.write_text(yaml_content)

    with patch(
        "jupyter_fsspec.file_manager.jupyter_config_dir", return_value=str(config_dir)
    ):
        print(f"Patching jupyter_config_dir to: {config_dir}")


@pytest.fixture(scope="function")
def empty_config(tmp_path: Path):
    config_dir = tmp_path / "config"
    config_dir.mkdir(exist_ok=True)

    yaml_content = """ """
    yaml_file = config_dir / "jupyter-fsspec.yaml"
    yaml_file.write_text(yaml_content)

    with patch(
        "jupyter_fsspec.file_manager.jupyter_config_dir", return_value=str(config_dir)
    ):
        print(f"Patching jupyter_config_dir to: {config_dir}")


# TODO: split?
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
    path: "file://{tmp_local}"
  - name: "TestEmptyLocalDir"
    path: "file://{empty_tmp_local}"
  - name: "TestsMemSource"
    path: "memory://"
    protocol: "file"
  - name: "empty_test_mem"
    path: "memory://empty"
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
async def fs_manager_instance_empty_mem(setup_config_file_fs, s3_client):
    fs_manager = setup_config_file_fs
    fs_info = fs_manager.get_filesystem("empty_test_mem")
    mem_fs = fs_info["instance"]
    mem_fs_path = fs_info["path"]
    if not mem_fs:
        print("In memory filesystem not found")
    if await mem_fs._exists(mem_fs_path):
        await mem_fs._rm(mem_fs_path, recursive=True)

    await mem_fs._mkdir(mem_fs_path)
    return fs_manager


@pytest.fixture(scope="function")
async def fs_manager_instance(setup_config_file_fs, s3_client):
    fs_manager = setup_config_file_fs
    fs_info = fs_manager.get_filesystem("TestsMemSource")
    mem_fs = fs_info["instance"]

    if not mem_fs:
        print("In memory filesystem not found")
    else:
        if await mem_fs._exists("test_dir"):
            await mem_fs._rm("test_dir", recursive=True)
        if await mem_fs._exists("second_dir"):
            await mem_fs._rm("second_dir", recursive=True)

        await mem_fs._pipe("file_in_root.txt", b"Root file content")

        await mem_fs._mkdir("test_dir", exist_ok=True)
        await mem_fs._mkdir("second_dir", exist_ok=True)

        await mem_fs._pipe("test_dir/file1.txt", b"Test content")
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
    for key in client.list_objects(Bucket=bucket_name)["Contents"]:
        print(f"client objects: {key['Key']}")

    yield client
    client.close()


@pytest.fixture
def jp_server_config(jp_server_config):
    return {"ServerApp": {"jpserver_extensions": {"jupyter_fsspec": True}}}
