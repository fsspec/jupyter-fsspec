import React from 'react';
import { useState, useEffect } from 'react';
import { TreeView, TreeItem } from '@jupyter/react-components';
import { listDirectory } from './handler/fileOperations';

interface IFileItem {
  name: string;
  type: string;
  ino: number;
}

interface IDirectoryContents {
  [key: string]: IFileItem[];
}

export const TreeComponent = (): JSX.Element => {
  const [fileStructure, setFileStructure] = useState([]);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [directoryContents, setDirectoryContents] =
    useState<IDirectoryContents>({});

  useEffect(() => {
    listDirectory('.')
      .then(data => {
        console.log('data[files] is: ', data['files']);
        setFileStructure(data['files']);
      })
      .catch(reason => {
        console.error(
          `The jupyterlab_examples_server server extension appears to be missing.\n${reason}`
        );
      });
  }, []);

  const handleExpand = (item: any) => {
    const itemName = item['name'];
    // determine items to include in set
    console.log('inside handleExpand!!!!');
    setExpandedItems(previousExpandedItems => {
      const newExpandedItems = new Set(previousExpandedItems);
      if (newExpandedItems.has(itemName)) {
        newExpandedItems.delete(itemName);
      } else {
        newExpandedItems.add(itemName);
        // fetch directory items if not already fetched
        if (!directoryContents[itemName]) {
          console.log('item is: ', item);
          console.log(`itemName is: ${itemName}`);
          listDirectory(item['name'])
            .then(data => {
              console.log('data[files] is: ', data['files']);
              setDirectoryContents(previousContents => ({
                ...previousContents,
                [item['name']]: data['files']
              }));
            })
            .catch(reason => {
              console.error(
                `The jupyterlab_examples_server server extension appears to be missing.\n${reason}`
              );
            });
        }
      }
      console.log('the expanded items are: ', newExpandedItems);
      return newExpandedItems;
    });
  };

  const handle_select = (item: any) => {
    console.log('item selected: ', item);
    handleExpand(item);
  };

  const isFolder = (type: any) => {
    if (type === 'directory') {
      console.log('it is a directory');
      return true;
    }
    return false;
  };

  const renderTreeItems = (items: any) => {
    return items.map((item: any) => {
      const { name, type, ino } = item;
      const itemPath = `${name}`;
      console.log(`itemPath is: ${itemPath}`);
      const isDirectory = isFolder(type);
      const isExpanded = expandedItems.has(item['name']);
      console.log('isExpanded is: ', isExpanded);

      return (
        <TreeItem
          key={ino}
          expanded={isExpanded}
          onSelect={() => handle_select(item)}
        >
          {/* TODO: Fix this so that you don't have to click a super small & off to the far left area */}
          <span
            onClick={() => {
              console.log(`itemPath from onClick is: ${itemPath}`);
              handleExpand(itemPath);
            }}
          >
            {isDirectory ? (isExpanded ? '-' : '+') : ''}
            {name}
          </span>
          {isDirectory &&
            isExpanded &&
            directoryContents[name] &&
            renderTreeItems(directoryContents[name])}
        </TreeItem>
      );
    });
  };

  return (
    <TreeView renderCollapsedNodes={false}>
      {renderTreeItems(fileStructure)}
    </TreeView>
  );
};
