import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PageBoard, type PageBoardControls } from "../src/components/PageBoard.tsx";
import { reviewPosition } from "../src/lib/review-position.ts";
import { referenceGuides, type Guide } from "../src/lib/alignment.ts";
import { inspectHTMLPage, type Diagnostic } from "./inspect.ts";
import { documentHTML } from "./document.ts";
import { starterSource } from "./starter.ts";
import { hintAlphabet, reviewHints, targetRect } from "./review-hints.ts";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "../src/styles/base.css";
import "../src/styles/shell.css";
import "../src/styles/feedback.css";
import "./preview.css";

type Snapshot = { source: string; revision: string; name: string; path: string; key: string; pages: string[] };
type Target = { page: string; id: string };
type Note = Target & { key: string; text: string };
type Page = { id: string; name: string; canvas: { width: number; height: number } };
type Correction = Target & ({ kind: "move"; translate: string } | { kind: "delete" });
type Hints = { page: string; prefix: string; entries: ReturnType<typeof reviewHints>; scrollLeft: number; scrollTop: number };
const submitKey = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ Enter" : "Ctrl + Enter";
const token = new URLSearchParams(location.search).get("session") ?? "";
async function request(edit?: unknown, revision?: string): Promise<Snapshot> {
  if (!token) {
    if (edit) throw new Error("Open a local CLI preview to save source corrections.");
    const source = starterSource(), doc = new DOMParser().parseFromString(source, "text/html");
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
    return { source, revision: Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join(""), name: "blank.html", path: "skills/konpeki/assets/blank.html", key: "starter:default", pages: Array.from(doc.querySelectorAll("body > [data-page]"), page => page.id) };
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
  function hit(event: React.MouseEvent) {
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
      const translate = `${d.tx + d.dx}px ${d.ty + d.dy}px`;
      d.target.style.translate = translate;
      onEdit({ kind: "move", page: page.id, id: d.id, translate });
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
    <div className="html-page" ref={outer} tabIndex={0} data-html-page={page.id} aria-busy={!ready || locked} style={{ aspectRatio: `${page.canvas.width}/${page.canvas.height}` }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        // The iframe is a canvas surface, not a native text-selection target.
        event.preventDefault();
        if (locked || !ready) return;
        const target = hit(event); if (!target) return;
        const value = { page: page.id, id: target.id };
        if (commenting) { onComment(value, anchor(target.id)); return; }
        if (target.id === page.id) { onSelect(undefined); outer.current!.blur(); return; }
        onSelect(value); outer.current!.focus({ preventScroll: true });
        if (source !== undefined) return;
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
        outer.current!.setPointerCapture(event.pointerId); onBusy(true);
      }}
      onPointerMove={event => {
        const d = drag.current;
        if (!d) { setHover(hit(event)?.id); return; }
        const zoom = outer.current!.getBoundingClientRect().width / page.canvas.width;
        d.dx = Math.round((event.clientX - d.x) / zoom); d.dy = Math.round((event.clientY - d.y) / zoom);
        d.moved ||= Math.abs(d.dx) + Math.abs(d.dy) > 2;
        if (d.moved && !d.frame) d.frame = requestAnimationFrame(() => { d.frame = 0; d.target.style.translate = `${d.tx + d.dx}px ${d.ty + d.dy}px`; setGuides(referenceGuides(d.target.getBoundingClientRect(), d.targets)); redraw(n => n + 1); });
      }} onPointerUp={() => stop()} onPointerCancel={() => stop(true)} onLostPointerCapture={() => stop(true)} onPointerLeave={() => setHover(undefined)}
      onDoubleClick={event => {
        event.preventDefault();
        if (locked || !ready) return;
        const target = hit(event);
        if (target && target.id !== page.id) onComment({ page: page.id, id: target.id }, anchor(target.id));
      }}>
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
  const [vim, setVim] = useState(() => { try { return localStorage.getItem("html-review:vim") === "true"; } catch { return false; } });
  const [help, setHelp] = useState(false), [hints, setHints] = useState<Hints>();
  const [activePage, setActivePage] = useState(""), [prefix, setPrefix] = useState("");
  const [queueIndex, setQueueIndex] = useState(0);
  const board = useRef<PageBoardControls>(null), workspace = useRef<HTMLElement>(null), shortcuts = useRef<HTMLDialogElement>(null);
  const composerOrigin = useRef<"closed" | "queue">("closed");
  const current = useRef(snapshot), busy = useRef(false), loaded = useRef(false), panel = useRef<HTMLElement>(null);
  const launcher = useRef<HTMLButtonElement>(null), restoreFocus = useRef(false);
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
  useEffect(() => { if (!prefix) return; const id = setTimeout(() => setPrefix(""), 1200); return () => clearTimeout(id); }, [prefix]);
  useEffect(() => { setHints(undefined); }, [snapshot?.revision, sizes]);
  useEffect(() => {
    function cancelHints() { setHints(undefined); setPrefix(""); }
    const surface = workspace.current!;
    function scrolled() {
      // Navigation can deliver its scroll event after the next `f` key. Keep
      // hints measured at that position; cancel only if their geometry moved.
      setHints(h => h?.scrollLeft === surface.scrollLeft && h.scrollTop === surface.scrollTop ? h : undefined);
      setPrefix("");
    }
    surface.addEventListener("scroll", scrolled);
    surface.addEventListener("gesturestart", cancelHints);
    window.addEventListener("resize", cancelHints);
    window.addEventListener("blur", cancelHints);
    return () => { surface.removeEventListener("scroll", scrolled); surface.removeEventListener("gesturestart", cancelHints); window.removeEventListener("resize", cancelHints); window.removeEventListener("blur", cancelHints); };
  }, []);
  useEffect(() => {
    if (help) shortcuts.current?.showModal();
    else shortcuts.current?.close();
  }, [help]);
  async function save(edit: Correction | { kind: "undo" }) {
    if (!token || !current.current || saving) return;
    busy.current = true; setSaving(true); setError("");
    try { setSnapshot(await request(edit, current.current.revision)); setNotice("Saved"); if (edit.kind === "delete") setSelected(undefined); }
    catch (e) { setError(String(e)); setReset(n => n + 1); try { setSnapshot(await request()); } catch {} }
    finally { busy.current = false; setSaving(false); }
  }
  function pageSurface(id: string) {
    return workspace.current?.querySelector<HTMLElement>(`.html-page[data-html-page="${CSS.escape(id)}"]`);
  }
  function selectedPage() {
    return selected ? pageSurface(selected.page) : null;
  }
  function closePanel() {
    restoreFocus.current = true; setView("closed"); setHints(undefined); setPrefix("");
  }
  function dismissComposer() {
    if (typeof view === "object" && composerOrigin.current === "queue") setView("queue");
    else closePanel();
  }
  function openQueue() {
    setHints(undefined); setView("queue"); setFallback(""); setQueueIndex(0);
  }
  function openComment(target: Target, rect: DOMRect) {
    composerOrigin.current = vim && view === "queue" ? "queue" : "closed";
    setHints(undefined); setActivePage(target.page);
    setSelected(target.id === target.page ? undefined : target);
    setView(target); setAnchor(rect); setFallback("");
  }
  function commentOn(target: Target, reveal = false) {
    const surface = pageSurface(target.page);
    if (!surface || !targetRect(surface, target.id)) { setError("This target is unavailable. Your comments were kept; wait for the page to load or select another target."); return; }
    if (reveal) {
      board.current?.goTo(target.page);
      const rect = targetRect(surface, target.id)!;
      board.current?.pan(rect.left + rect.width / 2 - workspace.current!.clientWidth / 2, rect.top + rect.height / 2 - workspace.current!.clientHeight / 2);
    }
    openComment(target, targetRect(surface, target.id)!);
  }
  function startHints() {
    if (busy.current) return;
    board.current?.stopZoom();
    const surface = pageSurface(activePage);
    if (!surface || surface.getAttribute("aria-busy") !== "false") return;
    const entries = reviewHints(surface);
    if (!entries.length) { setNotice("No visible targets. Pan to an element, or use Shift+C to comment on the page."); return; }
    setView("closed"); setHints({ page: activePage, prefix: "", entries, scrollLeft: workspace.current!.scrollLeft, scrollTop: workspace.current!.scrollTop });
    surface.focus({ preventScroll: true });
  }
  function startComment() {
    const outline = selectedPage()?.querySelector(".html-outline");
    if (selected && outline) openComment(selected, outline.getBoundingClientRect());
    else if (vim) startHints();
    else setView("select");
    setFallback("");
  }
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      const element = event.target as HTMLElement;
      const typing = element.isContentEditable || !!element.closest("textarea,input,select");
      const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
      const motion = plain && vim && view === "closed" && !hints && !help && !typing && ["h", "j", "k", "l", "+", "=", "-"].includes(event.key);
      if (event.repeat && !motion) { if (!typing && event.key === "Enter") event.preventDefault(); return; }
      if (help) {
        if (event.key === "Escape") { event.preventDefault(); setHelp(false); }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (hints) setHints(undefined);
        else if (prefix) setPrefix("");
        else if (view !== "closed") dismissComposer();
        else {
          setSelected(undefined);
          if (document.activeElement?.matches(".html-page")) (document.activeElement as HTMLElement).blur();
        }
        return;
      }
      if (saving || busy.current) return;
      if (vim && view === "queue" && (event.ctrlKey || event.metaKey) && !event.altKey && event.key === "Enter") {
        event.preventDefault(); if (notes.length) void copy(); return;
      }
      if (typing) return;
      if (plain && event.key === "?") { event.preventDefault(); setHints(undefined); setPrefix(""); setHelp(true); return; }
      if (hints) {
        if (!plain) return;
        event.preventDefault();
        if (event.key === "Backspace") setHints({ ...hints, prefix: hints.prefix.slice(0, -1) });
        else if (hintAlphabet.includes(event.key.toLowerCase()) && event.key.length === 1) {
          const next = hints.prefix + event.key.toLowerCase();
          const match = hints.entries.find(hint => hint.label === next);
          if (match) commentOn({ page: hints.page, id: match.id });
          else if (hints.entries.some(hint => hint.label.startsWith(next))) setHints({ ...hints, prefix: next });
        }
        return;
      }
      if (vim && plain && (view === "closed" || view === "queue")) {
        if (event.key === "q") { event.preventDefault(); if (view === "queue") closePanel(); else openQueue(); return; }
        if (view === "queue") {
          if (["j", "k"].includes(event.key)) {
            event.preventDefault(); setQueueIndex(i => Math.max(0, Math.min(notes.length - 1, i + (event.key === "j" ? 1 : -1)))); return;
          }
          if (event.key === "Enter" && element.closest(".revision-note-target")) {
            event.preventDefault(); if (notes[queueIndex]) commentOn(notes[queueIndex], true); return;
          }
        } else {
          const first = prefix === "g" && event.key === "g";
          setPrefix("");
          if (event.key === "g" && !first) { event.preventDefault(); setPrefix("g"); return; }
          if (["[", "]", "G"].includes(event.key) || first) {
            event.preventDefault();
            const ids = snapshot?.pages ?? [], index = ids.indexOf(activePage);
            const next = first ? 0 : event.key === "G" ? ids.length - 1 : Math.max(0, Math.min(ids.length - 1, index + (event.key === "]" ? 1 : -1)));
            if (ids[next]) { setSelected(undefined); board.current?.goTo(ids[next]); }
            return;
          }
          if (motion) {
            event.preventDefault();
            if (["+", "=", "-"].includes(event.key)) board.current?.zoom(event.key === "-" ? 1 / 1.2 : 1.2);
            else board.current?.pan(event.key === "h" ? -80 : event.key === "l" ? 80 : 0, event.key === "k" ? -80 : event.key === "j" ? 80 : 0);
            return;
          }
          if (event.key === "0") { event.preventDefault(); board.current?.goTo(activePage, true); return; }
          if (event.key === "f") { event.preventDefault(); startHints(); return; }
          if (event.key === "C") { event.preventDefault(); commentOn({ page: activePage, id: activePage }); return; }
        }
      }
      if (plain && (view === "closed" || view === "queue") && event.key.toLowerCase() === "c") {
        event.preventDefault(); startComment(); return;
      }
      if (element.closest("button")) return;
      if (view === "closed" && selected && event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault(); startComment(); return;
      }
      if (!token) return;
      if ((event.metaKey || event.ctrlKey) && event.key === "z") { event.preventDefault(); void save({ kind: "undo" }); }
      if (["Delete", "Backspace"].includes(event.key) && selected && view === "closed") { event.preventDefault(); void save({ ...selected, kind: "delete" }); }
    }
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [selected, view, saving, vim, hints, help, activePage, prefix, queueIndex, notes, snapshot]);
  useLayoutEffect(() => {
    if (saving) return;
    if (view === "closed" && restoreFocus.current) {
      restoreFocus.current = false;
      (selectedPage() ?? (vim ? pageSurface(activePage) : null) ?? launcher.current)?.focus({ preventScroll: true });
    }
    if (view === "queue") {
      const actions = panel.current?.querySelector(".review-actions");
      const rows = panel.current?.querySelectorAll<HTMLButtonElement>(".revision-note-target");
      const row = vim ? rows?.[Math.min(queueIndex, (rows?.length ?? 1) - 1)] : undefined;
      (panel.current?.querySelector("textarea") ?? row ?? actions?.querySelector<HTMLButtonElement>(".primary:not(:disabled)") ?? actions?.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }
    if (typeof view !== "object" || !panel.current || !anchor) return;
    const position = reviewPosition(anchor, panel.current.getBoundingClientRect(), { x: 0, y: 0, width: innerWidth, height: innerHeight - 80 });
    Object.assign(panel.current.style, { left: `${position.left}px`, top: `${position.top}px`, right: "auto", bottom: "auto" });
    panel.current.querySelector("textarea")?.focus();
  }, [view, anchor, notes.length, saving, fallback, queueIndex, vim]);
  function persist(next: Note[]) {
    const key = `html-review:${snapshot!.key}`;
    if (localStorage.getItem(key) !== storedComments.current) throw new Error("Comments changed in another preview. Keep your draft and reload before changing the queue.");
    const value = JSON.stringify(next);
    localStorage.setItem(key, value); storedComments.current = value;
    setNotes(next);
  }
  async function copy() {
    if (saving || !notes.length) return;
    const batch = notes;
    const prompt = [`Revise the HTML document ${JSON.stringify(snapshot!.path)} using these comments.`, "Reread the latest HTML source first. Preserve unrelated edits, stable element IDs and saved CSS position corrections. If a target is missing or ambiguous, ask rather than guessing. Render the HTML in a browser and inspect every affected page before delivery.", ...batch.map((n, i) => `${i + 1}. Page: ${JSON.stringify(n.page)}\nElement: ${JSON.stringify(n.id)}\nComment:\n${n.text}`)].join("\n\n");
    setSaving(true); setError("");
    try { await navigator.clipboard.writeText(prompt); persist(notes.filter(n => !batch.includes(n))); setCleared(batch); closePanel(); setNotice("Copied and cleared"); }
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
      setDrafts(v => ({ ...v, [draftKey]: "" }));
      if (vim) { closePanel(); setNotice("Comment added"); }
      else setView("queue");
    } catch (e) { setError(String(e)); }
  }
  const pages: Page[] = snapshot?.pages.map((id, i) => ({ id, name: String(i + 1).padStart(2, "0"), canvas: sizes[id] ?? { width: 794, height: 1123 } })) ?? [];
  const target = typeof view === "object" ? view : undefined, draftKey = target ? `${target.page}/${target.id}` : "";
  const text = drafts[draftKey] ?? "";
  return <main ref={workspace} className="workspace" onWheelCapture={() => setHints(undefined)} onPointerDown={e => {
    const element = e.target as HTMLElement;
    if (element.closest(".revision-notes,.review-launcher,.html-pin,.review-hints,.review-status,.shortcut-help,.shortcut-launcher")) return;
    setHints(undefined); setPrefix("");
    if (!element.closest(".html-page")) {
      setSelected(undefined);
      if (document.activeElement?.matches(".html-page")) (document.activeElement as HTMLElement).blur();
    }
    if (view === "queue" || target) setView("closed");
  }}>
    <header className="board-heading html-heading"><h1>Konpeki</h1>{!token && <>
      <a href="https://github.com/vcfgdev/konpeki/blob/main/html/README.md">Authoring guide</a>
    </>}<button className="shortcut-launcher" aria-label="Keyboard shortcuts" aria-keyshortcuts="Shift+/" title="Keyboard shortcuts (?)" onClick={() => { setHints(undefined); setHelp(true); }}><kbd>?</kbd></button></header>
    {!snapshot && <p>{error || "Opening HTML…"}</p>}
    {snapshot && <PageBoard draft={{ pages }} controls={board} onActivePage={setActivePage}>{page => <HTMLPage key={`${page.id}:${reset}`} page={page} revision={snapshot.revision} source={token ? undefined : snapshot.source} notes={notes} selected={selected} commenting={view === "select"} locked={saving}
      onSize={(width, height) => setSizes(current => current[page.id]?.width === width && current[page.id]?.height === height ? current : { ...current, [page.id]: { width, height } })}
      onSelect={value => { setSelected(value); setActivePage(page.id); }} onComment={openComment} onEdit={edit => void save(edit)} onBusy={value => { if (!value && saving) return; busy.current = value; }} onBlocked={setError} />}</PageBoard>}
    {(notice || error) && <div className={`feedback-notice toast visible${error ? " error" : ""}`} role="status"><span>{error || notice}</span>{!error && notice === "Copied and cleared" && cleared.length > 0 && <button disabled={saving} onClick={() => { try { persist([...cleared.filter(c => !notes.some(n => n.key === c.key)), ...notes]); setCleared([]); setNotice("Reviews restored"); } catch (e) { setError(String(e)); } }}>Undo</button>}{error && <button className="toast-dismiss" onClick={() => setError("")} aria-label="Dismiss error"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>}</div>}
    <button ref={launcher} className="review-launcher" aria-label="Comment" title="Comment (C)" aria-keyshortcuts="c" aria-pressed={view === "select" || !!target || !!hints} aria-expanded={view === "queue" || !!target} disabled={!snapshot || saving} onClick={() => { if (view !== "closed" || hints) closePanel(); else if (notes.length) openQueue(); else startComment(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path transform="translate(1.5 .5)" d="M20 11a8 8 0 0 1-8 8H5l-4 3V11a9 9 0 0 1 19 0Z" /></svg>{notes.length > 0 && <span className="review-count">{notes.length}</span>}</button>
    {(target || view === "queue") && <section ref={panel} className={`revision-notes${target ? " comment-composer" : ""}`} role="dialog" aria-label={target ? "Add comment" : "Pending reviews"} key={draftKey}>
      {target && <header><h2 className="revision-note-scope">{target.id}</h2></header>}
      {!target && vim && <header className="review-queue-heading"><h2>{notes.length} pending {notes.length === 1 ? "comment" : "comments"}</h2><span><kbd>j</kbd>/<kbd>k</kbd> select · <kbd>Enter</kbd> locate</span></header>}
      <ol className="revision-note-list">{notes.filter(n => !target || n.id === target.id && n.page === target.page).map(n => <li key={n.key} className={vim && !target && notes.indexOf(n) === queueIndex ? "review-note-active" : undefined}>
        {vim && !target ? <button className="revision-note-target" disabled={saving} onFocus={() => setQueueIndex(notes.indexOf(n))} onClick={() => commentOn(n, true)}><span className="revision-note-number">{notes.indexOf(n) + 1}</span><span className="revision-note-label" title={`${n.page} · ${n.id}`}>{n.page} · {n.id}</span></button> : <><span className="revision-note-number">{notes.indexOf(n) + 1}</span><span className="revision-note-label" title={n.id}>{n.id}</span></>}
        <p>{n.text}</p><div className="revision-note-actions"><button className="revision-note-remove" disabled={saving} aria-label={`Remove comment ${notes.indexOf(n) + 1}`} title="Remove comment" onClick={() => { try { persist(notes.filter(note => note !== n)); setQueueIndex(i => Math.max(0, Math.min(i, notes.length - 2))); } catch (e) { setError(String(e)); } }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button></div></li>)}</ol>
      {target ? <form onSubmit={addComment}>
        <textarea aria-label="What should change?" placeholder="Leave a comment…" value={text} maxLength={4000} onChange={e => setDrafts(v => ({ ...v, [draftKey]: e.target.value }))} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229 && !e.repeat) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
        <div className="revision-note-submit"><button type="button" className="review-secondary" onClick={dismissComposer}>Cancel</button><button className="primary" title="Add comment (Ctrl/⌘ + Enter)" disabled={!text.trim() || saving}>Add{vim && <kbd>{submitKey}</kbd>}</button></div>
      </form> : <>{!notes.length && <p className="review-empty">No pending comments</p>}{fallback && <textarea aria-label="Prompt to copy" readOnly value={fallback} onFocus={e => e.currentTarget.select()} />}<footer className="review-actions"><button className="review-secondary" disabled={saving} onClick={() => vim ? startHints() : setView("select")}>New comment</button><button className="primary" disabled={!notes.length || saving} onClick={() => void copy()}>Copy &amp; clear{vim && <kbd>{submitKey}</kbd>}</button></footer></>}
    </section>}
    {hints && <div className="review-hints" aria-label="Comment targets">
      <svg aria-hidden="true">{hints.entries.filter(hint => hint.label.startsWith(hints.prefix)).map(hint => <g key={hint.id}>
        <rect x={hint.rect.x} y={hint.rect.y} width={hint.rect.width} height={hint.rect.height} />
        <line x1={hint.rect.x} y1={hint.rect.y + 11} x2={hint.badge.right} y2={hint.badge.y + 11} />
      </g>)}</svg>
      {hints.entries.filter(hint => hint.label.startsWith(hints.prefix)).map(hint => <button key={hint.id} className="review-hint" data-target={hint.id} aria-label={`${hint.label}: comment on ${hint.id}`} style={{ left: hint.badge.x, top: hint.badge.y, width: hint.badge.width }} onClick={() => commentOn({ page: hints.page, id: hint.id })}><span>{hints.prefix}</span>{hint.label.slice(hints.prefix.length)}</button>)}
    </div>}
    {vim && snapshot && <div className="review-status" aria-label="Review keyboard mode">
      <button onClick={() => { setHints(undefined); setHelp(true); }} title="Keyboard shortcuts (?)">VIM · {hints ? "HINTS" : target ? "COMMENT" : view === "queue" ? "PENDING" : "NORMAL"}</button>
      {(hints || prefix) && <kbd>{hints ? `${hints.prefix}_` : `${prefix}_`}</kbd>}
      <span>{hints ? "Esc cancel" : target ? `${submitKey} add` : view === "queue" ? "Esc back" : "f comment · ? help"}</span>
      <span className="review-page-number">Page {Math.max(0, pages.findIndex(p => p.id === activePage)) + 1} / {pages.length}</span>
    </div>}
    <dialog ref={shortcuts} className="shortcut-help" aria-labelledby="shortcut-title" onCancel={() => setHelp(false)} onClose={() => setHelp(false)}>
      <header><h2 id="shortcut-title">Keyboard shortcuts</h2><button onClick={() => setHelp(false)} aria-label="Close keyboard shortcuts">×</button></header>
      <label className="vim-toggle"><input type="checkbox" checked={vim} onChange={e => { setVim(e.target.checked); setHints(undefined); try { localStorage.setItem("html-review:vim", String(e.target.checked)); } catch { setError("The Vim mode preference could not be saved. This change applies to the current session only."); } }} />Vim review mode</label>
      <p>Letter hints and navigation. Comments use normal text editing.</p>
      <h3>Canvas <span>Vim mode</span></h3>
      <dl><dt><kbd>f</kbd></dt><dd>Hint visible elements, then type their letters</dd><dt><kbd>c</kbd> / <kbd>Shift+C</kbd></dt><dd>Comment on selection / current page</dd><dt><kbd>h j k l</kbd></dt><dd>Pan left, down, up, right</dd><dt><kbd>[</kbd> / <kbd>]</kbd></dt><dd>Previous / next page · keep zoom</dd><dt><kbd>gg</kbd> / <kbd>G</kbd></dt><dd>First / last page</dd><dt><kbd>+</kbd> / <kbd>−</kbd> / <kbd>0</kbd></dt><dd>Zoom in / out / fit current page</dd><dt><kbd>q</kbd></dt><dd>Open pending comments</dd></dl>
      <h3>Pending comments <span>Vim mode</span></h3>
      <dl><dt><kbd>j</kbd> / <kbd>k</kbd></dt><dd>Select next / previous comment</dd><dt><kbd>Enter</kbd></dt><dd>Reveal selected target and its notes</dd><dt><kbd>{submitKey}</kbd></dt><dd>Copy &amp; clear · Undo remains available</dd></dl>
      <h3>Always available</h3>
      <dl><dt><kbd>c</kbd> / <kbd>Enter</kbd></dt><dd>Comment / comment on selected element</dd><dt><kbd>{submitKey}</kbd></dt><dd>Add comment · return to canvas in Vim mode</dd><dt><kbd>Esc</kbd></dt><dd>Back one level · keep unfinished drafts</dd><dt><kbd>?</kbd></dt><dd>Open this help outside text inputs</dd></dl>
    </dialog>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Preview />);
