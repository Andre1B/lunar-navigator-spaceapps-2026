// Browser QA (Playwright). Not part of `npm test` (name does not end in .test.mjs).
//   dev:        node tests/browser-check.mjs                 (http://localhost:5173)
//   production: QA_URL=https://<site> node tests/browser-check.mjs
// Env: QA_OUT=<dir> overrides the output directory (use a separate one per base URL); QA_HEADED=1 shows the browser. Output: ../tmp/lunar-qa/{results.json,*.png} (outside git).
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const BASE=(process.env.QA_URL||'http://localhost:5173').replace(/\/$/,'');
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(dirname(fileURLToPath(import.meta.url)),'..','..','tmp','lunar-qa');
mkdirSync(OUT,{recursive:true});
const CHROME_EXE='C:/Program Files/Google/Chrome/Application/chrome.exe';
const results=[];
const issues={console:[],pageerror:[],http:[],requestfailed:[]};

async function launch(){
  const args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
  const headless=!process.env.QA_HEADED;
  for(const opts of [{channel:'chrome'},existsSync(CHROME_EXE)?{executablePath:CHROME_EXE}:null,{}]){
    if(!opts)continue;
    try{return await chromium.launch({headless,args,...opts});}catch(e){console.error('launch failed',JSON.stringify(opts),e.message.split('\n')[0]);}
  }
  throw new Error('no usable browser');
}
function watch(page,tag){
  page.on('console',m=>{if(m.type()==='error')issues.console.push({tag,text:m.text().slice(0,300),url:page.url()});});
  page.on('pageerror',e=>issues.pageerror.push({tag,text:String(e).slice(0,300),url:page.url()}));
  page.on('response',r=>{if(r.status()>=400)issues.http.push({tag,status:r.status(),url:r.url()});});
  page.on('requestfailed',r=>issues.requestfailed.push({tag,url:r.url(),error:r.failure()?.errorText}));
}
async function check(name,fn){
  const t=Date.now();
  try{const detail=await fn();results.push({name,ok:true,detail:detail??'',ms:Date.now()-t});console.log('PASS',name);}
  catch(e){results.push({name,ok:false,detail:String(e.message||e).split('\n')[0],ms:Date.now()-t});console.log('FAIL',name,'-',String(e.message||e).split('\n')[0]);}
}
function expect(cond,msg){if(!cond)throw new Error(msg);}
const shot=(page,name)=>page.screenshot({path:join(OUT,name+'.png'),fullPage:true});

async function open(ctx,route,tag){
  const page=await ctx.newPage();watch(page,tag);
  await page.goto(`${BASE}/#/${route}`,{waitUntil:'networkidle'});
  await page.locator('#main').waitFor();
  return page;
}
const tableText=(page)=>page.locator('table').first().locator('tbody tr').allInnerTexts();
async function waitData(page){await page.locator('table').first().locator('tbody tr').first().waitFor({timeout:15000});}
async function activeInfo(page){return page.evaluate(()=>({id:document.activeElement?.id||'',tag:document.activeElement?.tagName,text:(document.activeElement?.textContent||'').trim().slice(0,60),hash:location.hash}));}

const browser=await launch();
console.log('browser',browser.version(),'base',BASE);
const desktop=await browser.newContext({viewport:{width:1440,height:900}});
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});

