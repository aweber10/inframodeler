# Fachliches Anforderungsdokument – InfraModeler

**Version:** 0.2 (Entwurf) · **Datum:** 19.07.2026 · **Status:** fortgeschriebener Arbeitsstand

---

## 1. Zielsetzung und Vision

InfraModeler ist ein spezialisiertes Desktop-Werkzeug zur Erstellung von Deployment-Diagrammen mit Infrastruktur-Anteil. Es bildet ab, welche Softwaremodule auf welchen Servern und Runtimes betrieben werden, wie sie mit Datenbanken, Middleware (ESB) sowie internen und externen Systemen kommunizieren und in welchen Netzwerkzonen sie sich befinden.

Das zentrale Qualitätsmerkmal ist **Top-Bedienbarkeit nach dem Vorbild des Camunda Modelers**: Das Werkzeug kennt die Semantik der Diagrammart und führt den Anwender aktiv. Ansprechende, einheitliche und aussagekräftige Diagramme entstehen als Nebenprodukt der Bedienung – nicht durch Fleißarbeit beim Ausrichten und Verkabeln, wie es bei generischen Werkzeugen (Visio, draw.io) oder schwergewichtigen Werkzeugen (Enterprise Architect) der Fall ist.

Der validierte Proof of Concept (POC, `inframodeler-prototyp.html`) dient als **lebende Spezifikation** der gewünschten Interaktionen und der Notation. Wo dieses Dokument auf den POC verweist, ist das dort gezeigte Verhalten gemeint.

### 1.1 Zielgruppe

Softwarearchitektinnen und -architekten, Systemingenieure und Betriebsverantwortliche, die Deployment-Sichten für Architektur-Dokumentation, Betriebshandbücher und Reviews erstellen. Die Anwender sind technisch versiert, aber keine Werkzeug-Spezialisten; das Tool muss ohne Schulung bedienbar sein.

### 1.2 Abgrenzung (Nicht-Ziele)

Die folgenden Themen sind bewusst **kein** Bestandteil des Produkts. Sie hier festzuhalten schützt den Kern – die Bedienbarkeit – vor Verwässerung:

- Kein Modell-Repository: Eine Datei repräsentiert genau ein Diagramm. Es gibt keine dateiübergreifende Wiederverwendung von Elementen und keine Konsistenzprüfung zwischen Diagrammen.
- Keine Ausführbarkeit, keine Anbindung an CMDBs, Discovery-Tools oder Deployment-Pipelines.
- Keine Echtzeit-Kollaboration. Zusammenarbeit erfolgt über Dateien im Git-Repository; Konflikte werden über Git-Mechanismen gelöst.
- Keine Vollständigkeit gegenüber UML-Deployment oder ArchiMate. Das Metamodell ist bewusst klein und domänenspezifisch.

---

## 2. Fachliches Metamodell

### 2.1 Elementtypen

| Nr. | Typ | Fachliche Bedeutung | Darstellung (gemäß POC) | Kann enthalten |
|---|---|---|---|---|
| E-01 | **Netzwerkzone** | Netzsegment mit einheitlichem Schutzniveau (z. B. Intranet, DMZ) | Gestrichelter, getönter Rahmen; Name in Versalien | Server, DB, ESB, Firewall, Externes System, Umsystem, Aktor, Notiz |
| E-02 | **Server / Knoten** | Physischer oder virtueller Rechner, benannt per Hostname | 3D-Quader (UML-Node-Stil), Hostname in Monospace | Systemsoftware, Modul, Datenbank |
| E-03 | **Systemsoftware** | Laufzeitumgebung, z. B. Tomcat, WebSphere Liberty (WLP) | Rechteck mit Zahnrad-Symbol | Modul |
| E-04 | **Software-Modul** | Betriebene fachliche Einheit (Anwendung, Service, WAR/EAR) | UML-Komponenten-Symbol, teal | – |
| E-05 | **Datenbank** | Datenbankinstanz oder -schema | Zylinder, gelb | – |
| E-06 | **ESB / Middleware** | Integrationsschicht (ESB, API-Gateway, Message Broker) | Abgerundeter Balken mit Richtungspfeilen, violett | – |
| E-07 | **Firewall** | Netzübergang mit Filterfunktion | Vertikaler Ziegelbalken, orange | – |
| E-08 | **Externes System** | System außerhalb des Konzerns (Partner, SaaS); Blackbox, fremde Verantwortung | Grau, **gestrichelt**, Stereotyp «extern», Globus-Symbol | – |
| E-09 | **Umsystem** | Konzern-internes System, das im Diagramm nicht vertieft wird; Blackbox in eigener Verantwortung | Grau, **solide** Kontur, Würfel-Symbol, ohne Stereotyp | – |
| E-10 | **Aktor** | Menschlicher Nutzer oder Rolle | UML-Strichfigur mit Namen | – |
| E-11 | **Notiz** | Freitext-Anmerkung | Gelber Zettel mit Eselsohr, automatischer Zeilenumbruch | – |

