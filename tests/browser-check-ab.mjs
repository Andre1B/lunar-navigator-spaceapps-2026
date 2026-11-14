// Directed browser QA: Compare A/B arrival skies (ArrivalComparison) and the Explore NextEvents panel.
// Playwright, not part of `npm test`. Uses `?qa=1` (read-only canvas.lunarSnapshot) only to read the 3D time.
//   node tests/browser-check-ab.mjs              (dev, http://localhost:5173)
//   QA_URL=https://... node tests/browser-check-ab.mjs
// Env: QA_OUT (default ../tmp/lunar-qa-ab), QA_HEADED=1, QA_ONLY=<substring>.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {horizonAt} from '../src/lib/analysis.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const BASE=(process.env.QA_URL||'http://localhost:5173').replace(/\/$/,'');
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(ROOT,'..','tmp','lunar-qa-ab');
mkdirSync(OUT,{recursive:true});
const CHROME_EXE='C:/Program Files/Google/Chrome/Application/chrome.exe';
const data=(f)=>JSON.parse(readFileSync(join(ROOT,'public/data',f),'utf8'));
const manifest=data('manifest.json');
const sites=Object.fromEntries(manifest.sites.map(s=>[s.id,data(s.file)]));
const T0=Date.parse(manifest.period.startUtc);
const results=[],issues={console:[],pageerror:[],http:[],requestfailed:[]};
const expect=(c,m)=>{if(!c)throw new Error(m);};
const utcAt=(i)=>new Date(T0+i*3600000).toISOString();
const fmt=(iso)=>iso.slice(0,16).replace('T',' ')+' UTC';

async function launch(){
  const args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
  const headless=!process.env.QA_HEADED;
  for(const o of [{channel:'chrome'},existsSync(CHROME_EXE)?{executablePath:CHROME_EXE}:null,{}]){
    if(!o)continue;try{return await chromium.launch({headless,args,...o});}catch(e){console.error('launch failed',e.message.split('\n')[0]);}
  }
  throw new Error('no usable browser');
}
async function check(name,fn){
  if(process.env.QA_ONLY&&!name.includes(process.env.QA_ONLY))return;
  const t=Date.now();
  try{const detail=await fn();results.push({name,ok:true,detail:detail??'',ms:Date.now()-t});console.log('PASS',name);}
  catch(e){results.push({name,ok:false,detail:String(e.message||e).split('\n')[0],ms:Date.now()-t});console.log('FAIL',name,'-',String(e.message||e).split('\n')[0]);}
}
function watch(page,tag){
  page.on('console',m=>{if(m.type()==='error')issues.console.push({tag,text:m.text().slice(0,200)});});
  page.on('pageerror',e=>issues.pageerror.push({tag,text:String(e).slice(0,200)}));
  page.on('response',r=>{if(r.status()>=400)issues.http.push({tag,status:r.status(),url:r.url()});});
  page.on('requestfailed',r=>{if(r.failure()?.errorText==='net::ERR_ABORTED')return;issues.requestfailed.push({tag,url:r.url(),error:r.failure()?.errorText});});
}
const errCount=()=>issues.console.length+issues.pageerror.length;
const fresh=(from)=>[...issues.console,...issues.pageerror].slice(from);
const shot=(page,name)=>page.screenshot({path:join(OUT,name+'.png'),fullPage:true});
async function compare(ctx,tag,qs=''){
  const page=await ctx.newPage();watch(page,tag);
  await page.goto(`${BASE}/${qs}#/compare`,{waitUntil:'networkidle'});
  await page.locator('table tbody tr').first().waitFor({timeout:20000});
  await page.locator('.arrival-comparison').waitFor({timeout:10000});
  return page;
}
async function explore(ctx,tag){
  const page=await ctx.newPage();watch(page,tag);
  await page.goto(`${BASE}/?qa=1#/simulator`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:/Step \+1 h/}).waitFor({timeout:30000});
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
  await page.locator('.next-events').first().waitFor({timeout:10000});
  return page;
}
const setSlider=(page,v)=>page.evaluate(v=>{const s=document.querySelector('#time-slider');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(s,String(v));s.dispatchEvent(new Event('input',{bubbles:true}));},v);
const snapIndex=(page)=>page.evaluate(()=>document.querySelector('canvas').lunarSnapshot().index);
const arrivalTime=(page)=>page.locator('.arrival-time time');
const horizonText=(page)=>page.locator('.arrival-comparison').innerText();
const sunHorizon=(text)=>{const m=/azimuth:?\s*(-?\d+(?:\.\d+)?)\s*°/i.exec(text);return m?+m[1]:null;};

