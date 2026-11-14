// Browser QA for the V2 redesign (Home, Learn, Explore 3D, tour, Compare, ...). Playwright, not part of `npm test`.
//   dev:  node tests/browser-check-v2.mjs                (http://localhost:5173)
//   prod: QA_URL=https://... node tests/browser-check-v2.mjs
// Env: QA_OUT overrides the output dir (default ../tmp/lunar-qa-v2); QA_HEADED=1 shows the browser.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const BASE=(process.env.QA_URL||'http://localhost:5173').replace(/\/$/,'');
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(dirname(fileURLToPath(import.meta.url)),'..','..','tmp','lunar-qa-v2');
mkdirSync(OUT,{recursive:true});
const CHROME_EXE='C:/Program Files/Google/Chrome/Application/chrome.exe';
const results=[],issues={console:[],pageerror:[],http:[],requestfailed:[]};
const expect=(c,m)=>{if(!c)throw new Error(m);};
const ROUTES=['home','learn','mission','simulator','compare','evidence','credits'];
const TOUR_STEPS=10;

async function launch(){
  const args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
  const headless=!process.env.QA_HEADED;
  for(const o of [{channel:'chrome'},existsSync(CHROME_EXE)?{executablePath:CHROME_EXE}:null,{}]){
    if(!o)continue;try{return await chromium.launch({headless,args,...o});}catch(e){console.error('launch failed',e.message.split('\n')[0]);}
  }
  throw new Error('no usable browser');
}
async function check(name,fn){
  const t=Date.now();
  try{const detail=await fn();results.push({name,ok:true,detail:detail??'',ms:Date.now()-t});console.log('PASS',name);}
  catch(e){results.push({name,ok:false,detail:String(e.message||e).split('\n')[0],ms:Date.now()-t});console.log('FAIL',name,'-',String(e.message||e).split('\n')[0]);}
}
function watch(page,tag){
  page.on('console',m=>{if(m.type()==='error')issues.console.push({tag,text:m.text().slice(0,200),url:page.url()});});
  page.on('pageerror',e=>issues.pageerror.push({tag,text:String(e).slice(0,200),url:page.url()}));
  page.on('response',r=>{if(r.status()>=400)issues.http.push({tag,status:r.status(),url:r.url()});});
  page.on('requestfailed',r=>{if(r.failure()?.errorText==='net::ERR_ABORTED')return;issues.requestfailed.push({tag,url:r.url(),error:r.failure()?.errorText});});
}
const errCount=()=>issues.console.length+issues.pageerror.length;
const freshErrors=(from)=>[...issues.console,...issues.pageerror].slice(from);
const shot=(page,name)=>page.screenshot({path:join(OUT,name+'.png'),fullPage:false});
async function open(ctx,route,tag,wait=700){
  const page=await ctx.newPage();watch(page,tag);
  await page.goto(`${BASE}/#/${route}`,{waitUntil:'networkidle'});
  await page.locator('#main').waitFor({timeout:20000});
  await page.waitForTimeout(wait);
  return page;
}
async function sim(ctx,tag){
  const page=await open(ctx,'simulator',tag,1200);
  await page.getByRole('button',{name:/Step \+1 h/}).waitFor({timeout:30000});
  return page;
}
const clockOf=async(page)=>{const t=await page.locator('.explorer-time').first().innerText();const m=/\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.exec(t);return m?m[0]:t;};
const active=(page)=>page.evaluate(()=>({id:document.activeElement?.id||'',tag:document.activeElement?.tagName,text:(document.activeElement?.textContent||document.activeElement?.getAttribute('aria-label')||'').trim().slice(0,50),hash:location.hash}));

const browser=await launch();
console.log('browser',browser.version(),'base',BASE);
const desktop=await browser.newContext({viewport:{width:1440,height:900}});
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
const short=await browser.newContext({viewport:{width:1280,height:560}});

