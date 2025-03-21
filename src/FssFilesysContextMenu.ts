// Right-click/context menu for file items
import { INotebookTracker } from '@jupyterlab/notebook';
import { Logger } from './logger';

export class FssFilesysContextMenu {
  root: any;
  clicked = false;
  parentControl: any = null;
  model: any;
  notebookTracker: any;
  private readonly logger: Logger;

  constructor(model: any, notebookTracker: INotebookTracker) {
    this.logger = Logger.getLogger('FssFilesysContextMenu');

    const root = document.createElement('div');
    root.classList.add('jfss-tree-context-menu');
    this.root = root;
    this.model = model;
    this.notebookTracker = notebookTracker;

    const actions = [
      ['Copy Path to Clipboard', 'jfss-tree-context-item', 'copyPath'],
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
    this.logger.debug('Context menu initialized');
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
    this.logger.debug('Created menu item', { text, contextType });

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
      this.logger.debug('Generated path', { path: canonical });
      return canonical;
    } else {
      this.logger.warn('Failed to generate path', {
        reason: 'No protocol found',
        info: info
      });
      return undefined;
    }
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
      this.logger.error('Cannot copy path', { reason: 'path is undefined' });
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
          notebookType: notebookPanel.content.model.type
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

    if (path) {
      const openCodeBlock = `with fsspec.open("${path}", "rt") as f:\n   for line in f:\n      print(line)`;
      navigator.clipboard.writeText(openCodeBlock).then(
        () => {
          this.logger.info('Copied code snippet to clipboard', {
            operation: 'open',
            path
          });
          this.logger.debug('Code block content', { content: openCodeBlock });
          this.root.remove();
        },
        error => {
          this.logger.error('Failed to copy code snippet to clipboard', {
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
    this.logger.debug('Menu item clicked', {
      type: event.target.dataset.fssContextType
    });

    if (event.target.dataset.fssContextType === 'copyPath') {
      this.copyPathToClipboard();
    } else if (event.target.dataset.fssContextType === 'copyOpenCodeBlock') {
      this.copyOpenCodeBlock();
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
