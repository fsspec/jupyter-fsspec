import * as path from "path";

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ICommandPalette } from '@jupyterlab/apputils';

import { FileManagerWidget } from './FileManager';

import { FsspecModel } from './handler/fileOperations';
import { FilesystemItem } from './FilesystemItem';
import { FssTreeItem } from './FssTreeItem';

import { Widget } from '@lumino/widgets';

import { TreeView } from '@jupyter/web-components';

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
  dirTree: any = {};

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
    for (const key of Object.keys(this.model.userFilesystems)) {
      let fsInfo = this.model.userFilesystems[key];
      this.addFilesystemItem(fsInfo);
    }
  }

  addFilesystemItem(fsInfo: any) {
    let fsItem = new FilesystemItem(fsInfo, [this.handleFilesystemClicked.bind(this)]);
    this.filesysContainer.appendChild(fsItem.element);
  }

  async handleFilesystemClicked(fsInfo: any) {
    this.model.setActiveFilesystem(fsInfo.name);
    await this.populateTree(fsInfo.name);
  }

  getNodeForPath(source_path: string) {
    // Traverse the dir tree and get the node for the supplied path
    let nodeForPath: any = null;
    // Dir tree nodes store a path relative to the fs root directly on the node (with
    // an absolute path stored elsewhere, in the metadata attribute). Children of nodes
    // are keyed by path segment from their parent (so at the node for a folder "my_data",
    // a child path "my_data/salinity.csv" has a key "salinity.csv" in the node's children
    // leading to that node).
    // 
    // Here, we get the supplied path relative to fs root, then split it into path segments,
    // and start traversing the dir tree using those segments to find the next child node
    // (so if "/my_cool/root_directory" is the fs root, "/my_cool/root_directory/data_files/userfile.dat"
    // will start looking for the "data_files" child node first.
    let relPathFromFsRoot = path.relative(this.model.getActiveFilesystemInfo().path, source_path);

    // Traverse nodes using the source path's segments
    let currentNode = this.dirTree;
    for (const segment of relPathFromFsRoot.split('/').filter((c: any) => c.length > 0)) {
      if (segment in currentNode['children']) {
        currentNode = currentNode['children'][segment]
      } else {
        break;
      }
    }

    // Check if the desired node was found, set result if so
    if (currentNode.metadata.name == source_path) {
      nodeForPath = currentNode;
    }

    return nodeForPath;
  }

  async lazyLoad(source_path: string) {
    console.log(`Calling lazy load for ${path}`);

    // TODO validate response
    const response = await this.model.listDirectory(this.model.userFilesystems[this.model.activeFilesystem].key, source_path);
    console.log(JSON.stringify(response));

    let nodeForPath = this.getNodeForPath(source_path);
    nodeForPath;

    if (!nodeForPath.fetch) {
      this.updateTree(nodeForPath, response['content'], this.model.getActiveFilesystemInfo().path);
      nodeForPath.fetch = true;  // TODO check this
      console.log(`HAXY ${JSON.stringify(nodeForPath)}`);
    }
  }

  async populateTree(fsname: string) {
    // Update current filesystem disp label and empty tree view
    this.selectedFsLabel.innerText = `Files for: ${fsname}`;
    this.treeView.replaceChildren();

    // Fetch available files, populate tree
    // const response = await this.model.listActiveFilesystem();
    const response = await this.model.listDirectory(this.model.userFilesystems[this.model.activeFilesystem].key);
    const pathInfos = response['content'];
    // console.log('PATHINFOS');
    // console.log(pathInfos);
    let dirTree: any = this.buildTree(pathInfos, this.model.userFilesystems[fsname].path);  // TODO missing files key
    this.dirTree = dirTree;
    // console.log(JSON.stringify(dirTree));
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
          let item = new FssTreeItem([this.lazyLoad.bind(this)]);
          item.setMetadata((pathInfo as any).path);
          item.setText(pathSegment);
          elemParent.appendChild(item.root);

          if (Object.keys((pathInfo as any).children).length > 0 ||
              ('type' in (pathInfo as any).metadata && (pathInfo as any).metadata.type == 'directory')) {
            item.setType('dir');
          } else {
            item.setType('file');
          }

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

  updateTree(tree: any, pathInfoList: any, rootPath: string) {
    // Update a given tree or subtree by building/populating
    // a nested tree structure based on the provided pathInfos
    let dirTree = tree;
    for (let pdata of pathInfoList) {
      let name = path.relative(rootPath, pdata.name);

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
          if (i == Math.max(0, segments.length - 1)) {
            metadata = pdata;
          }
          parentLocation[segment] = {
            'path': pdata.name,
            'children': children,
            'metadata': metadata,
            'fetch': false
          };
          parentLocation = parentLocation[segment]['children']
        }
      }
    }
    return dirTree;
  }

  buildTree(pathInfoList: any, rootPath: string) {
    // Start building a new directory tree structure from scratch,
    // update/populate it using a list of pathInfos ([path + metadata] items)
    let dirTree = {
      'path': '/',
      'children': {},
      'fetch': true,
      'metadata': {path: rootPath}
    };
    this.updateTree(dirTree, pathInfoList, rootPath);

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
