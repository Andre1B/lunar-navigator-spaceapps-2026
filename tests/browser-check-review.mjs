// Browser QA for the 3-minute Review route and the exportable Compare record. Playwright, not part of `npm test`.
//   node tests/browser-check-review.mjs                (dev, http://localhost:5173)
//   QA_URL=https://... node tests/browser-check-review.mjs
// Env: QA_OUT (default ../tmp/lunar-qa-review), QA_HEADED=1, QA_ONLY=<substring>.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {arrivalSeries} from '../src/lib/arrivalSeries.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const BASE=(process.env.QA_URL||'http://localhost:5173').replace(/\/$/,'');
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(ROOT,'..','tmp','lunar-qa-review');
mkdirSync(OUT,{recursive:true});
const CHROME_EXE='C:/Program Files/Google/Chrome/Application/chrome.exe';
const results=[],issues={console:[],pageerror:[],http:[],requestfailed:[]};
const expect=(c,m)=>{if(!c)throw new Error(m);};
const integrityFile=JSON.parse(readFileSync(join(ROOT,'public/data/integrity.json'),'utf8'));
const manifestFile=JSON.parse(readFileSync(join(ROOT,'public/data/manifest.json'),'utf8'));
const validationFile=JSON.parse(readFileSync(join(ROOT,'public/data/validation.json'),'utf8'));
const siteFiles=Object.fromEntries(manifestFile.sites.map(site=>[site.id,JSON.parse(readFileSync(join(ROOT,'public/data',site.file),'utf8'))]));

async function launch(){
  const args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
  const headless=!process.env.QA_HEADED;
  for(const o of [{channel:'chrome'},existsSync(CHROME_EXE)?{executablePath:CHROME_EXE}:null,{}]){
    if(!o)continue;try{return await chromium.launch({headless,args,...o});}catch(e){console.error('launch failed',e.message.split('\n')[0]);}
  }
  throw new Error('no usable browser');
}
async function check(name,fn){
  if(process.env.QA_ONLY&&!name.includes(process.env.QA_ONLY))return;
  const t=Date.now();
  try{const detail=await fn();results.push({name,ok:true,detail:detail??'',ms:Date.now()-t});console.log('PASS',name);}
  catch(e){results.push({name,ok:false,detail:String(e.message||e).split('\n')[0],ms:Date.now()-t});console.log('FAIL',name,'-',String(e.message||e).split('\n')[0]);}
}
function watch(page,tag){
  page.on('console',m=>{if(m.type()==='error')issues.console.push({tag,text:m.text().slice(0,200)});});
  page.on('pageerror',e=>issues.pageerror.push({tag,text:String(e).slice(0,200)}));
  page.on('response',r=>{if(r.status()>=400)issues.http.push({tag,status:r.status(),url:r.url()});});
  page.on('requestfailed',r=>{if(r.failure()?.errorText==='net::ERR_ABORTED')return;issues.requestfailed.push({tag,url:r.url(),error:r.failure()?.errorText});});
}
const errCount=()=>issues.console.length+issues.pageerror.length;
const fresh=(from)=>[...issues.console,...issues.pageerror].slice(from);
const shot=(page,name)=>page.screenshot({path:join(OUT,name+'.png'),fullPage:true});
async function open(ctx,route,tag,wait=600){
  const page=await ctx.newPage();watch(page,tag);
  await load(page,`${BASE}/#/${route}`);
  await page.locator('#main').waitFor({timeout:20000});await page.waitForTimeout(wait);return page;
}
async function load(page,url){
  await page.goto(url,{waitUntil:'networkidle'});
  const opening=page.getByRole('dialog',{name:'Lunacline'});
  if(await opening.count())await opening.waitFor({state:'hidden',timeout:4500});
}
async function download(page){
  const [dl]=await Promise.all([page.waitForEvent('download',{timeout:15000}),page.locator('.comparison-export').getByRole('button',{name:/Download comparison.*JSON/}).click()]);
  const path=await dl.path();const text=readFileSync(path,'utf8');
  return {name:dl.suggestedFilename(),text,json:JSON.parse(text)};
}
async function downloadAdvanced(page){
  const [dl]=await Promise.all([page.waitForEvent('download',{timeout:15000}),page.locator('.comparison-details').getByRole('button',{name:/Download comparison.*JSON/}).click()]);
  const path=await dl.path();const text=readFileSync(path,'utf8');
  return {name:dl.suggestedFilename(),text,json:JSON.parse(text)};
}
async function downloadPdf(page){
  const [dl]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.locator('.comparison-export').getByRole('button',{name:/PDF summary/}).click()]);
  const path=await dl.path(),bytes=readFileSync(path);
  return {name:dl.suggestedFilename(),bytes};
}
const setLimit=(page,v)=>page.fill('#dark-limit',String(v));
async function compareReady(ctx,tag){const page=await open(ctx,'compare',tag);const detail=page.locator('details.comparison-details').first();if(await detail.getAttribute('open')===null)await detail.locator('summary').click();await detail.locator('table tbody tr').first().waitFor({timeout:20000});return page;}

