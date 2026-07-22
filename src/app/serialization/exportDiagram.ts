import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { Connection, Element, Shape } from 'diagram-js/lib/model/Types';

import type { InfraConnection, InfraShape } from '../../editor/infra/InfraElementFactory';
import { isInfraType } from '../../editor/infra/meta/types';
import {
  CURRENT_FORMAT_VERSION,
  FORMAT_NAME,
  type DiagramConnectionRecord,
  type DiagramElementRecord,
  type DiagramFile,
  type ExtensionFields
} from './format';

export function exportDiagram(
  elementRegistry: ElementRegistry,
  title: string,
  extensions?: ExtensionFields
): DiagramFile {
  const elements: DiagramElementRecord[] = [];
  const connections: DiagramConnectionRecord[] = [];

  for (const rawElement of elementRegistry.getAll() as Element[]) {
    if (isConnection(rawElement)) {
      const connection = rawElement as InfraConnection;
      if (!connection.source || !connection.target || !connection.businessObject?.kind) continue;
      connections.push({
        id: connection.id,
        source: connection.source.id,
        target: connection.target.id,
        kind: connection.businessObject.kind,
        label: connection.businessObject.label ?? '',
        pinnedRouting: connection.businessObject.pinnedRouting ?? false,
        labelPosition: connection.businessObject.labelPosition,
        waypoints: connection.waypoints.map((point, index) => ({
          x: point.x,
          y: point.y,
          extensions: connection.businessObject.waypointExtensions?.[index]
        })),
        extensions: connection.businessObject.extensions
      });
      continue;
    }

    const shape = rawElement as InfraShape;
    if (!isInfraType(shape.businessObject?.type)) continue;
    elements.push({
      id: shape.id,
      type: shape.businessObject.type,
      name: shape.businessObject.name,
      ...(isInfraShape(shape.parent) ? { parent: shape.parent.id } : {}),
      x: shape.x,
      y: shape.y,
      w: shape.width,
      h: shape.height,
      extensions: shape.businessObject.extensions
    });
  }

  return {
    format: FORMAT_NAME,
    formatVersion: CURRENT_FORMAT_VERSION,
    title,
    elements,
    connections,
    extensions
  };
}

function isConnection(element: Element): element is Connection {
  return 'waypoints' in element;
}

function isInfraShape(element: Element | undefined): element is Shape {
  return Boolean(element && isInfraType(element.businessObject?.type));
}
