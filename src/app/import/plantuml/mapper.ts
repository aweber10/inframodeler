import { TYPE_DEFINITIONS, type InfraType } from '../../../editor/infra/meta/types';
import { CURRENT_FORMAT_VERSION, FORMAT_NAME, type DiagramConnectionRecord, type DiagramElementRecord, type DiagramFile } from '../../serialization/format';
import type { PlantUmlDeclaration, PlantUmlDocument, PlantUmlRelation, PlantUmlWarning } from './ast';

interface MappedElement {
  sourceUid: string;
  type: InfraType;
  name: string;
  parentSourceUid?: string;
  source: PlantUmlDeclaration;
}

export interface PlantUmlImportResult {
  file: DiagramFile;
  warnings: PlantUmlWarning[];
  statistics: Partial<Record<InfraType, number>>;
}

export function mapPlantUml(document: PlantUmlDocument): PlantUmlImportResult {
  const warnings = [...document.warnings];
  const byUid = new Map(document.declarations.map((item) => [item.uid, item]));
  const children = groupChildren(document.declarations);
  const mapped: MappedElement[] = [];
  const sourceTargets = new Map<string, string[]>();

  for (const declaration of document.declarations) {
    const result = mapDeclaration(declaration, byUid, children, warnings);
    for (const item of result) {
      mapped.push(item);
      const targets = sourceTargets.get(declaration.uid) ?? [];
      targets.push(item.sourceUid);
      sourceTargets.set(declaration.uid, targets);
    }
  }

  // Resolve logical parents after all source constructs have been classified.
  for (const item of mapped) {
    item.parentSourceUid = resolveMappedParent(item.source, item.type, mapped, byUid, warnings);
  }

  const layout = layoutElements(mapped);
  const outputBySource = new Map(mapped.map((item, index) => [item.sourceUid, layout.elements[index]!]));
  const resolver = createResolver(document.declarations, sourceTargets, outputBySource);
  const connections = mapRelations(document.relations, resolver, warnings);

  for (const note of document.notes) {
    const target = resolver(note.target, note.scopeUid);
    if (!target) {
      warnings.push({ code: 'unresolved-note', message: `Notizziel "${note.target}" konnte nicht aufgelöst werden.`, line: note.location.line });
      continue;
    }
    const targetRecord = layout.elements.find(({ id }) => id === target);
    const zoneParent = findZoneParent(targetRecord, layout.elements);
    const noteRecord = createRecord('note', note.text, `note_${layout.noteCounter++}`, zoneParent?.id, 0, 0);
    const position = notePosition(targetRecord!, noteRecord, note.position);
    noteRecord.x = position.x;
    noteRecord.y = position.y;
    layout.elements.push(noteRecord);
    connections.push(connectionRecord(`connection_${connections.length + 1}`, noteRecord.id, target, 'noteAttachment', ''));
  }

  if (document.legend) {
    for (const declaration of document.declarations.filter(({ color }) => color)) {
      const target = resolver(declaration.alias, declaration.parentUid);
      if (!target) continue;
      const targetRecord = layout.elements.find(({ id }) => id === target)!;
      const zoneParent = findZoneParent(targetRecord, layout.elements);
      const noteRecord = createRecord('note', document.legend, `note_${layout.noteCounter++}`, zoneParent?.id, targetRecord.x + targetRecord.w + 35, targetRecord.y);
      layout.elements.push(noteRecord);
      connections.push(connectionRecord(`connection_${connections.length + 1}`, noteRecord.id, target, 'noteAttachment', ''));
      warnings.push({ code: 'color-legend', message: `Farbcodierung von "${declaration.name}" wurde als Notiz übernommen.`, line: declaration.location.line });
    }
  }

  const statistics: Partial<Record<InfraType, number>> = {};
  for (const element of layout.elements) statistics[element.type] = (statistics[element.type] ?? 0) + 1;
  return {
    file: {
      format: FORMAT_NAME,
      formatVersion: CURRENT_FORMAT_VERSION,
      title: document.title || 'PlantUML-Import',
      elements: layout.elements,
      connections
    },
    warnings,
    statistics
  };
}

