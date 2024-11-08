import * as path from "path";

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ICommandPalette } from '@jupyterlab/apputils';

import { FileManagerWidget } from './FileManager';

import { FsspecModel } from './handler/fileOperations';
import { FssFilesysItem } from './FssFilesysItem';
import { FssTreeItem } from './FssTreeItem';

import { Widget } from '@lumino/widgets';

import { TreeView } from '@jupyter/web-components';

import { Logger } from "./logger"

declare global {
  interface Window {
    fsspecModel: FsspecModel;
  }
}

class UniqueId {
  static _id_val = -1;

  static get_id() {
    UniqueId._id_val += 1;
    return UniqueId._id_val;
  }
}

class FsspecWidget extends Widget {
  upperArea: any;
  model: any;
  selectedFsLabel: any;
  fsDetails: any;
  detailName: any;
  detailPath: any;
  treeView: any;
  elementHeap: any = {};  // Holds FssTreeItem's keyed by path
  sourcesHeap: any = {};  // Holds FssFilesysItem's keyed by name
  filesysContainer: any;
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

    let sourcesControls = document.createElement('div');
    sourcesControls.classList.add('jfss-sourcescontrols');
    this.upperArea.appendChild(sourcesControls);

    let sourcesLabel = document.createElement('div');
    sourcesLabel.classList.add('jfss-sourceslabel');
    sourcesLabel.innerText = 'Configured Filesystems'
    sourcesLabel.title = 'A list of filesystems stored in the Jupyter FSSpec yaml';
    sourcesControls.appendChild(sourcesLabel);

    let sourcesDivider = document.createElement('div');
    sourcesLabel.classList.add('jfss-sourcesdivider');
    sourcesControls.appendChild(sourcesDivider);

    let refreshConfig = document.createElement('div');
    refreshConfig.title = 'Re-read and refresh sources from config';
    refreshConfig.classList.add('jfss-refreshconfig');
    refreshConfig.innerText = '\u{21bb}'
    refreshConfig.addEventListener('click', this.fetchConfig.bind(this))
    sourcesControls.appendChild(refreshConfig);

    this.filesysContainer = document.createElement('div');
    this.filesysContainer.classList.add('jfss-userfilesystems');
    this.upperArea.appendChild(this.filesysContainer);

    let hsep = document.createElement('div');
    hsep.classList.add('jfss-hseparator');

    let lowerArea = document.createElement('div');
    lowerArea.classList.add('jfss-lowerarea');

    // let browserAreaLabel = document.createElement('div');
    // browserAreaLabel.classList.add('jfss-browseAreaLabel');
    // browserAreaLabel.innerText = 'Browse Filesystem';
    // lowerArea.appendChild(browserAreaLabel);

    this.selectedFsLabel = document.createElement('div');
    this.selectedFsLabel.classList.add('jfss-selectedFsLabel');
    this.selectedFsLabel.innerText = '<Select a filesystem>';
    lowerArea.appendChild(this.selectedFsLabel);

    let resultArea = document.createElement('div');
    resultArea.classList.add('jfss-resultarea');
    lowerArea.appendChild(resultArea);

    this.treeView = new TreeView();
    resultArea.appendChild(this.treeView);

    primaryDivider.appendChild(this.upperArea);
    primaryDivider.appendChild(hsep);
    primaryDivider.appendChild(lowerArea);

