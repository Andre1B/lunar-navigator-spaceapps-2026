// Targeted QA for the current intro, animation, event-inspection, visual-mode,
// and non-WebGL comparison contracts. Not part of `npm test`.
//   node tests/browser-check-new-ui.mjs
//   QA_URL=https://... QA_OUT=../tmp/lunar-new-ui node tests/browser-check-new-ui.mjs
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Quaternion} from 'three';
import {interpolateBodyQuaternion} from '../src/lib/sceneGeometry.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const BASE=(process.env.QA_URL||'http://localhost:5173').replace(/\/$/,'');
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(ROOT,'..','tmp','lunar-new-ui');
const manifest=JSON.parse(readFileSync(join(ROOT,'public/data/manifest.json'),'utf8'));
const skyData=JSON.parse(readFileSync(join(ROOT,'public/data/sky.json'),'utf8'));
const results=[],issues={console:[],page:[],http:[],requestfailed:[]},contexts=[];
mkdirSync(OUT,{recursive:true});
const fail=(m)=>{throw new Error(m);};
function watch(page,tag){
  page.on('console',m=>{if(m.type()==='error')issues.console.push({tag,text:m.text().slice(0,300)});});
  page.on('pageerror',e=>issues.page.push({tag,text:String(e).slice(0,300)}));
  page.on('response',r=>{if(r.status()>=400)issues.http.push({tag,status:r.status(),url:r.url()});});
  page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')issues.requestfailed.push({tag,url:r.url(),error:r.failure()?.errorText});});
}
async function context(browser,tag,{viewport={width:1440,height:900},motion='no-preference',webglBlocked=false,touch=false}={}){
  const ctx=await browser.newContext({viewport,reducedMotion:motion,isMobile:touch,hasTouch:touch,deviceScaleFactor:touch?2:1});contexts.push(ctx);
  if(webglBlocked)await ctx.addInitScript(()=>{
    window.__qaWebglCalls=0;
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      if(type==='webgl'||type==='webgl2'||type==='experimental-webgl'){
        window.__qaWebglCalls++;
        throw new Error('WebGL disabled by Compare/export QA');
      }
      return original.call(this,type,...args);
    };
  });
  const page=await ctx.newPage();watch(page,tag);return {ctx,page};
}
async function go(page,route){
  await page.goto(`${BASE}/?qa=1#/${route}`,{waitUntil:'networkidle',timeout:60000});
  const opening=page.getByRole('dialog',{name:'Lunar Navigator'});
  if(await opening.count())await opening.waitFor({state:'hidden',timeout:4500});
  await page.locator('#main').waitFor({timeout:20000});
}
async function check(name,fn){const only=process.env.QA_ONLY?.toLowerCase().split('|').filter(Boolean)??[];if(only.length&&!only.some(fragment=>name.toLowerCase().includes(fragment)))return;const start=Date.now();try{const detail=await fn();results.push({name,ok:true,detail:detail??'',ms:Date.now()-start});console.log('PASS',name);}catch(e){results.push({name,ok:false,detail:String(e.message||e).split('\n')[0],ms:Date.now()-start});console.log('FAIL',name,String(e.message||e).split('\n')[0]);}}
async function launch(){const exe='C:/Program Files/Google/Chrome/Application/chrome.exe';const {existsSync}=await import('node:fs');for(const opts of [{channel:'chrome',headless:true},...(existsSync(exe)?[{executablePath:exe,headless:true}]:[]),{headless:true}]){try{return await chromium.launch(opts);}catch{}}throw new Error('Chrome/Chromium could not be launched');}
const browser=await launch();console.log('browser',browser.version(),'base',BASE);

