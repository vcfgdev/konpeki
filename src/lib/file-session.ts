import type { CompositionDocument } from "../../composition/types.ts";

export type FileSessionDocument = {
  document: CompositionDocument;
  revision: string;
  name: string;
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

export function loadFileSession(token: string) {
  return request<FileSessionDocument>(token);
}

export function saveFileSession(
  token: string,
  revision: string,
  document: CompositionDocument,
) {
  return request<{ revision: string }>(token, "", {
    method: "PUT",
    body: JSON.stringify({ revision, document }),
  });
}

export function sendBuildRequest(
  token: string,
  requestBody: {
    revision: string;
    instruction: string;
    slideId: string;
    componentId?: string;
  },
) {
  return request<{ ok: true }>(token, "/build", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}
