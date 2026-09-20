import {
  resolvePalette,
  type PaletteMode,
  type PaletteName,
} from "../../design/palettes/index.ts";
import type { ThemeId } from "../../composition/types.ts";

const themeLabels: Record<ThemeId, PaletteName> = {
  plex: "Plex",
  precision: "Precision",
  editorial: "Editorial",
  "blue-cyan": "Blue–cyan",
  "orange-coral": "Orange–coral",
  yellow: "Yellow",
  green: "Green",
  graphite: "Graphite",
};

export function themeLabel(id: ThemeId) {
  return themeLabels[id];
}

export function composerPalette(id: ThemeId, mode: PaletteMode) {
  return resolvePalette(themeLabel(id), mode);
}
