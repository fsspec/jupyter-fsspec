"""Server configuration for integration tests.

!! Never use this configuration in production because it
opens the server to the world and provide access to JupyterLab
JavaScript objects through the global window variable.
"""

from jupyterlab.galata import configure_jupyter_server

configure_jupyter_server(c)

# Uncomment to set server log level to debug level
# c.ServerApp.log_level = "DEBUG"

from tempfile import mkdtemp
import jupyter_core.paths

jupyter_core.paths.jupyter_config_dir = lambda: mkdtemp(prefix="test-config-dir")
print(f"TEST_CONFIG_DIR is: {jupyter_core.paths.jupyter_config_dir()}")
