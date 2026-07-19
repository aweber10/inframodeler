import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Shape } from 'diagram-js/lib/model/Types';
import type { Dimensions, RectTRBL } from 'diagram-js/lib/util/Types';

import { CONTAINER_PADDING, TYPE_DEFINITIONS, isInfraType } from './meta/types';

interface ResizeStartEvent {
  context: {
    shape: Shape;
    minDimensions?: Dimensions;
    childrenBoxPadding?: RectTRBL;
  };
}

export default class InfraResizeBehavior {
  static $inject = ['eventBus'];

  constructor(eventBus: EventBus) {
    eventBus.on('resize.start', 1500, ({ context }: ResizeStartEvent) => {
      const type = context.shape.businessObject?.type;
      if (!isInfraType(type) || !(type in CONTAINER_PADDING)) return;

      const padding = CONTAINER_PADDING[type as keyof typeof CONTAINER_PADDING];
      context.minDimensions = {
        width: TYPE_DEFINITIONS[type].width,
        height: TYPE_DEFINITIONS[type].height
      };
      context.childrenBoxPadding = {
        top: padding.top,
        right: padding.side + (type === 'server' ? 12 : 0),
        bottom: padding.bottom,
        left: padding.side
      };
    });
  }
}
