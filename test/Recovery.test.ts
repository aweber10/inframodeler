import { describe, expect, it } from 'vitest';

import { parseRecovery, RECOVERY_VERSION, stringifyRecovery } from '../src/app/Recovery';

describe('recovery format', () => {
  it('roundtrips a dirty document with original path', () => {
    const recovery = {
      recoveryVersion: RECOVERY_VERSION,
      originalPath: '/tmp/shop.imod.json',
      title: 'Shop',
      savedSnapshot: '{"saved":true}',
      currentSnapshot: '{"saved":false}',
      timestamp: '2026-07-19T10:00:00.000Z'
    };
    expect(parseRecovery(stringifyRecovery(recovery))).toEqual(recovery);
  });

  it('rejects unsupported recovery versions', () => {
    expect(() => parseRecovery(JSON.stringify({ recoveryVersion: 2 }))).toThrow(/Recovery-Datei/);
  });
});
