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
import {comparisonRows} from '../src/lib/comparisonReport.mjs';
import {percent,windowBounds,formatDelay} from '../src/lib/analysis.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const BASE=(process.env.QA_URL||'http://localhost:5173').replace(/\/$/,'');
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(ROOT,'..','tmp','lunar-new-ui');
const manifest=JSON.parse(readFileSync(join(ROOT,'public/data/manifest.json'),'utf8'));
const skyData=JSON.parse(readFileSync(join(ROOT,'public/data/sky.json'),'utf8'));
const siteData=Object.fromEntries(manifest.sites.map(s=>[s.id,JSON.parse(readFileSync(join(ROOT,'public/data',s.file),'utf8'))]));
const dataset={manifest,sites:siteData};
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
  const opening=page.getByRole('dialog',{name:'Lunacline'});
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
    localStorage.setItem('lunar-music-v1','off');
    window.__qaOpeningChimes=[];window.__qaAudioContextCreations=0;
    window.addEventListener('lunacline:chime',()=>window.__qaOpeningChimes.push(performance.now()));
    const Native=window.AudioContext;
    if(Native)window.AudioContext=new Proxy(Native,{construct(target,args,newTarget){window.__qaAudioContextCreations++;return Reflect.construct(target,args,newTarget);}});
  });
  await ctx.addInitScript(()=>{
    window.__qaOpeningSeen=false;
    const observer=new MutationObserver(()=>{if(document.querySelector('.space-opening[role="dialog"]')){window.__qaOpeningSeen=true;observer.disconnect();}});
    observer.observe(document,{childList:true,subtree:true});
  });
  await page.goto(`${BASE}/?qa=1#/compare`,{waitUntil:'commit',timeout:60000});
  const dialog=page.getByRole('dialog',{name:'Lunacline'});
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
  const initial=await page.evaluate(()=>({inert:document.querySelector('.app-shell')?.hasAttribute('inert'),skipFocused:document.activeElement?.classList.contains('opening-skip')}));
  if(!initial.inert||!initial.skipFocused)fail(`opening did not inert the app and focus Skip intro: ${JSON.stringify(initial)}`);
  const openingText=await page.evaluate(()=>['.lc-brand h1','.lc-descriptor','.lc-question'].map(s=>{const e=document.querySelector(s),c=getComputedStyle(e);return{selector:s,animation:c.animationName,opacity:c.opacity};}));
  if(openingText.some(x=>x.animation!=='none'||x.opacity!=='1'))fail(`opening identity text should remain sharp while illustration animates: ${JSON.stringify(openingText)}`);
  await page.keyboard.press('Shift+Tab');
  if(!await page.evaluate(()=>document.activeElement?.classList.contains('lc-enter')))fail('Shift+Tab did not stay inside the opening dialog');
  await page.keyboard.press('Tab');
  if(!await page.evaluate(()=>document.activeElement?.classList.contains('opening-skip')))fail('Tab did not wrap within the opening dialog');
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.activeElement?.id==='main',null,{timeout:1500});
  const afterEscape=await page.evaluate(()=>({inert:document.querySelector('.app-shell')?.hasAttribute('inert'),hash:location.hash,focus:document.activeElement?.id,outline:getComputedStyle(document.activeElement).outlineStyle,selection:getSelection()?.toString()}));
  if(afterEscape.inert||afterEscape.hash!=='#/compare'||afterEscape.focus!=='main'||afterEscape.outline!=='none'||afterEscape.selection)fail(`Escape did not preserve Compare and restore clean Main focus: ${JSON.stringify(afterEscape)}`);
  await page.waitForTimeout(2150);
  const escapedAudio=await page.evaluate(()=>({chimes:window.__qaOpeningChimes.length,contexts:window.__qaAudioContextCreations}));
  if(escapedAudio.chimes!==0||escapedAudio.contexts!==0)fail(`Escape did not cancel the intro chime without creating audio: ${JSON.stringify(escapedAudio)}`);
  await page.goto(`${BASE}/?qa=chime#/evidence`,{waitUntil:'commit',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('.space-opening[role="dialog"]')!==null,null,{timeout:8000});
  const chimeDialog=page.getByRole('dialog',{name:'Lunacline'});await chimeDialog.waitFor({state:'visible'});
  const chimeDialogAt=await page.evaluate(()=>performance.now());
  await page.waitForFunction(()=>window.__qaOpeningChimes?.length===1,null,{timeout:4000});
  const chime=await page.evaluate((visibleAt)=>({delay:window.__qaOpeningChimes[0]-visibleAt,contexts:window.__qaAudioContextCreations,preference:localStorage.getItem('lunar-music-v1')}),chimeDialogAt);
  if(chime.delay<1750||chime.delay>2600||chime.contexts!==0||chime.preference!=='off')fail(`intro chime timing/off contract: ${JSON.stringify(chime)}`);
  await page.getByRole('button',{name:/Skip intro/}).click();await chimeDialog.waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.activeElement?.id==='main',null,{timeout:1500});
  await page.getByRole('link',{name:'How it works',exact:true}).click();await page.waitForFunction(()=>location.hash==='#/learn',null,{timeout:5000});
  if(await page.getByRole('dialog',{name:'Lunacline'}).count())fail('SPA route change reopened the opening');
  // Change the query too: changing only the hash is an SPA/same-document
  // navigation and correctly does not replay the full-document opening.
  await page.goto(`${BASE}/?qa=2#/evidence`,{waitUntil:'commit',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('.space-opening[role="dialog"]')!==null,null,{timeout:8000});
  await page.getByRole('dialog',{name:'Lunacline'}).waitFor({timeout:1200});
  await page.getByRole('button',{name:/Skip intro/}).click();
  await page.waitForFunction(()=>document.activeElement?.id==='main',null,{timeout:1500});
  const afterSkip=await page.evaluate(()=>({hash:location.hash,focus:document.activeElement?.id,outline:getComputedStyle(document.activeElement).outlineStyle,selection:getSelection()?.toString()}));
  if(afterSkip.hash!=='#/evidence'||afterSkip.focus!=='main'||afterSkip.outline!=='none'||afterSkip.selection)fail(`Skip did not preserve Evidence and restore clean Main focus: ${JSON.stringify(afterSkip)}`);
  await page.goto(`${BASE}/?qa=3#/home`,{waitUntil:'commit',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('.space-opening[role="dialog"]')!==null,null,{timeout:8000});
  await page.getByRole('dialog',{name:'Lunacline'}).waitFor({timeout:1200});
  const autoAt=await page.evaluate(()=>performance.now());
  await page.getByRole('dialog').waitFor({state:'hidden',timeout:4500});
  const autoDuration=await page.evaluate((started)=>performance.now()-started,autoAt);
  if(autoDuration<2600||autoDuration>3900)fail(`opening auto-close should be about 3 seconds: ${autoDuration.toFixed(0)} ms`);
  await page.waitForFunction(()=>location.hash==='#/home',null,{timeout:5000});
  await page.waitForFunction(()=>document.activeElement?.id==='main',null,{timeout:2000});
  const afterAuto=await page.evaluate(()=>({focus:document.activeElement?.id,outline:getComputedStyle(document.activeElement).outlineStyle,selection:getSelection()?.toString()}));
  if(afterAuto.focus!=='main'||afterAuto.outline!=='none'||afterAuto.selection)fail(`Home autoclose did not restore clean Main focus: ${JSON.stringify(afterAuto)}`);
  await page.getByRole('button',{name:/View comparison in 3D/}).click();await page.waitForFunction(()=>location.hash==='#/simulator',null,{timeout:10000});
  if(await page.getByRole('dialog',{name:'Lunacline'}).count())fail('Home-to-Simulator SPA entry repeated the opening');
  await ctx.close();return `same tab/storage: 3 s opening; Escape cancels pending chime, Skip works; chime event fires at about 2.05 s while Music Off without creating AudioContext; focus trap/Main focus and deep links preserved; SPA route does not reopen; pre-mount observer=${observerRecorded?'saw opening':'missed (DOM visibility assertion passed)'}`;
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
  if(await page.getByRole('dialog',{name:'Lunacline'}).count())fail('reduced-motion first visit auto-opened the intro');
  await page.getByRole('button',{name:'Replay the opening'}).click();
  const dialog=page.getByRole('dialog',{name:'Lunacline'});await dialog.waitFor();
  const animations=await dialog.evaluate(e=>[...e.querySelectorAll('*')].flatMap(n=>n.getAnimations().filter(a=>a.playState==='running').map(a=>({tag:n.tagName,className:n.className?.baseVal??n.className,name:a.animationName}))));
  if(animations.length)fail(`replay intro animates under reduced motion: ${JSON.stringify(animations)}`);
  await page.waitForTimeout(2700);if(!await dialog.isVisible())fail('reduced-motion replay auto-dismissed before the user chose');
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await ctx.close();
  return 'no automatic opening; replay remains static and user-dismissible';
});

