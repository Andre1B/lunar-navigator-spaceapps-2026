// Focused QA of the deferred 4k textures (desktop only) and the eagerly loaded Learn page.
// Playwright, not part of `npm test`.
//   QA_URL=https://lunar-navigator-2026.pages.dev node tests/browser-check-textures.mjs
// Env: QA_OUT (default ../tmp/lunar-qa-textures), QA_HEADED=1, QA_ONLY=<substring>.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const BASE=(process.env.QA_URL||'http://localhost:5173').replace(/\/$/,'');
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(ROOT,'..','tmp','lunar-qa-textures');
mkdirSync(OUT,{recursive:true});
const CHROME_EXE='C:/Program Files/Google/Chrome/Application/chrome.exe';
const results=[],issues={console:[],pageerror:[],http:[],requestfailed:[]};
const expect=(c,m)=>{if(!c)throw new Error(m);};
const K4=/moon-color-lroc-4096x2048|earth-visual-4k|starmap-2020-celestial-4096x2048/;
const K2=/moon-color-lroc-2048x1024|earth-visual-2k\.jpg|starmap-2020-celestial-2048x1024/;
const K1=/moon-color-lroc-1024x512|earth-visual-1k|starmap-2020-celestial-1024x512/;

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
function track(page,tag){
  const t={req:[],done:[]};
  page.on('request',r=>t.req.push(r.url()));
  page.on('response',r=>{t.done.push({url:r.url(),status:r.status()});if(r.status()>=400)issues.http.push({tag,status:r.status(),url:r.url()});});
  page.on('console',m=>{if(m.type()==='error')issues.console.push({tag,text:m.text().slice(0,200)});});
  page.on('pageerror',e=>issues.pageerror.push({tag,text:String(e).slice(0,200)}));
  page.on('requestfailed',r=>{if(r.failure()?.errorText==='net::ERR_ABORTED')return;issues.requestfailed.push({tag,url:r.url(),error:r.failure()?.errorText});});
  t.count=(re)=>t.req.filter(u=>re.test(u)).length;
  t.names=(re)=>t.req.filter(u=>re.test(u)).map(u=>u.split('/').pop());
  return t;
}
const errCount=()=>issues.console.length+issues.pageerror.length;
const fresh=(from)=>[...issues.console,...issues.pageerror].slice(from);
async function simPage(ctx,tag,qs='?qa=1'){
  const page=await ctx.newPage();const net=track(page,tag);
  await page.goto(`${BASE}/${qs}#/simulator`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:/Step \+1 h/}).waitFor({timeout:30000});
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
  await page.waitForTimeout(3000);
  return {page,net};
}
const canvasBox=async(page)=>{const b=await page.locator('canvas').first().boundingBox();return {cx:b.x+b.width/2,cy:b.y+b.height/2};};
// 16x16 grayscale signature of the canvas, to detect flips / blank scenes independent of 2k vs 4k sharpness
async function signature(page){
  const png=await page.locator('canvas').first().screenshot();
  return page.evaluate(async b64=>{
    const bin=atob(b64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);const bmp=await createImageBitmap(new Blob([bytes],{type:'image/png'})); // no fetch(): the site CSP blocks data: connections
    const c=new OffscreenCanvas(16,16);const g=c.getContext('2d');g.drawImage(bmp,0,0,16,16);
    const d=g.getImageData(0,0,16,16).data;const out=[];for(let i=0;i<d.length;i+=4)out.push((d[i]+d[i+1]+d[i+2])/3);return out;
  },png.toString('base64'));
}
const diff=(a,b)=>a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0)/a.length;
const mean=(a)=>a.reduce((s,v)=>s+v,0)/a.length;

const browser=await launch();
console.log('browser',browser.version(),'base',BASE);
const desktop=await browser.newContext({viewport:{width:1440,height:900}});
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});

