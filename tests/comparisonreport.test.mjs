// Independent tests for src/lib/comparisonReport.mjs (table, short review and JSON record share one path).
// Expected values come from hand-built summaries, windowBounds arithmetic and an independent trapezoid mean,
// not from re-implementing the module.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {comparisonRows,assessDarkness,comparisonReport,downloadComparison} from '../src/lib/comparisonReport.mjs';

const DATA=join(dirname(fileURLToPath(import.meta.url)),'..','public','data');
const json=(f)=>JSON.parse(readFileSync(join(DATA,f),'utf8'));
const manifest=json('manifest.json'),validation=json('validation.json'),integrity=json('integrity.json');
const sites=Object.fromEntries(manifest.sites.map(s=>[s.id,json(s.file)]));
const dataset={manifest,sites,validation,integrity};
const settings={siteId:'connecting-ridge',alternative:'shackleton-rim',height:1,date:'2027-03-01',days:7,delay:7};
const close=(a,b,eps,m='')=>assert.ok(Math.abs(a-b)<=eps,`${m} got ${a} expected ${b}`);
const trapezoid=(a)=>a.slice(0,-1).reduce((s,v,i)=>s+(v+a[i+1])/2,0)/(a.length-1);
const addDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const coverageEndDate=manifest.period.endUtc.slice(0,10);
const outOfCoverageDate=addDays(coverageEndDate,-5);
const nearCoverageEnd=addDays(coverageEndDate,-20);

test('comparisonRows: three scenarios, same height and window length, delay and alternative applied',()=>{
  const rows=comparisonRows(dataset,settings);
  assert.deepEqual(rows.map(r=>r.label),['Original arrival','Delayed arrival','Alternative point']);
  assert.deepEqual(rows.map(r=>r.id),['connecting-ridge','connecting-ridge','shackleton-rim']);
  assert.deepEqual(rows.map(r=>r.offset),[0,7,7]);
  const start=(Date.parse(settings.date+'T00:00:00Z')-Date.parse(manifest.period.startUtc))/3600000;
  // Delay shifts both windows by seven UTC days; all lengths derive from the selected settings.
  assert.deepEqual(rows.map(r=>r.bounds),[{start,end:start+168},{start:start+168,end:start+336},{start:start+168,end:start+336}]);
  for(const r of rows){assert.ok(r.summary,r.label);assert.equal(r.bounds.end-r.bounds.start,7*24);}
});

test('comparisonRows: summary numbers are faithful to the data (independent trapezoid mean, sane durations)',()=>{
  for(const height of [1,5,'5']){
    const rows=comparisonRows(dataset,{...settings,height});
    for(const r of rows){
      const h=String(Number(height));
      const sun=sites[r.id].sun.visibleFraction[h].slice(r.bounds.start,r.bounds.end+1);
      close(r.summary.meanSun,trapezoid(sun),1e-12,`${r.label} h=${height} mean`);
      assert.ok(r.summary.sunlitFraction>=0&&r.summary.sunlitFraction<=1);
      assert.ok(r.summary.earthFraction>=0&&r.summary.earthFraction<=1);
      assert.ok(r.summary.dark.hours>=0&&r.summary.dark.hours<=7*24+1e-9);
      assert.ok(r.summary.noEarth.hours>=0&&r.summary.noEarth.hours<=7*24+1e-9);
    }
  }
  // 5 m can only see more of the Sun: its mean is >= the 1 m mean for the same window
  const a=comparisonRows(dataset,{...settings,height:1}),b=comparisonRows(dataset,{...settings,height:5});
  a.forEach((r,i)=>assert.ok(b[i].summary.meanSun>=r.summary.meanSun-1e-3,r.label));
});

test('comparisonRows: windows outside coverage or with invalid input are not calculated (no invented numbers)',()=>{
  for(const bad of [{date:outOfCoverageDate},{date:addDays(manifest.period.startUtc.slice(0,10),-1)},{date:''},{date:'garbage'},{date:'2027-02-31'},{date:'2027-03-32'},{date:'03/01/2027'},{date:'2027-03'},{date:'2027-03-01T00:00:00Z'},{days:0},{days:NaN},{delay:29,date:nearCoverageEnd,days:14}]){
    const rows=comparisonRows(dataset,{...settings,...bad});
    for(const r of rows.filter(r=>!r.bounds))assert.equal(r.summary,null,JSON.stringify(bad));
    assert.ok(rows.some(r=>!r.bounds),'at least one row outside coverage for '+JSON.stringify(bad));
  }
  // delay pushes only the delayed rows out of coverage; the original stays calculated
  const rows=comparisonRows(dataset,{...settings,date:nearCoverageEnd,days:7,delay:14});
  assert.ok(rows[0].summary);assert.equal(rows[1].summary,null);assert.equal(rows[2].summary,null);
  assert.deepEqual(comparisonRows({manifest:null},settings),[]);
});