function mapDeclaration(
  declaration: PlantUmlDeclaration,
  byUid: Map<string, PlantUmlDeclaration>,
  children: Map<string | undefined, PlantUmlDeclaration[]>,
  warnings: PlantUmlWarning[]
): MappedElement[] {
  const directChildren = children.get(declaration.uid) ?? [];
  switch (declaration.kind) {
    case 'frame':
      if (!declaration.parentUid) return [mapped(declaration, 'zone', declaration.name)];
      if (directChildren.some(({ kind }) => kind === 'database')) return [];
      return [mapped(declaration, 'syssoft', declaration.name)];
    case 'actor': return [mapped(declaration, 'actor', declaration.name)];
    case 'interface': return [mapped(declaration, 'esb', declaration.name)];
    case 'database': {
      const parent = declaration.parentUid ? byUid.get(declaration.parentUid) : undefined;
      const runtimeSuffix = parent?.kind === 'frame' ? ` (${parent.name})` : '';
      if (runtimeSuffix) warnings.push({ code: 'database-runtime', message: `Datenbank-Container "${parent!.name}" wurde in den Datenbanknamen übernommen.`, line: declaration.location.line });
      return [mapped(declaration, 'db', `${declaration.name}${runtimeSuffix}`)];
    }
    case 'artifact': {
      const components = directChildren.filter(({ kind }) => kind === 'component');
      if (!components.length) return [mapped(declaration, 'module', declaration.name)];
      warnings.push({ code: 'artifact-flattened', message: `Artifact "${declaration.name}" wurde in ${components.length} Module abgeflacht.`, line: declaration.location.line });
      return components.map((component) => mapped(component, 'module', `${declaration.name} / ${component.name}`, declaration.uid));
    }
    case 'component': {
      const parent = declaration.parentUid ? byUid.get(declaration.parentUid) : undefined;
      if (parent?.kind === 'artifact') return [];
      return [mapped(declaration, 'module', declaration.name)];
    }
    case 'node': {
      const zone = findAncestor(declaration, byUid, (item) => item.kind === 'frame' && !item.parentUid);
      const deployables = directChildren.filter(({ kind }) => ['component', 'artifact', 'frame', 'database'].includes(kind));
      const nestedNodes = directChildren.filter(({ kind }) => kind === 'node');
      if (nestedNodes.length && !deployables.length) {
        warnings.push({ code: 'host-group', message: `Node "${declaration.name}" mit inneren Servern wurde als Zone interpretiert.`, line: declaration.location.line });
        return [mapped(declaration, 'zone', declaration.name)];
      }
      if (!directChildren.length && zone && /^internet$/i.test(zone.name)) return [mapped(declaration, 'extsys', declaration.name)];
      if (!directChildren.length && /^systeme\b/i.test(zone?.name ?? '')) return [mapped(declaration, 'umsystem', declaration.name)];
      return [mapped(declaration, 'server', declaration.name)];
    }
  }
}

function mapped(source: PlantUmlDeclaration, type: InfraType, name: string, sourceUid = source.uid): MappedElement {
  return { sourceUid, type, name, source };
}

function resolveMappedParent(
  source: PlantUmlDeclaration,
  type: InfraType,
  mappedItems: MappedElement[],
  byUid: Map<string, PlantUmlDeclaration>,
  warnings: PlantUmlWarning[]
): string | undefined {
  let parentUid = source.parentUid;
  while (parentUid) {
    const candidates = mappedItems.filter((item) => item.sourceUid === parentUid);
    const compatible = candidates.find((parent) => canParent(parent.type, type));
    if (compatible) return compatible.sourceUid;
    const parentSource = byUid.get(parentUid);
    if (parentSource?.kind === 'node' && type === 'server') {
      warnings.push({ code: 'nested-server', message: `Verschachtelter Server "${source.name}" wurde in die umgebende Zone hochgezogen.`, line: source.location.line });
    }
    parentUid = parentSource?.parentUid;
  }
  return undefined;
}

