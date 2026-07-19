# Technisches Konzept – InfraModeler

**Version:** 0.2 (Entwurf) · **Datum:** 19.07.2026 · **Bezug:** Anforderungsdokument v0.2, POC `inframodeler-prototyp.html`

---

## 1. Architekturüberblick

InfraModeler ist eine Tauri-Desktop-Anwendung. Die Architektur trennt drei Schichten mit klaren Verantwortungen:

```
┌─────────────────────────────────────────────────────┐
│  Tauri-Shell (Rust)                                 │
│  Fenster, native Menüs, Dateidialoge, Datei-IO,     │
│  Dateityp-Assoziation, Single-Instance, Updates     │
├─────────────────────────────────────────────────────┤
│  App-Shell (TypeScript, WebView)                    │
│  Dokument-Lebenszyklus (neu/öffnen/speichern/dirty),│
│  Serialisierung + Migration, Export, Recent Files,  │
│  Dialoge, Tastenkürzel-Registrierung                │
├─────────────────────────────────────────────────────┤
│  Editor-Kern (diagram-js + eigene Module)           │
│  Canvas, Interaktionen, Command-Stack,              │
│  InfraModel: Renderer · Rules · ContextPad ·        │
│  AutoPlace · AutoResize · Labels · Layouter         │
└─────────────────────────────────────────────────────┘
```

Leitprinzip: **Rust so dünn wie möglich.** Alle fachliche Logik lebt im TypeScript-Frontend; Rust liefert nur, was der Browser nicht kann (natives Datei-IO, Menüs, OS-Integration). Damit bleibt das Team in seiner Kernkompetenz TypeScript, und der Editor-Kern ist ohne Tauri im Browser test- und entwickelbar (wichtig für Tests und schnelle Iteration).

### 1.1 Technologie-Entscheidungen

| Entscheidung | Wahl | Begründung |
|---|---|---|
| Desktop-Rahmen | **Tauri 2** | Vorgabe; kleine Binaries, gute OS-Integration, aktives Ökosystem |
| Editor-Framework | **diagram-js** (MIT) | Beschlossen; liefert Command-Stack, Context Pad, Rules, Snapping, Bendpoints, Lasso, Copy/Paste als gepflegte Module. Hinweis Lizenz: die "powered by bpmn.io"-Logopflicht betrifft *bpmn-js*, nicht diagram-js |
| Sprache | **TypeScript** (strict) | Teamskills; diagram-js liefert Typdefinitionen |
| Build | **Vite** | Standard im Tauri-Umfeld, schnelle Dev-Loop |
| App-Shell-UI | **Framework-frei** (Vanilla TS + wenige Web-Komponenten) | Die App-Shell ist klein (Menü-Handler, 3–4 Dialoge). Ein UI-Framework brächte hier mehr Komplexität als Nutzen, zumal der Editor selbst außerhalb jedes Frameworks lebt |
| SVG-Hilfsbibliothek | **tiny-svg** | Wird von diagram-js selbst verwendet; der POC-Renderer lässt sich damit nahezu mechanisch portieren (Kap. 3.4) |
| Tests | **Vitest** (Unit), **Playwright** + WebdriverIO/tauri-driver (E2E) | Editor-Kern im Browser testbar; Shell-Integration per tauri-driver |

### 1.2 Referenzprojekte

Die Dokumentation zu Custom-Editoren auf diagram-js ist dünn; gelernt wird aus Quellcode. Drei Referenzen decken alles Nötige ab:

1. **postit-js** (github.com/pinussilvestrus/postit-js) – ein eigenständiger Post-it-Board-Editor auf purem diagram-js, *ohne* BPMN. Bestes Vorbild für Projektaufbau, Modul-Registrierung und einen eigenen ElementFactory/Renderer. Unser Setup folgt diesem Muster.
2. **bpmn-js** – Fundgrube für fortgeschrittene Behaviors: AutoResize, AutoPlace-Strategien, Label-Editing, Kopieren/Einfügen, SVG-Export (`saveSVG`).
3. **diagram-js/example** und **dmn-js (DRD-Editor)** – weitere Custom-Editor-Beispiele der bpmn.io-Familie.

---

## 2. Editor-Kern: Aufbau auf diagram-js

### 2.1 Instanziierung und Modulsystem

diagram-js verwendet Dependency Injection (didi): Der Editor wird aus Modulen komponiert, jedes Modul registriert Services unter Namen. Unser Editor entsteht so:

