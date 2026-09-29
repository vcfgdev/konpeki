import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PageBoard } from "../src/components/PageBoard.tsx";
import { reviewPosition } from "../src/lib/review-position.ts";
import { referenceGuides, type Guide } from "../src/lib/alignment.ts";
import { inspectHTMLPage, type Diagnostic } from "./inspect.ts";
import { documentHTML } from "./document.ts";
import { examples } from "./examples.ts";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "../src/styles/base.css";
import "../src/styles/shell.css";
import "../src/styles/feedback.css";
import "./preview.css";

type Snapshot = { source: string; revision: string; name: string; key: string; pages: string[] };
type Target = { page: string; id: string };
type Note = Target & { key: string; text: string };
type Page = { id: string; name: string; canvas: { width: number; height: number } };
type Correction = Target & ({ kind: "move"; style: string } | { kind: "delete" });
const token = new URLSearchParams(location.search).get("session") ?? "";
const example = examples.find(item => item.id === new URLSearchParams(location.search).get("example")) ?? examples[0];
async function request(edit?: unknown, revision?: string): Promise<Snapshot> {
  if (!token) {
    if (edit) throw new Error("Open a local CLI preview to save source corrections.");
    const doc = new DOMParser().parseFromString(example.source, "text/html");
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(example.source));
    return { source: example.source, revision: Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join(""), name: `examples/${example.id}/document.html`, key: `example:${example.id}`, pages: Array.from(doc.querySelectorAll("body > [data-page]"), page => page.id) };
  }
  const response = await fetch("/__konpeki/html", { method: edit ? "PATCH" : "GET", headers: { "x-konpeki-session": token, "Content-Type": "application/json" }, ...(edit ? { body: JSON.stringify({ edit, revision }) } : {}) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  return body;
}
function HTMLPage({ page, revision, source, notes, selected, commenting, locked, onSize, onSelect, onComment, onEdit, onBusy, onBlocked }: {
  page: Page; revision: string; source?: string; notes: Note[]; selected?: Target; commenting: boolean; locked: boolean;
  onSize: (width: number, height: number) => void; onSelect: (target?: Target) => void;
  onComment: (target: Target, anchor: DOMRect) => void; onEdit: (edit: Correction) => void; onBusy: (busy: boolean) => void;
  onBlocked: (message: string) => void;
}) {
  const outer = useRef<HTMLDivElement>(null), frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1), [ready, setReady] = useState(false), [tick, redraw] = useState(0);
  const [hover, setHover] = useState<string>();
  const [staticURL, setStaticURL] = useState<string>();
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]), [guides, setGuides] = useState<Guide[]>([]);
  const drag = useRef<{ target: HTMLElement; id: string; x: number; y: number; tx: number; ty: number; style: string; moved: boolean; frame: number; dx: number; dy: number; targets: { x: number[]; y: number[] } } | undefined>(undefined);
  const url = source === undefined ? `/__konpeki/html/${encodeURIComponent(token)}/document/?page=${encodeURIComponent(page.id)}&revision=${revision}` : staticURL;
  useEffect(() => {
    if (source === undefined) return;
    const objectURL = URL.createObjectURL(new Blob([documentHTML(source, page.id)], { type: "text/html" }));
    setStaticURL(objectURL);
    return () => URL.revokeObjectURL(objectURL);
  }, [source, page.id]);
  useEffect(() => { setReady(false); }, [url]);
  useEffect(() => {
    const p = frame.current?.contentDocument?.getElementById(page.id);
    if (ready && p) { setDiagnostics(inspectHTMLPage(p).diagnostics); redraw(n => n + 1); }
  }, [ready, page.id, page.canvas.width, page.canvas.height]);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => setScale(outer.current!.clientWidth / page.canvas.width));
    observer.observe(outer.current!); return () => observer.disconnect();
  }, [page.canvas.width]);
  function element(id: string) { return frame.current?.contentDocument?.getElementById(id); }
  function box(id: string) {
    const el = element(id); if (!el) return undefined;
    const rect = el.getBoundingClientRect();
    return { left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale };
  }
  function anchor(id: string) {
    const el = element(id)!, bounds = outer.current!.getBoundingClientRect(), r = el.getBoundingClientRect();
    const zoom = bounds.width / page.canvas.width;
    return new DOMRect(bounds.x + r.x * zoom, bounds.y + r.y * zoom, r.width * zoom, r.height * zoom);
  }
  function hit(event: React.PointerEvent) {
    const rect = outer.current!.getBoundingClientRect(), zoom = rect.width / page.canvas.width;
    return frame.current?.contentDocument?.elementFromPoint((event.clientX - rect.x) / zoom, (event.clientY - rect.y) / zoom)?.closest<HTMLElement>("[id]");
  }
  function stop(cancel = false) {
    const d = drag.current; if (!d) return;
    cancelAnimationFrame(d.frame); drag.current = undefined;
    setGuides([]);
    onBusy(false);
    if (cancel) d.target.style.cssText = d.style;
    else if (d.moved) {
      d.target.style.translate = `${d.tx + d.dx}px ${d.ty + d.dy}px`;
      onEdit({ kind: "move", page: page.id, id: d.id, style: d.target.style.cssText });
    }
    const pageElement = element(page.id);
    if (pageElement) setDiagnostics(inspectHTMLPage(pageElement).diagnostics);
    redraw(n => n + 1);
  }
  useEffect(() => () => { if (drag.current) cancelAnimationFrame(drag.current.frame); }, []);
  const outlined = commenting ? hover : selected?.page === page.id ? selected.id : undefined;
  const bounds = ready && outlined ? box(outlined) : undefined;
  void tick;
  return <>
    <header className="stage-meta"><span className="page-index">{page.name}</span><h2>{page.id}</h2>{diagnostics.length > 0 && <details className="html-diagnostics"><summary>{diagnostics.length} layout {diagnostics.length === 1 ? "issue" : "issues"}</summary><ul>{diagnostics.map(d => <li key={`${d.code}/${d.target}`}><strong>{d.target}</strong>: {d.message}</li>)}</ul></details>}</header>
    <div className="html-page" ref={outer} tabIndex={0} data-html-page={page.id} style={{ aspectRatio: `${page.canvas.width}/${page.canvas.height}` }}
      onPointerDown={event => {
        if (event.button !== 0 || locked || !ready) return;
        const target = hit(event); if (!target) return;
        const value = { page: page.id, id: target.id };
        if (commenting || source !== undefined) { onComment(value, anchor(target.id)); return; }
        if (target.id === page.id) { onSelect(undefined); return; }
        onSelect(value); outer.current!.focus({ preventScroll: true });
        const translated = frame.current!.contentWindow!.getComputedStyle(target).translate;
        // Percentage/3D translations need a defined correction policy; don't silently replace them.
        if (translated !== "none" && !/^-?[\d.]+px(?: -?[\d.]+px)?$/.test(translated)) { onBlocked("Move this element in source; its translation is not a simple pixel offset."); return; }
        for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const style = frame.current!.contentWindow!.getComputedStyle(ancestor);
          if (ancestor.namespaceURI === "http://www.w3.org/2000/svg" || style.transform !== "none" || style.rotate !== "none" || style.scale !== "none" || Number(style.zoom) !== 1) {
            onBlocked("Move this element in source; its parent changes the coordinate system."); return;
          }
        }
        const [tx, ty = 0] = translated === "none" ? [0, 0] : translated.split(" ").map(parseFloat);
        const peers = Array.from(element(page.id)!.querySelectorAll("[id]")).filter(el => el !== target && !el.contains(target) && !target.contains(el) && el.getClientRects().length).map(el => el.getBoundingClientRect());
        const targets = { x: [0, page.canvas.width / 2, page.canvas.width, ...peers.flatMap(r => [r.x, r.x + r.width / 2, r.right])], y: [0, page.canvas.height / 2, page.canvas.height, ...peers.flatMap(r => [r.y, r.y + r.height / 2, r.bottom])] };
        drag.current = { target, id: target.id, x: event.clientX, y: event.clientY, tx, ty, style: target.style.cssText, moved: false, frame: 0, dx: 0, dy: 0, targets };
        outer.current!.setPointerCapture(event.pointerId); onBusy(true); event.preventDefault();
      }}
      onPointerMove={event => {
        const d = drag.current;
        if (!d) { setHover(hit(event)?.id); return; }
        const zoom = outer.current!.getBoundingClientRect().width / page.canvas.width;
        d.dx = Math.round((event.clientX - d.x) / zoom); d.dy = Math.round((event.clientY - d.y) / zoom);
        d.moved ||= Math.abs(d.dx) + Math.abs(d.dy) > 2;
        if (d.moved && !d.frame) d.frame = requestAnimationFrame(() => { d.frame = 0; d.target.style.translate = `${d.tx + d.dx}px ${d.ty + d.dy}px`; setGuides(referenceGuides(d.target.getBoundingClientRect(), d.targets)); redraw(n => n + 1); });
      }} onPointerUp={() => stop()} onPointerCancel={() => stop(true)} onLostPointerCapture={() => stop(true)} onPointerLeave={() => setHover(undefined)}
      onDoubleClick={() => { if (selected?.page === page.id && element(selected.id)) onComment(selected, anchor(selected.id)); }}>
      <iframe title={page.id} ref={frame} sandbox="allow-same-origin" src={url} style={{ width: page.canvas.width, height: page.canvas.height, transform: `scale(${scale})` }}
        onLoad={async () => { const doc = frame.current?.contentDocument; if (!doc) return; await doc.fonts.ready; await Promise.all(Array.from(doc.images).map(image => image.decode().catch(() => {}))); const p = doc.getElementById(page.id); if (!p) return; const report = inspectHTMLPage(p); setDiagnostics(report.diagnostics); if (report.width > 0 && report.height > 0 && report.width <= 8192 && report.height <= 8192) onSize(report.width, report.height); setReady(true); redraw(n => n + 1); }} />
      {bounds && <div className="html-outline" style={bounds} aria-hidden="true" />}
      {guides.map(g => <div key={g.axis} className={`html-guide ${g.axis}`} style={g.axis === "x" ? { left: g.value * scale } : { top: g.value * scale }} aria-hidden="true" />)}
      {ready && notes.filter(n => n.page === page.id).map(note => { const b = box(note.id); return b && <button key={note.key} className="html-pin" style={{ left: b.left + b.width - 10, top: b.top - 10 }} aria-label={`Comment on ${note.id}`} onPointerDown={e => e.stopPropagation()} onClick={() => onComment(note, anchor(note.id))}>{notes.indexOf(note) + 1}</button>; })}
    </div>
  </>;
}

