import { describe, expect, it } from 'vitest';

import DocumentSession from '../src/app/DocumentSession';

describe('DocumentSession', () => {
  it('tracks dirty state against the canonical saved snapshot', () => {
    const session = new DocumentSession('empty');
    expect(session.dirty).toBe(false);

    session.update('changed');
    expect(session.dirty).toBe(true);

    session.update('empty');
    expect(session.dirty).toBe(false);
  });

  it('updates path and baseline after saving', () => {
    const session = new DocumentSession('empty');
    session.update('changed');
    session.saved('changed', '/tmp/demo.imod.json');

    expect(session.path).toBe('/tmp/demo.imod.json');
    expect(session.dirty).toBe(false);
  });
});
