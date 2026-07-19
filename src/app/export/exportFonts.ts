import inter400Url from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import inter500Url from '@fontsource/inter/files/inter-latin-500-normal.woff2?url';
import inter600Url from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
import mono400Url from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url';
import mono600Url from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2?url';

const FONTS = [
  ['Inter', 400, inter400Url],
  ['Inter', 500, inter500Url],
  ['Inter', 600, inter600Url],
  ['JetBrains Mono', 400, mono400Url],
  ['JetBrains Mono', 600, mono600Url]
] as const;

let cachedCss: Promise<string> | undefined;

export function getEmbeddedFontCss(): Promise<string> {
  cachedCss ??= Promise.all(FONTS.map(async ([family, weight, url]) => {
    const dataUrl = await fetchAsDataUrl(url);
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url(${dataUrl}) format('woff2');}`;
  })).then((rules) => rules.join(''));
  return cachedCss;
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Schrift konnte nicht geladen werden: ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:font/woff2;base64,${btoa(binary)}`;
}