test('comparisonRows and exported report reject impossible, partial, timestamp and alternate-format arrival dates',()=>{
  for(const date of ['2027-02-31','2027-03-32','03/01/2027','2027-03','2027-03-01T00:00:00Z','']){
    const rows=comparisonRows(dataset,{...settings,date});
    assert.equal(rows.length,3);
    assert.ok(rows.every(r=>r.bounds===null&&r.summary===null),`${date}: rows ${JSON.stringify(rows)}`);
    const report=comparisonReport(dataset,{...settings,date},72);
    assert.deepEqual(report.scenarios.map(s=>s.status),['not-calculated','not-calculated','not-calculated'],date);
    assert.ok(report.scenarios.every(s=>s.startUtc===null&&s.endUtc===null&&s.summary===null),date);
  }
  assert.equal(comparisonRows(dataset,{...settings,date:'2027-03-01'}).every(r=>r.summary!==null),true,'valid ISO arrival remains calculated');
});

test('rolling coverage includes its first and last complete UTC stay, then fails closed one day later',()=>{
  const first=manifest.period.startUtc.slice(0,10);
  const last=addDays(manifest.period.endUtc.slice(0,10),-settings.days);
  const atStart=comparisonRows(dataset,{...settings,date:first,delay:0});
  const atLast=comparisonRows(dataset,{...settings,date:last,delay:0});
  assert.ok(atStart.every(r=>r.summary),`first coverage day: ${first}`);
  assert.ok(atLast.every(r=>r.summary),`last full stay: ${last}`);
  const outside=comparisonRows(dataset,{...settings,date:addDays(last,1),delay:0});
  assert.ok(outside.every(r=>r.bounds===null&&r.summary===null),`outside final full stay: ${addDays(last,1)}`);
});

test('assessDarkness: hand-built cases (uncensored/censored, above/below limit, boundaries, invalid)',()=>{
  const S=(hours,censored)=>({dark:{hours,censored}});
  let r=assessDarkness(S(10,false),4);
  assert.deepEqual([r.status,r.lowerBound,r.marginH,r.message],['exceeds',false,6,'Exceeds your limit by 6.0 h.']);
  r=assessDarkness(S(10,true),4);
  assert.equal(r.status,'exceeds');assert.equal(r.lowerBound,true);assert.equal(r.message,'Exceeds your limit by at least 6.0 h.');
  r=assessDarkness(S(3,true),4);
  assert.deepEqual([r.status,r.lowerBound,r.marginH],['undetermined',true,null],'censored gap below the limit is undetermined, never "within"');
  assert.match(r.message,/Lower bound only/);
  r=assessDarkness(S(3.5,false),10);
  assert.deepEqual([r.status,r.lowerBound,r.marginH],['within',false,6.5]);assert.equal(r.message,'Within this limit, with 6.5 h margin.');
  // boundaries
  assert.equal(assessDarkness(S(4,false),4).status,'within','hours == limit is within');
  assert.equal(assessDarkness(S(4,true),4).status,'undetermined','censored at exactly the limit stays undetermined');
  assert.equal(assessDarkness(S(0,false),0).status,'within','zero darkness, zero limit');
  assert.equal(assessDarkness(S(0.01,false),0).status,'exceeds');
  assert.equal(assessDarkness(S(0,true),0).status,'undetermined');
  // invalid input -> not calculated, nothing invented
  for(const limit of [NaN,-1,Infinity,-Infinity,undefined,null,'5'])
    assert.equal(assessDarkness(S(3,false),limit).status,'not-calculated',String(limit));
  for(const summary of [null,undefined])assert.equal(assessDarkness(summary,10).status,'not-calculated');
});

test('comparisonReport: structure, provenance, limitations, integrity, coverage',()=>{
  const rep=comparisonReport(dataset,settings,72);
  assert.equal(rep.reportType,'faithful-comparison');assert.equal(rep.project,'Lunar Navigator');
  assert.match(rep.sourceCode,/github\.com\/Andre1B\/lunar-navigator-spaceapps-2026/);
  assert.equal(rep.build,null,'no build info defined in node');
  assert.ok(!Number.isNaN(Date.parse(rep.generatedAtUtc)));
  assert.equal(rep.settings.exampleDarknessLimitH,72);assert.equal(rep.settings.siteId,'connecting-ridge');
  assert.deepEqual(rep.coverage,manifest.period);
  assert.equal(rep.dataset.manifestGeneratedAtUtc,manifest.generatedAtUtc);assert.deepEqual(rep.dataset.integrity,integrity);
  assert.equal(comparisonReport({manifest,sites,validation},settings,72).dataset.integrity,null,'integrity optional');
  assert.deepEqual(rep.conventions,manifest.conventions);assert.deepEqual(rep.provenance,manifest.provenance);
  assert.deepEqual(rep.validation.map(v=>v.id),validation.tests.map(t=>t.id));
  assert.deepEqual(rep.validation.map(v=>v.status),validation.tests.map(t=>t.status));
  const lim=rep.limitations.join(' | ');
  assert.match(lim,/not NASA requirements/);assert.match(lim,/Free Mode freezes never change/);assert.match(lim,/no landing-safety certification or NASA endorsement/);
  assert.ok(manifest.limitations.every(l=>rep.limitations.includes(l)),'manifest limitations preserved');
  for(const k of ['means','durations','censored','visibility','unavailable'])assert.ok(rep.method[k]);
  assert.match(rep.method.visibility,/not a radio-link guarantee/);
  assert.equal(comparisonReport({manifest:null},settings,72),null);
});

