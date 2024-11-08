// Right-click/context menu for file items

export class FssContextMenu {
    root: any;
    clicked = false;

    constructor() {
        let root = document.createElement('div');
        root.classList.add('jfss-tree-context-menu');
        this.root = root;

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
            navigator.clipboard.writeText(this.root.dataset.fss).then(
                () => {  // Success
                    console.log('Copy path: ' + this.root.dataset.fss);
                    this.root.remove();
                },
                () => {
                    console.log('Copy path failed: ' + this.root.dataset.fss);
                    this.root.remove();
                },
            );
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
