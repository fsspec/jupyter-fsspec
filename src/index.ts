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
  upperArea: any;

  constructor() {
    super();
    this.title.label = 'FSSpec'

    this.node.classList.add('jfss-root');

    let primaryDivider = document.createElement('div');
    primaryDivider.classList.add('jfss-primarydivider');

    this.upperArea = document.createElement('div');
    this.upperArea.innerText = 'Jupyter FSSpec'
    this.upperArea.classList.add('jfss-upperarea')

    let hsep = document.createElement('div');
    hsep.classList.add('jfss-hseparator');

    let lowerArea = document.createElement('div');
    lowerArea.classList.add('jfss-lowerarea')

    let resultArea = document.createElement('div');
    resultArea.classList.add('jfss-resultarea')
    lowerArea.appendChild(resultArea);

    primaryDivider.appendChild(this.upperArea);
    primaryDivider.appendChild(hsep);
    primaryDivider.appendChild(lowerArea);

    this.node.appendChild((primaryDivider));
    this.addFilesystemItem('Hard Drive', 'Local');
    this.addFilesystemItem('Bar', 'S3');
    this.addFilesystemItem('Biz', 'S3');
    this.addFilesystemItem('Wik', 'S3');
    this.addFilesystemItem('Rak', 'S3');
    this.addFilesystemItem('Rum', 'S3');
  }

  addFilesystemItem(name: string, fstype: string) {
    let fsItem = document.createElement('div');
    fsItem.classList.add('jfss-fsitem-root');

    let nameField = document.createElement('div');
    nameField.classList.add('jfss-fsitem');
    nameField.innerText = name;
    nameField.addEventListener('mouseenter', this.handleFsysHover);
    nameField.addEventListener('mouseleave', this.handleFsysHover);
    fsItem.appendChild(nameField);

    let typeField = document.createElement('div');
    typeField.classList.add('jfss-fsitem');
    typeField.innerText = fstype;
    fsItem.appendChild(typeField);

    this.upperArea.appendChild(fsItem);
  }

  handleFsysHover(event: any) {
    if (event.type == 'mouseenter') {
      event.target.style.backgroundColor = '#bbb';
    }
    else {
      event.target.style.backgroundColor = '#ddd';
    }
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
