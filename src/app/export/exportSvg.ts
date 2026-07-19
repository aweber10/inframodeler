import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { Element } from 'diagram-js/lib/model/Types';

import { expandExportBounds } from './exportBounds';
import { getEmbeddedFontCss } from './exportFonts';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SvgExport {
  svg: string;
  width: number;
  height: number;
}

export async function exportSvg(canvas: Canvas, registry: ElementRegistry): Promise<SvgExport> {
  const elements = registry.getAll() as Element[];
  const hasShapes = elements.some((element) => 'width' in element && !element.labelTarget);
  if (!hasShapes) throw new Error('Das leere Diagramm kann nicht exportiert werden.');
  const sourceSvg = canvas.getContainer().querySelector<SVGSVGElement>(':scope > svg');
  if (!sourceSvg) throw new Error('SVG-Zeichenfläche nicht gefunden.');
  const layer = getContentLayer(canvas, sourceSvg);
  if (!layer) throw new Error('Diagramminhalt nicht gefunden.');
  const bounds = expandExportBounds((layer as SVGGElement).getBBox());

  const output = document.createElementNS(SVG_NS, 'svg');
  output.setAttribute('xmlns', SVG_NS);
  output.setAttribute('width', String(bounds.width));
  output.setAttribute('height', String(bounds.height));
  output.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
  output.setAttribute('role', 'img');

  const defs = sourceSvg.querySelector(':scope > defs')?.cloneNode(true) as SVGDefsElement | undefined;
  const outputDefs = defs ?? document.createElementNS(SVG_NS, 'defs');
  const style = document.createElementNS(SVG_NS, 'style');
  style.textContent = await getEmbeddedFontCss();
  outputDefs.prepend(style);
  output.append(outputDefs);

  const background = document.createElementNS(SVG_NS, 'rect');
  background.setAttribute('x', String(bounds.x));
  background.setAttribute('y', String(bounds.y));
  background.setAttribute('width', String(bounds.width));
  background.setAttribute('height', String(bounds.height));
  background.setAttribute('fill', '#ffffff');
  output.append(background);

  const content = layer.cloneNode(true) as SVGElement;
  content.querySelectorAll('.djs-hit, .djs-outline, .djs-selection-outline').forEach((element) => element.remove());
  output.append(content);

  const serialized = new XMLSerializer().serializeToString(output);
  return {
    svg: `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}\n`,
    width: bounds.width,
    height: bounds.height
  };
}

function getContentLayer(canvas: Canvas, sourceSvg: SVGSVGElement): SVGElement | null {
  const active = canvas.getActiveLayer()?.group;
  if (active?.querySelector('.djs-element')) return active;

  const defaultLayer = canvas.getDefaultLayer();
  if (defaultLayer.querySelector('.djs-element')) return defaultLayer;

  return [...sourceSvg.querySelectorAll<SVGElement>('.viewport > g[class^="layer-"]')]
    .find((layer) => layer.querySelector('.djs-element')) ?? null;
}
