import { expect, test } from '@jupyterlab/galata';

/**
 * Don't load JupyterLab webpage before running the tests.
 * This is required to ensure we capture all log messages.
 */
test.use({ autoGoto: false });

test('should emit an activation console message', async ({ page }) => {
  const logs: string[] = [];

  page.on('console', message => {
    logs.push(message.text());
  });

  await page.goto();

  const activationLogs = logs.filter(log => {
    return log.includes('JupyterLab extension jupyterFsspec is activated!');
  });

  expect(activationLogs).toHaveLength(1);

  expect(activationLogs[0]).toContain('[INFO]');
});
