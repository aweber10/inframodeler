import { describe, expect, it } from 'vitest';

import { canContain, canCreateAtRoot, CONTAINS } from '../../src/editor/infra/meta/containment';
import { INFRA_TYPES, type InfraType } from '../../src/editor/infra/meta/types';

const expected: Partial<Record<InfraType, readonly InfraType[]>> = {
  zone: ['server', 'db', 'esb', 'firewall', 'extsys', 'umsystem', 'actor', 'note'],
  server: ['syssoft', 'module', 'db'],
  syssoft: ['module']
};

describe('containment', () => {
  it('matches every combination in the metamodel', () => {
    for (const parent of INFRA_TYPES) {
      for (const child of INFRA_TYPES) {
        expect(canContain(parent, child), `${parent} -> ${child}`).toBe(
          expected[parent]?.includes(child) ?? false
        );
      }
    }
  });

  it('keeps black boxes leaf-only', () => {
    expect(CONTAINS.extsys).toBeUndefined();
    expect(CONTAINS.umsystem).toBeUndefined();
  });

  it('keeps the permissive POC root behavior', () => {
    expect(INFRA_TYPES.every(() => canCreateAtRoot())).toBe(true);
  });
});
