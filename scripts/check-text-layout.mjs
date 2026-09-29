// Reconstructed Chromium comparison (the referenced 3,719-case fixture was not supplied).
// The fixture currently contains 45 focused cases, including layout-unit edges.
// Requires the supervised app, whose CSS loads the same Fontsource faces:
//   node scripts/check-text-layout.mjs [http://localhost:4318]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { loadNodeFontContext } from "../composition/fonts.ts";
import { layoutText } from "../composition/text-layout.ts";

const base = process.argv[2] ?? "http://localhost:4318";
const cases = JSON.parse(readFileSync(new URL("../composition/fixtures/text-layout-cases.json", import.meta.url)));
const context = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
const manifest = JSON.parse(readFileSync(new URL("../fonts/manifest.json", import.meta.url)));
const b = (...args) => execFileSync("agent-browser", ["--session", "text-layout-check", ...args], { encoding: "utf8", maxBuffer: 16 << 20 }).trim();
try {
  b("open", new URL("legacy.html", base).href); b("set", "viewport", "1280", "720", "2"); b("wait", ".canvas");
  const browser = JSON.parse(b("eval", `(() => { const cases=${JSON.stringify(cases)},fonts=${JSON.stringify(manifest.fonts)};
    const style=document.head.appendChild(document.createElement('style'));style.textContent=fonts.map(f=>'@font-face{font-family:"'+f.family+'";font-style:'+f.style+';font-weight:'+f.weight+';src:url("/fonts/'+f.file+'") format("truetype")}').join('');
    return Promise.all(fonts.map(f=>document.fonts.load(f.style+' '+f.weight+' 20px "'+f.family+'"'))).then(() => {
    const host=document.body.appendChild(document.createElement('div'));
    host.style.cssText='position:fixed;left:-10000px;top:0';
    const results=cases.map(c=>{const el=host.appendChild(document.createElement('div')); el.textContent=c.text;
      el.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;width:'+c.width+'px;font: '+(c.style==='italic'?'italic ':'')+(c.weight??400)+' 20px/28px "'+(c.family??'IBM Plex Sans')+'","Noto Sans Symbols 2","Noto Sans Symbols";text-align:'+(c.align??'left');
      if(c.wrap==='no-wrap') el.style.whiteSpace='pre';
      const node=el.firstChild,lines=[];let start=0,top;for(let i=0;i<c.text.length;i++){const ch=c.text[i];
        if(ch==='\\r'||ch==='\\n'){lines.push(c.text.slice(start,i));if(ch==='\\r'&&c.text[i+1]==='\\n')i++;start=i+1;top=undefined;continue}
        const r=document.createRange();r.setStart(node,i);r.setEnd(node,i+1);const next=r.getClientRects()[0]?.top;
        if(top!==undefined&&next!==top){lines.push(c.text.slice(start,i));start=i}top=next}lines.push(c.text.slice(start));el.remove();return lines;});
    // A zero-height inline box's top is the browser's baseline. This is an
    // independent measurement, not a re-evaluation of our baseline formula.
    const metrics=fonts.flatMap(f=>[[20,28],[44,52],[76,84]].map(([size,leading])=>{
      const line=host.appendChild(document.createElement('div'));line.style.cssText='font:'+f.style+' '+f.weight+' '+size+'px/'+leading+'px "'+f.family+'";height:'+leading+'px';
      const marker=line.appendChild(document.createElement('span'));marker.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';
      const baseline=marker.getBoundingClientRect().top-line.getBoundingClientRect().top;line.remove();return{id:f.id,size,leading,baseline};
    }));host.remove();return{lines:results,metrics};
  })})()`));
  const lineBreakFailures=[];
  cases.forEach((fixture,index)=>{
    const result=layoutText(context,{text:fixture.text,width:fixture.width,fontFamily:fixture.family??"IBM Plex Sans",fontSize:20,lineHeight:28,fontWeight:fixture.weight,fontStyle:fixture.style,align:fixture.align,wrap:fixture.wrap,overflowWrap:"anywhere"});
    const actual=result.lines.map(line=>line.text);
    if(JSON.stringify(actual)!==JSON.stringify(browser.lines[index])) lineBreakFailures.push({name:fixture.name,chromium:browser.lines[index],harfbuzz:actual});
  });
  const baselineDifferences=[];
  for(const measured of browser.metrics){
    const font=context.fonts.get(measured.id);
    const baseline=(measured.leading-(font.ascent+font.descent)*measured.size)/2+font.ascent*measured.size;
    const difference=Math.abs(baseline-measured.baseline);
    if(difference>0.5) baselineDifferences.push({name:measured.id,size:measured.size,chromiumBaseline:measured.baseline,sceneBaseline:baseline,difference});
  }
  // Blink FontMetrics::AscentDescentWithHacks rounds ascent/descent independently;
  // core/layout/inline/line_utils.cc CalculateLeadingSpace floors half-leading.
  // Keep the fractional scene formula. Only these captured cases are exceptions;
  // a new font/size or a changed Chromium position must fail, even below 1px.
  const exceptions=new Map([
    ...[400,500,600].flatMap(weight=>["normal","italic"].map(style=>[`noto-sans-latin-${weight}-${style}/20`,21])),
    ["noto-sans-symbols-2-400-normal/44",35],
    ["noto-sans-symbols-2-400-normal/76",58],
    ["noto-sans-symbols-400-normal/76",76],
  ]);
  const known=item=>exceptions.get(`${item.name}/${item.size}`)===item.chromiumBaseline&&item.difference<1;
  const acceptedBaselineExceptions=baselineDifferences.filter(known);
  const baselineFailures=baselineDifferences.filter(item=>!known(item));
  console.log(JSON.stringify({
    lineBreaks:{checks:cases.length,passed:cases.length-lineBreakFailures.length,failures:lineBreakFailures},
    baselines:{checks:browser.metrics.length,tolerancePx:0.5,passed:browser.metrics.length-baselineDifferences.length,
      acceptedExceptions:acceptedBaselineExceptions.length,exceptionReason:"Chromium pixel-snaps inline line-box baselines; formula values remain fractional OpenType metrics",failures:baselineFailures},
    acceptedBaselineExceptions
  },null,2));
  if(lineBreakFailures.length||baselineFailures.length) process.exitCode=1;
} finally { b("close"); }
