import starter from "../skills/konpeki/assets/blank.html?raw";
import themeURL from "../theme.css?url";

export function starterSource() {
  return starter.replace('href="theme.css"', `href="${new URL(themeURL, location.href).href}"`);
}
