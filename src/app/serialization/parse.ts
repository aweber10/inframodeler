import { isInfraType } from '../../editor/infra/meta/types';
import { canContain } from '../../editor/infra/meta/containment';
import { DiagramFileError } from './errors';
import {
  FORMAT_NAME,
  type DiagramConnectionRecord,
  type DiagramElementRecord,
  type DiagramFile,
  type DiagramPoint,
  type ExtensionFields
} from './format';
import { migrateDiagramFile } from './migrate';

const ROOT_KEYS = new Set(['format', 'formatVersion', 'title', 'elements', 'connections']);
const ELEMENT_KEYS = new Set(['id', 'type', 'name', 'parent', 'x', 'y', 'w', 'h']);
const CONNECTION_KEYS = new Set(['id', 'source', 'target', 'kind', 'label', 'pinnedRouting', 'labelPosition', 'waypoints']);
const POINT_KEYS = new Set(['x', 'y']);

export function parseDiagramFile(source: string): DiagramFile {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (error) {
    throw jsonError(error, source);
  }

  const root = object(raw, '$');
  if (root.format !== FORMAT_NAME) {
    throw new DiagramFileError(`Ungültige Formatkennung. Erwartet wird "${FORMAT_NAME}".`, 'format');
  }

  const file: DiagramFile = {
    format: FORMAT_NAME,
    formatVersion: integer(root.formatVersion, 'formatVersion'),
    title: string(root.title, 'title'),
    elements: array(root.elements, 'elements').map(parseElement),
    connections: array(root.connections, 'connections').map(parseConnection),
    extensions: extras(root, ROOT_KEYS)
  };

  validateReferences(file);
  return migrateDiagramFile(file);
}

function parseElement(value: unknown, index: number): DiagramElementRecord {
  const path = `elements[${index}]`;
  const item = object(value, path);
  const type = item.type;
  if (!isInfraType(type)) throw new DiagramFileError('Unbekannter Elementtyp.', `${path}.type`);

  return {
    id: nonEmptyString(item.id, `${path}.id`),
    type,
    name: string(item.name, `${path}.name`),
    ...(item.parent === undefined ? {} : { parent: nonEmptyString(item.parent, `${path}.parent`) }),
    x: finiteNumber(item.x, `${path}.x`),
    y: finiteNumber(item.y, `${path}.y`),
    w: positiveNumber(item.w, `${path}.w`),
    h: positiveNumber(item.h, `${path}.h`),
    extensions: extras(item, ELEMENT_KEYS)
  };
}

function parseConnection(value: unknown, index: number): DiagramConnectionRecord {
  const path = `connections[${index}]`;
  const item = object(value, path);
  if (item.kind !== 'communication' && item.kind !== 'noteAttachment') {
    throw new DiagramFileError('Unbekannte Verbindungsart.', `${path}.kind`);
  }

  return {
    id: nonEmptyString(item.id, `${path}.id`),
    source: nonEmptyString(item.source, `${path}.source`),
    target: nonEmptyString(item.target, `${path}.target`),
    kind: item.kind,
    label: string(item.label, `${path}.label`),
    ...(item.pinnedRouting === undefined ? {} : { pinnedRouting: boolean(item.pinnedRouting, `${path}.pinnedRouting`) }),
    ...(item.labelPosition === undefined ? {} : { labelPosition: parsePoint(item.labelPosition, `${path}.labelPosition`) }),
    waypoints: array(item.waypoints, `${path}.waypoints`).map((point, pointIndex) =>
      parsePoint(point, `${path}.waypoints[${pointIndex}]`)
    ),
    extensions: extras(item, CONNECTION_KEYS)
  };
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new DiagramFileError('Boolescher Wert erwartet.', path);
  return value;
}

function parsePoint(value: unknown, path: string): DiagramPoint {
  const point = object(value, path);
  return {
    x: finiteNumber(point.x, `${path}.x`),
    y: finiteNumber(point.y, `${path}.y`),
    extensions: extras(point, POINT_KEYS)
  };
}

