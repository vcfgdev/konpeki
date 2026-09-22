import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { initialDraft } from "../composition/document.ts";
import { validateComposition } from "../composition/validate.ts";

const skill = new URL("../skills/konpeki/", import.meta.url);
const cli = fileURLToPath(new URL("./konpeki.mjs", import.meta.url));

async function fixture(path: string, version = "0.2.0") {
  for (const file of ["AGENTS.md", "AUTHORING.md", "composition/README.md", "design/README.md", "docs/workflow.md"]) {
    await mkdir(dirname(join(path, file)), { recursive: true });
    await writeFile(join(path, file), "fixture\n");
  }
  await mkdir(join(path, "runtime"), { recursive: true });
  await writeFile(join(path, "runtime/konpeki.mjs"), `
    import { readFileSync } from "node:fs";
    if (process.argv[2] !== "validate" || JSON.parse(readFileSync(process.argv[3])).schema !== "konpeki-composition/v1") process.exit(1);
    console.log("fixture validation passed");
  `);
  await writeFile(join(path, "package.json"), JSON.stringify({ name: "konpeki", version, bin: { konpeki: "runtime/konpeki.mjs" } }));
}

test("a copied skill resolves pinned runtimes without touching project files", async t => {
  const root = await mkdtemp(join(tmpdir(), "konpeki-onboarding-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = join(root, "user project");
  const cache = join(root, "user cache");
  const checkout = join(root, "plugin checkout");
  const copied = join(checkout, "skills/konpeki");
  await mkdir(workspace);
  await cp(skill, copied, { recursive: true });
  const packageJSON = '{"name":"existing-project","private":true}\n';
  const guidance = "Keep my project guidance.\n";
  await writeFile(join(workspace, "package.json"), packageJSON);
  await writeFile(join(workspace, "AGENTS.md"), guidance);
  const run = (...args: string[]) => spawnSync(process.execPath, [join(copied, "scripts/ensure-runtime.mjs"), ...args], {
    cwd: workspace,
    env: { ...process.env, XDG_CACHE_HOME: cache, LOCALAPPDATA: cache },
    encoding: "utf8",
  });
  const missing = run();
  assert.equal(missing.status, 1);
  assert.equal(missing.stdout, "");
  assert.match(missing.stderr, /--install/);
  assert.deepEqual((await readdir(workspace)).sort(), ["AGENTS.md", "package.json"]);
  await assert.rejects(readdir(cache), { code: "ENOENT" });

  await fixture(checkout);
  await rm(join(checkout, "runtime"), { recursive: true });
  await mkdir(join(checkout, "bin"));
  await writeFile(join(checkout, "bin/konpeki.mjs"), 'import "missing-dependency";');
  assert.equal(run().status, 1, "a dependency-free checkout is not a usable runtime");
  const cachedRoot = join(cache, "konpeki/0.2.0/node_modules/konpeki");
  await fixture(cachedRoot);
  assert.deepEqual(JSON.parse(run().stdout), { root: cachedRoot, cli: join(cachedRoot, "runtime/konpeki.mjs"), version: "0.2.0" });
  const installedRoot = join(workspace, "node_modules/konpeki");
  await fixture(installedRoot);
  assert.equal(JSON.parse(run("--install").stdout).root, installedRoot, "reuse beats installation, including with --install");
  await writeFile(join(installedRoot, "runtime/konpeki.mjs"), 'throw Error("broken runtime");');
  const fallback = run();
  assert.equal(fallback.stderr, "", "failed probes must not leak diagnostics into bootstrap output");
  assert.equal(JSON.parse(fallback.stdout).root, cachedRoot, "broken workspace and checkout must not shadow a usable cache");
  await fixture(installedRoot, "0.1.0");
  assert.equal(JSON.parse(run().stdout).root, cachedRoot, "an incompatible workspace package must not be reused or replaced");
  assert.equal(JSON.parse(await readFile(join(installedRoot, "package.json"), "utf8")).version, "0.1.0");
  await rm(join(cachedRoot, "AUTHORING.md"));
  assert.equal(run().status, 1, "incomplete runtime must not be reported ready");
  assert.equal(await readFile(join(workspace, "package.json"), "utf8"), packageJSON);
  assert.equal(await readFile(join(workspace, "AGENTS.md"), "utf8"), guidance);
});

test("bootstrap installs into its cache, not an ancestor project or inherited global prefix", async t => {
  const root = await mkdtemp(join(tmpdir(), "konpeki-install-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = join(root, "existing project");
  const copied = join(root, "installed skill");
  const packageRoot = join(root, "fixture package");
  await mkdir(workspace);
  await cp(skill, copied, { recursive: true });
  const manifest = '{"name":"keep-project","private":true}\n';
  const lock = '{"name":"keep-project","lockfileVersion":3,"packages":{}}\n';
  await writeFile(join(workspace, "package.json"), manifest);
  await writeFile(join(workspace, "package-lock.json"), lock);
  const broken = join(workspace, "node_modules/konpeki");
  await fixture(broken);
  const brokenCLI = 'import "missing-dependency";';
  await writeFile(join(broken, "runtime/konpeki.mjs"), brokenCLI);
  await fixture(packageRoot);
  const exec = promisify(execFile);
  const packed = await exec("npm", ["pack", "--json", "--ignore-scripts", "--global=false", "--pack-destination", root], { cwd: packageRoot });
  const tarball = await readFile(join(root, JSON.parse(packed.stdout)[0].filename));
  let downloads = 0;
  const registry = createServer((request, response) => {
    if (request.url === "/konpeki") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({
        name: "konpeki", "dist-tags": { latest: "0.2.0" },
        versions: { "0.2.0": { name: "konpeki", version: "0.2.0", bin: { konpeki: "runtime/konpeki.mjs" }, dist: { tarball: `${registryURL}/konpeki.tgz` } } },
      }));
    } else if (request.url === "/konpeki.tgz") {
      downloads++;
      response.end(tarball);
    } else { response.writeHead(404); response.end(); }
  });
  registry.listen(0, "127.0.0.1");
  await once(registry, "listening");
  t.after(() => new Promise<void>(resolve => registry.close(() => resolve())));
  const address = registry.address();
  assert.ok(address && typeof address === "object");
  const registryURL = `http://127.0.0.1:${address.port}`;
  const installed = await exec(process.execPath, [join(copied, "scripts/ensure-runtime.mjs"), "--install"], {
    cwd: workspace,
    env: {
      ...process.env,
      XDG_CACHE_HOME: "nested cache", LOCALAPPDATA: "nested cache",
      npm_config_registry: registryURL, npm_config_cache: join(root, "npm cache"),
      npm_config_global: "true", npm_config_prefix: join(root, "global prefix"),
      npm_config_userconfig: join(root, "empty-npmrc"),
    },
  });
  const cachedRoot = join(workspace, "nested cache/konpeki/0.2.0/node_modules/konpeki");
  assert.deepEqual(JSON.parse(installed.stdout), { root: cachedRoot, cli: join(cachedRoot, "runtime/konpeki.mjs"), version: "0.2.0" });
  assert.equal(downloads, 1, "exercise a real npm install against the disposable registry");
  assert.equal(await readFile(join(workspace, "package.json"), "utf8"), manifest);
  assert.equal(await readFile(join(workspace, "package-lock.json"), "utf8"), lock);
  assert.equal(await readFile(join(broken, "runtime/konpeki.mjs"), "utf8"), brokenCLI);
  await assert.rejects(readdir(join(root, "global prefix")), { code: "ENOENT" });
});

test("plugin packages the canonical skill with creation-first prompts", async () => {
  const manifest = JSON.parse(await readFile(new URL("../plugin.json", import.meta.url), "utf8"));
  const marketplace = JSON.parse(await readFile(new URL("../.agents/plugins/marketplace.json", import.meta.url), "utf8"));
  const source = await readFile(new URL("SKILL.md", skill), "utf8");
  assert.equal(manifest.name, "konpeki");
  assert.equal(marketplace.plugins[0].source.path, "./");
  assert.match(source, /^name: konpeki$/m);
  assert.doesNotMatch(source, /\]\(\.\.\//, "copied skill must not link to missing parent resources");
  for (const prompt of manifest.extensions["com.openai"].interface.defaultPrompt)
    assert.match(prompt, /^Use Konpeki to (create|turn)/);
  assert.equal(await readFile(new URL("../.agents/skills/konpeki/SKILL.md", import.meta.url), "utf8"), source);
});

test("the portable init template matches the editor's canonical blank document", async () => {
  const blank = JSON.parse(await readFile(new URL("assets/blank.json", skill), "utf8"));
  assert.deepEqual(blank, initialDraft(true), "update the portable template when the blank-document contract changes");
  assert.equal(validateComposition(blank).ok, true);
  assert.equal(blank.slides.length, 1);
  assert.deepEqual(blank.slides[0].components, []);
});

test("copied init creates an empty document, reopens without rewriting, and handles concurrent creation", async t => {
  const root = await mkdtemp(join(tmpdir(), "konpeki-init-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const copied = join(root, "installed skill");
  await cp(skill, copied, { recursive: true });
  const script = join(copied, "scripts/prepare-document.mjs");
  const path = join(root, "user project/slides/new page/composition.json");
  const run = (path: string) => spawnSync(process.execPath, [script, cli, path], { encoding: "utf8" });
  const created = run(path);
  assert.equal(created.status, 0, created.stderr);
  assert.deepEqual(JSON.parse(created.stdout), { compositionPath: path, created: true });
  const blank = JSON.parse(await readFile(path, "utf8"));
  assert.equal(blank.title, "Untitled composition");
  assert.equal(blank.slides.length, 1);
  assert.deepEqual(blank.slides[0].components, []);
  assert.deepEqual(await readdir(dirname(path)), ["composition.json"], "init must not create review state or start a listener");

  const example = JSON.parse(await readFile(new URL("../slides/introducing-konpeki/composition.json", import.meta.url), "utf8"));
  const edited = `  ${JSON.stringify({ ...example, title: "Keep my human edits" }, null, 3)}\n\n`;
  const feedback = '{"keep":"my review state"}\n';
  await writeFile(path, edited);
  await writeFile(`${path}.review.json`, feedback);
  const reopened = run(path);
  assert.equal(reopened.status, 0, reopened.stderr);
  assert.deepEqual(JSON.parse(reopened.stdout), { compositionPath: path, created: false });
  assert.equal(await readFile(path, "utf8"), edited, "even formatting must survive init");
  assert.equal(await readFile(`${path}.review.json`, "utf8"), feedback);

  const concurrent = join(root, "concurrent/composition.json");
  const exec = promisify(execFile);
  const results = await Promise.all([0, 1].map(() => exec(process.execPath, [script, cli, concurrent])));
  assert.deepEqual(results.map(result => JSON.parse(result.stdout).created).sort(), [false, true]);
  assert.deepEqual(JSON.parse(await readFile(concurrent, "utf8")), blank);
});

test("init preserves invalid files and orphaned reviews and writes nothing when validation fails", async t => {
  const root = await mkdtemp(join(tmpdir(), "konpeki-init-invalid-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const copied = join(root, "installed skill");
  await cp(skill, copied, { recursive: true });
  const script = join(copied, "scripts/prepare-document.mjs");
  const path = join(root, "composition.json");
  const run = (runtime = cli) => spawnSync(process.execPath, [script, runtime, path], { encoding: "utf8" });
  await writeFile(path, "{broken");
  const invalid = run();
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, "");
  assert.equal(await readFile(path, "utf8"), "{broken");

  await rm(path);
  await writeFile(`${path}.review.json`, "preserve orphaned feedback");
  assert.match(run().stderr, /Review data exists without its composition/);
  assert.equal(await readFile(`${path}.review.json`, "utf8"), "preserve orphaned feedback");
  await assert.rejects(readFile(path), { code: "ENOENT" });
  await rm(`${path}.review.json`);

  assert.equal(run(join(root, "missing-cli.mjs")).status, 1);
  await assert.rejects(readFile(path), { code: "ENOENT" });
  await writeFile(join(copied, "assets/blank.json"), "{}");
  assert.equal(run().status, 1);
  await assert.rejects(readFile(path), { code: "ENOENT" });
});
