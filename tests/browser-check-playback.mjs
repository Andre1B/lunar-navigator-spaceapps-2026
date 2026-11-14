// Targeted simulator regression QA for replay, deliberate changes and the new
// multi-height dataset. Not part of `npm test`; run after the owner marks the UI stable.
//   node tests/browser-check-playback.mjs
//   QA_URL=https://... QA_OUT=../tmp/lunar-playback node tests/browser-check-playback.mjs
// Env: QA_URL, QA_OUT, QA_HEADED=1, QA_ONLY=<check-name substring>.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const BASE=(process.env.QA_URL||'http://localhost:5173').replace(/\/$/,'');
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(ROOT,'..','tmp','lunar-playback');
const manifest=JSON.parse(readFileSync(join(ROOT,'public/data/manifest.json'),'utf8'));
const SITES=manifest.sites.map(s=>s.id),HEIGHTS=manifest.observerHeightsM.map(String);
const PRESETS=['overview','earth','south','sky','terrain','pair','system'];
const UI={
  play:'Play',pause:'Pause',replay:'Replay from start',restart:'Restart',
  slider:'#time-slider',site:'#explorer-site',height:'#explorer-height',
  presetButtons:'.camera-presets button',canvas:'canvas',
};
const results=[],issues={console:[],page:[],http:[],requestfailed:[]};
const fail=(message)=>{throw new Error(message);};
const snapshot=(page)=>page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.());
const setIndex=(page,index)=>page.evaluate((i)=>{
  const el=document.querySelector('#time-slider');
  if(!el)throw new Error('time slider missing');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(i));
  el.dispatchEvent(new Event('input',{bubbles:true}));
},index);
const visible=(page,label)=>page.getByRole('button',{name:label,exact:true}).isVisible().catch(()=>false);
const finiteScene=(s)=>{
  const direction=s?.camera?.direction,q=s?.camera?.quaternion;
  return Boolean(s&&Number.isFinite(s.index)&&s.camera?.position?.every(Number.isFinite)&&direction?.every(Number.isFinite)&&q?.every(Number.isFinite)&&Math.abs(Math.hypot(...direction)-1)<1e-5&&Math.abs(Math.hypot(...q)-1)<1e-5);
};
const waitRendered=async(page,{view,siteId,height,index,afterSerial=0,timeout=15000})=>{
  const expected={view,siteId,height,index,afterSerial};
  try{return await page.waitForFunction((a)=>{
  const s=document.querySelector('canvas')?.lunarSnapshot?.(),r=s?.rendered;
  return Boolean(r&&r.serial!==a.afterSerial&&r.view===a.view&&r.siteId===a.siteId&&String(r.height)===String(a.height)&&Math.abs(r.index-a.index)<1e-8&&r.ready===true);
  },expected,{timeout});}catch(error){const actual=await snapshot(page).catch(()=>null);throw new Error(`${error.message}; wanted ${JSON.stringify(expected)}, actual ${JSON.stringify(actual?.rendered)}`);}
};

