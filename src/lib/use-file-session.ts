import { useEffect, useRef, useState } from "react";
import { canonicalJSON } from "../../composition/compile.ts";
import { validateComposition } from "../../composition/validate.ts";
import type { Draft } from "./model.ts";
import {
  FileSessionError,
  fileSessionToken,
  loadFileSession,
  saveFileSession,
  sendBuildRequest,
} from "./file-session.ts";

export type FileStatus = "loading" | "saved" | "saving" | "conflict" | "error";

type Callbacks = {
  onOpen: (draft: Draft, name: string) => void;
  onExternalChange: (draft: Draft) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

export function useFileSession(
  enabled: boolean,
  draft: Draft,
  callbacks: Callbacks,
) {
  const token = fileSessionToken();
  const [status, setStatus] = useState<FileStatus>(enabled ? "loading" : "saved");
  const [building, setBuilding] = useState(false);
  const buildPending = useRef(false);
  const submittingBuild = useRef(false);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const state = useRef<{
    ready: boolean;
    revision: string;
    savedJSON: string;
    pending?: { draft: Draft; serialized: string };
    drain?: Promise<void>;
  }>({ ready: false, revision: "", savedJSON: "" });

  useEffect(() => {
    if (!enabled || !token) return;
    let cancelled = false;
    void loadFileSession(token).then((session) => {
      if (cancelled) return;
      state.current = {
        ready: true,
        revision: session.revision,
        savedJSON: canonicalJSON(session.document),
      };
      setStatus("saved");
      callbacksRef.current.onOpen(session.document, session.name);
    }).catch((error) => {
      if (cancelled) return;
      setStatus("error");
      callbacksRef.current.onError(
        error instanceof Error ? error.message : "Could not open the file-backed composition.",
      );
    });
    return () => { cancelled = true; };
  }, [enabled, token]);

  useEffect(() => {
    if (!enabled || !state.current.ready || ["conflict", "error"].includes(status))
      return;
    if (!validateComposition(draft).ok) return;
    const timer = window.setTimeout(() => { void save(draft); }, 250);
    return () => window.clearTimeout(timer);
  }, [draft, enabled, status]);

  useEffect(() => {
    if (!enabled || !token) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      if (!state.current.ready || state.current.drain || submittingBuild.current) return;
      const revision = state.current.revision;
      void loadFileSession(token).then((remote) => {
        if (cancelled || state.current.drain || submittingBuild.current || revision !== state.current.revision || remote.revision === revision) return;
        if (canonicalJSON(draftRef.current) !== state.current.savedJSON) {
          finishBuild();
          setStatus("conflict");
          callbacksRef.current.onNotice(
            "The file changed elsewhere. Neither version was overwritten.",
          );
          return;
        }
        state.current = {
          ready: true,
          revision: remote.revision,
          savedJSON: canonicalJSON(remote.document),
        };
        setStatus("saved");
        callbacksRef.current.onExternalChange(remote.document);
        finishBuild();
      }).catch(() => {
        if (cancelled || submittingBuild.current || revision !== state.current.revision) return;
        setStatus("error");
        if (buildPending.current) {
          finishBuild();
          callbacksRef.current.onNotice("Could not load the agent result. Check the local file service.");
        }
      });
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, token]);

  function finishBuild() {
    buildPending.current = false;
    setBuilding(false);
  }

  function save(next: Draft): Promise<string | undefined> {
    if (!token || !state.current.ready) return Promise.resolve(undefined);
    const serialized = canonicalJSON(next);
    if (serialized === state.current.savedJSON && !state.current.drain)
      return Promise.resolve(state.current.revision);
    state.current.pending = { draft: next, serialized };
    if (!state.current.drain) {
      state.current.drain = drain(token).finally(() => {
        state.current.drain = undefined;
      });
    }
    return state.current.drain.then(() =>
      state.current.savedJSON === serialized ? state.current.revision : undefined,
    );
  }

  async function drain(activeToken: string) {
    while (state.current.pending) {
      const pending = state.current.pending;
      state.current.pending = undefined;
      setStatus("saving");
      try {
        const result = await saveFileSession(
          activeToken,
          state.current.revision,
          pending.draft,
        );
        state.current.revision = result.revision;
        state.current.savedJSON = pending.serialized;
        setStatus("saved");
      } catch (error) {
        state.current.pending = undefined;
        const conflict = error instanceof FileSessionError && error.status === 409;
        setStatus(conflict ? "conflict" : "error");
        callbacksRef.current.onNotice(conflict
          ? "The composition changed outside this browser. Your edits were not overwritten."
          : error instanceof Error ? error.message : "Could not save the composition file.");
        return;
      }
    }
  }

  async function build(
    instruction: string,
    slideId: string,
    componentId?: string,
  ) {
    if (!token || buildPending.current) return false;
    buildPending.current = true;
    submittingBuild.current = true;
    setBuilding(true);
    try {
      const revision = await save(draftRef.current);
      if (!revision) {
        finishBuild();
        return false;
      }
      await sendBuildRequest(token, {
        revision,
        instruction,
        slideId,
        ...(componentId ? { componentId } : {}),
      });
      return true;
    } catch (error) {
      finishBuild();
      throw error;
    } finally {
      submittingBuild.current = false;
    }
  }

  return { status, build, building };
}
