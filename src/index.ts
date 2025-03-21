import { Buffer } from 'buffer';
import * as path from 'path';

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  provideJupyterDesignSystem,
  jpTreeView
} from '@jupyter/web-components';
import { addJupyterLabThemeChangeListener } from '@jupyter/web-components';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ICommandPalette, Dialog } from '@jupyterlab/apputils';

import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { INotebookTracker } from '@jupyterlab/notebook';

import { FsspecModel } from './handler/fileOperations';
import { FssFilesysItem } from './FssFilesysItem';
import { FssTreeItem } from './FssTreeItem';
import { FssFileUploadContextPopup } from './fileUploadContextPopup';

import { Widget } from '@lumino/widgets';

import { Logger } from './logger';

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
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

const CODE_GETBYTES = `
from jupyter_fsspec import helper as _jupyter_fsshelper
try:
  _jupyter_fsshelper._request_bytes('FS_NAME', 'FILEPATH')
except:
  raise
`;

const CODE_UPLOADUSERDATA = `
from jupyter_fsspec import helper as _jupyter_fsshelper
`;

class FsspecWidget extends Widget {
  private readonly logger = Logger.getLogger('FsspecWidget');

  upperArea: any;
  model: any;
  selectedFsLabel: any;
  fsDetails: any;
  detailName: any;
  detailPath: any;
  treeView: any;
  elementHeap: any = {}; // Holds FssTreeItem's keyed by path
  sourcesHeap: any = {}; // Holds FssFilesysItem's keyed by name
  emptySourcesHint: any;
  filesysContainer: any;
  openInputHidden: any;
  dirTree: any = {};
  getCurrentWidget: any;
  currentTarget: any = null;
  notebookTracker: INotebookTracker;
  uploadDialog: any = null;
  jobQueueControls: any;
  jobQueue: any;
  jobQueueContainer: any;
  jobQueueExpander: any;
  queuedPickerUploadInfo: any;
  queuedJupyterFileBrowserUploadInfo: any;
  fileBrowserFactory: any;
  app: any;

