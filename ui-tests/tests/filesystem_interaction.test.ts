import { expect, test } from '@jupyterlab/galata';

test('test open jupyterFsspec with empty config', async ({ page }) => {
  await page.getByText('FSSpec', { exact: true }).click();
  await expect
    .soft(page.getByRole('link', { name: '⚠ No configured filesystems' }))
    .toBeVisible();
  await expect.soft(page.locator('.jfss-resultarea')).toBeVisible();
});
