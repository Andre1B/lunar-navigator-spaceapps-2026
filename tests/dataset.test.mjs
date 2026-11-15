// Independent checks of the published dataset in public/data (schema, units, physical consistency).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {visibleDiskFraction,horizonAt,runs} from '../src/lib/analysis.mjs';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const DATA=join(ROOT,'public','data');
const load=(f)=>JSON.parse(readFileSync(join(DATA,f),'utf8'));
const manifest=load('manifest.json');
const sky=load('sky.json');
const validation=load('validation.json');
const integrity=load('integrity.json');
const terrain=load('terrain/terrain.json');
const ORIGINAL_SITE_IDS=['connecting-ridge','shackleton-rim','nobile-rim-1','malapert-massif'];
const NEIGHBOR_SITE_IDS=['connecting-neighbor','shackleton-neighbor'];
const SITE_IDS=[...ORIGINAL_SITE_IDS,...NEIGHBOR_SITE_IDS];
const sites=Object.fromEntries(manifest.sites.map(s=>[s.id,load(s.file)]));
const N=manifest.period.sampleCount,H=manifest.observerHeightsM.map(String);
const addUtcCalendarYearsClamped=(isoDate,years)=>{
  const [year,month,day]=isoDate.split('-').map(Number);
  const targetYear=year+years,monthIndex=month-1;
  const finalDay=new Date(Date.UTC(targetYear,monthIndex+1,0)).getUTCDate();
  return new Date(Date.UTC(targetYear,monthIndex,Math.min(day,finalDay))).toISOString().slice(0,10);
};
const finite=(a)=>a.every(Number.isFinite);
const inRange=(a,lo,hi)=>a.every(v=>v>=lo&&v<=hi);
const unitVector=(azDeg,elDeg)=>{
  const az=azDeg*Math.PI/180,el=elDeg*Math.PI/180;
  return [Math.cos(el)*Math.cos(az),Math.cos(el)*Math.sin(az),Math.sin(el)];
};
const circleOverlapFraction=(r,R,d)=>{
  if(d>=r+R)return 0;
  if(d<=Math.abs(R-r))return Math.min(r,R)**2/r**2;
  const a=Math.acos(Math.max(-1,Math.min(1,(d*d+r*r-R*R)/(2*d*r))));
  const b=Math.acos(Math.max(-1,Math.min(1,(d*d+R*R-r*r)/(2*d*R))));
  const q=(-d+r+R)*(d+r-R)*(d-r+R)*(d+r+R);
  return (r*r*a+R*R*b-0.5*Math.sqrt(Math.max(q,0)))/(Math.PI*r*r);
};

