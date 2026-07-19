import { describe, expect, it } from 'vitest';

import { calculateExportBounds, expandExportBounds } from '../../src/app/export/exportBounds';

describe('export bounds', () => {
  it('adds a presentation margin around all shapes', () => {
    const elements = [
      { id: 'a', x: 20, y: 30, width: 100, height: 50 },
      { id: 'b', x: 180, y: 10, width: 40, height: 100 }
    ];
    expect(calculateExportBounds(elements as never[], 20)).toEqual({ x: 0, y: -10, width: 240, height: 140 });
  });

  it('rejects empty diagrams and empty rendered bounds', () => {
    expect(() => calculateExportBounds([])).toThrow(/leere Diagramm/);
    expect(() => expandExportBounds({ x: 0, y: 0, width: 0, height: 0 })).toThrow(/leere Diagramm/);
  });
});
