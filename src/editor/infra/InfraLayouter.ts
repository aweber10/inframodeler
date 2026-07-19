import BaseLayouter, { type LayoutConnectionHints } from 'diagram-js/lib/layout/BaseLayouter';
import { connectRectangles, repairConnection } from 'diagram-js/lib/layout/ManhattanLayout';
import type { Connection, Shape } from 'diagram-js/lib/model/Types';
import type { Point } from 'diagram-js/lib/util/Types';

export default class InfraLayouter extends BaseLayouter {
  override layoutConnection(connection: Connection, hints: LayoutConnectionHints = {}): Point[] {
    const source = (hints.source ?? connection.source) as Shape;
    const target = (hints.target ?? connection.target) as Shape;
    const layoutHints = {
      preferredLayouts: ['h:h', 'v:v'],
      connectionStart: Boolean(hints.connectionStart),
      connectionEnd: Boolean(hints.connectionEnd)
    };

    if (connection.waypoints?.length) {
      return repairConnection(
        source,
        target,
        hints.connectionStart,
        hints.connectionEnd,
        connection.waypoints,
        layoutHints
      );
    }

    return connectRectangles(source, target, hints.connectionStart, hints.connectionEnd, layoutHints);
  }
}

export function normalizeDocking(connection: Connection): Point[] {
  const source = connection.source as Shape;
  const target = connection.target as Shape;
  if (!connection.waypoints?.length) return connectRectangles(source, target);
  return repairConnection(source, target, undefined, undefined, connection.waypoints, {
    preferredLayouts: ['h:h', 'v:v'],
    connectionStart: true,
    connectionEnd: true
  });
}
