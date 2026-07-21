import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type CroppingConnectionDocking from 'diagram-js/lib/layout/CroppingConnectionDocking';
import type { Connection, Element, Shape } from 'diagram-js/lib/model/Types';
import { append, attr, create } from 'tiny-svg';

import type { InfraConnection, InfraShape } from './InfraElementFactory';
import { isInfraType } from './meta/types';

const FONT = '"JetBrains Mono", monospace';
const SANS = 'Inter, sans-serif';
const PRIORITY = 1500;
const ARROW_MARKER_ID = 'infra-arrow';
const GEAR_PATH = 'M8.27,4.05 L8.82,1.68 L11.18,1.68 L11.73,4.05 L12.99,4.57 L15.04,3.28 L16.72,4.96 L15.43,7.01 L15.95,8.27 L18.32,8.82 L18.32,11.18 L15.95,11.73 L15.43,12.99 L16.72,15.04 L15.04,16.72 L12.99,15.43 L11.73,15.95 L11.18,18.32 L8.82,18.32 L8.27,15.95 L7.01,15.43 L4.96,16.72 L3.28,15.04 L4.57,12.99 L4.05,11.73 L1.68,11.18 L1.68,8.82 L4.05,8.27 L4.57,7.01 L3.28,4.96 L4.96,3.28 L7.01,4.57 Z';

function svg(
  parent: SVGElement,
  tag: string,
  attributes: Record<string, string | number>,
  text?: string
): SVGElement {
  const element = create(tag);
  attr(element, attributes);
  if (text !== undefined) element.textContent = text;
  append(parent, element);
  return element;
}

