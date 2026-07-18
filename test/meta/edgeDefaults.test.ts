import { describe, expect, it } from 'vitest';

import { getDefaultEdgeLabel } from '../../src/editor/infra/meta/edgeDefaults';

describe('edge defaults', () => {
  it.each([
    ['module', 'db', 'JDBC'],
    ['module', 'esb', 'REST / SOAP'],
    ['esb', 'module', 'REST / SOAP'],
    ['actor', 'module', 'HTTPS'],
    ['module', 'module', 'REST'],
    ['module', 'extsys', 'REST / SOAP'],
    ['note', 'module', ''],
    ['module', 'note', '']
  ] as const)('%s -> %s yields %s', (source, target, expected) => {
    expect(getDefaultEdgeLabel(source, target)).toBe(expected);
  });
});
