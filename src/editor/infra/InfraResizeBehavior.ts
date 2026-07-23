import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Shape } from 'diagram-js/lib/model/Types';
import type { Dimensions, RectTRBL } from 'diagram-js/lib/util/Types';
import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import { CONTAINER_PADDING, TYPE_DEFINITIONS, isInfraType } from './meta/types';

interface ResizeStartEvent {
  context: {
    shape: Shape;
    minDimensions?: Dimensions;
    childrenBoxPadding?: RectTRBL;
  };
}

interface ResizeCommandContext {
  shape: Shape;
  newBounds: { width: number; height: number };
  oldManualMinWidth?: number;
  oldManualMinHeight?: number;
  manualResize?: boolean;
}

export default class InfraResizeBehavior extends CommandInterceptor {
  static override $inject = ['eventBus'];

  private readonly manuallyResizing = new Set<Shape>();

  constructor(eventBus: EventBus) {
    super(eventBus);

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
    eventBus.on('resize.end', 1500, ({ context }: ResizeStartEvent) => {
      this.manuallyResizing.add(context.shape);
    });
    eventBus.on('resize.cleanup', () => this.manuallyResizing.clear());

    this.execute('shape.resize', ({ context }: { context: ResizeCommandContext }) => {
      if (!this.manuallyResizing.has(context.shape) || !isResizableContainer(context.shape)) return;
      context.manualResize = true;
      context.oldManualMinWidth = context.shape.businessObject.manualMinWidth;
      context.oldManualMinHeight = context.shape.businessObject.manualMinHeight;
      context.shape.businessObject.manualMinWidth = context.newBounds.width;
      context.shape.businessObject.manualMinHeight = context.newBounds.height;
    });
    this.revert('shape.resize', ({ context }: { context: ResizeCommandContext }) => {
      if (!context.manualResize) return;
      context.shape.businessObject.manualMinWidth = context.oldManualMinWidth;
      context.shape.businessObject.manualMinHeight = context.oldManualMinHeight;
    });
  }
}

function isResizableContainer(shape: Shape): boolean {
  const type = shape.businessObject?.type;
  return isInfraType(type) && type in CONTAINER_PADDING;
}
