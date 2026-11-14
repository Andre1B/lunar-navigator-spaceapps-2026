// Independent tests for src/lib/analysis.mjs. Expected values are derived by hand
// (analytic geometry / small hand-built series), not by re-implementing the functions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {timeAt,indexAt,windowBounds,runs,summarize,eventSummary,visibleDiskFraction,horizonAt,percent,hours} from '../src/lib/analysis.mjs';

const close=(a,b,eps=1e-9,msg='')=>assert.ok(Math.abs(a-b)<=eps,`${msg} expected ${b}, got ${a}`);
const period={startUtc:'2027-03-01T00:00:00Z',stepMinutes:60,sampleCount:1393};

test('timeAt/indexAt are inverse and use UTC minutes',()=>{
  assert.equal(timeAt(period,0),'2027-03-01T00:00:00.000Z');
  assert.equal(timeAt(period,25),'2027-03-02T01:00:00.000Z');
  assert.equal(timeAt(period,1392),'2027-04-28T00:00:00.000Z');
  assert.equal(indexAt(period,'2027-03-02T01:00:00Z'),25);
  assert.equal(indexAt(period,'2027-03-01T00:30:00Z'),0.5);
  assert.equal(indexAt(period,'2027-02-28T23:00:00Z'),-1);
  assert.equal(indexAt({...period,stepMinutes:5},'2027-03-01T01:00:00Z'),12);
});

test('windowBounds: basic window, delay and exact coverage limits',()=>{
  assert.deepEqual(windowBounds(period,'2027-03-01T00:00:00Z',1),{start:0,end:24});
  assert.deepEqual(windowBounds(period,'2027-03-01T00:00:00Z',14,2),{start:48,end:48+336});
  // 58 days = 1392 h = last sample index: allowed (end === sampleCount-1)
  assert.deepEqual(windowBounds(period,'2027-03-01T00:00:00Z',58),{start:0,end:1392});
  // one hour more than the data covers
  assert.equal(windowBounds(period,'2027-03-01T00:00:00Z',58+1/24),null);
  assert.deepEqual(windowBounds(period,'2027-04-27T00:00:00Z',1),{start:1368,end:1392});
  assert.equal(windowBounds(period,'2027-04-27T00:00:01Z',1),null,'1 s past the last full-day start overflows');
});

test('windowBounds rejects out-of-range, non-positive and invalid input',()=>{
  assert.equal(windowBounds(period,'2027-02-28T23:00:00Z',1),null,'starts before the period');
  assert.equal(windowBounds(period,'2027-03-01T00:00:00Z',0),null);
  assert.equal(windowBounds(period,'2027-03-01T00:00:00Z',-3),null);
  assert.equal(windowBounds(period,'2027-03-01T00:00:00Z',1,-1),null,'negative delay pushes start before data');
  assert.equal(windowBounds(period,'2027-03-01T00:00:00Z',NaN),null);
  assert.equal(windowBounds(period,'2027-03-01T00:00:00Z',Infinity),null);
});

test('windowBounds works with a finer step (30 min) and rounds fractional indices',()=>{
  const p={startUtc:'2027-03-01T00:00:00Z',stepMinutes:30,sampleCount:100};
  assert.deepEqual(windowBounds(p,'2027-03-01T00:00:00Z',1),{start:0,end:48});
  assert.deepEqual(windowBounds(p,'2027-03-01T00:15:00Z',1),{start:1,end:49}); // 0.5 rounds up
});

test('runs: closed intervals, hours = samples*step, interior runs uncensored',()=>{
  const r=runs([1,0,0,1,0,1],v=>v<=0,2);
  assert.deepEqual(r,[{start:1,end:3,hours:4,censored:false},{start:4,end:5,hours:2,censored:true}]); // run reaching the last sample is censored
});

test('runs: censoring at start and at end of window',()=>{
  assert.deepEqual(runs([0,0,1,1],v=>v<=0,1),[{start:0,end:2,hours:2,censored:true}]);
  const r=runs([1,1,0,0,0],v=>v<=0,1);
  assert.equal(r.length,1);
  assert.equal(r[0].censored,true);
  assert.equal(r[0].start,2);
  assert.deepEqual(runs([1,1,1],v=>v<=0,1),[]);
});

