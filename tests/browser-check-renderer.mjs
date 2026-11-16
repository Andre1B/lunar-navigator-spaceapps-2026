// Hardware-only check for the adaptive draw loop. Not part of `npm test`.
// Run against the current local preview, without forcing SwiftShader:
//   QA_URL=http://localhost:4173 QA_GPU=hardware node tests/browser-check-renderer.mjs
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const BASE=(process.env.QA_URL||'http://localhost:4173').replace(/\/$/,'');
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(ROOT,'..','tmp','lunar-renderer-hardware');
mkdirSync(OUT,{recursive:true});
const errors=[];
const targets=[{width:1440,height:900,touch:false,cap:120},{width:844,height:390,touch:true,cap:60}];
async function launch(){
  const exe='C:/Program Files/Google/Chrome/Application/chrome.exe';
  for(const o of [{channel:'chrome',headless:true,args:[]},...(existsSync(exe)?[{executablePath:exe,headless:true,args:[]}]:[]),{headless:true,args:[]}])try{return await chromium.launch(o);}catch{}
  throw new Error('Chrome/Chromium could not be launched');
}
const browser=await launch();
console.log('browser',browser.version(),'base',BASE,'args=[] (no SwiftShader override)');
const reports=[];
for(const target of targets){
  const context=await browser.newContext({viewport:{width:target.width,height:target.height},isMobile:target.touch,hasTouch:target.touch,deviceScaleFactor:target.touch?2:1,reducedMotion:'no-preference'});
  await context.addInitScript(()=>sessionStorage.setItem('lunar-opening-v1','seen'));
  const page=await context.newPage();
  page.on('console',m=>{if(m.type()==='error')errors.push({viewport:`${target.width}x${target.height}`,kind:'console',text:m.text().slice(0,240)});});
  page.on('pageerror',e=>errors.push({viewport:`${target.width}x${target.height}`,kind:'page',text:String(e).slice(0,240)}));
  page.on('response',r=>{if(r.status()>=400)errors.push({viewport:`${target.width}x${target.height}`,kind:'http',status:r.status(),url:r.url()});});
  await page.goto(`${BASE}/?qa=1#/simulator`,{waitUntil:'networkidle',timeout:60000});
  const opening=page.getByRole('dialog',{name:'Lunacline'});if(await opening.count())await opening.waitFor({state:'hidden',timeout:5000});
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.(),null,{timeout:30000});
  if(await page.getByRole('button',{name:'Pause',exact:true}).isVisible())await page.getByRole('button',{name:'Pause',exact:true}).click();
  if(target.width<=720){
    if(!await page.locator('#explorer-view').isVisible())await page.locator('.setup-toggle').click();
    await page.locator('#explorer-view').selectOption('terrain');
  }else await page.locator('.camera-presets button').filter({hasText:'Local terrain'}).click();
  await page.waitForFunction(()=>{const r=document.querySelector('canvas')?.lunarSnapshot?.().rendered;return r?.ready===true&&r.view==='terrain';},null,{timeout:30000});
  await page.waitForTimeout(700);
  const hardware=await page.evaluate(()=>{
    const canvas=document.querySelector('canvas');let gl=null;
    try{gl=canvas?.getContext('webgl2')??canvas?.getContext('webgl');}catch{}
    const ext=gl?.getExtension('WEBGL_debug_renderer_info');
    return{vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl?.getParameter(gl.VENDOR)??null,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER)??null,version:gl?.getParameter(gl.VERSION)??null,viewport:{width:innerWidth,height:innerHeight},dpr:devicePixelRatio};
  });
  if(!await page.getByRole('button',{name:'Play',exact:true}).isVisible())throw new Error(`${target.width}x${target.height}: expected paused state before controlled render sample`);
  const startingSerial=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.serial??0);
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.waitForFunction(s=>{
    const c=document.querySelector('canvas')?.lunarSnapshot?.(),status=document.querySelector('.playback-status')?.textContent?.trim()??'';
    return c?.rendered?.ready&&c.rendered.serial>s&&/^Playing\b/.test(status);
  },startingSerial,{timeout:8000});
  await page.waitForTimeout(250);
  await page.evaluate(()=>{
    const trace={raf:[],draws:[]};window.__qaRenderCadence=trace;let previous=-1;
    const sample=()=>{
      const at=performance.now(),s=document.querySelector('canvas')?.lunarSnapshot?.(),r=s?.rendered;trace.raf.push(at);
      if(r&&r.serial!==previous){previous=r.serial;trace.draws.push({sampleAt:at,serial:r.serial,frameTimeMs:r.frameTimeMs,renderScale:r.renderScale,terrainDetail:r.terrainDetail,drawCalls:r.drawCalls,triangles:r.triangles,fpsLimit:r.fpsLimit,ready:r.ready,view:r.view});}
      window.__qaRenderCadence.rafId=requestAnimationFrame(sample);
    };trace.rafId=requestAnimationFrame(sample);
  });
  await page.waitForTimeout(4200);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const raw=await page.evaluate(()=>{cancelAnimationFrame(window.__qaRenderCadence?.rafId);return window.__qaRenderCadence;});
  const rafIntervals=raw.raf.slice(1).map((t,i)=>t-raw.raf[i]).sort((a,b)=>a-b);
  const drawIntervals=raw.draws.slice(1).map((f,i)=>f.frameTimeMs-raw.draws[i].frameTimeMs).filter(Number.isFinite).sort((a,b)=>a-b);
  const median=x=>x.length?+x[Math.floor(x.length/2)].toFixed(3):null;
  const elapsed=raw.draws.length>1?raw.draws.at(-1).frameTimeMs-raw.draws[0].frameTimeMs:0;
  const stats={viewport:`${target.width}x${target.height}`,touch:target.touch,hardware,rafSamples:raw.raf.length,rafMedianMs:median(rafIntervals),rafRateHz:rafIntervals.length?+(1000/median(rafIntervals)).toFixed(1):null,drawFrames:raw.draws.length,drawMedianMs:median(drawIntervals),drawRateHz:drawIntervals.length?+(1000/median(drawIntervals)).toFixed(1):null,drawAverageHz:elapsed>0?+((raw.draws.length-1)*1000/elapsed).toFixed(1):null,fpsCap:raw.draws.at(-1)?.fpsLimit,renderScale:raw.draws.at(-1)?.renderScale,terrainDetail:raw.draws.at(-1)?.terrainDetail,drawCalls:raw.draws.at(-1)?.drawCalls,triangles:raw.draws.at(-1)?.triangles,frames:raw.draws};
  reports.push(stats);console.log('RENDER-CADENCE',JSON.stringify({...stats,frames:`${stats.drawFrames} (raw samples stored in results)`}));
  const identity=String(hardware.renderer??'');
  if(!identity||/swiftshader|llvmpipe|softpipe|software raster/i.test(identity))errors.push({viewport:stats.viewport,kind:'renderer-not-hardware',renderer:identity||'unavailable'});
  if(raw.draws.length<30||!drawIntervals.length)errors.push({viewport:stats.viewport,kind:'insufficient-draw-samples',count:raw.draws.length});
  if(stats.fpsCap!==target.cap)errors.push({viewport:stats.viewport,kind:'wrong-fps-cap',expected:target.cap,actual:stats.fpsCap});
  if(stats.renderScale!==1||stats.terrainDetail!=='full')errors.push({viewport:stats.viewport,kind:'adaptive-quality-dropped-on-fast-hardware',renderScale:stats.renderScale,terrainDetail:stats.terrainDetail});
  if(!(stats.drawAverageHz>=target.cap*0.9&&stats.drawAverageHz<=target.cap*1.05))errors.push({viewport:stats.viewport,kind:'average-draw-rate-outside-target-band',measured:stats.drawAverageHz,medianIntervalRate:stats.drawRateHz,cap:target.cap});
  // The 5 m near-field mesh is visual only. Its upload/morph must leave the
  // observation at this exact paused sample unchanged from the 40 m terrain view.
  const beforeNear=await page.evaluate(()=>{const s=document.querySelector('canvas')?.lunarSnapshot?.();return{index:s?.index,observation:s?.observation};});
  if(target.width<=720){
    if(!await page.locator('#explorer-view').isVisible())await page.locator('.setup-toggle').click();
    await page.locator('#explorer-view').selectOption('sky');
  }else await page.locator('.camera-presets button').filter({hasText:'Surface sky'}).click();
  await page.waitForFunction(()=>{const c=document.querySelector('canvas')?.lunarSnapshot?.();return c?.rendered?.ready===true&&c.rendered.view==='sky'&&c.surface?.nearVisible===true&&c.surface?.terrainReady===true;},null,{timeout:45000});
  const near=await page.evaluate(()=>{const c=document.querySelector('canvas')?.lunarSnapshot?.();return{index:c?.index,observation:c?.observation,nearVisible:c?.surface?.nearVisible,terrainReady:c?.surface?.terrainReady,nearAlignmentM:c?.surface?.nearAlignmentM,rendered:c?.rendered};});
  if(!Number.isFinite(near.nearAlignmentM))errors.push({viewport:stats.viewport,kind:'near-field-alignment-not-finite',value:near.nearAlignmentM});
  if(near.index!==beforeNear.index||JSON.stringify(near.observation)!==JSON.stringify(beforeNear.observation))errors.push({viewport:stats.viewport,kind:'near-field-changed-scientific-observation',before:{index:beforeNear.index,observation:beforeNear.observation},after:{index:near.index,observation:near.observation}});
  await page.screenshot({path:join(OUT,`${target.width}x${target.height}-surface-sky-near.png`),fullPage:false});
  stats.surfaceSky={nearVisible:near.nearVisible,terrainReady:near.terrainReady,nearAlignmentM:near.nearAlignmentM,index:near.index,scienceUnchanged:near.index===beforeNear.index&&JSON.stringify(near.observation)===JSON.stringify(beforeNear.observation)};
  console.log('SURFACE-NEAR',JSON.stringify({viewport:stats.viewport,...stats.surfaceSky}));
  await context.close();
}
const report={base:BASE,browser:browser.version(),generatedAt:new Date().toISOString(),frameRateDefinitions:{raf:'requestAnimationFrame sampler callbacks',draw:'distinct rendered.serial samples measured by rendered.frameTimeMs'},reports,errors};
writeFileSync(join(OUT,'results.json'),JSON.stringify(report,null,2));
console.log(`${reports.length} viewport measurements; ${errors.length} issues; results ${join(OUT,'results.json')}`);
await browser.close();
if(errors.length)process.exitCode=1;