  constructor(
    model: any,
    notebookTracker: INotebookTracker,
    app: any,
    fileBrowserFactory: any
  ) {
    super();
    this.logger.debug(`DEBUGax1 ${app.serviceManager}`);
    this.logger.debug(`  ${app.serviceManager}`);

    this.model = model;
    this.notebookTracker = notebookTracker;
    this.fileBrowserFactory = fileBrowserFactory;
    this.app = app;

    this.title.label = 'FSSpec';
    this.node.classList.add('jfss-root');

    const primaryDivider = document.createElement('div');
    primaryDivider.classList.add('jfss-primarydivider');

    this.upperArea = document.createElement('div');
    this.upperArea.classList.add('jfss-upperarea');

    // Use a hiden input element to spawn the browser file picker dialog
    this.openInputHidden = document.createElement('input');
    this.openInputHidden.classList.add('jfss-hidden');
    this.openInputHidden.setAttribute('type', 'file');
    this.openInputHidden.addEventListener(
      'input',
      this.handleFilePickerChange.bind(this),
      { passive: true }
    );
    this.upperArea.appendChild(this.openInputHidden);

    const mainLabel = document.createElement('div');
    mainLabel.classList.add('jfss-mainlabel');
    mainLabel.innerText = 'Jupyter FSSpec';
    this.upperArea.appendChild(mainLabel);

    const sourcesControls = document.createElement('div');
    sourcesControls.classList.add('jfss-sourcescontrols');
    this.upperArea.appendChild(sourcesControls);

    const sourcesLabel = document.createElement('div');
    sourcesLabel.classList.add('jfss-sourceslabel');
    sourcesLabel.innerText = 'Configured Filesystems';
    sourcesLabel.title =
      'A list of filesystems stored in the Jupyter FSSpec yaml';
    sourcesControls.appendChild(sourcesLabel);

    const sourcesDivider = document.createElement('div');
    sourcesLabel.classList.add('jfss-sourcesdivider');
    sourcesControls.appendChild(sourcesDivider);

    const refreshConfig = document.createElement('div');
    refreshConfig.title = 'Re-read and refresh sources from config';
    refreshConfig.classList.add('jfss-refreshconfig');
    refreshConfig.innerText = '\u{21bb}';
    refreshConfig.addEventListener('click', this.fetchConfig.bind(this));
    sourcesControls.appendChild(refreshConfig);

    this.emptySourcesHint = document.createElement('div');
    this.emptySourcesHint.classList.add('jfss-emptysourceshint');
    this.emptySourcesHint.innerHTML =
      '<span><a target="_blank" href="https://jupyter-fsspec.readthedocs.io/en/latest/#config-file">\u{26A0} No configured filesystems found,' +
      ' click here to read docs/config info.</a></span>';
    this.upperArea.appendChild(this.emptySourcesHint);

    this.filesysContainer = document.createElement('div');
    this.filesysContainer.classList.add('jfss-userfilesystems');
    this.upperArea.appendChild(this.filesysContainer);

    const hsep = document.createElement('div');
    hsep.classList.add('jfss-hseparator');

    const lowerArea = document.createElement('div');
    lowerArea.classList.add('jfss-lowerarea');

    // let browserAreaLabel = document.createElement('div');
    // browserAreaLabel.classList.add('jfss-browseAreaLabel');
    // browserAreaLabel.innerText = 'Browse Filesystem';
    // lowerArea.appendChild(browserAreaLabel);

    this.selectedFsLabel = document.createElement('div');
    this.selectedFsLabel.classList.add('jfss-selectedFsLabel');
    this.selectedFsLabel.innerText = '<Select a filesystem>';
    lowerArea.appendChild(this.selectedFsLabel);

    const resultArea = document.createElement('div');
    resultArea.classList.add('jfss-resultarea');
    lowerArea.appendChild(resultArea);

    // We use the tagName `jp-tree-view` for Notebook 7 compatibility
    if (!customElements.get('jp-tree-view')) {
      provideJupyterDesignSystem().register(jpTreeView());
      console.log('`jpTreeView` was registered!');
      addJupyterLabThemeChangeListener();
    }
    this.treeView = document.createElement('jp-tree-view');
    this.treeView.setAttribute('name', 'jfss-treeView');
    resultArea.appendChild(this.treeView);

    // Add job queue bottom panel
    this.jobQueueContainer = document.createElement('div');
    this.jobQueueContainer.classList.add('jfss-job-queue-container');
    // ....
    this.jobQueueControls = document.createElement('div');
    this.jobQueueControls.classList.add('jfss-job-queue-controls');
    this.jobQueueContainer.appendChild(this.jobQueueControls);
    // ....
    this.jobQueueExpander = document.createElement('div');
    this.jobQueueExpander.classList.add('jfss-job-queue-expander');
    this.jobQueueExpander.innerText = '\u{25B6}';
    this.jobQueueExpander.addEventListener(
      'click',
      this.handleJobQueueExpanderClick.bind(this)
    );
    this.jobQueueControls.appendChild(this.jobQueueExpander);
    // ....
    const controlLabel = document.createElement('div');
    controlLabel.classList.add('jfss-job-queue-label');
    controlLabel.innerText = 'Success: file:///Users/spam/eggs.txt';
    this.jobQueueControls.appendChild(controlLabel);
    // ....
    this.jobQueue = document.createElement('div');
    this.jobQueue.classList.add('jfss-job-queue');
    this.jobQueueContainer.appendChild(this.jobQueue);
    lowerArea.appendChild(this.jobQueueContainer);
    // ....
    for (let i = 0; i < 3; i++) {
      const exampleJobItem = document.createElement('div');
      exampleJobItem.classList.add('jfss-job-queue-item');
      const statusIndicator = document.createElement('div');
      statusIndicator.classList.add('jfss-job-item-status');
      statusIndicator.innerText = '\u{00D7}';
      exampleJobItem.appendChild(statusIndicator);
      const jobItemLabel = document.createElement('span');
      jobItemLabel.classList.add('jfss-job-item-label');
      exampleJobItem.appendChild(jobItemLabel);
      if (i === 0) {
        jobItemLabel.innerText = '\u{2B61}OK: file:///Users/spam/eggs.txt';
        statusIndicator.style.backgroundColor = '#34cf00';
      } else if (i === 1) {
        jobItemLabel.innerText = '\u{2B63}FAIL: file:///Users/wik/rak.txt';
        statusIndicator.style.backgroundColor = 'red';
      } else if (i === 2) {
        jobItemLabel.innerText = '\u{2B61}OK: file:///etc/fstab';
        statusIndicator.style.backgroundColor = '#34cf00';
      }
      this.jobQueue.appendChild(exampleJobItem);
    }

    primaryDivider.appendChild(this.upperArea);
    primaryDivider.appendChild(hsep);
    primaryDivider.appendChild(lowerArea);

    this.node.appendChild(primaryDivider);
    this.populateFilesystems();
  }

