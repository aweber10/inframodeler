import { describe, expect, it } from 'vitest';

import InfraElementFactory from '../src/editor/infra/InfraElementFactory';
import { INFRA_TYPES, TYPE_DEFINITIONS } from '../src/editor/infra/meta/types';

describe('InfraElementFactory', () => {
  it('creates every type with its POC defaults', () => {
    const factory = new InfraElementFactory();

    for (const type of INFRA_TYPES) {
      const shape = factory.createInfraShape(type);
      const definition = TYPE_DEFINITIONS[type];

      expect(shape.width).toBe(definition.width);
      expect(shape.height).toBe(definition.height);
      expect(shape.businessObject).toEqual({ type, name: definition.defaultName });
    }
  });

  it('preserves explicit IDs and names', () => {
    const factory = new InfraElementFactory();
    const shape = factory.createInfraShape('module', {
      id: 'module_webshop',
      businessObject: { type: 'module', name: 'Webshop' }
    });

    expect(shape.id).toBe('module_webshop');
    expect(shape.businessObject.name).toBe('Webshop');
  });

  it('creates typed connections', () => {
    const factory = new InfraElementFactory();
    const connection = factory.createInfraConnection({}, {
      kind: 'communication',
      label: 'JDBC'
    });

    expect(connection.businessObject).toEqual({ kind: 'communication', label: 'JDBC' });
  });
});
