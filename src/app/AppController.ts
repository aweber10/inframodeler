import type Diagram from 'diagram-js';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type EditorActions from 'diagram-js/lib/features/editor-actions/EditorActions';

import { createDemo } from '../editor/demo';
import type InfraElementFactory from '../editor/infra/InfraElementFactory';
import DocumentSession from './DocumentSession';
import { exportSvg as renderSvg } from './export/exportSvg';
import { importPlantUml, isPlantUmlPath } from './import/plantuml/importPlantUml';
import type PlantUmlImportDialog from './PlantUmlImportDialog';
import type { PlatformAdapter, AppAction } from './platform/PlatformAdapter';
import RecentFiles from './RecentFiles';
import { parseRecovery, RECOVERY_VERSION, stringifyRecovery } from './Recovery';
import type RecoveryDialog from './RecoveryDialog';
import { exportDiagram } from './serialization/exportDiagram';
import type { DiagramFile } from './serialization/format';
import type { ExtensionFields } from './serialization/format';
import { CURRENT_FORMAT_VERSION, FORMAT_NAME } from './serialization/format';
import { importDiagram } from './serialization/importDiagram';
import { parseDiagramFile } from './serialization/parse';
import { stringifyDiagramFile } from './serialization/stringify';
import type UnsavedChangesDialog from './UnsavedChangesDialog';

const EMPTY_FILE: DiagramFile = {
  format: FORMAT_NAME,
  formatVersion: CURRENT_FORMAT_VERSION,
  title: 'Unbenannt',
  elements: [],
  connections: []
};
const RECOVERY_INTERVAL_MS = 60_000;

export default class AppController {
  private readonly canvas: Canvas;
  private readonly commandStack: CommandStack;
  private readonly editorActions: EditorActions;
  private readonly elementFactory: InfraElementFactory;
  private readonly elementRegistry: ElementRegistry;
  private readonly eventBus: EventBus;
  private readonly recentFiles = new RecentFiles();
  private readonly session = new DocumentSession(stringifyDiagramFile(EMPTY_FILE));
  private documentExtensions: ExtensionFields | undefined;
  private allowClose = false;

  constructor(
    private readonly diagram: Diagram,
    private readonly platform: PlatformAdapter,
    private readonly unsavedDialog: UnsavedChangesDialog,
    private readonly recoveryDialog: RecoveryDialog,
    private readonly plantUmlImportDialog: PlantUmlImportDialog,
    private readonly recentContainer: HTMLElement | null
  ) {
    this.canvas = diagram.get('canvas');
    this.commandStack = diagram.get('commandStack');
    this.editorActions = diagram.get('editorActions');
    this.elementFactory = diagram.get('elementFactory');
    this.elementRegistry = diagram.get('elementRegistry');
    this.eventBus = diagram.get('eventBus');
  }

  async start(): Promise<void> {
    importDiagram(this.diagram, EMPTY_FILE);
    this.documentExtensions = undefined;
    this.bindToolbar();
    this.eventBus.on('commandStack.changed', () => this.refreshState());
    await this.platform.onAction((action) => void this.perform(action));
    await this.platform.onOpenPath((path) => void this.openPath(path));
    await this.platform.onCloseRequested(async () => {
      if (this.allowClose) return true;
      const canClose = await this.confirmDiscardChanges();
      if (canClose) {
        this.allowClose = true;
        await this.platform.closeWindow();
      }
      return false;
    });
    await this.offerRecovery();
    window.setInterval(() => void this.persistRecovery(), RECOVERY_INTERVAL_MS);
    this.renderRecentFiles();
    await this.refreshState();
  }