await check('every normal-motion document load opens once and dismissal preserves Main focus/deep links',async()=>{
  const {ctx,page}=await context(browser,'opening-normal');
  await ctx.addInitScript(()=>sessionStorage.setItem('lunar-opening-v1','seen'));
  await ctx.addInitScript(()=>{
    window.__qaOpeningSeen=false;
    const observer=new MutationObserver(()=>{if(document.querySelector('.space-opening[role="dialog"]')){window.__qaOpeningSeen=true;observer.disconnect();}});
    observer.observe(document,{childList:true,subtree:true});
  });
  await page.goto(`${BASE}/?qa=1#/compare`,{waitUntil:'commit',timeout:60000});
  const dialog=page.getByRole('dialog',{name:'Lunar Navigator'});
  // A document-start MutationObserver can miss the initial insertion when
  // the browser attaches it before the document element exists. Observe the
  // actual modal as the primary assertion; keep the observer as supplemental
  // evidence and report both when the product expectation is not met.
  try{await dialog.waitFor({state:'visible',timeout:8000});}
  catch(error){
    const actual=await page.evaluate(()=>({seen:window.__qaOpeningSeen,visible:!!document.querySelector('.space-opening[role="dialog"]'),hash:location.hash,storage:sessionStorage.getItem('lunar-opening-v1'),body:document.body?.innerText?.slice(0,240)})).catch(()=>null);
    throw new Error(`full document load did not show the opening: ${JSON.stringify(actual)}; ${error.message.split('\n')[0]}`);
  }
  const observerRecorded=await page.evaluate(()=>window.__qaOpeningSeen);
  const initial=await page.evaluate(()=>({inert:document.querySelector('.app-shell')?.hasAttribute('inert'),focus:document.activeElement?.className}));
  if(!initial.inert||initial.focus!=='opening-skip')fail(`opening did not inert the app and focus Skip intro: ${JSON.stringify(initial)}`);
  const openingText=await page.evaluate(()=>['.opening-composition h1','.opening-composition p'].map(s=>{const e=document.querySelector(s),c=getComputedStyle(e);return{selector:s,animation:c.animationName,opacity:c.opacity};}));
  if(openingText.some(x=>x.animation!=='none'||x.opacity!=='1'))fail(`opening identity text should remain sharp while illustration animates: ${JSON.stringify(openingText)}`);
  await page.keyboard.press('Shift+Tab');
  if(await page.evaluate(()=>document.activeElement?.textContent?.trim())!=='Start exploring →')fail('Shift+Tab did not stay inside the opening dialog');
  await page.keyboard.press('Tab');
  if(await page.evaluate(()=>document.activeElement?.textContent?.trim())!=='Skip intro ↗')fail('Tab did not wrap within the opening dialog');
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.activeElement?.id==='main',null,{timeout:2000});
  const afterEscape=await page.evaluate(()=>({inert:document.querySelector('.app-shell')?.hasAttribute('inert'),hash:location.hash,focus:document.activeElement?.id,outline:getComputedStyle(document.activeElement).outlineStyle,selection:getSelection()?.toString()}));
  if(afterEscape.inert||afterEscape.hash!=='#/compare'||afterEscape.focus!=='main'||afterEscape.outline!=='none'||afterEscape.selection)fail(`Escape did not preserve Compare and restore clean Main focus: ${JSON.stringify(afterEscape)}`);
  await page.getByRole('link',{name:'How it works',exact:true}).click();await page.waitForFunction(()=>location.hash==='#/learn',null,{timeout:5000});
  if(await page.getByRole('dialog',{name:'Lunar Navigator'}).count())fail('SPA route change reopened the opening');
  // Change the query too: changing only the hash is an SPA/same-document
  // navigation and correctly does not replay the full-document opening.
  await page.goto(`${BASE}/?qa=2#/evidence`,{waitUntil:'commit',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('.space-opening[role="dialog"]')!==null,null,{timeout:8000});
  await page.getByRole('dialog',{name:'Lunar Navigator'}).waitFor({timeout:1200});
  await page.getByRole('button',{name:/Skip intro/}).click();
  await page.waitForFunction(()=>document.activeElement?.id==='main',null,{timeout:2000});
  const afterSkip=await page.evaluate(()=>({hash:location.hash,focus:document.activeElement?.id,outline:getComputedStyle(document.activeElement).outlineStyle,selection:getSelection()?.toString()}));
  if(afterSkip.hash!=='#/evidence'||afterSkip.focus!=='main'||afterSkip.outline!=='none'||afterSkip.selection)fail(`Skip did not preserve Evidence and restore clean Main focus: ${JSON.stringify(afterSkip)}`);
  await page.goto(`${BASE}/?qa=3#/home`,{waitUntil:'commit',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('.space-opening[role="dialog"]')!==null,null,{timeout:8000});
  await page.getByRole('dialog',{name:'Lunar Navigator'}).waitFor({timeout:1200});
  await page.getByRole('dialog').waitFor({state:'hidden',timeout:4500});
  await page.waitForFunction(()=>location.hash==='#/home',null,{timeout:5000});
  await page.waitForFunction(()=>document.activeElement?.id==='main',null,{timeout:2000});
  const afterAuto=await page.evaluate(()=>({focus:document.activeElement?.id,outline:getComputedStyle(document.activeElement).outlineStyle,selection:getSelection()?.toString()}));
  if(afterAuto.focus!=='main'||afterAuto.outline!=='none'||afterAuto.selection)fail(`Home autoclose did not restore clean Main focus: ${JSON.stringify(afterAuto)}`);
  await page.getByRole('button',{name:/Open the simulator/}).click();await page.waitForFunction(()=>location.hash==='#/simulator',null,{timeout:10000});
  if(await page.getByRole('dialog',{name:'Lunar Navigator'}).count())fail('Home-to-Simulator SPA entry repeated the opening');
  await ctx.close();return `same tab/storage: 3 full loads show intro; SPA route does not; Escape/Skip preserve deep link; Home autoclose stays Home; CTA enters Simulator; Main focus outline/selection clear; pre-mount observer=${observerRecorded?'saw opening':'missed (DOM visibility assertion passed)'}`;
});

await check('route motion uses one non-opacity animated ancestor and watches only child-list additions',async()=>{
  const {ctx,page}=await context(browser,'route-motion-contract');
  await ctx.addInitScript(()=>{
    window.__qaMutationConfigs=[];
    const original=MutationObserver.prototype.observe;
    MutationObserver.prototype.observe=function(target,options){
      if(target instanceof HTMLElement&&target.tagName==='MAIN')window.__qaMutationConfigs.push({...options});
      return original.call(this,target,options);
    };
  });
  await go(page,'compare');await page.waitForTimeout(800);
  const report=await page.evaluate(()=>{
    const main=document.querySelector('main'),h=main?.querySelector('h1');
    const chain=[];for(let e=h;e&&e!==main.parentElement;e=e.parentElement){const c=getComputedStyle(e);chain.push({tag:e.tagName,className:String(e.className||''),animation:c.animationName,opacity:c.opacity,animations:e.getAnimations().filter(a=>a.playState==='running').map(a=>a.effect?.getKeyframes()??[])});}
    const observers=window.__qaMutationConfigs??[];
    return{chain,observers,hash:location.hash};
  });
  const textStyle=report.chain[0];if(!textStyle||textStyle.animation!=='none'||textStyle.opacity!=='1')fail(`route heading is CSS animated/faded: ${JSON.stringify(textStyle)}`);
  const animatedAncestors=report.chain.filter(x=>x.animations.length>0);
  if(animatedAncestors.length>1)fail(`more than one animated ancestor wraps route text: ${JSON.stringify(animatedAncestors.map(x=>x.className))}`);
  const opacityFrames=animatedAncestors.flatMap(x=>x.animations.flat()).some(k=>'opacity'in k);
  if(opacityFrames)fail('route text inherits an opacity fade from its animated ancestor');
  if(!report.observers.some(o=>o.childList===true&&o.subtree===true&&!o.attributes&&!o.characterData))fail(`no child-list-only MutationObserver on main: ${JSON.stringify(report.observers)}`);
  await ctx.close();return `${report.hash}; animated ancestors=${animatedAncestors.length}; opacity fade=none; Main observer childList/subtree only`;
});

await check('reduced-motion suppresses automatic intro and Replay opening stays static',async()=>{
  const {ctx,page}=await context(browser,'opening-reduced',{motion:'reduce'});
  await page.goto(`${BASE}/?qa=1#/home`,{waitUntil:'networkidle',timeout:60000});
  if(await page.getByRole('dialog',{name:'Lunar Navigator'}).count())fail('reduced-motion first visit auto-opened the intro');
  await page.getByRole('button',{name:'Replay the opening'}).click();
  const dialog=page.getByRole('dialog',{name:'Lunar Navigator'});await dialog.waitFor();
  const animation=await page.locator('.opening-craft').evaluate(e=>getComputedStyle(e).animationName);
  if(animation!=='none')fail(`replay intro animates under reduced motion: ${animation}`);
  await page.waitForTimeout(2700);if(!await dialog.isVisible())fail('reduced-motion replay auto-dismissed before the user chose');
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await ctx.close();
  return 'no automatic opening; replay remains static and user-dismissible';
});

await check('background music starts enabled, reports blocked autoplay as Ready, unlocks on gesture and persists Off',async()=>{
  const {ctx,page}=await context(browser,'background-music');
  await ctx.addInitScript(()=>{
    window.__qaAudioContexts=[];
    window.__qaAudioGesture=false;
    const Native=window.AudioContext;
    if(Native){
      const resume=Native.prototype.resume;
      Native.prototype.resume=function(...args){
        if(!window.__qaAudioGesture)return Promise.reject(new DOMException('Blocked until first gesture','NotAllowedError'));
        return resume.apply(this,args);
      };
      window.AudioContext=class extends Native{constructor(...args){super(...args);window.__qaAudioContexts.push(this);}};
      window.addEventListener('pointerdown',event=>{if(!event.target?.closest?.('.music-toggle'))window.__qaAudioGesture=true;},true);
      window.addEventListener('keydown',event=>{if(!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key!=='Escape')window.__qaAudioGesture=true;},true);
    }
  });
  await go(page,'home');
  const toggle=page.locator('.music-toggle');await toggle.waitFor();
  let audio=await page.evaluate(()=>({contexts:window.__qaAudioContexts?.length??0,state:window.__qaAudioContexts?.[0]?.state,pressed:document.querySelector('.music-toggle')?.getAttribute('aria-pressed'),playing:document.querySelector('.music-toggle')?.getAttribute('data-playing'),label:document.querySelector('.music-toggle')?.innerText?.trim()}));
  if(audio.pressed!=='true')fail(`music should be enabled by default: ${JSON.stringify(audio)}`);
  if(audio.playing!=='false'||audio.state!=='suspended'||audio.label!=='Music Ready')fail(`blocked autoplay must show truthful Ready, not On: ${JSON.stringify(audio)}`);
  if(audio.contexts!==1)fail(`automatic attempt should keep at most one suspended AudioContext, got ${JSON.stringify(audio)}`);
  await page.getByRole('link',{name:'Compare',exact:true}).click();
  await page.waitForFunction(()=>location.hash==='#/compare',null,{timeout:5000});
  await page.waitForFunction(()=>{const b=document.querySelector('.music-toggle'),c=window.__qaAudioContexts?.[0];return b?.getAttribute('data-playing')==='true'&&c?.state==='running';},null,{timeout:5000});
  audio=await page.evaluate(()=>({contexts:window.__qaAudioContexts?.length??0,state:window.__qaAudioContexts?.[0]?.state,pressed:document.querySelector('.music-toggle')?.getAttribute('aria-pressed'),playing:document.querySelector('.music-toggle')?.getAttribute('data-playing'),label:document.querySelector('.music-toggle')?.innerText?.trim()}));
  if(audio.contexts!==1||audio.state!=='running'||audio.pressed!=='true'||audio.playing!=='true'||audio.label!=='Music On')fail(`first non-music gesture did not unlock truthful playback: ${JSON.stringify(audio)}`);
  const settings=page.locator('details.music-settings'),summary=page.getByLabel('Music volume and credits');
  await summary.click();if(!await settings.evaluate(e=>e.open))fail('volume and credits disclosure did not open');
  const volume=page.locator('#music-volume');
  const setVolume=async(value)=>volume.evaluate((e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,String(v));e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},value);
  await setVolume(0);
  if((await page.locator('output[for="music-volume"]').innerText()).trim()!=='0%')fail('volume slider did not expose its muted value');
  await page.keyboard.press('Escape');if(await settings.evaluate(e=>e.open))fail('Escape did not close the music settings');
  if(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))!=='Music volume and credits')fail('Escape did not return focus to the music settings button');
  await summary.click();await setVolume(35);
  await page.getByRole('button',{name:'Music On',exact:true}).click();
  await page.getByRole('button',{name:'Music Off',exact:true}).waitFor({timeout:5000});
  await page.waitForFunction(()=>window.__qaAudioContexts?.[0]?.state==='suspended',null,{timeout:5000});
  const paused=await page.evaluate(()=>window.__qaAudioContexts[0].currentTime);await page.waitForTimeout(250);
  const settled=await page.evaluate(()=>({contexts:window.__qaAudioContexts.length,state:window.__qaAudioContexts[0].state,time:window.__qaAudioContexts[0].currentTime}));
  if(settled.contexts!==1||settled.state!=='suspended'||Math.abs(settled.time-paused)>0.01)fail(`Music Off did not suspend and hold the same AudioContext: ${JSON.stringify({paused,settled})}`);
  const preference=await page.evaluate(()=>localStorage.getItem('lunar-music-v1'));if(preference!=='off')fail(`Music Off was not persisted: ${preference}`);
  await page.reload({waitUntil:'networkidle',timeout:60000});
  await page.getByRole('button',{name:'Music Off',exact:true}).waitFor({timeout:5000});
  const reload=await page.evaluate(()=>({contexts:window.__qaAudioContexts?.length??0,pressed:document.querySelector('.music-toggle')?.getAttribute('aria-pressed'),playing:document.querySelector('.music-toggle')?.getAttribute('data-playing'),label:document.querySelector('.music-toggle')?.innerText?.trim(),preference:localStorage.getItem('lunar-music-v1')}));
  if(reload.contexts!==0||reload.pressed!=='false'||reload.playing!=='false'||reload.label!=='Music Off'||reload.preference!=='off')fail(`persisted Off did not survive a full reload without starting audio: ${JSON.stringify(reload)}`);
  await ctx.close();return 'enabled default; simulated autoplay block is truthful Ready on one suspended context; first non-music gesture unlocks one running context; volume reaches 0%; Escape restores focus; Off suspends and persists across reload without a new context';
});

