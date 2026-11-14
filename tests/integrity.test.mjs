// verifyDatasetIntegrity / `npm run check:data`: positive case on the real dataset and tamper / missing /
// duplicated / path-escape cases on scratch copies. The real public/data is never modified.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,copyFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifyDatasetIntegrity} from '../scripts/check-data-integrity.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const REAL=join(ROOT,'public','data');
const manifest=JSON.parse(readFileSync(join(REAL,'manifest.json'),'utf8'));
const integrity=JSON.parse(readFileSync(join(REAL,'integrity.json'),'utf8'));
const FILES=['manifest.json','sky.json','planets.json','validation.json','integrity.json',...manifest.sites.map(s=>s.file)];
const sha=(b)=>createHash('sha256').update(b).digest('hex');
const snapshotDir=(dir)=>{const out={};const walk=(d,p='')=>{for(const n of readdirSync(d)){const f=join(d,n);const st=statSync(f);if(st.isDirectory())walk(f,p+n+'/');else out[p+n]=sha(readFileSync(f));}};walk(dir);return out;};

function scratch(){
  const dir=mkdtempSync(join(tmpdir(),'lunar-integrity-'));
  for(const f of FILES){mkdirSync(dirname(join(dir,f)),{recursive:true});copyFileSync(join(REAL,f),join(dir,f));}
  return dir;
}
const withScratch=(fn)=>{const dir=scratch();try{return fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}};
const readInt=(dir)=>JSON.parse(readFileSync(join(dir,'integrity.json'),'utf8'));
const writeInt=(dir,obj)=>writeFileSync(join(dir,'integrity.json'),JSON.stringify(obj));

test('real dataset: integrity record verifies all 8 derived files, read-only',()=>{
  const before=snapshotDir(REAL);
  const r=verifyDatasetIntegrity(REAL);
  assert.deepEqual(r,{valid:true,filesChecked:8});
  assert.deepEqual(snapshotDir(REAL),before,'verification must not modify the dataset');
  assert.equal(integrity.files.length,8);
  for(const e of integrity.files){assert.match(e.sha256,/^[0-9a-f]{64}$/);assert.equal(e.bytes,readFileSync(join(REAL,e.file)).length,e.file);assert.equal(e.sha256,sha(readFileSync(join(REAL,e.file))),e.file);}
  assert.equal(integrity.manifestGeneratedAtUtc,manifest.generatedAtUtc);
  const names=integrity.files.map(f=>f.file).sort();
  assert.deepEqual(names,['manifest.json','planets.json','sites/connecting-ridge.json','sites/malapert-massif.json','sites/nobile-rim-1.json','sites/shackleton-rim.json','sky.json','validation.json']);
});

test('default directory argument verifies the repository dataset',()=>assert.equal(verifyDatasetIntegrity().valid,true));

