// Independent tests for src/lib/nextEvents.mjs: hand-built sites with known answers plus real-data
// cross-checks computed by a plain scan of the published events (not by re-implementing the module).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {nextEvents,formatUntil,EVENT_TYPES,EVENT_METHOD} from '../src/lib/nextEvents.mjs';

const DATA=join(dirname(fileURLToPath(import.meta.url)),'..','public','data');
const json=(f)=>JSON.parse(readFileSync(join(DATA,f),'utf8'));
const manifest=json('manifest.json');
const sites=Object.fromEntries(manifest.sites.map(s=>[s.id,json(s.file)]));
const period={startUtc:'2027-03-01T00:00:00Z',stepMinutes:60,sampleCount:100}; // end = +99 h = 2027-03-05T03:00:00Z
const ev=(type,utc,heightM=1,resolutionMin=1)=>({type,heightM,utc,resolutionMin,refined:true});
const site=(events)=>({events,sun:{visibleFraction:{'1':[],'5':[]}},horizon:{elevationDeg:{'1':[],'5':[]}}});
const close=(a,b,eps,m='')=>assert.ok(Math.abs(a-b)<=eps,`${m} got ${a} expected ${b}`);
const by=(r,type)=>r.events.find(e=>e.type===type);
const NO='No transition in the computed period';

test('ok result shape: four events in fixed order, ISO times, hoursUntil, height number, period end',()=>{
  const r=nextEvents(site([ev('sunset','2027-03-01T10:46:06Z'),ev('earthrise','2027-03-02T01:34:13Z')]),period,0,1);
  assert.equal(r.status,'ok');
  assert.deepEqual(r.events.map(e=>e.type),['sunrise','sunset','earthrise','earthset']);
  assert.deepEqual(EVENT_TYPES,['sunrise','sunset','earthrise','earthset']);
  assert.equal(r.height,1);assert.equal(r.nowUtc,'2027-03-01T00:00:00.000Z');assert.equal(r.periodEndUtc,'2027-03-05T03:00:00.000Z');
  assert.equal(by(r,'sunset').utc,'2027-03-01T10:46:06Z');
  close(by(r,'sunset').hoursUntil,10+46/60+6/3600,1e-9);
  assert.equal(by(r,'sunset').label,'in 10 h 46 min');
  assert.equal(by(r,'sunrise').utc,null);assert.equal(by(r,'sunrise').label,NO);assert.equal(by(r,'sunrise').hoursUntil,null);assert.equal(by(r,'sunrise').resolutionMin,null);
  assert.equal(by(r,'earthrise').resolutionMin,1);
  assert.match(EVENT_METHOD,/5-minute/);assert.match(EVENT_METHOD,/1 minute/);
});

test('strictly after "now": an event exactly at the displayed instant is not next; one second later is',()=>{
  const s=site([ev('sunset','2027-03-01T10:00:00Z'),ev('sunset','2027-03-01T20:00:00Z')]);
  assert.equal(by(nextEvents(s,period,10,1),'sunset').utc,'2027-03-01T20:00:00Z','event at now is skipped');
  const s2=site([ev('sunset','2027-03-01T10:00:01Z')]);
  const r=nextEvents(s2,period,10,1);
  assert.equal(by(r,'sunset').utc,'2027-03-01T10:00:01Z');close(by(r,'sunset').hoursUntil,1/3600,1e-12);
  assert.equal(by(r,'sunset').label,'in under 1 min');
});

test('fractional timestamps: index 10.5 is 10:30, 807.49 is exact to the millisecond',()=>{
  const s=site([ev('sunset','2027-03-01T10:46:06Z')]);
  const r=nextEvents(s,period,10.5,1);
  assert.equal(r.nowUtc,'2027-03-01T10:30:00.000Z');
  close(by(r,'sunset').hoursUntil,(16*60+6)/3600,1e-9);assert.equal(by(r,'sunset').label,'in 16 min');
  const big={...period,sampleCount:1393};
  const r2=nextEvents(s,big,807.49,1);
  assert.equal(r2.nowUtc,new Date(Date.parse(period.startUtc)+807.49*3600000).toISOString());
  assert.equal(by(r2,'sunset').utc,null,'event is in the past at index 807.49');
  // quarter-hour steps
  assert.equal(nextEvents(s,{...period,stepMinutes:15},43,1).nowUtc,'2027-03-01T10:45:00.000Z');
});

