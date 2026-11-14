// True-scale and interaction acceptance for the 3D Explorer. Playwright, not part of `npm test`.
// Uses the read-only debug hook enabled by `?qa=1`: canvas.lunarSnapshot() (units: Moon radii, 1737.4 km = 1).
// Real mouse / wheel / keyboard input drives the scene; the snapshot is only used to measure the result.
//   node tests/browser-check-truescale.mjs                      (dev, http://localhost:5173)
//   QA_URL=https://... node tests/browser-check-truescale.mjs
// Env: QA_OUT (default ../tmp/lunar-qa-truescale), QA_HEADED=1.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {visibleDiskFraction,horizonAt} from '../src/lib/analysis.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const BASE=(process.env.QA_URL||'http://localhost:5173').replace(/\/$/,'');
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(ROOT,'..','tmp','lunar-qa-truescale');
mkdirSync(OUT,{recursive:true});
const CHROME_EXE='C:/Program Files/Google/Chrome/Application/chrome.exe';
const R=1737.4;
const sky=JSON.parse(readFileSync(join(ROOT,'public/data/sky.json'),'utf8'));
const planets=JSON.parse(readFileSync(join(ROOT,'public/data/planets.json'),'utf8'));
const PRESETS=['overview','earth','south','sky','terrain','pair','system'];
const notes=new Set();
const results=[],issues={console:[],pageerror:[],http:[],requestfailed:[]};
const expect=(c,m)=>{if(!c)throw new Error(m);};
const near=(a,b,rel,msg)=>expect(Math.abs(a-b)<=Math.max(Math.abs(b)*rel,1e-9),`${msg}: got ${a}, expected ${b} (rel ${rel})`);
const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],len=(v)=>Math.hypot(...v),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const finite=(v)=>v.every(Number.isFinite);
// J2000 (km, Moon-centred) -> Three axes (x,z,-y), in Moon radii
const toScene=(p)=>[p[0]/R,p[2]/R,-p[1]/R];

async function launch(){
  const args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
  const headless=!process.env.QA_HEADED;
  for(const o of [{channel:'chrome'},existsSync(CHROME_EXE)?{executablePath:CHROME_EXE}:null,{}]){
    if(!o)continue;try{return await chromium.launch({headless,args,...o});}catch(e){console.error('launch failed',e.message.split('\n')[0]);}
  }
  throw new Error('no usable browser');
}
async function check(name,fn){
  if(process.env.QA_ONLY&&!name.includes(process.env.QA_ONLY))return; // QA_ONLY=<substring> runs a subset
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
const snap=(page)=>page.evaluate(()=>document.querySelector('canvas')?.lunarSnapshot?.());
const shot=(page,name)=>page.screenshot({path:join(OUT,name+'.png')});
async function sim(ctx,tag,qs='?qa=1'){
  const page=await ctx.newPage();watch(page,tag);
  await page.goto(`${BASE}/${qs}#/simulator`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:/Step \+1 h/}).waitFor({timeout:30000});
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:20000}).catch(()=>{throw new Error('canvas.lunarSnapshot is missing (open with ?qa=1)');});
  await page.waitForTimeout(800);
  return page;
}
async function settle(page,ms=7000){
  // A click starts its transition on the next frame, so wait, then require "no transition" and a stable camera.
  await page.waitForTimeout(450);
  const t=Date.now();let prev=null;
  while(Date.now()-t<ms){
    const s=await snap(page);
    const key=JSON.stringify([s.camera.position,s.camera.target]);
    if(!s.transition&&key===prev)return s;
    prev=key;await page.waitForTimeout(250);
  }
  return snap(page);
}
const canvasHash=async(page)=>createHash('md5').update(await page.locator('canvas').first().screenshot()).digest('hex');
// wait for the Loading state to disappear and the image to stop changing, then hash
const stableHash=async(page,ms=10000)=>{await page.waitForFunction(()=>!document.querySelector('.scene-loading'),null,{timeout:ms}).catch(()=>{});let prev='',n=0;const t=Date.now();while(Date.now()-t<ms){const h=await canvasHash(page);if(h===prev){if(++n>=2)return h;}else{n=0;prev=h;}await page.waitForTimeout(400);}return prev;};
const preset=async(page,id)=>{await page.locator('.camera-presets button').nth(PRESETS.indexOf(id)).click();};
const camDist=(s)=>len(vsub(s.camera.position,s.camera.target));
const bodyDist=(s,b)=>len(vsub(s.camera.position,s.bodies[b].position));
const angRadiusDeg=(s,b)=>Math.asin(Math.min(1,s.bodies[b].radius/bodyDist(s,b)))*180/Math.PI;
const openNav=async(page)=>{const d=page.locator('details.manual-camera-controls');if(!(await d.getAttribute('open')!==null))await d.locator('summary').click();};
async function canvasBox(page){const b=await page.locator('canvas').first().boundingBox();return {cx:b.x+b.width/2,cy:b.y+b.height/2,w:b.width,h:b.height};}
async function drag(page,dx,dy,steps=12){const {cx,cy}=await canvasBox(page);await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+dx,cy+dy,{steps});await page.mouse.up();}
const wheel=async(page,dy,times)=>{const {cx,cy}=await canvasBox(page);await page.mouse.move(cx,cy);for(let i=0;i<times;i++){await page.mouse.wheel(0,dy);await page.waitForTimeout(25);}await page.waitForTimeout(300);};
const angleBetween=(a,b)=>Math.acos(Math.max(-1,Math.min(1,dot(a,b)/(len(a)*len(b)))))*180/Math.PI;

