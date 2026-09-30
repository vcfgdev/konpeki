import { spawnSync } from "node:child_process";
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

try {
  const [cli, input, ...extra] = process.argv.slice(2);
  if (!cli || !input || extra.length && (extra.length !== 2 || extra[0] !== "--theme"))
    throw new Error("Usage: node prepare-document.mjs <cli> <document.html> [--theme default|editorial|dark|dense-data]");
  const theme = extra[1] ?? "default";
  if (!["default", "editorial", "dark", "dense-data"].includes(theme)) throw new Error(`Unknown theme: ${theme}`);
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
    const themeRoot = theme === "default" ? root : join(root, "themes", theme);
    const assets = new Map([["theme.css", join(themeRoot, "theme.css")], ["theme-base.css", join(root, "theme-base.css")]]);
    for (const directory of new Set([root, themeRoot]))
      for (const name of readdirSync(join(directory, "fonts")))
        if (/\.woff2$|OFL\.txt$/.test(name)) assets.set(`fonts/${name}`, join(directory, "fonts", name));
    if (existsSync(join(themeRoot, "NOTES.md"))) assets.set("NOTES.md", join(themeRoot, "NOTES.md"));
    // Preflight every asset before writing any: a theme request must not silently
    // reuse another theme or replace an author's stylesheet in a shared folder.
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