async function launch(){
  const exe='C:/Program Files/Google/Chrome/Application/chrome.exe';
  const options={headless:!process.env.QA_HEADED,args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']};
  for(const browser of [{...options,channel:'chrome'},...(existsSync(exe)?[{...options,executablePath:exe}]:[]),options]){
    try{return await chromium.launch(browser);}catch{}
  }
  throw new Error('Chrome/Chromium could not be launched');
}
function watch(page,tag){
  page.on('console',m=>{if(m.type()==='error')issues.console.push({tag,text:m.text().slice(0,300)});});
  page.on('pageerror',e=>issues.page.push({tag,text:String(e).slice(0,300)}));
  page.on('response',r=>{if(r.status()>=400)issues.http.push({tag,status:r.status(),url:r.url()});});
  page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')issues.requestfailed.push({tag,url:r.url(),error:r.failure()?.errorText});});
}
async function openSimulator(browser,tag,motion='no-preference'){
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:motion});
  const page=await context.newPage();watch(page,tag);
  await page.goto(`${BASE}/?qa=1#/simulator`,{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
  await page.locator(UI.slider).waitFor({timeout:20000});
  return {context,page};
}
async function check(name,fn){
  const only=process.env.QA_ONLY?.toLowerCase().split('|').filter(Boolean)??[];
  if(only.length&&!only.some(fragment=>name.toLowerCase().includes(fragment)))return;
  const started=Date.now();
  try{const detail=await fn();results.push({name,ok:true,detail:detail??'',ms:Date.now()-started});console.log('PASS',name);}
  catch(e){results.push({name,ok:false,detail:String(e.message||e).split('\n')[0],ms:Date.now()-started});console.log('FAIL',name,String(e.message||e).split('\n')[0]);}
}

const browser=await launch();
console.log('browser',browser.version(),'base',BASE);

await check('Play at the period end replays from zero; Restart is always available and remains paused',async()=>{
  const {context,page}=await openSimulator(browser,'replay');
  const max=Number(await page.locator(UI.slider).getAttribute('max'));
  const first=await snapshot(page);
  if(!finiteScene(first))fail('initial simulator snapshot is missing or non-finite');
  if(await visible(page,UI.restart)!==true)fail('Restart is not visible at the start');
  if(await visible(page,UI.play)!==true)fail('time should start paused');
  await page.waitForTimeout(800);
  if(Math.abs((await snapshot(page)).index-first.index)>1e-9)fail('time advanced without Play');
  await setIndex(page,max);
  await page.waitForFunction(m=>Math.abs(document.querySelector('canvas')?.lunarSnapshot?.().index-m)<1e-6,max,{timeout:10000});
  if(await visible(page,UI.replay)!==true)fail('period end does not expose Replay from start');
  if(await visible(page,UI.restart)!==true)fail('Restart disappeared at the period end');
  await page.getByRole('button',{name:UI.replay,exact:true}).click();
  await page.getByRole('button',{name:UI.pause,exact:true}).waitFor({timeout:5000});
  await page.waitForTimeout(350);
  const replay=await snapshot(page);
  if(!finiteScene(replay)||replay.index<=0||replay.index>=max)fail(`Replay did not start from zero and advance: index ${replay?.index}`);
  await page.getByRole('button',{name:UI.pause,exact:true}).click();
  const paused=await snapshot(page);await page.waitForTimeout(250);const held=await snapshot(page);
  if(Math.abs(held.index-paused.index)>1e-9)fail('Pause did not hold the replay time');
  await page.getByRole('button',{name:UI.restart,exact:true}).click();
  const restarted=await snapshot(page);
  if(Math.abs(restarted.index)>1e-6)fail(`Restart did not return to zero: ${restarted.index}`);
  if(await visible(page,UI.play)!==true||await visible(page,UI.pause))fail('Restart should leave playback paused');
  await context.close();return `max=${max}; replay=${replay.index.toFixed(3)}; restart=${restarted.index}`;
});

await check('site, height and view changes keep the live playback clock monotonic',async()=>{
  const outcomes=[];
  const actions=[
    ['site',async p=>p.selectOption(UI.site,{index:1})],
    ['height',async p=>p.selectOption(UI.height,{index:1})],
    ['view',async p=>p.locator(UI.presetButtons).nth(1).click()],
  ];
  for(const [label,action] of actions){
    const {context,page}=await openSimulator(browser,`pause-${label}`);
    await setIndex(page,240);
    await page.getByRole('button',{name:UI.play,exact:true}).click();
    await page.getByRole('button',{name:UI.pause,exact:true}).waitFor({timeout:5000});
    await page.waitForTimeout(300);const before=await snapshot(page);
    await action(page);await page.waitForTimeout(150);
    const after=await snapshot(page);
    if(await visible(page,UI.pause)!==true)fail(`${label} change unexpectedly paused playback`);
    if(after.index<before.index-1e-9)fail(`${label} change moved time backwards from ${before.index} to ${after.index}`);
    if(!finiteScene(after))fail(`${label} change produced a non-finite snapshot`);
    outcomes.push(`${label}:${before.index.toFixed(2)}->${after.index.toFixed(2)}`);await context.close();
  }
  return outcomes.join(', ');
});

await check('scrub, Restart and Faithful/Free mode changes pause playback as specified',async()=>{
  const outcomes=[];
  const actions=[
    ['scrub',async p=>setIndex(p,Math.min(36,Number(await p.locator(UI.slider).getAttribute('max'))))],
    ['restart',async p=>p.getByRole('button',{name:UI.restart,exact:true}).click()],
    ['mode',async p=>p.getByRole('button',{name:/^Free Mode/}).first().click()],
  ];
  for(const [label,action] of actions){
    const {context,page}=await openSimulator(browser,`pause-${label}`);
    await page.getByRole('button',{name:UI.play,exact:true}).click();
    await page.getByRole('button',{name:UI.pause,exact:true}).waitFor({timeout:5000});
    await page.waitForTimeout(250);await action(page);await page.waitForTimeout(120);
    if(await visible(page,UI.pause))fail(`${label} did not stop playback`);
    if(await visible(page,UI.play)!==true)fail(`${label} did not leave a paused play control`);
    if(label==='restart'&&Math.abs((await snapshot(page)).index)>1e-6)fail('Restart did not return the clock to zero');
    outcomes.push(label);await context.close();
  }
  return outcomes.join(', ');
});

await check('site x height x preset x mode matrix reaches valid simulator states',async()=>{
  const {context,page}=await openSimulator(browser,'matrix');
  const errorsBefore=issues.console.length+issues.page.length;
  let count=0;
  const viewButtons=page.locator(UI.presetButtons);
  if(await viewButtons.count()!==PRESETS.length)fail(`expected ${PRESETS.length} camera presets`);
  for(const mode of ['Faithful','Free']){
    const modeButton=page.getByRole('button',{name:new RegExp(`^${mode} Mode`)}).first();
    if(await modeButton.getAttribute('aria-pressed')!=='true')await modeButton.click();
    for(const site of SITES)for(const height of HEIGHTS)for(let i=0;i<PRESETS.length;i++){
      const serial=(await snapshot(page)).rendered?.serial??0;
      await page.selectOption(UI.site,site);
      await page.selectOption(UI.height,height);
      await viewButtons.nth(i).click();
      const alreadyRendered=(count===0&&PRESETS[i]===(await snapshot(page)).rendered?.view&&site===(await snapshot(page)).rendered?.siteId&&String(height)===String((await snapshot(page)).rendered?.height));
      await waitRendered(page,{view:PRESETS[i],siteId:site,height,index:(await snapshot(page)).index,afterSerial:alreadyRendered? -1:serial});
      const s=await snapshot(page);
      if(!finiteScene(s))fail(`${mode}/${site}/${height}/${PRESETS[i]} produced invalid scene state`);
      if(await page.locator(UI.site).inputValue()!==site||await page.locator(UI.height).inputValue()!==height)fail(`${mode}/${site}/${height}/${PRESETS[i]} lost a selector value`);
      count++;
    }
  }
  const newErrors=issues.console.length+issues.page.length-errorsBefore;
  await context.close();if(newErrors)fail(`${newErrors} console/page errors during matrix`);
  return `${count} combinations (${SITES.length} sites x ${HEIGHTS.length} heights x ${PRESETS.length} views x 2 modes)`;
});

await check('all 49 ordered camera preset transitions end at the requested view',async()=>{
  const {context,page}=await openSimulator(browser,'preset-pairs');
  const buttons=page.locator(UI.presetButtons),bad=[];let count=0;
  for(let from=0;from<PRESETS.length;from++)for(let to=0;to<PRESETS.length;to++){
    let state=await snapshot(page),site=await page.locator(UI.site).inputValue(),height=await page.locator(UI.height).inputValue(),index=state.index;
    if(state.rendered?.view!==PRESETS[from]||state.rendered?.ready!==true){
      const serial=state.rendered?.serial??0;await buttons.nth(from).click();
      await waitRendered(page,{view:PRESETS[from],siteId:site,height,index,afterSerial:serial});
      state=await snapshot(page);
    }
    if(from!==to){
      const serial=state.rendered?.serial??0;await buttons.nth(to).click();
      await waitRendered(page,{view:PRESETS[to],siteId:site,height,index,afterSerial:serial,timeout:20000});
    }else if(state.rendered?.view!==PRESETS[to]||state.rendered?.ready!==true)fail(`identity transition ${PRESETS[from]} is not rendered ready`);
    const s=await snapshot(page);if(!finiteScene(s)||s.view!==PRESETS[to])bad.push(`${PRESETS[from]}->${PRESETS[to]}`);
    count++;
  }
  await context.close();if(bad.length)fail(bad.slice(0,5).join(', '));
  return `${count} ordered transitions`;
});

await check('reduced-motion normal and reduce both start paused and permit manual Play/Pause',async()=>{
  const out=[];
  for(const motion of ['no-preference','reduce']){
    const {context,page}=await openSimulator(browser,`motion-${motion}`,motion);
    const start=await snapshot(page);await page.waitForTimeout(600);const idle=await snapshot(page);
    if(Math.abs(idle.index-start.index)>1e-9)fail(`${motion}: autoplay on load`);
    if(await visible(page,UI.play)!==true)fail(`${motion}: not initially paused`);
    await page.getByRole('button',{name:UI.play,exact:true}).click();
    await page.waitForTimeout(600);const playing=await snapshot(page);
    if(playing.index<=idle.index)fail(`${motion}: Play failed to advance`);
    await page.getByRole('button',{name:UI.pause,exact:true}).click();
    const paused=await snapshot(page);await page.waitForTimeout(200);
    if(Math.abs((await snapshot(page)).index-paused.index)>1e-9)fail(`${motion}: Pause failed to hold`);
    out.push(`${motion}:${playing.index.toFixed(2)}`);await context.close();
  }
  return out.join(', ');
});

await check('Surface sky navigation guidance does not cover camera controls at 390 or 768 px',async()=>{
  const outcomes=[];
  for(const width of [390,768]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390,deviceScaleFactor:width===390?2:1});
    const page=await context.newPage();watch(page,`sky-guidance-${width}`);
    await page.goto(`${BASE}/?qa=1#/simulator`,{waitUntil:'networkidle',timeout:60000});
    await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
    if(width===390){if(!await page.locator('#explorer-view').isVisible())await page.locator('.setup-toggle').click();await page.selectOption('#explorer-view','sky');}
    else await page.locator(UI.presetButtons).nth(PRESETS.indexOf('sky')).click();
    await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().view==='sky',null,{timeout:10000});
    const boxes=await page.evaluate(()=>{
      const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      return {guide:rect('.scene-navigation-help'),controls:rect('.camera-controls')};
    });
    if(!boxes.guide||!boxes.controls)fail(`${width}px: navigation guide or camera controls missing`);
    const overlapX=Math.max(0,Math.min(boxes.guide.right,boxes.controls.right)-Math.max(boxes.guide.x,boxes.controls.x));
    const overlapY=Math.max(0,Math.min(boxes.guide.bottom,boxes.controls.bottom)-Math.max(boxes.guide.y,boxes.controls.y));
    if(overlapX>0&&overlapY>0)fail(`${width}px: navigation guidance overlaps camera controls (${overlapX.toFixed(1)}x${overlapY.toFixed(1)} px)`);
    outcomes.push(`${width}px:no-overlap`);await context.close();
  }
  return outcomes.join(', ');
});

