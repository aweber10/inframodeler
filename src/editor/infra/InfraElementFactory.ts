import ElementFactory from 'diagram-js/lib/core/ElementFactory';
import type { Connection, Shape } from 'diagram-js/lib/model/Types';

import {
  TYPE_DEFINITIONS,
  type InfraBusinessObject,
  type InfraConnectionBusinessObject,
  type InfraType
} from './meta/types';

export type InfraShape = Shape & { businessObject: InfraBusinessObject };
export type InfraConnection = Connection & { businessObject: InfraConnectionBusinessObject };

export default class InfraElementFactory extends ElementFactory {
  private readonly counters = new Map<string, number>();

  createInfraShape(type: InfraType, attrs: Partial<InfraShape> = {}): InfraShape {
    const definition = TYPE_DEFINITIONS[type];
    const businessObject: InfraBusinessObject = {
      type,
      name: attrs.businessObject?.name ?? definition.defaultName,
      extensions: attrs.businessObject?.extensions
    };

    return this.createShape({
      id: attrs.id ?? this.nextId(type),
      width: definition.width,
      height: definition.height,
      ...attrs,
      businessObject
    }) as InfraShape;
  }

  createInfraConnection(
    attrs: Partial<InfraConnection> = {},
    businessObject: Partial<InfraConnectionBusinessObject> = {}
  ): InfraConnection {
    return this.createConnection({
      id: attrs.id ?? this.nextId('connection'),
      ...attrs,
      businessObject: {
        kind: businessObject.kind ?? 'communication',
        label: businessObject.label ?? '',
        extensions: businessObject.extensions,
        waypointExtensions: businessObject.waypointExtensions
      }
    }) as InfraConnection;
  }

  reserveId(id: string): void {
    const match = /^(.*)_(\d+)$/.exec(id);
    if (!match) return;
    const prefix = match[1]!;
    const number = Number(match[2]);
    this.counters.set(prefix, Math.max(this.counters.get(prefix) ?? 0, number));
  }

  private nextId(prefix: string): string {
    const next = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, next);
    return `${prefix}_${next}`;
  }
}
