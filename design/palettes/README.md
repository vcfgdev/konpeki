# Color palettes

Color resources only; no typography, layout or content.

- [index.ts](index.ts): `resolvePalette(name, 'paper' | 'night')` for Plex,
  Precision, Editorial, Blue–cyan, Orange–coral, Yellow, Green and Graphite.
  Contains surface/text roles, categorical colors, sequential ramps and status.
- [candidates.ts](candidates.ts): `lightPalettes`, Mineral and Botanical,
  including named series and diverging ramps. Light-only; not auto-inverted.
- [base.ts](base.ts): original specimen roles, still re-exported by
  `lib/taste.ts` for existing runtime consumers. Definitions are not duplicated.

Choose only the needed series. Keep category meaning separate from status.
For typography with a palette, use [themes](../themes/README.md).
