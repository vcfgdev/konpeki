import type { CompositionDocument } from "../../composition/runtime.ts";
import { resolveDocument, toComposition, type WireDocument } from "../../composition/grid.ts";
import { assertComposition } from "../../composition/validate.ts";
import type { ReviewState } from "./review.ts";

export type FileSessionDocument = {
  document: CompositionDocument;
  revision: string;
  name: string;
  commentKey: string;
  review: ReviewState;
  reviewError?: string;
};

export class FileSessionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly revision?: string,
  ) {
    super(message);
  }
}

export function fileSessionToken() {
  return new URLSearchParams(window.location.search).get("session");
}

async function request<T>(
  token: string,
  path = "",
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/__konpeki/session${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      "x-konpeki-session": token,
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
  });
  const body = await response.json() as { error?: string; revision?: string } & T;
  if (!response.ok)
    throw new FileSessionError(
      body.error || "The local Konpeki service could not complete the request.",
      response.status,
      body.revision,
    );
  return body;
}

export async function loadFileSession(token: string): Promise<FileSessionDocument> {
  const session = await request<Omit<FileSessionDocument, "document"> & { document: WireDocument }>(token);
  return { ...session, document: resolveDocument(assertComposition(session.document)) };
}

export function saveFileSession(
  token: string,
  revision: string,
  document: CompositionDocument,
) {
  return request<{ revision: string }>(token, "", {
    method: "PUT",
    body: JSON.stringify({ revision, document: toComposition(document) }),
  });
}
