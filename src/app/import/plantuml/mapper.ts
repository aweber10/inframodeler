import { TYPE_DEFINITIONS, type InfraType } from '../../../editor/infra/meta/types';
import { CURRENT_FORMAT_VERSION, FORMAT_NAME, type DiagramConnectionRecord, type DiagramElementRecord, type DiagramFile } from '../../serialization/format';
import type { PlantUmlDeclaration, PlantUmlDocument, PlantUmlRelation, PlantUmlWarning } from './ast';
import { CHILD_STACK_GAP, LAYOUT_ORIGIN, MIDDLEWARE_CLEARANCE, MIDDLEWARE_SINGLE_NEIGHBOR_GAP, ROOT_GRID, ZONE_CHILD_GRID, ZONE_GRID, containerPadding } from './layout-constants';

interface MappedElement {
  sourceUid: string;
  type: InfraType;
  name: string;
  parentSourceUid?: string;
  source: PlantUmlDeclaration;
}

/** Connection weight between two element ids, used to keep frequently communicating elements close together. */
type AdjacencyMap = Map<string, Map<string, number>>;

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

  const records = createRecords(mapped);
  const outputBySource = new Map(mapped.map((item, index) => [item.sourceUid, records[index]!]));
  const resolver = createResolver(document.declarations, sourceTargets, outputBySource);
  const adjacency = buildAdjacency(document.relations, resolver);

  layoutElements(records, adjacency);

  const connections = mapRelations(document.relations, resolver, warnings);

  let noteCounter = 1;
  for (const note of document.notes) {
    const target = resolver(note.target, note.scopeUid);
    if (!target) {
      warnings.push({ code: 'unresolved-note', message: `Notizziel "${note.target}" konnte nicht aufgelöst werden.`, line: note.location.line });
      continue;
    }
    const targetRecord = records.find(({ id }) => id === target);
    const zoneParent = findZoneParent(targetRecord, records);
    const noteRecord = createRecord('note', note.text, `note_${noteCounter++}`, zoneParent?.id, 0, 0);
    const position = notePosition(targetRecord!, noteRecord, note.position);
    noteRecord.x = position.x;
    noteRecord.y = position.y;
    records.push(noteRecord);
    connections.push(connectionRecord(`connection_${connections.length + 1}`, noteRecord.id, target, 'noteAttachment', ''));
  }

  if (document.legend) {
    for (const declaration of document.declarations.filter(({ color }) => color)) {
      const target = resolver(declaration.alias, declaration.parentUid);
      if (!target) continue;
      const targetRecord = records.find(({ id }) => id === target)!;
      const zoneParent = findZoneParent(targetRecord, records);
      const noteRecord = createRecord('note', document.legend, `note_${noteCounter++}`, zoneParent?.id, targetRecord.x + targetRecord.w + 35, targetRecord.y);
      records.push(noteRecord);
      connections.push(connectionRecord(`connection_${connections.length + 1}`, noteRecord.id, target, 'noteAttachment', ''));
      warnings.push({ code: 'color-legend', message: `Farbcodierung von "${declaration.name}" wurde als Notiz übernommen.`, line: declaration.location.line });
    }
  }

  // Notes are placed relative to their target after the main layout, so de-collide them last -
  // against every other element as well as against each other.
  resolveNoteOverlaps(records);

  const statistics: Partial<Record<InfraType, number>> = {};
  for (const element of records) statistics[element.type] = (statistics[element.type] ?? 0) + 1;
  return {
    file: {
      format: FORMAT_NAME,
      formatVersion: CURRENT_FORMAT_VERSION,
      title: document.title || 'PlantUML-Import',
      elements: records,
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
  return (parent === 'zone' && ['server', 'db', 'esb', 'extsys', 'umsystem', 'actor', 'note'].includes(child)) ||
    (parent === 'server' && ['syssoft', 'module', 'db'].includes(child)) ||
    (parent === 'syssoft' && child === 'module');
}

/** Assigns stable, human-readable ids and creates the initial (unpositioned) records. */
function createRecords(mappedItems: MappedElement[]): DiagramElementRecord[] {
  const counters = new Map<InfraType, number>();
  const ids = new Map<string, string>();
  for (const item of mappedItems) {
    const next = (counters.get(item.type) ?? 0) + 1;
    counters.set(item.type, next);
    ids.set(item.sourceUid, `${item.type}_${next}`);
  }
  return mappedItems.map((item) =>
    createRecord(item.type, item.name, ids.get(item.sourceUid)!, item.parentSourceUid ? ids.get(item.parentSourceUid) : undefined, 0, 0)
  );
}

/** Builds an undirected connection-weight map keyed by resolved element id, used to keep related elements close together. */
export function buildAdjacency(
  relations: PlantUmlRelation[],
  resolve: (reference: string, scopeUid?: string) => string | undefined
): AdjacencyMap {
  const adjacency: AdjacencyMap = new Map();
  const bump = (a: string, b: string) => {
    const inner = adjacency.get(a) ?? new Map<string, number>();
    inner.set(b, (inner.get(b) ?? 0) + 1);
    adjacency.set(a, inner);
  };
  for (const relation of relations) {
    if (relation.hidden) continue;
    const source = resolve(relation.source, relation.scopeUid);
    const target = resolve(relation.target, relation.scopeUid);
    if (!source || !target || source === target) continue;
    bump(source, target);
    bump(target, source);
  }
  return adjacency;
}

/**
 * Orders a set of sibling elements so that strongly connected elements end up next to each other
 * once placed into a grid/stack. Simple greedy nearest-neighbour heuristic: start with the element
 * that has the strongest connectivity within the set, then repeatedly append the still-unplaced
 * element most strongly connected to the last placed one. Falls back to the original (declaration)
 * order whenever no connection data is available, keeping the result fully deterministic.
 */
export function sortByConnectivity(items: DiagramElementRecord[], adjacency: AdjacencyMap): DiagramElementRecord[] {
  if (items.length <= 2) return items;

  const weight = (a: string, b: string) => adjacency.get(a)?.get(b) ?? 0;
  const totalWithinSet = (id: string) => items.reduce((sum, other) => (other.id === id ? sum : sum + weight(id, other.id)), 0);

  const remaining = items.slice();
  const start = remaining.reduce((best, item) => (totalWithinSet(item.id) > totalWithinSet(best.id) ? item : best), remaining[0]!);
  const ordered: DiagramElementRecord[] = [start];
  remaining.splice(remaining.indexOf(start), 1);

  while (remaining.length) {
    const current = ordered[ordered.length - 1]!;
    let bestIndex = 0;
    let bestWeight = -1;
    remaining.forEach((candidate, index) => {
      const candidateWeight = weight(current.id, candidate.id);
      if (candidateWeight > bestWeight) {
        bestWeight = candidateWeight;
        bestIndex = index;
      }
    });
    ordered.push(remaining[bestIndex]!);
    remaining.splice(bestIndex, 1);
  }

  return ordered;
}

/**
 * Places `items` into a row-major grid with the given column count, sizing each row/column from
 * the elements' actual (already grown) width/height so that siblings never overlap. Descendants of
 * each item are shifted along, since sizes were established bottom-up beforehand.
 */
function packAndTranslate(
  items: DiagramElementRecord[],
  columns: number,
  gapX: number,
  gapY: number,
  originX: number,
  originY: number,
  records: DiagramElementRecord[]
): void {
  let y = originY;
  for (let index = 0; index < items.length; index += columns) {
    const rowItems = items.slice(index, index + columns);
    let x = originX;
    let rowHeight = 0;
    for (const item of rowItems) {
      translateSubtree(item, x - item.x, y - item.y, records);
      x += item.w + gapX;
      rowHeight = Math.max(rowHeight, item.h);
    }
    y += rowHeight + gapY;
  }
}

function translateSubtree(root: DiagramElementRecord, dx: number, dy: number, records: DiagramElementRecord[]): void {
  if (dx === 0 && dy === 0) return;
  root.x += dx;
  root.y += dy;
  for (const child of records.filter(({ parent }) => parent === root.id)) translateSubtree(child, dx, dy, records);
}

function computeDepth(record: DiagramElementRecord, byId: Map<string, DiagramElementRecord>): number {
  let depth = 0;
  let current: DiagramElementRecord | undefined = record;
  while (current?.parent) {
    current = byId.get(current.parent);
    depth += 1;
  }
  return depth;
}

/**
 * Arranges the direct children of a single container in place (relative to the container's current
 * position), then grows the container to fit them. Zones use a two-column grid, every other
 * container (server, syssoft, ...) stacks its children in a single column - matching how the shapes
 * are meant to be read (top-to-bottom for runtime/module nesting, 2D for zone contents).
 */
function arrangeContainer(parent: DiagramElementRecord, records: DiagramElementRecord[], adjacency: AdjacencyMap): void {
  const rawChildren = records.filter(({ parent: parentId }) => parentId === parent.id);
  if (!rawChildren.length) return;

  const children = sortByConnectivity(rawChildren, adjacency);
  const padding = containerPadding(parent.type);

  if (parent.type === 'zone') {
    packAndTranslate(children, ZONE_CHILD_GRID.columns, ZONE_CHILD_GRID.gapX, ZONE_CHILD_GRID.gapY, parent.x + padding.side, parent.y + padding.top, records);
  } else {
    packAndTranslate(children, 1, 0, CHILD_STACK_GAP, parent.x + padding.side, parent.y + padding.top, records);
  }

  fitContainer(parent, records, padding.side, padding.top, padding.bottom);
}

/**
 * Two phases:
 *  1. Bottom-up sizing - every container (deepest first) arranges its own children relative to its
 *     current position and grows to fit them. Because every container starts at (0, 0), this yields
 *     correct *relative* positions for entire subtrees without knowing their final absolute placement.
 *  2. Top-down placement - root zones and root elements are placed into grids; translating a root
 *     element by a delta cascades to all of its already-correctly-arranged descendants.
 */
function layoutElements(records: DiagramElementRecord[], adjacency: AdjacencyMap): void {
  const byId = new Map(records.map((record) => [record.id, record]));
  const containers = records
    .filter((record) => records.some(({ parent }) => parent === record.id))
    .sort((a, b) => computeDepth(b, byId) - computeDepth(a, byId));

  for (const container of containers) arrangeContainer(container, records, adjacency);

  const zones = sortByConnectivity(records.filter(({ type, parent }) => type === 'zone' && !parent), adjacency);
  packAndTranslate(zones, ZONE_GRID.columns, ZONE_GRID.gapX, ZONE_GRID.gapY, LAYOUT_ORIGIN.zoneX, LAYOUT_ORIGIN.zoneY, records);

  const zonesBottom = zones.length ? Math.max(...zones.map((zone) => zone.y + zone.h)) + ZONE_GRID.gapY : LAYOUT_ORIGIN.rootY;

  const roots = records.filter(({ parent }) => !parent).filter((record) => record.type !== 'zone');
  const actors = roots.filter(({ type }) => type === 'actor');
  const others = sortByConnectivity(roots.filter(({ type }) => type !== 'actor'), adjacency);

  packAndTranslate(actors, 1, 0, LAYOUT_ORIGIN.actorGapY, LAYOUT_ORIGIN.actorX, LAYOUT_ORIGIN.actorY, records);
  packAndTranslate(others, ROOT_GRID.columns, ROOT_GRID.gapX, ROOT_GRID.gapY, LAYOUT_ORIGIN.rootX, zonesBottom, records);

  repositionMiddleware(records, adjacency);
}

function center(record: DiagramElementRecord): { x: number; y: number } {
  return { x: record.x + record.w / 2, y: record.y + record.h / 2 };
}

/**
 * Moves each middleware element (type 'esb') from its generic grid cell to sit *between* the
 * components it connects, rather than being lumped into a uniform block. Uses the already-resolved
 * connection weights:
 *  - no neighbours: left untouched
 *  - one neighbour: nudged just next to that neighbour
 *  - two or more:   placed at the (weighted) centroid of its neighbours' centres
 *
 * The target is clamped to the middleware's own parent container (no reparenting) and, if it would
 * overlap a sibling, nudged along the axis of smaller penetration as a best-effort de-collision.
 */
export function repositionMiddleware(records: DiagramElementRecord[], adjacency: AdjacencyMap): void {
  const byId = new Map(records.map((record) => [record.id, record]));

  for (const esb of records.filter(({ type }) => type === 'esb')) {
    const neighbourWeights = adjacency.get(esb.id);
    if (!neighbourWeights?.size) continue;

    const neighbours = [...neighbourWeights.entries()]
      .map(([id, weight]) => ({ record: byId.get(id), weight }))
      .filter((entry): entry is { record: DiagramElementRecord; weight: number } => Boolean(entry.record));
    if (!neighbours.length) continue;

    let targetCenter: { x: number; y: number };
    if (neighbours.length === 1) {
      const partner = center(neighbours[0]!.record);
      // Nudge next to the single partner, on the side the middleware currently sits, so we do not
      // always collapse onto the exact same spot.
      const direction = center(esb).x >= partner.x ? 1 : -1;
      targetCenter = { x: partner.x + direction * (neighbours[0]!.record.w / 2 + esb.w / 2 + MIDDLEWARE_SINGLE_NEIGHBOR_GAP), y: partner.y };
    } else {
      const totalWeight = neighbours.reduce((sum, { weight }) => sum + weight, 0);
      targetCenter = neighbours.reduce(
        (acc, { record, weight }) => {
          const c = center(record);
          return { x: acc.x + (c.x * weight) / totalWeight, y: acc.y + (c.y * weight) / totalWeight };
        },
        { x: 0, y: 0 }
      );
    }

    const dx = targetCenter.x - esb.w / 2 - esb.x;
    const dy = targetCenter.y - esb.h / 2 - esb.y;
    translateSubtree(esb, dx, dy, records);
    clampToParent(esb, byId);
    resolveOverlap(esb, records, byId);
  }
}

function clampToParent(esb: DiagramElementRecord, byId: Map<string, DiagramElementRecord>): void {
  if (!esb.parent) return;
  const parent = byId.get(esb.parent);
  if (!parent) return;
  const padding = containerPadding(parent.type);
  const minX = parent.x + padding.side;
  const minY = parent.y + padding.top;
  const maxX = parent.x + parent.w - padding.side - esb.w;
  const maxY = parent.y + parent.h - padding.bottom - esb.h;
  esb.x = Math.min(Math.max(esb.x, minX), Math.max(minX, maxX));
  esb.y = Math.min(Math.max(esb.y, minY), Math.max(minY, maxY));
}

function relatedIds(record: DiagramElementRecord, records: DiagramElementRecord[], byId: Map<string, DiagramElementRecord>): Set<string> {
  const related = new Set<string>([record.id]);
  // Ancestors: a moved element must not treat its own containers as obstacles.
  let ancestor = record.parent ? byId.get(record.parent) : undefined;
  while (ancestor) {
    related.add(ancestor.id);
    ancestor = ancestor.parent ? byId.get(ancestor.parent) : undefined;
  }
  // Descendants: same reasoning for nested children.
  const collectChildren = (id: string) => {
    for (const child of records.filter(({ parent }) => parent === id)) {
      related.add(child.id);
      collectChildren(child.id);
    }
  };
  collectChildren(record.id);
  return related;
}

/** Signed penetration depth of the overlap between two rectangles (0 if they do not overlap). The
 * obstacle is inflated by `margin` on every side to keep a minimum clearance around the record. */
function overlapArea(a: DiagramElementRecord, b: DiagramElementRecord, margin = 0): number {
  const dx = Math.min(a.x + a.w, b.x + b.w + margin) - Math.max(a.x, b.x - margin);
  const dy = Math.min(a.y + a.h, b.y + b.h + margin) - Math.max(a.y, b.y - margin);
  return dx > 0 && dy > 0 ? dx * dy : 0;
}

/**
 * Nudges `record` out of any overlap with other elements, keeping a minimum clearance (obstacles
 * are treated as inflated by MIDDLEWARE_CLEARANCE). Considers every element except the record's own
 * containers (ancestors) and nested children; foreign zones ARE obstacles, so a middleware bridging
 * two zones is pushed clear of their borders. Each step resolves the strongest overlap (largest
 * inflated intersection area) and tries all four escape directions, keeping the move that minimises
 * remaining overlap, so it can escape vertically when there is no horizontal room (and vice versa).
 */
function resolveOverlap(record: DiagramElementRecord, records: DiagramElementRecord[], byId: Map<string, DiagramElementRecord>): void {
  const related = relatedIds(record, records, byId);
  const obstacles = records.filter((other) => !related.has(other.id));
  const margin = MIDDLEWARE_CLEARANCE;
  const totalOverlap = () => obstacles.reduce((sum, other) => sum + overlapArea(record, other, margin), 0);

  const maxAttempts = obstacles.length * 4 + 4;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let blocker: DiagramElementRecord | undefined;
    let worst = 0;
    for (const other of obstacles) {
      const area = overlapArea(record, other, margin);
      if (area > worst) {
        worst = area;
        blocker = other;
      }
    }
    if (!blocker) return;

    // Candidate moves: push the record clear of the blocker (plus clearance) on each side.
    const candidates = [
      { dx: blocker.x - margin - record.w - record.x, dy: 0 },
      { dx: blocker.x + blocker.w + margin - record.x, dy: 0 },
      { dx: 0, dy: blocker.y - margin - record.h - record.y },
      { dx: 0, dy: blocker.y + blocker.h + margin - record.y }
    ];

    let best: { dx: number; dy: number; residual: number; distance: number } | undefined;
    for (const candidate of candidates) {
      translateSubtree(record, candidate.dx, candidate.dy, records);
      const residual = totalOverlap();
      const distance = Math.abs(candidate.dx) + Math.abs(candidate.dy);
      translateSubtree(record, -candidate.dx, -candidate.dy, records);
      // Prefer the move with the least remaining overlap, breaking ties by shortest distance.
      if (!best || residual < best.residual || (residual === best.residual && distance < best.distance)) {
        best = { ...candidate, residual, distance };
      }
    }

    if (!best) return;
    translateSubtree(record, best.dx, best.dy, records);
  }
}

/**
 * De-collides every note against all other elements (and one another). Notes are laid out relative
 * to their target after the main grid pass, so without this two notes attached near the same area -
 * or a note sitting on top of an unrelated component - would overlap.
 */
export function resolveNoteOverlaps(records: DiagramElementRecord[]): void {
  const byId = new Map(records.map((record) => [record.id, record]));
  for (const note of records.filter(({ type }) => type === 'note')) {
    resolveOverlap(note, records, byId);
  }
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