await check('Learn walkthrough advances, pauses without advancing and its manual CTA navigates',async()=>{
  const {ctx,page}=await context(browser,'learn-walkthrough');await go(page,'learn');
  const widget=page.locator('.animated-explainer');await widget.waitFor();
  const play=widget.getByRole('button',{name:'Play walkthrough'});await play.click();
  if(await widget.getByRole('button',{name:'Pause walkthrough'}).getAttribute('aria-pressed')!=='true')fail('Play walkthrough did not enter playing state');
  await page.waitForFunction(()=>document.querySelector('.explainer-count')?.textContent.trim()==='02 / 04',null,{timeout:7000});
  await widget.getByRole('button',{name:'Pause walkthrough'}).click();
  const paused=await widget.locator('.explainer-count').innerText();await page.waitForTimeout(5700);
  if(await widget.locator('.explainer-count').innerText()!==paused)fail('walkthrough advanced after Pause');
  await widget.getByRole('button',{name:/4 Read a duration, then inspect it/}).click();
  if((await widget.locator('.explainer-count').innerText()).trim()!=='04 / 04')fail('manual step selection did not reach step 4');
  await widget.getByRole('button',{name:'Check the evidence'}).click();
  await page.waitForFunction(()=>location.hash==='#/evidence',null,{timeout:5000});await ctx.close();
  return 'Play → step 2; Pause holds; manual step 4 CTA opens Evidence';
});

await check('Home delay briefing recomputes two real rows and its CTA applies the selected settings to Compare',async()=>{
  const {ctx,page}=await context(browser,'home-delay-briefing');await go(page,'home');
  const briefing=page.locator('.delay-briefing');await briefing.waitFor();
  const rows=briefing.locator('.briefing-results article');await rows.first().waitFor({timeout:30000});
  if(await rows.count()!==2)fail(`delay briefing should show two comparison rows, got ${await rows.count()}`);
  const signatures=[];
  for(const delay of [3,7,14]){
    const b=briefing.getByRole('button',{name:`+${delay} days`,exact:true});await b.click();
    if(await b.getAttribute('aria-pressed')!=='true')fail(`+${delay} days is not selected`);
    await page.waitForFunction(d=>document.querySelector('.delay-briefing .briefing-results')?.textContent.includes(`Arrive ${d} days later`),delay,{timeout:5000});
    if(await rows.count()!==2)fail(`+${delay} days produced ${await rows.count()} rows`);
    const values=await rows.allTextContents();if(values.some(t=>/Not calculated|Loading the real/i.test(t)))fail(`+${delay} days did not produce calculated data`);
    signatures.push(values.join('|'));
    if(delay===14){await briefing.getByRole('button',{name:/Change the place, date or height/}).click();await page.waitForFunction(()=>location.hash==='#/compare',null,{timeout:10000});}
  }
  if(new Set(signatures).size<2)fail('delay choices did not change the comparison rows');
  const applied={site:await page.locator('#site').inputValue(),alternative:await page.locator('#alternative').inputValue(),height:await page.locator('#height').inputValue(),date:await page.locator('#arrival').inputValue(),days:await page.locator('#days').inputValue(),delay:await page.locator('#delay').inputValue()};
  if(JSON.stringify(applied)!==JSON.stringify({site:'connecting-ridge',alternative:'shackleton-rim',height:'1',date:'2027-03-01',days:'7',delay:'14'}))fail(`Home briefing CTA did not apply its settings: ${JSON.stringify(applied)}`);
  await ctx.close();return `three delays update two rows; Compare receives ${JSON.stringify(applied)}`;
});

