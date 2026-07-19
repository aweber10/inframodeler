import { describe, expect, it } from 'vitest';

import UpdateTextHandler from '../src/editor/infra/commands/UpdateTextHandler';
import type { InfraShape } from '../src/editor/infra/InfraElementFactory';

describe('system software text fitting', () => {
  it('grows the shape to keep the complete title visible', () => {
    const shape = {
      id: 'syssoft_1',
      x: 0,
      y: 0,
      width: 200,
      height: 95,
      children: [],
      businessObject: { type: 'syssoft', name: 'Tomcat 10' }
    } as unknown as InfraShape;
    const modeling = {
      resizeShape(element: InfraShape, bounds: { width: number; height: number }) {
        element.width = bounds.width;
        element.height = bounds.height;
      }
    };
    const handler = new UpdateTextHandler(modeling as never);
    const context = {
      element: shape,
      value: 'WebSphere Liberty Production Runtime With A Long Name'
    };
    handler.execute(context);
    handler.postExecute(context);

    expect(shape.width).toBeGreaterThan(350);
    expect(shape.businessObject.name).toBe('WebSphere Liberty Production Runtime With A Long Name');
  });
});
