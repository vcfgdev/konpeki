import type { Rect, VectorElementKind } from "./types.ts";
import type { TextLayout } from "./text-layout.ts";

export type SceneTarget = { pageId: string; componentId?: string; elementId?: string };
export type SceneShape = SceneTarget & {
  kind: "shape";
  tag: Exclude<VectorElementKind, "g" | "text" | "tspan">;
  attributes: Record<string, string | number>;
  /** Explicit local-to-page affine transform. Writers never compute fit. */
  transform: [number, number, number, number, number, number];
  clip?: Rect;
};
export type SceneText = SceneTarget & {
  kind: "text";
  source: string;
  box: Rect;
  layout: TextLayout;
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  color: string;
  opacity: number;
  label: boolean;
  clip?: Rect;
};
export type SceneItem = SceneShape | SceneText;
export type ScenePage = {
  pageId: string;
  width: number;
  height: number;
  background: string;
  items: SceneItem[];
  components: { id: string; box: Rect; contentBox: Rect; draft: boolean; artworkScale?: [number, number]; chart: boolean }[];
};