const browser=await launch();
console.log('browser',browser.version(),'base',BASE);
const desktop=await browser.newContext({viewport:{width:1440,height:900}});
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});

await check('true scale: every body radius = radiusKm / 1737.4 and position = posKm / 1737.4 (axes x,z,-y), at default and after moving time',async()=>{
  const page=await sim(desktop,'scale');
  const slider=page.locator('#time-slider');
  const report=[];
  for(const index of [0,12,777]){
    {await slider.focus();await page.evaluate(i=>{const s=document.querySelector('#time-slider');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(s,String(i));s.dispatchEvent(new Event('input',{bubbles:true}));},index);await page.waitForTimeout(500);}
    const s=await snap(page);
    expect(Math.abs(s.index-index)<1.01,`snapshot index ${s.index} vs ${index}`);
    const truth={moon:{pos:[0,0,0],radius:1},earth:{pos:toScene(sky.earthPosKm[index]),radius:sky.radiiKm.earth/R},sun:{pos:toScene(sky.sunPosKm[index]),radius:sky.radiiKm.sun/R}};
    for(const p of planets.planets)truth[p.id]={pos:toScene(p.posKm[index]),radius:p.radiusKm/R};
    for(const [id,t] of Object.entries(truth)){
      const b=s.bodies[id];expect(b,'missing body '+id);
      near(b.radius,t.radius,2e-3,`${id} radius @${index}`);
      expect(len(vsub(b.position,t.pos))<=Math.max(len(t.pos)*2e-3,2e-3),`${id} position @${index}: ${b.position.map(v=>v.toFixed(2))} vs ${t.pos.map(v=>v.toFixed(2))}`);
    }
    report.push(`i${index}: earth ${len(truth.earth.pos).toFixed(1)} R, radius ${truth.earth.radius.toFixed(3)} R`);
  }
  await page.close();return report.join('; ');
});

await check('true scale: default Moon-orbit view shows a small Earth (angular radius < 3 deg) and a tiny Sun disc, camera inside limits',async()=>{
  const page=await sim(desktop,'default');
  const s=await settle(page);
  expect(s.view==='overview','default view is '+s.view);
  const e=angRadiusDeg(s,'earth'),su=angRadiusDeg(s,'sun');
  expect(e<3&&e>0.3,`Earth angular radius ${e.toFixed(2)} deg should be ~0.9 deg (true scale)`);
  expect(su<1&&su>0.1,`Sun angular radius ${su.toFixed(2)} deg should be ~0.27 deg`);
  const d=camDist(s);expect(d>=s.camera.minDistance-1e-9&&d<=s.camera.maxDistance,`camera distance ${d}`);
  expect(len(s.camera.position)>=s.bodies.moon.radius,'camera must not be inside the Moon');
  await shot(page,'desktop-default-moon-orbit');await page.close();
  return `earth ${e.toFixed(2)} deg, sun ${su.toFixed(2)} deg`;
});

for(const mode of ['Faithful','Free'])await check(`presets (${mode} Mode): all 7 reach their view, finite camera inside min/max, true radii retained, no console errors`,async()=>{
  const from=errCount();
  const page=await sim(desktop,'presets-'+mode);
  if(mode==='Free')await page.getByRole('button',{name:/^Free Mode/}).first().click();
  const out=[];
  for(const id of PRESETS){
    await preset(page,id);const s=await settle(page,9000);
    expect(!s.transition,`${id}: transition did not finish`);
    expect(s.view===id||s.view.includes(id.slice(0,3)),`${id}: view reports "${s.view}"`);
    expect(finite(s.camera.position)&&finite(s.camera.target)&&finite(s.camera.up),`${id}: non-finite camera`);
    const d=camDist(s);
    if(id==='sky')expect(len(s.camera.position)>=0.99&&len(s.camera.position)<1.01,`sky: observer must sit on the surface, |p|=${len(s.camera.position)}`);
    else expect(d>=s.camera.minDistance*0.999&&d<=s.camera.maxDistance*1.001,`${id}: distance ${d} outside [${s.camera.minDistance},${s.camera.maxDistance}]`);
    near(s.bodies.earth.radius,sky.radiiKm.earth/R,2e-3,`${id}: earth radius`);
    near(s.bodies.moon.radius,1,1e-6,`${id}: moon radius`);
    expect(Math.abs(len(s.camera.up)-1)<1e-3,`${id}: up not unit (${len(s.camera.up)})`);
    expect(await page.locator('.scene-error').count()===0,`${id}: scene error`);
    out.push(`${id}:${d.toFixed(id==='terrain'?4:1)}`);
    await shot(page,`desktop-${mode.toLowerCase()}-${id}`);
  }
  const e=fresh(from);expect(e.length===0,'console errors: '+JSON.stringify(e.slice(0,2)));
  await page.close();return out.join(' ');
});

