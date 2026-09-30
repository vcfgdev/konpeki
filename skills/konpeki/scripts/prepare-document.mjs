import { spawnSync } from "node:child_process";
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

try {
  const [cli, input, ...extra] = process.argv.slice(2);
  if (!cli || !input || extra.length) throw new Error("Usage: node prepare-document.mjs <cli> <document.html>");
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
    const assets = new Map([["theme.css", join(root, "theme.css")], ["theme-base.css", join(root, "theme-base.css")]]);
    for (const name of readdirSync(join(root, "fonts")))
      if (/\.woff2$|OFL\.txt$/.test(name)) assets.set(`fonts/${name}`, join(root, "fonts", name));
    // Preflight every asset before writing any: never replace an author's
    // adapted stylesheet or fonts in a shared folder.
    for (const [asset, source] of assets) {
      const destination = join(dirname(documentPath), asset);
      if (existsSync(destination) && !readFileSync(destination).equals(readFileSync(source)))
        throw new Error(`Existing asset differs: ${destination}. Use a new directory; existing files were not changed.`);
    }
    mkdirSync(join(dirname(documentPath), "fonts"), { recursive: true });
    for (const [asset, source] of assets) {
      try { copyFileSync(source, join(dirname(documentPath), asset), constants.COPYFILE_EXCL); }
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
