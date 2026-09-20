import type { CompositionSlide } from "../../composition/types.ts";
import { pagePresets, pageSizeIssue, resizePage } from "../lib/page-size.ts";

export function PageSizePicker({ slide, onChange }: { slide: CompositionSlide; onChange: (slide: CompositionSlide) => void }) {
  const preset = pagePresets.find((item) => item.width === slide.canvas.width && item.height === slide.canvas.height);
  function apply(w: number, h: number, destination: CompositionSlide["intendedViewingSize"] = "custom") {
    const size = { width: w, height: h };
    if (!pageSizeIssue(slide, size)) {
      onChange(resizePage(slide, size, destination));
    }
  }
  return <fieldset>
    <legend>Size</legend>
    <label className="field">
      <span className="sr-only">Size</span>
      <select name="page-format" value={preset?.name ?? "Imported"} onChange={(event) => {
        const next = pagePresets.find((item) => item.name === event.target.value);
        if (next) apply(next.width, next.height, next.destination);
      }}>
        {!preset && <option value="Imported" disabled>{slide.canvas.width} × {slide.canvas.height} · Imported size</option>}
        {pagePresets.map((item) => {
          const unavailable = Boolean(pageSizeIssue(slide, item));
          return <option key={item.name} value={item.name} disabled={unavailable}>
            {item.name} · {item.width} × {item.height}{unavailable ? " · unavailable" : ""}
          </option>;
        })}
      </select>
    </label>
  </fieldset>;
}
