import type { InfraConnectionKind, InfraType } from '../../editor/infra/meta/types';

export const FORMAT_NAME = 'inframodeler';
export const CURRENT_FORMAT_VERSION = 3;

export type ExtensionFields = Record<string, unknown>;

export interface DiagramFile {
  format: typeof FORMAT_NAME;
  formatVersion: number;
  title: string;
  elements: DiagramElementRecord[];
  connections: DiagramConnectionRecord[];
  extensions?: ExtensionFields;
}

export interface DiagramElementRecord {
  id: string;
  type: InfraType;
  name: string;
  parent?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  manualMinWidth?: number;
  manualMinHeight?: number;
  extensions?: ExtensionFields;
}

export interface DiagramConnectionRecord {
  id: string;
  source: string;
  target: string;
  kind: InfraConnectionKind;
  label: string;
  pinnedRouting?: boolean;
  labelPosition?: { x: number; y: number };
  waypoints: DiagramPoint[];
  extensions?: ExtensionFields;
}

export interface DiagramPoint {
  x: number;
  y: number;
  extensions?: ExtensionFields;
}
