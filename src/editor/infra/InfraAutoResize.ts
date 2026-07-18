import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import AutoResize from 'diagram-js/lib/features/auto-resize/AutoResize';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type Rules from 'diagram-js/lib/features/rules/Rules';
import type { Shape } from 'diagram-js/lib/model/Types';
import type { RectTRBL } from 'diagram-js/lib/util/Types';

import { CONTAINER_PADDING, isInfraType } from './meta/types';

export default class InfraAutoResize extends AutoResize {
  static override $inject = ['eventBus', 'elementRegistry', 'modeling', 'rules'];

  constructor(
    eventBus: EventBus,
    elementRegistry: ElementRegistry,
    modeling: Modeling,
    rules: Rules
  ) {
    super(eventBus, elementRegistry, modeling, rules);
  }

  override getOffset(shape: Shape): RectTRBL {
    const type = shape.businessObject?.type;
    if (!isInfraType(type) || !(type in CONTAINER_PADDING)) {
      return super.getOffset(shape);
    }

    const padding = CONTAINER_PADDING[type as keyof typeof CONTAINER_PADDING];
    const right = padding.side + (type === 'server' ? 12 : 0);
    return { top: padding.top, bottom: padding.bottom, left: padding.side, right };
  }

  override getPadding(shape: Shape): RectTRBL {
    return this.getOffset(shape);
  }
}