Die visuelle Unterscheidung von E-08 und E-09 (gestrichelt + Stereotyp vs. solide ohne Stereotyp) ist fachlich bedeutsam: Sie codiert die Verantwortungsgrenze und muss ohne Legende erkennbar bleiben.

### 2.2 Verbindungen

| Nr. | Verbindung | Bedeutung | Darstellung |
|---|---|---|---|
| V-01 | **Kommunikation** | Aufrufbeziehung mit Protokoll-Label (JDBC, REST, SOAP, HTTPS, MQ …) | Durchgezogene orthogonale Linie mit Pfeil in Aufrufrichtung, Label in Pille |
| V-02 | **Notiz-Anheftung** | Zuordnung einer Notiz zu einem Element | Gestrichelte Linie ohne Pfeil (UML-Konvention) |

Kontextabhängige Standard-Labels beim Erzeugen (überschreibbar): Ziel Datenbank → `JDBC`; Ziel/Quelle ESB → `REST / SOAP`; Ziel Modul → `REST`; Quelle Aktor → `HTTPS`; Umsystem/Externes System → `REST / SOAP`.

Eine verbindliche Quell-/Ziel-Matrix für zulässige Verbindungen ist bewusst nicht Teil dieses Dokuments. V1 verbietet nur Selbstverbindungen, Verbindungen mit einer Netzwerkzone als Endpunkt sowie Notiz-zu-Notiz-Verbindungen; alle übrigen Kombinationen sind zulässig. Diese permissive Regel ist eine bewusste Zwischenentscheidung: Eine engere Matrix wird erst auf Basis der praktischen Nutzung ergänzt, falls sich ein Bedarf zeigt.

### 2.3 Enthaltensein-Regeln

Die Spalte "Kann enthalten" in 2.1 ist normativ. Das Werkzeug erzwingt diese Regeln: Unzulässiges Ablegen wird verhindert (nicht nur gewarnt). Blackbox-Typen (E-08, E-09) haben grundsätzlich kein Innenleben.

Auf der Wurzelebene des Diagramms (außerhalb jedes Containers) lässt das Werkzeug derzeit jeden Elementtyp zu, auch Software-Module und Systemsoftware, die fachlich normalerweise in Server bzw. Systemsoftware eingebettet sind. Diese offene Root-Platzierung ist eine bewusste Zwischenentscheidung; eine Einschränkung erfolgt erst, falls die praktische Nutzung einen Bedarf dafür zeigt.

---

## 3. Annahmen und Rahmenbedingungen

Die folgenden Annahmen wurden vom Autor getroffen und sind vom Fachbereich zu bestätigen:

- **A-01** Oberflächensprache ist Deutsch; die Architektur sieht Übersetzbarkeit vor, eine zweite Sprache ist für V1 nicht gefordert.
- **A-02** Exportformat in V1 ist SVG. PDF-Export ist für eine Folgeversion vorgesehen.
- **A-03** Ein Element-Template-Katalog (vorkonfigurierte Bausteine wie "WLP", "Oracle 19c", konzernspezifische ESB-Instanzen) ist als V1.1 eingeplant, nicht V1.
- **A-04** Das Entwicklungsteam besteht aus 1–3 Personen (duale Studierende plus Betreuer) mit TypeScript-Kenntnissen; Rust-Kenntnisse sind nur minimal erforderlich (siehe technisches Konzept).
- **A-05** Die Anwendung wird intern verteilt (kein öffentlicher Store); Code-Signing wird angestrebt, ist aber kein V1-Blocker.
- **A-06** Diagrammgrößen bis ca. 300 Elemente gelten als Obergrenze des realistischen Gebrauchs.

