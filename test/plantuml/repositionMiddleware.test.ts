import { describe, expect, it } from 'vitest';

import { repositionMiddleware } from '../../src/app/import/plantuml/mapper';
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
});
