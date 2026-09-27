// Editor/render types. The immutable v1 wire API remains in types.ts; v2 is in grid.ts.
export * from "./types.ts";
export type {
  ResolvedComponent as CompositionComponent,
  ResolvedSlide as CompositionSlide,
  ResolvedDocument as CompositionDocument,
} from "./grid.ts";
