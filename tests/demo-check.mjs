// Playwright QA of the static slide demo at /demo/. Not part of `npm test`.
//   QA_URL=https://lunar-navigator-2026.pages.dev node tests/demo-check.mjs
// Env: QA_OUT overrides the output dir (default ../tmp/lunar-qa/demo); QA_HEADED=1 shows the browser.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const BASE=(process.env.QA_URL||'http://localhost:5173').replace(/\/$/,'');
const URL_=BASE+'/demo/';
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(dirname(fileURLToPath(import.meta.url)),'..','..','tmp','lunar-qa','demo');
mkdirSync(OUT,{recursive:true});
const CHROME_EXE='C:/Program Files/Google/Chrome/Application/chrome.exe';
const results=[],issues={console:[],pageerror:[],http:[],requestfailed:[]};
const expect=(c,m)=>{if(!c)throw new Error(m);};

async function launch(){
  const headless=!process.env.QA_HEADED;
  for(const o of [{channel:'chrome'},existsSync(CHROME_EXE)?{executablePath:CHROME_EXE}:null,{}]){
    if(!o)continue;try{return await chromium.launch({headless,...o});}catch(e){console.error('launch failed',e.message.split('\n')[0]);}
  }
  throw new Error('no usable browser');
}
async function check(name,fn){
  try{const detail=await fn();results.push({name,ok:true,detail:detail??''});console.log('PASS',name);}
  catch(e){results.push({name,ok:false,detail:String(e.message||e).split('\n')[0]});console.log('FAIL',name,'-',String(e.message||e).split('\n')[0]);}
}
function watch(page,tag){
  page.on('console',m=>{if(['error','warning'].includes(m.type()))issues.console.push({tag,type:m.type(),text:m.text().slice(0,300)});});
  page.on('pageerror',e=>issues.pageerror.push({tag,text:String(e).slice(0,300)}));
  page.on('response',r=>{if(r.status()>=400)issues.http.push({tag,status:r.status(),url:r.url()});});
  page.on('requestfailed',r=>issues.requestfailed.push({tag,url:r.url(),error:r.failure()?.errorText}));
}
const state=(page)=>page.evaluate(()=>({
  count:document.getElementById('count').textContent,
  hash:location.hash,
  active:[...document.querySelectorAll('.slide')].map((s,i)=>s.classList.contains('active')?i+1:0).filter(Boolean),
  visible:[...document.querySelectorAll('.slide')].filter(s=>s.getBoundingClientRect().height>0&&getComputedStyle(s).display!=='none').length,
  hiddenOk:[...document.querySelectorAll('.slide')].every(s=>s.classList.contains('active')===(s.getAttribute('aria-hidden')==='false')),
}));
const at=async(page,n,why)=>{const s=await state(page);expect(s.count===`${n} / 6`&&s.active.length===1&&s.active[0]===n&&s.visible===1&&(s.hash==='#'+n||(n===1&&s.hash===''))&&s.hiddenOk,`${why}: expected slide ${n}, got ${JSON.stringify(s)}`);};
async function load(ctx,tag,hash=''){const p=await ctx.newPage();watch(p,tag);await p.goto(URL_+hash,{waitUntil:'networkidle'});return p;}

const browser=await launch();
console.log('browser',browser.version(),'url',URL_);
const desk=await browser.newContext({viewport:{width:1280,height:720}});
const mob=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});

