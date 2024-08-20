import React from 'react';
import { Select, Option } from '@jupyter/react-components';
// import { updateFile } from './handler/fileOperations';

export const DebugPanel = (): JSX.Element => {
  const onSelectionChange = (event: any) => {
    console.log('changed to: ', event.target.value);
    // const request_type = event.target.value;
    // const file_path = '/Users/rosioreyes/Desktop/test_fsspec/B/text1.txt';

    // switch (request_type) {
    //   case 'Post':
    //     updateFile(file_path, false, 'local', 'This is a test post!!!')
    //       .then(data => {
    //         console.log('data is: ', data);
    //       })
    //       .catch(reason => {
    //         console.error(
    //           `The jupyterlab_examples_server server extension appears to be missing.\n${reason}`
    //         );
    //       });
    //     console.log('post request');
    //     break;
    //   case 'Get':
    //     console.log('get request');
    //     break;
    //   case 'Delete':
    //     console.log('Delete request');
    //     break;
    //   case 'Update':
    //     console.log('Update request');
    //     break;
    //   default:
    //     console.log('Unsupported selection');
    // }
  };

  return (
    <div className="jp-FlexColumn">
      <label>Select</label>
      <Select onChange={onSelectionChange}>
        <Option>Post</Option>
        <Option>Get</Option>
        <Option>Delete</Option>
        <Option>Update</Option>
      </Select>
    </div>
  );
};
