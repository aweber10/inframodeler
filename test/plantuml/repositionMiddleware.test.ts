import { describe, expect, it } from 'vitest';

import { repositionMiddleware, resolveNoteOverlaps } from '../../src/app/import/plantuml/mapper';
import { MIDDLEWARE_CLEARANCE } from '../../src/app/import/plantuml/layout-constants';
import type { DiagramElementRecord } from '../../src/app/serialization/format';

type Adjacency = Map<string, Map<string, number>>;

function element(id: string, type: DiagramElementRecord['type'], x: number, y: number, w: number, h: number, parent?: string): DiagramElementRecord {
  return { id, type, name: id, x, y, w, h, ...(parent ? { parent } : {}) };
}

function adjacencyOf(pairs: Array<[string, string, number]>): Adjacency {
  const map: Adjacency = new Map();
  const bump = (a: string, b: string, weight: number) => {
    const inner = map.get(a) ?? new Map<string, number>();
    inner.set(b, (inner.get(b) ?? 0) + weight);
    map.set(a, inner);
  };
  for (const [a, b, weight] of pairs) {
    bump(a, b, weight);
    bump(b, a, weight);
  }
  return map;
}

function center(record: DiagramElementRecord): { x: number; y: number } {
  return { x: record.x + record.w / 2, y: record.y + record.h / 2 };
}

