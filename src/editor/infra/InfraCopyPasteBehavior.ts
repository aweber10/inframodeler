import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Element } from 'diagram-js/lib/model/Types';

interface CopyContext {
  descriptor: Record<string, unknown>;
  element: Element;
}

interface PasteContext {
  descriptor: Record<string, unknown>;
}

export default class InfraCopyPasteBehavior {
  static $inject = ['eventBus'];

  constructor(eventBus: EventBus) {
    eventBus.on('copyPaste.copyElement', 1500, ({ descriptor, element }: CopyContext) => {
      descriptor.businessObject = structuredClone(element.businessObject);
    });
    eventBus.on('copyPaste.pasteElement', 1500, ({ descriptor }: PasteContext) => {
      if (descriptor.businessObject) {
        descriptor.businessObject = structuredClone(descriptor.businessObject);
      }
    });
  }
}