```ts
// src/editor/InfraModeler.ts
import Diagram from 'diagram-js';
import ConnectModule from 'diagram-js/lib/features/connect';
import ContextPadModule from 'diagram-js/lib/features/context-pad';
import CreateModule from 'diagram-js/lib/features/create';
import LassoToolModule from 'diagram-js/lib/features/lasso-tool';
import ModelingModule from 'diagram-js/lib/features/modeling';
import MoveModule from 'diagram-js/lib/features/move';
import MoveCanvasModule from 'diagram-js/lib/navigation/movecanvas';
import ZoomScrollModule from 'diagram-js/lib/navigation/zoomscroll';
import SelectionModule from 'diagram-js/lib/features/selection';
import RulesModule from 'diagram-js/lib/features/rules';
import SnappingModule from 'diagram-js/lib/features/snapping';
import BendpointsModule from 'diagram-js/lib/features/bendpoints';
import AutoResizeModule from 'diagram-js/lib/features/auto-resize';
import AutoPlaceModule from 'diagram-js/lib/features/auto-place';
import LabelSupportModule from 'diagram-js/lib/features/label-support';

import InfraCoreModule from './infra';   // unsere Module, siehe 2.2

export function createInfraModeler(container: HTMLElement) {
  return new Diagram({
    canvas: { container },
    modules: [
      ModelingModule, SelectionModule, MoveModule, ConnectModule,
      ContextPadModule, CreateModule, RulesModule, SnappingModule,
      BendpointsModule, LassoToolModule, AutoResizeModule, AutoPlaceModule,
      LabelSupportModule, MoveCanvasModule, ZoomScrollModule,
      InfraCoreModule
    ]
  });
}
```

Undo/Redo (CommandStack), Auswahl-Outline, Keyboard und Overlays kommen über die Modeling-/Selection-Module bzw. werden bei Bedarf ergänzt. **Wichtig:** Nichts davon bauen wir selbst – das ist der Kern der Framework-Entscheidung.

### 2.2 Eigene Module (Paket `src/editor/infra`)

```
src/editor/infra/
├── index.ts                 // didi-Moduldefinition, registriert alles Folgende
├── meta/
│   ├── types.ts             // Elementtypen, Größen, Defaults  (POC: DEF)
│   ├── containment.ts       // Enthaltensein-Matrix            (POC: CONTAINS)
│   ├── contextPad.ts        // typisierte Context-Pad-Aktionen  (POC: PADCFG)
│   └── edgeDefaults.ts      // Standard-Kantenlabels           (POC: EDGE_DEFAULT)
├── InfraElementFactory.ts   // erzeugt Shapes mit businessObject {type, name}
├── InfraRenderer.ts         // zeichnet alle Elementtypen      (POC: drawNode)
├── InfraRules.ts            // RuleProvider                    (POC: CONTAINS + Checks)
├── InfraContextPad.ts       // ContextPadProvider              (POC: PADCFG)
├── InfraAutoPlace.ts        // Platzierungsstrategie           (POC: placeInside/freeSpot)
├── InfraAutoResize.ts       // automatisches Containerwachstum  (POC: fit)
├── InfraFitBehavior.ts      // Rück-Fitting nach Löschen/Umhängen
├── InfraResizeBehavior.ts   // manuelles Skalieren über Eckgriffe
├── InfraLayouter.ts         // orthogonales Kantenrouting      (POC: routePoints)
├── InfraLabelBehavior.ts    // CommandInterceptor: Default-Labels, Aktor→HTTPS, Notiz-Stil
├── InfraDirectEditing.ts    // Inline-Bearbeitung von Namen und Kantenlabels
├── InfraCopyPasteBehavior.ts// Erhalt der Fachdaten beim Kopieren
└── InfraPalette.ts          // linke Palette (ersetzt Toolbar-Buttons des POC)
```

Die Moduldefinition in `src/editor/infra/index.ts` verdrahtet diese Services per didi. Generische Funktionen wie CommandStack, Auswahl, Resize, Bendpoints, Snapping, Lasso und Copy/Paste bleiben Module von diagram-js.

---

## 3. Übertragbarkeit: POC → diagram-js (Kernkapitel)

Der POC ist kein Wegwerf-Code, sondern die **Spezifikation**. Dieses Kapitel bildet jede POC-Mechanik auf ihren diagram-js-Zielort ab und markiert, was 1:1 portierbar ist, was in ein Framework-Muster umzieht und was ersatzlos entfällt, weil das Framework es besser mitbringt.

### 3.1 Mapping-Tabelle (Gesamtübersicht)

