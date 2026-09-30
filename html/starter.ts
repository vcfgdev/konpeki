import starter from "../skills/konpeki/assets/blank.html?raw";
import themeURL from "../theme.css?url";
import editorialURL from "../themes/editorial/theme.css?url";
import darkURL from "../themes/dark/theme.css?url";
import denseURL from "../themes/dense-data/theme.css?url";

export const themes = [
  { id: "default", title: "Cobalt", url: themeURL },
  { id: "editorial", title: "Editorial", url: editorialURL },
  { id: "dark", title: "Dark", url: darkURL },
  { id: "dense-data", title: "Dense data", url: denseURL },
];

export function starterSource(theme: typeof themes[number]) {
  return starter.replace('href="theme.css"', `href="${new URL(theme.url, location.href).href}"`);
}
