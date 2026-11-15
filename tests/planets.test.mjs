// Structural checks of public/data/planets.json (optional visual Solar System context).
// These do NOT validate planet positions against Horizons; the file itself says it is not validated.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const DATA=join(dirname(fileURLToPath(import.meta.url)),'..','public','data');
const load=(f)=>JSON.parse(readFileSync(join(DATA,f),'utf8'));
const planets=load('planets.json'),manifest=load('manifest.json'),sky=load('sky.json'),validation=load('validation.json');
const N=manifest.period.sampleCount;
const EXPECTED=['mercury','venus','mars','jupiter','saturn','uranus','neptune'];
// Loose geocentric-distance envelopes (km) from orbital geometry (perihelion/aphelion of both bodies, with margin).
const RANGE={mercury:[5e7,2.4e8],venus:[3.5e7,2.7e8],mars:[5e7,4.1e8],jupiter:[5.5e8,1.0e9],saturn:[1.1e9,1.8e9],uranus:[2.5e9,3.3e9],neptune:[4.2e9,4.8e9]};
const RADIUS_KM={mercury:2439.7,venus:6051.8,mars:3389.5,jupiter:69911,saturn:58232,uranus:25362,neptune:24622}; // IAU/IAU-WGCCRE mean-ish radii

test('planets.json: seven expected planets in order, unique ids, names and colors',()=>{
  assert.deepEqual(planets.planets.map(p=>p.id),EXPECTED);
  for(const p of planets.planets){
    assert.equal(p.name.toLowerCase(),p.id);
    assert.match(p.color,/^#[0-9a-f]{6}$/i,`${p.id} color`);
    assert.ok(p.spiceTarget&&p.positionNote,`${p.id} spiceTarget/positionNote`);
  }
  assert.equal(new Set(planets.planets.map(p=>p.color)).size,7,'colors are distinct');
});

test('planets.json: period and frame align with the dataset',()=>{
  assert.deepEqual(planets.period,manifest.period);
  assert.deepEqual(planets.period,sky.period);
  assert.equal(planets.frame,sky.frame,'same frame as sky.json');
  assert.equal(planets.schemaVersion,manifest.schemaVersion);
});

test('planets.json: radii are positive and within 2% of published mean radii',()=>{
  for(const p of planets.planets){
    assert.ok(Number.isFinite(p.radiusKm)&&p.radiusKm>0,`${p.id} radius`);
    assert.ok(Math.abs(p.radiusKm/RADIUS_KM[p.id]-1)<0.02,`${p.id} radius ${p.radiusKm}`);
  }
});

test('planets.json: one finite 3-vector per published hourly instant at plausible Moon-centred distances',()=>{
  for(const p of planets.planets){
    assert.equal(p.posKm.length,N,`${p.id} sample count`);
    const [lo,hi]=RANGE[p.id];
    for(const v of p.posKm){
      assert.equal(v.length,3);assert.ok(v.every(Number.isFinite),`${p.id} finite`);
      const r=Math.hypot(...v);assert.ok(r>=lo&&r<=hi,`${p.id} distance ${r}`);
    }
  }
});

test('planets.json: positions are continuous (direction changes < 0.2 deg per hour) and not constant',()=>{
  for(const p of planets.planets){
    let moved=0;
    for(let i=1;i<N;i++){
      const a=p.posKm[i-1],b=p.posKm[i];
      const c=(a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/(Math.hypot(...a)*Math.hypot(...b));
      const deg=Math.acos(Math.min(1,c))*180/Math.PI;
      assert.ok(deg<0.2,`${p.id} jump ${deg} deg at ${i}`);moved+=deg;
    }
    assert.ok(moved>0,`${p.id} never moves`);
  }
});

test('planets.json: a planet is never at the Sun or Earth position (independent of sky.json)',()=>{
  for(const i of [0,Math.floor(N/2),N-1])for(const p of planets.planets){
    const sep=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
    assert.ok(sep(p.posKm[i],sky.sunPosKm[i])>1e6,`${p.id} coincides with Sun`);
    assert.ok(sep(p.posKm[i],sky.earthPosKm[i])>1e6,`${p.id} coincides with Earth`);
  }
});

test('planets.json: metadata states visual-only use, proxies and no Horizons validation',()=>{
  assert.match(planets.purpose,/visual/i);
  assert.match(planets.purpose,/Not used by any/i);
  assert.match(planets.validation,/Not compared with Horizons/i);
  assert.ok(planets.limitations.some(l=>/barycent/i.test(l)),'barycentre proxy limitation');
  assert.ok(planets.limitations.some(l=>/Visual context only/i.test(l)));
  for(const id of ['mars','jupiter','saturn','uranus','neptune'])assert.match(planets.planets.find(p=>p.id===id).positionNote,/proxy|not the planet centre/i,`${id} proxy note`);
  for(const id of ['mercury','venus'])assert.match(planets.planets.find(p=>p.id===id).positionNote,/coincides/i);
  assert.ok(planets.provenance.kernels.every(k=>manifest.provenance.kernels.some(m=>m.file===k)),'kernels are from the documented set');
  assert.doesNotMatch(JSON.stringify(planets),/validated against|NASA-approved|endorse/i);
});

test('planets are isolated from scientific results: not referenced by manifest, validation or site data',()=>{
  const blob=JSON.stringify({manifest,validation});
  for(const id of EXPECTED)assert.ok(!new RegExp(`"${id}"`,'i').test(blob),`${id} leaked into manifest/validation`);
  assert.equal('planets' in sky,false);
  const site=load(manifest.sites[0].file);
  assert.equal('planets' in site,false);
  assert.ok(!manifest.sites.some(s=>EXPECTED.includes(s.id)));
});
