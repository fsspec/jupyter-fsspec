// Element for displaying a single fsspec filesystem

import { FssContextMenu } from './treeContext';

class FssFilesysItem {
    root: HTMLElement;
    filesysName: string;
    filesysType: string;
    fsInfo: any;
    clickSlots: any;
    nameField: any;
    typeField: any;

    constructor(fsInfo: any, userClickSlots: any) {
      this.filesysName = fsInfo.name;
      this.filesysType = fsInfo.type;
      this.fsInfo = fsInfo;

      this.clickSlots = [];
      for (const slot of userClickSlots) {
        this.clickSlots.push(slot);
      }

      let fsItem = document.createElement('div');
      fsItem.classList.add('jfss-fsitem-root');
      fsItem.addEventListener('mouseenter', this.handleFsysHover.bind(this));
      fsItem.addEventListener('mouseleave', this.handleFsysHover.bind(this));
      this.root = fsItem;

      // Set the tooltip
      this.root.title = `Root Path: ${fsInfo.path}`;

      this.nameField = document.createElement('div');
      this.nameField.classList.add('jfss-fsitem-name');
      this.nameField.innerText = this.filesysName;
      fsItem.appendChild(this.nameField);

      this.typeField = document.createElement('div');
      this.typeField.classList.add('jfss-fsitem-type');
      this.typeField.innerText = 'Type: ' + this.filesysType;
      fsItem.appendChild(this.typeField);

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
        let context = new FssContextMenu(null);
        context.root.dataset.fss = this.root.dataset.fss;
        let body = document.getElementsByTagName('body')[0];
        body.appendChild(context.root);

        // Position it under the mouse (top left corner normally,
        // or bottom right if that corner is out-of-viewport)
        let parentRect = body.getBoundingClientRect();
        let contextRect = context.root.getBoundingClientRect();
        let xCoord = event.clientX - parentRect.x;
        let yCoord = event.clientY - parentRect.y;
        let spacing = 12;
        if (xCoord + contextRect.width > window.innerWidth || yCoord + contextRect.height > window.innerHeight) {
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

    handleFsysHover(event: any) {
      if (event.type == 'mouseenter') {
        this.root.style.backgroundColor = 'var(--jp-layout-color3)';
        this.root.style.backgroundColor = 'var(--jp-layout-color3)';
      }
      else {
        this.root.style.backgroundColor = 'var(--jp-layout-color2)';
        this.root.style.backgroundColor = 'var(--jp-layout-color2)';
      }
    }

    handleClick(_event: any) {
      for (const slot of this.clickSlots) {
        slot(this.fsInfo);
      }
    }
  }

  export { FssFilesysItem };
