import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

// import React from 'react';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ICommandPalette } from '@jupyterlab/apputils';

// import { Checkbox } from '@jupyter/web-components';

// import { requestAPI } from './handler/handler';
import { FileManagerWidget } from './FileManager';

// import { Signal } from '@lumino/signaling';

import {
  Widget
} from '@lumino/widgets';

declare global {
  interface Window {
    fsspecModel: FsspecModel;
  }
}

class FsspecModel {
  // Frontend model for user's fsspec filesystems
  activeFilesystem = '';
  filesystemList: any;

  constructor() {

  }

  getStoredFilesystems() {
    // Fetch list of filesystems stored in user's config file
  }

  listActiveFilesystem() {
    // Return list of files for active FS
  }

  listFilesystem(name: String) {
    // Provide a FS name to list
  }
}

class FsspecWidget extends Widget {

  constructor() {
    super();

    this.node.classList.add('jfsspec-root');

    // let uiToolkit = new DesignSystemProvider();
    let primaryDivider = document.createElement('div');
    primaryDivider.classList.add('jfsspec-primarydivider');
    // uiToolkit.appendChild(primaryDivider);

    let upperArea = document.createElement('div');
    upperArea.innerText = 'Local filesystem'
    upperArea.classList.add('jfsspec-upperarea')

    // let fileMgr: any = React.createElement('FileManagerComponent');
    // upperArea.appendChild(fileMgr);

    let hsep = document.createElement('div');
    hsep.classList.add('jfsspec-hseparator');

    let lowerArea = document.createElement('div');
    lowerArea.classList.add('jfsspec-lowerarea')

    let resultArea = document.createElement('div');
    resultArea.classList.add('jfsspec-resultarea')
    lowerArea.appendChild(resultArea);

    primaryDivider.appendChild(upperArea);
    primaryDivider.appendChild(hsep);
    primaryDivider.appendChild(lowerArea);

    // let cbox = new Checkbox();
    // cbox.style.marginLeft = '1rem';
    // upperArea.appendChild(cbox);

    this.node.appendChild((primaryDivider));
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
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log('JupyterLab extension jupyterFsspec is activated!');

    let fsspecModel = new FsspecModel();
    window.fsspecModel = fsspecModel;

    let fsspec_widget = new FsspecWidget();
    fsspec_widget.id = 'jupyterFsspec:widget'
    app.shell.add(fsspec_widget, 'right');

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

    const { commands } = app;
    const commandToolkit = 'jupyter_fsspec:open-toolkit';
    commands.addCommand(commandToolkit, {
      label: 'Open fsspec Toolkit Widget',
      execute: () => {
        const widget = new FileManagerWidget();
        widget.id = 'jupyter_fsspec-toolkit-widget';
        widget.title.label = 'fsspec Toolkit Widget';
        app.shell.add(widget, 'right');
      }
    });

    palette.addItem({
      command: commandToolkit,
      category: 'My Extensions',
      args: { origin: 'from palette ' }
    });
  }
};

export default plugin;
