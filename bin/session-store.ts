import { createHash, randomBytes } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { canonicalJSON } from "../composition/compile.ts";
import { validateComposition } from "../composition/validate.ts";
import { parseCompositionJSON } from "../composition/document.ts";

export function revisionFor(value: string) {
  return createHash("sha256").update(value).digest("hex");
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