// ================= Home
await check('home: purpose is clear, three entry actions work (Faithful->mission, Free->Explore, tour opens)',async()=>{
  let page=await open(desktop,'home','home');
  await shot(page,'desktop-home');
  const text=await page.locator('main').innerText();
  expect(/Moon/i.test(text)&&/landing|window|light/i.test(text),'purpose text');
  await page.getByRole('button',{name:/Open the simulator/}).click();
  await page.waitForFunction(()=>location.hash==='#/simulator',null,{timeout:10000});
  await page.goto(`${BASE}/#/home`);await page.locator('#main').waitFor();
  await page.getByRole('link',{name:'Guided analysis'}).first().click();
  await page.waitForFunction(()=>location.hash==='#/mission',null,{timeout:10000});
  await page.goto(`${BASE}/#/home`);await page.locator('#main').waitFor();
  await page.getByRole('button',{name:/Free experiment/}).click();
  await page.waitForFunction(()=>location.hash==='#/simulator',null,{timeout:10000});
  const freeBtn=page.getByRole('button',{name:/^Free Mode/}).first();await freeBtn.waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>/^Free Mode/.test(b.textContent.trim())&&b.getAttribute('aria-pressed')==='true'),null,{timeout:8000}).catch(()=>{throw new Error('Free Mode must be pressed after entering Explore from Home');});
  await page.goto(`${BASE}/#/home`);await page.locator('#main').waitFor();
  await page.getByRole('button',{name:/Show me how/}).click();
  await page.getByRole('dialog').waitFor();
  await page.close();
});

// ================= Tour
async function tourWalk(ctx,label){
  const page=await open(ctx,'home','tour-'+label);
  const vp=page.viewportSize();
  await page.getByRole('button',{name:/Show me how/}).click();
  const dlg=page.getByRole('dialog');await dlg.waitFor();
  const seen=[];const problems=[];
  for(let i=1;i<=TOUR_STEPS;i++){
    await page.waitForTimeout(450);
    const counter=await dlg.locator('.mono').first().innerText();
    if(!new RegExp(`${i} / ${TOUR_STEPS}`).test(counter))problems.push(`step ${i}: counter "${counter}"`);
    const r=await page.evaluate(()=>{
      const card=document.querySelector('.tour-card').getBoundingClientRect(),sp=document.querySelector('.tour-spotlight')?.getBoundingClientRect();
      const ov=sp?Math.max(0,Math.min(card.right,sp.right)-Math.max(card.left,sp.left))*Math.max(0,Math.min(card.bottom,sp.bottom)-Math.max(card.top,sp.top)):0;
      return {card:{l:card.left,t:card.top,r:card.right,b:card.bottom},sp:sp?{l:sp.left,t:sp.top,r:sp.right,b:sp.bottom,w:sp.width,h:sp.height}:null,cover:sp&&sp.width*sp.height?ov/(sp.width*sp.height):0,hash:location.hash,title:document.querySelector('#tour-title').textContent,
        ariaLabelled:document.querySelector('.tour-card').getAttribute('aria-labelledby')==='tour-title'};
    });
    seen.push(`${i}:${r.hash}`);
    if(r.card.l<-1||r.card.t<-1||r.card.r>vp.width+1||r.card.b>vp.height+1)problems.push(`step ${i} (${r.title}): card outside viewport ${JSON.stringify(r.card)}`);
    if(!r.sp)problems.push(`step ${i} (${r.title}): no spotlight/target found`);
    else{
      if(r.sp.w<=0||r.sp.h<=0)problems.push(`step ${i}: empty target`);
      if(r.sp.b<0||r.sp.t>vp.height)problems.push(`step ${i}: target not in view (top ${Math.round(r.sp.t)}, bottom ${Math.round(r.sp.b)})`);
      if(r.cover>0.5&&r.sp.h<vp.height*0.6)problems.push(`step ${i} (${r.title}): card covers ${(r.cover*100).toFixed(0)}% of its target`);
    }
    if(!r.ariaLabelled)problems.push(`step ${i}: dialog not labelled`);
    if(i===3&&label==='desktop')await shot(page,'desktop-tour-step3');
    if(i<TOUR_STEPS)await dlg.getByRole('button',{name:'Next'}).click();
  }
  const last=await dlg.getByRole('button',{name:/Start exploring/}).isVisible();
  if(!last)problems.push('last step lacks "Start exploring"');
  await dlg.getByRole('button',{name:/Start exploring/}).click();
  if(await page.getByRole('dialog').count())problems.push('tour still open after Start exploring');
  await page.close();
  expect(problems.length===0,problems.slice(0,6).join(' || '));
  return seen.join(' ');
}
await check('tour: all 10 steps at 1440x900 (counter, routes, target visible, card inside viewport, not covering target)',()=>tourWalk(desktop,'desktop'));
await check('tour: all 10 steps at 390x844 mobile',()=>tourWalk(mobile,'mobile'));
await check('tour: all 10 steps on a short 1280x560 viewport',()=>tourWalk(short,'short'));
await check('tour: Back, Escape (focus restored to a tour starter), Skip, manual hash navigation, and the app stays usable',async()=>{
  const page=await open(desktop,'home','tour-nav');
  await page.getByRole('button',{name:/Show me how/}).click();
  const dlg=page.getByRole('dialog');await dlg.waitFor();
  expect(await dlg.getByRole('button',{name:'Back'}).isDisabled(),'Back disabled on step 1');
  await dlg.getByRole('button',{name:'Next'}).click();await dlg.getByRole('button',{name:'Next'}).click();
  await dlg.getByRole('button',{name:'Back'}).click();
  expect(/2 \/ 10/.test(await dlg.locator('.mono').first().innerText()),'Back goes to step 2');
  // the tour is non-modal: a real control behind it is usable (we are on the simulator now)
  await page.waitForFunction(()=>location.hash==='#/simulator');
  await page.waitForTimeout(500);
  await page.getByRole('button',{name:'Free Mode'}).first().click();
  expect(await page.getByRole('button',{name:'Free Mode'}).first().getAttribute('aria-pressed')==='true','Free Mode usable while the tour is open');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('.tour-card'));
  const a=await active(page);
  expect(/tour|how/i.test(a.text)||a.tag==='BUTTON'||a.id==='main','focus after Escape should be on a sensible element: '+JSON.stringify(a));
  await page.getByRole('button',{name:/Take a tour/}).first().click();await dlg.waitFor();
  await dlg.getByRole('button',{name:'Skip tour'}).click();
  expect(await page.getByRole('dialog').count()===0,'Skip closes');
  await page.getByRole('button',{name:/Take a tour/}).first().click();await dlg.waitFor();
  await page.evaluate(()=>{location.hash='#/credits';});
  await page.waitForTimeout(600);
  expect(await page.getByRole('dialog').count()===0,'manual hash navigation closes the tour');
  await page.close();
});

