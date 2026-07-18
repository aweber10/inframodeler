import type { Shape } from 'diagram-js/lib/model/Types';
import { describe, expect, it } from 'vitest';

import { getInsidePosition } from '../src/editor/infra/InfraAutoPlace';
import type { InfraShape } from '../src/editor/infra/InfraElementFactory';

function shape(type: 'zone' | 'server' | 'syssoft' | 'module', attrs: Partial<Shape>): InfraShape {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    children: [],
    businessObject: { type, name: type },
    ...attrs
  } as InfraShape;
}

describe('inside auto placement', () => {
  it('uses POC padding for the first child', () => {
    const parent = shape('server', { x: 100, y: 50, width: 230, height: 130 });
    const child = shape('syssoft', { width: 200, height: 95 });

    expect(getInsidePosition(parent, child)).toEqual({ x: 216, y: 133.5 });
  });

  it('stacks below the lowest child', () => {
    const existing = shape('module', { x: 120, y: 100, width: 156, height: 46 });
    const parent = shape('syssoft', { x: 100, y: 60, children: [existing] });
    const child = shape('module', { width: 156, height: 46 });

    expect(getInsidePosition(parent, child)).toEqual({ x: 198, y: 181 });
  });
});
