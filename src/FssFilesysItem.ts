// Element for displaying a single fsspec filesystem

import { FssContextMenu } from './treeContext';
// import { Logger } from "./logger"

const HOVER = 'var(--jp-layout-color3)';
const UNHOVER = 'var(--jp-layout-color2)';
const SELECTED = 'var(--jp-layout-color4)';

class FssFilesysItem {
  root: HTMLElement;
  model: any;
  filesysName: string;
  filesysType: string;
  fsInfo: any;
  clickSlots: any;
  nameField: any;
  pathField: any;
  _selected = false;
  _hovered = false;

  constructor(model: any, fsInfo: any, userClickSlots: any) {
    this.model = model;
    this.filesysName = fsInfo.name;
    this.filesysType = fsInfo.type;
    this.fsInfo = fsInfo;

    this.clickSlots = [];
    for (const slot of userClickSlots) {
      this.clickSlots.push(slot);
    }

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
    this.pathField.classList.add('jfss-fsitem-type');
    this.pathField.innerText = 'Path: ' + fsInfo.path;
    fsItem.appendChild(this.pathField);

    fsItem.addEventListener('click', this.handleClick.bind(this));
    fsItem.addEventListener('contextmenu', this.handleContext.bind(this));
  }

  handleContext(event: any) {
    // Prevent ancestors from adding extra context boxes
    event.stopPropagation();

    // Prevent default browser context menu (unless shift pressed
    // as per usual JupyterLab conventions)
    if (!event.shiftKey) {
      event.preventDefault();
    } else {
      return;
    }

    // Make/add the context menu
    const context = new FssContextMenu(this.model);
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
    } else {
      // Shift the menu so the mouse is inside it, not at the corner/edge
      xCoord -= spacing;
      yCoord -= spacing;
    }

    context.root.style.left = `${xCoord}` + 'px';
    context.root.style.top = `${yCoord}` + 'px';
  }

  setMetadata(value: string) {
    this.root.dataset.fss = value;
  }

  set selected(value: boolean) {
    this._selected = value;
    if (value) {
      this.root.style.backgroundColor = SELECTED;
    } else {
      this.hovered = this._hovered;
    }
  }

  set hovered(state: boolean) {
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
    this.selected = true;
    for (const slot of this.clickSlots) {
      slot(this.fsInfo);
    }
  }
}

export { FssFilesysItem };
