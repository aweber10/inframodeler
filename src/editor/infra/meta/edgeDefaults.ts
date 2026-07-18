import type { InfraType } from './types';

const EDGE_DEFAULTS: Partial<Record<InfraType, string>> = {
  db: 'JDBC',
  esb: 'REST / SOAP',
  module: 'REST',
  server: '',
  extsys: 'REST / SOAP',
  umsystem: 'REST / SOAP'
};

export function getDefaultEdgeLabel(source: InfraType, target: InfraType): string {
  if (source === 'note' || target === 'note') return '';
  if (source === 'actor') return 'HTTPS';
  if (source === 'esb' || target === 'esb') return 'REST / SOAP';
  return EDGE_DEFAULTS[target] ?? '';
}
