import type { RefObject } from "react";
import type { CompositionComponent } from "../../composition/types.ts";
import { componentLabels } from "../lib/model.ts";
import mark from "../assets/konpeki-mark.png";
import { BuildOrb } from "./BuildOrb.tsx";

const dockItems: {
  kind: CompositionComponent["kind"];
}[] = [
  { kind: "text-block" },
  { kind: "diagram" },
  { kind: "chart" },
  { kind: "image" },
  { kind: "table" },
];

function DockIcon({
  kind,
}: {
  kind: CompositionComponent["kind"] | "select";
}) {
  return (
    <svg className="dock-glyph" viewBox="0 0 24 24" aria-hidden="true">
      {kind === "select" ? (
        <path d="M5 3.8 18 12l-6.2 1.2L8.6 19Z" />
      ) : kind === "text-block" ? (
        <path d="M5 6h14M5 10h14M5 14h10M5 18h12" />
      ) : kind === "chart" ? (
        <>
          <path d="M5 19V5M5 19h14" />
          <path d="M8 16v-4M12 16V8M16 16v-7" />
        </>
      ) : kind === "diagram" ? (
        <>
          <rect x="3" y="5" width="6" height="5" rx="1" />
          <rect x="15" y="14" width="6" height="5" rx="1" />
          <path d="M9 8h6v8M12 13l3 3 3-3" />
        </>
      ) : kind === "image" ? (
        <>
          <rect x="4" y="5" width="16" height="14" rx="1" />
          <circle cx="15.5" cy="9" r="1.5" />
          <path d="m6 17 4.5-5 3 3 2-2 2.5 4" />
        </>
      ) : kind === "table" ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="1" />
          <path d="M3 10h18M9 5v14M15 5v14" />
        </>
      ) : (
        <path d="M5 7h14M5 12h10M5 17h14" />
      )}
    </svg>
  );
}

export function WorkspaceChrome({
  title,
  titleRef,
  titleError,
  selectedKind,
  onTitle,
  onEditEnd,
  onExportPNG,
  exporting,
  onPresent,
  fileStatus,
  building,
  buildState,
  onBuild,
  onSelectTool,
  onComponentTool,
  leftCollapsed,
  onToggleLeftPanel,
}: {
  leftCollapsed: boolean;
  onToggleLeftPanel: () => void;
  title: string;
  titleRef: RefObject<HTMLInputElement | null>;
  titleError: boolean;
  selectedKind?: CompositionComponent["kind"];
  onTitle: (title: string, mergeKey?: string) => void;
  onEditEnd: () => void;
  onExportPNG: () => void;
  exporting: boolean;
  onPresent: () => void;
  fileStatus?: "loading" | "saved" | "saving" | "conflict" | "error";
  building: boolean;
  buildState?: "ready" | "working";
  onBuild?: () => void;
  onSelectTool: () => void;
  onComponentTool: (kind: CompositionComponent["kind"]) => void;
}) {
  return (
    <>
      <header className="document-island" aria-label="Document controls">
        <img src={mark} alt="Konpeki" />
        <label className="document-title">
          <span className="sr-only">Composition title</span>
          <input
            ref={titleRef}
            aria-invalid={titleError || undefined}
            aria-describedby={titleError ? "title-error" : undefined}
            name="composition-title"
            autoComplete="off"
            disabled={building}
            value={title}
            onChange={(event) => onTitle(event.target.value, "title")}
            onBlur={onEditEnd}
          />
        </label>
        {titleError && (
          <span className="document-title-error" id="title-error">
            Enter a title.
          </span>
        )}
        {fileStatus && fileStatus !== "saved" && (
          <span
            className={`file-status ${fileStatus}`}
            role="status"
            aria-live="polite"
            title={fileStatus === "conflict"
              ? "The file changed elsewhere while this browser has edits."
              : undefined}
          >
            {fileStatus === "loading" ? "Opening"
              : fileStatus === "saving" ? "Saving"
              : fileStatus === "conflict" ? "Conflict" : "Save error"}
          </span>
        )}
        <button type="button" className="panel-toggle"
          aria-label={leftCollapsed ? "Expand left panel" : "Collapse left panel"}
          onClick={onToggleLeftPanel}>
          <svg className="panel-collapse-icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d={leftCollapsed ? "M9 4v16M13 9l3 3-3 3" : "M9 4v16M16 9l-3 3 3 3"} />
          </svg>
        </button>
      </header>

      <div className="action-island" aria-label="Document actions" inert={leftCollapsed}>
        <button
          type="button"
          className="icon-only"
          aria-label="Export PNG"
          title="Export active page as PNG"
          disabled={exporting || building}
          onClick={onExportPNG}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="4" width="16" height="12" rx="2" />
            <path d="m7 14 3.5-4 3 3 2-2 2.5 3M12 16v5m-3-3 3 3 3-3" />
          </svg>
        </button>
        <button type="button" className="icon-only" aria-label="Present" title="Present" onClick={onPresent} disabled={building}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M12 16v5m-4 0h8M10 7l5 3-5 3Z" />
          </svg>
        </button>
        {onBuild && (
          <button
            type="button"
            className={`primary build-button ${building ? "building" : ""}`}
            disabled={fileStatus !== "saved" || building}
            aria-busy={building}
            onClick={onBuild}
          >
            <BuildOrb active={building} />
            <span className="build-label">{buildState === "ready" ? "Request ready" : buildState === "working" ? "Agent working" : "Build it"}</span>
          </button>
        )}
      </div>

      <nav className="component-dock" aria-label="Canvas tools" inert={building}>
        <button
          type="button"
          className={!selectedKind ? "active" : ""}
          aria-pressed={!selectedKind}
          onClick={onSelectTool}
        >
          <DockIcon kind="select" />
          <span>Select</span>
        </button>
        {dockItems.map(({ kind }) => (
          <button
            key={kind}
            type="button"
            className={selectedKind === kind ? "active" : ""}
            aria-pressed={selectedKind === kind}
            title={`Add or select ${componentLabels[kind]}`}
            onClick={() => onComponentTool(kind)}
          >
            <DockIcon kind={kind} />
            <span>{componentLabels[kind]}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
