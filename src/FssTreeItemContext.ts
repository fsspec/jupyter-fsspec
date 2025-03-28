// Right-click/context menu for file items
import { INotebookTracker } from '@jupyterlab/notebook';

import { Logger } from './logger';

export class FssTreeItemContext {
  root: any;
  clicked = false;
  parentControl: any = null;
  model: any;
  notebookTracker: any;

  constructor(
    model: any,
    notebookTracker: INotebookTracker,
    parentControl: any
  ) {
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

    return menuItem;
  }

  copyPath() {
    const info = this.model.getActiveFilesystemInfo();
    const protocol = info?.canonical_path.slice(
      0,
      info.canonical_path.length - info.path.length
    );
    if (protocol) {
      const canonical =
        protocol + '/' + this.root.dataset.fss.replace(/^\/+/, () => '');
      return canonical;
    }
  }

  copyPathToClipboard() {
    const path = this.copyPath();

    if (path) {
      navigator.clipboard.writeText(path).then(
        () => {
          // Success
          console.log('Copy path: ' + path);
          this.root.remove();
        },
        () => {
          console.log('Copy path failed: ' + path);
          this.root.remove();
        }
      );
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
        console.log('Updated cell content to: ', newCellContent);
      }
    }
  }

  copyOpenCodeBlock() {
    const path = this.copyPath();

    if (path) {
      const openCodeBlock = `with fsspec.open("${path}", "rb") as f:\n   ...`;
      navigator.clipboard.writeText(openCodeBlock).then(
        () => {
          console.log('Inserted `open` code block');
          console.log(openCodeBlock);
          this.root.remove();
        },
        () => {
          console.log('Failed to copy `open` code block');
          this.root.remove();
        }
      );

      this.insertCodeBlock(openCodeBlock);
    } else {
      console.log('Failed to copy `open` code block');
      this.root.remove();
    }
  }

  handleItemClick(event: any) {
    console.log('sig1');
    if (event.target.dataset.fssContextType === 'copyPath') {
      this.copyPathToClipboard();
    } else if (event.target.dataset.fssContextType === 'copyOpenCodeBlock') {
      this.copyOpenCodeBlock();
    } else if (event.target.dataset.fssContextType === 'getBytes') {
      Logger.debug('Context item click');
      Logger.debug(`${this.parentControl}`);
      if (this.parentControl) {
        this.parentControl.handleRequestBytes();
      }
    } else if (event.target.dataset.fssContextType === 'uploadUserData') {
      Logger.debug('XX1');
      if (this.parentControl) {
        this.parentControl.handleUploadRequest();
      }
    } else if (event.target.dataset.fssContextType === 'uploadBrowserFile') {
      Logger.debug('XX2');
      console.log('sig2');
      if (this.parentControl) {
        this.parentControl.handleUploadRequest({
          is_browser_file_picker: true
        });
      }
    } else if (
      event.target.dataset.fssContextType === 'uploadJupyterBrowserFile'
    ) {
      Logger.debug('XX3');
      if (this.parentControl) {
        this.parentControl.handleUploadRequest({
          is_jup_browser_file: true
        });
      }
    }

    console.log('sig3');
    this.root.remove();
    console.log('sig4');
  }

  handleItemHover(event: any) {
    event.target.style.backgroundColor = 'var(--jp-layout-color2)';
  }

  handleItemUnhover(event: any) {
    event.target.style.backgroundColor = 'var(--jp-layout-color1)';
  }

  handleMouseExit(event: any) {
    event.preventDefault();
    this.root.remove();
    return false;
  }
}
