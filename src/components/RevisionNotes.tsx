import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CompositionDocument } from "../../composition/runtime.ts";
import { componentInstanceLabel } from "../lib/model.ts";
import type { RevisionNote, ReviewState, ReviewTarget } from "../lib/review.ts";
import { reviewPosition } from "../lib/review-position.ts";

export function RevisionNotes({ document, open, target, editId, review, disabled, storageBlocked, onAdd, onPreparePrompt, onCopied, onRemove, onSelect, onNew, onEdit, onClose }: {
  document: CompositionDocument;
  open: boolean;
  target?: ReviewTarget;
  editId?: string;
  review: ReviewState;
  disabled: boolean;
  storageBlocked: boolean;
  onAdd: (target: ReviewTarget, text: string, editId?: string) => void;
  onPreparePrompt: () => string;
  onCopied: (notes: RevisionNote[]) => void;
  onRemove: (id: string) => void;
  onSelect: (target: ReviewTarget) => void;
  onNew: () => void;
  onEdit: (note: RevisionNote) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState("");
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const key = !open ? "closed" : target ? JSON.stringify([target.slideId, target.componentId, target.elementId, editId]) : "pending";
  const activeKey = useRef(key);
  activeKey.current = key;
  const copied = useRef(onCopied);
  copied.current = onCopied;
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const editing = editId ? review.notes.find(note => note.id === editId && !note.resolved) : undefined;
  const text = drafts[key] ?? editing?.text ?? "";
  useLayoutEffect(() => {
    const popup = panel.current;
    if (!open || !target || !popup) return;
    const page = window.document.querySelector(`[data-page="${CSS.escape(target.slideId)}"]`);
    const anchor = (target.componentId && page?.querySelector(`.component-hit[data-component="${CSS.escape(target.componentId)}"]`)) || page?.querySelector(".scene-canvas");
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth)
      anchor.scrollIntoView({ block: "center", inline: "nearest" });
    let frame = 0;
    const view = window.visualViewport;
    function place() {
      const viewport = { x: view?.offsetLeft ?? 0, y: view?.offsetTop ?? 0, width: view?.width ?? window.innerWidth, height: view?.height ?? window.innerHeight };
      const launcher = window.document.querySelector(".review-launcher")?.getBoundingClientRect();
      if (launcher && launcher.top > viewport.y) viewport.height = Math.min(viewport.height, launcher.top - viewport.y);
      popup!.style.maxHeight = `${Math.max(0, viewport.height - 32)}px`;
      popup!.style.maxWidth = `${Math.max(0, viewport.width - 32)}px`;
      const position = reviewPosition(anchor!.getBoundingClientRect(), popup!.getBoundingClientRect(), viewport);
      Object.assign(popup!.style, { left: `${position.left}px`, top: `${position.top}px`, right: "auto", bottom: "auto" });
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(place); }
    place();
    const resize = new ResizeObserver(schedule);
    resize.observe(popup); resize.observe(anchor);
    // CSS zoom and page reflow can move an anchor without resizing its layout box.
    const layout = new MutationObserver(schedule);
    const board = anchor.closest(".page-board-content");
    if (board) layout.observe(board, { attributes: true, subtree: true, attributeFilter: ["style"] });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    view?.addEventListener("resize", schedule);
    view?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); layout.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      view?.removeEventListener("resize", schedule);
      view?.removeEventListener("scroll", schedule);
      popup.removeAttribute("style");
    };
  }, [open, key, document]);
  useEffect(() => {
    setError(""); setFallback(""); panel.current?.scrollTo(0, 0);
    (input.current ?? panel.current)?.focus({ preventScroll: true });
  }, [key]);
  useEffect(() => { if (fallback) { promptInput.current?.focus(); promptInput.current?.select(); } }, [fallback]);
  if (!open) return null;
  function label(value: ReviewTarget) {
    const slide = document.pages.find(s => s.id === value.slideId);
    if (!slide) return "Deleted page";
    const component = slide.components.find(c => c.id === value.componentId);
    if (value.componentId && !component) return `${slide.name} · Deleted component`;
    const name = component ? componentInstanceLabel(slide.components, component.id) : "Page";
    const element = value.elementId && component?.customVisual?.format === "vector"
      ? component.customVisual.elements.find(e => e.id === value.elementId) : undefined;
    return `${slide.name} · ${name}${value.elementId ? ` · ${element ? value.elementId : "Deleted element"}` : ""}`;
  }
  function run(action: () => void) {
    if (saving || disabled || storageBlocked) return;
    try { action(); setError(""); setFallback(""); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save comment"); }
  }
  const pending = review.notes.filter(n => !n.resolved);
  const current = editId ? [] : target ? pending.filter(note => note.slideId === target.slideId && note.componentId === target.componentId && note.elementId === target.elementId) : pending;
  const page = document.pages.find(page => page.id === target?.slideId);
  const component = page?.components.find(component => component.id === target?.componentId);
  const stale = Boolean(editId && !editing) || (target && (!page || Boolean(target.componentId && !component) || Boolean(target.elementId && (component?.customVisual?.format !== "vector" || !component.customVisual.elements.some(element => element.id === target.elementId)))));
  function noteItem(note: RevisionNote) {
    const number = pending.indexOf(note) + 1;
    return <li key={note.id} id={`note-${note.id}`}>
      {target ? <span className="revision-note-number">{number}</span> : <button type="button" className="revision-note-target" title={label(note)} onClick={() => onSelect(note)}><span className="revision-note-number">{number}</span><span>{label(note)}</span></button>}
      <p>{note.text}</p>
      <div className="revision-note-actions">
        <button type="button" disabled={disabled || storageBlocked || saving} aria-label={`Edit comment ${number}`} title="Edit comment" onClick={() => onEdit(note)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14v6Z" /></svg></button>
        <button type="button" className="revision-note-remove" disabled={disabled || storageBlocked || saving} aria-label={`Remove comment ${number}`} title="Remove comment" onClick={() => run(() => onRemove(note.id))}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
      </div>
    </li>;
  }
  async function copyPrompt() {
    if (saving || !pending.length) return;
    setSaving(true); setError(""); setFallback("");
    let prompt = "";
    try {
      prompt = onPreparePrompt();
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(prompt);
      if (mounted.current) copied.current(pending);
    } catch (error) {
      if (activeKey.current !== key) return;
      if (prompt) {
        setFallback(prompt);
        setError("Clipboard unavailable. Copy below.");
      } else setError(error instanceof Error ? error.message : "Could not copy prompt");
    } finally { setSaving(false); }
  }
  return <section key={key} ref={panel} id="revision-notes" className={`revision-notes${target ? " comment-composer" : ""}`} role="dialog" aria-labelledby="comment-heading" aria-busy={saving} tabIndex={-1}>
    <header className={target ? undefined : "sr-only"}><h2 id="comment-heading" className={target ? "revision-note-scope" : undefined} title={target ? label(target) : undefined}>{target ? label(target) : "Pending reviews"}</h2></header>
    {current.length > 0 && <ol className={`revision-note-list${target ? " current-comments" : ""}`} aria-label={target ? "Comments on this target" : "Pending reviews"}>{current.map(noteItem)}</ol>}
    {!target && !pending.length && <p className="review-empty">No pending comments</p>}
    {target && <form onSubmit={event => {
      event.preventDefault();
      run(() => {
        if (stale || !text.trim() || text.length > 4000) throw new Error("Select a target and write a comment of 1–4000 characters.");
        onAdd(target, text, editId);
        setDrafts(current => { const next = { ...current }; delete next[key]; return next; });
      });
    }}>
      <label htmlFor="revision-note" className="sr-only">What should change?</label>
      <textarea ref={input} id="revision-note" value={text} maxLength={4000} rows={3} placeholder="Leave a comment…" readOnly={saving}
        onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
        onChange={event => { setFallback(""); setError(""); setDrafts(current => ({ ...current, [key]: event.target.value })); }} />
      {stale && <p className="comment-error">This comment or target was deleted.</p>}
      <div className="revision-note-submit"><button type="button" className="review-secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary" aria-label={editId ? "Save comment" : "Add comment"} title="Ctrl/⌘ Enter" disabled={disabled || saving || stale || storageBlocked || !text.trim()}>{!editId && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>}{editId ? "Save" : "Add"}</button></div>
    </form>}
    {error && <p role="alert" className="comment-error">{error}</p>}
    {fallback && <label className="comment-copy-fallback">Prompt to copy<textarea ref={promptInput} value={fallback} readOnly rows={6} onFocus={event => event.currentTarget.select()} /></label>}
    {!target && <footer className="review-actions"><button type="button" className="review-secondary" disabled={saving} onClick={onNew}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>New comment</button><button type="button" className="primary" disabled={saving || !pending.length} onClick={() => { void copyPrompt(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3" /></svg>{saving ? "Copying…" : "Copy & clear"}</button></footer>}
  </section>;
}
