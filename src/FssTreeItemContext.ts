// Right-click/context menu for file items
import { INotebookTracker } from '@jupyterlab/notebook';
import { Logger } from './logger';

export class FssTreeItemContext {
  root: any;
  clicked = false;
  parentControl: any = null;
  model: any;
  notebookTracker: any;
  private readonly logger: Logger;

  constructor(
    model: any,
    notebookTracker: INotebookTracker,
    parentControl: any
  ) {
    this.logger = Logger.getLogger('FssTreeItemContext');

    const root = document.createElement('div');
    root.classList.add('jfss-tree-context-menu');
    this.root = root;
    this.model = model;
    this.notebookTracker = notebookTracker;
    this.parentControl = parentControl;

    const actions = [
      ['Copy Path to Clipboard', 'jfss-tree-context-item', 'copyPath'],
      ['Send to Helper Module', 'jfss-tree-context-item', 'getBytes'],
      ['Upload from Helper Module', 'jfss-tree-context-item', 'uploadUserData'],
      ['Upload from Computer', 'jfss-tree-context-item', 'uploadBrowserFile'],
      [
        'Upload from Jupyter File Browser',
        'jfss-tree-context-item',
        'uploadJupyterBrowserFile'
      ],
      [
        'Insert `open` Code Snippet',
        'jfss-tree-context-item',
        'copyOpenCodeBlock'
      ] // TODO: skip(?) if file path is directory
    ];

    for (const action of actions) {
      this.createMenuItem(action[0], action[1], action[2]);
    }

    root.addEventListener('mouseleave', this.handleMouseExit.bind(this), false);

    this.logger.debug('Context menu initialized', {
      itemCount: actions.length,
      hasParentControl: !!parentControl
    });
  }

  createMenuItem(text: string, cssClass: string, contextType: string) {
    const menuItem = document.createElement('div');
    menuItem.classList.add(cssClass);
    menuItem.innerText = text;
    menuItem.dataset.fssContextType = contextType;

    menuItem.addEventListener('click', this.handleItemClick.bind(this));
    menuItem.addEventListener('mouseenter', this.handleItemHover.bind(this));
    menuItem.addEventListener('mouseleave', this.handleItemUnhover.bind(this));

    this.root.appendChild(menuItem);

    this.logger.debug('Menu item created', {
      text,
      contextType
    });

    return menuItem;
  }

  copyPath() {
    return this.root.dataset.fss.replace(/^\/+/, () => '');
  }

  copyPathToClipboard() {
    const path = this.copyPath();

    if (path) {
      navigator.clipboard.writeText(path).then(
        () => {
          // Success
          this.logger.info('Path copied to clipboard', { path });
          this.root.remove();
        },
        error => {
          this.logger.error('Failed to copy path to clipboard', {
            path,
            error
          });
          this.root.remove();
        }
      );
    } else {
      this.logger.error('Cannot copy path', {
        reason: 'path is undefined'
      });
      this.root.remove();
    }
  }

  insertCodeBlock(codeBlock: string) {
    // Determine if there is an active notebook and cell to paste to
    const notebookPanel = this.notebookTracker.currentWidget;
    if (notebookPanel) {
      const activeCell = notebookPanel.content.activeCell;
      if (activeCell) {
        const cellContent = activeCell.model.sharedModel.getSource();
        const newCellContent = cellContent + '\n' + codeBlock;
        activeCell.model.sharedModel.setSource(newCellContent);
        this.logger.debug('Updated cell content', {
          oldLength: cellContent.length,
          newLength: newCellContent.length,
          notebookId: notebookPanel.id
        });
      } else {
        this.logger.warn('No active cell found in notebook', {
          notebookId: notebookPanel.id
        });
      }
    } else {
      this.logger.warn('No active notebook found');
    }
  }

  copyOpenCodeBlock() {
    const path = this.copyPath();
    const kwargs = this.model.getActiveFilesystemInfo().kwargs;
    const [_, relative_path] = path.split(/\/(.+)/);
    const fsInfo = this.model.getActiveFilesystemInfo();
    const real_path =
      fsInfo.protocol +
      '://' +
      (fsInfo.prefix_path ? fsInfo.prefix_path + '/' : '') +
      relative_path;

    let openCodeBlock = '';
    if (kwargs) {
      openCodeBlock = `import fsspec\nimport json\nfsspec_kwargs = json.loads(${JSON.stringify(JSON.stringify(kwargs))})\nwith fsspec.open("${real_path}", mode="rb", **fsspec_kwargs) as f:\n   ...`;
    } else {
      openCodeBlock = `import fsspec\nwith fsspec.open("${real_path}", mode="rb"q) as f:\n   ...`;
    }

    if (path) {
      navigator.clipboard.writeText(openCodeBlock).then(
        () => {
          this.logger.info('Code snippet copied and inserted', {
            operation: 'open',
            path
          });
          this.logger.debug('Code snippet content', { content: openCodeBlock });
          this.root.remove();
        },
        error => {
          this.logger.error('Failed to copy code snippet', {
            operation: 'open',
            path,
            error
          });
          this.root.remove();
        }
      );

      this.insertCodeBlock(openCodeBlock);
    } else {
      this.logger.error('Failed to copy code snippet', {
        operation: 'open',
        reason: 'path not available'
      });
      this.root.remove();
    }
  }

  handleItemClick(event: any) {
    const contextType = event.target.dataset.fssContextType;
    this.logger.debug('Menu item clicked', {
      type: contextType,
      path: this.root.dataset.fss
    });

    if (contextType === 'copyPath') {
      this.copyPathToClipboard();
    } else if (contextType === 'copyOpenCodeBlock') {
      this.copyOpenCodeBlock();
    } else if (contextType === 'getBytes') {
      if (this.parentControl) {
        this.logger.debug('Requesting bytes from parent control', {
          controlType: this.parentControl.constructor.name
        });
        this.parentControl.handleRequestBytes();
      } else {
        this.logger.warn('Cannot request bytes: no parent control');
      }
    } else if (contextType === 'uploadUserData') {
      if (this.parentControl) {
        this.logger.debug('Requesting user data upload', {
          path: this.root.dataset.fss
        });
        this.parentControl.handleUploadRequest();
      } else {
        this.logger.warn('Cannot upload user data: no parent control');
      }
    } else if (contextType === 'uploadBrowserFile') {
      this.logger.debug('Requesting browser file picker upload', {
        path: this.root.dataset.fss
      });
      if (this.parentControl) {
        this.parentControl.handleUploadRequest({
          is_browser_file_picker: true
        });
      } else {
        this.logger.warn('Cannot upload from browser: no parent control');
      }
    } else if (contextType === 'uploadJupyterBrowserFile') {
      if (this.parentControl) {
        this.logger.debug('Requesting Jupyter browser file upload', {
          path: this.root.dataset.fss
        });
        this.parentControl.handleUploadRequest({
          is_jup_browser_file: true
        });
      } else {
        this.logger.warn(
          'Cannot upload from Jupyter browser: no parent control'
        );
      }
    }
    this.root.remove();
  }

  handleItemHover(event: any) {
    event.target.style.backgroundColor = 'var(--jp-layout-color2)';
  }

  handleItemUnhover(event: any) {
    event.target.style.backgroundColor = 'var(--jp-layout-color1)';
  }

  handleMouseExit(event: any) {
    event.preventDefault();
    this.logger.debug('Context menu closed', { reason: 'mouse exit' });
    this.root.remove();
    return false;
  }
}
