import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { computeDockingAnchor, findBlockingObstacle, resolveDockingSides, type FanConnection, type Rect } from '../src/editor/infra/connectionRouting';
import { routeOrthogonal, type ExistingSegment } from '../src/editor/infra/orthoRouter';
import { parseDiagramFile } from '../src/app/serialization/parse';

const fixture = parseDiagramFile(readFileSync(new URL('./fixtures/json/deployment_prod.imod.json', import.meta.url), 'utf8'));
type FixtureRect = Rect & { id: string; parent?: string };

describe('deployment production routing fixture', () => {
  it('reroutes every connection without obstacles or more than six bends', () => {
    const elements = new Map(fixture.elements.map((element) => [element.id, {
      id: element.id, parent: element.parent, x: element.x, y: element.y, width: element.w, height: element.h
    } satisfies FixtureRect]));
    const routes = new Map<string, { x: number; y: number }[]>();
    const existingSegments: ExistingSegment[] = [];

    for (const connection of fixture.connections) {
      const source = elements.get(connection.source)!;
      const target = elements.get(connection.target)!;
      const sides = resolveDockingSides(source, target);
      expect(sides.source, connection.id).not.toBeNull();
      expect(sides.target, connection.id).not.toBeNull();
      const sourceFan = fanConnections(connection.source, sides.source!, fixture.connections, elements);
      const targetFan = fanConnections(connection.target, sides.target!, fixture.connections, elements);
      const excluded = excludedIds(source.id, target.id, elements);
      const obstacles = [...elements.values()].filter((element) => !excluded.has(element.id));
      const route = routeOrthogonal({
        source, target,
        sourceAnchor: boundaryAnchor(computeDockingAnchor(source, sides.source!, sourceFan, connection.id), source, sides.source!),
        targetAnchor: boundaryAnchor(computeDockingAnchor(target, sides.target!, targetFan, connection.id), target, sides.target!),
        sourceSide: sides.source!, targetSide: sides.target!, obstacles, existingSegments
      });
      expect(route, connection.id).toBeDefined();
      expect(findBlockingObstacle(route!, obstacles), connection.id).toBeUndefined();
      expect(route!.length - 2, connection.id).toBeLessThanOrEqual(6);
      routes.set(connection.id, route!);
      for (let index = 0; index < route!.length - 1; index += 1) {
        existingSegments.push({ start: route![index]!, end: route![index + 1]! });
      }
    }

    expect(routes.size).toBe(fixture.connections.length);
  }, 30_000);
});

function boundaryAnchor(point: { x: number; y: number }, rect: Rect, side: NonNullable<ReturnType<typeof resolveDockingSides>['source']>) {
  if (side === 'left') return { x: rect.x, y: point.y };
  if (side === 'right') return { x: rect.x + rect.width, y: point.y };
  if (side === 'top') return { x: point.x, y: rect.y };
  return { x: point.x, y: rect.y + rect.height };
}

function excludedIds(sourceId: string, targetId: string, elements: Map<string, FixtureRect>): Set<string> {
  const excluded = new Set<string>();
  for (const id of [sourceId, targetId]) {
    collectSubtree(id, excluded, elements);
    let parent = elements.get(id)?.parent;
    while (parent) {
      excluded.add(parent);
      parent = elements.get(parent)?.parent;
    }
  }
  return excluded;
}

function collectSubtree(id: string, result: Set<string>, elements: Map<string, FixtureRect>): void {
  result.add(id);
  for (const element of elements.values()) {
    if (element.parent === id) collectSubtree(element.id, result, elements);
  }
}

function fanConnections(
  shapeId: string,
  side: NonNullable<ReturnType<typeof resolveDockingSides>['source']>,
  connections: typeof fixture.connections,
  elements: Map<string, FixtureRect>
): FanConnection[] {
  return connections
    .filter((connection) => connection.source === shapeId || connection.target === shapeId)
    .filter((connection) => {
      const source = elements.get(connection.source)!;
      const target = elements.get(connection.target)!;
      const sides = resolveDockingSides(source, target);
      return (connection.source === shapeId ? sides.source : sides.target) === side;
    })
    .map((connection) => ({ id: connection.id, side }));
}