describe('repositionMiddleware', () => {
  it('leaves a middleware element without connections untouched', () => {
    const esb = element('esb_1', 'esb', 100, 100, 240, 56);
    const records = [esb];
    repositionMiddleware(records, new Map());
    expect(esb).toMatchObject({ x: 100, y: 100 });
  });

  it('places a middleware element at the centroid of two neighbours', () => {
    const a = element('module_1', 'module', 0, 0, 100, 40);
    const b = element('db_1', 'db', 400, 400, 100, 40);
    const esb = element('esb_1', 'esb', 800, 800, 240, 56);
    const records = [a, b, esb];

    repositionMiddleware(records, adjacencyOf([['esb_1', 'module_1', 1], ['esb_1', 'db_1', 1]]));

    // Centroid of the two neighbour centres is (250, 220); esb centre should land there.
    expect(center(esb).x).toBeCloseTo(250, 5);
    expect(center(esb).y).toBeCloseTo(220, 5);
  });

  it('weights the centroid by connection strength', () => {
    const a = element('module_1', 'module', 0, 500, 100, 40);
    const b = element('module_2', 'module', 1200, 500, 100, 40);
    const esb = element('esb_1', 'esb', 3000, 3000, 240, 56);
    const records = [a, b, esb];

    repositionMiddleware(records, adjacencyOf([['esb_1', 'module_1', 3], ['esb_1', 'module_2', 1]]));

    // Weighted towards module_1 (centre x=50) over module_2 (centre x=1250): (50*3 + 1250*1) / 4 = 350.
    expect(center(esb).x).toBeCloseTo(350, 5);
  });

  it('nudges a single-neighbour middleware next to its partner', () => {
    const partner = element('module_1', 'module', 0, 0, 100, 40);
    const esb = element('esb_1', 'esb', 500, 0, 240, 56);
    const records = [partner, esb];

    repositionMiddleware(records, adjacencyOf([['esb_1', 'module_1', 1]]));

    // esb was to the right of the partner, so it stays on the right, separated by a gap.
    expect(esb.x).toBeGreaterThan(partner.x + partner.w);
    expect(center(esb).y).toBeCloseTo(center(partner).y, 5);
  });

  it('clamps the target inside the parent zone without reparenting', () => {
    const zone = element('zone_1', 'zone', 0, 0, 300, 300);
    const a = element('module_1', 'module', 2000, 2000, 100, 40);
    const b = element('db_1', 'db', 2400, 2400, 100, 40);
    const esb = element('esb_1', 'esb', 20, 20, 200, 56, 'zone_1');
    const records = [zone, a, b, esb];

    repositionMiddleware(records, adjacencyOf([['esb_1', 'module_1', 1], ['esb_1', 'db_1', 1]]));

    expect(esb.x).toBeGreaterThanOrEqual(zone.x);
    expect(esb.y).toBeGreaterThanOrEqual(zone.y);
    expect(esb.x + esb.w).toBeLessThanOrEqual(zone.x + zone.w);
    expect(esb.y + esb.h).toBeLessThanOrEqual(zone.y + zone.h);
    expect(esb.parent).toBe('zone_1');
  });

  it('resolves overlap with a sibling after repositioning', () => {
    const a = element('module_1', 'module', 0, 0, 100, 40);
    const b = element('module_2', 'module', 400, 0, 100, 40);
    // A sibling sitting exactly at the centroid the esb would target.
    const sibling = element('db_1', 'db', 220, -20, 100, 80);
    const esb = element('esb_1', 'esb', 900, 900, 100, 40);
    const records = [a, b, sibling, esb];

    repositionMiddleware(records, adjacencyOf([['esb_1', 'module_1', 1], ['esb_1', 'module_2', 1]]));

    const overlaps = esb.x < sibling.x + sibling.w && esb.x + esb.w > sibling.x && esb.y < sibling.y + sibling.h && esb.y + esb.h > sibling.y;
    expect(overlaps).toBe(false);
  });

  it('does not place a middleware on top of an unrelated component in another container', () => {
    // esb lives in zone_1, its centroid target lands on a component parented to zone_2.
    const zone1 = element('zone_1', 'zone', 0, 0, 2000, 2000);
    const zone2 = element('zone_2', 'zone', 0, 0, 2000, 2000);
    const a = element('module_1', 'module', 200, 200, 100, 40);
    const b = element('module_2', 'module', 600, 200, 100, 40);
    const foreign = element('db_1', 'db', 380, 180, 100, 80, 'zone_2');
    const esb = element('esb_1', 'esb', 50, 50, 100, 40, 'zone_1');
    const records = [zone1, zone2, a, b, foreign, esb];

    repositionMiddleware(records, adjacencyOf([['esb_1', 'module_1', 1], ['esb_1', 'module_2', 1]]));

    const hit = esb.x < foreign.x + foreign.w && esb.x + esb.w > foreign.x && esb.y < foreign.y + foreign.h && esb.y + esb.h > foreign.y;
    expect(hit).toBe(false);
  });

  it('separates two middleware elements that would land on the same spot', () => {
    const a = element('module_1', 'module', 0, 0, 100, 40);
    const b = element('module_2', 'module', 1000, 0, 100, 40);
    const esb1 = element('esb_1', 'esb', 5000, 5000, 100, 40);
    const esb2 = element('esb_2', 'esb', 6000, 6000, 100, 40);
    const records = [a, b, esb1, esb2];

    repositionMiddleware(records, adjacencyOf([
      ['esb_1', 'module_1', 1], ['esb_1', 'module_2', 1],
      ['esb_2', 'module_1', 1], ['esb_2', 'module_2', 1]
    ]));

    const overlap = esb1.x < esb2.x + esb2.w && esb1.x + esb1.w > esb2.x && esb1.y < esb2.y + esb2.h && esb1.y + esb1.h > esb2.y;
    expect(overlap).toBe(false);
  });

  it('does not overlap a foreign network zone when bridging two zones', () => {
    // A root-level esb bridging components in two zones. Its centroid would land inside zone_2;
    // foreign zones must be treated as obstacles so the esb ends up off of them.
    const zone1 = element('zone_1', 'zone', 0, 0, 400, 400);
    const zone2 = element('zone_2', 'zone', 500, 0, 600, 400);
    const inZone1 = element('module_1', 'module', 40, 180, 100, 40, 'zone_1');
    const inZone2 = element('module_2', 'module', 700, 180, 100, 40, 'zone_2');
    const esb = element('esb_1', 'esb', 3000, 3000, 200, 56);
    const records = [zone1, zone2, inZone1, inZone2, esb];

    repositionMiddleware(records, adjacencyOf([['esb_1', 'module_1', 1], ['esb_1', 'module_2', 1]]));

    for (const zone of [zone1, zone2]) {
      const hit = esb.x < zone.x + zone.w && esb.x + esb.w > zone.x && esb.y < zone.y + zone.h && esb.y + esb.h > zone.y;
      expect(hit, `esb must not overlap ${zone.id}`).toBe(false);
    }
  });

  it('keeps a clearance margin between the middleware and a foreign zone border', () => {
    const zone1 = element('zone_1', 'zone', 0, 0, 400, 400);
    const zone2 = element('zone_2', 'zone', 500, 0, 600, 400);
    const inZone1 = element('module_1', 'module', 40, 180, 100, 40, 'zone_1');
    const inZone2 = element('module_2', 'module', 700, 180, 100, 40, 'zone_2');
    const esb = element('esb_1', 'esb', 3000, 3000, 200, 56);
    const records = [zone1, zone2, inZone1, inZone2, esb];

    repositionMiddleware(records, adjacencyOf([['esb_1', 'module_1', 1], ['esb_1', 'module_2', 1]]));

    // Distance to every foreign zone border must be at least the configured clearance.
    for (const zone of [zone1, zone2]) {
      const separatedX = esb.x >= zone.x + zone.w + MIDDLEWARE_CLEARANCE || esb.x + esb.w <= zone.x - MIDDLEWARE_CLEARANCE;
      const separatedY = esb.y >= zone.y + zone.h + MIDDLEWARE_CLEARANCE || esb.y + esb.h <= zone.y - MIDDLEWARE_CLEARANCE;
      expect(separatedX || separatedY, `clearance to ${zone.id}`).toBe(true);
    }
  });

  it('does not remain on top of densely nested modules (module overlap regression)', () => {
    // A server with a runtime and two modules, tightly packed - the esb target lands right on them.
    const server = element('server_1', 'server', 0, 0, 260, 240);
    const runtime = element('syssoft_1', 'syssoft', 20, 40, 220, 180, 'server_1');
    const module1 = element('module_1', 'module', 40, 80, 156, 46, 'syssoft_1');
    const module2 = element('module_2', 'module', 40, 140, 156, 46, 'syssoft_1');
    const partner = element('db_1', 'db', 600, 100, 100, 80);
    const esb = element('esb_1', 'esb', 5000, 5000, 200, 56);
    const records = [server, runtime, module1, module2, partner, esb];

    repositionMiddleware(records, adjacencyOf([['esb_1', 'module_1', 1], ['esb_1', 'db_1', 1]]));

    for (const other of [server, runtime, module1, module2, partner]) {
      const hit = esb.x < other.x + other.w && esb.x + esb.w > other.x && esb.y < other.y + other.h && esb.y + esb.h > other.y;
      expect(hit, `esb must not overlap ${other.id}`).toBe(false);
    }
  });
});

