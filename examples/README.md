# Examples

Three native HTML examples cover a link-sized product cover, a proportional
data brief, and a two-page printable field guide. The cohort and scenarios are
illustrative; they are not customer data or product-performance claims.

| Source | Demonstrates |
| --- | --- |
| [Cover](cover/document.html) | 1200 × 630 graphic with HTML typography and inline SVG |
| [Data brief](data-brief/document.html) | Proportional bars, explicit quantities and denominators |
| [Field guide](field-guide/document.html) | Two portrait pages, flowing prose, inline code and a table |

The field guide uses IBM Plex Sans from Google Fonts, so preview and export need
network access. No font binaries are committed. The other examples use system
fonts. The cohort retains the former gallery's fictional 1,000-user scenario:
700 activate, with 400 paid and 300 free; the 300 not activated leave.

From a checkout, run:

```sh
pnpm konpeki validate examples/cover/document.html
pnpm konpeki inspect examples/data-brief/document.html --details
pnpm konpeki render examples/field-guide/document.html --format pdf --output /tmp/field-guide.pdf
pnpm konpeki preview examples/cover/document.html
```

The public Pages preview is comment-only. A local CLI preview additionally
supports moving and deleting elements, with undo for those changes.
