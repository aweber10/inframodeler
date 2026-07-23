import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type EditorActions from 'diagram-js/lib/features/editor-actions/EditorActions';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import type { Connection, Element, Shape } from 'diagram-js/lib/model/Types';

import { separateParallelSegments } from './connectionRouting';
import { routeConnectionOrthogonal } from './InfraLayouter';

interface UpdateWaypointsContext {
  connection?: Connection;
  hints?: { parallelSeparation?: boolean; bendpointMove?: unknown; segmentMove?: unknown; unpinRouting?: boolean };
  oldPinnedRouting?: boolean;
}

interface ReconnectContext {
  connection: Connection;
  oldPinnedRouting?: boolean;
}

interface CreateConnectionContext {
  connection: Connection;
  hints?: { skipAutomaticRouting?: boolean };
}

interface MoveShapeContext {
  shape: Shape;
  oldLabelPosition?: { x: number; y: number };
}

export default class InfraRoutingBehavior extends CommandInterceptor {
  static override $inject = ['eventBus', 'elementRegistry', 'modeling', 'editorActions', 'selection'];

  constructor(
    eventBus: EventBus,
    private readonly elementRegistry: ElementRegistry,
    private readonly modeling: Modeling,
    editorActions: EditorActions,
    selection: Selection
  ) {
    super(eventBus);

    eventBus.on('shape.move.move', 750, (event: { hover?: Element }) => {
      if (event.hover?.labelTarget) event.hover = event.hover.parent;
    });
    eventBus.on('shape.move.move', 400, ({ context }: { context: { shape?: Shape; target?: Element; canExecute?: boolean } }) => {
      if (!context.shape?.labelTarget) return;
      context.target = context.shape.parent;
      context.canExecute = true;
    });

    this.postExecute('connection.create', ({ context }: { context: CreateConnectionContext }) => {
      if (!context.hints?.skipAutomaticRouting) this.reroute([context.connection]);
      this.createLabel(context.connection);
    });
    this.postExecute('infra.updateText', ({ context }: { context: { element: Element } }) => {
      if (isConnection(context.element)) this.createLabel(context.element);
    });
    this.execute('connection.updateWaypoints', ({ context }: { context: UpdateWaypointsContext }) => {
      const connection = context.connection;
      if (!connection?.businessObject) return;
      context.oldPinnedRouting = Boolean(connection.businessObject.pinnedRouting);
      if (context.hints?.unpinRouting) connection.businessObject.pinnedRouting = false;
      else if (context.hints?.bendpointMove || context.hints?.segmentMove) connection.businessObject.pinnedRouting = true;
    });
    this.revert('connection.updateWaypoints', ({ context }: { context: UpdateWaypointsContext }) => {
      if (context.connection?.businessObject && context.oldPinnedRouting !== undefined) {
        context.connection.businessObject.pinnedRouting = context.oldPinnedRouting;
      }
    });
    this.execute('connection.reconnect', ({ context }: { context: ReconnectContext }) => {
      if (!context.connection.businessObject) return;
      context.oldPinnedRouting = Boolean(context.connection.businessObject.pinnedRouting);
      context.connection.businessObject.pinnedRouting = true;
    });
    this.revert('connection.reconnect', ({ context }: { context: ReconnectContext }) => {
      if (context.connection.businessObject && context.oldPinnedRouting !== undefined) {
        context.connection.businessObject.pinnedRouting = context.oldPinnedRouting;
      }
    });
    this.executed('shape.move', ({ context }: { context: MoveShapeContext }) => this.storeLabelPosition(context));
    this.reverted('shape.move', ({ context }: { context: MoveShapeContext }) => {
      const target = context.shape.labelTarget as Connection | undefined;
      if (target?.businessObject) target.businessObject.labelPosition = context.oldLabelPosition;
    });
    editorActions.register({ rerouteConnections: () => {
      const selected = selection.get().filter(isConnection);
      this.reroute(selected.length ? selected : (this.elementRegistry.getAll() as Element[]).filter(isConnection), new Set(selected));
    } });
  }

  private reroute(connections: readonly Connection[], explicitlySelected = new Set<Connection>()): void {
    for (const connection of connections) {
      if (connection.businessObject?.pinnedRouting && !explicitlySelected.has(connection)) continue;
      const waypoints = routeConnectionOrthogonal(connection, this.elementRegistry);
      if (waypoints && (!sameWaypoints(connection.waypoints, waypoints) || explicitlySelected.has(connection))) {
        this.modeling.updateWaypoints(connection, waypoints, { automaticRouting: true, unpinRouting: explicitlySelected.has(connection) });
      }
    }
    this.separateConnections();
  }

  private separateConnections(): void {
    const connections = (this.elementRegistry.getAll() as Element[]).filter(isConnection).filter((connection) => !connection.businessObject?.pinnedRouting);
    const separated = separateParallelSegments(connections);
    for (let index = 0; index < connections.length; index += 1) {
      const connection = connections[index]!;
      const waypoints = separated[index]!.waypoints;
      if (!sameWaypoints(connection.waypoints, waypoints)) {
        this.modeling.updateWaypoints(connection, [...waypoints], { parallelSeparation: true });
      }
    }
  }

  private createLabel(connection: Connection): void {
    if (!connection.businessObject?.label || connection.labels?.length) return;
    const position = connection.businessObject.labelPosition ?? longestSegmentMidpoint(connection.waypoints);
    this.modeling.createLabel(connection, position, {
      id: `${connection.id}_label`,
      width: connection.businessObject.label.length * 6.4 + 12,
      height: 18,
      businessObject: connection.businessObject
    });
  }

  private storeLabelPosition(context: MoveShapeContext): void {
    const target = context.shape.labelTarget as Connection | undefined;
    if (!target?.businessObject) return;
    context.oldLabelPosition = target.businessObject.labelPosition;
    target.businessObject.labelPosition = {
      x: context.shape.x + context.shape.width / 2,
      y: context.shape.y + context.shape.height / 2
    };
  }
}

function longestSegmentMidpoint(waypoints: readonly { x: number; y: number }[]): { x: number; y: number } {
  let longest = { start: waypoints[0]!, end: waypoints[1]!, length: -1 };
  for (let index = 1; index < waypoints.length; index += 1) {
    const start = waypoints[index - 1]!;
    const end = waypoints[index]!;
    const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
    if (length > longest.length) longest = { start, end, length };
  }
  return { x: (longest.start.x + longest.end.x) / 2, y: (longest.start.y + longest.end.y) / 2 };
}

function isConnection(element: Element): element is Connection {
  return Array.isArray((element as Connection).waypoints);
}

function sameWaypoints(a: readonly { x: number; y: number }[], b: readonly { x: number; y: number }[]): boolean {
  return a.length === b.length && a.every((point, index) => point.x === b[index]!.x && point.y === b[index]!.y);
}