await check('Arrival calendar keyboard, bounds, invalid ISO text and export remain honest at desktop and mobile',async()=>{
  const reports=[];
  for(const [label,viewport,mobile] of [['desktop',{width:1440,height:900},false],['mobile-390',{width:390,height:844},true]]){
    const {ctx,page}=await context(browser,`arrival-calendar-${label}`,{viewport});await go(page,'compare');
    const input=page.locator('#arrival'),trigger=page.getByRole('button',{name:'Choose arrival date',exact:true});
    if(await input.getAttribute('type')!=='text')fail(`${label}: arrival input must preserve editable ISO text`);
    await trigger.click();const dialog=page.getByRole('dialog');await dialog.waitFor();
    if(await dialog.getAttribute('aria-modal')!=='false')fail(`${label}: calendar should be a nonmodal dialog`);
    const monthHeading=(date)=>new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(date);
    const startDay=manifest.period.startUtc.slice(0,10),endDay=manifest.period.endUtc.slice(0,10),startDate=new Date(`${startDay}T00:00:00Z`),endDate=new Date(`${endDay}T00:00:00Z`);
    const monthSelect=page.getByLabel('Calendar month'),yearSelect=page.getByLabel('Calendar year');
    const initialValue=await input.inputValue(),initialDate=new Date(`${initialValue}T00:00:00Z`);
    if((await dialog.locator('.calendar-heading h3').innerText()).trim()!==monthHeading(initialDate))fail(`${label}: initial month does not match the selected ISO date`);
    if(await monthSelect.inputValue()!==String(initialDate.getUTCMonth())||await yearSelect.inputValue()!==String(initialDate.getUTCFullYear()))fail(`${label}: Month/Year selectors do not match selected date`);
    await page.getByRole('button',{name:'Previous month',exact:true}).waitFor();
    await yearSelect.selectOption(String(startDate.getUTCFullYear()));await monthSelect.selectOption(String(startDate.getUTCMonth()));
    await page.waitForFunction(h=>document.querySelector('.calendar-heading h3')?.textContent.trim()===h,monthHeading(startDate));
    if(!await page.getByRole('button',{name:'Previous month',exact:true}).isDisabled())fail(`${label}: previous-month navigation should be disabled at coverage start ${startDay}`);
    if(!await dialog.locator(`[data-day="${new Date(startDate.getTime()-86400000).toISOString().slice(0,10)}"]`).isDisabled())fail(`${label}: date before computed coverage should be disabled`);
    await yearSelect.selectOption(String(endDate.getUTCFullYear()));await monthSelect.selectOption(String(endDate.getUTCMonth()));
    await page.waitForFunction(h=>document.querySelector('.calendar-heading h3')?.textContent.trim()===h,monthHeading(endDate));
    if(!await page.getByRole('button',{name:'Next month',exact:true}).isDisabled())fail(`${label}: next-month navigation should be disabled at coverage end ${endDay}`);
    if(!await dialog.locator(`[data-day="${new Date(endDate.getTime()+86400000).toISOString().slice(0,10)}"]`).isDisabled())fail(`${label}: date after computed coverage should be disabled`);
    const layout=await page.evaluate(()=>{const r=document.querySelector('.calendar-popover').getBoundingClientRect();return{vw:innerWidth,vh:innerHeight,scrollWidth:document.documentElement.scrollWidth,rect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};});
    if(layout.scrollWidth>layout.vw+1||layout.rect.x<0||layout.rect.y<0||layout.rect.right>layout.vw+1||layout.rect.bottom>layout.vh+1)fail(`${label}: calendar overflows viewport: ${JSON.stringify(layout)}`);
    const before=await input.inputValue();await page.keyboard.press('Escape');
    await dialog.waitFor({state:'hidden'});
    if(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))!=='Choose arrival date')fail(`${label}: Escape did not return focus to the calendar trigger`);
    if(await input.inputValue()!==before)fail(`${label}: Escape changed the typed arrival date`);
    await trigger.click();
    await page.keyboard.press('PageDown');
    const nextMonth=Date.UTC(initialDate.getUTCFullYear(),initialDate.getUTCMonth()+1,1),nextLast=new Date(Date.UTC(initialDate.getUTCFullYear(),initialDate.getUTCMonth()+2,0)).getUTCDate(),nextActive=Date.UTC(initialDate.getUTCFullYear(),initialDate.getUTCMonth()+1,Math.min(initialDate.getUTCDate(),nextLast)),endOfWeek=nextActive+(6-((new Date(nextActive).getUTCDay()+6)%7))*86400000,keyboardDay=new Date(endOfWeek).toISOString().slice(0,10);
    await page.waitForFunction(h=>document.querySelector('.calendar-heading h3')?.textContent.trim()===h,monthHeading(new Date(nextMonth)));
    await page.keyboard.press('End');
    await page.waitForFunction(d=>document.activeElement?.getAttribute('data-day')===d,keyboardDay);
    await page.keyboard.press('Enter');await dialog.waitFor({state:'hidden'});
    if(await input.inputValue()!==keyboardDay)fail(`${label}: keyboard-selected calendar day ${keyboardDay} was not applied`);
    const invalidDates=['2027-02-31','2027-03-32','03/01/2027','2027-03','2027-03-01T00:00:00Z',''];
    for(const date of invalidDates){
      await input.fill(date);
      await page.waitForFunction(v=>{const el=document.querySelector('#arrival'),cards=[...document.querySelectorAll('.answer-scenario')];return el?.value===v&&cards.length===3&&cards.every(c=>c.querySelector('dd')?.textContent.trim()==='Not calculated');},date,{timeout:5000});
      if(date&&await input.getAttribute('aria-invalid')!=='true')fail(`${label}: invalid raw date ${JSON.stringify(date)} is not marked invalid`);
      if(await input.inputValue()!==date)fail(`${label}: invalid raw text ${JSON.stringify(date)} was not preserved for correction`);
    }
    await input.fill('2027-03-01');
    await page.waitForFunction(()=>[...document.querySelectorAll('.answer-scenario')].length===3&&[...document.querySelectorAll('.answer-scenario')].every(c=>c.querySelector('dd')?.textContent.trim()!=='Not calculated'),null,{timeout:10000});
    await input.fill('2027-02-31');
    await page.getByText('Full measurements, methods and a darkness limit',{exact:true}).click();
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:/Download comparison.*JSON/}).click();
    const download=await downloadPromise,file=join(OUT,`${label}-${download.suggestedFilename()}`);await download.saveAs(file);
    const report=JSON.parse(readFileSync(file,'utf8'));
    if(report.settings?.date!=='2027-02-31'||report.scenarios?.length!==3||!report.scenarios.every(s=>s.status==='not-calculated'&&s.startUtc===null&&s.endUtc===null&&s.summary===null))fail(`${label}: invalid date leaked a computed value into export: ${JSON.stringify(report.scenarios?.map(s=>({status:s.status,startUtc:s.startUtc,endUtc:s.endUtc,summary:s.summary})))}`);
    reports.push(`${label}: month bounds, keyboard select/Escape, raw invalid date preservation, 3 not-calculated rows/export, no overflow`);await ctx.close();
  }
  return reports.join('; ');
});