const browser=await launch();
console.log('browser',browser.version(),'base',BASE);
const desktop=await browser.newContext({viewport:{width:1440,height:900}});
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});

// ================= A/B arrival skies
await check('A/B: two arrival buttons, default Original pressed, real UTC instants, observer height, snapshot caveat',async()=>{
  const from=errCount();
  const page=await compare(desktop,'ab-basic');
  const group=page.getByRole('group',{name:'Compare arrival skies'});
  const buttons=group.getByRole('button');
  expect(await buttons.count()===2,'two arrival buttons');
  const names=await buttons.allInnerTexts();
  expect(/Original arrival/.test(names[0])&&/Delayed arrival.*\+7 days/.test(names[1]),'labels: '+names.join('|'));
  expect(await buttons.nth(0).getAttribute('aria-pressed')==='true'&&await buttons.nth(1).getAttribute('aria-pressed')==='false','default pressed state');
  expect(await arrivalTime(page).getAttribute('datetime')===new Date(T0).toISOString().replace('.000Z','.000Z'),'original UTC '+await arrivalTime(page).getAttribute('datetime'));
  expect(/1 m observer/.test(await page.locator('.arrival-time').innerText()),'height shown');
  await buttons.nth(1).click();
  expect(await buttons.nth(1).getAttribute('aria-pressed')==='true'&&await buttons.nth(0).getAttribute('aria-pressed')==='false','pressed toggles');
  expect(await arrivalTime(page).getAttribute('datetime')===utcAt(168),'delayed UTC = start + 7 d: '+await arrivalTime(page).getAttribute('datetime'));
  expect(await arrivalTime(page).innerText()===fmt(utcAt(168)),'displayed text');
  const caption=await page.locator('.arrival-comparison .caption').filter({hasText:/snapshots at arrival/i}).innerText();
  expect(/snapshots at arrival, not averages/i.test(caption),'snapshot warning: '+caption);
  expect(await page.locator('#time-slider').count()===0,'duplicate timeline removed from Compare');
  await shot(page,'desktop-compare-ab');
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});

await check('A/B: the sky shown is the real arrival instant (terrain elevation at the Sun azimuth equals the dataset) and A differs from B',async()=>{
  const page=await compare(desktop,'ab-real');
  const group=page.getByRole('group',{name:'Compare arrival skies'}).getByRole('button');
  const checkOne=async(siteId,height,index,label)=>{
    const t=await horizonText(page);const v=sunHorizon(t);
    expect(v!==null,`${label}: no "terrain elevation at the Sun's azimuth" text: ${t.replace(/\s+/g,' ').slice(0,160)}`);
    const d=sites[siteId];const expected=horizonAt(d.horizon.elevationDeg[String(height)],d.sun.azDeg[index]);
    expect(Math.abs(v-expected)<0.011,`${label}: UI ${v} vs dataset ${expected.toFixed(3)} at index ${index}`);
    return v;
  };
  const seen=new Set();
  for(const [site,h,date,delay] of [['connecting-ridge',1,'2027-03-01',7],['shackleton-rim',5,'2027-03-10',3],['malapert-massif',1,'2027-03-20',14],['nobile-rim-1',5,'2027-04-01',1]]){
    await page.selectOption('#site',site);await page.selectOption('#height',String(h));await page.fill('#arrival',date);await page.selectOption('#delay',String(delay));
    await page.waitForTimeout(300);
    const base=Math.round((Date.parse(date+'T00:00:00Z')-T0)/3600000);
    await group.nth(0).click();seen.add(await checkOne(site,h,base,`${site} A`));
    expect(await arrivalTime(page).getAttribute('datetime')===utcAt(base),`${site} A time`);
    await group.nth(1).click();seen.add(await checkOne(site,h,base+delay*24,`${site} B`));
    expect(await arrivalTime(page).getAttribute('datetime')===utcAt(base+delay*24),`${site} B time`);
    expect(/5 m observer|1 m observer/.test(await page.locator('.arrival-time').innerText())&&(await page.locator('.arrival-time').innerText()).includes(h+' m observer'),`${site} height label`);
  }
  expect(seen.size>=4,'the A/B skies must differ across settings ('+seen.size+' distinct elevations)');
  await page.close();
});

