import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

try {
  const [cli, input, ...extra] = process.argv.slice(2);
  if (!cli || !input || extra.length)
    throw new Error("Usage: node prepare-document.mjs <cli> <document.html|composition.json>");
  const html = /\.html?$/i.test(input);
  if (!html && !/\.json$/i.test(input)) throw new Error("Use an .html or .json document path.");
  const compositionPath = resolve(input);
  function validate(path) {
    // Use the published JS CLI, not TypeScript imports from node_modules.
    const result = spawnSync(process.execPath, [cli, "validate", path], {
      stdio: ["ignore", 2, 2],
    });
    if (result.error || result.status !== 0)
      throw new Error("Document validation failed; existing files were not changed.");
  }
  let created = false;
  if (!existsSync(compositionPath)) {
    if (existsSync(`${compositionPath}.review.json`))
      throw new Error("Review data exists without its composition. Restore the document or choose a new path.");
    const template = fileURLToPath(new URL(html ? "../assets/blank.html" : "../assets/blank.json", import.meta.url));
    validate(template);
    const blank = readFileSync(template);
    mkdirSync(dirname(compositionPath), { recursive: true });
    try {
      writeFileSync(compositionPath, blank, { flag: "wx" });
      created = true;
    } catch (error) {
      // Another initializer may have created it; reopen, never replace it.
      if (error.code !== "EEXIST") throw error;
    }
  }
  validate(compositionPath);
  console.log(JSON.stringify({ ...(html ? { documentPath: compositionPath } : { compositionPath }), created }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