await check('desktop 1440: loading the simulator without interaction requests the 2k textures and NO 4k file',async()=>{
  const from=errCount();
  const {page,net}=await simPage(desktop,'tex-idle');
  expect(net.count(K4)===0,'4k requested without interaction: '+net.names(K4).join(','));
  expect(net.count(/moon-color-lroc-2048x1024/)>=1&&net.count(/earth-visual-2k\.jpg/)>=1&&net.count(/starmap-2020-celestial-2048x1024/)>=1,'2k set requested: '+net.names(K2).join(','));
  expect(net.count(K1)===0,'1k set must not load on desktop: '+net.names(K1).join(','));
  await page.waitForTimeout(2500);expect(net.count(K4)===0,'4k appeared on its own after idle time');
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();return net.names(K2).join(',');
});
await check('desktop 1440: wheel triggers exactly three 4k requests (Moon, Earth, stars), scene keeps rendering, no console errors, later input adds none',async()=>{
  const from=errCount();
  const {page,net}=await simPage(desktop,'tex-wheel');
  const sig0=await signature(page);expect(mean(sig0)>3,'scene is not blank before: mean '+mean(sig0).toFixed(1));
  const {cx,cy}=await canvasBox(page);await page.mouse.move(cx,cy);await page.mouse.wheel(0,-200);
  await page.waitForTimeout(6000);
  const names=net.names(K4);
  expect(names.length===3&&new Set(names).size===3,'expected exactly 3 distinct 4k requests, got '+names.length+': '+names.join(','));
  expect(names.some(n=>/moon-color/.test(n))&&names.some(n=>/earth-visual-4k/.test(n))&&names.some(n=>/starmap/.test(n)),'4k set: '+names.join(','));
  const bad=net.done.filter(d=>K4.test(d.url)&&d.status!==200);expect(bad.length===0,'4k responses: '+JSON.stringify(bad));
  const sig1=await signature(page);expect(mean(sig1)>3,'scene is not blank after switching to 4k');
  // more interaction: no further 4k requests
  await page.mouse.wheel(0,200);await page.mouse.wheel(0,-150);await page.mouse.down();await page.mouse.move(cx+120,cy+30,{steps:8});await page.mouse.up();await page.waitForTimeout(2500);
  expect(net.count(K4)===3,'additional 4k requests after more input: '+net.count(K4));
  expect(await page.locator('.scene-error').count()===0,'scene error shown');
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();return names.join(',');
});
await check('desktop 1440: a drag alone and, separately, keyboard-only (arrow key, "+") each trigger exactly three 4k requests',async()=>{
  const from=errCount();
  for(const [label,act] of [
    ['drag',async(page)=>{const {cx,cy}=await canvasBox(page);await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+100,cy+20,{steps:6});await page.mouse.up();}],
    ['ArrowRight',async(page)=>{await page.locator('canvas').first().focus();await page.keyboard.press('ArrowRight');}],
    ['Equal (+)',async(page)=>{await page.locator('canvas').first().focus();await page.keyboard.press('Equal');}],
    ['Navigation button',async(page)=>{const d=page.locator('details.manual-camera-controls');if(await d.getAttribute('open')===null)await d.locator('summary').click();await page.getByRole('button',{name:'Zoom in'}).click();}]]){
    const {page,net}=await simPage(desktop,'tex-'+label);
    expect(net.count(K4)===0,`${label}: 4k before input`);
    await act(page);await page.waitForTimeout(6000);
    expect(net.count(K4)===3,`${label}: expected 3 4k requests, got ${net.count(K4)}: ${net.names(K4).join(',')}`);
    expect(mean(await signature(page))>3,`${label}: scene blank`);
    await page.close();
  }
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
});
await check('desktop 1440: the 4k switch keeps the texture orientation (no flip) and brightness at the same camera',async()=>{
  const a=await simPage(desktop,'tex-orient-2k');
  const s2=await signature(a.page);
  await a.page.screenshot({path:join(OUT,'desktop-2k.png')});
  await a.page.close();
  const b=await simPage(desktop,'tex-orient-4k');
  const {cx,cy}=await canvasBox(b.page);
  await b.page.mouse.move(cx,cy);await b.page.mouse.down();await b.page.mouse.up(); // click only: the camera does not move
  await b.page.waitForTimeout(6000);
  expect(b.net.count(K4)===3,'4k loaded by a click: '+b.net.count(K4));
  const s4=await signature(b.page);
  await b.page.screenshot({path:join(OUT,'desktop-4k.png')});
  const d=diff(s2,s4);
  const flippedH=s2.map((_,i)=>s2[(Math.floor(i/16))*16+(15-(i%16))]),flippedV=s2.map((_,i)=>s2[(15-Math.floor(i/16))*16+(i%16)]);
  expect(d<6,`2k vs 4k signature differs by ${d.toFixed(2)} (grey levels): orientation or brightness changed`);
  expect(diff(flippedH,s4)>=d&&diff(flippedV,s4)>=d,`4k looks closer to a flipped 2k than to the 2k itself (h ${diff(flippedH,s4).toFixed(2)}, v ${diff(flippedV,s4).toFixed(2)}, same ${d.toFixed(2)})`);
  expect(Math.abs(mean(s2)-mean(s4))<8,'mean brightness changed '+mean(s2).toFixed(1)+' -> '+mean(s4).toFixed(1));
  await b.page.close();return `diff ${d.toFixed(2)}`;
});
await check('desktop 1440: Free Mode after the switch still renders, presets work, and no additional 4k loads',async()=>{
  const from=errCount();
  const {page,net}=await simPage(desktop,'tex-free');
  const {cx,cy}=await canvasBox(page);await page.mouse.move(cx,cy);await page.mouse.wheel(0,-100);await page.waitForTimeout(5000);
  expect(net.count(K4)===3,'4k count '+net.count(K4));
  await page.getByRole('button',{name:/^Free Mode/}).first().click();
  await page.getByLabel(/Earth.s position/).check();
  await page.getByRole('button',{name:/Step \+1 h/}).click();await page.waitForTimeout(800);
  for(const id of ['earth','sky','terrain','pair','overview']){await page.locator('.camera-presets button').nth(['overview','earth','south','sky','terrain','pair','system'].indexOf(id)).click();await page.waitForTimeout(1200);
    expect(mean(await signature(page))>1.5,`Free Mode ${id}: scene looks blank`);}
  expect(net.count(K4)===3,'extra 4k requests in Free Mode: '+net.count(K4));
  expect(await page.locator('.scene-error').count()===0,'scene error');
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});
await check('mobile 390: never loads 4k (nor 2k): 1k textures only, even after interaction',async()=>{
  const from=errCount();
  const {page,net}=await simPage(mobile,'tex-mobile');
  expect(net.count(K4)===0&&net.count(K2)===0,'unexpected sizes on mobile: '+net.names(/4096|4k|2048x1024|earth-visual-2k/).join(','));
  expect(net.count(K1)>=3,'1k set requested: '+net.names(K1).join(','));
  await page.locator('canvas').first().focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Equal');
  await page.locator('.setup-toggle').tap();await page.selectOption('#explorer-view','earth');await page.waitForTimeout(3000);
  expect(net.count(K4)===0,'4k after interaction on mobile: '+net.names(K4).join(','));
  expect(mean(await signature(page))>1.5,'mobile scene blank');
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});