test('summarize: trapezoid mean, left-endpoint fractions, dark-run duration (hand computed)',()=>{
  // sun: 0.5 0.5 0 0 0.5 0.5 -> 5 intervals
  // trapezoid mean = (0.5+0.25+0+0.25+0.5)/5 = 0.3 ; sunlit intervals (left>0): idx 0,1,4 -> 3/5
  const data={sun:{visibleFraction:{'1':[9,0.5,0.5,0,0,0.5,0.5,9]}},earth:{visibleFraction:{'1':[9,1,1,1,0,0,0,9]}}};
  const s=summarize(data,1,{start:1,end:6},30);
  close(s.meanSun,0.3);
  close(s.sunlitFraction,0.6);
  assert.equal(s.stepHours,0.5);
  assert.equal(s.sun.length,6,'slice includes both bounds and excludes outside samples');
  assert.deepEqual({h:s.dark.hours,c:s.dark.censored},{h:1,c:false}); // 2 intervals * 0.5 h
  // earth: 1 1 1 0 0 0 -> 3/5 of intervals visible; no-earth run touches the window end
  close(s.earthFraction,0.6);
  assert.equal(s.noEarth.censored,true);
  close(s.noEarth.hours,1);
});

test('summarize: constant series',()=>{
  const data={sun:{visibleFraction:{'5':[1,1,1,1]}},earth:{visibleFraction:{'5':[0,0,0,0]}}};
  const s=summarize(data,5,{start:0,end:3});
  close(s.meanSun,1);close(s.sunlitFraction,1);close(s.earthFraction,0);
  assert.equal(s.dark.hours,0);
  assert.equal(s.noEarth.censored,true);
  assert.equal(s.noEarth.hours,3);
});

test('summarize: returns null for unusable input',()=>{
  const ok={sun:{visibleFraction:{'1':[1,1,1]}},earth:{visibleFraction:{'1':[1,1,1]}}};
  assert.equal(summarize(null,1,{start:0,end:2}),null);
  assert.equal(summarize(ok,1,null),null);
  assert.equal(summarize(ok,1,{start:1,end:1}),null,'single sample has no interval');
  const nan={sun:{visibleFraction:{'1':[1,NaN,1]}},earth:{visibleFraction:{'1':[1,1,1]}}};
  assert.equal(summarize(nan,1,{start:0,end:2}),null);
  const shortEarth={sun:{visibleFraction:{'1':[1,1,1]}},earth:{visibleFraction:{'1':[1,1]}}};
  assert.equal(summarize(shortEarth,1,{start:0,end:2}),null);
});

test('visibleDiskFraction: analytic circular-segment values',()=>{
  const R=0.27;
  close(visibleDiskFraction(0,0,R),0.5,1e-12,'centre on horizon');
  assert.equal(visibleDiskFraction(R,0,R),1);
  assert.equal(visibleDiskFraction(5,0,R),1);
  assert.equal(visibleDiskFraction(-R,0,R),0);
  assert.equal(visibleDiskFraction(-5,0,R),0);
  // d=0.5: 1-(acos(.5)-.5*sqrt(.75))/pi = 0.80450
  close(visibleDiskFraction(0.5*R,0,R),1-(Math.PI/3-0.5*Math.sqrt(0.75))/Math.PI,1e-12);
  close(visibleDiskFraction(0.5*R,0,R),0.80450,1e-4);
  close(visibleDiskFraction(0.5*R,0,R)+visibleDiskFraction(-0.5*R,0,R),1,1e-12,'symmetry');
});

test('visibleDiskFraction depends only on (elevation-horizon)/radius and is monotonic',()=>{
  close(visibleDiskFraction(3.1,3,0.5),visibleDiskFraction(0.1,0,0.5),1e-12);
  close(visibleDiskFraction(0.2,0,0.4),visibleDiskFraction(0.4,0,0.8),1e-12);
  let prev=-1;
  for(let e=-0.3;e<=0.3;e+=0.01){const f=visibleDiskFraction(e,0,0.25);assert.ok(f>=prev,'monotonic');assert.ok(f>=0&&f<=1);prev=f;}
});

