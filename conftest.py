from pathlib import Path
from unittest.mock import patch
import pytest
import os
from moto.moto_server.threaded_moto_server import ThreadedMotoServer
from jupyter_fsspec.file_manager import FileSystemManager

pytest_plugins = [
    "pytest_jupyter.jupyter_server",
    "jupyter_server.pytest_plugin",
    "pytest_asyncio",
]


@pytest.fixture(scope="function")
def setup_tmp_local(tmp_path: Path):
    local_root = tmp_path / "test"
    local_root.mkdir()
    local_file = local_root / "file_loc.txt"
    local_file.touch()
    local_empty_root = tmp_path / "empty"
    local_empty_root.mkdir()

    return [local_root, local_empty_root]


@pytest.fixture(scope="function", autouse=True)
def setup_config_file_fs(tmp_path: Path, setup_tmp_local):
    tmp_local = setup_tmp_local[0]
    empty_tmp_local = setup_tmp_local[1]
    config_dir = tmp_path / "config"
    config_dir.mkdir(exist_ok=True)

    yaml_content = f"""sources:
  - name: "TestSourceAWS"
    path: "s3://my-test-bucket/"
    additional_options:
      anon: false
      key: "my-access-key"
      secret: "my-secret-key"
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

    return fs_manager


@pytest.fixture(scope="function")
def fs_manager_instance(setup_config_file_fs):
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
        file_info = mem_fs.info(f"{mem_root_path}/test_dir/file1.txt")
        print(f"File exists. size: {file_info}")
    else:
        print("File does not exist!")
    return fs_manager


def get_boto3_client():
    from botocore.session import Session

    # NB: we use the sync botocore client for setup
    session = Session()

    endpoint_uri = "http://127.0.0.1:%s/" % "5555"
    return session.create_client("s3", endpoint_url=endpoint_uri)


@pytest.fixture(scope="function")
def s3_client(mock_s3_fs):
    s3_client = get_boto3_client()
    s3_client.create_bucket(Bucket="my-test-bucket")
    return s3_client


@pytest.fixture(scope="function")
def s3_fs_manager_instance(setup_config_file_fs):
    fs_manager = setup_config_file_fs
    # fs_info = fs_manager.get_filesystem_by_protocol("s3")
    # key = fs_info["key"]
    # fs = fs_info["info"]["instance"]
    # root_path = fs_info["info"]["path"]

    # endpoint_uri = "http://127.0.0.1:%s/" % "5555"
    # fs = fsspec.filesystem('s3', asynchronous=True, anon=False, client_kwargs={'endpoint_url': endpoint_uri})
    return fs_manager


@pytest.fixture(params=["memory", "local", "s3"])
def filesystem_protocol(request):
    return request.param


@pytest.fixture(scope="function")
def populated_file_system(filesystem_protocol):
    fs_manager = FileSystemManager(config_file="jupyter-fsspec.yaml")
    fs_protocol = filesystem_protocol
    fs_info = fs_manager.get_filesystem_by_protocol(fs_protocol)
    fs = fs_info["info"]["instance"]

    if fs:
        # Delete any existting directories
        # Populate the filesystem
        # mkdir => root_path + 'rootA'
        # mkdir => root_path + 'rootB'
        # touch => root_path + 'file1.txt'
        # touch => root_path + 'rootA' + 'file_in_rootA.txt'
        print(f"valid filesystem: {fs}")
    else:
        print(f"invalid filesystem: {fs}")
    return {"fs_protocol": fs_protocol, "fs_manager": fs_manager}


# TODO: Update this fixture from s3fs
@pytest.fixture(scope="function")
def mock_s3_fs():
    # This fixture is module-scoped, meaning that we can re-use the MotoServer across all tests
    server = ThreadedMotoServer(ip_address="127.0.0.1", port=5555)
    server.start()
    if "AWS_SECRET_ACCESS_KEY" not in os.environ:
        os.environ["AWS_SECRET_ACCESS_KEY"] = "foo"
    if "AWS_ACCESS_KEY_ID" not in os.environ:
        os.environ["AWS_ACCESS_KEY_ID"] = "foo"
    # aws_session_token=os.environ["AWS_SESSION_TOKEN"]
    if "AWS_SESSION_TOKEN" not in os.environ:
        os.environ["AWS_SESSION_TOKEN"] = "foo"
    print("server up")
    yield
    print("moto done")
    server.stop()


@pytest.fixture(scope="function")
def fs_manager_instance_parameterized(populated_file_system):
    fs_ret = populated_file_system
    fs_protocol = fs_ret["fs_protocol"]
    fs_manager = fs_ret["fs_manager"]
    fs_info = fs_manager.get_filesystem_by_protocol(fs_protocol)
    fs = fs_info["info"]["instance"]
    root_path = fs_info["info"]["path"]

    # fs_info = fs_manager.get_filesystem_by_protocol('local')
    # key = fs_info['key']
    # fs = fs_info['info']['instance']
    # local_root_path = fs_info['info']['path']

    if fs:
        # TODO: Update file creation FOR PATHS!!!
        if fs.exists(f"{root_path}/test_dir"):
            print(f"{root_path}/test_dir EXISTS!!!!")
            # fs.rm(f'{root_path}/test_dir', recursive=True)
        if fs.exists(f"{root_path}/second_dir"):
            print(f"{root_path}/second_dir EXISTS!!!!")
            # fs.rm('/my_dir/second_dir', recursive=True)

        fs.touch(f"{root_path}/file_in_root.txt")
        with fs.open(f"{root_path}/file_in_root.txt", "wb") as f:
            f.write("Root file content".encode())

        # fs.mkdir('/my_dir/test_dir', exist_ok=True)
        # fs.mkdir('/my_dir/second_dir', exist_ok=True)
        # # fs.mkdir('/my_dir/second_dir/subdir', exist_ok=True)
        # fs.touch('/my_dir/test_dir/file1.txt')
        # with fs.open('/my_dir/test_dir/file1.txt', "wb") as f:
        #     f.write("Test content".encode())
        #     f.close()
    else:
        print(f"Filesystem of protocol {fs_protocol} NOT FOUND")

    if fs.exists(f"{root_path}test_dir/file1.txt"):
        file_info = fs.info(f"/{root_path}/test_dir/file1.txt")
        print(f"File exists. size: {file_info}")
    else:
        print("File does not exist!")
    return fs_manager


@pytest.fixture
def jp_server_config(jp_server_config):
    return {"ServerApp": {"jpserver_extensions": {"jupyter_fsspec": True}}}
