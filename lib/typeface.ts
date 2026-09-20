import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-400-italic.css';
import '@fontsource/ibm-plex-sans/latin-500-italic.css';
import '@fontsource/ibm-plex-sans/latin-600-italic.css';
import regular from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2?url';
import medium from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2?url';
import semibold from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2?url';
import italic from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff2?url';
import mediumItalic from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-italic.woff2?url';
import semiboldItalic from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-italic.woff2?url';
import license from '@fontsource/ibm-plex-sans/LICENSE?raw';

const faces = [
  { url: regular, weight: 400, style: 'normal' },
  { url: medium, weight: 500, style: 'normal' },
  { url: semibold, weight: 600, style: 'normal' },
  { url: italic, weight: 400, style: 'italic' },
  { url: mediumItalic, weight: 500, style: 'italic' },
  { url: semiboldItalic, weight: 600, style: 'italic' },
];
export const fontsReady = Promise.all(faces.map(({ weight, style }) =>
  document.fonts.load(`${style} ${weight} 32px "IBM Plex Sans"`),
));

// Our existing SVG/PNG experiment must retain the newly selected typeface.
// Latin font files and their OFL notice travel with the SVG.
export async function embedTypeface(source: string) {
  const css = await Promise.all(faces.map(async ({ url, weight, style }) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Unable to load export typeface.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const data = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
    return `@font-face{font-family:'IBM Plex Sans';font-style:${style};font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2')}`;
  }));
  const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
  const style = xml.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = css.join('\n');
  const metadata = xml.createElementNS('http://www.w3.org/2000/svg', 'metadata');
  metadata.textContent = license;
  xml.documentElement.prepend(style, metadata);
  return new XMLSerializer().serializeToString(xml);
}
