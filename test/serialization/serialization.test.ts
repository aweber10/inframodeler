import { describe, expect, it } from 'vitest';

import { DiagramFileError, NewerFormatVersionError } from '../../src/app/serialization/errors';
import { FORMAT_NAME, type DiagramFile } from '../../src/app/serialization/format';
import { parseDiagramFile } from '../../src/app/serialization/parse';
import { stringifyDiagramFile } from '../../src/app/serialization/stringify';

const FILE: DiagramFile = {
  format: FORMAT_NAME,
  formatVersion: 1,
  title: 'Webshop',
  elements: [
    { id: 'module_2', type: 'module', name: 'Shop', parent: 'server_1', x: 30, y: 40, w: 156, h: 46 },
    { id: 'server_1', type: 'server', name: 'srv-01', x: 10, y: 20, w: 230, h: 130 }
  ],
  connections: [],
  extensions: { zeta: true, alpha: 'kept' }
};

describe('diagram serialization', () => {
  it('is deterministic and sorts records and extension fields', () => {
    const first = stringifyDiagramFile(FILE);
    const second = stringifyDiagramFile(parseDiagramFile(first));

    expect(second).toBe(first);
    expect(first.indexOf('"module_2"')).toBeLessThan(first.indexOf('"server_1"'));
    expect(first.indexOf('"alpha"')).toBeLessThan(first.indexOf('"zeta"'));
    expect(first.endsWith('\n')).toBe(true);
  });

  it('preserves unknown fields at every supported level', () => {
    const source = JSON.stringify({
      format: FORMAT_NAME,
      formatVersion: 1,
      title: 'Extras',
      customRoot: 1,
      elements: [{ id: 'db_1', type: 'db', name: 'DB', x: 0, y: 0, w: 10, h: 10, customElement: 2 }],
      connections: []
    });

    const output = stringifyDiagramFile(parseDiagramFile(source));
    expect(output).toContain('"customRoot": 1');
    expect(output).toContain('"customElement": 2');
  });

  it('reports malformed JSON with line and column', () => {
    expect(() => parseDiagramFile('{\n  "format":')).toThrow(/Zeile 2, Spalte/);
  });

  it('rejects a newer format version', () => {
    const source = JSON.stringify({ ...FILE, formatVersion: 2 });
    expect(() => parseDiagramFile(source)).toThrow(NewerFormatVersionError);
  });

  it('rejects invalid references without accepting partial data', () => {
    const source = JSON.stringify({
      ...FILE,
      elements: [{ id: 'module_1', type: 'module', name: 'M', parent: 'missing', x: 0, y: 0, w: 10, h: 10 }]
    });
    expect(() => parseDiagramFile(source)).toThrow(DiagramFileError);
  });

  it('rejects connection kinds that contradict their endpoints', () => {
    const source = JSON.stringify({
      format: FORMAT_NAME,
      formatVersion: 1,
      title: 'Invalid edge',
      elements: [
        { id: 'module_1', type: 'module', name: 'M', x: 0, y: 0, w: 10, h: 10 },
        { id: 'note_1', type: 'note', name: 'N', x: 20, y: 0, w: 10, h: 10 }
      ],
      connections: [{
        id: 'connection_1', source: 'module_1', target: 'note_1', kind: 'communication', label: '',
        waypoints: [{ x: 10, y: 5 }, { x: 20, y: 5 }]
      }]
    });
    expect(() => parseDiagramFile(source)).toThrow(/Verbindungsart/);
  });
});
