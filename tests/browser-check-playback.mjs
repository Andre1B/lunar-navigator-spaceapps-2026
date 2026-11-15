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
const results=[],textTraces=[],issues={console:[],page:[],http:[],requestfailed:[]};
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
  const options={headless:!process.env.QA_HEADED,args:process.env.QA_GPU==='hardware'?[]:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']};
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
  await context.addInitScript(()=>sessionStorage.setItem('lunar-opening-v1','seen'));
  const page=await context.newPage();watch(page,tag);
  await page.goto(`${BASE}/?qa=1#/simulator`,{waitUntil:'networkidle',timeout:60000});
  const opening=page.getByRole('dialog',{name:'Lunar Navigator'});
  if(await opening.count())await opening.waitFor({state:'hidden',timeout:4500});
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
  await page.locator(UI.slider).waitFor({timeout:20000});
  // Keep the interaction checks deterministic; autoplay itself is asserted by
  // the dedicated entry-contract check below.
  if(await visible(page,UI.pause))await page.getByRole('button',{name:UI.pause,exact:true}).click();
  if(await visible(page,UI.restart))await page.getByRole('button',{name:UI.restart,exact:true}).click();
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

await check('Loop computed period wraps to the first sample; disabling it pauses at the terminal sample',async()=>{
  const {context,page}=await openSimulator(browser,'period-loop');
  const loop=page.getByLabel('Loop computed period'),max=Number(await page.locator(UI.slider).getAttribute('max'));
  if(!await loop.isChecked())fail('Loop computed period should be enabled by default');
  await page.getByLabel('Speed').selectOption('24');
  await setIndex(page,max-0.05);
  await page.getByRole('button',{name:UI.play,exact:true}).click();
  await page.waitForFunction(m=>{
    const s=document.querySelector('canvas')?.lunarSnapshot?.(),status=document.querySelector('.playback-status')?.textContent??'';
    return status.startsWith('Playing')&&s?.index>=0&&s.index<3;
  },max,{timeout:12000}).catch(async e=>{const s=await snapshot(page),status=await page.locator('.playback-status').innerText();throw new Error(`loop did not wrap from max ${max}: index=${s?.index}, status=${status}; ${e.message.split('\n')[0]}`);});
  const wrapped=await snapshot(page);
  if(wrapped.index>=3||!await visible(page,UI.pause))fail(`loop did not continue from the first samples: ${wrapped.index}`);
  await page.getByRole('button',{name:UI.pause,exact:true}).click();
  await loop.setChecked(false);
  if(await loop.isChecked())fail('Loop computed period did not turn off');
  await page.getByRole('button',{name:UI.restart,exact:true}).click();
  await setIndex(page,max-0.05);
  await page.getByRole('button',{name:UI.play,exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.playback-status')?.textContent.includes('End of the calculated period'),null,{timeout:12000});
  const ended=await snapshot(page);
  if(Math.abs(ended.index-max)>1e-6||await visible(page,UI.pause)||!await visible(page,UI.replay))fail(`loop-off playback did not stop at terminal sample: ${JSON.stringify({index:ended.index,max,pause:await visible(page,UI.pause),replay:await visible(page,UI.replay)})}`);
  await context.close();return `loop-on wrapped and remained Playing at index ${wrapped.index.toFixed(3)}; loop-off paused at ${ended.index}/${max} with Replay available`;
});

await check('fast playback publishes the exact terminal HUD; re-entry from the period end restarts at zero',async()=>{
  const {context,page}=await openSimulator(browser,'terminal-frame');
  const max=Number(await page.locator(UI.slider).getAttribute('max'));
  const expected=new Date(Date.parse(manifest.period.startUtc)+max*manifest.period.stepMinutes*60000).toISOString();
  await page.locator('.camera-presets button').nth(PRESETS.indexOf('sky')).click();
  await page.getByLabel('Speed').selectOption('24');
  await setIndex(page,max-0.05);
  await page.waitForFunction(m=>Math.abs(document.querySelector('canvas')?.lunarSnapshot?.().index-m)<0.01,max-0.05,{timeout:10000}).catch(async e=>{const d=await page.evaluate(()=>({slider:document.querySelector('#time-slider')?.value,index:document.querySelector('canvas')?.lunarSnapshot?.().index,rendered:document.querySelector('canvas')?.lunarSnapshot?.().rendered}));throw new Error(`pre-end scrub timeout for ${max-0.05}: ${JSON.stringify(d)}; ${e.message.split('\n')[0]}`);});
  await page.getByRole('button',{name:UI.play,exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.playback-status')?.textContent.includes('End of the calculated period'),null,{timeout:10000}).catch(async e=>{const d=await page.evaluate(()=>({status:document.querySelector('.playback-status')?.textContent,index:document.querySelector('canvas')?.lunarSnapshot?.().index}));throw new Error(`end-state timeout: ${JSON.stringify(d)}; ${e.message.split('\n')[0]}`);});
  const hud=page.locator('.world-reading small');
  await page.waitForFunction(t=>new RegExp(`frame ${t.slice(11,19)} UTC`).test(document.querySelector('.world-reading small')?.textContent??''),expected,{timeout:10000}).catch(async e=>{const d=await page.evaluate(()=>({hud:document.querySelector('.world-reading small')?.textContent,index:document.querySelector('canvas')?.lunarSnapshot?.().index,rendered:document.querySelector('canvas')?.lunarSnapshot?.().rendered}));throw new Error(`terminal HUD timeout: wanted ${expected}, got ${JSON.stringify(d)}; ${e.message.split('\n')[0]}`);});
  await page.locator('.sky-description-details').locator('summary').click();
  await page.waitForFunction(t=>{
    const p=document.querySelector('.sky-description-details p')?.textContent??'';
    return p.startsWith(`${t.slice(0,16).replace('T',' ')} UTC,`)&&!p.includes('Waiting for the sky geometry');
  },expected,{timeout:10000}).catch(async e=>{const d=await page.evaluate(()=>document.querySelector('.sky-description-details p')?.textContent);throw new Error(`terminal description timeout: wanted ${expected}, got ${d}; ${e.message.split('\n')[0]}`);});
  const end=await snapshot(page);
  if(Math.abs(end.index-max)>1e-6||Math.abs(end.rendered?.presentedIndex-max)>0.02)fail(`last rendered frame did not reach the last sample: ${JSON.stringify({index:end.index,presented:end.rendered?.presentedIndex,max})}`);
  await page.evaluate(()=>{location.hash='#/home'});await page.locator('#main').waitFor();
  await page.evaluate(()=>{location.hash='#/simulator'});await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
  await page.locator('.camera-presets button').nth(PRESETS.indexOf('sky')).click();
  await page.waitForFunction(v=>{
    const s=document.querySelector('canvas')?.lunarSnapshot?.();
    return s?.rendered?.view==='sky'&&s.index<1&&s.rendered?.ready===true;
  },max,{timeout:30000});
  const remountStart=await snapshot(page);
  await page.waitForFunction(i=>document.querySelector('canvas')?.lunarSnapshot?.().index>i,remountStart.index,{timeout:5000});
  const remountHud=await page.locator('.world-reading small').innerText();
  if(remountHud.includes(`frame ${expected.slice(11,19)} UTC`))fail(`remounted HUD retained the old terminal frame: ${remountHud}`);
  if(!await visible(page,UI.pause))fail('normal-motion route re-entry did not autoplay after resetting the terminal time');
  await context.close();return `end index ${end.index}; terminal HUD/details at ${expected}; route re-entry starts at ${remountStart.index.toFixed(3)} and advances`;
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

await check('normal-motion Simulator entry autoplays; reduced-motion entry stays paused but allows manual playback',async()=>{
  const out=[];
  for(const motion of ['no-preference','reduce']){
    const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:motion});
    await context.addInitScript(()=>sessionStorage.setItem('lunar-opening-v1','seen'));
    const page=await context.newPage();watch(page,`motion-${motion}`);
    await page.goto(`${BASE}/?qa=1#/simulator`,{waitUntil:'networkidle',timeout:60000});
    await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
    await page.locator(UI.slider).waitFor({timeout:20000});
    const start=await snapshot(page);await page.waitForTimeout(600);const idle=await snapshot(page);
    if(motion==='no-preference'){
      if(idle.index<=start.index||await visible(page,UI.pause)!==true)fail('normal motion Simulator entry did not autoplay');
    }else{
      if(Math.abs(idle.index-start.index)>1e-9||await visible(page,UI.play)!==true)fail('reduced-motion Simulator entry should remain paused');
      await page.getByRole('button',{name:UI.play,exact:true}).click();
    }
    await page.waitForTimeout(600);const playing=await snapshot(page);
    if(playing.index<=idle.index)fail(`${motion}: playback failed to advance after user action`);
    await page.getByRole('button',{name:UI.pause,exact:true}).click();
    const paused=await snapshot(page);await page.waitForTimeout(200);
    if(Math.abs((await snapshot(page)).index-paused.index)>1e-9)fail(`${motion}: Pause failed to hold`);
    out.push(`${motion}:${playing.index.toFixed(2)}`);await context.close();
  }
  return out.join(', ');
});

await check('Guided tour and Compare inspection enter the simulator paused',async()=>{
  const outcomes=[];
  const tour=await browser.newContext({viewport:{width:1440,height:900}});
  await tour.addInitScript(()=>sessionStorage.setItem('lunar-opening-v1','seen'));
  const tp=await tour.newPage();watch(tp,'tour-entry-pause');
  await tp.goto(`${BASE}/#/home`,{waitUntil:'networkidle',timeout:60000});
  await tp.getByRole('button',{name:/Show me how.*interactive tour/}).click();
  const card=tp.getByRole('dialog');await card.waitFor();
  await card.getByRole('button',{name:'Next',exact:true}).click();
  await tp.waitForFunction(()=>location.hash==='#/simulator',null,{timeout:10000}).catch(async e=>{throw new Error(`tour did not navigate from its home step: ${JSON.stringify(await tp.evaluate(()=>({hash:location.hash,card:document.querySelector('[role=dialog]')?.innerText,step:document.querySelector('.tour-counter')?.textContent})))}; ${e.message.split('\n')[0]}`);});
  await tp.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.ready===true,null,{timeout:30000}).catch(async e=>{throw new Error(`tour simulator did not reach a rendered ready frame: ${JSON.stringify(await tp.evaluate(()=>({hash:location.hash,scene:document.querySelector('canvas')?.lunarSnapshot?.(),error:document.querySelector('.scene-error')?.textContent})))}; ${e.message.split('\n')[0]}`);});
  if(!await tp.getByRole('button',{name:UI.play,exact:true}).isVisible()||await visible(tp,UI.pause))fail('tour entry should be paused');
  const ti=await snapshot(tp);await tp.waitForTimeout(600);if(Math.abs((await snapshot(tp)).index-ti.index)>1e-9)fail('tour clock advanced while it should start paused');
  outcomes.push('tour');await tour.close();

  const inspect=await browser.newContext({viewport:{width:1440,height:900}});
  await inspect.addInitScript(()=>sessionStorage.setItem('lunar-opening-v1','seen'));
  const ip=await inspect.newPage();watch(ip,'compare-inspection-entry-pause');
  await ip.goto(`${BASE}/#/compare`,{waitUntil:'networkidle',timeout:60000});
  const inspectButton=ip.getByRole('button',{name:'See this arrival in 3D',exact:true}).first();await inspectButton.waitFor({timeout:30000});await inspectButton.click();
  await ip.waitForFunction(()=>location.hash==='#/simulator'&&document.querySelector('canvas')?.lunarSnapshot?.().rendered?.ready===true,null,{timeout:30000});
  const ins=await snapshot(ip);
  if(ins.view!=='sky'||!await ip.getByRole('button',{name:UI.play,exact:true}).isVisible()||await visible(ip,UI.pause))fail(`Compare inspection should open Surface sky paused, got ${JSON.stringify({view:ins.view,index:ins.index})}`);
  await ip.waitForTimeout(600);if(Math.abs((await snapshot(ip)).index-ins.index)>1e-9)fail('inspection clock advanced while paused');
  outcomes.push('inspection/sky');await inspect.close();return outcomes.join(', ');
});

await check('Surface sky navigation guidance does not cover camera controls at 390 or 768 px',async()=>{
  const outcomes=[];
  for(const width of [390,768]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390,deviceScaleFactor:width===390?2:1});
    const page=await context.newPage();watch(page,`sky-guidance-${width}`);
    await page.goto(`${BASE}/?qa=1#/simulator`,{waitUntil:'networkidle',timeout:60000});
    const opening=page.getByRole('dialog',{name:'Lunar Navigator'});if(await opening.count())await opening.waitFor({state:'hidden',timeout:4500});
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
  const opening=page.getByRole('dialog',{name:'Lunar Navigator'});
  if(await opening.count())await opening.waitFor({state:'hidden',timeout:4500});
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
  if(!await page.locator('#explorer-view').isVisible())await page.locator('.setup-toggle').click();
  await page.selectOption('#explorer-view','sky');
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().view==='sky',null,{timeout:10000});
  if(await visible(page,UI.pause))await page.getByRole('button',{name:UI.pause,exact:true}).click();
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
  if(oneFingerAngle<0.0005)fail(`positive control: a one-pixel single-finger drag changed direction by only ${(oneFingerAngle*180/Math.PI).toFixed(3)} degrees; before=${JSON.stringify(before.camera.direction)} after=${JSON.stringify(oneFinger.camera.direction)} tracking=${before.skyTracking}->${oneFinger.skyTracking} pointerEvents=${JSON.stringify(pointerLog.slice(0,8))}`);
  if(angularDelta>0.01)fail(`one-pixel primary touch moved the camera by about ${(angularDelta*180/Math.PI).toFixed(2)} degrees`);
  if(cancelAngle>0.0002)fail(`camera kept moving after pointer cancellation (${(cancelAngle*180/Math.PI).toFixed(3)} degrees)`);
  if(restartAngle<0.0005)fail(`drag did not restart after cancellation (${(restartAngle*180/Math.PI).toFixed(3)} degrees)`);
  if(!cancelLog.some(e=>e.type==='pointercancel'))fail('CDP cancellation did not reach the canvas as pointercancel');
  return `${pointerLog.length} pointer events; single finger ${(oneFingerAngle*180/Math.PI).toFixed(3)}°, two-finger primary ${(angularDelta*180/Math.PI).toFixed(3)}°, canceled ${(cancelAngle*180/Math.PI).toFixed(3)}°, restarted ${(restartAngle*180/Math.PI).toFixed(3)}°`;
});

await check('Play keeps Surface sky and Local terrain text mounted and readable at desktop and mobile',async()=>{
  const reports=[],failures=[];
  const viewportCases=[[1440,900,false],[390,844,true],[844,390,true]].filter(([w])=>!process.env.QA_WIDTH||w===Number(process.env.QA_WIDTH));
  const textViews=['sky','terrain'].filter(view=>!process.env.QA_VIEW||view===process.env.QA_VIEW);
  for(const [width,height,mobile] of viewportCases)for(const view of textViews){
    const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1,reducedMotion:'no-preference'});
    const page=await context.newPage();watch(page,`play-text-${width}-${view}`);
    await page.goto(`${BASE}/?qa=1#/simulator`,{waitUntil:'networkidle',timeout:60000});
    // The focused target is steady text during playback; intro timing is
    // covered separately. Explicitly dismiss it so the setup cannot time out
    // on a device/emulation whose motion preference disables auto-close.
    const opening=page.getByRole('dialog',{name:'Lunar Navigator'});if(await opening.isVisible().catch(()=>false))await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
    if(!await visible(page,UI.pause))fail(`${width}x${height}: normal-motion Simulator entry did not autoplay`);
    await page.getByRole('button',{name:UI.pause,exact:true}).click();
    if(width<=720&&!await page.locator('#explorer-view').isVisible())await page.locator('.setup-toggle').click({timeout:8000}).catch(e=>{throw new Error(`${width}x${height} cannot open mobile settings: ${e.message.split('\n')[0]}`);});
    const beforeView=await snapshot(page);
    if(width<=720)await page.selectOption('#explorer-view',view).catch(e=>{throw new Error(`${width}x${height} cannot select ${view} via the mobile view picker: ${e.message.split('\n')[0]}`);});
    else await page.locator(UI.presetButtons).nth(PRESETS.indexOf(view)).click({timeout:8000}).catch(e=>{throw new Error(`${width}x${height} cannot select ${view} preset: ${e.message.split('\n')[0]}`);});
    await page.waitForFunction(v=>document.querySelector('canvas')?.lunarSnapshot?.().view===v,view,{timeout:10000});
    let s=await snapshot(page);await waitRendered(page,{view,siteId:s.rendered?.siteId,height:s.rendered?.height,index:s.index,afterSerial:beforeView.rendered?.serial??0});
    for(const selector of ['.world-reading','.scene-navigation-help','.sky-description','.sky-description-plain span','.sky-description-context','.sky-description-details summary','.sky-description p[aria-live]',view==='sky'?'.sky-view-guide':'.view-explainer'])try{await page.locator(selector).first().waitFor({timeout:10000});}catch(e){throw new Error(`${width}x${height} ${view}: missing ${selector} after render-ready: ${e.message.split('\n')[0]}`);}
    // Settle first-load terrain/ephemeris messages before measuring playback stability.
    await page.waitForFunction(()=>{
      const live=document.querySelector('.sky-description p[aria-live]');
      return live&&!live.textContent.includes('Waiting for the sky geometry')&&document.querySelector('canvas')?.lunarSnapshot?.().rendered?.ready===true;
    },null,{timeout:20000});
    await page.waitForTimeout(900);
    await page.evaluate(()=>{
      const stable=['.world-reading','.scene-navigation-help','.sky-description','.sky-description-plain','.sky-description-context','.sky-description-details','.sky-description-details p','.sr-only[aria-live]','.sky-view-guide','.view-explainer'];
      const root=document.querySelector('#main'),trace={frames:0,rafTimes:[],renderedFrames:[],missing:Object.fromEntries(stable.map(x=>[x,0])),blank:Object.fromEntries(stable.map(x=>[x,0])),plainSpanCounts:[],placeholders:0,liveTexts:[],removed:[],layout:{},maxDirectionDeg:0,notReady:0};
      window.__playTextTrace=trace;
      const observer=new MutationObserver(records=>{for(const r of records)for(const node of r.removedNodes){if(node.nodeType!==1)continue;for(const sel of stable)if(node.matches?.(sel)||node.querySelector?.(sel))trace.removed.push(sel);}});
      observer.observe(root,{childList:true,subtree:true});
      const initial=document.querySelector('canvas')?.lunarSnapshot?.()?.camera?.direction;
      const sample=()=>{
        trace.frames++;const at=performance.now();trace.rafTimes.push(at);const snap=document.querySelector('canvas')?.lunarSnapshot?.();
        const rendered=snap?.rendered,last=trace.renderedFrames.at(-1);
        if(rendered?.frameTimeMs!==last?.frameTimeMs){const playbackStatus=document.querySelector('.playback-status')?.textContent?.trim()??'';trace.renderedFrames.push({sampleTime:at,frameTimeMs:rendered?.frameTimeMs,clockIndex:snap?.index,renderedIndex:rendered?.index,presentedIndex:rendered?.presentedIndex,playing:/^Playing\b/.test(playbackStatus),playbackStatus,view:rendered?.view,siteId:rendered?.siteId,height:rendered?.height,fpsLimit:rendered?.fpsLimit,serial:rendered?.serial});}
        trace.plainSpanCounts.push(document.querySelectorAll('.sky-description-plain span').length);
        if(snap?.rendered?.ready!==true)trace.notReady++;
        if(initial&&snap?.camera?.direction){const dot=Math.max(-1,Math.min(1,initial.reduce((a,v,i)=>a+v*snap.camera.direction[i],0)));trace.maxDirectionDeg=Math.max(trace.maxDirectionDeg,Math.acos(dot)*180/Math.PI);}
        for(const sel of stable){const e=document.querySelector(sel);if(!e){trace.missing[sel]++;continue;}const t=e.textContent.trim();if(!t)trace.blank[sel]++;if((sel==='.world-reading')&&/Not calculated|NaN/.test(t))trace.placeholders++;if(sel==='.sr-only[aria-live]'&&!trace.liveTexts.includes(t))trace.liveTexts.push(t);if(['.world-reading','.scene-navigation-help','.sky-description','.sky-description-plain','.sky-view-guide','.view-explainer'].includes(sel)){const r=e.getBoundingClientRect(),v=trace.layout[sel]??={min:r.height,max:r.height};v.min=Math.min(v.min,r.height);v.max=Math.max(v.max,r.height);}}
        window.__playTextRaf=requestAnimationFrame(sample);
      };window.__playTextRaf=requestAnimationFrame(sample);
    });
    if(await visible(page,UI.play))await page.getByRole('button',{name:UI.play,exact:true}).click();
    await page.getByRole('button',{name:UI.pause,exact:true}).waitFor({timeout:5000});
    await page.evaluate(()=>{if(window.__playTextTrace)window.__playTextTrace.liveTexts=[];});await page.waitForTimeout(3000);
    if(await visible(page,UI.pause))await page.getByRole('button',{name:UI.pause,exact:true}).click({timeout:8000}).catch(e=>{throw new Error(`${width}x${height} ${view} cannot Pause after sample: ${e.message.split('\n')[0]}`);});
    const trace=await page.evaluate(()=>{cancelAnimationFrame(window.__playTextRaf);return window.__playTextTrace;});
    const intervals=trace.rafTimes.slice(1).map((t,i)=>t-trace.rafTimes[i]).sort((a,b)=>a-b),renderedIntervals=trace.renderedFrames.slice(1).map((f,i)=>f.frameTimeMs-trace.renderedFrames[i].frameTimeMs).filter(Number.isFinite).sort((a,b)=>a-b);
    const median=(xs)=>xs.length?+xs[Math.floor(xs.length/2)].toFixed(2):null;
    const framePairs=trace.renderedFrames.slice(1).map((frame,i)=>({before:trace.renderedFrames[i],after:frame})).filter(pair=>pair.before.playing&&pair.after.playing&&pair.before.view===pair.after.view&&pair.before.siteId===pair.after.siteId&&String(pair.before.height)===String(pair.after.height));
    const baseBackslideEvents=framePairs.filter(({before,after})=>Number.isFinite(before.clockIndex)&&Number.isFinite(after.clockIndex)&&after.clockIndex<before.clockIndex-1e-8);
    const presentationBackslideEvents=framePairs.filter(({before,after})=>Number.isFinite(before.presentedIndex)&&Number.isFinite(after.presentedIndex)&&after.presentedIndex<before.presentedIndex-1e-8&&after.clockIndex>=before.clockIndex-1e-8);
    const backslides=baseBackslideEvents.length+presentationBackslideEvents.length;
    trace.cadence={rafFrames:trace.frames,rafMedianIntervalMs:median(intervals),rafMaxIntervalMs:intervals.at(-1)??null,renderedFrames:trace.renderedFrames.length,renderMedianIntervalMs:median(renderedIntervals),renderMaxIntervalMs:renderedIntervals.at(-1)??null,fpsLimit:trace.renderedFrames.at(-1)?.fpsLimit??null,firstBaseIndex:trace.renderedFrames[0]?.clockIndex??null,lastBaseIndex:trace.renderedFrames.at(-1)?.clockIndex??null,firstPresentedIndex:trace.renderedFrames[0]?.presentedIndex??null,lastPresentedIndex:trace.renderedFrames.at(-1)?.presentedIndex??null,baseIndexBackslides:baseBackslideEvents.length,presentedIndexBackslides:presentationBackslideEvents.length};
    console.log('PLAY-CADENCE',width,view,JSON.stringify(trace.cadence));
    const required=['.world-reading','.scene-navigation-help','.sky-description','.sky-description-plain','.sky-description-context','.sky-description-details','.sky-description-details p','.sr-only[aria-live]',view==='sky'?'.sky-view-guide':'.view-explainer'];
    const badMissing=required.filter(sel=>trace.missing[sel]||trace.blank[sel]||trace.removed.includes(sel));
    const layoutDrift=Object.fromEntries(Object.entries(trace.layout).map(([k,v])=>[k,+((v.max-v.min).toFixed(2))]));
    textTraces.push({width,height,view,frames:trace.renderedFrames,cadence:trace.cadence,missing:trace.missing,blank:trace.blank,removed:trace.removed,placeholders:trace.placeholders,notReady:trace.notReady,layoutDrift,liveTexts:trace.liveTexts});
    const badDrift=Object.entries(layoutDrift).filter(([k,v])=>required.includes(k)&&v>3);
    const report=`${width}px ${view}: ${trace.frames} frames, missing/blank/unmounted=${badMissing.join(',')||'none'}, placeholders=${trace.placeholders}, unready=${trace.notReady}, layout drift=${JSON.stringify(layoutDrift)}, live=${trace.liveTexts.join('|')}, max camera drift=${trace.maxDirectionDeg.toFixed(3)}°`;
    if(badMissing.length||trace.placeholders||trace.notReady>Math.max(2,trace.frames*0.05)||badDrift.length||!trace.liveTexts.some(t=>t.startsWith('Paused description:'))||trace.liveTexts.some(t=>/UTC, /.test(t)))failures.push(report);
    reports.push(`${report}; cadence=${JSON.stringify(trace.cadence)}`);
    if(process.env.QA_GPU==='hardware'&&trace.cadence.rafMedianIntervalMs>20)failures.push(`${width}px ${view}: test sampler median interval ${trace.cadence.rafMedianIntervalMs}ms is slower than a 50 Hz text-stability sample`);
    if(backslides>0)failures.push(`${width}px ${view}: base/presented clock moved backwards ${backslides} times: ${JSON.stringify({base:baseBackslideEvents.slice(0,3),presented:presentationBackslideEvents.slice(0,3)})}`);
    if(width===844&&trace.cadence.fpsLimit!==60)failures.push(`${width}x${height} touch viewport expected a 60 fps renderer cap, got ${trace.cadence.fpsLimit}`);
    if(trace.plainSpanCounts.some(count=>count!==2))failures.push(`${width}px ${view}: expected two stable visible Sun/Earth text spans; counts ${[...new Set(trace.plainSpanCounts)].join(',')}`);
    await context.close();
  }
  if(failures.length)fail(failures.join(' || '));
  return reports.join('; ');
});

