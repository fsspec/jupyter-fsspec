"""Holds jupyter_fsspec exception base + any derived exceptions"""


class JupyterFsspecException(Exception):
    pass


class ConfigFileException(JupyterFsspecException):
    pass
