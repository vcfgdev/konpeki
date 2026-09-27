import { useEffect, useId, useRef, useState } from "react";
import type { CompositionSlide, CompositionDocument } from "../../composition/types.ts";
import type { ResolvedDocument } from "../../composition/grid.ts";
import { toComposition } from "../../composition/grid.ts";
import { lowerPage } from "../../composition/lower.ts";
import { checkPage } from "../../composition/check.ts";
import { componentInstanceLabel } from "../lib/model.ts";
import { sceneFonts } from "../lib/scene-fonts.ts";

/** Deterministic scene diagnostics; this does not depend on mounted DOM geometry. */
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
    void sceneFonts().then(fonts => {
      const wire = toComposition({ schema: "konpeki-composition/v2", title: "Diagnostics", theme, slides: [slide] } as ResolvedDocument);
      const scene = lowerPage(wire, wire.slides[0], fonts);
      const overflow = checkPage(scene, fonts).filter(issue => issue.code === "native-overflow" || issue.code === "clipped-label")
        .filter(issue => issue.componentId).map(issue => ({ componentId: issue.componentId!, elementId: issue.elementId,
          text: String(issue.evidence.source ?? issue.message).slice(0, 80) }));
      if (!cancelled) { setIssues(overflow); if (!overflow.length) popover.current?.hidePopover(); }
    });
    return () => { cancelled = true; };
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
