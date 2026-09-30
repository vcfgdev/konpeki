import { readFileSync } from "node:fs";

export type FloorRule = { ids: string[]; tier: "ban" | "default" | "verify"; check: "inspect" | "review"; text: string };

const tiers: Record<string, FloorRule["tier"]> = { Bans: "ban", Defaults: "default", Verify: "verify" };

/** The rules in skills/konpeki/floor.md, the single source for the review checklist. */
export function floorRules(source = readFileSync(new URL("../skills/konpeki/floor.md", import.meta.url), "utf8")) {
  const rules: FloorRule[] = [];
  let tier: FloorRule["tier"] | undefined;
  for (const line of source.split("\n")) {
    const heading = /^## (\w+)/.exec(line);
    if (heading) { tier = tiers[heading[1]]; continue; }
    const rule = /^- ((?:`[a-z0-9-]+`(?:, )?)+) \((inspect|review)\):(?: (.*))?$/.exec(line);
    if (rule && tier) rules.push({ ids: rule[1].match(/[a-z0-9-]+/g)!, tier, check: rule[2] as FloorRule["check"], text: rule[3] ?? "" });
    else if (/^ {2}\S/.test(line) && rules.length) rules.at(-1)!.text = `${rules.at(-1)!.text} ${line.trim()}`.trim();
  }
  return rules;
}

/** The first sentence, ignoring full stops inside quoted examples. */
function firstSentence(text: string) {
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') quoted = !quoted;
    else if (!quoted && text[i] === "." && (i + 1 === text.length || text[i + 1] === " ")) return text.slice(0, i + 1);
  }
  return text;
}

/** The first sentence of each rule that only a person looking at the page can check. */
export function reviewChecklist(rules = floorRules()) {
  return rules.filter(rule => rule.check === "review").map(rule => `${rule.ids[0]}: ${firstSentence(rule.text)}`);
}
