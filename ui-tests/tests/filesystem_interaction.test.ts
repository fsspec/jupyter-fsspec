import { expect, test } from '@jupyterlab/galata';

test.use({
  autoGoto: false,
  contextOptions: {
    permissions: ['clipboard-read', 'clipboard-write']
  }
});

const config = {
  status: 'success',
  description: 'Retrieved available filesystems from configuration file.',
  content: [
    {
      key: 'mymem',
      name: 'mymem',
      protocol: 'memory',
      path: '/mymemoryfs',
      canonical_path: 'memory:///mymemoryfs'
    }
  ]
};

const updateConfig = {
  status: 'success',
  description: 'Retrieved available filesystems from configuration file.',
  content: [
    {
      key: 'secondMem',
      name: 'secondMem',
      protocol: 'memory',
      path: '/second_memoryfs',
      canonical_path: 'memory:///second_memoryfs'
    },
    {
      key: 'mymem',
      name: 'mymem',
      protocol: 'memory',
      path: '/mymemoryfs',
      canonical_path: 'memory:///mymemoryfs'
    }
  ]
};

const emptyConfig = {
  status: 'success',
  description: 'Retrieved available filesystems from configuration file.',
  content: []
};

const rootMyMemFs = {
  status: 'success',
  description: 'Retrieved /mymemoryfs',
  content: [
    {
      name: '/mymemoryfs/mydocs',
      type: 'directory',
      size: 128,
      ino: 49648960,
      mode: 16877
    },
    {
      name: '/mymemoryfs/myfile.txt',
      type: 'file',
      size: 128,
      ino: 49648960,
      mode: 33188
    },
    {
      name: '/mymemoryfs/otherdocs',
      type: 'directory',
      size: 2002,
      ino: 13894260,
      mode: 16877
    }
  ]
};

const myMemFsDirectory = {
  status: 'success',
  description: 'Retrieved /mymemoryfs/mydocs',
  content: [
    {
      name: '/mymemoryfs/mydocs/file1.csv',
      type: 'file',
      size: 7464,
      ino: 49648230,
      mode: 33204
    },
    {
      name: '/mymemoryfs/mydocs/file2.csv',
      type: 'file',
      size: 3872,
      ino: 49429060,
      mode: 33188
    }
  ]
};

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8888/jupyter_fsspec/config?**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(config)
    });
  });

  // intercept request for filesystem root files
  await page.route(
    'http://localhost:8888/jupyter_fsspec/files?key=mymem&item_path=&type=default&**',
    route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rootMyMemFs)
      });
    }
  );
});

test('test open jupyterFsspec with empty config', async ({ page }) => {
  await page.route('http://localhost:8888/jupyter_fsspec/config?**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyConfig)
    });
  });

  await page.goto('');
  await page.getByText('FSSpec', { exact: true }).click();
  await expect
    .soft(page.getByRole('link', { name: '⚠ No configured filesystems' }))
    .toBeVisible();
  await expect.soft(page.locator('.jfss-resultarea')).toBeVisible();
});

test('test memory filesystem with mock config data', async ({ page }) => {
  await page.goto();
  await page.getByText('FSSpec', { exact: true }).click();

  // verify filesystem item was created
  await expect.soft(page.locator('.jfss-fsitem-root')).toBeVisible();

  // filesystem details should match as expected
  await expect.soft(page.locator('.jfss-fsitem-name')).toBeVisible();
  await expect.soft(page.locator('.jfss-fsitem-name')).toHaveText('mymem');
  await expect
    .soft(page.locator('.jfss-fsitem-protocol'))
    .toHaveText('Path: /mymemoryfs');
});

test('test interacting with a filesystem', async ({ page }) => {
  page.on('console', logMsg => console.log('[BROWSER OUTPUT] ', logMsg.text()));
  await page.goto();
  await page.getByText('FSSpec', { exact: true }).click();
  await expect.soft(page.locator('.jfss-fsitem-root')).toBeVisible();

  // Select the filesystem
  await page.locator('.jfss-fsitem-root').click();

  // Verify the filesystem name is updated in lower area
  await expect.soft(page.locator('.jfss-selectedFsLabel')).toHaveText('mymem');

  const treeItems = await page
    .locator('jp-tree-view')
    .locator('jp-tree-item')
    .filter({
      has: page.locator(':visible')
    });
  const countTreeItems = await treeItems.count();
  const elements = await treeItems.elementHandles();
  for (const element of elements) {
    console.log(await element.evaluate(el => el.textContent));
  }
  expect(countTreeItems).toEqual(3);
});

