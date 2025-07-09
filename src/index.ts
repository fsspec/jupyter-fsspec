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

import { Logger, LogConfig } from './logger';
import { initializeLogger } from './loggerSettings';

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
from jupyter_fsspec import helper as
try:
  _jupyter_fsshelper._get_user_data_string('FS_NAME', 'FILEPATH')
except:
  raise
`;

class FsspecWidget extends Widget {
  upperArea: HTMLElement;
  model: FsspecModel;
  lowerAreaHeader: HTMLElement;
  selectedFsLabel: HTMLElement;
  refreshFileList: HTMLElement;
  treeView: any;
  elementHeap: any = {}; // Holds FssTreeItem's keyed by path
  sourcesHeap: any = {}; // Holds FssFilesysItem's keyed by name
  emptySourcesHint: HTMLElement;
  filesysContainer: HTMLElement;
  openInputHidden: HTMLInputElement;
  dirTree: any = {};
  currentTarget: any = null;
  notebookTracker: INotebookTracker;
  uploadDialog: Dialog<null> | null = null;
  jobQueueControls: HTMLElement;
  jobQueue: HTMLElement;
  jobQueueContainer: HTMLElement;
  jobQueueExpander: HTMLElement;
  queuedPickerUploadInfo: any;
  queuedJupyterFileBrowserUploadInfo: any;
  fileBrowserFactory: any;
  app: any;
  private readonly logger: Logger;

  constructor(
    model: any,
    notebookTracker: INotebookTracker,
    app: any,
    fileBrowserFactory: any
  ) {
    super();

    this.logger = Logger.getLogger('FsspecWidget');

    this.logger.debug('Initializing widget', {
      serviceManager: app.serviceManager !== undefined
    });

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
    this.lowerAreaHeader = document.createElement('div');
    this.lowerAreaHeader.classList.add('jfss-lowerAreaHeader');
    lowerArea.appendChild(this.lowerAreaHeader);

    this.selectedFsLabel = document.createElement('div');
    this.selectedFsLabel.classList.add('jfss-selectedFsLabel');
    this.selectedFsLabel.innerText = '<Select a filesystem>';
    this.lowerAreaHeader.appendChild(this.selectedFsLabel);

    const spacer = document.createElement('div');
    spacer.style.flexGrow = '10';
    spacer.style.width = '1.5rem';
    spacer.style.height = '1.5rem';
    this.lowerAreaHeader.appendChild(spacer);

    this.refreshFileList = document.createElement('div');
    this.refreshFileList.classList.add('jfss-refreshFileList');
    this.refreshFileList.innerText = '\u{21bb}';
    this.refreshFileList.title = 'Refresh current filesystem contents';
    this.refreshFileList.addEventListener('click', () => {
      this.handleRefreshFilesystem();
    });

    this.lowerAreaHeader.appendChild(this.refreshFileList);

    const resultArea = document.createElement('div');
    resultArea.classList.add('jfss-resultarea');
    lowerArea.appendChild(resultArea);

    // We use the tagName `jp-tree-view` for Notebook 7 compatibility
    if (!customElements.get('jp-tree-view')) {
      provideJupyterDesignSystem().register(jpTreeView());
      this.logger.info('jpTreeView web component registered');
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

    this.logger.debug('Widget initialization complete');
  }

  handleJobQueueExpanderClick() {
    const currentHeight = this.jobQueueContainer.style.height;
    let newHeight: string;
    let expanderSymbol: string;

    if (currentHeight === '17.75rem') {
      newHeight = '1.75rem';
      expanderSymbol = '\u{25B6}';
    } else {
      newHeight = '17.75rem';
      expanderSymbol = '\u{25BC}';
    }

    this.logger.debug('Job queue panel toggled', {
      previousHeight: currentHeight,
      newHeight: newHeight,
      expanded: newHeight === '17.75rem'
    });

    this.jobQueueContainer.style.height = newHeight;
    this.jobQueueExpander.innerText = expanderSymbol;
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
    this.logger.debug('Prompting for filename');

    const bodyWidget = new FssFileUploadContextPopup();
    this.uploadDialog = new Dialog({
      body: bodyWidget,
      title: 'Upload file'
    });

    const result = await this.uploadDialog.launch();

    if (result?.value) {
      this.logger.debug('Filename provided', { filename: result.value });
      return result;
    }

    this.logger.debug('Filename prompt cancelled');
    return null;
  }

  async getKernelUserBytesTempfilePath() {
    const target = this.notebookTracker.currentWidget;

    if (!target || target.isDisposed) {
      this.logger.error('Invalid target widget', {
        exists: !!target,
        isDisposed: target?.isDisposed
      });
      return null;
    }

    if (target?.context?.sessionContext?.session) {
      const kernel = target.context.sessionContext.session.kernel;
      if (!kernel) {
        this.logger.error('Error fetching kernel from active widget', {
          hasContext: !!target.context,
          hasSessionContext: !!target?.context?.sessionContext,
          hasSession: !!target?.context?.sessionContext?.session
        });
        return null;
      }

      this.logger.debug('Using kernel for bytes tempfile path', {
        kernelId: kernel.id,
        kernelName: kernel.name
      });

      const userCode = CODE_UPLOADUSERDATA;
      this.logger.debug('Executing kernel code', { code: userCode });

      const shellFuture = kernel.requestExecute({
        code: 'from jupyter_fsspec import helper as _jupyter_fsshelper',
        user_expressions: {
          jfss_data: '_jupyter_fsshelper._get_user_data_tempfile_path()'
        }
      });

      try {
        const reply: any = await shellFuture.done;
        this.logger.debug('Kernel execution reply received', {
          status: reply.content.status,
          hasUserExpressions: !!reply.content.user_expressions
        });

        let tempfilePath =
          reply.content.user_expressions.jfss_data.data['text/plain'];

        // Strip out the quotes
        tempfilePath = tempfilePath.replace(
          /[\x27\x22]/g, // replace single/double quote chars, add the g flag for replace-all
          (match: any, p1: any, p2: any, p3: any, offset: any, string: any) => {
            return ''; // Removes matching chars
          }
        );

        this.logger.debug('Obtained tempfile path', { path: tempfilePath });

        if (!tempfilePath) {
          this.logger.error('Empty tempfile path returned');
          return null;
        }

        return tempfilePath;
      } catch (e) {
        this.logger.error('Error during kernel execution', { error: e });
        return null;
      }
    }

    this.logger.warn('No active kernel session available');
    return null;
  }

  async handleJupyterFileBrowserSetBytesTarget(
    userFile: any,
    fileBrowser: any
  ) {
    this.logger.debug('Setting bytes target from JupyterLab file browser', {
      path: userFile.value.path,
      size: userFile.value.size,
      type: userFile.value.type,
      mimeType: userFile.value.mimetype
    });

    const fileData = await this.app.serviceManager.contents.get(
      userFile.value.path,
      { content: true, format: 'base64', type: 'base64' }
    );

    this.logger.debug('File content retrieved', {
      format: fileData.format,
      contentSize: fileData?.content?.length
    });

    this.queuedJupyterFileBrowserUploadInfo = {
      fileData: Buffer.from(fileData.content, 'base64')
    };
  }

  handleFilePickerChange() {
    if (!this.openInputHidden.value || this.openInputHidden.files === null) {
      this.logger.debug('File picker cancelled or no file selected');
      this.queuedPickerUploadInfo = null;
      return;
    }

    if (this.openInputHidden.files.length > 0) {
      const fileData = this.openInputHidden.files[0];
      this.queuedPickerUploadInfo['fileData'] = fileData;

      this.logger.debug('File selected from browser picker', {
        fileName: fileData.name,
        fileSize: fileData.size,
        fileType: fileData.type
      });

      this.handleBrowserPickerUpload(
        this.queuedPickerUploadInfo.user_path,
        this.queuedPickerUploadInfo.is_dir
      );

      this.queuedPickerUploadInfo = null;
      this.openInputHidden.value = '';
    } else {
      this.logger.warn('No file selected from browser picker');
      this.queuedPickerUploadInfo = null;
      this.openInputHidden.value = '';
      return;
    }
  }

  async handleJupyterFileBrowserUpload(user_path: string, is_dir: boolean) {
    this.logger.debug('Handling upload from Jupyter file browser', {
      path: user_path,
      isDirectory: is_dir
    });

    // Get the desired path for this upload from a dialog box
    if (is_dir) {
      // Get filename when uploading to folder
      const result: any = await this.promptForFilename();

      if (result?.value) {
        user_path += '/' + result.value;
        this.logger.debug('Using path with filename', { path: user_path });
      } else {
        this.logger.error('Upload cancelled: no filename provided');
        return;
      }
    }

    if (this.queuedJupyterFileBrowserUploadInfo) {
      // We have file information from the Lab file browser
      this.logger.debug('Processing Jupyter file browser upload', {
        contentFormat: this.queuedJupyterFileBrowserUploadInfo.fileData.format,
        contentSize:
          this.queuedJupyterFileBrowserUploadInfo.fileData?.content?.length
      });

      const binaryData = this.queuedJupyterFileBrowserUploadInfo.fileData;

      try {
        await this.model.post(
          this.model.activeFilesystem,
          user_path,
          binaryData
        );

        this.logger.info('File upload completed successfully', {
          path: user_path,
          filesystem: this.model.activeFilesystem
        });

        this.fetchAndDisplayFileInfo(this.model.activeFilesystem);
      } catch (error) {
        this.logger.error('Error uploading file', {
          path: user_path,
          error
        });
      }
    } else {
      this.logger.error(
        'Upload failed: No Jupyter file browser data available'
      );
    }
  }

  async handleBrowserPickerUpload(user_path: string, is_dir: boolean) {
    this.logger.debug('Handling upload from browser picker', {
      path: user_path,
      isDirectory: is_dir
    });

    // Get the desired path for this upload from a dialog box
    if (is_dir) {
      const result: any = await this.promptForFilename();

      if (result?.value) {
        user_path += '/' + result.value;
        this.logger.debug('Using path with filename', { path: user_path });
      } else {
        this.logger.error('Upload cancelled: no filename provided');
        return;
      }
    }

    // Get the path of the file to upload
    if (!this.queuedPickerUploadInfo) {
      // First we have to obtain info from the browser file picker (async user selection)
      this.queuedPickerUploadInfo = {
        user_path: user_path,
        is_dir: is_dir,
        is_browser_file_picker: true,
        fileData: null
      };

      this.logger.debug('Opening browser file picker', {
        targetPath: user_path
      });

      this.openInputHidden.click();
      return;
    } else if (this.queuedPickerUploadInfo) {
      // We have obtained file info from the user's selection (our call above)
      this.logger.debug('Processing selected file', {
        fileName: this.queuedPickerUploadInfo.fileData.name,
        fileSize: this.queuedPickerUploadInfo.fileData.size,
        fileType: this.queuedPickerUploadInfo.fileData.type
      });

      try {
        const binRaw = await this.queuedPickerUploadInfo.fileData.arrayBuffer();
        const binData: any = new Uint8Array(binRaw);

        await this.model.post(this.model.activeFilesystem, user_path, binData);

        this.logger.info('File upload completed successfully', {
          path: user_path,
          filesystem: this.model.activeFilesystem
        });

        this.fetchAndDisplayFileInfo(this.model.activeFilesystem);
      } catch (error) {
        this.logger.error('Error uploading file', {
          path: user_path,
          error
        });
      }
    } else {
      this.logger.error('Upload failed: No browser file data available');
    }
  }

  async handleKernelHelperUpload(user_path: string, is_dir: boolean) {
    this.logger.debug('Handling upload using kernel helper', {
      path: user_path,
      isDirectory: is_dir
    });
    const target = this.notebookTracker.currentWidget;
    if (!target || target.isDisposed) {
      this.logger.error('Upload failed: Invalid target widget', {
        exists: !!target,
        isDisposed: target?.isDisposed
      });
      return;
    }

    // Get the desired path for this upload from a dialog box
    if (is_dir) {
      // Get filename when uploading to folder
      const result: any = await this.promptForFilename();

      if (result?.value) {
        user_path += '/' + result.value;
        this.logger.debug('Using path with filename', { path: user_path });
      } else {
        this.logger.error('Upload cancelled: no filename provided');
        return;
      }
    }

    // Get the path of the file to upload from the kernel
    const tempfilePath = await this.getKernelUserBytesTempfilePath();
    if (!tempfilePath) {
      this.logger.error(
        'Upload failed: Could not get tempfile path from kernel'
      );
      return;
    }

    try {
      await this.model.upload(
        this.model.activeFilesystem,
        tempfilePath,
        user_path,
        'upload'
      );
    } catch (error) {
      this.logger.error('Error during kernel upload', {
        path: user_path,
        error
      });
    }

    await this.fetchAndDisplayFileInfo(this.model.activeFilesystem);
  }

  handleContextGetBytes(user_path: string) {
    const target = this.notebookTracker.currentWidget;

    if (!target || target.isDisposed) {
      this.logger.error('Get bytes failed: Invalid target widget', {
        exists: !!target,
        isDisposed: target?.isDisposed
      });
      return;
    }

    this.logger.debug('Handling get bytes request', { path: user_path });

    if (target?.context?.sessionContext?.session) {
      const kernel = target.context.sessionContext.session.kernel;
      if (!kernel) {
        this.logger.error('Get bytes failed: No kernel available', {
          hasContext: !!target.context,
          hasSessionContext: !!target?.context?.sessionContext,
          hasSession: !!target?.context?.sessionContext?.session
        });
        return;
      }

      this.logger.debug('Preparing kernel code for get bytes', {
        kernelId: kernel.id,
        kernelName: kernel.name,
        filesystem: this.model.activeFilesystem,
        path: user_path
      });

      // Replace template placeholders
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

      this.logger.debug('Executing get bytes code', { code: getBytesCode });

      kernel
        .requestExecute({
          code: getBytesCode,
          user_expressions: {
            jfss_data: 'repr(_jupyter_fsshelper.out)'
          }
        })
        .done.then((message: any) => {
          this.logger.debug('Get bytes execution complete', {
            status: message.content.status,
            hasUserExpressions: !!message.content.user_expressions
          });
        })
        .catch(error => {
          this.logger.error('Error executing get bytes code', { error });
        });
    } else {
      this.logger.error('Get bytes failed: No kernel session available');
    }
  }

  async fetchConfig() {
    this.logger.debug('Refreshing filesystems configuration');
    this.selectedFsLabel.innerText = '<Select a filesystem>';

    await this.model.refreshConfig();

    this.logger.debug('Configuration refreshed', {
      filesystemCount: Object.keys(this.model.userFilesystems).length
    });

    this.populateFilesystems();
  }

  populateFilesystems() {
    this.logger.debug('Populating filesystems', {
      count: Object.keys(this.model.userFilesystems).length
    });

    this.sourcesHeap = {};
    this.filesysContainer.replaceChildren();
    this.treeView.replaceChildren();
    this.elementHeap = {};

    if (Object.keys(this.model.userFilesystems).length === 0) {
      this.logger.warn('No filesystems configured');
      this.emptySourcesHint.style.display = 'block';
    } else {
      this.emptySourcesHint.style.display = 'none';

      for (const key of Object.keys(this.model.userFilesystems)) {
        const fsInfo = this.model.userFilesystems[key];
        this.addFilesystemItem(fsInfo);
      }

      this.logger.info('Filesystems populated', {
        count: Object.keys(this.model.userFilesystems).length
      });
    }
  }

  addFilesystemItem(fsInfo: any) {
    this.logger.debug('Adding filesystem item', {
      name: fsInfo.name,
      protocol: fsInfo.protocol,
      path: fsInfo.path
    });

    const fsItem = new FssFilesysItem(this.model, fsInfo, this.notebookTracker);
    fsItem.filesysClicked.connect(this.handleFilesystemClicked, this);

    this.sourcesHeap[fsInfo.name] = fsItem;
    fsItem.setMetadata(fsInfo.path);
    this.filesysContainer.appendChild(fsItem.root);
  }

  async handleFilesystemClicked(sender: any, fsInfo: any) {
    this.logger.debug('Filesystem clicked', {
      name: fsInfo.name,
      protocol: fsInfo.protocol,
      path: fsInfo.path
    });

    for (const child of this.filesysContainer.children) {
      const fsElem: any = child;
      // Set clicked FS to selected state (+colorize), deselect others
      if (!(fsElem.dataset.fssname in this.sourcesHeap)) {
        // This should never happen
        this.logger.error('Error selecting filesystem', {
          name: fsElem.dataset.fssname,
          availableFilesystems: Object.keys(this.sourcesHeap)
        });
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

  async handleRefreshFilesystem() {
    // Check if there's an active filesystem
    if (!this.model.activeFilesystem) {
      this.logger.warn('No active filesystem to refresh');
      return;
    }

    const fsInfo = this.model.userFilesystems[this.model.activeFilesystem];
    if (!fsInfo) {
      this.logger.error('Active filesystem not found in user filesystems', {
        activeFilesystem: this.model.activeFilesystem
      });
      return;
    }

    this.logger.debug('Refreshing filesystem', {
      name: fsInfo.name,
      protocol: fsInfo.protocol,
      path: fsInfo.path
    });

    await this.fetchAndDisplayFileInfo(fsInfo.name, true);
  }

  getNodeForPath(source_path: string) {
    // Traverse the dir tree and get the node for the supplied path
    this.logger.debug('Getting node for path', { path: source_path });

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

    this.logger.debug('Relative path from filesystem root', {
      relativePath: relPathFromFsRoot
    });

    // Traverse nodes using the source path's segments
    let currentNode = this.dirTree;
    for (const segment of relPathFromFsRoot
      .split('/')
      .filter((c: any) => c.length > 0)) {
      if (segment in currentNode['children']) {
        currentNode = currentNode['children'][segment];
      } else {
        this.logger.debug('Path segment not found in tree', { segment });
        break;
      }
    }

    // Check if the desired node was found, set result if so
    if (currentNode.metadata.name === source_path) {
      nodeForPath = currentNode;
      this.logger.debug('Node found for path', {
        found: true,
        nodeId: nodeForPath.id
      });
    } else {
      this.logger.debug('Node not found for path', {
        found: false,
        currentNodePath: currentNode.metadata.name
      });
    }

    return nodeForPath;
  }

  async lazyLoad(source_path: string) {
    // Fetch files for a given folder and update the dir tree with the results
    this.logger.info('Lazy loading directory contents', { path: source_path });

    const response = await this.model.listDirectory(
      this.model.userFilesystems[this.model.activeFilesystem].key,
      source_path,
      'default',
      false
    );

    // TODO: Check for status/description?
    if (!response?.content) {
      // TODO refactor validation
      this.logger.error('Error fetching files', { path: source_path }); // TODO jupyter info print
      return;
    }

    this.logger.debug('Directory listing received', {
      path: source_path,
      itemCount: response.content.length
    });

    // Get the dir tree node for this path (updates go into this subtree)
    const nodeForPath = this.getNodeForPath(source_path);

    if (!nodeForPath) {
      this.logger.error('Failed to find node for path', { path: source_path });
      return;
    }

    if (!nodeForPath.fetch) {
      // Only fetch if this hasn't been fetched before
      // Update the dir tree/data
      this.updateTree(nodeForPath, response['content'], source_path);
      nodeForPath.fetch = true;

      this.logger.debug('Updated directory tree with new content', {
        path: source_path,
        nodeId: nodeForPath.id,
        childCount: Object.keys(nodeForPath.children).length
      });
    } else {
      // Already fetched this child path, ignore and return
      this.logger.info('Skipping lazy load, already fetched', {
        path: source_path
      });
      return;
    }

    // Update the TreeView in the UI
    await this.updateFileBrowserView(nodeForPath);

    if (nodeForPath.id.toString() in this.elementHeap) {
      const uiElement = this.elementHeap[nodeForPath.id.toString()];
      uiElement.expandItem();

      this.logger.debug('Auto-expanded directory node', {
        path: source_path,
        nodeId: nodeForPath.id
      });
    }
  }

  getElementForNode(ident: any) {
    return this.elementHeap[ident.toString()];
  }

  async handleTreeItemClicked(sender: any, userPath: string) {
    this.logger.debug('Trigger lazy load', { userPath });
    await this.lazyLoad(userPath);
  }

  handleUserGetBytesRequest(_sender: any, userPath: string) {
    this.handleContextGetBytes(userPath);
  }

  async handleUploadRequest(sender: any, args: any) {
    // Routes all upload requests (kernel user_data, browser picker, etc.)
    if (args.is_browser_file_picker && args.is_jup_browser_file) {
      this.logger.error('Bad upload request (conflicting source values)', {
        is_browser: args.is_browser_file_picker,
        is_jup_browser: args.is_jup_browser_file
      });
      return;
    }

    if (args.is_browser_file_picker) {
      await this.handleBrowserPickerUpload(args.user_path, args.is_dir);
    } else if (args.is_jup_browser_file) {
      await this.handleJupyterFileBrowserUpload(args.user_path, args.is_dir);
    } else {
      await this.handleKernelHelperUpload(args.user_path, args.is_dir);
    }
  }

  async updateFileBrowserView(startNode: any = null) {
    // Update/sync the tree view with the file data for this filesys
    this.logger.info('Updating file browser view', {
      fullRefresh: startNode === null,
      startNodePath: startNode?.path
    });

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
          this.logger.debug('No children for path', { path: absPath });
          continue;
        }

        for (const [pathSegment, pathInfo] of Object.entries(childPaths)) {
          const item = new FssTreeItem(
            this.model,
            true,
            true,
            this.notebookTracker
          );
          item.setMetadata(
            (pathInfo as any).path,
            (pathInfo as any).metadata.size
          );
          item.setText(pathSegment);
          item.treeItemClicked.connect(this.handleTreeItemClicked.bind(this));
          item.getBytesRequested.connect(
            this.handleUserGetBytesRequest.bind(this)
          );
          item.uploadRequested.connect(this.handleUploadRequest.bind(this));
          elemParent.appendChild(item.root);

          // Store ID and element in the element heap
          const item_id = UniqueId.get_id();
          (pathInfo as any).id = item_id;
          this.elementHeap[item_id.toString()] = item;

          // Set the item type (file or directory)
          const isDirectory =
            Object.keys((pathInfo as any).children).length > 0 ||
            ('type' in (pathInfo as any).metadata &&
              (pathInfo as any).metadata.type === 'directory');

          if (isDirectory) {
            item.setType('dir');
          } else {
            item.setType('file');
          }

          // Add children to build targets if needed
          if (Object.keys((pathInfo as any).children).length > 0) {
            buildTargets[(pathInfo as any).path] = [
              item,
              (pathInfo as any).children
            ];
          }
        }

        deleteQueue.push(absPath);
      }

      // Remove processed items from build targets
      for (const item of deleteQueue) {
        delete buildTargets[item];
      }
    }

    this.logger.debug('File browser view updated', {
      elementCount: Object.keys(this.elementHeap).length
    });
  }

  async fetchAndDisplayFileInfo(fsname: string, refresh: boolean = false) {
    this.logger.info('Fetch/refresh file information display', {
      filesystem: fsname
    });
    // Fetch files for this filesystem
    const response = await this.model.listDirectory(
      this.model.userFilesystems[this.model.activeFilesystem].key,
      '',
      'default',
      refresh
    );

    if (!response) {
      this.logger.error('Invalid response fetching files', {
        filesystem: fsname
      });
      return;
    }

    if (!response.content) {
      this.logger.error('Error retrieving content from filesystem', {
        filesystem: fsname
      });
      return;
    }

    const pathInfos = response['content'].sort((a: any, b: any) => {
      return a.name.localeCompare(b.name);
    });

    this.logger.debug('File information received', {
      filesystem: fsname,
      itemCount: pathInfos.length
    });

    // Update current filesystem display labels
    this.selectedFsLabel.innerText = `${fsname}`;

    // Build a directory tree and update the display
    this.dirTree = this.buildTree(
      pathInfos,
      this.model.userFilesystems[fsname].path
    );
    await this.updateFileBrowserView();
  }

  updateTree(tree: any, pathInfoList: any, rootPath: string) {
    // Update a given tree or subtree by building/populating
    // a nested tree structure based on the provided pathInfos
    this.logger.debug('Updating tree', {
      rootPath,
      itemCount: pathInfoList.length
    });

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
    this.logger.debug('Clearing file data');
    this.dirTree = {};
    this.elementHeap = {};
  }

  buildTree(pathInfoList: any, rootPath: string) {
    // Start building a new directory tree structure from scratch,
    // update/populate it using a list of pathInfos ([path + metadata] items)
    this.logger.debug('Building directory tree', {
      rootPath,
      itemCount: pathInfoList.length
    });

    this.clearFileData();

    const dirTree = {
      path: '/',
      children: {},
      fetch: true,
      metadata: { path: rootPath },
      id: null
    };

    this.updateTree(dirTree, pathInfoList, rootPath);

    this.logger.debug('Directory tree built', {
      childCount: Object.keys(dirTree.children).length
    });

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

    // Expose the log config to the debug console
    if (typeof window !== 'undefined') {
      (window as any).jupyterFsspecLogConfig = LogConfig;
    }

    logger.info('JupyterLab extension jupyterFsspec is activated!');

    if (app['namespace'] !== 'Jupyter Notebook') {
      // Auto initialize the model
      const fsspecModel = new FsspecModel();
      await fsspecModel.initialize();

      logger.debug('Filesystem model initialized', {
        fileBrowserFactoryKeys: Object.keys(fileBrowserFactory)
      });

      // Use the model to initialize the widget and add to the UI
      const fsspec_widget = new FsspecWidget(
        fsspecModel,
        notebookTracker,
        app,
        fileBrowserFactory
      );
      fsspec_widget.id = 'jupyterFsspec:widget';

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
            logger.debug('File browser upload source selected', {
              path: file.path,
              name: file.name,
              type: file.type
            });

            await fsspec_widget.handleJupyterFileBrowserSetBytesTarget(
              fileModel,
              fileBrowserFactory.tracker?.currentWidget
            );
          } else {
            logger.warn('No file selected for upload source');
          }
        }
      });

      logger.info('Adding fsspec widget to right panel');
      app.shell.add(fsspec_widget, 'right');
    } else {
      logger.info('Running in Jupyter Notebook mode');

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
              logger.info('Right panel opened for JupyterFsspec');
            });
          }

          // Auto initialize the model
          const fsspecModel = new FsspecModel();
          await fsspecModel.initialize();

          logger.debug('Filesystem model initialized in Notebook mode');

          // Use the model to initialize the widget and add to the UI
          const fsspec_widget = new FsspecWidget(
            fsspecModel,
            notebookTracker,
            app,
            fileBrowserFactory
          );
          fsspec_widget.id = 'jupyter_fsspec:widget';

          // Add the widget to the top area
          logger.info('Adding fsspec widget to right panel with rank 100');
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

    // Settings integration
    if (settingRegistry) {
      try {
        const settings = await settingRegistry.load(plugin.id);

        logger.info('Settings loaded', {
          settings: settings.composite
        });

        await initializeLogger(settingRegistry);

        settings.changed.connect(() => {
          logger.debug('Settings changed', {
            newSettings: settings.composite
          });
        });
      } catch (error) {
        logger.error('Failed to load settings', {
          error,
          pluginId: plugin.id
        });
      }
    }
  }
};

export default plugin;
