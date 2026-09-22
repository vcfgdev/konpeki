import {
  createElement,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import {
  componentKinds,
  type CompositionComponent,
  type Rect,
  type VectorElement,
} from "../../composition/types.ts";
import { tableStyleForAppearance } from "../../composition/schema.ts";
import { diagramDefinition } from "../../composition/visualizations.ts";
import {
  componentInstanceLabel,
  defaultAppearance,
  getSlide,
  snapRect,
  snapResizeRect,
  type Draft,
  type Guide,
} from "../lib/model.ts";
import { composerPalette, themeLabel } from "../lib/theme.ts";
import { getTheme } from "../../design/themes/index.ts";
import { resolveVectorAttribute } from "../../composition/theme-tokens.ts";
import { DiagramTypeIcon } from "./DiagramTypeIcon.tsx";
import type { RevisionNote } from "../lib/review.ts";

type ResizeCorner = "nw" | "ne" | "sw" | "se";

function resizeFromCorner(rect: Rect, dx: number, dy: number, corner: ResizeCorner) {
  const left = corner.endsWith("w");
  const top = corner.startsWith("n");
  return {
    x: left ? rect.x + dx : rect.x,
    y: top ? rect.y + dy : rect.y,
    width: rect.width + (left ? -dx : dx),
    height: rect.height + (top ? -dy : dy),
  };
}

function fallbackTopologyRects(
  width: number,
  height: number,
  count: number,
  layout: string,
) {
  const nodeWidth = Math.min(220, width / Math.max(2, count + 0.5));
  const nodeHeight = Math.min(100, height * 0.28);
  const centered = (cx: number, cy: number) => ({
    x: Math.max(0, Math.min(width - nodeWidth, cx - nodeWidth / 2)),
    y: Math.max(0, Math.min(height - nodeHeight, cy - nodeHeight / 2)),
    width: nodeWidth,
    height: nodeHeight,
  });
  if (layout === "cyclical" || layout === "hub-and-spoke") {
    const hub = layout === "hub-and-spoke";
    return Array.from({ length: count }, (_, index) => {
      if (hub && index === 0) return centered(width / 2, height / 2);
      const radialCount = hub ? count - 1 : count;
      const radialIndex = hub ? index - 1 : index;
      const angle = -Math.PI / 2 + radialIndex * Math.PI * 2 / Math.max(1, radialCount);
      return centered(
        width / 2 + Math.cos(angle) * Math.max(0, width / 2 - nodeWidth * 0.75),
        height / 2 + Math.sin(angle) * Math.max(0, height / 2 - nodeHeight * 0.75),
      );
    });
  }
  if (layout === "branching")
    return Array.from({ length: count }, (_, index) =>
      index === 0
        ? centered(nodeWidth * 0.7, height / 2)
        : centered(
            width - nodeWidth * 0.7,
            (index - 0.5) * height / Math.max(1, count - 1),
          ),
    );
  if (layout === "layered")
    return Array.from({ length: count }, (_, index) =>
      centered(
        (index + 1) * width / (count + 1),
        (index + 1) * height / (count + 1),
      ),
    );
  if (layout === "request-flow")
    return Array.from({ length: count }, (_, index) =>
      centered(
        index % 2 ? width * 0.72 : width * 0.28,
        (Math.floor(index / 2) + 1) * height / (Math.ceil(count / 2) + 1),
      ),
    );
  return Array.from({ length: count }, (_, index) =>
    centered((index + 1) * width / (count + 1), height / 2),
  );
}

function Illustration({ component }: { component: CompositionComponent }) {
  const appearance = {
    ...defaultAppearance(component.kind),
    ...(component.appearance as Record<string, string> | undefined),
  };
  const template = component.kind === "diagram"
    ? diagramDefinition(component.appearance.type).layout
    : appearance?.template;
  if (component.kind === "chart" && !component.topology) {
    const count = appearance?.density === "standard" ? 4 : 3;
    const legend = appearance?.legend ?? "none";
    return (
      <div className={`chart-preview legend-${legend}`}>
        <svg className="illustration" viewBox="0 0 600 240" aria-hidden="true">
          {template === "line" ? (
            <>
              <path d="M30 195H570M30 20V195" className="chart-axis" />
              <path
                d={
                  count === 4
                    ? "M30 165L140 110L260 137L390 58L560 35"
                    : "M30 165L260 137L560 35"
                }
                className="chart-line"
              />
            </>
          ) : template === "pie" ? (
            <>
              <circle cx="300" cy="120" r="92" className="chart-context" />
              <path
                d="M300 120V28A92 92 0 0 1 386 153Z"
                className="chart-accent"
              />
              <path
                d="M300 120 386 153A92 92 0 0 1 252 199Z"
                className="chart-tertiary"
              />
            </>
          ) : template === "radar" ? (
            <>
              <path d="M300 25 410 88 368 205 232 205 190 88Z" className="chart-axis" />
              <path d="M300 58 378 101 348 174 255 188 219 99Z" className="chart-context" />
              <path d="M300 42 390 112 342 188 246 168 210 94Z" className="chart-line" />
              <path d="M300 25V215M180 88 420 174M420 88 180 174" className="chart-axis" />
            </>
          ) : template === "treemap" ? (
            <>
              <rect x="30" y="25" width="330" height="190" className="chart-accent" />
              <rect x="370" y="25" width="200" height="110" className="chart-context" />
              <rect x="370" y="145" width="125" height="70" className="chart-tertiary" />
              <rect x="505" y="145" width="65" height="70" className="chart-context" />
            </>
          ) : template === "scatter" ? (
            <>
              <path d="M30 215H570M30 20V215" className="chart-axis" />
              {[[95, 175], [142, 158], [205, 147], [248, 122], [315, 133], [370, 92], [428, 74], [515, 48]].map(([cx, cy], index) => (
                <circle key={index} cx={cx} cy={cy} r={index === 7 ? 11 : 7} className={index === 7 ? "chart-accent" : "chart-context"} />
              ))}
            </>
          ) : template === "sankey" ? (
            <>
              <path d="M70 72C210 72 230 105 350 105S450 58 530 58" className="chart-line" style={{ strokeWidth: 28, opacity: 0.72 }} />
              <path d="M70 150C210 150 235 116 350 116S450 170 530 170" className="chart-axis" style={{ strokeWidth: 19, opacity: 0.7 }} />
              <path d="M70 92C205 92 240 162 350 162S450 112 530 112" className="chart-line" style={{ strokeWidth: 10, opacity: 0.42 }} />
              <rect x="55" y="50" width="20" height="125" className="chart-context" />
              <rect x="340" y="85" width="20" height="98" className="chart-tertiary" />
              <rect x="525" y="38" width="20" height="154" className="chart-accent" />
            </>
          ) : template === "annotated-detail" ? (
            <>
              <rect
                x="60"
                y="20"
                width="480"
                height="195"
                className="chart-context"
              />
              <path
                d="M90 195L220 70L325 155L410 100L510 195"
                fill="none"
                className="chart-line"
              />
              <circle cx="430" cy="60" r="15" className="chart-accent" />
              <path d="M340 95L565 30" className="chart-axis" />
            </>
          ) : appearance?.orientation === "horizontal" ? (
            <>
              {[155, 330, 245, 285].slice(0, count).map((width, i) => (
                <g key={i}>
                  <rect
                    x="25"
                    y={14 + i * (200 / count)}
                    width={width}
                    height="18"
                    className="chart-accent"
                  />
                  <rect
                    x="25"
                    y={36 + i * (200 / count)}
                    width={width * 0.72}
                    height="13"
                    className="chart-context"
                  />
                </g>
              ))}
            </>
          ) : (
            <>
              <path d="M25 215H575" className="chart-axis" />
              {[92, 175, 130, 155].slice(0, count).map((height, i) => {
                const step = 510 / count;
                return (
                  <g key={i}>
                    <rect
                      x={48 + i * step}
                      y={215 - height}
                      width="42"
                      height={height}
                      className="chart-accent"
                    />
                    <rect
                      x={94 + i * step}
                      y={215 - height * 0.7}
                      width="34"
                      height={height * 0.7}
                      className="chart-context"
                    />
                  </g>
                );
              })}
            </>
          )}
        </svg>
        {legend !== "none" && (
          <span className="chart-legend" aria-hidden="true">
            <span><i className="legend-accent" />A</span>
            <span><i className="legend-context" />B</span>
          </span>
        )}
      </div>
    );
  }
  if (component.kind === "diagram" || component.kind === "chart") {
    const topology = component.topology;
    const positionedNodes = topology
      ? (() => {
          const fallbackRects = fallbackTopologyRects(
            component.preferredRect.width,
            component.preferredRect.height,
            topology.nodes.length,
            template ?? "linear",
          );
          return topology.nodes.map((node, index) => {
            const rect = node.preferredRect;
            if (!rect) return { ...node, rect: fallbackRects[index] };
          return {
            ...node,
            rect: {
              x: rect.x - component.preferredRect.x,
              y: rect.y - component.preferredRect.y,
              width: rect.width,
              height: rect.height,
            },
          };
          });
        })()
      : undefined;
    if (positionedNodes) {
      const explicitNodes = positionedNodes.filter((node) => node.visible !== false);
      const byId = new Map(positionedNodes.map((node) => [node.id, node]));
      const centers = (explicitNodes.length ? explicitNodes : positionedNodes).map((node) => ({
        x: node.rect.x + node.rect.width / 2,
        y: node.rect.y + node.rect.height / 2,
      }));
      const center = {
        x: centers.reduce((sum, point) => sum + point.x, 0) / centers.length,
        y: centers.reduce((sum, point) => sum + point.y, 0) / centers.length,
      };
      const curved = template === "cyclical";
      const curveOffset = Math.min(
        component.preferredRect.width,
        component.preferredRect.height,
      ) * 0.16;
      const boundaryPoint = (
        node: (typeof explicitNodes)[number],
        toward: { x: number; y: number },
      ) => {
        const origin = {
          x: node.rect.x + node.rect.width / 2,
          y: node.rect.y + node.rect.height / 2,
        };
        const dx = toward.x - origin.x;
        const dy = toward.y - origin.y;
        if (!dx && !dy) return origin;
        const scale = Math.min(
          dx ? node.rect.width / 2 / Math.abs(dx) : Infinity,
          dy ? node.rect.height / 2 / Math.abs(dy) : Infinity,
        );
        return { x: origin.x + dx * scale, y: origin.y + dy * scale };
      };
      const edgePath = (from: (typeof explicitNodes)[number], to: (typeof explicitNodes)[number]) => {
        const fromCenter = {
          x: from.rect.x + from.rect.width / 2,
          y: from.rect.y + from.rect.height / 2,
        };
        const toCenter = {
          x: to.rect.x + to.rect.width / 2,
          y: to.rect.y + to.rect.height / 2,
        };
        const start = boundaryPoint(from, toCenter);
        const end = boundaryPoint(to, fromCenter);
        if (!curved) return `M${start.x} ${start.y}L${end.x} ${end.y}`;
        const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        const outward = { x: midpoint.x - center.x, y: midpoint.y - center.y };
        const length = Math.hypot(outward.x, outward.y) || 1;
        return `M${start.x} ${start.y}Q${midpoint.x + outward.x / length * curveOffset} ${midpoint.y + outward.y / length * curveOffset} ${end.x} ${end.y}`;
      };
      const edgeMidpoint = (from: (typeof explicitNodes)[number], to: (typeof explicitNodes)[number]) => ({
        x: (from.rect.x + from.rect.width / 2 + to.rect.x + to.rect.width / 2) / 2,
        y: (from.rect.y + from.rect.height / 2 + to.rect.y + to.rect.height / 2) / 2,
      });
      const markerId = `topology-arrow-${component.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      return (
        <svg
          className="illustration topology-preview"
          viewBox={`0 0 ${component.preferredRect.width} ${component.preferredRect.height}`}
          aria-hidden="true"
        >
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0 0 10 5 0 10Z" className="topology-arrowhead" />
            </marker>
          </defs>
          <g className="chart-axis">
            {component.topology!.edges.map((edge, index) => {
              const from = byId.get(edge.from)!;
              const to = byId.get(edge.to)!;
              if (from.visible === false || to.visible === false) return null;
              return (
                <path
                  key={`${edge.from}-${edge.to}-${index}`}
                  d={edgePath(from, to)}
                  markerEnd={`url(#${markerId})`}
                />
              );
            })}
          </g>
          {component.topology!.edges.map((edge, index) => {
            if (!edge.label) return null;
            const from = byId.get(edge.from)!;
            const to = byId.get(edge.to)!;
            if (from.visible === false || to.visible === false) return null;
            const midpoint = edgeMidpoint(from, to);
            return (
              <text
                key={`label-${edge.from}-${edge.to}-${index}`}
                x={midpoint.x}
                y={midpoint.y - 8}
                textAnchor="middle"
                className="topology-edge-label"
              >
                {edge.label}
              </text>
            );
          })}
          {explicitNodes.map((node) => (
            <g key={node.id}>
              {node.primitive?.kind === "shape" && node.primitive.shape === "circle" ? (
                <ellipse
                  cx={node.rect.x + node.rect.width / 2}
                  cy={node.rect.y + node.rect.height / 2}
                  rx={node.rect.width / 2}
                  ry={node.rect.height / 2}
                  className={`topology-node fill-${node.primitive.fill ?? "none"} color-${node.primitive.color ?? "accent"}`}
                />
              ) : node.primitive?.kind === "shape" && node.primitive.shape === "line" ? (
                <path
                  d={`M${node.rect.x} ${node.rect.y + node.rect.height / 2}H${node.rect.x + node.rect.width}`}
                  className={`topology-node topology-line color-${node.primitive.color ?? "accent"}`}
                />
              ) : (
                <rect
                  {...node.rect}
                  rx={node.primitive?.kind === "shape" && node.primitive.shape === "rectangle"
                    ? 0
                    : curved
                      ? node.rect.width / 2
                      : Math.min(node.rect.width, node.rect.height) * 0.08}
                  className={`topology-node ${node.primitive?.kind === "shape" ? `fill-${node.primitive.fill ?? "none"} color-${node.primitive.color ?? "accent"}` : ""}`}
                />
              )}
              {node.primitive?.kind === "icon" && (
                <path
                  d={`M${node.rect.x + node.rect.width * 0.35} ${node.rect.y + node.rect.height * 0.62}L${node.rect.x + node.rect.width * 0.5} ${node.rect.y + node.rect.height * 0.35}L${node.rect.x + node.rect.width * 0.65} ${node.rect.y + node.rect.height * 0.62}Z`}
                  className={`topology-icon style-${node.primitive.style ?? "outline"} color-${node.primitive.color ?? "accent"}`}
                />
              )}
              <text
                x={node.rect.x + node.rect.width / 2}
                y={node.rect.y + node.rect.height / 2}
                dy="0.35em"
                textAnchor="middle"
                className="node-text topology-node-label"
              >
                {node.primitive?.kind === "icon"
                  ? node.primitive.name?.trim() || "Icon"
                  : node.id}
              </text>
            </g>
          ))}
        </svg>
      );
    }
    if (component.kind === "chart") return null;
    return (
      <DiagramTypeIcon
        type={component.appearance.type}
        className="diagram-canvas-icon"
      />
    );
  }
  if (component.kind === "image")
    return (
      <svg className="illustration image-preview" viewBox="0 0 600 240" aria-hidden="true">
        <rect x="24" y="18" width="552" height="204" rx="4" className="chart-context" />
        <circle cx="455" cy="66" r="22" className="chart-accent" />
        <path d="M45 205 190 72l112 103 80-68 173 98Z" className="image-mountain" />
      </svg>
    );
  if (component.kind === "table") {
    const columns = 3;
    const rows = 4;
    const tableStyle = tableStyleForAppearance(appearance);
    return (
      <span
        className={`table-preview table-style-${tableStyle} table-density-${appearance?.density ?? "sparse"}`}
        aria-hidden="true"
      >
        {Array.from({ length: rows * columns }, (_, index) => {
          const row = Math.floor(index / columns);
          const isHeader = row === 0;
          return <i key={index} className={isHeader ? "table-header" : ""} />;
        })}
      </span>
    );
  }
  return null;
}