    this.node.appendChild((primaryDivider));
    this.populateFilesystems();
  }

  async fetchConfig() {
    this.selectedFsLabel.innerText = '<Select a filesystem>';
    await this.model.refreshConfig();
    Logger.debug(`[FSSpec] Refresh config:\n${JSON.stringify(this.model.userFilesystems)}`);
    this.populateFilesystems();
  }

  populateFilesystems() {
    Logger.debug(`[FSSpec] Populate filesystems: \n${JSON.stringify(this.model.userFilesystems)}`);

    this.sourcesHeap = {};
    this.filesysContainer.replaceChildren();
    this.treeView.replaceChildren();
    this.elementHeap = {};
    for (const key of Object.keys(this.model.userFilesystems)) {
      let fsInfo = this.model.userFilesystems[key];
      this.addFilesystemItem(fsInfo);
    }
  }

  addFilesystemItem(fsInfo: any) {
    let fsItem = new FssFilesysItem(fsInfo, [this.handleFilesystemClicked.bind(this)]);
    this.sourcesHeap[fsInfo.name] = fsItem;
    fsItem.setMetadata(fsInfo.path);
    this.filesysContainer.appendChild(fsItem.root);
  }

  async handleFilesystemClicked(fsInfo: any) {
    for (let fsElem of this.filesysContainer.children) {
      // Set clicked FS to selected state (+colorize), deselect others
      if (!(fsElem.dataset.fssname in this.sourcesHeap)) {
        // This should never happen
        Logger.error('Error selecting filesystem');
        break;
      }

      let wrapper = this.sourcesHeap[fsElem.dataset.fssname];

      if (fsElem.dataset.fssname == fsInfo.name) {
        wrapper.selected = true;
      }
      else {
        wrapper.selected = false;
      }
    }

    this.model.setActiveFilesystem(fsInfo.name);
    await this.fetchAndDisplayFileInfo(fsInfo.name);
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
    // Fetch files for a given folder and update the dir tree with the results
    Logger.info(`Calling lazy load for ${source_path}`);
    const response = await this.model.listDirectory(this.model.userFilesystems[this.model.activeFilesystem].key, source_path);
    if (response?.status != 'success' || !response?.content) {
      // TODO refactor validation
      Logger.error(`Error fetching files for path ${source_path}`);  // TODO jupyter info print
      return;
    }
    // Logger.debug(`Response: (${JSON.stringify(response)})`);

    // Get the dir tree node for this path (updates go into this subtree)
    let nodeForPath = this.getNodeForPath(source_path);
    // Logger.debug(`Found node: ${JSON.stringify(nodeForPath)}`);
    if (!nodeForPath) {
      Logger.error(`Error: Bad path for ${source_path}`);
      return;
    }
    if (!nodeForPath.fetch) {  // Only fetch if this hasn't been fetched before
      // Update the dir tree/data
      this.updateTree(nodeForPath, response['content'], source_path);
      nodeForPath.fetch = true;
      // Logger.debug(`After fetch: ${JSON.stringify(nodeForPath)}`);
    }
    else {
      // Already fetched this child path, ignore and return
      Logger.info('Skipping lazy load, already fetched for ${source_path}');
      return;
    }

    // Update the TreeView in the UI
    await this.updateFileBrowserView(nodeForPath);
    if (nodeForPath.id.toString() in this.elementHeap) {
      let uiElement = this.elementHeap[nodeForPath.id.toString()];
      uiElement.expandItem();
      // Logger.debug(`[FSSpec] StartNode children after lazy load:\n\n${uiElement.root.innerHTML}`);
    }
  }

  getElementForNode(ident: any) {
    return this.elementHeap[ident.toString()];
  }

  async updateFileBrowserView(startNode: any=null) {
    // Update/sync the tree view with the file data for this filesys
    Logger.info('Updating file browser view');
    let dirTree: any = this.dirTree;
    let buildTargets: any = {'/': [this.treeView, dirTree.children]};

    // Set up either a partial update (from a given start node), or
    // a complete tear down and repopulate from scratch (for new data)
    if (startNode) {
      dirTree = startNode;
      let startPath = startNode.path;
      buildTargets = {};
      buildTargets[startPath] = [this.getElementForNode(startNode.id), startNode.children];

    } else {
      this.treeView.replaceChildren();
    }

    // Traverse iteratively
    while (Object.keys(buildTargets).length > 0) {
      // Start with root, add children
      let deleteQueue: any = []
      for (const absPath of Object.keys(buildTargets)) {
        let elemParent = buildTargets[absPath][0];
        let childPaths = buildTargets[absPath][1];

        if (!childPaths) {
          // TODO: Create a placeholder child item for this dir
        }
        for (let [pathSegment, pathInfo] of Object.entries(childPaths)) {
          let item = new FssTreeItem([this.lazyLoad.bind(this)], true, true);
          item.setMetadata((pathInfo as any).path);
          item.setText(pathSegment);
          // (pathInfo as any).ui = item;
          elemParent.appendChild(item.root);

          // Store ID and element in the element heap
          let item_id = UniqueId.get_id();
          (pathInfo as any).id = item_id;
          this.elementHeap[item_id.toString()] = item;

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

  async fetchAndDisplayFileInfo(fsname: string) {
    // Fetch files for this filesystem
    const response = await this.model.listDirectory(this.model.userFilesystems[this.model.activeFilesystem].key);
    if (!('status' in response) || !(response.status == 'success') || !('content' in response)) {
      // TODO refactor validation
      Logger.error(`Error fetching files for filesystem ${fsname}`);  // TODO jupyter info print
      return;
    }
    const pathInfos = response['content'].sort((a: any, b: any) => {return a.name.localeCompare(b.name)});

    // Update current filesystem display labels
    this.selectedFsLabel.innerText = `${fsname}`;

    // Build a directory tree and update the display
    this.dirTree = this.buildTree(pathInfos, this.model.userFilesystems[fsname].path);
    this.updateFileBrowserView();
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
            'fetch': false,
            'id': null,
          };
          parentLocation = parentLocation[segment]['children']
        }
      }
    }
    return dirTree;
  }

  clearFileData() {
    this.dirTree = {};
    this.elementHeap = {};
  }

  buildTree(pathInfoList: any, rootPath: string) {
    // Start building a new directory tree structure from scratch,
    // update/populate it using a list of pathInfos ([path + metadata] items)
    this.clearFileData();
    let dirTree = {
      'path': '/',
      'children': {},
      'fetch': true,
      'metadata': {path: rootPath},
      'id': null,
    };
    this.updateTree(dirTree, pathInfoList, rootPath);

    return dirTree;
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
    Logger.setLevel(Logger.DEBUG)

    // Auto initialize the model
    let fsspecModel = new FsspecModel();
    await fsspecModel.initialize();
    // Use the model to initialize the widget and add to the UI
    let fsspec_widget = new FsspecWidget(fsspecModel);
    fsspec_widget.id = 'jupyterFsspec:widget'
    app.shell.add(fsspec_widget, 'right');

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
