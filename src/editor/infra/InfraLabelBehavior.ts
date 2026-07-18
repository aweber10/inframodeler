import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Element } from 'diagram-js/lib/model/Types';

import type { InfraConnection } from './InfraElementFactory';
import { getDefaultEdgeLabel } from './meta/edgeDefaults';
import { isInfraType } from './meta/types';

interface CreateConnectionContext {
  connection: InfraConnection;
  source: Element;
  target: Element;
}

export default class InfraLabelBehavior extends CommandInterceptor {
  static override $inject = ['eventBus'];

  constructor(eventBus: EventBus) {
    super(eventBus);

    this.preExecute('connection.create', ({ context }: { context: CreateConnectionContext }) => {
      const { connection, source, target } = context;
      const sourceType = source.businessObject?.type;
      const targetType = target.businessObject?.type;
      const businessObject = connection.businessObject;

      if (!isInfraType(sourceType) || !isInfraType(targetType) || !businessObject) return;

      businessObject.kind = sourceType === 'note' || targetType === 'note'
        ? 'noteAttachment'
        : 'communication';

      if (businessObject.label === undefined) {
        businessObject.label = getDefaultEdgeLabel(sourceType, targetType);
      }
    });
  }
}
