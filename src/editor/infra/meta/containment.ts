import type { InfraType } from './types';

export const CONTAINS: Readonly<Partial<Record<InfraType, readonly InfraType[]>>> = {
  zone: ['server', 'db', 'esb', 'firewall', 'extsys', 'umsystem', 'actor', 'note'],
  server: ['syssoft', 'module', 'db'],
  syssoft: ['module']
};

export function canContain(parent: InfraType, child: InfraType): boolean {
  return CONTAINS[parent]?.includes(child) ?? false;
}

// The POC permits every type at root, while its toolbar only exposes domain-relevant root types.
export function canCreateAtRoot(): boolean {
  return true;
}
