import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const [url, out, pages = "7", session = "intro-rebuild"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = (...a) => execFileSync("agent-browser", ["--session", session, ...a], { encoding: "utf8" }).trim();
const check = `(() => { const bad=[];
  for (const c of document.querySelectorAll('.presentation [data-component]')) {
    const svg = c.querySelector('.custom-vector-art');
    if (!svg) { const t=c.querySelector('.text-block-content'); if (t && (t.scrollHeight>c.clientHeight+1||t.scrollWidth>c.clientWidth+1)) bad.push('overflow '+c.dataset.component+' '+t.scrollHeight+'>'+c.clientHeight); continue; }
    const v=svg.viewBox.baseVal; for (const t of svg.querySelectorAll('text')) { const x=t.getBBox(); if (x.x<-1||x.y<-1||x.x+x.width>v.width+1||x.y+x.height>v.height+1) bad.push('clip '+t.textContent); } }
  return bad.length? bad.join('; ') : 'ok'; })()`;
const settle = "document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))";
try {
  b("open", url); b("set", "viewport", "1600", "1000");
  b("wait", "2000"); b("eval", settle); b("screenshot", `${out}/editor.png`);
  b("find", "role", "button", "click", "--name", "Present", "--exact");
  for (const [w, h, p] of [[1920, 1080, "slide"], [1024, 768, "review"]]) {
    b("set", "viewport", String(w), String(h)); b("focus", ".presentation"); b("press", "Home");
    for (let i = 1; i <= +pages; i++) {
      b("eval", settle);
      console.log(`${w}x${h} p${i}: ${b("eval", check)}`);
      b("screenshot", ".presentation .canvas", `${out}/${p}-${i}.png`);
      if (i < +pages) b("find", "role", "button", "click", "--name", "Next page", "--exact");
    }
  }
} finally { b("close"); }
