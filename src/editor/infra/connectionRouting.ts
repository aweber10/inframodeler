/**
 * Pure, dependency-free helpers used by {@link InfraLayouter} to make the automatic connection
 * routing a bit smarter than plain diagram-js defaults:
 *
 *  - pick a sensible preferred Manhattan layout direction for diagonally placed shapes
 *  - resolve which side of source/target a connection docks on, mirroring diagram-js's own
 *    (unexported) direction resolution so our custom docking anchors line up with its routing
 *  - spread multiple connections docking on the same side of a shape instead of stacking them
 *    all on the exact same point (fan-in / fan-out)
 *  - detect when a routed connection crosses an unrelated shape and provide a simple alternative
 *    routing (nudging the middle segment past the obstacle) to try instead
 *
 * None of this replaces a full obstacle-avoiding router - it is a set of small, pragmatic
 * heuristics layered on top of diagram-js's Manhattan layout.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type ManhattanLayout = 'h:h' | 'v:v';

function mid(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/**
 * Picks whether a connection between two rectangles should preferably be routed with a
 * horizontal (`h:h`) or vertical (`v:v`) middle segment. Only relevant for diagonally placed
 * shapes - diagram-js overrides this for shapes that are already purely top/bottom or
 * left/right aligned.
 */
export function pickPreferredLayout(source: Rect, target: Rect): ManhattanLayout {
  const a = mid(source);
  const b = mid(target);
  return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'h:h' : 'v:v';
}

export type DockingSide = 'top' | 'right' | 'bottom' | 'left';

export interface DockingSides {
  source: DockingSide | null;
  target: DockingSide | null;
  directions: ManhattanLayout | null;
}

const OPPOSITE_ORIENTATION: Record<string, string> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
  'top-left': 'bottom-right',
  'bottom-right': 'top-left',
  'top-right': 'bottom-left',
  'bottom-left': 'top-right'
};

function invertOrientation(orientation: string): string {
  return OPPOSITE_ORIENTATION[orientation] ?? orientation;
}

/**
 * Determines which side of `source` and `target` a connection between them should dock on,
 * mirroring the (unexported) direction resolution diagram-js's ManhattanLayout uses internally.
 * Keeping this in sync ensures our custom docking anchors (fan-out offsets) land on the same
 * side that the actual routing will use.
 */
export function resolveDockingSides(source: Rect, target: Rect): DockingSides {
  const orientation = getOrientation(source, target);
  if (orientation === 'intersect') return { source: null, target: null, directions: null };

  const directions: ManhattanLayout = /^(top|bottom)$/.test(orientation)
    ? 'v:v'
    : /^(left|right)$/.test(orientation)
      ? 'h:h'
      : pickPreferredLayout(source, target);

  const isHorizontal = directions === 'h:h';
  const sourceOrientation = invertOrientation(orientation);

  const resolveSide = (reference: string): DockingSide =>
    isHorizontal ? (/left/.test(reference) ? 'left' : 'right') : (/top/.test(reference) ? 'top' : 'bottom');

  return {
    source: resolveSide(sourceOrientation),
    target: resolveSide(orientation),
    directions
  };
}

function getOrientation(rect: Rect, reference: Rect): string {
  const top = rect.y + rect.height <= reference.y;
  const right = rect.x >= reference.x + reference.width;
  const bottom = rect.y >= reference.y + reference.height;
  const left = rect.x + rect.width <= reference.x;
  const vertical = top ? 'top' : bottom ? 'bottom' : null;
  const horizontal = left ? 'left' : right ? 'right' : null;
  return vertical && horizontal ? `${vertical}-${horizontal}` : horizontal ?? vertical ?? 'intersect';
}

export interface FanConnection {
  id: string;
  side: DockingSide;
}

const MIN_EDGE_MARGIN = 10;

/**
 * Given all connections that dock on a particular side of a shape, returns an offset (from the
 * side's mid point, along the side) for the connection with the given id so that connections
 * sharing a side are spread out evenly instead of overlapping at the exact middle point.
 *
 * @param connections All connections docking on the same side, in a stable order.
 * @param connectionId The connection to compute the offset for.
 * @param sideLength The length of the shape's side (width for top/bottom, height for left/right).
 */
export function computeFanOffset(connections: readonly FanConnection[], connectionId: string, sideLength: number): number {
  const ordered = connections.map((connection) => connection.id);
  const index = ordered.indexOf(connectionId);
  if (index === -1 || ordered.length <= 1) return 0;

  const usableLength = Math.max(sideLength - 2 * MIN_EDGE_MARGIN, 0);
  const step = usableLength / (ordered.length + 1);
  const offsetFromEdge = MIN_EDGE_MARGIN + step * (index + 1);

  return offsetFromEdge - sideLength / 2;
}

/**
 * Computes the docking anchor point on `shape`'s given side, offset along the side according to
 * the shape's other connections sharing that side (see {@link computeFanOffset}).
 */
