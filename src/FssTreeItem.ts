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
    treeItemObserver: MutationObserver;
    pendingExpandAction = false;

    constructor(clickSlots: any) {
        // The TreeItem component is the root and handles
        // tree structure functionality in the UI
        let root = new TreeItem();
        this.root = root;
        this.clickSlots = clickSlots;

        // Use a MutationObserver to look for new child nodes
        let observeOptions = {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class'],
            attributeOldValue: true,
        };
        this.treeItemObserver = new MutationObserver(this.handleDomMutation.bind(this));

        // The main container holds custom fsspec UI/functionality
        let container = document.createElement('div');
        container.classList.add('jfss-tree-item-container');
        root.appendChild(container);
        this.container = container;

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

        // Start observing for changes to the TreeItem's shadow root
        if (this.root.shadowRoot) {
            console.log('ITEM HAS SHADOW')
            this.treeItemObserver.observe(this.root.shadowRoot, observeOptions)
        }
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

    handleDomMutation(records: any, observer: any) {
        // console.log(`Observing ${this.root.dataset.fss}`);
        if (this.pendingExpandAction) {

            for (const rec of records) {
                // console.log(`mREC`);
                // console.log(rec);
                // console.log(rec?.class);
                for (let node of rec?.addedNodes) {
                    // console.log(node);
                    // console.log(node?.className);
                    if (node?.classList) {
                        // console.log(`chk CLS ${node.classList.contains('expand-collapse-button')}`);
                        if (node.classList.contains('expand-collapse-button')) {
                            // console.log('DoEXPAND');
                            node.click();
                        }
                    }
                }
            }
        }
    }

    handleClick(event: any) {
        let target = event.target;
        console.log(`FOOBAR ${target?.shadowRoot}`);
        let expander = this.root.shadowRoot.querySelector('.expand-collapse-button');
        if (expander) {
            let expRect = expander.getBoundingClientRect();
            if (!(event.clientX < expRect.left
                    || event.clientX > expRect.right
                    || event.clientY < expRect.top
                    || event.clientY > expRect.bottom)) {
                console.log('--> Click inside expander');
            }
        }

        console.log(`TCLICK // t... ${event.target} // Q... ${event.target.querySelectorAll('.expand-collapse-button')}`);
        if (this.isDir) {
            for (let slot of this.clickSlots) {
                slot(this.root.dataset.fss);
            }
        }
    }

    expandItem() {
        console.log('expandItem XX');
        let shadow = this.root.shadowRoot;
        let expander = this.root.shadowRoot.querySelector('.expand-collapse-button');
        console.log(this.root.innerHTML);
        console.log(shadow);
        console.log(shadow.innerHTML);
        console.log(shadow.querySelector('.expand-collapse-button'));
        console.log(shadow.children);
        if (expander) {
            console.log('CLICKING expander');
            expander.click();
        }

        // This method's purpose is to expand folder items to show
        // children, but when this is called, the children aren't ready...
        // Set this here to indicate that an expand action is desired,
        // then use the MutationObserver member var to find the
        // expand/collapse Element so that it can be click()'d to
        // perform the actual expand action
        this.pendingExpandAction = true;
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
