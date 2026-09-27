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