test('visibleDiskFraction returns null for invalid inputs',()=>{
  assert.equal(visibleDiskFraction(NaN,0,1),null);
  assert.equal(visibleDiskFraction(0,Infinity,1),null);
  assert.equal(visibleDiskFraction(0,0,0),null);
  assert.equal(visibleDiskFraction(0,0,-1),null);
  assert.equal(visibleDiskFraction(0,0,undefined),null);
});

test('horizonAt: linear interpolation and 360° wraparound',()=>{
  const h=[10,20,30,40]; // samples every 90°
  assert.equal(horizonAt(h,0),10);
  assert.equal(horizonAt(h,90),20);
  close(horizonAt(h,45),15);
  close(horizonAt(h,315),25,1e-12,'between last sample and first');
  close(horizonAt(h,359.999),10,1e-3);
  assert.equal(horizonAt(h,360),10);
  assert.equal(horizonAt(h,450),20);
  close(horizonAt(h,-45),25,1e-12,'negative azimuth wraps');
  close(horizonAt(h,-90-360),40,1e-12);
});

test('horizonAt with 720 samples (0.5°)',()=>{
  const h=Array.from({length:720},(_,i)=>i);
  assert.equal(horizonAt(h,0.5),1);
  assert.equal(horizonAt(h,359.5),719);
  close(horizonAt(h,359.75),359.5,1e-9,'halfway between sample 719 (719) and sample 0 (0)');
});

test('formatters',()=>{
  assert.equal(percent(null),'Not calculated');
  assert.equal(percent(undefined),'Not calculated');
  assert.equal(percent(0),'0.0%');
  assert.equal(percent(0.4822),'48.2%');
  assert.equal(hours(null),'Not calculated');
  assert.equal(hours({hours:240.67,censored:false}),'241 h');
  assert.equal(hours({hours:12,censored:true}),'≥ 12 h');
});

// Regression: an unparsable date used to throw RangeError (Date#toISOString).
test('windowBounds returns null (does not throw) for an unparsable date',()=>{
  assert.equal(windowBounds(period,'not a date',1),null);
  assert.equal(windowBounds(period,'2027-03-01T00:00:00Z',1,NaN),null);
});

// ---- eventSummary: durations from refined events (hand-built 12 h series, 1 m events) ----
const evPeriod={startUtc:'2027-03-01T00:00:00Z',stepMinutes:60,sampleCount:12};
const at=(h,m=0)=>`2027-03-01T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`;
const mkData=(events,sun0=1,earth0=1)=>({
  sun:{visibleFraction:{'1':[sun0,...Array(11).fill(0.5)],'5':Array(12).fill(0.5)}},
  earth:{visibleFraction:{'1':[earth0,...Array(11).fill(0.5)],'5':Array(12).fill(0.5)}},
  events});
const ev=(type,utc,heightM=1)=>({type,heightM,utc,resolutionMin:1,refined:true});

test('eventSummary: transitions inside the window give exact visible fraction and uncensored gap',()=>{
  const d=mkData([ev('sunset',at(4)),ev('sunrise',at(6))]);
  const s=eventSummary(d,1,{start:2,end:8},evPeriod);
  close(s.sunlitFraction,4/6);           // 2-4 h and 6-8 h visible
  assert.deepEqual(s.dark,{hours:2,censored:false});
  close(s.earthFraction,1);               // no earth events, earth visible at sample 0
  assert.deepEqual(s.noEarth,{hours:0,censored:false});
  assert.match(s.durationMethod,/event search/);
  close(s.meanSun,0.5,1e-12,'meanSun stays the hourly trapezoid value');
});

test('eventSummary: sub-hour precision that the hourly series cannot represent',()=>{
  const d=mkData([ev('sunset',at(4,30)),ev('sunrise',at(5,10))]);
  const s=eventSummary(d,1,{start:2,end:8},evPeriod);
  close(s.dark.hours,40/60,1e-12);
  close(s.sunlitFraction,(6-40/60)/6,1e-12);
});

test('eventSummary: last event before window start decides the initial state (censored at start)',()=>{
  const d=mkData([ev('sunset',at(0,30)),ev('sunrise',at(3))]);
  const s=eventSummary(d,1,{start:2,end:8},evPeriod);
  assert.deepEqual(s.dark,{hours:1,censored:true});
  close(s.sunlitFraction,5/6);
});

