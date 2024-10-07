// Element for displaying a single fsspec filesystem

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

      this.nameField = document.createElement('div');
      this.nameField.classList.add('jfss-fsitem-name');
      this.nameField.innerText = this.filesysName;
      fsItem.appendChild(this.nameField);

      this.typeField = document.createElement('div');
      this.typeField.classList.add('jfss-fsitem-type');
      this.typeField.innerText = 'Type: ' + this.filesysType;
      fsItem.appendChild(this.typeField);

      fsItem.addEventListener('click', this.handleClick.bind(this));
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
