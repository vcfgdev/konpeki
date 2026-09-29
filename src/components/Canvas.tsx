import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { CompositionComponent, Rect } from "../../composition/runtime.ts";
import { pageMetrics, toComposition } from "../../composition/grid.ts";
import { lowerPage } from "../../composition/lower.ts";
import { renderSVG } from "../../composition/svg.ts";
import type { ScenePage } from "../../composition/scene.ts";
import { alignmentGuides, componentInstanceLabel, getSlide, transformComponentRect, type Draft, type Guide } from "../lib/model.ts";
import { sceneFonts } from "../lib/scene-fonts.ts";
import type { RevisionNote, ReviewTarget } from "../lib/review.ts";

type Corner = "nw" | "ne" | "sw" | "se";
type Props = {
  mode?: "edit" | "review"; draft: Draft; activeSlideId: string; pageNumber: number; selected?: string;
  commentTarget?: ReviewTarget;
  onSelect: (id?: string) => void;
  onComment?: (componentId?: string) => void;
  onSlideName: (name: string) => void;
  onComponent: (component: CompositionComponent, mergeKey?: string) => void;
  onDuplicate?: (id: string, rect: Rect) => CompositionComponent | undefined;
  onEditEnd: () => void;
  onNotice: (message: string) => void;
  revisionNotes?: RevisionNote[]; onSelectNote?: (note: RevisionNote) => void;
};

const resize = (r: Rect, dx: number, dy: number, c: Corner): Rect => ({
  x: c.endsWith("w") ? r.x + dx : r.x, y: c.startsWith("n") ? r.y + dy : r.y,
  width: r.width + (c.endsWith("w") ? -dx : dx), height: r.height + (c.startsWith("n") ? -dy : dy),
});