| POC-Mechanik | POC-Code | diagram-js-Zielort | Übertragung |
|---|---|---|---|
| Elementdaten `{id,type,x,y,w,h,label,parent}` | `model.nodes` | Shapes in `ElementRegistry`; Fachdaten als `businessObject { type, name }` | **Umzug**: Geometrie verwaltet das Framework, Fachattribute bleiben unsere |
| Kanten `{source,target,label}` | `model.edges` | Connections mit `waypoints`; Label als eigenes Label-Element (`labelSupport`) | Umzug; Waypoints ersetzen unser implizites Routing |
| Typen, Größen, Defaults | `DEF` | `meta/types.ts`, genutzt von ElementFactory | **1:1 kopierbar** |
| Enthaltensein-Matrix | `CONTAINS` | `meta/containment.ts`, ausgewertet in `InfraRules` | **1:1 kopierbar** |
| Standard-Kantenlabels | `EDGE_DEFAULT` | `meta/edgeDefaults.ts`, angewendet im `InfraLabelBehavior` | **1:1 kopierbar** |
| Formen zeichnen | `drawNode()` | `InfraRenderer.drawShape()` | **Nahezu mechanisch portierbar**, siehe 3.4 |
| Kanten zeichnen | `drawEdge()` | `InfraRenderer.drawConnection()` + `InfraLayouter` | Aufgeteilt: Optik → Renderer, Verlauf → Layouter |
| Kantenverlauf | `routePoints()` | `InfraLayouter` auf Basis `ManhattanLayout`-Utilities + `CroppingConnectionDocking` | Muster übernehmen, Framework-Utilities nutzen |
| Context Pad | `PADCFG` + `updatePad()` | `InfraContextPad.getContextPadEntries()` | Konfiguration 1:1, Rendering entfällt (Framework) |
| Anhängen mit Auto-Position | `appendInside/appendBeside/placeInside/freeSpot` | `autoPlace`-Feature + eigener `InfraAutoPlace`-Handler | Strategie 1:1 (vertikal stapeln, rechts mit Ausweichen), Rahmen vom Framework |
| Mitwachsende Container | `fit()` | `InfraAutoResize` (erweitert `AutoResizeProvider`) | Idee identisch; Framework triggert bei create/move automatisch und undo-fähig |
| Andocken per Drag | Drop-Logik in `pointerup` | `InfraRules`-Regel `elements.move` + Modeling | Regel 1:1; visuelles Feedback beim Ziehen gratis |
| Verbinden-Werkzeug | `startConnect/finishConnect` | `connect`-Feature; Zulässigkeit via `InfraRules` (`connection.create`) | Eigenbau entfällt |
| Default-Label je Kontext | in `finishConnect` | `InfraLabelBehavior` (CommandInterceptor `postExecute` auf `connection.create`) | Logik 1:1, als Behavior |
| Notiz-Kante gestrichelt/ohne Pfeil | Sonderfall in `drawEdge` | `drawConnection()` unterscheidet per businessObject | 1:1 |
| Umbenennen per Doppelklick | `beginRename` + Overlay-Input | Paket `diagram-js-direct-editing` + eigener Provider | Eigenbau entfällt |
| Notiz-Zeilenumbruch | `wrapText()` + `n.h`-Anpassung | Renderer (tspan-Zeilen) + `text-util`; Höhe via Modeling.resize | Utility 1:1 übernehmbar |
| Auswahl + Outline | `sel` + Overlay-Rechteck | `selection`/`outline`-Module | **Entfällt** |
| Undo/Redo | JSON-Snapshots (`snap/undo`) | `CommandStack` | **Entfällt** – granularer und speicherschonender |
| Zoom/Pan | Wheel-/Pointer-Handler | `zoomscroll`/`movecanvas` | **Entfällt** |
| Voll-Rerender pro Frame | `render()` | inkrementelles Rendering des Frameworks | **Entfällt** – löst das Performance-Risiko des POC |
| Toolbar "+ Element" | Header-Buttons | `InfraPalette` (+ `create`-Feature: Element hängt am Cursor) | Aufwertung |
| SVG-Export | String-Zusammenbau | `saveSVG`-Muster aus bpmn-js (Canvas-SVG klonen, Defs einbetten) | Muster übernehmen |
| Beispielszene | `seed()` | Importer lädt `beispiel.imod.json` | Umzug ins Dateiformat |

**Fazit vorab:** Die drei Konfigurationsobjekte (`DEF`, `CONTAINS`, `EDGE_DEFAULT`), der komplette Renderer und die Platzierungs-/Wachstums-Strategien – also alles, was InfraModeler *fachlich einzigartig* macht – wandern nahezu unverändert mit. Was zurückbleibt, ist ausschließlich generische Editor-Mechanik, die diagram-js besser beherrscht.

