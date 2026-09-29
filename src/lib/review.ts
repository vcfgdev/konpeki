import type { CompositionDocument } from "../../composition/runtime.ts";

export type ReviewTarget = { slideId: string; componentId?: string; elementId?: string };
export type RevisionNote = ReviewTarget & {
  id: string;
  text: string;
  resolved: boolean;
};
export type ReviewState = {
  schema: "konpeki-review/v1";
  version: number;
  notes: RevisionNote[];
};
export const emptyReview = (): ReviewState => ({ schema: "konpeki-review/v1", version: 0, notes: [] });

export function isReviewState(input: unknown): input is ReviewState {
  if (!input || typeof input !== "object") return false;
  const state = input as ReviewState;
  return state.schema === "konpeki-review/v1" && Number.isSafeInteger(state.version) && state.version >= 0 &&
    Array.isArray(state.notes) && state.notes.every(note => note &&
      typeof note.id === "string" && typeof note.slideId === "string" &&
      typeof note.text === "string" && typeof note.resolved === "boolean" &&
      (note.componentId === undefined || typeof note.componentId === "string") &&
      (note.elementId === undefined || typeof note.elementId === "string"));
}

export function reviewPrompt(document: CompositionDocument, review: ReviewState, sourceName?: string) {
  const comments = review.notes.filter(note => !note.resolved).map((note, index) => {
    const page = document.pages.find(page => page.id === note.slideId);
    const component = page?.components.find(component => component.id === note.componentId);
    const element = component?.customVisual?.format === "vector"
      ? component.customVisual.elements.find(element => element.id === note.elementId) : undefined;
    return [
      `${index + 1}. Page: ${JSON.stringify(note.slideId)}${page ? ` (${page.name})` : " [missing]"}`,
      ...(note.componentId ? [`Component: ${JSON.stringify(note.componentId)}${component ? "" : " [missing]"}`] : []),
      ...(note.elementId ? [`Vector element: ${JSON.stringify(note.elementId)}${element ? "" : " [missing]"}`] : []),
      `Comment:\n${note.text}`,
    ].join("\n");
  });
  return [
    `Revise the Konpeki composition ${JSON.stringify(document.title)} using these comments.`,
    ...(sourceName ? [`Source file: ${JSON.stringify(sourceName)}`] : ["Use the latest composition JSON shared in this conversation; ask for it if unavailable."]),
    "Reread the current source first. Preserve unrelated human edits and stable page/component/vector IDs. Target IDs are scoped to their page. If a target is missing or ambiguous, ask rather than guessing. Run Konpeki inspect, render the result, and visually check it before delivery.",
    ...comments,
  ].join("\n\n");
}
