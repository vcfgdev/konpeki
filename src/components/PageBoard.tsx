import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Draft } from "../lib/model.ts";
import { layoutPages } from "../lib/page-board.ts";

export function PageBoard({ draft, children }: { draft: Draft; children: (page: Draft["pages"][number], index: number) => ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState({ width: 0, height: 0 });
  const marker = useId();
  useEffect(() => {
    const viewport = root.current!.closest<HTMLElement>(".workspace")!;
    const observer = new ResizeObserver(() => {
      const help = viewport.querySelector<HTMLElement>(".board-help");
      const footer = help ? help.offsetHeight + parseFloat(getComputedStyle(help).marginTop) : 0;
      const top = root.current!.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
      const padding = getComputedStyle(viewport);
      const width = viewport.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
      const height = Math.max(0, viewport.clientHeight - top - parseFloat(padding.paddingBottom) - footer);
      setSpace(current => current.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(root.current!);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const viewport = root.current!.closest<HTMLElement>(".workspace")!;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let scale = 1, goal = 1, gestureScale: number | undefined;
    let frame = 0, lastTime = 0, x = 0, y = 0, smooth = true;
    let anchorX = 0, anchorY = 0;
    function animate(time: number) {
      frame = 0;
      const board = content.current;
      if (!board) return;
      const distance = Math.log(goal / scale);
      const fraction = smooth && !reducedMotion.matches ? 1 - Math.exp(-Math.min(time - lastTime, 64) / 40) : 1;
      const next = Math.abs(distance) < .002 ? goal : scale * Math.exp(distance * fraction);
      lastTime = time;
      // Keep view-only zoom out of React. Retain the original anchor across
      // frames so integer scroll rounding cannot accumulate into pointer drift.
      board.style.zoom = String(next);
      const after = board.getBoundingClientRect();
      viewport.scrollLeft += after.left + anchorX * next - x;
      viewport.scrollTop += after.top + anchorY * next - y;
      scale = next;
      if (scale !== goal) frame = requestAnimationFrame(animate);
      else delete board.dataset.zooming;
    }
    function zoomAt(next: number, clientX: number, clientY: number, ease: boolean) {
      if (!content.current) return;
      const bounds = content.current.getBoundingClientRect();
      anchorX = (clientX - bounds.left) / scale;
      anchorY = (clientY - bounds.top) / scale;
      goal = Math.min(4, Math.max(.1, next));
      x = clientX; y = clientY; smooth = ease;
      content.current.dataset.zooming = "true";
      if (!frame) { lastTime = performance.now(); frame = requestAnimationFrame(animate); }
    }
    function wheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) {
        // A fitted row has no vertical travel. Let a plain mouse wheel navigate
        // it, while preserving native two-axis panning when zoomed in.
        if (!event.deltaX && viewport.scrollHeight <= viewport.clientHeight + 1 && viewport.scrollWidth > viewport.clientWidth) {
          event.preventDefault();
          const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientWidth : 1;
          viewport.scrollLeft += event.deltaY * unit;
        }
        return;
      }
      event.preventDefault();
      if (gestureScale !== undefined) return; // Safari can emit both event families.
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
      zoomAt(goal * Math.exp(-event.deltaY * unit * .004), event.clientX, event.clientY, true);
    }
    function gesture(event: Event) {
      const pinch = event as Event & { scale: number; clientX: number; clientY: number };
      event.preventDefault();
      if (event.type === "gesturestart") gestureScale = goal;
      else if (event.type === "gestureend") gestureScale = undefined;
      else if (gestureScale !== undefined) zoomAt(gestureScale * pinch.scale, pinch.clientX, pinch.clientY, false);
    }
    viewport.addEventListener("wheel", wheel, { passive: false });
    for (const type of ["gesturestart", "gesturechange", "gestureend"]) viewport.addEventListener(type, gesture, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("wheel", wheel);
      for (const type of ["gesturestart", "gesturechange", "gestureend"]) viewport.removeEventListener(type, gesture);
    };
  }, []);
  const layout = layoutPages(draft.pages.map(page => page.canvas), space.width, space.height);
  return <div ref={root} className="page-board" style={{ minHeight: space.height }} aria-label="All pages in reading order">
    {space.width > 0 && <div ref={content} className="page-board-content" style={{ width: layout.width, height: layout.height, zoom: 1 }}>
      <svg className="page-order" width={layout.width} height={layout.height} aria-hidden="true">
        <defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1 7 4 1 7" /></marker></defs>
        {layout.arrows.map((path, index) => <path key={draft.pages[index].id} data-from={draft.pages[index].id} data-to={draft.pages[index + 1].id} d={path} markerEnd={`url(#${marker})`} />)}
      </svg>
      {draft.pages.map((page, index) => {
        const box = layout.pages[index];
        return <article key={page.id} className="board-page" data-page={page.id} aria-label={`Page ${index + 1}: ${page.name}`}
          style={{ left: box.x, top: box.y - 32, width: box.width }}>
          {children(page, index)}
        </article>;
      })}
    </div>}
  </div>;
}
