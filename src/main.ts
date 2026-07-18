import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import 'diagram-js/assets/diagram-js.css';
import './styles.css';

import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';

import { createDemo } from './editor/demo';
import { createInfraModeler } from './editor/InfraModeler';
import type InfraElementFactory from './editor/infra/InfraElementFactory';

const container = document.querySelector<HTMLElement>('#canvas');
if (!container) throw new Error('Editor container not found.');

const diagram = createInfraModeler(container);
const canvas = diagram.get<Canvas>('canvas');
const commandStack = diagram.get<CommandStack>('commandStack');
const elementFactory = diagram.get<InfraElementFactory>('elementFactory');
const eventBus = diagram.get<EventBus>('eventBus');
const modeling = diagram.get<Modeling>('modeling');

const undoButton = document.querySelector<HTMLButtonElement>('#undo');
const redoButton = document.querySelector<HTMLButtonElement>('#redo');
const resetButton = document.querySelector<HTMLButtonElement>('#reset-demo');

function updateHistoryButtons(): void {
  if (undoButton) undoButton.disabled = !commandStack.canUndo();
  if (redoButton) redoButton.disabled = !commandStack.canRedo();
}

function resetDemo(): void {
  diagram.clear();
  commandStack.clear();
  createDemo({ canvas, elementFactory, modeling });
  commandStack.clear();
  updateHistoryButtons();
}

undoButton?.addEventListener('click', () => commandStack.undo());
redoButton?.addEventListener('click', () => commandStack.redo());
resetButton?.addEventListener('click', resetDemo);
eventBus.on('commandStack.changed', updateHistoryButtons);

resetDemo();
