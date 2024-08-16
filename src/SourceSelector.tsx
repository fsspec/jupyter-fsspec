import React from 'react';
import { Select, Option } from '@jupyter/react-components';

export const SelectOptionComponent = (): JSX.Element => {
  const onSelectionChange = (event: any) => {
    console.log('changed to: ', event.target.value);
  };

  return (
    <div className="jp-FlexColumn">
      <label>Select</label>
      <Select onChange={onSelectionChange}>
        <Option>Option Label #1</Option>
        <Option>Option Label #2</Option>
        <Option>Option Label #3</Option>
      </Select>
    </div>
  );
};
