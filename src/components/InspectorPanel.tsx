import {
  themeIds,
  typographyIds,
  type CompositionComponent,
  type CompositionSlide,
  type ChartTemplate,
  type DiagramType,
  type Rect,
  type TextColor,
  type ThemeId,
  type TypographyId,
  type VectorElement,
} from "../../composition/types.ts";
import {
  chartDefinitions,
  chartTemplates,
  diagramCategories,
  diagramDefinitions,
} from "../../composition/visualizations.ts";
import { useEffect, useRef, type CSSProperties } from "react";
import {
  appearanceOptions,
  tableAppearanceForStyle,
  tableStyleForAppearance,
  tableStyles,
  type TableStyle,
} from "../../composition/schema.ts";
import {
  clamp,
  componentLabels,
  defaultAppearance,
  type Draft,
} from "../lib/model.ts";
import { composerPalette, themeLabel } from "../lib/theme.ts";
import { getTheme, typographyLabels } from "../../design/themes/index.ts";
import { DiagramTypeIcon } from "./DiagramTypeIcon.tsx";
import { Field, Select, humanize } from "./ui.tsx";
import { moveVectorElement, removeVectorElement } from "../../composition/vector.ts";
import { tokensForAttribute } from "../../composition/theme-tokens.ts";
import { VectorOverflowWarning } from "./VectorOverflowWarning.tsx";
import { PageSizePicker } from "./PageSizePicker.tsx";

const appearanceLabels: Record<string, string> = {
  rule: "Divider",
  style: "Number format",
};
const optionLabels: Record<string, string> = {
  "01": "Current page — 01",
  "01/02": "Current / total — 01/02",
  single: "Single",
  "two-column": "2 equal columns",
  "three-column": "3 equal columns",
  "two-plus-two": "2 + 2 grid",
  "four-column": "4 columns",
  "one-plus-three": "1 + 3 blocks",
  "three-plus-one": "3 + 1 blocks",
  "header-rule": "Rule under header",
  "top-header-bottom": "Top + header + bottom",
  "row-rules": "Horizontal rules",
  "full-grid": "Full grid",
};

function VectorActionIcon({ action }: { action: "backward" | "forward" | "delete" }) {
  return (
    <svg className="vector-action-icon" viewBox="0 0 20 20" aria-hidden="true">
      {action === "delete" ? (
        <>
          <path d="M4 5h12M8 2.75h4M6 5l.65 11h6.7L14 5" />
          <path d="M8.25 8v5M11.75 8v5" />
        </>
      ) : (
        <>
          <rect x="3" y="7" width="8" height="8" rx="1.5" />
          <path d="M7 4h6a2 2 0 0 1 2 2v6" />
          {action === "backward" ? (
            <path d="m12.5 10 2.5 2.5 2.5-2.5" />
          ) : (
            <path d="m12.5 6.5 2.5-2.5 2.5 2.5" />
          )}
        </>
      )}
    </svg>
  );
}

function previewCount(key: string, value: string) {
  if (key === "tableStyle") return 6;
  if (key !== "layout") return 4;
  if (value === "single") return 1;
  if (value === "two-column") return 2;
  if (value === "three-column") return 3;
  return 4;
}

function AppearancePicker({
  label,
  name,
  value,
  options,
  labels,
  description,
  disabledOptions,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: readonly string[];
  labels?: Partial<Record<string, string>>;
  description?: string;
  disabledOptions?: ReadonlySet<string>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field appearance-field">
      <span>{label}</span>
      <div className="appearance-options" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={value === option ? "selected" : ""}
            aria-pressed={value === option}
            disabled={disabledOptions?.has(option)}
            title={disabledOptions?.has(option) ? "Remove the recorded Sankey topology before changing chart type." : undefined}
            onClick={() => onChange(option)}
          >
            <span
              className="appearance-preview"
              data-property={name}
              data-value={option}
              aria-hidden="true"
            >
              {Array.from({ length: previewCount(name, option) }, (_, index) => (
                <i key={index} />
              ))}
            </span>
            <span>{labels?.[option] ?? optionLabels[option] ?? humanize(option)}</span>
          </button>
        ))}
      </div>
      {description && <small className="visualization-description">{description}</small>}
    </div>
  );
}

