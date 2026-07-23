import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const fixturePath = fileURLToPath(new URL('../fixtures/plantuml/anonymized_system_landscape.pu', import.meta.url));
const fixture = readFileSync(fixturePath);

test('imports a PlantUML file through the existing open action', async ({ page }) => {
  await page.goto('/');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-app-action="open"]').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'anonymized_system_landscape.pu',
    mimeType: 'text/plain',
    buffer: fixture
  });

  await expect(page.locator('#plantuml-import-dialog')).toBeVisible();
  await expect(page.locator('[data-import-summary]')).toContainText('Elemente werden importiert');
  await page.locator('[data-import="confirm"]').click();

  await expect(page.locator('.djs-shape').filter({ hasText: 'Orion Platform' })).toHaveCount(1);
  await expect(page.locator('.djs-shape').filter({ hasText: 'Example Runtime' })).toHaveCount(1);
  await expect(page.locator('.djs-shape').filter({ hasText: 'Orion Database' })).toHaveCount(1);
  await expect(page).toHaveTitle(/● Orion Platform - Production/);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-app-action="save"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('orion-platform-production-system-landscape.imod.json');
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
