import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type { Element, Shape } from 'diagram-js/lib/model/Types';

import { CONTAINER_PADDING, TYPE_DEFINITIONS, isInfraType } from './meta/types';

interface DeleteContext {
  elements: Element[];
  infraOldParents?: Shape[];
}

interface MoveContext {
  shapes: Shape[];
  infraOldParents?: Shape[];
}

interface TextContext {
  element: Element;
}

export default class InfraFitBehavior extends CommandInterceptor {
  static override $inject = ['eventBus', 'modeling'];

  constructor(eventBus: EventBus, private readonly modeling: Modeling) {
    super(eventBus);

    this.preExecute('elements.delete', ({ context }: { context: DeleteContext }) => {
      context.infraOldParents = uniqueContainerParents(context.elements);
    });
    this.postExecute('elements.delete', ({ context }: { context: DeleteContext }) => {
      this.fitAll(context.infraOldParents ?? []);
    });

    this.preExecute('elements.move', ({ context }: { context: MoveContext }) => {
      context.infraOldParents = uniqueContainerParents(context.shapes);
    });
    this.postExecute('elements.move', ({ context }: { context: MoveContext }) => {
      this.fitAll(context.infraOldParents ?? []);
    });

    this.postExecute('infra.updateText', ({ context }: { context: TextContext }) => {
      const parent = context.element.parent;
      if (parent && isShape(parent)) this.fit(parent);
    });
  }

  private fitAll(containers: Shape[]): void {
    for (const container of containers) this.fit(container);
  }

  private fit(container: Shape): void {
    const type = container.businessObject?.type;
    if (!isInfraType(type) || !(type in CONTAINER_PADDING)) return;

    const padding = CONTAINER_PADDING[type as keyof typeof CONTAINER_PADDING];
    const definition = TYPE_DEFINITIONS[type];
    const children = container.children.filter(isShape);
    const right = children.length ? Math.max(...children.map((child) => child.x + child.width)) : container.x;
    const bottom = children.length ? Math.max(...children.map((child) => child.y + child.height)) : container.y;
    const width = Math.max(
      definition.width,
      right - container.x + padding.side + (type === 'server' ? 12 : 0)
    );
    const height = Math.max(definition.height, bottom - container.y + padding.bottom);

    if (width !== container.width || height !== container.height) {
      this.modeling.resizeShape(container, { x: container.x, y: container.y, width, height }, undefined, {
        autoResize: false
      });
    }

    if (container.parent && isShape(container.parent)) this.fit(container.parent);
  }
}

function uniqueContainerParents(elements: Element[]): Shape[] {
  return [...new Set(elements.map((element) => element.parent).filter(isShape))];
}

function isShape(element: Element | undefined): element is Shape {
  return Boolean(element && 'width' in element && 'height' in element);
}
