import { spawnSync } from "node:child_process";
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

try {
  const [cli, input, ...extra] = process.argv.slice(2);
  if (!cli || !input || extra.length)
    throw new Error("Usage: node prepare-document.mjs <cli> <document.html>");
  if (!/\.html?$/i.test(input)) throw new Error("Use an .html document path.");
  const documentPath = resolve(input);
  function validate(path) {
    // Use the supplied CLI, not internal TypeScript imports from node_modules.
    const result = spawnSync(process.execPath, [cli, "validate", path], {
      stdio: ["ignore", 2, 2],
    });
    if (result.error || result.status !== 0)
      throw new Error("Document validation failed; existing files were not changed.");
  }
  let created = false;
  if (!existsSync(documentPath)) {
    const template = fileURLToPath(new URL("../assets/blank.html", import.meta.url));
    validate(template);
    const blank = readFileSync(template);
    const root = resolve(dirname(cli), "..");
    mkdirSync(join(dirname(documentPath), "fonts"), { recursive: true });
    for (const asset of ["theme.css", "fonts/OFL.txt", ...[400, 600, 700].map(weight => `fonts/ibm-plex-sans-latin-${weight}-normal.woff2`)]) {
      try { copyFileSync(join(root, asset), join(dirname(documentPath), asset), constants.COPYFILE_EXCL); }
      catch (error) { if (error.code !== "EEXIST") throw error; }
    }
    try {
      writeFileSync(documentPath, blank, { flag: "wx" });
      created = true;
    } catch (error) {
      // Another initializer may have created it; reopen, never replace it.
      if (error.code !== "EEXIST") throw error;
    }
  }
  validate(documentPath);
  console.log(JSON.stringify({ documentPath, created }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
