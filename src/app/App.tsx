import { useEffect, useMemo, useRef, useState } from "react";
import type { CompositionComponent } from "../../composition/types.ts";
import { validateComposition } from "../../composition/validate.ts";
import { removeVectorElement } from "../../composition/vector.ts";
import {
  addComponent,
  addSlide as appendSlide,
  componentRemovalIssue,
  componentInstanceLabel,
  componentLabels,
  duplicateComponent,
  getSlide,
  initialDraft,
  parseCompositionJSON,
  removeComponent,
  removeSlide as deleteSlide,
  reorderPaintOrder,
  transformComponentRect,
  type Draft,
} from "../lib/model.ts";
import {
  commitHistory,
  createHistory,
  finishHistoryEdit,
  redoHistory,
  undoHistory,
} from "../lib/history.ts";
import {
  clearStoredDraft,
  clearStoredExampleDraft,
  loadDraft,
  loadExampleDraft,
  persistDraft,
  persistExampleDraft,
} from "../lib/storage.ts";
import { canonicalJSON } from "../../composition/compile.ts";
import { diagramDefinition } from "../../composition/visualizations.ts";
import { Canvas } from "../components/Canvas.tsx";
import { BuildOrb } from "../components/BuildOrb.tsx";
import { LeftPanel, type LeftPanelView } from "../components/LeftPanel.tsx";
import { Presentation } from "../components/Presentation.tsx";
import {
  RightPanel,
  type RightPanelView,
} from "../components/RightPanel.tsx";
import { WorkspaceChrome } from "../components/WorkspaceChrome.tsx";
import { FeedbackNotice } from "../components/ui.tsx";
import { exampleDraft } from "../lib/examples.ts";
import { exportPagePNG } from "../lib/export-png.ts";
import { fileSessionToken } from "../lib/file-session.ts";
import { useFileSession } from "../lib/use-file-session.ts";
import { RevisionNotes } from "../components/RevisionNotes.tsx";
import type { ReviewTarget } from "../lib/review.ts";

const sessionToken = fileSessionToken();

function loadInitialDraft() {
  if (sessionToken)
    return {
      draft: initialDraft(true),
      storageBlocked: false,
      exampleName: undefined,
      fileSession: true,
    };
  const exampleName = new URLSearchParams(window.location.search).get("example");
  const example = exampleDraft(exampleName);
  return example
    ? {
        ...loadExampleDraft(exampleName!, example),
        exampleName: exampleName!,
        fileSession: false,
      }
    : { ...loadDraft(), exampleName: undefined, fileSession: false };
}