await check('a tiny first-finger move does not jump Surface sky after a second touch joins',async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await context.newPage();watch(page,'sky-two-touch');
  await page.goto(`${BASE}/?qa=1#/simulator`,{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
  if(!await page.locator('#explorer-view').isVisible())await page.locator('.setup-toggle').click();
  await page.selectOption('#explorer-view','sky');
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().view==='sky',null,{timeout:10000});
  const canvas=page.locator(UI.canvas).first();await canvas.scrollIntoViewIfNeeded();
  const box=await canvas.boundingBox();if(!box)fail('sky canvas has no visible bounds');
  const x=Math.round(box.x+box.width/2),y=Math.round(box.y+box.height/2);
  await canvas.evaluate(el=>{window.__qaPointerLog=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,e=>window.__qaPointerLog.push({type,id:e.pointerId,x:e.clientX,y:e.clientY,pointerType:e.pointerType}),true);});
  const cdp=await context.newCDPSession(page);
  const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.reduce((sum,v,i)=>sum+v*b[i],0))));
  const before=await snapshot(page),serial=before.rendered?.serial??0;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-12,y,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-11,y,id:1}]});
  await waitRendered(page,{view:'sky',siteId:before.rendered?.siteId,height:before.rendered?.height,index:before.index,afterSerial:serial});
  const oneFinger=await snapshot(page),oneFingerAngle=angle(before.camera.direction,oneFinger.camera.direction);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}).catch(()=>{});
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  const resetBase=await snapshot(page);
  await waitRendered(page,{view:'sky',siteId:resetBase.rendered?.siteId,height:resetBase.rendered?.height,index:resetBase.index,afterSerial:resetBase.rendered?.serial??0});
  const baseline=await snapshot(page),resetSerial=baseline.rendered?.serial??0;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-12,y,id:1},{x:x+12,y,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-11,y,id:1},{x:x+12,y,id:2}]});
  await waitRendered(page,{view:'sky',siteId:baseline.rendered?.siteId,height:baseline.rendered?.height,index:baseline.index,afterSerial:resetSerial});
  const after=await snapshot(page);
  const pointerLog=await page.evaluate(()=>window.__qaPointerLog);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}).catch(()=>{});
  if(!pointerLog.some(e=>e.type==='pointerdown')||!pointerLog.some(e=>e.type==='pointermove'))fail(`touch input did not reach the sky canvas: ${JSON.stringify(pointerLog)}`);
  const angularDelta=angle(baseline.camera.direction,after.camera.direction);
  const cancelBase=await snapshot(page),cancelSerial=cancelBase.rendered?.serial??0;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-8,y,id:3}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-4,y,id:3}]});
  await waitRendered(page,{view:'sky',siteId:cancelBase.rendered?.siteId,height:cancelBase.rendered?.height,index:cancelBase.index,afterSerial:cancelSerial});
  const beforeCancel=await snapshot(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await page.waitForTimeout(100);
  const afterCancel=await snapshot(page),cancelAngle=angle(beforeCancel.camera.direction,afterCancel.camera.direction);
  const restartSerial=afterCancel.rendered?.serial??0;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-8,y,id:4}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-7,y,id:4}]});
  await waitRendered(page,{view:'sky',siteId:afterCancel.rendered?.siteId,height:afterCancel.rendered?.height,index:afterCancel.index,afterSerial:restartSerial});
  const afterRestart=await snapshot(page),restartAngle=angle(afterCancel.camera.direction,afterRestart.camera.direction);
  const cancelLog=await page.evaluate(()=>window.__qaPointerLog);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}).catch(()=>{});
  await context.close();
  if(oneFingerAngle<0.0005)fail(`positive control: a one-pixel single-finger drag changed direction by only ${(oneFingerAngle*180/Math.PI).toFixed(3)} degrees`);
  if(angularDelta>0.01)fail(`one-pixel primary touch moved the camera by about ${(angularDelta*180/Math.PI).toFixed(2)} degrees`);
  if(cancelAngle>0.0002)fail(`camera kept moving after pointer cancellation (${(cancelAngle*180/Math.PI).toFixed(3)} degrees)`);
  if(restartAngle<0.0005)fail(`drag did not restart after cancellation (${(restartAngle*180/Math.PI).toFixed(3)} degrees)`);
  if(!cancelLog.some(e=>e.type==='pointercancel'))fail('CDP cancellation did not reach the canvas as pointercancel');
  return `${pointerLog.length} pointer events; single finger ${(oneFingerAngle*180/Math.PI).toFixed(3)}°, two-finger primary ${(angularDelta*180/Math.PI).toFixed(3)}°, canceled ${(cancelAngle*180/Math.PI).toFixed(3)}°, restarted ${(restartAngle*180/Math.PI).toFixed(3)}°`;
});