await check('Next event ±5 minute inspection pauses Play and jumps to the exact sky timestamp',async()=>{
  const {ctx,page}=await context(browser,'next-events');await go(page,'simulator');
  await page.waitForFunction(()=>document.querySelector('.next-events-item .next-events-time'),null,{timeout:30000});
  if(await page.getByRole('button',{name:'Play',exact:true}).isVisible())await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Playing'}).waitFor({timeout:5000});
  await page.waitForTimeout(120);
  const groups=page.locator('.next-events-item');let chosen=null;
  for(let i=0;i<await groups.count();i++){
    const g=groups.nth(i),button=g.getByRole('button',{name:'5 min before',exact:true});
    if(await button.count()&&await button.isEnabled()){
      const utc=await g.locator('time').getAttribute('datetime');chosen={g,button,utc};break;
    }
  }
  if(!chosen)fail('no in-coverage 5 min before action is enabled');
  const target=(Date.parse(chosen.utc)-5*60000-Date.parse(manifest.period.startUtc))/(manifest.period.stepMinutes*60000);
  await chosen.button.click();
  await page.waitForFunction((t)=>{
    const c=document.querySelector('canvas')?.lunarSnapshot?.(),status=document.querySelector('.playback-status')?.textContent??'';
    return c?.view==='sky'&&!status.startsWith('Playing')&&Math.abs(c.index-t)<0.02;
  },target,{timeout:20000});
  const s=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.());
  if(Math.abs(s.rendered?.presentedIndex-target)>0.02)fail(`rendered timestamp not at 5-minute target: ${s.rendered?.presentedIndex} vs ${target}`);
  await ctx.close();return `paused in Surface sky at index ${s.index.toFixed(3)} for ${chosen.utc}`;
});

await check('Surface sky follows Sun and Earth through changing time; zoom keeps tracking, manual camera input releases it',async()=>{
  const {ctx,page}=await context(browser,'sky-tracking');await go(page,'simulator');
  await page.locator('.camera-presets button').filter({hasText:'Surface sky'}).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.ready===true&&document.querySelector('canvas')?.lunarSnapshot?.().view==='sky',null,{timeout:30000});
  const sunToggle=page.getByRole('button',{name:/^Keep following Sun/});
  await sunToggle.waitFor();if(await sunToggle.getAttribute('aria-pressed')!=='true')fail('Surface sky should default to current-Sun tracking');
  await sunToggle.click();await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().skyTracking==null,null,{timeout:5000});
  if(await sunToggle.getAttribute('aria-pressed')!=='false')fail('Keep following Sun Off did not release tracking');
  await sunToggle.click();await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().skyTracking==='sun',null,{timeout:5000});
  if(await sunToggle.getAttribute('aria-pressed')!=='true')fail('Keep following Sun On did not begin tracking');
  await page.getByLabel('Speed').selectOption('24');
  const read=()=>page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.());
  const errorDeg=(s,id)=>{
    const p=s?.bodies?.[id]?.position,c=s?.camera?.position,d=s?.camera?.direction;
    if(!p||!c||!d)return Infinity;
    const v=p.map((x,i)=>x-c[i]),n=Math.hypot(...v),dot=d.reduce((a,x,i)=>a+x*v[i]/n,0);
    return Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
  };
  const follow=async(id,label)=>{
    const before=await read();
    await page.getByRole('button',{name:`Look at ${label}`,exact:true}).click();
    await page.waitForFunction(body=>document.querySelector('canvas')?.lunarSnapshot?.().skyTracking===body,id,{timeout:5000});
    await page.waitForTimeout(100);
    const initial=await read();if(errorDeg(initial,id)>0.6)fail(`${label} was not centered on click (${errorDeg(initial,id).toFixed(3)}°)`);
    if(await page.getByRole('button',{name:'Play',exact:true}).isVisible())await page.getByRole('button',{name:'Play',exact:true}).click();
    await page.waitForFunction(start=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.presentedIndex>=start+24,before.rendered.presentedIndex,{timeout:7000});
    const after=await read();if(after.skyTracking!==id)fail(`${label} follow ended when time changed`);
    if(errorDeg(after,id)>0.6)fail(`${label} tracking drifted ${errorDeg(after,id).toFixed(3)}° after time advanced`);
    return {before:before.rendered.presentedIndex,after:after.rendered.presentedIndex,error:errorDeg(after,id)};
  };
  const sun=await follow('sun','Sun');
  const earth=await follow('earth','Earth');
  if(await sunToggle.getAttribute('aria-pressed')!=='false')fail('following Earth incorrectly leaves the Sun-follow toggle On');

  await page.getByRole('button',{name:/^Free Mode/}).click();
  const earthPosition=page.locator('.freeze-controls label').filter({hasText:/Earth.*position/}).locator('input');
  await earthPosition.check();
  const frozen=await read();await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.waitForFunction(start=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.presentedIndex>=start+12,frozen.rendered.presentedIndex,{timeout:7000});
  const frozenAfter=await read();
  if(frozenAfter.skyTracking!=='earth')fail('Earth follow was lost in Free Mode');
  const bodyDrift=Math.hypot(...frozen.bodies.earth.position.map((v,i)=>v-frozenAfter.bodies.earth.position[i]));
  if(bodyDrift>1e-6)fail(`Free Mode did not hold Earth position (drift ${bodyDrift})`);
  if(errorDeg(frozenAfter,'earth')>0.6)fail(`Earth follow did not track its frozen position (${errorDeg(frozenAfter,'earth').toFixed(3)}°)`);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const canvas=page.locator('canvas').first();await canvas.focus();
  const zoomSerial=(await read()).rendered.serial;await page.keyboard.press('Equal');
  await page.waitForFunction(s=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.serial!==s,zoomSerial,{timeout:5000});
  if((await read()).skyTracking!=='earth')fail('zoom unexpectedly released Earth tracking');
  await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().skyTracking==null,null,{timeout:5000});
  if(await page.getByRole('button',{name:/Stop following/}).count())fail('keyboard look did not release the follow control');
  if(await sunToggle.getAttribute('aria-pressed')!=='false')fail('manual keyboard look did not turn Sun-follow Off');

  await page.getByRole('button',{name:'Look at Sun',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().skyTracking==='sun',null,{timeout:5000});
  const box=await canvas.boundingBox();if(!box)fail('Surface sky canvas has no bounds for manual drag release');
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.5,{steps:3});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().skyTracking==null,null,{timeout:5000});
  await ctx.close();return `Sun ${sun.before}->${sun.after}, error ${sun.error.toFixed(3)}°; Earth ${earth.before}->${earth.after}, error ${earth.error.toFixed(3)}°; Free frozen Earth tracks; zoom retains follow; key and drag release`;
});