export function App() {
  const [loaded] = useState(loadInitialDraft);
  const [history, setHistory] = useState(() =>
    createHistory<{ draft: Draft; selected?: string; activeSlideId: string }>({
      draft: loaded.draft,
      activeSlideId: loaded.draft.slides[0].id,
    }),
  );
  const { draft, selected, activeSlideId } = history.present;
  const slide = getSlide(draft, activeSlideId);
  const validation = useMemo(() => validateComposition(draft), [draft]);
  const [savedDraft, setSavedDraft] = useState<Draft>();
  const [blocked, setBlocked] = useState(loaded.storageBlocked);
  const [requiresReset, setRequiresReset] = useState(loaded.storageBlocked);
  const [error, setError] = useState(loaded.error ?? "");
  const [notice, setNotice] = useState<{
    message: string;
    tone: "neutral" | "error";
  }>();
  const [toastPaused, setToastPaused] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftView, setLeftView] = useState<LeftPanelView>("pages");
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [rightView, setRightView] = useState<RightPanelView>("settings");
  const [vectorEditRequest, setVectorEditRequest] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [vectorSelection, setVectorSelection] = useState<{
    componentId: string;
    elementId?: string;
  }>();
  const [titleError, setTitleError] = useState(false);
  const title = useRef<HTMLInputElement>(null);
  const focusAfterHistory = useRef(false);
  const fileSession = useFileSession(loaded.fileSession, draft, {
    onOpen: (document, name) => {
      setHistory(createHistory({
        draft: document,
        activeSlideId: document.slides[0].id,
      }));
      showNotice(`${name} opened from the local service.`);
    },
    onExternalChange: (document) => {
      setHistory((current) => commitHistory(current, {
        draft: document,
        activeSlideId: document.slides.some(
          (candidate) => candidate.id === current.present.activeSlideId,
        ) ? current.present.activeSlideId : document.slides[0].id,
        selected: undefined,
      }));
    },
    onNotice: showNotice,
    onError: setError,
  });
  const fileLocked = loaded.fileSession && (!fileSession.ready || fileSession.opening);
  useEffect(() => {
    if (!focusAfterHistory.current) return;
    focusAfterHistory.current = false;
    const frame = requestAnimationFrame(() => {
      const target = history.present.selected
        ? [...document.querySelectorAll<HTMLElement>("[data-component]")]
            .find(
              (element) =>
                element.dataset.component === history.present.selected,
            )
            ?.querySelector<HTMLElement>(".component-surface")
        : document.querySelector<HTMLElement>("#canvas-stage");
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [history.present]);
  useEffect(() => {
    if (loaded.fileSession) return;
    if (blocked) return;
    if (!validation.ok) return;
    const timer = setTimeout(() => {
      try {
        if (loaded.exampleName) persistExampleDraft(loaded.exampleName, draft);
        else persistDraft(draft);
        setSavedDraft(draft);
      } catch {
        setError(
          "Unable to save this browser-local draft. Download JSON or reset to retry.",
        );
        setBlocked(true);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [draft, validation, blocked, loaded.exampleName, loaded.fileSession]);
  useEffect(() => {
    if (!notice || notice.tone === "error" || toastPaused) return;
    const timer = window.setTimeout(() => setNotice(undefined), 3000);
    return () => window.clearTimeout(timer);
  }, [notice, toastPaused]);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 1200px)");
    const compact = window.matchMedia("(max-width: 900px)");
    const adaptPanels = () => {
      setRightCollapsed(narrow.matches);
      setLeftCollapsed(compact.matches);
    };
    adaptPanels();
    narrow.addEventListener("change", adaptPanels);
    compact.addEventListener("change", adaptPanels);
    return () => {
      narrow.removeEventListener("change", adaptPanels);
      compact.removeEventListener("change", adaptPanels);
    };
  }, []);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (presenting || fileLocked || fileSession.building) return;
      const modifier = event.metaKey || event.ctrlKey;
      const target = event.target;
      const editable =
        target instanceof HTMLElement &&
        (target.closest("input,textarea,select") || target.isContentEditable);
      const slideRename =
        target instanceof HTMLInputElement &&
        target.getAttribute("aria-label") === "Page name";
      const noteEditing = target instanceof HTMLTextAreaElement && target.id === "revision-note";
      if (event.key === "Escape" && !editable && vectorSelection) {
        setVectorSelection(undefined);
        return;
      }
      if (modifier && !event.altKey && event.key.toLowerCase() === "z") {
        if (slideRename || noteEditing) return;
        event.preventDefault();
        setHistory((current) =>
          event.shiftKey ? redoHistory(current) : undoHistory(current),
        );
        return;
      }
      if (
        modifier &&
        !event.altKey &&
        event.key.toLowerCase() === "y"
      ) {
        if (slideRename || noteEditing) return;
        event.preventDefault();
        setHistory(redoHistory);
        return;
      }
      if (
        modifier &&
        !event.altKey &&
        event.key.toLowerCase() === "d" &&
        selected &&
        !editable
      ) {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (
        !["Delete", "Backspace"].includes(event.key) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !selected
      )
        return;
      if (editable) return;
      event.preventDefault();
      deleteSelected();
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [draft, presenting, selected, vectorSelection, fileSession.building, fileLocked]);
  function showNotice(message: string, tone: "neutral" | "error" = "neutral") {
    if (!message) setToastPaused(false);
    setNotice(message ? { message: message.replace(/\.$/, ""), tone } : undefined);
  }
  function updateDraft(
    next: Draft,
    options: { mergeKey?: string; selected?: string; activeSlideId?: string } = {},
  ) {
    setHistory((current) =>
      commitHistory(
        current,
        {
          draft: next,
          selected: Object.hasOwn(options, "selected")
            ? options.selected
            : current.present.selected,
          activeSlideId: options.activeSlideId ?? current.present.activeSlideId,
        },
        options.mergeKey,
      ),
    );
  }
  function selectComponent(id?: string) {
    if (!id || vectorSelection?.componentId !== id) setVectorSelection(undefined);
    setHistory((current) => {
      const next = finishHistoryEdit(current);
      return { ...next, present: { ...next.present, selected: id } };
    });
  }
  function selectSlide(id: string) {
    setVectorSelection(undefined);
    setHistory((current) => {
      const next = finishHistoryEdit(current);
      return {
        ...next,
        present: { ...next.present, activeSlideId: id, selected: undefined },
      };
    });
  }
  function addNewSlide() {
    const result = appendSlide(draft);
    if (!result.slideId) {
      showNotice("Could not add a page until the composition is valid.", "error");
      return;
    }
    focusAfterHistory.current = true;
    updateDraft(result.draft, {
      activeSlideId: result.slideId,
      selected: undefined,
    });
    showNotice("Page added.");
  }
  function removeExistingSlide(id: string) {
    if (draft.slides.length === 1) {
      showNotice("A document needs at least one page.", "error");
      return;
    }
    const index = draft.slides.findIndex((item) => item.id === id);
    const next = deleteSlide(draft, id);
    if (next === draft) return;
    const nextActiveSlideId =
      id === slide.id
        ? next.slides[Math.min(index, next.slides.length - 1)].id
        : slide.id;
    focusAfterHistory.current = true;
    updateDraft(next, {
      activeSlideId: nextActiveSlideId,
      selected: id === slide.id ? undefined : selected,
    });
    showNotice("Page deleted.");
  }
  function finishEdit() {
    setHistory(finishHistoryEdit);
  }
  function performRedo() {
    focusAfterHistory.current = true;
    setHistory(redoHistory);
  }
  function updateComponent(
    component: CompositionComponent,
    mergeKey?: string,
  ) {
    const previous = slide.components.find(
      (candidate) => candidate.id === component.id,
    );
    const nextComponent = previous && (
      previous.preferredRect.x !== component.preferredRect.x ||
      previous.preferredRect.y !== component.preferredRect.y ||
      previous.preferredRect.width !== component.preferredRect.width ||
      previous.preferredRect.height !== component.preferredRect.height
    )
      ? transformComponentRect(
          component,
          previous.preferredRect,
          component.preferredRect,
        )
      : component;
    const diagramTypeChanged =
      previous?.kind === "diagram" &&
      nextComponent.kind === "diagram" &&
      previous.appearance.type !== nextComponent.appearance.type;
    updateDraft(
      {
        ...draft,
        slides: draft.slides.map((item) =>
          item.id === slide.id
            ? {
                ...item,
                components: item.components.map((candidate) =>
                  candidate.id === nextComponent.id ? nextComponent : candidate,
                ),
                contentSlots: item.contentSlots.map((slot) => {
                  if (
                    !nextComponent.slotIds.includes(slot.id) ||
                    "targets" in slot
                  )
                    return slot;
                  if (
                    diagramTypeChanged &&
                    nextComponent.kind === "diagram" &&
                    ["process-step", "entity"].includes(slot.role)
                  )
                    return {
                      ...slot,
                      role: diagramDefinition(nextComponent.appearance.type).slotRole,
                    };
                  return slot;
                }),
              }
            : item,
        ),
      },
      { mergeKey },
    );
  }
  function add(
    kind: CompositionComponent["kind"],
    at?: { x: number; y: number },
  ) {
    const next = addComponent(draft, kind, at, slide.id);
    if (next === draft) return;
    const nextSlide = getSlide(next, slide.id);
    const id = nextSlide.components.find(
      (component) =>
        !slide.components.some((item) => item.id === component.id),
    )!.id;
    focusAfterHistory.current = true;
    updateDraft(next, { selected: id });
    showNotice(`${componentLabels[kind]} added.`);
  }
  function duplicateSelected() {
    if (!selected) return;
    const next = duplicateComponent(draft, selected, slide.id);
    if (next === draft) return;
    const nextSlide = getSlide(next, slide.id);
    const id = nextSlide.components.find(
      (component) =>
        !slide.components.some((item) => item.id === component.id),
    )!.id;
    focusAfterHistory.current = true;
    updateDraft(next, { selected: id });
    showNotice("Component duplicated.");
  }
  function updatePaintOrder(ids: string[]) {
    const next = reorderPaintOrder(draft, ids, slide.id);
    if (next === draft) return;
    updateDraft(next);
  }
  function deleteSelected() {
    if (!selected) return;
    if (vectorSelection?.componentId === selected) {
      const component = slide.components.find((item) => item.id === selected);
      if (component?.customVisual?.format === "vector" && vectorSelection.elementId) {
        updateComponent({
          ...component,
          customVisual: {
            ...component.customVisual,
            elements: removeVectorElement(component.customVisual.elements, vectorSelection.elementId),
          },
        });
        setVectorSelection({ componentId: selected });
      }
      return;
    }
    remove(selected);
  }
  function remove(id: string) {
    const issue = componentRemovalIssue(draft, id, slide.id);
    if (issue) {
      showNotice(issue, "error");
      return;
    }
    const index = slide.components.findIndex((component) => component.id === id);
    const next = removeComponent(draft, id, slide.id);
    if (next === draft) return;
    const nextSelected =
      selected === id
        ? slide.components[index - 1]?.id ?? slide.components[index + 1]?.id
        : selected;
    focusAfterHistory.current = true;
    updateDraft(next, { selected: nextSelected });
    showNotice("Component deleted.");
  }
  function selectNoteTarget(target: ReviewTarget & { id?: string }) {
    const page = draft.slides.find(s => s.id === target.slideId);
    if (!page) return;
    selectSlide(page.id);
    setLeftCollapsed(false);
    setLeftView("notes");
    const component = page.components.find(c => c.id === target.componentId);
    if (component) {
      selectComponent(component.id);
      if (target.elementId && component.customVisual?.format === "vector" && component.customVisual.elements.some(e => e.id === target.elementId))
        setVectorSelection({ componentId: component.id, elementId: target.elementId });
    }
    if (target.id) requestAnimationFrame(() => document.getElementById(`note-${target.id}`)?.scrollIntoView({ block: "nearest" }));
  }
  async function requestBuild() {
    try {
      const instruction = fileSession.review.notes.some(note => !note.resolved)
        ? "Apply the attached revision notes to their named targets. Preserve unrelated human edits. Validate and inspect the result, then acknowledge this request with konpeki finish."
        : selected
        ? "Review the selected component in context and build it from the current saved composition."
        : "Review the current slides and build them from the current saved composition.";
      const requested = await fileSession.build(instruction, slide.id, selected, vectorSelection?.componentId === selected ? vectorSelection?.elementId : undefined);
      if (requested) {
        setNotice(undefined);
        setToastPaused(false);
      }
    } catch (requestError) {
      showNotice(requestError instanceof Error ? requestError.message : "Could not send the build request.", "error");
    }
  }
  async function openComposition(file: File) {
    let raw = "";
    try {
      raw = await file.text();
    } catch {
      showNotice("Could not read that composition file.", "error");
      return;
    }
    const parsed = parseCompositionJSON(raw);
    if (!parsed.ok) {
      showNotice(`Could not open: ${parsed.message}`, "error");
      return;
    }
    focusAfterHistory.current = true;
    updateDraft(parsed.document, {
      activeSlideId: parsed.document.slides[0].id,
      selected: undefined,
    });
    setTitleError(false);
    showNotice("Editable composition opened. Undo restores the previous document.");
  }
  function present() {
    const validation = validateComposition(draft);
    if (!validation.ok) {
      const issue = validation.issues[0];
      showNotice(
        `Cannot present: ${issue?.path || "document"} ${issue?.message || "is invalid"}.`,
        "error",
      );
      return;
    }
    selectComponent();
    setPresenting(true);
  }
  async function downloadPNG() {
    const source = document.querySelector<HTMLElement>(".workspace .canvas");
    if (!source) return;
    setExportBusy(true);
    showNotice("Exporting page…");
    try {
      const blob = await exportPagePNG(source, slide.canvas);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slide.name.replace(/[^a-z0-9_-]+/gi, "-") || "konpeki-page"}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showNotice(
        `PNG exported at ${slide.canvas.width} × ${slide.canvas.height}.`,
      );
    } catch (exportError) {
      showNotice(
        `Could not export PNG: ${exportError instanceof Error ? exportError.message : "Unknown error"}`,
        "error",
      );
    } finally {
      setExportBusy(false);
    }
  }
  function downloadJSON() {
    const validation = validateComposition(draft);
    if (!validation.ok) {
      showNotice("Fix the composition before downloading JSON.", "error");
      return;
    }
    const blob = new Blob([canonicalJSON(draft)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.title.replace(/[^a-z0-9_-]+/gi, "-") || "konpeki-composition"}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotice("Editable composition JSON downloaded.");
  }
  function startBlank() {
    if (!window.confirm(
      "Start with a blank composition? You can undo this replacement until you reload.",
    )) return;
    const next = initialDraft(true);
    focusAfterHistory.current = true;
    updateDraft(next, {
      activeSlideId: next.slides[0].id,
      selected: undefined,
    });
    setTitleError(false);
    showNotice("Blank composition started. Undo restores the previous document.");
  }
  function reset() {
    const target = loaded.exampleName ? "example" : "saved local draft";
    if (!window.confirm(
      `Reset this ${target}? This removes its browser-local working copy.`,
    )) return;
    try {
      if (loaded.exampleName) clearStoredExampleDraft(loaded.exampleName);
      else clearStoredDraft();
      const next = loaded.exampleName
        ? structuredClone(exampleDraft(loaded.exampleName)!)
        : initialDraft(true);
      setHistory(
        createHistory({ draft: next, activeSlideId: next.slides[0].id }),
      );
      setBlocked(false);
      setRequiresReset(false);
      setError("");
      setTitleError(false);
      showNotice(loaded.exampleName ? "Example reset." : "Saved draft reset.");
    } catch {
      setBlocked(true);
      setError("Storage remains unavailable. Export your work to keep it.");
    }
  }
  const browserSaveMessage = !validation.ok
    ? `Autosave paused: ${validation.issues[0]?.path || "document"} ${validation.issues[0]?.message || "is invalid"}. Fix this to resume saving.`
    : blocked
      ? "Changes are not being saved. Download JSON to keep your work."
      : savedDraft !== draft
        ? "Saving changes in this browser…"
        : "Your editable composition is saved only in this browser.";
  const recoveryMessage = fileSession.opening
    ? "Opening the file… Editing is paused."
    : !validation.ok
    ? `Changes are not saved: ${validation.issues[0]?.path || "document"} ${validation.issues[0]?.message || "is invalid"}. Undo the edit or correct this value.`
    : error;
  const selectedComponent = slide.components.find((c) => c.id === selected);
  const buildState = fileSession.building
    ? fileSession.review.request?.status === "working" ? "working" : "ready"
    : undefined;
  function useComponentTool(kind: CompositionComponent["kind"]) {
    add(kind);
  }
  return (
    <>
      <a className="skip-link" href="#canvas-stage">
        Skip to canvas
      </a>
      <FeedbackNotice kind="recovery">
        {recoveryMessage ? <>
          <span>{recoveryMessage}</span>
          <div className="recovery-actions">
            {!validation.ok ? <button type="button" onClick={() => setHistory(current => undoHistory(current))}>Undo edit</button> : <>
              {(!loaded.fileSession || fileSession.ready) && <button type="button" onClick={downloadJSON}>Download JSON</button>}
              {loaded.fileSession ? fileSession.status === "conflict" ? (
                <button type="button" onClick={() => {
                  if (window.confirm("Replace your browser edits with the current file? Download JSON first to keep a copy.")) void fileSession.reload();
                }}>Load file version</button>
              ) : <button type="button" disabled={fileSession.opening} onClick={() => { void fileSession.retry(); }}>{fileSession.opening ? "Opening…" : fileSession.ready ? "Retry save" : "Retry open"}</button> : <>
                {!requiresReset && <button type="button" onClick={() => { setBlocked(false); setError(""); }}>Retry save</button>}
                <button type="button" onClick={reset}>{loaded.exampleName ? "Reset example" : "Reset saved draft"}</button>
              </>}
            </>}
          </div>
        </> : null}
      </FeedbackNotice>
      <div
        className={`workspace ${fileSession.building ? "is-building" : ""} ${leftCollapsed ? "left-collapsed" : ""} ${rightCollapsed ? "right-collapsed" : ""}`}
        aria-hidden={presenting || undefined}
        inert={presenting || fileLocked || undefined}
        aria-busy={fileSession.opening || undefined}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          if (fileLocked || fileSession.building) {
            event.preventDefault();
            return;
          }
          const file = event.dataTransfer.files[0];
          if (!file) return;
          event.preventDefault();
          void openComposition(file);
        }}
      >
        <WorkspaceChrome
          leftCollapsed={leftCollapsed}
          onToggleLeftPanel={() => setLeftCollapsed(!leftCollapsed)}
          title={draft.title}
          titleRef={title}
          titleError={titleError}
          selectedKind={selectedComponent?.kind}
          onTitle={(value, mergeKey) => {
            updateDraft({ ...draft, title: value }, { mergeKey });
            setTitleError(false);
          }}
          onEditEnd={finishEdit}
          onExportPNG={() => { void downloadPNG(); }}
          exporting={exportBusy}
          onPresent={present}
          fileStatus={loaded.fileSession ? fileSession.status : undefined}
          building={fileSession.building}
          buildState={buildState}
          onBuild={loaded.fileSession ? () => { void requestBuild(); } : undefined}
          browserTools={loaded.fileSession ? undefined : {
            example: Boolean(loaded.exampleName),
            saveMessage: browserSaveMessage,
            onImportJSON: (file) => { void openComposition(file); },
            onDownloadJSON: downloadJSON,
            onStartBlank: startBlank,
            onReset: reset,
          }}
          onSelectTool={() => selectComponent()}
          onComponentTool={useComponentTool}
        >
        <LeftPanel
          draft={draft}
          view={leftView}
          onView={setLeftView}
          revisionNotes={loaded.fileSession && <RevisionNotes
            document={draft}
            target={{ slideId: slide.id, ...(selected ? { componentId: selected } : {}), ...(vectorSelection?.componentId === selected && vectorSelection?.elementId ? { elementId: vectorSelection.elementId } : {}) }}
            review={fileSession.review}
            disabled={fileSession.building || fileSession.status !== "saved"}
            onAdd={fileSession.addNote}
            onRemove={fileSession.removeNote}
            onSelect={selectNoteTarget}
            onNotice={(message) => showNotice(message, "error")}
          />}
          activeSlideId={slide.id}
          collapsed={leftCollapsed}
          onSelectSlide={selectSlide}
          onAddSlide={addNewSlide}
          onRemoveSlide={removeExistingSlide}
        />
        </WorkspaceChrome>
        <div className="editor-content" inert={fileSession.building} aria-busy={fileSession.building}>
        <Canvas
          key={slide.id}
          revisionNotes={fileSession.review.notes.filter(note => !note.resolved)}
          onSelectNote={selectNoteTarget}
          draft={draft}
          activeSlideId={slide.id}
          selected={selected}
          vectorSelection={vectorSelection}
          onSelect={selectComponent}
          onVectorSelect={(selection, edit) => {
            if (selection) {
              selectComponent(selection.componentId);
              setVectorSelection(selection);
              setRightView("settings");
              if (edit) {
                setRightCollapsed(false);
                setVectorEditRequest((request) => request + 1);
              }
            } else setVectorSelection(undefined);
          }}
          onSlideName={(name) =>
            updateDraft({
              ...draft,
              slides: draft.slides.map((item) =>
                item.id === slide.id ? { ...item, name } : item,
              ),
            })
          }
          onComponent={updateComponent}
          onDuplicate={(sourceId, rect) => {
            const next = duplicateComponent(draft, sourceId, slide.id);
            if (next === draft) return;
            const nextSlide = getSlide(next, slide.id);
            const copy = nextSlide.components.find(candidate => !slide.components.some(existing => existing.id === candidate.id));
            if (!copy) return;
            const moved = transformComponentRect(copy, copy.preferredRect, rect);
            nextSlide.components = nextSlide.components.map(candidate => candidate.id === copy.id ? moved : candidate);
            setVectorSelection(undefined);
            updateDraft(next, { selected: moved.id, mergeKey: `geometry:${moved.id}` });
            return moved;
          }}
          onEditEnd={finishEdit}
          onAdd={add}
          onNotice={showNotice}
        />
        <RightPanel
          view={rightView}
          collapsed={rightCollapsed}
          vectorEditRequest={vectorEditRequest}
          component={selectedComponent}
          selectedComponentId={selected}
          selectedVectorElementId={
            vectorSelection && vectorSelection.componentId === selected
              ? vectorSelection.elementId
              : undefined
          }
          componentLabel={
            selected
              ? componentInstanceLabel(slide.components, selected)
              : undefined
          }
          slide={slide}
          draft={draft}
          onView={setRightView}
          onCollapsedChange={setRightCollapsed}
          onSelectSlide={() => selectComponent()}
          onSelectComponent={selectComponent}
          onSelectVectorElement={(elementId) =>
            selected && setVectorSelection({ componentId: selected, elementId })
          }
          onSelectOverflow={(componentId, elementId) => {
            selectComponent(componentId);
            setVectorSelection(elementId ? { componentId, elementId } : undefined);
            setRightView("settings");
            setRightCollapsed(false);
            if (elementId) setVectorEditRequest(request => request + 1);
          }}
          onReorderPaintOrder={updatePaintOrder}
          onComponent={updateComponent}
          onSlide={(nextSlide, mergeKey) =>
            updateDraft(
              {
                ...draft,
                slides: draft.slides.map((item) =>
                  item.id === nextSlide.id ? nextSlide : item,
                ),
              },
              { mergeKey },
            )
          }
          onDraft={(patch, mergeKey) =>
            updateDraft({ ...draft, ...patch }, { mergeKey })
          }
          onEditEnd={finishEdit}
        />
        </div>
        {fileSession.building && (
          <div className="stage build-loading" role="status" aria-live="polite">
            <div className="build-loading-card">
              <div className="build-nebula"><BuildOrb active nebula /></div>
              {buildState === "working" ? <>
                <strong>Agent working</strong>
                <span>Updating this composition. Editing resumes when the request finishes.</span>
              </> : <>
                <strong>Request ready</strong>
                <span>Copy the handoff prompt to ask your coding agent to apply these changes.</span>
                <button type="button" className="primary" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText("Pick up my pending Konpeki request and apply the changes.");
                    showNotice("Prompt copied");
                  } catch {
                    showNotice("Could not copy. Ask your coding agent to pick up your pending Konpeki request", "error");
                  }
                }}>Copy prompt</button>
              </>}
              <button type="button" onClick={() => { void fileSession.cancel().catch(error => showNotice(error.message, "error")); }}>Cancel request</button>
            </div>
          </div>
        )}
      </div>
      {presenting && (
        <Presentation
          draft={draft}
          initialSlideId={slide.id}
          onExit={() => setPresenting(false)}
        />
      )}
      <FeedbackNotice kind="toast" tone={notice?.tone} onPauseChange={setToastPaused}
        onDismiss={() => { setNotice(undefined); setToastPaused(false); }}>
        {notice?.message}
      </FeedbackNotice>
    </>
  );
}
