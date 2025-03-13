// Element for displaying a single fsspec tree entry

import {
  provideJupyterDesignSystem,
  jpTreeItem
} from '@jupyter/web-components';

import { INotebookTracker } from '@jupyterlab/notebook';

import { fileIcon, folderIcon } from '@jupyterlab/ui-components';

import { FssTreeItemContext } from './FssTreeItemContext';
import { Logger } from './logger';

export class FssTreeItem {
  root: any;
  model: any;
  // icon: HTMLElement;
  nameLbl: HTMLElement;
  sizeLbl: HTMLElement;
  dirSymbol: HTMLElement;
  container: HTMLElement;
  clickSlots: any;
  getBytesSlots: any;
  uploadUserDataSlots: any;
  uploadFromBrowserPickerSlots: any;
  uploadFromJupyterBrowserSlots: any;
  isDir = false;
  treeItemObserver: MutationObserver;
  pendingExpandAction = false;
  lazyLoadAutoExpand = true;
  clickAnywhereDoesAutoExpand = true;
  notebookTracker: INotebookTracker;

  constructor(
    model: any,
    clickSlots: any,
    userGetBytesSlots: any,
    uploadUserDataSlots: any,

    uploadFromBrowserPickerSlots: any,
    uploadFromJupyterBrowserSlots: any,

    autoExpand: boolean,
    expandOnClickAnywhere: boolean,
    notebookTracker: INotebookTracker
  ) {
    // The TreeItem component is the root and handles
    // tree structure functionality in the UI
    // We use the tagName `jp-tree-item` for Notebook 7 compatibility
    if (!customElements.get('jp-tree-item')) {
      provideJupyterDesignSystem().register(jpTreeItem());
      console.log('`jpTreeItem` was registered!');
    }
    const root = document.createElement('jp-tree-item');
    root.setAttribute('name', 'jfss-treeitem-root');
    this.root = root;
    this.model = model;
    this.clickSlots = clickSlots;
    this.getBytesSlots = userGetBytesSlots; // TODO fix its horrible
    this.uploadUserDataSlots = uploadUserDataSlots;
    this.uploadFromBrowserPickerSlots = uploadFromBrowserPickerSlots;
    this.uploadFromJupyterBrowserSlots = uploadFromJupyterBrowserSlots;
    this.lazyLoadAutoExpand = autoExpand;
    this.clickAnywhereDoesAutoExpand = expandOnClickAnywhere;
    this.notebookTracker = notebookTracker;

    // Use a MutationObserver on the root TreeItem's shadow DOM,
    // where the TreeItem's expand/collapse control will live once
    // the item has children to show
    const observeOptions = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: true
    };
    this.treeItemObserver = new MutationObserver(
      this.handleDomMutation.bind(this)
    );

    // The main container holds custom fsspec UI/functionality
    const container = document.createElement('div');
    container.classList.add('jfss-tree-item-container');
    root.appendChild(container);
    this.container = container;

    // Reserve space in the layout for the file/folder icon
    const dirSymbol = document.createElement('div');
    dirSymbol.classList.add('jfss-dir-symbol');
    container.appendChild(dirSymbol);
    dirSymbol.style.visibility = 'hidden';
    this.dirSymbol = dirSymbol;

    // Show the name of this file/folder (a single path segment)
    const nameLbl = document.createElement('div');
    container.appendChild(nameLbl);
    this.nameLbl = nameLbl;

    // Show the name of this file/folder (a single path segment)
    const sizeLbl = document.createElement('div');
    sizeLbl.classList.add('jfss-filesize-lbl');
    container.appendChild(sizeLbl);
    this.sizeLbl = sizeLbl;

    // Add click and right click handlers to the tree component
    root.addEventListener('contextmenu', this.handleContext.bind(this));
    root.addEventListener('click', this.handleClick.bind(this), true);

