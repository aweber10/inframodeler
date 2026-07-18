import type { Parent, Shape } from 'diagram-js/lib/model/Types';
import { describe, expect, it } from 'vitest';

import { canConnect, canPlace } from '../src/editor/infra/InfraRules';

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

describe('InfraRules connections', () => {
  it('creates communication connections between regular elements', () => {
    expect(canConnect(shape('module'), shape('db'))).toMatchObject({
      businessObject: { kind: 'communication' }
    });
  });

  it('creates note attachments without communication semantics', () => {
    expect(canConnect(shape('module'), shape('note'))).toMatchObject({
      businessObject: { kind: 'noteAttachment' }
    });
  });

  it('rejects self, zone and note-to-note connections', () => {
    const module = shape('module');
    expect(canConnect(module, module)).toBe(false);
    expect(canConnect(shape('zone'), shape('server'))).toBe(false);
    expect(canConnect(shape('note'), shape('note'))).toBe(false);
  });
});