test('manifest publishes the rolling UTC window with endpoint-inclusive hourly samples',()=>{
  const p=manifest.period;
  const policy=manifest.coveragePolicy;
  const start=addUtcCalendarYearsClamped(policy.asOfUtcDate,-policy.calendarYearsBefore);
  const end=addUtcCalendarYearsClamped(policy.asOfUtcDate,policy.calendarYearsAfter);
  assert.match(policy.asOfUtcDate,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(policy.mode,'rolling-calendar-years');
  assert.equal(p.sampleCount,N);
  assert.equal(p.stepMinutes,60);
  assert.equal(p.startUtc,`${start}T00:00:00Z`,'window starts at the clamped UTC calendar anniversary');
  assert.equal(p.endUtc,`${end}T00:00:00Z`,'window ends at the clamped UTC calendar anniversary');
  const elapsedMs=Date.parse(p.endUtc)-Date.parse(p.startUtc),stepMs=p.stepMinutes*60000;
  assert.equal(elapsedMs%stepMs,0,'period duration is an exact number of sample intervals');
  assert.equal(elapsedMs,(N-1)*stepMs,'both endpoint samples match the UTC interval count');
  assert.equal(N,elapsedMs/stepMs+1,'sample count is derived from both endpoints and step size');
  assert.deepEqual(sky.period,p);
  assert.deepEqual(manifest.observerHeightsM,[0.5,1,2,5,10]);
});

test('rolling calendar anniversary fixtures clamp February 29 without shortening the daily grid',()=>{
  assert.equal(addUtcCalendarYearsClamped('2024-02-29',-1),'2023-02-28','prior non-leap anniversary clamps to February 28');
  assert.equal(addUtcCalendarYearsClamped('2024-02-29',1),'2025-02-28','following non-leap anniversary clamps to February 28');
  assert.equal(addUtcCalendarYearsClamped('2024-02-29',4),'2028-02-29','leap-year anniversary keeps February 29');
  const start=Date.UTC(2024,1,28),nextDay=new Date(start+86400000).toISOString().slice(0,10);
  assert.equal(nextDay,'2024-02-29','UTC day addition advances through the leap day');
});

test('manifest declares four published points and two explicit selections with sane coordinates',()=>{
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
  const records=Object.fromEntries(manifest.sites.map(s=>[s.id,s]));
  assert.deepEqual(records['connecting-neighbor'].polarStereoXYM,[records['connecting-ridge'].polarStereoXYM[0]+1000,records['connecting-ridge'].polarStereoXYM[1]]);
  assert.deepEqual(records['shackleton-neighbor'].polarStereoXYM,[records['shackleton-rim'].polarStereoXYM[0],records['shackleton-rim'].polarStereoXYM[1]+1000]);
  assert.match(records['connecting-neighbor'].coordinateSource,/our team.*fixed \+1000 m polar-stereographic X offset from connecting-ridge/i);
  assert.match(records['shackleton-neighbor'].coordinateSource,/our team.*fixed \+1000 m polar-stereographic Y offset from shackleton-rim/i);
  for(const id of NEIGHBOR_SITE_IDS){
    assert.match(records[id].name,/our selection/i,`${id} labels the point selection`);
    assert.match(records[id].coordinateSource,/not a published RoI centroid, selected landing site, or an illumination optimum/i,id);
  }
});

test('manifest has conventions, provenance and disclosures required by the project',()=>{
  for(const k of ['azimuth','elevation','longitude','frame','time','visibleFraction','censored'])assert.ok(manifest.conventions[k],`convention ${k}`);
  assert.match(manifest.conventions.azimuth,/clockwise from local north/);
  assert.match(manifest.conventions.longitude,/east/);
  assert.equal(manifest.conventions.geometryReferenceHeightM,1);
  assert.match(manifest.conventions.heightCalculation,/Shared azDeg, elDeg, angularRadiusDeg and rangeKm refer to the 1 m observer/);
  assert.match(manifest.conventions.heightCalculation,/no interpolation between heights/i);
  assert.match(manifest.conventions.time,/N-1 left-endpoint 5-minute intervals, excluding the terminal sample/i);
  assert.match(manifest.conventions.solarEclipse,/Opaque spherical Earth and uniform solar disk/i);
  assert.match(manifest.conventions.visibleFraction,/not multiplied/i);
  assert.ok(manifest.provenance.kernels.length>=5);
  for(const k of manifest.provenance.kernels)assert.match(k.sha256,/^[0-9a-f]{64}$/,k.file);
  assert.equal(manifest.provenance.dems.length,6);
  for(const d of manifest.provenance.dems){assert.match(d.sha256,/^[0-9a-f]{64}$/,d.file);assert.match(d.url,/^https:\/\//);}
  assert.ok(manifest.provenance.references.length>=3);
  assert.match(manifest.aiDisclosure,/AI/);
  assert.ok(manifest.limitations.some(l=>/NASA-selected landing sites/i.test(l)));
  assert.ok(manifest.limitations.some(l=>/communications|DSN/i.test(l)));
  assert.ok(manifest.assumptions.some(a=>/line of sight/i.test(a)),'Earth visibility is not communications');
  for(const w of [/(NASA|agency)[- ](approved|endorsed|certified)/i,/safe to land/i])
    assert.ok(!w.test(JSON.stringify(manifest)),`manifest must not claim ${w}`);
});

test('integrity lists and verifies exactly the rolling dataset JSON files',()=>{
  const expected=['manifest.json','sky.json','planets.json','validation.json',...SITE_IDS.map(id=>`sites/${id}.json`)].sort();
  assert.equal(integrity.files.length,10);
  assert.deepEqual(integrity.files.map(x=>x.file).sort(),expected);
  assert.equal(integrity.manifestGeneratedAtUtc,manifest.generatedAtUtc);
  for(const entry of integrity.files){
    const bytes=readFileSync(join(DATA,entry.file));
    assert.equal(bytes.length,entry.bytes,entry.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.file);
  }
});

test('terrain tiles are aligned and hash-verified for all six study points',()=>{
  assert.equal(terrain.tiles.length,SITE_IDS.length);
  assert.deepEqual(terrain.tiles.map(t=>t.siteId).sort(),[...SITE_IDS].sort());
  for(const tile of terrain.tiles){
    assert.equal(tile.width,500);assert.equal(tile.height,500);assert.equal(tile.cellSizeM,40);
    assert.deepEqual(tile.siteXYM,manifest.sites.find(s=>s.id===tile.siteId).polarStereoXYM);
    const bytes=readFileSync(join(DATA,tile.file));
    assert.equal(bytes.length,500000,`${tile.siteId} int16 tile bytes`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),tile.sha256,`${tile.siteId} tile hash`);
  }
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
        if(body==='sun')for(const key of ['terrainVisibleFraction','eclipseUnobscuredFraction']){
          const separate=d.sun[key]?.[h];
          assert.ok(Array.isArray(separate),`sun.${key}[${h}] exists`);
          assert.equal(separate.length,N,`sun.${key}[${h}] length`);
          assert.ok(finite(separate)&&inRange(separate,0,1),`sun.${key}[${h}] values`);
          for(let i=0;i<N;i++)assert.ok(f[i]<=separate[i]+1e-9,`joint<=${key} ${h} ${i}`);
        }
      }
    }
    // physical sanity: Sun ~1 AU, angular radius ~0.267-0.275 deg; Earth 356-407 Mm, radius ~0.88-1.0 deg
    assert.ok(inRange(d.sun.rangeKm,1.45e8,1.55e8));
    assert.ok(inRange(d.sun.angularRadiusDeg,0.26,0.28));
    assert.ok(inRange(d.earth.rangeKm,356000,407000));
    assert.ok(inRange(d.earth.angularRadiusDeg,0.85,1.05));
    // angular radius = asin(R/range)
    for(const i of [0,Math.floor(N/2),N-1]){
      assert.ok(Math.abs(Math.asin(696000/d.sun.rangeKm[i])*180/Math.PI-d.sun.angularRadiusDeg[i])<2e-4,'sun radius vs range');
      assert.ok(Math.abs(Math.asin(6378.137/d.earth.rangeKm[i])*180/Math.PI-d.earth.angularRadiusDeg[i])<2e-4,'earth radius vs range');
    }
  });

  test(`site ${id}: horizon has 720 azimuths at 0.5 deg for each observer height`,()=>{
    const hz=sites[id].horizon;
    assert.equal(hz.azimuthStepDeg,0.5);
    assert.equal(hz.azimuthDeg0,0);
    for(const h of H){assert.equal(hz.elevationDeg[h].length,720);assert.ok(finite(hz.elevationDeg[h]));assert.ok(inRange(hz.elevationDeg[h],-30,30),`${h} m horizon range`);}
    // Each successive observer height sees the same or a lower blocking horizon.
    for(let j=1;j<H.length;j++)for(let i=0;i<720;i++)assert.ok(hz.elevationDeg[H[j]][i]<=hz.elevationDeg[H[j-1]][i]+5e-4,`${H[j]} m vs ${H[j-1]} m, az index ${i}`);
    assert.ok(hz.minReachKm>300,'sight lines reach beyond 300 km (V3 convergence)');
  });

  test(`site ${id}: terrain visibility is height-monotone, with no monotonic eclipse claim`,()=>{
    for(const body of ['sun','earth']){
      for(let j=1;j<H.length;j++){
        const a=body==='sun'?sites[id].sun.terrainVisibleFraction[H[j-1]]:sites[id][body].visibleFraction[H[j-1]];
        const b=body==='sun'?sites[id].sun.terrainVisibleFraction[H[j]]:sites[id][body].visibleFraction[H[j]];
        for(let i=0;i<N;i++)assert.ok(b[i]>=a[i]-2e-3,`${body} sample ${i}: ${H[j]} m ${b[i]} < ${H[j-1]} m ${a[i]}`);
      }
    }
  });

  test(`site ${id}: terrain-only fractions match disk geometry; solar joint fraction respects both masks`,()=>{
    const d=sites[id];
    for(const body of ['sun','earth'])for(const h of H){
      let worst=0;
      for(let i=0;i<N;i++){
        const f=visibleDiskFraction(d[body].elDeg[i],horizonAt(d.horizon.elevationDeg[h],d[body].azDeg[i]),d[body].angularRadiusDeg[i]);
        const published=body==='sun'?d.sun.terrainVisibleFraction[h][i]:d.earth.visibleFraction[h][i];
        worst=Math.max(worst,Math.abs(f-published));
      }
      assert.ok(worst<0.01,`${body} terrain-only ${h} m worst difference ${worst}`);
      if(body==='sun')for(let i=0;i<N;i++){
        assert.ok(d.sun.visibleFraction[h][i]<=d.sun.terrainVisibleFraction[h][i]+1e-9,`joint<=terrain ${h} ${i}`);
        assert.ok(d.sun.visibleFraction[h][i]<=d.sun.eclipseUnobscuredFraction[h][i]+1e-9,`joint<=unobscured ${h} ${i}`);
      }
    }
  });

  test(`site ${id}: analytic Earth-disk overlap, joint eclipse geometry and refined contacts`,()=>{
    const d=sites[id],h='1';let overlapSamples=0;
    for(let i=0;i<N;i++){
      const a=unitVector(d.sun.azDeg[i],d.sun.elDeg[i]),b=unitVector(d.earth.azDeg[i],d.earth.elDeg[i]);
      const dot=Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2]));
      const separation=Math.acos(dot)*180/Math.PI;
      const expected=1-circleOverlapFraction(d.sun.angularRadiusDeg[i],d.earth.angularRadiusDeg[i],separation);
      const actual=d.sun.eclipseUnobscuredFraction[h][i];
      assert.ok(Math.abs(actual-expected)<0.004,`1 m analytic uncovered disk i=${i}: ${actual} vs ${expected}`);
      if(actual<0.999)overlapSamples++;
    }
    assert.ok(overlapSamples>0,'period includes Earth/Sun disk overlap');
    for(const e of [...d.events,...d.eclipseEvents])if(e.refined)
      assert.ok(e.refinementBracketSec>0&&e.refinementBracketSec<=30,`${e.type} ${e.utc} bracket ${e.refinementBracketSec}`);
  });

  test(`site ${id}: events are inside the period, typed, sorted and alternate sunrise/sunset`,()=>{
    const d=sites[id];const t0=Date.parse(manifest.period.startUtc),t1=Date.parse(manifest.period.endUtc);
    assert.ok(d.events.length>0);
    for(const e of d.events){
      assert.ok(['sunrise','sunset','earthrise','earthset','eclipseDarknessStart','eclipseDarknessEnd'].includes(e.type),e.type);
      assert.ok(manifest.observerHeightsM.includes(e.heightM));
      assert.match(e.utc,/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
      const t=Date.parse(e.utc);assert.ok(t>=t0&&t<=t1,`${e.type} ${e.utc} outside period`);
      assert.ok(e.resolutionMin>0&&e.resolutionMin<=5);
      if(['sunrise','sunset','earthrise','earthset'].includes(e.type))assert.equal(e.cause,'terrain',`${e.type} cause`);
      if(e.type.startsWith('eclipseDarkness'))assert.equal(e.cause,'earth-occultation',`${e.type} cause`);
      if(e.refined)assert.ok(e.refinementBracketSec>0&&e.refinementBracketSec<=30,`${e.type} refinement bracket`);
    }
    const key=(e)=>e.heightM+e.utc;
    const sorted=[...d.events].sort((a,b)=>a.heightM-b.heightM||(a.utc<b.utc?-1:a.utc>b.utc?1:0));
    assert.deepEqual(d.events.map(key),sorted.map(key),'sorted by height then time');
    for(const h of manifest.observerHeightsM)for(const [rise,set] of [['sunrise','sunset'],['earthrise','earthset']]){
      const seq=d.events.filter(e=>e.heightM===h&&e.cause==='terrain'&&(e.type===rise||e.type===set)).map(e=>e.type);
      for(let i=1;i<seq.length;i++)assert.notEqual(seq[i],seq[i-1],`${h} m ${rise}/${set} must alternate`);
    }
    assert.ok(Array.isArray(d.eclipseEvents)&&d.eclipseEvents.length>0);
    for(const h of manifest.observerHeightsM){
      const intervals=d.eclipses.filter(e=>e.heightM===h),boundaries=d.eclipseEvents.filter(e=>e.heightM===h);
      assert.ok(intervals.length>0,`${h} m eclipse intervals`);
      assert.ok(boundaries.length>0&&boundaries.every(e=>['solarEclipseStart','solarEclipseEnd'].includes(e.type)),`${h} m eclipse boundary types`);
      const seq=boundaries.map(e=>e.type);for(let i=1;i<seq.length;i++)assert.notEqual(seq[i],seq[i-1],`${h} m eclipse boundary alternation`);
      for(const eclipse of intervals){
        const start=Date.parse(eclipse.startUtc),end=Date.parse(eclipse.endUtc);
        assert.ok(start>=t0&&end<=t1&&start<end,`${h} m eclipse interval bounds`);
        assert.ok(eclipse.minimumUnobscuredFraction>=0&&eclipse.minimumUnobscuredFraction<=1);
        assert.equal(eclipse.minimumSamplingMin,5);assert.equal(eclipse.refined,true);
        assert.ok(eclipse.resolutionMin>0&&eclipse.resolutionMin<=5);
        assert.ok(boundaries.some(e=>e.type==='solarEclipseStart'&&e.utc===eclipse.startUtc));
        assert.ok(boundaries.some(e=>e.type==='solarEclipseEnd'&&e.utc===eclipse.endUtc));
      }
      for(const e of d.events.filter(e=>e.heightM===h&&e.type.startsWith('eclipseDarkness')))
        assert.ok(intervals.some(x=>Date.parse(e.utc)>=Date.parse(x.startUtc)&&Date.parse(e.utc)<=Date.parse(x.endUtc)),`${h} m darkness event in eclipse`);
    }
  });

  test(`site ${id}: each event coincides with a transition of the hourly visible fraction`,()=>{
    const d=sites[id];const t0=Date.parse(manifest.period.startUtc);
    for(const e of d.events){
      const body=e.type.startsWith('sun')||e.type.startsWith('eclipseDarkness')?'sun':'earth';
      const rising=/rise$/.test(e.type);
      const sameBody=d.events.filter(x=>x.heightM===e.heightM&&(
        e.type.startsWith('eclipseDarkness')?x.type.startsWith('eclipseDarkness'):
        body==='sun'?x.cause==='terrain'&&x.type.startsWith('sun'):
        x.type.startsWith('earth')
      ));
      const eventMs=Date.parse(e.utc),x=(eventMs-t0)/3600000;
      const eventRising=e.type==='eclipseDarknessEnd'?true:e.type==='eclipseDarknessStart'?false:rising;
      const sampleIndex=eventRising?Math.ceil(x)-1:Math.ceil(x);
      const sampleMs=t0+sampleIndex*3600000;
      const intervalEvents=sameBody.filter(x=>eventRising
        ? Date.parse(x.utc)>sampleMs&&Date.parse(x.utc)<=eventMs
        : Date.parse(x.utc)>=eventMs&&Date.parse(x.utc)<=sampleMs);
      // The hourly series cannot resolve multiple sub-hour transitions. Only
      // assert the expected side when this is the sole same-body event between
      // the adjacent hourly sample and the refined event.
      if(intervalEvents.length===1){
        const f=e.type.startsWith('eclipseDarkness')?d.sun.visibleFraction[String(e.heightM)]:body==='sun'?d.sun.terrainVisibleFraction[String(e.heightM)]:d.earth.visibleFraction[String(e.heightM)];
        assert.equal(f[sampleIndex],0,`${e.type} ${e.utc} h=${e.heightM}: hourly sample on the non-visible side`);
      }
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
      const intervals=N-1;
      const mean=sun.slice(0,-1).reduce((s,v)=>s+v,0)/intervals;
      assert.ok(Math.abs(mean-m.meanSunVisibleFraction)<0.01,`left-endpoint mean sun ${mean} vs ${m.meanSunVisibleFraction}`);
      assert.ok(Math.abs(sun.slice(0,-1).filter(v=>v>0).length/intervals-m.sunlitTimeFraction)<0.005);
      assert.ok(Math.abs(earth.slice(0,-1).filter(v=>v>0).length/intervals-m.earthVisibleTimeFraction)<0.005);
      const longest=(arr,pred)=>Math.max(0,...runs(arr,pred,1).map(r=>r.hours));
      assert.ok(Math.abs(longest(sun,v=>v<=0)-m.longestNoDirectSunH)<=6,'longest dark (hourly grid can bridge sub-hour sunlit blips)');
      assert.ok(Math.abs(longest(earth,v=>v<=0)-m.longestNoEarthH)<=3,'longest no-Earth');
      assert.ok(Math.abs(longest(sun,v=>v>0)-m.longestSunlitH)<=3,'longest sunlit');
    }
    assert.ok(Array.isArray(d.eclipses));
  });
}

