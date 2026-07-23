import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { importPlantUml, isPlantUmlPath } from '../../src/app/import/plantuml/importPlantUml';
import { parsePlantUml } from '../../src/app/import/plantuml/parser';
import { stringifyDiagramFile } from '../../src/app/serialization/stringify';
import { parseDiagramFile } from '../../src/app/serialization/parse';

const fixture = readFileSync(fileURLToPath(new URL('../fixtures/plantuml/anonymized_system_landscape.pu', import.meta.url)), 'utf8');

describe('PlantUML subset import', () => {
  it('parses aliases, notes, interfaces and bidirectional relations', () => {
    const document = parsePlantUml(fixture);
    expect(document.title).toBe('Orion Platform - Production / System Landscape');
    expect(document.declarations.filter(({ kind }) => kind === 'interface')).toHaveLength(5);
    expect(document.notes).toHaveLength(2);
    expect(document.relations.some(({ bidirectional }) => bidirectional)).toBe(true);
    expect(document.relations.some(({ hidden }) => hidden)).toBe(true);
  });

  it('maps the anonymized system landscape deterministically', () => {
    const first = importPlantUml(fixture);
    const second = importPlantUml(fixture);

    expect(stringifyDiagramFile(first.file)).toBe(stringifyDiagramFile(second.file));
    expect(() => parseDiagramFile(stringifyDiagramFile(first.file))).not.toThrow();
    expect(first.statistics).toMatchObject({
      zone: 4,
      server: 4,
      syssoft: 1,
      module: 6,
      db: 1,
      esb: 5,
      extsys: 1,
      umsystem: 13,
      actor: 2
    });
    expect(first.file.connections.length).toBeGreaterThanOrEqual(30);
    expect(first.warnings.some(({ code }) => code === 'nested-server')).toBe(true);
    expect(first.warnings.some(({ code }) => code === 'hidden-edge')).toBe(true);
    expect(first.warnings.some(({ code }) => code === 'color-legend')).toBe(true);

    const db = first.file.elements.find(({ type }) => type === 'db')!;
    const dbHost = first.file.elements.find(({ name }) => name === 'db-01.example.test')!;
    expect(db.parent).toBe(dbHost.id);
    expect(dbHost.parent).toBe(first.file.elements.find(({ name }) => name === 'Orion Platform')!.id);
  });

  it('recognizes all supported PlantUML extensions', () => {
    expect(['a.puml', 'a.plantuml', 'a.pu'].every(isPlantUmlPath)).toBe(true);
    expect(isPlantUmlPath('a.imod.json')).toBe(false);
  });
});
