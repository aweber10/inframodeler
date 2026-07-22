import { simplifyWaypoints, type DockingSide, type Point, type Rect } from './connectionRouting';

export interface ExistingSegment {
  start: Point;
  end: Point;
}

export interface RouteOrthogonalOptions {
  source: Rect;
  target: Rect;
  sourceAnchor: Point;
  targetAnchor: Point;
  sourceSide: DockingSide;
  targetSide: DockingSide;
  obstacles: readonly Rect[];
  existingSegments: readonly ExistingSegment[];
}

const MARGIN = 12;
const OBSTACLE_PADDING = 4;
const DIAGRAM_PADDING = 40;
const BEND_PENALTY = 30;
const OVERLAP_PENALTY = 40;

type Direction = 'h' | 'v' | null;

interface State {
  xIndex: number;
  yIndex: number;
  direction: Direction;
  cost: number;
  estimate: number;
  previous?: string;
}

export function routeOrthogonal(options: RouteOrthogonalOptions): Point[] | undefined {
  const obstacles = options.obstacles.map((obstacle) => expandRect(obstacle, OBSTACLE_PADDING));
  const bounds = diagramBounds(options);
  const xCoordinates = coordinates(options, 'x', bounds);
  const yCoordinates = coordinates(options, 'y', bounds);
  const sourceIndex = pointIndex(options.sourceAnchor, xCoordinates, yCoordinates);
  const targetIndex = pointIndex(options.targetAnchor, xCoordinates, yCoordinates);
  if (!sourceIndex || !targetIndex) return undefined;

  const start: State = {
    ...sourceIndex,
    direction: null,
    cost: 0,
    estimate: manhattan(options.sourceAnchor, options.targetAnchor)
  };
  const startKey = stateKey(start);
  const states = new Map([[startKey, start]]);
  const bestCost = new Map([[startKey, 0]]);
  const open = new StateQueue();
  open.push(startKey, start);
  let endKey: string | undefined;

  while (open.size) {
    const entry = open.pop()!;
    const currentKey = entry.key;
    const current = entry.state;
    if (current.cost !== bestCost.get(currentKey)) continue;
    const currentPoint = gridPoint(current, xCoordinates, yCoordinates);

    if (current.xIndex === targetIndex.xIndex && current.yIndex === targetIndex.yIndex) {
      endKey = currentKey;
      break;
    }

    for (const neighbor of neighbors(current, xCoordinates, yCoordinates)) {
      const point = gridPoint(neighbor, xCoordinates, yCoordinates);
      if (!insideBounds(point, bounds) || pointBlocked(point, obstacles, options.sourceAnchor, options.targetAnchor)) continue;
      if (segmentBlocked(currentPoint, point, obstacles)) continue;
      if (current.direction === null && !movesOutward(currentPoint, point, options.sourceSide)) continue;
      if (neighbor.xIndex === targetIndex.xIndex && neighbor.yIndex === targetIndex.yIndex && !movesIntoTarget(currentPoint, point, options.targetSide)) continue;

      const direction: Direction = currentPoint.x === point.x ? 'v' : 'h';
      const bendCost = current.direction && current.direction !== direction ? BEND_PENALTY : 0;
      const overlapCost = overlapsExisting(currentPoint, point, options.existingSegments) ? OVERLAP_PENALTY : 0;
      const cost = current.cost + manhattan(currentPoint, point) + bendCost + overlapCost;
      const state: State = {
        ...neighbor,
        direction,
        cost,
        estimate: cost + manhattan(point, options.targetAnchor),
        previous: currentKey
      };
      const key = stateKey(state);
      if (cost >= (bestCost.get(key) ?? Number.POSITIVE_INFINITY)) continue;
      bestCost.set(key, cost);
      states.set(key, state);
      open.push(key, state);
    }
  }

  if (!endKey) return undefined;
  const result: Point[] = [];
  let key: string | undefined = endKey;
  while (key) {
    const state: State = states.get(key)!;
    result.push(gridPoint(state, xCoordinates, yCoordinates));
    key = state.previous;
  }
  result.reverse();
  if (!movesOutward(result[0]!, result[1]!, options.sourceSide)) return undefined;
  if (!movesIntoTarget(result[result.length - 2]!, result[result.length - 1]!, options.targetSide)) return undefined;
  return simplifyWaypoints(result);
}

function coordinates(options: RouteOrthogonalOptions, axis: 'x' | 'y', bounds: Rect): number[] {
  const size = axis === 'x' ? 'width' : 'height';
  const values = new Set<number>([
    options.sourceAnchor[axis], options.targetAnchor[axis], bounds[axis], bounds[axis] + bounds[size]
  ]);
  for (const obstacle of [options.source, options.target, ...options.obstacles]) {
    values.add(obstacle[axis] - MARGIN);
    values.add(obstacle[axis] + obstacle[size] + MARGIN);
    values.add(obstacle[axis] - OBSTACLE_PADDING);
    values.add(obstacle[axis] + obstacle[size] + OBSTACLE_PADDING);
  }
  return [...values].sort((a, b) => a - b);
}

