import { useState } from "react";
import type { CompositionDocument } from "../../composition/types.ts";
import { componentInstanceLabel } from "../lib/model.ts";
import { activeRequest, type ReviewState, type ReviewTarget } from "../lib/review.ts";

export function RevisionNotes({ document, target, review, disabled, onAdd, onRemove, onSelect, onNotice }: {
  document: CompositionDocument;
  target: ReviewTarget;
  review: ReviewState;
  disabled: boolean;
  onAdd: (target: ReviewTarget, text: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onSelect: (target: ReviewTarget) => void;
  onNotice: (message: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const key = JSON.stringify(target);
  const text = drafts[key] ?? "";
  function label(value: ReviewTarget) {
    const slide = document.slides.find(s => s.id === value.slideId);
    if (!slide) return "Deleted page";
    const component = slide.components.find(c => c.id === value.componentId);
    if (value.componentId && !component) return `${slide.name} · Deleted component`;
    const name = component ? componentInstanceLabel(slide.components, component.id) : "Page";
    const element = value.elementId && component?.customVisual?.format === "vector"
      ? component.customVisual.elements.find(e => e.id === value.elementId) : undefined;
    return `${slide.name} · ${name}${value.elementId ? ` · ${element ? value.elementId : "Deleted element"}` : ""}`;
  }
  async function run(action: () => Promise<void>) {
    setSaving(true);
    try { await action(); onNotice(""); }
    catch (error) { onNotice(error instanceof Error ? error.message : "Could not save revision note"); }
    finally { setSaving(false); }
  }
  const pending = review.notes.filter(n => !n.resolved);
  return <section className="revision-notes" aria-label="Revision notes">
    <form onSubmit={event => { event.preventDefault(); void run(async () => {
      await onAdd(target, text);
      setDrafts(current => ({ ...current, [key]: current[key] === text ? "" : current[key] }));
    }); }}>
      <label htmlFor="revision-note">Request a change</label>
      <p className="revision-note-scope">{label(target)}</p>
      <textarea id="revision-note" value={text} maxLength={4000} rows={3} placeholder="Describe what to change…" disabled={disabled || saving}
        onChange={event => setDrafts(current => ({ ...current, [key]: event.target.value }))} />
      <div className="revision-note-submit"><button type="submit" disabled={disabled || saving || !text.trim()}>{saving ? "Saving…" : "Add note"}</button></div>
    </form>
    <p className="revision-note-count">{pending.length} pending</p>
    {pending.length > 0 && <ol className="revision-note-list">{pending.map((note, i) => <li key={note.id} id={`note-${note.id}`}>
      <button type="button" className="revision-note-target" onClick={() => onSelect(note)}><span>{i + 1}</span>{label(note)}</button>
      <p>{note.text}</p>
      <button type="button" className="revision-note-remove" disabled={disabled || saving || activeRequest(review.request)} aria-label={`Remove note ${i + 1}`} onClick={() => { void run(() => onRemove(note.id)); }}>Remove</button>
    </li>)}</ol>}
  </section>;
}
