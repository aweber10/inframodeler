import BaseLayouter, { type LayoutConnectionHints } from 'diagram-js/lib/layout/BaseLayouter';
import { connectRectangles, repairConnection } from 'diagram-js/lib/layout/ManhattanLayout';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { Connection, Shape } from 'diagram-js/lib/model/Types';
import type { Point } from 'diagram-js/lib/util/Types';

import { computeDockingAnchor, findBlockingObstacle, nudgeMiddleSegment, resolveDockingSides, simplifyWaypoints, type DockingSide, type FanConnection } from './connectionRouting';
import { routeOrthogonal, type ExistingSegment } from './orthoRouter';

function isConnection(element: Shape | Connection): element is Connection {
  return Array.isArray((element as Connection).waypoints);
}

function collectSubtreeIds(shape: Shape, ids: Set<string>): void {
  ids.add(shape.id);
  for (const child of shape.children ?? []) collectSubtreeIds(child as Shape, ids);
}

function collectAncestorIds(shape: Shape, ids: Set<string>): void {
  let current = shape.parent as Shape | undefined;
  while (current) {
    ids.add(current.id);
    current = current.parent as Shape | undefined;
  }
}

/** All shapes that are not part of source's or target's own containment subtree - candidates a routed connection should avoid crossing. */
export function obstaclesFor(elementRegistry: ElementRegistry, source: Shape, target: Shape): Shape[] {
  const excluded = new Set<string>();
  collectSubtreeIds(source, excluded);
  collectSubtreeIds(target, excluded);
  collectAncestorIds(source, excluded);
  collectAncestorIds(target, excluded);

  return elementRegistry
    .getAll()
    .filter((element): element is Shape => 'width' in element && !isConnection(element as Shape | Connection) && !excluded.has(element.id));
}

/** All connections attached to `shape` that dock on the given side, ordered by their other endpoint's position along that side. */
function fanConnections(elementRegistry: ElementRegistry, shape: Shape, side: DockingSide): FanConnection[] {
  const attached = elementRegistry
    .getAll()
    .filter((element): element is Connection => isConnection(element as Shape | Connection) && ((element as Connection).source === shape || (element as Connection).target === shape));

  const withSide = attached
    .map((connection) => {
      const isSource = connection.source === shape;
      const other = (isSource ? connection.target : connection.source) as Shape;
      const sides = isSource ? resolveDockingSides(shape, other) : resolveDockingSides(other, shape);
      const connectionSide = isSource ? sides.source : sides.target;
      return connectionSide === side ? { id: connection.id, side, other } : undefined;
    })
    .filter((entry): entry is { id: string; side: DockingSide; other: Shape } => Boolean(entry));

  const axisKey = side === 'top' || side === 'bottom' ? 'x' : 'y';
  withSide.sort((a, b) => (a.other[axisKey] + a.other[axisKey === 'x' ? 'width' : 'height'] / 2) - (b.other[axisKey] + b.other[axisKey === 'x' ? 'width' : 'height'] / 2));

  return withSide.map(({ id, side: connectionSide }) => ({ id, side: connectionSide }));
}

interface ConnectionHints {
  connectionStart?: Point | boolean;
  connectionEnd?: Point | boolean;
}

function isPoint(value: Point | boolean | undefined): value is Point {
  return typeof value === 'object' && value !== null;
}

/**
 * Shared routing core used both by the live layouter (during editing) and by normalizeDocking
 * (right after importing a diagram). When an elementRegistry is available, connections get
 * fanned-out docking anchors and are nudged around obstacles they would otherwise cross;
 * without one, this falls back to plain diagram-js Manhattan routing.
 */