function textContentStyle(component: Extract<CompositionComponent, { kind: "text-block" }>, pageWidth: number): CSSProperties {
  const style = component.textStyle;
  return {
    fontSize: `${(style?.size ?? 36) * 100 / pageWidth}cqw`,
    fontWeight: style?.weight ?? 400,
    lineHeight: style?.lineHeight ?? 1.4,
    fontFamily: `var(--vector-${style?.font ?? "body"}-font)`,
    color: `var(--slide-${style?.color ?? "ink"})`,
  };
}

function componentColors(
  component: CompositionComponent,
  palette: ReturnType<typeof composerPalette>,
) {
  const appearance = {
    ...defaultAppearance(component.kind),
    ...(component.appearance as Record<string, string> | undefined),
  };
  const scheme = appearance?.colorScheme ?? "accent-with-muted-context";
  let accent = palette.accent;
  let context = palette.line;
  if (scheme === "monochrome") [accent, context] = [palette.fg, palette.muted];
  if (scheme === "categorical")
    [accent, context] = [palette.categorical[0], palette.categorical[1]];
  if (scheme === "sequential")
    [accent, context] = [palette.sequential[4], palette.sequential[1]];
  if (scheme === "status")
    [accent, context] = [palette.status.complete, palette.status.blocked];
  if (appearance?.emphasis === "none") accent = context;
  if (appearance?.emphasis === "latest-series") accent = palette.categorical[2];
  if (appearance?.emphasis === "exception") accent = palette.emphasis;
  return {
    "--component-accent": accent,
    "--component-context": context,
  } as CSSProperties;
}

