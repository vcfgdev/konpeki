# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.66.0", "brotli==1.2.0"]
# ///
# Generate deterministic sfnt assets (HarfBuzz cannot consume WOFF2 directly):
#   uv run --locked scripts/generate-fonts.py
from fontTools.ttLib import TTFont
from pathlib import Path
from io import BytesIO
import argparse, hashlib, json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "fonts"
FAMILIES = {
    "ibm-plex-sans": "IBM Plex Sans",
    "ibm-plex-serif": "IBM Plex Serif",
    "noto-sans": "Noto Sans",
    "hanken-grotesk": "Hanken Grotesk",
}

parser = argparse.ArgumentParser(description="Generate fonts and verify the committed metrics and hashes.")
parser.add_argument("--update-manifest", action="store_true", help="Explicitly accept a reviewed font or converter update.")
args = parser.parse_args()
manifest_path = OUT / "manifest.json"
expected = None if args.update_manifest else json.loads(manifest_path.read_text())
entries = []
assets = {}

def vertical_metrics(font):
    """Use the same OpenType metric selection Chromium/FreeType uses."""
    head, hhea, os2 = font["head"], font["hhea"], font["OS/2"]
    # OpenType OS/2.fsSelection bit 7 requests the typo ascender/descender.
    # These bundled faces set it (and currently duplicate the hhea values), but
    # recording the selected table prevents a future font update from silently
    # changing which em box the manifest describes.
    if os2.fsSelection & (1 << 7):
        return head, os2.sTypoAscender, -os2.sTypoDescender, "OS/2"
    return head, hhea.ascent, -hhea.descent, "hhea"

for package, family in FAMILIES.items():
    source = ROOT / "node_modules" / "@fontsource" / package
    assets[f"LICENSE-{package}.txt"] = (source / "LICENSE").read_bytes()
    for weight in (400, 500, 600):
        for style, suffix in (("normal", "normal"), ("italic", "italic")):
            src = source / "files" / f"{package}-latin-{weight}-{suffix}.woff2"
            font = TTFont(src, recalcTimestamp=False)
            font.flavor = None
            target = f"{package}-latin-{weight}-{suffix}.ttf"
            buffer = BytesIO()
            font.save(buffer, reorderTables=False)
            data = assets[target] = buffer.getvalue()
            head, ascent, descent, metrics_source = vertical_metrics(font)
            entries.append({"id": target[:-4], "family": family, "weight": weight, "style": style,
                "file": target, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data),
                "unitsPerEm": head.unitsPerEm, "ascent": ascent / head.unitsPerEm,
                "descent": descent / head.unitsPerEm, "metricsSource": metrics_source})

# Symbols 2 contains pictographs, but not the ordinary U+2192 arrow. Bundle
# Symbols too; fallback selection checks cmap coverage rather than font names.
for package, family in (("noto-sans-symbols-2", "Noto Sans Symbols 2"), ("noto-sans-symbols", "Noto Sans Symbols")):
    source = ROOT / "node_modules" / "@fontsource" / package
    assets[f"LICENSE-{package}.txt"] = (source / "LICENSE").read_bytes()
    src = source / "files" / f"{package}-symbols-400-normal.woff2"
    font = TTFont(src, recalcTimestamp=False); font.flavor = None
    target = f"{package}-400-normal.ttf"
    buffer = BytesIO(); font.save(buffer, reorderTables=False)
    data = assets[target] = buffer.getvalue()
    head, ascent, descent, metrics_source = vertical_metrics(font)
    entries.append({"id": target[:-4], "family": family, "weight": 400, "style": "normal", "file": target,
        "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "unitsPerEm": head.unitsPerEm,
        "ascent": ascent / head.unitsPerEm, "descent": descent / head.unitsPerEm,
        "metricsSource": metrics_source, "fallback": True})

manifest = {"version": 1, "generator": "uv run scripts/generate-fonts.py", "fonts": entries}
if not args.update_manifest and manifest != expected:
    raise SystemExit("Generated fonts differ from fonts/manifest.json. Review the font/converter change, then use --update-manifest only to accept it intentionally.")

# Verify the entire set before writing anything. Repeated builds leave unchanged
# files alone so the dev server does not reload every font unnecessarily.
OUT.mkdir(exist_ok=True)
for name, data in assets.items():
    path = OUT / name
    if not path.exists() or path.read_bytes() != data:
        path.write_bytes(data)
if args.update_manifest:
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Generated and {'recorded' if args.update_manifest else 'verified'} {len(entries)} fonts ({sum(e['bytes'] for e in entries)} bytes)")
