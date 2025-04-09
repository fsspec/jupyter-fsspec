# Gives users access to filesystems defined in the jupyter_fsspec config file


import copy
import datetime
import re
import tempfile
import traceback
from base64 import standard_b64encode

from .file_manager import FileSystemManager
from .exceptions import JupyterFsspecException


# Global config manager for kernel-side jupyter-fsspec use
_manager = None
_active = None
_user_data = None
_EMPTY_RESULT = {
    "ok": False,
    "value": None,
    "path": None,
    "timestamp": None,
    "error": None,
}
out = None  # Set below
_builtin_open = open  # The public API here shadows this name, save it here


class HelperOutput:
    """Jupyter FSSpec request output helper (read-only)"""

    PREVIEW_LEN = 64

    def __init__(self, data):
        # if not (set(data) >= set(_EMPTY_RESULT)):
        #     # Check for all needed keys
        #     raise JupyterFsspecException('Invalid Jupyter FSSpec output!')

        self._result = data

    @property
    def value(self):
        """The value of the requested operation"""
        return self._result["value"]

    @property
    def ok(self):
        """The status of the request"""
        return self._result["ok"]

    @property
    def path(self):
        return self._result["path"]

    @property
    def timestamp(self):
        return self._result["timestamp"]

    @property
    def timedelta(self):
        time_delta = None
        if self.timestamp:
            time_delta = datetime.datetime.now() - self.timestamp
        return time_delta

    @property
    def error(self):
        return self._result["error"]

    @property
    def length(self):
        return -1 if self.value is None else len(self.value)

    def __repr__(self):
        # Compile time info
        timestamp = self.timestamp
        # ....
        time_delta_info = ""
        if timestamp is not None:
            delta = datetime.datetime.now() - datetime.datetime.fromisoformat(timestamp)
            time_delta_info = f" made {delta}s ago"
        # ....
        timestamp_info = (
            f'Timestamp {timestamp if timestamp is not None else "<None>"}\n'
        )

        # Compile value info
        value = self.value
        value_info = " <None>"
        if value is not None:
            value_info = f"\n\n{value[:HelperOutput.PREVIEW_LEN]}"

        newline = "\n"
        string_rep = (
            '----------------\n'
            f'Request [{"OK" if self.ok else "FAIL"}]{time_delta_info}\n'
            f'{timestamp_info}'
            '................\n'
            f'Path: {"<None>" if self.path is None else self.path}\n'
            f'Data[:{HelperOutput.PREVIEW_LEN}] preview (total {self.length:,}):{value_info}\n'
            f'{"" if self.ok else f"{newline}.... ERROR! ....{newline}" + str(self.error) + newline}'
            '----------------'
        )
        return string_rep


def _get_manager(cached=True):
    # Get and cache a manager: The manager handles the config and filesystem
    # construction using the same underlying machinery used by the frontend extension.
    # The manager is cached to avoid hitting the disk/config file multiple times.
    global _manager
    if not cached or _manager is None:
        _manager = FileSystemManager.create_default()
    return _manager


def _get_fs(fs_name):
    # Get an fsspec filesystem from the manager
    # The fs_name is url encoded, we handle that here...TODO refactor that
    mgr = _get_manager()
    fs = mgr.construct_named_fs(fs_name)
    if fs is not None:
        return fs
    else:
        raise JupyterFsspecException("Error, could not find specified filesystem")


def reload():
    # Get a new manager/re-read the config file
    return _get_manager(False)


def fs(fs_name):
    # (Public API) Return an fsspec filesystem from the manager
    return _get_fs(fs_name)


filesystem = fs  # Alias for matching fsspec call


def _request_bytes(fs_name, path):
    global out

    # Empty results first
    blank = copy.deepcopy(_EMPTY_RESULT)
    now = datetime.datetime.now().isoformat()
    blank["timestamp"] = now
    blank["path"] = path
    out = HelperOutput(blank)

    try:
        # Get the fs key (the fs name from the config)
        split_path = [p for p in re.split("/+", path) if p]
        if not split_path:
            raise JupyterFsspecException("Invalid path")
        remainder = []
        if len(split_path) > 1:
            remainder = split_path[1:]
        named_fs_key = split_path[0]

        # Get a non-magic (magic paths start with a fake/virtual named_fs_key component) absolute path
        fs_info = _get_manager().get_filesystem(named_fs_key)
        path_components = [fs_info["path"]]
        if remainder:
            path_components.extend(remainder)
        abspath = "/".join(path_components)
        named_fs = _get_manager().construct_named_fs(named_fs_key)
        out = HelperOutput(
            {
                "ok": True,
                "value": named_fs.open(abspath, mode="rb").read(),
                "path": path,
                "timestamp": now,
                "error": None,
            }
        )
    except Exception:
        blank["error"] = traceback.format_exc()
        out = HelperOutput(blank)


def _get_user_data_string():
    # TODO refactor/remove this later
    # The web APIs use strings for base64 decoding, return an ascii/utf8 string
    return standard_b64encode(_user_data).decode("utf8")


def _get_user_data_tempfile_path():
    tfile = tempfile.NamedTemporaryFile(delete=False)
    tfile.write(_user_data)
    return tfile.name


def set_user_data(data):
    global _user_data
    _user_data = data


def work_on(fs_name):
    # Set one of the named filesystems as "active" for use with convenience funcs below
    global _active
    fs = _get_fs(fs_name)
    _active = fs

    return fs


def _get_active():
    # Gets the "active" filesystem
    return _active


def open(*args, **kwargs):
    # Get a file handle
    if not _active:
        raise JupyterFsspecException("No active filesystem")

    fs = _get_active()
    return fs.open(*args, **kwargs)


def bytes(*args, **kwargs):
    # Get bytes from the specified path
    if not _active:
        raise JupyterFsspecException("No active filesystem")

    fs = _get_active()
    kwargs["mode"] = "rb"

    return fs.open(*args, **kwargs).read()


def utf8(*args, **kwargs):
    # Get utf8 text from the specified path (valid utf8 data is assumed)
    if not _active:
        raise JupyterFsspecException("No active filesystem")

    fs = _get_active()
    kwargs["mode"] = "r"
    kwargs["encoding"] = "utf8"

    return fs.open(*args, **kwargs).read()


def ls(*args, **kwargs):
    # Convenience/pass through call to fsspec ls
    if not _active:
        raise JupyterFsspecException("No active filesystem")

    fs = _get_active()
    return fs.ls(*args, **kwargs)


def stat(*args, **kwargs):
    # Convenience/pass through call to fsspec stat
    if not _active:
        raise JupyterFsspecException("No active filesystem")

    fs = _get_active()
    return fs.stat(*args, **kwargs)
