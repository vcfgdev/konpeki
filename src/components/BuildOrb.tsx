import type { CSSProperties } from "react";

/** Decorative, deterministic particles: no timers or animation dependency. */
export function BuildOrb({ active = false, nebula = false }: { active?: boolean; nebula?: boolean }) {
  const count = nebula ? 96 : 24;
  return <svg className={`build-orb${active ? " active" : ""}${nebula ? " nebula" : ""}`} viewBox="0 0 100 100" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => {
      const angle = i / count * Math.PI * 2 - Math.PI / 2;
      const y = nebula ? 34 * (2 * (i + 0.5) / count - 1) : Math.sin(angle) * 34;
      const radius = Math.sqrt(34 ** 2 - y ** 2);
      const x = nebula ? Math.cos(i * 2.39996) * radius : Math.cos(angle) * 34;
      const squareEdge = i / count * 4;
      const squareVertices = [[-28, -28], [28, -28], [28, 28], [-28, 28]];
      const squareFrom = squareVertices[Math.floor(squareEdge) % 4];
      const squareTo = squareVertices[(Math.floor(squareEdge) + 1) % 4];
      const squareT = squareEdge % 1;
      const edge = i / count * 3;
      const vertices = [[0, -36], [32, 24], [-32, 24]];
      const from = vertices[Math.floor(edge) % 3];
      const to = vertices[(Math.floor(edge) + 1) % 3];
      const t = edge % 1;
      const hexEdge = i / count * 6;
      const hexAngle = Math.floor(hexEdge) * Math.PI / 3 - Math.PI / 2;
      const hexT = hexEdge % 1;
      const style = {
        "--x": `${x}px`, "--y": `${y}px`,
        "--sx": `${squareFrom[0] + (squareTo[0] - squareFrom[0]) * squareT}px`,
        "--sy": `${squareFrom[1] + (squareTo[1] - squareFrom[1]) * squareT}px`,
        "--tx": `${from[0] + (to[0] - from[0]) * t}px`,
        "--ty": `${from[1] + (to[1] - from[1]) * t}px`,
        "--hx": `${34 * ((1 - hexT) * Math.cos(hexAngle) + hexT * Math.cos(hexAngle + Math.PI / 3))}px`,
        "--hy": `${34 * ((1 - hexT) * Math.sin(hexAngle) + hexT * Math.sin(hexAngle + Math.PI / 3))}px`,
        "--radius": `${radius}px`,
        "--phase": `${-i * 2.39996 / (2 * Math.PI) * 12}s`,
        opacity: nebula ? 0.65 : 1,
      } as CSSProperties;
      return <circle key={i} cx="50" cy="50" r={nebula ? 0.8 + (i % 3) * 0.45 : 2.5} style={style} />;
    })}
  </svg>;
}