Rahmenbedingungen aus den getroffenen Entscheidungen: Desktop-Anwendung auf Basis **Tauri** für **Windows, macOS und Linux**; Ablage als **lokale Dateien**, Versionierung über **Git**; Editor-Kern auf Basis **diagram-js**; Datenmodell **ein Diagramm pro Datei**.

Aktueller Validierungsstand: Editor-Kern, Dateiformat und Desktop-Dateilebenszyklus sind auf macOS umgesetzt und manuell erprobt. Die funktionale Gleichheit auf Windows und Linux bleibt Bestandteil der plattformübergreifenden Abnahme gemäß N-02.

---

## 4. Funktionale Anforderungen

Priorisierung nach MoSCoW: **[M]** Muss (V1), **[S]** Soll (V1, verhandelbar), **[K]** Kann (Folgeversion).

### 4.1 Datei und Lebenszyklus

- **F-01 [M] Neues Diagramm.** Der Anwender kann ein leeres Diagramm anlegen. Ein neues Diagramm ist sofort bearbeitbar, ohne dass zuvor gespeichert werden muss.
- **F-02 [M] Speichern und Speichern unter.** Diagramme werden in einem dokumentierten, textbasierten Dateiformat gespeichert (Dateiendung `.imod.json`, siehe technisches Konzept). Das Format ist Git-Diff-freundlich: stabile Element-IDs, deterministische Serialisierung, ein Element pro Zeilenblock.
- **F-03 [M] Öffnen.** Diagramme können über Dateidialog, Zuletzt-geöffnet-Liste und per Doppelklick im Dateimanager (Dateityp-Assoziation) geöffnet werden. Beim Öffnen einer neueren Formatversion erscheint eine verständliche Fehlermeldung mit Versionshinweis.
- **F-04 [M] Ungespeicherte Änderungen.** Der Fenstertitel zeigt einen Dirty-Indikator. Beim Schließen mit ungespeicherten Änderungen fragt die Anwendung nach (Speichern / Verwerfen / Abbrechen).
- **F-05 [S] Absturzsicherung.** Die Anwendung legt periodisch eine Wiederherstellungskopie an und bietet diese nach einem Absturz beim nächsten Start an.
- **F-06 [K] Mehrere Diagramme gleichzeitig** in Tabs oder Fenstern.

### 4.2 Editor-Kerninteraktionen ("Camunda-Gefühl")

