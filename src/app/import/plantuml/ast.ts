export type PlantUmlDeclarationKind =
  | 'frame'
  | 'node'
  | 'artifact'
  | 'database'
  | 'interface'
  | 'actor'
  | 'component';

export interface SourceLocation {
  line: number;
  column: number;
}

export interface PlantUmlDeclaration {
  uid: string;
  kind: PlantUmlDeclarationKind;
  name: string;
  alias: string;
  parentUid?: string;
  color?: string;
  location: SourceLocation;
}

export interface PlantUmlNote {
  target: string;
  position: 'left' | 'right' | 'top' | 'bottom';
  text: string;
  scopeUid?: string;
  location: SourceLocation;
}

export interface PlantUmlRelation {
  source: string;
  target: string;
  label: string;
  bidirectional: boolean;
  dotted: boolean;
  hidden: boolean;
  scopeUid?: string;
  location: SourceLocation;
}

export interface PlantUmlWarning {
  code: string;
  message: string;
  line?: number;
}

export interface PlantUmlDocument {
  title?: string;
  declarations: PlantUmlDeclaration[];
  notes: PlantUmlNote[];
  relations: PlantUmlRelation[];
  legend?: string;
  warnings: PlantUmlWarning[];
}