test('earliest of several events wins regardless of input order; past events are never returned (no past, no future beyond the period)',()=>{
  const s=site([ev('sunrise','2027-03-04T00:00:00Z'),ev('sunrise','2027-03-02T05:00:00Z'),ev('sunrise','2027-03-01T01:00:00Z'),ev('sunrise','2027-03-05T04:00:00Z')]);
  const r=nextEvents(s,period,2,1);
  assert.equal(by(r,'sunrise').utc,'2027-03-02T05:00:00Z');
  // after 2027-03-04T00:00 only the event beyond the period end (03-05T04:00 > end 03:00) remains -> none
  const late=nextEvents(s,period,72,1);
  assert.equal(by(late,'sunrise').utc,null,'event after the period end must not be reported');
});

test('period end boundary: event exactly at the end is included, one minute later is dropped',()=>{
  const atEnd=site([ev('earthset','2027-03-05T03:00:00Z')]);
  assert.equal(by(nextEvents(atEnd,period,50,1),'earthset').utc,'2027-03-05T03:00:00Z');
  const after=site([ev('earthset','2027-03-05T03:01:00Z')]);
  assert.equal(by(nextEvents(after,period,50,1),'earthset').utc,null);
});

test('height handling: events of another height are ignored; "5" and 5 are equivalent; unmodelled heights are invalid; modelled height with no events is ok',()=>{
  const s=site([ev('sunset','2027-03-01T10:00:00Z',1),ev('sunset','2027-03-01T12:00:00Z',5)]);
  assert.equal(by(nextEvents(s,period,0,1),'sunset').utc,'2027-03-01T10:00:00Z');
  assert.equal(by(nextEvents(s,period,0,5),'sunset').utc,'2027-03-01T12:00:00Z');
  assert.deepEqual(nextEvents(s,period,0,'5').events,nextEvents(s,period,0,5).events);
  assert.equal(nextEvents(s,period,0,'5').height,5);
  const bad=nextEvents(s,period,0,3);
  assert.equal(bad.status,'invalid');assert.match(bad.reason,/3 m/);
  const none=nextEvents(site([]),period,0,1);
  assert.equal(none.status,'ok');assert.ok(none.events.every(e=>e.utc===null&&e.label===NO));
});

test('coverage: index outside [0, sampleCount-1] is out-of-coverage; the last sample is ok with nothing after it',()=>{
  const s=site([ev('sunset','2027-03-02T00:00:00Z')]);
  assert.equal(nextEvents(s,period,-0.001,1).status,'out-of-coverage');
  assert.equal(nextEvents(s,period,-5,1).status,'out-of-coverage');
  assert.equal(nextEvents(s,period,100,1).status,'out-of-coverage');
  assert.equal(nextEvents(s,period,99.0001,1).status,'out-of-coverage');
  const last=nextEvents(s,period,99,1);
  assert.equal(last.status,'ok');assert.ok(last.events.every(e=>e.utc===null&&e.label===NO));
  assert.equal(nextEvents(s,period,0,1).status,'ok','index 0 is covered');
  assert.ok(nextEvents(s,period,-1,1).reason&&nextEvents(s,period,-1,1).reason.length>5);
});

test('invalid input never throws and is reported as invalid (strict numeric parsing)',()=>{
  const s=site([ev('sunset','2027-03-02T00:00:00Z')]);
  for(const bad of [null,undefined,'','   ',true,false,NaN,Infinity,-Infinity,'abc',{},[]]){
    for(const [i,h] of [[bad,1],[0,bad]]){
      let r;assert.doesNotThrow(()=>{r=nextEvents(s,period,i,h);},`index/height ${String(bad)}`);
      assert.equal(r.status,'invalid',`index=${String(i)} height=${String(h)} -> ${r.status}`);
      assert.ok(r.reason);
    }
  }
  assert.equal(nextEvents(s,period,'10.5','5').status,'ok','numeric strings are accepted');
  for(const sd of [null,undefined,{},{events:null},{events:'x'}])assert.equal(nextEvents(sd,period,0,1).status,'invalid');
  const badPeriods=[null,undefined,{},{...period,stepMinutes:0},{...period,stepMinutes:-60},{...period,stepMinutes:Infinity},{...period,stepMinutes:null},{...period,stepMinutes:''},
    {...period,sampleCount:0},{...period,sampleCount:1.5},{...period,sampleCount:null},{...period,sampleCount:NaN},{...period,startUtc:'garbage'},{...period,startUtc:12345},{...period,startUtc:null}];
  for(const p of badPeriods){let r;assert.doesNotThrow(()=>{r=nextEvents(s,p,0,1);},JSON.stringify(p));assert.equal(r.status,'invalid',JSON.stringify(p));}
  // dates beyond the valid Date range must not raise RangeError
  let r;assert.doesNotThrow(()=>{r=nextEvents(s,{...period,stepMinutes:1e15,sampleCount:100},1,1);});
  assert.equal(r.status,'invalid');
  assert.doesNotThrow(()=>nextEvents(s,{startUtc:'+275760-09-13T00:00:00Z',stepMinutes:60,sampleCount:100},50,1));
});

