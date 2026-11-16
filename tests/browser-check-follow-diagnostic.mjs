// Short hardware-only trace for Moon/planet flicker, inspector transitions and
// follow-camera resets. Not part of `npm test`.
//   QA_URL=http://localhost:4173 QA_GPU=hardware QA_OUT=../tmp/follow node tests/browser-check-follow-diagnostic.mjs
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const BASE=(process.env.QA_URL||'http://localhost:4173').replace(/\/$/,'');
const referenceBuild=/\.pages\.dev\/?$/i.test(BASE);
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(ROOT,'..','tmp','follow-diagnostic');
mkdirSync(OUT,{recursive:true});
const exe='C:/Program Files/Google/Chrome/Application/chrome.exe';
const launches=[{channel:'chrome',headless:true,args:[]},...(existsSync(exe)?[{executablePath:exe,headless:true,args:[]}]:[]),{headless:true,args:[]}];
let browser;
for(const opts of launches){try{browser=await chromium.launch(opts);break;}catch{}}
if(!browser)throw new Error('Chrome/Chromium could not be launched');
const errors=[];
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url()}`);});
await page.goto(`${BASE}/?qa=1#/simulator`,{waitUntil:'networkidle',timeout:60000});
const opening=page.getByRole('dialog',{name:/Lunacline|Lunar Navigator/});
if(await opening.count())await opening.waitFor({state:'hidden',timeout:5000});
await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.(),null,{timeout:30000});
const snapshot=()=>page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.());
if(await page.getByRole('button',{name:'Pause',exact:true}).isVisible())await page.getByRole('button',{name:'Pause',exact:true}).click();
const cases=[];
for(const scenario of [
  {name:'orbit-sun',startView:'overview',target:'sun'},
  {name:'orbit-saturn',startView:'overview',target:'saturn'},
  {name:'orbit-jupiter',startView:'overview',target:'jupiter'},
  {name:'sky-sun',startView:'sky',target:'sun'},
  {name:'sky-saturn-inspector',startView:'sky',target:'saturn'},
  {name:'sky-jupiter-inspector',startView:'sky',target:'jupiter'},
]){
  if(await page.getByRole('button',{name:'Pause',exact:true}).isVisible())await page.getByRole('button',{name:'Pause',exact:true}).click();
  const presetName=scenario.startView==='sky'?'Surface sky':'Moon orbit';
  const preset=page.locator('.camera-presets button').filter({hasText:presetName});
  if(await preset.count())await preset.first().click();
  else await page.locator('#explorer-view').selectOption(scenario.startView);
  await page.getByLabel('Speed').selectOption('24');
  if(scenario.startView==='sky'&&scenario.target==='sun'&&await page.getByRole('button',{name:'Look at Sun',exact:true}).count())
    await page.getByRole('button',{name:'Look at Sun',exact:true}).click();
  else {
    const picker=page.locator('select[aria-label*="Inspect individual planets"],select[aria-label*="celestial body"]').first();
    await picker.selectOption(scenario.target);
  }
  await page.waitForFunction(({startView,target,referenceBuild})=>{
    const s=document.querySelector('canvas')?.lunarSnapshot?.();
    const oldSkyInspector=referenceBuild&&startView==='sky'&&target!=='sun';
    return s?.rendered?.ready!==false&&(s.skyTracking===target||s.trackedBody===target)&&
      (startView==='sky'&&target==='sun'||oldSkyInspector?s.view==='sky':s.view!=='sky');
  },{startView:scenario.startView,target:scenario.target,referenceBuild},{timeout:20000});
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().transition===false,null,{timeout:12000});
  const start=await snapshot();
  const expectedIndex=start.rendered?.presentedIndex;
  const pausedSamples=[];
  for(let i=0;i<6;i++){
    const s=await snapshot(),body=s?.bodies?.[scenario.target];
    const v=body?.position&&s.camera?.position?body.position.map((x,j)=>x-s.camera.position[j]):null;
    const vn=v?Math.hypot(...v):0,d=s?.camera?.direction;
    const angleDeg=v&&d&&vn?Math.acos(Math.max(-1,Math.min(1,d.reduce((sum,x,j)=>sum+x*v[j]/vn,0))))*180/Math.PI:null;
    const tDist=v?Math.hypot(...v):null;
    pausedSamples.push({sample:i,serial:s?.rendered?.serial,frameTimeMs:s?.rendered?.frameTimeMs,index:s?.index,presentedIndex:s?.rendered?.presentedIndex,angleDeg:angleDeg===null?null:+angleDeg.toFixed(6),targetDistanceRadii:tDist&&body?.radius?+(tDist/body.radius).toFixed(5):null,cameraPosition:s?.camera?.position,cameraQuaternion:s?.camera?.quaternion,origin:s?.origin,trackedBody:s?.trackedBody,skyTracking:s?.skyTracking});
    await page.waitForTimeout(100);
  }
  const sampleSeconds=1.0;
  await page.evaluate(({sampleSeconds,target})=>{
    const trace={target,frames:[],screenshots:[],started:performance.now(),durationMs:sampleSeconds*1000,lastSerial:null};
    window.__followDiagnostic=trace;
    const c=document.querySelector('.space-canvas canvas');
    if(c&&!c.dataset.followTraceId)c.dataset.followTraceId=`canvas-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const raf=()=>{
      const s=document.querySelector('canvas')?.lunarSnapshot?.();
      const now=performance.now();
      if(s?.rendered&&s.rendered.serial!==trace.lastSerial){
        trace.lastSerial=s.rendered.serial;
        const liveCanvas=document.querySelector('.space-canvas canvas'),body=s.bodies?.[trace.target];
        if(liveCanvas&&!liveCanvas.dataset.followTraceId)liveCanvas.dataset.followTraceId=`canvas-${now}-${Math.random().toString(36).slice(2)}`;
        const delta=body?.position&&s.camera?.position?body.position.map((v,i)=>s.camera.position[i]-v):null;
        const toward=delta?.map(v=>-v),distance=toward?Math.hypot(...toward):0,direction=s.camera?.direction;
        const angleDeg=toward&&direction&&distance?Math.acos(Math.max(-1,Math.min(1,direction.reduce((sum,x,i)=>sum+x*toward[i]/distance,0))))*180/Math.PI:null;
        trace.frames.push({
          sampleMs:+(now-trace.started).toFixed(2),serial:s.rendered.serial,
          frameTimeMs:s.rendered.frameTimeMs,index:s.index,presentedIndex:s.rendered.presentedIndex,
          renderScale:s.rendered.renderScale,terrainDetail:s.rendered.terrainDetail,
          triangles:s.rendered.triangles,drawCalls:s.rendered.drawCalls,
          nearVisible:s.surface?.nearVisible,view:s.view,skyTracking:s.skyTracking,trackedBody:s.trackedBody,
          cameraPosition:s.camera?.position,cameraDirection:s.camera?.direction,cameraQuaternion:s.camera?.quaternion,origin:s.origin,
          cameraTarget:s.camera?.target,targetDistance:delta?Math.hypot(...delta):null,targetRadius:body?.radius,
          targetDistanceRadii:delta&&body?.radius?+(Math.hypot(...delta)/body.radius).toFixed(5):null,
          targetAngularErrorDeg:angleDeg===null?null:+angleDeg.toFixed(6),
          targetVisible:body?.visible,moonVisible:s.bodies?.moon?.visible,moonPosition:s.bodies?.moon?.position,
          canvasId:liveCanvas?.dataset?.followTraceId??null,canvasSize:liveCanvas?[liveCanvas.width,liveCanvas.height]:null,
          glareEnabled:s.surface?.glare,sunFraction:s.observation?.sun,
          ready:s.rendered.ready,
        });
      }
      if(now-trace.started<trace.durationMs)trace.rafId=requestAnimationFrame(raf);
    };
    trace.rafId=requestAnimationFrame(raf);
  },{sampleSeconds,target:scenario.target});
  await page.getByRole('button',{name:'Play',exact:true}).click();
  const canvas=page.locator('.space-canvas canvas').first();
  for(let i=0;i<10;i++){
    await page.waitForTimeout(100);
    await canvas.screenshot({path:join(OUT,`${scenario.name}-${i+1}.png`),timeout:10000});
  }
  await page.waitForTimeout(100);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const trace=await page.evaluate(()=>window.__followDiagnostic);
  const frames=trace.frames;
  const diffs={
    count:frames.length,
    renderedIndexBackslides:frames.slice(1).filter((x,i)=>x.presentedIndex+1e-6<frames[i].presentedIndex).length,
    baseIndexBackslides:frames.slice(1).filter((x,i)=>x.index+1e-6<frames[i].index).length,
    invalidCamera:frames.filter(x=>!x.cameraPosition?.every(Number.isFinite)||!x.cameraQuaternion?.every(Number.isFinite)).length,
    trackingMismatch:frames.filter(x=>x.skyTracking!==scenario.target&&x.trackedBody!==scenario.target).length,
    moonVisibleTransitions:frames.slice(1).filter((x,i)=>x.moonVisible!==frames[i].moonVisible).length,
    canvasRemounts:new Set(frames.map(x=>x.canvasId)).size-1,
    distanceRadii:[...new Set(frames.map(x=>x.targetDistanceRadii))],
    targetVisibleValues:[...new Set(frames.map(x=>x.targetVisible))],
    targetAngularErrorDeg:frames.length?{min:+Math.min(...frames.map(x=>x.targetAngularErrorDeg).filter(Number.isFinite)).toFixed(5),max:+Math.max(...frames.map(x=>x.targetAngularErrorDeg).filter(Number.isFinite)).toFixed(5),jumpsOver1Deg:frames.slice(1).filter((x,i)=>Math.abs(x.targetAngularErrorDeg-frames[i].targetAngularErrorDeg)>1).length}:null,
    triangleValues:[...new Set(frames.map(x=>x.triangles))],
    renderScaleValues:[...new Set(frames.map(x=>x.renderScale))],
    terrainDetailValues:[...new Set(frames.map(x=>x.terrainDetail))],
    nearVisibleValues:[...new Set(frames.map(x=>x.nearVisible))],
    actualDrawHz:frames.length>1?+((frames.length-1)/((frames.at(-1).frameTimeMs-frames[0].frameTimeMs)/1000)).toFixed(1):null,
    startIndex:expectedIndex,endIndex:frames.at(-1)?.presentedIndex,
  };
  cases.push({scenario,starting:{view:start.view,index:start.index,presentedIndex:start.rendered?.presentedIndex,renderScale:start.rendered?.renderScale,terrainDetail:start.rendered?.terrainDetail,triangles:start.rendered?.triangles,nearVisible:start.surface?.nearVisible,skyTracking:start.skyTracking,trackedBody:start.trackedBody,moonVisible:start.bodies?.moon?.visible,cameraPosition:start.camera?.position,cameraQuaternion:start.camera?.quaternion},pausedSamples,summary:diffs,frames});
  console.log('FOLLOW-TRACE',JSON.stringify({scenario,pausedSerials:[...new Set(pausedSamples.map(x=>x.serial))],pausedAngular:pausedSamples.map(x=>x.angleDeg),summary:diffs}));
}
const report={url:BASE,browser:browser.version(),viewport:{width:1440,height:900},deviceScaleFactor:1,createdAt:new Date().toISOString(),cases,errors};
writeFileSync(join(OUT,'results.json'),JSON.stringify(report,null,2));
await browser.close();
if(errors.length)process.exitCode=1;
console.log('SAVED',join(OUT,'results.json'));