function validateReferences(file: DiagramFile): void {
  const ids = new Set<string>();
  for (const element of file.elements) {
    if (ids.has(element.id)) throw new DiagramFileError('Doppelte ID.', `elements.${element.id}`);
    ids.add(element.id);
  }
  for (const connection of file.connections) {
    if (ids.has(connection.id)) throw new DiagramFileError('Doppelte ID.', `connections.${connection.id}`);
    ids.add(connection.id);
  }
  const elementIds = new Set(file.elements.map(({ id }) => id));
  for (const element of file.elements) {
    if (element.parent && !elementIds.has(element.parent)) {
      throw new DiagramFileError(`Unbekannter Parent "${element.parent}".`, `elements.${element.id}.parent`);
    }
    if (element.parent === element.id) {
      throw new DiagramFileError('Ein Element kann nicht sein eigener Parent sein.', `elements.${element.id}.parent`);
    }
  }
  const byId = new Map(file.elements.map((element) => [element.id, element]));
  for (const element of file.elements) {
    if (!element.parent) continue;
    const parent = byId.get(element.parent)!;
    if (!canContain(parent.type, element.type)) {
      throw new DiagramFileError(
        `${parent.type} darf ${element.type} nicht enthalten.`,
        `elements.${element.id}.parent`
      );
    }
    const visited = new Set([element.id]);
    let ancestor: DiagramElementRecord | undefined = parent;
    while (ancestor?.parent) {
      if (visited.has(ancestor.id)) {
        throw new DiagramFileError('Zyklische Parent-Beziehung.', `elements.${element.id}.parent`);
      }
      visited.add(ancestor.id);
      ancestor = byId.get(ancestor.parent);
    }
  }
  for (const connection of file.connections) {
    if (!elementIds.has(connection.source)) {
      throw new DiagramFileError(`Unbekannte Quelle "${connection.source}".`, `connections.${connection.id}.source`);
    }
    if (!elementIds.has(connection.target)) {
      throw new DiagramFileError(`Unbekanntes Ziel "${connection.target}".`, `connections.${connection.id}.target`);
    }
    const source = byId.get(connection.source)!;
    const target = byId.get(connection.target)!;
    if (connection.source === connection.target || source.type === 'zone' || target.type === 'zone') {
      throw new DiagramFileError('Unzulässige Verbindung.', `connections.${connection.id}`);
    }
    const noteAttachment = source.type === 'note' || target.type === 'note';
    if ((source.type === 'note' && target.type === 'note') ||
        (noteAttachment && connection.kind !== 'noteAttachment') ||
        (!noteAttachment && connection.kind !== 'communication')) {
      throw new DiagramFileError('Verbindungsart passt nicht zu den Endpunkten.', `connections.${connection.id}.kind`);
    }
    if (connection.waypoints.length < 2) {
      throw new DiagramFileError('Eine Verbindung benötigt mindestens zwei Wegpunkte.', `connections.${connection.id}.waypoints`);
    }
  }
}

function jsonError(error: unknown, source: string): DiagramFileError {
  const message = error instanceof Error ? error.message : 'Unbekannter JSON-Fehler.';
  const position = /position (\d+)/.exec(message)?.[1];
  const offset = position ? Number(position) : source.length;
  const before = source.slice(0, offset);
  const line = before.split('\n').length;
  const column = offset - before.lastIndexOf('\n');
  return new DiagramFileError(`Ungültiges JSON in Zeile ${line}, Spalte ${column}: ${message}`);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DiagramFileError('Objekt erwartet.', path);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new DiagramFileError('Liste erwartet.', path);
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new DiagramFileError('Text erwartet.', path);
  return value;
}

function nonEmptyString(value: unknown, path: string): string {
  const result = string(value, path);
  if (!result) throw new DiagramFileError('Der Wert darf nicht leer sein.', path);
  return result;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DiagramFileError('Endliche Zahl erwartet.', path);
  }
  return value;
}

function positiveNumber(value: unknown, path: string): number {
  const result = finiteNumber(value, path);
  if (result <= 0) throw new DiagramFileError('Positive Zahl erwartet.', path);
  return result;
}

function integer(value: unknown, path: string): number {
  const result = finiteNumber(value, path);
  if (!Number.isInteger(result)) throw new DiagramFileError('Ganzzahl erwartet.', path);
  return result;
}

function extras(value: Record<string, unknown>, known: Set<string>): ExtensionFields | undefined {
  const entries = Object.entries(value).filter(([key]) => !known.has(key));
  return entries.length ? Object.fromEntries(entries) : undefined;
}
