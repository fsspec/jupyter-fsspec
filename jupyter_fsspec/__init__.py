try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings

    warnings.warn("Importing 'jupyter_fsspec' outside a proper installation.")
    __version__ = "dev"
from . import helper as helper
from .handlers import setup_handlers


from traitlets import Bool
from traitlets.config import Configurable


class JupyterFsspec(Configurable):
    allow_absolute_paths = Bool(
        True,
        help="If True, accepts absolute paths via jupyter_fsspec.yaml config. "
        "Only intended for trusted environments.",
    ).tag(config=True)


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "jupyterFsspec"}]


def _jupyter_server_extension_points():
    return [{"module": "jupyter_fsspec"}]


def _load_jupyter_server_extension(server_app):
    """Registers the API handler to receive HTTP requests from the frontend extension.

    Parameters
    ----------
    server_app: jupyterlab.labapp.LabApp
        JupyterLab application instance
    """
    cfg = JupyterFsspec(parent=server_app)
    server_app.web_app.settings["jupyter_fsspec_allow_abs"] = cfg.allow_absolute_paths
    setup_handlers(server_app.web_app)
    name = "jupyter_fsspec"
    server_app.log.info(f"Registered {name} server extension")
