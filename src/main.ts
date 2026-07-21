import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import 'diagram-js/assets/diagram-js.css';
import './styles.css';

import AppController from './app/AppController';
import EmptyCanvasHelp from './app/EmptyCanvasHelp';
import BrowserPlatform from './app/platform/BrowserPlatform';
import type { PlatformAdapter } from './app/platform/PlatformAdapter';
import PlantUmlImportDialog from './app/PlantUmlImportDialog';
import RecoveryDialog from './app/RecoveryDialog';
import UnsavedChangesDialog from './app/UnsavedChangesDialog';
import { createInfraModeler } from './editor/InfraModeler';

async function bootstrap(): Promise<void> {
  const container = document.querySelector<HTMLElement>('#canvas');
  if (!container) throw new Error('Editor container not found.');

  const diagram = createInfraModeler(container);
  const emptyHelp = document.querySelector<HTMLElement>('#empty-canvas-help');
  if (!emptyHelp) throw new Error('Empty canvas help not found.');
  new EmptyCanvasHelp(diagram.get('elementRegistry'), emptyHelp, diagram.get('eventBus'));
  const dialog = document.querySelector<HTMLDialogElement>('#unsaved-dialog');
  if (!dialog) throw new Error('Unsaved changes dialog not found.');
  const recoveryDialog = document.querySelector<HTMLDialogElement>('#recovery-dialog');
  if (!recoveryDialog) throw new Error('Recovery dialog not found.');
  const plantUmlDialog = document.querySelector<HTMLDialogElement>('#plantuml-import-dialog');
  if (!plantUmlDialog) throw new Error('PlantUML import dialog not found.');

  const platform: PlatformAdapter = window.__TAURI_INTERNALS__
    ? new (await import('./app/platform/TauriPlatform')).default()
    : new BrowserPlatform();

  const controller = new AppController(
    diagram,
    platform,
    new UnsavedChangesDialog(dialog),
    new RecoveryDialog(recoveryDialog),
    new PlantUmlImportDialog(plantUmlDialog),
    document.querySelector('#recent-files')
  );
  await controller.start();
}

void bootstrap();
