import { describe, expect, it } from 'vitest';

import { DiagramFileError, NewerFormatVersionError } from '../../src/app/serialization/errors';
import { CURRENT_FORMAT_VERSION, FORMAT_NAME, type DiagramFile } from '../../src/app/serialization/format';
import { parseDiagramFile } from '../../src/app/serialization/parse';
import { stringifyDiagramFile } from '../../src/app/serialization/stringify';

const FILE: DiagramFile = {
  format: FORMAT_NAME,
  formatVersion: CURRENT_FORMAT_VERSION,
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

  it('migrates v1 connections and preserves routing metadata', () => {
    const source = JSON.stringify({
      ...FILE,
      formatVersion: 1,
      connections: [{
        id: 'connection_1', source: 'module_2', target: 'server_1', kind: 'communication', label: 'HTTPS',
        waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }]
      }]
    });
    const migrated = parseDiagramFile(source);
    expect(migrated.formatVersion).toBe(CURRENT_FORMAT_VERSION);
    expect(migrated.connections[0]).toMatchObject({ pinnedRouting: false });

    migrated.connections[0]!.pinnedRouting = true;
    migrated.connections[0]!.labelPosition = { x: 25, y: 30 };
    expect(parseDiagramFile(stringifyDiagramFile(migrated)).connections[0]).toMatchObject({
      pinnedRouting: true,
      labelPosition: { x: 25, y: 30 }
    });
  });

  it('reports malformed JSON with line and column', () => {
    expect(() => parseDiagramFile('{\n  "format":')).toThrow(/Zeile 2, Spalte/);
  });

  it('rejects a newer format version', () => {
    expect(() => parseDiagramFile(JSON.stringify({ ...FILE, formatVersion: 3 }))).toThrow(NewerFormatVersionError);
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
