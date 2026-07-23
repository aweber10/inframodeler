import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type { Connection, Element, Parent, Shape } from 'diagram-js/lib/model/Types';

import { findCommonAncestor } from './elementHierarchy';

interface CreateConnectionContext {
  connection: Connection;
  source?: Element;
  target?: Element;
  parent?: Parent;
  parentIndex?: number;
}

interface MoveShapeContext {
  shape: Shape;
}

interface MoveElementsContext {
  shapes: Shape[];
}

const NO_DELTA = { x: 0, y: 0 };

/**
 * Keeps every connection parented under the deepest common ancestor of its source and target,
 * instead of diagram-js's default (always `source.parent`).
 *
 * Without this a connection whose target is nested inside a container (e.g. a module/db inside a
 * server) but whose source lives in a different branch ends up trapped in the source container's
 * children group - a sibling shape (another server cube) then paints over the part of the line
 * reaching into the target, hiding its arrowhead.
 *
 * Two hooks are needed:
 *  - connection.create: pick the right parent when the connection is first created.
 *  - shape.move / elements.move: re-parent affected connections after a shape (and thus the common
 *    ancestor of its connections) moves into or out of a container.
 */
export default class InfraConnectionParentBehavior extends CommandInterceptor {
  static override $inject = ['eventBus', 'canvas', 'modeling'];

  constructor(eventBus: EventBus, private readonly canvas: Canvas, private readonly modeling: Modeling) {
    super(eventBus);

    this.preExecute('connection.create', ({ context }: { context: CreateConnectionContext }) => {
      if (!context.source || !context.target) return;
      const parent = this.commonParent(context.source, context.target);
      if (parent && parent !== context.parent) {
        context.parent = parent;
        // The index is relative to the previous parent's children; drop it so the connection is
        // appended to the corrected parent instead.
        delete context.parentIndex;
      }
    });

    this.postExecuted('shape.move', ({ context }: { context: MoveShapeContext }) => {
      if (context.shape.labelTarget) return;
      this.reparentConnectionsOf([context.shape]);
    });

    this.postExecuted('elements.move', ({ context }: { context: MoveElementsContext }) => {
      this.reparentConnectionsOf((context.shapes ?? []).filter((shape) => !shape.labelTarget));
    });
  }

  private reparentConnectionsOf(shapes: Shape[]): void {
    const connections = new Set<Connection>();
    for (const shape of shapes) {
      for (const connection of connectionsInSubtree(shape)) connections.add(connection);
    }

    for (const connection of connections) {
      if (!connection.source || !connection.target) continue;
      const parent = this.commonParent(connection.source, connection.target);
      if (!parent) continue;
      // Re-parent onto the common ancestor. Even when the parent is unchanged we re-append the
      // connection so it moves to the end of the children list and paints above sibling containers
      // (e.g. a server cube) it now crosses into after the move.
      this.moveToFront(connection, parent);
    }
  }

  /** Moves the connection under `parent`, ensuring it is the last child so it paints on top. */
  private moveToFront(connection: Connection, parent: Parent): void {
    const siblings = (parent.children as Element[] | undefined) ?? [];
    const alreadyLast = connection.parent === parent && siblings[siblings.length - 1] === connection;
    if (alreadyLast) return;
    this.modeling.moveConnection(connection, NO_DELTA, parent);
  }

  private commonParent(source: Element, target: Element): Parent {
    return findCommonAncestor(source, target, this.canvas.getRootElement() as Parent);
  }
}

/** All connections attached to a shape or any of its descendants. */
function connectionsInSubtree(shape: Shape): Connection[] {
  const result: Connection[] = [
    ...((shape.incoming as Connection[]) ?? []),
    ...((shape.outgoing as Connection[]) ?? [])
  ];
  for (const child of (shape.children as Shape[]) ?? []) {
    result.push(...connectionsInSubtree(child));
  }
  return result;
}