// ================= Learn loaded eagerly
await check('Learn: opens directly and through navigation; worked example visible; no lazy Learn chunk; no console errors',async()=>{
  const from=errCount();
  const direct=await desktop.newPage();const n1=track(direct,'learn-direct');
  await direct.goto(`${BASE}/#/learn`,{waitUntil:'networkidle'});
  await direct.locator('.learn-worked').waitFor({timeout:15000});
  expect(/Real data · not a cartoon/.test(await direct.locator('.learn-worked').innerText()),'worked example badge');
  expect(await direct.locator('h1').first().innerText().then(t=>/How Lunar Navigator works/.test(t)),'Learn h1');
  expect(n1.count(/Learn[-.][\w-]*\.js/)===0,'a separate Learn chunk was requested: '+n1.names(/Learn[-.][\w-]*\.js/).join(','));
  await direct.close();
  const nav=await desktop.newPage();const n2=track(nav,'learn-nav');
  await nav.goto(`${BASE}/#/home`,{waitUntil:'networkidle'});
  const before=n2.req.length;
  await nav.locator('header').getByRole('link',{name:'How it works'}).click();
  await nav.waitForFunction(()=>location.hash==='#/learn');
  await nav.locator('.learn-worked').waitFor({timeout:15000});
  expect(n2.req.slice(before).filter(u=>/\.js(\?|$)/.test(u)&&!/node_modules|\/src\//.test(u)).length===0,'navigating to Learn fetched new JS: '+n2.req.slice(before).filter(u=>/\.js(\?|$)/.test(u)).join(','));
  // widgets still work
  const slider=nav.locator('input[type=range]').first();await slider.focus();await nav.keyboard.press('End');
  expect(/clears|high enough/i.test(await nav.locator('.learn-svg').first().getAttribute('aria-label')),'raise-the-observer widget works');
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await nav.close();
});
await check('Learn 390: opens directly and via navigation, worked example visible, no horizontal overflow',async()=>{
  const from=errCount();
  for(const via of ['direct','nav']){
    const page=await mobile.newPage();track(page,'learn-mobile-'+via);
    if(via==='direct')await page.goto(`${BASE}/#/learn`,{waitUntil:'networkidle'});
    else{await page.goto(`${BASE}/#/home`,{waitUntil:'networkidle'});await page.evaluate(()=>{location.hash='#/learn';});}
    await page.locator('.learn-worked').waitFor({timeout:15000});
    const o=await page.evaluate(()=>{const vw=document.documentElement.clientWidth;const skip=e=>e.closest('.table-wrap,pre,nav,svg,canvas');return {sw:document.documentElement.scrollWidth,vw,off:[...document.querySelectorAll('main *')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.right>vw+1||b.left<-1)&&!skip(e);}).slice(0,3).map(e=>e.tagName+'.'+String(e.className?.baseVal??e.className).slice(0,25))};});
    expect(o.sw<=o.vw+1&&o.off.length===0,`${via}: overflow ${JSON.stringify(o)}`);
    await page.screenshot({path:join(OUT,`mobile-learn-${via}.png`)});await page.close();
  }
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
});

// ================= Smoke
await check('smoke: Home, Compare and Review open without console or network errors (desktop and mobile)',async()=>{
  const from=errCount();const bad=[];
  for(const [label,ctx] of [['desktop',desktop],['mobile',mobile]])for(const route of ['home','compare','review']){
    const page=await ctx.newPage();track(page,`smoke-${label}-${route}`);
    await page.goto(`${BASE}/#/${route}`,{waitUntil:'networkidle'});await page.locator('#main').waitFor({timeout:20000});
    if(route==='compare')await page.locator('table tbody tr').first().waitFor({timeout:20000});
    await page.waitForTimeout(600);
    const o=await page.evaluate(()=>({h1:document.querySelector('h1')?.textContent.trim().slice(0,40)||'',sw:document.documentElement.scrollWidth,vw:document.documentElement.clientWidth,nan:/NaN|undefined/.test(document.querySelector('main').innerText)}));
    if(!o.h1)bad.push(`${label} ${route}: no h1`);if(o.sw>o.vw+1)bad.push(`${label} ${route}: overflow ${o.sw}>${o.vw}`);if(o.nan)bad.push(`${label} ${route}: NaN/undefined text`);
    await page.close();
  }
  expect(bad.length===0,bad.join(' | '));expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
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
