import { Blob, Face, Font } from "harfbuzzjs";

export interface FontManifestEntry {
  id: string; family: string; weight: number; style: "normal" | "italic"; file: string;
  sha256: string; bytes: number; unitsPerEm: number; ascent: number; descent: number;
  capHeight: number;
  metricsSource?: "hhea" | "OS/2"; fallback?: boolean;
}
export interface FontManifest { version: number; generator: string; fonts: FontManifestEntry[] }
export interface LoadedFont extends FontManifestEntry { data: Uint8Array; hbFont: Font }
export type FontByteLoader = (file: string) => Promise<Uint8Array>;

export class FontContext {
  readonly manifest: FontManifest;
  readonly fonts: ReadonlyMap<string, LoadedFont>;
  constructor(manifest: FontManifest, fonts: Iterable<LoadedFont>) {
    this.manifest = manifest;
    this.fonts = new Map([...fonts].map(font => [font.id, font]));
  }
  match(family: string, weight = 400, style: "normal" | "italic" = "normal"): LoadedFont {
    const candidates = [...this.fonts.values()].filter(font => font.family === family && !font.fallback);
    if (!candidates.length) throw new Error(`Unknown font family: ${family}`);
    return candidates.sort((a, b) => Number(a.style !== style) - Number(b.style !== style) || Math.abs(a.weight - weight) - Math.abs(b.weight - weight))[0];
  }
  fallbackFonts(): LoadedFont[] { return [...this.fonts.values()].filter(font => font.fallback); }
  getBytes(id: string): Uint8Array { return this.require(id).data.slice(); }
  glyphOutline(id: string, glyphId: number): string { return this.require(id).hbFont.glyphToPath(glyphId); }
  private require(id: string): LoadedFont {
    const font = this.fonts.get(id); if (!font) throw new Error(`Unknown font id: ${id}`); return font;
  }
}

export async function loadFontContext(manifest: FontManifest, loadBytes: FontByteLoader): Promise<FontContext> {
  const loaded = await Promise.all(manifest.fonts.map(async entry => {
    const data = await loadBytes(entry.file);
    const face = new Face(new Blob(data));
    if (face.upem !== entry.unitsPerEm) throw new Error(`${entry.id}: manifest unitsPerEm ${entry.unitsPerEm} != font ${face.upem}`);
    const hbFont = new Font(face); hbFont.setScale(face.upem, face.upem);
    return { ...entry, data, hbFont };
  }));
  return new FontContext(manifest, loaded);
}

export async function loadNodeFontContext(fontDirectory: string | URL): Promise<FontContext> {
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const directory = fontDirectory instanceof URL ? fontDirectory : resolve(fontDirectory);
  const url = (file: string) => directory instanceof URL ? new URL(file, directory.href.endsWith("/") ? directory : new URL(`${directory.href}/`)) : resolve(directory, file);
  const manifest = JSON.parse(await readFile(url("manifest.json"), "utf8")) as FontManifest;
  return loadFontContext(manifest, async file => new Uint8Array(await readFile(url(file))));
}

export async function loadBrowserFontContext(fontBaseUrl: string | URL): Promise<FontContext> {
  const base = new URL(fontBaseUrl, globalThis.location?.href);
  const url = (file: string) => new URL(file, base.href.endsWith("/") ? base : new URL(`${base.href}/`));
  const manifest = await (await fetch(url("manifest.json"))).json() as FontManifest;
  return loadFontContext(manifest, async file => new Uint8Array(await (await fetch(url(file))).arrayBuffer()));
}