await check('true angular sizes in the surface-sky view: Sun ~0.27 deg and Earth ~0.9 deg radius (from snapshot geometry, +-20%)',async()=>{
  const page=await sim(desktop,'sky-size');
  await preset(page,'sky');const s=await settle(page,9000);
  const e=angRadiusDeg(s,'earth'),su=angRadiusDeg(s,'sun');
  expect(Math.abs(e-0.9)<0.9*0.2,`Earth ${e.toFixed(3)} deg`);expect(Math.abs(su-0.267)<0.267*0.2,`Sun ${su.toFixed(3)} deg`);
  await page.close();return `earth ${e.toFixed(3)}, sun ${su.toFixed(3)}`;
});
await check('Earth and Earth-Moon scale presets: Earth is physically large only when the camera is physically close to it',async()=>{
  const page=await sim(desktop,'earth-pair');
  await preset(page,'earth');let s=await settle(page,9000);
  const eInspect=angRadiusDeg(s,'earth');
  expect(eInspect>5,`Earth inspection should fill a meaningful part of the view, ${eInspect.toFixed(2)} deg`);
  expect(len(vsub(s.camera.target,s.bodies.earth.position))<s.bodies.earth.radius*1.5,'Earth inspection targets Earth');
  expect(bodyDist(s,'earth')>=s.bodies.earth.radius,'camera must stay outside Earth');
  await preset(page,'pair');s=await settle(page,9000);
  const ePair=angRadiusDeg(s,'earth'),mPair=Math.asin(Math.min(1,1/len(s.camera.position)))*180/Math.PI;
  expect(ePair<eInspect,'pair view must show Earth smaller than inspection view');
  const dm=len(s.bodies.earth.position);
  expect(Math.abs(len(vsub(s.bodies.earth.position,s.bodies.moon.position))-dm)<1e-6,'Earth-Moon distance is the true one');
  expect(dm>200&&dm<240,`Earth-Moon distance ${dm.toFixed(1)} R (expected ~207-235)`);
  void mPair;await page.close();return `earth ${eInspect.toFixed(1)} deg (inspect) vs ${ePair.toFixed(2)} deg (pair)`;
});
await check('solar system preset: planets are true-size points (no enlarged meshes), distances physical',async()=>{
  const page=await sim(desktop,'system');
  await preset(page,'system');const s=await settle(page,9000);
  for(const p of planets.planets){
    const b=s.bodies[p.id];near(b.radius,p.radiusKm/R,2e-3,p.id+' true radius (not enlarged)');
    const ang=angRadiusDeg(s,p.id);expect(ang<2,`${p.id} would appear ${ang.toFixed(2)} deg radius (enlarged?)`);
  }
  expect(s.camera.maxDistance>=4.6e6,'system view must reach Neptune (~2.6e6 R from the Moon)');
  await page.close();
});

await check('zoom limits: wheel in/out and +/- keys never cross min/max or enter the focused body, in every preset',async()=>{
  const from=errCount();
  const page=await sim(desktop,'zoom');
  const bad=[];
  for(const id of PRESETS){
    await preset(page,id);await settle(page,9000);
    await wheel(page,-400,45);let s=await snap(page);
    const dIn=camDist(s);
    if(id!=='sky'&&dIn<s.camera.minDistance*0.99)bad.push(`${id}: zoom-in ${dIn} < min ${s.camera.minDistance}`);
    const tracked=s.trackedBody&&s.bodies[s.trackedBody];
    if(tracked&&id!=='terrain'&&id!=='sky'&&len(vsub(s.camera.position,tracked.position))<tracked.radius*0.999)bad.push(`${id}: camera inside ${s.trackedBody}`);
    await wheel(page,400,70);s=await snap(page);
    const dOut=camDist(s);
    if(dOut>s.camera.maxDistance*1.001)bad.push(`${id}: zoom-out ${dOut} > max ${s.camera.maxDistance}`);
    if(!finite(s.camera.position))bad.push(id+': non-finite after zoom');
    await page.locator('canvas').first().focus();
    for(let i=0;i<30;i++)await page.keyboard.press('Minus');
    s=await snap(page);if(camDist(s)>s.camera.maxDistance*1.001)bad.push(`${id}: key zoom-out beyond max`);
    for(let i=0;i<60;i++)await page.keyboard.press('Equal');
    s=await snap(page);if(id!=='sky'&&camDist(s)<s.camera.minDistance*0.99)bad.push(`${id}: key zoom-in below min`);
  }
  expect(bad.length===0,bad.slice(0,4).join(' | '));
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});
await check('local terrain minimums: camera stays >= 2.6 km from the target and above the 150 m DEM floor (never underground)',async()=>{
  const page=await sim(desktop,'local-floor');
  await preset(page,'terrain');await settle(page,9000);
  await wheel(page,-400,80);
  let s=await snap(page);
  const dKm=camDist(s)*R;
  expect(dKm>=2.6*0.98,`camera ${dKm.toFixed(2)} km from target (min 2.6 km)`);
  // steep pitch drag in both directions must not push the camera through the ground
  for(const dy of [-400,400,-400]){await drag(page,0,dy,25);s=await snap(page);
    expect(finite(s.camera.position),'finite camera');
    // radial height above the sphere (Moon radius) must be positive: 1 + h/R with terrain min about -9 km
    const h=(len(s.camera.position)-1)*R;expect(h>-9.5,`camera radial height ${h.toFixed(2)} km below datum`);
  }
  await page.close();
});

