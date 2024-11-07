# Gives users access to filesystems defined in the jupyter_fsspec config file


import datetime
from types import SimpleNamespace
from urllib.parse import quote as urlescape  # TODO refactor

from .file_manager import FileSystemManager
from .exceptions import JupyterFsspecException


# Global config manager for kernel-side jupyter-fsspec use
_manager = None
_active = None
_EMPTY_RESULT = {
    'ok': False,
    'value': None,
    'path': None,
    'timestamp': None,
}
out = SimpleNamespace(_EMPTY_RESULT)


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
    fs = mgr.get_filesystem(urlescape(fs_name))
    if fs is not None and 'instance' in fs:
        return fs['instance']  # TODO refactor
    else:
        raise JupyterFsspecException('Error, could not find specified filesystem')


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
    now = datetime.datetime.now().isoformat()
    out = SimpleNamespace(_EMPTY_RESULT)
    out.timestamp = now

    filesys = filesystem(fs_name)
    out = SimpleNamespace({
        'ok': True,
        'value': filesys.open(path, mode='rb').read(),
        'path': path,
        'timestamp': now,
    })


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
        raise JupyterFsspecException('No active filesystem')

    fs = _get_active()
    return fs.open(*args, **kwargs)


def bytes(*args, **kwargs):
    # Get bytes from the specified path
    if not _active:
        raise JupyterFsspecException('No active filesystem')

    fs = _get_active()
    kwargs['mode'] = 'rb'

    return fs.open(*args, **kwargs).read()


def utf8(*args, **kwargs):
    # Get utf8 text from the specified path (valid utf8 data is assumed)
    if not _active:
        raise JupyterFsspecException('No active filesystem')

    fs = _get_active()
    kwargs['mode'] = 'r'
    kwargs['encoding'] = 'utf8'

    return fs.open(*args, **kwargs).read()


def ls(*args, **kwargs):
    # Convenience/pass through call to fsspec ls
    if not _active:
        raise JupyterFsspecException('No active filesystem')

    fs = _get_active()
    return fs.ls(*args, **kwargs)


def stat(*args, **kwargs):
    # Convenience/pass through call to fsspec stat
    if not _active:
        raise JupyterFsspecException('No active filesystem')

    fs = _get_active()
    return fs.stat(*args, **kwargs)
