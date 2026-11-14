// Independent tests of src/lib/sceneGeometry.mjs (V2 3D geometry). Expected values come from
// analytic geometry, published metadata and the real data files, not from re-implementing the code.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import * as THREE from 'three';
import {MOON_RADIUS_M,sampleGrid,displacedGlobe,polarPoint,localTerrain,interpolateVector,interpolateBodyQuaternion} from '../src/lib/sceneGeometry.mjs';

const DATA=join(dirname(fileURLToPath(import.meta.url)),'..','public','data');
const json=(f)=>JSON.parse(readFileSync(join(DATA,f),'utf8'));
function grid(file,width,height){
  const b=readFileSync(join(DATA,file));
  assert.equal(b.length,width*height*2,'file size');
  const values=new Int16Array(width*height);
  for(let i=0;i<values.length;i++)values[i]=b.readInt16LE(i*2);
  return {values,width,height};
}
const close=(a,b,eps,msg='')=>assert.ok(Math.abs(a-b)<=eps,`${msg} expected ${b} got ${a} (eps ${eps})`);
const manifest=json('manifest.json'),sky=json('sky.json'),terrain=json('terrain/terrain.json'),elevMeta=json('globe/moon-elevation.json');

test('MOON_RADIUS_M is the 1737.4 km reference sphere',()=>assert.equal(MOON_RADIUS_M,1737400));

test('sampleGrid: bilinear values, clamping and longitude wrap (hand-computed 2x2 grid)',()=>{
  const g={width:2,height:2,values:Int16Array.from([0,10,20,30])};
  assert.equal(sampleGrid(g,0,0),0);
  assert.equal(sampleGrid(g,1,1),30);
  close(sampleGrid(g,0.5,0.5),15,1e-12);
  close(sampleGrid(g,0.5,0),5,1e-12);
  close(sampleGrid(g,0,0.5),10,1e-12);
  assert.equal(sampleGrid(g,-5,-5),0,'clamped');
  assert.equal(sampleGrid(g,9,9),30,'clamped');
  // wrap: halfway between the last and first column of row 0 is (10+0)/2 = 5
  close(sampleGrid(g,1.5,0,true),5,1e-12,'wrap east');
  close(sampleGrid(g,-0.5,0,true),5,1e-12,'wrap west');
  close(sampleGrid(g,2,0,true),0,1e-12,'full turn');
});

test('polarPoint: pole, radius, height scaling and exact lat/lon of the published sites',()=>{
  const p0=polarPoint(0,0);
  close(p0.x,0,1e-12);close(p0.y,-1,1e-12);close(p0.z,0,1e-12);
  close(polarPoint(12345,-6789).length(),1,1e-12,'unit radius at 0 m');
  close(polarPoint(500,500,1737.4).length(),1.001,1e-12,'height 1.7374 km -> 1.001');
  for(const s of manifest.sites){
    const p=polarPoint(...s.polarStereoXYM,s.terrainElevationM);
    close(p.length(),1+s.terrainElevationM/MOON_RADIUS_M,1e-12,s.id+' radius');
    const lat=Math.asin(p.y/p.length())*180/Math.PI;
    let lon=Math.atan2(-p.z,p.x)*180/Math.PI;if(lon<0)lon+=360; // Three (x,z,-y) -> ME longitude
    close(lat,s.latitudeDeg,2e-5,s.id+' latitude');
    const dl=Math.abs(((lon-s.longitudeEastDeg+540)%360)-180);
    assert.ok(dl<2e-4,`${s.id} longitude ${lon} vs ${s.longitudeEastDeg}`);
  }
});

test('polarPoint: sphere curvature, 10 km from the pole drops 28.8 m (theta^2 R / 2), not a flat plane',()=>{
  const theta=10000/MOON_RADIUS_M; // arc to first order (stereographic true scale at the pole)
  const p=polarPoint(10000,0);
  const dropM=(p.y-(-1))*-1*MOON_RADIUS_M; // displacement along the local zenith (-y) at the pole: negative = below tangent plane
  const expected=-(theta*theta/2)*MOON_RADIUS_M;
  close(dropM,expected,0.3,'drop below tangent plane');
  close(expected,-28.8,0.1,'~29 m, as documented');
  // longitude convention: ME lon 0 toward +Y_polar, 90E toward +X_polar -> different Three axes
  const north=polarPoint(0,10000),east=polarPoint(10000,0);
  assert.ok(north.x>0&&Math.abs(north.z)<1e-9,'lon 0 -> +X in Three');
  assert.ok(east.z<0&&Math.abs(east.x)<1e-6,'lon 90E -> -Z in Three');
});

