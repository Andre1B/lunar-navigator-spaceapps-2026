// Regression QA for temporary 3D inspection from the three Compare answers and A/B arrival view.
// Not part of `npm test`; run after the owner marks the UI stable.
//   node tests/browser-check-comparison-inspection.mjs
//   QA_URL=https://... QA_OUT=../tmp/lunar-inspection node tests/browser-check-comparison-inspection.mjs
// Env: QA_URL, QA_OUT, QA_HEADED=1.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const BASE=(process.env.QA_URL||'http://localhost:5173').replace(/\/$/,'');
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(ROOT,'..','tmp','lunar-inspection');
const UI={site:'#site',height:'#height',date:'#arrival',days:'#days',delay:'#delay',alternative:'#alternative'};
const original={site:'malapert-massif',height:'2',date:'2027-03-05',days:'14',delay:'3',alternative:'shackleton-rim'};
const results=[],issues={console:[],page:[],http:[],requestfailed:[]};
const ensure=(condition,message)=>{if(!condition)throw new Error(message);};

async function launch(){
  const exe='C:/Program Files/Google/Chrome/Application/chrome.exe';
  const opts={headless:!process.env.QA_HEADED,args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']};
  for(const o of [{...opts,channel:'chrome'},...(existsSync(exe)?[{...opts,executablePath:exe}]:[]),opts]){
    try{return await chromium.launch(o);}catch{}
  }
  throw new Error('Chrome/Chromium could not be launched');
}
function watch(page){
  page.on('console',m=>{if(m.type()==='error')issues.console.push(m.text().slice(0,300));});
  page.on('pageerror',e=>issues.page.push(String(e).slice(0,300)));
  page.on('response',r=>{if(r.status()>=400)issues.http.push({status:r.status(),url:r.url()});});
  page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')issues.requestfailed.push({url:r.url(),error:r.failure()?.errorText});});
}
async function openCompare(context){
  const page=await context.newPage();watch(page);
  await page.goto(`${BASE}/?qa=1#/compare`,{waitUntil:'networkidle',timeout:60000});
  await page.locator('.answer-scenario').first().waitFor({timeout:20000});
  await page.locator('.answer-inspect').first().waitFor({timeout:20000});
  for(const [id,value] of Object.entries(original)){
    const selector=UI[id];if(id==='date')await page.fill(selector,value);else await page.selectOption(selector,value);
  }
  await page.waitForTimeout(250);
  return page;
}
const settingsOf=async(page)=>Object.fromEntries(await Promise.all(Object.entries(UI).map(async([key,selector])=>[key,await page.locator(selector).inputValue()])));
const cardsOf=async(page)=>page.locator('.answer-scenario').allInnerTexts();
async function download(page){
  const [item]=await Promise.all([page.waitForEvent('download',{timeout:15000}),page.getByRole('button',{name:/Download comparison/}).click()]);
  const value=JSON.parse(readFileSync(await item.path(),'utf8'));delete value.generatedAtUtc;return value;
}
async function detailedRows(page){
  const detail=page.locator('details.comparison-details').first();
  if(await detail.getAttribute('open')===null)await detail.locator('summary').click();
  return detail.locator('table tbody tr').allInnerTexts();
}
async function inspectAndReturn(page,button){
  await button.click();
  await page.waitForURL(/#\/simulator$/,{timeout:15000});
  await page.waitForFunction(()=>document.querySelector('canvas')?.lunarSnapshot,null,{timeout:30000});
  ensure(await page.locator('.inspection-note').innerText().then(t=>/original location and dates are preserved/i.test(t)),'inspection banner omits preservation note');
  const faithful=page.getByRole('button',{name:/^Faithful Mode/}).first();
  ensure(await faithful.getAttribute('aria-pressed')==='true','inspection should use Faithful Mode');
  const site=await page.locator('#explorer-site').inputValue();
  const alternateSite=site==='connecting-ridge'?'malapert-massif':'connecting-ridge';
  await page.selectOption('#explorer-site',alternateSite);
  await page.selectOption('#explorer-height','10');
  await page.getByRole('link',{name:/Return to your comparison/}).click();
  await page.waitForURL(/#\/compare$/,{timeout:15000});
  await page.locator('.answer-scenario').first().waitFor({timeout:15000});
}

const browser=await launch();
const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
const page=await openCompare(context);
try{
  const baseSettings=await settingsOf(page),baseCards=await cardsOf(page),baseRows=await detailedRows(page),baseExport=await download(page);
  ensure(JSON.stringify(baseSettings)===JSON.stringify(original),`test setup mismatch: ${JSON.stringify(baseSettings)}`);
  ensure(baseCards.length===3,'expected three comparison answer cards');
  ensure(baseRows.length===3,'expected three detailed comparison rows');
  const resultsByCard=[];
  for(let i=0;i<3;i++){
    const button=page.locator('.answer-scenario').nth(i).getByRole('button',{name:/^See /});
    ensure(await button.count()===1,`scenario ${i+1} inspect action missing`);
    await inspectAndReturn(page,button);
    const settings=await settingsOf(page),cards=await cardsOf(page),rows=await detailedRows(page),exported=await download(page);
    ensure(JSON.stringify(settings)===JSON.stringify(baseSettings),`scenario ${i+1} changed original settings: ${JSON.stringify(settings)}`);
    ensure(JSON.stringify(cards)===JSON.stringify(baseCards),`scenario ${i+1} changed answer cards`);
    ensure(JSON.stringify(rows)===JSON.stringify(baseRows),`scenario ${i+1} changed detailed table rows`);
    ensure(JSON.stringify(exported)===JSON.stringify(baseExport),`scenario ${i+1} changed exported comparison`);
    resultsByCard.push({scenario:i+1,site:settings.site,height:settings.height,rows:rows.length,unchanged:true});
  }

  const arrival=page.locator('.arrival-comparison');
  const originalA=arrival.getByRole('button').first();
  if(await originalA.getAttribute('aria-pressed')!=='true')await originalA.click();
  const abAction=arrival.getByRole('button',{name:/Inspect this instant in 3D/});
  await inspectAndReturn(page,abAction);
  const abSettings=await settingsOf(page),abCards=await cardsOf(page),abRows=await detailedRows(page),abExport=await download(page);
  ensure(JSON.stringify(abSettings)===JSON.stringify(baseSettings),'A/B inspection changed original settings');
  ensure(JSON.stringify(abCards)===JSON.stringify(baseCards),'A/B inspection changed answer cards');
  ensure(JSON.stringify(abRows)===JSON.stringify(baseRows),'A/B inspection changed detailed table rows');
  ensure(JSON.stringify(abExport)===JSON.stringify(baseExport),'A/B inspection changed export');
  results.push({name:'three scenario cards and A/B inspection preserve original Compare settings, results and JSON export',ok:true,detail:{cards:resultsByCard,AB:true,settings:baseSettings,rows:baseRows.length}});
}catch(e){results.push({name:'three scenario cards and A/B inspection preserve original Compare settings, results and JSON export',ok:false,detail:String(e.message||e)});}
await context.close();await browser.close();
const report={base:BASE,browser:browser.version?.()??'Chrome',generatedAt:new Date().toISOString(),results,issues};
mkdirSync(OUT,{recursive:true});writeFileSync(join(OUT,'results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(results.some(r=>!r.ok)||Object.values(issues).some(a=>a.length))process.exitCode=1;
