import { Button } from '@jupyter/react-components';
import { ReactWidget } from '@jupyterlab/apputils';
import React, { useState } from 'react';
import { requestAPI } from './handler';

const MyButtonComponent = (): JSX.Element => {
  const [counter, setCounter] = useState(0);

  const handleClick = () => {
    alert(`Button Clicked ${counter} times!`);

    requestAPI<any>('hello')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The jupyterlab_examples_server server extension appears to be missing.\n${reason}`
        );
      });

    requestAPI<any>('list_files')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The jupyterlab_examples_server server extension appears to be missing.\n${reason}`
        );
      });
    setCounter(counter + 1);
  };

  return (
    <div>
      <h1>My Button Widget</h1>
      <Button onClick={handleClick}>Increment</Button>
    </div>
  );
};

export class MyButtonWidget extends ReactWidget {
  constructor() {
    super();
    this.addClass('jp-react-widget');
  }

  render(): JSX.Element {
    return <MyButtonComponent />;
  }
}