  async perform(action: AppAction): Promise<void> {
    try {
      switch (action) {
        case 'new': await this.newDocument(); break;
        case 'open': await this.open(); break;
        case 'save': await this.save(); break;
        case 'saveAs': await this.saveAs(); break;
        case 'example': await this.openExample(); break;
        case 'undo': this.commandStack.undo(); break;
        case 'redo': this.commandStack.redo(); break;
        case 'fitViewport': this.canvas.zoom('fit-viewport'); break;
        case 'rerouteConnections': this.triggerEditorAction('rerouteConnections'); break;
        case 'cut': this.triggerEditorAction('cut'); break;
        case 'copy': this.triggerEditorAction('copy'); break;
        case 'paste': this.triggerEditorAction('paste'); break;
        case 'delete': this.triggerEditorAction('removeSelection'); break;
        case 'exportSvg': await this.exportSvg(); break;
      }
    } catch (error) {
      await this.platform.showError('Aktion fehlgeschlagen', errorMessage(error));
    }
  }

  private async newDocument(): Promise<void> {
    if (!await this.confirmDiscardChanges()) return;
    importDiagram(this.diagram, EMPTY_FILE);
    this.documentExtensions = undefined;
    this.session.reset(stringifyDiagramFile(EMPTY_FILE), null, 'Unbenannt');
    await this.platform.removeRecovery();
    await this.refreshState();
  }

  private async open(): Promise<void> {
    if (!await this.confirmDiscardChanges()) return;
    const path = await this.platform.pickOpenPath();
    if (path) await this.openPath(path, false);
  }

  private async openPath(path: string, confirm = true): Promise<void> {
    if (confirm && !await this.confirmDiscardChanges()) return;
    try {
      const source = await this.platform.readText(path);
      if (isPlantUmlPath(path)) {
        await this.openPlantUml(path, source);
        return;
      }
      const file = parseDiagramFile(source);
      importDiagram(this.diagram, file);
      this.documentExtensions = file.extensions;
      const snapshot = stringifyDiagramFile(file);
      this.session.reset(snapshot, path, file.title);
      if (this.platform.isDesktop) this.recentFiles.add(path);
      this.renderRecentFiles();
      await this.refreshState();
    } catch (error) {
      if (this.platform.isDesktop) this.recentFiles.remove(path);
      this.renderRecentFiles();
      throw error;
    }
  }

  private async openPlantUml(path: string, source: string): Promise<void> {
    const result = importPlantUml(source);
    if (result.warnings.length && !await this.plantUmlImportDialog.show(result.warnings, result.statistics)) return;

    importDiagram(this.diagram, result.file, { routeConnections: true });
    this.documentExtensions = result.file.extensions;
    const snapshot = stringifyDiagramFile(result.file);
    this.session.reset(stringifyDiagramFile(EMPTY_FILE), null, result.file.title || fileName(path));
    this.session.update(snapshot);
    if (this.platform.isDesktop) this.recentFiles.add(path);
    this.renderRecentFiles();
    await this.refreshState();
  }

  private async save(): Promise<boolean> {
    return this.session.path ? this.saveTo(this.session.path) : this.saveAs();
  }

  private async saveAs(): Promise<boolean> {
    const path = await this.platform.pickSavePath(defaultFileName(this.session.title));
    return path ? this.saveTo(ensureExtension(path)) : false;
  }

  private async saveTo(path: string): Promise<boolean> {
    const snapshot = this.currentSnapshot();
    await this.platform.writeText(path, snapshot);
    this.session.saved(snapshot, path);
    await this.platform.removeRecovery();
    if (this.platform.isDesktop) this.recentFiles.add(path);
    this.renderRecentFiles();
    await this.refreshState();
    return true;
  }

  private async openExample(): Promise<void> {
    if (!await this.confirmDiscardChanges()) return;
    this.diagram.clear();
    this.documentExtensions = undefined;
    this.commandStack.clear();
    createDemo({
      canvas: this.canvas,
      elementFactory: this.elementFactory,
      modeling: this.diagram.get('modeling')
    });
    this.commandStack.clear();
    this.session.reset(stringifyDiagramFile(EMPTY_FILE), null, 'Beispieldiagramm');
    this.session.update(this.currentSnapshot());
    await this.refreshState();
  }

