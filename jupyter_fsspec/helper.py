# Gives users access to filesystems defined in the jupyter_fsspec config file


from urllib.parse import quote as urlescape  # TODO refactor

import jupyter_fsspec
from .file_manager import FileSystemManager
from .exceptions import JupyterFsspecException


# Global config manager for kernel-side jupyter-fsspec use
_manager = None
_active = None


def _get_manager(cached=True):
    global _manager
    if not cached or _manager is None:
        _manager = FileSystemManager.create_default()
    return _manager


def _get_fs(fs_name):
    mgr = _get_manager()
    fs = mgr.get_filesystem(urlescape(fs_name))
    if fs is not None and 'instance' in fs:
        return fs['instance']  # TODO refactor
    else:
        raise JupyterFsspecException('Error, could not find specified filesystem')


def reload():
    return _get_manager(False)


def fs(fs_name):
    return _get_fs(fs_name)


filesystem = fs  # Alias for matching fsspec call


def work_on(fs_name):
    global _active
    fs = _get_fs(fs_name)
    _active = fs

    return fs


def _get_active():
    return _active


def open(*args, **kwargs):
    if not _active:
        raise JupyterFsspecException('No active filesystem')

    fs = _get_active()
    return fs.open(*args, **kwargs)


def bytes(*args, **kwargs):
    if not _active:
        raise JupyterFsspecException('No active filesystem')

    fs = _get_active()
    kwargs['mode'] = 'rb'

    return fs.open(*args, **kwargs).read()


def utf8(*args, **kwargs):
    if not _active:
        raise JupyterFsspecException('No active filesystem')

    fs = _get_active()
    kwargs['mode'] = 'r'
    kwargs['encoding'] = 'utf8'

    return fs.open(*args, **kwargs).read()


def ls(*args, **kwargs):
    if not _active:
        raise JupyterFsspecException('No active filesystem')

    fs = _get_active()
    return fs.ls(*args, **kwargs)


def stat(*args, **kwargs):
    if not _active:
        raise JupyterFsspecException('No active filesystem')

    fs = _get_active()
    return fs.stat(*args, **kwargs)