await check('Lunacline opening brand and illustration fit desktop, portrait and landscape at first, middle and last frames',async()=>{
  const reports=[];
  for(const [width,height] of [[1440,900],[390,844],[844,390]]){
    const {ctx,page}=await context(browser,`opening-layout-${width}`,{viewport:{width,height},touch:width!==1440});
    await page.goto(`${BASE}/?opening-layout=${width}#/home`,{waitUntil:'commit',timeout:60000});
    const dialog=page.getByRole('dialog',{name:'Lunacline'});await dialog.waitFor({state:'visible',timeout:8000});
    const started=Date.now();
    for(const [phase,at] of [['first',120],['middle',1100],['last',2250]]){
      const remaining=at-(Date.now()-started);if(remaining>0)await page.waitForTimeout(remaining);
      const state=await page.evaluate(()=>{
        const rect=e=>{const r=e?.getBoundingClientRect();return r&&{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        const d=document.querySelector('.space-opening'),brand=d?.querySelector('.lc-brand'),scene=d?.querySelector('.lc-scene'),a=rect(brand),b=rect(scene);
        const overlap=!!(a&&b&&Math.min(a.right,b.right)-Math.max(a.x,b.x)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>2);
        const text=[...d.querySelectorAll('.lc-brand h1,.lc-descriptor,.lc-question')].map(e=>({text:e.textContent.trim(),opacity:getComputedStyle(e).opacity,animation:getComputedStyle(e).animationName}));
        return{viewport:{w:innerWidth,h:innerHeight},scrollWidth:document.documentElement.scrollWidth,dialog:rect(d),brand:a,scene:b,overlap,text,visible:!!d&&!!brand&&!!scene};
      });
      if(!state.visible||state.scrollWidth>width+1||state.dialog.x<0||state.dialog.y<0||state.dialog.right>width+1||state.dialog.bottom>height+1||state.overlap)fail(`${width}x${height} ${phase}: opening/brand/illustration clipping or overlap: ${JSON.stringify(state)}`);
      if(state.text.some(t=>t.opacity!=='1'||t.animation!=='none'))fail(`${width}x${height} ${phase}: brand copy fades/animates: ${JSON.stringify(state.text)}`);
      await page.screenshot({path:join(OUT,`intro-${width}x${height}-${phase}.png`),fullPage:false});
      reports.push(`${width}x${height} ${phase}: in bounds, no copy/illustration overlap`);
    }
    await ctx.close();
  }
  return reports.join('; ');
});

await check('Lunacline wordmark, navigation, keyboard focus and calendar use no blue or cyan interface colors',async()=>{
  const {ctx,page}=await context(browser,'brand-palette-calendar');await go(page,'home');
  const brand=await page.evaluate(async()=>{
    const img=document.querySelector('header img[src="/icon.svg"]'),nav=[...document.querySelectorAll('header nav a')].map(a=>a.innerText.trim());
    const svg=img?await (await fetch(img.src)).text():'';
    return{loaded:!!img?.complete&&img.naturalWidth>0,svg:svg.includes('<svg'),wordmark:document.querySelector('header')?.innerText.includes('LUNACLINE'),nav,logoColors:(svg.match(/#[0-9a-f]{3,8}\b/gi)||[])};
  });
  if(!brand.loaded||!brand.svg||!brand.wordmark||brand.nav[0]!=='Compare arrival times'||brand.nav[1]!=='3D view')fail(`new brand/navigation did not load in the approved order: ${JSON.stringify(brand)}`);
  const compare=page.getByRole('link',{name:'Compare arrival times',exact:true});await compare.focus();
  const collect=()=>page.evaluate(()=>{
    const hue=([r,g,b])=>{r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;if(!d)return {h:0,s:0};let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h=(h*60+360)%360;return{h,s:mx===0?0:d/mx};};
    const parse=s=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const n=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);if(n.length<3||n[3]===0)return null;return n.slice(0,3);};
    const candidates=[...document.querySelectorAll('header a,header button,main a,main button,main input,main select,main summary,.calendar-popover *')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
    const colors=[];for(const e of candidates){const c=getComputedStyle(e);for(const key of ['color','backgroundColor','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','outlineColor','fill','stroke']){const rgb=parse(c[key]);if(!rgb||Math.max(...rgb)<60)continue;const hs=hue(rgb);if(hs.s>.25&&hs.h>=175&&hs.h<=255)colors.push({tag:e.tagName,cls:String(e.className?.baseVal??e.className??'').slice(0,45),property:key,color:c[key]});}}
    return{visibleControls:candidates.length,blueOrCyan:colors};
  });
  const focus=await compare.evaluate(e=>{const c=getComputedStyle(e);return{outlineStyle:c.outlineStyle,outlineWidth:c.outlineWidth,outlineColor:c.outlineColor,boxShadow:c.boxShadow};});
  if((focus.outlineStyle==='none'||focus.outlineWidth==='0px')&&focus.boxShadow==='none')fail(`keyboard focus is not visible on the primary navigation: ${JSON.stringify(focus)}`);
  if((await collect()).blueOrCyan.length)fail(`new header or page controls still use blue/cyan: ${JSON.stringify((await collect()).blueOrCyan.slice(0,8))}`);
  await page.getByRole('link',{name:'Compare arrival times',exact:true}).click();await page.getByRole('button',{name:'Choose arrival date',exact:true}).click();
  const calendar=page.getByRole('dialog');await calendar.waitFor();
  const calendarColors=await collect();
  if(calendarColors.blueOrCyan.length)fail(`calendar controls still use blue/cyan: ${JSON.stringify(calendarColors.blueOrCyan.slice(0,8))}`);
  await ctx.close();return `SVG mark loaded; Compare-first nav; visible interface controls=${calendarColors.visibleControls}; no computed blue/cyan; visible primary-nav focus ${focus.outlineColor}`;
});

await check('current Guided analysis notes persist per chapter and across SPA routes without POSTs',async()=>{
  const {ctx,page}=await context(browser,'mission-notes-current');await go(page,'mission');
  const writes=[];page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))writes.push(`${request.method()} ${request.url()}`);});
  const note=page.getByLabel('Analysis notes'),explored=page.getByLabel('I explored this question');
  await note.fill('Prediction: a later arrival changes the exposed sky.');await explored.check();
  await page.locator('.chapter-list button').nth(2).click();
  if(await note.inputValue()!==''||await explored.isChecked())fail('chapter-specific notes leaked into another chapter');
  await note.fill('Chapter three observation');
  await page.locator('.chapter-list button').nth(0).click();
  if(await note.inputValue()!=='Prediction: a later arrival changes the exposed sky.'||!await explored.isChecked())fail('first chapter journal was lost when switching chapters');
  await page.getByRole('link',{name:'Compare arrival times',exact:true}).click();await page.waitForFunction(()=>location.hash==='#/compare',null,{timeout:5000});
  await page.getByRole('link',{name:'Guided analysis',exact:true}).click();await page.waitForFunction(()=>location.hash==='#/mission',null,{timeout:5000});
  if(await note.inputValue()!=='Prediction: a later arrival changes the exposed sky.'||!await explored.isChecked())fail('chapter journal was lost after an SPA route round-trip');
  if(await note.getAttribute('maxlength')!=='1000')fail('journal does not retain its 1000-character limit');
  if(writes.length)fail(`notes unexpectedly sent non-GET requests: ${writes.join(', ')}`);
  await ctx.close();return 'notes stay isolated by chapter and survive Compare ↔ Guided analysis; no writes sent; 1000-character limit retained';
});

