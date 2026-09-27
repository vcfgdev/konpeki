import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CompositionComponent, Rect, VectorElement } from "../../composition/runtime.ts";
import { areaRect, gridMetrics, snapArea, toComposition } from "../../composition/grid.ts";
import { lowerPage } from "../../composition/lower.ts";
import { renderSVG } from "../../composition/svg.ts";
import type { ScenePage } from "../../composition/scene.ts";
import { componentInstanceLabel, getSlide, snapRect, snapResizeRect, transformComponentRect, type Draft, type Guide } from "../lib/model.ts";
import { sceneFonts } from "../lib/scene-fonts.ts";
import type { RevisionNote } from "../lib/review.ts";

type Corner = "nw" | "ne" | "sw" | "se";
type Props = {
  mode?: "edit" | "present"; draft: Draft; activeSlideId: string; selected?: string;
  vectorSelection?: { componentId: string; elementId?: string };
  onSelect: (id?: string) => void;
  onVectorSelect?: (selection?: { componentId: string; elementId?: string }, edit?: boolean) => void;
  onSlideName: (name: string) => void;
  onComponent: (component: CompositionComponent, mergeKey?: string) => void;
  onDuplicate?: (id: string, rect: Rect) => CompositionComponent | undefined;
  onEditEnd: () => void;
  onAdd: (kind: CompositionComponent["kind"], at: { x: number; y: number }) => void;
  onNotice: (message: string) => void;
  revisionNotes?: RevisionNote[]; onSelectNote?: (note: RevisionNote) => void;
};

const resize = (r: Rect, dx: number, dy: number, c: Corner): Rect => ({
  x: c.endsWith("w") ? r.x + dx : r.x, y: c.startsWith("n") ? r.y + dy : r.y,
  width: r.width + (c.endsWith("w") ? -dx : dx), height: r.height + (c.startsWith("n") ? -dy : dy),
});

