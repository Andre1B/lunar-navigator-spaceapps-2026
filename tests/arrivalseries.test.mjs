// Independent tests for src/lib/arrivalSeries.mjs. Counts and dates come from period arithmetic
// (a window of d days fits when start + d*24 h <= last sample), and each entry is compared with the
// Compare table path (comparisonRows) for the same date.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {arrivalSeries} from '../src/lib/arrivalSeries.mjs';
import {comparisonRows} from '../src/lib/comparisonReport.mjs';

const DATA=join(dirname(fileURLToPath(import.meta.url)),'..','public','data');
const json=(f)=>JSON.parse(readFileSync(join(DATA,f),'utf8'));
const manifest=json('manifest.json');
const sites=Object.fromEntries(manifest.sites.map(s=>[s.id,json(s.file)]));
const period=manifest.period;
const dataset={manifest,sites};
const coverageDays=(period.sampleCount-1)*period.stepMinutes/1440;
const addDays=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const validArrivalDates=(p,days)=>{
  const first=Date.parse(p.startUtc),last=first+(p.sampleCount-1)*p.stepMinutes*60000,windowMs=days*86400000;
  const dates=[];
  for(let t=first;t+windowMs<=last;t+=86400000)dates.push(new Date(t).toISOString().slice(0,10));
  return dates;
};
const close=(a,b,eps,m='')=>assert.ok(Math.abs(a-b)<=eps,`${m} got ${a} expected ${b}`);

test('arrivalSeries: one entry per UTC start day while the full window fits',()=>{
  const d=sites['malapert-massif'];
  for(const days of [1,3,7,14,28,365,730]){
    const s=arrivalSeries(d,period,1,days);
    const dates=validArrivalDates(period,days);
    const expected=dates.length;
    assert.equal(s.length,expected,`days=${days}`);
    if(!expected){assert.deepEqual(s,[],`days=${days}: no full stay fits`);continue;}
    assert.equal(s[0].date,dates[0]);
    assert.equal(s.at(-1).date,dates.at(-1),`last date for ${days} d`);
    s.forEach((e,k)=>assert.equal(e.date,dates[k],'consecutive daily dates'));
    assert.ok(s.every(e=>e.summary&&typeof e.summary.meanSun==='number'),'every entry calculated');
  }
  assert.deepEqual(arrivalSeries(d,period,1,coverageDays+1),[],'window longer than the coverage');
  assert.deepEqual(arrivalSeries(d,period,1,coverageDays+0.5),[],'fractional window that cannot fit from first UTC midnight');
});

test('arrivalSeries: never extrapolates (last window ends exactly on the last sample, one more day would not fit)',()=>{
  for(const [id,d] of Object.entries(sites))for(const days of [3,7,14,28]){
    const s=arrivalSeries(d,period,1,days);const last=s.at(-1);
    const endH=(Date.parse(last.date+'T00:00:00Z')-Date.parse(period.startUtc))/3600000+days*24;
    assert.equal(endH,period.sampleCount-1,`${id} ${days} d: last window must end at the last sample`);
    for(const e of s)assert.ok(e.summary.dark.hours<=days*24+1e-9,'duration bounded by the window');
  }
});

test('arrivalSeries: every entry equals the Compare table row (original arrival) for that date, all sites and heights',()=>{
  for(const [id,d] of Object.entries(sites))for(const height of [1,5,'5'])for(const days of [3,7,28]){
    const s=arrivalSeries(d,period,height,days);
    for(const e of s){
      const row=comparisonRows(dataset,{siteId:id,alternative:id,height,date:e.date,days,delay:7})[0];
      assert.ok(row.summary,`${id} ${e.date}`);
      for(const k of ['meanSun','sunlitFraction','earthFraction'])close(e.summary[k],row.summary[k],1e-12,`${id} ${e.date} ${days}d h=${height} ${k}`);
      assert.deepEqual(e.summary.dark,row.summary.dark,`${id} ${e.date} dark`);
      assert.deepEqual(e.summary.noEarth,row.summary.noEarth,`${id} ${e.date} noEarth`);
    }
  }
});

