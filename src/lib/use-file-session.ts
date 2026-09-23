import { useEffect, useRef, useState } from "react";
import { canonicalJSON } from "../../composition/compile.ts";
import { validateComposition } from "../../composition/validate.ts";
import type { Draft } from "./model.ts";
import { activeRequest, emptyReview, type ReviewState, type ReviewTarget } from "./review.ts";
import {
  addNote,
  removeNote,
  cancelRequest,
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
  onNotice: (message: string, tone?: "neutral" | "error") => void;
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
  const [review, setReview] = useState<ReviewState>(emptyReview);
  const reviewRef = useRef(review);
  const buildPending = useRef(false);
  const submittingBuild = useRef(false);
  const loading = useRef(false);
  const loadGeneration = useRef(0);
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
    void reload();
    return () => {
      loadGeneration.current++;
      loading.current = false;
    };
  }, [enabled, token]);

  useEffect(() => {
    if (!enabled || !state.current.ready || ["loading", "conflict", "error"].includes(status))
      return;
    if (!validateComposition(draft).ok) return;
    const timer = window.setTimeout(() => { void save(draft); }, 250);
    return () => window.clearTimeout(timer);
  }, [draft, enabled, status]);

  useEffect(() => {
    if (!enabled || !token) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      if (!state.current.ready || loading.current || state.current.drain || submittingBuild.current) return;
      const revision = state.current.revision;
      const generation = loadGeneration.current;
      void loadFileSession(token).then((remote) => {
        if (cancelled || generation !== loadGeneration.current || loading.current || state.current.drain || submittingBuild.current || revision !== state.current.revision) return;
        receiveReview(remote.review);
        if (canonicalJSON(draftRef.current) === state.current.savedJSON) {
          setStatus("saved");
          callbacksRef.current.onError("");
        }
        if (remote.revision === revision) return;
        if (canonicalJSON(draftRef.current) !== state.current.savedJSON) {
          setStatus("conflict");
          callbacksRef.current.onError("The file changed elsewhere. Your browser edits are not saved; neither version was overwritten.");
          return;
        }
        state.current = {
          ready: true,
          revision: remote.revision,
          savedJSON: canonicalJSON(remote.document),
        };
        setStatus("saved");
        callbacksRef.current.onExternalChange(remote.document);
      }).catch((error) => {
        if (cancelled || generation !== loadGeneration.current || loading.current || state.current.drain || submittingBuild.current || revision !== state.current.revision) return;
        setStatus("error");
        callbacksRef.current.onError(`Could not load the latest file. ${error instanceof Error ? error.message : "Check the local file service."}`);
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

  function receiveReview(next: ReviewState) {
    if (next.version < reviewRef.current.version) return;
    reviewRef.current = next;
    setReview(next);
    buildPending.current = activeRequest(next.request);
    setBuilding(buildPending.current);
  }

  async function noteAction(action: () => Promise<ReviewState>, saveFirst = false) {
    if (loading.current || !state.current.ready) throw new Error("Wait for the file to open before submitting.");
    if (submittingBuild.current) throw new Error("Wait for the current save before submitting.");
    submittingBuild.current = true;
    try {
      if (saveFirst && !await save(draftRef.current)) throw new Error("Save the composition before adding a note.");
      receiveReview(await action());
    } finally { submittingBuild.current = false; }
  }

  function save(next: Draft): Promise<string | undefined> {
    if (!token || loading.current || !state.current.ready || activeRequest(reviewRef.current.request)) return Promise.resolve(undefined);
    if (!validateComposition(next).ok) return Promise.resolve(undefined);
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
        callbacksRef.current.onError("");
      } catch (error) {
        state.current.pending = undefined;
        const conflict = error instanceof FileSessionError && error.status === 409;
        setStatus(conflict ? "conflict" : "error");
        callbacksRef.current.onError(
          conflict
            ? "The file changed elsewhere. Your browser edits are not saved; neither version was overwritten."
            : `Changes are not saved. ${error instanceof Error ? error.message : "Could not save the composition file."}`,
        );
        return;
      }
    }
  }

  async function build(
    instruction: string,
    slideId: string,
    componentId?: string,
    elementId?: string,
  ) {
    if (!token || loading.current || !state.current.ready || buildPending.current) return false;
    if (submittingBuild.current) throw new Error("Wait for your note to finish saving before building.");
    buildPending.current = true;
    submittingBuild.current = true;
    setBuilding(true);
    try {
      const revision = await save(draftRef.current);
      if (!revision) {
        finishBuild();
        return false;
      }
      receiveReview(await sendBuildRequest(token, {
        revision,
        instruction,
        slideId,
        ...(componentId ? { componentId } : {}),
        ...(elementId ? { elementId } : {}),
      }));
      return true;
    } catch (error) {
      finishBuild();
      throw error;
    } finally {
      submittingBuild.current = false;
    }
  }

  async function reload() {
    if (!token || loading.current || state.current.drain || submittingBuild.current) return;
    loading.current = true;
    const generation = ++loadGeneration.current;
    const requestedJSON = canonicalJSON(draftRef.current);
    setStatus("loading");
    try {
      const session = await loadFileSession(token);
      if (generation !== loadGeneration.current) return;
      if (canonicalJSON(draftRef.current) !== requestedJSON) {
        setStatus("conflict");
        callbacksRef.current.onError("Your browser edits changed while opening the file. Neither version was overwritten. Download JSON before loading the file again.");
        return;
      }
      state.current = { ready: true, revision: session.revision, savedJSON: canonicalJSON(session.document) };
      draftRef.current = session.document;
      receiveReview(session.review);
      callbacksRef.current.onOpen(session.document, session.name);
      callbacksRef.current.onError("");
      setStatus("saved");
    } catch (error) {
      if (generation !== loadGeneration.current) return;
      setStatus("error");
      callbacksRef.current.onError(error instanceof Error ? error.message : "Could not open the file.");
    } finally {
      if (generation === loadGeneration.current) loading.current = false;
    }
  }

  return {
    status, build, building, review,
    opening: status === "loading",
    ready: state.current.ready,
    reload,
    retry: () => state.current.ready && !activeRequest(reviewRef.current.request) ? save(draftRef.current) : reload(),
    addNote: (target: ReviewTarget, text: string) => noteAction(() => addNote(token!, target, text), true),
    removeNote: (id: string) => noteAction(() => removeNote(token!, id)),
    cancel: () => noteAction(() => cancelRequest(token!, reviewRef.current.request!.id)),
  };
}