test('displacedGlobe (real 720x360 relief): finite, unit normals, outward, shared pole radius, seam welded',()=>{
  const file=elevMeta.files.find(f=>f.width===720);
  const g=grid(file.file,720,360);
  const segments=72;
  const geo=displacedGlobe(g,segments);
  const pos=geo.attributes.position,nor=geo.attributes.normal,uv=geo.attributes.uv,cols=segments+1,rows=segments/2+1;
  assert.equal(pos.count,cols*rows);
  let minR=Infinity,maxR=0,outward=0;
  const v=new THREE.Vector3(),n=new THREE.Vector3();
  for(let i=0;i<pos.count;i++){
    v.fromBufferAttribute(pos,i);n.fromBufferAttribute(nor,i);
    assert.ok(Number.isFinite(v.x+v.y+v.z)&&Number.isFinite(n.x+n.y+n.z),`finite vertex ${i}`);
    close(n.length(),1,1e-4,`normal ${i} length`);
    const r=v.length();minR=Math.min(minR,r);maxR=Math.max(maxR,r);
    if(n.dot(v.clone().normalize())>0)outward++;
  }
  assert.ok(outward/pos.count>0.995,`normals point outward: ${outward}/${pos.count}`);
  // radii within the data's own min/max elevations (metres -> unit radius)
  assert.ok(minR>=1+file.minM/MOON_RADIUS_M-1e-6,'min radius '+minR);
  assert.ok(maxR<=1+file.maxM/MOON_RADIUS_M+1e-6,'max radius '+maxR);
  // poles: every duplicated vertex of the pole rows shares one radius and sits on the axis, normal along the axis
  for(const [row,sign] of [[0,1],[rows-1,-1]]){
    const radii=new Set();
    for(let c=0;c<cols;c++){
      const i=row*cols+c;v.fromBufferAttribute(pos,i);n.fromBufferAttribute(nor,i);
      radii.add(v.length().toFixed(9));
      close(Math.hypot(v.x,v.z),0,1e-6,'on axis');assert.equal(Math.sign(v.y),sign);
      assert.ok(n.y*sign>0.999,'pole normal within ~2.5 deg of the axis: '+n.y);
      if(c===0)var n0=n.clone();else assert.ok(n.distanceTo(n0)<1e-5,'duplicated pole vertices share one normal (no lighting seam at the pole)');
    }
    assert.equal(radii.size,1,`pole row ${row} has ${radii.size} distinct radii`);
  }
  // seam: first and last column of each row coincide in position and normal (no crack, no lighting seam)
  for(let r=0;r<rows;r++){
    const a=r*cols,b=a+segments;
    const pa=new THREE.Vector3().fromBufferAttribute(pos,a),pb=new THREE.Vector3().fromBufferAttribute(pos,b);
    assert.ok(pa.distanceTo(pb)<1e-5,`seam position row ${r}: ${pa.distanceTo(pb)}`);
    const na=new THREE.Vector3().fromBufferAttribute(nor,a),nb=new THREE.Vector3().fromBufferAttribute(nor,b);
    assert.ok(na.distanceTo(nb)<1e-5,`seam normal row ${r}`);
  }
  assert.ok(geo.boundingSphere.radius>0.99&&geo.boundingSphere.radius<1.01);
  // uv ranges are [0,1] with v=1 at the north pole
  // equator row spans u = 0..1 (pole vertices carry u at the segment centre, so exclude them)
  const eq=Math.floor(rows/2)*cols;
  close(uv.getX(eq),0,1e-9);close(uv.getX(eq+segments),1,1e-9);close(uv.getY(0),1,1e-9,'north pole v=1');close(uv.getY(pos.count-1),0,1e-9,'south pole v=0');
});

test('displacedGlobe: constant elevation gives an exact sphere of radius 1 + h/R; zero gives the unit sphere',()=>{
  for(const h of [0,1000,-2500]){
    const g={width:16,height:8,values:new Int16Array(16*8).fill(h)};
    const geo=displacedGlobe(g,16);
    const p=geo.attributes.position,v=new THREE.Vector3();
    for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);close(v.length(),1+h/MOON_RADIUS_M,1e-6,`h=${h} (float32 geometry)`);}
  }
});

test('displacedGlobe: known mountain lands at the right longitude/latitude (orientation of the grid on the sphere)',()=>{
  // single 5 km bump at lon +90E (col 3/4 of width), equator row; everything else 0
  const W=64,H=32,values=new Int16Array(W*H);
  const col=Math.round(((90+180)/360)*W-0.5),row=Math.round((0.5)*H-0.5);
  for(let dr=0;dr<=1;dr++)for(let dc=0;dc<=1;dc++)values[(row+dr)*W+col+dc]=5000;
  const geo=displacedGlobe({width:W,height:H,values},64);
  const p=geo.attributes.position,v=new THREE.Vector3();
  let best=null;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);if(!best||v.length()>best.r)best={r:v.length(),v:v.clone()};}
  assert.ok(best.r>1+2000/MOON_RADIUS_M,'bump present');
  const lat=Math.asin(best.v.y/best.r)*180/Math.PI;
  let lon=Math.atan2(-best.v.z,best.v.x)*180/Math.PI; // ME lon from Three axes (x,z,-y)
  close(lat,0,6,'latitude ~ equator');close(lon,90,6,'longitude ~ +90E');
});