export function Canvas({ mode = "edit", draft, activeSlideId, pageNumber, selected, commentTarget, onSelect, onComment, onSlideName, onComponent, onDuplicate, onEditEnd, onNotice, revisionNotes = [], onSelectNote }: Props) {
  const interactive = mode === "edit", slide = getSlide(draft, activeSlideId);
  const root = useRef<HTMLDivElement>(null);
  const sceneId = useId();
  const [rendered, setRendered] = useState<{ markup: string; components: ScenePage["components"] }>({ markup: "", components: [] });
  const { markup } = rendered;
  // Unrelated UI updates must not replace the SVG underneath an active preview.
  const artwork = useMemo(() => ({ __html: markup }), [markup]);
  const [renderError, setRenderError] = useState("");
  const [guides, setGuides] = useState<Guide[]>([]);
  const [heldGroup, setHeldGroup] = useState<{ id: string; offset: number; area: Rect }>();
  const [editing, setEditing] = useState<{ component: CompositionComponent; value: string }>();
  const [renaming, setRenaming] = useState(false), [name, setName] = useState(slide.name);
  const gesture = useRef<{ id: string; x: number; y: number; rect: Rect; scale: number; corner?: Corner; duplicate?: boolean } | undefined>(undefined);
  const nodeGesture = useRef<{ componentId: string; nodeId: string; x: number; y: number; position: { x: number; y: number }; scale: number } | undefined>(undefined);
  const preview = useRef<{ document: Draft; cssScale: number; rect?: Rect; nodes: (HTMLElement | SVGElement)[] } | undefined>(undefined);
  const previewFrame = useRef(0);
  // Moving does not change layout until drop. Keep the settled scene, including
  // group offsets, and translate just its existing artwork and interaction chrome.
  const renderGroup = preview.current ? undefined : heldGroup;

  useEffect(() => {
    let stale = false;
    setRenderError("");
    void sceneFonts().then(fonts => {
      const document = toComposition(draft);
      const page = document.pages.find(item => item.id === activeSlideId)!;
      const scene = lowerPage(document, page, fonts, renderGroup && new Map([[renderGroup.id, renderGroup.offset]]));
      const next = renderSVG(scene, fonts, undefined, sceneId);
      if (!stale) setRendered({ markup: next, components: scene.components });
    }).catch(error => !stale && setRenderError(error instanceof Error ? error.message : "Scene rendering failed."));
    return () => { stale = true; };
  }, [draft, activeSlideId, sceneId, renderGroup]);

  useLayoutEffect(() => {
    // Keep the preview until the committed scene replaces it, avoiding a flash
    // back to the old position between the document update and SVG generation.
    if (!gesture.current) clearPreview();
  }, [rendered]);
  useLayoutEffect(() => {
    if (gesture.current && preview.current && (preview.current.document !== draft || !interactive)) {
      gesture.current = undefined; clearPreview(); setHeldGroup(undefined);
    }
  }, [draft, interactive]);
  useEffect(() => () => clearPreview(), []);

  useEffect(() => {
    window.addEventListener("blur", end);
    return () => window.removeEventListener("blur", end);
  }, [onEditEnd]);

  const box = (component: CompositionComponent) => rendered.components.find(item => item.id === component.id)?.box ?? component.preferredRect;
  const editBox = (component: CompositionComponent) => component.rect
    ? { ...component.preferredRect, height: box(component).height } : box(component);
  function holdGroup(component: CompositionComponent) {
    const group = slide.groups.find(group => group.rect && group.verticalAlignment && group.childIds.includes(component.id));
    if (!group) return;
    const held = { id: group.id, offset: box(component).y - component.preferredRect.y, area: group.rect! };
    setHeldGroup(current => current ?? held);
  }
  function changed(component: CompositionComponent, rect: Rect) {
    const previous = editBox(component);
    // Wrapping may change measured height during a horizontal resize. Compare
    // vertical intent to the gesture's starting height, not that new measurement.
    if (gesture.current?.corner && component.rect?.height === undefined)
      previous.height = gesture.current.rect.height;
    const next = transformComponentRect(component, previous, rect, slide.canvas);
    if (next === component) clearPreview();
    else onComponent(next, `geometry:${component.id}`);
  }
  function constrain(rect: Rect, original?: Rect): Rect {
    if (!original) return { ...rect,
      x: Math.max(0, Math.min(slide.canvas.width - rect.width, rect.x)),
      y: Math.max(0, Math.min(slide.canvas.height - rect.height, rect.y)),
    };
    const minimumWidth = Math.min(1, original.width), minimumHeight = Math.min(1, original.height);
    const right = Math.max(minimumWidth, Math.min(slide.canvas.width, rect.x + rect.width));
    const bottom = Math.max(minimumHeight, Math.min(slide.canvas.height, rect.y + rect.height));
    const x = Math.max(0, Math.min(right - minimumWidth, rect.x)), y = Math.max(0, Math.min(bottom - minimumHeight, rect.y));
    return { x, y, width: right - x, height: bottom - y };
  }
  function clearPreview() {
    cancelAnimationFrame(previewFrame.current); previewFrame.current = 0;
    for (const node of preview.current?.nodes ?? []) {
      if (node instanceof SVGElement) node.removeAttribute("transform");
      else node.style.removeProperty("translate");
    }
    preview.current = undefined;
    setGuides(current => current.length ? [] : current);
  }
  function showGuides(id: string, rect: Rect) {
    const component = slide.components.find(item => item.id === id)!;
    const authored = editBox(component), visible = box(component);
    const scale = root.current!.getBoundingClientRect().width / slide.canvas.width;
    const next = alignmentGuides({ ...rect, x: rect.x + visible.x - authored.x, y: rect.y + visible.y - authored.y },
      slide.components.filter(item => item.id !== id).map(box), slide.canvas, pageMetrics(slide).margin, 2 / scale);
    setGuides(current => current.length === next.length && current.every((guide, index) => guide.axis === next[index].axis && guide.value === next[index].value) ? current : next);
  }
  function paintPreview() {
    previewFrame.current = 0;
    const active = gesture.current, current = preview.current;
    if (!active || !current?.rect || !root.current) return;
    if (!current.nodes.length) current.nodes = [...root.current.querySelectorAll<HTMLElement | SVGElement>(`[data-component="${CSS.escape(active.id)}"], .resize-handle, .process-node-hit`)];
    const dx = current.rect.x - active.rect.x, dy = current.rect.y - active.rect.y;
    for (const node of current.nodes) {
      if (node instanceof SVGElement) node.setAttribute("transform", `translate(${dx} ${dy})`);
      else node.style.translate = `${dx * current.cssScale}px ${dy * current.cssScale}px`;
    }
    showGuides(active.id, current.rect);
  }
  function start(event: ReactPointerEvent, component: CompositionComponent, corner?: Corner) {
    if (event.button !== 0) return;
    event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onSelect(component.id);
    // Pointer deltas apply to authored geometry. Capturing it here keeps the
    // derived group offset out of the document and stable throughout the drag.
    gesture.current = { id: component.id, x: event.clientX, y: event.clientY, rect: editBox(component), corner, duplicate: event.altKey && !corner && !!component.rect, scale: root.current!.getBoundingClientRect().width / slide.canvas.width };
    clearPreview();
    if (!corner && !gesture.current.duplicate) preview.current = { document: draft, cssScale: parseFloat(getComputedStyle(root.current!).width) / slide.canvas.width, nodes: [] };
    if (!gesture.current.duplicate) holdGroup(component);
  }
  function move(event: ReactPointerEvent) {
    const node = nodeGesture.current;
    if (node) {
      const dx = (event.clientX - node.x) / node.scale, dy = (event.clientY - node.y) / node.scale;
      if (Math.hypot(dx, dy) >= 3) positionNode(node.componentId, node.nodeId, { x: node.position.x + dx, y: node.position.y + dy });
      return;
    }
    const active = gesture.current;
    if (!active) return;
    let component = slide.components.find(item => item.id === active.id); if (!component) return;
    const dx = (event.clientX - active.x) / active.scale, dy = (event.clientY - active.y) / active.scale;
    if (active.duplicate && Math.hypot(dx, dy) < 3) return;
    const proposed = active.corner ? resize(active.rect, dx, dy, active.corner) : { ...active.rect, x: active.rect.x + dx, y: active.rect.y + dy };
    if (preview.current) {
      preview.current.rect = constrain(proposed);
      if (!previewFrame.current) previewFrame.current = requestAnimationFrame(paintPreview);
      return;
    }
    const result = { rect: constrain(proposed, active.corner ? active.rect : undefined) };
    showGuides(active.id, result.rect);
    if (active.duplicate) { active.duplicate = false; component = onDuplicate?.(component.id, result.rect); if (!component) gesture.current = undefined; else active.id = component.id; return; }
    changed(component, result.rect);
  }
  function end() {
    const active = gesture.current, current = preview.current;
    gesture.current = undefined; nodeGesture.current = undefined;
    cancelAnimationFrame(previewFrame.current); previewFrame.current = 0;
    const component = active && slide.components.find(item => item.id === active.id);
    if (active && component && current?.rect && current.document === draft) {
      const rect = current.rect;
      if (rect.x !== active.rect.x || rect.y !== active.rect.y) changed(component, rect);
      else clearPreview();
    } else if (active) clearPreview();
    setHeldGroup(undefined); setGuides(current => current.length ? [] : current); onEditEnd();
  }
  function positionNode(componentId: string, nodeId: string, position?: { x: number; y: number }) {
    const component = slide.components.find(item => item.id === componentId);
    if (component?.kind !== "diagram" || !component.processFlow || !component.topology) return;
    onComponent({ ...component, topology: { ...component.topology, nodes: component.topology.nodes.map(node => {
      if (node.id !== nodeId) return node;
      const { position: _, ...rest } = node;
      return position ? { ...rest, position: { x: Math.round(position.x), y: Math.round(position.y) } } : rest;
    }) } }, `process-node:${componentId}:${nodeId}`);
  }
  function commitEdit() {
    if (!editing) return;
    const original = editing.component;
    if (original.kind === "text-block" && editing.value !== (original.content ?? "")) {
      const component = slide.components.find(item => item.id === original.id);
      if (component?.kind !== "text-block" || component.customVisual) {
        onNotice("This text component was removed or replaced. Your draft is still open; copy it before pressing Escape to cancel.");
        return;
      }
      if ((component.content ?? "") !== (original.content ?? "") && component.content !== editing.value) {
        onNotice("This text changed elsewhere. Your draft is still open; copy it before pressing Escape to load the latest text.");
        return;
      }
      if (component.content !== editing.value) onComponent({ ...component, content: editing.value }, `content:${component.id}`);
    }
    setEditing(undefined); onEditEnd();
  }
  function correct(component: CompositionComponent) {
    if (editing) { onNotice("Finish or cancel the open text draft first."); return; }
    if (component.kind === "text-block" && !component.customVisual) setEditing({ component, value: component.content ?? "" });
    else onComment?.(component.id);
  }
  function svgTarget(event: { target: EventTarget }) {
    return (event.target as Element).closest<SVGGraphicsElement>("[data-component]");
  }
  function selectArtwork(event: ReactPointerEvent) {
    if (!interactive) return;
    const target = svgTarget(event), componentId = target?.dataset.component;
    if (!componentId) { onSelect(); return; }
    event.stopPropagation(); onSelect(componentId);
  }
  const selectedComponent = slide.components.find(item => item.id === selected);
  const selectedScene = rendered.components.find(item => item.id === selected);
  function nudge(event: React.KeyboardEvent, component: CompositionComponent) {
    if (event.key === "Enter") {
      event.preventDefault(); onSelect(component.id);
      correct(component);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    holdGroup(component);
    const r = editBox(component);
    const dx = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const dy = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    const next = constrain({ ...r, x: r.x + dx, y: r.y + dy });
    changed(component, next);
  }
  function keyboardResize(event: React.KeyboardEvent, component: CompositionComponent, corner: Corner) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    holdGroup(component);
    const dx = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const dy = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    const original = editBox(component);
    const next = constrain(resize(original, dx, dy, corner), original);
    changed(component, next); onNotice(`Size ${Math.round(next.width)} by ${Math.round(next.height)}`);
  }

  return <section className="stage" style={{ "--page-ratio": slide.canvas.width / slide.canvas.height } as CSSProperties} tabIndex={interactive ? -1 : undefined} onPointerDown={event => { if (interactive && event.target === event.currentTarget) onSelect(); }}>
    <div className="slide-wrap">
      <div className="stage-meta"><span className="page-index" aria-hidden="true">{String(pageNumber).padStart(2, "0")}</span>{interactive && renaming ? <input aria-label="Page name" autoFocus value={name} onChange={e => setName(e.target.value)} onBlur={() => { if (name.trim()) onSlideName(name.trim()); setRenaming(false); }} onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} /> : <h2 onClick={() => interactive ? onSelect() : onComment?.()} onDoubleClick={() => { if (interactive) { setName(slide.name); setRenaming(true); } }}>{slide.name}</h2>}
      </div>
      <div ref={root} className={`canvas scene-canvas ${mode === "review" ? "review-canvas" : ""}${commentTarget && !commentTarget.componentId ? " comment-selected" : ""}`} style={{ aspectRatio: `${slide.canvas.width}/${slide.canvas.height}` }} aria-label="Page canvas" aria-busy={!markup || undefined}
        onPointerDown={selectArtwork} onDoubleClick={() => { if (interactive) onComment?.(); }} onPointerMove={move} onPointerUp={event => { if (preview.current) move(event); end(); }} onPointerCancel={end} onLostPointerCapture={end}
        onBlur={() => { if (!gesture.current && !nodeGesture.current) end(); }}
        onKeyUp={event => { if (event.key.startsWith("Arrow")) end(); }}>
        {renderError ? <p className="scene-error" role="alert">{renderError}</p> : <div className="scene-artwork" dangerouslySetInnerHTML={artwork} />}
        {mode === "review" && <button type="button" className="page-comment-hit" aria-label={`Comment on page: ${slide.name}`} onClick={() => onComment?.()} />}
        {interactive && heldGroup && <div className="group-area-outline" aria-hidden="true" style={{ left: `${heldGroup.area.x/slide.canvas.width*100}%`, top: `${heldGroup.area.y/slide.canvas.height*100}%`, width: `${heldGroup.area.width/slide.canvas.width*100}%`, height: `${heldGroup.area.height/slide.canvas.height*100}%` }} />}
        {slide.paintOrder.map(id => slide.components.find(component => component.id === id)!).map(component => <button key={component.id} type="button" data-component={component.id} className={`component-hit ${selected === component.id || commentTarget?.componentId === component.id ? "selected" : ""}`} style={{ left: `${box(component).x/slide.canvas.width*100}%`, top: `${box(component).y/slide.canvas.height*100}%`, width: `${box(component).width/slide.canvas.width*100}%`, height: `${box(component).height/slide.canvas.height*100}%` }} aria-label={`${interactive ? "Select" : "Comment on"} ${componentInstanceLabel(slide.components, component.id)}`} aria-pressed={selected === component.id || commentTarget?.componentId === component.id}
          title={interactive ? "Drag or use arrow keys to move · Delete to remove · Double-click text to edit" : "Click to comment"}
          onPointerDown={event => { if (interactive) start(event, component); }} onClick={event => { if (!interactive) onComment?.(component.id); else if (event.detail === 0) onSelect(component.id); }} onDoubleClick={event => { event.stopPropagation(); if (interactive) correct(component); }} onKeyDown={event => { if (interactive) nudge(event, component); }} />)}
        {interactive && selectedComponent?.rect && (["nw","ne","sw","se"] as Corner[]).map(corner => <button key={corner} type="button" className={`resize-handle resize-${corner}`} style={{ left: `${(box(selectedComponent).x + (corner.endsWith("e") ? box(selectedComponent).width : 0))/slide.canvas.width*100}%`, top: `${(box(selectedComponent).y + (corner.startsWith("s") ? box(selectedComponent).height : 0))/slide.canvas.height*100}%` }} aria-label={`Resize ${componentInstanceLabel(slide.components, selectedComponent.id)} from ${corner}`} onPointerDown={event => start(event, selectedComponent, corner)} onKeyDown={event => keyboardResize(event, selectedComponent, corner)} />)}
        {interactive && selectedComponent && selectedScene?.processNodes?.map(node => <button key={node.id} type="button" className="component-hit process-node-hit" data-process-node={node.id}
          aria-label={`Move step: ${node.label}`} title="Drag or use arrow keys to pin this step. Delete resets automatic placement."
          style={{ left: `${node.box.x/slide.canvas.width*100}%`, top: `${node.box.y/slide.canvas.height*100}%`, width: `${node.box.width/slide.canvas.width*100}%`, height: `${node.box.height/slide.canvas.height*100}%` }}
          onPointerDown={event => {
            if (event.button !== 0) return;
            event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); holdGroup(selectedComponent);
            nodeGesture.current = { componentId: selectedComponent.id, nodeId: node.id, x: event.clientX, y: event.clientY,
              position: { x: node.box.x - selectedScene.contentBox.x, y: node.box.y - selectedScene.contentBox.y },
              scale: root.current!.getBoundingClientRect().width / slide.canvas.width };
          }}
          onDoubleClick={event => event.stopPropagation()}
          onKeyDown={event => {
            if (["Delete", "Backspace"].includes(event.key)) {
              event.preventDefault(); event.stopPropagation(); positionNode(selectedComponent.id, node.id); onEditEnd();
              onNotice(`Automatic placement restored for ${node.label}`); return;
            }
            if (!event.key.startsWith("Arrow")) return;
            event.preventDefault(); event.stopPropagation(); holdGroup(selectedComponent);
            const step = 1;
            positionNode(selectedComponent.id, node.id, {
              x: node.box.x - selectedScene.contentBox.x + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0),
              y: node.box.y - selectedScene.contentBox.y + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0),
            });
          }} />)}
        {editing && <textarea className="scene-text-editor" aria-label={`Edit ${componentInstanceLabel(slide.components, editing.component.id)}`} autoFocus value={editing.value} style={{ left: `${box(editing.component).x/slide.canvas.width*100}%`, top: `${box(editing.component).y/slide.canvas.height*100}%`, width: `${box(editing.component).width/slide.canvas.width*100}%`, height: `${box(editing.component).height/slide.canvas.height*100}%` }} onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} onChange={e => setEditing({ ...editing, value: e.target.value })} onBlur={commitEdit} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); setEditing(undefined); } }} />}
        {interactive && guides.map(guide => <i key={guide.axis} aria-hidden="true" className={`guide guide-${guide.axis}`} style={guide.axis === "x" ? { left: `${guide.value/slide.canvas.width*100}%` } : { top: `${guide.value/slide.canvas.height*100}%` }} />)}
        {revisionNotes.map((note,index) => {
          const component = slide.components.find(item => item.id === note.componentId);
          if (note.slideId !== slide.id || note.resolved || note.componentId && !component) return null;
          const r = component && box(component);
          const previous = revisionNotes.slice(0, index).filter(item => !item.resolved && item.slideId === note.slideId && item.componentId === note.componentId).length;
          return <button key={note.id} type="button" className="revision-pin" data-component={note.componentId} style={{ left: r ? `clamp(0px, calc(${(r.x+r.width)/slide.canvas.width*100}% - ${64 + previous * 44}px), calc(100% - 40px))` : `${3 + previous * 44}px`, top: r ? `max(0px, calc(${r.y/slide.canvas.height*100}% - 32px))` : "3px" }} aria-label={`Revision note ${index+1}: ${note.text}`} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onSelectNote?.(note); }}>{index+1}</button>;
        })}
      </div>
    </div>
  </section>;
}
