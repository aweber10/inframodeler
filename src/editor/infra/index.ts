import InfraAutoPlace from './InfraAutoPlace';
import InfraAutoResize from './InfraAutoResize';
import InfraAutoResizeProvider from './InfraAutoResizeProvider';
import InfraCommandHandlers from './InfraCommandHandlers';
import InfraConnectionParentBehavior from './InfraConnectionParentBehavior';
import InfraContextPad from './InfraContextPad';
import InfraCopyPasteBehavior from './InfraCopyPasteBehavior';
import InfraDirectEditing from './InfraDirectEditing';
import InfraElementFactory from './InfraElementFactory';
import InfraFitBehavior from './InfraFitBehavior';
import InfraLabelBehavior from './InfraLabelBehavior';
import InfraLayouter from './InfraLayouter';
import InfraPalette from './InfraPalette';
import InfraRenderer from './InfraRenderer';
import InfraResizeBehavior from './InfraResizeBehavior';
import InfraRoutingBehavior from './InfraRoutingBehavior';
import InfraRules from './InfraRules';

export default {
  __init__: [
    'infraRenderer',
    'infraRules',
    'infraPalette',
    'infraLabelBehavior',
    'infraAutoResizeProvider',
    'infraCommandHandlers',
    'infraCopyPasteBehavior',
    'infraConnectionParentBehavior',
    'infraFitBehavior',
    'infraResizeBehavior',
    'infraRoutingBehavior',
    'infraDirectEditing',
    'infraContextPad'
  ],
  elementFactory: ['type', InfraElementFactory],
  infraRenderer: ['type', InfraRenderer],
  infraRules: ['type', InfraRules],
  infraPalette: ['type', InfraPalette],
  infraLabelBehavior: ['type', InfraLabelBehavior],
  infraAutoPlace: ['type', InfraAutoPlace],
  autoResize: ['type', InfraAutoResize],
  infraAutoResizeProvider: ['type', InfraAutoResizeProvider],
  infraCommandHandlers: ['type', InfraCommandHandlers],
  infraCopyPasteBehavior: ['type', InfraCopyPasteBehavior],
  infraConnectionParentBehavior: ['type', InfraConnectionParentBehavior],
  infraFitBehavior: ['type', InfraFitBehavior],
  infraResizeBehavior: ['type', InfraResizeBehavior],
  infraRoutingBehavior: ['type', InfraRoutingBehavior],
  infraDirectEditing: ['type', InfraDirectEditing],
  infraContextPad: ['type', InfraContextPad],
  connectionDocking: ['type', CroppingConnectionDocking],
  layouter: ['type', InfraLayouter]
};
import CroppingConnectionDocking from 'diagram-js/lib/layout/CroppingConnectionDocking';