const browser=await launch();
console.log('browser',browser.version(),'base',BASE);
const desktop=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,acceptDownloads:true});

await check('Compare makes JSON primary, retains the PDF summary and advanced JSON record',async()=>{
  const page=await open(desktop,'compare','json-primary',500);
  await page.selectOption('#delay','7');await page.selectOption('#delay-hours','5');
  const delayStatus=(await page.locator('.setup').innerText()).replace(/\s+/g,' ');
  expect(delayStatus.includes('Total delay: 7 days 5 h (173 h)'),`selected whole-hour offset is not explicit: ${delayStatus}`);
  const cards=await page.locator('.answer-scenario').allTextContents();
  expect(cards.length===3&&cards[1].includes('+7 days 5 h'),'Compare answer must retain the complete delayed-arrival label');
  const order=await page.evaluate(()=>{
    const pdf=document.querySelector('.comparison-export'),advanced=document.querySelector('.comparison-details');
    return{pdf:!!pdf,advanced:!!advanced,primaryBeforeAdvanced:!!(pdf&&advanced&&(pdf.compareDocumentPosition(advanced)&Node.DOCUMENT_POSITION_FOLLOWING)),primaryJsonLabel:pdf?.querySelector('button')?.innerText.trim(),secondaryPdfLabel:pdf?.querySelectorAll('button')[1]?.innerText.trim(),advancedJsonLabel:advanced?.querySelector('button')?.textContent.trim()};
  });
  expect(order.pdf&&order.advanced&&order.primaryBeforeAdvanced,'primary exports must precede the advanced JSON disclosure: '+JSON.stringify(order));
  expect(/Download comparison.*JSON/.test(order.primaryJsonLabel)&&/PDF summary/.test(order.secondaryPdfLabel)&&/Download comparison.*JSON/.test(order.advancedJsonLabel),'JSON primary, PDF summary and advanced JSON labels must match the export contract: '+JSON.stringify(order));
  await shot(page,'compare-json-primary');
  const primaryJson=await download(page);
  expect(/\.json$/i.test(primaryJson.name)&&primaryJson.json.reportType==='faithful-comparison','primary JSON download: '+primaryJson.name);
  expect(Math.abs(Number(primaryJson.json.settings.delay)-(7+5/24))<1e-12,'primary JSON does not preserve the selected 7 d 5 h delay: '+JSON.stringify(primaryJson.json.settings));
  const pdf=await downloadPdf(page),pdfPath=join(OUT,pdf.name);writeFileSync(pdfPath,pdf.bytes);
  expect(/\.pdf$/i.test(pdf.name),'PDF summary filename: '+pdf.name);
  expect(pdf.bytes.subarray(0,5).toString('ascii')==='%PDF-','download is not a PDF byte stream');
  expect(pdf.bytes.length>50000&&pdf.bytes.length<2_000_000,'unexpected PDF size '+pdf.bytes.length);
  const detail=page.locator('details.comparison-details').first();if(await detail.getAttribute('open')===null)await detail.locator('summary').click();
  const json=await downloadAdvanced(page);
  expect(/\.json$/i.test(json.name)&&json.json.reportType==='faithful-comparison','advanced JSON download remains available: '+json.name);
  const withoutGenerationTime=(record)=>{const copy=JSON.parse(JSON.stringify(record));delete copy.generatedAtUtc;return copy;};
  expect(json.name===primaryJson.name&&JSON.stringify(withoutGenerationTime(json.json))===JSON.stringify(withoutGenerationTime(primaryJson.json)),'primary and advanced JSON buttons must download the same report and filename');
  expect(Math.abs(Number(json.json.settings.delay)-(7+5/24))<1e-12,'JSON does not preserve the selected 7 d 5 h delay: '+JSON.stringify(json.json.settings));
  await page.close();return `primary and advanced JSON both download ${json.name}; PDF summary ${pdf.name} (${pdf.bytes.length} bytes) has a valid %PDF header`;
});

