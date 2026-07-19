export const RECOVERY_VERSION = 1;

export interface RecoveryRecord {
  recoveryVersion: number;
  originalPath: string | null;
  title: string;
  savedSnapshot: string;
  currentSnapshot: string;
  timestamp: string;
}

export function stringifyRecovery(record: RecoveryRecord): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}

export function parseRecovery(source: string): RecoveryRecord {
  const value: unknown = JSON.parse(source);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ungültige Recovery-Datei.');
  const record = value as Partial<RecoveryRecord>;
  if (record.recoveryVersion !== RECOVERY_VERSION ||
      (record.originalPath !== null && typeof record.originalPath !== 'string') ||
      typeof record.title !== 'string' ||
      typeof record.savedSnapshot !== 'string' ||
      typeof record.currentSnapshot !== 'string' ||
      typeof record.timestamp !== 'string') {
    throw new Error('Nicht unterstützte Recovery-Datei.');
  }
  return record as RecoveryRecord;
}