  private async confirmDiscardChanges(): Promise<boolean> {
    if (!this.session.dirty) return true;
    const choice = await this.unsavedDialog.show();
    if (choice === 'cancel') return false;
    if (choice === 'save') return this.save();
    await this.platform.removeRecovery();
    return true;
  }

  private currentSnapshot(): string {
    return stringifyDiagramFile(exportDiagram(
      this.elementRegistry,
      this.session.title,
      this.documentExtensions
    ));
  }

  private async exportSvg(): Promise<void> {
    const exported = await renderSvg(this.canvas, this.elementRegistry);
    const path = await this.platform.pickExportPath(exportFileName(this.session.title));
    if (path) await this.platform.writeText(ensureExportExtension(path), exported.svg);
  }

  private async refreshState(): Promise<void> {
    this.session.update(this.currentSnapshot());
    const displayName = this.session.path ? fileName(this.session.path) : this.session.title;
    await this.platform.setWindowTitle(`${this.session.dirty ? '● ' : ''}${displayName} – InfraModeler`);
    const undo = document.querySelector<HTMLButtonElement>('#undo');
    const redo = document.querySelector<HTMLButtonElement>('#redo');
    if (undo) undo.disabled = !this.commandStack.canUndo();
    if (redo) redo.disabled = !this.commandStack.canRedo();
  }

  private bindToolbar(): void {
    document.querySelectorAll<HTMLElement>('[data-app-action]').forEach((element) => {
      element.addEventListener('click', () => void this.perform(element.dataset.appAction as AppAction));
    });
  }

  private renderRecentFiles(): void {
    if (!this.recentContainer) return;
    this.recentContainer.replaceChildren();
    if (!this.platform.isDesktop) {
      this.recentContainer.hidden = true;
      return;
    }
    for (const path of this.recentFiles.get()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = path;
      button.textContent = fileName(path);
      button.addEventListener('click', () => void this.openPath(path));
      this.recentContainer.append(button);
    }
    this.recentContainer.hidden = !this.recentContainer.childElementCount;
  }

  private triggerEditorAction(action: string): void {
    if (this.editorActions.isRegistered(action)) this.editorActions.trigger(action, undefined);
  }

  private async persistRecovery(): Promise<void> {
    if (!this.session.dirty) return;
    try {
      await this.platform.writeRecovery(stringifyRecovery({
        recoveryVersion: RECOVERY_VERSION,
        originalPath: this.session.path,
        title: this.session.title,
        savedSnapshot: this.session.savedSnapshot,
        currentSnapshot: this.session.currentSnapshot,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Recovery konnte nicht gespeichert werden.', error);
    }
  }

  private async offerRecovery(): Promise<void> {
    const source = await this.platform.readRecovery();
    if (!source) return;
    try {
      const recovery = parseRecovery(source);
      const choice = await this.recoveryDialog.show(recovery.timestamp);
      if (choice === 'discard') {
        await this.platform.removeRecovery();
        return;
      }
      const currentFile = parseDiagramFile(recovery.currentSnapshot);
      importDiagram(this.diagram, currentFile);
      this.documentExtensions = currentFile.extensions;
      this.session.reset(recovery.savedSnapshot, recovery.originalPath, recovery.title);
      this.session.update(recovery.currentSnapshot);
      await this.refreshState();
    } catch (error) {
      await this.platform.removeRecovery();
      await this.platform.showError('Recovery fehlgeschlagen', errorMessage(error));
    }
  }
}

function ensureExtension(path: string): string {
  return path.endsWith('.imod.json') ? path : `${path}.imod.json`;
}

function defaultFileName(title: string): string {
  const base = title === 'Unbenannt' ? 'diagramm' : slugify(title);
  return `${base}.imod.json`;
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function exportFileName(title: string): string {
  const base = title === 'Unbenannt' ? 'diagramm' : slugify(title);
  return `${base}.svg`;
}

function ensureExportExtension(path: string): string {
  return path.toLowerCase().endsWith('.svg') ? path : `${path}.svg`;
}

function slugify(value: string): string {
  return value
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'diagramm';
}
