# Jupyter fsspec documentation

![Jupyter FSSpec inside JupyterLab](_static/extension_example_1.png 'Jupyter FSSpec inside JupyterLab')

Welcome to the `jupyter_fsspec` documentation, the Jupyter extension for the `fsspec` Python library.

`jupyter_fsspec` provides a file browser for your `fsspec` filesystems using a config file, and a Python module (`jupyter_fsspec.helper`) for using your defined filesystems inside your notebook kernels.

## Installation

You can install `jupyter_fsspec` with pip (make sure you've installed JupyterLab or another editor first):

`pip install jupyter-fsspec`

You can verify that the JupyterLab extension and Jupyter Server extension are enabled properly with:

```
jupyter labextension list
jupyter server extension list
```

## Basic Usage

`jupyter_fsspec` lives in the JupyterLab right sidebar, and when you open it, you will
see a list of the filesystems you have defined in the config file (see below). When
you select one of them, you will see a file browser (tree view) of those files below.

Basic navigation works as you'd expect: Click to expand/collapse folders, and right click for
context options (such as copying the path of the current file to the clipboard).

### Uploading Files

Uploading files to your FSSpec filesystems allows you to:

- Transfer data between your local environment and remote storage systems
- Share notebooks with datasets across different computing environments
- Back up your work to cloud storage or other remote locations
- Prepare data for distributed processing in cloud environments

You can upload files from multiple sources:

- **From bytes inside your active notebook kernel:**

  - Import the `jupyter_fsspec.helper` module
  - Designate bytes for upload with
    `jupyter_fsspec.helper.set_user_data(some_bytes)`
  - Right-click the target folder or location in Jupyter FSSpec
  - Select `Upload from Helper Module`
  - _Useful for: Programmatically generated data, processed results, or content
    modified in your notebook_

- **From your local computer:**

  - Right-click the target folder or location in Jupyter FSSpec
  - Select `Upload from Computer`
  - Choose a file from the browser's file picker
  - _Useful for: New datasets, configuration files, or results from external
    tools_

- **From JupyterLab's integrated file browser:**
  - Right-click a file in JupyterLab's File Browser
  - Select `Select as Upload Source for FSSpec`
  - Right-click the target folder or location in Jupyter FSSpec
  - Select `Upload from Jupyter File Browser`
  - _Useful for: Moving files between your JupyterLab workspace and remote
    storage systems_

:::{note}
To transfer files between different remote filesystems (e.g., from S3
to GCS), you'll need to use the `helper` module in your notebook to download
from one source and upload to another. Direct remote-to-remote transfers are not
currently supported through the UI.
:::

## Config File

To define your `fsspec` filesystems, you will need to list them in the Jupyter config folder,
inside a file named `~/.jupyter/jupyter-fsspec.yaml`. Here's a sample file where for the local
filesystem instances, `file:///Users/finnmertens` is the server root path:

```
sources:
  - name: "Cell filter repo"
    path: "file:///Users/finnmertens/cfilter/jupyterlab"
  - name: "Averager project"
    path: "file:///Users/finnmertens/averager"
  - name: "Remote MyBucket"
    path: "s3://mybucket"
    args: []
    kwargs:
      anon: false
      key: "my-access-key"
      secret: "my-secret-key"
      client_kwargs:
        endpoint_url: "https://s3.provider.com"
  - name: "MemFS"
    path: "memory://sample"
```

The config file has a list of sources, where each item needs a name and a path URL. The name
is a unique identifier, so it should not be duplicated. The type of filesystem `fsspec` should
construct is required in the path URL as the protocol `file://` etc. For local filesystems,
when the path is provided with no prefix in the protocol URL e.g. `file://`,
the filesystem will be instantiated at the root of the corresponding filesystem.
See the [fsspec documentation](https://filesystem-spec.readthedocs.io/en/latest/usage.html#instantiate-a-file-system)
for more information about available protocols and filesystem instantiation.
If you provide the `protocol` argument it will be ignored. The config file path URL
option accepts directory paths but does not support specifying specific files paths.

Lastly, you can pass additional arguments to the `fsspec` filesystem contructor by using the
`args` and/or `kwargs` keys. You can check the `fsspec` docs for the available options that
each filesystem implementation offers.

:::{warning}
By default, the file browser in jupyter_fsspec does not enforce Jupyter Server’s root
directory restriction and will allow access to paths outside of it. To restrict access:

- Set the CLI flag `--JupyterFsspec.allow_absolute_paths=False ` when instantiating the server
- Set the corresponding environment variable in the kernel environment environment (see `helper` module section)

This will ensure that `jupyter_fsspec` will only instantiate filesystems rooted within
the server's working directory in both the browser UI and in the kernel side.
Since the kernel is usually a fully privileged process, this restriction only applies to the automatic behavior of jupyter_fsspec.
:::

### Inactive Filesystems

Filesystems that are not instantiated due to an error will appear grayed out and will display an error message on hover.
On click, there will be more information logged to the browser console.

![Jupyter FSSpec Inactive Filesystem](_static/s3fs_inactive.png 'Jupyter FSSpec Inactive Filesystem')

## The `helper` module

You can import the `jupyter_fsspec.helper` module into your notebooks to interact with
filesystems defined in your config file:

```
# Import the helper module directly
from jupyter_fsspec import helper

# Get an fsspec filesystem using the config name
# (and use it as you would any fsspec filesystem)
fs = helper.filesystem('Averager project')

with fsspec.open('file://my/file/path', 'rb') as fhandle:
    filebytes = fhandle.read()
filebytes[:256]
```

:::{note}
In disctrubuted environments, (for e.g. remote kernels) the paths in the code
that the helper uses may not be valid unless the kernel and server share a filesystem.
:::

:::{warning}
The environment variable "JUPYTER_FSSPEC_ALLOW_ABSOLUTE_PATHS" defaults to true, and
should be set to false in the kernel environment to ensure that the the helper does not
instantiate filesystems with absolute paths.
:::

## Examples

Practical examples demonstrating how to use Jupyter fsspec with different storage systems:

```{toctree}
:maxdepth: 1

examples/minio-quickstart.md
```