function wrapText(text: string, maxCharacters: number): string[] {
  const lines: string[] = [];
  let current = '';

  for (const word of text.split(/\s+/)) {
    if (`${current} ${word}`.trim().length > maxCharacters && current) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export default class InfraRenderer extends BaseRenderer {
  static $inject = ['eventBus', 'connectionDocking'];

  constructor(eventBus: EventBus, private readonly connectionDocking: CroppingConnectionDocking) {
    super(eventBus, PRIORITY);
  }

  override canRender(element: Element): boolean {
    return isInfraType(element.businessObject?.type) || isInfraConnection(element);
  }

  override drawShape(parent: SVGElement, rawShape: Shape): SVGElement {
    const shape = rawShape as InfraShape;
    const { width: w, height: h } = shape;
    const { type, name } = shape.businessObject;

    switch (type) {
      case 'zone':
        svg(parent, 'rect', { width: w, height: h, rx: 10, fill: '#eef2f6', 'fill-opacity': 0.55, stroke: '#8da2b5', 'stroke-width': 1.4, 'stroke-dasharray': '6 4' });
        svg(parent, 'text', { x: 14, y: 22, 'font-family': FONT, 'font-size': 11.5, 'letter-spacing': '0.14em', fill: '#52606d' }, `ZONE  ${name.toUpperCase()}`);
        break;
      case 'server': {
        const depth = 12;
        svg(parent, 'polygon', { points: `0,${depth} ${depth},0 ${w},0 ${w - depth},${depth}`, fill: '#e4e7eb', stroke: '#52606d', 'stroke-width': 1.4, 'stroke-linejoin': 'round' });
        svg(parent, 'polygon', { points: `${w - depth},${depth} ${w},0 ${w},${h - depth} ${w - depth},${h}`, fill: '#d5dade', stroke: '#52606d', 'stroke-width': 1.4, 'stroke-linejoin': 'round' });
        svg(parent, 'rect', { y: depth, width: w - depth, height: h - depth, fill: '#fff', stroke: '#52606d', 'stroke-width': 1.4 });
        svg(parent, 'text', { x: 12, y: depth + 18, 'font-family': FONT, 'font-size': 12, 'font-weight': 600, fill: '#1f2933' }, `NODE  ${name}`);
        break;
      }
      case 'syssoft':
        svg(parent, 'rect', { width: w, height: h, rx: 6, fill: '#f5f7fa', stroke: '#616e7c', 'stroke-width': 1.3 });
        {
          const gear = svg(parent, 'g', { transform: 'translate(7, 6) scale(1.1)' }) as SVGGElement;
          svg(gear, 'path', { d: GEAR_PATH, fill: 'none', stroke: '#3e4c59', 'stroke-width': 1.1, 'stroke-linejoin': 'round' });
          svg(gear, 'circle', { cx: 10, cy: 10, r: 2.7, fill: 'none', stroke: '#3e4c59', 'stroke-width': 1.1 });
        }
        svg(parent, 'text', { x: 32, y: 21, 'font-family': FONT, 'font-size': 11.5, fill: '#3e4c59' }, name);
        break;
      case 'module':
        svg(parent, 'rect', { width: w, height: h, rx: 5, fill: '#e6f4f1', stroke: '#0f766e', 'stroke-width': 1.4 });
        svg(parent, 'rect', { x: 8, y: h / 2 - 7, width: 10, height: 14, rx: 1.5, fill: 'none', stroke: '#0f766e', 'stroke-width': 1.2 });
        svg(parent, 'rect', { x: 5, y: h / 2 - 5, width: 6, height: 3.5, fill: '#e6f4f1', stroke: '#0f766e', 'stroke-width': 1.1 });
        svg(parent, 'rect', { x: 5, y: h / 2 + 1.5, width: 6, height: 3.5, fill: '#e6f4f1', stroke: '#0f766e', 'stroke-width': 1.1 });
        svg(parent, 'text', { x: w / 2 + 9, y: h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': SANS, 'font-size': 12.5, 'font-weight': 500, fill: '#134e4a' }, name);
        break;
      case 'db': {
        const radiusX = w / 2;
        const radiusY = 12;
        svg(parent, 'path', { d: `M0,${radiusY} A${radiusX},${radiusY} 0 0 1 ${w},${radiusY} V${h - radiusY} A${radiusX},${radiusY} 0 0 1 0,${h - radiusY} Z`, fill: '#fef3c7', stroke: '#b45309', 'stroke-width': 1.4 });
        svg(parent, 'ellipse', { cx: radiusX, cy: radiusY, rx: radiusX, ry: radiusY, fill: '#fde68a', stroke: '#b45309', 'stroke-width': 1.4 });
        svg(parent, 'text', { x: radiusX, y: h / 2 + radiusY / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': SANS, 'font-size': 12.5, 'font-weight': 500, fill: '#78350f' }, name);
        break;
      }
      case 'esb':
        svg(parent, 'rect', { width: w, height: h, rx: h / 2, fill: '#ede9fe', stroke: '#6d28d9', 'stroke-width': 1.5 });
        svg(parent, 'path', { d: `M16,${h / 2} H${w - 16} M${w - 24},${h / 2 - 6} L${w - 16},${h / 2} L${w - 24},${h / 2 + 6} M24,${h / 2 - 6} L16,${h / 2} L24,${h / 2 + 6}`, fill: 'none', stroke: '#6d28d9', 'stroke-width': 1.2, opacity: 0.45 });
        svg(parent, 'text', { x: w / 2, y: h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': SANS, 'font-size': 12.5, 'font-weight': 600, fill: '#4c1d95' }, name);
        break;
      case 'extsys': {
        svg(parent, 'rect', { width: w, height: h, rx: 9, fill: '#f1f2f4', stroke: '#9aa5b1', 'stroke-width': 1.4, 'stroke-dasharray': '5 3' });
        const cx = 22;
        const cy = h / 2;
        svg(parent, 'circle', { cx, cy, r: 10, fill: '#fff', stroke: '#7b8794', 'stroke-width': 1.2 });
        svg(parent, 'ellipse', { cx, cy, rx: 4.2, ry: 10, fill: 'none', stroke: '#7b8794', 'stroke-width': 1 });
        svg(parent, 'line', { x1: 12, y1: cy, x2: 32, y2: cy, stroke: '#7b8794', 'stroke-width': 1 });
        svg(parent, 'text', { x: (w + 34) / 2, y: h / 2 - 9, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT, 'font-size': 10, 'letter-spacing': '0.08em', fill: '#7b8794' }, '«extern»');
        svg(parent, 'text', { x: (w + 34) / 2, y: h / 2 + 9, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': SANS, 'font-size': 12.5, 'font-weight': 500, fill: '#3e4c59' }, name);
        break;
      }
      case 'umsystem':
        svg(parent, 'rect', { width: w, height: h, rx: 9, fill: '#eceff3', stroke: '#7b8794', 'stroke-width': 1.4 });
        svg(parent, 'path', { d: 'M21,22 l8,4 v10 l-8,4 l-8,-4 v-10 z M13,26 l8,4 l8,-4 M21,30 v10', fill: '#fff', stroke: '#7b8794', 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
        svg(parent, 'text', { x: (w + 34) / 2, y: h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': SANS, 'font-size': 12.5, 'font-weight': 500, fill: '#3e4c59' }, name);
        break;
      case 'actor': {
        const cx = w / 2;
        svg(parent, 'rect', { width: w, height: h, fill: 'transparent' });
        svg(parent, 'circle', { cx, cy: 11, r: 7.5, fill: '#fff', stroke: '#3e4c59', 'stroke-width': 1.6 });
        svg(parent, 'path', { d: `M${cx},18.5 V42 M${cx - 14},27 H${cx + 14} M${cx},42 L${cx - 12},60 M${cx},42 L${cx + 12},60`, fill: 'none', stroke: '#3e4c59', 'stroke-width': 1.6, 'stroke-linecap': 'round' });
        svg(parent, 'text', { x: cx, y: h - 6, 'text-anchor': 'middle', 'font-family': SANS, 'font-size': 12, 'font-weight': 500, fill: '#1f2933' }, name);
        break;
      }
      case 'note': {
        const fold = 13;
        const lines = wrapText(name, 27);
        svg(parent, 'path', { d: `M0,0 H${w - fold} L${w},${fold} V${h} H0 Z`, fill: '#fefce8', stroke: '#a8a29e', 'stroke-width': 1.2 });
        svg(parent, 'path', { d: `M${w - fold},0 V${fold} H${w}`, fill: '#f5f0d8', stroke: '#a8a29e', 'stroke-width': 1.2 });
        lines.forEach((line, index) => svg(parent, 'text', { x: 12, y: 22 + index * 16, 'font-family': SANS, 'font-size': 11.5, fill: '#57534e' }, line));
        break;
      }
      case 'firewall':
        svg(parent, 'rect', { width: w, height: h, rx: 3, fill: '#ffedd5', stroke: '#ea580c', 'stroke-width': 1.4 });
        for (let y = 14; y < h; y += 14) svg(parent, 'line', { x1: 0, y1: y, x2: w, y2: y, stroke: '#ea580c', 'stroke-width': 1, opacity: 0.6 });
        for (let y = 0, index = 0; y < h; y += 14, index += 1) {
          const x = index % 2 ? w * 0.33 : w * 0.66;
          svg(parent, 'line', { x1: x, y1: y, x2: x, y2: Math.min(y + 14, h), stroke: '#ea580c', 'stroke-width': 1, opacity: 0.6 });
        }
        svg(parent, 'text', { x: w / 2, y: h + 16, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': 10.5, 'letter-spacing': '0.1em', fill: '#9a3412' }, name.toUpperCase());
        break;
    }

    return parent.firstElementChild as SVGElement;
  }

  override drawConnection(parent: SVGElement, rawConnection: Connection): SVGElement {
    const connection = rawConnection as InfraConnection;
    const visibleWaypoints = this.connectionDocking.getCroppedWaypoints(connection, connection.source, connection.target);
    const pathData = connectionPath(visibleWaypoints, false);
    const noteAttachment = connection.businessObject.kind === 'noteAttachment';
    const path = svg(parent, 'path', {
      d: pathData,
      fill: 'none',
      stroke: '#52606d',
      'stroke-width': 1.5,
      ...(noteAttachment
        ? { 'stroke-dasharray': '4 3' }
        : { 'marker-end': `url(#${ARROW_MARKER_ID})` })
    });

    if (!noteAttachment) this.ensureArrowMarker(parent.ownerSVGElement);

    const label = connection.businessObject.label;
    if (label) this.drawConnectionLabel(parent, visibleWaypoints, label);

    return path;
  }

  override getShapePath(shape: Shape): string {
    return `M${shape.x},${shape.y} h${shape.width} v${shape.height} h-${shape.width} z`;
  }

  override getConnectionPath(connection: Connection): string {
    return connectionPath(connection.waypoints, true);
  }

  private ensureArrowMarker(ownerSvg: SVGSVGElement | null): void {
    if (!ownerSvg || ownerSvg.querySelector(`#${ARROW_MARKER_ID}`)) return;
    let defs = ownerSvg.querySelector('defs');
    if (!defs) defs = svg(ownerSvg, 'defs', {}) as SVGDefsElement;
    const marker = svg(defs, 'marker', {
      id: ARROW_MARKER_ID,
      viewBox: '0 0 10 10',
      refX: 9,
      refY: 5,
      markerWidth: 7,
      markerHeight: 7,
      orient: 'auto-start-reverse'
    });
    svg(marker, 'path', { d: 'M0 0 L10 5 L0 10 z', fill: '#52606d' });
  }

  private drawConnectionLabel(parent: SVGElement, waypoints: Connection['waypoints'], label: string): void {
    const point = getLabelPoint(waypoints);
    const width = label.length * 6.4 + 12;
    svg(parent, 'rect', { x: point.x - width / 2, y: point.y - 10, width, height: 18, rx: 9, fill: '#f7f7f5', stroke: '#d3d6da', 'stroke-width': 1 });
    svg(parent, 'text', { x: point.x, y: point.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT, 'font-size': 10.5, fill: '#3e4c59' }, label);
  }
}

function connectionPath(waypoints: Connection['waypoints'], useOriginal: boolean): string {
  return waypoints.map((waypoint, index) => {
    const original = (waypoint as typeof waypoint & { original?: typeof waypoint }).original;
    const point = useOriginal && original ? original : waypoint;
    return `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`;
  }).join(' ');
}


function isInfraConnection(element: Element): element is InfraConnection {
  return element.businessObject?.kind === 'communication' || element.businessObject?.kind === 'noteAttachment';
}

export function getLabelPoint(waypoints: readonly { x: number; y: number }[]): { x: number; y: number } {
  if (waypoints.length < 2) return waypoints[0] ?? { x: 0, y: 0 };

  let longest = { start: waypoints[0]!, end: waypoints[1]!, length: -1 };
  for (let index = 1; index < waypoints.length; index += 1) {
    const start = waypoints[index - 1]!;
    const end = waypoints[index]!;
    const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
    if (length > longest.length) longest = { start, end, length };
  }

  return {
    x: (longest.start.x + longest.end.x) / 2,
    y: (longest.start.y + longest.end.y) / 2
  };
}
