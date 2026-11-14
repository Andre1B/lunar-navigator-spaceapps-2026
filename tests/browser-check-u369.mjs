// Directed browser QA for: U3 arrival-date series (Compare), U6 worked example (Learn), U9 sky text description
// (Explore). Playwright, not part of `npm test`. `?qa=1` (read-only canvas.lunarSnapshot) is used only to read geometry.
//   node tests/browser-check-u369.mjs                 (dev, http://localhost:5173)
//   QA_URL=https://... node tests/browser-check-u369.mjs   (describeObservation unit checks need the dev server)
// Env: QA_OUT (default ../tmp/lunar-qa-u369), QA_HEADED=1, QA_ONLY=<substring>.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {horizonAt} from '../src/lib/analysis.mjs';
import {arrivalSeries} from '../src/lib/arrivalSeries.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const BASE=(process.env.QA_URL||'http://localhost:5173').replace(/\/$/,'');
const IS_DEV=/localhost|127\.0\.0\.1/.test(BASE);
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(ROOT,'..','tmp','lunar-qa-u369');
mkdirSync(OUT,{recursive:true});
const CHROME_EXE='C:/Program Files/Google/Chrome/Application/chrome.exe';
const data=(f)=>JSON.parse(readFileSync(join(ROOT,'public/data',f),'utf8'));
const manifest=data('manifest.json');
const sites=Object.fromEntries(manifest.sites.map(s=>[s.id,data(s.file)]));
const T0=Date.parse(manifest.period.startUtc);
const utcAt=(i)=>new Date(T0+i*3600000).toISOString();
const results=[],issues={console:[],pageerror:[],http:[],requestfailed:[]};
const expect=(c,m)=>{if(!c)throw new Error(m);};
const pct=(v)=>(v*100).toFixed(1)+'%',hrs=(r)=>(r.censored?'≥ ':'')+r.hours.toFixed(0)+' h';

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
function watch(page,tag,ignore){
  page.on('console',m=>{if(m.type()==='error'&&!(ignore&&ignore.test(m.text())))issues.console.push({tag,text:m.text().slice(0,200)});});
  page.on('pageerror',e=>issues.pageerror.push({tag,text:String(e).slice(0,200)}));
  page.on('response',r=>{if(r.status()>=400)issues.http.push({tag,status:r.status(),url:r.url()});});
  page.on('requestfailed',r=>{if(r.failure()?.errorText==='net::ERR_ABORTED')return;if(ignore&&ignore.test(r.url()))return;issues.requestfailed.push({tag,url:r.url(),error:r.failure()?.errorText});});
}
const errCount=()=>issues.console.length+issues.pageerror.length;
const fresh=(from)=>[...issues.console,...issues.pageerror].slice(from);
const shot=(page,name)=>page.screenshot({path:join(OUT,name+'.png')}).catch(()=>{}); // viewport shot: very tall pages break fullPage captures
async function compare(ctx,tag){
  const page=await ctx.newPage();watch(page,tag);
  await page.goto(`${BASE}/#/compare`,{waitUntil:'networkidle'});
  await page.locator('table tbody tr').first().waitFor({timeout:20000});
  await page.locator('.arrival-series').waitFor({timeout:10000});
  return page;
}
async function explore(ctx,tag){
  const page=await ctx.newPage();watch(page,tag);
  await page.goto(`${BASE}/?qa=1#/simulator`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:/Step \+1 h/}).waitFor({timeout:30000});
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
  await page.locator('.sky-description').waitFor({timeout:10000});
  return page;
}
const snap=(page)=>page.evaluate(()=>document.querySelector('canvas').lunarSnapshot());
const setSlider=(page,v)=>page.evaluate(v=>{const s=document.querySelector('#time-slider');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(s,String(v));s.dispatchEvent(new Event('input',{bubbles:true}));},v);
const desc=(page)=>page.locator('.sky-description p[aria-live]').innerText();
const fullText=/UTC, .*, observer \d m above the ground\. Sun at azimuth/;
const watchMutations=(page)=>page.evaluate(()=>{const p=document.querySelector('.sky-description p[aria-live]');window.__m=[];new MutationObserver(()=>window.__m.push(p.textContent)).observe(p,{childList:true,characterData:true,subtree:true});});
const mutations=(page)=>page.evaluate(()=>window.__m);

const browser=await launch();
console.log('browser',browser.version(),'base',BASE);
const desktop=await browser.newContext({viewport:{width:1440,height:900}});
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});