test('arrivalSeries: documented Malapert values (first two dates censored, later ones not, 79.9 h)',()=>{
  const s=arrivalSeries(sites['malapert-massif'],period,1,7);
  assert.ok(s.length>0);
  assert.ok(s.every(e=>Number.isFinite(e.summary.dark.hours)&&e.summary.dark.hours>=0&&e.summary.dark.hours<=168));
  assert.ok(s.some(e=>e.summary.dark.censored),'some dates touch a simulated boundary');
  assert.ok(s.some(e=>!e.summary.dark.censored),'some dates have a resolved darkness interval');
  assert.ok(new Set(s.map(e=>e.summary.dark.hours.toFixed(1))).size>10,'darkness varies with arrival date');
});

test('arrivalSeries: height 1 and "5" are accepted as numbers or strings and change the numbers',()=>{
  const d=sites['connecting-ridge'];
  const a=arrivalSeries(d,period,1,7),b=arrivalSeries(d,period,5,7),c=arrivalSeries(d,period,'5',7);
  assert.deepEqual(b,c);
  assert.equal(a.length,b.length);
  assert.ok(b.every((e,k)=>e.summary.meanSun>=a[k].summary.meanSun-1e-3),'5 m sees at least as much Sun');
  assert.ok(a.some((e,k)=>e.summary.meanSun!==b[k].summary.meanSun),'heights differ');
  assert.equal(arrivalSeries(d,period,1,'7').length,validArrivalDates(period,7).length,'numeric string for days');
});

test('arrivalSeries: invalid input returns an empty series and never throws',()=>{
  const d=sites['connecting-ridge'];
  const bad=[[null,period,1,7],[undefined,period,1,7],[d,period,1,0],[d,period,1,-3],[d,period,1,NaN],[d,period,1,'abc'],[d,period,1,Infinity],[d,period,NaN,7],[d,period,'x',7],
    [d,null,1,7],[d,undefined,1,7],[d,{},1,7],[d,{startUtc:'garbage',stepMinutes:60,sampleCount:1393},1,7],[d,{...period,sampleCount:0},1,7],[d,{...period,stepMinutes:0},1,7]];
  for(const args of bad){let r;assert.doesNotThrow(()=>{r=arrivalSeries(...args);},JSON.stringify(args.slice(2)));assert.deepEqual(r,[],JSON.stringify([args[2],args[3],args[1]&&args[1].startUtc]));}
  // site data without events: still returns entries (eventSummary falls back to the sampled summary), no throw
  assert.doesNotThrow(()=>arrivalSeries({...d,events:undefined},period,1,7));
});

test('arrivalSeries: finer or coarser grids keep the same arithmetic (3-hourly toy period)',()=>{
  const toy={startUtc:'2027-03-01T00:00:00Z',stepMinutes:180,sampleCount:49}; // 6 days: last index 48 = 144 h
  const n=toy.sampleCount;const mk=(v)=>Array(n).fill(v);
  const site={events:[],sun:{visibleFraction:{'1':mk(0.5)}},earth:{visibleFraction:{'1':mk(1)}}};
  const s=arrivalSeries(site,toy,1,2);
  assert.equal(s.length,5,'6-day period, 2-day windows -> 5 start days');
  assert.equal(s.at(-1).date,'2027-03-05');
  assert.deepEqual(arrivalSeries(site,toy,1,7),[]);
});

test('arrivalSeries: UTC daily starts include leap day and stop at the last full stay without an extra day',()=>{
  const toy={startUtc:'2024-02-28T00:00:00Z',stepMinutes:60,sampleCount:73};
  const values=Array(toy.sampleCount).fill(0.5);
  const site={events:[],sun:{visibleFraction:{'1':values}},earth:{visibleFraction:{'1':Array(toy.sampleCount).fill(1)}}};
  const dates=arrivalSeries(site,toy,1,1).map(entry=>entry.date);
  assert.deepEqual(dates,['2024-02-28','2024-02-29','2024-03-01'],'daily arrivals advance in UTC across February 29');
  assert.deepEqual(arrivalSeries(site,toy,1,4),[],'a one-day stay beyond the three-day coverage cannot fit');
});
