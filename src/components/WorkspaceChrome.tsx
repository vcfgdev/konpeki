import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { CompositionComponent } from "../../composition/types.ts";
import { componentLabels } from "../lib/model.ts";
import type { ExportFormat } from "../lib/export-scene.ts";
import mark from "../assets/konpeki-mark.png";

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
  onExport,
  exporting,
  onPresent,
  fileStatus,
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
  onExport: (format: ExportFormat) => void;
  exporting: boolean;
  onPresent: () => void;
  fileStatus?: "loading" | "saved" | "saving" | "conflict" | "error";
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
  const exportMenu = useRef<HTMLDetailsElement>(null);
  const [browserMenuOpen, setBrowserMenuOpen] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  function closeBrowserMenu(restoreFocus = true) {
    const menu = browserMenu.current;
    if (!menu?.open) return;
    setBrowserMenuOpen(false);
    if (restoreFocus) menu.querySelector("summary")?.focus();
  }
  useEffect(() => {
    if (leftCollapsed) {
      closeBrowserMenu(false);
      if (exportMenu.current) exportMenu.current.open = false;
    }
  }, [leftCollapsed]);
  useEffect(() => {
    function dismissOutside(event: Event) {
      if (event.target instanceof Node && !browserMenu.current?.contains(event.target)) {
        closeBrowserMenu(false);
      }
      if (event.target instanceof Node && exportMenu.current && !exportMenu.current.contains(event.target)) {
        exportMenu.current.open = false;
      }
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, []);
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

      <div className="editor-content">
        {children}
      </div>

      <div className="action-island" aria-label="Document actions" inert={leftCollapsed}>
        <details className="browser-menu export-menu" ref={exportMenu} onKeyDown={event => {
          if (event.key === "Escape") {
            event.preventDefault(); event.stopPropagation();
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }
        }}>
          <summary className="icon-only" aria-label="Export" title="Export" aria-disabled={exporting}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="16" height="12" rx="2" />
              <path d="m7 14 3.5-4 3 3 2-2 2.5 3M12 16v5m-3-3 3 3 3-3" />
            </svg>
          </summary>
          <div className="browser-menu-popover" aria-label="Export formats">
            {(["png", "svg", "pdf"] as const).map(format => (
              <button key={format} type="button" disabled={exporting} onClick={() => {
                if (exportMenu.current) exportMenu.current.open = false;
                onExport(format);
              }}>
                Export {format.toUpperCase()}
              </button>
            ))}
          </div>
        </details>
        <button type="button" className="icon-only" aria-label="Present" title="Present" onClick={onPresent}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M12 16v5m-4 0h8M10 7l5 3-5 3Z" />
          </svg>
        </button>
        {browserTools && (
          <details className="browser-menu" ref={browserMenu} open={browserMenuOpen} onKeyDown={(event) => {
            if (event.key === "Escape" && browserMenu.current?.open) {
              event.preventDefault();
              event.stopPropagation();
              closeBrowserMenu();
            }
          }}>
            <summary onClick={(event) => {
              event.preventDefault();
              setBrowserMenuOpen(open => !open);
            }}>
              Demo Mode
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 10 4-4 4 4" /></svg>
            </summary>
            <div className="browser-menu-popover" role="region" aria-label="Demo Mode" inert={!browserMenuOpen}>
              <div className="browser-menu-intro">
                <strong>Demo Mode</strong>
                <p>
                  Explore the canvas here. No agent connection or file sync.{" "}
                  <span role="status">{browserTools.saveMessage}</span>
                </p>
              </div>
              <div className="browser-menu-actions">
                <button type="button" onClick={() => importInput.current?.click()}>
                  Import
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
                  Export
                </button>
                <button type="button" className="secondary" onClick={() => {
                  closeBrowserMenu();
                  browserTools.onStartBlank();
                }}>
                  Start blank
                </button>
                <button type="button" className="secondary" onClick={() => {
                  closeBrowserMenu();
                  browserTools.onReset();
                }}>
                  {browserTools.example ? "Reset example" : "Reset local draft"}
                </button>
              </div>
              <div className="browser-agent-handoff">
                <strong>Continue with an agent</strong>
                <p>Export the JSON file, then ask your coding agent to open it with Konpeki.</p>
                <a
                  href="https://github.com/vcfgdev/konpeki/blob/main/SETUP.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  Setup guide
                </a>
              </div>
            </div>
          </details>
        )}
      </div>
      </div>

      <nav className="component-dock" aria-label="Canvas tools">
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