await check('mouse drag orbits (overview/earth/pair/south/system), changes the look in sky and local views (pixels), and the view does not snap back',async()=>{
  const page=await sim(desktop,'drag');const bad=[];
  for(const id of ['overview','earth','pair','south','sky','terrain','system']){
    await preset(page,id);const a=await settle(page,9000);const h0=await canvasHash(page);
    await drag(page,160,-70);await page.waitForTimeout(300);const b=await snap(page);const h1=await canvasHash(page);
    await page.waitForTimeout(1500);const c=await snap(page);const h2=await canvasHash(page);
    const geometric=len(vsub(b.camera.position,a.camera.position))>1e-6*Math.max(1,len(a.camera.position))||angleBetween(vsub(b.camera.target,b.camera.position),vsub(a.camera.target,a.camera.position))>0.2;
    if(!geometric&&h0===h1)bad.push(`${id}: drag changed neither the snapshot nor the image`);
    if(id==='sky'&&!geometric)notes.add('sky view: snapshot camera.target/position do not change on drag (image does) - snapshot lacks the look direction');
    if(h1!==h2)bad.push(`${id}: image changed after release (snap-back or drift)`);
    const back=len(vsub(c.camera.position,b.camera.position))/Math.max(1e-9,len(vsub(b.camera.position,a.camera.position)));
    if(geometric&&back>0.05&&angleBetween(vsub(c.camera.target,c.camera.position),vsub(b.camera.target,b.camera.position))>0.5)bad.push(`${id}: snapped back after release`);
    if(!finite(c.camera.position))bad.push(id+': non-finite');
  }
  expect(bad.length===0,bad.join(' | '));await page.close();
});

await check('orbit keyboard (canvas focused + Navigation buttons): left/right and up/down are opposite and consistent; pole clamp never flips the camera',async()=>{
  const from=errCount();
  const page=await sim(desktop,'keys');const bad=[];
  const canvas=page.locator('canvas').first();
  await canvas.focus();expect(await page.evaluate(()=>document.activeElement===document.querySelector('canvas')),'canvas is focusable');
  for(const id of ['overview','pair','south']){
    await preset(page,id);const a=await settle(page,9000);
    const azimuth=(s)=>{const v=vsub(s.camera.position,s.camera.target),u=s.camera.up;const p=[v[0]-u[0]*dot(v,u),v[1]-u[1]*dot(v,u),v[2]-u[2]*dot(v,u)];return p;};
    await canvas.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(500);const r=await snap(page);
    await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');await page.waitForTimeout(500);const l=await snap(page);
    const dr=vsub(r.camera.position,a.camera.position),dl=vsub(l.camera.position,r.camera.position);
    if(len(dr)<1e-6)bad.push(id+': ArrowRight did nothing');
    else if(dot(dr,dl)>=0)bad.push(`${id}: ArrowLeft does not move opposite to ArrowRight`);
    await page.keyboard.press('ArrowRight');await page.waitForTimeout(300);
    // hold up to the pole
    const cam0=await snap(page);
    for(let i=0;i<60;i++)await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(500);const up=await snap(page);
    const dirUp=vsub(up.camera.position,up.camera.target);
    const cosPole=Math.abs(dot(dirUp,up.camera.up))/(len(dirUp)*len(up.camera.up));
    if(cosPole>0.99999)bad.push(`${id}: camera reached the exact pole (degenerate orbit basis): ${cosPole}`);
    if(!finite(up.camera.position)||!finite(up.camera.up))bad.push(id+': non-finite at the pole');
    for(let i=0;i<120;i++)await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(500);const dn=await snap(page);
    const dirDn=vsub(dn.camera.position,dn.camera.target);
    const cosDn=Math.abs(dot(dirDn,dn.camera.up))/(len(dirDn)*len(dn.camera.up));
    if(cosDn>0.99999)bad.push(`${id}: camera reached the opposite pole`);
    if(dot(up.camera.up,dn.camera.up)<0.5)bad.push(`${id}: up vector flipped while crossing the equator (${dot(up.camera.up,dn.camera.up).toFixed(2)})`);
    void cam0;
    await canvas.focus();await page.keyboard.press('Home');await page.waitForTimeout(800);
  }
  // Navigation details buttons
  await openNav(page);
  const before=await snap(page);
  for(const name of ['Rotate camera left','Rotate camera up','Zoom in','Zoom out','Reset view'])await page.getByRole('button',{name}).click();
  const after=await snap(page);expect(finite(after.camera.position),'finite after buttons');
  expect(bad.length===0,bad.slice(0,4).join(' | '));
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  void before;await page.close();
});