await check('Surface sky modes, labels, options and direct sunlit-terrain path update the rendered scene',async()=>{
  const {ctx,page}=await context(browser,'surface-options');await go(page,'simulator');
  await page.locator('.camera-presets button').filter({hasText:'Surface sky'}).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.view==='sky'&&document.querySelector('canvas')?.lunarSnapshot?.().rendered?.ready===true,null,{timeout:30000});
  const guide=await page.locator('.sky-view-guide').innerText();
  if(!/40 m terrain/i.test(guide)||!/not a photograph/i.test(guide))fail(`Surface sky lacks its terrain/illustration limitation: ${guide}`);
  for(const label of ['Look at Sun','Look at Earth','See sunlit terrain'])if(!await page.getByRole('button',{name:label,exact:true}).isVisible())fail(`${label} action is not visible`);
  await page.getByRole('button',{name:'Horizon diagram',exact:true}).click();
  if((await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.().surface?.style))!=='diagram')fail('Horizon diagram did not change surface style');
  await page.getByRole('button',{name:'Lunar surface',exact:true}).click();
  if((await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.().surface?.style))!=='terrain')fail('Lunar surface did not restore the terrain style');
  const toggles=[['Draw light paths','lightPaths'],['Optical glare','glare'],['Detailed shadows','detailedShadows']];
  for(const [index,[inputName,key]] of toggles.entries()){const box=page.locator('.scene-visual-options input').nth(index);
    await box.check();if(await page.evaluate(k=>document.querySelector('canvas')?.lunarSnapshot?.().surface?.[k],key)!==true)fail(`${inputName} was not reflected in the rendered-scene snapshot`);
    await box.uncheck();if(await page.evaluate(k=>document.querySelector('canvas')?.lunarSnapshot?.().surface?.[k],key)!==false)fail(`${inputName} did not switch off`);
  }
  const siteId=await page.locator('#explorer-site').inputValue(),height=await page.locator('#explorer-height').inputValue();
  const siteData=JSON.parse(readFileSync(join(ROOT,'public','data','sites',`${siteId}.json`),'utf8'));
  const fractions=siteData.sun.visibleFraction[String(height)],hiddenIndex=fractions.findIndex(v=>v===0),litIndex=fractions.findIndex(v=>v>0.9);
  if(hiddenIndex<0||litIndex<0)fail(`chosen site/height lacks hidden and well-lit samples: ${siteId}/${height}`);
  const setTime=async(index)=>{
    await page.evaluate(i=>{const e=document.querySelector('#time-slider');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,String(i));e.dispatchEvent(new Event('input',{bubbles:true}));},index);
    await page.waitForFunction(i=>{const s=document.querySelector('canvas')?.lunarSnapshot?.();return s?.rendered?.ready&&Math.abs(s?.rendered?.presentedIndex-i)<0.01&&Math.abs(s?.observation?.index-i)<0.01;},index,{timeout:20000});
  };
  const glare=page.locator('.scene-visual-options input').nth(1),canvas=page.locator('canvas').first();
  const shotHash=async()=>createHash('sha256').update(await canvas.screenshot()).digest('hex');
  const toggleHashes=async(index)=>{
    await setTime(index);await page.getByRole('button',{name:'Look at Sun',exact:true}).click();await page.waitForTimeout(150);
    const sun=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.().observation?.sun);
    if(!await glare.isChecked())await glare.check();
    const serial=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.serial);
    await glare.uncheck();await page.waitForFunction(s=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.serial!==s,serial,{timeout:5000});const off=await shotHash();
    const next=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.serial);
    await glare.check();await page.waitForFunction(s=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.serial!==s,next,{timeout:5000});const on=await shotHash();
    return {sun,off,on};
  };
  const hidden=await toggleHashes(hiddenIndex);
  if(hidden.sun!==0)fail(`hidden-Sun glare sample should have exact fraction 0, got ${hidden.sun}`);
  if(hidden.off!==hidden.on)fail('glare toggle changed the Surface sky image while the Sun was fully terrain-occluded');
  const lit=await toggleHashes(litIndex);
  if(!(lit.sun>0))fail(`positive-Sun glare sample is not visible: ${lit.sun}`);
  if(lit.off===lit.on)fail('glare toggle produced no visible change when the Sun was above the terrain horizon');
  await page.getByRole('button',{name:'See sunlit terrain',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().view==='terrain',null,{timeout:10000});await ctx.close();
  return 'horizon diagram/real terrain, 3 optional visual controls, direct terrain action';
});