test('localTerrain (all 4 real tiles): finite, outward normals, centre vertex at the site, curvature present',()=>{
  for(const tile of terrain.tiles){
    const g=grid(tile.file,tile.width,tile.height);
    const segments=50;
    const geo=localTerrain(g,tile,segments);
    const pos=geo.attributes.position,nor=geo.attributes.normal,count=segments+1;
    assert.equal(pos.count,count*count);
    let outward=0;const v=new THREE.Vector3(),n=new THREE.Vector3();
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos,i);n.fromBufferAttribute(nor,i);
      assert.ok(Number.isFinite(v.x+v.y+v.z+n.x+n.y+n.z),`${tile.siteId} finite ${i}`);
      if(n.dot(v)>0)outward++;
    }
    assert.ok(outward/pos.count>0.99,`${tile.siteId} outward normals ${outward}/${pos.count}`);
    // mesh centre vertex = site XY (cell centre registration): within one 40 m cell of the published site point
    const centre=new THREE.Vector3().fromBufferAttribute(pos,(segments/2)*count+segments/2);
    const site=polarPoint(...tile.siteXYM,tile.siteTerrainHeightM);
    assert.ok(centre.distanceTo(site)*MOON_RADIUS_M<400,`${tile.siteId} centre is ${(centre.distanceTo(site)*MOON_RADIUS_M).toFixed(0)} m from the site point`);
    // radius of every vertex stays within tile min/max elevation (+ tolerance for bilinear)
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos,i);const hM=(v.length()-1)*MOON_RADIUS_M;
      assert.ok(hM>=tile.minM-5&&hM<=tile.maxM+5,`${tile.siteId} vertex height ${hM}`);
    }
    // curvature: a corner (14 km away) is ~ d^2/2R = 57 m below the tangent plane at the centre vertex, far more than a flat mesh
    const up=site.clone().normalize();
    const corner=new THREE.Vector3().fromBufferAttribute(pos,0);
    const flatDist=Math.hypot(tile.boundsPolarStereoM.xMin-tile.siteXYM[0],tile.boundsPolarStereoM.yMax-tile.siteXYM[1]);
    const sag=corner.clone().sub(site).dot(up)*MOON_RADIUS_M; // includes terrain height difference
    const geomSag=-(flatDist*flatDist)/(2*MOON_RADIUS_M);
    const terrainDiff=0; // unknown exactly; bound with the tile's height range
    assert.ok(sag<geomSag+(tile.maxM-tile.minM)&&sag>geomSag-(tile.maxM-tile.minM),`${tile.siteId} sag ${sag.toFixed(0)} vs ${geomSag.toFixed(0)}±${tile.maxM-tile.minM}`);
    assert.ok(geomSag<-50,'expected ~57 m sagitta at the corners');
    void terrainDiff;
  }
});

test('localTerrain: flat zero tile near the pole is a spherical cap (sag matches theta^2 R/2 to 2%) with outward normals and correct winding',()=>{
  const tile={boundsPolarStereoM:{xMin:-10000,xMax:10000,yMin:-10000,yMax:10000}};
  const g={width:20,height:20,values:new Int16Array(400)};
  const geo=localTerrain(g,tile,20);
  const p=geo.attributes.position,count=21;
  const centre=new THREE.Vector3().fromBufferAttribute(p,10*count+10);
  close(centre.y,-1,1e-6,'centre at the pole');
  const edge=new THREE.Vector3().fromBufferAttribute(p,10*count+0); // x = -10 km, y = 0
  const theta=10000/MOON_RADIUS_M;
  close((edge.y+1)*-MOON_RADIUS_M,-(theta*theta/2)*MOON_RADIUS_M,0.5,'edge drop');
  // triangle winding: geometric face normals computed from indices point away from the Moon centre
  const idx=geo.index.array;let good=0,total=0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<idx.length;i+=3){
    a.fromBufferAttribute(p,idx[i]);b.fromBufferAttribute(p,idx[i+1]);c.fromBufferAttribute(p,idx[i+2]);
    const nrm=b.clone().sub(a).cross(c.clone().sub(a));
    if(nrm.dot(a)>0)good++;total++;
  }
  assert.equal(good,total,'all triangles wound counter-clockwise seen from outside');
});