export function computeDockingAnchor(shape: Rect, side: DockingSide, connections: readonly FanConnection[], connectionId: string): Point {
  const center = mid(shape);
  const isHorizontalSide = side === 'top' || side === 'bottom';
  const offset = computeFanOffset(connections, connectionId, isHorizontalSide ? shape.width : shape.height);

  return isHorizontalSide ? { x: center.x + offset, y: center.y } : { x: center.x, y: center.y + offset };
}

/** Axis-aligned segment (all Manhattan waypoints are either purely horizontal or vertical). */
export function segmentIntersectsRect(a: Point, b: Point, rect: Rect, padding = 0): boolean {
  const minX = Math.min(a.x, b.x) - padding;
  const maxX = Math.max(a.x, b.x) + padding;
  const minY = Math.min(a.y, b.y) - padding;
  const maxY = Math.max(a.y, b.y) + padding;

  return minX <= rect.x + rect.width && maxX >= rect.x && minY <= rect.y + rect.height && maxY >= rect.y;
}

/**
 * Returns the first obstacle whose bounding box is crossed by any segment of the given
 * (Manhattan/axis-aligned) waypoint path, or undefined if the path is clear.
 */
export function findBlockingObstacle<T extends Rect>(waypoints: readonly Point[], obstacles: readonly T[]): T | undefined {
  return findBlockingSegment(waypoints, obstacles)?.obstacle;
}

const OBSTACLE_MARGIN = 12;
const MINI_SEGMENT_LENGTH = 6;
const MAX_NUDGE_ITERATIONS = 10;

interface BlockingSegment<T extends Rect> {
  index: number;
  obstacle: T;
}

function findBlockingSegment<T extends Rect>(waypoints: readonly Point[], obstacles: readonly T[]): BlockingSegment<T> | undefined {
  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const a = waypoints[index]!;
    const b = waypoints[index + 1]!;
    const obstacle = obstacles.find((candidate) => segmentIntersectsRect(a, b, candidate));
    if (obstacle) return { index, obstacle };
  }
  return undefined;
}

/** Removes redundant points and collapses sub-6 px orthogonal stair steps. */
export function simplifyWaypoints(points: readonly Point[]): Point[] {
  if (points.length < 2) return points.map((point) => ({ ...point }));

  const result = points
    .filter((point, index) => index === 0 || point.x !== points[index - 1]!.x || point.y !== points[index - 1]!.y)
    .map((point) => ({ ...point }));

  let changed = true;
  while (changed) {
    changed = false;

    for (let index = 1; index < result.length - 1; index += 1) {
      const previous = result[index - 1]!;
      const point = result[index]!;
      const next = result[index + 1]!;
      if ((previous.x === point.x && point.x === next.x) || (previous.y === point.y && point.y === next.y)) {
        result.splice(index, 1);
        changed = true;
        break;
      }
    }
    if (changed) continue;

    for (let index = 1; index < result.length - 2; index += 1) {
      const before = result[index - 1]!;
      const start = result[index]!;
      const end = result[index + 1]!;
      const after = result[index + 2]!;
      const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
      const horizontalOuter = before.y === start.y && end.y === after.y;
      const verticalOuter = before.x === start.x && end.x === after.x;
      if (length >= MINI_SEGMENT_LENGTH || (!horizontalOuter && !verticalOuter)) continue;

      const previousLength = Math.abs(start.x - before.x) + Math.abs(start.y - before.y);
      const nextLength = Math.abs(after.x - end.x) + Math.abs(after.y - end.y);
      if (previousLength >= nextLength && index + 2 < result.length - 1) {
        if (horizontalOuter) {
          end.y = start.y;
          after.y = start.y;
        } else {
          end.x = start.x;
          after.x = start.x;
        }
      } else if (index > 1) {
        if (horizontalOuter) {
          before.y = end.y;
          start.y = end.y;
        } else {
          before.x = end.x;
          start.x = end.x;
        }
      } else {
        continue;
      }
      changed = true;
      break;
    }
  }

  return result;
}

/**
 * Best-effort attempt to route around a blocking obstacle: finds the (single, axis-aligned)
 * middle segment that crosses it and shifts that segment to just past the obstacle's nearer edge,
 * on whichever side requires the smaller shift. Returns undefined if no axis-aligned middle
 * segment could be identified (e.g. already a straight line).
 */
