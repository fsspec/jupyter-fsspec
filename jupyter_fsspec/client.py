import logging

import fsspec.utils
from fsspec import AbstractFileSystem
import requests  # to patch

logger = logging.getLogger("jupyter_fsspec.client")
fsspec.utils.setup_logging(logger=logger)


class JFS(AbstractFileSystem):
    def __init__(self, base_url):
        super().__init__()
        self.base_url = base_url
        self.session = requests.Session()

    def _split_path(self, path):
        key, *relpath = path.split("/", 1)
        return key, relpath[0] if relpath else ""

    def _call(self, path, method="GET", **kw):
        logger.debug("request: %s %s %s", path, method, kw)
        r = self.session.request(method, f"{self.base_url}/{path}", params=kw)
        r.raise_for_status()
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
                bits = self._call("jupyter_fsspec/files", key=key, item_path=relpath)
                return bits

        if detail:
            return out
        return [_["name"] for _ in out]
