import type { DiagramType } from "../../composition/types.ts";

export function DiagramTypeIcon({
  type,
  className = "",
}: {
  type: DiagramType;
  className?: string;
}) {
  const nodes = (points: [number, number][]) =>
    points.map(([cx, cy], index) => (
      <circle key={index} cx={cx} cy={cy} r="2.5" />
    ));
  return (
    <svg
      className={`diagram-type-icon ${className}`.trim()}
      viewBox="0 0 48 32"
      aria-hidden="true"
    >
      {type === "architecture" ? <>
        <rect x="19" y="11" width="10" height="10" rx="2" />
        {nodes([[6, 7], [42, 7], [6, 25], [42, 25]])}
        <path d="M19 14 8 8m21 6 11-6M19 18 8 24m21-6 11 6" />
      </> : type === "it-current-state" ? <>
        <rect x="3" y="4" width="14" height="8" rx="1" /><rect x="28" y="3" width="17" height="10" rx="1" /><rect x="8" y="21" width="16" height="8" rx="1" /><rect x="34" y="20" width="11" height="9" rx="1" /><path d="M17 8h11M15 12l-3 9m12 4h10M36 13l3 7" />
      </> : type === "high-level" ? <>
        <rect x="3" y="8" width="12" height="16" rx="2" /><rect x="18" y="8" width="12" height="16" rx="2" /><rect x="33" y="8" width="12" height="16" rx="2" />
      </> : type === "deployment" ? <>
        <rect x="3" y="4" width="42" height="24" rx="2" /><path d="M24 4v24" /><rect x="7" y="9" width="12" height="7" rx="1" /><rect x="29" y="17" width="12" height="7" rx="1" /><path d="M19 12h7l-2-2m2 2-2 2" />
      </> : type === "nested" ? <>
        <rect x="3" y="4" width="42" height="24" rx="2" /><rect x="9" y="9" width="30" height="14" rx="2" /><rect x="16" y="13" width="16" height="6" rx="1" />
      </> : type === "flowchart" ? <>
        <rect x="2" y="11" width="10" height="9" rx="2" /><path d="m24 8 8 8-8 8-8-8Z M12 16h4m16 0h8" /><circle cx="43" cy="16" r="3" />
      </> : type === "sequence" ? <>
        {nodes([[8, 5], [24, 5], [40, 5]])}<path d="M8 9v18M24 9v18M40 9v18M8 13h16l-3-2m3 2-3 2M40 20H24l3-2m-3 2 3 2" />
      </> : type === "state-machine" ? <>
        {nodes([[8, 16], [24, 7], [40, 16], [24, 25]])}<path d="m11 14 10-5m6 0 10 5m0 4-10 5m-6 0-10-5" />
      </> : type === "swimlane" ? <>
        <path d="M2 9h44M2 22h44M15 3v26" /><rect x="19" y="12" width="9" height="6" rx="1" /><path d="M28 15h9" />
      </> : type === "process" ? <>
        {nodes([[6, 16], [18, 16], [30, 16], [42, 16]])}<path d="M9 16h6m6 0h6m6 0h6" />
      </> : type === "user-journey" ? <>
        <path d="M4 20C12 7 20 25 28 12s12-3 16-6" />{nodes([[5, 19], [16, 15], [28, 12], [43, 6]])}<path d="M7 26h8m3 0h8m3 0h8" />
      </> : type === "data-flow" ? <>
        <rect x="2" y="11" width="11" height="10" rx="2" /><circle cx="25" cy="16" r="6" /><path d="M13 16h6m12 0h8l-3-3m3 3-3 3" /><path d="M40 10v12" />
      </> : type === "dp-integration" ? <>
        <rect x="2" y="7" width="11" height="18" rx="2" /><rect x="19" y="4" width="10" height="24" rx="2" /><rect x="35" y="7" width="11" height="18" rx="2" /><path d="M13 16h6m10 0h6" />
      </> : type === "er-data-model" ? <>
        <rect x="2" y="8" width="14" height="16" rx="1" /><rect x="32" y="8" width="14" height="16" rx="1" /><path d="m24 10 6 6-6 6-6-6Zm-8 6h2m12 0h2" />
      </> : type === "database-schema" ? <>
        <rect x="2" y="6" width="15" height="20" rx="1" /><path d="M2 12h15M6 16h7M6 20h7" /><rect x="31" y="6" width="15" height="20" rx="1" /><path d="M31 12h15M35 16h7M17 17h14" />
      </> : type === "medallion" ? <>
        <ellipse cx="12" cy="16" rx="9" ry="12" /><ellipse cx="24" cy="16" rx="9" ry="12" /><ellipse cx="36" cy="16" rx="9" ry="12" /><path d="M8 16h8m4 0h8m4 0h8" />
      </> : type === "layer-stack" ? <>
        <path d="m24 3 18 7-18 7-18-7Zm-18 13 18 7 18-7M6 22l18 7 18-7" />
      </> : type === "dp-security-matrix" ? <>
        <rect x="7" y="4" width="34" height="24" rx="1" /><path d="M7 12h34M7 20h34M18 4v24M29 4v24" /><circle cx="35" cy="16" r="2" />
      </> : type === "dependency-graph" ? <>
        {nodes([[6, 8], [6, 24], [24, 16], [42, 8], [42, 24]])}<path d="M8 9 21 15M8 23l13-6m6-2 13-6m-13 8 13 6" />
      </> : type === "uml-class" ? <>
        <rect x="10" y="3" width="28" height="26" rx="1" /><path d="M10 10h28M10 18h28M15 14h12M15 22h17M15 25h12" />
      </> : type === "tree" ? <>
        {nodes([[24, 5], [12, 16], [36, 16], [6, 27], [18, 27], [30, 27], [42, 27]])}<path d="M22 7 14 14m12-7 8 7M11 18l-4 7m7-7 3 7m18-7-4 7m7-7 3 7" />
      </> : type === "org-chart" ? <>
        <rect x="19" y="2" width="10" height="7" rx="1" /><path d="M24 9v7M8 16h32M8 16v6M24 16v6M40 16v6" /><rect x="3" y="22" width="10" height="7" rx="1" /><rect x="19" y="22" width="10" height="7" rx="1" /><rect x="35" y="22" width="10" height="7" rx="1" />
      </> : type === "pyramid-funnel" ? <path d="M5 4h38l-6 7H11Zm8 10h22l-5 6H18Zm7 9h8l-4 6Z" />
      : type === "timeline" ? <>{nodes([[7, 16], [20, 16], [33, 16], [44, 16]])}<path d="M3 16h42M7 13V7M20 19v7M33 13V7" /></>
      : type === "gantt" ? <><path d="M12 3v26M2 9h44M2 16h44M2 23h44" /><path className="filled" d="M16 5h15v3H16zm8 7h18v3H24zm-7 7h13v3H17zm14 7h11v3H31z" /></>
      : type === "kanban" ? <><rect x="3" y="3" width="42" height="26" rx="2" /><path d="M17 3v26M31 3v26" /><rect x="6" y="8" width="8" height="5" rx="1" /><rect x="20" y="8" width="8" height="8" rx="1" /><rect x="34" y="8" width="8" height="12" rx="1" /></>
      : type === "story-map" ? <><path d="M3 10h42M15 3v26M28 3v26M3 21h42" /><rect x="5" y="4" width="8" height="4" rx="1" /><rect x="17" y="13" width="9" height="5" rx="1" /><rect x="31" y="23" width="11" height="4" rx="1" /></>
      : type === "quadrant" ? <><path d="M5 27V4m0 23h39M24 4v23M5 16h39" />{nodes([[13, 10], [20, 21], [32, 8], [39, 23]])}</>
      : type === "wardley-map" ? <><path d="M5 27V4m0 23h39M10 22 20 15l8 5 10-12M20 15l-3-7m11 12 8 4" />{nodes([[10, 22], [20, 15], [17, 8], [28, 20], [38, 8], [36, 24]])}</>
      : type === "loop-flywheel" ? <><circle cx="24" cy="16" r="11" /><path d="m29 5 5 1-2 5M19 27l-5-1 2-5" />{nodes([[24, 5], [35, 16], [24, 27], [13, 16]])}</>
      : type === "venn" ? <><circle cx="19" cy="16" r="10" /><circle cx="29" cy="16" r="10" /></>
      : <><path d="M5 16h37M37 12l5 4-5 4M13 16 7 7M20 16l-4-12M27 16l7-10M34 16l8 8" />{nodes([[7, 7], [16, 4], [34, 6], [42, 24]])}</>}
    </svg>
  );
}
