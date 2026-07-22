import type { Element, Parent } from 'diagram-js/lib/model/Types';

/** Collects an element and all of its ancestors, root-most last. */
function ancestorChain(element: Element): Element[] {
  const chain: Element[] = [];
  let current: Element | undefined = element;
  while (current) {
    chain.push(current);
    current = current.parent as Element | undefined;
  }
  return chain;
}

/**
 * Returns the deepest element that is an ancestor of (or equal to) both `a` and `b`. Used to decide
 * where a connection should live in the containment hierarchy: parenting a connection under the
 * common ancestor of its source and target keeps it in the same SVG children group as (or above)
 * the shapes it links, so a container's own visual can never paint over the connection.
 *
 * Falls back to `fallback` (typically the canvas root) when no shared ancestor exists.
 */
export function findCommonAncestor(a: Element, b: Element, fallback: Parent): Parent {
  const ancestorsOfA = new Set(ancestorChain(a));
  for (const candidate of ancestorChain(b)) {
    if (ancestorsOfA.has(candidate)) return candidate as Parent;
  }
  return fallback;
}
