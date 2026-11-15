// CPU-only smoke of the generated document; browser download/UI behavior is covered separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {createComparisonPdf} from '../src/lib/comparisonPdf.mjs';

const DATA=join(dirname(fileURLToPath(import.meta.url)),'..','public','data');
const json=(name)=>JSON.parse(readFileSync(join(DATA,name),'utf8'));
const manifest=json('manifest.json');
const dataset={
  manifest,
  validation:json('validation.json'),
  integrity:json('integrity.json'),
  sites:Object.fromEntries(manifest.sites.map(s=>[s.id,json(s.file)])),
};

test('annual PDF is a styled, bounded report with explicit time/disc percentages and complete arrival dates',async()=>{
  const settings={siteId:'connecting-ridge',alternative:'connecting-neighbor',height:1,date:'2027-03-01',days:7,delay:7};
  // Node has no page base URL, so the font request fails locally and exercises
  // the supported Helvetica fallback without contacting the network.
  const doc=await createComparisonPdf(dataset,settings,72);
  const pages=doc.internal.pages.slice(1);
  assert.ok(pages.length>=20&&pages.length<100,`unexpected page count ${pages.length}`);
  const text=pages.flat().join('\n').replaceAll('\\(','(').replaceAll('\\)',')');
  assert.match(text,/Sun visible \(% time\)/,'time-with-sunlight measure is explicit');
  assert.match(text,/Earth visible \(% time\)/,'time-with-Earth measure is explicit');
  assert.match(text,/Mean Sun disc/,'mean visible Sun disc remains a separate quantity');
  assert.match(text,/Sun disc /,'Sun arrival-disc percentage is included');
  assert.match(text,/Earth disc /,'Earth arrival-disc percentage is included');
  assert.match(text,/2025-11-15/,'appendix begins at rolling coverage start');
  assert.match(text,/2027-11-08/,'appendix ends on the last arrival whose 7-day stay fits');
  assert.match(text,/full computed eclipse/i,'eclipse contacts and scope are explained');
  assert.match(text,/No settings or data were uploaded/i,'local generation/privacy disclosure is present');
  assert.doesNotMatch(text,/\b(?:NaN|Infinity)\b/,'computed report text contains no non-finite placeholders');
  const bytes=Buffer.from(doc.output('arraybuffer'));
  assert.equal(bytes.subarray(0,5).toString('ascii'),'%PDF-');
  assert.ok(bytes.length>50000&&bytes.length<2_000_000,`PDF size ${bytes.length}`);
});
