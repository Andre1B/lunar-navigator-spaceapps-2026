// Independent checks of the published dataset in public/data (schema, units, physical consistency).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {visibleDiskFraction,horizonAt,runs} from '../src/lib/analysis.mjs';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const DATA=join(ROOT,'public','data');
const load=(f)=>JSON.parse(readFileSync(join(DATA,f),'utf8'));
const manifest=load('manifest.json');
const sky=load('sky.json');
const validation=load('validation.json');
const SITE_IDS=['connecting-ridge','shackleton-rim','nobile-rim-1','malapert-massif'];
const sites=Object.fromEntries(manifest.sites.map(s=>[s.id,load(s.file)]));
const N=1393,H=['1','5'];
const finite=(a)=>a.every(Number.isFinite);
const inRange=(a,lo,hi)=>a.every(v=>v>=lo&&v<=hi);

test('manifest period, step and sample count agree (58 days hourly, 1393 samples)',()=>{
  const p=manifest.period;
  assert.equal(p.sampleCount,N);
  assert.equal(p.stepMinutes,60);
  assert.equal(Date.parse(p.endUtc)-Date.parse(p.startUtc),(N-1)*p.stepMinutes*60000);
  assert.equal(p.startUtc,'2027-03-01T00:00:00Z');
  assert.deepEqual(sky.period,p);
  assert.deepEqual(manifest.observerHeightsM,[1,5]);
});

test('manifest declares exactly the 4 expected sites with sane coordinates and no landing-site claim',()=>{
  assert.deepEqual(manifest.sites.map(s=>s.id).sort(),[...SITE_IDS].sort());
  for(const s of manifest.sites){
    assert.ok(s.latitudeDeg<-85&&s.latitudeDeg>=-90,`${s.id} lat`);
    assert.ok(s.longitudeEastDeg>=0&&s.longitudeEastDeg<360,`${s.id} lon`);
    assert.equal(s.notALandingSite,true);
    assert.ok(s.coordinateSource&&s.coordinateSource.length>20,`${s.id} coordinate source`);
    assert.ok(existsSync(join(DATA,s.file)));
    // polar stereographic radius must be consistent with latitude: rho = 2R tan((90-|lat|)/2)
    const [x,y]=s.polarStereoXYM;const rho=Math.hypot(x,y);
    const expected=2*1737400*Math.tan((90-Math.abs(s.latitudeDeg))*Math.PI/360);
    assert.ok(Math.abs(rho-expected)/expected<0.01,`${s.id} stereographic radius ${rho} vs ${expected}`);
    // longitude: 0 -> +Y, 90E -> +X  =>  lon = atan2(x,y)
    let lon=Math.atan2(x,y)*180/Math.PI;if(lon<0)lon+=360;
    const dl=Math.abs(((lon-s.longitudeEastDeg+540)%360)-180);
    assert.ok(dl<0.5,`${s.id} longitude ${lon} vs ${s.longitudeEastDeg}`);
  }
});

