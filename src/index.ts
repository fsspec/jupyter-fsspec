import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';

import { requestAPI } from './handler';
import { MyButtonWidget } from './MyButtonWidget';

import { Checkbox } from '@jupyter/web-components';

// import { Signal } from '@lumino/signaling';

import {
  Widget
} from '@lumino/widgets';

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

    let cbox = new Checkbox();
    cbox.style.marginLeft = '1rem';
    upperArea.appendChild(cbox);

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
        const content = new MyButtonWidget();
        const widget = new MainAreaWidget<MyButtonWidget>({ content });
        widget.id = 'jupyter_fsspec-toolkit-widget';
        widget.title.label = 'fsspec Toolkit Widget';
        app.shell.add(widget, 'main');

        requestAPI<any>('hello')
          .then(data => {
            console.log(data);
          })
          .catch(reason => {
            console.error(
              `The jupyterlab_examples_server server extension appears to be missing.\n${reason}`
            );
          });
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
