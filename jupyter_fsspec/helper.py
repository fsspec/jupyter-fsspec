# Gives users access to filesystems defined in the jupyter_fsspec config file


import copy
import datetime
import traceback

from .file_manager import FileSystemManager
from .exceptions import JupyterFsspecException


# Global config manager for kernel-side jupyter-fsspec use
_manager = None
_active = None
_EMPTY_RESULT = {
    "ok": False,
    "value": None,
    "path": None,
    "timestamp": None,
    "error": None,
}
out = None  # Set below


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

        string_rep = (
            '----------------\n'
            f'Request [{"OK" if self.ok else "FAIL"}]{time_delta_info}\n'
            f'{timestamp_info}'
            '................\n'
            f'Path: {"<None>" if self.path is None else self.path}\n'
            f'Data[:{HelperOutput.PREVIEW_LEN}] preview (total {self.length}):{value_info}\n'
            f'{"" if self.ok else "\n.... ERROR! ....\n" + str(self.error)}'
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
    fs = mgr.get_filesystem(fs_name)
    if fs is not None and "instance" in fs:
        return fs["instance"]  # TODO refactor
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

    filesys = filesystem(fs_name)
    try:
        out = HelperOutput(
            {
                "ok": True,
                "value": filesys.open(path, mode="rb").read(),
                "path": path,
                "timestamp": now,
                "error": None,
            }
        )
    except Exception:
        blank["error"] = traceback.format_exc()
        out = HelperOutput(blank)


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
