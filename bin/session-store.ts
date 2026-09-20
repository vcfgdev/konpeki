import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { canonicalJSON } from "../composition/compile.ts";
import { validateComposition } from "../composition/validate.ts";
import { parseCompositionJSON } from "../composition/document.ts";

export function revisionFor(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function requestFileFor(compositionPath: string) {
  const key = revisionFor(resolve(compositionPath));
  return join(tmpdir(), "konpeki", `${key}.request.json`);
}

export async function readCompositionFile(compositionPath: string) {
  const raw = await readFile(compositionPath, "utf8");
  const parsed = parseCompositionJSON(raw);
  if (!parsed.ok) throw new Error(parsed.message);
  return {
    document: parsed.document,
    revision: revisionFor(raw),
    name: basename(compositionPath),
  };
}

export async function saveCompositionFile(
  compositionPath: string,
  expectedRevision: string,
  document: unknown,
) {
  const validation = validateComposition(document);
  if (!validation.ok) {
    const issue = validation.issues[0];
    throw Object.assign(
      new Error(`${issue?.path || "document"} ${issue?.message || "is invalid"}`),
      { code: "INVALID_COMPOSITION" },
    );
  }
  const current = await readFile(compositionPath, "utf8");
  const currentRevision = revisionFor(current);
  if (currentRevision !== expectedRevision) {
    throw Object.assign(new Error("The composition changed outside this browser."), {
      code: "REVISION_CONFLICT",
      revision: currentRevision,
    });
  }
  const value = `${canonicalJSON(document)}\n`;
  const temporary = join(
    dirname(compositionPath),
    `.${basename(compositionPath)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
  await writeFile(temporary, value, { encoding: "utf8", flag: "wx" });
  try {
    await rename(temporary, compositionPath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return { revision: revisionFor(value) };
}

export async function writeBuildRequest(
  compositionPath: string,
  request: {
    revision: string;
    instruction: string;
    slideId: string;
    componentId?: string;
  },
) {
  const current = await readCompositionFile(compositionPath);
  if (current.revision !== request.revision) {
    throw Object.assign(new Error("Save the latest composition before requesting a build."), {
      code: "REVISION_CONFLICT",
      revision: current.revision,
    });
  }
  const output = requestFileFor(compositionPath);
  await mkdir(dirname(output), { recursive: true });
  const value = {
    schema: "konpeki-build-request/v1",
    compositionPath: resolve(compositionPath),
    revision: request.revision,
    instruction: request.instruction.trim(),
    slideId: request.slideId,
    ...(request.componentId ? { componentId: request.componentId } : {}),
    createdAt: new Date().toISOString(),
  };
  await writeFile(output, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return { output, request: value };
}
