import { connectRectangles } from 'diagram-js/lib/layout/ManhattanLayout';
import { describe, expect, it } from 'vitest';

import { findBlockingObstacle, type Rect } from '../src/editor/infra/connectionRouting';
import { routeOrthogonal, type ExistingSegment } from '../src/editor/infra/orthoRouter';

const source = { x: 0, y: 100, width: 40, height: 40 };
const target = { x: 300, y: 100, width: 40, height: 40 };
const sourceAnchor = { x: 40, y: 120 };
const targetAnchor = { x: 300, y: 120 };

function route(obstacles: Rect[] = [], existingSegments: ExistingSegment[] = []) {
  return routeOrthogonal({
    source, target, sourceAnchor, targetAnchor,
    sourceSide: 'right', targetSide: 'left', obstacles, existingSegments
  });
}

describe('routeOrthogonal', () => {
  it('routes around a U-shaped obstacle', () => {
    const obstacles = [
      { x: 120, y: 40, width: 20, height: 100 },
      { x: 120, y: 40, width: 120, height: 20 },
      { x: 220, y: 40, width: 20, height: 100 }
    ];
    const waypoints = route(obstacles);
    expect(waypoints).toBeDefined();
    expect(findBlockingObstacle(waypoints!, obstacles)).toBeUndefined();
  });

  it('uses the same bend count as connectRectangles in free space', () => {
    const routed = route()!;
    const manhattan = connectRectangles(source, target, sourceAnchor, targetAnchor, { preferredLayouts: ['h:h'] });
    expect(routed.length - 2).toBe(manhattan.length - 2);
  });

  it('moves a second route away from an occupied parallel corridor', () => {
    const first = route()!;
    const segments = first.slice(1).map((end, index) => ({ start: first[index]!, end }));
    const second = routeOrthogonal({
      source, target,
      sourceAnchor: { x: 40, y: 128 }, targetAnchor: { x: 300, y: 128 },
      sourceSide: 'right', targetSide: 'left', obstacles: [], existingSegments: segments
    })!;
    const overlaps = second.slice(1).some((end, index) => segments.some(({ start, end: existingEnd }) =>
      start.y === existingEnd.y && second[index]!.y === end.y && start.y === end.y
      && Math.max(Math.min(start.x, existingEnd.x), Math.min(second[index]!.x, end.x)) < Math.min(Math.max(start.x, existingEnd.x), Math.max(second[index]!.x, end.x))
    ));
    expect(overlaps).toBe(false);
  });
});
