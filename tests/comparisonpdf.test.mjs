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
const DAY_MS=86400000;
const coverageStart=manifest.period.startUtc.slice(0,10);
const coverageEnd=manifest.period.endUtc.slice(0,10);
const arrivalDays=7;
const asOfDate=manifest.coveragePolicy.asOfUtcDate;
const lastArrivalDate=new Date(Date.parse(manifest.period.endUtc)-arrivalDays*DAY_MS).toISOString().slice(0,10);
const dataset={
  manifest,
  validation:json('validation.json'),
  integrity:json('integrity.json'),
  sites:Object.fromEntries(manifest.sites.map(s=>[s.id,json(s.file)])),
};

test('rolling PDF is a styled, bounded report with explicit time/disc percentages and complete arrival dates',async()=>{
  const settings={siteId:'connecting-ridge',alternative:'connecting-neighbor',height:1,date:asOfDate,days:arrivalDays,delay:7};
  const arrivalMs=Date.parse(`${settings.date}T00:00:00Z`),startMs=Date.parse(manifest.period.startUtc),endMs=Date.parse(manifest.period.endUtc);
  assert.ok(arrivalMs>=startMs&&arrivalMs+arrivalDays*DAY_MS<=endMs,`as-of arrival ${settings.date} must fit within published coverage`);
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
  assert.ok(text.includes(coverageStart),`appendix begins at rolling coverage start ${coverageStart}`);
  assert.ok(text.includes(lastArrivalDate),`appendix includes the last arrival whose ${arrivalDays}-day stay fits (${lastArrivalDate}; coverage ends ${coverageEnd})`);
  assert.match(text,/full computed eclipse/i,'eclipse contacts and scope are explained');
  assert.match(text,/No settings or data were uploaded/i,'local generation/privacy disclosure is present');
  assert.doesNotMatch(text,/\b(?:NaN|Infinity)\b/,'computed report text contains no non-finite placeholders');
  const bytes=Buffer.from(doc.output('arraybuffer'));
  assert.equal(bytes.subarray(0,5).toString('ascii'),'%PDF-');
  assert.ok(bytes.length>50000&&bytes.length<2_000_000,`PDF size ${bytes.length}`);
});