function PalettePicker({
  value,
  mode,
  onChange,
}: {
  value: ThemeId;
  mode: "paper" | "night";
  onChange: (value: ThemeId) => void;
}) {
  return (
    <fieldset className="theme-picker">
      <legend>Color palette</legend>
      <div className="theme-options">
        {themeIds.map((id) => {
          const palette = composerPalette(id, mode);
          return (
            <button
              key={id}
              type="button"
              className={value === id ? "selected" : ""}
              data-theme={id}
              aria-pressed={value === id}
              onClick={() => onChange(id)}
            >
              <span>{themeLabel(id)}</span>
              <span className="theme-swatches" aria-hidden="true">
                {[palette.accent, palette.categorical[1], palette.categorical[2]].map(
                  (color) => (
                    <i key={color} style={{ background: color }} />
                  ),
                )}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SegmentedControl({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="choice-picker">
      <legend>{label}</legend>
      <div className="segmented-options" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((option) => (
          <button key={option} type="button" aria-pressed={value === option}
            className={value === option ? "selected" : ""}
            onClick={() => onChange(option)}>
            <span>{humanize(option)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function DiagramTypePicker({
  value,
  selection,
  onChange,
}: {
  value: DiagramType;
  selection: "auto" | "explicit";
  onChange: (value: DiagramType, selection: "auto" | "explicit") => void;
}) {
  return (
    <details className="field diagram-type-field">
      <summary id="diagram-type-label">Template</summary>
      <div className="diagram-type-options" aria-labelledby="diagram-type-label">
        <div className="diagram-type-category">
          <div>
            <button
              type="button"
              className={selection === "auto" ? "selected" : ""}
              aria-pressed={selection === "auto"}
              onClick={() => onChange(value, "auto")}
            >
              <svg className="diagram-type-icon" viewBox="0 0 48 32" aria-hidden="true">
                <rect x="13" y="5" width="22" height="22" rx="4" />
                <circle className="filled" cx="19" cy="11" r="1.5" />
                <circle className="filled" cx="29" cy="11" r="1.5" />
                <circle className="filled" cx="24" cy="16" r="1.5" />
                <circle className="filled" cx="19" cy="21" r="1.5" />
                <circle className="filled" cx="29" cy="21" r="1.5" />
              </svg>
              <span>YOLO</span>
            </button>
          </div>
        </div>
        {diagramCategories.map((category) => (
          <div className="diagram-type-category" role="group" aria-label={category} key={category}>
            <span>{category}</span>
            <div>
            {Object.entries(diagramDefinitions)
              .filter(([, definition]) => definition.category === category)
              .map(([type, definition]) => (
                <button
                  type="button"
                  className={selection === "explicit" && value === type ? "selected" : ""}
                  aria-pressed={selection === "explicit" && value === type}
                  key={type}
                  onClick={() => onChange(type as DiagramType, "explicit")}
                >
                  <DiagramTypeIcon type={type as DiagramType} />
                  <span>{definition.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function ChartTypePicker({ value, selection, hasTopology, onChange }: {
  value: ChartTemplate;
  selection: "auto" | "explicit";
  hasTopology: boolean;
  onChange: (value: ChartTemplate, selection: "auto" | "explicit") => void;
}) {
  return (
    <details className="field chart-type-field diagram-type-field">
      <summary>{selection === "auto" ? "YOLO" : `Required form: ${chartDefinitions[value].label}`}</summary>
      <button type="button" aria-pressed={selection === "auto"} onClick={() => onChange(value, "auto")}>YOLO</button>
      <AppearancePicker
        label="Chart form"
        name="template"
        value={selection === "explicit" ? value : ""}
        options={chartTemplates}
        labels={Object.fromEntries(Object.entries(chartDefinitions).map(([type, definition]) => [type, definition.label]))}
        description={`${chartDefinitions[value].expression}${hasTopology ? " Recorded Sankey topology is preserved; remove it before changing chart type, even in YOLO." : ""}`}
        disabledOptions={hasTopology ? new Set(chartTemplates.filter(type => type !== "sankey")) : undefined}
        onChange={(value) => {
          const template = chartTemplates.find(type => type === value);
          if (template) onChange(template, "explicit");
        }}
      />
    </details>
  );
}

export function InspectorPanel({
  component,
  componentLabel,
  slide,
  draft,
  selectedVectorElementId,
  vectorEditRequest,
  onSelectSlide,
  onSelectVectorElement,
  onComponent,
  onSlide,
  onDraft,
  onEditEnd,
}: {
  component?: CompositionComponent;
  componentLabel?: string;
  slide: CompositionSlide;
  draft: Draft;
  selectedVectorElementId?: string;
  vectorEditRequest?: number;
  onSelectSlide: () => void;
  onSelectVectorElement: (id?: string) => void;
  onComponent: (component: CompositionComponent, mergeKey?: string) => void;
  onSlide: (slide: CompositionSlide, mergeKey?: string) => void;
  onDraft: (patch: Partial<Draft>, mergeKey?: string) => void;
  onEditEnd: () => void;
}) {
  const vectorEditor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!vectorEditRequest) return;
    const editor = vectorEditor.current;
    const control = editor?.querySelector<HTMLTextAreaElement | HTMLInputElement>("textarea, input");
    const target = control ?? editor;
    target?.focus();
    target?.scrollIntoView({ block: "nearest" });
    control?.select();
  }, [vectorEditRequest]);
  const theme = draft.theme ?? { id: "plex", mode: "paper" };
  const typography = getTheme(themeLabel(theme.id), theme.mode, theme.typography);
  if (!component)
    return (
      <section className="inspector-content" aria-labelledby="inspector-heading">
        <h2 id="inspector-heading">Page</h2>
        <PageSizePicker key={slide.id} slide={slide} onChange={onSlide} />
        <h2>Document appearance</h2>
        <Select
          label="Font"
          value={typography.typographyId}
          options={typographyIds}
          optionLabels={typographyLabels}
          onChange={(value) => onDraft({ theme: { ...theme, typography: value as TypographyId } })}
        />
        <PalettePicker
          value={theme.id}
          mode={theme.mode}
          onChange={(value) =>
            onDraft({
              theme: {
                ...theme,
                id: value,
                typography: typography.typographyId,
              },
            })
          }
        />
        <SegmentedControl
          label="Background"
          value={theme.mode}
          options={["paper", "night"]}
          onChange={(value) =>
            onDraft({
              theme: {
                ...theme,
                mode: value as "paper" | "night",
              },
            })
          }
        />
        <VectorOverflowWarning slide={slide} theme={draft.theme} />
        <h2 className="slide-settings-heading">Page numbering</h2>
        <fieldset className="page-number-picker">
          <SegmentedControl
            label="Format"
            value={slide.pageNumber?.style ?? "none"}
            options={["none", "01", "01/02"]}
            onChange={(value) =>
              onSlide({
                ...slide,
                pageNumber: {
                  style: value as "none" | "01" | "01/02",
                  color: slide.pageNumber?.color ?? "muted",
                },
              })
            }
          />
          {(slide.pageNumber?.style ?? "none") !== "none" && (
            <SegmentedControl
              label="Color"
              value={slide.pageNumber?.color ?? "muted"}
              options={["ink", "muted", "accent"]}
              onChange={(value) =>
                onSlide({
                  ...slide,
                  pageNumber: {
                    style: slide.pageNumber?.style ?? "01",
                    color: value as TextColor,
                  },
                })
              }
            />
          )}
        </fieldset>
      </section>
    );
  const rect = component.preferredRect;
  const appearance = component.appearance as Record<string, string> | undefined;
  const defaults = defaultAppearance(component.kind);
  const previewPalette = composerPalette(draft.theme?.id ?? "plex", draft.theme?.mode ?? "paper");
  const vectorVisual = component.customVisual?.format === "vector"
    ? component.customVisual
    : undefined;
  const vectorElement = vectorVisual?.elements.find(
    (element) => element.id === selectedVectorElementId,
  );
  function updateVectorElement(
    element: VectorElement,
    mergeKey = `vector:${component!.id}:${element.id}`,
  ) {
    if (!vectorVisual) return;
    onComponent({
      ...component!,
      customVisual: {
        ...vectorVisual,
        elements: vectorVisual.elements.map((item) =>
          item.id === element.id ? element : item,
        ),
      },
    }, mergeKey);
  }
  function geometry(key: keyof Rect, value: number) {
    if (!Number.isFinite(value)) return;
    const next = { ...rect };
    if (key === "x") next.x = clamp(value, 0, slide.canvas.width - rect.width);
    if (key === "y") next.y = clamp(value, 0, slide.canvas.height - rect.height);
    if (key === "width")
      next.width = clamp(value, Math.min(180, slide.canvas.width - rect.x), slide.canvas.width - rect.x);
    if (key === "height")
      next.height = clamp(value, Math.min(72, slide.canvas.height - rect.y), slide.canvas.height - rect.y);
    onComponent(
      { ...component!, preferredRect: next },
      `geometry:${component!.id}`,
    );
  }
  return (
    <section className={`inspector-content${component.kind === "text-block" && !component.customVisual ? " native-text-inspector" : ""}`} aria-labelledby="inspector-heading"
      style={{
        "--preview-ink": previewPalette.fg,
        "--preview-muted": previewPalette.line,
        "--preview-accent": previewPalette.accent,
        "--preview-secondary": previewPalette.categorical[1],
        "--preview-tertiary": previewPalette.categorical[2],
        "--preview-complete": previewPalette.status.complete,
        "--preview-attention": previewPalette.status.attention,
        "--preview-blocked": previewPalette.status.blocked,
      } as CSSProperties}
    >
      <h2 id="inspector-heading" className="inspector-context">
        <button type="button" onClick={onSelectSlide}>Page</button>
        <span aria-hidden="true">/</span>
        <span>{componentLabel ?? componentLabels[component.kind]}</span>
      </h2>
      {component.kind === "text-block" && !component.customVisual && <>
        <VectorOverflowWarning slide={slide} theme={draft.theme} />
        <Field label="Text"><textarea name="text-content" value={component.content ?? ""}
          onChange={(event) => onComponent({ ...component, content: event.target.value }, `content:${component.id}`)} onBlur={onEditEnd} /></Field>
        <div className="text-typography-fields">
        <Field label="Font size"><input type="number" min={8} max={240} value={component.textStyle?.size ?? 36}
          onChange={(event) => { const size = event.target.valueAsNumber; if (size >= 8 && size <= 240) onComponent({ ...component, textStyle: { ...component.textStyle, size } }, `font:${component.id}`); }} onBlur={onEditEnd} /></Field>
        <Select label="Text color" value={component.textStyle?.color ?? "ink"} options={["ink", "muted", "accent"]}
          onChange={(color) => onComponent({ ...component, textStyle: { ...component.textStyle, color: color as "ink" | "muted" | "accent" } })} />
        <Select label="Font weight" value={String(component.textStyle?.weight ?? 400)} options={["400", "500", "600"]}
          onChange={(weight) => onComponent({ ...component, textStyle: { ...component.textStyle, weight: Number(weight) as 400 | 500 | 600 } })} />
        <Field label="Line height"><input type="number" min={1} max={3} step={0.1} value={component.textStyle?.lineHeight ?? 1.4}
          onChange={(event) => { const lineHeight = event.target.valueAsNumber; if (lineHeight >= 1 && lineHeight <= 3) onComponent({ ...component, textStyle: { ...component.textStyle, lineHeight } }, `leading:${component.id}`); }} onBlur={onEditEnd} /></Field>
        </div>
      </>}
      <Field label={component.kind === "diagram" || component.kind === "chart" ? "What should this explain?" : "Content intent"}>
        <textarea
          name="content-intent"
          autoComplete="off"
          rows={4}
          placeholder={component.kind === "diagram" || component.kind === "chart" ? "Describe the relationship or takeaway and supply the facts or data to preserve." : undefined}
          value={component.intent ?? ""}
          onChange={(e) =>
            onComponent(
              { ...component, intent: e.target.value },
              `intent:${component.id}`,
            )
          }
          onBlur={onEditEnd}
        />
      </Field>
      {component.kind === "diagram" && <DiagramTypePicker
        value={component.appearance.type}
        selection={component.appearance.selection ?? "explicit"}
        onChange={(type, selection) => onComponent({ ...component, appearance: { ...component.appearance, type, selection } })}
      />}
      {component.kind === "chart" && <ChartTypePicker
        value={component.appearance.template}
        selection={component.appearance.selection ?? "explicit"}
        hasTopology={Boolean(component.topology)}
        onChange={(template, selection) => {
          if (template === "sankey") {
            onComponent({ ...component, appearance: { ...component.appearance, template, selection } });
          } else if (!component.topology) {
            onComponent({ ...component, topology: undefined, appearance: { ...component.appearance, template, selection } });
          }
        }}
      />}
      <fieldset>
        <legend>Position & size</legend>
        <div className="geometry">
          {(["x", "y", "width", "height"] as const).map((key) => (
            <Field key={key} label={humanize(key)}>
              <span className="parameter-input">
                <input
                  name={key}
                  autoComplete="off"
                  type="number"
                  step="1"
                  value={Math.round(rect[key])}
                  onChange={(e) => {
                    if (e.target.value !== "")
                      geometry(key, e.target.valueAsNumber);
                  }}
                  onBlur={onEditEnd}
                />
                <span className="parameter-unit" aria-hidden="true">px</span>
              </span>
            </Field>
          ))}
        </div>
      </fieldset>
      {component.customVisual && (
        <fieldset className="custom-visual-summary">
          <legend>Agent visual</legend>
          <dl>
            <div>
              <dt>Source</dt>
              <dd>
                {component.customVisual.format === "vector"
                  ? `${component.customVisual.elements.length} editable vector elements`
                  : "Legacy self-contained SVG"}
              </dd>
            </div>
            <div>
              <dt>Local viewport</dt>
              <dd>
                {component.customVisual.viewBox.width} × {component.customVisual.viewBox.height}
              </dd>
            </div>
            <div>
              <dt>Fit</dt>
              <dd>{component.customVisual.fit ?? "contain"}</dd>
            </div>
          </dl>
          {component.customVisual.format !== "vector" && (
            <p className="field-help">
              This SVG is opaque to the editor. Ask an agent to convert it to editable vector elements.
            </p>
          )}
          {vectorVisual && (
            <>
              <Field label="Vector element">
                <select
                  value={selectedVectorElementId ?? ""}
                  onChange={(event) =>
                    onSelectVectorElement(event.target.value || undefined)
                  }
                >
                  <option value="">Select an element</option>
                  {vectorVisual.elements.map((element) => (
                    <option key={element.id} value={element.id}>
                      {element.kind} · {element.id}
                    </option>
                  ))}
                </select>
              </Field>
              {vectorElement && (
                <div className="vector-element-editor" ref={vectorEditor} tabIndex={-1}>
                  <strong>{humanize(vectorElement.kind)} · {vectorElement.id}</strong>
                  <div className="vector-actions">
                    {([-1, 1] as const).map((direction) => (
                      <button
                        key={direction}
                        type="button"
                        aria-label={direction === -1 ? "Send backward" : "Bring forward"}
                        title={direction === -1 ? "Send backward" : "Bring forward"}
                        disabled={moveVectorElement(vectorVisual.elements, vectorElement.id, direction) === vectorVisual.elements}
                        onClick={() => onComponent({
                          ...component,
                          customVisual: {
                            ...vectorVisual,
                            elements: moveVectorElement(vectorVisual.elements, vectorElement.id, direction),
                          },
                        })}
                      >
                        <VectorActionIcon action={direction === -1 ? "backward" : "forward"} />
                        {direction === -1 ? "Back" : "Forward"}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="vector-delete-action"
                      aria-label="Delete element"
                      title="Delete element"
                      onClick={() => {
                        onComponent({
                          ...component,
                          customVisual: {
                            ...vectorVisual,
                            elements: removeVectorElement(vectorVisual.elements, vectorElement.id),
                          },
                        });
                        onSelectVectorElement(undefined);
                      }}
                    >
                      <VectorActionIcon action="delete" />
                      Delete
                    </button>
                  </div>
                  {(vectorElement.kind === "text" || vectorElement.kind === "tspan") && (
                    <Field label="Text">
                      <textarea
                        rows={3}
                        value={vectorElement.text ?? ""}
                        onChange={(event) =>
                          updateVectorElement({
                            ...vectorElement,
                            text: event.target.value,
                          })
                        }
                        onBlur={onEditEnd}
                      />
                    </Field>
                  )}
                  <div className="vector-attributes">
                    {Object.entries(vectorElement.attributes).map(([name, value]) => (
                      <Field key={name} label={humanize(name)}>
                        <input
                          name={`vector-${name}`}
                          list={`theme-options-${name}`}
                          autoComplete="off"
                          value={value}
                          onChange={(event) =>
                            updateVectorElement({
                              ...vectorElement,
                              attributes: {
                                ...vectorElement.attributes,
                                [name]: event.target.value,
                              },
                            })
                          }
                          onBlur={onEditEnd}
                        />
                        <datalist id={`theme-options-${name}`}>
                          {tokensForAttribute(name).map((token) => <option key={token} value={`theme:${token}`} />)}
                        </datalist>
                      </Field>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </fieldset>
      )}
      {!component.customVisual && <fieldset
        className="appearance-fieldset"
      >
        <legend>Appearance</legend>
        {component.kind === "table" && (
          <AppearancePicker
            label="Table style"
            name="tableStyle"
            value={tableStyleForAppearance(component.appearance)}
            options={tableStyles}
            onChange={(value) =>
              onComponent({
                ...component,
                appearance: {
                  ...component.appearance,
                  ...tableAppearanceForStyle(value as TableStyle),
                },
              })
            }
          />
        )}
        {Object.entries(appearanceOptions[component.kind])
          .filter(([key]) => !["selection", "type", "template"].includes(key))
          .filter(([key]) => component.kind !== "text-block" || ["alignment", "border", "rule"].includes(key))
          .filter(([key]) => !["diagram", "chart"].includes(component.kind) || !["density", "emphasis", "colorScheme"].includes(key))
          .filter(
            ([key]) =>
              component.kind !== "table" ||
              !["header", "grid", "border", "colorScheme"].includes(key),
          )
          .filter(([key]) => {
            if (key !== "orientation") return true;
            if (component.kind === "chart")
              return appearance?.template === "grouped-bar";
            return true;
          })
          .map(([key, options]) => {
            return (
              <AppearancePicker
                key={key}
                name={key}
                label={appearanceLabels[key] ?? humanize(key)}
                value={appearance?.[key] ?? defaults[key] ?? options[0]}
                options={options}
                onChange={(value) => {
                  const nextAppearance = {
                    ...component.appearance,
                    [key]: value,
                  } as Record<string, string>;
                  const nextComponent = {
                    ...component,
                    appearance: nextAppearance,
                  } as CompositionComponent;
                  onComponent(nextComponent);
                }}
              />
            );
          })}
      </fieldset>}
    </section>
  );
}
