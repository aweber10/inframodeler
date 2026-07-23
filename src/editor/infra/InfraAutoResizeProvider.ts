import type EventBus from 'diagram-js/lib/core/EventBus';
import AutoResizeProvider from 'diagram-js/lib/features/auto-resize/AutoResizeProvider';
import type { Shape } from 'diagram-js/lib/model/Types';

import { CONTAINER_PADDING, isInfraType } from './meta/types';

export default class InfraAutoResizeProvider extends AutoResizeProvider {
  static override $inject = ['eventBus'];

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  override canResize(_elements: Shape[], target: Shape): boolean {
    const type = target?.businessObject?.type;
    return _elements.length > 0
      && _elements.every((element) => !element.labelTarget && isInfraType(element.businessObject?.type))
      && isInfraType(type) && type in CONTAINER_PADDING;
  }
}