// ================= U3 arrival-date series
await check('U3: series sits after the A/B comparison, one day per arrival date, selected marker, censored bars, labelled chart',async()=>{
  const from=errCount();
  const page=await compare(desktop,'u3-basic');
  expect(await page.evaluate(()=>{const a=document.querySelector('.arrival-comparison'),b=document.querySelector('.arrival-series');return !!a&&!!b&&!!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);}),'series comes after ArrivalComparison');
  const expected=arrivalSeries(sites['connecting-ridge'],manifest.period,1,7);
  expect(expected.length===52,'sanity: 52 dates');
  expect(await page.locator('.arrival-series-day').count()===52,'52 day groups: '+await page.locator('.arrival-series-day').count());
  expect(await page.locator('.arrival-series-day.is-selected').count()===1,'exactly one selected day');
  expect(await page.locator('.arrival-series-dark.is-censored').count()===expected.filter(e=>e.summary.dark.censored).length,'censored bars match the data');
  const svg=page.locator('svg.arrival-series-chart');
  expect(await svg.getAttribute('role')==='img'&&/52 arrival dates/.test(await svg.getAttribute('aria-label'))&&/table follows/i.test(await svg.getAttribute('aria-label')),'chart is a labelled image: '+await svg.getAttribute('aria-label'));
  const text=await page.locator('.arrival-series').innerText();
  expect(/lower bound/i.test(text)&&/does not rank dates/i.test(text),'legend explains lower bounds and no ranking');
  expect(!/\b(best|optimal|recommended)\b/i.test(text),'no ranking language: '+(text.match(/\b(best|optimal|recommended)\b/i)||[''])[0]);
  const bad=await page.evaluate(()=>[...document.querySelectorAll('.arrival-series svg *')].filter(e=>[...e.attributes].some(a=>/NaN|undefined/.test(a.value))).length);
  expect(bad===0,'NaN in SVG attributes');
  await shot(page,'desktop-compare-series');
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});
await check('U3: table lists every date with the Compare numbers; "Use as arrival" changes the date, the marker and the main table',async()=>{
  const page=await compare(desktop,'u3-use');
  const expected=arrivalSeries(sites['connecting-ridge'],manifest.period,1,7);
  await page.locator('.arrival-series-table summary').click();
  const rows=page.locator('.arrival-series-table tbody tr');
  expect(await rows.count()===52,'52 table rows');
  expect(await page.locator('.arrival-series-table tbody tr[aria-current=true]').count()===1,'one aria-current row');
  expect(/2027-03-01/.test(await page.locator('.arrival-series-table tbody tr[aria-current=true]').innerText()),'current row is the selected date');
  expect(await rows.nth(0).getByRole('button',{name:'Use as arrival'}).isDisabled(),'selected date button disabled');
  // numbers shown in the table equal the series numbers
  for(const k of [0,13,30,51]){
    const cells=await rows.nth(k).locator('td').allInnerTexts();const e=expected[k];
    expect(cells[0]===pct(e.summary.meanSun),`row ${k} mean: ${cells[0]} vs ${pct(e.summary.meanSun)}`);
    expect(cells[1]===hrs(e.summary.dark),`row ${k} darkness: ${cells[1]} vs ${hrs(e.summary.dark)}`);
    expect(cells[2]===pct(e.summary.earthFraction),`row ${k} earth: ${cells[2]}`);
    expect(await rows.nth(k).locator('th').innerText()===e.date,`row ${k} date`);
  }
  // choose 2027-03-15
  await rows.nth(14).getByRole('button',{name:'Use as arrival'}).click();
  expect(await page.inputValue('#arrival')==='2027-03-15','arrival input updated');
  expect(await page.locator('.arrival-series-day.is-selected').count()===1,'one marker after the change');
  const marker=await page.evaluate(()=>[...document.querySelectorAll('.arrival-series-day')].findIndex(g=>g.classList.contains('is-selected')));
  expect(marker===14,'marker moved to index 14: '+marker);
  expect(/2027-03-15/.test(await page.locator('.arrival-series-table tbody tr[aria-current=true]').innerText()),'aria-current moved');
  // the main comparison table's original arrival row shows the same values as the series row
  const main=(await page.locator('table').first().locator('tbody tr').first().innerText()).replace(/\s+/g,' ');
  expect(main.includes(pct(expected[14].summary.meanSun))&&main.includes(hrs(expected[14].summary.dark).replace('≥ ','≥ '))&&main.includes(pct(expected[14].summary.earthFraction)),`main table row does not equal the series row: ${main.slice(0,160)}`);
  expect(/2027-03-15/.test(main),'main table row shows the selected date');
  // the A/B comparison follows the same date
  expect(await page.locator('.arrival-time time').first().getAttribute('datetime')===utcAt(14*24),'A/B instant follows the chosen arrival');
  await page.close();
});
await check('U3: follows window length, observer height and point; unavailable arrival date keeps the series without a marker',async()=>{
  const from=errCount();
  const page=await compare(desktop,'u3-follow');
  const count=async()=>page.locator('.arrival-series-day').count();
  for(const [days,n] of [['3',56],['14',45],['28',31],['7',52]]){
    await page.selectOption('#days',days);await page.waitForTimeout(250);
    expect(await count()===n,`days=${days}: ${await count()} groups, expected ${n}`);
    expect(new RegExp(`${n} arrival dates`).test(await page.locator('svg.arrival-series-chart').getAttribute('aria-label')),'aria-label count');
  }
  await page.locator('.arrival-series-table summary').click();
  const head1=(await page.locator('.arrival-series-table tbody tr').first().innerText());
  await page.selectOption('#height','5');await page.waitForTimeout(250);
  expect((await page.locator('.arrival-series-table tbody tr').first().innerText())!==head1,'height changes the numbers');
  expect(/5 m/.test(await page.locator('.arrival-series > p').first().innerText()),'description mentions 5 m');
  await page.selectOption('#height','1');
  await page.selectOption('#site','shackleton-rim');await page.waitForTimeout(250);
  const exp=arrivalSeries(sites['shackleton-rim'],manifest.period,1,7);
  const first=await page.locator('.arrival-series-table tbody tr').first().locator('td').allInnerTexts();
  expect(first[0]===pct(exp[0].summary.meanSun)&&first[1]===hrs(exp[0].summary.dark),'point change: '+first.join('|'));
  expect(/Shackleton/.test(await page.locator('.arrival-series > p').first().innerText()),'description names the point');
  // an arrival date with no calculable window: series stays, no selected marker, no crash
  await page.fill('#arrival','2027-04-27');await page.waitForTimeout(250);
  expect(await count()===52&&await page.locator('.arrival-series-day.is-selected').count()===0,'no marker when the arrival date has no window');
  await page.fill('#arrival','');await page.waitForTimeout(250);
  expect(await count()===52&&await page.locator('.arrival-series-day.is-selected').count()===0,'empty date safe');
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});
await check('U3: keyboard (summary, Use as arrival via Enter/Space) and mobile 390 layout without overflow',async()=>{
  const page=await compare(mobile,'u3-mobile');
  await page.locator('.arrival-series-table summary').scrollIntoViewIfNeeded();
  await page.locator('.arrival-series-table summary').focus();await page.keyboard.press('Enter');
  expect(await page.locator('.arrival-series-table').evaluate(d=>d.open),'details opens with the keyboard');
  const btn=page.locator('.arrival-series-table tbody tr').nth(5).getByRole('button',{name:'Use as arrival'});
  await btn.scrollIntoViewIfNeeded();await btn.focus();await page.keyboard.press('Enter');
  expect(await page.inputValue('#arrival')==='2027-03-06','Enter selects the date');
  const btn2=page.locator('.arrival-series-table tbody tr').nth(9).getByRole('button',{name:'Use as arrival'});
  await btn2.focus();await page.keyboard.press('Space');
  expect(await page.inputValue('#arrival')==='2027-03-10','Space selects the date');
  const o=await page.evaluate(()=>{const vw=document.documentElement.clientWidth;const skip=e=>e.closest('.table-wrap,svg');return {sw:document.documentElement.scrollWidth,vw,off:[...document.querySelectorAll('.arrival-series *')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.right>vw+1||b.left<-1)&&!skip(e);}).length,svgW:document.querySelector('svg.arrival-series-chart').getBoundingClientRect().width,tableInWrap:!!document.querySelector('.arrival-series-table .table-wrap table')};});
  expect(o.sw<=o.vw+1&&o.off===0&&o.svgW<=o.vw&&o.tableInWrap,'mobile overflow '+JSON.stringify(o));
  const small=await page.$$eval('.arrival-series button',els=>els.filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height<24;}).length);
  expect(small===0,small+' tiny buttons in the series');
  await shot(page,'mobile-compare-series');await page.close();
});

