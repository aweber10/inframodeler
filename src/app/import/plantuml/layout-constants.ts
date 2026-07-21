import { CONTAINER_PADDING } from '../../../editor/infra/meta/types';

/** Padding applied inside a container when arranging its direct children. */
export interface ContainerPadding {
  top: number;
  side: number;
  bottom: number;
}

/** Falls back to a generic padding for container types without explicit CONTAINER_PADDING entry. */
const DEFAULT_CONTAINER_PADDING: ContainerPadding = { top: 38, side: 16, bottom: 16 };

/** Vertical gap between stacked children inside the same container. */
export const CHILD_STACK_GAP = 12;

/** Grid layout used to arrange zones on the canvas. */
export const ZONE_GRID = { columns: 2, gapX: 60, gapY: 60 };

/** Grid layout used to arrange the direct children of a zone. */
export const ZONE_CHILD_GRID = { columns: 2, gapX: 30, gapY: 30 };

/** Grid layout used to arrange root elements that are not part of any zone (excluding actors). */
export const ROOT_GRID = { columns: 4, gapX: 30, gapY: 30 };

/** Fixed offsets for the very first zone / root row. */
export const LAYOUT_ORIGIN = { zoneX: 80, zoneY: 60, actorX: 0, actorY: 120, actorGapY: 28, rootX: 350, rootY: 80 };

export function containerPadding(type: string): ContainerPadding {
  return (CONTAINER_PADDING as Record<string, ContainerPadding | undefined>)[type] ?? DEFAULT_CONTAINER_PADDING;
}
