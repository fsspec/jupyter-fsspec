# jupyter_fsspec

[![Github Actions Status](https://github.com/fsspec/jupyter-fsspec/workflows/Build/badge.svg)](https://github.com/fsspec/jupyter-fsspec/actions/workflows/build.yml)

Welcome to the `jupyter_fsspec` repo, a Jupyter extension for the `fsspec` Python library.
Browse your fsspec filesystems in Jupyter, copy files and paths and otherwise interact with
your data in the Jupyter interface and inside your notebooks.

## Documentation

Read the documentation at https://jupyter-fsspec.readthedocs.io/en/latest/

## Requirements

- JupyterLab >= 4.0.0

## Install

To install the extension, execute:

```bash
pip install jupyter_fsspec
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupyter_fsspec
```

## Motivation

`jupyter_fsspec` was created to provide seamless integration between Jupyter
environments and the powerful `fsspec` ecosystem. While the Jupyter ecosystem
already had file browsing capabilities, there was a need for a dedicated extension
that could leverage the full power of `fsspec`'s unified interface to various
filesystems.

### Why We Created jupyter_fsspec

The creation of `jupyter_fsspec` was inspired by several ideas we wanted to explore:

1. **Direct fsspec Integration**: We wanted to build a bridge directly to the
   `fsspec` ecosystem, making it simple to access all filesystems supported by
   `fsspec` with minimal layers.

2. **Unified Interface**: `fsspec` offers a consistent API across different storage
   backends (local, cloud, and remote filesystems). We thought it would be valuable
   to bring this unified approach to the Jupyter interface.

3. **Complementary Approach**: We designed the UI with certain workflows in mind,
   focusing on unified browsing, easy file path copying, and seamless notebook
   integration.

### Complementary to jupyter-fs

[`jupyter-fs`](https://github.com/jpmorganchase/jupyter-fs) is also a great project
with similar goals but different design choices that make it excellent for certain
use cases:

- `jupyter-fs` leverages PyFilesystem, providing robust filesystem abstractions
  with its own set of advantages
- The separate panel per filesystem in `jupyter-fs` offers a clean separation that
  some users may prefer for their workflows
- Both projects enhance the Jupyter experience by bringing better filesystem access
  to users

We see `jupyter_fsspec` and `jupyter-fs` as complementary tools in the ecosystem.
We have also been discussing trying to merge the projects and `jupyter-fs` recently
added a `fsspec` backend as well.

If you're deciding between the two, consider your specific needs:

- If you're already using `fsspec` in your Python code, `jupyter_fsspec` provides a
  consistent experience
- If you prefer separate filesystem panels or are already using PyFilesystem,
  `jupyter-fs` might be more aligned with your workflow

We welcome contributions and feedback from the community as we continue developing
this extension. We're also open to collaborations with other filesystem projects in
the Jupyter ecosystem to collectively improve the experience for data scientists and
researchers working with diverse data sources.
