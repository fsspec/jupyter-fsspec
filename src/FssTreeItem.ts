// Element for displaying a single fsspec tree entry

import { TreeItem } from '@jupyter/web-components';
import { fileIcon, folderIcon } from '@jupyterlab/ui-components';

import { FssContextMenu } from './treeContext';

export class FssTreeItem {
    root: any;
    // icon: HTMLElement;
    nameLbl: HTMLElement;
    dirSymbol: HTMLElement;
    container: HTMLElement;
    clickSlots: any;
    isDir = false;

    constructor(clickSlots: any) {
        // The TreeItem component is the root and handles
        // tree structure functionality in the UI
        let root = new TreeItem();
        this.root = root;
        this.clickSlots = clickSlots;

        // The main container holds custom fsspec UI/functionality
        let container = document.createElement('div');
        container.classList.add('jfss-tree-item-container');
        root.appendChild(container);
        this.container = container

        // Reserve space in the layout for the file/folder icon
        let dirSymbol = document.createElement('div');
        dirSymbol.classList.add('jfss-dir-symbol');
        container.appendChild(dirSymbol);
        dirSymbol.style.visibility = 'hidden';
        this.dirSymbol = dirSymbol;

        // Show the name of this file/folder (a single path segment)
        let nameLbl = document.createElement('div');
        container.appendChild(nameLbl);
        this.nameLbl = nameLbl;

        // Add click and right click handlers to the tree component
        root.addEventListener('contextmenu', this.handleContext.bind(this));
        root.addEventListener('click', this.handleClick.bind(this), true);
    }

    appendChild(elem: any) {
        this.root.appendChild(elem);
    }

    setMetadata(value: string) {
        this.root.dataset.fss = value;
    }

    setText(value: string) {
        this.nameLbl.innerText = value;
    }

    setType(symbol: 'dir' | 'file') {
        this.dirSymbol.replaceChildren();
        this.dirSymbol.style.visibility = 'visible';

        if (symbol == 'dir') {
            folderIcon.element({container: this.dirSymbol});
            this.isDir = true;
        }
        if (symbol == 'file') {
            fileIcon.element({container: this.dirSymbol});
            this.isDir = false;
        }
    }

    handleClick(event: any) {
        if (this.isDir) {
            for (let slot of this.clickSlots) {
                slot(this.root.dataset.fss);
            }
        }
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
        let context = new FssContextMenu();
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
}
