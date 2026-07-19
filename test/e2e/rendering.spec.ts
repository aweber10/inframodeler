import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test('keeps long runtime labels inside their shape', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-app-action="example"]').click();
  const runtime = page.locator('[data-element-id="runtime_tomcat"]');
  await runtime.locator('.djs-hit').dispatchEvent('dblclick');
  const editor = page.locator('.djs-direct-editing-content');
  await editor.fill('WebSphere Liberty Production Runtime With A Long Name');
  await editor.press('Enter');

  const text = runtime.locator('.djs-visual text').last();
  expect(await text.textContent()).toBe('WebSphere Liberty Production Runtime With A Long Name');
  const textBox = await text.boundingBox();
  const shapeBox = await runtime.boundingBox();
  expect(textBox).toBeTruthy();
  expect(shapeBox).toBeTruthy();
  expect(textBox!.x + textBox!.width).toBeLessThanOrEqual(shapeBox!.x + shapeBox!.width);
});

test('docks all demo connections on source and target borders', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-app-action="example"]').click();

  const results = await page.evaluate(() => {
    const connections = [...document.querySelectorAll<SVGGElement>('.djs-connection')];
    return connections.map((connection) => {
      const path = connection.querySelector<SVGPathElement>('.djs-visual > path');
      const data = path?.getAttribute('d') ?? '';
      const points = [...data.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
      return { id: connection.dataset.elementId, start: points[0], end: points.at(-1) };
    });
  });

  const endpoints: Record<string, [string, string]> = {
    connection_jdbc: ['module_webshop', 'database_customer'],
    connection_https: ['actor_customer', 'module_webshop'],
    connection_esb: ['module_webshop', 'esb_corporate']
  };
  for (const result of results) {
    const endpoint = endpoints[result.id!];
    expect(endpoint, `known connection ${result.id}`).toBeTruthy();
    const [sourceId, targetId] = endpoint!;
    const source = await modelBounds(page, sourceId);
    const target = await modelBounds(page, targetId);
    expect(onBorder(result.start!, source), `${result.id} source`).toBe(true);
    expect(onBorder(result.end!, target), `${result.id} target`).toBe(true);
  }
});

async function modelBounds(page: Page, id: string) {
  return page.locator(`[data-element-id="${id}"]`).evaluate((element) => {
    const matrix = (element as SVGGElement).transform.baseVal.consolidate()!.matrix;
    const hit = element.querySelector<SVGRectElement>(':scope > .djs-hit')!;
    return { x: matrix.e, y: matrix.f, width: hit.width.baseVal.value, height: hit.height.baseVal.value };
  });
}

function onBorder(point: { x: number; y: number }, bounds: { x: number; y: number; width: number; height: number }): boolean {
  const epsilon = 1;
  const insideX = point.x >= bounds.x - epsilon && point.x <= bounds.x + bounds.width + epsilon;
  const insideY = point.y >= bounds.y - epsilon && point.y <= bounds.y + bounds.height + epsilon;
  const borderX = Math.abs(point.x - bounds.x) <= epsilon || Math.abs(point.x - bounds.x - bounds.width) <= epsilon;
  const borderY = Math.abs(point.y - bounds.y) <= epsilon || Math.abs(point.y - bounds.y - bounds.height) <= epsilon;
  return insideX && insideY && (borderX || borderY);
}
