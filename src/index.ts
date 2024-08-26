import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ICommandPalette } from '@jupyterlab/apputils';

import { FileManagerWidget } from './FileManager';

import { FsspecModel } from './handler/fileOperations';
import { FilesystemItem } from './FilesystemItem';

import { Widget } from '@lumino/widgets';

import { TreeItem, TreeView } from '@jupyter/web-components';

declare global {
  interface Window {
    fsspecModel: FsspecModel;
  }
}

class FsspecWidget extends Widget {
  upperArea: any;
  model: any;
  // fsList: any;
  selectedFsLabel: any;
  treeView: any;
  filesysContainer: any;
  // stubToggle = false;

  constructor(model: any) {
    super();
    this.model = model;

    this.title.label = 'FSSpec'
    this.node.classList.add('jfss-root');

    let primaryDivider = document.createElement('div');
    primaryDivider.classList.add('jfss-primarydivider');

    this.upperArea = document.createElement('div');
    this.upperArea.classList.add('jfss-upperarea');

    let mainLabel = document.createElement('div');
    mainLabel.classList.add('jfss-mainlabel');
    mainLabel.innerText = 'Jupyter FSSpec'
    this.upperArea.appendChild(mainLabel);

    this.filesysContainer = document.createElement('div');
    this.filesysContainer.classList.add('jfss-userfilesystems');
    this.upperArea.appendChild(this.filesysContainer);

    let hsep = document.createElement('div');
    hsep.classList.add('jfss-hseparator');

    let lowerArea = document.createElement('div');
    lowerArea.classList.add('jfss-lowerarea');

    let resultArea = document.createElement('div');
    resultArea.classList.add('jfss-resultarea');
    lowerArea.appendChild(resultArea);

    this.selectedFsLabel = document.createElement('div');
    this.selectedFsLabel.classList.add('jfss-selectedFsLabel');
    this.selectedFsLabel.classList.add('jfss-mainlabel');
    this.selectedFsLabel.innerText = 'Select a filesystem to display';
    resultArea.appendChild(this.selectedFsLabel);

    this.treeView = new TreeView();
    resultArea.appendChild(this.treeView);

    primaryDivider.appendChild(this.upperArea);
    primaryDivider.appendChild(hsep);
    primaryDivider.appendChild(lowerArea);

    this.node.appendChild((primaryDivider));
    this.populateFilesystems();
  }

  populateFilesystems() {
    console.log('POP FSs 1');
    console.log(this.model);
    for (const [name, fsInfo] of Object.entries(this.model.userFilesystems)) {
      this.addFilesystemItem(name, (fsInfo as any).type)
    }

    // this.addFilesystemItem('Hard Drive', 'Local');
    // this.addFilesystemItem('Cloud Lab Metrics', 'S3',);
  }

  addFilesystemItem(fsname: string, fstype: string) {
    let fsItem = new FilesystemItem(fsname, fstype, [this.handleFilesystemClicked.bind(this)]);
    // this.fsList[fsname] = fsItem;
    this.filesysContainer.appendChild(fsItem.element);
  }

  async handleFilesystemClicked(fsname: string, fstype: string) {
    this.model.setActiveFilesystem(fsname);
    await this.populateTree(fsname);
  }

  async populateTree(fsname: string) {
    // Update current filesystem disp label and empty tree view
    this.selectedFsLabel.innerText = `Files for: ${fsname}`;
    this.treeView.replaceChildren();

    // Fetch available files, populate tree
    let pathInfos = await this.model.listActiveFilesystem();
    console.log('PATHINFOS');
    console.log(pathInfos);
    let dirTree: any = this.buildTree(pathInfos.files);  // TODO missing files key
    console.log(JSON.stringify(dirTree));
    let buildTargets: any = {'/': [this.treeView, dirTree.children]};
    // Traverse iteratively
    while (Object.keys(buildTargets).length > 0) {
      // Start with root, add children
      let deleteQueue: any = []
      for (const absPath of Object.keys(buildTargets)) {
        let elemParent = buildTargets[absPath][0];
        let childPaths = buildTargets[absPath][1];
        // console.log('XXXX');
        // console.log(absPath);
        // console.log(elemParent);
        // console.log(childPaths);
        // console.log(buildTargets[absPath]);

        for (let [pathSegment, pathInfo] of Object.entries(childPaths)) {
          let item = new TreeItem();
          item.innerText = pathSegment;
          elemParent.appendChild(item);

          if (Object.keys((pathInfo as any).children).length > 0) {
            buildTargets[(pathInfo as any).path] = [item, (pathInfo as any).children];
          }
        }
        deleteQueue.push(absPath);
      }
      for (const item of deleteQueue) {
        delete buildTargets[item];
      }
    }
  }

  buildTree(pathInfoList: any) {
    // Take a list of path infos, return a nested dir tree dict
    let dirTree = {
      'path': '/',
      'children': {},
    };
    for (let pdata of pathInfoList) {
      let name = pdata.name;

      // TODO: path sep normalization
      // Go segment by segment, building the nested path tree
      let segments = name.split('/').filter((c: any) => c.length > 0);
      let parentLocation: any = dirTree['children']
      for (let i = 0; i < segments.length; i++) {
        // Get path components and a key for this subpath
        let subpath = [];
        for (let j = 0; j <= i; j++) {
          subpath.push(segments[j])
        }

        let segment: any = segments[i];
        if (segment in parentLocation) {
          parentLocation = parentLocation[segment]['children']
        }
        else {
          let children = {};
          let metadata = {};
          if (i == segments.lastIndexOf()) {
            metadata = pdata;
          }
          parentLocation[segment] = {
            'path': '/' + subpath.join('/'),
            'children': children,
            'metadata': metadata,
          };
          parentLocation = parentLocation[segment]['children']
        }
      }
    }
    return dirTree;
  }

  // getStubFileList() {
  //   let pathList: any = [
  //     {'name': '/Users/djikstra/workspace/averager/index.html', 'type': 'FILE'},
  //     {'name': '/Users/djikstra/workspace/averager/styles.css', 'type': 'FILE'},
  //   ]
  //   return pathList;
  // }
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

    let fsspecModel = new FsspecModel();
    await fsspecModel.initialize();
    window.fsspecModel = fsspecModel;

    let fsspec_widget = new FsspecWidget(fsspecModel);
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