### 3.2 Regeln: `CONTAINS` → RuleProvider

Der POC prüft Zulässigkeit an drei verstreuten Stellen (Drop-Logik, Pad-Konfiguration, implizit im Seed). diagram-js zentralisiert das: Ein `RuleProvider` beantwortet Fragen wie "darf X in Y erzeugt/verschoben werden, darf A mit B verbunden werden" – und *alle* Werkzeuge (Create, Move, Connect, Paste) fragen ihn automatisch.

```ts
import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';
import { CONTAINS } from './meta/containment';

export default class InfraRules extends RuleProvider {
  init() {
    this.addRule('shape.create', ({ target, shape }) =>
      canContain(target, shape));                       // POC: CONTAINS-Check

    this.addRule('elements.move', ({ target, shapes }) =>
      target == null || shapes.every(s => canContain(target, s)));  // POC: Drop-Logik

    this.addRule('connection.create', ({ source, target }) =>
      canConnect(source, target));                      // z. B. keine Kante Zone→Zone
  }
}

function canContain(parent, child) {
  if (!parent || parent.id === '__implicitroot')
    return child.businessObject.type !== 'syssoft'
        && child.businessObject.type !== 'module';      // Runtimes/Module nie freistehend? → fachlich klären; POC erlaubt es
  return (CONTAINS[parent.businessObject?.type] ?? []).includes(child.businessObject.type);
}
```

Gewinn gegenüber dem POC: Die Regel wirkt schon *während* des Ziehens (rote/grüne Drop-Markierung), nicht erst beim Loslassen – genau das Camunda-Gefühl, das der POC nur andeutet.

### 3.3 Context Pad: `PADCFG` → ContextPadProvider

Die POC-Datenstruktur bleibt wörtlich bestehen; nur die Auswertung zieht um. Ein Eintrag pro Aktion, das Framework übernimmt Positionierung, Rendering und Öffnen/Schließen:

```ts
export default class InfraContextPad {
  static $inject = ['contextPad', 'modeling', 'elementFactory', 'autoPlace', 'connect', 'create'];
  constructor(contextPad, modeling, elementFactory, autoPlace, connect, create) {
    Object.assign(this, { modeling, elementFactory, autoPlace, connect, create });
    contextPad.registerProvider(this);
  }

  getContextPadEntries(element) {
    const entries = {};
    for (const cfg of PADCFG[element.businessObject.type] ?? []) {
      entries[`append.${cfg.t}`] = {
        group: 'append',
        className: `infra-icon-${cfg.t}`,          // POC-Icons → CSS-Sprite/Font
        title: cfg.tip,
        action: { click: () => this.append(element, cfg) }   // nutzt autoPlace, s. 3.5
      };
    }
    entries['connect'] = { group: 'edit', className: 'infra-icon-connect',
      title: 'Verbinden – Ziel anklicken',
      action: { click: (ev) => this.connect.start(ev, element) } };
    entries['delete']  = { group: 'edit', className: 'infra-icon-trash',
      title: 'Löschen (Entf)',
      action: { click: () => this.modeling.removeElements([element]) } };
    return entries;
  }
}
```

Der POC-Sonderfall "Notiz anheften an alles außer Notizen" wird zur Bedingung in der Schleife – identische Logik, anderer Ort.

### 3.4 Renderer: `drawNode()` portiert sich fast von selbst

Das ist die wichtigste Erkenntnis für die Studenten: Der POC-Renderer nutzt einen Helfer `el(tag, attrs, parent)`, der SVG-Elemente erzeugt. diagram-js' Hausbibliothek **tiny-svg** bietet exakt dieselbe Denkweise (`svgCreate`, `svgAttr`, `svgAppend`). Die Portierung ist damit eine mechanische Übersetzung, Form für Form:

```ts
// POC                                     // InfraRenderer (tiny-svg)
el('rect', {x, y, width:w, ...}, g);       const r = svgCreate('rect');
                                           svgAttr(r, {x: 0, y: 0, width: w, ...});
                                           svgAppend(parentGfx, r);
```

Einziger konzeptioneller Unterschied: diagram-js zeichnet Shapes in einem **lokalen Koordinatensystem** (0/0 = linke obere Ecke des Shapes; die Weltposition setzt das Framework per Transform). Beim Portieren wird also in jeder kopierten `drawNode`-Formel `x`→`0` und `y`→`0` gesetzt – der Rest (3D-Server-Quader, Zylinder-Pfad, Ziegel-Firewall, Globus, Strichfigur, Eselsohr inkl. `wrapText`) bleibt Zeichen für Zeichen erhalten.

