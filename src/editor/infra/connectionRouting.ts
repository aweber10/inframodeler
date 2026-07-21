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
import { getOrientation } from 'diagram-js/lib/layout/LayoutUtil';

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
  const orientation = getOrientation(source, target, 0);
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
  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const a = waypoints[index]!;
    const b = waypoints[index + 1]!;
    const hit = obstacles.find((obstacle) => segmentIntersectsRect(a, b, obstacle));
    if (hit) return hit;
  }
  return undefined;
}

const OBSTACLE_MARGIN = 12;

/**
 * Best-effort attempt to route around a blocking obstacle: finds the (single, axis-aligned)
 * middle segment that crosses it and shifts that segment to just past the obstacle's nearer edge,
 * on whichever side requires the smaller shift. Returns undefined if no axis-aligned middle
 * segment could be identified (e.g. already a straight line).
 */
export function nudgeMiddleSegment(waypoints: readonly Point[], obstacles: readonly Rect[]): Point[] | undefined {
  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const a = waypoints[index]!;
    const b = waypoints[index + 1]!;
    const vertical = a.x === b.x;
    const horizontal = a.y === b.y;
    if (!vertical && !horizontal) continue;

    const obstacle = obstacles.find((rect) => segmentIntersectsRect(a, b, rect));
    if (!obstacle) continue;

    const original = vertical ? a.x : a.y;
    const candidates = vertical
      ? [obstacle.x - OBSTACLE_MARGIN, obstacle.x + obstacle.width + OBSTACLE_MARGIN]
      : [obstacle.y - OBSTACLE_MARGIN, obstacle.y + obstacle.height + OBSTACLE_MARGIN];

    const chosen = candidates.reduce((best, value) => (Math.abs(value - original) < Math.abs(best - original) ? value : best));

    const result = waypoints.map((point) => ({ ...point }));
    if (vertical) {
      result[index] = { ...result[index]!, x: chosen };
      result[index + 1] = { ...result[index + 1]!, x: chosen };
    } else {
      result[index] = { ...result[index]!, y: chosen };
      result[index + 1] = { ...result[index + 1]!, y: chosen };
    }
    return result;
  }

  return undefined;
}