test('eventSummary: no events at all falls back to sample 0 state',()=>{
  let s=eventSummary(mkData([],1),1,{start:2,end:8},evPeriod);
  close(s.sunlitFraction,1);assert.equal(s.dark.hours,0);
  s=eventSummary(mkData([],0),1,{start:2,end:8},evPeriod);
  close(s.sunlitFraction,0);assert.deepEqual(s.dark,{hours:6,censored:true});
});

test('eventSummary: event exactly at window start sets state without splitting; at window end is ignored',()=>{
  let s=eventSummary(mkData([ev('sunset',at(2)),ev('sunrise',at(5))]),1,{start:2,end:8},evPeriod);
  assert.deepEqual(s.dark,{hours:3,censored:true},'sunset at begin: dark from the first instant');
  close(s.sunlitFraction,3/6);
  s=eventSummary(mkData([ev('sunset',at(6)),ev('sunrise',at(8))]),1,{start:2,end:8},evPeriod);
  assert.deepEqual(s.dark,{hours:2,censored:true},'sunrise exactly at end does not shorten the gap');
  close(s.sunlitFraction,4/6);
});

test('eventSummary: gap touching the end is censored; longest of several gaps wins',()=>{
  const d=mkData([ev('sunset',at(3)),ev('sunrise',at(4)),ev('sunset',at(5)),ev('sunrise',at(7))]);
  const s=eventSummary(d,1,{start:2,end:8},evPeriod);
  assert.deepEqual(s.dark,{hours:2,censored:false});
  const e=eventSummary(mkData([ev('sunset',at(7))]),1,{start:2,end:8},evPeriod);
  assert.deepEqual(e.dark,{hours:1,censored:true});
});

test('eventSummary: unsorted events, other heights and Earth events are handled independently',()=>{
  const d=mkData([ev('sunrise',at(6)),ev('sunset',at(4)),ev('sunset',at(3),5),ev('earthset',at(5)),ev('earthrise',at(7))]);
  const s=eventSummary(d,1,{start:2,end:8},evPeriod);
  assert.deepEqual(s.dark,{hours:2,censored:false});
  assert.deepEqual(s.noEarth,{hours:2,censored:false});
  close(s.earthFraction,4/6);
  const s5=eventSummary(d,5,{start:2,end:8},evPeriod);
  assert.deepEqual(s5.dark,{hours:5,censored:true},'5 m: sunset at 03:00 and no sunrise');
});

test('eventSummary: invalid input and missing events',()=>{
  assert.equal(eventSummary(mkData([]),1,null,evPeriod),null);
  assert.equal(eventSummary(null,1,{start:0,end:5},evPeriod),null);
  const noEvents=mkData(undefined);delete noEvents.events;
  const s=eventSummary(noEvents,1,{start:2,end:8},evPeriod);
  assert.ok(s&&!('durationMethod' in s),'falls back to the sampled summary');
});

test('eventSummary agrees with sampled summarize within 1 h on real data (4 sites x 3 windows)',async()=>{
  const {readFileSync}=await import('node:fs');
  const man=JSON.parse(readFileSync(new URL('../public/data/manifest.json',import.meta.url)));
  for(const site of man.sites){
    const data=JSON.parse(readFileSync(new URL('../public/data/'+site.file,import.meta.url)));
    for(const [date,days] of [['2027-03-01',7],['2027-03-10',14],['2027-03-30',28]])for(const h of [1,5]){
      const b=windowBounds(man.period,date,days);
      const a=summarize(data,h,b,60),e=eventSummary(data,h,b,man.period);
      assert.ok(Math.abs(a.sunlitFraction-e.sunlitFraction)<0.03,`${site.id} ${date} ${h} sunlit ${a.sunlitFraction} vs ${e.sunlitFraction}`);
      assert.ok(Math.abs(a.earthFraction-e.earthFraction)<0.03,`${site.id} ${date} ${h} earth`);
      assert.ok(Math.abs(a.dark.hours-e.dark.hours)<=6,`${site.id} ${date} ${h} dark ${a.dark.hours} vs ${e.dark.hours}`);
      assert.ok(e.dark.hours<=days*24&&e.noEarth.hours<=days*24);
    }
  }
});
