import Diagram from 'diagram-js';
import CreateModule from 'diagram-js/lib/features/create';
import EditorActionsModule from 'diagram-js/lib/features/editor-actions';
import KeyboardModule from 'diagram-js/lib/features/keyboard';
import ModelingModule from 'diagram-js/lib/features/modeling';
import MoveModule from 'diagram-js/lib/features/move';
import PaletteModule from 'diagram-js/lib/features/palette';
import MoveCanvasModule from 'diagram-js/lib/navigation/movecanvas';
import ZoomScrollModule from 'diagram-js/lib/navigation/zoomscroll';

import InfraCoreModule from './infra';

export function createInfraModeler(container: HTMLElement): Diagram {
  return new Diagram({
    canvas: { container },
    modules: [
      ModelingModule,
      MoveModule,
      CreateModule,
      PaletteModule,
      EditorActionsModule,
      KeyboardModule,
      MoveCanvasModule,
      ZoomScrollModule,
      InfraCoreModule
    ]
  });
}