test('joint terrain and eclipse fractions are not multiplied',()=>{
  let witness=null;
  for(const id of SITE_IDS){
    const d=sites[id],h='1';
    for(let i=0;i<N;i++){
      const terrainFraction=d.sun.terrainVisibleFraction[h][i],unobscured=d.sun.eclipseUnobscuredFraction[h][i],joint=d.sun.visibleFraction[h][i];
      if(terrainFraction>0.1&&terrainFraction<0.9&&unobscured>0.1&&unobscured<0.9&&Math.abs(joint-terrainFraction*unobscured)>0.01){
        witness={site:id,index:i,terrainFraction,unobscured,joint};break;
      }
    }
    if(witness)break;
  }
  assert.ok(witness,'an overlap sample shows joint area differs from multiplying separate fractions');
});

test('six study points are not interchangeable: different horizons and different series',()=>{
  const sig=SITE_IDS.map(id=>sites[id].horizon.elevationDeg['1'].slice(0,50).join());
  assert.equal(new Set(sig).size,SITE_IDS.length);
  const s2=SITE_IDS.map(id=>sites[id].metrics['1'].meanSunVisibleFraction);
  assert.ok(new Set(s2).size>=3);
});

test('rolling data exposes per-height products with shared 1 m reference geometry',()=>{
  assert.equal(manifest.conventions.geometryReferenceHeightM,1);
  for(const id of SITE_IDS){
    const d=sites[id];
    assert.deepEqual(Object.keys(d.metrics).sort(),H.sort(),id+' metric heights');
    assert.deepEqual(Object.keys(d.horizon.elevationDeg).sort(),H.sort(),id+' horizon heights');
    for(const body of ['sun','earth']){
      for(const key of ['azDeg','elDeg','angularRadiusDeg','rangeKm'])assert.equal(d[body][key].length,N,id+' '+body+'.'+key);
      assert.deepEqual(Object.keys(d[body].visibleFraction).sort(),H.sort(),id+' '+body+' fraction heights');
      if(body==='sun')for(const key of ['terrainVisibleFraction','eclipseUnobscuredFraction'])assert.deepEqual(Object.keys(d.sun[key]).sort(),H.sort(),id+' '+key);
    }
  }
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
  for(const i of [0,Math.floor(N/2),N-1]){
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
  assert.deepEqual(ids,['V1','V2','V3','V4','V4b','V5','V6','V7']);
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
  if(t.V1.status==='pass'){assert.ok(t.V1.result.p95Deg<0.01);assert.ok(t.V1.result.n>=60);assert.equal(t.V1.result.perSiteBody.length,SITE_IDS.length*2);}
  if(t.V2.status==='pass')for(const r of t.V2.result){assert.ok(Math.abs(r.medianDiffM)<2,r.site);assert.deepEqual(r.bestShiftM,[0,0]);assert.ok(r.n>1000);}
  if(t.V3.status==='pass'){assert.equal(t.V3.result.length,SITE_IDS.length);assert.deepEqual(t.V3.result.map(r=>r.site).sort(),[...SITE_IDS].sort());for(const r of t.V3.result)assert.ok(r.maxAbsDiffDeg<0.01,r.site);}
  if(t.V4.status==='pass')for(const r of t.V4.result)assert.ok(r.meanVisibleFraction2024to2026At1m>0.7,r.site);
  if(t.V5.status==='pass'){
    const pairs=[[0.5,1],[1,2],[2,5],[5,10]];
    const perSite=t.V5.result.filter(r=>r.site);
    assert.equal(perSite.length,SITE_IDS.length);
    for(const r of perSite){
      assert.ok(SITE_IDS.includes(r.site),r.site);
      assert.deepEqual(r.adjacentHeightPairs.map(p=>[p.lowerM,p.upperM]),pairs,r.site);
      for(const p of r.adjacentHeightPairs){
        assert.equal(p.higherHorizonNotAboveLower,true,`${r.site} ${p.lowerM}/${p.upperM} horizon`);
        assert.deepEqual(p.higherVisibleFractionNotBelowLower,{sun:true,earth:true},`${r.site} ${p.lowerM}/${p.upperM} fractions`);
      }
    }
    const psr=t.V5.result.find(r=>r.psrPixel);
    assert.ok(psr,'PSR pixel check present');
    assert.equal(psr.psrPixel.maxSunFraction2024to2026,0);
  }
  if(t.V6.status==='pass'){
    const r=t.V6.result;
    assert.equal(r.pass,true);assert.ok(r.cases>=86);
    assert.ok(r.analyticMaxError<1e-8);
    assert.ok(r.quadrature128vs256MaxError<2e-5);
    assert.ok(r.independent100000ChordMaxError<1e-4);
  }
  if(t.V7.status==='pass'){
    const r=t.V7.result;
    assert.equal(r.pass,true);assert.deepEqual(r.errors,[]);
    assert.equal(r.intervalHours,N-1);
    assert.deepEqual(r.sites.map(s=>s.site).sort(),[...SITE_IDS].sort());
    assert.ok(r.sites.every(s=>s.samples===N&&s.eclipseIntervalsAllHeights>0));
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