await check('Reset uses the preset at the paused index; Restart changes time without resetting camera orientation',async()=>{
  const {context,page}=await openSimulator(browser,'camera-reset');
  const buttons=page.locator(UI.presetButtons);
  await buttons.nth(2).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.ready===true&&document.querySelector('canvas')?.lunarSnapshot?.().rendered?.view==='south',null,{timeout:10000});
  const beforeOverview=await snapshot(page);
  await buttons.nth(0).click();
  const canvas=page.locator(UI.canvas).first();await canvas.focus();
  await waitRendered(page,{view:'overview',siteId:beforeOverview.rendered.siteId,height:beforeOverview.rendered.height,index:beforeOverview.index,afterSerial:beforeOverview.rendered.serial});
  await page.waitForFunction(()=>{const q=document.querySelector('canvas')?.lunarSnapshot?.()?.camera?.quaternion;if(!q)return false;const old=window.__qaResetStableQ,count=(window.__qaResetStableCount??0)+1;window.__qaResetStableCount=old&&Math.max(...q.map((v,i)=>Math.abs(v-old[i])))<1e-8?count:0;window.__qaResetStableQ=q;return window.__qaResetStableCount>=4;},null,{timeout:5000});
  const read=()=>page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.());
  const before=await read(),q0=before.camera.quaternion;await page.keyboard.press('ArrowRight');
  await page.waitForFunction(q=>{const s=document.querySelector('canvas')?.lunarSnapshot?.();return s?.rendered?.serial>q.serial&&s?.camera?.quaternion.some((v,i)=>Math.abs(v-q.q[i])>1e-5);},{serial:before.rendered.serial,q:q0},{timeout:5000});
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await page.waitForFunction(q=>{const s=document.querySelector('canvas')?.lunarSnapshot?.();if(!s?.rendered?.ready||s.rendered.view!=='overview'||Math.abs(s.index-q.index)>1e-6)return false;const dot=Math.abs(s.camera.quaternion.reduce((a,v,i)=>a+v*q.q[i],0));return 2*Math.acos(Math.min(1,dot))<0.01;},{index:before.index,q:q0},{timeout:10000}).catch(async e=>{const d=await read();throw new Error(`Reset view did not restore orientation at the same rendered time: ${JSON.stringify({before:{index:before.index,rendered:before.rendered,quaternion:q0},after:{index:d.index,rendered:d.rendered,quaternion:d.camera.quaternion},dot:Math.abs(d.camera.quaternion.reduce((a,v,i)=>a+v*q0[i],0))})}; ${e.message.split('\n')[0]}`);});
  await setIndex(page,12);
  await page.waitForFunction(()=>Math.abs((document.querySelector('canvas')?.lunarSnapshot?.().index??NaN)-12)<1e-8,null,{timeout:5000});
  let at12=await snapshot(page);
  await waitRendered(page,{view:'overview',siteId:at12.rendered.siteId,height:at12.rendered.height,index:12,afterSerial:at12.rendered.serial});
  at12=await read();await canvas.focus();await page.keyboard.press('ArrowDown');
  await page.waitForFunction(q=>{const s=document.querySelector('canvas')?.lunarSnapshot?.();return s?.camera?.quaternion.some((v,i)=>Math.abs(v-q[i])>1e-5);},at12.camera.quaternion,{timeout:5000});
  const beforeRestart=await read();await page.getByRole('button',{name:UI.restart,exact:true}).click();
  await page.waitForFunction(q=>{const s=document.querySelector('canvas')?.lunarSnapshot?.();return s?.rendered?.ready&&Math.abs(s.index)<1e-6&&s.rendered.serial>q.serial;},{serial:beforeRestart.rendered.serial},{timeout:10000});
  const afterRestart=await read(),restartDot=Math.abs(afterRestart.camera.quaternion.reduce((a,v,i)=>a+v*beforeRestart.camera.quaternion[i],0));
  if(2*Math.acos(Math.min(1,restartDot))>=0.01)fail(`Restart unexpectedly reset the world camera while changing time: ${JSON.stringify({before:beforeRestart.camera.quaternion,after:afterRestart.camera.quaternion,dot:restartDot,index:afterRestart.index})}`);
  await page.evaluate(()=>{location.hash='#/home'});await page.locator('#main').waitFor();
  await page.evaluate(()=>{location.hash='#/simulator'});await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
  if(!finiteScene(await snapshot(page)))fail('simulator did not remount after route navigation');
  await context.close();return 'preset reset is evaluated at the paused index; Restart-to-zero preserves current world quaternion; route remount';
});

