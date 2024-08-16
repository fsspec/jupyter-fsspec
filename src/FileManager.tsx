import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import { TreeComponent } from './Tree';
import { SelectOptionComponent } from './SourceSelector';

const FileManagerComponent = (): JSX.Element => {
  return (
    <div>
      <SelectOptionComponent />
      <TreeComponent />
    </div>
  );
};

export class FileManagerWidget extends ReactWidget {
  constructor() {
    super();
    this.addClass('jp-react-widget');
    this.addClass('jp-fsspec-widget');
    console.log('node is: ', this.node);
  }

  render(): JSX.Element {
    return <FileManagerComponent />;
  }
}