await check('keyboard can reach current navigation and immersive controls and Escape restores focus',async()=>{
  const {ctx,page}=await context(browser,'keyboard-current');await go(page,'home');
  const skip=page.getByRole('link',{name:'Skip to content',exact:true});await skip.focus();
  if(!await skip.isVisible())fail('Skip to content is not visible when keyboard-focused');
  await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.id==='main',null,{timeout:3000});
  if(await page.evaluate(()=>location.hash)!=='#/home')fail('Skip to content changed the current route');
  const compare=page.getByRole('link',{name:'Compare arrival times',exact:true});await compare.focus();
  const focused=await compare.evaluate(e=>{const s=getComputedStyle(e);return {active:document.activeElement===e,outline:s.outlineStyle,outlineWidth:s.outlineWidth,shadow:s.boxShadow};});
  if(!focused.active||((focused.outline==='none'||focused.outlineWidth==='0px')&&focused.shadow==='none'))fail(`focused navigation link has no visible focus indicator: ${JSON.stringify(focused)}`);
  await page.keyboard.press('Enter');await page.waitForFunction(()=>location.hash==='#/compare',null,{timeout:5000});
  await page.getByRole('link',{name:'3D view',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>location.hash==='#/simulator',null,{timeout:5000});
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
  const enter=page.getByRole('button',{name:'Explore fullscreen',exact:true});await enter.focus();await page.keyboard.press('Enter');
  const back=page.getByRole('button',{name:/Return to workspace/});await back.waitFor();
  if(!await page.evaluate(()=>document.body.classList.contains('immersive-active'))||!await back.evaluate(e=>document.activeElement===e))fail('keyboard entry did not move focus into immersive controls');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.body.classList.contains('immersive-active'),null,{timeout:5000});
  if(!await enter.evaluate(e=>document.activeElement===e))fail('Escape did not restore focus to Explore fullscreen');
  await ctx.close();return 'focused nav has a visible indicator; Enter routes; immersive entry/Exit use Enter/Escape with focus restoration';
});

await check('Free Mode motion freezes use current labels, persist while stepping, and clear on Faithful reset',async()=>{
  const {ctx,page}=await context(browser,'free-mode-freezes-current');await go(page,'simulator');
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
  const pause=page.getByRole('button',{name:'Pause',exact:true});if(await pause.isVisible().catch(()=>false))await pause.click();
  await page.getByRole('button',{name:/Free Mode/}).first().click();
  const earth=page.getByLabel('Earth’s position', {exact:true});
  const mercury=page.getByLabel('Mercury position',{exact:true});
  if(!await earth.isVisible()||await earth.isChecked())fail('Earth position freeze should be visible and unchecked in Free Mode');
  if(!await mercury.isVisible()||await mercury.isChecked())fail('optional Mercury position freeze should be visible and unchecked in Free Mode');
  const timeBefore=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.().index);
  await earth.check();await mercury.check();await page.getByRole('button',{name:/Step \+1 h/}).click();
  const timeAfter=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.().index);
  if(!(timeAfter>timeBefore)||!await earth.isChecked()||!await mercury.isChecked())fail(`Free Mode step did not advance time and preserve Earth/Mercury freezes: ${JSON.stringify({timeBefore,timeAfter,earth:await earth.isChecked(),mercury:await mercury.isChecked()})}`);
  await page.getByRole('button',{name:'Reset to Faithful Mode',exact:true}).click();
  if(await page.locator('.free-lab').count())fail('Free Mode freeze disclosure remains after Faithful reset');
  await page.getByRole('button',{name:/Free Mode/}).first().click();
  if(await page.getByLabel('Earth’s position',{exact:true}).isChecked()||await page.getByLabel('Mercury position',{exact:true}).isChecked())fail('Faithful reset did not clear Earth and optional Mercury position freezes');
  await ctx.close();return 'Earth and Mercury position freezes are visible in Free Mode, survive stepping, and clear after Faithful reset';
});

