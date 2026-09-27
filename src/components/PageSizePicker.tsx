import type { CompositionSlide } from "../../composition/runtime.ts";
import { gridMetrics, refineGrid, resolveSlide, toGridComponent } from "../../composition/grid.ts";
import { pagePresets, pageSizeIssue, resizePage } from "../lib/page-size.ts";

export function PageSizePicker({ slide, onChange }: { slide: CompositionSlide; onChange: (slide: CompositionSlide) => void }) {
  const preset = pagePresets.find((item) => item.width === slide.canvas.width && item.height === slide.canvas.height);
  const metrics = slide.grid && gridMetrics(slide.grid);
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
            {item.name} · {"displaySize" in item ? item.displaySize : `${item.width} × ${item.height}`}{unavailable ? " · unavailable" : ""}
          </option>;
        })}
      </select>
    </label>
    {metrics && <div className="field">
      <span>{metrics.columns} columns × {metrics.rows} rows</span>
      {slide.grid!.revision !== 2 && <>
        <button type="button" onClick={() => onChange(resolveSlide(refineGrid({
          ...slide, grid: slide.grid!, components: slide.components.map(toGridComponent),
        })))}>Use finer grid</button>
        <small className="visualization-description">Double the columns without moving content. Rows stay the same.</small>
      </>}
    </div>}
  </fieldset>;
}
