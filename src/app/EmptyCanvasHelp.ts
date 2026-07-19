import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';

export default class EmptyCanvasHelp {
  constructor(
    private readonly elementRegistry: ElementRegistry,
    private readonly element: HTMLElement,
    eventBus: EventBus
  ) {
    eventBus.on(['shape.added', 'shape.removed', 'diagram.clear'], () => queueMicrotask(() => this.update()));
    this.update();
  }

  update(): void {
    const hasShapes = this.elementRegistry.getAll().some((item) => 'width' in item && !item.labelTarget);
    this.element.hidden = hasShapes;
  }
}