test('comparisonReport: three scenarios mirror the rows (same windows, height, metrics) and carry exact UTC window times',()=>{
  const rep=comparisonReport(dataset,settings,72),rows=comparisonRows(dataset,settings);
  assert.equal(rep.scenarios.length,3);
  rep.scenarios.forEach((s,i)=>{
    assert.equal(s.label,rows[i].label);assert.equal(s.siteId,rows[i].id);assert.equal(s.arrivalDelayDays,rows[i].offset);
    assert.equal(s.point.id,rows[i].id);assert.equal(s.point.notALandingSite,true);
    assert.equal(s.status,'calculated');
    close(s.summary.meanVisibleSolarDiscFraction,rows[i].summary.meanSun,1e-12);
    close(s.summary.directSunTimeFraction,rows[i].summary.sunlitFraction,1e-12);
    close(s.summary.earthVisibleTimeFraction,rows[i].summary.earthFraction,1e-12);
    assert.deepEqual(s.summary.longestDarkness,rows[i].summary.dark);
    assert.ok(['exceeds','undetermined','within'].includes(s.exampleDarknessAssessment.status));
  });
  // exact UTC windows for the selected 2027-03-01 arrival and seven-day delay.
  assert.deepEqual(rep.scenarios.map(s=>[s.startUtc,s.endUtc]),[
    ['2027-03-01T00:00:00.000Z','2027-03-08T00:00:00.000Z'],
    ['2027-03-08T00:00:00.000Z','2027-03-15T00:00:00.000Z'],
    ['2027-03-08T00:00:00.000Z','2027-03-15T00:00:00.000Z']]);
});

test('comparisonReport: invalid coverage is "not-calculated" with null window and summary, never extrapolated',()=>{
  const rep=comparisonReport(dataset,{...settings,date:outOfCoverageDate},72);
  for(const s of rep.scenarios){
    assert.equal(s.status,'not-calculated');assert.equal(s.summary,null);assert.equal(s.startUtc,null);assert.equal(s.endUtc,null);
    assert.equal(s.exampleDarknessAssessment.status,'not-calculated');
  }
  const partial=comparisonReport(dataset,{...settings,date:nearCoverageEnd,days:7,delay:14},72);
  assert.deepEqual(partial.scenarios.map(s=>s.status),['calculated','not-calculated','not-calculated']);
  // zero / NaN / negative limits
  for(const limit of [NaN,-5]){
    comparisonReport(dataset,settings,limit).scenarios.forEach(s=>assert.equal(s.exampleDarknessAssessment.status,'not-calculated',String(limit)));
  }
  const zero=comparisonReport(dataset,settings,0);
  zero.scenarios.forEach(s=>{
    const st=s.exampleDarknessAssessment.status;
    if(s.summary.longestDarkness.hours>0)assert.equal(st,'exceeds');
    else assert.notEqual(st,'exceeds');
  });
});

test('comparisonReport: the exported record is compact (no massive arrays), serializable, deterministic and ignores display mode',()=>{
  const rep=comparisonReport(dataset,settings,72);
  const text=JSON.stringify(rep,null,2);
  assert.ok(text.length<80000,'report size '+text.length);
  const walk=(v,path='')=>{
    if(Array.isArray(v)){assert.ok(v.length<=400,`${path} has ${v.length} items`);v.forEach((x,i)=>walk(x,path+'['+i+']'));}
    else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v))walk(x,path+'.'+k);
  };
  walk(rep);
  assert.equal(JSON.parse(text).scenarios.length,3);
  assert.ok(!/NaN|undefined|Infinity/.test(text),'no NaN/undefined leaks into the file');
  // same inputs -> same record (apart from the timestamp); unrelated Free Mode keys do not change results
  const again=comparisonReport(dataset,{...settings,mode:'free',freeze:{earthPosition:12}},72);
  const strip=(r)=>{const c=JSON.parse(JSON.stringify(r));delete c.generatedAtUtc;delete c.settings;return c;};
  assert.deepEqual(strip(again),strip(rep),'results must not depend on Free Mode state');
});

test('downloadComparison: null report is a no-op',()=>assert.equal(downloadComparison(null),undefined));