await check('current simulator HUD and camera controls stay inside the desktop and mobile scene frame',async()=>{
  const measured=[];
  for(const [label,viewport,touch] of [['desktop-1440',{width:1440,height:900},false],['mobile-390',{width:390,height:844},true]]){
    const {ctx,page}=await context(browser,`simulator-hud-${label}`,{viewport,touch});await go(page,'simulator');
    await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
    if(touch&&!await page.locator('#explorer-view').isVisible())await page.locator('.setup-toggle').click();
    if(touch)await page.selectOption('#explorer-view','overview');
    else await page.locator('.camera-presets button').first().click();
    await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().view==='overview',null,{timeout:10000});
    await page.waitForTimeout(200);
    const layout=await page.evaluate(()=>{
      const names=['.explorer-world','.camera-controls','.world-reading','.world-meta','.scene-navigation-help'];
      const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,visible:r.width>0&&r.height>0};};
      return{viewport:{width:innerWidth,height:innerHeight},items:Object.fromEntries(names.map(s=>[s,rect(document.querySelector(s))]))};
    });
    const frame=layout.items['.explorer-world'],controls=layout.items['.camera-controls'],reading=layout.items['.world-reading'],meta=layout.items['.world-meta'];
    if(!frame?.visible||frame.x<0||frame.right>layout.viewport.width+1||frame.y<0)fail(`${label}: scene frame is missing or horizontally outside viewport: ${JSON.stringify(layout)}`);
    for(const [selector,r] of [['.camera-controls',controls],['.world-reading',reading],['.world-meta',meta]])if(!r?.visible||r.x<frame.x-1||r.right>frame.right+1||r.y<frame.y-1||r.bottom>frame.bottom+1)fail(`${label}: ${selector} is missing or outside the scene frame: ${JSON.stringify(layout)}`);
    const overlapX=Math.max(0,Math.min(controls.right,reading.right)-Math.max(controls.x,reading.x)),overlapY=Math.max(0,Math.min(controls.bottom,reading.bottom)-Math.max(controls.y,reading.y));
    if(overlapX>1&&overlapY>1)fail(`${label}: camera controls overlap the live Sun/Earth HUD by ${overlapX.toFixed(1)}×${overlapY.toFixed(1)} px: ${JSON.stringify(layout)}`);
    measured.push(`${label}:HUD/camera in frame, overlap=${overlapX.toFixed(1)}×${overlapY.toFixed(1)}px`);await ctx.close();
  }
  return measured.join('; ');
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
  let audio=await page.evaluate(()=>({contexts:window.__qaAudioContexts?.length??0,state:window.__qaAudioContexts?.[0]?.state,pressed:document.querySelector('.music-toggle')?.getAttribute('aria-pressed'),playing:document.querySelector('.music-toggle')?.getAttribute('data-playing'),label:document.querySelector('.music-toggle')?.innerText?.trim().replace(/\s+/g,' ')}));
  if(audio.pressed!=='true')fail(`music should be enabled by default: ${JSON.stringify(audio)}`);
  if(audio.playing!=='false'||audio.state!=='suspended'||audio.label!=='Music Ready')fail(`blocked autoplay must show truthful Ready, not On: ${JSON.stringify(audio)}`);
  if(audio.contexts!==1)fail(`automatic attempt should keep at most one suspended AudioContext, got ${JSON.stringify(audio)}`);
  await page.getByRole('link',{name:'Compare arrival times',exact:true}).click();
  await page.waitForFunction(()=>location.hash==='#/compare',null,{timeout:5000});
  await page.waitForFunction(()=>{const b=document.querySelector('.music-toggle'),c=window.__qaAudioContexts?.[0];return b?.getAttribute('data-playing')==='true'&&c?.state==='running';},null,{timeout:5000});
  audio=await page.evaluate(()=>({contexts:window.__qaAudioContexts?.length??0,state:window.__qaAudioContexts?.[0]?.state,pressed:document.querySelector('.music-toggle')?.getAttribute('aria-pressed'),playing:document.querySelector('.music-toggle')?.getAttribute('data-playing'),label:document.querySelector('.music-toggle')?.innerText?.trim().replace(/\s+/g,' ')}));
  if(audio.contexts!==1||audio.state!=='running'||audio.pressed!=='true'||audio.playing!=='true'||audio.label!=='Music On')fail(`first non-music gesture did not unlock truthful playback: ${JSON.stringify(audio)}`);
  const settings=page.locator('details.music-settings'),summary=page.getByLabel('Music volume and credits');
  await summary.click();if(!await settings.evaluate(e=>e.open))fail('volume and credits disclosure did not open');
  const volume=page.locator('#music-volume');
  const defaultVolume=await volume.inputValue(),storedVolume=await page.evaluate(()=>localStorage.getItem('lunar-music-volume-v1'));
  if(defaultVolume!=='50'||storedVolume!==null)fail(`a fresh visitor should start at 50% without a saved override: ${JSON.stringify({defaultVolume,storedVolume})}`);
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
  const reload=await page.evaluate(()=>({contexts:window.__qaAudioContexts?.length??0,pressed:document.querySelector('.music-toggle')?.getAttribute('aria-pressed'),playing:document.querySelector('.music-toggle')?.getAttribute('data-playing'),label:document.querySelector('.music-toggle')?.innerText?.trim().replace(/\s+/g,' '),preference:localStorage.getItem('lunar-music-v1')}));
  if(reload.contexts!==0||reload.pressed!=='false'||reload.playing!=='false'||reload.label!=='Music Off'||reload.preference!=='off')fail(`persisted Off did not survive a full reload without starting audio: ${JSON.stringify(reload)}`);
  await page.getByLabel('Music volume and credits').click();
  const persistedVolume=await page.locator('#music-volume').inputValue(),savedVolume=await page.evaluate(()=>localStorage.getItem('lunar-music-volume-v1'));
  if(persistedVolume!=='35'||savedVolume!=='35')fail(`chosen volume did not persist after reload: ${JSON.stringify({persistedVolume,savedVolume})}`);
  await ctx.close();return 'enabled default; fresh volume 50%; simulated autoplay block is truthful Ready on one suspended context; first non-music gesture unlocks one running context; volume reaches 0%, chosen 35% persists across reload; Escape restores focus; Off suspends and persists across reload without a new context';
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
  const featuredDate='2027-02-09',date=[3,7,14].every(delay=>windowBounds(manifest.period,featuredDate,7,delay))?featuredDate:manifest.coveragePolicy.asOfUtcDate;
  const heading=await briefing.locator('.hl-kicker').innerText();
  if(!heading.includes('Shackleton rim')||!heading.includes('1 m above the ground')||!heading.includes('7-day stay'))fail(`featured home example does not describe Shackleton rim / 1 m / 7 days: ${heading}`);
  const signatures=[];
  for(const delay of [3,7,14]){
    const b=briefing.getByRole('button',{name:`+${delay} days`,exact:true});await b.click();
    if(await b.getAttribute('aria-pressed')!=='true')fail(`+${delay} days is not selected`);
    await page.waitForFunction(d=>document.querySelector('.delay-briefing .briefing-results')?.textContent.includes(`Arrive ${d} days later`),delay,{timeout:5000});
    if(await rows.count()!==2)fail(`+${delay} days produced ${await rows.count()} rows`);
    const values=await rows.allTextContents();if(values.some(t=>/Not calculated|Loading the real/i.test(t)))fail(`+${delay} days did not produce calculated data`);
    const expected=comparisonRows(dataset,{siteId:'shackleton-rim',alternative:'connecting-ridge',height:1,date,days:7,delay});
    const rendered=await rows.evaluateAll(nodes=>nodes.map(n=>({heading:n.querySelector('h3')?.textContent.trim(),number:n.querySelector('.hl-num')?.textContent.trim(),facts:[...n.querySelectorAll('.hl-facts dd')].map(e=>e.textContent.trim())})));
    const fmtDay=(value)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`));
    for(const [i,r] of expected.slice(0,2).entries()){
      const wantNumber=r.summary.dark.hours.toFixed(1)+' h';
      if(i===0&&!rendered[i].heading?.startsWith(`Arrive ${fmtDay(date)}`))fail(`base briefing row date differs from comparisonRows: ${JSON.stringify(rendered[i])}`);
      if(i===1&&!rendered[i].heading?.startsWith(`Arrive ${delay} days later`))fail(`delayed briefing row heading is wrong: ${JSON.stringify(rendered[i])}`);
      if(!rendered[i].number?.includes(wantNumber))fail(`briefing row ${i} longest-dark value differs from comparisonRows: expected ${wantNumber}, got ${rendered[i].number}`);
      const wantFacts=[`${percent(r.summary.sunlitFraction)} of the stay`,`${percent(r.summary.earthFraction)} of the stay`];
      if(JSON.stringify(rendered[i].facts)!==JSON.stringify(wantFacts))fail(`briefing row ${i} percentages differ from comparisonRows: expected ${JSON.stringify(wantFacts)}, got ${JSON.stringify(rendered[i].facts)}`);
    }
    signatures.push(values.join('|'));
    if(delay===14){await briefing.getByRole('button',{name:/Compare arrival times/}).click();await page.waitForFunction(()=>location.hash==='#/compare',null,{timeout:10000});}
  }
  if(new Set(signatures).size<2)fail('delay choices did not change the comparison rows');
  const applied={site:await page.locator('#site').inputValue(),alternative:await page.locator('#alternative').inputValue(),height:await page.locator('#height').inputValue(),date:await page.locator('#arrival').inputValue(),days:await page.locator('#days').inputValue(),delay:await page.locator('#delay').inputValue()};
  const expected={site:'shackleton-rim',alternative:'connecting-ridge',height:'1',date,days:'7',delay:'14'};
  if(JSON.stringify(applied)!==JSON.stringify(expected))fail(`Home briefing CTA did not apply its settings: expected ${JSON.stringify(expected)}, got ${JSON.stringify(applied)}`);
  const figures=page.locator('.hl-compare');await figures.waitFor({timeout:10000});
  const compareRows=comparisonRows(dataset,{siteId:expected.site,alternative:expected.alternative,height:1,date:expected.date,days:7,delay:14});
  const ledger=await figures.locator('.hl-ledger svg[role="img"]').getAttribute('aria-label');
  for(const r of compareRows){
    for(const text of [`${r.summary.dark.hours.toFixed(1)} h`,`Sun visible ${percent(r.summary.sunlitFraction)}`,`Earth visible ${percent(r.summary.earthFraction)}`])
      if(!ledger.includes(text))fail(`Compare ledger is missing ${text} from comparisonRows: ${ledger}`);
  }
  await ctx.close();return `featured ${heading}; each Home row and all three Compare ledger rows match comparisonRows; Compare receives ${JSON.stringify(applied)}`;
});

await check('whole-hour delay controls keep Compare timestamps and rows aligned to the hourly grid',async()=>{
  const {ctx,page}=await context(browser,'whole-hour-delay',{webglBlocked:true});await go(page,'compare');
  await page.locator('#delay').selectOption('7');await page.locator('#delay-hours').selectOption('5');
  const delay=7+5/24,total=(await page.locator('.setup').innerText()).replace(/\s+/g,' ');
  if(!total.includes('Total delay: 7 days 5 h (173 h)'))fail(`delay summary does not report 7 d 5 h = 173 h: ${total}`);
  const settings={siteId:await page.locator('#site').inputValue(),alternative:await page.locator('#alternative').inputValue(),height:Number(await page.locator('#height').inputValue()),date:await page.locator('#arrival').inputValue(),days:Number(await page.locator('#days').inputValue()),delay};
  const expected=comparisonRows(dataset,settings),cards=await page.locator('.answer-scenario').allTextContents();
  if(expected.length!==3||cards.length!==3)fail('the delayed-hour change did not preserve all three scenarios');
  for(const [i,row] of expected.entries()){
    const stamp=new Date(Date.parse(manifest.period.startUtc)+row.bounds.start*manifest.period.stepMinutes*60000).toISOString().slice(0,16).replace('T',' ');
    if(!cards[i].includes(stamp))fail(`scenario ${i} arrival timestamp does not match its computed hourly index ${stamp}: ${cards[i]}`);
  }
  if(!cards[1].includes('+7 days 5 h'))fail(`delayed scenario does not label the full offset: ${cards[1]}`);
  const details=page.locator('details.comparison-details').first();if(await details.getAttribute('open')===null)await details.locator('summary').click();
  const reportPromise=page.waitForEvent('download');await page.getByRole('button',{name:/Download comparison.*JSON/}).click();
  const download=await reportPromise,report=JSON.parse(readFileSync(await download.path(),'utf8'));
  if(Math.abs(report.settings.delay-delay)>1e-12)fail(`JSON delay ${report.settings.delay} differs from the selected 173-hour offset`);
  await ctx.close();return `selected 7 d 5 h (173 h); three card UTC starts match comparisonRows; JSON delay=${report.settings.delay} days; format=${formatDelay(delay)}`;
});

await check('comparison link copies six settings and restores the same computed cards in a fresh context',async()=>{
  const settings={site:'nobile-rim-1',h:'2',arr:'2026-11-16',days:'14',delay:'7',alt:'connecting-neighbor',dh:'5'};
  const {ctx,page}=await context(browser,'share-link-copy',{webglBlocked:true});
  await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(BASE).origin});
  await go(page,'compare');
  await page.locator('#site').selectOption(settings.site);await page.locator('#alternative').selectOption(settings.alt);
  await page.locator('#height').selectOption(settings.h);await page.locator('#arrival').fill(settings.arr);
  await page.locator('#days').selectOption(settings.days);await page.locator('#delay').selectOption(settings.delay);await page.locator('#delay-hours').selectOption(settings.dh);
  const copy=page.getByRole('button',{name:'Copy comparison link',exact:true});await copy.click();
  await page.getByRole('status').filter({hasText:'Link copied.'}).waitFor({timeout:3000});
  const link=await page.locator('.share-url input[readonly]').inputValue();
  const clipboard=await page.evaluate(()=>navigator.clipboard.readText());
  if(link!==clipboard)fail(`copied link differs from read-only URL: ${JSON.stringify({link,clipboard})}`);
  const params=new URL(link).hash.split('?')[1];const actual=Object.fromEntries(new URLSearchParams(params));
  if(JSON.stringify(actual)!==JSON.stringify(settings))fail(`share URL does not contain the six current settings: ${JSON.stringify({settings,actual})}`);
  const original=await page.locator('.answer-scenario').allTextContents();
  const {ctx:restoredCtx,page:restored}=await context(browser,'share-link-restore',{webglBlocked:true});
  await restored.goto(link,{waitUntil:'networkidle',timeout:60000});
  await restored.locator('#site').waitFor();await restored.getByRole('status').filter({hasText:'Settings restored from a link'}).waitFor({timeout:5000});
  const restoredSettings={site:await restored.locator('#site').inputValue(),alt:await restored.locator('#alternative').inputValue(),h:await restored.locator('#height').inputValue(),arr:await restored.locator('#arrival').inputValue(),days:await restored.locator('#days').inputValue(),delay:await restored.locator('#delay').inputValue(),dh:await restored.locator('#delay-hours').inputValue()};
  const expected={site:settings.site,alt:settings.alt,h:settings.h,arr:settings.arr,days:settings.days,delay:settings.delay,dh:settings.dh};
  if(JSON.stringify(restoredSettings)!==JSON.stringify(expected))fail(`new document did not restore all six fields: ${JSON.stringify({expected,restoredSettings})}`);
  const restoredCards=await restored.locator('.answer-scenario').allTextContents();
  if(original.join('\n')!==restoredCards.join('\n'))fail('fresh-context restored cards differ from the original computed comparison');
  const expectedRows=comparisonRows(dataset,{siteId:settings.siteId??settings.site,alternative:settings.alternative??settings.alt,height:Number(settings.h),date:settings.date??settings.arr,days:Number(settings.days),delay:Number(settings.delay)+Number(settings.dh??0)/24});
  const rendered=await restored.locator('.answer-scenario').evaluateAll(nodes=>nodes.map(n=>({sun:n.querySelector('.answer-sun-percent')?.textContent.trim(),earth:n.querySelector('.answer-earth-percent')?.textContent.trim(),dark:n.querySelector('dl:not(.answer-context) dd')?.textContent.trim()})));
  for(const [i,row] of expectedRows.entries()){
    if(rendered[i].sun!==percent(row.summary.sunlitFraction)||rendered[i].earth!==percent(row.summary.earthFraction)||!rendered[i].dark.includes(row.summary.dark.hours.toFixed(1)))fail(`restored scenario ${i} differs from comparisonRows: ${JSON.stringify({actual:rendered[i],expected:{sun:percent(row.summary.sunlitFraction),earth:percent(row.summary.earthFraction),dark:row.summary.dark.hours}})}`);
  }
  const invalidCtx=await context(browser,'share-link-invalid',{webglBlocked:true});
  await invalidCtx.page.goto(`${BASE}/?qa=1#/compare?site=unknown&h=999&arr=2027-02-31&days=9&delay=30&dh=24&alt=unknown`,{waitUntil:'networkidle',timeout:60000});
  await invalidCtx.page.getByRole('status').filter({hasText:'Settings restored from a link'}).waitFor({timeout:5000});
  const notice=await invalidCtx.page.locator('.share-restored').innerText();
  if(!/ignored invalid site, alt, h, days, dh, delay, arr/.test(notice))fail(`invalid fields are not identified in the restored-link status: ${notice}`);
  if(await invalidCtx.page.locator('.answer-scenario').count()!==3)fail('invalid shared fields crashed or removed the comparison scenarios');
  for(const c of [ctx,restoredCtx,invalidCtx.ctx])await c.close();
  return `copy/read-only link roundtrip restored six settings and matching scientific values; invalid fields were ignored and announced`;
});