for(const [label,ctx] of [['desktop-1440',desktop],['mobile-390',mobile]])
await check(`review ${label}: readable, three scenarios, no overflow, no console errors, header does not overlap`,async()=>{
  const from=errCount();
  const page=await open(ctx,'review','review-'+label,900);
  await shot(page,`${label}-review`);
  const r=await page.evaluate(()=>{
    const vw=document.documentElement.clientWidth;
    const skip=e=>e.closest('.table-wrap,pre,nav,.chapter-list,svg,canvas');
    const off=[...document.querySelectorAll('main *')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.right>vw+1||b.left<-1)&&!skip(e);}).slice(0,3).map(e=>e.tagName+'.'+String(e.className).slice(0,25));
    const text=[...document.querySelectorAll('main *')].filter(e=>e.scrollWidth>e.clientWidth+1&&e.clientWidth>0&&!skip(e)&&getComputedStyle(e).overflowX==='visible'&&e.children.length===0).slice(0,3).map(e=>e.tagName+'.'+String(e.className).slice(0,25));
    const items=[...document.querySelectorAll('header a,header button')].filter(e=>e.getBoundingClientRect().width>0);
    const boxes=items.map(e=>({n:(e.textContent||'').trim().slice(0,14),...e.getBoundingClientRect().toJSON()}));
    const overlaps=[];for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)overlaps.push(a.n+' x '+b.n);}
    const header=document.querySelector('header').getBoundingClientRect();
    return {sw:document.documentElement.scrollWidth,vw,off,text,overlaps,headerH:header.height,main:document.querySelector('main').innerText,
      cards:[...document.querySelectorAll('main h2,main h3')].map(e=>e.textContent.trim())};
  });
  expect(r.sw<=r.vw+1,`horizontal overflow ${r.sw}>${r.vw}`);
  expect(r.off.length===0&&r.text.length===0,'overflowing elements: '+[...r.off,...r.text].join(', '));
  expect(r.overlaps.length===0,'header items overlap: '+r.overlaps.join('; '));
  for(const need of ['Original arrival','Delayed arrival','Alternative point'])expect(r.cards.includes(need),'missing scenario card '+need);
  expect(!/NaN|undefined|Infinity/.test(r.main),'NaN/undefined in the Review text');
  expect(/%/.test(r.main)&&/\d+ ?h/.test(r.main),'Review shows real percentages and hours');
  expect(/not .*(NASA|landing|certif)|geometry|link/i.test(r.main),'limits are stated on the Review page');
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();return `header ${Math.round(r.headerH)} px`;
});

await check('review: every link/CTA works (Compare, Simulator, Evidence, Learn, Credits) and the header has all 8 entries on desktop',async()=>{
  const page=await open(desktop,'review','review-links');
  const nav=await page.locator('header a').allInnerTexts();
  expect(nav.length>=7&&nav.some(t=>/3-min review/i.test(t)),'header entries: '+nav.join('|'));
  const hrefs=await page.$$eval('main a[href^="#"]',a=>[...new Set(a.map(x=>x.getAttribute('href')))]);
  expect(hrefs.length>=4,'links on Review: '+hrefs.join(','));
  for(const h of hrefs){
    await load(page,`${BASE}/#/review`);await page.locator('#main').waitFor();
    await page.locator(`main a[href="${h}"]`).first().click();
    await page.waitForFunction(x=>location.hash===x,h,{timeout:5000});
    await page.locator('#main').waitFor();expect((await page.locator('h1').first().innerText()).length>0,`${h} renders an h1`);
  }
  await load(page,`${BASE}/#/review`);await page.locator('#main').waitFor();
  await page.getByRole('link',{name:/Change the inputs/}).click();
  await page.waitForFunction(()=>location.hash==='#/compare');
  await page.close();return hrefs.join(' ');
});

