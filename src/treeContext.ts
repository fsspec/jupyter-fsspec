// Right-click/context menu for file items
import { INotebookTracker } from '@jupyterlab/notebook';

import { Logger } from './logger';

export class FssContextMenu {
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

    const menuItem = this.createMenuItem('Copy Path', 'copyPath');
    root.appendChild(menuItem);

    // TODO refactor this...add a second option for TreeItems
    if (parentControl) {
      const menuItem2 = document.createElement('div');
      menuItem2.classList.add('jfss-tree-context-item');
      menuItem2.innerText = 'Send Bytes to helper';
      menuItem2.addEventListener('mouseenter', this.handleItemHover.bind(this));
      menuItem2.addEventListener(
        'mouseleave',
        this.handleItemUnhover.bind(this)
      );
      menuItem2.addEventListener('click', this.handleItemClick.bind(this));
      menuItem2.dataset.fssContextType = 'getBytes';
      root.appendChild(menuItem2);

      const menuItem3 = document.createElement('div');
      menuItem3.classList.add('jfss-tree-context-item');
      menuItem3.innerText = 'Upload to path (helper.user_data)';
      menuItem3.addEventListener('mouseenter', this.handleItemHover.bind(this));
      menuItem3.addEventListener(
        'mouseleave',
        this.handleItemUnhover.bind(this)
      );
      menuItem3.addEventListener('click', this.handleItemClick.bind(this));
      menuItem3.dataset.fssContextType = 'uploadUserData';
      root.appendChild(menuItem3);

      const menuItem4 = document.createElement('div');
      menuItem4.classList.add('jfss-tree-context-item');
      menuItem4.innerText = 'Pick a file to upload';
      menuItem4.addEventListener('mouseenter', this.handleItemHover.bind(this));
      menuItem4.addEventListener(
        'mouseleave',
        this.handleItemUnhover.bind(this)
      );
      menuItem4.addEventListener('click', this.handleItemClick.bind(this));
      menuItem4.dataset.fssContextType = 'uploadBrowserFile';
      root.appendChild(menuItem4);
    }

    root.addEventListener('mouseleave', this.handleMouseExit.bind(this), false);

    this.parentControl = parentControl;
    // TODO: skip(?) if file path is directory
    const openCode = this.createMenuItem(
      'Copy `open` code block',
      'copyOpenCodeBlock'
    );
    root.appendChild(openCode);
  }

  createMenuItem(text: string, contextType: string) {
    const menuItem = document.createElement('div');
    menuItem.classList.add('jfss-tree-context-item');
    menuItem.innerText = text;
    menuItem.dataset.fssContextType = contextType;

    menuItem.addEventListener('click', this.handleItemClick.bind(this));
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
      const openCodeBlock = `with fsspec.open("${path}", "rt") as f:\n   for line in f:\n      print(line)`;
      navigator.clipboard.writeText(openCodeBlock).then(
        () => {
          console.log('Copied `open` code block');
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
    // TODO multiple menu it
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
      if (this.parentControl) {
        this.parentControl.handleUploadUserData();
      }
    } else if (event.target.dataset.fssContextType === 'uploadBrowserFile') {
      if (this.parentControl) {
        this.parentControl.handleUploadUserData({
          is_browser_file_picker: true
        });
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
    this.root.remove();
    return false;
  }
}
