import type { Parent, Shape } from 'diagram-js/lib/model/Types';
import { describe, expect, it } from 'vitest';

import { canPlace } from '../src/editor/infra/InfraRules';

function shape(type: string): Shape {
  return { businessObject: { type } } as Shape;
}

describe('InfraRules placement', () => {
  it('allows valid nested placement', () => {
    expect(canPlace(shape('server') as Parent, shape('module'))).toBe(true);
    expect(canPlace(shape('syssoft') as Parent, shape('module'))).toBe(true);
  });

  it('rejects invalid nested placement', () => {
    expect(canPlace(shape('db') as Parent, shape('module'))).toBe(false);
    expect(canPlace(shape('zone') as Parent, shape('syssoft'))).toBe(false);
  });

  it('allows POC-compatible root placement', () => {
    expect(canPlace(null, shape('module'))).toBe(true);
    expect(canPlace({} as Parent, shape('syssoft'))).toBe(true);
  });
});
