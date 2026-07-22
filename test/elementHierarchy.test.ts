import { describe, expect, it } from 'vitest';

import { findCommonAncestor } from '../src/editor/infra/elementHierarchy';

interface Node {
  id: string;
  parent?: Node;
}

function node(id: string, parent?: Node): Node {
  return { id, parent };
}

describe('findCommonAncestor', () => {
  const root = node('root');
  const zone = node('zone', root);
  const server = node('server', zone);
  const runtime = node('syssoft', server);
  const module = node('module', runtime);
  const db = node('db', server);
  const actor = node('actor', root);

  const cast = (n: Node) => n as never;

  it('returns the container when the target is nested inside the source', () => {
    expect(findCommonAncestor(cast(server), cast(module), cast(root)).id).toBe('server');
  });

  it('returns the deepest shared container for two nested siblings', () => {
    expect(findCommonAncestor(cast(module), cast(db), cast(root)).id).toBe('server');
  });

  it('returns the shared zone when connecting an outside root element to a deeply nested one', () => {
    // actor (root child) -> module (server > syssoft) share only root.
    expect(findCommonAncestor(cast(actor), cast(module), cast(root)).id).toBe('root');
  });

  it('returns the zone when both elements live in the same zone at different depths', () => {
    const other = node('db2', zone);
    expect(findCommonAncestor(cast(module), cast(other), cast(root)).id).toBe('zone');
  });

  it('falls back to the provided fallback when the chains do not intersect', () => {
    const fallback = node('fallback');
    const orphanA = node('a');
    const orphanB = node('b');
    expect(findCommonAncestor(cast(orphanA), cast(orphanB), cast(fallback)).id).toBe('fallback');
  });

  it('returns the element itself when both are identical', () => {
    expect(findCommonAncestor(cast(module), cast(module), cast(root)).id).toBe('module');
  });
});