// ================= U6 worked example (Learn)
await check('U6: worked example shows the real Malapert metrics (1 m vs 5 m) from the dataset, with the real-data badge and caveats',async()=>{
  const from=errCount();
  const page=await browser.newContext({viewport:{width:1440,height:900}}).then(c=>c.newPage());watch(page,'u6');
  await page.goto(`${BASE}/#/learn`,{waitUntil:'networkidle'});
  const w=page.locator('.learn-worked');await w.waitFor({timeout:15000});
  expect(/Real data · not a cartoon/.test(await w.innerText()),'real-data badge');
  expect(await page.evaluate(()=>{const w=document.querySelector('.learn-worked');const c=document.querySelector('.learn-svg');return !c||!!(c.compareDocumentPosition(w)&Node.DOCUMENT_POSITION_FOLLOWING);}),'worked example follows the cartoon');
  const m=sites['malapert-massif'].metrics;
  const star=(c)=>c?'≥ ':'';
  const exp=[
    [`${star(m['1'].longestNoDirectSunCensored)}${Math.round(m['1'].longestNoDirectSunH)} h`,`${star(m['5'].longestNoDirectSunCensored)}${Math.round(m['5'].longestNoDirectSunH)} h`],
    [`${Math.round(m['1'].meanSunVisibleFraction*100)}%`,`${Math.round(m['5'].meanSunVisibleFraction*100)}%`],
    [`${Math.round(m['1'].sunlitTimeFraction*100)}%`,`${Math.round(m['5'].sunlitTimeFraction*100)}%`],
    [`${Math.round(m['1'].earthVisibleTimeFraction*100)}%`,`${Math.round(m['5'].earthVisibleTimeFraction*100)}%`]];
  const rows=await w.locator('tbody tr').all();
  expect(rows.length===4,'4 rows');
  for(let i=0;i<4;i++){const cells=await rows[i].locator('td').allInnerTexts();expect(cells[0]===exp[i][0]&&cells[1]===exp[i][1],`row ${i}: ${cells.join('|')} vs ${exp[i].join('|')}`);}
  expect(exp[0].join('|')==='289 h|144 h'&&exp[1].join('|')==='32%|68%','sanity: the documented 289→144 h, 32%→68%');
  const t=await w.innerText();
  expect(/Geometry only/i.test(t)&&/not a selected landing site/i.test(t)&&/5-minute/i.test(t),'caveats present');
  expect(!/NaN|undefined/.test(t),'no NaN');
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});
await check('U6: without the Malapert file the example waits politely (status, no crash, rest of Learn works)',async()=>{
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});const page=await ctx.newPage();
  const local=[];page.on('pageerror',e=>local.push('PE '+String(e).slice(0,150)));
  await page.route(/data\/sites\/malapert-massif\.json/,r=>r.abort());
  await page.goto(`${BASE}/#/learn`,{waitUntil:'load'});await page.waitForTimeout(3500);
  expect(await page.locator('h1').first().innerText().then(t=>t.length>0),'Learn renders');
  const worked=await page.locator('.learn-worked').count();
  const status=await page.locator('main [role=status]').allInnerTexts();
  expect(worked===0||/wait|loading|unavailable|not available/i.test(await page.locator('.learn-worked').innerText()+status.join(' ')),'a waiting/unavailable status is shown instead of invented numbers');
  expect(!/289 h|144 h/.test(await page.locator('main').innerText().then(t=>worked?t.replace(/\s+/g,' '):'')),'no numbers shown without data');
  expect(await page.locator('input[type=range]').count()>=1,'cartoon widgets still work');
  expect(local.length===0,'page errors: '+local.slice(0,2).join(' | '));
  await ctx.close();
});
await check('U6: worked example readable on mobile 390 (table scrolls inside its wrapper, no page overflow)',async()=>{
  const page=await mobile.newPage();watch(page,'u6-mobile');
  await page.goto(`${BASE}/#/learn`,{waitUntil:'networkidle'});await page.locator('.learn-worked').waitFor({timeout:15000});
  await page.locator('.learn-worked').scrollIntoViewIfNeeded();
  const o=await page.evaluate(()=>{const vw=document.documentElement.clientWidth;const w=document.querySelector('.learn-worked');return {sw:document.documentElement.scrollWidth,vw,ww:w.getBoundingClientRect().width,off:[...w.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.right>vw+1||b.left<-1)&&!e.closest('.table-wrap');}).length,fs:parseFloat(getComputedStyle(w.querySelector('td')).fontSize)};});
  expect(o.sw<=o.vw+1&&o.off===0&&o.ww<=o.vw,'mobile overflow '+JSON.stringify(o));
  expect(o.fs>=12,'font size '+o.fs);
  await shot(page,'mobile-learn-worked');await page.close();
});

