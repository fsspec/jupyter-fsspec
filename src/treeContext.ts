// Right-click/context menu for file items

export class FssContextMenu {
    root: HTMLElement;
    clicked = false;

    constructor() {
        let root = document.createElement('div');
        root.classList.add('jfss-tree-context-menu');
        this.root = root;

        let menuItem = document.createElement('div');
        menuItem.classList.add('jfss-tree-context-item');
        root.appendChild(menuItem);

        root.addEventListener('click', this.handleClick.bind(this));
        root.addEventListener('mouseleave', this.handleMouseExit.bind(this), false);
    }

    handleClick() {
        console.log('Click context!!');
    }

    handleMouseExit(event: any) {
        event.preventDefault();
        this.root.remove();
        return false;
    }
}
