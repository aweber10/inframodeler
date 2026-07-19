import { expect, test } from '@playwright/test';

test('starts with an empty editable document', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.djs-shape')).toHaveCount(0);
  await expect(page).toHaveTitle('Unbenannt – InfraModeler');
  const canvasHeight = await page.locator('#canvas').evaluate((element) => element.getBoundingClientRect().height);
  const legendHeight = await page.locator('.app-footer').evaluate((element) => element.getBoundingClientRect().height);
  expect(canvasHeight).toBeGreaterThan(legendHeight * 5);
});

test('saves and reopens a diagram in browser mode', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-app-action="example"]').click();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-app-action="save"]').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const contents = Buffer.concat(chunks).toString('utf8');
  expect(download.suggestedFilename()).toBe('beispieldiagramm.imod.json');
  expect(JSON.parse(contents)).toMatchObject({ format: 'inframodeler', formatVersion: 1, title: 'Beispieldiagramm' });

  await page.locator('[data-app-action="new"]').click();
  await expect(page.locator('.djs-shape')).toHaveCount(0);

  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-app-action="open"]').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'beispiel.imod.json', mimeType: 'application/json', buffer: Buffer.from(contents) });
  await expect(page.locator('[data-element-id="module_webshop"]')).toBeVisible();
});

test('creates and edits a JDBC database through the context pad', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-app-action="example"]').click();

  const module = page.locator('[data-element-id="module_webshop"]');
  await expect(module).toBeVisible();
  await module.click();

  const appendDatabase = page.locator('.djs-context-pad [data-action="append.db"]');
  await expect(appendDatabase).toBeVisible();
  await appendDatabase.click();

  const databases = page.locator('.djs-shape').filter({ hasText: 'Datenbank' });
  await expect(databases).toHaveCount(1);
  await expect(page.locator('.djs-connection').filter({ hasText: 'JDBC' })).toHaveCount(2);

  const createdId = await databases.first().getAttribute('data-element-id');
  expect(createdId).toBeTruthy();
  const createdDatabase = page.locator(`[data-element-id="${createdId}"]`);
  await createdDatabase.locator('.djs-hit').dispatchEvent('dblclick');
  const editor = page.locator('.djs-direct-editing-content');
  await expect(editor).toBeVisible();
  await expect(editor).toHaveText('Datenbank');
  await editor.fill('Bestell-DB');
  await editor.press('Enter');
  await expect(createdDatabase).toContainText('Bestell-DB');

  await page.locator('#undo').click();
  await expect(createdDatabase).toContainText('Datenbank');
  await page.locator('#undo').click();
  await expect(databases).toHaveCount(0);
});

test('exposes M2 comfort tools', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-app-action="example"]').click();
  await expect(page.locator('.djs-palette [data-action="tool.lasso"]')).toBeVisible();

  const module = page.locator('[data-element-id="module_webshop"]');
  await module.click();
  await page.keyboard.press('ControlOrMeta+c');
  await page.mouse.move(600, 500);
  await page.keyboard.press('ControlOrMeta+v');
  await page.mouse.click(600, 500);

  await expect(page.locator('.djs-shape').filter({ hasText: 'Webshop' })).toHaveCount(2);
});

test('draws a connection from the context pad to a target', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-app-action="example"]').click();

  const source = page.locator('[data-element-id="system_crm"]');
  const target = page.locator('[data-element-id="database_customer"]');
  await source.click();

  const connect = page.locator('.djs-context-pad [data-action="connect"]');
  await connect.click();
  await target.click();

  await expect(page.locator('.djs-connection')).toHaveCount(4);
});