export function Canvas({ mode = "edit", draft, activeSlideId, selected, vectorSelection, onSelect, onVectorSelect, onSlideName, onComponent, onDuplicate, onEditEnd, onAdd, onNotice, revisionNotes = [], onSelectNote }: Props) {
  const interactive = mode === "edit", slide = getSlide(draft, activeSlideId);
  const root = useRef<HTMLDivElement>(null);
  const sceneId = useId();
  const [rendered, setRendered] = useState<{ markup: string; components: ScenePage["components"] }>({ markup: "", components: [] });
  const { markup } = rendered;
  const [renderError, setRenderError] = useState("");
  const [guides, setGuides] = useState<Guide[]>([]);
  const [heldGroup, setHeldGroup] = useState<{ id: string; offset: number; area: Rect }>();
  const [editing, setEditing] = useState<{ component: CompositionComponent; value: string }>();
  const [renaming, setRenaming] = useState(false), [name, setName] = useState(slide.name);
  const gesture = useRef<{ id: string; x: number; y: number; rect: Rect; scale: number; corner?: Corner; duplicate?: boolean } | undefined>(undefined);
  const lineGesture = useRef<{ pointerId: number; endpoint: "start" | "end"; line: VectorElement; screenInverse: DOMMatrix } | undefined>(undefined);

  useEffect(() => {
    let stale = false;
    setRenderError("");
    void sceneFonts().then(fonts => {
      const document = toComposition(draft);
      const page = document.slides.find(item => item.id === activeSlideId)!;
      const scene = lowerPage(document, page, fonts, heldGroup && new Map([[heldGroup.id, heldGroup.offset]]));
      const next = renderSVG(scene, fonts, undefined, sceneId);
      if (!stale) setRendered({ markup: next, components: scene.components });
    }).catch(error => !stale && setRenderError(error instanceof Error ? error.message : "Scene rendering failed."));
    return () => { stale = true; };
  }, [draft, activeSlideId, sceneId, heldGroup]);

  useEffect(() => {
    window.addEventListener("blur", end);
    return () => window.removeEventListener("blur", end);
  }, [onEditEnd]);

  const box = (component: CompositionComponent) => rendered.components.find(item => item.id === component.id)?.box ?? component.preferredRect;
  function holdGroup(component: CompositionComponent) {
    const group = slide.groups.find(group => group.area && group.verticalAlignment && group.childIds.includes(component.id));
    if (!group || !slide.grid) return;
    const held = { id: group.id, offset: box(component).y - component.preferredRect.y, area: areaRect(slide.grid, group.area!) };
    setHeldGroup(current => current ?? held);
  }
  function changed(component: CompositionComponent, rect: Rect) {
    onComponent(transformComponentRect(component, component.preferredRect, rect, slide.grid), `geometry:${component.id}`);
  }
  function start(event: ReactPointerEvent, component: CompositionComponent, corner?: Corner) {
    if (event.button !== 0) return;
    event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onSelect(component.id);
    // Pointer deltas apply to authored geometry. Capturing it here keeps the
    // derived group offset out of the document and stable throughout the drag.
    gesture.current = { id: component.id, x: event.clientX, y: event.clientY, rect: component.preferredRect, corner, duplicate: event.altKey && !corner, scale: root.current!.getBoundingClientRect().width / slide.canvas.width };
    if (!gesture.current.duplicate) holdGroup(component);
  }
  function move(event: ReactPointerEvent) {
    const active = gesture.current;
    if (!active) return;
    let component = slide.components.find(item => item.id === active.id); if (!component) return;
    const dx = (event.clientX - active.x) / active.scale, dy = (event.clientY - active.y) / active.scale;
    if (active.duplicate && Math.hypot(dx, dy) < 3) return;
    const proposed = active.corner ? resize(active.rect, dx, dy, active.corner) : { ...active.rect, x: active.rect.x + dx, y: active.rect.y + dy };
    const others = slide.components.filter(item => item.id !== active.id).map(box);
    const result = slide.grid ? { rect: areaRect(slide.grid, snapArea(slide.grid, proposed)), guides: [] } : active.corner
      ? snapResizeRect(proposed, others, 14, { left: active.corner.endsWith("w"), right: active.corner.endsWith("e"), top: active.corner.startsWith("n"), bottom: active.corner.startsWith("s") }, slide.canvas, slide.innerPadding)
      : snapRect(proposed, others, 14, slide.canvas, slide.innerPadding);
    setGuides(result.guides);
    if (active.duplicate) { active.duplicate = false; component = onDuplicate?.(component.id, result.rect); if (!component) gesture.current = undefined; else active.id = component.id; return; }
    changed(component, result.rect);
  }
  function end() { gesture.current = undefined; lineGesture.current = undefined; setHeldGroup(undefined); setGuides([]); onEditEnd(); }
  function commitEdit() {
    if (!editing) return;
    const component = editing.component;
    onComponent(component.kind === "text-block" ? { ...component, content: editing.value } : { ...component, intent: editing.value }, `${component.kind === "text-block" ? "content" : "intent"}:${component.id}`);
    setEditing(undefined); onEditEnd();
  }
  function svgTarget(event: { target: EventTarget }) {
    return (event.target as Element).closest<SVGGraphicsElement>("[data-component]");
  }
  function selectArtwork(event: ReactPointerEvent) {
    if (!interactive) return;
    const target = svgTarget(event), componentId = target?.dataset.component;
    if (!componentId) { onSelect(); return; }
    event.stopPropagation(); onSelect(componentId);
    if (vectorSelection?.componentId === componentId && target?.dataset.vectorElement) onVectorSelect?.({ componentId, elementId: target.dataset.vectorElement });
  }
  const selectedComponent = slide.components.find(item => item.id === selected);
  const selectedLine = selectedComponent?.customVisual?.format === "vector" && vectorSelection?.componentId === selected
    ? selectedComponent.customVisual.elements.find(item => item.id === vectorSelection?.elementId && item.kind === "line" && !item.parentId) : undefined;
  function linePoint(line: VectorElement, endpoint: "start" | "end") {
    const rendered = root.current?.querySelector<SVGGraphicsElement>(`[data-component="${CSS.escape(selected!)}"][data-vector-element="${CSS.escape(line.id)}"] line`);
    const sceneRoot = rendered?.ownerSVGElement;
    if (!rendered || !sceneRoot) return;
    const screen = new DOMPoint(Number(line.attributes[endpoint === "start" ? "x1" : "x2"] ?? 0), Number(line.attributes[endpoint === "start" ? "y1" : "y2"] ?? 0)).matrixTransform(rendered.getScreenCTM()!);
    return screen.matrixTransform(sceneRoot.getScreenCTM()!.inverse());
  }
  function moveLine(event: ReactPointerEvent<SVGCircleElement>) {
    const active = lineGesture.current; if (!active || active.pointerId !== event.pointerId || !selectedComponent) return;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(active.screenInverse);
    const x = active.endpoint === "start" ? "x1" : "x2", y = active.endpoint === "start" ? "y1" : "y2";
    const updated: VectorElement = { ...active.line, attributes: { ...active.line.attributes, [x]: Math.round(local.x), [y]: Math.round(local.y) } };
    const visual = selectedComponent.customVisual;
    if (visual?.format !== "vector") return;
    onComponent({ ...selectedComponent, customVisual: { ...visual, elements: visual.elements.map(item => item.id === updated.id ? updated : item) } } as CompositionComponent, `vector:${selectedComponent.id}:${updated.id}`);
  }
  function nudge(event: React.KeyboardEvent, component: CompositionComponent) {
    if (event.key === "Enter") {
      event.preventDefault(); onSelect(component.id);
      if (component.customVisual) onVectorSelect?.({ componentId: component.id });
      else setEditing({ component, value: component.kind === "text-block" ? component.content ?? "" : component.intent ?? "" });
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    holdGroup(component);
    const r = component.preferredRect;
    const metrics = slide.grid && gridMetrics(slide.grid);
    const dx = event.key === "ArrowRight" ? metrics ? metrics.columnWidth + metrics.gutter : 10 : event.key === "ArrowLeft" ? metrics ? -metrics.columnWidth - metrics.gutter : -10 : 0;
    const dy = event.key === "ArrowDown" ? metrics?.baseline ?? 10 : event.key === "ArrowUp" ? -(metrics?.baseline ?? 10) : 0;
    const next = snapRect({ ...r, x: r.x + dx, y: r.y + dy }, [], 0, slide.canvas, slide.innerPadding).rect;
    changed(component, next);
  }
  function keyboardResize(event: React.KeyboardEvent, component: CompositionComponent, corner: Corner) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    holdGroup(component);
    const metrics = slide.grid && gridMetrics(slide.grid);
    const dx = event.key === "ArrowRight" ? metrics ? metrics.columnWidth + metrics.gutter : 10 : event.key === "ArrowLeft" ? metrics ? -metrics.columnWidth - metrics.gutter : -10 : 0;
    const dy = event.key === "ArrowDown" ? metrics?.baseline ?? 10 : event.key === "ArrowUp" ? -(metrics?.baseline ?? 10) : 0;
    const next = snapResizeRect(resize(component.preferredRect, dx, dy, corner), [], 0, { left: corner.endsWith("w"), right: corner.endsWith("e"), top: corner.startsWith("n"), bottom: corner.startsWith("s") }, slide.canvas, slide.innerPadding).rect;
    changed(component, next); onNotice(`Size ${Math.round(next.width)} by ${Math.round(next.height)}`);
  }

  return <main id="canvas-stage" className="stage" tabIndex={interactive ? -1 : undefined} onPointerDown={event => { if (event.target === event.currentTarget) onSelect(); }}>
    <div className="slide-wrap">
      {interactive && <div className="stage-meta">{renaming ? <input aria-label="Page name" autoFocus value={name} onChange={e => setName(e.target.value)} onBlur={() => { if (name.trim()) onSlideName(name.trim()); setRenaming(false); }} onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} /> : <h2 onClick={() => onSelect()} onDoubleClick={() => { setName(slide.name); setRenaming(true); }}>{slide.name}</h2>}
        {selectedComponent?.customVisual?.format === "vector" && <button type="button" className="edit-elements-action" aria-pressed={vectorSelection?.componentId === selected} onClick={() => onVectorSelect?.(vectorSelection?.componentId === selected ? undefined : { componentId: selectedComponent.id })}>{vectorSelection?.componentId === selected ? "Done editing" : "Edit elements"}</button>}
      </div>}
      <div ref={root} className={`canvas scene-canvas ${interactive ? "" : "presentation-canvas"}`} style={{ aspectRatio: `${slide.canvas.width}/${slide.canvas.height}` }} aria-label="Page canvas" aria-busy={!markup || undefined}
        onPointerDown={selectArtwork} onDoubleClick={event => { const target = svgTarget(event); const componentId = target?.dataset.component, elementId = target?.dataset.vectorElement; if (componentId && elementId) { event.stopPropagation(); onSelect(componentId); onVectorSelect?.({ componentId, elementId }, true); } }} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
        onBlur={() => { if (!gesture.current && !lineGesture.current) end(); }}
        onKeyUp={event => { if (event.key.startsWith("Arrow")) end(); }}
        onDragOver={event => { if (interactive) event.preventDefault(); }} onDrop={event => { if (!interactive) return; event.preventDefault(); const kind = event.dataTransfer.getData("application/konpeki-component") as CompositionComponent["kind"]; const r = event.currentTarget.getBoundingClientRect(); onAdd(kind, { x: (event.clientX-r.left)/r.width*slide.canvas.width, y: (event.clientY-r.top)/r.height*slide.canvas.height }); }}>
        {renderError ? <p className="scene-error" role="alert">{renderError}</p> : <div className="scene-artwork" dangerouslySetInnerHTML={{ __html: markup }} />}
        {interactive && heldGroup && <div className="group-area-outline" aria-hidden="true" style={{ left: `${heldGroup.area.x/slide.canvas.width*100}%`, top: `${heldGroup.area.y/slide.canvas.height*100}%`, width: `${heldGroup.area.width/slide.canvas.width*100}%`, height: `${heldGroup.area.height/slide.canvas.height*100}%` }} />}
        {interactive && slide.paintOrder.map(id => slide.components.find(component => component.id === id)!).map(component => <button key={component.id} type="button" data-component={component.id} className={`component-hit ${selected === component.id ? "selected" : ""} ${vectorSelection?.componentId === component.id ? "element-editing" : ""}`} style={{ left: `${box(component).x/slide.canvas.width*100}%`, top: `${box(component).y/slide.canvas.height*100}%`, width: `${box(component).width/slide.canvas.width*100}%`, height: `${box(component).height/slide.canvas.height*100}%` }} aria-label={`Select ${componentInstanceLabel(slide.components, component.id)}`} aria-pressed={selected === component.id}
          onPointerDown={event => start(event, component)} onDoubleClick={event => { event.stopPropagation(); setEditing({ component, value: component.kind === "text-block" ? component.content ?? "" : component.intent ?? "" }); }} onKeyDown={event => nudge(event, component)} />)}
        {interactive && selectedComponent && (["nw","ne","sw","se"] as Corner[]).map(corner => <button key={corner} type="button" className={`resize-handle resize-${corner}`} style={{ left: `${(box(selectedComponent).x + (corner.endsWith("e") ? box(selectedComponent).width : 0))/slide.canvas.width*100}%`, top: `${(box(selectedComponent).y + (corner.startsWith("s") ? box(selectedComponent).height : 0))/slide.canvas.height*100}%` }} aria-label={`Resize ${componentInstanceLabel(slide.components, selectedComponent.id)} from ${corner}`} onPointerDown={event => start(event, selectedComponent, corner)} onKeyDown={event => keyboardResize(event, selectedComponent, corner)} />)}
        {editing && <textarea className="scene-text-editor" aria-label={`Edit ${componentInstanceLabel(slide.components, editing.component.id)}`} autoFocus value={editing.value} style={{ left: `${box(editing.component).x/slide.canvas.width*100}%`, top: `${box(editing.component).y/slide.canvas.height*100}%`, width: `${box(editing.component).width/slide.canvas.width*100}%`, height: `${box(editing.component).height/slide.canvas.height*100}%` }} onPointerDown={e => e.stopPropagation()} onChange={e => setEditing({ ...editing, value: e.target.value })} onBlur={commitEdit} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); setEditing(undefined); } }} />}
        {interactive && selectedComponent && selectedLine && <svg className="line-handles" viewBox={`0 0 ${slide.canvas.width} ${slide.canvas.height}`}>{(["start","end"] as const).map(endpoint => { const point = linePoint(selectedLine, endpoint); return point && <circle key={endpoint} cx={point.x} cy={point.y} r="9" tabIndex={0} aria-label={`${endpoint} endpoint`} onPointerDown={event => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); const rendered = root.current!.querySelector<SVGGraphicsElement>(`[data-component="${CSS.escape(selected!)}"][data-vector-element="${CSS.escape(selectedLine.id)}"] line`)!; lineGesture.current = { pointerId: event.pointerId, endpoint, line: selectedLine, screenInverse: rendered.getScreenCTM()!.inverse() }; holdGroup(selectedComponent); }} onPointerMove={moveLine} />; })}</svg>}
        {interactive && guides.map((guide,index) => <i key={index} className={`guide guide-${guide.axis}`} style={guide.axis === "x" ? { left: `${guide.value/slide.canvas.width*100}%` } : { top: `${guide.value/slide.canvas.height*100}%` }} />)}
        {interactive && revisionNotes.map((note,index) => {
          const component = slide.components.find(item => item.id === note.componentId);
          if (note.slideId !== slide.id || note.resolved || note.componentId && !component) return null;
          const r = component && box(component);
          const previous = revisionNotes.slice(0, index).filter(item => !item.resolved && item.slideId === note.slideId && item.componentId === note.componentId).length;
          return <button key={note.id} type="button" className="revision-pin" style={{ left: r ? `clamp(0px, calc(${(r.x+r.width)/slide.canvas.width*100}% - ${64 + previous * 44}px), calc(100% - 40px))` : `${3 + previous * 44}px`, top: r ? `max(0px, calc(${r.y/slide.canvas.height*100}% - 32px))` : "3px" }} aria-label={`Revision note ${index+1}: ${note.text}`} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onSelectNote?.(note); }}>{index+1}</button>;
        })}
      </div>
    </div>
  </main>;
}
