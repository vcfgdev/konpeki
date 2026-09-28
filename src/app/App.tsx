import { useEffect, useMemo, useRef, useState } from "react";
import type { CompositionComponent } from "../../composition/runtime.ts";
import { validateDraft, initialGridDraft } from "../../composition/document.ts";
import { areaIssue, resolveDocument, toComposition } from "../../composition/grid.ts";
import { componentRemovalIssue, duplicateComponent, getSlide, parseCompositionJSON, removeComponent, transformComponentRect, type Draft } from "../lib/model.ts";
import { commitHistory, createHistory, finishHistoryEdit, redoHistory, undoHistory } from "../lib/history.ts";
import { clearStoredDraft, clearStoredExampleDraft, loadDraft, loadExampleDraft, loadFileReview, persistDraft, persistExampleDraft, persistFileReview } from "../lib/storage.ts";
import { canonicalJSON } from "../../composition/compile.ts";
import { Canvas } from "../components/Canvas.tsx";
import { PageBoard } from "../components/PageBoard.tsx";
import { RevisionNotes } from "../components/RevisionNotes.tsx";
import { FeedbackNotice } from "../components/ui.tsx";
import { exampleDraft } from "../lib/examples.ts";
import { fileSessionToken } from "../lib/file-session.ts";
import { useFileSession } from "../lib/use-file-session.ts";
import { emptyReview, reviewPrompt, type ReviewState, type ReviewTarget } from "../lib/review.ts";

const sessionToken = fileSessionToken();
function loadInitialDraft() {
  if (sessionToken) return { draft: initialGridDraft(), storageBlocked: false, exampleName: undefined, fileSession: true, review: undefined, error: undefined };
  const exampleName = new URLSearchParams(window.location.search).get("example");
  const example = exampleDraft(exampleName);
  return example
    ? { ...loadExampleDraft(exampleName!, example), exampleName: exampleName!, fileSession: false }
    : { ...loadDraft(), exampleName: undefined, fileSession: false };
}

