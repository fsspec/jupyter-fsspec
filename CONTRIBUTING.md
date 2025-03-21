## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupyter_fsspec directory
# Install package in development mode
pip install -e "."
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
pip uninstall jupyter_fsspec
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `jupyterFsspec` within that folder.

### Code Styling

All non-Python source code is formatted with Prettier; while Python source code is formatted with Ruff. Before commiting changes, you should install pre-commit and the pre-commit git hooks. These hooks are defined in the `.pre-commit-config.yaml`.

To install the pre-commit git hooks you can run:

```
pip install pre-commit
pre-commit install
```

You can then run the hooks using `pre-commit run`. If files were committed before the hooks were installed, you can lint all files with the `pre-commit run --all-files` command. Additionally, the `scripts` section in the `package.json` contains standalone commands for running the styling, linting and formatting most of the non-Python source code.

### Testing the extension

#### Frontend tests

This extension is using [Jest](https://jestjs.io/) for JavaScript code testing.

To execute them, execute:

```sh
jlpm
jlpm test
```

#### Integration tests

This extension uses [Playwright](https://playwright.dev/docs/intro) for the integration tests (aka user level tests).
More precisely, the JupyterLab helper [Galata](https://github.com/jupyterlab/jupyterlab/tree/master/galata) is used to handle testing the extension in JupyterLab.

More information are provided within the [ui-tests](./ui-tests/README.md) README.

### Packaging the extension

See [RELEASE](RELEASE.md)

### Logging

The extension uses a configurable logging system that supports different
verbosity levels. When developing or debugging, you can adjust the log level to
see more or less detailed information.

#### Log Levels

The following log levels are available (in order of increasing verbosity):

- `NONE` (0): No logs
- `ERROR` (1): Only error messages
- `WARN` (2): Warnings and errors
- `INFO` (3): Informational messages, warnings, and errors (default)
- `DEBUG` (4): Debug messages and all above

#### Setting the Log Level During Development

There are several ways to change the log level during development:

1. **Using the JupyterLab Settings UI:**

   - Open JupyterLab
   - Go to Settings → Advanced Settings Editor
   - Select "jupyter-fsspec" in the left sidebar
   - Set the `logLevel` value in the User Settings panel on the right:
     ```json
     {
       "logLevel": "debug"
     }
     ```
   - Click "Save Settings"

2. **Programmatically in the browser console:**

   ```javascript
   // Set to debug level
   require('jupyterFsspec').Logger.setLevel(4);

   // Set to error level only
   require('jupyterFsspec').Logger.setLevel(1);
   ```

3. **In your code during development:**

   ```typescript
   import { Logger } from './logger';

   // Set log level for debugging
   Logger.setLevel(Logger.DEBUG);

   // Create a logger with context
   const logger = Logger.getLogger('MyComponent');
   logger.debug('This is a debug message');
   ```

#### Best Practices for Logging

When adding logging to your code:

1. Always use a contextual logger:

   ```typescript
   const logger = Logger.getLogger('ComponentName');
   ```

2. Choose the appropriate log level:

   - `error`: For failures that prevent functionality
   - `warn`: For issues that don't break functionality but are concerning
   - `info`: For important events users should know about
   - `debug`: For developer-focused details

3. Include relevant data for debugging:

   ```typescript
   logger.debug('Processing data', {
     count: items.length,
     firstItem: items[0]
   });
   ```

4. Log at entry/exit points of significant operations:
   ```typescript
   logger.info('Starting file upload...');
   // ... operation code ...
   logger.info('File upload completed');
   ```