test('manifest has conventions, provenance and disclosures required by the project',()=>{
  for(const k of ['azimuth','elevation','longitude','frame','time','visibleFraction','censored'])assert.ok(manifest.conventions[k],`convention ${k}`);
  assert.match(manifest.conventions.azimuth,/clockwise from local north/);
  assert.match(manifest.conventions.longitude,/east/);
  assert.ok(manifest.provenance.kernels.length>=5);
  for(const k of manifest.provenance.kernels)assert.match(k.sha256,/^[0-9a-f]{64}$/,k.file);
  assert.equal(manifest.provenance.dems.length,6);
  for(const d of manifest.provenance.dems){assert.match(d.sha256,/^[0-9a-f]{64}$/,d.file);assert.match(d.url,/^https:\/\//);}
  assert.ok(manifest.provenance.references.length>=3);
  assert.match(manifest.aiDisclosure,/AI/);
  assert.ok(manifest.limitations.some(l=>/not NASA-selected/i.test(l)));
  assert.ok(manifest.limitations.some(l=>/communications|DSN/i.test(l)));
  assert.ok(manifest.assumptions.some(a=>/line of sight/i.test(a)),'Earth visibility is not communications');
  for(const w of [/(NASA|agency)[- ](approved|endorsed|certified)/i,/safe to land/i])
    assert.ok(!w.test(JSON.stringify(manifest)),`manifest must not claim ${w}`);
});

for(const id of SITE_IDS){
  test(`site ${id}: array lengths, finiteness and value ranges`,()=>{
    const d=sites[id];
    assert.equal(d.siteId,id);
    for(const body of ['sun','earth']){
      for(const k of ['azDeg','elDeg','angularRadiusDeg','rangeKm'])assert.equal(d[body][k].length,N,`${body}.${k}`),assert.ok(finite(d[body][k]),`${body}.${k} finite`);
      assert.ok(inRange(d[body].azDeg,0,360),`${body} az in [0,360]`);
      assert.ok(inRange(d[body].elDeg,-90,90));
      for(const h of H){
        const f=d[body].visibleFraction[h];
        assert.equal(f.length,N);assert.ok(finite(f));assert.ok(inRange(f,0,1),`${body} fraction ${h} m in [0,1]`);
      }
    }
    // physical sanity: Sun ~1 AU, angular radius ~0.267-0.275 deg; Earth 356-407 Mm, radius ~0.88-1.0 deg
    assert.ok(inRange(d.sun.rangeKm,1.45e8,1.55e8));
    assert.ok(inRange(d.sun.angularRadiusDeg,0.26,0.28));
    assert.ok(inRange(d.earth.rangeKm,356000,407000));
    assert.ok(inRange(d.earth.angularRadiusDeg,0.85,1.05));
    // angular radius = asin(R/range)
    for(const i of [0,500,1392]){
      assert.ok(Math.abs(Math.asin(696000/d.sun.rangeKm[i])*180/Math.PI-d.sun.angularRadiusDeg[i])<2e-4,'sun radius vs range');
      assert.ok(Math.abs(Math.asin(6378.137/d.earth.rangeKm[i])*180/Math.PI-d.earth.angularRadiusDeg[i])<2e-4,'earth radius vs range');
    }
  });

  test(`site ${id}: horizon has 720 azimuths at 0.5 deg for 1 m and 5 m, 5 m horizon not above 1 m`,()=>{
    const hz=sites[id].horizon;
    assert.equal(hz.azimuthStepDeg,0.5);
    assert.equal(hz.azimuthDeg0,0);
    for(const h of H){assert.equal(hz.elevationDeg[h].length,720);assert.ok(finite(hz.elevationDeg[h]));assert.ok(inRange(hz.elevationDeg[h],-30,30),`${h} m horizon range`);}
    // A taller observer cannot see a higher (blocking) horizon: 5 m <= 1 m (+ rounding 0.0005)
    for(let i=0;i<720;i++)assert.ok(hz.elevationDeg['5'][i]<=hz.elevationDeg['1'][i]+5e-4,`az index ${i}`);
    assert.ok(hz.minReachKm>300,'sight lines reach beyond 300 km (V3 convergence)');
  });

  test(`site ${id}: taller observer never sees less of the Sun or Earth`,()=>{
    for(const body of ['sun','earth']){
      const a=sites[id][body].visibleFraction['1'],b=sites[id][body].visibleFraction['5'];
      for(let i=0;i<N;i++)assert.ok(b[i]>=a[i]-2e-3,`${body} sample ${i}: 5 m ${b[i]} < 1 m ${a[i]}`);
    }
  });

  test(`site ${id}: stored visibleFraction matches disk geometry recomputed from elevation, horizon and radius`,()=>{
    const d=sites[id];
    for(const body of ['sun','earth'])for(const h of H){
      let worst=0;
      for(let i=0;i<N;i++){
        const f=visibleDiskFraction(d[body].elDeg[i],horizonAt(d.horizon.elevationDeg[h],d[body].azDeg[i]),d[body].angularRadiusDeg[i]);
        worst=Math.max(worst,Math.abs(f-d[body].visibleFraction[h][i]));
      }
      assert.ok(worst<0.01,`${body} ${h} m worst difference ${worst}`);
    }
  });

  test(`site ${id}: events are inside the period, typed, sorted and alternate sunrise/sunset`,()=>{
    const d=sites[id];const t0=Date.parse(manifest.period.startUtc),t1=Date.parse(manifest.period.endUtc);
    assert.ok(d.events.length>0);
    for(const e of d.events){
      assert.ok(['sunrise','sunset','earthrise','earthset'].includes(e.type),e.type);
      assert.ok([1,5].includes(e.heightM));
      assert.match(e.utc,/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
      const t=Date.parse(e.utc);assert.ok(t>=t0&&t<=t1,`${e.type} ${e.utc} outside period`);
      assert.ok(e.resolutionMin>0&&e.resolutionMin<=5);
    }
    const key=(e)=>e.heightM+e.utc;
    const sorted=[...d.events].sort((a,b)=>a.heightM-b.heightM||(a.utc<b.utc?-1:a.utc>b.utc?1:0));
    assert.deepEqual(d.events.map(key),sorted.map(key),'sorted by height then time');
    for(const h of [1,5])for(const [rise,set] of [['sunrise','sunset'],['earthrise','earthset']]){
      const seq=d.events.filter(e=>e.heightM===h&&(e.type===rise||e.type===set)).map(e=>e.type);
      for(let i=1;i<seq.length;i++)assert.notEqual(seq[i],seq[i-1],`${h} m ${rise}/${set} must alternate`);
    }
  });

  test(`site ${id}: each event coincides with a transition of the hourly visible fraction`,()=>{
    const d=sites[id];const t0=Date.parse(manifest.period.startUtc);
    for(const e of d.events){
      const body=e.type.startsWith('sun')?'sun':'earth';const rising=/rise$/.test(e.type);
      const f=d[body].visibleFraction[String(e.heightM)];
      const x=(Date.parse(e.utc)-t0)/3600000;const lo=Math.floor(x),hi=Math.ceil(x);
      // The hourly series cannot resolve sub-hour blips, but it must never contradict the event:
      // before a rise (sample at floor(t)) and after a set (sample at ceil(t)) the body is not visible.
      if(rising)assert.equal(f[lo],0,`${e.type} ${e.utc} h=${e.heightM}: already visible before the event`);
      else assert.equal(f[hi],0,`${e.type} ${e.utc} h=${e.heightM}: still visible after the event`);
    }
  });

  test(`site ${id}: metrics keys, ranges and agreement with the hourly series`,()=>{
    const d=sites[id];
    for(const h of H){
      const m=d.metrics[h];
      for(const k of ['meanSunVisibleFraction','sunlitTimeFraction','earthVisibleTimeFraction'])assert.ok(m[k]>=0&&m[k]<=1,k);
      for(const k of ['longestSunlitH','longestNoDirectSunH','longestNoEarthH'])assert.ok(m[k]>=0&&m[k]<=(N-1),k);
      for(const k of ['longestSunlitCensored','longestNoDirectSunCensored','longestNoEarthCensored'])assert.equal(typeof m[k],'boolean',k);
      assert.equal(m.durationResolutionMin,5);
      // mean sun fraction >= sunlit-time fraction * (small), and mean <= sunlit fraction (fraction<=1)
      assert.ok(m.meanSunVisibleFraction<=m.sunlitTimeFraction+0.005);
      // independent recomputation from the hourly series (5-min internal grid differs slightly)
      const sun=d.sun.visibleFraction[h],earth=d.earth.visibleFraction[h];
      const mean=sun.reduce((s,v)=>s+v,0)/N;
      assert.ok(Math.abs(mean-m.meanSunVisibleFraction)<0.02,`mean sun ${mean} vs ${m.meanSunVisibleFraction}`);
      assert.ok(Math.abs(sun.filter(v=>v>0).length/N-m.sunlitTimeFraction)<0.03);
      assert.ok(Math.abs(earth.filter(v=>v>0).length/N-m.earthVisibleTimeFraction)<0.03);
      const longest=(arr,pred)=>Math.max(0,...runs(arr,pred,1).map(r=>r.hours));
      assert.ok(Math.abs(longest(sun,v=>v<=0)-m.longestNoDirectSunH)<=6,'longest dark (hourly grid can bridge sub-hour sunlit blips)');
      assert.ok(Math.abs(longest(earth,v=>v<=0)-m.longestNoEarthH)<=3,'longest no-Earth');
      assert.ok(Math.abs(longest(sun,v=>v>0)-m.longestSunlitH)<=3,'longest sunlit');
    }
    assert.ok(Array.isArray(d.eclipses));
  });
}

test('sites are not interchangeable: different horizons and different series',()=>{
  const sig=SITE_IDS.map(id=>sites[id].horizon.elevationDeg['1'].slice(0,50).join());
  assert.equal(new Set(sig).size,4);
  const s2=SITE_IDS.map(id=>sites[id].metrics['1'].meanSunVisibleFraction);
  assert.ok(new Set(s2).size>=3);
});

test('sky.json: time-aligned arrays, unit quaternions and expected radii',()=>{
  for(const k of ['sunPosKm','earthPosKm','moonOrientationQuat','earthOrientationQuat'])assert.equal(sky[k].length,N,k);
  for(const q of [...sky.moonOrientationQuat,...sky.earthOrientationQuat]){
    assert.equal(q.length,4);assert.ok(Math.abs(Math.hypot(...q)-1)<1e-5,`quat norm ${Math.hypot(...q)}`);
  }
  sky.sunPosKm.forEach(v=>{const r=Math.hypot(...v);assert.ok(r>1.45e8&&r<1.55e8,'sun distance');});
  sky.earthPosKm.forEach(v=>{const r=Math.hypot(...v);assert.ok(r>356000&&r<407000,'earth distance');});
  assert.deepEqual(sky.radiiKm,{sun:696000,earth:6378.137,moon:1737.4});
  assert.match(sky.quaternionConvention,/w,x,y,z/);
  // sky ranges must agree with per-site ranges to within the moon radius (observer on the surface)
  for(const i of [0,700,1392]){
    const r=Math.hypot(...sky.earthPosKm[i]);
    assert.ok(Math.abs(r-sites['connecting-ridge'].earth.rangeKm[i])<2100,`earth range ${i}`);
  }
  // time continuity: the Sun direction rotates slowly (<1 deg/hour in J2000) for the whole window
  for(let i=1;i<N;i++){
    const a=sky.sunPosKm[i-1],b=sky.sunPosKm[i];
    const c=(a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/(Math.hypot(...a)*Math.hypot(...b));
    assert.ok(Math.acos(Math.min(1,c))*180/Math.PI<0.1,`sun jump at ${i}`);
  }
});

test('validation.json: schema, allowed statuses and evidence for every test',()=>{
  const ids=validation.tests.map(t=>t.id);
  assert.deepEqual(ids,['V1','V2','V3','V4','V4b','V5']);
  const allowed=['pass','fail','pending','info'];
  for(const t of validation.tests){
    for(const k of ['id','title','method','metric','target','result','status','evidence','notes'])assert.ok(k in t,`${t.id} missing ${k}`);
    assert.ok(allowed.includes(t.status),`${t.id} status ${t.status}`);
    assert.ok(t.method&&t.metric&&t.target,`${t.id} method/metric/target`);
    if(t.status==='pass'||t.status==='fail'){
      assert.ok(t.result!==null,`${t.id} ${t.status} without a result`);
      assert.ok(t.evidence&&t.evidence.length>5,`${t.id} needs evidence`);
    }
    if(t.status==='pending')assert.equal(t.result,null,`${t.id} pending must have no result`);
  }
  assert.ok(validation.tests.find(t=>t.id==='V4b').status==='info');
});

test('manifest.validation summary mirrors validation.json and status is derived honestly',()=>{
  assert.equal(manifest.validation.file,'validation.json');
  const summary=Object.fromEntries(validation.tests.map(t=>[t.id,t.status]));
  assert.deepEqual(manifest.validation.summary,summary);
  const real=validation.tests.filter(t=>t.status!=='info').map(t=>t.status);
  const expected=real.includes('fail')?'failed':real.every(s=>s==='pending')?'pending':real.includes('pending')?'partial':'done';
  assert.equal(manifest.validation.status,expected);
});

test('validation results satisfy their own stated targets (re-checked independently)',()=>{
  const t=Object.fromEntries(validation.tests.map(x=>[x.id,x]));
  if(t.V1.status==='pass'){assert.ok(t.V1.result.p95Deg<0.01);assert.ok(t.V1.result.n>=40);assert.equal(t.V1.result.perSiteBody.length,8);}
  if(t.V2.status==='pass')for(const r of t.V2.result){assert.ok(Math.abs(r.medianDiffM)<2,r.site);assert.deepEqual(r.bestShiftM,[0,0]);assert.ok(r.n>1000);}
  if(t.V3.status==='pass'){assert.equal(t.V3.result.length,4);for(const r of t.V3.result)assert.ok(r.maxAbsDiffDeg<0.01,r.site);}
  if(t.V4.status==='pass')for(const r of t.V4.result)assert.ok(r.meanVisibleFraction2024to2026At1m>0.7,r.site);
  if(t.V5.status==='pass'){
    for(const r of t.V5.result){
      if('horizon5mNotAbove1m' in r)assert.equal(r.horizon5mNotAbove1m,true);
      if(r.psrPixel)assert.equal(r.psrPixel.maxSunFraction2024to2026,0);
    }
    assert.ok(t.V5.result.some(r=>r.psrPixel),'PSR pixel test present');
  }
});

test('V4b is context only and does not feed pass/fail',()=>{
  const v=validation.tests.find(t=>t.id==='V4b');
  assert.equal(v.status,'info');
  assert.match(v.target,/qualitative/i);
});

test('validation evidence references code that exists in scientific/validate.py',()=>{
  const code=readFileSync(join(ROOT,'scientific','validate.py'),'utf8');
  for(const t of validation.tests){
    const m=/validate\.py (v\w+)/.exec(t.evidence);
    if(m)assert.ok(code.includes(`def ${m[1]}(`),`${t.id} evidence names missing function ${m[1]}`);
  }
});
