import type { Element } from 'diagram-js/lib/model/Types';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';

import type { InfraConnection, InfraShape } from '../InfraElementFactory';
import { TYPE_DEFINITIONS } from '../meta/types';

export interface UpdateTextContext {
  element: InfraShape | InfraConnection;
  value: string;
  oldValue?: string;
}

export default class UpdateTextHandler {
  static $inject = ['modeling'];

  constructor(private readonly modeling: Modeling) {}

  execute(context: UpdateTextContext): Element[] {
    const { element } = context;
    context.oldValue = getValue(element);
    setValue(element, context.value);
    return [element];
  }

  postExecute(context: UpdateTextContext): void {
    if (!isShape(context.element)) return;
    const bounds = getTextBounds(context.element);
    if (!bounds) return;
    this.modeling.resizeShape(context.element, bounds);
  }

  revert(context: UpdateTextContext): Element[] {
    setValue(context.element, context.oldValue ?? '');
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

function getTextBounds(element: InfraShape) {
  let width = element.width;
  let height = element.height;
  if (element.businessObject.type === 'note') {
    height = Math.max(56, wrapText(element.businessObject.name, 27).length * 16 + 24);
  }
  if (element.businessObject.type === 'syssoft') {
    const titleWidth = 32 + element.businessObject.name.length * 6.9 + 12;
    const childrenRight = element.children
      .filter(isChildShape)
      .reduce((right, child) => Math.max(right, child.x + child.width - element.x + 14), 0);
    width = Math.max(TYPE_DEFINITIONS.syssoft.width, Math.ceil(titleWidth), childrenRight);
  }
  if (width === element.width && height === element.height) return undefined;
  return { x: element.x, y: element.y, width, height };
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

function isChildShape(element: Element): element is InfraShape {
  return 'width' in element && 'height' in element;
}