await check('deck has 6 slides (<= 7), starts on slide 1, labels match',async()=>{
  const p=await load(desk,'deck');
  const n=await p.locator('.slide').count();expect(n===6&&n<=7,`slides: ${n}`);
  const s=await state(p);expect(s.count==='1 / 6'&&s.active[0]===1&&s.visible===1,JSON.stringify(s));
  const labels=await p.locator('.slide').evaluateAll(a=>a.map(x=>x.getAttribute('aria-label')));
  expect(labels.every((l,i)=>l===`${i+1} of 6`),'aria-labels '+labels.join('|'));
  expect(await p.locator('#prev').getAttribute('aria-label')==='Previous slide'&&await p.locator('#next').getAttribute('aria-label')==='Next slide','button names');
  await p.close();
});
await check('Next button: locator click 1->2->3, then a real mouse click at its coordinates 3->4 (nothing overlays it)',async()=>{
  const p=await load(desk,'next');
  await p.locator('#next').click();await at(p,2,'click 1');
  await p.locator('#next').click();await at(p,3,'click 2');
  const b=await p.locator('#next').boundingBox();
  const top=await p.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y);return e.id||e.tagName;},{x:b.x+b.width/2,y:b.y+b.height/2});
  expect(top==='next','element at the Next button centre is '+top+' (overlay?)');
  expect(b.y+b.height<=720&&b.x>=0&&b.x+b.width<=1280,'Next button outside viewport');
  await p.mouse.click(b.x+b.width/2,b.y+b.height/2);await at(p,4,'mouse click');
  await p.close();
});
await check('keyboard: ArrowRight, End, Previous click, Home, ArrowLeft, Space; ends clamp at 1 and 6',async()=>{
  const p=await load(desk,'kbd');
  await p.locator('#next').click();await p.locator('#next').click();await at(p,3,'setup');
  await p.keyboard.press('ArrowRight');await at(p,4,'ArrowRight');
  await p.keyboard.press('End');await at(p,6,'End');
  await p.keyboard.press('ArrowRight');await at(p,6,'ArrowRight at last slide clamps');
  await p.locator('#prev').click();await at(p,5,'Previous click');
  await p.keyboard.press('ArrowLeft');await at(p,4,'ArrowLeft');
  await p.keyboard.press('PageDown');await at(p,5,'PageDown');
  await p.keyboard.press('Space');await at(p,6,'Space');
  await p.keyboard.press('Home');await at(p,1,'Home');
  await p.keyboard.press('ArrowLeft');await at(p,1,'ArrowLeft at first slide clamps');
  await p.close();
});
await check('deep links: reopening #3 shows slide 3; out-of-range and invalid hashes are safe',async()=>{
  const p=await load(desk,'hash','#3');
  const s=await state(p);expect(s.count==='3 / 6'&&s.active[0]===3&&s.visible===1,'#3 -> '+JSON.stringify(s));
  const fresh=await load(desk,'hash-fresh','#3');await at(fresh,3,'#3 fresh load');
  for(const [h,want] of [['#99','6 / 6'],['#0','1 / 6'],['#-4','1 / 6'],['#abc','1 / 6'],['#6','6 / 6']]){
    const q=await load(desk,'hash-'+h,h);const st=await state(q);
    expect(st.count===want&&st.visible===1,`${h} -> ${st.count} (visible ${st.visible}), wanted ${want}`);await q.close();
  }
  await p.close();await fresh.close();
});
await check('hash follows navigation (replaceState) so a reload keeps the current slide',async()=>{
  const p=await load(desk,'reload');
  await p.keyboard.press('End');await p.reload({waitUntil:'networkidle'});await at(p,6,'reload after End');
  await p.close();
});
await check('slide 3 screenshot image loaded (natural size > 0, alt text, correct request)',async()=>{
  const p=await load(desk,'img','#3');
  const r=await p.evaluate(()=>{const i=document.querySelector('.slide.active img');return {ok:i.complete&&i.naturalWidth>0,w:i.naturalWidth,h:i.naturalHeight,alt:i.alt.length,src:i.currentSrc};});
  expect(r.ok&&r.w>=800,'image not loaded: '+JSON.stringify(r));expect(r.alt>20,'alt text too short');
  expect((await p.request.get(r.src)).ok(),'image URL not OK');
  await p.close();return `${r.w}x${r.h}`;
});
for(const [label,ctx,w,h] of [['desktop-1280x720',desk,1280,720],['mobile-390x844',mob,390,844]]){
  await check(`${label}: every slide fits horizontally, content reachable, controls visible (screenshots saved)`,async()=>{
    const p=await load(ctx,'layout-'+label);const bad=[];
    for(let n=1;n<=6;n++){
      if(n>1)await p.locator('#next').click();await at(p,n,'layout nav');
      const r=await p.evaluate(()=>{
        const vw=document.documentElement.clientWidth;const sl=document.querySelector('.slide.active');
        const off=[...sl.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.right>vw+1||b.left<-1)&&!e.closest('table')&&!e.closest('pre');}).slice(0,3).map(e=>e.tagName+'.'+e.className);
        const tbl=[...sl.querySelectorAll('table')].map(t=>t.getBoundingClientRect().right>vw+1);
        const c=document.querySelector('.controls').getBoundingClientRect();
        return {sw:document.documentElement.scrollWidth,vw,off,tableOver:tbl.some(Boolean),ctrlIn:c.top>=0&&c.bottom<=innerHeight&&c.left>=0&&c.right<=vw,scrollH:document.documentElement.scrollHeight,vh:innerHeight};
      });
      if(r.sw>r.vw+1||r.off.length||r.tableOver)bad.push(`slide ${n}: sw ${r.sw}>${r.vw} ${r.off.join(',')}${r.tableOver?' table-overflow':''}`);
      if(!r.ctrlIn)bad.push(`slide ${n}: controls outside viewport`);
      await p.waitForTimeout(900); // let the slide fade-in finish before the screenshot
      await p.screenshot({path:join(OUT,`demo-${label}-slide${n}.png`),fullPage:true});
    }
    await p.close();
    expect(bad.length===0,bad.join(' || '));
  });
}
await check('links on slides are absolute, point to the project, and external ones are safe',async()=>{
  const p=await load(desk,'links');
  const links=await p.$$eval('a',as=>as.map(a=>({href:a.href,rel:a.rel,target:a.target})));
  expect(links.length>=7,'links: '+links.length);
  expect(links.every(l=>/^https:\/\//.test(l.href)),'non-https link');
  expect(links.some(l=>/github\.com\/Andre1B\/lunar-navigator-spaceapps-2026/.test(l.href)),'GitHub link');
  expect(links.every(l=>l.target!=='_blank'||/noopener|noreferrer/.test(l.rel)),'unsafe _blank');
  for(const u of new Set(links.map(l=>l.href).filter(h=>/lunar-navigator-2026\.pages\.dev/.test(h)))){const r=await p.request.get(u.split('#')[0]);expect(r.ok(),'broken '+u+' '+r.status());}
  await p.close();return `${links.length} links`;
});
await check('no console errors/warnings (incl. CSP), page errors or failed requests on /demo/',async()=>{
  const bad=[...issues.console,...issues.pageerror,...issues.http,...issues.requestfailed].filter(x=>!/favicon\.ico/.test(x.url||''));
  expect(bad.length===0,JSON.stringify(bad.slice(0,4)));
});
const csp=(await desk.request.get(URL_)).headers();
await browser.close();
const failed=results.filter(r=>!r.ok).length;
writeFileSync(join(OUT,'demo-results.json'),JSON.stringify({base:URL_,at:new Date().toISOString(),browserVersion:'see run log',headers:{csp:csp['content-security-policy']||null,ctype:csp['content-type']},passed:results.length-failed,failed,results,issues},null,1));
console.log(`\n${results.length-failed}/${results.length} passed. Output: ${OUT}`);
process.exit(failed?1:0);
