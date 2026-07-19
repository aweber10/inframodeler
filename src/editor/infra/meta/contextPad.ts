import type { InfraType } from './types';

export interface AppendAction {
  type: InfraType;
  placement: 'inside' | 'beside';
  title: string;
  label?: string;
}

export const CONTEXT_PAD_ACTIONS: Readonly<Partial<Record<InfraType, readonly AppendAction[]>>> = {
  zone: [
    { type: 'server', placement: 'inside', title: 'Server in Zone anlegen' },
    { type: 'zone', placement: 'beside', title: 'Weitere Zone daneben' }
  ],
  server: [
    { type: 'syssoft', placement: 'inside', title: 'Systemsoftware (Runtime) anlegen' },
    { type: 'db', placement: 'inside', title: 'Datenbank auf Server anlegen' },
    { type: 'server', placement: 'beside', title: 'Server daneben und verbinden', label: '' }
  ],
  syssoft: [{ type: 'module', placement: 'inside', title: 'Software-Modul deployen' }],
  module: [
    { type: 'db', placement: 'beside', title: 'Datenbank anbinden (JDBC)', label: 'JDBC' },
    { type: 'esb', placement: 'beside', title: 'Über ESB anbinden (REST/SOAP)', label: 'REST / SOAP' },
    { type: 'module', placement: 'beside', title: 'Modul anbinden (REST)', label: 'REST' },
    { type: 'extsys', placement: 'beside', title: 'Externes System direkt anbinden', label: 'REST' },
    { type: 'umsystem', placement: 'beside', title: 'Umsystem anbinden', label: 'REST' }
  ],
  esb: [
    { type: 'module', placement: 'beside', title: 'Konsument anbinden', label: 'REST / SOAP' },
    { type: 'extsys', placement: 'beside', title: 'Externes System anbinden', label: 'REST / SOAP' },
    { type: 'umsystem', placement: 'beside', title: 'Umsystem anbinden', label: 'REST / SOAP' }
  ],
  extsys: [{ type: 'esb', placement: 'beside', title: 'Über ESB anbinden', label: 'REST / SOAP' }],
  umsystem: [{ type: 'esb', placement: 'beside', title: 'Über ESB anbinden', label: 'REST / SOAP' }],
  actor: [{ type: 'module', placement: 'beside', title: 'Nutzt Modul (HTTPS)', label: 'HTTPS' }]
};
