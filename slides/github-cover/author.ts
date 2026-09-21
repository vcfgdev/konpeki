import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {assertComposition} from '../../composition/validate.ts';
import {compositionSchema, type CompositionComponent, type CompositionDocument, type VectorElement} from '../../composition/types.ts';

// Reproduce the existing mark's alpha silhouette as editable vector geometry.
const mask=execFileSync('magick',[fileURLToPath(new URL('../../src/assets/konpeki-mark.png',import.meta.url)),'-alpha','extract','-threshold','50%','-depth','8','gray:-']);
let outline='';
for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  if(mask[y*128+x]<128)continue;
  const start=x;
  while(x+1<128&&mask[y*128+x+1]>=128)x++;
  outline+=`M${start} ${y}h${x-start+1}v1H${start}Z`;
}
const ink='#202630',blue='#007fb5';
const text=(id:string,content:string,x:number,y:number,width:number,height:number,size:number,weight:400|600=600):CompositionComponent=>({
  id,kind:'text-block',content,slotIds:[`${id}-content`],preferredRect:{x,y,width,height},
  textStyle:{size,weight,lineHeight:1.18,color:'ink',font:'heading'},
  appearance:{role:id==='brand'?'title':'body',alignment:'start',border:'none',rule:'none'},
});
const elements:VectorElement[]=[
  {id:'intent-build',kind:'path',attributes:{d:'M202 74H239Q261 74 261 96V178',fill:'none',stroke:blue,'stroke-width':3}},
  {id:'build-refine',kind:'path',attributes:{d:'M316 215H352Q376 215 376 239V325',fill:'none',stroke:blue,'stroke-width':3}},
];
for(const [id,label,x,y,width] of [['intent','Intent',12,38,190],['build','Build',132,179,184],['refine','Refine',250,326,184]] as const){
  elements.push({id:`${id}-shape`,kind:'rect',attributes:{x,y,width,height:72,rx:18,fill:id==='refine'?'#eaf6fb':'#ffffff',stroke:blue,'stroke-width':2.5}});
  elements.push({id:`${id}-label`,kind:'text',text:label,attributes:{x:x+width/2,y:y+46,'text-anchor':'middle','font-family':'theme:heading-font','font-size':28,'font-weight':500,fill:ink}});
}
for(const [i,x,y] of [[0,245,321],[1,429,321],[2,245,393],[3,429,393]])elements.push({id:`edit-handle-${i}`,kind:'rect',attributes:{x,y,width:10,height:10,fill:'#ffffff',stroke:blue,'stroke-width':2}});
const components:CompositionComponent[]=[
  text('brand','Konpeki',150,120,480,110,84),
  {id:'brand-mark',kind:'image',slotIds:['brand-mark-content'],preferredRect:{x:64,y:143,width:66,height:66},customVisual:{format:'vector',viewBox:{x:0,y:0,width:128,height:128},description:'Konpeki blue brush mark',elements:[{id:'mark-silhouette',kind:'path',attributes:{d:outline,fill:blue}}]}},
  text('promise','A shared canvas.',64,302,680,90,62),
  text('audience','For you and your agents.',64,400,660,76,44,400),
  {id:'workflow',kind:'diagram',slotIds:['workflow-content'],preferredRect:{x:772,y:116,width:444,height:412},appearance:{type:'flowchart',selection:'explicit',border:'none'},customVisual:{format:'vector',viewBox:{x:0,y:0,width:444,height:412},description:'Intent connects to Build, then Refine; selection handles on Refine express editable output.',elements}},
];
const document:CompositionDocument={schema:compositionSchema,title:'Konpeki GitHub cover',authoringMode:'default',theme:{id:'plex',mode:'paper'},slides:[{
  id:'github-cover',name:'GitHub repository cover',canvas:{width:1280,height:640},innerPadding:{top:64,right:64,bottom:64,left:64},pageNumber:{style:'none',color:'muted'},
  audience:'Developers discovering Konpeki on GitHub',question:'What is Konpeki?',intendedViewingSize:'social',components,
  contentSlots:components.map(c=>({id:c.slotIds[0],label:c.id,role:'body',required:true,instruction:c.kind==='text-block'?c.content??'':c.customVisual?.description??''})),
  groups:[],relationships:[],readingOrder:components.map(c=>({kind:'component',id:c.id})),paintOrder:components.map(c=>c.id),
}]};
assertComposition(document);
writeFileSync(new URL('composition.json',import.meta.url),JSON.stringify(document,null,2)+'\n');
