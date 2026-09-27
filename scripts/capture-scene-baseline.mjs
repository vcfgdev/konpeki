// Reconstructs the pre-HarfBuzz browser baseline from the five checked-in gallery
// documents (11 pages total). Run while the legacy Canvas renderer is active:
//   node scripts/capture-scene-baseline.mjs [http://localhost:4318] [output.json]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [base = "http://localhost:4318", output = "composition/fixtures/text-layout-browser-baseline.json"] = process.argv.slice(2);
const files = ["architecture", "sankey", "release", "explainer", "intro"].map(name => ({
  name,
  path: resolve(name === "intro" ? "slides/introducing-konpeki/composition.json" : `slides/gallery/${name}.json`),
}));
const b = (...args) => execFileSync("agent-browser", ["--session", "text-baseline", ...args], { encoding: "utf8", maxBuffer: 32 << 20 }).trim();
const click = name => b("find", "role", "button", "click", "--name", name, "--exact");
const pages = [];
try {
  b("open", base);
  b("set", "viewport", "1920", "1080", "2");
  b("wait", ".canvas");
  for (const file of files) {
    const document = JSON.parse(readFileSync(file.path, "utf8"));
    b("upload", 'input[type="file"]', file.path);
    b("wait", "--fn", `document.querySelector('.document-title input')?.value === ${JSON.stringify(document.title)}`);
    click("Present");
    b("focus", ".presentation"); b("press", "Home");
    for (let page = 0; page < document.slides.length; page++) {
      const pageWidth = document.slides[page].canvas?.width ?? ({ presentation: 1920, portrait: 1080, link: 1200, square: 1080, article: 1600, explainer: 1200, gallery: 1600 })[document.slides[page].grid?.preset];
      b("eval", "document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))");
      const measured = JSON.parse(b("eval", `(() => {
        const canvas=document.querySelector('.presentation .canvas'), cb=canvas.getBoundingClientRect(), scale=cb.width/${pageWidth};
        const round=n=>Math.round(n*1000)/1000;
        const texts=[...canvas.querySelectorAll('.text-block-content')].map(el=>{
          const s=getComputedStyle(el), value=el.textContent??'', lines=[];
          let start=0,top; for(let i=0;i<value.length;i++){const range=document.createRange();range.setStart(el.firstChild??el,i);range.setEnd(el.firstChild??el,i+1);const next=range.getClientRects()[0]?.top;
            if(value[i]==='\\n'){lines.push({text:value.slice(start,i),start,end:i,top:round((top-cb.top)/scale)});start=i+1;top=undefined;continue}
            if(top!==undefined&&next!==top){lines.push({text:value.slice(start,i),start,end:i,top:round((top-cb.top)/scale)});start=i} top=next;
          } lines.push({text:value.slice(start),start,end:value.length,top:round(((top??el.getBoundingClientRect().top)-cb.top)/scale)});
          return {id:el.closest('[data-component]')?.dataset.component,text:value,fontFamily:s.fontFamily,fontWeight:s.fontWeight,fontStyle:s.fontStyle,fontSize:round(parseFloat(s.fontSize)/scale),lineHeight:round(parseFloat(s.lineHeight)/scale),lines};
        });
        const labels=[...canvas.querySelectorAll('svg text')].map(el=>{const s=getComputedStyle(el),m=el.getScreenCTM(),p=new DOMPoint(0,Number(el.getAttribute('y')??0)).matrixTransform(m);return {id:el.dataset.vectorElement??null,text:el.textContent??'',baseline:round((p.y-cb.top)/scale),fontFamily:s.fontFamily,fontWeight:s.fontWeight,fontStyle:s.fontStyle,fontSize:round(parseFloat(s.fontSize)*Math.hypot(m.c,m.d)/scale)};});
        return {texts,labels};
      })()`));
      pages.push({document:file.name,page:page+1,slideId:document.slides[page].id,...measured});
      if (page + 1 < document.slides.length) click("Next page");
    }
    click("Exit");
  }
  writeFileSync(resolve(output), JSON.stringify({kind:"reconstructed-browser-baseline",capturedAt:new Date().toISOString(),engine:"Chromium",devicePixelRatio:2,source:"Five checked-in gallery documents; the referenced 3,719-layout dataset was not supplied.",pages},null,2)+"\n");
  console.log(`Captured ${pages.length} pages, ${pages.reduce((n,p)=>n+p.texts.length,0)} text blocks, ${pages.reduce((n,p)=>n+p.labels.length,0)} SVG labels.`);
} finally { b("close"); }