await check('A/B: unavailable dates show "Not calculated" with no Inspect button and no invented sky; the available side still works',async()=>{
  const page=await compare(desktop,'ab-unavailable');
  const group=page.getByRole('group',{name:'Compare arrival skies'}).getByRole('button');
  await page.fill('#arrival','2027-04-20');await page.selectOption('#days','3');await page.selectOption('#delay','7');
  await group.nth(0).click();
  expect(await arrivalTime(page).count()===1&&await page.getByRole('button',{name:/Inspect this instant/}).isVisible(),'original is available');
  await group.nth(1).click();
  const status=page.locator('.arrival-comparison [role=status]');
  expect(/Not calculated/.test(await status.innerText()),'delayed side says Not calculated');
  expect(await arrivalTime(page).count()===0&&await page.getByRole('button',{name:/Inspect this instant/}).count()===0,'no time/Inspect when not calculated');
  expect(!sunHorizon(await horizonText(page)),'no horizon values for an uncovered arrival');
  // an empty / garbage date: both sides unavailable, page alive
  const from=errCount();
  await page.fill('#arrival','');
  for(const i of [0,1]){await group.nth(i).click();expect(/Not calculated/.test(await status.innerText()),`empty date side ${i}`);}
  expect(fresh(from).length===0,'console errors on empty date: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});

await check('A/B: keyboard operation (Tab, Space, Enter) and mobile 390 layout',async()=>{
  const page=await compare(mobile,'ab-mobile');
  const group=page.getByRole('group',{name:'Compare arrival skies'}).getByRole('button');
  await group.nth(1).scrollIntoViewIfNeeded();
  await group.nth(0).focus();await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>/Delayed arrival/.test(document.activeElement.textContent)),'Tab reaches the second button');
  await page.keyboard.press('Space');
  expect(await group.nth(1).getAttribute('aria-pressed')==='true','Space activates');
  await group.nth(0).focus();await page.keyboard.press('Enter');
  expect(await group.nth(0).getAttribute('aria-pressed')==='true','Enter activates');
  for(const i of [0,1]){const b=await group.nth(i).boundingBox();expect(b.height>=36,`button ${i} is ${Math.round(b.height)} px high`);}
  const inspect=await page.getByRole('button',{name:/Inspect this instant/}).boundingBox();expect(inspect.height>=36,'Inspect button '+Math.round(inspect.height));
  const over=await page.evaluate(()=>{const vw=document.documentElement.clientWidth;const skip=e=>e.closest('.table-wrap,pre,nav,svg');return {sw:document.documentElement.scrollWidth,vw,off:[...document.querySelectorAll('.arrival-comparison *')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.right>vw+1||b.left<-1)&&!skip(e);}).length};});
  expect(over.sw<=over.vw+1&&over.off===0,`mobile overflow ${JSON.stringify(over)}`);
  await shot(page,'mobile-compare-ab');await page.close();
});

