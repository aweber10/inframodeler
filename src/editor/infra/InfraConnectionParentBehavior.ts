import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Connection, Element, Parent } from 'diagram-js/lib/model/Types';

import { findCommonAncestor } from './elementHierarchy';

interface CreateConnectionContext {
  connection: Connection;
  source?: Element;
  target?: Element;
  parent?: Parent;
  parentIndex?: number;
}

/**
 * Parents every connection under the deepest common ancestor of its source and target instead of
 * diagram-js's default (always `source.parent`). Without this a connection whose target is nested
 * inside a container (e.g. a module/db inside a server) but whose source lives outside ends up as a
 * sibling of - or above - that container in the SVG tree. Once `updateContainments` reorders the
 * container after the connection, the container's own visual (e.g. the server "cube") paints over
 * the connection, hiding the part that reaches into the container, including its arrowhead.
 *
 * This covers every creation path that runs through the `connection.create` command: the interactive
 * connect tool, programmatic `modeling.connect` (import, demo) and `modeling.appendShape`.
 */
export default class InfraConnectionParentBehavior extends CommandInterceptor {
  static override $inject = ['eventBus', 'canvas'];

  constructor(eventBus: EventBus, private readonly canvas: Canvas) {
    super(eventBus);

    this.preExecute('connection.create', ({ context }: { context: CreateConnectionContext }) => {
      if (!context.source || !context.target) return;
      const parent = findCommonAncestor(context.source, context.target, this.canvas.getRootElement() as Parent);
      if (parent && parent !== context.parent) {
        context.parent = parent;
        // The index is relative to the previous parent's children; drop it so the connection is
        // appended to the corrected parent instead.
        delete context.parentIndex;
      }
    });
  }
}