// ================= Learn
await check('learn: no console errors/NaN; raise-the-observer reacts (slider keyboard, ARIA text changes)',async()=>{
  const from=errCount();
  const page=await open(desktop,'learn','learn');
  const svg=page.locator('.learn-svg').first();
  const label0=await svg.getAttribute('aria-label');
  const slider=page.locator('input[type=range]').first();
  await slider.focus();await page.keyboard.press('End');
  const high=await svg.getAttribute('aria-label');
  await page.keyboard.press('Home');
  const low=await svg.getAttribute('aria-label');
  expect(high!==low,`ARIA text never changes between min and max: "${low}"`);
  expect(/clears|high enough/i.test(high)&&/hits/i.test(low),`unexpected labels: "${low}" / "${high}"`);
  const nan=await page.evaluate(()=>[...document.querySelectorAll('svg *')].filter(e=>[...e.attributes].some(a=>/NaN|undefined/.test(a.value))).length);
  expect(nan===0,`${nan} SVG elements with NaN/undefined attributes`);
  const status=await page.locator('[role=status]').first().innerText();
  expect(status.length>10,'status text present');
  expect(freshErrors(from).length===0,'console errors on /learn: '+JSON.stringify(freshErrors(from).slice(0,2)));
  await shot(page,'desktop-learn');
  await page.close();
});
await check('learn: quiz buttons give feedback and keep aria-pressed; Faithful/Free toggle; metric cases toggle',async()=>{
  const page=await open(desktop,'learn','learn-widgets');
  await page.getByRole('button',{name:'Yes, it is above the horizon'}).click();
  expect(await page.getByRole('button',{name:'Yes, it is above the horizon'}).getAttribute('aria-pressed')==='true','pressed state');
  expect(await page.locator('[role=status]').filter({hasText:/Not quite|Correct|Right|Exactly/}).count()>0,'quiz feedback status');
  await page.getByRole('button',{name:'Free Mode'}).last().click();
  expect(await page.getByRole('button',{name:'Free Mode'}).last().getAttribute('aria-pressed')==='true','mode toggle');
  await page.getByRole('button',{name:'Bright bursts'}).click();
  expect(await page.getByRole('button',{name:'Bright bursts'}).getAttribute('aria-pressed')==='true'&&await page.getByRole('button',{name:'Steady and thin'}).getAttribute('aria-pressed')==='false','metrics case switch');
  const clock=page.locator('input[type=range]').nth(1);
  const v0=await clock.inputValue();await clock.focus();await page.keyboard.press('ArrowRight');
  expect(await clock.inputValue()!==v0,'shared clock slider moves by keyboard');
  await page.close();
});
await check('learn: 8-step stepper bounds (Back disabled at 1, Next stops/changes at 8), status text and keyboard activation',async()=>{
  const page=await open(desktop,'learn','learn-stepper');
  const group=page.locator('[aria-live=polite]').filter({hasText:/Step \d of 8/}).first();
  const back=page.getByRole('button',{name:'Back',exact:true}),next=page.getByRole('button',{name:/Next step/});
  await group.scrollIntoViewIfNeeded();
  expect(await back.isDisabled(),'Back disabled at step 1');
  expect(/Step 1 of 8/i.test(await group.innerText()),'status says Step 1 of 8');
  for(let i=2;i<=8;i++){await next.focus();await page.keyboard.press('Enter');expect(new RegExp(`Step ${i} of 8`,"i").test(await group.innerText()),`status after Next: step ${i}`);}
  expect(await next.isDisabled()||!/Step 9/i.test(await group.innerText()),'Next must not go past step 8');
  expect(!(await back.isDisabled()),'Back enabled at step 8');
  for(let i=7;i>=1;i--){await back.focus();await page.keyboard.press('Space');expect(new RegExp(`Step ${i} of 8`,"i").test(await group.innerText()),`status after Back: step ${i}`);}
  expect(await back.isDisabled(),'Back disabled again at step 1');
  // clicking a step chip jumps to it
  await page.getByRole('button',{name:/Step 5:/}).click();
  expect(/Step 5 of 8/i.test(await group.innerText()),'step chip jump');
  await page.close();
});
await check('learn: onOpen routes (simulator, compare, credits) and the tour starter work',async()=>{
  const go=async(name,hash,first=true)=>{
    const page=await open(desktop,'learn','learn-open');
    const b=page.getByRole('button',{name}),l=page.getByRole('link',{name});
    const target=(await b.count())?b.first():l.first();
    await target.scrollIntoViewIfNeeded();await target.click();
    await page.waitForFunction(h=>location.hash===h,hash,{timeout:8000});
    await page.close();
  };
  await go('Open simulator','#/simulator');
  await go('Compare','#/compare');
  await go(/See all credits/,'#/credits');
  const page=await open(desktop,'learn','learn-tour');
  await page.getByRole('button',{name:'Take interactive tour'}).first().click();
  await page.getByRole('dialog').waitFor();
  await page.close();
});
await check('learn: every interactive control is keyboard-reachable with a visible focus indicator',async()=>{
  const page=await open(desktop,'learn','learn-kbd');
  const bad=await page.evaluate(()=>[...document.querySelectorAll('main button,main input,main summary,main a')].filter(e=>!e.disabled&&e.getBoundingClientRect().width>0).filter(e=>e.tabIndex<0).map(e=>e.tagName+':'+(e.textContent||e.id).trim().slice(0,20)));
  expect(bad.length===0,'controls with tabindex<0: '+bad.slice(0,4).join(', '));
  const stops=new Set();const noRing=[];
  for(let i=0;i<140;i++){
    await page.keyboard.press('Tab');
    const r=await page.evaluate(()=>{const e=document.activeElement;if(!e||e===document.body)return null;const s=getComputedStyle(e);return {k:e.tagName+':'+(e.textContent||e.getAttribute('aria-label')||e.id).trim().slice(0,24),ring:!(s.outlineStyle==='none'||parseFloat(s.outlineWidth)===0)||s.boxShadow!=='none'};});
    if(r){stops.add(r.k);if(!r.ring)noRing.push(r.k);}
  }
  expect(stops.size>25,'only '+stops.size+' tab stops reached on /learn');
  expect(noRing.length===0,'focused without visible indicator: '+[...new Set(noRing)].slice(0,4).join(', '));
  await page.close();return stops.size+' tab stops';
});

