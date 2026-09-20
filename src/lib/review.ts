export type ReviewTarget = { slideId: string; componentId?: string; elementId?: string };
export type RevisionNote = ReviewTarget & {
  id: string;
  text: string;
  resolved: boolean;
};
export type BuildRequest = ReviewTarget & {
  schema: "konpeki-build-request/v2";
  id: string;
  compositionPath: string;
  revision: string;
  instruction: string;
  notes: RevisionNote[];
  status: "submitted" | "working" | "done" | "needs-clarification" | "failed";
  message?: string;
  resultRevision?: string;
};
export type ReviewState = {
  schema: "konpeki-review/v1";
  version: number;
  notes: RevisionNote[];
  request?: BuildRequest;
};
export const emptyReview = (): ReviewState => ({ schema: "konpeki-review/v1", version: 0, notes: [] });
export const activeRequest = (request?: BuildRequest) =>
  request?.status === "submitted" || request?.status === "working";