await check('Review and answer cards show time with some sunlight; the detailed table keeps mean Sun-disc fraction',async()=>{
  const cmp=await compareReady(desktop,'cmp-numbers');
  const detail=cmp.locator('details.comparison-details').first();
  if(await detail.getAttribute('open')===null)await detail.locator('summary').click();
  const report=(await download(cmp)).json;
  const rows=await detail.locator('table tbody tr').allInnerTexts();
  const answer=await cmp.locator('.answer-scenario').allInnerTexts();
  const answerMeaning=(await cmp.locator('.answer-meaning').first().innerText()).replace(/\s+/g,' ');
  const rev=await open(desktop,'review','rev-numbers',900);
  const cards=rev.locator('.review-results article');
  expect(await answer.length===3&&await cards.count()===3&&report.scenarios.length===3,'expected three scenarios in answer, Review and export');
  const samePercent=(x)=>`${(x*100).toFixed(1)}%`;
  let distinct=0;
  for(let i=0;i<3;i++){
    const scenario=report.scenarios[i],direct=samePercent(scenario.summary.directSunTimeFraction),mean=samePercent(scenario.summary.meanVisibleSolarDiscFraction);
    const answerText=answer[i],reviewText=await cards.nth(i).innerText();
    expect(answerText.includes(direct),`${scenario.label}: Compare answer card should show time fraction ${direct}`);
    expect(reviewText.includes(direct),`${scenario.label}: Review should show time fraction ${direct}`);
    expect(/Sun visible\s*·\s*% of your stay/.test(answerText.replace(/\s+/g,' ')),`${scenario.label}: Compare must label Sun visibility as a percentage of the stay: ${JSON.stringify(answerText)}`);
    expect(/Time with some sunlight/.test(reviewText.replace(/\s+/g,' ')),`${scenario.label}: Review must identify the time-with-sun metric: ${JSON.stringify(reviewText)}`);
    expect(!/Average Sun disc/.test(answerText+reviewText),`${scenario.label}: short summary conflates duration with mean disk area`);
    expect(rows[i].includes(mean),`${scenario.label}: detailed table should show mean visible disc ${mean}: ${rows[i]}`);
    if(Math.abs(scenario.summary.directSunTimeFraction-scenario.summary.meanVisibleSolarDiscFraction)>1e-6)distinct++;
  }
  expect(/stay percentage counts time with any part visible/i.test(answerMeaning),`Compare must explain that its Sun-visible percentage is time share, not power: ${answerMeaning}`);
  expect(distinct>0,'test data must demonstrate that time-with-sun and mean visible disc are different measures');
  expect((await detail.locator('thead').innerText()).includes('Average Sun disc in view'),'detailed-table heading should retain the disc-area measure');
  await cmp.close();await rev.close();
});

await check('download: real file, JSON parses, reproduces the UI (settings, windows, metrics), compact, provenance and limitations present',async()=>{
  const page=await compareReady(desktop,'dl');
  const d=await download(page);
  expect(d.name==='lunar-navigator-comparison.json','file name '+d.name);
  const j=d.json;
  expect(d.text.length<80000,'file size '+d.text.length);
  const walk=(v,p='')=>{if(Array.isArray(v)){expect(v.length<=400,`${p} has ${v.length} items`);v.forEach((x,i)=>walk(x,p+'['+i+']'));}else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v))walk(x,p+'.'+k);};
  walk(j);
  expect(j.reportType==='faithful-comparison'&&j.scenarios.length===3,'structure');
  expect(j.provenance&&j.provenance.kernels?.length>=5&&j.provenance.dems?.length>=6,'provenance present');
  expect(j.limitations.some(l=>/not NASA requirements/.test(l))&&j.limitations.some(l=>/landing-safety/.test(l)),'limitations present');
  expect(j.conventions&&j.method&&j.validation?.length===validationFile.tests.length&&j.validation.every((entry,i)=>entry.id===validationFile.tests[i].id&&entry.status===validationFile.tests[i].status),`conventions/method/current validation records present (${j.validation?.length} exported, ${validationFile.tests.length} current)`);
  expect(j.dataset.integrity&&Object.keys(JSON.stringify(j.dataset.integrity)).length>50,'dataset integrity block');
  const intg=JSON.stringify(j.dataset.integrity);
  expect(intg===JSON.stringify(integrityFile),'integrity block equals public/data/integrity.json');
  expect(j.build===null||(typeof j.build==='object'&&'revision' in j.build),'build info: '+JSON.stringify(j.build));
  // the file reproduces what the page shows
  const ui={site:await page.inputValue('#site'),alt:await page.inputValue('#alternative'),height:+await page.inputValue('#height'),date:await page.inputValue('#arrival'),days:+await page.inputValue('#days'),delay:+await page.inputValue('#delay'),limit:+await page.inputValue('#dark-limit')};
  expect(j.settings.siteId===ui.site&&j.settings.alternative===ui.alt&&Number(j.settings.height)===ui.height&&j.settings.date===ui.date&&Number(j.settings.days)===ui.days&&Number(j.settings.delay)===ui.delay&&j.settings.exampleDarknessLimitH===ui.limit,'settings in file != UI: '+JSON.stringify([j.settings,ui]));
  const rows=await page.locator('table').first().locator('tbody tr').allInnerTexts();
  j.scenarios.forEach((s,i)=>{
    const mean=(s.summary.meanVisibleSolarDiscFraction*100).toFixed(1)+'%',earth=(s.summary.earthVisibleTimeFraction*100).toFixed(1)+'%';
    expect(rows[i].includes(mean),`${s.label}: UI row lacks mean Sun ${mean}: ${rows[i].replace(/\s+/g,' ').slice(0,100)}`);
    expect(rows[i].includes(earth),`${s.label}: UI row lacks Earth visible ${earth}`);
    expect(rows[i].includes(Math.round(s.summary.longestDarkness.hours)+' h'),`${s.label}: darkness hours`);
    const expectStart=new Date(Date.parse(j.coverage.startUtc)+(Date.parse(ui.date+'T00:00:00Z')-Date.parse(j.coverage.startUtc))+s.arrivalDelayDays*86400000).toISOString();
    expect(s.startUtc===expectStart,`${s.label}: start ${s.startUtc} vs ${expectStart}`);
  });
  await page.close();return `${d.text.length} bytes`;
});