await check('Enhanced vision is off by default, adds illustrative outlines in three views, and leaves science unchanged',async()=>{
  const {ctx,page}=await context(browser,'enhanced-vision');await go(page,'simulator');
  if(await page.getByRole('button',{name:'Pause',exact:true}).isVisible())await page.getByRole('button',{name:'Pause',exact:true}).click();
  const setTime=async(index)=>{
    await page.evaluate(i=>{const e=document.querySelector('#time-slider');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,String(i));e.dispatchEvent(new Event('input',{bubbles:true}));},index);
    await page.waitForFunction(i=>{const s=document.querySelector('canvas')?.lunarSnapshot?.();return s?.rendered?.ready&&Math.abs(s?.rendered?.presentedIndex-i)<0.01&&Math.abs(s?.index-i)<0.01;},index,{timeout:20000});
  };
  await setTime(420);
  const toggle=page.getByRole('button',{name:'Enhanced vision',exact:true});await toggle.waitFor();
  const cases=[['overview','Moon orbit','lunar limb'],['sky','Surface sky','calculated terrain horizon'],['terrain','Local terrain','20 km terrain window']];
  const reports=[];
  const capture=async()=>page.locator('canvas').first().screenshot();
  const pixelDiff=async(a,b)=>page.evaluate(async ([left,right])=>{
    const decode=(b64)=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=`data:image/png;base64,${b64}`;});
    const [x,y]=await Promise.all([decode(left),decode(right)]);if(x.width!==y.width||x.height!==y.height)throw new Error(`PNG dimensions differ: ${x.width}x${x.height} vs ${y.width}x${y.height}`);
    const canvas=document.createElement('canvas');canvas.width=x.width;canvas.height=x.height;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(x,0,0);const a=c.getImageData(0,0,x.width,x.height).data;c.clearRect(0,0,x.width,x.height);c.drawImage(y,0,0);const b=c.getImageData(0,0,x.width,x.height).data;
    let changedPixels=0,maxChannelDelta=0,pixelsOver8=0;for(let i=0;i<a.length;i+=4){let m=0;for(let k=0;k<3;k++)m=Math.max(m,Math.abs(a[i+k]-b[i+k]));if(m){changedPixels++;maxChannelDelta=Math.max(maxChannelDelta,m);if(m>8)pixelsOver8++;}}
    return{width:x.width,height:x.height,totalPixels:x.width*x.height,changedPixels,fraction:changedPixels/(x.width*x.height),maxChannelDelta,pixelsOver8};
  },[a.toString('base64'),b.toString('base64')]);
  const sceneMeta=()=>page.evaluate(()=>{const canvas=document.querySelector('.space-canvas canvas'),s=canvas?.lunarSnapshot?.(),r=canvas?.getBoundingClientRect();return{camera:s?.camera,index:s?.index,rendered:s?.rendered,enhancedVision:s?.surface?.enhancedVision,drawingBuffer:canvas?[canvas.width,canvas.height]:null,cssRect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,dpr:devicePixelRatio,textureResources:performance.getEntriesByType('resource').map(x=>x.name).filter(x=>/\.(?:jpe?g|png|webp|ktx2?)(?:\?|$)/i.test(x)).slice(-20)};});
  const settleCamera=async()=>{
    await page.evaluate(()=>{window.__qaStableVisionQ=null;window.__qaStableVisionN=0;});
    await page.waitForFunction(()=>{const c=document.querySelector('canvas')?.lunarSnapshot?.()?.camera,q=c?.quaternion;if(!q)return false;const prev=window.__qaStableVisionQ,n=(window.__qaStableVisionN??0)+1;window.__qaStableVisionN=prev&&Math.max(...q.map((v,i)=>Math.abs(v-prev[i])))<1e-8?n:0;window.__qaStableVisionQ=q;return window.__qaStableVisionN>=5;},null,{timeout:10000});
  };
  const stableCapture=async()=>{let previous=await capture();for(let i=0;i<6;i++){await page.waitForTimeout(55);const next=await capture(),delta=await pixelDiff(previous,next);if(delta.changedPixels<=2&&delta.maxChannelDelta<=1)return next;previous=next;}return null;};
  for(const [view,label,expectedDescription] of cases){
    await page.locator('.camera-presets button').filter({hasText:label}).click();
    await page.waitForFunction(v=>{const s=document.querySelector('canvas')?.lunarSnapshot?.();return s?.rendered?.ready&&s.rendered.view===v;},view,{timeout:30000});
    await settleCamera();
    const before=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.());
    if(before.surface?.enhancedVision!==false)fail(`${view}: Enhanced vision should start Off`);
    if(await toggle.getAttribute('aria-pressed')!=='false'||!/Off/.test(await toggle.innerText()))fail(`${view}: Off state is not visibly and accessibly clear`);
    const offImage=await stableCapture(),serial=before.rendered.serial;if(!offImage)fail(`${view}: off-state canvas did not settle to repeatable pixels before comparing toggle`);
    writeFileSync(join(OUT,`enhanced-${view}-off-before.png`),offImage);
    await toggle.click();
    await page.waitForFunction(s=>{const x=document.querySelector('canvas')?.lunarSnapshot?.();return x?.rendered?.serial>s&&x?.surface?.enhancedVision===true;},serial,{timeout:10000});
    await settleCamera();
    const on=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.());
    const onImage=await stableCapture();if(!onImage)fail(`${view}: on-state canvas did not settle to repeatable pixels`);
    writeFileSync(join(OUT,`enhanced-${view}-on.png`),onImage);
    const onDelta=await pixelDiff(offImage,onImage);if(onDelta.changedPixels<Math.max(24,onDelta.totalPixels*0.0005)||onDelta.maxChannelDelta<32)fail(`${view}: Enhanced vision On did not add a substantial rendered outline: ${JSON.stringify(onDelta)}`);
    if(await toggle.getAttribute('aria-pressed')!=='true'||!/On/.test(await toggle.innerText()))fail(`${view}: On state is not visibly and accessibly clear`);
    const explanation=await page.locator('.vision-explanation').innerText();
    if(!/illustrative/i.test(explanation)||!new RegExp(expectedDescription,'i').test(explanation)||!/Visibility, lighting and measurements are unchanged/i.test(explanation))fail(`${view}: visual-only disclosure missing or incorrect: ${explanation}`);
    if(JSON.stringify(before.bodies)!==JSON.stringify(on.bodies)||JSON.stringify(before.observation)!==JSON.stringify(on.observation))fail(`${view}: Enhanced vision changed physical positions, body radii or the computed observation`);
    const offSerial=on.rendered.serial;await toggle.click();
    await page.waitForFunction(s=>{const x=document.querySelector('canvas')?.lunarSnapshot?.();return x?.rendered?.serial>s&&x?.surface?.enhancedVision===false;},offSerial,{timeout:10000});
    await settleCamera();const restored=await stableCapture();if(!restored)fail(`${view}: off-state canvas did not settle after disabling the toggle`);writeFileSync(join(OUT,`enhanced-${view}-off-after.png`),restored);const restoreDelta=await pixelDiff(offImage,restored);if(restoreDelta.changedPixels>16||restoreDelta.maxChannelDelta>8){const after=await sceneMeta();fail(`${view}: turning Enhanced vision Off did not restore the same visible scene within renderer noise: ${JSON.stringify({onDelta,restoreDelta,before:before.camera,after:after.camera,rendered:after.rendered,buffer:after.drawingBuffer,cssRect:after.cssRect,dpr:after.dpr,textures:after.textureResources})}`);}
    reports.push(`${view}: On changed ${onDelta.changedPixels}/${onDelta.totalPixels} pixels; Off restored within ${restoreDelta.changedPixels} pixels (max channel delta ${restoreDelta.maxChannelDelta}); positions/metrics unchanged`);
  }
  await page.locator('.camera-presets button').filter({hasText:'Surface sky'}).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.view==='sky',null,{timeout:10000});
  await toggle.click();
  await page.getByRole('button',{name:'Explore fullscreen',exact:true}).click();
  const caption=await page.locator('.immersive-mode').innerText();
  if(!/Enhanced vision \(illustrative\)/.test(caption))fail(`immersive caption omitted the visual-only toggle: ${caption}`);
  if(await page.locator('.vision-toggle').count())fail('workspace controls remained visible in immersive view');
  await page.keyboard.press('Escape');await page.locator('.vision-toggle').waitFor();
  if(await toggle.getAttribute('aria-pressed')!=='true')fail('Enhanced vision state was lost when leaving immersive view');
  reports.push('immersive caption');await ctx.close();return reports.join('; ');
});

