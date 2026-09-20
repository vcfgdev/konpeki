import type { CSSProperties } from "react";
import type {
  CompositionSlide,
  ThemeMode,
} from "../../composition/types.ts";
import type { Draft } from "../lib/model.ts";

function ThumbnailCanvas({
  slide,
  themeMode,
  pageIndex,
  pageTotal,
}: {
  slide: CompositionSlide;
  themeMode: ThemeMode;
  pageIndex: number;
  pageTotal: number;
}) {
  return (
    <span className={`slide-thumbnail-canvas ${themeMode}`} style={{ aspectRatio: slide.canvas.width / slide.canvas.height }}>
      {slide.components.map((component) => {
        const rect = component.preferredRect;
        const style = {
          left: `${rect.x * 100 / slide.canvas.width}%`,
          top: `${rect.y * 100 / slide.canvas.height}%`,
          width: `${rect.width * 100 / slide.canvas.width}%`,
          height: `${rect.height * 100 / slide.canvas.height}%`,
        } as CSSProperties;
        return (
          <span
            key={component.id}
            className={`thumbnail-component kind-${component.kind} ${component.kind === "text-block" ? `role-${component.appearance.role}` : ""}`}
            style={style}
          />
        );
      })}
      {slide.pageNumber?.style !== "none" && (
        <span className="thumbnail-page-number">
          {String(pageIndex).padStart(2, "0")}
          {slide.pageNumber?.style === "01/02"
            ? `/${String(pageTotal).padStart(2, "0")}`
            : ""}
        </span>
      )}
    </span>
  );
}

export function LeftPanel({
  draft,
  activeSlideId,
  collapsed,
  onSelectSlide,
  onAddSlide,
  onRemoveSlide,
}: {
  draft: Draft;
  activeSlideId: string;
  collapsed: boolean;
  onSelectSlide: (id: string) => void;
  onAddSlide: () => void;
  onRemoveSlide: (id: string) => void;
}) {
  return (
    <aside className={`left-panel${collapsed ? " collapsed" : ""}`} aria-label="Workspace panel" inert={collapsed}>
      <div className="panel-toolbar">
        <span className="panel-heading">Pages</span>
      </div>
      <div className="slide-list">
        {draft.slides.map((item, index) => (
          <div key={item.id} className="slide-thumbnail-item">
            <button
              type="button"
              className={`slide-thumbnail ${item.id === activeSlideId ? "selected" : ""}`}
              aria-current={item.id === activeSlideId ? "page" : undefined}
              onClick={() => onSelectSlide(item.id)}
            >
              <ThumbnailCanvas
                slide={item}
                themeMode={draft.theme?.mode ?? "paper"}
                pageIndex={index + 1}
                pageTotal={draft.slides.length}
              />
              <span>{item.name}</span>
            </button>
            <button
              type="button"
              className="remove-slide"
              aria-label={`Remove ${item.name}`}
              onClick={() => onRemoveSlide(item.id)}
            >
              <span className="panel-close-icon" aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="add-slide"
          aria-label="Add page"
          onClick={onAddSlide}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </aside>
  );
}
