import { Widget } from '@lumino/widgets';

import { Logger } from './logger';

export class FssFileUploadContextPopup extends Widget {
  private readonly logger = Logger.getLogger('FssFileUploadContextPopup');

  root: any;
  pathField: any;

  constructor() {
    super();
    this.id = 'FssFileUploadContextPopup';

    this.root = document.createElement('div');
    this.root.classList.add('jfss-file-upload-context-popup');
    this.node.appendChild(this.root);

    const bodyText = document.createElement('div');
    bodyText.innerText = 'File name:';
    this.root.appendChild(bodyText);

    this.pathField = document.createElement('input');
    this.pathField.classList.add('jfss-file-upload-context-popup');
    this.pathField.addEventListener(
      'input',
      this.handlePathTextUpdate.bind(this)
    );
    this.root.appendChild(this.pathField);
  }

  handlePathTextUpdate(event: any) {
    this.logger.debug(`${event}`);
  }

  getValue() {
    return this.pathField.value;
  }
}
