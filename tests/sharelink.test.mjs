import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {comparisonHash,readComparisonHash,STAY_DAYS,DELAY_DAYS} from '../src/lib/shareLink.mjs';
import {comparisonRows} from '../src/lib/comparisonReport.mjs';

const DATA=join(dirname(fileURLToPath(import.meta.url)),'..','public','data');
const json=(path)=>JSON.parse(readFileSync(join(DATA,path),'utf8'));
const manifest=json('manifest.json');
const dataset={manifest,sites:Object.fromEntries(manifest.sites.map(s=>[s.id,json(s.file)]))};

test('comparison links serialize only the six settings and restore exact values',()=>{
  const settings={siteId:'nobile-rim-1',height:2,date:'2026-11-16',days:14,delay:3,alternative:'connecting-neighbor'};
  const hash=comparisonHash(settings);
  assert.match(hash,/^#\/compare\?/);
  const params=new URLSearchParams(hash.slice(hash.indexOf('?')+1));
  assert.deepEqual([...params.keys()],['site','h','arr','days','delay','alt']);
  const parsed=readComparisonHash(hash,manifest);
  assert.deepEqual(parsed,{settings,rejected:[],covered:true});
  const before=comparisonRows(dataset,settings);
  const after=comparisonRows(dataset,parsed.settings);
  assert.deepEqual(after.map(r=>({id:r.id,offset:r.offset,bounds:r.bounds,summary:r.summary})),before.map(r=>({id:r.id,offset:r.offset,bounds:r.bounds,summary:r.summary})));
});

test('untrusted comparison links reject unknown ids, heights, windows and impossible dates field by field',()=>{
  const parsed=readComparisonHash('#/compare?site=unknown&h=99&arr=2027-02-31&days=9&delay=30&alt=not-a-site',manifest);
  assert.deepEqual(parsed.settings,{});
  assert.deepEqual(parsed.rejected,['site','alt','h','days','delay','arr']);
  assert.equal(parsed.covered,true,'invalid fields are ignored and do not produce an invented out-of-coverage date');
  assert.equal(readComparisonHash('#/compare?arr=2029-01-01&days=7&delay=14',manifest).covered,false);
  assert.deepEqual(readComparisonHash('#/compare?site=shackleton-rim&days=14',manifest),{
    settings:{siteId:'shackleton-rim',days:14},rejected:[],covered:true,
  });
});

test('stay and delay choices are limited to the published UI values',()=>{
  assert.deepEqual(STAY_DAYS,[3,7,14,28]);
  assert.deepEqual(DELAY_DAYS,[1,3,7,14,29]);
  for(const days of [0,1,2,5,30])assert.ok(readComparisonHash(`#/compare?days=${days}`,manifest).rejected.includes('days'));
  for(const delay of [0,2,15,30])assert.ok(readComparisonHash(`#/compare?delay=${delay}`,manifest).rejected.includes('delay'));
});

test('non-Compare routes and empty comparison queries are not treated as shared settings',()=>{
  assert.equal(readComparisonHash('#/home?site=shackleton-rim',manifest),null);
  assert.equal(readComparisonHash('#/compare',manifest),null);
  assert.equal(readComparisonHash('#/compare?utm_source=test',manifest),null);
});
