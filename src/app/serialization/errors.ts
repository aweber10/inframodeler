export class DiagramFileError extends Error {
  constructor(message: string, readonly path?: string) {
    super(path ? `${message} (${path})` : message);
    this.name = 'DiagramFileError';
  }
}

export class NewerFormatVersionError extends DiagramFileError {
  constructor(readonly version: number, readonly supportedVersion: number) {
    super(
      `Die Datei verwendet Formatversion ${version}. Diese Anwendung unterstützt höchstens Version ${supportedVersion}.`,
      'formatVersion'
    );
    this.name = 'NewerFormatVersionError';
  }
}