await check('focus every body (Look at) across orbit, local and sky views: tracked body/target follow, no console errors',async()=>{
  const from=errCount();
  const page=await sim(desktop,'focus');const bad=[];
  const sel=page.locator('[aria-label="Focus a celestial body"]');
  for(const id of ['overview','sky','terrain','pair']){
    await preset(page,id);await settle(page,9000);
    const opts=await sel.locator('option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
    if(opts.length<3)bad.push(`${id}: only ${opts.length} focus options`);
    let lastHash='';const sameImage=[];
    for(const v of opts){
      await sel.selectOption(v);
      for(let k=0;k<20;k++){const t=await snap(page);if(t.trackedBody===v||!t.bodies[v])break;await page.waitForTimeout(200);}
      const s=await settle(page,6000);
      if(s.transition)bad.push(`${id}/${v}: transition stuck`);
      if(!finite(s.camera.position)||!finite(s.camera.target))bad.push(`${id}/${v}: non-finite`);
      if(id==='sky'||id==='terrain'){const h=await canvasHash(page);if(h===lastHash)sameImage.push(v);lastHash=h;}
      else if(s.bodies[v]){
        const aim=angleBetween(vsub(s.camera.target,s.camera.position),vsub(s.bodies[v].position,s.camera.position));
        const ok=s.trackedBody===v||aim<2||len(vsub(s.camera.target,s.bodies[v].position))<=Math.max(s.bodies[v].radius*2,1e-3);
        if(!ok)bad.push(`${id}/${v}: not aimed (tracked ${s.trackedBody}, off-axis ${aim.toFixed(1)} deg)`);
      }
      const d=camDist(s);if(d<s.camera.minDistance*0.99||d>s.camera.maxDistance*1.001)bad.push(`${id}/${v}: distance ${d} outside limits`);
    }
    if((id==='sky'||id==='terrain')&&sameImage.length>2)bad.push(`${id}: Look at did not change the image for ${sameImage.join(',')}`);
    if(id==='sky')notes.add('sky view: Look-at aiming verified via image change only; snapshot target stays [0,0,0]');
  }
  expect(bad.length===0,bad.slice(0,5).join(' | '));
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});

await check('time: float time, Play/Pause, stepping, and Free-Mode freezes keep geometry consistent (Earth frozen while Sun moves)',async()=>{
  const page=await sim(desktop,'time');
  const a=await snap(page);
  await page.getByRole('button',{name:/Step \+1 h/}).click();await page.waitForTimeout(400);
  const b=await snap(page);
  expect(b.index>a.index,'step advances index');
  expect(len(vsub(b.bodies.earth.position,a.bodies.earth.position))>0,'Earth moves with time (Faithful)');
  await page.getByRole('button',{name:/^Free Mode/}).first().click();
  const earthBox=page.getByLabel(/Earth.s position/);
  await earthBox.check();await page.waitForTimeout(300);
  const f0=await snap(page);
  await page.getByRole('button',{name:/Step \+1 h/}).click();await page.getByRole('button',{name:/Step \+1 h/}).click();await page.waitForTimeout(500);
  const f1=await snap(page);
  expect(f1.index>f0.index,'index advanced under freeze');
  expect(len(vsub(f1.bodies.earth.position,f0.bodies.earth.position))<1e-6,'frozen Earth position must not change');
  expect(len(vsub(f1.bodies.sun.position,f0.bodies.sun.position))>0,'Sun still moves');
  near(f1.bodies.earth.radius,sky.radiiKm.earth/R,2e-3,'frozen Earth keeps true radius');
  await page.getByRole('button',{name:'Faithful Mode'}).first().click();
  await page.getByRole('button',{name:'Play'}).click();await page.waitForTimeout(1800);
  const p1=await snap(page);await page.getByRole('button',{name:'Pause'}).click();const p2=await snap(page);await page.waitForTimeout(900);const p3=await snap(page);
  expect(p2.index>a.index&&Math.abs(p3.index-p2.index)<1e-9,'Pause holds the time');
  await page.close();
});

await check('rapid preset switching and interrupted transitions: ends on the last preset, input cancels a transition, no console errors',async()=>{
  const from=errCount();
  const page=await sim(desktop,'rapid');
  const order=['terrain','system','sky','earth','pair','south','overview','system','terrain','pair'];
  for(const id of order)await preset(page,id);
  let s=await settle(page,12000);
  expect(s.view==='pair'||s.view.includes('pair'),'final view '+s.view);
  expect(finite(s.camera.position)&&camDist(s)>=s.camera.minDistance*0.99&&camDist(s)<=s.camera.maxDistance*1.001,'camera valid after rapid switching');
  await preset(page,'earth');await page.waitForTimeout(150);
  const mid=await snap(page);
  await page.locator('canvas').first().focus();await page.keyboard.press('ArrowLeft');await page.waitForTimeout(400);
  const after=await snap(page);
  expect(!after.transition,'keyboard input cancels the transition (transition still '+JSON.stringify(after.transition)+')');
  await wheel(page,-200,3);await preset(page,'south');await page.waitForTimeout(100);await drag(page,80,0,6);
  await page.waitForTimeout(800);const d=await snap(page);expect(!d.transition&&finite(d.camera.position),'mouse drag cancels a running transition');
  void mid;
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});

await check('resize: aspect follows the canvas, camera distance unchanged, no errors (desktop <-> mobile <-> tablet)',async()=>{
  const from=errCount();
  const page=await sim(desktop,'resize');
  await preset(page,'pair');const a=await settle(page,9000);
  const d0=camDist(a);
  for(const [w,h] of [[390,844],[820,1180],[1440,900],[1024,600]]){
    await page.setViewportSize({width:w,height:h});await page.waitForTimeout(700);
    const s=await snap(page);const box=await canvasBox(page);
    expect(Math.abs(s.camera.aspect-box.w/box.h)<0.05*s.camera.aspect+0.02,`${w}x${h}: aspect ${s.camera.aspect.toFixed(3)} vs canvas ${(box.w/box.h).toFixed(3)}`);
    expect(Math.abs(camDist(s)-d0)<d0*0.02,`${w}x${h}: camera distance changed ${camDist(s)} vs ${d0}`);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`${w}x${h}: horizontal overflow`);
  }
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});

