import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ICommandPalette } from '@jupyterlab/apputils';

import { FsspecWidget } from './fsspecWidget';
import { Logger } from './logger';

import { FsspecModel } from './handler/fileOperations';

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Window {
    fsspecModel: FsspecModel;
  }
}

/**
 * Initialization data for the jupyterFsspec extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterFsspec:plugin',
  description: 'A Jupyter interface for fsspec.',
  autoStart: true,
  requires: [ICommandPalette],
  optional: [ISettingRegistry],
  activate: async (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log('JupyterLab extension jupyterFsspec is activated!');
    Logger.setLevel(Logger.DEBUG);

    if (app['namespace'] !== 'Jupyter Notebook') {
      // Auto initialize the model
      const fsspecModel = new FsspecModel();
      await fsspecModel.initialize();

      // Use the model to initialize the widget and add to the UI
      const fsspec_widget = new FsspecWidget(fsspecModel);
      fsspec_widget.id = 'jupyterFsspec:widget';

      app.shell.add(fsspec_widget, 'right');
    } else {
      const { commands } = app;
      const commandToolkit = 'jupyter_fsspec:open';

      commands.addCommand(commandToolkit, {
        label: 'Open jupyterFsspec',
        execute: async () => {
          const top_area_command = 'application:toggle-panel';
          const args = {
            side: 'right',
            title: 'Show jupyterFsspec',
            id: 'plugin'
          };

          // Check if right area is open
          if (!commands.isToggled(top_area_command, args)) {
            await commands.execute(top_area_command, args).then(async () => {
              console.log('Opened JupyterFsspec!');
            });
          }

          // Auto initialize the model
          const fsspecModel = new FsspecModel();
          await fsspecModel.initialize();
          // Use the model to initialize the widget and add to the UI
          const fsspec_widget = new FsspecWidget(fsspecModel);
          fsspec_widget.id = 'jupyter_fsspec:widget';

          // Add the widget to the top area
          app.shell.add(fsspec_widget, 'right', { rank: 100 });
          app.shell.activateById(fsspec_widget.id);
        }
      });

      palette.addItem({
        command: commandToolkit,
        category: 'My Extensions',
        args: { origin: 'from palette', area: 'right' }
      });
    }

    // // TODO finish this
    // if (settingRegistry) {
    //   settingRegistry
    //     .load(plugin.id)
    //     .then(settings => {
    //       Logger.info(`[FSSpec] Settings loaded: ${settings.composite}`);
    //     })
    //     .catch(reason => {
    //       Logger.error(`[FSSpec] Failed to load settings for jupyterFsspec: ${reason}`);
    //     });
    // }
  }
};

export default plugin;