    // Start observing for changes to the TreeItem's shadow root
    if (this.root.shadowRoot) {
      this.treeItemObserver.observe(this.root.shadowRoot, observeOptions);
    }
  }

  appendChild(elem: any) {
    this.root.appendChild(elem);
  }

  handleRequestBytes() {
    Logger.debug('Treeitem get bytes');
    for (const slot of this.getBytesSlots) {
      Logger.debug(slot);
      slot(this.root.dataset.fss);
    }
  }

  async handleUploadFromBrowserPicker(options: any) {
    this.model.queuedPickerUploadInfo = {}; // Context click always resets this data
    Logger.debug('Treeitem upload user data');
    for (const slot of this.uploadFromBrowserPickerSlots) {
      Logger.debug(slot);
      await slot(this.root.dataset.fss, this.isDir);
    }
  }

  async handleUploadFromJupyterBrowser(options: any) {
    Logger.debug('Treeitem upload user data');
    for (const slot of this.uploadFromJupyterBrowserSlots) {
      Logger.debug(slot);
      await slot(this.root.dataset.fss, this.isDir);
    }
  }

  async handleUploadUserData(options: any) {
    let is_browser_file_picker = false;
    let is_jup_browser_file = false;
    if (options) {
      is_browser_file_picker = options.is_browser_file_picker;
      is_jup_browser_file = options.is_jup_browser_file;
      this.model.queuedPickerUploadInfo = {}; // Context click always resets this data
    }
    Logger.debug('Treeitem upload user data');
    for (const slot of this.uploadUserDataSlots) {
      Logger.debug(slot);
      await slot(
        this.root.dataset.fss,
        this.isDir,
        is_browser_file_picker,
        is_jup_browser_file
      );
    }
  }

  setMetadata(user_path: string, size: string) {
    this.root.dataset.fss = user_path;
    this.root.dataset.fsize = size;

    const sizeDisplay = `(${size.toLocaleString()})`;
    // if (parseInt(size) > 100) {
    //     const sizeFormat = new Intl.NumberFormat(undefined, {
    //         notation: 'scientific',
    //     });
    //     sizeDisplay = `(${sizeFormat.format(parseInt(size))})`;
    // }
    this.sizeLbl.innerText = sizeDisplay;
  }

  setText(value: string) {
    this.nameLbl.innerText = value;
  }

  setType(symbol: 'dir' | 'file') {
    this.dirSymbol.replaceChildren();
    this.dirSymbol.style.visibility = 'visible';

    if (symbol === 'dir') {
      folderIcon.element({ container: this.dirSymbol });
      this.isDir = true;
      this.sizeLbl.style.display = 'none';
    }
    if (symbol === 'file') {
      fileIcon.element({ container: this.dirSymbol });
      this.isDir = false;
    }
  }

  handleDomMutation(records: any, observer: any) {
    // This is used to auto-expand directory-type TreeItem's to show children after
    // a lazy-load. It checks the TreeItem's shadow dom for the addition of an
    // "expand-collapse-button" child control which is used to expand and show
    // children (in the tree) of this class's root TreeItem node. By auto expanding here,
    // we save the user from having to click twice on a folder (once to lazy-load
    // and another time to expand) when they want to expand it
    if (this.lazyLoadAutoExpand && this.pendingExpandAction) {
      for (const rec of records) {
        const addedNodes = rec?.addedNodes;
        if (addedNodes) {
          for (const node of addedNodes) {
            if (
              node?.classList &&
              node.classList.contains('expand-collapse-button')
            ) {
              node.click();
              this.root.scrollTo();
              this.pendingExpandAction = false;
            }
          }
        }
      }
    }
  }

  handleClick(event: any) {
    // Filter click events to handle this item's root+shadow and container
    if (
      event.target === this.root ||
      this.container.contains(event.target) ||
      this.root.shadowRoot.contains(event.target)
    ) {
      // Handles normal click events on the TreeItem (unlike the MutationObserver system
      // which is for handling folder auto-expand after lazy load)
      if (this.clickAnywhereDoesAutoExpand) {
        const expander = this.root.shadowRoot.querySelector(
          '.expand-collapse-button'
        );
        if (expander) {
          const expRect = expander.getBoundingClientRect();
          if (
            event.clientX < expRect.left ||
            event.clientX > expRect.right ||
            event.clientY < expRect.top ||
            event.clientY > expRect.bottom
          ) {
            Logger.debug('--> Click outside expander, force expander click');
            expander.click();
            this.root.scrollTo();
          }
        }
      }
      // Fire connected slots that were supplied to this item on init
      if (this.isDir) {
        for (const slot of this.clickSlots) {
          slot(this.root.dataset.fss);
        }
      } else {
        this.root.click();
      }
    }
  }

  expandItem() {
    // This method's purpose is to expand folder items to show children
    // after a lazy load, but when this is called, the expand controls aren't
    // ready...a flag is set here to indicate that an expand action is desired,
    // which is used by the MutationObserver member var's handler to find the
    // expand/collapse Element when it is added so that it can be click()'d
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
    const context = new FssTreeItemContext(
      this.model,
      this.notebookTracker,
      this
    );
    context.root.dataset.fss = this.root.dataset.fss;
    const body = document.getElementsByTagName('body')[0];
    body.appendChild(context.root);

    // Position it under the mouse (top left corner normally,
    // or bottom right if that corner is out-of-viewport)
    const parentRect = body.getBoundingClientRect();
    const contextRect = context.root.getBoundingClientRect();
    let xCoord = event.clientX - parentRect.x;
    let yCoord = event.clientY - parentRect.y;
    const spacing = 12;
    if (
      xCoord + contextRect.width > window.innerWidth ||
      yCoord + contextRect.height > window.innerHeight
    ) {
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
