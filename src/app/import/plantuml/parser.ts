import type {
  PlantUmlDeclaration,
  PlantUmlDeclarationKind,
  PlantUmlDocument,
  PlantUmlRelation,
  SourceLocation
} from './ast';

const DECLARATION = /^(frame|node|artifact|database|interface|actor)\s+(.+)$/i;
const COMPONENT = /^\[([^\]]+)](?:\s+as\s+([^\s{]+))?\s*(\{)?\s*$/i;
const NOTE = /^note\s+(left|right|top|bottom)\s+of\s+(.+)$/i;
const RELATION = /^(.+?)\s+(\S*(?:--|~~|\.\.)\S*)\s+(.+?)(?:\s*:\s*(.*))?$/;

export function parsePlantUml(source: string): PlantUmlDocument {
  const document: PlantUmlDocument = { declarations: [], notes: [], relations: [], warnings: [] };
  const scopes: string[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let uid = 0;
  let started = false;
  let ended = false;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]!;
    const line = raw.trim();
    const location = { line: index + 1, column: raw.search(/\S|$/) + 1 };
    if (!line || line.startsWith("'")) continue;

    if (line === '@startuml') {
      if (started && !ended) document.warnings.push(warning('duplicate-start', 'Weiteres @startuml als fehlerhafter Abschluss ignoriert.', location));
      else started = true;
      continue;
    }
    if (line === '@enduml') {
      ended = true;
      continue;
    }
    if (/^skinparam\b/i.test(line)) continue;

    if (/^title\s*$/i.test(line)) {
      const block = collectBlock(lines, index + 1, /^end\s+title$/i);
      document.title = cleanText(block.content.join(' / '));
      index = block.end;
      continue;
    }
    if (/^legend\b/i.test(line)) {
      const block = collectBlock(lines, index + 1, /^endlegend$/i);
      document.legend = cleanText(block.content.join(' '));
      index = block.end;
      continue;
    }

    const note = NOTE.exec(line);
    if (note) {
      const block = collectBlock(lines, index + 1, /^end\s+note$/i);
      document.notes.push({
        position: note[1]!.toLowerCase() as 'left' | 'right' | 'top' | 'bottom',
        target: normalizeReference(note[2]!),
        text: cleanText(block.content.join('\n')),
        scopeUid: scopes.at(-1),
        location
      });
      index = block.end;
      continue;
    }

    if (line === '}') {
      if (!scopes.pop()) document.warnings.push(warning('extra-close', 'Überzählige schließende Klammer ignoriert.', location));
      continue;
    }

    const component = COMPONENT.exec(line);
    if (component) {
      const declaration = createDeclaration('component', component[1]!, component[2], Boolean(component[3]), scopes, ++uid, location);
      document.declarations.push(declaration);
      if (component[3]) scopes.push(declaration.uid);
      continue;
    }

    const declarationMatch = DECLARATION.exec(line);
    if (declarationMatch) {
      const parsed = parseDeclarationTail(declarationMatch[2]!);
      const declaration = createDeclaration(
        declarationMatch[1]!.toLowerCase() as PlantUmlDeclarationKind,
        parsed.name,
        parsed.alias,
        parsed.opensBlock,
        scopes,
        ++uid,
        location,
        parsed.color
      );
      document.declarations.push(declaration);
      if (parsed.opensBlock) scopes.push(declaration.uid);
      continue;
    }

    const relation = parseRelation(line, scopes.at(-1), location);
    if (relation) {
      document.relations.push(relation);
      continue;
    }

    document.warnings.push(warning('unsupported', `Nicht unterstützte Anweisung ignoriert: ${line}`, location));
  }

  if (!started) throw new Error('Keine @startuml-Deklaration gefunden.');
  if (!ended) document.warnings.push({ code: 'missing-end', message: 'Fehlendes @enduml wurde toleriert.' });
  if (scopes.length) document.warnings.push({ code: 'unclosed-block', message: `${scopes.length} nicht geschlossene Blöcke wurden am Dateiende geschlossen.` });
  if (!document.declarations.length) throw new Error('Keine importierbaren PlantUML-Elemente gefunden.');
  return document;
}

function parseDeclarationTail(tail: string) {
  const opensBlock = /\{\s*$/.test(tail);
  let value = tail.replace(/\{\s*$/, '').trim();
  const color = /\s+(#[^\s]+)\s*$/.exec(value)?.[1];
  if (color) value = value.slice(0, value.lastIndexOf(color)).trim();
  const aliasMatch = /\s+as\s+([^\s]+)\s*$/i.exec(value);
  const alias = aliasMatch?.[1];
  if (aliasMatch) value = value.slice(0, aliasMatch.index).trim();
  return { name: unquote(value), alias, color, opensBlock };
}

function createDeclaration(
  kind: PlantUmlDeclarationKind,
  name: string,
  explicitAlias: string | undefined,
  _opensBlock: boolean,
  scopes: string[],
  uid: number,
  location: SourceLocation,
  color?: string
): PlantUmlDeclaration {
  return {
    uid: `puml_${uid}`,
    kind,
    name: cleanText(unquote(name)),
    alias: normalizeReference(explicitAlias ?? unquote(name)),
    parentUid: scopes.at(-1),
    color,
    location
  };
}

function parseRelation(line: string, scopeUid: string | undefined, location: SourceLocation): PlantUmlRelation | undefined {
  const match = RELATION.exec(line);
  if (!match) return undefined;
  const arrow = match[2]!;
  return {
    source: normalizeReference(match[1]!),
    target: normalizeReference(match[3]!),
    label: cleanText(match[4] ?? ''),
    bidirectional: arrow.startsWith('<') && arrow.endsWith('>'),
    dotted: arrow.includes('.'),
    hidden: arrow.includes('[hidden]'),
    scopeUid,
    location
  };
}

function collectBlock(lines: string[], start: number, endPattern: RegExp) {
  const content: string[] = [];
  for (let index = start; index < lines.length; index += 1) {
    if (endPattern.test(lines[index]!.trim())) return { content, end: index };
    content.push(lines[index]!.trim());
  }
  return { content, end: lines.length - 1 };
}

export function cleanText(value: string): string {
  return value.replace(/<\/?[a-z][^>]*>/gi, '').replace(/\s+\n/g, '\n').trim();
}

export function normalizeReference(value: string): string {
  const trimmed = value.trim();
  const component = /^\[([^\]]+)]$/.exec(trimmed);
  return cleanText(unquote(component?.[1] ?? trimmed)).trim();
}

function unquote(value: string): string {
  return value.replace(/^"|"$/g, '');
}

function warning(code: string, message: string, location: SourceLocation) {
  return { code, message, line: location.line };
}