```ts
import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
const PRIORITY = 1500;

export default class InfraRenderer extends BaseRenderer {
  static $inject = ['eventBus'];
  constructor(eventBus) { super(eventBus, PRIORITY); }

  canRender(element) { return !!element.businessObject?.type; }

  drawShape(parentGfx, shape) {
    switch (shape.businessObject.type) {
      case 'server':  return this.drawServer(parentGfx, shape);   // Inhalt = POC drawNode-Zweig
      case 'db':      return this.drawDb(parentGfx, shape);
      // … alle 11 Typen
    }
  }

  drawConnection(parentGfx, connection) {
    // Polyline entlang connection.waypoints;
    // gestrichelt/ohne Pfeil, wenn ein Endpunkt Typ 'note' ist (POC-Logik 1:1)
  }
}
```

### 3.5 Anhängen & Platzieren: `placeInside`/`freeSpot` → AutoPlace

Das "einen Klick, fertig positioniert"-Gefühl des POC entsteht in diagram-js über das `auto-place`-Feature: `autoPlace.append(source, shape)` erzeugt Element + Verbindung als *einen* Undo-Schritt und fragt eine Strategie nach der Position. Unsere Strategie ist die POC-Logik:

- Ziel ist Container (`inside`-Fall): unter dem untersten Kind stapeln (`placeInside`), sonst Innen-Offset gemäß `PADIN`.
- Ziel ist "daneben" (`beside`-Fall): rechts vom Quell-Element mit Lücke, bei Kollision in 64-px-Schritten nach unten ausweichen (`freeSpot`).

Beide Funktionen werden aus dem POC übernommen und lediglich von Pixel-Mutation auf "Position zurückgeben" umgestellt. Die Verbindung samt Default-Label entsteht nicht mehr hier, sondern deklarativ im `InfraLabelBehavior` (3.6) – dadurch gilt sie auch für manuell gezogene Verbindungen.

### 3.6 Behaviors: die unsichtbare Intelligenz

CommandInterceptors sind das diagram-js-Muster für "immer wenn X passiert, tue zusätzlich Y" – transaktional und undo-fähig. Drei Behaviors ersetzen POC-Sonderlogik und tragen neue Funktionen:

```ts
export default class InfraLabelBehavior extends CommandInterceptor {
  static $inject = ['eventBus', 'modeling'];
  constructor(eventBus, modeling) {
    super(eventBus);
    this.postExecute('connection.create', ({ context }) => {
      const { source, target, connection } = context;
      if (connection.businessObject.label !== undefined) return;
      let label = EDGE_DEFAULT[target.businessObject.type] ?? '';
      if (source.businessObject.type === 'actor') label = 'HTTPS';
      if ([source, target].some(e => e.businessObject.type === 'note')) label = '';
      if (label) modeling.updateLabel(connection, label);
    });
  }
}
```

`InfraAutoResize` (erweitert den mitgelieferten `AutoResizeProvider`): erlaubt Auto-Wachstum genau für Zone/Server/Systemsoftware und übernimmt die `PADIN`-Innenabstände aus dem POC als Expansions-Padding – `fit()` als Framework-Bürger, automatisch ausgelöst bei Create, Move und Paste.

`FirewallBehavior` (F-31, vorgesehen): `postExecute('connection.create')` soll prüfen, ob Quelle und Ziel in unterschiedlichen Zonen liegen (Elternkette hochlaufen – identisch zur POC-`depth`-Logik); wenn ja, geht ein Event an die App-Shell für die unaufdringliche Nachfrage. Bei Zustimmung fügt `modeling` ein Firewall-Shape auf der Verbindung ein und teilt sie.

### 3.7 Was bewusst *nicht* portiert wird

- **Voll-Rerender pro Mausereignis** – der zentrale technische Makel des POC. diagram-js rendert inkrementell; das Performance-Ziel N-03 wird dadurch ohne Eigenleistung erreichbar.
- **JSON-Snapshot-Undo** – ersetzt durch den CommandStack (granular, korrekt bei zusammengesetzten Operationen wie autoPlace).
- **Selbstgebaute Pointer-Zustandsmaschine** (drag/pan/connect-Modi) – vollständig durch Framework-Features abgedeckt; erfahrungsgemäß die fehleranfälligste Codeklasse in Eigenbau-Editoren.

### 3.8 Portierungs-Fahrplan für das Team

Empfohlene Reihenfolge, jede Stufe lauffähig (gut als Studenten-Meilensteine):

