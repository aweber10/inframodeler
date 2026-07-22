import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type { Connection, Element } from 'diagram-js/lib/model/Types';

import { separateParallelSegments } from './connectionRouting';

interface UpdateWaypointsContext {
  hints?: { parallelSeparation?: boolean };
}

const MODEL_CHANGES = ['connection.create', 'connection.layout', 'shape.move', 'elements.move', 'shape.resize'];

export default class InfraRoutingBehavior extends CommandInterceptor {
  static override $inject = ['eventBus', 'elementRegistry', 'modeling'];

  constructor(eventBus: EventBus, private readonly elementRegistry: ElementRegistry, private readonly modeling: Modeling) {
    super(eventBus);

    this.postExecuted(MODEL_CHANGES, () => this.separateConnections());
    this.postExecuted('connection.updateWaypoints', ({ context }: { context: UpdateWaypointsContext }) => {
      if (!context.hints?.parallelSeparation) this.separateConnections();
    });
  }

  private separateConnections(): void {
    const connections = (this.elementRegistry.getAll() as Element[]).filter(isConnection);
    const separated = separateParallelSegments(connections);
    for (let index = 0; index < connections.length; index += 1) {
      const connection = connections[index]!;
      const waypoints = separated[index]!.waypoints;
      if (!sameWaypoints(connection.waypoints, waypoints)) {
        this.modeling.updateWaypoints(connection, [...waypoints], { parallelSeparation: true });
      }
    }
  }
}

function isConnection(element: Element): element is Connection {
  return Array.isArray((element as Connection).waypoints);
}

function sameWaypoints(a: readonly { x: number; y: number }[], b: readonly { x: number; y: number }[]): boolean {
  return a.length === b.length && a.every((point, index) => point.x === b[index]!.x && point.y === b[index]!.y);
}
