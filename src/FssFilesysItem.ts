// Element for displaying a single fsspec filesystem

import { Signal } from '@lumino/signaling';

import { FssFilesysContextMenu } from './FssFilesysContextMenu';
import { Logger } from './logger';
import { INotebookTracker } from '@jupyterlab/notebook';

const HOVER = 'var(--jp-layout-color3)';
const UNHOVER = 'var(--jp-layout-color2)';
const SELECTED = 'var(--jp-brand-color2)';

class FssFilesysItem {
  root: HTMLElement;
  model: any;
  filesysName: string;
  filesysProtocol: string;
  fsInfo: any;
  nameField: any;
  pathField: any;
  _selected = false;
  _hovered = false;
  notebookTracker: INotebookTracker;
  private readonly logger: Logger;
  filesysClicked: Signal<any, string>;

  constructor(model: any, fsInfo: any, notebookTracker: INotebookTracker) {
    this.logger = Logger.getLogger('FssFilesysItem');

    this.model = model;
    this.filesysName = fsInfo.name;
    this.filesysProtocol = fsInfo.protocol;
    this.fsInfo = fsInfo;
    this.notebookTracker = notebookTracker;
    this.filesysClicked = new Signal<this, any>(this);

    const fsItem = document.createElement('div');
    fsItem.classList.add('jfss-fsitem-root');
    fsItem.addEventListener('mouseenter', this.handleFsysHover.bind(this));
    fsItem.addEventListener('mouseleave', this.handleFsysHover.bind(this));
    fsItem.dataset.fssname = fsInfo.name;
    this.root = fsItem;

    // Set the tooltip
    this.root.title = `Root Path: ${fsInfo.path}`;

    this.nameField = document.createElement('div');
    this.nameField.classList.add('jfss-fsitem-name');
    this.nameField.innerText = this.filesysName;
    fsItem.appendChild(this.nameField);

    this.pathField = document.createElement('div');
    this.pathField.classList.add('jfss-fsitem-protocol');
    this.pathField.innerText = 'Path: ' + fsInfo.path;
    fsItem.appendChild(this.pathField);

    fsItem.addEventListener('click', this.handleClick.bind(this));
    fsItem.addEventListener('contextmenu', this.handleContext.bind(this));

    this.logger.debug('Filesystem item initialized', {
      name: this.filesysName,
      protocol: this.filesysProtocol,
      path: fsInfo.path
    });
  }

  handleContext(event: any) {
    // Prevent ancestors from adding extra context boxes
    event.stopPropagation();

    // Prevent default browser context menu (unless shift pressed
    // as per usual JupyterLab conventions)
    if (!event.shiftKey) {
      event.preventDefault();
    } else {
      this.logger.debug('Default context menu shown (shift+click)');
      return;
    }

    this.logger.debug('Opening custom context menu', {
      filesystem: this.filesysName,
      clientX: event.clientX,
      clientY: event.clientY
    });

    // Make/add the context menu
    const context = new FssFilesysContextMenu(this.model, this.notebookTracker);
    context.root.dataset.fss = this.root.dataset.fss;
    const body = document.getElementsByTagName('body')[0];
    body.appendChild(context.root);

    // Position it under the mouse (top left corner normally,
    // or bottom right if that corner is out-of-viewport)
    const parentRect = body.getBoundingClientRect();
    const contextRect = context.root.getBoundingClientRect();
    let xCoord = event.clientX - parentRect.x;
    let yCoord = event.clientY - parentRect.y;
    const spacing = 12;
    if (
      xCoord + contextRect.width > window.innerWidth ||
      yCoord + contextRect.height > window.innerHeight
    ) {
      // Context menu is cut off when positioned under mouse at top left corner,
      // use the bottom right corner instead
      xCoord -= contextRect.width;
      yCoord -= contextRect.height;
      // Shift the menu so the mouse is inside it, not at the corner/edge
      xCoord += spacing;
      yCoord += spacing;

      this.logger.debug('Context menu positioned at bottom right', {
        x: xCoord,
        y: yCoord,
        reason: 'viewport constraints'
      });
    } else {
      // Shift the menu so the mouse is inside it, not at the corner/edge
      xCoord -= spacing;
      yCoord -= spacing;

      this.logger.debug('Context menu positioned at top left', {
        x: xCoord,
        y: yCoord
      });
    }

    context.root.style.left = `${xCoord}` + 'px';
    context.root.style.top = `${yCoord}` + 'px';
  }

  setMetadata(value: string) {
    this.logger.debug('Setting filesystem metadata', {
      filesystem: this.filesysName,
      value
    });
    this.root.dataset.fss = value;
  }

  set selected(value: boolean) {
    this.logger.debug('Selection state changed', {
      filesystem: this.filesysName,
      selected: value,
      previousState: this._selected
    });

    this._selected = value;
    if (value) {
      this.root.style.backgroundColor = SELECTED;
    } else {
      this.hovered = this._hovered;
    }
  }

  set hovered(state: boolean) {
    if (this._hovered !== state) {
      this.logger.debug('Hover state changed', {
        filesystem: this.filesysName,
        hovered: state,
        selected: this._selected
      });
    }

    this._hovered = state;
    if (this._selected) {
      this.root.style.backgroundColor = SELECTED;
    } else {
      if (state) {
        this.root.style.backgroundColor = HOVER;
      } else {
        this.root.style.backgroundColor = UNHOVER;
      }
    }
  }

  handleFsysHover(event: any) {
    if (event.type === 'mouseenter') {
      this.hovered = true;
    } else {
      this.hovered = false;
    }
  }

  handleClick(_event: any) {
    this.logger.info('Filesystem selected', {
      name: this.filesysName,
      protocol: this.filesysProtocol,
      path: this.fsInfo.path
    });

    this.selected = true;
    this.filesysClicked.emit(this.fsInfo);
  }
}

export { FssFilesysItem };