test('malformed events are ignored, not fatal',()=>{
  const s=site([null,{type:'sunset'},{type:'sunset',heightM:1,utc:'nonsense'},{type:'volcano',heightM:1,utc:'2027-03-01T05:00:00Z'},ev('sunset','2027-03-01T08:00:00Z')]);
  const r=nextEvents(s,period,0,1);
  assert.equal(r.status,'ok');assert.equal(by(r,'sunset').utc,'2027-03-01T08:00:00Z');
  assert.equal(r.events.length,4);
});

test('formatUntil: minute rounding, units, and never the word "never"',()=>{
  assert.equal(formatUntil(0),'in under 1 min');
  assert.equal(formatUntil(0.004),'in under 1 min');
  assert.equal(formatUntil(0.5/60+1e-9),'in 1 min');
  assert.equal(formatUntil(1),'in 1 h');
  assert.equal(formatUntil(24),'in 1 d');
  assert.equal(formatUntil(25.5),'in 1 d 1 h 30 min');
  assert.equal(formatUntil(3526/60),'in 2 d 10 h 46 min');
  assert.equal(formatUntil(0.75),'in 45 min');
  for(const bad of [-1,NaN,Infinity,null,undefined])assert.equal(formatUntil(bad),NO);
  for(const bad of [-1,NaN])assert.doesNotMatch(formatUntil(bad),/never/i);
  assert.doesNotMatch(NO,/never/i);
});

test('real data: matches a plain scan of the published events for all sites, heights and several instants',()=>{
  const t0=Date.parse(manifest.period.startUtc),end=t0+(manifest.period.sampleCount-1)*3600000;
  for(const [id,data] of Object.entries(sites))for(const h of [1,5])for(const index of [0,12,10.5,100.25,807.49,1000,1391.5,1392]){
    const r=nextEvents(data,manifest.period,index,h);
    assert.equal(r.status,'ok',`${id} ${h} ${index}`);
    const now=t0+index*3600000;
    for(const type of EVENT_TYPES){
      const scan=data.events.filter(e=>e.heightM===h&&e.type===type&&Date.parse(e.utc)>now&&Date.parse(e.utc)<=end).map(e=>Date.parse(e.utc)).sort((a,b)=>a-b)[0];
      const got=by(r,type);
      if(scan===undefined){assert.equal(got.utc,null,`${id} ${h} ${index} ${type}`);assert.equal(got.label,NO);}
      else{assert.equal(Date.parse(got.utc),scan,`${id} ${h} ${index} ${type}`);close(got.hoursUntil,(scan-now)/3600000,1e-9);assert.ok(got.hoursUntil>0);assert.equal(got.resolutionMin,1);}
    }
  }
});

test('real data: the documented first event and monotonic progression',()=>{
  const cr=sites['connecting-ridge'];
  const r=nextEvents(cr,manifest.period,0,1);
  assert.equal(by(r,'sunset').utc,'2027-03-03T10:46:06Z');assert.equal(by(r,'sunset').label,'in 2 d 10 h 46 min');
  const r5=nextEvents(cr,manifest.period,10.5,'5');assert.equal(r5.nowUtc,'2027-03-01T10:30:00.000Z');
  const last=nextEvents(cr,manifest.period,manifest.period.sampleCount-1,1);
  assert.ok(last.events.every(e=>e.utc===null&&e.label===NO));
  assert.equal(nextEvents(cr,manifest.period,manifest.period.sampleCount,1).status,'out-of-coverage');
  // as time advances, the next event of a type never moves earlier, and when it changes the previous one has passed
  for(const [id,data] of Object.entries(sites))for(const type of EVENT_TYPES){
    let prev=null;
    for(let i=0;i<=1392;i+=0.5){
      const e=by(nextEvents(data,manifest.period,i,1),type);
      if(prev&&e.utc&&prev.utc&&e.utc!==prev.utc)assert.ok(Date.parse(prev.utc)<=Date.parse(manifest.period.startUtc)+i*3600000,`${id} ${type}: next event changed before the previous passed (${i})`);
      if(prev&&prev.utc&&e.utc)assert.ok(Date.parse(e.utc)>=Date.parse(prev.utc),`${id} ${type}: next event moved earlier at ${i}`);
      prev=e;
    }
  }
});
