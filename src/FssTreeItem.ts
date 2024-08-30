// Element for displaying a single fsspec tree entry

import { TreeItem } from '@jupyter/web-components';
import { FssContextMenu } from './treeContext';

export class FssTreeItem {
    root: HTMLElement;
    // icon: HTMLElement;
    nameLbl: HTMLElement;
    dirSymbol: HTMLElement;

    constructor() {
        let root = new TreeItem();
        this.root = root;

        let container = document.createElement('div');
        container.classList.add('jfss-tree-item-container');
        root.appendChild(container);

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

    handleContext() {
        console.log('Fss Context');
        let context = new FssContextMenu();
        this.root.appendChild(context.root);
    }
}
