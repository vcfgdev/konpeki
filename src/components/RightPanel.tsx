import { useState } from "react";
import type {
  CompositionComponent,
  CompositionSlide,
} from "../../composition/types.ts";
import { componentInstanceLabel, type Draft } from "../lib/model.ts";
import { InspectorPanel } from "./InspectorPanel.tsx";
import { VectorOverflowWarning } from "./VectorOverflowWarning.tsx";

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
  const [dropIndex, setDropIndex] = useState<number>();
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
        <div className="layer-list"
          onDragOver={(event) => {
            if (!dragging) return;
            event.preventDefault();
            const rows = [...event.currentTarget.querySelectorAll<HTMLElement>(".layer-row")];
            const next = rows.findIndex((row) => {
              const rect = row.getBoundingClientRect();
              return event.clientY < rect.top + rect.height / 2;
            });
            const boundary = next < 0 ? layers.length : next;
            const sourceIndex = layers.indexOf(dragging);
            const unchanged = boundary === sourceIndex || boundary === sourceIndex + 1;
            event.dataTransfer.dropEffect = unchanged ? "none" : "move";
            setDropIndex(unchanged ? undefined : boundary);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDropIndex(undefined);
            }
          }}
          onDrop={(event) => {
            if (!dragging) return;
            event.preventDefault();
            if (dropIndex !== undefined) {
              moveLayer(dragging, dropIndex > layers.indexOf(dragging) ? dropIndex - 1 : dropIndex);
            }
            setDragging(undefined);
            setDropIndex(undefined);
          }}
        >
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
                data-drop-edge={dropIndex === index ? "before" : dropIndex === layers.length && index === layers.length - 1 ? "after" : undefined}
                className={`layer-row ${selectedComponentId === id ? "selected" : ""} ${dragging === id ? "dragging" : ""}`}
                draggable
                onDragStart={(event) => {
                  setDragging(id);
                  setDropIndex(undefined);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", id);
                }}
                onDragEnd={() => {
                  setDragging(undefined);
                  setDropIndex(undefined);
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
  onSelectOverflow,
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
  onSelectOverflow: (componentId: string, elementId?: string) => void;
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
        <div className="overflow-control" inert={collapsed}>
          <VectorOverflowWarning slide={slide} theme={draft.theme} onSelect={onSelectOverflow} />
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
          key={component?.id ?? slide.id}
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
