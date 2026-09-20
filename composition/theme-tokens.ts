/** Explicit opt-in bindings. Literal SVG attributes always remain fixed. */
export const colorTokens = ["ink", "muted", "background", "surface", "divider", "accent", "on-accent", "wash"] as const;
export const fontTokens = ["heading-font", "body-font"] as const;
export type ThemeToken = typeof colorTokens[number] | typeof fontTokens[number];
export function tokensForAttribute(name: string): readonly ThemeToken[] {
  return name === "font-family" ? fontTokens
    : ["fill", "stroke", "color"].includes(name) ? colorTokens : [];
}
export function validThemeBinding(name: string, value: string | number): boolean {
  return typeof value !== "string" || !value.startsWith("theme:") ||
    tokensForAttribute(name).some((token) => value === `theme:${token}`);
}
export function resolveVectorAttribute(name: string, value: string | number): string | number {
  return typeof value === "string" && value.startsWith("theme:") && validThemeBinding(name, value)
    ? `var(--vector-${value.slice(6)})` : value;
}
