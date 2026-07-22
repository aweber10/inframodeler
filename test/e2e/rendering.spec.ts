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

test('parents a cross-container connection under the common ancestor, not the source container', async ({ page }) => {
  await page.goto('/');

  // A module in server_a talks to a db in server_b (both inside the same zone). diagram-js would
  // parent the connection under server_a (source.parent), leaving it trapped in server_a's children
  // group where server_b - painted later - covers the arrowhead reaching into the db. It must be
  // parented under the zone (the common ancestor) instead.
  const file = {
    format: 'inframodeler',
    formatVersion: 1,
    title: 'CrossContainer',
    elements: [
      { id: 'zone_1', type: 'zone', name: 'z', x: 40, y: 40, w: 900, h: 400 },
      { id: 'server_a', type: 'server', name: 'A', x: 80, y: 100, w: 300, h: 200, parent: 'zone_1' },
      { id: 'module_1', type: 'module', name: 'App', x: 110, y: 160, w: 156, h: 46, parent: 'server_a' },
      { id: 'server_b', type: 'server', name: 'B', x: 520, y: 100, w: 300, h: 200, parent: 'zone_1' },
      { id: 'db_1', type: 'db', name: 'DB', x: 560, y: 170, w: 132, h: 88, parent: 'server_b' }
    ],
    connections: [
      {
        id: 'connection_cross', source: 'module_1', target: 'db_1', kind: 'communication', label: 'JDBC',
        waypoints: [{ x: 266, y: 183 }, { x: 626, y: 214 }]
      }
    ]
  };

  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-app-action="open"]').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'cross.imod.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });

  await expect(page.locator('[data-element-id="connection_cross"]')).toBeVisible();

  const groupInfo = await page.evaluate(() => {
    const idOf = (group: Element | null | undefined): string | null => {
      const el = group?.querySelector(':scope > .djs-element') as SVGGElement | undefined;
      return el?.getAttribute('data-element-id') ?? null;
    };
    const connection = document.querySelector<SVGGElement>('.djs-element[data-element-id="connection_cross"]');
    const server = document.querySelector<SVGGElement>('.djs-element[data-element-id="server_b"]');
    const connectionGroup = connection?.closest('.djs-group');
    const serverGroup = server?.closest('.djs-group');
    // The connection's containing children group belongs to which element?
    const owner = idOf(connectionGroup?.parentElement?.closest('.djs-group'));
    const following = Node.DOCUMENT_POSITION_FOLLOWING;
    const afterServerB = Boolean(connectionGroup && serverGroup && (serverGroup.compareDocumentPosition(connectionGroup) & following));
    return { owner, afterServerB };
  });

  // Parented under the zone (common ancestor), and painted after server_b so its cube cannot cover
  // the arrowhead.
  expect(groupInfo.owner).toBe('zone_1');
  expect(groupInfo.afterServerB).toBe(true);
});

test('reparents a connection when its target is dragged into a container', async ({ page }) => {
  await page.goto('/');

  // A module sits next to a server (holding a runtime) at root level, connected from an actor.
  // After dragging the module into the runtime, the connection's common ancestor becomes the
  // server, so the connection must be re-parented there (painting above the server cube) - not left
  // behind at root level where the cube would cover the arrowhead reaching into the module.
  const file = {
    format: 'inframodeler',
    formatVersion: 1,
    title: 'DragIn',
    elements: [
      { id: 'server_1', type: 'server', name: 'srv', x: 400, y: 120, w: 320, h: 220 },
      { id: 'syssoft_1', type: 'syssoft', name: 'Tomcat', x: 430, y: 170, w: 250, h: 140, parent: 'server_1' },
      { id: 'module_1', type: 'module', name: 'App', x: 120, y: 200, w: 156, h: 46 },
      { id: 'actor_1', type: 'actor', name: 'User', x: 40, y: 200, w: 64, h: 82 }
    ],
    connections: [
      {
        id: 'connection_https', source: 'actor_1', target: 'module_1', kind: 'communication', label: 'HTTPS',
        waypoints: [{ x: 104, y: 223 }, { x: 120, y: 223 }]
      }
    ]
  };

  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-app-action="open"]').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'dragin.imod.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });

  const moduleShape = page.locator('[data-element-id="module_1"]');
  await expect(moduleShape).toBeVisible();
  await moduleShape.locator('.djs-hit').click({ force: true });

  // Drag the module into the runtime shape (overcome the move threshold with an intermediate step).
  const from = await moduleShape.locator('.djs-hit').boundingBox();
  const runtime = await page.locator('[data-element-id="syssoft_1"] .djs-hit').first().boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2 + 20, from!.y + from!.height / 2 + 20, { steps: 5 });
  await page.mouse.move(runtime!.x + runtime!.width / 2, runtime!.y + runtime!.height / 2, { steps: 15 });
  await page.mouse.up();

  // The module is now a descendant of the server; so must the connection be.
  await expect.poll(async () => page.evaluate(() => {
    const module = document.querySelector<SVGGElement>('.djs-element[data-element-id="module_1"]');
    const runtime = document.querySelector<SVGGElement>('.djs-element[data-element-id="syssoft_1"]');
    return Boolean(runtime?.closest('.djs-group')?.contains(module!));
  })).toBe(true);

  const result = await page.evaluate(() => {
    const connection = document.querySelector<SVGGElement>('.djs-element[data-element-id="connection_https"]');
    const server = document.querySelector<SVGGElement>('.djs-element[data-element-id="server_1"]');
    if (!connection || !server) return { paintsLast: false, reachesIntoServer: false };

    // The connection must paint after the server so its cube cannot cover the arrowhead.
    const paintsLast = Boolean(server.compareDocumentPosition(connection) & Node.DOCUMENT_POSITION_FOLLOWING);

    // And it must be the last among its siblings (guaranteed by the reparent-to-front behaviour),
    // so a later containment refresh cannot push a sibling container on top of it.
    const connectionGroup = connection.closest('.djs-group')!;
    const siblings = connectionGroup.parentElement!.children;
    const isLastSibling = siblings[siblings.length - 1] === connectionGroup;

    return { paintsLast, isLastSibling };
  });

  expect(result.paintsLast).toBe(true);
  expect(result.isLastSibling).toBe(true);
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
