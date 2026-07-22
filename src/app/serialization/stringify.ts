import type {
  DiagramConnectionRecord,
  DiagramElementRecord,
  DiagramFile,
  DiagramPoint,
  ExtensionFields
} from './format';

export function stringifyDiagramFile(file: DiagramFile): string {
  const normalized = {
    format: file.format,
    formatVersion: file.formatVersion,
    title: file.title,
    ...sortedExtensions(file.extensions),
    elements: [...file.elements].sort(byId).map(normalizeElement),
    connections: [...file.connections].sort(byId).map(normalizeConnection)
  };
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

function normalizeElement(element: DiagramElementRecord) {
  return {
    id: element.id,
    type: element.type,
    name: element.name,
    ...(element.parent ? { parent: element.parent } : {}),
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    ...sortedExtensions(element.extensions)
  };
}

function normalizeConnection(connection: DiagramConnectionRecord) {
  return {
    id: connection.id,
    source: connection.source,
    target: connection.target,
    kind: connection.kind,
    label: connection.label,
    ...(connection.pinnedRouting === undefined ? {} : { pinnedRouting: connection.pinnedRouting }),
    ...(connection.labelPosition ? { labelPosition: normalizePoint(connection.labelPosition) } : {}),
    waypoints: connection.waypoints.map(normalizePoint),
    ...sortedExtensions(connection.extensions)
  };
}

function normalizePoint(point: DiagramPoint) {
  return { x: point.x, y: point.y, ...sortedExtensions(point.extensions) };
}

function sortedExtensions(extensions: ExtensionFields | undefined): ExtensionFields {
  return Object.fromEntries(Object.entries(extensions ?? {}).sort(([a], [b]) => a.localeCompare(b)));
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id.localeCompare(b.id);
}