  // handleMainWidgetChanged() {
  //   // Change the target notebook when the user switches widgets in the application
  //   const currentWidget = this.getCurrentWidget();
  //   if (currentWidget instanceof DocumentWidget) {
  //     // TODO: !!!!!!!! Fix/make more specific, for notebooks
  //     // Notebooks are the only valid target
  //     // this.currentTargetLbl.innerText =
  //     //   'Current Notebook: ' + currentWidget.title.label;
  //     this.currentTarget = currentWidget;
  //   } else {
  //     // Set target to nothing if it's not valid
  //     // this.currentTargetLbl.innerText = 'Current Notebook: <None>';
  //     this.currentTarget = null;
  //   }
  // }

  handleJobQueueExpanderClick() {
    if (this.jobQueueContainer.style.height === '17.75rem') {
      this.jobQueueContainer.style.height = '1.75rem';
      this.jobQueueExpander.innerText = '\u{25B6}';
    } else {
      this.jobQueueContainer.style.height = '17.75rem';
      this.jobQueueExpander.innerText = '\u{25BC}';
    }
  }

  // navigateToPath(userPath:  string) {
  //   // TODO subdirs need to be lazy loaded individually to avoid inaccurate/unpopulated subdir contents in browser view
  //   this.logger.debug(`Navigate to path ${userPath}`);
  //   // let currentNode = this.dirTree;
  //   for (const segment of userPath
  //     .split('/')
  //     .filter((c: any) => c.length > 0)) {
  //       this.logger.debug(`  segment: ${segment}`);
  //   }

  //   this.lazyLoad(userPath);
  //   let node = this.getNodeForPath(userPath);
  //   this.logger.debug(`Nav to: ${node}`);
  //   return node;
  // }

  async promptForFilename() {
    const bodyWidget = new FssFileUploadContextPopup();
    this.uploadDialog = new Dialog({
      body: bodyWidget,
      title: 'Upload file'
    });
    const result = await this.uploadDialog.launch();
    if (result?.value) {
      return result;
    }
    return null;
    this.logger.debug(`Popup path ${result?.value}`);
    // TODO cancel when no path provided, IF user specified upload to folder
  }

  async getKernelUserBytesTempfilePath() {
    const target = this.notebookTracker.currentWidget;

    if (!target || target.isDisposed) {
      this.logger.error('Invalid target widget');
      return null;
    }

    if (target?.context?.sessionContext?.session) {
      const kernel = target.context.sessionContext.session.kernel;
      if (!kernel) {
        this.logger.error('Error fetching kernel from active widget!');
        return null;
      }
      this.logger.debug('Kernel: ' + kernel);
      // this.logger.debug(
      //   `this.savedSnapshotPathField.value is : ${this.savedSnapshotPathField.value}`
      // );
      const userCode = CODE_UPLOADUSERDATA;
      this.logger.debug(userCode);
      const shellFuture = kernel.requestExecute({
        code: 'from jupyter_fsspec import helper as _jupyter_fsshelper',
        user_expressions: {
          jfss_data: '_jupyter_fsshelper._get_user_data_tempfile_path()'
        }
      });
      try {
        const reply: any = await shellFuture.done;
        this.logger.debug(`DEBUGx1 ${JSON.stringify(reply.content)}`);
        let tempfilePath =
          reply.content.user_expressions.jfss_data.data['text/plain'];
        this.logger.debug(`AA1 ${tempfilePath}`);
        // Strip out the quotes
        tempfilePath = tempfilePath.replace(
          /[\x27\x22]/g, // replace single/double quote chars, add the g flag for replace-all
          (match: any, p1: any, p2: any, p3: any, offset: any, string: any) => {
            return ''; // Removes matching chars
          }
        );
        this.logger.debug(`AA2 "${tempfilePath}"`);
        if (!tempfilePath) {
          // TODO yuck
          this.logger.error('Error obtaining tempfile path!');
          return null;
        }
        return tempfilePath;
      } catch (e) {
        this.logger.debug(`${e}\nError on kernel execution, read more above.`);
        return null;
      }
      // kernel
      //   .requestExecute({
      //     code: 'from jupyter_fsspec import helper as _jupyter_fsshelper',
      //     user_expressions: {
      //       jfss_data: '_jupyter_fsshelper._get_user_data_tempfile_path()'
      //     }
      //   })
      //   .done.then((message: any) => {
      //     this.logger.debug(message);

      //     // Grab the value (this is the python repr() of our user expression
      //     // according to the jupyter messaging protocol, it will have quotes)
      //     let tempfilePath = '';
      //     const message_content =
      //       message?.content?.user_expressions?.jfss_data.data;
      //     if (message_content) {
      //       tempfilePath = message_content['text/plain'];
      //       this.logger.debug(`Tempfile path is ${tempfilePath}`);
      //     } else {
      //       this.logger.error('Error uploading data');
      //       return;
      //     }
      //     if (!tempfilePath) {
      //       this.logger.error('Error ');
      //       return;
      //     }

      //     // Strip out the quotes
      //     tempfilePath = tempfilePath.replace(
      //       /[\x27\x22]/g, // replace single/double quote chars, add the g flag for replace-all
      //       (
      //         match: any,
      //         p1: any,
      //         p2: any,
      //         p3: any,
      //         offset: any,
      //         string: any
      //       ) => {
      //         return ''; // Removes matching chars
      //       }
      //     );
      //     if (!tempfilePath) {  // TODO yuck
      //       this.logger.error('Error ');
      //       return null;
      //     }

      //     return tempfilePath;
      //   })
      //   // temp1.content.user_expressions.jfss_data.data
      //   .catch(() => {
      //     this.logger.error('Error loading on kernel');
      //   });
    }
    return null;
  }

