import type ContextPad from 'diagram-js/lib/features/context-pad/ContextPad';
import type { ContextPadEntries } from 'diagram-js/lib/features/context-pad/ContextPadProvider';
import type Connect from 'diagram-js/lib/features/connect/Connect';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type { Element } from 'diagram-js/lib/model/Types';

import type InfraAutoPlace from './InfraAutoPlace';
import type { InfraConnection, InfraShape } from './InfraElementFactory';
import { INFRA_ICONS } from './InfraPalette';
import { CONTEXT_PAD_ACTIONS, type AppendAction } from './meta/contextPad';
import { isInfraType } from './meta/types';

const ACTION_ICONS = {
  connect: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 16L15 5M15 5h-5M15 5v5"/></svg>',
  edit: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13.5 3.5l3 3L7 16l-4 1 1-4z"/></svg>',
  trash: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3.5 5.5h13M8 5.5V3.8h4v1.7M5.5 5.5l1 11h7l1-11M8.4 8.5v5M11.6 8.5v5"/></svg>'
};

interface DirectEditing {
  activate(element: Element): boolean;
}

export default class InfraContextPad {
  static $inject = ['contextPad', 'connect', 'directEditing', 'infraAutoPlace', 'modeling'];

  constructor(
    contextPad: ContextPad,
    private readonly connect: Connect,
    private readonly directEditing: DirectEditing,
    private readonly autoPlace: InfraAutoPlace,
    private readonly modeling: Modeling
  ) {
    contextPad.registerProvider(this);
  }

  getContextPadEntries(element: Element): ContextPadEntries {
    if (isConnection(element)) return this.getConnectionEntries(element);

    const shape = element as InfraShape;
    const type = shape.businessObject?.type;
    if (!isInfraType(type)) return {};

    const entries: ContextPadEntries = {};
    for (const action of CONTEXT_PAD_ACTIONS[type] ?? []) {
      entries[`append.${action.type}`] = this.appendEntry(shape, action);
    }

    if (type !== 'note') {
      const noteAction: AppendAction = {
        type: 'note',
        placement: 'beside',
        title: 'Notiz anheften',
        label: ''
      };
      entries['append.note'] = this.appendEntry(shape, noteAction);
    }

    entries.connect = {
      group: 'edit',
      title: 'Verbinden - Ziel ziehen',
      html: icon(ACTION_ICONS.connect),
      action: {
        click: (event: Event) => this.connect.start(event as MouseEvent, shape),
        dragstart: (event: Event) => this.connect.start(event as MouseEvent, shape)
      }
    };
    entries.edit = {
      group: 'edit',
      title: 'Umbenennen',
      html: icon(ACTION_ICONS.edit),
      action: { click: () => this.directEditing.activate(shape) }
    };
    entries.delete = this.deleteEntry(shape);

    return entries;
  }

  private appendEntry(shape: InfraShape, action: AppendAction) {
    return {
      group: 'append',
      title: action.title,
      html: icon(INFRA_ICONS[action.type]),
      action: { click: () => this.autoPlace.append(shape, action) }
    };
  }

  private getConnectionEntries(connection: InfraConnection): ContextPadEntries {
    return {
      edit: {
        group: 'edit',
        title: 'Beschriftung ändern',
        html: icon(ACTION_ICONS.edit),
        action: { click: () => this.directEditing.activate(connection) }
      },
      delete: this.deleteEntry(connection)
    };
  }

  private deleteEntry(element: Element) {
    return {
      group: 'edit',
      title: 'Löschen (Entf)',
      html: icon(ACTION_ICONS.trash, 'danger'),
      action: { click: () => this.modeling.removeElements([element]) }
    };
  }
}

function icon(svg: string, extraClass = ''): string {
  return `<span class="entry infra-context-icon ${extraClass}">${svg}</span>`;
}

function isConnection(element: Element): element is InfraConnection {
  return Array.isArray((element as InfraConnection).waypoints);
}
