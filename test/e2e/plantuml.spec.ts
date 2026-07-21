import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const fixturePath = fileURLToPath(new URL('../fixtures/plantuml/Kontext_und_Schnittstellen_PROD.pu', import.meta.url));
const fixture = readFileSync(fixturePath);

test('imports a PlantUML file through the existing open action', async ({ page }) => {
  await page.goto('/');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-app-action="open"]').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'Kontext_und_Schnittstellen_PROD.pu',
    mimeType: 'text/plain',
    buffer: fixture
  });

  await expect(page.locator('#plantuml-import-dialog')).toBeVisible();
  await expect(page.locator('[data-import-summary]')).toContainText('Elemente werden importiert');
  await page.locator('[data-import="confirm"]').click();

  await expect(page.locator('.djs-shape').filter({ hasText: 'Schadenmanagementsystem SAM' })).toHaveCount(1);
  await expect(page.locator('.djs-shape').filter({ hasText: 'Websphere Liberty Profile' })).toHaveCount(1);
  await expect(page.locator('.djs-shape').filter({ hasText: 'SAMP' })).toHaveCount(1);
  await expect(page).toHaveTitle(/● Übersicht SAM - Prod/);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-app-action="save"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('uebersicht-sam-prod-kontext-und-schnittstellen.imod.json');
});

test('cancelled PlantUML import keeps the existing diagram', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-app-action="example"]').click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-app-action="open"]').click();
  await page.locator('[data-choice="discard"]').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'context.pu', mimeType: 'text/plain', buffer: fixture });
  await page.locator('[data-import="cancel"]').click();
  await expect(page.locator('[data-element-id="module_webshop"]')).toBeVisible();
});
