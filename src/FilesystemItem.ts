// Element for displaying a single fsspec filesystem

class FilesystemItem {
    element: HTMLElement;
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
      this.element = fsItem;

      this.nameField = document.createElement('div');
      this.nameField.classList.add('jfss-fsitem');
      this.nameField.innerText = this.filesysName;
      this.nameField.addEventListener('mouseenter', this.handleFsysHover.bind(this));
      this.nameField.addEventListener('mouseleave', this.handleFsysHover.bind(this));
      fsItem.appendChild(this.nameField);

      this.typeField = document.createElement('div');
      this.typeField.classList.add('jfss-fsitem');
      this.typeField.innerText = this.filesysType;
      fsItem.appendChild(this.typeField);

      fsItem.addEventListener('click', this.handleClick.bind(this));
    }

    handleFsysHover(event: any) {
      if (event.type == 'mouseenter') {
        this.nameField.style.backgroundColor = '#bbb';
        this.typeField.style.backgroundColor = '#bbb';
      }
      else {
        this.nameField.style.backgroundColor = '#ddd';
        this.typeField.style.backgroundColor = '#ddd';
      }
    }

    handleClick(_event: any) {
      for (const slot of this.clickSlots) {
        slot(this.fsInfo);
      }
    }
  }

  export { FilesystemItem };