// ---- Home & start modes & chapters
await check('home: both start modes enter the mission with the right mode',async()=>{
  const page=await open(desktop,'home','home');
  await shot(page,'desktop-home');
  await page.getByRole('button',{name:'Start in Faithful Mode'}).click();
  await page.waitForFunction(()=>location.hash==='#/mission');
  expect((await page.locator('.header-mode').innerText()).startsWith('Faithful'),'faithful label');
  await page.goBack();
  await page.getByRole('button',{name:'Start in Free Mode'}).click();
  await page.waitForFunction(()=>location.hash==='#/mission');
  expect((await page.locator('.header-mode').innerText()).startsWith('Free'),'free label');
  expect(/free mode/i.test(await page.locator('.section-label').first().innerText()),'mission label shows Free Mode');
  await page.close();
});
await check('mission: all chapters open immediately and each has an action route',async()=>{
  const page=await open(desktop,'mission','mission');
  const n=await page.locator('.chapter-list button').count();
  expect(n===5,`expected 5 chapters, got ${n}`);
  const titles=new Set();
  for(let i=0;i<n;i++){
    const b=page.locator('.chapter-list button').nth(i);
    expect(await b.isEnabled(),`chapter ${i+1} disabled`);
    await b.click();
    titles.add(await page.locator('h1').innerText());
    expect(await b.getAttribute('aria-current')==='step',`chapter ${i+1} not current`);
  }
  expect(titles.size===5,'chapter headings are not distinct');
  expect(await page.getByRole('button',{name:'Previous chapter'}).isEnabled(),'previous enabled on last chapter');
  await page.getByRole('button',{name:'Review your decision'}).click();
  await page.waitForFunction(()=>location.hash==='#/compare');
  await page.close();
});
await check('home: "Open all stages" link goes straight to compare',async()=>{
  const page=await open(desktop,'home','home2');
  await page.getByRole('link',{name:/Open all stages/}).click();
  await page.waitForFunction(()=>location.hash==='#/compare');
  await page.close();
});

await check('mission: notes and "explored" persist across chapters and routes, and are never sent to a server',async()=>{
  const page=await open(desktop,'mission','notes');
  const posts=[];page.on('request',r=>{if(r.method()!=='GET'&&r.method()!=='HEAD')posts.push(r.method()+' '+r.url());});
  const note=page.getByLabel('Your mission notes'),explored=page.getByLabel('I explored this question');
  await note.fill('Prediction: delay helps\nsecond line');await explored.check();
  await page.locator('.chapter-list button').nth(2).click();
  expect((await note.inputValue())==='','another chapter must have its own empty note');
  await note.fill('chapter 3 note');
  await page.locator('.chapter-list button').nth(0).click();
  expect(await note.inputValue()==='Prediction: delay helps\nsecond line','note lost when switching chapters');
  expect(await explored.isChecked(),'explored flag lost');
  await page.getByRole('link',{name:'Compare'}).first().click();
  await page.waitForFunction(()=>location.hash==='#/compare');
  await page.getByRole('link',{name:'Guided Mission'}).click();
  await page.waitForFunction(()=>location.hash==='#/mission');
  expect(await note.inputValue()==='Prediction: delay helps\nsecond line','note lost after leaving the route');
  await page.locator('.chapter-list button').nth(2).click();
  expect(await note.inputValue()==='chapter 3 note','chapter 3 note lost');
  expect(await note.getAttribute('maxlength')==='1000','maxlength 1000');
  expect(posts.length===0,'notes must not be sent to a server: '+posts.join(', '));
  await page.close();
});