await check('A/B: "Inspect this instant in 3D" opens the Explorer at exactly the selected arrival index (original and delayed, other settings)',async()=>{
  const from=errCount();
  for(const [site,date,delay,side] of [['connecting-ridge','2027-03-01',7,0],['connecting-ridge','2027-03-01',7,1],['shackleton-rim','2027-03-10',3,1],['malapert-massif','2027-03-20',14,0]]){
    const page=await compare(desktop,'ab-inspect','?qa=1');
    await page.selectOption('#site',site);await page.fill('#arrival',date);await page.selectOption('#delay',String(delay));
    const group=page.getByRole('group',{name:'Compare arrival skies'}).getByRole('button');
    await group.nth(side).click();
    const base=Math.round((Date.parse(date+'T00:00:00Z')-T0)/3600000),index=base+(side?delay*24:0);
    await page.getByRole('button',{name:/Inspect this instant/}).click();
    await page.waitForFunction(()=>location.hash==='#/simulator',null,{timeout:10000});
    await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
    await page.waitForTimeout(600);
    const got=await snapIndex(page);
    expect(Math.abs(got-index)<1e-6,`${site} ${date} side ${side}: 3D index ${got} vs ${index}`);
    expect(await page.locator('.explorer-time').innerText().then(t=>t.includes(fmt(utcAt(index)).slice(0,16))),`${site}: time readout shows ${utcAt(index)}`);
    expect(await page.locator('#explorer-site').inputValue()===site,'Explorer keeps the compared point');
    await page.close();
  }
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
});