// ================= Explore 3D
await check('explore: every camera preset works (one pressed at a time, no console errors, no scene error)',async()=>{
  const from=errCount();
  const page=await sim(desktop,'presets');
  await shot(page,'desktop-explore');
  const names=['Moon & Earth','South pole','Surface sky','Local terrain','Solar context'];
  for(const n of names){
    const b=page.locator('.camera-presets button',{hasText:n.split(' ')[0]}).first();
    await b.click();await page.waitForTimeout(900);
    expect(await b.getAttribute('aria-pressed')==='true',`${n} not pressed`);
    expect(await page.locator('.camera-presets button[aria-pressed=true]').count()===1,'exactly one preset pressed');
    expect(await page.locator('.scene-error').count()===0,`${n}: scene error shown`);
    expect(await page.locator('canvas').first().evaluate(c=>c.width>0&&c.height>0),`${n}: canvas empty`);
    await shot(page,'desktop-explore-'+n.replace(/\W+/g,'-').toLowerCase());
    if(n==='Local terrain')expect(/visual geometry/i.test(await page.locator('main').innerText()),'local terrain view must be labelled visual geometry');
  }
  expect(freshErrors(from).length===0,'console errors: '+JSON.stringify(freshErrors(from).slice(0,2)));
  await page.close();
});
await check('explore: Look-at focus, camera buttons and zoom work in every preset without errors',async()=>{
  const from=errCount();
  const page=await sim(desktop,'focus');
  const sel=page.locator('[aria-label="Focus a celestial body"]');
  for(const preset of ['Moon','South','Surface','Local','Solar']){
    await page.locator('.camera-presets button',{hasText:preset}).first().click();await page.waitForTimeout(500);
    const opts=await sel.locator('option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
    expect(opts.length>=3,preset+': few focus options');
    for(const v of opts){await sel.selectOption(v);await page.waitForTimeout(80);}
    {const d=page.locator('details.manual-camera-controls');if(await d.getAttribute('open')===null)await d.locator('summary').click();}
    for(const label of ['Rotate camera left','Rotate camera up','Zoom in','Zoom out','Reset view'])await page.getByRole('button',{name:label}).click();
  }
  expect(freshErrors(from).length===0,'console errors: '+JSON.stringify(freshErrors(from).slice(0,2)));
  await page.close();
});
await check('explore: location/height selectors, time slider (float time), Play/Pause and step',async()=>{
  const from=errCount();
  const page=await sim(desktop,'time');
  const clock=()=>clockOf(page);
  await page.selectOption('#explorer-site',{index:1});await page.selectOption('#explorer-height','5');
  const slider=page.locator('#time-slider');
  expect(+(await slider.getAttribute('max'))>=1392,'slider covers the whole period');
  const t0=await clock();
  await slider.focus();await page.keyboard.press('ArrowRight');
  const t1=await clock();expect(t1!==t0||await slider.inputValue()!=='0','slider keyboard changes time');
  await page.keyboard.press('End');
  const tEnd=await clock();expect(/2027-04-28/.test(tEnd),'End shows the last instant: '+tEnd);
  await page.keyboard.press('Home');
  await page.getByRole('button',{name:'Play'}).click();await page.waitForTimeout(1700);
  const playing=await clock();
  await page.getByRole('button',{name:'Pause'}).click();
  const p1=await clock();await page.waitForTimeout(900);
  expect(await clock()===p1,'time must hold after Pause');
  expect(playing!==tEnd,'Play advanced time (or is smooth)');
  const step=await clock();await page.getByRole('button',{name:/Step \+1 h/}).click();
  expect(await clock()!==step,'step changes time');
  for(const t of ['Try this','Why it matters'])await page.getByRole('button',{name:t}).click();
  expect(freshErrors(from).length===0,'console errors: '+JSON.stringify(freshErrors(from).slice(0,2)));
  await page.close();
});
await check('explore: Faithful/Free freezes persist while stepping, reset clears, Free never recommends',async()=>{
  const page=await sim(desktop,'freeze');
  await page.getByRole('button',{name:'Free Mode'}).first().click();
  const boxes=page.locator('input[type=checkbox]');
  const n=await boxes.count();expect(n>=4,'freeze checkboxes: '+n);
  const first=boxes.first();await first.check();
  await page.getByRole('button',{name:/Step \+1 h/}).click();await page.getByRole('button',{name:/Step \+1 h/}).click();
  expect(await first.isChecked(),'freeze lost when stepping');
  const body=await page.locator('main').innerText();
  expect(/artificial|experiment|not .*real/i.test(body),'Free Mode labelled artificial/experimental');
  expect(!/\b(best (landing )?site|recommend(ed)? (site|landing)|optimal site)\b/i.test(body),'Free Mode must not recommend');
  const reset=page.getByRole('button',{name:/Reset to Faithful|Faithful Mode/}).first();
  await page.getByRole('button',{name:'Faithful Mode'}).first().click();
  expect(await page.getByRole('button',{name:'Faithful Mode'}).first().getAttribute('aria-pressed')==='true','back to Faithful');
  await page.getByRole('button',{name:'Free Mode'}).first().click();
  expect(!(await page.locator('input[type=checkbox]').first().isChecked()),'freezes cleared after returning to Faithful');
  void reset;
  await page.close();return n+' freeze checkboxes';
});
await check('explore: immersive hides interface, focus moves to Return, Escape restores focus to the entry button',async()=>{
  const page=await sim(desktop,'immersive');
  const enter=page.getByRole('button',{name:/Explore fullscreen/});
  await enter.click();
  const back=page.getByRole('button',{name:/Return to workspace/});await back.waitFor();
  expect((await active(page)).text.startsWith('Return to workspace'),'focus on Return');
  for(const sel of ['.header','.footer'])expect(!(await page.locator(sel).first().isVisible().catch(()=>false)),sel+' hidden in immersive');
  await shot(page,'desktop-explore-immersive');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('.return-workspace'));
  expect(/Explore fullscreen/.test((await active(page)).text),'focus returns to Explore fullscreen: '+JSON.stringify(await active(page)));
  await enter.focus();await page.keyboard.press('Enter');await back.waitFor();
  await back.focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>!document.querySelector('.return-workspace'));
  await page.close();
});