export function App() {
  const [loaded] = useState(loadInitialDraft);
  const [history, setHistory] = useState(() => createHistory<{ draft: Draft; review: ReviewState; selection?: ReviewTarget }>({ draft: loaded.draft, review: loaded.review ?? emptyReview() }));
  const { draft, review: localReview, selection } = history.present;
  const validation = useMemo(() => validateDraft(draft), [draft]);
  const [blocked, setBlocked] = useState(loaded.storageBlocked);
  const [storageError, setStorageError] = useState(loaded.error ?? "");
  const [error, setError] = useState("");
  const [fileIdentity, setFileIdentity] = useState<{ key: string; name: string }>();
  const [notice, setNotice] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [target, setTarget] = useState<ReviewTarget>();
  const [reviewSession, setReviewSession] = useState(0);
  const importInput = useRef<HTMLInputElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const fileSession = useFileSession(loaded.fileSession, draft, {
    onOpen: session => {
      const comments = loadFileReview(session.commentKey, session.review, session.reviewError);
      setFileIdentity({ key: session.commentKey, name: session.name });
      setBlocked(comments.storageBlocked); setStorageError(comments.error ?? "");
      setHistory(createHistory({ draft: session.document, review: comments.review })); closeReview();
    },
    onExternalChange: document => setHistory(current => commitHistory(current, { ...current.present, draft: document, selection: undefined })),
    onError: setError,
  });
  const review = localReview;
  const locked = loaded.fileSession && (!fileSession.ready || fileSession.opening);

  useEffect(() => {
    if ((loaded.fileSession && !fileIdentity) || blocked || !validation.ok) return;
    const timer = setTimeout(() => {
      try { persist(draft, localReview); }
      catch { setBlocked(true); setStorageError("Browser storage is unavailable. Download your composition and copy pending comments before reloading."); }
    }, 250);
    return () => clearTimeout(timer);
  }, [draft, localReview, validation, blocked, fileIdentity]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => { document.title = `${draft.title} · Konpeki`; }, [draft.title]);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.defaultPrevented || locked) return;
      const editable = event.target instanceof HTMLElement && (event.target.closest("input,textarea,select") || event.target.isContentEditable);
      if (event.key === "Escape" && reviewing) { event.preventDefault(); closeReview(); return; }
      if (editable) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === "o" && !loaded.fileSession) { event.preventDefault(); importInput.current?.click(); }
        if (key === "s") { event.preventDefault(); downloadJSON(); }
        if (key === "z" || key === "y") {
          event.preventDefault();
          setHistory(key === "y" || event.shiftKey ? redoHistory : undoHistory);
        }
      }
      if (reviewing) return;
      if (["Delete", "Backspace"].includes(event.key) && !modifier && !event.altKey && selection?.componentId) {
        event.preventDefault();
        const issue = componentRemovalIssue(draft, selection.componentId, selection.slideId);
        if (issue) { setNotice(issue); return; }
        updateDraft(removeComponent(draft, selection.componentId, selection.slideId), { selection: undefined });
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [draft, selection, reviewing, locked, review]);

  function persist(document: Draft, comments: ReviewState) {
    if (loaded.fileSession) {
      if (!fileIdentity) throw new Error("Wait for the file to open before commenting.");
      persistFileReview(fileIdentity.key, comments);
    } else if (loaded.exampleName) persistExampleDraft(loaded.exampleName, document, comments);
    else persistDraft(document, comments);
  }
  function updateDraft(next: Draft, options: { mergeKey?: string; selection?: ReviewTarget; review?: ReviewState } = {}) {
    setHistory(current => commitHistory(current, {
      draft: resolveDocument(toComposition(next)),
      review: options.review ?? current.present.review,
      selection: Object.hasOwn(options, "selection") ? options.selection : current.present.selection,
    }, options.mergeKey));
  }
  function select(slideId: string, componentId?: string) {
    setHistory(current => ({ ...finishHistoryEdit(current), present: { ...current.present, selection: { slideId, componentId } } }));
  }
  function updateComponent(slideId: string, component: CompositionComponent, mergeKey?: string) {
    const page = getSlide(draft, slideId);
    const issue = page.grid && component.area && areaIssue(page.grid, component.area);
    if (issue) { setNotice(issue); return; }
    updateDraft({ ...draft, slides: draft.slides.map(page => page.id === slideId
      ? { ...page, components: page.components.map(item => item.id === component.id ? component : item) } : page) }, { mergeKey: mergeKey && `${slideId}:${mergeKey}` });
  }
  function closeReview() {
    setReviewing(false); closeComment();
    requestAnimationFrame(() => reviewButton.current?.focus({ preventScroll: true }));
  }
  function closeComment() {
    setTarget(undefined);
  }
  function comment(next: ReviewTarget) {
    setNotice("");
    setReviewing(true); setTarget({ slideId: next.slideId, componentId: next.componentId, elementId: next.elementId });
    setHistory(current => ({ ...finishHistoryEdit(current), present: { ...current.present, selection: undefined } }));
  }
  function changeLocalReview(change: (value: ReviewState) => ReviewState) {
    if (blocked || !validation.ok) throw new Error("Save or download your work before changing comments.");
    const next = change(localReview);
    persist(draft, next);
    setHistory(current => commitHistory(current, { ...current.present, review: next }));
    return next;
  }
  function download(value: string, extension: string) {
    const url = URL.createObjectURL(new Blob([value], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.title.replace(/[^a-z0-9_-]+/gi, "-") || "konpeki-composition"}${extension}`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadJSON() {
    if (!validation.ok) { setNotice("Undo the invalid edit before downloading JSON."); return; }
    download(canonicalJSON(toComposition(draft)), ".json");
  }
  async function openComposition(file: File) {
    if (loaded.fileSession) { setNotice("Open a different file with konpeki preview."); return; }
    try {
      const parsed = parseCompositionJSON(await file.text());
      if (!parsed.ok) throw new Error(parsed.message);
      updateDraft(parsed.document, { selection: undefined, review: emptyReview() });
      setReviewSession(current => current + 1);
      closeReview(); setNotice("Composition opened. Undo restores the previous document and comments.");
    } catch (error) { setNotice(`Could not open: ${error instanceof Error ? error.message : "Invalid file"}`); }
  }
  function reset() {
    if (!window.confirm("Reset this browser-local composition and its comments? Download JSON and copy pending comments first to keep your work.")) return;
    try {
      if (loaded.exampleName) clearStoredExampleDraft(loaded.exampleName); else clearStoredDraft();
      setHistory(createHistory({ draft: loaded.exampleName ? structuredClone(exampleDraft(loaded.exampleName)!) : initialGridDraft(), review: emptyReview() }));
      setReviewSession(current => current + 1);
      setBlocked(false); setStorageError(""); closeReview();
    } catch { setStorageError("Storage remains unavailable. Download your work before reloading."); }
  }
  const recovery = fileSession.opening ? "Opening the composition…" : !validation.ok ? "This edit is invalid. Undo it before saving." : error || storageError;
  const pending = review.notes.filter(note => !note.resolved);
  return <>
    <main className={`workspace${reviewing ? " reviewing" : ""}`} aria-label="Composition canvas" inert={locked || undefined} data-file-status={loaded.fileSession ? fileSession.status : undefined}
      onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
      onDrop={event => { event.preventDefault(); if (!locked && event.dataTransfer.files[0]) void openComposition(event.dataTransfer.files[0]); }}>
      <header className="board-heading"><h1>{draft.title}</h1></header>
      <PageBoard draft={draft}>{(page, index) => <Canvas mode={reviewing ? "review" : "edit"} draft={draft} activeSlideId={page.id} pageNumber={index + 1}
        selected={selection?.slideId === page.id ? selection.componentId : undefined}
        commentTarget={target?.slideId === page.id ? target : undefined}
        onSelect={id => select(page.id, id)} onComment={componentId => comment({ slideId: page.id, ...(componentId ? { componentId } : {}) })}
        onSlideName={name => updateDraft({ ...draft, slides: draft.slides.map(item => item.id === page.id ? { ...item, name } : item) })}
        onComponent={(component, key) => updateComponent(page.id, component, key)}
        onDuplicate={(sourceId, rect) => {
          const next = duplicateComponent(draft, sourceId, page.id);
          if (next === draft) return;
          const nextPage = getSlide(next, page.id);
          const copy = nextPage.components.find(item => !page.components.some(old => old.id === item.id));
          if (!copy) return;
          const moved = transformComponentRect(copy, copy.preferredRect, rect, page.grid);
          nextPage.components = nextPage.components.map(item => item.id === copy.id ? moved : item);
          updateDraft(next, { selection: { slideId: page.id, componentId: moved.id }, mergeKey: `${page.id}:geometry:${moved.id}` });
          return moved;
        }}
        onEditEnd={() => setHistory(finishHistoryEdit)} onNotice={setNotice}
        revisionNotes={pending} onSelectNote={comment} />}</PageBoard>
      {!loaded.fileSession && <p className="board-help">Drop a composition JSON to open it · Ctrl/⌘ O to browse · Ctrl/⌘ S to save</p>}
      <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={event => {
        const file = event.currentTarget.files?.[0]; if (file) void openComposition(file); event.currentTarget.value = "";
      }} />
    </main>
    <RevisionNotes key={reviewSession} document={draft} open={reviewing} target={target} review={review}
      disabled={!validation.ok || (loaded.fileSession && fileSession.status !== "saved")} storageBlocked={blocked}
      onSelect={comment}
      onClose={target ? closeComment : closeReview}
      onAdd={(next, text) => {
        changeLocalReview(current => ({ ...current, version: current.version + 1, notes: [...current.notes, { ...next, id: crypto.randomUUID(), text: text.trim(), resolved: false }] }));
        closeComment();
      }}
      onPreparePrompt={() => reviewPrompt(draft, review, fileIdentity?.name)}
      onCopied={() => setNotice("Copied—paste into your agent.")}
      onRemove={id => { changeLocalReview(current => ({ ...current, version: current.version + 1, notes: current.notes.filter(note => note.id !== id) })); }} />
    <button ref={reviewButton} type="button" className="review-launcher" aria-label={reviewing ? `Close reviews, ${pending.length} pending reviews` : "Comment"} aria-pressed={reviewing} disabled={locked}
      aria-haspopup="dialog" aria-expanded={reviewing} aria-controls={reviewing ? "revision-notes" : undefined}
      title={reviewing ? "Close reviews" : "Open reviews"} onClick={() => {
        setNotice("");
        if (reviewing) closeReview();
        else { setReviewing(true); setHistory(current => ({ ...finishHistoryEdit(current), present: { ...current.present, selection: undefined } })); }
      }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-6 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /></svg>
      {(reviewing || !!pending.length) && <span className="review-count">{pending.length}</span>}
    </button>
    <FeedbackNotice kind="toast">{notice}</FeedbackNotice>
    <FeedbackNotice kind="recovery">{recovery && <><span>{recovery}</span>{!fileSession.opening && <div className="recovery-actions">
      {!validation.ok ? <button onClick={() => setHistory(undoHistory)}>Undo edit</button> : <>
        {!locked && <button onClick={downloadJSON}>Download JSON</button>}
        {loaded.fileSession ? fileSession.status === "conflict" ? <button onClick={() => { if (window.confirm("Load the current file? Download unsaved changes first.")) void fileSession.reload(); }}>Load file version</button>
          : <button onClick={() => {
            if (!storageError) void fileSession.retry();
            else if (window.confirm("Reload the file and saved comments? Download JSON and copy pending comments first to keep unsaved work.")) void fileSession.reload();
          }}>Retry</button> : <>{!loaded.storageBlocked && <button onClick={() => { setBlocked(false); setStorageError(""); }}>Retry save</button>}<button onClick={reset}>Reset saved draft</button></>}
      </>}
    </div>}</>}</FeedbackNotice>
  </>;
}
