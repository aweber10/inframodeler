import ElementFactory from 'diagram-js/lib/core/ElementFactory';
import type { Shape } from 'diagram-js/lib/model/Types';

import {
  TYPE_DEFINITIONS,
  type InfraBusinessObject,
  type InfraType
} from './meta/types';

export type InfraShape = Shape & { businessObject: InfraBusinessObject };

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
}
