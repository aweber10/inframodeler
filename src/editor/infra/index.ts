import InfraElementFactory from './InfraElementFactory';
import InfraPalette from './InfraPalette';
import InfraRenderer from './InfraRenderer';
import InfraRules from './InfraRules';

export default {
  __init__: ['infraRenderer', 'infraRules', 'infraPalette'],
  elementFactory: ['type', InfraElementFactory],
  infraRenderer: ['type', InfraRenderer],
  infraRules: ['type', InfraRules],
  infraPalette: ['type', InfraPalette]
};