function canParent(parent: InfraType, child: InfraType): boolean {
  return (parent === 'zone' && ['server', 'db', 'extsys', 'umsystem', 'actor', 'note'].includes(child)) ||
    (parent === 'server' && ['syssoft', 'module', 'db'].includes(child)) ||
    (parent === 'syssoft' && child === 'module');
}

function layoutElements(mappedItems: MappedElement[]) {
  const counters = new Map<InfraType, number>();
  const ids = new Map<string, string>();
  for (const item of mappedItems) {
    const next = (counters.get(item.type) ?? 0) + 1;
    counters.set(item.type, next);
    ids.set(item.sourceUid, `${item.type}_${next}`);
  }
  const records = mappedItems.map((item) => createRecord(item.type, item.name, ids.get(item.sourceUid)!, item.parentSourceUid ? ids.get(item.parentSourceUid) : undefined, 0, 0));
  const byId = new Map(records.map((record) => [record.id, record]));

  // Leaf content first.
  for (const parent of records.filter(({ type }) => type === 'syssoft')) arrangeChildren(parent, records, 14, 32, 12);
  for (const parent of records.filter(({ type }) => type === 'server')) arrangeChildren(parent, records, 16, 38, 14);

  const zones = records.filter(({ type }) => type === 'zone');
  zones.forEach((zone, zoneIndex) => {
    const x = 80 + (zoneIndex % 2) * 700;
    const y = 60 + Math.floor(zoneIndex / 2) * 520;
    zone.x = x;
    zone.y = y;
    const children = records.filter(({ parent }) => parent === zone.id);
    children.forEach((child, index) => {
      child.x = x + 28 + (index % 2) * 310;
      child.y = y + 55 + Math.floor(index / 2) * 190;
      moveDescendants(child, records, child.x, child.y);
    });
    fitContainer(zone, records, 24, 48, 24);
  });

  const roots = records.filter((record) => !record.parent && record.type !== 'zone');
  roots.forEach((record, index) => {
    if (record.type === 'actor') {
      record.x = 0;
      record.y = 120 + index * 110;
    } else {
      record.x = 350 + (index % 4) * 280;
      record.y = 80 + zones.length * 520 + Math.floor(index / 4) * 120;
    }
  });
  void byId;
  return { elements: records, noteCounter: 1 };
}

function arrangeChildren(parent: DiagramElementRecord, records: DiagramElementRecord[], side: number, top: number, gap: number) {
  const children = records.filter(({ parent: parentId }) => parentId === parent.id);
  children.forEach((child, index) => {
    child.x = parent.x + side;
    child.y = parent.y + top + index * (child.h + gap);
    moveDescendants(child, records, child.x, child.y);
  });
  fitContainer(parent, records, side, top, side);
}

function moveDescendants(parent: DiagramElementRecord, records: DiagramElementRecord[], x: number, y: number) {
  const children = records.filter(({ parent: parentId }) => parentId === parent.id);
  children.forEach((child, index) => {
    child.x = x + 16;
    child.y = y + 38 + index * (child.h + 12);
    moveDescendants(child, records, child.x, child.y);
  });
  if (children.length) fitContainer(parent, records, 16, 38, 16);
}

function fitContainer(parent: DiagramElementRecord, records: DiagramElementRecord[], side: number, top: number, bottom: number) {
  const children = records.filter(({ parent: parentId }) => parentId === parent.id);
  if (!children.length) return;
  parent.w = Math.max(parent.w, Math.max(...children.map((child) => child.x + child.w - parent.x)) + side);
  parent.h = Math.max(parent.h, Math.max(...children.map((child) => child.y + child.h - parent.y)) + bottom, top + bottom);
}

