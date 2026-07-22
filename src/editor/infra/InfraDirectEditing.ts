import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Element } from 'diagram-js/lib/model/Types';

import type { InfraConnection, InfraShape } from './InfraElementFactory';
import { getLabelPoint } from './InfraRenderer';
import type UpdateTextHandler from './commands/UpdateTextHandler';
import { isInfraType } from './meta/types';

interface DirectEditing {
  activate(element: Element): boolean;
  cancel(): void;
  complete(): void;
  isActive(element?: Element): boolean;
  registerProvider(provider: InfraDirectEditing): void;
}

interface EditingContext {
  bounds: { x: number; y: number; width: number; height: number };
  text: string;
  style: Record<string, string>;
  options?: { centerVertically?: boolean; autoResize?: boolean };
}

export default class InfraDirectEditing {
  static $inject = ['canvas', 'commandStack', 'directEditing', 'eventBus'];

  constructor(
    private readonly canvas: Canvas,
    private readonly commandStack: CommandStack,
    directEditing: DirectEditing,
    eventBus: EventBus
  ) {
    directEditing.registerProvider(this);
    eventBus.on('element.dblclick', ({ element }: { element: Element }) => {
      directEditing.activate(element);
    });
    eventBus.on(['canvas.viewbox.changing', 'drag.init'], () => {
      if (directEditing.isActive()) directEditing.complete();
    });
  }

  activate(element: Element): EditingContext | undefined {
    if (element.labelTarget && isConnection(element.labelTarget)) return this.connectionContext(element.labelTarget, element);
    if (isConnection(element)) return this.connectionContext(element);
    if (!isInfraType(element.businessObject?.type)) return undefined;

    const shape = element as InfraShape;
    const bounds = this.canvas.getAbsoluteBBox(shape);
    return {
      bounds,
      text: shape.businessObject.name,
      style: {
        fontFamily: 'Inter, sans-serif',
        fontSize: `${12.5 * this.canvas.zoom()}px`,
        fontWeight: '500',
        border: '1.5px solid #0f766e',
        borderRadius: '4px',
        padding: '3px 6px'
      },
      options: {
        centerVertically: shape.businessObject.type !== 'note',
        autoResize: shape.businessObject.type === 'note' || shape.businessObject.type === 'syssoft'
      }
    };
  }

  update(element: InfraShape | InfraConnection, value: string): void {
    if (element.labelTarget && isConnection(element.labelTarget)) element = element.labelTarget;
    const trimmed = value.trim();
    if (!isConnection(element) && !trimmed) return;
    this.commandStack.execute('infra.updateText', {
      element,
      value: isConnection(element) ? trimmed : trimmed || element.businessObject.name
    } satisfies Parameters<UpdateTextHandler['execute']>[0]);
  }

  private connectionContext(connection: InfraConnection, labelShape?: Element): EditingContext | undefined {
    if (connection.businessObject.kind === 'noteAttachment') return undefined;
    const point = labelShape && 'width' in labelShape
      ? { x: labelShape.x + labelShape.width / 2, y: labelShape.y + labelShape.height / 2 }
      : getLabelPoint(connection.waypoints);
    const viewbox = this.canvas.viewbox();
    const zoom = this.canvas.zoom();
    const absolute = {
      x: (point.x - viewbox.x) * zoom,
      y: (point.y - viewbox.y) * zoom
    };
    return {
      bounds: { x: absolute.x - 90, y: absolute.y - 14, width: 180, height: 28 },
      text: connection.businessObject.label ?? '',
      style: {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: `${10.5 * this.canvas.zoom()}px`,
        border: '1.5px solid #0f766e',
        borderRadius: '4px',
        padding: '3px 6px'
      },
      options: { centerVertically: true }
    };
  }
}

function isConnection(element: Element): element is InfraConnection {
  return Array.isArray((element as InfraConnection).waypoints);
}
