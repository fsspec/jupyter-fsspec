// Right-click/context menu for file items
import { INotebookTracker } from '@jupyterlab/notebook';

export class FssContextMenu {
  root: any;
  clicked = false;
  model: any;
  copiedPath: string;
  notebookTracker: any;

  constructor(model: any, notebookTracker: INotebookTracker) {
    const root = document.createElement('div');
    root.classList.add('jfss-tree-context-menu');
    this.root = root;
    this.model = model;
    this.copiedPath = '';
    this.notebookTracker = notebookTracker;

    const menuItem = this.createMenuItem('Copy Path', 'copyPath');
    root.appendChild(menuItem);

    // TODO: skip(?) if file path is directory
    const openCode = this.createMenuItem(
      'Copy `open` code block',
      'copyOpenCodeBlock'
    );
    root.appendChild(openCode);

    root.addEventListener('mouseleave', this.handleMouseExit.bind(this), false);
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
      this.copiedPath = canonical;
      navigator.clipboard.writeText(canonical).then(
        () => {
          // Success
          console.log('Copy path: ' + canonical);
          this.root.remove();
        },
        () => {
          console.log('Copy path failed: ' + canonical);
          this.root.remove();
        }
      );
    }
  }

  copyOpenCodeBlock() {
    this.copyPath();

    if (this.copiedPath) {
      const openCodeBlock = `with fsspec.open("${this.copiedPath}", "rt") as f:\n   for line in f:\n      print(line)`;
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

      // Determine if there is an active notebook and cell to paste to
      const notebookPanel = this.notebookTracker.currentWidget;
      if (notebookPanel) {
        const activeCell = notebookPanel.content.activeCell;
        if (activeCell) {
          const cellContent = activeCell.model.sharedModel.getSource();
          const newCellContent = cellContent + '\n' + openCodeBlock;
          activeCell.model.sharedModel.setSource(newCellContent);
          console.log('Updated cell content to: ', newCellContent);
        }
      }
    } else {
      console.log('Failed to copy `open` code block');
      this.root.remove();
    }
  }

  handleItemClick(event: any) {
    // TODO multiple menu it
    if (event.target.dataset.fssContextType === 'copyPath') {
      this.copyPath();
    } else if (event.target.dataset.fssContextType === 'copyOpenCodeBlock') {
      this.copyOpenCodeBlock();
    }
  }

  handleMouseExit(event: any) {
    event.preventDefault();
    this.root.remove();
    return false;
  }
}