await check('keyboard navigation and Reset view return the camera to its preset',async()=>{
  const {context,page}=await openSimulator(browser,'camera-reset');
  await page.locator(UI.presetButtons).nth(0).click();
  const canvas=page.locator(UI.canvas).first();await canvas.focus();
  const read=()=>page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.().camera.position);
  const before=await read();await page.keyboard.press('ArrowRight');await page.waitForTimeout(150);
  const moved=await read();if(moved.every((v,i)=>Math.abs(v-before[i])<1e-7))fail('ArrowRight did not move the camera');
  await page.getByRole('button',{name:'Reset view',exact:true}).click();await page.waitForTimeout(250);
  const reset=await read();if(Math.hypot(...reset.map((v,i)=>v-before[i]))>1e-5)fail('Reset view did not restore the preset camera');
  await page.evaluate(()=>{location.hash='#/home'});await page.locator('#main').waitFor();
  await page.evaluate(()=>{location.hash='#/simulator'});await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
  if(!finiteScene(await snapshot(page)))fail('simulator did not remount after route navigation');
  await context.close();return 'keyboard, camera reset, route remount';
});

await check('capture Home, Compare, Surface sky and Local terrain at desktop and 390 px',async()=>{
  const captures=[];
  for(const [label,viewport,mobile] of [['desktop',{width:1440,height:900},false],['mobile-390',{width:390,height:844},true]]){
    const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
    const page=await context.newPage();watch(page,`capture-${label}`);
    for(const [route,name] of [['home','home'],['compare','compare']]){
      await page.goto(`${BASE}/#/${route}`,{waitUntil:'networkidle',timeout:60000});
      await page.locator('#main').waitFor({timeout:20000});
      await page.evaluate(()=>document.fonts?.ready);
      const file=join(OUT,`${label}-${name}.png`);await page.screenshot({path:file,fullPage:mobile&&name==='compare'});captures.push(file);
    }
    await page.goto(`${BASE}/?qa=1#/simulator`,{waitUntil:'networkidle',timeout:60000});
    await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
    if(mobile){const view=page.locator('#explorer-view');if(!await view.isVisible())await page.locator('.setup-toggle').click();}
    for(const [viewName,id] of [['surface-sky','sky'],['local-terrain','terrain']]){
      if(mobile)await page.selectOption('#explorer-view',id);
      else await page.locator(UI.presetButtons).nth(PRESETS.indexOf(id)).click();
      await page.waitForFunction(id=>document.querySelector('canvas')?.lunarSnapshot?.().view===id, id,{timeout:10000});
      await page.waitForTimeout(700);
      if(mobile)await page.locator(UI.canvas).first().scrollIntoViewIfNeeded();
      const file=join(OUT,`${label}-${viewName}.png`);await page.screenshot({path:file});captures.push(file);
    }
    await context.close();
  }
  return captures.join(', ');
});

const report={base:BASE,browser:browser.version(),generatedAt:new Date().toISOString(),results,issues};
mkdirSync(OUT,{recursive:true});writeFileSync(join(OUT,'results.json'),JSON.stringify(report,null,2));
console.log(`\n${results.filter(r=>r.ok).length}/${results.length} checks passed; results ${join(OUT,'results.json')}`);
await browser.close();
if(results.some(r=>!r.ok)||Object.values(issues).some(v=>v.length))process.exitCode=1;