function diagramBounds(options: RouteOrthogonalOptions): Rect {
  const rectangles = [options.source, options.target, ...options.obstacles];
  const left = Math.min(...rectangles.map((rect) => rect.x), options.sourceAnchor.x, options.targetAnchor.x) - DIAGRAM_PADDING;
  const top = Math.min(...rectangles.map((rect) => rect.y), options.sourceAnchor.y, options.targetAnchor.y) - DIAGRAM_PADDING;
  const right = Math.max(...rectangles.map((rect) => rect.x + rect.width), options.sourceAnchor.x, options.targetAnchor.x) + DIAGRAM_PADDING;
  const bottom = Math.max(...rectangles.map((rect) => rect.y + rect.height), options.sourceAnchor.y, options.targetAnchor.y) + DIAGRAM_PADDING;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function pointIndex(point: Point, xs: readonly number[], ys: readonly number[]) {
  const xIndex = xs.indexOf(point.x);
  const yIndex = ys.indexOf(point.y);
  return xIndex === -1 || yIndex === -1 ? undefined : { xIndex, yIndex };
}

function neighbors(state: State, xs: readonly number[], ys: readonly number[]): Array<{ xIndex: number; yIndex: number }> {
  const result = [];
  if (state.xIndex > 0) result.push({ xIndex: state.xIndex - 1, yIndex: state.yIndex });
  if (state.xIndex + 1 < xs.length) result.push({ xIndex: state.xIndex + 1, yIndex: state.yIndex });
  if (state.yIndex > 0) result.push({ xIndex: state.xIndex, yIndex: state.yIndex - 1 });
  if (state.yIndex + 1 < ys.length) result.push({ xIndex: state.xIndex, yIndex: state.yIndex + 1 });
  return result;
}

function gridPoint(state: Pick<State, 'xIndex' | 'yIndex'>, xs: readonly number[], ys: readonly number[]): Point {
  return { x: xs[state.xIndex]!, y: ys[state.yIndex]! };
}

function stateKey(state: Pick<State, 'xIndex' | 'yIndex' | 'direction'>): string {
  return `${state.xIndex}:${state.yIndex}:${state.direction ?? '-'}`;
}

function compareStates(a: State, b: State): number {
  return a.estimate - b.estimate || a.cost - b.cost || a.yIndex - b.yIndex || a.xIndex - b.xIndex || String(a.direction).localeCompare(String(b.direction));
}

class StateQueue {
  private readonly entries: Array<{ key: string; state: State }> = [];

  get size(): number {
    return this.entries.length;
  }

  push(key: string, state: State): void {
    this.entries.push({ key, state });
    let index = this.entries.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compareStates(this.entries[parent]!.state, state) <= 0) break;
      this.entries[index] = this.entries[parent]!;
      index = parent;
    }
    this.entries[index] = { key, state };
  }

  pop(): { key: string; state: State } | undefined {
    const first = this.entries[0];
    const last = this.entries.pop();
    if (!first || !last || !this.entries.length) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= this.entries.length) break;
      const right = left + 1;
      const child = right < this.entries.length
        && compareStates(this.entries[right]!.state, this.entries[left]!.state) < 0 ? right : left;
      if (compareStates(last.state, this.entries[child]!.state) <= 0) break;
      this.entries[index] = this.entries[child]!;
      index = child;
    }
    this.entries[index] = last;
    return first;
  }
}

function expandRect(rect: Rect, padding: number): Rect {
  return { x: rect.x - padding, y: rect.y - padding, width: rect.width + 2 * padding, height: rect.height + 2 * padding };
}

function pointBlocked(point: Point, obstacles: readonly Rect[], sourceAnchor: Point, targetAnchor: Point): boolean {
  if (samePoint(point, sourceAnchor) || samePoint(point, targetAnchor)) return false;
  return obstacles.some((rect) => point.x > rect.x && point.x < rect.x + rect.width && point.y > rect.y && point.y < rect.y + rect.height);
}

function segmentBlocked(a: Point, b: Point, obstacles: readonly Rect[]): boolean {
  return obstacles.some((rect) => {
    if (a.x === b.x) {
      return a.x > rect.x && a.x < rect.x + rect.width
        && Math.max(Math.min(a.y, b.y), rect.y) < Math.min(Math.max(a.y, b.y), rect.y + rect.height);
    }
    if (a.y === b.y) {
      return a.y > rect.y && a.y < rect.y + rect.height
        && Math.max(Math.min(a.x, b.x), rect.x) < Math.min(Math.max(a.x, b.x), rect.x + rect.width);
    }
    return true;
  });
}

function movesOutward(a: Point, b: Point, side: DockingSide): boolean {
  return side === 'left' ? b.x < a.x : side === 'right' ? b.x > a.x : side === 'top' ? b.y < a.y : b.y > a.y;
}

function movesIntoTarget(a: Point, b: Point, side: DockingSide): boolean {
  return side === 'left' ? a.x < b.x : side === 'right' ? a.x > b.x : side === 'top' ? a.y < b.y : a.y > b.y;
}

function overlapsExisting(a: Point, b: Point, segments: readonly ExistingSegment[]): boolean {
  return segments.some(({ start, end }) => {
    if (a.x === b.x && start.x === end.x && a.x === start.x) {
      return Math.max(Math.min(a.y, b.y), Math.min(start.y, end.y)) < Math.min(Math.max(a.y, b.y), Math.max(start.y, end.y));
    }
    if (a.y === b.y && start.y === end.y && a.y === start.y) {
      return Math.max(Math.min(a.x, b.x), Math.min(start.x, end.x)) < Math.min(Math.max(a.x, b.x), Math.max(start.x, end.x));
    }
    return false;
  });
}

function insideBounds(point: Point, bounds: Rect): boolean {
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}
