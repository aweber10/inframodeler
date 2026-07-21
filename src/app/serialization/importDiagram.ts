import type Diagram from 'diagram-js';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import type { Parent } from 'diagram-js/lib/model/Types';

import type InfraElementFactory from '../../editor/infra/InfraElementFactory';
import type { InfraShape } from '../../editor/infra/InfraElementFactory';
import type { DiagramFile } from './format';
import { normalizeDocking } from '../../editor/infra/InfraLayouter';

export function importDiagram(diagram: Diagram, file: DiagramFile): void {
  diagram.clear();

  const canvas = diagram.get<Canvas>('canvas');
  const commandStack = diagram.get<CommandStack>('commandStack');
  const elementFactory = diagram.get<InfraElementFactory>('elementFactory');
  const elementRegistry = diagram.get<ElementRegistry>('elementRegistry');
  const modeling = diagram.get<Modeling>('modeling');
  const selection = diagram.get<Selection>('selection');
  const root = canvas.getRootElement() as Parent;
  const pending = new Map(file.elements.map((element) => [element.id, element]));
  const created = new Map<string, InfraShape>();

  for (const { id } of file.elements) elementFactory.reserveId(id);
  for (const { id } of file.connections) elementFactory.reserveId(id);

  while (pending.size) {
    let progress = false;
    for (const [id, record] of pending) {
      const parent = record.parent ? created.get(record.parent) : root;
      if (!parent) continue;

      const shape = elementFactory.createInfraShape(record.type, {
        id,
        width: record.w,
        height: record.h,
        businessObject: {
          type: record.type,
          name: record.name,
          extensions: record.extensions
        }
      });
      const createdShape = modeling.createShape(
        shape,
        { x: record.x + record.w / 2, y: record.y + record.h / 2 },
        parent,
        { autoResize: false }
      ) as InfraShape;
      created.set(id, createdShape);
      pending.delete(id);
      progress = true;
    }
    if (!progress) throw new Error('Elementhierarchie konnte nicht aufgebaut werden.');
  }

  for (const record of file.connections) {
    const source = created.get(record.source)!;
    const target = created.get(record.target)!;
    const connection = elementFactory.createInfraConnection({
      id: record.id,
      waypoints: record.waypoints.map(({ x, y }) => ({ x, y }))
    }, {
      kind: record.kind,
      label: record.label,
      extensions: record.extensions,
      waypointExtensions: record.waypoints.map(({ extensions }) => extensions)
    });
    const createdConnection = modeling.connect(source, target, connection);
    modeling.updateWaypoints(createdConnection, normalizeDocking(createdConnection, elementRegistry));
  }

  selection.select([]);
  commandStack.clear();
  canvas.zoom('fit-viewport');
}