  // handleContextUploadFilePicker(user_path: string, is_dir: boolean, is_browser_file_picker: boolean) {
  //   this.queuedPickerUploadInfo = {
  //     user_path: user_path,
  //     is_dir: is_dir,
  //     is_browser_file_picker: is_browser_file_picker,
  //   }
  //   this.openInputHidden.click();
  // }

  async handleJupyterFileBrowserSetBytesTarget(
    userFile: any,
    fileBrowser: any
  ) {
    // this.logger.debug(
    //   `FBrowser choose: B ${fileBrowser}} / D "${fileBrowser.model.driveName}" / R "${fileBrowser.model.rootPath}"`
    // );
    // this.logger.debug(`  pth    ${userFile.value.path}`);
    // this.logger.debug(`  srvpth ${userFile.value.serverPath}`);
    // this.logger.debug(`  sz     ${userFile.value.size}`);
    // this.logger.debug(`  type   ${userFile.value.type}`);
    // this.logger.debug(`  mtype  ${userFile.value.mimetype}`);
    // this.logger.debug(`  fmt    ${userFile.value.format}`);
    // this.logger.debug(`  wrt    ${userFile.value.writable}`);

    const fileData = await this.app.serviceManager.contents.get(
      userFile.value.path,
      { content: true, format: 'base64', type: 'base64' }
    );
    // this.logger.debug(`xFILE CONTs:\n${JSON.stringify(fileData)}`);
    this.queuedJupyterFileBrowserUploadInfo = { fileData: fileData };
  }

  handleFilePickerChange() {
    let fileData: any = null;
    if (!this.openInputHidden.value) {
      this.queuedPickerUploadInfo = null;
      return;
    }

    if (this.openInputHidden.files.length > 0) {
      fileData = this.openInputHidden.files[0];
      this.queuedPickerUploadInfo['fileData'] = fileData;
      this.logger.debug(`FData ${fileData}`);
      this.handleBrowserPickerUpload(
        this.queuedPickerUploadInfo.user_path,
        this.queuedPickerUploadInfo.is_dir,
        this.queuedPickerUploadInfo.is_browser_file_picker,
        false
      );
      this.queuedPickerUploadInfo = null;
      this.openInputHidden.value = null;
    } else {
      console.log('[FSSpec] No file selected!');
      this.queuedPickerUploadInfo = null;
      this.openInputHidden.value = null;
      return;
    }
  }

