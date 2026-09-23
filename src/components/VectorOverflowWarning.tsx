import { useEffect, useId, useRef, useState } from "react";
import type { CompositionSlide, CompositionDocument } from "../../composition/types.ts";
import { componentInstanceLabel } from "../lib/model.ts";

/** Measure rendered text, including nested SVG transforms, after fonts settle. */
export function VectorOverflowWarning({ slide, theme, onSelect }: {
  slide: CompositionSlide;
  theme: CompositionDocument["theme"];
  onSelect: (componentId: string, elementId?: string) => void;
}) {
  const [issues, setIssues] = useState<{ componentId: string; elementId?: string; text: string }[]>([]);
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  useEffect(() => { popover.current?.hidePopover(); }, [slide.id]);
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    function measure() {
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        const overflow: typeof issues = [];
        function add(text: Element) {
          const componentId = text.closest<HTMLElement>("[data-component]")?.dataset.component;
          if (componentId) overflow.push({ componentId, elementId: text.getAttribute("data-vector-element") ?? undefined, text: text.textContent?.trim().slice(0, 80) ?? "Text" });
        }
        document.querySelectorAll<HTMLElement>(".stage .text-block-content").forEach((text) => {
          const surface = text.parentElement;
          if (surface && (text.scrollHeight > surface.clientHeight + 1 || text.scrollWidth > surface.clientWidth + 1)) add(text);
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
            })) add(text);
          });
        });
        setIssues(overflow);
        if (!overflow.length) popover.current?.hidePopover();
      });
    }
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => { cancelled = true; cancelAnimationFrame(frame); document.fonts.removeEventListener("loadingdone", measure); };
  }, [slide, theme]);
  return <>
    <span className="sr-only" role="status">{issues.length ? `${issues.length} text overflow ${issues.length === 1 ? "warning" : "warnings"} on this page` : ""}</span>
    <button type="button" className="overflow-trigger" popoverTarget={id} disabled={!issues.length}
      aria-label={`${issues.length} text overflow warnings`} title="Text overflow warnings">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3 18 17H2ZM10 8v4m0 2v.5" /></svg>
      <span>{issues.length}</span>
    </button>
    <div id={id} ref={popover} popover="auto" className="overflow-popover">
      <strong>Text outside its frame</strong>
      <p>Select an item to revise its text or size. Nothing was resized automatically.</p>
      <ul>{issues.map(issue => <li key={`${issue.componentId}:${issue.elementId ?? "native"}`}>
        <button type="button" onClick={() => { popover.current?.hidePopover(); onSelect(issue.componentId, issue.elementId); }}>
          <strong>{componentInstanceLabel(slide.components, issue.componentId)}{issue.elementId ? ` · ${issue.elementId}` : ""}</strong>
          <span>{issue.text}</span>
        </button>
      </li>)}</ul>
    </div>
  </>;
}