await check('capture Home, Compare, Surface sky and Local terrain at desktop and 390 px',async()=>{
  const captures=[];
  for(const [label,viewport,mobile] of [['desktop',{width:1440,height:900},false],['mobile-390',{width:390,height:844},true]]){
    const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
    const page=await context.newPage();watch(page,`capture-${label}`);
    for(const [route,name] of [['home','home'],['compare','compare']]){
      await page.goto(`${BASE}/#/${route}`,{waitUntil:'networkidle',timeout:60000});
      const opening=page.getByRole('dialog',{name:'Lunar Navigator'});
      if(await opening.count())await opening.waitFor({state:'hidden',timeout:4500});
      if(route==='home'&&await page.evaluate(()=>location.hash)!=='#/home'){
        await page.evaluate(()=>{location.hash='#/home';});await page.waitForFunction(()=>location.hash==='#/home');
      }
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

const report={base:BASE,browser:browser.version(),generatedAt:new Date().toISOString(),results,textTraces,issues};
mkdirSync(OUT,{recursive:true});writeFileSync(join(OUT,'results.json'),JSON.stringify(report,null,2));
console.log(`\n${results.filter(r=>r.ok).length}/${results.length} checks passed; results ${join(OUT,'results.json')}`);
await browser.close();
if(results.some(r=>!r.ok)||Object.values(issues).some(v=>v.length))process.exitCode=1;
