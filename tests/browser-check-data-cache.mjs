// Browser regression checks for coherent dataset caching and safe mixed-schema failure.
// Not part of `npm test`; run with native Chrome after a source/data rollout.
//   node tests/browser-check-data-cache.mjs
//   QA_URL=https://... QA_OUT=../tmp/lunar-data-cache node tests/browser-check-data-cache.mjs
// Env: QA_URL, QA_OUT, QA_HEADED=1.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const BASE=(process.env.QA_URL||'http://localhost:5173').replace(/\/$/,'');
const OUT=process.env.QA_OUT?resolve(process.env.QA_OUT):resolve(ROOT,'..','tmp','lunar-data-cache');
const manifest=JSON.parse(readFileSync(join(ROOT,'public/data/manifest.json'),'utf8'));
const sampleSite=JSON.parse(readFileSync(join(ROOT,'public/data/sites/malapert-massif.json'),'utf8'));
const results=[],issues={console:[],page:[],http:[],requestfailed:[]};
const ensure=(c,m)=>{if(!c)throw new Error(m);};

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

const browser=await launch();
console.log('browser',browser.version(),'base',BASE);

{
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();watch(page);
  const requests=[];
  await page.addInitScript(()=>{
    window.__datasetFetchCalls=[];
    const fetch0=window.fetch.bind(window);
    window.fetch=(input,init={})=>{
      const url=typeof input==='string'?input:input.url;
      if(url.includes('/data/'))window.__datasetFetchCalls.push({url,cache:init.cache??(input instanceof Request?input.cache:null)});
      return fetch0(input,init);
    };
  });
  await page.route('**/data/**',async route=>{
    requests.push({url:route.request().url(),headers:route.request().headers()});
    await route.continue();
  });
  await page.goto(`${BASE}/#/compare`,{waitUntil:'networkidle',timeout:60000});
  await page.locator('.answer-scenario').first().waitFor({timeout:20000});
  try{
    const data=requests.map(r=>({url:new URL(r.url),headers:r.headers}));
    const manifestRequest=data.find(r=>r.url.pathname.endsWith('/manifest.json'));
    ensure(manifestRequest,'manifest request not observed');
    ensure(manifestRequest.url.searchParams.get('v')===null,'manifest should be revalidated independently, without an old dataset version');
    const fetchCalls=await page.evaluate(()=>window.__datasetFetchCalls);
    const manifestFetch=fetchCalls.find(r=>new URL(r.url,BASE).pathname.endsWith('/manifest.json'));
    ensure(manifestFetch?.cache==='no-cache',`manifest fetch cache mode was ${manifestFetch?.cache??'not recorded'}, expected no-cache`);
    const json=data.filter(r=>r.url.pathname.endsWith('.json')&&!r.url.pathname.endsWith('/manifest.json'));
    ensure(json.length>=7,`expected versioned data JSON requests, saw ${json.length}`);
    const mismatches=json.filter(r=>r.url.searchParams.get('v')!==manifest.generatedAtUtc);
    ensure(mismatches.length===0,`data requests did not share manifest.generatedAtUtc=${manifest.generatedAtUtc}: ${mismatches.map(x=>x.url.pathname+'?'+x.url.search).join(', ')}`);
    results.push({name:'manifest is revalidated and every dependent data JSON uses its generatedAtUtc version',ok:true,detail:{manifest:manifestRequest.url.href,fetchCacheMode:manifestFetch.cache,jsonRequests:json.length,version:manifest.generatedAtUtc}});
  }catch(e){results.push({name:'manifest is revalidated and every dependent data JSON uses its generatedAtUtc version',ok:false,detail:String(e.message||e)});}
  await context.close();
}

{
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();watch(page);
  const malformed=JSON.parse(JSON.stringify(sampleSite));
  delete malformed.sun.visibleFraction['2'];
  await page.route('**/data/sites/malapert-massif.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(malformed)}));
  await page.goto(`${BASE}/#/compare`,{waitUntil:'networkidle',timeout:60000});
  const status=page.getByRole('status').filter({hasText:/Scientific dataset is not available yet/});
  await status.waitFor({timeout:20000});
  try{
    const text=await status.innerText();
    ensure(!/TypeError|Cannot read|undefined|NaN/i.test(text),`malformed dataset leaked an implementation error: ${text}`);
    const details=status.locator('details');await details.locator('summary').click();
    const technical=await details.innerText();
    ensure(/Dataset files do not match the declared heights or period/.test(technical),`expected a clear mixed-schema error, got: ${technical}`);
    ensure(await page.locator('.answer-scenario').count()===0,'numeric comparison was exposed for an inconsistent dataset');
    ensure(await page.getByRole('button',{name:/Download comparison/}).count()===0,'comparison export was exposed for an inconsistent dataset');
    ensure(issues.page.length===0,`uncaught page errors: ${issues.page.join(' | ')}`);
    results.push({name:'mixed-height dataset fails closed with a clear status and no TypeError or numeric results',ok:true,detail:technical});
  }catch(e){results.push({name:'mixed-height dataset fails closed with a clear status and no TypeError or numeric results',ok:false,detail:String(e.message||e)});}
  await context.close();
}

await browser.close();
const report={base:BASE,browser:browser.version(),generatedAt:new Date().toISOString(),results,issues};
mkdirSync(OUT,{recursive:true});writeFileSync(join(OUT,'results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(results.some(r=>!r.ok)||Object.values(issues).some(a=>a.length))process.exitCode=1;
