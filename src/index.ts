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

  handleFilesystemClicked(fsname: string, fstype: string) {
    this.populateTree(fsname);
  }

  populateTree(fsname: string) {
    // Update current filesystem disp label and empty tree view
    this.selectedFsLabel.innerText = `Files for: ${fsname}`;
    this.treeView.replaceChildren();

    // Fetch available files, populate tree
    let dirTree: any = this.buildTree(this.getStubFileList());
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

  getStubFileList() {
    let pathList: any = [
      {'name': '/Users/djikstra/workspace/averager/index.html', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.DS_Store', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/styles.css', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/sample.js.map', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/sample.ts', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/sample.html', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/script.js', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/tsconfig.json', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/sample.js', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.vscode', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.idea', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/ORIG_HEAD', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/config', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/HEAD', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/description', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/index', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/COMMIT_EDITMSG', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/info', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/logs', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/hooks', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/refs', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/66', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/3e', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/03', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/0e', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/ac', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/d8', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/ee', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/f5', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/cf', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/ca', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/e4', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/c8', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/4b', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/pack', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/7d', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/87', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/7b', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/8f', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/81', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/38', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/info', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/6d', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/d3', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/a0', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/a7', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/f9', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/46', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/2d', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/77', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/1e', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/66/61d63223a8e9db7aab8f0ba11665ace6486cec', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/3e/58e41e7e4556e210eb3a0bfbf1e60b99df46f2', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/03/009efb14d95416597cab2f83e3314ea4168d7e', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/0e/4a258d2a06b0c9ad05569add061b57b64d1d6f', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/ac/5f4b49b6fabd3640a9fd44870a01b1910f8b9a', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/d8/c0ce4627a53577a1049bfbafac98221ffad58c', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/ee/6056579f4366f0a462eaf8d076dfad85ad7a5a', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/f5/b6d1b7570c035066f4ee9ea9b83520d54dbdae', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/cf/a02433e3a3fa76cd6e473f950c833421564681', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/ca/8063725020a95388fcf8c2f990a25cda9c296d', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/e4/8e480edc01c4f277e92f62ce7afeda7076d68e', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/c8/d6e1857abbb3fc4dd637ae34b8f7fe315363f7', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/4b/3e62de86011b4947f600646f3cd594d2651f79', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/7d/81b268de8249dc7fb2074c7b27e05f7e7ea759', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/87/e466597101d706c01a4a25cbc7526075061795', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/7b/c70c85a55624426b37bf1806abfe128179c5a9', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/8f/ccf1fdfeefb6053ce57fbd312e8c948fd5c673', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/81/cbf3a2fcef1269e96bf0c638256077bc5b9bcb', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/38/04706d1dc5dc7f7db2749ee44262841fd8f64a', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/6d/d4afc7672ea51ba30d270f70fb8c775e6bab95', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/d3/150a7d6e0db0d3b0d31f75d36cd18fc4f95c11', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/a0/058ba1ef189bcc0ffe88a7469751bf18000cd3', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/a7/d5fa31cf3784232cc366133dcf7dbe7cae4404', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/f9/6ae8774bb3deb33e1005d6b74aa4849852dfef', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/46/ff7f9965f473460d65ef4df65060c1de616944', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/2d/38e74b308ac0f7b0a8cf55314e6411c89c5cba', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/77/d594c948f1b3e4a15a11e47941155f940f741c', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/objects/1e/9980e5c4306f8f324dd5843dcd264771993cbb', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/info/exclude', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/logs/HEAD', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/logs/refs', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/logs/refs/stash', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/logs/refs/heads', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/logs/refs/heads/tscript', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/logs/refs/heads/avgprotoclass', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/logs/refs/heads/master', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/hooks/commit-msg.sample', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/hooks/pre-rebase.sample', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/hooks/pre-commit.sample', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/hooks/applypatch-msg.sample', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/hooks/fsmonitor-watchman.sample', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/hooks/pre-receive.sample', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/hooks/prepare-commit-msg.sample', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/hooks/post-update.sample', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/hooks/pre-merge-commit.sample', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/hooks/pre-applypatch.sample', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/hooks/pre-push.sample', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/hooks/update.sample', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/hooks/push-to-checkout.sample', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/refs/stash', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/refs/heads', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/refs/tags', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/refs/heads/tscript', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/refs/heads/avgprotoclass', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.git/refs/heads/master', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.vscode/launch.json', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.idea/vcs.xml', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.idea/.gitignore', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.idea/workspace.xml', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.idea/modules.xml', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.idea/averager.iml', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.idea/misc.xml', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.idea/inspectionProfiles', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.idea/codeStyles', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.idea/inspectionProfiles/profiles_settings.xml', 'type': 'FILE'},
      {'name': '/Users/djikstra/workspace/averager/.idea/codeStyles/codeStyleConfig.xml', 'type': 'FILE'}
    ]
    return pathList;
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