function mapRelations(
  relations: PlantUmlRelation[],
  resolve: (reference: string, scopeUid?: string) => string | undefined,
  warnings: PlantUmlWarning[]
): DiagramConnectionRecord[] {
  const result: DiagramConnectionRecord[] = [];
  for (const relation of relations) {
    if (relation.hidden) {
      warnings.push({ code: 'hidden-edge', message: 'Hidden-Verbindung wurde als reine Layoutanweisung ignoriert.', line: relation.location.line });
      continue;
    }
    const source = resolve(relation.source, relation.scopeUid);
    const target = resolve(relation.target, relation.scopeUid);
    if (!source || !target || source === target) {
      warnings.push({ code: 'unresolved-relation', message: `Verbindung ${relation.source} -> ${relation.target} konnte nicht aufgelöst werden.`, line: relation.location.line });
      continue;
    }
    if (relation.dotted) warnings.push({ code: 'dotted-edge', message: 'Gepunktete Kante wurde als normale Kommunikation importiert.', line: relation.location.line });
    result.push(connectionRecord(`connection_${result.length + 1}`, source, target, 'communication', relation.label));
    if (relation.bidirectional) result.push(connectionRecord(`connection_${result.length + 1}`, target, source, 'communication', relation.label));
  }
  return result;
}

function connectionRecord(id: string, source: string, target: string, kind: 'communication' | 'noteAttachment', label: string): DiagramConnectionRecord {
  return { id, source, target, kind, label, waypoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
}

function createResolver(
  declarations: PlantUmlDeclaration[],
  sourceTargets: Map<string, string[]>,
  outputBySource: Map<string, DiagramElementRecord>
) {
  return (reference: string, scopeUid?: string): string | undefined => {
    const normalized = reference.trim();
    const candidates = declarations.filter((item) => item.alias === normalized || item.name === normalized);
    let scope = scopeUid;
    while (scope) {
      const scoped = candidates.find((candidate) => candidate.parentUid === scope || candidate.uid === scope);
      if (scoped) return outputBySource.get(sourceTargets.get(scoped.uid)?.[0] ?? scoped.uid)?.id;
      scope = declarations.find(({ uid }) => uid === scope)?.parentUid;
    }
    const declaration = candidates.length === 1 ? candidates[0] : candidates[0];
    if (!declaration) return undefined;
    const sourceUid = sourceTargets.get(declaration.uid)?.[0] ?? declaration.uid;
    return outputBySource.get(sourceUid)?.id;
  };
}

function createRecord(type: InfraType, name: string, id: string, parent: string | undefined, x: number, y: number): DiagramElementRecord {
  const definition = TYPE_DEFINITIONS[type];
  return { id, type, name, ...(parent ? { parent } : {}), x, y, w: definition.width, h: definition.height };
}

function findZoneParent(record: DiagramElementRecord | undefined, elements: DiagramElementRecord[]): DiagramElementRecord | undefined {
  let current = record;
  while (current?.parent) {
    current = elements.find(({ id }) => id === current!.parent);
    if (current?.type === 'zone') return current;
  }
  return undefined;
}

function notePosition(target: DiagramElementRecord, note: DiagramElementRecord, position: string) {
  if (position === 'left') return { x: target.x - note.w - 35, y: target.y };
  if (position === 'top') return { x: target.x, y: target.y - note.h - 35 };
  if (position === 'bottom') return { x: target.x, y: target.y + target.h + 35 };
  return { x: target.x + target.w + 35, y: target.y };
}

function findAncestor(
  declaration: PlantUmlDeclaration,
  byUid: Map<string, PlantUmlDeclaration>,
  predicate: (item: PlantUmlDeclaration) => boolean
) {
  let current = declaration.parentUid ? byUid.get(declaration.parentUid) : undefined;
  while (current) {
    if (predicate(current)) return current;
    current = current.parentUid ? byUid.get(current.parentUid) : undefined;
  }
  return undefined;
}

function groupChildren(declarations: PlantUmlDeclaration[]) {
  const result = new Map<string | undefined, PlantUmlDeclaration[]>();
  for (const declaration of declarations) {
    const list = result.get(declaration.parentUid) ?? [];
    list.push(declaration);
    result.set(declaration.parentUid, list);
  }
  return result;
}
