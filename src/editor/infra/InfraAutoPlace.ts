import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type { Parent, Shape } from 'diagram-js/lib/model/Types';
import type { Point } from 'diagram-js/lib/util/Types';

import type InfraElementFactory from './InfraElementFactory';
import type { InfraConnection, InfraShape } from './InfraElementFactory';
import type { AppendAction } from './meta/contextPad';
import { CONTAINER_PADDING, isInfraType } from './meta/types';

const BESIDE_GAP = 90;
const COLLISION_STEP = 64;
const MAX_COLLISION_ATTEMPTS = 24;

export default class InfraAutoPlace {
  static $inject = ['elementFactory', 'elementRegistry', 'modeling'];

  constructor(
    private readonly elementFactory: InfraElementFactory,
    private readonly elementRegistry: ElementRegistry,
    private readonly modeling: Modeling
  ) {}

  append(source: InfraShape, action: AppendAction): InfraShape {
    const shape = this.elementFactory.createInfraShape(action.type);

    if (action.placement === 'inside') {
      return this.modeling.createShape(
        shape,
        getInsidePosition(source, shape),
        source
      ) as InfraShape;
    }

    if (action.label === undefined) {
      return this.modeling.createShape(
        shape,
        this.getBesidePosition(source, shape),
        source.parent as Parent
      ) as InfraShape;
    }

    const connection = this.elementFactory.createInfraConnection({}, {
      kind: action.type === 'note' ? 'noteAttachment' : 'communication',
      label: action.label
    });

    return this.modeling.appendShape(
      source,
      shape,
      this.getBesidePosition(source, shape),
      source.parent as Parent,
      { connection }
    ) as InfraShape;
  }

  private getBesidePosition(source: Shape, shape: Shape): Point {
    const x = source.x + source.width + BESIDE_GAP + shape.width / 2;
    let y = source.y + source.height / 2;

    for (let attempt = 0; attempt < MAX_COLLISION_ATTEMPTS; attempt += 1) {
      const bounds = {
        x: x - shape.width / 2,
        y: y - shape.height / 2,
        width: shape.width,
        height: shape.height
      };
      const collision = this.elementRegistry.getAll().some((element) =>
        isLeafShape(element) && overlaps(bounds, element)
      );
      if (!collision) break;
      y += COLLISION_STEP;
    }

    return { x, y };
  }
}

export function getInsidePosition(parent: InfraShape, child: Shape): Point {
  const type = parent.businessObject.type;
  if (!(type in CONTAINER_PADDING)) {
    return { x: parent.x + child.width / 2, y: parent.y + child.height / 2 };
  }

  const padding = CONTAINER_PADDING[type as keyof typeof CONTAINER_PADDING];
  const children = parent.children.filter(isShape).filter((element) => !element.labelTarget);
  const left = children.length
    ? children.reduce((current, candidate) =>
      candidate.y + candidate.height > current.y + current.height ? candidate : current
    ).x
    : parent.x + padding.side;
  const top = children.length
    ? Math.max(...children.map((element) => element.y + element.height)) + 12
    : parent.y + padding.top;

  return { x: left + child.width / 2, y: top + child.height / 2 };
}

function isShape(element: unknown): element is Shape {
  return Boolean(element && typeof element === 'object' && 'width' in element && 'height' in element);
}

function isLeafShape(element: unknown): element is Shape {
  if (!isShape(element)) return false;
  const type = element.businessObject?.type;
  return isInfraType(type) && !(type in CONTAINER_PADDING);
}

function overlaps(a: Pick<Shape, 'x' | 'y' | 'width' | 'height'>, b: Shape): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

export type { InfraConnection };
