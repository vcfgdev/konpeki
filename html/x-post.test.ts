import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { browserDocument } from "./browser.ts";
import { documentServer } from "./server.ts";
import { inspectHTMLPage } from "./inspect.ts";
import { writeTestTheme } from "../scripts/test-fonts.ts";

const starter = await readFile(new URL("../skills/konpeki/assets/x-post.html", import.meta.url), "utf8");
const withMedia = starter.replace(/<!-- Optional[\s\S]*?-->/g, block => block.slice(block.indexOf("<", 4), -3))
  .replace("avatar.jpg", "avatar.svg").replace("attachment.png", "attachment.svg")
  .replace('<span id="post-published">Publish date and time</span>', '<time id="post-published" datetime="2026-09-29T19:05:00+02:00">7:05 PM · Sep 29, 2026 (UTC+02:00)</time>')
  .replace(">View count</strong>", ">0</strong>")
  .replace("Your post text goes here. Keep paragraphs, links, and the details that matter.", "A complete image, including its edges.");

test("post starter exports text and local media in both appearances with stable review targets", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-post-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeTestTheme(dir);
  await writeFile(join(dir, "avatar.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="#2458b8"/></svg>');
  await writeFile(join(dir, "attachment.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300"><rect width="800" height="300" fill="#2458b8"/><rect x="4" y="4" width="792" height="292" fill="none" stroke="#fff" stroke-width="8"/></svg>');
  const file = join(dir, "post.html");
  for (const [variant, source] of [["text", starter], ["media", withMedia]]) {
    for (const appearance of ["light", "dark"]) {
      await writeFile(file, source.replace('data-appearance="light"', `data-appearance="${appearance}"`));
      const { report, bytes } = await browserDocument(file, { format: "png", scale: 2 });
      assert.deepEqual(report.diagnostics, [], `${variant}/${appearance}`);
      const png = Buffer.from(bytes!);
      assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [2400, 1260]);
      const ids = report.pages[0].blocks.map(block => block.id);
      for (const id of ["post-name", "post-handle", "post-platform", "post-body", ...(variant === "media" ? ["post-avatar", "post-image", "post-published", "post-view-count", "post-source-link"] : [])])
        assert(ids.includes(id), `Missing review target: ${id}`);
      if (variant === "text") assert(!ids.includes("post-published") && !ids.includes("post-view-count"), "unknown metadata stays absent");
    }
  }
});

test("post styling is explicit, wraps long content, and contains rather than crops media", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-post-layout-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeTestTheme(dir);
  // Inline assets isolate layout from resource loading; both have asymmetric dimensions.
  const image = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="720" height="280"%3E%3Crect width="720" height="280" fill="blue"/%3E%3C/svg%3E';
  const file = join(dir, "post.html");
  await writeFile(file, withMedia.replaceAll('src="avatar.svg"', `src='${image}'`).replaceAll('src="attachment.svg"', `src='${image}'`));
  const browser = await chromium.launch(); t.after(() => browser.close());
  const server = await documentServer(file); t.after(() => server.close());
  const tab = await browser.newPage();
  await tab.goto(`${server.origin}${server.prefix}/document/`);
  await tab.evaluate(() => document.fonts.ready);
  const page = tab.locator("[data-page]");
  const shortHeader = (await tab.locator("#post-author").boundingBox())!;
  const shortLogo = (await tab.getByRole("img", { name: "X", exact: true }).boundingBox())!;
  assert.equal(shortLogo.y + shortLogo.height / 2, shortHeader.y + shortHeader.height / 2, "logo centers in the avatar-height header");
  for (const appearance of ["light", "dark"]) {
    await page.evaluate((page, appearance) => page.setAttribute("data-appearance", appearance), appearance);
    for (const colorScheme of ["light", "dark"] as const) {
      await tab.emulateMedia({ colorScheme });
      assert.deepEqual(await page.evaluate(page => [getComputedStyle(page).backgroundColor, getComputedStyle(page.querySelector("#post-body")!).color]),
        appearance === "light" ? ["rgb(255, 255, 255)", "rgb(17, 17, 17)"] : ["rgb(0, 0, 0)", "rgb(242, 242, 242)"]);
      assert.equal(await tab.getByRole("img", { name: "X", exact: true }).evaluate(el => getComputedStyle(el).fill),
        appearance === "light" ? "rgb(17, 17, 17)" : "rgb(242, 242, 242)");
      assert.equal(await tab.locator("#post-view-count").evaluate(el => getComputedStyle(el).color),
        appearance === "light" ? "rgb(17, 17, 17)" : "rgb(242, 242, 242)");
      assert.equal(await tab.locator("#post-published").evaluate(el => getComputedStyle(el).color),
        appearance === "light" ? "rgb(83, 100, 113)" : "rgb(160, 170, 180)");
    }
  }
  const media = await tab.locator("#post-image").evaluate(el => {
    const image = el as HTMLImageElement, style = getComputedStyle(image), box = image.getBoundingClientRect();
    return { fit: style.objectFit, natural: [image.naturalWidth, image.naturalHeight], width: box.width, height: box.height };
  });
  assert.equal(media.fit, "contain"); assert.deepEqual(media.natural, [720, 280]);
  assert.equal(media.width, 1104); assert(media.height >= 160);
  assert.equal(await tab.locator("#post-published").getAttribute("datetime"), "2026-09-29T19:05:00+02:00");
  assert.equal(await tab.locator("#post-published").innerText(), "7:05 PM · Sep 29, 2026 (UTC+02:00)");
  assert.equal(await tab.locator("#post-views").innerText(), "0 views", "a known zero is not missing metadata");
  await tab.locator("#post-media").evaluate(el => el.remove());
  await tab.locator("#post-name").evaluate(el => { el.textContent = "A deliberately long author name that must wrap without an ellipsis or clipping"; });
  await tab.locator("#post-body").evaluate(el => { el.innerHTML = 'A paragraph with an <a id="post-link" href="https://example.com">actual link</a>.'; });
  await tab.locator("#post-text").evaluate(el => { el.insertAdjacentHTML("beforeend", '<p id="post-second">A second paragraph, with café and naïve intact.</p>'); });
  assert.equal(await tab.locator("#post-link").getAttribute("href"), "https://example.com");
  assert((await tab.locator("#post-name").boundingBox())!.height > 40, "long author name wraps");
  for (const [size, width, height] of [["link", 1200, 630], ["square", 1080, 1080], ["portrait", 1080, 1350]] as const) {
    await page.evaluate((page, size) => page.setAttribute("data-size", size), size);
    const report = await page.evaluate(inspectHTMLPage);
    assert.deepEqual(report.diagnostics, [], size);
    assert.deepEqual([report.width, report.height], [width, height]);
    assert.equal(await tab.locator("#post-body").evaluate(el => getComputedStyle(el).fontSize), "44px", "larger canvases do not shrink text");
    const header = (await tab.locator("#post-author").boundingBox())!;
    const logo = (await tab.getByRole("img", { name: "X", exact: true }).boundingBox())!;
    const identity = (await tab.locator("#post-identity").boundingBox())!;
    assert.deepEqual([logo.width, logo.height, logo.y + logo.height / 2, logo.x + logo.width], [40, 40, header.y + header.height / 2, header.x + header.width]);
    assert(identity.x + identity.width <= logo.x - 24, "wrapped names leave space for the logo");
  }
  const name = await tab.locator("#post-name").evaluate(el => {
    const s = getComputedStyle(el); return [s.overflow, s.textOverflow, s.webkitLineClamp];
  });
  assert.deepEqual(name, ["visible", "clip", "none"]);
  await tab.locator("#post-name").evaluate(el => { el.textContent = "Author"; });
  await page.evaluate(el => { el.style.setProperty("--kp-page-width", "600px"); el.style.setProperty("--kp-page-height", "900px"); });
  assert.deepEqual((await page.evaluate(inspectHTMLPage)).diagnostics, [], "custom dimensions with wrapped metadata");
  const published = (await tab.locator("#post-published").boundingBox())!;
  const views = (await tab.locator("#post-views").boundingBox())!;
  assert(views.y >= published.y + published.height, "metadata wraps without truncating its timestamp");
  assert.equal(await tab.locator("#post-views").evaluate(el => getComputedStyle(el, "::before").content), '"·"');
  await tab.locator("#post-published").evaluate(el => el.remove());
  assert.equal(await tab.locator("#post-views").evaluate(el => getComputedStyle(el, "::before").content), "none", "no orphan separator when the date is unknown");
  await tab.locator("#post-views").evaluate(el => el.remove());
  assert.deepEqual((await page.evaluate(inspectHTMLPage)).diagnostics, [], "source-only footer remains valid");
});

test("excess post copy is reported and CLI export leaves no clipped image", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-post-overflow-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeTestTheme(dir);
  const file = join(dir, "post.html"), output = join(dir, "post.png");
  await writeFile(file, starter.replace("Your post text goes here.", "Required copy must stay visible. ".repeat(40)));
  const { report } = await browserDocument(file);
  assert.equal(report.ok, false);
  assert(report.diagnostics.some(d => d.code === "page-overflow" && d.target === "post-body"));
  assert.throws(() => execFileSync(process.execPath, [join(import.meta.dirname, "../bin/konpeki.mjs"), "render", file, "--output", output], { stdio: "pipe" }), /failed|refused|overflow/i);
  await assert.rejects(readFile(output), /ENOENT/);
});
