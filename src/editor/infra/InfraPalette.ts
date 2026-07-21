import type Canvas from 'diagram-js/lib/core/Canvas';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type Create from 'diagram-js/lib/features/create/Create';
import type LassoTool from 'diagram-js/lib/features/lasso-tool/LassoTool';
import type Palette from 'diagram-js/lib/features/palette/Palette';
import type { PaletteEntries } from 'diagram-js/lib/features/palette/PaletteProvider';

import type InfraElementFactory from './InfraElementFactory';
import { PALETTE_TYPES, TYPE_DEFINITIONS, type InfraType } from './meta/types';

export const INFRA_ICONS: Record<InfraType, string> = {
  zone: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2"><rect x="2.5" y="4" width="15" height="12" rx="2"/></svg>',
  server: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7l3-3h11v9l-3 3H3z"/><path d="M3 7h11v9M14 7l3-3"/></svg>',
  syssoft: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8.27,4.05 L8.82,1.68 L11.18,1.68 L11.73,4.05 L12.99,4.57 L15.04,3.28 L16.72,4.96 L15.43,7.01 L15.95,8.27 L18.32,8.82 L18.32,11.18 L15.95,11.73 L15.43,12.99 L16.72,15.04 L15.04,16.72 L12.99,15.43 L11.73,15.95 L11.18,18.32 L8.82,18.32 L8.27,15.95 L7.01,15.43 L4.96,16.72 L3.28,15.04 L4.57,12.99 L4.05,11.73 L1.68,11.18 L1.68,8.82 L4.05,8.27 L4.57,7.01 L3.28,4.96 L4.96,3.28 L7.01,4.57 Z"/><circle cx="10" cy="10" r="2.7"/></svg>',
  module: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="4" width="11" height="12" rx="1.5"/><rect x="3" y="7" width="6" height="3"/><rect x="3" y="12" width="6" height="3"/></svg>',
  db: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="10" cy="5" rx="6" ry="2.5"/><path d="M4 5v10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5"/></svg>',
  esb: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="7" width="16" height="6" rx="3"/><path d="M6 10h8M12 8l2 2-2 2"/></svg>',
  firewall: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="6" y="2" width="8" height="16" rx="1"/><path d="M6 6h8M6 10h8M6 14h8M10 2v4M8 6v4M12 6v4"/></svg>',
  extsys: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="10" cy="10" r="7"/><ellipse cx="10" cy="10" rx="3" ry="7"/><path d="M3 10h14"/></svg>',
  umsystem: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2.5l6.5 3.2v8.6L10 17.5l-6.5-3.2V5.7z"/><path d="M3.5 5.7L10 9l6.5-3.3M10 9v8.5"/></svg>',
  actor: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="4.6" r="2.6"/><path d="M10 7.2v5.2M4.8 9.8h10.4M10 12.4l-3.6 4.8M10 12.4l3.6 4.8"/></svg>',
  note: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 3h9l3 3v11H4z"/><path d="M13 3v3h3"/></svg>'
};

export default class InfraPalette {
  static $inject = ['palette', 'canvas', 'create', 'elementFactory', 'eventBus', 'lassoTool'];

  private activeCreateType: InfraType | null = null;

  constructor(
    palette: Palette,
    private readonly canvas: Canvas,
    private readonly create: Create,
    private readonly elementFactory: InfraElementFactory,
    eventBus: EventBus,
    private readonly lassoTool: LassoTool
  ) {
    palette.registerProvider(this);
    eventBus.on(['create.cancel', 'create.cleanup', 'create.end'], () => this.clearCreateHighlight());
  }

  getPaletteEntries(): PaletteEntries {
    const createEntries = Object.fromEntries(
      PALETTE_TYPES.map((type) => [
        `create.${type}`,
        {
          group: 'create',
          title: `${TYPE_DEFINITIONS[type].title} anlegen`,
          html: `<span class="entry infra-palette-icon">${INFRA_ICONS[type]}</span>`,
          action: {
            dragstart: (event: Event) => this.startCreate(event, type),
            click: (event: Event) => this.startCreate(event, type)
          }
        }
      ])
    );

    return {
      'tool.lasso': {
        group: 'tools',
        title: 'Mehrfachauswahl',
        html: '<span class="entry infra-palette-icon"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"><path d="M3 5h14v10H3z"/><path d="M1.5 1.5v4M1.5 1.5h4M18.5 18.5v-4M18.5 18.5h-4"/></svg></span>',
        action: { click: () => this.lassoTool.toggle() }
      },
      ...createEntries
    };
  }

  private startCreate(event: Event, type: InfraType): void {
    this.setCreateHighlight(type);
    this.create.start(event, this.elementFactory.createInfraShape(type));
  }

  private setCreateHighlight(type: InfraType): void {
    this.clearCreateHighlight();
    this.activeCreateType = type;
    this.getCreateEntry(type)?.classList.add('infra-active-entry');
  }

  private clearCreateHighlight(): void {
    if (!this.activeCreateType) return;
    this.getCreateEntry(this.activeCreateType)?.classList.remove('infra-active-entry');
    this.activeCreateType = null;
  }

  private getCreateEntry(type: InfraType): HTMLElement | null {
    return this.canvas.getContainer().querySelector(`[data-action="create.${type}"]`);
  }
}
