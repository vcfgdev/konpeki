import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {assertComposition} from '../../composition/validate.ts';
import {gridSchema, type GridComponent, type GridDocument, type TypeStep} from '../../composition/grid.ts';
import type {Rect} from '../../composition/types.ts';
import type {VectorElement} from '../../composition/types.ts';

// Reproduce the existing mark's alpha silhouette as editable vector geometry.
const mask=execFileSync('magick',[fileURLToPath(new URL('../../src/assets/konpeki-mark.png',import.meta.url)),'-alpha','extract','-threshold','50%','-depth','8','gray:-']);
let outline='';
for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  if(mask[y*128+x]<128)continue;
  const start=x;
  while(x+1<128&&mask[y*128+x+1]>=128)x++;
  outline+=`M${start} ${y}h${x-start+1}v1H${start}Z`;
}
const blue='theme:accent',lightGray='theme:divider';
const text=(id:string,content:string,rect:Rect,step:TypeStep,weight:400|600=600,leading?:number):GridComponent=>({
  id,kind:'text-block',content,slotIds:[`${id}-content`],rect,
  textStyle:{step,weight,leading,color:'ink',font:'heading'},
  appearance:{role:id==='brand'?'title':'body',alignment:'start',border:'none',rule:'none'},
});
const elements:VectorElement[]=[
  {id:'cover-frame',kind:'rect',attributes:{x:10,y:8,width:260,height:140,rx:8,fill:'#ffffff',stroke:blue,'stroke-width':2.5}},
  {id:'cover-mark',kind:'rect',attributes:{x:28,y:28,width:42,height:42,rx:4,fill:blue}},
  {id:'cover-title',kind:'rect',attributes:{x:86,y:29,width:144,height:13,rx:3,fill:lightGray}},
  {id:'cover-copy-1',kind:'rect',attributes:{x:86,y:53,width:112,height:7,rx:3,fill:lightGray}},
  {id:'cover-copy-2',kind:'rect',attributes:{x:28,y:102,width:164,height:7,rx:3,fill:lightGray}},
  {id:'cover-accent',kind:'rect',attributes:{x:211,y:96,width:39,height:28,rx:4,fill:'#eaf6fb'}},
  {id:'square-frame',kind:'rect',attributes:{x:292,y:8,width:140,height:140,rx:8,fill:'#ffffff',stroke:blue,'stroke-width':2.5}},
  {id:'square-title',kind:'rect',attributes:{x:311,y:28,width:82,height:10,rx:3,fill:lightGray}},
  {id:'square-bar-1',kind:'rect',attributes:{x:314,y:93,width:18,height:31,rx:3,fill:blue}},
  {id:'square-bar-2',kind:'rect',attributes:{x:342,y:72,width:18,height:52,rx:3,fill:'#5cb9df'}},
  {id:'square-bar-3',kind:'rect',attributes:{x:370,y:52,width:18,height:72,rx:3,fill:'#9adbed'}},
  {id:'square-baseline',kind:'path',attributes:{d:'M307 126H410',fill:'none',stroke:lightGray,'stroke-width':2}},
  {id:'portrait-frame',kind:'rect',attributes:{x:10,y:172,width:145,height:230,rx:8,fill:'#ffffff',stroke:blue,'stroke-width':2.5}},
  {id:'portrait-title',kind:'rect',attributes:{x:28,y:193,width:94,height:11,rx:3,fill:lightGray}},
  {id:'portrait-visual',kind:'rect',attributes:{x:28,y:224,width:109,height:81,rx:5,fill:'#eaf6fb'}},
  {id:'portrait-rule',kind:'path',attributes:{d:'M45 285L76 247 96 270 122 236',fill:'none',stroke:blue,'stroke-width':4}},
  {id:'portrait-copy-1',kind:'rect',attributes:{x:28,y:326,width:92,height:7,rx:3,fill:lightGray}},
  {id:'portrait-copy-2',kind:'rect',attributes:{x:28,y:344,width:108,height:7,rx:3,fill:lightGray}},
  {id:'portrait-copy-3',kind:'rect',attributes:{x:28,y:362,width:74,height:7,rx:3,fill:lightGray}},
  {id:'slide-frame',kind:'rect',attributes:{x:180,y:172,width:252,height:144,rx:8,fill:'#ffffff',stroke:blue,'stroke-width':2.5}},
  {id:'slide-title',kind:'rect',attributes:{x:199,y:190,width:115,height:11,rx:3,fill:lightGray}},
  {id:'diagram-path',kind:'path',attributes:{d:'M305 251V270H231V278M305 270H379V278',fill:'none',stroke:lightGray,'stroke-width':3}},
  {id:'diagram-parent',kind:'rect',attributes:{x:284,y:215,width:42,height:36,rx:7,fill:blue}},
  {id:'diagram-child-1',kind:'rect',attributes:{x:210,y:278,width:42,height:25,rx:6,fill:'#eaf6fb',stroke:blue,'stroke-width':2}},
  {id:'diagram-child-2',kind:'rect',attributes:{x:358,y:278,width:42,height:25,rx:6,fill:'#eaf6fb',stroke:blue,'stroke-width':2}},
  {id:'table-frame',kind:'rect',attributes:{x:180,y:338,width:252,height:64,rx:8,fill:'#ffffff',stroke:blue,'stroke-width':2.5}},
  {id:'table-header',kind:'rect',attributes:{x:181,y:339,width:250,height:20,rx:7,fill:'#eaf6fb'}},
  {id:'table-grid',kind:'path',attributes:{d:'M250 339V401M330 339V401M181 359H431M181 380H431',fill:'none',stroke:lightGray,'stroke-width':2}},
  {id:'table-emphasis',kind:'rect',attributes:{x:196,y:365,width:38,height:8,rx:3,fill:blue}},
];
// Keep the existing editable illustrations, with colors owned by the theme.
for(const element of elements)for(const key of ['fill','stroke']){
  const value=element.attributes[key];
  if(value==='#ffffff')element.attributes[key]='theme:background';
  if(value==='#eaf6fb'||value==='#9adbed')element.attributes[key]='theme:wash';
  if(value==='#5cb9df')element.attributes[key]='theme:muted';
}
const components:GridComponent[]=[
  text('brand','Konpeki',{x:48,y:227,width:540,height:88},'display',600,80),
  {id:'brand-mark',kind:'image',slotIds:['brand-mark-content'],rect:{x:48,y:155,width:540,height:64},customVisual:{format:'vector',alignment:'start',viewBox:{x:0,y:0,width:128,height:128},description:'Konpeki blue brush mark',elements:[{id:'mark-silhouette',kind:'path',attributes:{d:outline,fill:blue}}]}},
  text('promise','Create clear visuals',{x:48,y:363,width:540,height:56},'heading'),
  text('audience','with your coding agent.',{x:48,y:419,width:540,height:48},'lead',400),
  {id:'visual-family',kind:'image',slotIds:['visual-family-content'],rect:{x:612,y:83,width:540,height:464},customVisual:{format:'vector',viewBox:{x:0,y:0,width:444,height:412},description:'Aligned white canvases using Konpeki text, image, bar chart, line chart, diagram and table components.',elements}},
];
const document:GridDocument={schema:gridSchema,title:'Konpeki GitHub cover',authoringMode:'default',theme:{id:'plex',mode:'paper'},pages:[{
  id:'github-cover',name:'GitHub repository cover',preset:'link',canvas:{width:1200,height:630},innerPadding:{top:51,right:48,bottom:51,left:48},pageNumber:{style:'none',color:'muted'},
  audience:'Developers discovering Konpeki on GitHub',question:'What can I create with Konpeki and my coding agent?',intendedViewingSize:'social',components,
  contentSlots:components.map(c=>({id:c.slotIds[0],label:c.id,role:'body',required:true,instruction:c.kind==='text-block'?c.content??'':c.customVisual?.description??''})),
  groups:[{id:'brand-stack',childIds:['brand-mark','brand','promise','audience'],rect:{x:48,y:51,width:540,height:528},verticalAlignment:'center'}],
  relationships:[],readingOrder:components.map(c=>({kind:'component',id:c.id})),paintOrder:components.map(c=>c.id),
}]};
assertComposition(document);
writeFileSync(new URL('composition.json',import.meta.url),JSON.stringify(document,null,2)+'\n');