test('test copy path', async ({ page }) => {
  await page.goto();
  await page.getByText('FSSpec', { exact: true }).click();
  await expect.soft(page.locator('.jfss-fsitem-root')).toBeVisible();

  // Click on filesystem
  await page.locator('.jfss-fsitem-root').click();

  // Right-click first item (directory) in tree
  await page.getByText('mydocs', { exact: true }).click({ button: 'right' });

  // Wait for pop up
  await expect.soft(page.getByText('Copy Path')).toBeVisible();
  await page.getByText('Copy Path').click();

  const copiedText = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedText).toEqual('memory:///mymemoryfs/mydocs');
});

test('test expanding directory', async ({ page }) => {
  await page.goto();
  await page.getByText('FSSpec', { exact: true }).click();
  await expect.soft(page.locator('.jfss-fsitem-root')).toBeVisible();

  // select the filesystem
  await page.locator('.jfss-fsitem-root').click();

  // intercept request for filesystem subdirectory files
  await page.route(
    'http://localhost:8888/jupyter_fsspec/files?key=mymem&item_path=%2Fmymemoryfs%2Fmydocs&type=default&**',
    route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(myMemFsDirectory)
      });
    }
  );

  // Select first item (folder)
  await page.getByText('mydocs', { exact: true }).click({ button: 'left' });
  await page.waitForTimeout(2000);

  const countSubdirItems = await page
    .locator('jp-tree-view')
    .locator('jp-tree-item.expanded')
    .locator('jp-tree-item')
    .count();
  expect(countSubdirItems).toEqual(2);
});

test('test refresh for updated config', async ({ page }) => {
  await page.goto();
  await page.getByText('FSSpec', { exact: true }).click();

  // verify original config is present
  const originalFilesystems = page.locator('.jfss-fsitem-root');
  const firstFilesystemsCount = await originalFilesystems.count();
  expect(firstFilesystemsCount).toEqual(1);

  await page.route('http://localhost:8888/jupyter_fsspec/config?**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(updateConfig)
    });
  });

  await page.getByText('↻').click();

  // verify updated config has two filesystem items
  const updatedFilesystems = page.locator('.jfss-fsitem-root');
  const updatedFilesystemsCount = await updatedFilesystems.count();
  expect(updatedFilesystemsCount).toEqual(2);
});

test('copy open with code block', async ({ page }) => {
  // activate extension from launcher page
  await page.goto();
  await page.getByText('FSSpec', { exact: true }).click();

  await page.locator('.jfss-fsitem-root').click();
  await page
    .getByText('myfile.txt', { exact: true })
    .click({ button: 'right' });

  await expect.soft(page.getByText('Copy `open` code block')).toBeVisible();
  await page.getByText('Copy `open` code block').click();

  const copiedText = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedText).toEqual(
    `with fsspec.open("memory:///mymemoryfs/myfile.txt", "rt") as f:\n   for line in f:\n      print(line)`
  );
});

test('copy open with code block with active notebook cell', async ({
  page
}) => {
  await page.goto();
  await page.getByText('FSSpec', { exact: true }).click();
  await page.locator('.jfss-fsitem-root').click();

  // open a notebook
  await page.notebook.createNew();
  await page.waitForTimeout(1000);

  // add a cell with some content
  const cellText = '# This is a code cell.';
  await page.notebook.addCell('code', cellText);

  const copyCodeBlock = `with fsspec.open("memory:///mymemoryfs/myfile.txt", "rt") as f:\n   for line in f:\n      print(line)`;

  await page
    .getByText('myfile.txt', { exact: true })
    .click({ button: 'right' });

  // click copy code block
  await expect.soft(page.getByText('Copy `open` code block')).toBeVisible();
  await page.getByText('Copy `open` code block').click();

  // verify the clipboard contents
  const copiedText = await page.evaluate(() => navigator.clipboard.readText());
  console.log('copiedText: ');
  console.log(copiedText);
  expect(copiedText).toEqual(copyCodeBlock);

  // // verify the cell contents # TODO: debug cell content grab
  // const fullText = cellText + '\n' + copyCodeBlock;
  // const finalCellContent = await page.notebook.getCellTextInput(1);
  // expect(finalCellContent).toEqual(fullText);

  // WORKAROUND
  const content = await page.evaluate(() => {
    const cell = document.querySelector('.jp-Notebook .jp-Cell:nth-child(2)');
    return cell ? cell.textContent : null;
  });
  expect(content?.includes(cellText));
  expect(content?.includes(copyCodeBlock));
});