- **F-10 [M] Kontextmenü am Element (Context Pad).** Bei Auswahl eines Elements erscheint ein kompaktes Aktionsfeld direkt am Element. Es bietet ausschließlich die dort sinnvollen Aktionen an, gemäß der Pad-Konfiguration des POC (z. B. Zone → "Server anlegen"; Modul → "DB anbinden (JDBC)", "Über ESB anbinden", "Modul anbinden", "Externes System", "Umsystem"; überall: Notiz anheften, Verbinden, Umbenennen, Löschen).
- **F-11 [M] Anhängen mit automatischer Platzierung.** "Anhängen"-Aktionen erzeugen das neue Element automatisch positioniert (in Containern: gestapelt; daneben: rechts mit Kollisionsausweichen) und – wo definiert – inklusive beschrifteter Verbindung in einem Schritt.
- **F-12 [M] Mitwachsende und skalierbare Container.** Wird ein Kind in Zone, Server oder Systemsoftware eingefügt oder verschoben, wachsen die Container automatisch (rekursiv nach oben), sodass Inhalte nie überstehen. Nach Entfernen oder Umhängen eines Kindes schrumpfen die betroffenen Container bis zur fachlichen Mindestgröße beziehungsweise bis zur weiterhin für ihre Inhalte benötigten Größe. Für Ausnahmefälle lassen sich Container über Eckgriffe manuell vergrößern und verkleinern; Kinder und definierte Innenabstände begrenzen dabei die minimale Größe.
- **F-13 [M] Andocken per Drag & Drop.** Elemente lassen sich per Ziehen in zulässige Container umhängen (z. B. Modul von einem Tomcat in einen anderen). Unzulässige Ziele werden während des Ziehens visuell abgelehnt.
- **F-14 [M] Verbinden-Werkzeug.** Verbindungen entstehen über das Context Pad ("Verbinden", dann Ziel anklicken) mit kontextabhängigem Standard-Label (siehe 2.2). Unzulässige Verbindungen werden verhindert.
- **F-15 [M] Umbenennen inline.** Doppelklick auf Element oder Kantenlabel öffnet die Bearbeitung direkt am Ort; Enter bestätigt, Escape verwirft.
- **F-16 [M] Undo/Redo.** Alle Modelländerungen sind schrittweise rückgängig machbar und wiederholbar (Strg+Z / Strg+Y bzw. Cmd-Äquivalente), einschließlich Verschieben, Umhängen und Label-Änderungen.
- **F-17 [M] Zoomen und Verschieben der Arbeitsfläche.** Mausrad-Zoom auf den Cursor, Verschieben per Ziehen der freien Fläche; zusätzlich "Zoom auf Diagramm einpassen".
- **F-18 [M] Löschen** von Elementen (inklusive enthaltener Kinder und angeschlossener Verbindungen) und Verbindungen per Context Pad und Entf-Taste.
- **F-19 [S] Mehrfachauswahl.** Auswahl mehrerer Elemente per Aufziehrahmen (Lasso) und Umschalt-Klick; gemeinsames Verschieben und Löschen.
- **F-20 [S] Kopieren/Einfügen** innerhalb eines Diagramms, inklusive Teilbäumen (Server samt Inhalt).
- **F-21 [S] Kantenverlauf anpassen.** Verbindungen erhalten automatisch orthogonale Verläufe; der Anwender kann Stützpunkte (Bendpoints) versetzen, die beim Speichern erhalten bleiben.
- **F-22 [S] Ausrichten und Einrasten.** Beim Verschieben rastet das Element an Kanten und Mittelachsen benachbarter Elemente ein (Snapping mit Hilfslinien).
- **F-23 [K] Ausrichten-Befehle** für Mehrfachauswahl (linksbündig, zentriert, gleichmäßig verteilen).

### 4.3 Semantische Assistenz

- **F-30 [M] Regelwerk.** Enthaltensein- und Verbindungsregeln gemäß Kapitel 2 werden vom Werkzeug erzwungen; es gibt keinen "Trotzdem"-Modus.
- **F-31 [S] Firewall-Assistent.** Erzeugt der Anwender eine Kommunikationsverbindung über eine Zonengrenze hinweg, bietet die Anwendung unaufdringlich an, einen Firewall-Durchgang in die Verbindung einzufügen. Die Nachfrage ist pro Diagramm abschaltbar.
- **F-32 [K] Element-Templates.** Katalog vorkonfigurierter Bausteine (Name, Typ, ggf. Standard-Label), erweiterbar durch eigene, im Git teilbare Template-Dateien.
- **F-33 [K] Diagramm-Prüfung (Linting).** Hinweisliste auf Auffälligkeiten, z. B. unbeschriftete Verbindungen, leere Server, Zonenübertritte ohne Firewall.

### 4.4 Export und Austausch

- **F-40 [M] SVG-Export** des gesamten Diagramms in eine eigenständige Datei mit eingebetteten Stilen; das Ergebnis entspricht 1:1 der Bildschirmdarstellung (ohne Auswahl-Markierungen).
- **F-42 [S] Export in die Zwischenablage** (Bild), für schnelles Einfügen in Chats und Dokumente.
- **F-43 [K] PDF-Export.**
- **F-44 [K] Textueller Export** (PlantUML- oder Structurizr-DSL-Skizze) zur Weiterverarbeitung.
- **F-45 [S] PlantUML-Import.** Ein Untermenge des PlantUML-Deployment-Diagramm-Formats (`.puml`/`.plantuml`/`.pu`) kann geöffnet und auf das Metamodell aus Kapitel 2 abgebildet werden. Nicht eindeutig zuordenbare Konstrukte werden über Heuristiken gemappt und dem Anwender in einer Warnungsübersicht angezeigt. Ein importiertes Diagramm gilt als ungespeichert (dirty, ohne Pfad) und wird nie automatisch in die ursprüngliche PlantUML-Quelldatei zurückgeschrieben.

