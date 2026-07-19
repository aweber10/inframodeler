import type { Element } from 'diagram-js/lib/model/Types';

export interface ExportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const EXPORT_MARGIN = 40;

export function expandExportBounds(bounds: ExportBounds, margin = EXPORT_MARGIN): ExportBounds {
  if (bounds.width <= 0 || bounds.height <= 0) throw new Error('Das leere Diagramm kann nicht exportiert werden.');
  return {
    x: bounds.x - margin,
    y: bounds.y - margin,
    width: bounds.width + margin * 2,
    height: bounds.height + margin * 2
  };
}

export function calculateExportBounds(elements: Element[], margin = EXPORT_MARGIN): ExportBounds {
  const shapes = elements.filter((element) => 'width' in element && !element.labelTarget);
  if (!shapes.length) throw new Error('Das leere Diagramm kann nicht exportiert werden.');

  const left = Math.min(...shapes.map((shape) => shape.x));
  const top = Math.min(...shapes.map((shape) => shape.y));
  const right = Math.max(...shapes.map((shape) => shape.x + shape.width));
  const bottom = Math.max(...shapes.map((shape) => shape.y + shape.height));

  return expandExportBounds({ x: left, y: top, width: right - left, height: bottom - top }, margin);
}