  async handleJupyterFileBrowserUpload(user_path: string, is_dir: boolean) {
    this.logger.debug('BB a1');

    // Get the desired path for this upload from a dialog box
    this.logger.debug(`Upath ${user_path}`);
    if (is_dir) {
      // TODO make dialog box and grab filename when uploading to folder
      const result: any = await this.promptForFilename();
      this.logger.debug(`Resultvalue ${result?.value}`);
      if (result?.value) {
        user_path += '/' + result.value;
      } else {
        this.logger.error('Error, no filename provided!');
        return;
      }
      this.logger.debug(`Popup path ${result?.value}`);
    }
    this.logger.debug(`Upath2 ${user_path}`);

    if (this.queuedJupyterFileBrowserUploadInfo) {
      // We have file information from the Lab file browser
      this.logger.debug('Jup file browser result get!');
      this.logger.debug(
        `Dump jbrowser info ${JSON.stringify(this.queuedJupyterFileBrowserUploadInfo)}`
      );
      const base64String =
        this.queuedJupyterFileBrowserUploadInfo.fileData.content;
      this.logger.debug(`B64 content str:\n${base64String}`);

      // TODO error handling and data checks
      await this.model.post(
        this.model.activeFilesystem,
        user_path,
        base64String,
        true
      );
      this.logger.debug('Finish upload');

      this.fetchAndDisplayFileInfo(this.model.activeFilesystem);

      return;
    } else {
      this.logger.error('Error, no Jupyter file browser data available!');
      return;
    }
  }

  async handleBrowserPickerUpload(
    user_path: string,
    is_dir: boolean,
    is_browser_file_picker: boolean,
    is_jup_browser_file: boolean
  ) {
    this.logger.debug('BB a2');

    // Get the desired path for this upload from a dialog box
    this.logger.debug(`Upath ${user_path}`);
    if (is_dir) {
      // TODO make dialog box and grab filename when uploading to folder
      const result: any = await this.promptForFilename();
      this.logger.debug(`Resultvalue ${result?.value}`);
      if (result?.value) {
        user_path += '/' + result.value;
      } else {
        this.logger.error('Error, no filename provided!');
        return;
      }
      this.logger.debug(`Popup path ${result?.value}`);
    }
    this.logger.debug(`Upath2 ${user_path}`);

    // Get the path of the file to upload
    if (!this.queuedPickerUploadInfo) {
      // First we have to obtain info from the browser file picker (async user selection)
      this.queuedPickerUploadInfo = {
        user_path: user_path,
        is_dir: is_dir,
        is_browser_file_picker: is_browser_file_picker,
        fileData: null
      };
      this.openInputHidden.click();
      this.logger.debug('WAIT FOR FILE PICKER');
      return;
    } else if (this.queuedPickerUploadInfo) {
      // We have obtained file info from the user's selection (our call above)
      this.logger.debug('File Result get!');
      this.logger.debug(
        `Dump picker info ${JSON.stringify(this.queuedPickerUploadInfo)}`
      );
      // this.logger.debug(`File ${this.queuedPickerUploadInfo.fileData.name}`);
      // this.logger.debug(
      //   `File ${this.queuedPickerUploadInfo.fileData.webkitRelativePath}`
      // );

      const binRaw = await this.queuedPickerUploadInfo.fileData.arrayBuffer();
      const binData: any = new Uint8Array(binRaw);
      const base64String = Buffer.from(binData).toString('base64');

      await this.model.post(
        this.model.activeFilesystem,
        user_path,
        base64String,
        true
      );
      this.logger.debug('Finish upload');

      this.fetchAndDisplayFileInfo(this.model.activeFilesystem);

      return;
    } else {
      this.logger.error('Error, no browser file data available!');
      return;
    }
  }

  async handleKernelHelperUpload(
    user_path: string,
    is_dir: boolean,
    is_browser_file_picker: boolean,
    is_jup_browser_file: boolean
  ) {
    this.logger.debug('BB a3');
    const target = this.notebookTracker.currentWidget;

    if (!is_browser_file_picker && !is_jup_browser_file) {
      // Only check for current notebook when uploading from user kernel
      // TODO cleanup this horrendous mess and pull these apart into discrete units
      if (!target || target.isDisposed) {
        this.logger.error('Invalid target widget');
        return;
      }
    }

    // this.logger.debug('FileBrowser items!!');
    // for (const item of this.fileBrowser.items()) {
    //   this.logger.debug(`${item}`);
    // }

    // Get the desired path for this upload from a dialog box
    this.logger.debug(`Upath ${user_path}`);
    if (is_dir) {
      // TODO make dialog box and grab filename when uploading to folder
      const result: any = await this.promptForFilename();
      this.logger.debug(`Resultvalue ${result?.value}`);
      if (result?.value) {
        user_path += '/' + result.value;
      } else {
        this.logger.error('Error, no filename provided!');
        return;
      }
      this.logger.debug(`Popup path ${result?.value}`);
    }
    this.logger.debug(`Upath2 ${user_path}`);

    // Get the path of the file to upload
    let tempfilePath: any = '';
    // We are obtaining bytes from the user's kernel, get a
    // serialized tempfile path from the server
    tempfilePath = await this.getKernelUserBytesTempfilePath();
    this.logger.debug(`Debugx2: ${tempfilePath}`);
    if (!tempfilePath) {
      this.logger.error('Error fetching serialized user_data!');
      return;
    }

    // TODO error handling
    this.model.upload(
      this.model.activeFilesystem,
      tempfilePath,
      user_path,
      'upload'
    );
    // let foo = this.navigateToPath(user_path);
    // this.logger.debug(`Finish upload to ${foo}`);
    this.fetchAndDisplayFileInfo(this.model.activeFilesystem);
  }