test('`npm run check:data` / node script exits 0 with a JSON line',()=>{
  const r=spawnSync(process.execPath,[join(ROOT,'scripts','check-data-integrity.mjs')],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  assert.deepEqual(JSON.parse(r.stdout.trim()),{valid:true,filesChecked:8});
});

test('scratch copy verifies (positive control for the negative cases below)',()=>withScratch(dir=>assert.equal(verifyDatasetIntegrity(dir).valid,true)));

test('tamper: any changed byte in any hashed file is detected (same size and different size)',()=>{
  for(const file of integrity.files.map(f=>f.file)){
    withScratch(dir=>{
      const p=join(dir,file);const b=readFileSync(p);
      const flipped=Buffer.from(b);flipped[Math.floor(b.length/2)]^=0x01;writeFileSync(p,flipped);
      assert.throws(()=>verifyDatasetIntegrity(dir),/checksum|match/i,`flip in ${file}`);
      writeFileSync(p,Buffer.concat([b,Buffer.from(' ')]));
      assert.throws(()=>verifyDatasetIntegrity(dir),/checksum|match/i,`append in ${file}`);
      writeFileSync(p,b.subarray(0,b.length-1));
      assert.throws(()=>verifyDatasetIntegrity(dir),/checksum|match|JSON/i,`truncate in ${file} (manifest.json fails earlier as unparsable JSON; still rejected)`);
    });
  }
});

test('tamper: semantically harmless edit (value change keeping the length) is still detected',()=>withScratch(dir=>{
  const p=join(dir,'sites/malapert-massif.json');const t=readFileSync(p,'utf8');
  const changed=t.replace('"sunlitTimeFraction":0','"sunlitTimeFraction":1');
  assert.notEqual(changed,t);assert.equal(Buffer.byteLength(changed),Buffer.byteLength(t));
  writeFileSync(p,changed);
  assert.throws(()=>verifyDatasetIntegrity(dir),/checksum/i);
}));

test('tamper: recorded checksum or length edited in integrity.json is detected',()=>{
  withScratch(dir=>{const i=readInt(dir);i.files[1].sha256='0'.repeat(64);writeInt(dir,i);assert.throws(()=>verifyDatasetIntegrity(dir),/checksum/i);});
  withScratch(dir=>{const i=readInt(dir);i.files[2].bytes+=1;writeInt(dir,i);assert.throws(()=>verifyDatasetIntegrity(dir),/checksum/i);});
  withScratch(dir=>{const i=readInt(dir);i.files[3].sha256=i.files[3].sha256.toUpperCase();writeInt(dir,i);assert.throws(()=>verifyDatasetIntegrity(dir),/checksum/i,'hash comparison is exact (hex lower-case)');});
});

test('missing: absent dataset file, integrity.json or manifest.json fails (never "valid")',()=>{
  for(const file of ['sky.json','planets.json','validation.json','sites/nobile-rim-1.json'])
    withScratch(dir=>{rmSync(join(dir,file));assert.throws(()=>verifyDatasetIntegrity(dir),/ENOENT|no such file/i,file);});
  withScratch(dir=>{rmSync(join(dir,'integrity.json'));assert.throws(()=>verifyDatasetIntegrity(dir),/ENOENT|no such file/i);});
  withScratch(dir=>{rmSync(join(dir,'manifest.json'));assert.throws(()=>verifyDatasetIntegrity(dir),/ENOENT|no such file/i);});
  assert.throws(()=>verifyDatasetIntegrity(join(tmpdir(),'lunar-integrity-does-not-exist')),/ENOENT|no such file/i);
});

test('missing/omitted: an integrity record that omits a required file or has the wrong shape fails',()=>{
  withScratch(dir=>{const i=readInt(dir);i.files.pop();writeInt(dir,i);assert.throws(()=>verifyDatasetIntegrity(dir),/omits/i);});
  withScratch(dir=>{const i=readInt(dir);i.files=[];writeInt(dir,i);assert.throws(()=>verifyDatasetIntegrity(dir),/omits/i);});
  withScratch(dir=>{const i=readInt(dir);delete i.files;writeInt(dir,i);assert.throws(()=>verifyDatasetIntegrity(dir),/Unsupported|missing/i);});
  withScratch(dir=>{const i=readInt(dir);i.files='x';writeInt(dir,i);assert.throws(()=>verifyDatasetIntegrity(dir),/Unsupported|missing/i);});
  withScratch(dir=>{const i=readInt(dir);i.schemaVersion='2.0.0';writeInt(dir,i);assert.throws(()=>verifyDatasetIntegrity(dir),/Unsupported|missing/i);});
  withScratch(dir=>{writeFileSync(join(dir,'integrity.json'),'{not json');assert.throws(()=>verifyDatasetIntegrity(dir));});
  for(const bad of [null,{},{file:7},{file:null}])
    withScratch(dir=>{const i=readInt(dir);i.files[0]=bad;writeInt(dir,i);assert.throws(()=>verifyDatasetIntegrity(dir),/Invalid integrity entry/i,JSON.stringify(bad));});
});

test('stale record: integrity for a different manifest generation is rejected',()=>withScratch(dir=>{
  const i=readInt(dir);i.manifestGeneratedAtUtc='2020-01-01T00:00:00Z';writeInt(dir,i);
  assert.throws(()=>verifyDatasetIntegrity(dir),/different manifest generation/i);
}));

test('duplicated: the same file listed twice (even with valid hashes) is rejected',()=>withScratch(dir=>{
  const i=readInt(dir);i.files.push({...i.files[0]});writeInt(dir,i);
  assert.throws(()=>verifyDatasetIntegrity(dir),/duplicated/i);
  const j=readInt(dir);j.files=[...j.files.slice(0,-1)];j.files[1]={...j.files[0]};writeInt(dir,j);
  assert.throws(()=>verifyDatasetIntegrity(dir),/duplicated|omits/i,'duplicate that replaces another entry');
}));

test('path escape: ../, absolute, nested-dot and backslash paths are rejected without reading outside the directory',()=>{
  const bad=['../manifest.json','../../package.json','sites/../../package.json','/etc/passwd','C:\\Windows\\win.ini','C:/Windows/win.ini','..\\manifest.json','sites\\..\\..\\package.json','sites/connecting-ridge.json/../../../package.json','','.', 'sites/','./manifest.json','starmap/starmap.json','integrity.json','manifest.json\0'];
  for(const path of bad){
    withScratch(dir=>{
      const i=readInt(dir);i.files[0]={file:path,bytes:1,sha256:'0'.repeat(64)};writeInt(dir,i);
      assert.throws(()=>verifyDatasetIntegrity(dir),/Unexpected, duplicated or unsafe|Invalid integrity|ENOENT|Unsupported|null bytes|must be/i,'accepted path: '+JSON.stringify(path));
    });
  }
});

test('path escape: an entry pointing at a real file outside the directory with a CORRECT hash is still rejected',()=>{
  const outer=mkdtempSync(join(tmpdir(),'lunar-integrity-outer-'));
  try{
    const dir=join(outer,'data');mkdirSync(join(dir,'sites'),{recursive:true});
    for(const f of FILES){mkdirSync(dirname(join(dir,f)),{recursive:true});copyFileSync(join(REAL,f),join(dir,f));}
    const decoy=Buffer.from('decoy outside the dataset');writeFileSync(join(outer,'secret.txt'),decoy);
    const i=readInt(dir);i.files[0]={file:'../secret.txt',bytes:decoy.length,sha256:sha(decoy)};writeInt(dir,i);
    assert.throws(()=>verifyDatasetIntegrity(dir),/unsafe/i);
    // sibling directory with a common prefix (…/data-evil) must not pass the prefix test
    const evil=join(outer,'data-evil');mkdirSync(evil);writeFileSync(join(evil,'x.json'),decoy);
    const j=readInt(dir);j.files[0]={file:'../data-evil/x.json',bytes:decoy.length,sha256:sha(decoy)};writeInt(dir,j);
    assert.throws(()=>verifyDatasetIntegrity(dir),/unsafe/i);
  }finally{rmSync(outer,{recursive:true,force:true});}
});

test('unexpected extra entries (files that exist but are not part of the derived dataset) are rejected',()=>withScratch(dir=>{
  mkdirSync(join(dir,'extra'),{recursive:true});const b=Buffer.from('{}');writeFileSync(join(dir,'extra/x.json'),b);
  const i=readInt(dir);i.files.push({file:'extra/x.json',bytes:b.length,sha256:sha(b)});writeInt(dir,i);
  assert.throws(()=>verifyDatasetIntegrity(dir),/unsafe|Unexpected/i);
}));

test('a site list change in the manifest is detected: a new site must be hashed too',()=>withScratch(dir=>{
  const m=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
  m.sites.push({...m.sites[0],id:'extra-site',file:'sites/extra-site.json'});
  const bytes=Buffer.from(JSON.stringify(m));writeFileSync(join(dir,'manifest.json'),bytes);
  const i=readInt(dir);i.files[0]={file:'manifest.json',bytes:bytes.length,sha256:sha(bytes)};writeInt(dir,i);
  assert.throws(()=>verifyDatasetIntegrity(dir),/omits/i);
}));

test('the verifier is exported for tests and the workflow pins action SHAs (CI hardening)',()=>{
  assert.equal(typeof verifyDatasetIntegrity,'function');
  const wfDir=join(ROOT,'.github','workflows');
  if(!existsSync(wfDir))return; // workflow not present in this checkout
  for(const f of readdirSync(wfDir).filter(n=>/\.ya?ml$/.test(n))){
    const text=readFileSync(join(wfDir,f),'utf8');
    for(const m of text.matchAll(/uses:\s*([^\s#]+)/g)){
      if(m[1].startsWith('./'))continue;
      assert.match(m[1],/@[0-9a-f]{40}$/,`${f}: action not pinned to a commit SHA: ${m[1]}`);
    }
    assert.match(text,/check:data|check-data-integrity/,`${f} runs the integrity check`);
  }
});
void pathToFileURL;
