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
  createInfraShape(type: InfraType, attrs: Partial<InfraShape> = {}): InfraShape {
    const definition = TYPE_DEFINITIONS[type];
    const businessObject: InfraBusinessObject = {
      type,
      name: attrs.businessObject?.name ?? definition.defaultName
    };

    return this.createShape({
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
      ...attrs,
      businessObject: {
        kind: businessObject.kind ?? 'communication',
        label: businessObject.label ?? ''
      }
    }) as InfraConnection;
  }
}