function customVisualSource(component: CompositionComponent) {
  if (!component.customVisual || component.customVisual.format !== "svg") return undefined;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(component.customVisual.source)}`;
}

const reactSvgAttributes: Record<string, string> = {
  "fill-opacity": "fillOpacity",
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "font-style": "fontStyle",
  "font-weight": "fontWeight",
  "stroke-dasharray": "strokeDasharray",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-opacity": "strokeOpacity",
  "stroke-width": "strokeWidth",
  "text-anchor": "textAnchor",
  "dominant-baseline": "dominantBaseline",
  "vector-effect": "vectorEffect",
};

function vectorProps(attributes: VectorElement["attributes"]) {
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [reactSvgAttributes[key] ?? key, resolveVectorAttribute(key, value)]),
  );
}

function EditableVectorVisual({
  component,
  interactive,
  active,
  selectedElementId,
  onSelectElement,
  onElement,
  onEditEnd,
}: {
  component: CompositionComponent;
  interactive: boolean;
  active: boolean;
  selectedElementId?: string;
  onSelectElement: (id?: string, edit?: boolean) => void;
  onElement: (element: VectorElement, mergeKey?: string) => void;
  onEditEnd: () => void;
}) {
  const visual = component.customVisual;
  if (!visual || visual.format !== "vector") return null;
  const vectorVisual = visual;
  const svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<{
    id: string;
    endpoint: "start" | "end";
    pointerId: number;
  } | undefined>(undefined);
  const children = new Map<string | undefined, VectorElement[]>();
  for (const element of visual.elements) {
    const peers = children.get(element.parentId) ?? [];
    peers.push(element);
    children.set(element.parentId, peers);
  }
  function renderElement(element: VectorElement): React.ReactNode {
    const nested = (children.get(element.id) ?? []).map(renderElement);
    return createElement(
      element.kind,
      {
        ...vectorProps(element.attributes),
        key: element.id,
        "data-vector-element": element.id,
        className: selectedElementId === element.id ? "vector-element selected" : "vector-element",
        onDoubleClick: interactive && active
          ? (event: React.MouseEvent<SVGElement>) => {
              event.stopPropagation();
              onSelectElement(element.id, true);
            }
          : undefined,
        onPointerDown: interactive && active
          ? (event: React.PointerEvent<SVGElement>) => {
              event.stopPropagation();
              onSelectElement(element.id);
            }
          : undefined,
      },
      element.text,
      ...nested,
    );
  }
  const selected = vectorVisual.elements.find((element) => element.id === selectedElementId);
  const line = selected?.kind === "line" && !selected.parentId ? selected : undefined;
  function point(event: React.PointerEvent<SVGCircleElement>) {
    const point = svg.current!.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(event.currentTarget.getScreenCTM()!.inverse());
  }
  function handleMove(event: React.PointerEvent<SVGCircleElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId || !line) return;
    const next = point(event);
    const attributes = {
      ...line.attributes,
      [current.endpoint === "start" ? "x1" : "x2"]: Math.round(next.x),
      [current.endpoint === "start" ? "y1" : "y2"]: Math.round(next.y),
    };
    onElement({ ...line, attributes }, `vector:${component.id}:${line.id}`);
  }
  const preserveAspectRatio = vectorVisual.fit === "stretch"
    ? "none"
    : vectorVisual.fit === "cover"
      ? "xMidYMid slice"
      : "xMidYMid meet";
  return (
    <svg
      ref={svg}
      className={`custom-vector-art ${active ? "editing" : ""}`}
      viewBox={`${vectorVisual.viewBox.x} ${vectorVisual.viewBox.y} ${vectorVisual.viewBox.width} ${vectorVisual.viewBox.height}`}
      preserveAspectRatio={preserveAspectRatio}
      role="img"
      aria-label={vectorVisual.description}
    >
      {(children.get(undefined) ?? []).map(renderElement)}
      {interactive && active && line && (
        <g className="vector-handles" transform={String(line.attributes.transform ?? "")} aria-label={`Edit line ${line.id}`}>
          {(["start", "end"] as const).map((endpoint) => {
            const x = Number(line.attributes[endpoint === "start" ? "x1" : "x2"] ?? 0);
            const y = Number(line.attributes[endpoint === "start" ? "y1" : "y2"] ?? 0);
            return (
              <circle
                key={endpoint}
                cx={x}
                cy={y}
                r={Math.max(8, vectorVisual.viewBox.width / 150)}
                tabIndex={0}
                aria-label={`${endpoint} endpoint`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  gesture.current = { id: line.id, endpoint, pointerId: event.pointerId };
                }}
                onPointerMove={handleMove}
                onPointerUp={(event) => {
                  if (gesture.current?.pointerId !== event.pointerId) return;
                  gesture.current = undefined;
                  onEditEnd();
                }}
              />
            );
          })}
        </g>
      )}
    </svg>
  );
}

export function Canvas({
  mode = "edit",
  draft,
  activeSlideId,
  selected,
  vectorSelection,
  onSelect,
  onVectorSelect,
  onSlideName,
  onComponent,
  onDuplicate,
  onEditEnd,
  onAdd,
  onNotice,
  revisionNotes = [],
  onSelectNote,
}: {
  mode?: "edit" | "present";
  draft: Draft;
  activeSlideId: string;
  selected?: string;
  vectorSelection?: { componentId: string; elementId?: string };
  onSelect: (id?: string) => void;
  onVectorSelect?: (selection?: { componentId: string; elementId?: string }, edit?: boolean) => void;
  onSlideName: (name: string) => void;
  onComponent: (component: CompositionComponent, mergeKey?: string) => void;
  onDuplicate?: (id: string, rect: Rect) => CompositionComponent | undefined;
  onEditEnd: () => void;
  onAdd: (
    kind: CompositionComponent["kind"],
    at: { x: number; y: number },
  ) => void;
  onNotice: (message: string) => void;
  revisionNotes?: RevisionNote[];
  onSelectNote?: (note: RevisionNote) => void;
}) {
  const interactive = mode === "edit";
  const slide = getSlide(draft, activeSlideId);
  const page = String(draft.slides.indexOf(slide) + 1).padStart(2, "0");
  const pageTotal = String(draft.slides.length).padStart(2, "0");
  const canvas = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    id: string;
    x: number;
    y: number;
    rect: Rect;
    corner?: ResizeCorner;
    scale: number;
    duplicate?: boolean;
  } | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [editingIntent, setEditingIntent] = useState<string>();
  const [editingSlideName, setEditingSlideName] = useState(false);
  const [nextSlideName, setNextSlideName] = useState(slide.name);
  function start(
    event: PointerEvent,
    component: CompositionComponent,
    corner?: ResizeCorner,
  ) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    (event.currentTarget as HTMLElement).focus();
    onSelect(component.id);
    gesture.current = {
      id: component.id,
      duplicate: event.altKey && !corner,
      x: event.clientX,
      y: event.clientY,
      rect: component.preferredRect,
      corner,
      scale: canvas.current!.getBoundingClientRect().width / slide.canvas.width,
    };
  }
  function move(event: PointerEvent) {
    const active = gesture.current;
    if (!active) return;
    const component = slide.components.find((c) => c.id === active.id)!;
    const dx = (event.clientX - active.x) / active.scale;
    const dy = (event.clientY - active.y) / active.scale;
    if (active.duplicate && Math.hypot(event.clientX - active.x, event.clientY - active.y) < 3) return;
    const rect = active.corner
      ? resizeFromCorner(active.rect, dx, dy, active.corner)
      : { ...active.rect, x: active.rect.x + dx, y: active.rect.y + dy };
    const others = slide.components
      .filter((c) => c.id !== active.id)
      .map((c) => c.preferredRect);
    const result = active.corner
      ? snapResizeRect(rect, others, 14, {
          left: active.corner.endsWith("w"),
          top: active.corner.startsWith("n"),
          right: active.corner.endsWith("e"),
          bottom: active.corner.startsWith("s"),
        }, slide.canvas, slide.innerPadding)
      : snapRect(rect, others, 14, slide.canvas, slide.innerPadding);
    setGuides(result.guides);
    if (active.duplicate) {
      active.duplicate = false;
      const copy = onDuplicate?.(component.id, result.rect);
      if (!copy) { gesture.current = null; return; }
      active.id = copy.id;
      return;
    }
    onComponent(
      { ...component, preferredRect: result.rect },
      `geometry:${component.id}`,
    );
  }
  function end() {
    if (!gesture.current) return;
    gesture.current = null;
    setGuides([]);
    onEditEnd();
  }
  const themeId = draft.theme?.id ?? "plex";
  const themeMode = draft.theme?.mode ?? "paper";
  const palette = composerPalette(themeId, themeMode);
  const typography = getTheme(themeLabel(themeId), themeMode, draft.theme?.typography);
  const canvasStyle = {
    "--component-layers": slide.paintOrder.length,
    "--slide-bg": palette.bg,
    "--slide-accent": palette.accent,
    "--slide-ink": palette.fg,
    "--slide-muted": palette.muted,
    "--slide-context": palette.line,
    "--slide-wash": palette.wash,
    "--vector-ink": palette.fg,
    "--vector-muted": palette.muted,
    "--vector-background": palette.bg,
    "--vector-surface": palette.surface,
    "--vector-divider": palette.line,
    "--vector-accent": palette.accent,
    "--vector-on-accent": palette.bg,
    "--vector-wash": palette.wash,
    "--vector-heading-font": typography.headline,
    "--vector-body-font": typography.body,
  } as CSSProperties;
  return (
    <main
      id="canvas-stage"
      className={`stage ${interactive ? "" : "presentation-stage"}`}
      style={{ "--page-ratio": slide.canvas.width / slide.canvas.height } as CSSProperties}
      tabIndex={-1}
      onPointerDown={(event) => {
        if (!interactive) return;
        if (
          event.target instanceof Element &&
          !event.target.closest(".canvas")
        )
          onSelect();
      }}
    >
      <div className="slide-wrap">
        {interactive && <div className="stage-meta">
          {editingSlideName ? (
            <input
              aria-label="Page name"
              autoFocus
              value={nextSlideName}
              onChange={(event) => setNextSlideName(event.target.value)}
              onBlur={() => {
                const name = nextSlideName.trim();
                if (name && name !== slide.name) onSlideName(name);
                else setNextSlideName(slide.name);
                setEditingSlideName(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  setNextSlideName(slide.name);
                  setEditingSlideName(false);
                }
              }}
            />
          ) : (
            <h2
              title="Double-click to rename page"
              onDoubleClick={() => {
                setNextSlideName(slide.name);
                setEditingSlideName(true);
              }}
            >
              {slide.name}
            </h2>
          )}
          {selected && slide.components.some((component) => component.id === selected && component.customVisual?.format === "vector") && (
            <button
              type="button"
              className="edit-elements-action"
              aria-pressed={vectorSelection?.componentId === selected}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                setEditingIntent(undefined);
                onVectorSelect?.(vectorSelection?.componentId === selected ? undefined : { componentId: selected });
              }}
            >
              {vectorSelection?.componentId === selected ? "Done editing" : "Edit elements"}
            </button>
          )}
        </div>}
        <div
          ref={canvas}
          className={`canvas ${themeMode} ${interactive ? "" : "presentation-canvas"}`}
          data-theme={themeId}
          style={canvasStyle}
          aria-label="Page canvas"
          onPointerDown={(e) => {
            if (interactive && e.target === e.currentTarget) onSelect();
          }}
          onPointerMove={interactive ? move : undefined}
          onPointerUp={interactive ? () => end() : undefined}
          onPointerCancel={interactive ? () => end() : undefined}
          onLostPointerCapture={interactive ? () => end() : undefined}
          onDragOver={(e) => {
            if (!interactive) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            if (!interactive) return;
            e.preventDefault();
            const kind = e.dataTransfer.getData(
              "application/konpeki-component",
            );
            if (!componentKinds.includes(kind as CompositionComponent["kind"]))
              return;
            const r = e.currentTarget.getBoundingClientRect();
            onAdd(kind as CompositionComponent["kind"], {
              x: ((e.clientX - r.left) / r.width) * slide.canvas.width,
              y: ((e.clientY - r.top) / r.height) * slide.canvas.height,
            });
          }}
        >
          {slide.readingOrder
            .flatMap((entry) => entry.kind === "component"
              ? [entry.id]
              : slide.groups.find((group) => group.id === entry.id)!.childIds)
            .map((id) => slide.components.find((c) => c.id === id)!)
            .map((component) => {
              const r = component.preferredRect;
              const label = componentInstanceLabel(
                slide.components,
                component.id,
              );
              const a = {
                ...defaultAppearance(component.kind),
                ...(component.appearance as Record<string, string> | undefined),
              };
              const style = {
                ...componentColors(component, palette),
                zIndex: slide.paintOrder.indexOf(component.id),
                left: `${r.x * 100 / slide.canvas.width}%`,
                top: `${r.y * 100 / slide.canvas.height}%`,
                width: `${r.width * 100 / slide.canvas.width}%`,
                height: `${r.height * 100 / slide.canvas.height}%`,
                textAlign:
                  a?.alignment === "end"
                    ? "right"
                    : a?.alignment === "center"
                      ? "center"
                      : "left",
              } as CSSProperties;
              return (
                <div
                  key={component.id}
                  data-component={component.id}
                  className={`slide-component kind-${component.kind} role-${a?.role ?? "body"} ${component.customVisual ? "custom-visual" : ""} ${interactive && selected === component.id ? "selected" : ""} border-${a?.border ?? "none"} rule-${a?.rule ?? "none"} title-${a?.titleStyle ?? "plain"} purpose-${a?.purpose ?? "narrative"} treatment-${a?.treatment ?? "plain"} color-${a?.color ?? "ink"} scheme-${a?.colorScheme ?? "accent-with-muted-context"} emphasis-${a?.emphasis ?? "primary"} density-${a?.density ?? "sparse"} fit-${a?.fit ?? "cover"}`}
                  style={style}
                >
                  <div
                    className="component-surface"
                    role={interactive ? "button" : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    aria-label={interactive ? `Select ${label}` : undefined}
                    aria-pressed={interactive ? selected === component.id : undefined}
                    onPointerDown={interactive ? (e) => {
                      if (
                        e.target instanceof Element &&
                        e.target.closest(".inline-intent-editor")
                      )
                        return;
                      start(e, component);
                    } : undefined}
                    onClick={interactive ? () => onSelect(component.id) : undefined}
                    onDoubleClick={interactive ? (e) => {
                      e.stopPropagation();
                      onSelect(component.id);
                      onVectorSelect?.(undefined);
                      setEditingIntent(component.id);
                    } : undefined}
                    onKeyDown={interactive ? (e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSelect(component.id);
                        if (component.customVisual?.format === "vector")
                          onVectorSelect?.({ componentId: component.id });
                        else if (!component.customVisual) setEditingIntent(component.id);
                        return;
                      }
                      if (e.key === " ") {
                        e.preventDefault();
                        onSelect(component.id);
                        return;
                      }
                      if (
                        ![
                          "ArrowLeft",
                          "ArrowRight",
                          "ArrowUp",
                          "ArrowDown",
                        ].includes(e.key)
                      )
                        return;
                      e.preventDefault();
                      const next = snapRect(
                        {
                          ...r,
                          x:
                            r.x +
                            (e.key === "ArrowRight"
                              ? 10
                              : e.key === "ArrowLeft"
                                ? -10
                                : 0),
                          y:
                            r.y +
                            (e.key === "ArrowDown"
                              ? 10
                              : e.key === "ArrowUp"
                                ? -10
                                : 0),
                        },
                        [],
                        0,
                        slide.canvas,
                        slide.innerPadding,
                      ).rect;
                      onComponent(
                        { ...component, preferredRect: next },
                        `geometry:${component.id}`,
                      );
                    } : undefined}
                    onKeyUp={interactive ? (event) => {
                      if (
                        event.target === event.currentTarget &&
                        [
                          "ArrowLeft",
                          "ArrowRight",
                          "ArrowUp",
                          "ArrowDown",
                        ].includes(event.key)
                      )
                        onEditEnd();
                    } : undefined}
                  >
                    {component.customVisual?.format === "vector" ? (
                      <EditableVectorVisual
                        component={component}
                        interactive={interactive}
                        active={vectorSelection?.componentId === component.id}
                        selectedElementId={
                          vectorSelection?.componentId === component.id
                            ? vectorSelection.elementId
                            : undefined
                        }
                        onSelectElement={(elementId, edit) =>
                          onVectorSelect?.({ componentId: component.id, elementId }, edit)
                        }
                        onElement={(element, mergeKey) => {
                          if (component.customVisual?.format !== "vector") return;
                          onComponent({
                            ...component,
                            customVisual: {
                              ...component.customVisual,
                              elements: component.customVisual.elements.map((item) =>
                                item.id === element.id ? element : item,
                              ),
                            },
                          }, mergeKey);
                        }}
                        onEditEnd={onEditEnd}
                      />
                    ) : component.customVisual ? (
                      <img
                        className={`custom-visual-art fit-${component.customVisual.fit ?? "contain"}`}
                        src={customVisualSource(component)}
                        alt={component.customVisual.description}
                        draggable={false}
                      />
                    ) : component.kind === "text-block" ? (
                      <div className="text-block-content" style={textContentStyle(component, slide.canvas.width)}>{component.content ?? ""}</div>
                    ) : (
                      <>
                        <span className="component-heading">
                          {label}
                        </span>
                        {editingIntent !== component.id && (
                            <span className="component-intent">
                              {component.intent}
                            </span>
                          )}
                        {(component.kind === "diagram" || component.kind === "chart") && component.topology && (
                          <span className="topology-indicator">
                            Recorded topology: {component.topology.nodes.length} nodes ·{" "}
                            {component.topology.edges.length} connections
                          </span>
                        )}
                        <Illustration component={component} />
                      </>
                    )}
                  </div>
                  {interactive && editingIntent === component.id && (
                    <textarea
                      className="component-intent inline-intent-editor"
                      aria-label={`Edit ${label} ${component.kind === "text-block" ? "text" : "intent"}`}
                      style={component.kind === "text-block" ? textContentStyle(component, slide.canvas.width) : undefined}
                      autoFocus
                      value={component.kind === "text-block" ? component.content ?? "" : component.intent ?? ""}
                      onFocus={(event) => event.currentTarget.select()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        onComponent(
                          component.kind === "text-block" ? { ...component, content: event.target.value } : { ...component, intent: event.target.value },
                          `${component.kind === "text-block" ? "content" : "intent"}:${component.id}`,
                        )
                      }
                      onBlur={() => {
                        setEditingIntent(undefined);
                        onEditEnd();
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Escape") return;
                        event.preventDefault();
                        const surface = event.currentTarget
                          .previousElementSibling as HTMLElement | null;
                        event.currentTarget.blur();
                        requestAnimationFrame(() => surface?.focus());
                      }}
                    />
                  )}
                  {interactive && selected === component.id &&
                    (["nw", "ne", "sw", "se"] as const).map((corner) => (
                      <button
                        key={corner}
                        type="button"
                        className={`resize-handle resize-${corner}`}
                        aria-label={`Resize ${label} from ${corner}`}
                        title="Resize with pointer or arrow keys"
                        onPointerDown={(e) => start(e, component, corner)}
                        onKeyDown={(e) => {
                          if (
                            ![
                              "ArrowLeft",
                              "ArrowRight",
                              "ArrowUp",
                              "ArrowDown",
                            ].includes(e.key)
                          )
                            return;
                          e.preventDefault();
                          e.stopPropagation();
                          const dx =
                            e.key === "ArrowRight"
                              ? 10
                              : e.key === "ArrowLeft"
                                ? -10
                                : 0;
                          const dy =
                            e.key === "ArrowDown"
                              ? 10
                              : e.key === "ArrowUp"
                                ? -10
                                : 0;
                          const next = snapResizeRect(
                            resizeFromCorner(r, dx, dy, corner),
                            [],
                            0,
                            {
                              left: corner.endsWith("w"),
                              top: corner.startsWith("n"),
                              right: corner.endsWith("e"),
                              bottom: corner.startsWith("s"),
                            },
                            slide.canvas,
                            slide.innerPadding,
                          ).rect;
                          onComponent(
                            { ...component, preferredRect: next },
                            `geometry:${component.id}`,
                          );
                          onNotice(
                            `Size ${Math.round(next.width)} by ${Math.round(next.height)}`,
                          );
                        }}
                        onKeyUp={onEditEnd}
                      />
                    ))}
                </div>
              );
            })}
          {interactive && revisionNotes.map((note, index) => {
            if (note.slideId !== slide.id || note.resolved) return null;
            const component = slide.components.find(c => c.id === note.componentId);
            if (note.componentId && !component) return null;
            const rect = component?.preferredRect;
            const previous = revisionNotes.slice(0, index).filter(n => !n.resolved && n.slideId === note.slideId && n.componentId === note.componentId).length;
            return <button key={note.id} type="button" className="revision-pin"
              aria-label={`Revision note ${index + 1}: ${note.text}`} title={note.text}
              style={{ left: rect ? `clamp(0px, calc(${(rect.x + rect.width) * 100 / slide.canvas.width}% - ${64 + previous * 44}px), calc(100% - 40px))` : `${3 + previous * 44}px`, top: rect ? `max(0px, calc(${rect.y * 100 / slide.canvas.height}% - 32px))` : "3px", zIndex: slide.paintOrder.length + 4 }}
              onPointerDown={event => event.stopPropagation()}
              onClick={event => { event.stopPropagation(); onSelectNote?.(note); }}>{index + 1}</button>;
          })}
          {slide.pageNumber?.style !== "none" && (
            <span
              className={`slide-page-number color-${slide.pageNumber?.color ?? "muted"}`}
              aria-label="Page number"
            >
              {slide.pageNumber?.style === "01/02"
                ? `${page}/${pageTotal}`
                : page}
            </span>
          )}
          {interactive && guides.map((guide, index) => (
            <div
              key={index}
              aria-hidden="true"
              className={`guide guide-${guide.axis}`}
              style={
                guide.axis === "x"
                  ? { left: `${guide.value * 100 / slide.canvas.width}%` }
                  : { top: `${guide.value * 100 / slide.canvas.height}%` }
              }
            />
          ))}
        </div>
      </div>
    </main>
  );
}
