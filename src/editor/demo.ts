import type Canvas from 'diagram-js/lib/core/Canvas';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type { Parent } from 'diagram-js/lib/model/Types';

import type InfraElementFactory from './infra/InfraElementFactory';
import type { InfraShape } from './infra/InfraElementFactory';
import type { InfraType } from './infra/meta/types';

interface DemoServices {
  canvas: Canvas;
  elementFactory: InfraElementFactory;
  modeling: Modeling;
}

interface DemoShape {
  id: string;
  type: InfraType;
  name: string;
  x: number;
  y: number;
  parent?: string;
}

const DEMO_SHAPES: DemoShape[] = [
  { id: 'zone_intranet', type: 'zone', name: 'intranet', x: 90, y: 70 },
  { id: 'server_app', type: 'server', name: 'srv-app-01', x: 108, y: 110, parent: 'zone_intranet' },
  { id: 'runtime_tomcat', type: 'syssoft', name: 'Tomcat 10', x: 124, y: 146, parent: 'server_app' },
  { id: 'module_webshop', type: 'module', name: 'Webshop', x: 138, y: 178, parent: 'runtime_tomcat' },
  { id: 'database_customer', type: 'db', name: 'Kunden-DB', x: 430, y: 90 },
  { id: 'esb_corporate', type: 'esb', name: 'Enterprise Service Bus', x: 420, y: 230 },
  { id: 'external_payment', type: 'extsys', name: 'Payment Provider', x: 730, y: 75 },
  { id: 'system_crm', type: 'umsystem', name: 'CRM', x: 730, y: 180 },
  { id: 'actor_customer', type: 'actor', name: 'Kunde', x: -40, y: 140 },
  { id: 'note_owner', type: 'note', name: 'Betrieb durch Team Webshop', x: 420, y: 330 },
  { id: 'firewall_dmz', type: 'firewall', name: 'FW', x: 660, y: 45 }
];

export function createDemo({ canvas, elementFactory, modeling }: DemoServices): void {
  const root = canvas.getRootElement() as Parent;
  const created = new Map<string, InfraShape>();

  for (const item of DEMO_SHAPES) {
    const parent = item.parent ? created.get(item.parent) : root;
    if (!parent) throw new Error(`Missing demo parent: ${item.parent}`);

    const shape = elementFactory.createInfraShape(item.type, {
      id: item.id,
      businessObject: { type: item.type, name: item.name }
    });
    const position = {
      x: item.x + shape.width / 2,
      y: item.y + shape.height / 2
    };

    created.set(item.id, modeling.createShape(shape, position, parent as Parent) as InfraShape);
  }

  canvas.zoom('fit-viewport');
}
