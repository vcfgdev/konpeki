import { useState } from "react";
import type {
  CompositionComponent,
  CompositionSlide,
} from "../../composition/types.ts";
import { componentInstanceLabel, type Draft } from "../lib/model.ts";
import { InspectorPanel } from "./InspectorPanel.tsx";

export type RightPanelView = "settings" | "layers";

function LayersPanel({
  slide,
  selectedComponentId,
  onSelectComponent,
  onReorderPaintOrder,
}: {
  slide: CompositionSlide;
  selectedComponentId?: string;
  onSelectComponent: (id: string) => void;
  onReorderPaintOrder: (ids: string[]) => void;
}) {
  const [dragging, setDragging] = useState<string>();
  const layers = [...slide.paintOrder].reverse();
  function moveLayer(id: string, toIndex: number) {
    const next = layers.filter((item) => item !== id);
    next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, id);
    onReorderPaintOrder(next.reverse());
  }
  return (
    <section className="layers-panel" aria-labelledby="layers-heading">
      <div className="layers-heading-row">
        <h2 id="layers-heading">Components & layers</h2>
        <span>Front to back</span>
      </div>
      {layers.length ? (
        <div className="layer-list">
          {layers.map((id, index) => {
            const component = slide.components.find((item) => item.id === id)!;
            const groups = slide.groups
              .filter((group) => group.childIds.includes(id))
              .map((group) => group.label?.trim() || group.id);
            const label = componentInstanceLabel(slide.components, id);
            return (
              <div
                key={id}
                data-layer={id}
                className={`layer-row ${selectedComponentId === id ? "selected" : ""} ${dragging === id ? "dragging" : ""}`}
                draggable
                onDragStart={(event) => {
                  setDragging(id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", id);
                }}
                onDragEnd={() => setDragging(undefined)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const source = dragging || event.dataTransfer.getData("text/plain");
                  if (source && source !== id) moveLayer(source, index);
                  setDragging(undefined);
                }}
              >
                <span className="layer-drag" aria-hidden="true">⠿</span>
                <button
                  type="button"
                  className="layer-select"
                  onClick={() => onSelectComponent(id)}
                >
                  <strong>{label}</strong>
                  <span>{groups.length ? groups.join(", ") : "Page root"}</span>
                </button>
                <span className="layer-actions">
                  <button
                    type="button"
                    aria-label={`Move ${label} forward`}
                    disabled={index === 0}
                    onClick={() => moveLayer(id, index - 1)}
                  >↑</button>
                  <button
                    type="button"
                    aria-label={`Move ${label} backward`}
                    disabled={index === layers.length - 1}
                    onClick={() => moveLayer(id, index + 1)}
                  >↓</button>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="layers-empty">No components yet.</p>
      )}
    </section>
  );
}

export function RightPanel({
  view,
  collapsed,
  component,
  componentLabel,
  selectedComponentId,
  selectedVectorElementId,
  vectorEditRequest,
  slide,
  draft,
  onView,
  onCollapsedChange,
  onSelectSlide,
  onSelectComponent,
  onSelectVectorElement,
  onReorderPaintOrder,
  onComponent,
  onSlide,
  onDraft,
  onEditEnd,
}: {
  view: RightPanelView;
  collapsed: boolean;
  component?: CompositionComponent;
  componentLabel?: string;
  selectedComponentId?: string;
  selectedVectorElementId?: string;
  vectorEditRequest?: number;
  slide: CompositionSlide;
  draft: Draft;
  onView: (view: RightPanelView) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  onSelectSlide: () => void;
  onSelectComponent: (id: string) => void;
  onSelectVectorElement: (id?: string) => void;
  onReorderPaintOrder: (ids: string[]) => void;
  onComponent: (component: CompositionComponent, mergeKey?: string) => void;
  onSlide: (slide: CompositionSlide, mergeKey?: string) => void;
  onDraft: (patch: Partial<Draft>, mergeKey?: string) => void;
  onEditEnd: () => void;
}) {
  return (
    <aside className={`right-panel${collapsed ? " collapsed" : ""}`} aria-label="Inspector panel">
      <div className="panel-toolbar">
        <div className="panel-tabs" aria-label="Right panel view" inert={collapsed}>
          {(["settings", "layers"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={view === tab}
              className={view === tab ? "active" : ""}
              onClick={() => onView(tab)}
            >
              {tab === "settings" ? "Settings" : "Layers"}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="panel-toggle"
          aria-label={collapsed ? "Expand right panel" : "Collapse right panel"}
          aria-expanded={!collapsed}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          <svg
            className="panel-collapse-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d={collapsed ? "M15 4v16M11 9l-3 3 3 3" : "M15 4v16M8 9l3 3-3 3"} />
          </svg>
        </button>
      </div>
      <div className="right-panel-body" inert={collapsed}>
      {view === "settings" ? (
        <InspectorPanel
          component={component}
          componentLabel={componentLabel}
          slide={slide}
          draft={draft}
          selectedVectorElementId={selectedVectorElementId}
          vectorEditRequest={vectorEditRequest}
          onSelectSlide={onSelectSlide}
          onSelectVectorElement={onSelectVectorElement}
          onComponent={onComponent}
          onSlide={onSlide}
          onDraft={onDraft}
          onEditEnd={onEditEnd}
        />
      ) : (
        <LayersPanel
          slide={slide}
          selectedComponentId={selectedComponentId}
          onSelectComponent={onSelectComponent}
          onReorderPaintOrder={onReorderPaintOrder}
        />
      )}
      </div>
    </aside>
  );
}