await check('Horizon Ledger Home and Compare stay within mobile widths and mono captions remain readable',async()=>{
  const reports=[];
  for(const [width,height,touch] of [[390,844,true],[844,390,true],[1440,900,false]]){
    const {ctx,page}=await context(browser,`horizon-responsive-${width}`,{viewport:{width,height},touch,webglBlocked:true});
    await go(page,'home');await page.locator('.delay-briefing .hl-ledger svg').waitFor({timeout:15000});
    await page.evaluate(()=>document.fonts.ready);
    const read=()=>page.evaluate(()=>{
      const root=document.documentElement,caption=document.querySelector('.hl-legend'),style=getComputedStyle(caption),axis=document.querySelector('.hl-axis'),axisStyle=axis&&getComputedStyle(axis),rgb=s=>s.match(/[\d.]+/g)?.slice(0,3).map(Number)??[0,0,0];
      const luminance=values=>values.map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
      const fg=luminance(rgb(style.color)),bg=luminance(rgb(getComputedStyle(root).backgroundColor)),contrast=(Math.max(fg,bg)+0.05)/(Math.min(fg,bg)+0.05);
      const axisFg=axisStyle?luminance(rgb(axisStyle.fill)):0,axisContrast=axisStyle?(Math.max(axisFg,bg)+0.05)/(Math.min(axisFg,bg)+0.05):0;
      return{viewport:innerWidth,scrollWidth:root.scrollWidth,fontSize:parseFloat(style.fontSize),fontFamily:style.fontFamily,plexLoaded:document.fonts.check('12px "IBM Plex Mono"'),contrast:+contrast.toFixed(2),captionVisible:caption.getBoundingClientRect().width>0,axisFontSize:axisStyle?parseFloat(axisStyle.fontSize):null,axisContrast:+axisContrast.toFixed(2),axisVisible:!!axis&&axis.getBBox().width>0};
    });
    let home=await read();if(home.scrollWidth>width+1)fail(`${width}x${height}: Home overflows horizontally: ${JSON.stringify(home)}`);
    if(home.fontSize<11||home.fontSize>13||!home.fontFamily.includes('IBM Plex Mono')||!home.plexLoaded||home.contrast<4.5||!home.captionVisible||home.axisFontSize<10.5||home.axisFontSize>13||home.axisContrast<4.5||!home.axisVisible)fail(`${width}x${height}: Home ledger caption/axis labels are too small, low contrast or missing: ${JSON.stringify(home)}`);
    await page.getByRole('link',{name:'Compare arrival times',exact:true}).click();await page.waitForFunction(()=>location.hash==='#/compare',null,{timeout:10000});
    await page.locator('.hl-compare .hl-ledger svg').waitFor({timeout:15000});await page.evaluate(()=>document.fonts.ready);
    const compare=await read();if(compare.scrollWidth>width+1)fail(`${width}x${height}: Compare overflows horizontally: ${JSON.stringify(compare)}`);
    if(compare.fontSize<11||compare.fontSize>13||compare.contrast<4.5||!compare.plexLoaded||!compare.captionVisible||compare.axisFontSize<10.5||compare.axisFontSize>13||compare.axisContrast<4.5||!compare.axisVisible)fail(`${width}x${height}: Compare ledger caption/axis labels are too small, low contrast or missing: ${JSON.stringify(compare)}`);
    const endpoints=await page.locator('.hl-compare .hl-horizon .hl-start').allTextContents(),arrows=await page.locator('.hl-compare .hl-horizon .hl-arrow').count();
    if(width>=900)for(const endpoint of ['A start','A end','B start','B end'])if(!endpoints.some(text=>text.startsWith(endpoint+' ')))fail(`${width}x${height}: horizon paths do not label ${endpoint} UTC`);
    else if(!await page.locator('.hl-compare .hl-horizon .hl-legend').innerText().then(text=>/times UTC/.test(text)))fail(`${width}x${height}: compact horizon chart lost its UTC legend`);
    if(arrows<2)fail(`${width}x${height}: A/B horizon paths are missing directional arrows (${arrows})`);
    const clearance=page.locator('.hl-compare .hl-clearance'),clearanceTitle=(await clearance.locator('h3').innerText()).replace(/\s+/g,' '),clearanceLabel=await clearance.locator('svg[role="img"]').getAttribute('aria-label'),clearancePaths=await clearance.locator('.hl-curve').count();
    if(!/Sun centre minus the terrain horizon/.test(clearanceTitle)||clearancePaths!==3||!clearanceLabel?.startsWith('A ')||!/[.] B /.test(clearanceLabel??'')||!/[.] C /.test(clearanceLabel??''))fail(`${width}x${height}: clearance chart is missing its terrain-horizon definition or A/B/C series: ${JSON.stringify({clearanceTitle,clearanceLabel,clearancePaths})}`);
    reports.push(`${width}x${height}: no horizontal overflow; legends ${home.fontSize}/${compare.fontSize} px (contrast ${home.contrast}/${compare.contrast}:1), SVG axes ${home.axisFontSize}/${compare.axisFontSize} px (contrast ${home.axisContrast}/${compare.axisContrast}:1)`);await ctx.close();
  }
  return reports.join('; ');
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
      await page.waitForFunction(v=>{const el=document.querySelector('#arrival'),cards=[...document.querySelectorAll('.answer-scenario')];return el?.value===v&&cards.length===3&&cards.every(c=>c.querySelector('dl:not(.answer-context) dd')?.textContent.trim()==='Not calculated');},date,{timeout:5000});
      if(date&&await input.getAttribute('aria-invalid')!=='true')fail(`${label}: invalid raw date ${JSON.stringify(date)} is not marked invalid`);
      if(await input.inputValue()!==date)fail(`${label}: invalid raw text ${JSON.stringify(date)} was not preserved for correction`);
    }
    await input.fill('2027-03-01');
    await page.waitForFunction(()=>[...document.querySelectorAll('.answer-scenario')].length===3&&[...document.querySelectorAll('.answer-scenario')].every(c=>c.querySelector('dl:not(.answer-context) dd')?.textContent.trim()!=='Not calculated'),null,{timeout:10000});
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

await check('planet inspector loads textured Saturn and Sun, reports their limits, and advances while following a planet',async()=>{
  const {ctx,page}=await context(browser,'planet-inspector');const planetAssets=[];
  page.on('response',response=>{if(response.url().includes('/assets/planets/'))planetAssets.push({url:response.url(),status:response.status()});});
  await go(page,'simulator');
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.ready===true,null,{timeout:30000});
  const picker=page.getByLabel('Look at a body: close view');await picker.waitFor();
  const available=(await picker.locator('option').allTextContents()).join(' ');
  if(!/Saturn/.test(available)||!/Sun/.test(available))fail(`individual planet inspector is missing key options: ${available}`);
  const explore=page.locator('.explore-bodies');
  if((await explore.locator('h3').innerText()).trim()!=='Explore other celestial bodies')fail('setup panel lacks the Explore other celestial bodies heading');
  const bodyButtons=await explore.locator('button').allTextContents();
  if(bodyButtons.length!==8||!bodyButtons.includes('Sun')||!bodyButtons.includes('Saturn'))fail(`close-view buttons should include the Sun and all seven planets: ${JSON.stringify(bodyButtons)}`);
  await explore.getByRole('button',{name:'Sun',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().trackedBody==='sun',null,{timeout:12000});
  await picker.selectOption('saturn');
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().trackedBody==='saturn',null,{timeout:12000});
  const saturnStart=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.());
  if(!saturnStart?.bodies?.saturn?.visible)fail('Saturn was not visible after inspector selection');
  const canvas=page.locator('.space-canvas canvas'),first=await canvas.screenshot();
  await page.getByLabel('Speed').selectOption('24');
  await page.waitForFunction(start=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.presentedIndex>=start+24,saturnStart.rendered.presentedIndex,{timeout:7000});
  const saturnEnd=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.());
  if(saturnEnd.trackedBody!=='saturn'||!saturnEnd.bodies?.saturn?.visible)fail('Saturn follow or visibility was lost during playback');
  const rotated=await canvas.screenshot();
  await page.locator('.camera-presets button').filter({hasText:'Surface sky'}).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.view==='sky',null,{timeout:10000});
  await picker.selectOption('saturn');
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().skyTracking==='saturn'&&document.querySelector('.planet-note')?.textContent.includes('Saturn:'),null,{timeout:12000});
  const saturnNote=(await page.locator('.planet-note').innerText()).trim();
  if(!/rings drawn from 1\.24 to 2\.27 Saturn radii/.test(saturnNote)||!/tilt shown is illustrative/.test(saturnNote))fail(`Saturn note omits ring bounds or illustrative tilt: ${saturnNote}`);
  await picker.selectOption('sun');
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().skyTracking==='sun'&&document.querySelector('.planet-note')?.textContent.includes('Sun:'),null,{timeout:12000});
  const sunNote=(await page.locator('.planet-note').innerText()).trim();
  if(!/illustrative/.test(sunNote)||!/sidereal period/.test(sunNote))fail(`Sun rotation note is missing its illustrative limit or sidereal period: ${sunNote}`);
  const expectedAssets=['sun.jpg','mercury.jpg','venus.jpg','mars.jpg','jupiter.jpg','saturn.jpg','saturn-ring.png','uranus.jpg','neptune.jpg'];
  await page.waitForFunction(files=>files.every(file=>performance.getEntriesByType('resource').some(e=>new URL(e.name).pathname.endsWith(`/assets/planets/${file}`))),expectedAssets,{timeout:15000});
  const assetRequests=expectedAssets.map(file=>planetAssets.find(a=>new URL(a.url).pathname.endsWith(`/assets/planets/${file}`)));
  if(assetRequests.some(a=>a?.status!==200))fail(`textured planet asset requests did not all return HTTP 200: ${JSON.stringify({expectedAssets,assetRequests})}`);
  const report={available,assets:assetRequests,tracked:saturnEnd.trackedBody,indexAdvance:+(saturnEnd.rendered.presentedIndex-saturnStart.rendered.presentedIndex).toFixed(2),triangles:saturnEnd.rendered.triangles,renderScale:saturnEnd.rendered.renderScale,terrainDetail:saturnEnd.rendered.terrainDetail,canvasImageChanged:Buffer.compare(first,rotated)!==0,notes:{saturn:saturnNote,sun:sunNote}};
  writeFileSync(join(OUT,'planet-inspector.json'),JSON.stringify(report,null,2));
  await ctx.close();return `Saturn/Sun inspector notes visible; Saturn ring and Sun textures HTTP 200; Saturn remained tracked and visible through ${report.indexAdvance} h; ${report.triangles} triangles, scale ${report.renderScale}, ${report.terrainDetail} terrain detail`;
});

