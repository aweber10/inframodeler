import type EventBus from 'diagram-js/lib/core/EventBus';
import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';
import type { Parent, Shape } from 'diagram-js/lib/model/Types';

import type { InfraShape } from './InfraElementFactory';
import { canContain, canCreateAtRoot } from './meta/containment';
import { isInfraType } from './meta/types';

interface CreateContext {
  shape: Shape;
  target: Parent | null;
}

interface MoveContext {
  shapes: Shape[];
  target: Parent | null;
}

export function canPlace(target: Parent | null, rawShape: Shape): boolean {
  const shape = rawShape as InfraShape;
  const childType = shape.businessObject?.type;
  if (!isInfraType(childType)) return false;

  const parentType = target?.businessObject?.type;
  if (!isInfraType(parentType)) return canCreateAtRoot();

  return canContain(parentType, childType);
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
  }
}