function Preview() {
  const [snapshot, setSnapshot] = useState<Snapshot>(), [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [selected, setSelected] = useState<Target>(), [view, setView] = useState<"closed" | "select" | "queue" | Target>("closed");
  const [notes, setNotes] = useState<Note[]>([]), [drafts, setDrafts] = useState<Record<string, string>>({});
  const [cleared, setCleared] = useState<Note[]>([]);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [saving, setSaving] = useState(false), [fallback, setFallback] = useState("");
  const [reset, setReset] = useState(0);
  const [anchor, setAnchor] = useState<DOMRect>();
  const current = useRef(snapshot), busy = useRef(false), loaded = useRef(false), panel = useRef<HTMLElement>(null);
  const storedComments = useRef<string | null>(null);
  current.current = snapshot;
  useEffect(() => {
    let live = true, fetching = false;
    async function poll() {
      if (fetching || busy.current) return;
      fetching = true;
      try {
        const next = await request();
        if (!live || busy.current) return;
        if (!loaded.current) {
          const saved = localStorage.getItem(`html-review:${next.key}`);
          if (saved) { const value = JSON.parse(saved); if (!Array.isArray(value) || !value.every(n => typeof n.key === "string" && typeof n.page === "string" && typeof n.id === "string" && typeof n.text === "string")) throw new Error("Stored comments could not be read."); setNotes(value); }
          storedComments.current = saved;
          loaded.current = true;
        }
        if (next.revision !== current.current?.revision) setSnapshot(next);
      } catch (e) { if (live) setError(String(e)); }
      finally { fetching = false; }
    }
    void poll(); const timer = token ? setInterval(poll, 1200) : undefined;
    return () => { live = false; clearInterval(timer); };
  }, []);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(""), 4500); return () => clearTimeout(id); }, [notice]);
  async function save(edit: Correction | { kind: "undo" }) {
    if (!token || !current.current || saving) return;
    busy.current = true; setSaving(true); setError("");
    try { setSnapshot(await request(edit, current.current.revision)); setNotice("Saved"); if (edit.kind === "delete") setSelected(undefined); }
    catch (e) { setError(String(e)); setReset(n => n + 1); try { setSnapshot(await request()); } catch {} }
    finally { busy.current = false; setSaving(false); }
  }
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if ((event.target as HTMLElement).closest("textarea,input,button,select")) return;
      if (event.key === "Escape") { setView("closed"); setSelected(undefined); }
      if (saving || !token) return;
      if ((event.metaKey || event.ctrlKey) && event.key === "z") { event.preventDefault(); void save({ kind: "undo" }); }
      if (["Delete", "Backspace"].includes(event.key) && selected && view === "closed") { event.preventDefault(); void save({ ...selected, kind: "delete" }); }
    }
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [selected, view, saving]);
  useLayoutEffect(() => {
    if (typeof view !== "object" || !panel.current || !anchor) return;
    const position = reviewPosition(anchor, panel.current.getBoundingClientRect(), { x: 0, y: 0, width: innerWidth, height: innerHeight - 80 });
    Object.assign(panel.current.style, { left: `${position.left}px`, top: `${position.top}px`, right: "auto", bottom: "auto" });
    panel.current.querySelector("textarea")?.focus();
  }, [view, anchor]);
  function persist(next: Note[]) {
    const key = `html-review:${snapshot!.key}`;
    if (localStorage.getItem(key) !== storedComments.current) throw new Error("Comments changed in another preview. Keep your draft and reload before changing the queue.");
    const value = JSON.stringify(next);
    localStorage.setItem(key, value); storedComments.current = value;
    setNotes(next);
  }
  async function copy() {
    const batch = notes;
    const prompt = [`Revise the HTML document ${JSON.stringify(snapshot!.name)} using these comments.`, "Reread the latest HTML source first. Preserve unrelated edits, stable element IDs and saved CSS position corrections. If a target is missing or ambiguous, ask rather than guessing. Render the HTML in a browser and inspect every affected page before delivery.", ...batch.map((n, i) => `${i + 1}. Page: ${JSON.stringify(n.page)}\nElement: ${JSON.stringify(n.id)}\nComment:\n${n.text}`)].join("\n\n");
    setSaving(true); setError("");
    try { await navigator.clipboard.writeText(prompt); persist(notes.filter(n => !batch.includes(n))); setCleared(batch); setView("closed"); setNotice("Copied and cleared"); }
    catch (e) { setError(`Could not copy and clear. Comments were kept. ${e}`); setFallback(prompt); }
    finally { setSaving(false); }
  }
  function addComment(event: React.FormEvent) {
    event.preventDefault();
    if (!target || !text.trim() || saving || !snapshot) return;
    const doc = new DOMParser().parseFromString(snapshot.source, "text/html");
    if (doc.getElementById(target.id)?.closest("[data-page]")?.id !== target.page) {
      setError("This target changed outside the preview. Select it again; your draft was kept.");
      return;
    }
    try {
      persist([...notes, { ...target, key: crypto.randomUUID(), text }]);
      setDrafts(v => ({ ...v, [draftKey]: "" })); setView("queue");
    } catch (e) { setError(String(e)); }
  }
  const pages: Page[] = snapshot?.pages.map((id, i) => ({ id, name: String(i + 1).padStart(2, "0"), canvas: sizes[id] ?? { width: 794, height: 1123 } })) ?? [];
  const target = typeof view === "object" ? view : undefined, draftKey = target ? `${target.page}/${target.id}` : "";
  const text = drafts[draftKey] ?? "";
  return <main className="workspace" onPointerDown={e => {
    const element = e.target as HTMLElement;
    if (element.closest(".revision-notes,.review-launcher,.html-pin")) return;
    if (!element.closest(".html-page")) setSelected(undefined);
    if ((view === "queue" && !notes.length) || (target && !text.trim() && !notes.some(n => n.page === target.page && n.id === target.id))) setView("closed");
  }}>
    <header className="board-heading html-heading"><h1>Konpeki</h1>{!token && <select aria-label="Example" value={example.id} onChange={event => { const url = new URL(location.href); url.searchParams.set("example", event.target.value); location.assign(url); }}>{examples.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>}</header>
    {!snapshot && <p>{error || "Opening HTML…"}</p>}
    {snapshot && <PageBoard draft={{ pages }}>{page => <HTMLPage key={`${page.id}:${reset}`} page={page} revision={snapshot.revision} source={token ? undefined : snapshot.source} notes={notes} selected={selected} commenting={view === "select"} locked={saving || (view !== "closed" && view !== "select")}
      onSize={(width, height) => setSizes(current => current[page.id]?.width === width && current[page.id]?.height === height ? current : { ...current, [page.id]: { width, height } })}
      onSelect={setSelected} onComment={(target, rect) => { setView(target); setAnchor(rect); setFallback(""); }} onEdit={edit => void save(edit)} onBusy={value => { if (!value && saving) return; busy.current = value; }} onBlocked={setError} />}</PageBoard>}
    {(notice || error) && <div className={`feedback-notice toast visible${error ? " error" : ""}`} role="status"><span>{error || notice}</span>{!error && notice === "Copied and cleared" && cleared.length > 0 && <button disabled={saving} onClick={() => { try { persist([...cleared.filter(c => !notes.some(n => n.key === c.key)), ...notes]); setCleared([]); setNotice("Reviews restored"); } catch (e) { setError(String(e)); } }}>Undo</button>}{error && <button onClick={() => setError("")} aria-label="Dismiss error">×</button>}</div>}
    <button className="review-launcher" aria-label="Comment" aria-pressed={view === "select" || !!target} aria-expanded={view === "queue" || !!target} disabled={!snapshot || saving} onClick={() => { setView(view === "closed" ? notes.length ? "queue" : "select" : "closed"); setFallback(""); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path transform="translate(1.5 .5)" d="M20 11a8 8 0 0 1-8 8H5l-4 3V11a9 9 0 0 1 19 0Z" /></svg>{notes.length > 0 && <span className="review-count">{notes.length}</span>}</button>
    {(target || view === "queue") && <section ref={panel} className={`revision-notes${target ? " comment-composer" : ""}`} role="dialog" aria-label={target ? "Add comment" : "Pending reviews"} key={draftKey}>
      {target && <header><h2 className="revision-note-scope">{target.id}</h2></header>}
      <ol className="revision-note-list">{notes.filter(n => !target || n.id === target.id && n.page === target.page).map(n => <li key={n.key}><span className="revision-note-number">{notes.indexOf(n) + 1}</span><span>{n.id}</span><p>{n.text}</p><button disabled={saving} aria-label={`Remove comment ${notes.indexOf(n) + 1}`} onClick={() => { try { persist(notes.filter(note => note !== n)); } catch (e) { setError(String(e)); } }}>×</button></li>)}</ol>
      {target ? <form onSubmit={addComment}>
        <textarea aria-label="What should change?" placeholder="Leave a comment…" value={text} maxLength={4000} onChange={e => setDrafts(v => ({ ...v, [draftKey]: e.target.value }))} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") e.currentTarget.form?.requestSubmit(); }} />
        <div className="revision-note-submit"><button type="button" className="review-secondary" onClick={() => setView(notes.length ? "queue" : "closed")}>Cancel</button><button className="primary" disabled={!text.trim() || saving}>Add</button></div>
      </form> : <>{!notes.length && <p className="review-empty">No pending comments</p>}{fallback && <textarea aria-label="Prompt to copy" readOnly value={fallback} onFocus={e => e.currentTarget.select()} />}<footer className="review-actions"><button className="review-secondary" disabled={saving} onClick={() => setView("select")}>New comment</button><button className="primary" disabled={!notes.length || saving} onClick={() => void copy()}>Copy &amp; clear</button></footer></>}
    </section>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