await check('Sun close-view corona animates without changing measured geometry and is static with reduced motion',async()=>{
  const fields=(s)=>({index:s?.observation?.index,presentedIndex:s?.rendered?.presentedIndex,sunRadius:s?.bodies?.sun?.radius,angularRadiusDeg:s?.observation?.sunDetail?.angularRadiusDeg,sun:s?.observation?.sun,terrainFraction:s?.observation?.sunDetail?.terrainFraction,unobscuredFraction:s?.observation?.sunDetail?.unobscuredFraction,earth:s?.observation?.earth});
  const {ctx,page}=await context(browser,'sun-corona-normal');await go(page,'simulator');
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.ready===true,null,{timeout:30000});
  if(await page.getByRole('button',{name:'Pause',exact:true}).isVisible())await page.getByRole('button',{name:'Pause',exact:true}).click();
  const explore=page.locator('.explore-bodies');await explore.getByRole('button',{name:'Sun',exact:true}).click();
  await page.waitForFunction(()=>{const s=document.querySelector('canvas')?.lunarSnapshot?.();return s?.trackedBody==='sun'&&s?.rendered?.view==='overview'&&!s?.transition;},null,{timeout:20000});
  const canvas=page.locator('.space-canvas canvas'),start=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.()),startFields=fields(start),first=await canvas.screenshot();
  await page.waitForTimeout(1000);
  const end=await page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.()),endFields=fields(end),second=await canvas.screenshot();
  if(Buffer.compare(first,second)===0)fail('normal-motion Sun close view did not animate its corona pixels');
  for(const key of Object.keys(startFields))if(Math.abs(startFields[key]-endFields[key])>1e-10)fail(`Sun corona animation changed physical/display measurement ${key}: ${startFields[key]} -> ${endFields[key]}`);
  await writeFileSync(join(OUT,'sun-corona-normal-start.png'),first);await writeFileSync(join(OUT,'sun-corona-normal-end.png'),second);
  await ctx.close();

  const {ctx:reducedCtx,page:reducedPage}=await context(browser,'sun-corona-reduced',{motion:'reduce'});await go(reducedPage,'simulator');
  await reducedPage.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot?.().rendered?.ready===true,null,{timeout:30000});
  if(await reducedPage.getByRole('button',{name:'Pause',exact:true}).isVisible())fail('reduced-motion simulator unexpectedly started playing');
  await reducedPage.locator('.explore-bodies').getByRole('button',{name:'Sun',exact:true}).click();
  await reducedPage.waitForFunction(()=>{const s=document.querySelector('canvas')?.lunarSnapshot?.();return s?.trackedBody==='sun'&&s?.rendered?.view==='overview'&&!s?.transition;},null,{timeout:20000});
  const reducedCanvas=reducedPage.locator('.space-canvas canvas'),reducedStart=await reducedPage.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.()),reducedA=await reducedCanvas.screenshot();
  await reducedPage.waitForTimeout(900);
  const reducedEnd=await reducedPage.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.()),reducedB=await reducedCanvas.screenshot();
  if(Buffer.compare(reducedA,reducedB)!==0)fail('reduced-motion Sun corona changed pixels while paused');
  for(const key of Object.keys(fields(reducedStart)))if(Math.abs(fields(reducedStart)[key]-fields(reducedEnd)[key])>1e-10)fail(`reduced-motion Sun measurements changed during static close view: ${key}`);
  await writeFileSync(join(OUT,'sun-corona-reduced.png'),reducedB);await reducedCtx.close();
  return `normal paused close view changed corona pixels while Sun radius/angular radius/visibility fractions/time stayed constant; reduced-motion paused view was pixel-identical over 900 ms`;
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