### 4.5 Hilfe und Einstieg

- **F-50 [M] Leere-Fläche-Hilfe.** Ein leeres Diagramm zeigt eine dezente Einstiegshilfe (die wichtigsten drei Gesten), die beim ersten Element verschwindet.
- **F-51 [S] Tastaturübersicht** über Menü und `?`-Taste.
- **F-52 [S] Beispieldiagramm** über das Menü öffenbar (entspricht der POC-Beispielszene).

---

## 5. Nichtfunktionale Anforderungen

- **N-01 [M] Bedienbarkeit als oberstes Kriterium.** Bei Zielkonflikten zwischen Funktionsumfang und Bedienbarkeit entscheidet die Bedienbarkeit. Neue Funktionen dürfen die Grundgesten (F-10 bis F-18) nicht verkomplizieren.
- **N-02 [M] Plattformen.** Windows 10/11 (x64), macOS 13+ (Apple Silicon und Intel), gängige Linux-Distributionen (x64, WebKitGTK-basiert). Identischer Funktionsumfang auf allen Plattformen; plattformübliche Tastenkürzel.
- **N-03 [M] Performance.** Flüssiges Arbeiten (Ziehen, Zoomen ohne wahrnehmbares Ruckeln) bei Diagrammen bis 300 Elemente auf üblicher Büro-Hardware; Öffnen einer solchen Datei unter 2 Sekunden.
- **N-04 [M] Offline-Fähigkeit.** Die Anwendung funktioniert vollständig ohne Netzverbindung und sendet keine Telemetrie.
- **N-05 [M] Git-Tauglichkeit des Dateiformats.** Zwei aufeinanderfolgende Speichervorgänge ohne Änderung erzeugen byte-identische Dateien; kleine Modelländerungen erzeugen lokal begrenzte Diffs.
- **N-06 [M] Robustheit.** Fehlerhafte oder handbearbeitete Dateien führen zu einer verständlichen Fehlermeldung mit Positionsangabe, niemals zu Absturz oder stillem Datenverlust.
- **N-07 [S] Zugänglichkeit.** Vollständige Bedienbarkeit der Menüs per Tastatur; sichtbarer Fokus; Farbcodierung wird stets durch Form/Symbol ergänzt (bereits Eigenschaft der Notation).
- **N-08 [S] Wartbarkeit.** Notation und Regeln sind in klar abgegrenzten Modulen konfiguriert (siehe technisches Konzept), sodass ein neuer Elementtyp ohne Änderungen am Editor-Kern ergänzt werden kann.
- **N-09 [M] Datei-Kompatibilität.** Jede Datei trägt eine Formatversion; die Anwendung liest alle älteren Formatversionen (Migration beim Laden).

---

## 6. Priorisierter Lieferumfang

**V1 (produktiv nutzbar):** F-01–F-04, F-05, F-10–F-22, F-30, F-40, F-45, F-50; alle [M]-NFRs. Damit ist der komplette POC-Funktionsumfang plus Datei-Lebenszyklus, Absturzsicherung, Komfortgesten und Export abgedeckt – in Framework-Qualität.

**V1.x (Komfort):** F-31, F-42, F-51, F-52, N-07, N-08.

**V2 (Ausbau):** F-06, F-23, F-32, F-33, F-43, F-44.

---

## 7. Abnahmekriterien (exemplarisch)

Für die Abnahme von V1 gilt das folgende Leitszenario, das ein Anwender ohne Einweisung in unter fünf Minuten bewältigen können muss: Neues Diagramm anlegen → Zone "Intranet" erstellen → darin per Context Pad einen Server, darin einen Tomcat, darin zwei Module anlegen (Container wachsen automatisch mit) → am ersten Modul per einem Klick eine Datenbank mit JDBC-Verbindung anhängen → einen Aktor erstellen und per HTTPS mit dem Modul verbinden → alles umbenennen → speichern, Anwendung schließen, Datei per Doppelklick wieder öffnen → als SVG exportieren. Das exportierte SVG ist ohne Nacharbeit präsentationstauglich.
