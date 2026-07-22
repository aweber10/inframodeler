import { describe, expect, it } from 'vitest';

import {
  computeDockingAnchor,
  computeFanOffset,
  findBlockingObstacle,
  nudgeMiddleSegment,
  pickPreferredLayout,
  resolveDockingSides,
  segmentIntersectsRect,
  separateParallelSegments,
  simplifyWaypoints,
  type FanConnection,
  type Rect
} from '../src/editor/infra/connectionRouting';

function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

describe('pickPreferredLayout', () => {
  it('prefers a horizontal middle segment when the horizontal offset dominates', () => {
    expect(pickPreferredLayout(rect(0, 0, 100, 40), rect(500, 50, 100, 40))).toBe('h:h');
  });

  it('prefers a vertical middle segment when the vertical offset dominates', () => {
    expect(pickPreferredLayout(rect(0, 0, 100, 40), rect(50, 600, 100, 40))).toBe('v:v');
  });
});

describe('resolveDockingSides', () => {
  it('docks source on the right and target on the left when target is to the right', () => {
    const sides = resolveDockingSides(rect(0, 0, 100, 40), rect(400, 0, 100, 40));
    expect(sides).toMatchObject({ source: 'right', target: 'left', directions: 'h:h' });
  });

  it('docks source on the bottom and target on the top when target is below', () => {
    const sides = resolveDockingSides(rect(0, 0, 100, 40), rect(0, 400, 100, 40));
    expect(sides).toMatchObject({ source: 'bottom', target: 'top', directions: 'v:v' });
  });

  it('returns null sides for overlapping (intersecting) shapes', () => {
    const sides = resolveDockingSides(rect(0, 0, 100, 40), rect(10, 10, 100, 40));
    expect(sides).toEqual({ source: null, target: null, directions: null });
  });

  it('picks a consistent side for diagonally placed shapes', () => {
    const sides = resolveDockingSides(rect(0, 0, 100, 40), rect(500, 400, 100, 40));
    expect(sides.directions).toBe('h:h');
    expect(sides).toMatchObject({ source: 'right', target: 'left' });
  });
});

describe('computeFanOffset / computeDockingAnchor', () => {
  const connections: FanConnection[] = [
    { id: 'a', side: 'right' },
    { id: 'b', side: 'right' },
    { id: 'c', side: 'right' }
  ];

  it('returns 0 offset for a single connection', () => {
    expect(computeFanOffset([{ id: 'solo', side: 'right' }], 'solo', 100)).toBe(0);
  });

  it('spreads multiple connections evenly along the side without overlap', () => {
    const offsets = connections.map((connection) => computeFanOffset(connections, connection.id, 100));
    expect(new Set(offsets).size).toBe(3);
    // Symmetric around the middle.
    expect(offsets[0]).toBeCloseTo(-offsets[2]!, 5);
    expect(offsets[1]).toBeCloseTo(0, 5);
  });

  it('computes docking anchors offset along the vertical axis for left/right sides', () => {
    const shape = rect(0, 0, 40, 100);
    const anchor = computeDockingAnchor(shape, 'right', connections, 'a');
    expect(anchor.x).toBe(20);
    expect(anchor.y).not.toBe(50);
  });

  it('computes docking anchors offset along the horizontal axis for top/bottom sides', () => {
    const shape = rect(0, 0, 100, 40);
    const topConnections: FanConnection[] = [
      { id: 'a', side: 'top' },
      { id: 'b', side: 'top' }
    ];
    const anchor = computeDockingAnchor(shape, 'top', topConnections, 'a');
    expect(anchor.y).toBe(20);
    expect(anchor.x).not.toBe(50);
  });
});

describe('segmentIntersectsRect / findBlockingObstacle', () => {
  it('detects when a horizontal segment crosses a rectangle', () => {
    expect(segmentIntersectsRect({ x: 0, y: 50 }, { x: 200, y: 50 }, rect(80, 30, 40, 40))).toBe(true);
  });

  it('does not detect a crossing when the rectangle is elsewhere', () => {
    expect(segmentIntersectsRect({ x: 0, y: 50 }, { x: 200, y: 50 }, rect(80, 300, 40, 40))).toBe(false);
  });

  it('finds the first obstacle blocking a multi-segment path', () => {
    const waypoints = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const clear = rect(500, 500, 10, 10);
    const blocking = rect(90, -10, 20, 20);
    expect(findBlockingObstacle(waypoints, [clear, blocking])).toBe(blocking);
  });

  it('returns undefined when no obstacle blocks the path', () => {
    const waypoints = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(findBlockingObstacle(waypoints, [rect(500, 500, 10, 10)])).toBeUndefined();
  });
});

describe('nudgeMiddleSegment', () => {
  it('shifts a vertical middle segment past the nearer edge of the blocking obstacle', () => {
    const waypoints = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }, { x: 200, y: 200 }];
    const obstacle = rect(90, 50, 20, 60);
    const nudged = nudgeMiddleSegment(waypoints, [obstacle]);

    expect(nudged).toBeDefined();
    expect(findBlockingObstacle(nudged!, [obstacle])).toBeUndefined();
    // Endpoints must stay put - only the middle segment moves.
    expect(nudged![0]).toEqual({ x: 0, y: 0 });
    expect(nudged![nudged!.length - 1]).toEqual({ x: 200, y: 200 });
  });

  it('returns undefined when there is no axis-aligned segment to nudge', () => {
    const waypoints = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    expect(nudgeMiddleSegment(waypoints, [rect(40, 40, 20, 20)])).toBeUndefined();
  });

  it('never moves a blocked docking segment', () => {
    const waypoints = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 100 }];
    expect(nudgeMiddleSegment(waypoints, [rect(40, -10, 20, 20)])).toBeUndefined();
    expect(waypoints[0]).toEqual({ x: 0, y: 0 });
    expect(waypoints[1]).toEqual({ x: 100, y: 0 });
  });

  it('iteratively avoids two obstacles in a corridor', () => {
    const waypoints = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 200 }, { x: 200, y: 200 }];
    const obstacles = [rect(30, 40, 20, 30), rect(30, 120, 20, 30)];
    const nudged = nudgeMiddleSegment(waypoints, obstacles);
    expect(nudged).toBeDefined();
    expect(findBlockingObstacle(nudged!, obstacles)).toBeUndefined();
  });
});

describe('simplifyWaypoints', () => {
  it('removes duplicate and collinear intermediate points', () => {
    expect(simplifyWaypoints([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }])).toEqual([
      { x: 0, y: 0 }, { x: 100, y: 0 }
    ]);
  });

  it('collapses a four pixel stair step', () => {
    expect(simplifyWaypoints([
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 4 }, { x: 100, y: 4 }, { x: 100, y: 100 }
    ])).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
  });
});

describe('separateParallelSegments', () => {
  it('fans out overlapping inner segments while preserving docking segments', () => {
    const connections = ['a', 'b'].map((id) => ({ id, waypoints: [
      { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 100 }, { x: 100, y: 100 }
    ] }));
    const separated = separateParallelSegments(connections);
    expect(separated[0]!.waypoints[1]!.x).toBe(32);
    expect(separated[1]!.waypoints[1]!.x).toBe(48);
    expect(separated[0]!.waypoints[0]).toEqual(connections[0]!.waypoints[0]);
    expect(separated[0]!.waypoints[3]).toEqual(connections[0]!.waypoints[3]);
  });
});