await check('download follows the inputs (site, height, window, delay, limit) and the UI assessment text equals the file',async()=>{
  const page=await compareReady(desktop,'dl2');
  await page.selectOption('#site','shackleton-rim');await page.selectOption('#alternative','malapert-massif');
  await page.selectOption('#height','5');await page.selectOption('#days','14');await page.selectOption('#delay','3');
  await setLimit(page,10);await page.waitForTimeout(400);
  const j=(await download(page)).json;
  expect(j.settings.siteId==='shackleton-rim'&&j.settings.alternative==='malapert-massif'&&Number(j.settings.height)===5&&Number(j.settings.days)===14&&Number(j.settings.delay)===3&&j.settings.exampleDarknessLimitH===10,'inputs not reflected: '+JSON.stringify(j.settings));
  expect(j.scenarios.map(s=>s.siteId).join()==='shackleton-rim,shackleton-rim,malapert-massif','scenario sites');
  expect(j.scenarios.map(s=>s.arrivalDelayDays).join()==='0,3,3','delays');
  const body=await page.locator('main').innerText();
  for(const s of j.scenarios){
    const a=s.exampleDarknessAssessment;
    expect(['exceeds','undetermined','within'].includes(a.status),`${s.label} status ${a.status}`);
    const core=a.message.replace(/\s+/g,' ').replace(/\.$/,'');
    expect(body.replace(/\s+/g,' ').includes(core),`UI does not show the file's assessment for ${s.label}: "${core}"`);
    if(a.status==='undetermined')expect(a.marginH===null&&a.lowerBound===true,'undetermined must be a lower bound without margin');
    if(a.status==='exceeds'&&a.lowerBound)expect(/at least/.test(a.message),'censored exceeds must say "at least"');
  }
  await page.close();return j.scenarios.map(s=>s.exampleDarknessAssessment.status).join(',');
});