function layoutManhattanConnection(
  connection: Connection,
  source: Shape,
  target: Shape,
  hints: ConnectionHints,
  elementRegistry?: ElementRegistry
): Point[] {
  const sides = resolveDockingSides(source, target);

  const start = isPoint(hints.connectionStart)
    ? hints.connectionStart
    : elementRegistry && sides.source
      ? computeDockingAnchor(source, sides.source, fanConnections(elementRegistry, source, sides.source), connection.id)
      : undefined;
  const end = isPoint(hints.connectionEnd)
    ? hints.connectionEnd
    : elementRegistry && sides.target
      ? computeDockingAnchor(target, sides.target, fanConnections(elementRegistry, target, sides.target), connection.id)
      : undefined;

  const layoutHints = {
    preferredLayouts: sides.directions ? [sides.directions] : [],
    connectionStart: Boolean(hints.connectionStart),
    connectionEnd: Boolean(hints.connectionEnd)
  };

  const waypoints = simplifyWaypoints(connection.waypoints?.length
    ? repairConnection(source, target, start, end, connection.waypoints, layoutHints)
    : connectRectangles(source, target, start, end, layoutHints));

  if (!elementRegistry || connection.businessObject?.pinnedRouting) return waypoints;

  const obstacles = obstaclesFor(elementRegistry, source, target);
  if (!findBlockingObstacle(waypoints, obstacles)) return waypoints;

  const nudged = nudgeMiddleSegment(waypoints, obstacles);
  return nudged && !findBlockingObstacle(nudged, obstacles) ? simplifyWaypoints(nudged) : waypoints;
}

export default class InfraLayouter extends BaseLayouter {
  static $inject = ['elementRegistry'];

  constructor(private readonly elementRegistry: ElementRegistry) {
    super();
  }

  override layoutConnection(connection: Connection, hints: LayoutConnectionHints = {}): Point[] {
    const source = (hints.source ?? connection.source) as Shape;
    const target = (hints.target ?? connection.target) as Shape;
    return layoutManhattanConnection(connection, source, target, hints, this.elementRegistry);
  }
}

export function normalizeDocking(connection: Connection, elementRegistry?: ElementRegistry): Point[] {
  const source = connection.source as Shape;
  const target = connection.target as Shape;
  if (elementRegistry) {
    const routed = routeConnectionOrthogonal(connection, elementRegistry);
    if (routed) return routed;
  }
  return layoutManhattanConnection(connection, source, target, { connectionStart: true, connectionEnd: true }, elementRegistry);
}

export function routeConnectionOrthogonal(connection: Connection, elementRegistry: ElementRegistry): Point[] | undefined {
  const source = connection.source as Shape;
  const target = connection.target as Shape;
  const sides = resolveDockingSides(source, target);
  if (!sides.source || !sides.target) return undefined;
  const sourceAnchor = toBoundaryAnchor(
    computeDockingAnchor(source, sides.source, fanConnections(elementRegistry, source, sides.source), connection.id),
    source,
    sides.source
  );
  const targetAnchor = toBoundaryAnchor(
    computeDockingAnchor(target, sides.target, fanConnections(elementRegistry, target, sides.target), connection.id),
    target,
    sides.target
  );
  const existingSegments: ExistingSegment[] = [];
  for (const element of elementRegistry.getAll() as Array<Shape | Connection>) {
    if (!isConnection(element) || element === connection) continue;
    for (let index = 0; index < element.waypoints.length - 1; index += 1) {
      existingSegments.push({ start: element.waypoints[index]!, end: element.waypoints[index + 1]! });
    }
  }
  return routeOrthogonal({
    source, target, sourceAnchor, targetAnchor,
    sourceSide: sides.source, targetSide: sides.target,
    obstacles: obstaclesFor(elementRegistry, source, target), existingSegments
  });
}

function toBoundaryAnchor(anchor: Point, shape: Shape, side: DockingSide): Point {
  if (side === 'left') return { x: shape.x, y: anchor.y };
  if (side === 'right') return { x: shape.x + shape.width, y: anchor.y };
  if (side === 'top') return { x: anchor.x, y: shape.y };
  return { x: anchor.x, y: shape.y + shape.height };
}
