import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

/**
 * Initialization data for the jupyterFsspec extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterFsspec:plugin',
  description: 'A Jupyter interface for fsspec.',
  autoStart: true,
  optional: [ISettingRegistry],
  activate: (app: JupyterFrontEnd, settingRegistry: ISettingRegistry | null) => {
    console.log('JupyterLab extension jupyterFsspec is activated!');

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('jupyterFsspec settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for jupyterFsspec.', reason);
        });
    }
  }
};

export default plugin;
