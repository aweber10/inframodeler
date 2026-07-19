import type EventBus from 'diagram-js/lib/core/EventBus';
import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';
import type { Connection, Element, Parent, Shape } from 'diagram-js/lib/model/Types';

import type { InfraShape } from './InfraElementFactory';
import { canContain, canCreateAtRoot } from './meta/containment';
import { CONTAINER_PADDING, isInfraType } from './meta/types';

interface CreateContext {
  shape: Shape;
  target: Parent | null;
}

interface MoveContext {
  shapes: Shape[];
  target: Parent | null;
}

interface ConnectionContext {
  source: Element;
  target: Element;
}

interface CreateElementsContext {
  elements: Element[];
  target: Parent | null;
}

interface ResizeContext {
  shape: Shape;
}

export function canPlace(target: Parent | null, rawShape: Shape): boolean {
  const shape = rawShape as InfraShape;
  const childType = shape.businessObject?.type;
  if (!isInfraType(childType)) return false;

  const parentType = target?.businessObject?.type;
  if (!isInfraType(parentType)) return canCreateAtRoot();

  return canContain(parentType, childType);
}

export function canConnect(source: Element, target: Element): false | Partial<Connection> {
  const sourceType = source.businessObject?.type;
  const targetType = target.businessObject?.type;

  if (!isInfraType(sourceType) || !isInfraType(targetType)) return false;
  if (source === target || sourceType === 'zone' || targetType === 'zone') return false;
  if (sourceType === 'note' && targetType === 'note') return false;

  return {
    businessObject: {
      kind: sourceType === 'note' || targetType === 'note' ? 'noteAttachment' : 'communication'
    }
  };
}

export function canResizeContainer(shape: Shape): boolean {
  const type = shape.businessObject?.type;
  return isInfraType(type) && type in CONTAINER_PADDING;
}

export default class InfraRules extends RuleProvider {
  static override $inject = ['eventBus'];

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  override init(): void {
    this.addRule('shape.create', ({ target, shape }: CreateContext) => canPlace(target, shape));
    this.addRule('elements.move', ({ target, shapes }: MoveContext) =>
      shapes.every((shape) => canPlace(target, shape))
    );
    this.addRule('connection.create', ({ source, target }: ConnectionContext) =>
      canConnect(source, target)
    );
    this.addRule('elements.create', ({ elements, target }: CreateElementsContext) =>
      elements.filter((element): element is Shape => 'width' in element && !('waypoints' in element))
        .every((shape) => shape.parent || canPlace(target, shape))
    );
    this.addRule('shape.resize', ({ shape }: ResizeContext) => {
      return canResizeContainer(shape);
    });
  }
}
