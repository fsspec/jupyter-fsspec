import os

import pytest
import requests
import subprocess
import time

import jupyter_fsspec.handlers
from jupyter_fsspec import client
import fsspec

fsspec.utils.setup_logging(logger_name="jupyter_fsspec.client")


@pytest.fixture()
def server(tmpdir):
    # runs proxy component in a separate process
    conf = f"""sources:
 - name: testmem
   path: memory://mytests
 - name: testfile
   path: {tmpdir}
 - name: testobj
   path: "s3://anaconda-package-data/conda/hourly/"
   kwargs:
     anon: True
"""
    env = os.environ.copy()
    os.environ["JUPYTER_FSSPEC_DISABLE_XSRF"] = "1"
    fn = f"{tmpdir}/jupyter-fsspec.yaml"
    with open(fn, "wt") as f:
        f.write(conf)
    env["JUPYTER_CONFIG_DIR"] = str(tmpdir)
    P = subprocess.Popen(["python", jupyter_fsspec.handlers.__file__], env=env)
    s = "http://127.0.0.1:9898"
    count = 5
    while True:
        try:
            requests.get(s)
            break
        except OSError:
            if count < 0:
                raise
        count -= 1
        time.sleep(0.1)
    yield s
    P.terminate()
    P.wait()


@pytest.fixture()
def fs(server):
    yield client.JFS(server)


def test_ls_root(fs):
    out = fs.ls("", detail=False)
    assert out == ["testfile", "testmem", "testobj"]
    out = fs.ls("", detail=True)
    assert all(_["type"] == "directory" for _ in out)
    assert all(_["size"] == 0 for _ in out)


def test_ls_nonroot(fs):
    out = fs.ls("testmem", detail=True)
    assert len(out) == 1
    assert out[0]["name"] == "testmem/afile"
    assert out[0]["size"] == len(b"hello")
    with pytest.raises(requests.exceptions.HTTPError):
        fs.ls("notakey")
    # deeper levels to come


def test_cat(fs):
    out = fs.cat_file("testmem/afile")
    assert out == b"hello"


def test_file(fs):
    with fs.open("testmem/afile", "rb") as f:
        assert f.read() == b"hello"


def test_errors(fs):
    with pytest.raises(requests.exceptions.HTTPError):
        fs.cat_file("testmem/notafile")
    with pytest.raises(requests.exceptions.HTTPError):
        fs.cat_file("notakey/afile")


def test_roundtrip_fileio(fs):
    with fs.open("testmem/afile2", "wb") as f:
        f.write(b"hello2")
    with fs.open("testmem/afile2", "rb") as f:
        assert f.read() == b"hello2"