// ================= U9 sky description
await check('U9: Faithful shows the labelled live region below NextEvents; the text equals the observation, HUD and dataset',async()=>{
  const from=errCount();
  const page=await explore(desktop,'u9-basic');
  const sec=page.locator('.sky-description');
  expect(await sec.getAttribute('aria-labelledby')==='sky-description-title','labelled section');
  const p=sec.locator('p[aria-live]');
  expect(await p.getAttribute('aria-live')==='polite'&&await p.getAttribute('aria-atomic')==='true','polite + atomic');
  expect(await page.evaluate(()=>{const a=document.querySelector('.next-events'),b=document.querySelector('.sky-description');return !!a&&!!b&&!!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);}),'below NextEvents');
  await page.waitForFunction(()=>/UTC, /.test(document.querySelector('.sky-description p[aria-live]').textContent),null,{timeout:8000});
  const text=await desc(page);const s=await snap(page);const o=s.observation;
  expect(fullText.test(text),'description text: '+text.slice(0,160));
  expect(text.startsWith(utcAt(s.index).slice(0,16).replace('T',' ')+' UTC, Connecting ridge, observer 1 m above the ground.'),'time/site/height lead: '+text.slice(0,90));
  // HUD (world-reading) must agree with the description
  const hud=await page.locator('.world-reading').innerText();
  const sunHud=+/Sun disc\s*([\d.]+)%/.exec(hud)[1],earthHud=+/Earth disc\s*([\d.]+)%/.exec(hud)[1];
  expect(Math.abs(sunHud-o.sun*100)<0.06&&Math.abs(earthHud-o.earth*100)<0.06,`HUD ${sunHud}/${earthHud} vs observation ${o.sun}/${o.earth}`);
  const phrase=(pc)=>pc>=99.95?'fully above the terrain horizon':pc<=0.05?'hidden below the terrain horizon':`${Math.round(pc)}% of the disc above the terrain horizon`;
  expect(text.includes('Sun at azimuth')&&text.includes(phrase(sunHud)),`Sun phrase for ${sunHud}%: ${text}`);
  expect(text.includes(phrase(earthHud)),`Earth phrase for ${earthHud}%`);
  // geometry matches the dataset at an integer sample (interpolated scene vs published sample)
  expect(Number.isInteger(s.index),'default index is an integer sample: '+s.index);
  const d=sites['connecting-ridge'];
  for(const [key,body] of [['sunDetail','sun'],['earthDetail','earth']]){
    const det=o[key];
    expect(Math.abs(det.elevationDeg-d[body].elDeg[s.index])<0.03,`${body} elevation ${det.elevationDeg} vs ${d[body].elDeg[s.index]}`);
    let da=Math.abs(det.azimuthDeg-d[body].azDeg[s.index]);da=Math.min(da,360-da);
    expect(da<0.1,`${body} azimuth ${det.azimuthDeg} vs ${d[body].azDeg[s.index]}`);
    expect(Math.abs(det.horizonDeg-horizonAt(d.horizon.elevationDeg['1'],d[body].azDeg[s.index]))<0.03,`${body} horizon ${det.horizonDeg}`);
    expect(Math.abs(det.fraction-d[body].visibleFraction['1'][s.index])<0.01,`${body} fraction`);
    expect(text.includes(`azimuth ${det.azimuthDeg.toFixed(0)}°`),`${body} azimuth text`);
  }
  expect(/Not a radio link, power or operational assessment/.test(await sec.innerText()),'honest note');
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});
await check('U9: follows point, observer height and fractional time (807.49 at Malapert 1 m = 35% / HUD 34.8%)',async()=>{
  const page=await explore(desktop,'u9-follow');
  await page.selectOption('#explorer-site','malapert-massif');await page.selectOption('#explorer-height','1');
  await setSlider(page,807.49);
  await page.waitForFunction(()=>/Malapert/.test(document.querySelector('.sky-description p[aria-live]').textContent),null,{timeout:8000});
  const text=await desc(page);const s=await snap(page);
  expect(Math.abs(s.index-807.49)<0.011,'index '+s.index);
  expect(text.startsWith(utcAt(s.index).slice(0,16).replace('T',' ')+' UTC, Malapert'),'lead: '+text.slice(0,70));
  expect(Math.abs(s.observation.sun-0.348)<0.02,'observation sun '+s.observation.sun);
  expect(text.includes('35% of the disc above the terrain horizon'),'Sun phrase: '+text);
  expect(/Sun disc\s*34\.\d%/.test(await page.locator('.world-reading').innerText()),'HUD agrees');
  await page.selectOption('#explorer-height','5');
  await page.waitForFunction(()=>/observer 5 m/.test(document.querySelector('.sky-description p[aria-live]').textContent),null,{timeout:8000});
  expect(/observer 5 m above the ground/.test(await desc(page)),'height follows');
  await page.close();
});
await check('U9: during Play the live region is quiet ("Paused description"), after Pause it updates once to the settled time',async()=>{
  const page=await explore(desktop,'u9-play');
  await page.waitForFunction(()=>/UTC, /.test(document.querySelector('.sky-description p[aria-live]').textContent),null,{timeout:8000});
  const i0=(await snap(page)).index;
  await watchMutations(page);
  await page.getByRole('button',{name:'Play'}).click();
  await page.waitForTimeout(2600);
  const during=await mutations(page);
  expect((await snap(page)).index>i0,'time advanced while playing');
  expect(during.length<=1,`live region changed ${during.length} times during Play: ${JSON.stringify(during.map(t=>t.slice(0,40)))}`);
  expect(await desc(page)==='Paused description: it updates when time stops.','message during Play: '+await desc(page));
  await page.getByRole('button',{name:'Pause'}).click();
  const settled=await page.evaluate(()=>document.querySelector('canvas').lunarSnapshot().index);
  const want=utcAt(settled).slice(0,16).replace('T',' ')+' UTC';
  await page.waitForFunction(w=>document.querySelector('.sky-description p[aria-live]').textContent.startsWith(w),want,{timeout:6000}).catch(()=>{throw new Error('after Pause the description never shows the settled time '+want+': '+'');});
  const text=await desc(page);
  expect(text.startsWith(want),`after Pause the text shows the settled time ${want}: ${text.slice(0,60)}`);
  await page.waitForTimeout(1200);
  const full=(await mutations(page)).filter(t=>/UTC, /.test(t));
  expect(full.length===1&&full[0].startsWith(want),`after Pause the live region must announce ONLY the settled time (${want}); it announced ${full.length}: ${JSON.stringify(full.map(t=>t.slice(0,18)))} (stale text from before Play is shown first)`);
  await page.close();
});
await check('U9: scrubbing the slider announces only the settled instant (no flood)',async()=>{
  const page=await explore(desktop,'u9-scrub');
  await page.waitForFunction(()=>/UTC, /.test(document.querySelector('.sky-description p[aria-live]').textContent),null,{timeout:8000});
  await watchMutations(page);
  for(const v of [100,180,260,340,420])await setSlider(page,v);
  await page.waitForTimeout(2200);
  const ms=await mutations(page);const full=ms.filter(t=>/UTC, /.test(t));
  expect(full.length<=2,`${full.length} full announcements while scrubbing: ${JSON.stringify(full.map(t=>t.slice(0,18)))}`);
  const final=await desc(page);
  expect(final.startsWith(utcAt(420).slice(0,16).replace('T',' ')+' UTC'),'final announcement is the settled time: '+final.slice(0,40));
  await page.close();
});
await check('U9: Free Mode hides the section; returning to Faithful restores it; frozen state is never described',async()=>{
  const page=await explore(desktop,'u9-free');
  await page.getByRole('button',{name:/^Free Mode/}).first().click();await page.waitForTimeout(500);
  expect(await page.locator('.sky-description').count()===0,'hidden in Free Mode');
  await page.getByLabel(/Earth.s position/).check();
  await page.getByRole('button',{name:/Step \+1 h/}).click();await page.waitForTimeout(500);
  expect(await page.locator('.sky-description').count()===0,'still hidden with a freeze');
  await page.getByRole('button',{name:/^Faithful Mode/}).first().click();
  await page.locator('.sky-description').waitFor({timeout:5000});
  await page.waitForFunction(()=>/UTC, /.test(document.querySelector('.sky-description p[aria-live]').textContent),null,{timeout:8000});
  const s=await snap(page);expect((await desc(page)).startsWith(utcAt(s.index).slice(0,16).replace('T',' ')),'description matches the restored time');
  expect(s.observation.frozen===false,'observation not frozen in Faithful');
  await page.close();
});
await check('U9: mobile 390 - section readable, wraps, no overflow',async()=>{
  const page=await explore(mobile,'u9-mobile');
  await page.waitForFunction(()=>/UTC, /.test(document.querySelector('.sky-description p[aria-live]').textContent),null,{timeout:10000});
  await page.locator('.sky-description').scrollIntoViewIfNeeded();
  const o=await page.evaluate(()=>{const vw=document.documentElement.clientWidth;const el=document.querySelector('.sky-description');const p=el.querySelector('p[aria-live]');return {sw:document.documentElement.scrollWidth,vw,off:[...el.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.right>vw+1||b.left<-1);}).length,fs:parseFloat(getComputedStyle(p).fontSize),h:p.getBoundingClientRect().height};});
  expect(o.sw<=o.vw+1&&o.off===0,'mobile overflow '+JSON.stringify(o));
  expect(o.fs>=12&&o.h>40,'readable '+JSON.stringify(o));
  await shot(page,'mobile-explore-description');await page.close();
});
await check('U9: describeObservation unit cases (imported from the dev server)',async()=>{
  if(!IS_DEV)return 'skipped: needs the dev server to import src/components/SkyDescription.jsx';
  const page=await browser.newContext().then(c=>c.newPage());await page.goto(`${BASE}/`,{waitUntil:'domcontentloaded'});
  const r=await page.evaluate(async()=>{
    const {describeObservation:d}=await import('/src/components/SkyDescription.jsx');
    const det=(f,el,az,hz)=>({fraction:f,elevationDeg:el,azimuthDeg:az,horizonDeg:hz});
    const ctx={siteName:'Test point',height:5,utc:'2027-03-01T12:00:00.000Z'};
    return {
      nullObs:d(null,ctx),missingEarth:d({sunDetail:det(1,1,1,1)},ctx),missingSun:d({earthDetail:det(1,1,1,1)},ctx),
      full:d({sunDetail:det(1,2.5,122.6,0.4),earthDetail:det(0,-7.123,359.6,-0.95)},ctx),
      partial:d({sunDetail:det(0.348,-0.2,10,-0.5),earthDetail:det(0.999,0.1,5,-0.5)},ctx),
      nan:d({sunDetail:det(1,NaN,1,1),earthDetail:det(0,-1,1,1)},ctx),
      zero:d({sunDetail:det(0,-0,0,0),earthDetail:det(1,0,0,0)},ctx)};
  });
  const expect2=(c,m)=>expect(c,m);
  expect2(r.nullObs===null&&r.missingEarth===null&&r.missingSun===null,'null when details are missing: '+JSON.stringify([r.nullObs,r.missingEarth,r.missingSun]));
  expect2(r.full.startsWith('2027-03-01 12:00 UTC, Test point, observer 5 m above the ground. '),'lead: '+r.full.slice(0,80));
  expect2(/Sun at azimuth 123°, 2\.50° relative to the local horizontal; terrain horizon in that direction 0\.40°; fully above the terrain horizon\./.test(r.full),'Sun sentence (rounding, sign): '+r.full);
  expect2(/Earth at azimuth 360°, −7\.12° relative to the local horizontal; terrain horizon in that direction −0\.95°; hidden below the terrain horizon\./.test(r.full),'Earth sentence (minus sign, hidden, azimuth rounds to 360°): '+r.full);
  expect2(/Sun at azimuth 10°, −0\.20°.*35% of the disc above the terrain horizon/.test(r.partial),'35% partial: '+r.partial);
  expect2(/Earth at.*100% of the disc above the terrain horizon/.test(r.partial)||/Earth at.*fully above/.test(r.partial),'0.999 rounds to 100%: '+r.partial);
  expect2(/Sun: not available\./.test(r.nan)&&/Earth at azimuth 1°/.test(r.nan),'NaN elevation -> not available: '+r.nan);
  expect2(!/NaN|undefined/.test(JSON.stringify(r)),'no NaN/undefined in any sentence');
  await page.close();
  return 'azimuth 359.6° prints as 360° (rounding, not wrapped to 0°)';
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