1. postit-js-Grundgerüst nachbauen; ElementFactory + Renderer mit **einem** Typ (Modul) → erstes eigenes Element auf dem Canvas.
2. Alle 11 Renderer-Zweige aus dem POC portieren (rein mechanisch, s. 3.4); Palette dazu.
3. `InfraRules` + `CONTAINS`; Verschachtelung per Drag erlebbar machen.
4. `InfraContextPad` + `InfraAutoPlace`: der "Ein-Klick-DB-mit-JDBC"-Moment.
5. `InfraAutoResize`, `InfraLayouter`, `InfraLabelBehavior`, direct-editing.
6. Bendpoints, Snapping, Lasso, Copy/Paste aktivieren (Konfiguration, kaum Code).
7. Serialisierung (Kap. 4), dann Tauri-Shell (Kap. 5), Export (Kap. 6), FirewallBehavior.

---

## 4. Dateiformat

Das implementierte JSON-Format trägt die Endung **`.imod.json`** und liegt in Formatversion 1 vor. Es bleibt für generische Werkzeuge als JSON erkennbar. Designziele sind Menschenlesbarkeit, Git-freundliche Diffs (N-05), robuste Validierung (N-06) und eine explizite Migrationskette (N-09).

```json
{
  "format": "inframodeler",
  "formatVersion": 1,
  "title": "Webshop – Produktionssicht",
  "elements": [
    { "id": "zone_1", "type": "zone",   "name": "intranet", "x": 80,  "y": 60,  "w": 280, "h": 170 },
    { "id": "server_1", "type": "server", "name": "srv-app-01", "parent": "zone_1", "x": 98, "y": 100, "w": 430, "h": 250 },
    { "id": "syssoft_1", "type": "syssoft", "name": "Tomcat 10", "parent": "server_1", "x": 114, "y": 136, "w": 200, "h": 95 },
    { "id": "module_1", "type": "module", "name": "Webshop", "parent": "syssoft_1", "x": 128, "y": 168, "w": 156, "h": 46 },
    { "id": "db_1", "type": "db", "name": "Kunden-DB", "parent": "server_1", "x": 350, "y": 130, "w": 132, "h": 88 }
  ],
  "connections": [
    { "id": "connection_1", "source": "module_1", "target": "db_1",
      "kind": "communication", "label": "JDBC",
      "waypoints": [ { "x": 284, "y": 191 }, { "x": 350, "y": 174 } ] }
  ]
}
```

### 4.1 Felder

- Das Wurzelobjekt enthält `format`, `formatVersion`, `title`, `elements` und `connections`.
- Elemente enthalten `id`, `type`, `name`, optional `parent`, sowie die Weltgeometrie `x`, `y`, `w`, `h`.
- Verbindungen enthalten `id`, `source`, `target`, `kind`, `label` und mindestens zwei `waypoints`.
- `kind` ist `communication` für gerichtete Kommunikation oder `noteAttachment` für eine gestrichelte Notiz-Anheftung.
- Containergrößen und manuell gesetzte Kantenwegpunkte werden vollständig persistiert.

### 4.2 Serialisierung

- **Deterministisch:** feste Schlüsselreihenfolge, Elemente sortiert nach ID, LF-Zeilenenden, 2-Spaces-Einrückung, abschließender Zeilenumbruch. Zwei Speichervorgänge ohne Änderung ⇒ byte-identisch.
- **Stabile IDs:** einmal vergeben, nie neu nummeriert. Neue IDs verwenden das Typpräfix und einen fortlaufenden, nach dem Import reservierten Zähler, beispielsweise `module_42` oder `connection_9`.
- **Ein Element pro Objekt-Block:** Änderungen an einem Element erzeugen einen lokal begrenzten Diff.
- **Toleranzprinzip:** Unbekannte Zusatzfelder auf Wurzel-, Element-, Verbindungs- und Wegpunktebene werden beim Laden bewahrt und deterministisch wieder herausgeschrieben.

### 4.3 Laden, Validierung und Migration

- Der Parser meldet syntaktische JSON-Fehler mit Zeile und Spalte.
- Formatkennung, Formatversion, Feldtypen, positive Größen, eindeutige IDs und Referenzen werden vor dem Import geprüft.
- Parent-Beziehungen müssen der Enthaltensein-Matrix entsprechen und dürfen keine Zyklen bilden.
- Verbindungsart und Endpunkte müssen semantisch zusammenpassen; Notiz-Anheftungen besitzen genau einen Notiz-Endpunkt.
- Dateien mit höherer Formatversion werden mit einer verständlichen Versionsmeldung abgelehnt. Für ältere Versionen durchläuft der Loader die Migrationskette in `migrate.ts`.
- Erst eine vollständig geparste und validierte Datei ersetzt den aktuellen Editorinhalt. Fehler lassen das geöffnete Diagramm unverändert.
- Der Import baut Eltern vor Kindern und anschließend die Verbindungen über `modeling`/`canvas` auf. Der Export liest aus der `ElementRegistry`. Die Implementierung liegt unter `src/app/serialization/` und wird mit Vitest auf Roundtrip, Determinismus, Zusatzfelder und Fehlerfälle geprüft.