// ================= NextEvents panel
const NAMES={sunrise:'Sunrise',sunset:'Sunset',earthrise:'Earthrise',earthset:'Earthset'};
const expectedNext=(siteId,height,index)=>{
  const now=T0+index*3600000,end=T0+(manifest.period.sampleCount-1)*3600000;const out={};
  for(const type of Object.keys(NAMES)){
    const ms=sites[siteId].events.filter(e=>e.heightM===height&&e.type===type&&Date.parse(e.utc)>now&&Date.parse(e.utc)<=end).map(e=>Date.parse(e.utc)).sort((a,b)=>a-b)[0];
    out[type]=ms===undefined?null:new Date(ms).toISOString().replace('.000Z','Z');
  }
  return out;
};
async function readEvents(page){
  return page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.next-events-item')].map(el=>[el.className.match(/next-events-(sunrise|sunset|earthrise|earthset)/)[1],{text:el.innerText.replace(/\s+/g,' ').trim(),datetime:el.querySelector('time')?.getAttribute('dateTime')??null}])));
}
const compareUi=async(page,siteId,height,index,label)=>{
  const exp=expectedNext(siteId,height,index),got=await readEvents(page);
  for(const type of Object.keys(NAMES)){
    expect(got[type],`${label}: missing ${type} item`);
    expect(got[type].text.includes(NAMES[type]),`${label}: ${type} name`);
    if(exp[type]===null){expect(got[type].datetime===null&&/No transition in the computed period/.test(got[type].text),`${label} ${type}: expected "No transition", got "${got[type].text}"`);}
    else{expect(got[type].datetime===exp[type],`${label} ${type}: UI ${got[type].datetime} vs dataset ${exp[type]}`);expect(/±1 min/.test(got[type].text),`${label} ${type}: resolution`);expect(/in (under 1 min|[\d dhmin ]+)/.test(got[type].text),`${label} ${type}: relative label`);}
  }
};
await check('NextEvents: shown in Faithful below the timeline, hidden in Free Mode, method note present, never says "never"',async()=>{
  const from=errCount();
  const page=await explore(desktop,'ne-mode');
  const panel=page.locator('.next-events');
  expect(await panel.isVisible(),'visible in Faithful');
  expect(await panel.evaluate(el=>{const t=document.querySelector('.explorer-time');return !t||el.getBoundingClientRect().top>=t.getBoundingClientRect().top;}),'panel sits below the time controls');
  const text=await panel.innerText();
  expect(/Geometry only/i.test(text)&&/not a forecast of power, communication or operations/i.test(text),'method note: '+text.slice(-160));
  expect(!/\bnever\b/i.test(text),'text must not say "never"');
  expect(await panel.locator('.next-events-item').count()===4,'four events');
  await page.getByRole('button',{name:/^Free Mode/}).first().click();
  await page.waitForTimeout(400);
  expect(await page.locator('.next-events').count()===0,'hidden in Free Mode');
  await page.getByRole('button',{name:/^Faithful Mode/}).first().click();await page.waitForTimeout(400);
  expect(await page.locator('.next-events').count()===1,'back in Faithful');
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});
await check('NextEvents: values equal the dataset scan at the default instant, stepping, fractional time, and at the period edges',async()=>{
  const page=await explore(desktop,'ne-values');
  let idx=await snapIndex(page);
  await compareUi(page,'connecting-ridge',1,idx,`default i${idx}`);
  await page.getByRole('button',{name:/Step \+1 h/}).click();await page.waitForTimeout(400);
  idx=await snapIndex(page);await compareUi(page,'connecting-ridge',1,idx,`step i${idx}`);
  for(const v of [10.5,100.25,807.49,1391.99,1392,0]){
    await setSlider(page,v);await page.waitForTimeout(500);
    idx=await snapIndex(page);expect(Math.abs(idx-v)<0.011,`slider ${v} -> ${idx}`);
    await compareUi(page,'connecting-ridge',1,idx,`i${idx}`);
    const ctx=await page.locator('.next-events-context').innerText();
    expect(ctx.includes('After '+utcAt(idx).slice(0,16).replace('T',' ')),`context shows the displayed instant: ${ctx}`);
  }
  // after the last sample: every type says "No transition" (no extrapolation, no future)
  await setSlider(page,1392);await page.waitForTimeout(400);
  const last=await readEvents(page);
  expect(Object.values(last).every(e=>e.datetime===null&&/No transition/.test(e.text)),'last sample: all "No transition"');
  await page.close();
});
await check('NextEvents: follows the point and the observer height (1 m vs 5 m) and the dates carry valid machine-readable time',async()=>{
  const page=await explore(desktop,'ne-follow');
  await page.getByRole('button',{name:/Step \+1 h/}).click();await page.waitForTimeout(300);
  let seen=new Set();
  for(const site of manifest.sites.map(s=>s.id))for(const h of ['1','5']){
    await page.selectOption('#explorer-site',site);await page.selectOption('#explorer-height',h);await page.waitForTimeout(450);
    const idx=await snapIndex(page);
    await compareUi(page,site,Number(h),idx,`${site} ${h} m`);
    const ctx=await page.locator('.next-events-context').innerText();
    expect(ctx.includes(`observer ${h} m`),`context shows ${h} m: ${ctx}`);
    const got=await readEvents(page);seen.add(JSON.stringify(Object.values(got).map(e=>e.datetime)));
    for(const e of Object.values(got))if(e.datetime)expect(!Number.isNaN(Date.parse(e.datetime))&&/Z$/.test(e.datetime),'dateTime attribute is an ISO UTC instant: '+e.datetime);
  }
  expect(seen.size>=4,'results must differ between points/heights ('+seen.size+')');
  await page.close();
});
await check('NextEvents: accessible (labelled section, definition list, status role on errors) and readable on mobile 390 without overflow',async()=>{
  const page=await explore(mobile,'ne-mobile');
  const panel=page.locator('.next-events');
  await panel.scrollIntoViewIfNeeded();
  expect(await panel.getAttribute('aria-labelledby')==='next-events-title'&&await page.locator('#next-events-title').count()===1,'aria-labelledby points at the heading');
  expect(await panel.locator('dl.next-events-list dt').count()===4&&await panel.locator('dl.next-events-list dd').count()===4,'definition list with 4 terms');
  const o=await page.evaluate(()=>{const vw=document.documentElement.clientWidth;const el=document.querySelector('.next-events');const kids=[...el.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.right>vw+1||b.left<-1);}).length;return {sw:document.documentElement.scrollWidth,vw,kids,w:el.getBoundingClientRect().width,fs:parseFloat(getComputedStyle(el.querySelector('.next-events-value')).fontSize)};});
  expect(o.sw<=o.vw+1&&o.kids===0,'mobile overflow '+JSON.stringify(o));
  expect(o.fs>=12,'readable font size '+o.fs);
  await shot(page,'mobile-explore-next-events');
  await page.close();
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
