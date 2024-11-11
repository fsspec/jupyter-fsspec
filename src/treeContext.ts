// Right-click/context menu for file items

export class FssContextMenu {
    root: any;
    clicked = false;
    model: any;

    constructor(model: any) {
        let root = document.createElement('div');
        root.classList.add('jfss-tree-context-menu');
        this.root = root;
        this.model = model;

        let menuItem = document.createElement('div');
        menuItem.classList.add('jfss-tree-context-item');
        menuItem.innerText = 'Copy Path';
        menuItem.addEventListener('mouseenter', this.handleItemHover.bind(this));
        menuItem.addEventListener('mouseleave', this.handleItemUnhover.bind(this));
        menuItem.addEventListener('click', this.handleItemClick.bind(this));
        menuItem.dataset.fssContextType = 'copyPath';
        root.appendChild(menuItem);

        root.addEventListener('mouseleave', this.handleMouseExit.bind(this), false);
    }

    handleItemClick(event: any) {  // TODO multiple menu it
        if (event.target.dataset.fssContextType == 'copyPath') {
            let info = this.model.getActiveFilesystemInfo();
            let protocol = info?.canonical_path.slice(
                0,
                info.canonical_path.length - info.path.length,
            )
            if (protocol) {
                let canonical = protocol + '/' + this.root.dataset.fss.replace(/^\/+/, () => '');
                navigator.clipboard.writeText(canonical).then(
                    () => {  // Success
                        console.log('Copy path: ' + canonical);
                        this.root.remove();
                    },
                    () => {
                        console.log('Copy path failed: ' + canonical);
                        this.root.remove();
                    },
                );
            }
        }
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
