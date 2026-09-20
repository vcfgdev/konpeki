import { useEffect, useRef, useState } from "react";
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
import { clearStoredDraft, loadDraft, persistDraft } from "../lib/storage.ts";
import { diagramDefinition } from "../../composition/visualizations.ts";
import { Canvas } from "../components/Canvas.tsx";
import { LeftPanel } from "../components/LeftPanel.tsx";
import { Presentation } from "../components/Presentation.tsx";
import {
  RightPanel,
  type RightPanelView,
} from "../components/RightPanel.tsx";
import { WorkspaceChrome } from "../components/WorkspaceChrome.tsx";
import { exampleDraft } from "../lib/examples.ts";
import { exportPagePNG } from "../lib/export-png.ts";
import { fileSessionToken } from "../lib/file-session.ts";
import { useFileSession } from "../lib/use-file-session.ts";

const sessionToken = fileSessionToken();

function loadInitialDraft() {
  if (sessionToken)
    return {
      draft: initialDraft(true),
      storageBlocked: false,
      example: false,
      fileSession: true,
    };
  const example = exampleDraft(
    new URLSearchParams(window.location.search).get("example"),
  );
  return example
    ? { draft: example, storageBlocked: false, example: true, fileSession: false }
    : { ...loadDraft(), example: false, fileSession: false };
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
  const [blocked, setBlocked] = useState(loaded.storageBlocked);
  const [error, setError] = useState(loaded.error ?? "");
  const [notice, setNotice] = useState<{
    message: string;
  }>();
  const [toastClosing, setToastClosing] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [rightView, setRightView] = useState<RightPanelView>("settings");
  const [vectorEditRequest, setVectorEditRequest] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [buildBusy, setBuildBusy] = useState(false);
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
      showNotice("Agent changes loaded. Undo restores the previous composition.");
    },
    onNotice: showNotice,
    onError: setError,
  });
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
    if (blocked || loaded.example) return;
    if (!validateComposition(draft).ok) return;
    const timer = setTimeout(() => {
      try {
        persistDraft(draft);
      } catch {
        setError(
          "Unable to save this draft. Export your work or reset saved draft to retry.",
        );
        setBlocked(true);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [draft, blocked, loaded.example, loaded.fileSession]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setToastClosing(true), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!toastClosing) return;
    const timer = window.setTimeout(() => {
      setNotice(undefined);
      setToastClosing(false);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [toastClosing]);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (presenting) return;
      const modifier = event.metaKey || event.ctrlKey;
      const target = event.target;
      const editable =
        target instanceof HTMLElement &&
        (target.closest("input,textarea,select") || target.isContentEditable);
      const slideRename =
        target instanceof HTMLInputElement &&
        target.getAttribute("aria-label") === "Page name";
      if (event.key === "Escape" && !editable && vectorSelection) {
        setVectorSelection(undefined);
        return;
      }
      if (modifier && !event.altKey && event.key.toLowerCase() === "z") {
        if (slideRename) return;
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
        if (slideRename) return;
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
  }, [draft, presenting, selected, vectorSelection]);
  function showNotice(message: string) {
    setToastClosing(false);
    setNotice({ message: message.replace(/\.$/, "") });
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
      showNotice("Could not add a page until the composition is valid.");
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
      showNotice("A document needs at least one page.");
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
      showNotice(issue);
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
  async function requestBuild() {
    setBuildBusy(true);
    try {
      const instruction = selected
        ? "Review the selected component in context and build it from the current saved composition."
        : "Review the current slides and build them from the current saved composition.";
      if (!await fileSession.build(instruction, slide.id, selected)) return;
      showNotice("Build request sent. The agent will reread this saved revision.");
    } catch (requestError) {
      showNotice(requestError instanceof Error ? requestError.message : "Could not send the build request.");
    } finally {
      setBuildBusy(false);
    }
  }
  async function openComposition(file: File) {
    let raw = "";
    try {
      raw = await file.text();
    } catch {
      showNotice("Could not read that composition file.");
      return;
    }
    const parsed = parseCompositionJSON(raw);
    if (!parsed.ok) {
      showNotice(`Could not open: ${parsed.message}`);
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
      );
    } finally {
      setExportBusy(false);
    }
  }
  function reset() {
    try {
      clearStoredDraft();
      const next = initialDraft(true);
      setHistory(
        createHistory({ draft: next, activeSlideId: next.slides[0].id }),
      );
      setBlocked(false);
      setError("");
      showNotice("Saved draft reset.");
    } catch {
      setError("Storage remains unavailable. Export your work to keep it.");
    }
  }
  const selectedComponent = slide.components.find((c) => c.id === selected);
  function useComponentTool(kind: CompositionComponent["kind"]) {
    add(kind);
  }
  return (
    <>
      <a className="skip-link" href="#canvas-stage">
        Skip to canvas
      </a>
      {error && (
        <div className="recovery" role="alert">
          <span>{error}</span>
          <button type="button" onClick={reset}>
            Reset saved draft
          </button>
        </div>
      )}
      <div
        className={`workspace ${leftCollapsed ? "left-collapsed" : ""} ${rightCollapsed ? "right-collapsed" : ""}`}
        aria-hidden={presenting || undefined}
        inert={presenting || undefined}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
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
          building={buildBusy}
          onBuild={loaded.fileSession ? () => { void requestBuild(); } : undefined}
          onSelectTool={() => selectComponent()}
          onComponentTool={useComponentTool}
        />
        <LeftPanel
          draft={draft}
          activeSlideId={slide.id}
          collapsed={leftCollapsed}
          onSelectSlide={selectSlide}
          onAddSlide={addNewSlide}
          onRemoveSlide={removeExistingSlide}
        />
        <Canvas
          key={slide.id}
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
      {presenting && (
        <Presentation
          draft={draft}
          initialSlideId={slide.id}
          onExit={() => setPresenting(false)}
        />
      )}
      <div
        className={`toast ${notice ? "visible" : ""} ${toastClosing ? "closing" : ""}`}
      >
        <span role="status" aria-live="polite">
          {notice?.message}
        </span>
      </div>
    </>
  );
}
