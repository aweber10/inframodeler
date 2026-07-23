import { CURRENT_FORMAT_VERSION, type DiagramFile } from './format';
import { DiagramFileError, NewerFormatVersionError } from './errors';

export function migrateDiagramFile(file: DiagramFile): DiagramFile {
  if (file.formatVersion > CURRENT_FORMAT_VERSION) {
    throw new NewerFormatVersionError(file.formatVersion, CURRENT_FORMAT_VERSION);
  }
  if (file.formatVersion < 1) {
    throw new DiagramFileError(`Nicht unterstützte Formatversion ${file.formatVersion}.`, 'formatVersion');
  }

  let migrated = file;
  while (migrated.formatVersion < CURRENT_FORMAT_VERSION) {
    migrated = migrateOneVersion(migrated);
  }
  return migrated;
}

function migrateOneVersion(file: DiagramFile): DiagramFile {
  if (file.formatVersion === 1) {
    return {
      ...file,
      formatVersion: 2,
      connections: file.connections.map((connection) => ({ ...connection, pinnedRouting: connection.pinnedRouting ?? false }))
    };
  }
  if (file.formatVersion === 2) {
    return {
      ...file,
      formatVersion: 3,
      elements: file.elements.map((element) => isContainer(element.type)
        ? { ...element, manualMinWidth: element.w, manualMinHeight: element.h }
        : element)
    };
  }
  throw new DiagramFileError(`Keine Migration für Formatversion ${file.formatVersion} registriert.`);
}

function isContainer(type: string): boolean {
  return type === 'zone' || type === 'server' || type === 'syssoft';
}
