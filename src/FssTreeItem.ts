// Element for displaying a single fsspec tree entry

import { TreeItem } from '@jupyter/web-components';
import { FssContextMenu } from './treeContext';

export class FssTreeItem {
    root: any;
    // icon: HTMLElement;
    nameLbl: HTMLElement;
    dirSymbol: HTMLElement;
    container: HTMLElement;

    constructor() {
        let root = new TreeItem();
        this.root = root;

        let container = document.createElement('div');
        container.classList.add('jfss-tree-item-container');
        root.appendChild(container);
        this.container = container

        let dirSymbol = document.createElement('div');
        dirSymbol.classList.add('jfss-dir-symbol');
        dirSymbol.innerText = 'D';
        container.appendChild(dirSymbol);
        dirSymbol.style.visibility = 'hidden';
        this.dirSymbol = dirSymbol;

        // let icon = document.createElement('img');
        // icon.innerText = 'D+'
        // icon.setAttribute('src', 'style/file_icon_dummy.png');
        // container.appendChild(icon);
        // this.icon = icon;

        let nameLbl = document.createElement('div');
        container.appendChild(nameLbl);
        this.nameLbl = nameLbl;

        root.addEventListener('contextmenu', this.handleContext.bind(this));
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

    showDirSymbol(state: boolean) {
        if (state) {
            this.dirSymbol.style.visibility = 'visible';
        } else {
            this.dirSymbol.style.visibility = 'hidden';
        }
    }

    handleContext(event: any) {
        // console.log('Fss Context');
        // Prevent ancestors from adding extra context boxes
        event.stopPropagation();

        // Prevent default browser context menu (unless shift pressed
        // as per usual JupyterLab conventions)
        if (!event.shiftKey) {
            event.preventDefault();
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
