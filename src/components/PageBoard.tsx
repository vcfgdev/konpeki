import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { Draft } from "../lib/model.ts";
import { layoutPages } from "../lib/page-board.ts";

export function PageBoard({ draft, children }: { draft: Draft; children: (page: Draft["slides"][number]) => ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const marker = useId();
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(root.current!);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const viewport = root.current!.closest<HTMLElement>(".workspace")!;
    let scale = 1, gestureScale: number | undefined;
    function zoomAt(next: number, x: number, y: number) {
      const board = content.current;
      if (!board) return;
      next = Math.min(4, Math.max(.25, next));
      const before = board.getBoundingClientRect();
      const ratio = next / scale;
      // Measure both sides: a fitted board is centered, a larger one scrolls.
      // Native scroll limits take over when the pointer anchor reaches an edge.
      flushSync(() => setZoom(next));
      const after = board.getBoundingClientRect();
      viewport.scrollLeft += after.left + (x - before.left) * ratio - x;
      viewport.scrollTop += after.top + (y - before.top) * ratio - y;
      scale = next;
    }
    function wheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      if (gestureScale !== undefined) return; // Safari can emit both event families.
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
      zoomAt(scale * Math.exp(-event.deltaY * unit * .002), event.clientX, event.clientY);
    }
    function gesture(event: Event) {
      const pinch = event as Event & { scale: number; clientX: number; clientY: number };
      event.preventDefault();
      if (event.type === "gesturestart") gestureScale = scale;
      else if (event.type === "gestureend") gestureScale = undefined;
      else if (gestureScale !== undefined) zoomAt(gestureScale * pinch.scale, pinch.clientX, pinch.clientY);
    }
    viewport.addEventListener("wheel", wheel, { passive: false });
    for (const type of ["gesturestart", "gesturechange", "gestureend"]) viewport.addEventListener(type, gesture, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", wheel);
      for (const type of ["gesturestart", "gesturechange", "gestureend"]) viewport.removeEventListener(type, gesture);
    };
  }, []);
  const layout = layoutPages(draft.slides.map(page => page.canvas), width);
  return <div ref={root} className="page-board" aria-label="All pages in reading order">
    {width > 0 && <div ref={content} className="page-board-content" style={{ width: layout.width, height: layout.height, zoom }}>
      <svg className="page-order" width={layout.width} height={layout.height} aria-hidden="true">
        <defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1 7 4 1 7" /></marker></defs>
        {layout.arrows.map((path, index) => <path key={draft.slides[index].id} data-from={draft.slides[index].id} data-to={draft.slides[index + 1].id} d={path} markerEnd={`url(#${marker})`} />)}
      </svg>
      {draft.slides.map((page, index) => {
        const box = layout.pages[index];
        return <article key={page.id} className="board-page" data-page={page.id} aria-label={`Page ${index + 1}: ${page.name}`}
          style={{ left: box.x, top: box.y - 32, width: box.width }}>
          <span className="page-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          {children(page)}
        </article>;
      })}
    </div>}
  </div>;
}