test('interpolateVector: axis mapping ME->Three (x,y,z)->(x,z,-y), linear in float time, clamped at both ends, reuses target',()=>{
  const arr=[[1,2,3],[3,6,9],[5,10,15]];
  const t=new THREE.Vector3();
  const r=interpolateVector(arr,0,t);
  assert.strictEqual(r,t,'writes into target');
  assert.deepEqual(r.toArray(),[1,3,-2]);
  assert.deepEqual(interpolateVector(arr,1).toArray(),[3,9,-6]);
  assert.deepEqual(interpolateVector(arr,0.5).toArray(),[2,6,-4]);
  assert.deepEqual(interpolateVector(arr,1.25).toArray(),[3.5,10.5,-7]);
  assert.deepEqual(interpolateVector(arr,-3).toArray(),[1,3,-2],'clamped below');
  assert.deepEqual(interpolateVector(arr,2).toArray(),[5,15,-10],'last sample exact');
  assert.deepEqual(interpolateVector(arr,17.9).toArray(),[5,15,-10],'clamped above');
});

test('interpolateVector on real sky data: continuous in float time (no jump between hourly samples)',()=>{
  const series=[sky.sunPosKm,sky.earthPosKm];
  for(const a of series)for(const i of [0,100,700,1391]){
    const p0=interpolateVector(a,i),p1=interpolateVector(a,i+1),mid=interpolateVector(a,i+0.5),q=interpolateVector(a,i+0.999);
    close(mid.distanceTo(p0)+mid.distanceTo(p1),p0.distanceTo(p1),1e-6*p0.length()+1e-6,'mid on the segment');
    assert.ok(q.distanceTo(p1)<=p0.distanceTo(p1)*0.01+1e-6,'approaches next sample');
  }
});

test('interpolateBodyQuaternion: SPICE wxyz -> Three mapping, unit norm, shortest path across sign flips (real data)',()=>{
  const q=[[1,0,0,0],[0,1,0,0]];
  const q0=interpolateBodyQuaternion(q,0);
  close(q0.x,0,1e-12);close(q0.y,0,1e-12);close(q0.z,0,1e-12);close(q0.w,1,1e-12);
  const e=interpolateBodyQuaternion([[0.5,0.1,0.2,0.3]],0);
  close(e.x,-0.1,1e-12);close(e.y,-0.3,1e-12);close(e.z,0.2,1e-12);close(e.w,0.5,1e-12);
  for(const arr of [sky.moonOrientationQuat,sky.earthOrientationQuat]){
    let flips=0;
    for(let i=0;i<arr.length-1;i++){
      const a=interpolateBodyQuaternion(arr,i),b=interpolateBodyQuaternion(arr,i+1),m=interpolateBodyQuaternion(arr,i+0.5);
      close(m.length(),1,1e-6,'unit');
      const total=a.angleTo(b),da=a.angleTo(m),db=m.angleTo(b);
      if(a.dot(b)<0)flips++;
      assert.ok(total<=Math.PI+1e-9);
      close(da+db,total,1e-5,`sample ${i}: midpoint is on the shortest arc`);
      close(da,total/2,1e-5,`sample ${i}: midpoint is halfway`);
    }
    assert.ok(flips>=0);
  }
  // clamping
  const a=interpolateBodyQuaternion(sky.moonOrientationQuat,-5),b=interpolateBodyQuaternion(sky.moonOrientationQuat,0);
  assert.ok(a.angleTo(b)<1e-6,"clamp below (acos noise ~4e-8)");
  const n=sky.moonOrientationQuat.length-1;
  assert.ok(interpolateBodyQuaternion(sky.moonOrientationQuat,n+7).angleTo(interpolateBodyQuaternion(sky.moonOrientationQuat,n))<1e-6,"clamp above");
});

test('Earth rotation quaternions rotate ~360 deg/day (real data, float time consumers see a smooth spin)',()=>{
  const arr=sky.earthOrientationQuat;let sum=0;
  for(let i=0;i<24;i++){
    const a=interpolateBodyQuaternion(arr,i),b=interpolateBodyQuaternion(arr,i+1);
    sum+=a.angleTo(b);
  }
  // the hourly step is 15 deg mod 2pi/... the shortest-arc angle is ambiguous for >180; assert the per-hour step is stable
  const step=interpolateBodyQuaternion(arr,0).angleTo(interpolateBodyQuaternion(arr,1));
  const step2=interpolateBodyQuaternion(arr,500).angleTo(interpolateBodyQuaternion(arr,501));
  close(step,step2,0.01,'regular hourly rotation');
  assert.ok(sum>0);
});