// ================= Compare (V1 flows adapted: same ids)
await check('compare: data changes, outside coverage, empty date, darkness limit',async()=>{
  const page=await open(desktop,'compare','compare');
  await page.locator('table tbody tr').first().waitFor({timeout:20000});
  const rows=()=>page.locator('table tbody tr').allInnerTexts();
  const base=await rows();expect(base.length===3&&!/NaN|undefined/.test(base.join(' ')),'3 clean rows');
  await page.selectOption('#site','shackleton-rim');expect((await rows())[0]!==base[0],'site changes row');
  await page.selectOption('#delay','29');
  await page.fill('#arrival','2027-04-27');expect((await rows()).every(r=>r.includes('Not calculated')),'beyond coverage');
  await page.fill('#arrival','');expect((await rows()).every(r=>r.includes('Not calculated')),'empty date');
  await page.fill('#arrival','2027-03-01');await page.fill('#dark-limit','0');
  expect(/Exceeds|Lower bound/.test(await page.locator('.decision').innerText()),'limit applies');
  expect(/not a NASA requirement/.test(await page.locator('main').innerText()),'caveat');
  await shot(page,'desktop-compare');
  await page.close();
});

// ================= Cross-cutting: overflow / reduced motion / console / requests
for(const [label,ctx] of [['desktop-1440',desktop],['mobile-390',mobile]]){
  await check(`${label}: all ${ROUTES.length} routes - no horizontal overflow, no console errors, no failed requests`,async()=>{
    const from=errCount(),httpFrom=issues.http.length+issues.requestfailed.length;const bad=[];
    for(const route of ROUTES){
      const page=await open(ctx,route,`overflow-${label}-${route}`,route==='simulator'?1800:600);
      if(route==='compare')await page.locator('table tbody tr').first().waitFor({timeout:20000});
      await shot(page,`${label}-${route}`);
      const r=await page.evaluate(()=>{
        const vw=document.documentElement.clientWidth,skip=e=>e.closest('.table-wrap,pre,nav,.chapter-list,.learn-svg,canvas');
        const boxes=[...document.querySelectorAll('body *')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.right>vw+1||b.left<-1)&&!skip(e)&&getComputedStyle(e).position!=='fixed';}).slice(0,3).map(e=>e.tagName+'.'+String(e.className?.baseVal??e.className).slice(0,30));
        const text=[...document.querySelectorAll('main *')].filter(e=>e.scrollWidth>e.clientWidth+1&&e.clientWidth>0&&!skip(e)&&getComputedStyle(e).overflowX==='visible'&&e.children.length===0).slice(0,3).map(e=>e.tagName+'.'+String(e.className?.baseVal??e.className).slice(0,30)+' text');
        return {sw:document.documentElement.scrollWidth,vw,off:[...boxes,...text]};
      });
      if(r.sw>r.vw+1||r.off.length)bad.push(`${route}: sw ${r.sw}>${r.vw} ${r.off.join(',')}`);
      await page.close();
    }
    const errs=freshErrors(from),net=[...issues.http,...issues.requestfailed].slice(httpFrom).filter(x=>!/favicon/.test(x.url));
    expect(bad.length===0,'OVERFLOW '+bad.join(' || '));
    expect(errs.length===0,'CONSOLE '+JSON.stringify(errs.slice(0,2)));
    expect(net.length===0,'NET '+JSON.stringify(net.slice(0,3)));
  });
}
await check('mobile-390: tap targets >= 24 px on home, learn, explore and compare',async()=>{
  const small=[];
  for(const route of ['home','learn','simulator','compare']){
    const page=await open(mobile,route,'targets-'+route,route==='simulator'?1500:500);
    small.push(...await page.$$eval('button,select,input:not([type=checkbox]):not([type=radio]),a.button',els=>els.filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.height<24||b.width<24)&&e.type!=='range';}).map(e=>e.tagName+':'+(e.textContent||e.id||e.getAttribute('aria-label')).trim().slice(0,20))).then(a=>a.map(x=>route+' '+x)));
    await page.close();
  }
  expect(small.length===0,'targets under 24px: '+small.slice(0,6).join(', '));
});
await check('prefers-reduced-motion: no autoplay and no looping CSS animation on home, learn and explore; tour still works',async()=>{
  const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});const bad=[];
  for(const route of ['home','learn','simulator']){
    const page=await open(ctx,route,'reduced-'+route,route==='simulator'?1800:500);
    if(route==='simulator'){
      const clock=()=>clockOf(page);
      const t0=await clock();await page.waitForTimeout(1700);
      if(await clock()!==t0)bad.push('simulator clock advanced without user action');
      if(!await page.getByRole('button',{name:'Play'}).isVisible())bad.push('not paused initially');
    }
    const anim=await page.evaluate(()=>[...document.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);return s.animationName!=='none'&&parseFloat(s.animationDuration)>0.05&&s.animationIterationCount!=='1';}).slice(0,3).map(e=>e.tagName+'.'+String(e.className?.baseVal??e.className).slice(0,25)));
    if(anim.length)bad.push(route+' looping: '+anim.join(','));
    await page.close();
  }
  const page=await open(ctx,'home','reduced-tour');await page.getByRole('button',{name:/Show me how/}).click();await page.getByRole('dialog').waitFor();
  const tr=await page.evaluate(()=>getComputedStyle(document.querySelector('.tour-card')).transitionDuration);
  await page.close();await ctx.close();
  expect(bad.length===0,bad.join(' || '));return 'tour-card transition: '+tr;
});
await check('no failed requests and no console errors across the whole run',async()=>{
  const net=[...issues.http,...issues.requestfailed].filter(x=>!/favicon/.test(x.url||''));
  const errs=[...issues.console,...issues.pageerror];
  expect(net.length===0&&errs.length===0,`net ${net.length} console ${errs.length}: ${JSON.stringify([...net,...errs].slice(0,3))}`);
});

await browser.close();
const failed=results.filter(r=>!r.ok).length;
writeFileSync(join(OUT,'results.json'),JSON.stringify({base:BASE,at:new Date().toISOString(),passed:results.length-failed,failed,results,issues},null,1));
console.log(`\n${results.length-failed}/${results.length} passed. Output: ${OUT}`);
process.exit(failed?1:0);