export function nudgeMiddleSegment(waypoints: readonly Point[], obstacles: readonly Rect[]): Point[] | undefined {
  let result = waypoints.map((point) => ({ ...point }));
  let changed = false;
  const visited = new Set<string>();

  for (let iteration = 0; iteration < MAX_NUDGE_ITERATIONS; iteration += 1) {
    const hit = findBlockingSegment(result, obstacles);
    if (!hit) return changed ? simplifyWaypoints(result) : undefined;
    if (hit.index === 0 || hit.index === result.length - 2) return changed ? simplifyWaypoints(result) : undefined;

    const a = result[hit.index]!;
    const b = result[hit.index + 1]!;
    const vertical = a.x === b.x;
    const horizontal = a.y === b.y;
    if (!vertical && !horizontal) return changed ? simplifyWaypoints(result) : undefined;

    const original = vertical ? a.x : a.y;
    const coordinates = vertical
      ? [hit.obstacle.x - OBSTACLE_MARGIN, hit.obstacle.x + hit.obstacle.width + OBSTACLE_MARGIN]
      : [hit.obstacle.y - OBSTACLE_MARGIN, hit.obstacle.y + hit.obstacle.height + OBSTACLE_MARGIN];
    const candidates = coordinates
      .filter((coordinate) => !visited.has(`${hit.index}:${coordinate}`))
      .map((coordinate) => ({ coordinate, waypoints: moveSegment(result, hit.index, vertical, coordinate) }));
    if (!candidates.length) return changed ? simplifyWaypoints(result) : undefined;

    const clear = candidates.find((candidate) => !findBlockingObstacle(candidate.waypoints, obstacles));
    const chosen = clear ?? candidates.reduce((best, candidate) =>
      Math.abs(candidate.coordinate - original) < Math.abs(best.coordinate - original) ? candidate : best
    );
    visited.add(`${hit.index}:${chosen.coordinate}`);
    result = chosen.waypoints;
    changed = true;
  }

  return changed ? simplifyWaypoints(result) : undefined;
}

function moveSegment(waypoints: readonly Point[], index: number, vertical: boolean, coordinate: number): Point[] {
  const result = waypoints.map((point) => ({ ...point }));
  if (vertical) {
    result[index]!.x = coordinate;
    result[index + 1]!.x = coordinate;
  } else {
    result[index]!.y = coordinate;
    result[index + 1]!.y = coordinate;
  }
  return result;
}

export interface RoutedConnection {
  id: string;
  waypoints: readonly Point[];
}

/** Fans out coincident, overlapping inner segments of different connections. */
export function separateParallelSegments(connections: readonly RoutedConnection[]): RoutedConnection[] {
  const result = connections.map((connection) => ({
    id: connection.id,
    waypoints: connection.waypoints.map((point) => ({ ...point }))
  }));
  const groups = new Map<string, Array<{ connectionIndex: number; segmentIndex: number; start: number; end: number }>>();

  result.forEach((connection, connectionIndex) => {
    for (let segmentIndex = 1; segmentIndex < connection.waypoints.length - 2; segmentIndex += 1) {
      const a = connection.waypoints[segmentIndex]!;
      const b = connection.waypoints[segmentIndex + 1]!;
      const vertical = a.x === b.x;
      const horizontal = a.y === b.y;
      if (!vertical && !horizontal) continue;
      const coordinate = vertical ? a.x : a.y;
      const start = vertical ? Math.min(a.y, b.y) : Math.min(a.x, b.x);
      const end = vertical ? Math.max(a.y, b.y) : Math.max(a.x, b.x);
      const key = `${vertical ? 'v' : 'h'}:${coordinate}`;
      const entries = groups.get(key) ?? [];
      entries.push({ connectionIndex, segmentIndex, start, end });
      groups.set(key, entries);
    }
  });

  for (const [key, entries] of groups) {
    const components: typeof entries[] = [];
    for (const entry of entries.sort((a, b) => a.start - b.start || a.end - b.end)) {
      const component = components.find((candidate) => candidate.some((other) => entry.start < other.end && entry.end > other.start));
      (component ?? components[components.push([]) - 1]!).push(entry);
    }
    const vertical = key.startsWith('v:');
    for (const component of components) {
      const distinct = component.filter((entry, index) => component.findIndex((other) => other.connectionIndex === entry.connectionIndex) === index);
      if (distinct.length < 2) continue;
      distinct.sort((a, b) => result[a.connectionIndex]!.id.localeCompare(result[b.connectionIndex]!.id));
      const ranks = fanRanks(distinct.length);
      distinct.forEach((entry, rankIndex) => {
        const points = result[entry.connectionIndex]!.waypoints as Point[];
        const offset = ranks[rankIndex]! * 8;
        if (vertical) {
          points[entry.segmentIndex]!.x += offset;
          points[entry.segmentIndex + 1]!.x += offset;
        } else {
          points[entry.segmentIndex]!.y += offset;
          points[entry.segmentIndex + 1]!.y += offset;
        }
      });
    }
  }

  return result;
}

function fanRanks(count: number): number[] {
  if (count % 2 === 1) {
    const half = Math.floor(count / 2);
    return Array.from({ length: count }, (_, index) => index - half);
  }
  const half = count / 2;
  return [...Array.from({ length: half }, (_, index) => index - half), ...Array.from({ length: half }, (_, index) => index + 1)];
}