  handleContextGetBytes(user_path: string) {
    const target = this.notebookTracker.currentWidget;

    if (!target || target.isDisposed) {
      this.logger.debug('Invalid target widget');
      return;
    }

    this.logger.debug('INDEX handle context get bytes');

    // console.log('Session: ' + target.context.sessionContext.session);
    if (target?.context?.sessionContext?.session) {
      const kernel = target.context.sessionContext.session.kernel;
      if (!kernel) {
        this.logger.error('Error fetching kernel from active widget!');
        return;
      }
      this.logger.debug('Kernel: ' + kernel);
      // this.logger.debug(
      //   `this.savedSnapshotPathField.value is : ${this.savedSnapshotPathField.value}`
      // );
      let getBytesCode = CODE_GETBYTES.replace(
        'FS_NAME',
        (match, p1, p2, p3, offset, string) => {
          return this.model.activeFilesystem;
        }
      );
      getBytesCode = getBytesCode.replace(
        'FILEPATH',
        (match, p1, p2, p3, offset, string) => {
          return user_path;
        }
      );
      this.logger.debug(getBytesCode);
      kernel
        .requestExecute({
          code: getBytesCode,
          user_expressions: {
            jfss_data: 'repr(_jupyter_fsshelper.out)'
          }
        })
        .done.then((message: any) => {
          this.logger.error(message);
        })
        .catch(() => {
          this.logger.error('Error loading on kernel');
        });
    }
  }

  async fetchConfig() {
    this.selectedFsLabel.innerText = '<Select a filesystem>';
    await this.model.refreshConfig();
    this.logger.debug(
      `[FSSpec] Refresh config:\n${JSON.stringify(this.model.userFilesystems)}`
    );
    this.populateFilesystems();
  }

  populateFilesystems() {
    this.logger.debug(
      `[FSSpec] Populate filesystems: \n${JSON.stringify(this.model.userFilesystems)}`
    );

    this.sourcesHeap = {};
    this.filesysContainer.replaceChildren();
    this.treeView.replaceChildren();
    this.elementHeap = {};
    if (Object.keys(this.model.userFilesystems).length === 0) {
      this.emptySourcesHint.style.display = 'block';
    } else {
      this.emptySourcesHint.style.display = 'none';
      for (const key of Object.keys(this.model.userFilesystems)) {
        const fsInfo = this.model.userFilesystems[key];
        this.addFilesystemItem(fsInfo);
      }
    }
  }

  addFilesystemItem(fsInfo: any) {
    const fsItem = new FssFilesysItem(
      this.model,
      fsInfo,
      [this.handleFilesystemClicked.bind(this)],
      this.notebookTracker
    );
    this.sourcesHeap[fsInfo.name] = fsItem;
    fsItem.setMetadata(fsInfo.path);
    this.filesysContainer.appendChild(fsItem.root);
  }