---

## 5. Tauri-Integration

Die Desktop-Shell verwendet **Tauri 2** mit dem finalen App-Identifier **`io.github.aweber10.inframodeler`**. Registriert sind die offiziellen Plugins `dialog`, `fs`, `persisted-scope`, `window-state` und auf Desktop-Plattformen `single-instance`.

- **App-Schichten:** `AppController` koordiniert Editor- und Dateiaktionen. `DocumentSession` hält Pfad, Titel, gespeicherten Snapshot und aktuellen Snapshot. `PlatformAdapter` trennt Browser- und Tauri-Zugriffe, sodass der Editor weiterhin unabhängig im Browser läuft.
- **Datei-Lebenszyklus:** Dirty wird durch den Vergleich der aktuellen kanonischen Serialisierung mit dem zuletzt gespeicherten Snapshot bestimmt. Dadurch wird auch ein Undo exakt zurück zum Speicherstand korrekt als sauber erkannt. Der Fenstertitel lautet `● name.imod.json – InfraModeler`; die Schließen-Abfrage bietet Speichern, Verwerfen und Abbrechen.
- **Dateityp-Assoziation** (F-03) über die Bundler-Konfiguration (`fileAssociations` für `.imod.json`); geöffnete Datei kommt als Startargument bzw. per single-instance-Event bei bereits laufender App.
- **Natives Menü:** Ablage, Bearbeiten, Darstellung und Hilfe werden in Rust definiert. Menüereignisse gehen als `app-action` an denselben TypeScript-Controller wie Toolbar und Editor-Actions.
- **Zuletzt geöffnet:** Bis zu zehn Pfade werden lokal gespeichert. Nicht mehr lesbare Einträge werden beim fehlgeschlagenen Öffnen entfernt.
- **Single Instance:** Weitere Startversuche fokussieren das vorhandene Fenster und übergeben eine `.imod.json`-Datei als `open-path`-Ereignis.
- **Recovery** (F-05, noch nicht umgesetzt): vorgesehen ist alle 60 s bei Dirty-Zustand ein Autosave in das Tauri-`appDataDir`; beim Start wird eine verbliebene Recovery-Datei erkannt und angeboten.
- **Sicherheit:** Eine strikte CSP erlaubt keinen Remote-Content. Dateizugriff wird auf per Dialog gewählte, per Finder geöffnete oder bereits autorisierte Diagrammpfade begrenzt. `persisted-scope` bewahrt diese Freigaben für die Liste zuletzt geöffneter Dateien.
- **Icons:** `design/icon-source.svg` ist die bearbeitbare Quelle, `design/icon-1024.png` das Ausgangsbild für `npm run tauri icon design/icon-1024.png`. Alle Dateien unter `src-tauri/icons/` sind daraus generiert.

**WebView-Realität:** Windows rendert mit WebView2 (Chromium), macOS mit WKWebView, Linux mit WebKitGTK. Konsequenzen: nur breit unterstützte Web-APIs; SVG-Feinheiten (Text-Metriken, `dominant-baseline`) auf allen drei Engines gegentesten; CI-Builds und Smoke-Tests pro Plattform (Kap. 7). Schriftart im Bundle mitliefern (ein freies Mono + ein freies Sans), nicht auf Systemfonts verlassen – wichtig für identische Diagramm-Optik und für den Export.

**Validierungsstand:** Entwicklung, Build, Dateilebenszyklus, native Menüs und manuelle Bedienung sind auf macOS geprüft. Die plattformübergreifenden Shell-Smoke-Tests für Windows und Linux erfolgen getrennt, sobald diese Plattformen verfügbar sind.

---

## 6. Export

