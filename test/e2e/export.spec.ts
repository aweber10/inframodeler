import { expect, test } from '@playwright/test';
import type { Download } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('inframodeler.browserRecovery'));
  await page.reload();
});

test('shows help only while the canvas is empty', async ({ page }) => {
  const help = page.locator('#empty-canvas-help');
  await expect(help).toBeVisible();
  await page.locator('[data-app-action="example"]').click();
  await expect(help).toBeHidden();
  await page.locator('[data-app-action="new"]').click();
  await page.locator('[data-choice="discard"]').click();
  await expect(help).toBeVisible();
});

test('exports a standalone SVG without changing dirty state', async ({ page }) => {
  await page.locator('[data-app-action="example"]').click();
  const titleBefore = await page.title();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-app-action="exportSvg"]').click();
  const download = await downloadPromise;
  const contents = await readDownload(download);

  expect(download.suggestedFilename()).toBe('beispieldiagramm.svg');
  expect(contents).toContain('<svg');
  expect(contents).toContain('data:font/woff2;base64,');
  expect(contents).toContain('id="infra-arrow"');
  expect(contents).not.toContain('djs-hit');
  expect(contents).not.toContain('djs-outline');
  expect(await page.title()).toBe(titleBefore);
});

async function readDownload(download: Download): Promise<string> {
  return (await readDownloadBuffer(download)).toString('utf8');
}

async function readDownloadBuffer(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