  async handleFilesystemClicked(fsInfo: any) {
    for (const fsElem of this.filesysContainer.children) {
      // Set clicked FS to selected state (+colorize), deselect others
      if (!(fsElem.dataset.fssname in this.sourcesHeap)) {
        // This should never happen
        this.logger.error('Error selecting filesystem');
        break;
      }

      const wrapper = this.sourcesHeap[fsElem.dataset.fssname];

      if (fsElem.dataset.fssname === fsInfo.name) {
        wrapper.selected = true;
      } else {
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
    const relPathFromFsRoot = path.relative(
      this.model.getActiveFilesystemInfo().path,
      source_path
    );

    // Traverse nodes using the source path's segments
    let currentNode = this.dirTree;
    for (const segment of relPathFromFsRoot
      .split('/')
      .filter((c: any) => c.length > 0)) {
      if (segment in currentNode['children']) {
        currentNode = currentNode['children'][segment];
      } else {
        break;
      }
    }

    // Check if the desired node was found, set result if so
    if (currentNode.metadata.name === source_path) {
      nodeForPath = currentNode;
    }

    return nodeForPath;
  }

  async lazyLoad(source_path: string) {
    // Fetch files for a given folder and update the dir tree with the results
    this.logger.info(`Calling lazy load for ${source_path}`);
    const response = await this.model.listDirectory(
      this.model.userFilesystems[this.model.activeFilesystem].key,
      source_path
    );
    if (response?.status !== 'success' || !response?.content) {
      // TODO refactor validation
      this.logger.error(`Error fetching files for path ${source_path}`); // TODO jupyter info print
      return;
    }
    this.logger.debug(`Response: (${JSON.stringify(response)})`);

    // Get the dir tree node for this path (updates go into this subtree)
    const nodeForPath = this.getNodeForPath(source_path);
    // this.logger.debug(`Found node: ${JSON.stringify(nodeForPath)}`);
    if (!nodeForPath) {
      this.logger.error(`Error: Bad path for ${source_path}`);
      return;
    }
    if (!nodeForPath.fetch) {
      // Only fetch if this hasn't been fetched before
      // Update the dir tree/data
      this.updateTree(nodeForPath, response['content'], source_path);
      nodeForPath.fetch = true;
      // this.logger.debug(`After fetch: ${JSON.stringify(nodeForPath)}`);
    } else {
      // Already fetched this child path, ignore and return
      this.logger.info(
        'Skipping lazy load, already fetched for ${source_path}'
      );
      return;
    }

    // Update the TreeView in the UI
    await this.updateFileBrowserView(nodeForPath);
    if (nodeForPath.id.toString() in this.elementHeap) {
      const uiElement = this.elementHeap[nodeForPath.id.toString()];
      uiElement.expandItem();
      // this.logger.debug(`[FSSpec] StartNode children after lazy load:\n\n${uiElement.root.innerHTML}`);
    }
  }

  getElementForNode(ident: any) {
    return this.elementHeap[ident.toString()];
  }

  async updateFileBrowserView(startNode: any = null) {
    // Update/sync the tree view with the file data for this filesys
    this.logger.info('Updating file browser view');
    let dirTree: any = this.dirTree;
    let buildTargets: any = { '/': [this.treeView, dirTree.children] };

    // Set up either a partial update (from a given start node), or
    // a complete tear down and repopulate from scratch (for new data)
    if (startNode) {
      dirTree = startNode;
      const startPath = startNode.path;
      buildTargets = {};
      buildTargets[startPath] = [
        this.getElementForNode(startNode.id),
        startNode.children
      ];
    } else {
      this.treeView.replaceChildren();
    }

    // Traverse iteratively
    while (Object.keys(buildTargets).length > 0) {
      // Start with root, add children
      const deleteQueue: any = [];
      for (const absPath of Object.keys(buildTargets)) {
        const elemParent = buildTargets[absPath][0];
        const childPaths = buildTargets[absPath][1];

        if (!childPaths) {
          // TODO: Create a placeholder child item for this dir
        }
        for (const [pathSegment, pathInfo] of Object.entries(childPaths)) {
          const item = new FssTreeItem(
            this.model,
            [this.lazyLoad.bind(this)],
            [this.handleContextGetBytes.bind(this)],
            [this.handleKernelHelperUpload.bind(this)],
            [this.handleBrowserPickerUpload.bind(this)],
            [this.handleJupyterFileBrowserUpload.bind(this)],
            true,
            true,
            this.notebookTracker
          );
          item.setMetadata(
            (pathInfo as any).path,
            (pathInfo as any).metadata.size
          );
          item.setText(pathSegment);
          // (pathInfo as any).ui = item;
          elemParent.appendChild(item.root);

          // Store ID and element in the element heap
          const item_id = UniqueId.get_id();
          (pathInfo as any).id = item_id;
          this.elementHeap[item_id.toString()] = item;

          if (
            Object.keys((pathInfo as any).children).length > 0 ||
            ('type' in (pathInfo as any).metadata &&
              (pathInfo as any).metadata.type === 'directory')
          ) {
            item.setType('dir');
          } else {
            item.setType('file');
          }

          if (Object.keys((pathInfo as any).children).length > 0) {
            buildTargets[(pathInfo as any).path] = [
              item,
              (pathInfo as any).children
            ];
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
    const response = await this.model.listDirectory(
      this.model.userFilesystems[this.model.activeFilesystem].key
    );
    if (!response) {
      this.logger.error(
        'Error fetching files for filesystem: response is null'
      );
      return;
    }

    if (
      !('status' in response) ||
      !(response.status === 'success') ||
      !('content' in response)
    ) {
      // TODO refactor validation
      this.logger.error(`Error fetching files for filesystem ${fsname}`); // TODO jupyter info print
      return;
    }
    const pathInfos = response['content'].sort((a: any, b: any) => {
      return a.name.localeCompare(b.name);
    });

    // Update current filesystem display labels
    this.selectedFsLabel.innerText = `${fsname}`;

    // Build a directory tree and update the display
    this.dirTree = this.buildTree(
      pathInfos,
      this.model.userFilesystems[fsname].path
    );
    this.updateFileBrowserView();
  }

  updateTree(tree: any, pathInfoList: any, rootPath: string) {
    // Update a given tree or subtree by building/populating
    // a nested tree structure based on the provided pathInfos
    const dirTree = tree;
    for (const pdata of pathInfoList) {
      const name = path.relative(rootPath, pdata.name);

      // TODO: path sep normalization
      // Go segment by segment, building the nested path tree
      const segments = name.split('/').filter((c: any) => c.length > 0);
      let parentLocation: any = dirTree['children'];
      for (let i = 0; i < segments.length; i++) {
        // Get path components and a key for this subpath
        const subpath = [];
        for (let j = 0; j <= i; j++) {
          subpath.push(segments[j]);
        }

        const segment: any = segments[i];
        if (segment in parentLocation) {
          parentLocation = parentLocation[segment]['children'];
        } else {
          const children = {};
          let metadata = {};
          if (i === Math.max(0, segments.length - 1)) {
            metadata = pdata;
          }
          parentLocation[segment] = {
            path: pdata.name,
            children: children,
            metadata: metadata,
            fetch: false,
            id: null
          };
          parentLocation = parentLocation[segment]['children'];
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
    const dirTree = {
      path: '/',
      children: {},
      fetch: true,
      metadata: { path: rootPath },
      id: null
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
  requires: [ICommandPalette, INotebookTracker, IFileBrowserFactory],
  optional: [ISettingRegistry],
  activate: async (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    notebookTracker: INotebookTracker,
    fileBrowserFactory: IFileBrowserFactory,
    settingRegistry: ISettingRegistry | null
  ) => {
    const logger = Logger.getLogger('JupyterFsspec');

    logger.info('JupyterLab extension jupyterFsspec is activated!');

    if (app['namespace'] !== 'Jupyter Notebook') {
      // Auto initialize the model
      const fsspecModel = new FsspecModel();
      await fsspecModel.initialize();

      logger.debug(`Activate, fbrowser is ${Object.keys(fileBrowserFactory)}`);
      console.log('########');
      console.log(fileBrowserFactory);
      console.log('########');

      // Use the model to initialize the widget and add to the UI
      const fsspec_widget = new FsspecWidget(
        fsspecModel,
        notebookTracker,
        app,
        fileBrowserFactory
      );
      fsspec_widget.id = 'jupyterFsspec:widget';

      // TODO verify filebrowserfactory and currentWidget are valid, file object is truthy etc.
      // Add Jupyter File Browser help
      app.commands.addCommand('jupyter_fsspec:filebrowser-context-upload', {
        label: 'Select as Upload Source for FSSpec',
        caption:
          'Handles upload requests to configured fsspec filesystems from the FileBrowser',
        execute: async () => {
          const fileModel: any = fileBrowserFactory.tracker.currentWidget
            ?.selectedItems()
            .next();
          const file = fileModel.value;

          if (file) {
            await fsspec_widget.handleJupyterFileBrowserSetBytesTarget(
              fileModel,
              fileBrowserFactory.tracker?.currentWidget
            );
          }
        }
      });

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
          const fsspec_widget = new FsspecWidget(
            fsspecModel,
            notebookTracker,
            app,
            fileBrowserFactory
          );
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
    //       this.logger.info(`[FSSpec] Settings loaded: ${settings.composite}`);
    //     })
    //     .catch(reason => {
    //       this.logger.error(`[FSSpec] Failed to load settings for jupyterFsspec: ${reason}`);
    //     });
    // }
  }
};

export default plugin;