- **SVG (F-40):** Muster von `bpmn-js` `saveSVG`: das Canvas-SVG klonen, Viewport-Transform entfernen, `viewBox` auf die Inhalts-Bounding-Box setzen, `defs` (Marker) einbetten. Da der Renderer ausschließlich Attribute statt CSS-Klassen stylt (POC-Erbe, beibehalten!), ist das Ergebnis selbsttragend. Schriften: Text bleibt Text; die Bundle-Fonts werden als `@font-face` (Base64, WOFF2) eingebettet, damit das SVG überall identisch aussieht.
- **PNG (F-41):** exportiertes SVG in ein `Image` laden, auf `<canvas>` mit Faktor 1–4× rastern, PNG-Blob über das `fs`-Plugin speichern. Läuft vollständig im WebView, kein Rust nötig.
- **Zwischenablage (F-42):** PNG-Blob via Clipboard-API; Fallback über Tauri-Clipboard-Plugin, falls eine WebView-Engine die Bild-Zwischenablage nicht unterstützt.

---

## 7. Qualitätssicherung und Build

- **Unit (Vitest, headless):** Rules-Matrix (jede Kombination aus 2.3 als Tabellen-Test), AutoPlace-Strategie, Serialisierung (Roundtrip, Determinismus, Migration), Label-Behavior.
- **Editor-Integration (Playwright, Browser):** Der Editor-Kern läuft ohne Tauri; das Leitszenario aus Kapitel 7 des Anforderungsdokuments wird als durchgängiger Browser-E2E-Test automatisiert.
- **Shell-E2E (tauri-driver/WebdriverIO):** wenige Smoke-Tests pro Plattform: Start, Datei öffnen per Argument, Speichern, Schließen-Dialog.
- **CI (GitHub Actions):** Matrix `windows-latest / macos-latest / ubuntu-latest`; Lint + Unit auf jedem Push, Bundles auf Tags. Signing/Notarization (macOS) als dokumentierter manueller Schritt, Automatisierung später (A-05).

---

## 8. Risiken und Gegenmaßnahmen

| Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|
| diagram-js-Lernkurve (didi, EventBus, dünne Doku) | Anlaufverzögerung | Portierungs-Fahrplan 3.8 mit früh sichtbaren Ergebnissen; postit-js als Blaupause; bpmn-js-Quellcode als Nachschlagewerk |
| WebView-Unterschiede (v. a. WebKitGTK) | Rendering-/Clipboard-Abweichungen | Bundle-Fonts, Attribut-Styling, CI-Smoke-Tests je Plattform, Feature-Fallbacks (6.) |
| AutoResize/AutoPlace-Feinschliff (verschachtelte Container) | UX bleibt hinter POC zurück | POC als Abnahme-Referenz: Verhalten gilt erst als fertig, wenn es sich wie im POC anfühlt; bpmn-js-Behaviors als Vorlage |
| Git-Merge-Konflikte in Diagrammdateien | Frust im Team | Format-Designregeln (Kap. 4) minimieren Konflikte; Doku-Kapitel "Konflikte lösen" im Benutzerhandbuch; ein Diagramm pro Datei begrenzt den Schaden |
| Scope-Creep Richtung Modell-Repository | V1 verfehlt | Nicht-Ziele im Anforderungsdokument; Erweiterungen nur als neue Elementtypen/Behaviors (N-08) |

---

## 9. Meilensteinplan

| Meilenstein | Inhalt | Ergebnis |
|---|---|---|
| **M1 – Editor-Fundament** | Fahrplan-Schritte 1–3 (Gerüst, Renderer, Rules) | Alle Elementtypen darstellbar, Verschachtelung per Drag, im Browser lauffähig |
| **M2 – Camunda-Gefühl** | Schritte 4–6 (Context Pad, AutoPlace, AutoResize, Layouter, direct-editing, Komfort-Features) | POC-Paritätstest bestanden: Leitszenario im Browser |
| **M3a – Desktop-App macOS** | Serialisierung, Tauri-Shell, Menüs, Dirty-Handling, Assoziation | Speichern/Laden und nativer Dateilebenszyklus auf macOS |
| **M3b – Plattformvalidierung** | Builds, Dateityp-Assoziation, Single Instance und Shell-Smoke-Tests | Gleiches Verhalten auf Windows, macOS und Linux |
| **M4 – Auslieferung V1** | SVG/PNG-Export, Leere-Fläche-Hilfe, Recovery, CI-Bundles, Handbuch-Basics | Installierbare V1 gemäß Anforderungsdokument Kap. 6 |

M1 und M2 sind bewusst Tauri-frei – das hält die Feedback-Schleife kurz und macht die Studenten-Challenge im Browser demonstrierbar, lange bevor die Desktop-Integration steht.

## 10. Ausblick auf die Zukunft

Kein Ziel der ersten Version - aber in zukünftigen Versionen sollen unterschiedliche Diagrammtypen unterstützt werden. Neben den aktuell umgesetzten klassischen Architekturen ein weiterer Diagrammtyp für Cloud-Native Architekturen.