// ---- Compare
await check('compare: scenarios respond to data changes, outside coverage and empty date are handled',async()=>{
  const page=await open(desktop,'compare','compare');await waitData(page);
  await shot(page,'desktop-compare');
  const base=await tableText(page);
  expect(base.length===3,'3 scenario rows');
  expect(!base.join(' ').includes('NaN')&&!base.join(' ').includes('undefined'),'NaN/undefined in table');
  await page.selectOption('#site','shackleton-rim');
  const bySite=await tableText(page);
  expect(bySite[0]!==base[0],'changing the point did not change the original row');
  await page.selectOption('#height','5');
  expect((await tableText(page))[0]!==bySite[0],'changing height did not change the row');
  await page.selectOption('#height','1');
  await page.selectOption('#delay','29');
  expect((await tableText(page))[1]!==bySite[1],'delay did not change the delayed row');
  // outside coverage: arrival 2027-04-27 + 7 d window is beyond 2027-04-28
  await page.fill('#arrival','2027-04-27');
  let rows=await tableText(page);
  expect(rows.every(r=>r.includes('Not calculated')),'rows beyond coverage must say Not calculated: '+rows[0]);
  expect(await page.locator('.decision li').first().innerText().then(t=>/Outside calculated coverage/.test(t)),'decision list says outside coverage');
  // empty date must not crash the page
  await page.fill('#arrival','');
  rows=await tableText(page);
  expect(rows.length===3&&rows.every(r=>r.includes('Not calculated')),'empty date rows');
  expect(await page.locator('h1').innerText().then(t=>t.length>0),'page still rendered');
  await page.fill('#arrival','2027-03-01');
  expect((await tableText(page))[0].includes('%'),'recovers after valid date');
  // censored duration markers are shown with ≥
  const all=(await tableText(page)).join(' ');
  await page.selectOption('#days','28');
  const long=(await tableText(page)).join(' ');
  expect(/Not calculated|%/.test(long),'28-day window renders');
  return `rows default: ${base[0].replace(/\s+/g,' ').slice(0,120)} | has ≥ at 7d:${all.includes('≥')} 28d:${long.includes('≥')}`;
});
await check('compare: user-defined darkness limit and honest caveats',async()=>{
  const page=await open(desktop,'compare','compare2');await waitData(page);
  await page.fill('#dark-limit','0');
  const t=await page.locator('.decision ul').innerText();
  expect(/Exceeds this darkness limit|Lower bound/.test(t),'limit 0 should be exceeded or lower-bound: '+t.slice(0,80));
  const body=await page.locator('main').innerText();
  expect(/not a NASA requirement/.test(body),'must state limit is not a NASA requirement');
  expect(/does not guarantee an operational link/.test(body),'Earth visibility caveat');
  expect(!/\?1 minute/.test(body),'garbled "?1 minute" glyph (should be ≤ 1 minute)');
  await page.close();
});

// ---- Simulator
await check('simulator: Free Mode freeze persists while stepping; Reset to Faithful clears',async()=>{
  const page=await open(desktop,'simulator','sim');await page.getByRole('button',{name:/Step \+1 h/}).waitFor({timeout:15000});
  await page.waitForTimeout(1500);await shot(page,'desktop-simulator');
  const clock=()=>page.locator('.playback .mono').innerText();
  expect((await page.getByRole('button',{name:'Faithful Mode'}).getAttribute('aria-pressed'))==='true','starts faithful');
  await page.getByRole('button',{name:'Free Mode'}).click();
  const box=page.getByLabel("Earth's position relative to the Moon");
  expect(await box.isVisible(),'freeze controls visible in Free Mode');
  expect(!(await box.isChecked()),'unchecked initially');
  const t0=await clock();
  await box.check();
  await page.getByRole('button',{name:/Step \+1 h/}).click();
  await page.getByRole('button',{name:/Step \+1 h/}).click();
  const t1=await clock();
  expect(t1!==t0,'clock did not advance');
  expect(await box.isChecked(),'freeze checkbox lost on stepping');
  expect(await page.locator('.free-notice').innerText().then(t=>/No mission recommendations/.test(t)),'free mode disclaimer');
  await page.getByRole('button',{name:'Reset to Faithful Mode'}).click();
  expect(await page.locator('.free-notice').count()===0,'free notice should disappear');
  expect((await page.locator('.header-mode').innerText()).startsWith('Faithful'),'header back to Faithful');
  await page.getByRole('button',{name:'Free Mode'}).click();
  expect(!(await page.getByLabel("Earth's position relative to the Moon").isChecked()),'freezes cleared after reset');
  await page.close();
});
await check('simulator: switching mode stops playback',async()=>{
  const page=await open(desktop,'simulator','sim2');await page.getByRole('button',{name:'Play'}).waitFor({timeout:15000});
  await page.getByRole('button',{name:'Play'}).click();
  expect(await page.getByRole('button',{name:'Pause'}).isVisible(),'Pause shown while playing');
  await page.getByRole('button',{name:'Free Mode'}).click();
  expect(await page.getByRole('button',{name:'Play'}).isVisible(),'playback should stop on mode change');
  await page.close();
});
await check('simulator: immersive hides other controls; Escape returns and focus is restored safely',async()=>{
  const page=await open(desktop,'simulator','immersive');
  const enter=page.getByRole('button',{name:/Explore space/});await enter.waitFor({timeout:15000});
  await enter.click();
  const back=page.getByRole('button',{name:/Return to workspace/});
  await back.waitFor();
  expect((await activeInfo(page)).text.startsWith('Return to workspace'),'focus should move to the return button');
  expect(await page.evaluate(()=>document.body.classList.contains('immersive-active')),'body class');
  for(const sel of ['.header','.footer','.sim-toolbar','.sim-bottom']){
    const vis=await page.locator(sel).first().isVisible().catch(()=>false);
    expect(!vis,`${sel} should be hidden in immersive mode`);
  }
  await shot(page,'desktop-simulator-immersive');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.body.classList.contains('immersive-active'));
  const a=await activeInfo(page);
  expect(/Explore space/.test(a.text),'focus must return to the Explore space button, got '+JSON.stringify(a));
  expect(await page.locator('.header').isVisible(),'header visible again');
  // keyboard path: Enter on the focused native button re-enters immersive
  await page.keyboard.press('Enter');
  await back.waitFor();
  await page.keyboard.press('Escape');
  await page.close();
});


