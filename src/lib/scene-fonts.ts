import manifest from "../../fonts/manifest.json";
import { loadFontContext, type FontContext, type FontManifest } from "../../composition/fonts.ts";

// Vite emits every font as a hashed asset and rewrites these URLs relative to
// the configured base, so a production build works from any subdirectory.
const fontAssets = import.meta.glob("../../fonts/*.{ttf,otf}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

let context: Promise<FontContext> | undefined;

export function sceneFonts(): Promise<FontContext> {
  context ??= loadFontContext(manifest as FontManifest, async (file) => {
    const url = fontAssets[`../../fonts/${file}`];
    if (!url) throw new Error(`Bundled scene font is missing: ${file}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load scene font: ${file}`);
    return new Uint8Array(await response.arrayBuffer());
  });
  return context;
}