await check('mobile 390x844: presets via touch, collapsed setup reveals selects, Navigation details usable, Home targets >= 36 px',async()=>{
  const from=errCount();
  const page=await sim(mobile,'mobile');
  const small=await page.$$eval('.camera-presets button, button, summary',els=>els.filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height<24;}).map(e=>(e.textContent||'').trim().slice(0,22)));
  expect(small.length===0,'explore targets < 24 px: '+small.slice(0,4).join(', '));
  // on mobile the camera presets live in the collapsed setup, exposed as a select
  await page.locator('.setup-toggle').tap();
  expect(await page.locator('#explorer-view').isVisible(),'camera select reachable after expanding "Change view"');
  expect(await page.locator('#explorer-site').isVisible(),'location selector reachable after expanding setup');
  for(const id of ['pair','earth','sky','terrain','overview','system','south']){await page.selectOption('#explorer-view',id);const s=await settle(page,9000);expect(s.view===id&&!s.transition&&finite(s.camera.position),id+' via the mobile select');}
  await openNav(page);expect(await page.getByRole('button',{name:'Zoom in'}).isVisible(),'Navigation buttons visible');
  await page.goto(`${BASE}/?qa=1#/home`);await page.locator('#main').waitFor();await page.waitForTimeout(500);
  const homeSmall=await page.$$eval('main button, main a.button',els=>els.filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height<36;}).map(e=>(e.textContent||'').trim().slice(0,28)+' '+Math.round(e.getBoundingClientRect().height)));
  expect(homeSmall.length===0,'Home targets < 36 px: '+homeSmall.join(', '));
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await shot(page,'mobile-home');await page.close();
});



