import Diagram from 'diagram-js';
import AutoResizeModule from 'diagram-js/lib/features/auto-resize';
import BendpointsModule from 'diagram-js/lib/features/bendpoints';
import ConnectModule from 'diagram-js/lib/features/connect';
import ContextPadModule from 'diagram-js/lib/features/context-pad';
import CopyPasteModule from 'diagram-js/lib/features/copy-paste';
import CreateModule from 'diagram-js/lib/features/create';
import EditorActionsModule from 'diagram-js/lib/features/editor-actions';
import KeyboardModule from 'diagram-js/lib/features/keyboard';
import LassoToolModule from 'diagram-js/lib/features/lasso-tool';
import ModelingModule from 'diagram-js/lib/features/modeling';
import MoveModule from 'diagram-js/lib/features/move';
import PaletteModule from 'diagram-js/lib/features/palette';
import SnappingModule from 'diagram-js/lib/features/snapping';
import MoveCanvasModule from 'diagram-js/lib/navigation/movecanvas';
import ZoomScrollModule from 'diagram-js/lib/navigation/zoomscroll';
import DirectEditingModule from 'diagram-js-direct-editing';

import InfraCoreModule from './infra';

export function createInfraModeler(container: HTMLElement): Diagram {
  return new Diagram({
    canvas: { container },
    modules: [
      ModelingModule,
      MoveModule,
      CreateModule,
      ConnectModule,
      ContextPadModule,
      AutoResizeModule,
      BendpointsModule,
      SnappingModule,
      LassoToolModule,
      CopyPasteModule,
      DirectEditingModule,
      PaletteModule,
      EditorActionsModule,
      KeyboardModule,
      MoveCanvasModule,
      ZoomScrollModule,
      InfraCoreModule
    ]
  });
}
