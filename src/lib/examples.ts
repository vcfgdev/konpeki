import { validateComposition } from "../../composition/validate.ts";
import { resolveDocument } from "../../composition/grid.ts";
import type { Draft } from "./model.ts";
import introducingKonpeki from "../../composition/fixtures/introducing-konpeki/composition.json" with { type: "json" };

export function exampleDraft(name: string | null): Draft | undefined {
  if (name === "introducing-konpeki") {
    const validation = validateComposition(introducingKonpeki);
    if (!validation.ok) throw new Error("Invalid Konpeki introduction deck");
    return resolveDocument(validation.document);
  }
  return undefined;
}
