import { readFileSync } from "node:fs";
import { copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Keep browser tests deterministic without shipping or committing font binaries.
export function fontData(family: "sans" | "mono", weight = 400, style = "normal") {
  const path = import.meta.resolve(`@fontsource/ibm-plex-${family}/files/ibm-plex-${family}-latin-${weight}-${style}.woff2`);
  return `data:font/woff2;base64,${readFileSync(new URL(path)).toString("base64")}`;
}

export const testFontCSS = [
  ...[400, 600, 700].map(weight => `@font-face{font-family:"IBM Plex Sans";font-weight:${weight};src:url("${fontData("sans", weight)}")}`),
  `@font-face{font-family:"IBM Plex Sans";font-style:italic;font-weight:400;src:url("${fontData("sans", 400, "italic")}")}`,
  `@font-face{font-family:"IBM Plex Mono";font-weight:400;src:url("${fontData("mono")}")}`,
].join("\n");

export async function writeTestTheme(directory: string) {
  const theme = readFileSync(new URL("../theme.css", import.meta.url), "utf8")
    .replace(/@import url\("https:\/\/fonts.googleapis.com\/[^"\n]+"\);/, () => testFontCSS);
  await writeFile(join(directory, "theme.css"), theme);
  await copyFile(new URL("../theme-base.css", import.meta.url), join(directory, "theme-base.css"));
}
