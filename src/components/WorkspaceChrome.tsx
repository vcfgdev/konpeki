import { useEffect, useRef, type ReactNode, type RefObject } from "react";
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
          <rect x="15" y="16" width="6" height="5" rx="1" />
          <path d="M9 8h9v8m-2.5-2.5L18 16l2.5-2.5" />
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
  browserTools,
  onSelectTool,
  onComponentTool,
  leftCollapsed,
  onToggleLeftPanel,
  children,
}: {
  children: ReactNode;
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
  browserTools?: {
    example: boolean;
    saveMessage: string;
    onImportJSON: (file: File) => void;
    onDownloadJSON: () => void;
    onStartBlank: () => void;
    onReset: () => void;
  };
  onSelectTool: () => void;
  onComponentTool: (kind: CompositionComponent["kind"]) => void;
}) {
  const browserMenu = useRef<HTMLDetailsElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  function closeBrowserMenu() {
    if (browserMenu.current) browserMenu.current.open = false;
  }
  useEffect(() => {
    if (leftCollapsed) closeBrowserMenu();
  }, [leftCollapsed]);
  return (
    <>
      <div className={`left-sidebar${leftCollapsed ? " collapsed" : ""}`}>
      <header className="document-island" aria-label="Document controls">
        <img src={mark} alt="Konpeki" />
        <label className="document-title" inert={leftCollapsed}>
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
        {fileStatus && (
          <span
            className={`file-status ${fileStatus}`}
            role="status"
            aria-live="polite"
            title={fileStatus === "saved" ? "Saved to file" : fileStatus === "saving" ? "Saving to file" : fileStatus === "loading" ? "Opening file" : "Changes are not saved — see the recovery notice"}
          >
            <span className="sr-only">{fileStatus === "saved" ? "Saved" : fileStatus === "loading" ? "Opening"
              : fileStatus === "saving" ? "Saving"
              : fileStatus === "conflict" ? "Conflict" : "Save error"}</span>
          </span>
        )}
        <button type="button" className="panel-toggle"
          aria-label={leftCollapsed ? "Expand left panel" : "Collapse left panel"}
          aria-expanded={!leftCollapsed}
          onClick={onToggleLeftPanel}>
          <svg className="panel-collapse-icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d={leftCollapsed ? "M9 4v16M13 9l3 3-3 3" : "M9 4v16M16 9l-3 3 3 3"} />
          </svg>
        </button>
      </header>

      <div className="editor-content" inert={building} aria-busy={building}>
        {children}
      </div>

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
        {browserTools && (
          <details className="browser-menu" ref={browserMenu}>
            <summary>Browser</summary>
            <div className="browser-menu-popover">
              <strong>Browser playground</strong>
              <p role="status">
                {browserTools.saveMessage}
                {" "}Nothing syncs automatically.
              </p>
              <div className="browser-menu-actions">
                <button type="button" onClick={() => importInput.current?.click()}>
                  Import JSON
                </button>
                <input
                  ref={importInput}
                  hidden
                  type="file"
                  accept="application/json,.json"
                  aria-label="Choose composition JSON"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    closeBrowserMenu();
                    browserTools.onImportJSON(file);
                  }}
                />
                <button type="button" onClick={() => {
                  closeBrowserMenu();
                  browserTools.onDownloadJSON();
                }}>
                  Download JSON
                </button>
                <button type="button" onClick={() => {
                  closeBrowserMenu();
                  browserTools.onStartBlank();
                }}>
                  Start blank
                </button>
                <button type="button" onClick={() => {
                  closeBrowserMenu();
                  browserTools.onReset();
                }}>
                  {browserTools.example ? "Reset example" : "Reset local draft"}
                </button>
              </div>
              <p className="browser-agent-handoff">
                To continue with a coding agent, download the editable JSON and
                follow the{" "}
                <a
                  href="https://github.com/vcfgdev/konpeki/blob/main/SETUP.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  setup guidance
                </a>
                .
              </p>
            </div>
          </details>
        )}
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
