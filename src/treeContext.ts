// Right-click/context menu for file items

export class FssContextMenu {
    root: any;
    clicked = false;
    parentControl: any = null;

    constructor(parentControl: any) {
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

        // TODO refactor this...add a second option for TreeItems
        if (parentControl) {
            let menuItem2 = document.createElement('div');
            menuItem2.classList.add('jfss-tree-context-item');
            menuItem2.innerText = 'Send Bytes to helper';
            menuItem2.addEventListener('mouseenter', this.handleItemHover.bind(this));
            menuItem2.addEventListener('mouseleave', this.handleItemUnhover.bind(this));
            menuItem2.addEventListener('click', this.handleItemClick.bind(this));
            menuItem2.dataset.fssContextType = 'getBytes';
            root.appendChild(menuItem2);
        }

        root.addEventListener('mouseleave', this.handleMouseExit.bind(this), false);

        this.parentControl = parentControl;
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
        if (event.target.dataset.fssContextType == 'getBytes') {
            console.log('AAA ffoo');
            if (this.parentControl) {
                this.parentControl.handleRequestBytes();
            }

            this.root.remove();
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