describe('resolveNoteOverlaps', () => {
  it('moves a note off an unrelated component it was placed on top of', () => {
    const component = element('module_1', 'module', 100, 100, 156, 46);
    const note = element('note_1', 'note', 120, 110, 190, 56);
    const records = [component, note];

    resolveNoteOverlaps(records);

    const hit = note.x < component.x + component.w && note.x + note.w > component.x && note.y < component.y + component.h && note.y + note.h > component.y;
    expect(hit).toBe(false);
  });

  it('separates two notes stacked on the same position', () => {
    const target = element('module_1', 'module', 0, 0, 156, 46);
    const note1 = element('note_1', 'note', 200, 0, 190, 56);
    const note2 = element('note_2', 'note', 210, 10, 190, 56);
    const records = [target, note1, note2];

    resolveNoteOverlaps(records);

    const overlap = note1.x < note2.x + note2.w && note1.x + note1.w > note2.x && note1.y < note2.y + note2.h && note1.y + note1.h > note2.y;
    expect(overlap).toBe(false);
  });

  it('does not treat a note as overlapping its own parent zone', () => {
    const zone = element('zone_1', 'zone', 0, 0, 1000, 1000);
    const note = element('note_1', 'note', 50, 50, 190, 56, 'zone_1');
    const records = [zone, note];

    resolveNoteOverlaps(records);

    expect(note).toMatchObject({ x: 50, y: 50 });
  });
});