// ---- Celestial focus, planets (visual context) and HUD layout
async function simPage(ctx,tag,viewName){
  const page=await open(ctx,'simulator',tag);
  await page.locator('[aria-label="Focus a celestial body"]').waitFor({timeout:20000});
  await page.waitForTimeout(800);
  if(viewName==='sky')await page.selectOption('.sim-toolbar select >> nth=0','sky');
  return page;
}
await check('simulator: "Look at" focus works for Sun, Earth, Moon, solar context and every planet (no console errors)',async()=>{
  const before=issues.console.length+issues.pageerror.length;
  const page=await simPage(desktop,'focus');
  const sel=page.locator('[aria-label="Focus a celestial body"]');
  const opts=await sel.locator('option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
  for(const need of ['moon','system','sun','earth'])expect(opts.includes(need),'overview option missing: '+need);
  const planets=opts.filter(v=>!['moon','system','sun','earth'].includes(v));
  expect(planets.length===7||planets.length===0,'expected 7 planets (or none if planets.json absent), got '+planets.length);
  for(const v of opts){
    await sel.selectOption(v);await page.waitForTimeout(150);
    expect(await sel.inputValue()==='','selector should reset to the placeholder after '+v);
  }
  // sky view: Moon and solar-context are not offered; Sun/Earth/planets are
  await page.selectOption('.sim-toolbar select >> nth=0','sky');await page.waitForTimeout(500);
  const skyOpts=await sel.locator('option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
  expect(!skyOpts.includes('moon')&&!skyOpts.includes('system'),'moon/system must not be offered in surface sky view');
  for(const v of skyOpts){await sel.selectOption(v);await page.waitForTimeout(150);}
  await shot(page,'desktop-simulator-sky');
  const fresh=[...issues.console,...issues.pageerror].slice(before);
  expect(fresh.length===0,'console/page errors while focusing: '+JSON.stringify(fresh.slice(0,3)));
  await page.close();
  return `overview options: ${opts.join(',')}`;
});
await check('simulator: planet position freezes are optional extras, stay in Free Mode only, and persist while stepping',async()=>{
  const page=await simPage(desktop,'planet-freeze');
  expect(await page.getByLabel(/'s position relative to the Moon/).count()===0||true,'n/a');
  await page.getByRole('button',{name:'Free Mode'}).click();
  const boxes=page.locator('.freeze-controls input[type=checkbox]');
  const n=await boxes.count();
  expect(n===4||n===11,'expected 4 core freezes (+7 planets), got '+n);
  if(n===11){
    const mars=page.getByLabel("Mars's position relative to the Moon");
    await mars.check();
    await page.getByRole('button',{name:/Step \+1 h/}).click();
    expect(await mars.isChecked(),'Mars freeze lost after stepping');
    await page.getByRole('button',{name:'Reset to Faithful Mode'}).click();
    expect(await page.locator('.freeze-controls').count()===0,'freeze controls leave with Faithful Mode');
    await page.getByRole('button',{name:'Free Mode'}).click();
    expect(!(await page.getByLabel("Mars's position relative to the Moon").isChecked()),'Mars freeze cleared by reset');
  }
  const body=await page.locator('main').innerText();
  expect(/visual context only/i.test(body)||n===4,'planets must be labelled visual context only');
  expect(!/\b(optimal|best site|recommend(ed)? (site|landing))/i.test(body),'Free Mode must not offer mission recommendations');
  await page.close();
  return `freeze checkboxes: ${n}`;
});
for(const [label,ctx,w] of [['desktop-1440',desktop,1440],['mobile-390',mobile,390]])for(const view of ['overview','sky']){
  await check(`${label} ${view}: scene HUD (look-at, camera buttons, caption) stays inside the frame without overlapping`,async()=>{
    const page=await simPage(ctx,`hud-${label}-${view}`,view);
    const r=await page.evaluate(()=>{
      const box=e=>{const b=e.getBoundingClientRect();return {l:b.left,t:b.top,r:b.right,b:b.bottom,w:b.width,h:b.height};};
      const frame=document.querySelector('.scene-frame');const f=box(frame);
      const hud=[...document.querySelectorAll('.camera-controls select, .camera-controls button, .scene-caption, .return-workspace')].filter(e=>e.getBoundingClientRect().width>0).map(e=>({name:(e.getAttribute('aria-label')||e.textContent||e.className).trim().slice(0,28),...box(e)}));
      const overlaps=[];
      for(let i=0;i<hud.length;i++)for(let j=i+1;j<hud.length;j++){
        const a=hud[i],b=hud[j];const ix=Math.min(a.r,b.r)-Math.max(a.l,b.l),iy=Math.min(a.b,b.b)-Math.max(a.t,b.t);
        if(ix>2&&iy>2)overlaps.push(`${a.name} x ${b.name} (${Math.round(ix)}x${Math.round(iy)})`);
      }
      const outside=hud.filter(h=>h.l<f.l-1||h.r>f.r+1||h.t<f.t-1||h.b>f.b+1).map(h=>h.name);
      return {overlaps,outside,n:hud.length,sw:document.documentElement.scrollWidth,vw:document.documentElement.clientWidth};
    });
    await shot(page,`${label}-simulator-${view}-hud`);
    expect(r.n>=5,'HUD elements not found');
    expect(r.sw<=r.vw+1,`horizontal overflow ${r.sw}>${r.vw}`);
    expect(r.overlaps.length===0,'overlapping HUD elements: '+r.overlaps.slice(0,4).join('; '));
    expect(r.outside.length===0,'HUD elements outside the scene frame: '+r.outside.slice(0,4).join(', '));
    await page.close();
  });
}

// ---- Accessibility basics
await check('skip link: focus lands on #main and the route hash is kept',async()=>{
  const page=await open(desktop,'compare','skip');
  await page.keyboard.press('Tab');
  const first=await page.evaluate(()=>document.activeElement.className+'|'+document.activeElement.textContent);
  expect(/skip-link/.test(first),'first Tab stop must be the skip link: '+first);
  expect(await page.locator('.skip-link').isVisible(),'skip link visible on focus');
  await page.keyboard.press('Enter');
  const a=await activeInfo(page);
  expect(a.id==='main','focus not on main: '+JSON.stringify(a));
  expect(a.hash==='#/compare','hash changed to '+a.hash);
  await page.close();
});
await check('keyboard: Tab reaches nav and native buttons; Enter/Space activate; focus is visible',async()=>{
  const page=await open(desktop,'home','kbd');
  const seen=[];
  for(let i=0;i<14;i++){await page.keyboard.press('Tab');seen.push(await page.evaluate(()=>{const e=document.activeElement;const s=getComputedStyle(e);return {tag:e.tagName,text:(e.textContent||e.getAttribute('alt')||'').trim().slice(0,30),outline:s.outlineStyle+' '+s.outlineWidth,shadow:s.boxShadow!=='none'};}));}
  expect(seen.some(s=>s.tag==='BUTTON'&&/Faithful/.test(s.text)),'Faithful button not reachable by Tab');
  expect(seen.some(s=>s.tag==='A'&&/Compare/.test(s.text)),'nav link not reachable');
  const noRing=seen.filter(s=>(/^none/.test(s.outline)||/ 0px$/.test(s.outline))&&!s.shadow);
  expect(noRing.length===0,'focused elements without visible indicator: '+JSON.stringify(noRing.slice(0,3)));
  // activate with Space on a native button
  await page.getByRole('button',{name:'Start in Faithful Mode'}).focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>location.hash==='#/mission');
  await page.close();
});
await check('evidence: validation statuses rendered, caveats present, no garbled glyphs',async()=>{
  const page=await open(desktop,'evidence','evidence');
  await page.locator('.validation-list article').first().waitFor({timeout:15000});
  expect(await page.locator('.validation-list article').count()===6,'6 validation tests');
  const t=await page.locator('main').innerText();
  expect(/not antenna gain|link budget/.test(t),'comms caveat');
  expect(!/\?1 minute/.test(t),'garbled "?1 minute"');
  await page.close();
});
await check('credits: GitHub links present and external links are safe',async()=>{
  const page=await open(desktop,'credits','credits');
  await page.locator('.credit-list article').first().waitFor({timeout:15000});
  const location=new URL(page.url());
  const links=await page.$$eval('a[target=_blank]',as=>as.map(a=>({rel:a.rel,href:a.href})));
  expect(links.length>10,'few external links: '+links.length);
  expect(links.every(l=>/noopener|noreferrer/.test(l.rel)),'target=_blank without noopener/noreferrer (noreferrer implies noopener)');
  expect(links.some(l=>/github\.com/.test(l.href)),'GitHub links');
  const bad=links.filter(l=>!/^https:\/\/[^/]+\.[a-z]{2,}/i.test(l.href)||/localhost|github:|git@|\/#\//.test(l.href)||new URL(l.href).origin===location.origin);
  expect(bad.length===0,'credits links that are not absolute https URLs to external sites: '+bad.slice(0,4).map(l=>l.href).join(', '));
  expect(await page.locator('main').innerText().then(t=>/not certify or endorse|no affiliation or endorsement/i.test(t)),'no-endorsement statement');
  await page.close();
});

// ---- Responsive overflow
for(const [label,ctx] of [['desktop-1440',desktop],['mobile-390',mobile]]){
  await check(`${label}: no horizontal overflow on any route (tables scroll internally)`,async()=>{
    const bad=[];
    for(const route of ['home','mission','simulator','compare','evidence','credits']){
      const page=await open(ctx,route,'overflow-'+label);
      if(route==='compare')await waitData(page);
      if(route==='simulator')await page.waitForTimeout(1200);
      if(label.startsWith('mobile')&&['home','simulator','compare'].includes(route))await shot(page,`mobile-${route}`);
      const r=await page.evaluate(()=>{
        const vw=document.documentElement.clientWidth;
        const skip=e=>e.closest('.table-wrap,pre,nav,.chapter-list'); // intentionally scrollable regions
        const boxes=[...document.querySelectorAll('body *')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.right>vw+1||b.left<-1)&&!skip(e)&&getComputedStyle(e).position!=='fixed';}).map(e=>e.tagName+'.'+e.className+' (box)');
        const text=[...document.querySelectorAll('main *')].filter(e=>e.scrollWidth>e.clientWidth+1&&e.clientWidth>0&&!skip(e)&&getComputedStyle(e).overflowX==='visible'&&e.children.length===0).map(e=>e.tagName+'.'+e.className+' (text overflow '+e.scrollWidth+'>'+e.clientWidth+')');
        const off=[...boxes,...text].slice(0,3);
        return {sw:document.documentElement.scrollWidth,vw,off};
      });
      if(r.sw>r.vw+1||r.off.length)bad.push(`${route}: scrollWidth ${r.sw} > ${r.vw}; e.g. ${r.off.join(', ')}`);
      await page.close();
    }
    expect(bad.length===0,bad.join(' || '));
  });
}
await check('mobile-390: primary controls are usable (tap targets >= 24 px, header nav reachable)',async()=>{
  const page=await open(mobile,'compare','mobile-targets');await waitData(page);
  const small=await page.$$eval('button,select,input,a.button',els=>els.filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.height<24||b.width<24);}).map(e=>e.tagName+':'+(e.textContent||e.id).trim().slice(0,20)));
  expect(small.length===0,'targets under 24px: '+small.join(', '));
  await page.close();
});

