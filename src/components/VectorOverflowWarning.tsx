import { useEffect, useState } from "react";
import type { CompositionSlide, CompositionDocument } from "../../composition/types.ts";

/** Measure rendered text, including nested SVG transforms, after fonts settle. */
export function VectorOverflowWarning({ slide, theme }: {
  slide: CompositionSlide;
  theme: CompositionDocument["theme"];
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    function measure() {
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        let overflow = 0;
        document.querySelectorAll<HTMLElement>(".stage .text-block-content").forEach((text) => {
          const surface = text.parentElement;
          if (surface && (text.scrollHeight > surface.clientHeight + 1 || text.scrollWidth > surface.clientWidth + 1)) overflow++;
        });
        document.querySelectorAll<SVGSVGElement>(".stage .custom-vector-art").forEach((svg) => {
          const root = svg.getScreenCTM();
          if (!root) return;
          const view = svg.viewBox.baseVal;
          svg.querySelectorAll<SVGTextElement>("text").forEach((text) => {
            const matrix = text.getScreenCTM();
            if (!matrix) return;
            const box = text.getBBox();
            const transform = root.inverse().multiply(matrix);
            const corners = [[box.x, box.y], [box.x + box.width, box.y],
              [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]];
            if (corners.some(([x, y]) => {
              const p = new DOMPoint(x, y).matrixTransform(transform);
              return p.x < view.x - 1 || p.y < view.y - 1 || p.x > view.x + view.width + 1 || p.y > view.y + view.height + 1;
            })) overflow++;
          });
        });
        setCount(overflow);
      });
    }
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => { cancelled = true; cancelAnimationFrame(frame); document.fonts.removeEventListener("loadingdone", measure); };
  }, [slide, theme]);
  return count ? <p role="status" className="field-error">{count} text {count === 1 ? "element exceeds" : "elements exceed"} its component viewport on this slide. Revise the text or geometry; nothing was resized.</p> : null;
}