await check('censored/undetermined and out-of-coverage warnings are shown and exported honestly',async()=>{
  const page=await compareReady(desktop,'warn');
  const days=14,period=manifestFile.period,siteId=await page.inputValue('#site'),height=await page.inputValue('#height');
  const candidate=arrivalSeries(siteFiles[siteId],period,height,days).find(entry=>entry.summary?.dark?.censored);
  expect(!!candidate,`no censored ${days}-day stay exists for current site ${siteId} within this rolling coverage`);
  await page.selectOption('#days',String(days));await page.fill('#arrival',candidate.date);await setLimit(page,0);await page.waitForTimeout(180);
  const reported=(await download(page)).json;
  const censored=reported.scenarios.filter(s=>s.summary?.longestDarkness.censored);
  expect(censored.length>0,`UI export lost the censored darkness case for ${siteId} on ${candidate.date}`);
  expect(censored.every(s=>s.exampleDarknessAssessment.lowerBound===true&&s.exampleDarknessAssessment.status==='exceeds'&&s.exampleDarknessAssessment.marginH>0&&/at least/.test(s.exampleDarknessAssessment.message)),`censored exceedance must be a lower-bound result: ${JSON.stringify(censored.map(s=>({label:s.label,status:s.exampleDarknessAssessment.status,lowerBound:s.exampleDarknessAssessment.lowerBound,marginH:s.exampleDarknessAssessment.marginH,message:s.exampleDarknessAssessment.message})))}`);
  const pageText=(await page.locator('main').innerText()).replace(/\s+/g,' ');
  expect(/At least \d/.test(pageText),`visible scenario text should mark censored darkness as a lower bound at ${candidate.date}`);
  await setLimit(page,1000);await page.waitForTimeout(150);
  const undetermined=(await download(page)).json.scenarios.filter(s=>s.summary?.longestDarkness.censored);
  expect(undetermined.length>0&&undetermined.every(s=>s.exampleDarknessAssessment.status==='undetermined'&&s.exampleDarknessAssessment.lowerBound===true&&s.exampleDarknessAssessment.marginH===null),`a censored interval below the user limit must remain undetermined: ${JSON.stringify(undetermined.map(s=>({label:s.label,status:s.exampleDarknessAssessment.status,lowerBound:s.exampleDarknessAssessment.lowerBound,marginH:s.exampleDarknessAssessment.marginH})))}`);
  expect((await page.locator('main').innerText()).includes('Lower bound only'),`visible UI should explain the undetermined lower bound at ${candidate.date}`);
  // A date after the latest period endpoint is outside coverage for a 7-day stay.
  await page.selectOption('#days','7');
  const outsideDate=new Date(Date.parse(period.endUtc)+86400000).toISOString().slice(0,10);
  await page.fill('#arrival',outsideDate);
  const j=(await download(page)).json;
  expect(j.scenarios.every(s=>s.status==='not-calculated'&&s.summary===null&&s.startUtc===null),'file must not invent numbers outside coverage');
  const rows=await page.locator('table').first().locator('tbody tr').allInnerTexts();
  expect(rows.every(r=>r.includes('Not calculated')),'UI says Not calculated');
  expect(/Outside|Not calculated|not calculated/.test(await page.locator('main').innerText()),'UI warns about coverage');
  await page.close();return `censored date ${candidate.date}: limit 0 returns lower-bound exceedance; limit 1000 is undetermined; ${outsideDate} exports not-calculated`;
});

await check('limit input: zero, NaN, negative, huge and empty values never break the page or the file',async()=>{
  const from=errCount();
  const page=await compareReady(desktop,'limit');
  for(const v of ['0','-5','abc','1e9','5000','','72']){
    await page.fill('#dark-limit',v).catch(()=>{});
    await page.waitForTimeout(150);
    const n=await page.locator('#dark-limit').evaluate(e=>e.valueAsNumber);
    expect(Number.isNaN(n)||(n>=0&&n<=1000),`valueAsNumber ${n} for "${v}" outside 0..1000`);
    const j=(await download(page)).json;
    j.scenarios.forEach(s=>expect(['exceeds','undetermined','within','not-calculated'].includes(s.exampleDarknessAssessment.status),`status for "${v}"`));
    expect(!/NaN|Infinity|undefined/.test(JSON.stringify(j)),`NaN in the file for "${v}"`);
    expect(!/NaN|Infinity/.test(await page.locator('main').innerText()),`NaN on the page for "${v}"`);
  }
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});