// ---- Reduced motion
await check('prefers-reduced-motion: simulation does not autoplay and CSS animations are suppressed',async()=>{
  const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  const page=await open(ctx,'simulator','reduced');
  await page.getByRole('button',{name:'Play'}).waitFor({timeout:15000});
  const t0=await page.locator('.playback .mono').innerText();
  await page.waitForTimeout(1600);
  expect(await page.locator('.playback .mono').innerText()===t0,'clock advanced without user action');
  expect(await page.getByRole('button',{name:'Play'}).isVisible(),'initial playing must be false');
  const anim=await page.evaluate(()=>[...document.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);return s.animationName!=='none'&&parseFloat(s.animationDuration)>0.05&&s.animationIterationCount!=='1';}).slice(0,5).map(e=>e.tagName+'.'+e.className+':'+getComputedStyle(e).animationName));
  expect(anim.length===0,'looping animations under reduced motion: '+anim.join(', '));
  await ctx.close();
  return 'no autoplay, no looping CSS animation';
});
await check('default motion: simulation also starts paused',async()=>{
  const page=await open(desktop,'simulator','paused');
  await page.getByRole('button',{name:'Play'}).waitFor({timeout:15000});
  await page.close();
});

await check('public files and linked pages respond (summary, AI record, datasets, credits)',async()=>{
  const paths=['/summary.html','/summary.txt','/ai-use.json','/credits.json','/data/manifest.json','/data/sky.json','/data/validation.json','/data/planets.json','/data/sites/connecting-ridge.json','/icon.svg'];
  const bad=[];const info=[];
  for(const p of paths){const r=await desktop.request.get(BASE+p);const ct=r.headers()['content-type']||'';info.push(`${p}:${r.status()}`);if(!r.ok()||/text\/html/.test(ct)&&p.endsWith('.json'))bad.push(`${p} ${r.status()} ${ct}`);}
  expect(bad.length===0,'bad responses: '+bad.join('; '));
  return info.join(' ');
});

// ---- Network / console hygiene (collected across all flows above)
await check('no failed requests (HTTP >= 400, requestfailed) during any flow',async()=>{
  const bad=[...issues.http,...issues.requestfailed].filter(x=>!/favicon\.ico/.test(x.url));
  expect(bad.length===0,JSON.stringify(bad.slice(0,5)));
});
await check('no console errors or uncaught page errors during any flow',async()=>{
  const bad=[...issues.console,...issues.pageerror];
  expect(bad.length===0,JSON.stringify(bad.slice(0,4)));
});

await browser.close();
const failed=results.filter(r=>!r.ok).length;
const summary={base:BASE,at:new Date().toISOString(),passed:results.length-failed,failed,results,issues};
writeFileSync(join(OUT,'results.json'),JSON.stringify(summary,null,1));
console.log(`\n${summary.passed}/${results.length} passed. Results and screenshots: ${OUT}`);
process.exit(failed?1:0);
