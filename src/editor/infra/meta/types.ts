export const INFRA_TYPES = [
  'zone',
  'server',
  'syssoft',
  'module',
  'db',
  'esb',
  'firewall',
  'extsys',
  'umsystem',
  'actor',
  'note'
] as const;

export type InfraType = (typeof INFRA_TYPES)[number];

export interface InfraBusinessObject {
  type: InfraType;
  name: string;
  extensions?: Record<string, unknown>;
}

export type InfraConnectionKind = 'communication' | 'noteAttachment';

export interface InfraConnectionBusinessObject {
  kind: InfraConnectionKind;
  label?: string;
  pinnedRouting?: boolean;
  labelPosition?: { x: number; y: number };
  extensions?: Record<string, unknown>;
  waypointExtensions?: Array<Record<string, unknown> | undefined>;
}

export interface InfraTypeDefinition {
  width: number;
  height: number;
  defaultName: string;
  title: string;
}

export const TYPE_DEFINITIONS: Record<InfraType, InfraTypeDefinition> = {
  zone: { width: 280, height: 170, defaultName: 'netzzone', title: 'Netzwerkzone' },
  server: { width: 230, height: 130, defaultName: 'srv-neu-01', title: 'Server' },
  syssoft: { width: 200, height: 95, defaultName: 'Tomcat 10', title: 'Systemsoftware' },
  module: { width: 156, height: 46, defaultName: 'Modul', title: 'Software-Modul' },
  db: { width: 132, height: 88, defaultName: 'Datenbank', title: 'Datenbank' },
  esb: { width: 240, height: 56, defaultName: 'ESB', title: 'ESB / Middleware' },
  firewall: { width: 40, height: 190, defaultName: 'FW', title: 'Firewall' },
  extsys: { width: 176, height: 66, defaultName: 'Partner-System', title: 'Externes System' },
  umsystem: { width: 176, height: 64, defaultName: 'Umsystem', title: 'Umsystem' },
  actor: { width: 64, height: 82, defaultName: 'Nutzer', title: 'Aktor' },
  note: { width: 190, height: 56, defaultName: 'Notiz ...', title: 'Notiz' }
};

export const CONTAINER_PADDING = {
  zone: { top: 40, side: 18, bottom: 18 },
  server: { top: 36, side: 16, bottom: 16 },
  syssoft: { top: 32, side: 14, bottom: 14 }
} as const;

export const PALETTE_TYPES: readonly InfraType[] = [
  'zone',
  'server',
  'db',
  'esb',
  'extsys',
  'umsystem',
  'actor',
  'note',
  'firewall'
];

export function isInfraType(value: unknown): value is InfraType {
  return typeof value === 'string' && (INFRA_TYPES as readonly string[]).includes(value);
}