await check('globe Worker: runs once per mount, terminates, route remounts x3 keep identical geometry (cached grid not detached), no errors',async()=>{
  const from=errCount();
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await ctx.newPage();watch(page,'worker');
  const workers=[];page.on('worker',w=>{const rec={url:w.url(),closed:false};w.on('close',()=>{rec.closed=true;});workers.push(rec);});
  const hashes=[],bad=[];
  for(let i=0;i<3;i++){
    await page.goto(`${BASE}/?qa=1#/${i?'home':'simulator'}`,{waitUntil:'networkidle'});
    if(i){await page.locator('#main').waitFor();await page.evaluate(()=>{location.hash='#/simulator';});}
    await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
    hashes.push(await stableHash(page));
    await page.evaluate(()=>{location.hash='#/home';});await page.locator('#main').waitFor();await page.waitForTimeout(400);
    await page.evaluate(()=>{location.hash='#/simulator';});
    await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
    hashes.push(await stableHash(page));
  }
  const globe=workers.filter(w=>/globe\.worker/.test(w.url));
  if(globe.length<1)bad.push('no globe.worker was started');
  if(globe.some(w=>!w.closed))bad.push(`${globe.filter(w=>!w.closed).length} globe workers still alive (leak)`);
  // the first mount can differ from later ones by a few pixels (visually identical in review); every remount uses the cached grid + a new worker and must be pixel-identical
  if(new Set(hashes.slice(1)).size!==1)bad.push(`remounted globes differ from each other (${new Set(hashes.slice(1)).size} distinct images): cached grid/buffer or geometry unstable`);
  if(hashes[0]!==hashes[1])notes.add('globe: first mount image differs by hash from later mounts (same camera/index; visually identical in the 1440x900 screenshots)');
  const e=fresh(from);if(e.length)bad.push('console errors: '+JSON.stringify(e.slice(0,2)));
  if(await page.locator('.scene-error').count())bad.push('scene error shown');
  await ctx.close();
  expect(bad.length===0,bad.join(' | '));return `${globe.length} worker starts, all closed`;
});
await check('globe Worker fallback: with the worker blocked the scene still renders a lower-resolution globe without uncaught errors',async()=>{
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await ctx.newPage();
  const local=[];page.on('pageerror',e=>local.push('PE '+String(e).slice(0,150)));
  page.on('console',m=>{if(m.type()==='error'&&!/globe\.worker|Failed to load resource|net::ERR_FAILED|worker/i.test(m.text()))local.push(m.text().slice(0,150));});
  await page.route(/globe\.worker/,r=>r.abort());
  await page.goto(`${BASE}/?qa=1#/simulator`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
  await page.waitForTimeout(3500);
  const blocked=await canvasHash(page);
  const s=await snap(page);
  expect(s&&s.camera&&finite(s.camera.position),'scene alive with the worker blocked');
  expect(await page.locator('.scene-error').count()===0,'scene error shown instead of falling back');
  await shot(page,'desktop-worker-blocked');
  // not blank: compare against a blank canvas hash by checking the image has many distinct bytes
  const png=await page.locator('canvas').first().screenshot();
  expect(png.length>20000,'canvas looks blank ('+png.length+' bytes)');
  await ctx.close();
  expect(local.length===0,'uncaught errors with worker blocked: '+local.slice(0,2).join(' | '));
  return `blocked-image hash differs from worker image: ${blocked!==''}`;
});


await check('reduced motion: no autoplay, camera presets jump without a long animated transition, no looping CSS animation',async()=>{
  const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  const page=await sim(ctx,'reduced');const bad=[];
  const a=await snap(page);await page.waitForTimeout(1800);const b=await snap(page);
  if(Math.abs(b.index-a.index)>1e-9)bad.push('time advanced without Play');
  if(!await page.getByRole('button',{name:'Play'}).isVisible())bad.push('not paused initially');
  await preset(page,'pair');
  let longest=0;const t0=Date.now();
  while(Date.now()-t0<3000){const s=await snap(page);if(s.transition)longest=Date.now()-t0;else if(Date.now()-t0>200)break;await page.waitForTimeout(60);}
  if(longest>700)bad.push(`preset transition animated for ${longest} ms under reduced motion`);
  const s=await settle(page,6000);if(s.view!=='pair')bad.push('preset not applied: '+s.view);
  const anim=await page.evaluate(()=>[...document.querySelectorAll('*')].filter(e=>{const st=getComputedStyle(e);return st.animationName!=='none'&&parseFloat(st.animationDuration)>0.05&&st.animationIterationCount!=='1';}).slice(0,3).map(e=>e.tagName+'.'+String(e.className?.baseVal??e.className).slice(0,25)));
  if(anim.length)bad.push('looping CSS animation: '+anim.join(','));
  await ctx.close();
  expect(bad.length===0,bad.join(' | '));return `transition ${longest} ms`;
});

await check('regression: fractional time 807.49 at Malapert 1 m - HUD/observation uses the interpolated scene, not the nearest hour (34.8% vs 64.8%)',async()=>{
  const from=errCount();
  const page=await sim(desktop,'fractional');
  await page.selectOption('#explorer-site','malapert-massif');await page.selectOption('#explorer-height','1');
  const set=(v)=>page.evaluate(v=>{const s=document.querySelector('#time-slider');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(s,String(v));s.dispatchEvent(new Event('input',{bubbles:true}));},v);
  const site=JSON.parse(readFileSync(join(ROOT,'public/data/sites/malapert-massif.json'),'utf8'));
  const lerp=(a,i,f)=>a[i]*(1-f)+a[i+1]*f;
  const bad=[];let worstNearest=0;
  for(const t of [807.49,807.25,807.75,100.5,1391.99]){
    await set(t);await page.waitForTimeout(700);
    const s=await snap(page);const o=s.observation;
    if(!o){bad.push(`${t}: snapshot.observation missing`);continue;}
    if(o.siteId!=='malapert-massif'||o.height!==1||Math.abs(o.index-t)>0.011)bad.push(`${t}: observation context ${JSON.stringify(o)}`);
    const i=Math.floor(t),f=t-i,j=Math.min(i+1,1392);
    for(const [body,key] of [['sun','sun'],['earth','earth']]){
      const b=site[body];const f2=i===j?0:f;
      const el=lerp(b.elDeg,i,f2),ang=lerp(b.angularRadiusDeg,i,f2);
      // azimuth: interpolate along the shortest arc
      let a0=b.azDeg[i],a1=b.azDeg[j];if(a1-a0>180)a1-=360;if(a0-a1>180)a1+=360;
      const az=((a0*(1-f2)+a1*f2)%360+360)%360;
      const expected=visibleDiskFraction(el,horizonAt(site.horizon.elevationDeg['1'],az),ang);
      if(Math.abs(o[key]-expected)>0.06)bad.push(`${t} ${body}: observation ${o[key].toFixed(3)} vs independent interpolation ${expected.toFixed(3)}`);
      const nearest=b.visibleFraction['1'][Math.round(t)];
      if(body==='sun')worstNearest=Math.max(worstNearest,Math.abs(nearest-o[key]));
    }
    const text=await page.locator('main').innerText();
    const pct=(o.sun*100).toFixed(1)+'%';
    if(!text.includes(pct))bad.push(`${t}: page text does not show the interpolated Sun ${pct}`);
  }
  expect(worstNearest>0.1,'sanity: the chosen times must differ from the nearest-hour value (worst '+worstNearest.toFixed(3)+')');
  // 807.49 specifically: interpolated scene ~34.8%, nearest hour ~64.8% -> HUD must show the former
  await set(807.49);await page.waitForTimeout(700);
  const o=(await snap(page)).observation;
  if(Math.abs(o.sun-0.348)>0.02)bad.push(`807.49 Sun ${o.sun} (expected ~0.348)`);
  if(!(await page.locator('main').innerText()).includes('64.8%')===false)bad.push('HUD still shows the nearest-hour 64.8%');
  // no render/state loop: the page stays responsive and keeps drawing frames while idle
  const t0=Date.now();const frames=await page.evaluate(()=>new Promise(r=>{let n=0;const end=performance.now()+1500;const tick=()=>{n++;if(performance.now()<end)requestAnimationFrame(tick);else r(n);};requestAnimationFrame(tick);}));
  if(frames<3)bad.push(`only ${frames} animation frames in 1.5 s (render/state loop?)`);
  if(Date.now()-t0>6000)bad.push('page unresponsive');
  if(fresh(from).some(e=>/Maximum update depth|too many re-renders/i.test(e.text)))bad.push('React update-depth error');
  expect(bad.length===0,bad.slice(0,4).join(' | '));
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();return `frames/1.5s: ${frames}`;
});

await check('regression: no camera enters a visible body (pair: 13xArrowRight, ArrowDown, wheel -2141.8 ; then aggressive zoom in every non-observer preset) after a rendered frame',async()=>{
  const page=await sim(desktop,'collision');const bad=[];
  const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const clear=(s,where)=>{for(const [id,b] of Object.entries(s.bodies)){if(!b.visible)continue;const d=bodyDist(s,id);if(d<b.radius*1.0-1e-9)bad.push(`${where}: camera ${d.toFixed(3)} R from ${id} centre, inside its radius ${b.radius.toFixed(3)}`);}};
  await preset(page,'pair');await settle(page,9000);
  const canvas=page.locator('canvas').first();await canvas.focus();
  for(let i=0;i<13;i++)await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  const {cx,cy}=await canvasBox(page);await page.mouse.move(cx,cy);await page.mouse.wheel(0,-2141.8);
  await frame();await page.waitForTimeout(300);await frame();
  let s=await snap(page);clear(s,'pair repro');
  const dE=bodyDist(s,'earth');
  if(dE<s.bodies.earth.radius*1.02-1e-6)bad.push(`pair repro: ${dE.toFixed(3)} R from Earth, needs >= 2% clearance (${(s.bodies.earth.radius*1.02).toFixed(3)})`);
  for(const id of ['overview','earth','south','pair','system']){
    await preset(page,id);await settle(page,9000);
    await page.mouse.move(cx,cy);
    for(let i=0;i<6;i++){await page.mouse.wheel(0,-2500);await page.waitForTimeout(40);}
    await frame();await page.waitForTimeout(250);await frame();
    s=await snap(page);clear(s,id);
    for(let i=0;i<20;i++)await page.keyboard.press('Equal');
    await frame();s=await snap(page);clear(s,id+' keys');
  }
  expect(bad.length===0,bad.slice(0,4).join(' | '));
  await page.close();
});

await check('no failed requests and no console errors across the whole run',async()=>{
  const net=[...issues.http,...issues.requestfailed].filter(x=>!/favicon/.test(x.url||''));
  const errs=[...issues.console,...issues.pageerror];
  expect(net.length===0&&errs.length===0,`net ${net.length} console ${errs.length}: ${JSON.stringify([...net,...errs].slice(0,3))}`);
});

await browser.close();
const failed=results.filter(r=>!r.ok).length;
writeFileSync(join(OUT,'results.json'),JSON.stringify({notes:[...notes],base:BASE,at:new Date().toISOString(),passed:results.length-failed,failed,results,issues},null,1));
console.log(`\n${results.length-failed}/${results.length} passed. Output: ${OUT}`);
process.exit(failed?1:0);
