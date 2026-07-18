import type { Element } from 'diagram-js/lib/model/Types';

import type { InfraConnection, InfraShape } from '../InfraElementFactory';

export interface UpdateTextContext {
  element: InfraShape | InfraConnection;
  value: string;
  oldValue?: string;
  oldHeight?: number;
}

export default class UpdateTextHandler {
  execute(context: UpdateTextContext): Element[] {
    const { element } = context;
    context.oldValue = getValue(element);
    context.oldHeight = isShape(element) ? element.height : undefined;
    setValue(element, context.value);
    resizeNote(element);
    return [element];
  }

  revert(context: UpdateTextContext): Element[] {
    setValue(context.element, context.oldValue ?? '');
    if (isShape(context.element) && context.oldHeight !== undefined) {
      context.element.height = context.oldHeight;
    }
    return [context.element];
  }
}

function getValue(element: InfraShape | InfraConnection): string {
  return isShape(element)
    ? element.businessObject.name
    : element.businessObject.label ?? '';
}

function setValue(element: InfraShape | InfraConnection, value: string): void {
  if (isShape(element)) element.businessObject.name = value;
  else element.businessObject.label = value;
}

function resizeNote(element: InfraShape | InfraConnection): void {
  if (!isShape(element) || element.businessObject.type !== 'note') return;
  const lineCount = wrapText(element.businessObject.name, 27).length;
  element.height = Math.max(56, lineCount * 16 + 24);
}

function wrapText(text: string, maxCharacters: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (`${current} ${word}`.trim().length > maxCharacters && current) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function isShape(element: InfraShape | InfraConnection): element is InfraShape {
  return 'width' in element;
}