await check('Free Mode never changes the exported comparison or the Review',async()=>{
  const page=await compareReady(desktop,'free-a');
  const before=(await download(page)).json;
  const reviewBefore=await (async()=>{const r=await open(desktop,'review','free-rev1',700);const t=await r.locator('main').innerText();await r.close();return t;})();
  // Keep the same app instance so the test isolates whether Free Mode mutates
  // the shared comparison state, instead of comparing two default instances.
  await page.evaluate(()=>{location.hash='#/simulator';});
  await page.waitForFunction(()=>location.hash==='#/simulator',null,{timeout:10000});
  await page.getByRole('button',{name:/^Free Mode/}).first().waitFor({timeout:15000});
  await page.getByRole('button',{name:/^Free Mode/}).first().click();
  await page.getByLabel(/Earth.s position/).check();
  await page.getByRole('button',{name:/Step \+1 h/}).click();await page.getByRole('button',{name:/Step \+1 h/}).click();
  await page.evaluate(()=>{location.hash='#/compare';});
  await page.waitForFunction(()=>location.hash==='#/compare',null,{timeout:10000});
  const detail=page.locator('details.comparison-details').first();
  if(await detail.getAttribute('open')===null)await detail.locator('summary').click();
  await detail.locator('table tbody tr').first().waitFor({timeout:20000});
  const after=(await download(page)).json;
  const strip=(r)=>{const c=JSON.parse(JSON.stringify(r));delete c.generatedAtUtc;return c;};
  expect(JSON.stringify(strip(after))===JSON.stringify(strip(before)),'exported record changed after Free Mode experiments');
  await page.evaluate(()=>{location.hash='#/review';});await page.waitForFunction(()=>location.hash==='#/review',null,{timeout:10000});await page.waitForTimeout(800);
  expect(await page.locator('main').innerText()===reviewBefore,'Review text changed after Free Mode experiments');
  await page.close();
});

await check('method links open the specific explanation for each metric (solar, darkness, earth, earth-gap) without errors',async()=>{
  const from=errCount();const page=await compareReady(desktop,'method');
  const texts=[];
  for(const m of ['solar','darkness','earth','earth-gap']){
    const link=page.locator(`main a[href="#/evidence?metric=${m}"]`).first();
    await link.scrollIntoViewIfNeeded();await link.click();
    await page.waitForFunction(x=>location.hash===x,`#/evidence?metric=${m}`);
    await page.locator('#main').waitFor();await page.waitForTimeout(500);
    texts.push(await page.locator('main').innerText());
    expect(await page.locator('main h1').count()>0,m+': no heading');
    await load(page,`${BASE}/#/compare`);
    const detail=page.locator('details.comparison-details').first();
    if(await detail.getAttribute('open')===null)await detail.locator('summary').click();
    await detail.locator('table tbody tr').first().waitFor();
  }
  const focus=await Promise.all(['solar','darkness','earth','earth-gap'].map(async m=>{await load(page,`${BASE}/#/evidence?metric=${m}`);await page.waitForTimeout(500);return page.evaluate(()=>(document.querySelector('[aria-current],[data-metric],.metric-explainer,.metric-focus')?.textContent||'').trim());}));
  expect(new Set(focus.filter(Boolean)).size>=3||new Set(texts).size===4,'metric deep links do not show distinct explanations');
  expect(fresh(from).length===0,'console errors: '+JSON.stringify(fresh(from).slice(0,2)));
  await page.close();
});

await check('mobile 390: Compare download button and Review CTA are usable (>= 36 px) and keyboard-activatable',async()=>{
  const page=await compareReady(mobile,'mobile-dl');
  const b=page.locator('.comparison-export').getByRole('button',{name:/Download comparison.*JSON/});
  const box=await b.boundingBox();expect(box.height>=36,`download button ${Math.round(box.height)} px high`);
  await b.focus();
  const [dl]=await Promise.all([page.waitForEvent('download',{timeout:15000}),page.keyboard.press('Enter')]);
  expect(dl.suggestedFilename()==='lunar-navigator-comparison.json','keyboard download');
  const r=await open(mobile,'review','mobile-cta');
  const cta=await r.getByRole('link',{name:/Change the inputs/}).boundingBox();expect(cta.height>=36,`CTA ${Math.round(cta.height)} px`);
  await page.close();await r.close();
});

await check('no failed requests and no console errors across the whole run',async()=>{
  const net=[...issues.http,...issues.requestfailed].filter(x=>!/favicon/.test(x.url||''));
  const errs=[...issues.console,...issues.pageerror];
  expect(net.length===0&&errs.length===0,`net ${net.length} console ${errs.length}: ${JSON.stringify([...net,...errs].slice(0,3))}`);
});

await browser.close();
const failed=results.filter(r=>!r.ok).length;
writeFileSync(join(OUT,'results.json'),JSON.stringify({base:BASE,at:new Date().toISOString(),passed:results.length-failed,failed,results,issues},null,1));
console.log(`\n${results.length-failed}/${results.length} passed. Output: ${OUT}`);
process.exit(failed?1:0);