await check('Enhanced vision toggle and captions do not overlap at 390x844 or 844x390 touch sizes',async()=>{
  const reports=[];
  for(const [width,height] of [[390,844],[844,390]]){
    const {ctx,page}=await context(browser,`enhanced-vision-touch-${width}`,{viewport:{width,height},touch:true});await go(page,'simulator');
    const pause=page.getByRole('button',{name:'Pause',exact:true});if(await pause.isVisible())await pause.click();
    const view=page.locator('#explorer-view');
    if(await view.isVisible())await view.selectOption('sky');
    else if(await page.locator('.setup-toggle').isVisible()){
      await page.locator('.setup-toggle').click({timeout:8000});
      await page.locator('#explorer-view').waitFor({state:'visible',timeout:5000});
      await page.selectOption('#explorer-view','sky');
    }else await page.locator('.camera-presets button').filter({hasText:'Surface sky'}).click({timeout:8000});
    await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.ready&&document.querySelector('canvas')?.lunarSnapshot?.().rendered?.view==='sky',null,{timeout:30000});
    const toggle=page.getByRole('button',{name:'Enhanced vision',exact:true});await toggle.click().catch(async e=>{const d=await page.evaluate(()=>({hash:location.hash,dialog:document.querySelector('[role=dialog]')?.innerText,viewport:{width:innerWidth,height:innerHeight},toggle:[...document.querySelectorAll('button')].filter(b=>b.innerText.includes('Enhanced vision')).map(b=>({text:b.innerText,disabled:b.disabled,rect:(()=>{const r=b.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})()})),body:document.body.innerText.slice(0,500)}));throw new Error(`${width}x${height}: Enhanced vision button click timed out: ${JSON.stringify(d)}; ${e.message.split('\n')[0]}`);});
    const layout=await page.evaluate(()=>{
      const selectors=['.vision-toggle','.vision-explanation','.scene-navigation-help','.camera-controls','.explorer-time'];
      const rects=Object.fromEntries(selectors.map(s=>{const e=document.querySelector(s);if(!e)return[s,null];const r=e.getBoundingClientRect();return[s,{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}];}));
      return{vw:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth,rects,view:document.querySelector('canvas')?.lunarSnapshot?.().view};
    });
    if(layout.sw>layout.vw+1)fail(`${width}x${height}: Enhanced vision layout overflow ${JSON.stringify(layout)}`);
    const pairs=[['.vision-toggle','.explorer-time'],['.vision-explanation','.explorer-time'],['.vision-toggle','.vision-explanation'],['.vision-explanation','.camera-controls']];
    for(const [a,b] of pairs){const x=layout.rects[a],y=layout.rects[b];if(!x||!y)continue;const ox=Math.max(0,Math.min(x.right,y.right)-Math.max(x.x,y.x)),oy=Math.max(0,Math.min(x.bottom,y.bottom)-Math.max(x.y,y.y));if(ox>1&&oy>1)fail(`${width}x${height}: ${a} overlaps ${b}: ${JSON.stringify({x,y})}`);}
    if(!/outline of the calculated terrain horizon/i.test(await page.locator('.vision-explanation').innerText()))fail(`${width}x${height}: sky horizon caption missing`);
    reports.push(`${width}x${height}: no overflow/overlap`);await ctx.close();
  }
  return reports.join('; ');
});

await check('Local terrain camera drag has no net-zero round-trip drift while time moves',async()=>{
  const {ctx,page}=await context(browser,'terrain-drag-netzero');await go(page,'simulator');
  await page.locator('.camera-presets button').filter({hasText:'Local terrain'}).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.ready===true&&document.querySelector('canvas')?.lunarSnapshot?.().rendered?.view==='terrain',null,{timeout:30000});
  await page.getByLabel('Speed').selectOption('24');
  const canvas=page.locator('canvas').first(),box=await canvas.boundingBox();if(!box)fail('canvas bounding box unavailable');
  const start=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.());
  if(await page.getByRole('button',{name:'Play',exact:true}).isVisible())await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(70);
  await page.mouse.move(box.x+box.width*.50,box.y+box.height*.50);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.65,box.y+box.height*.50,{steps:8});
  await page.waitForTimeout(140);await page.mouse.move(box.x+box.width*.50,box.y+box.height*.50,{steps:8});await page.mouse.up();
  await page.getByRole('button',{name:'Pause',exact:true}).click();await page.waitForTimeout(350);
  const end=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.());
  const localOrientation=(s)=>{
    const body=interpolateBodyQuaternion(skyData.moonOrientationQuat,s.rendered.presentedIndex,new Quaternion());
    const camera=new Quaternion(...s.camera.quaternion);
    return body.invert().multiply(camera);
  };
  const q0=localOrientation(start),q1=localOrientation(end),dot=Math.min(1,Math.abs(q0.dot(q1))),angle=2*Math.acos(dot)*180/Math.PI;
  if(end.index<=start.index)fail('clock did not advance during the terrain drag');
  if(angle>1)fail(`terrain drag out/back left ${angle.toFixed(2)}° of camera orientation drift while time advanced`);
  await ctx.close();return `time ${start.index.toFixed(2)}→${end.index.toFixed(2)}; camera quaternion net drift ${angle.toFixed(3)}°`;
});

await check('Compare calculations and JSON export work with WebGL disabled',async()=>{
  const {ctx,page}=await context(browser,'compare-no-webgl',{webglBlocked:true});await go(page,'compare');
  await page.locator('.answer-scenario').nth(0).waitFor();
  if(await page.locator('.answer-scenario').count()!==3)fail('Compare did not render its three answer scenarios');
  const original=await page.locator('.answer-scenario').allTextContents();
  await page.locator('#site').selectOption('connecting-ridge');await page.locator('#alternative').selectOption('shackleton-rim');
  await page.locator('#height').selectOption({label:'2 m'});await page.locator('#arrival').fill('2027-03-02');
  await page.locator('#days').selectOption('14');await page.locator('#delay').selectOption('3');
  const preserved={site:await page.locator('#site').inputValue(),height:await page.locator('#height').inputValue(),date:await page.locator('#arrival').inputValue(),days:await page.locator('#days').inputValue(),delay:await page.locator('#delay').inputValue()};
  await page.getByRole('button',{name:/Try a point about 1 km away/}).click();
  if(await page.locator('#alternative').inputValue()!=='connecting-neighbor')fail(`nearby-point action did not select the neighbor: ${await page.locator('#alternative').inputValue()}`);
  const after={site:await page.locator('#site').inputValue(),height:await page.locator('#height').inputValue(),date:await page.locator('#arrival').inputValue(),days:await page.locator('#days').inputValue(),delay:await page.locator('#delay').inputValue()};
  if(JSON.stringify(after)!==JSON.stringify(preserved))fail(`nearby-point action changed original comparison settings: ${JSON.stringify({preserved,after})}`);
  const changed=await page.locator('.answer-scenario').allTextContents();
  if(original.join('\n')===changed.join('\n'))fail('Compare cards did not react to location/height/nearby-point changes');
  await page.getByText('Full measurements, methods and a darkness limit',{exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:/Download comparison.*JSON/}).click();
  const download=await downloadPromise,file=join(OUT,download.suggestedFilename());await download.saveAs(file);
  const report=JSON.parse(readFileSync(file,'utf8'));
  if(report.reportType!=='faithful-comparison'||report.scenarios?.length!==3||Number(report.settings?.height)!==2||report.settings?.siteId!=='connecting-ridge'||report.settings?.alternative!=='connecting-neighbor'||report.settings?.date!=='2027-03-02'||Number(report.settings?.days)!==14||Number(report.settings?.delay)!==3)fail(`export record is incomplete or stale after neighbor switch: ${JSON.stringify({reportType:report.reportType,settings:report.settings,scenarios:report.scenarios?.length})}`);
  const blocked=await page.evaluate(()=>window.__qaWebglCalls);
  if(blocked!==0)fail(`Compare attempted ${blocked} WebGL context creations`);
  await ctx.close();return `three recomputed scenarios; only alternative changed to connecting-neighbor; export ${file}; no WebGL context requested`;
});

for(const c of contexts)await c.close().catch(()=>{});
mkdirSync(OUT,{recursive:true});
const report={base:BASE,browser:browser.version(),generatedAt:new Date().toISOString(),results,issues};
writeFileSync(join(OUT,'results.json'),JSON.stringify(report,null,2));
console.log(`\n${results.filter(r=>r.ok).length}/${results.length} checks passed; results ${join(OUT,'results.json')}`);
await browser.close();
if(results.some(r=>!r.ok)||Object.values(issues).some(v=>v.length))process.exitCode=1;
