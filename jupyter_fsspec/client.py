import logging

import fsspec.utils
from fsspec import AbstractFileSystem
from fsspec.spec import AbstractBufferedFile
import requests  # to patch

logger = logging.getLogger("jupyter_fsspec.client")
fsspec.utils.setup_logging(logger=logger)


class JFS(AbstractFileSystem):
    protocol = "jfs"

    def __init__(self, base_url):
        super().__init__()
        self.base_url = base_url
        self.session = requests.Session()

    def _split_path(self, path):
        key, *relpath = path.split("/", 1)
        return key, relpath[0] if relpath else ""

    def _call(self, path, method="GET", range=None, binary=False, **kw):
        logger.debug("request: %s %s %s", path, method, kw)
        headers = {}
        if range:
            headers["Range"] = f"bytes={range[0]}-{range[1]}"
        r = self.session.request(
            method, f"{self.base_url}/{path}", params=kw, headers=headers
        )
        r.raise_for_status()
        if binary:
            return r.content
        return r.json()["content"]

    def ls(self, path, detail=True, **kwargs):
        path = self._strip_protocol(path)
        out = self._ls_from_cache(path)
        if not out:
            if not path:
                # list root - list of filesystem configs
                bits = self._call("jupyter_fsspec/config")
                out = [{"name": _["key"], "type": "directory", "size": 0} for _ in bits]
                self.dircache[""] = out
            else:
                key, relpath = self._split_path(path)
                out = self._call("jupyter_fsspec/files", key=key, item_path=relpath)

        if detail:
            return out
        return sorted(_["name"] for _ in out)

    def _open(
        self,
        path,
        mode="rb",
        block_size=None,
        autocommit=True,
        cache_options=None,
        **kwargs,
    ):
        return JFile(self, path, mode, block_size, autocommit, cache_options, **kwargs)

    def cat_file(self, path, start=None, end=None):
        key, relpath = self._split_path(path)
        return self._call(
            "jupyter_fsspec/files/contents", key=key, item_path=relpath, binary=True
        )


class JFile(AbstractBufferedFile):
    def _fetch_range(self, start, end):
        return self.fs._cat_file(self.path, start, end)
