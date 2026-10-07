// Fixture-controlled comparison of actual entries; run with other browser jobs idle.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const {runtimeFiles}=require('./build-site.cjs');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),baseline=path.resolve(process.env.BASELINE_ROOT||''),candidate=path.join(root,'dist');
const fixtures=path.resolve(process.env.FIXTURES_DIR||path.join(root,'tests/fixtures')),output=path.resolve(process.env.PERFORMANCE_OUTPUT||path.join(root,'test-results/performance-'+Date.now()+'.json'));
if(!process.env.BASELINE_ROOT)throw Error('Set BASELINE_ROOT to an isolated restored protected baseline.');
if(fs.existsSync(output))throw Error('Use a fresh PERFORMANCE_OUTPUT.');
const baselineCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:baseline,encoding:'utf8'}).trim();assert.equal(baselineCommit,'16d63581c385b07c7c6b3fae70f6ed9365d0b3b1');execFileSync('git',['diff','--exit-code'],{cwd:baseline});
const names=new Map(fs.readdirSync(fixtures).filter(name=>name.endsWith('.json')).map(name=>[name.toLowerCase(),name]));
const files=new Map();for(const [kind,folder]of [['baseline',baseline],['refactor',candidate]])for(const name of runtimeFiles(folder))files.set('/'+kind+'/'+name,fs.readFileSync(path.join(folder,name)));
const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]),bytes=files.get(name);if(!bytes){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',/.m?js$/.test(name)?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':'text/html');res.end(bytes);});
const samples=[],errors=[];
const quantile=(values,fraction)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*fraction)-1];
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH});
 try{
 for(const mode of ['fallback','advanced'])for(let trial=0;trial<5;trial++)for(const kind of trial%2?['refactor','baseline']:['baseline','refactor']){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin===base)return route.continue();
   if(!url.pathname.endsWith('.json'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>'});
   await new Promise(resolve=>setTimeout(resolve,20));
   if(url.hostname==='raw.communitydragon.org' && mode==='fallback')return route.fulfill({status:503,body:'Unavailable'});
   const name=url.pathname.endsWith('/items.cdtb.bin.json')?'cd-items.json':url.pathname.endsWith('/versions.json')?'versions.json':url.pathname.endsWith('/champion.json')?'champions.json':url.pathname.endsWith('/item.json')?'items.json':url.pathname.endsWith('/runesReforged.json')?'runes.json':names.get(path.basename(url.pathname).toLowerCase());
   assert.ok(name,'Unknown fixture request '+url.pathname);return route.fulfill({contentType:'application/json',body:fs.readFileSync(path.join(fixtures,name))});
  });
  await page.addInitScript(()=>{window.__releaseReady=null;const check=()=>{if(window.__releaseReady===null&&document.querySelectorAll('#itemSlots button').length===7&&document.querySelector('#builderStatus')?.textContent==='')window.__releaseReady=performance.now();};new MutationObserver(check).observe(document,{childList:true,subtree:true,characterData:true});});
  for(const visit of ['fresh-context','repeat-context']){
   await page.goto(base+'/'+kind+'/Builder.html');await page.waitForFunction(()=>window.__releaseReady!==null);
   const pickerReadyMs=await page.evaluate(()=>window.__releaseReady);
   await page.locator('#championPickerBtn').click();await page.locator('#modalChampSearch').fill('Ashe');await page.locator('[data-champ="Ashe"]').click();await page.waitForFunction(()=>document.querySelector('#championPickerBtn').getAttribute('aria-label')==='Selected champion: Ashe');
   await page.evaluate(async()=>{const state=typeof BUILDER!=='undefined'?BUILDER:(await import(new URL('./JS/builder.js',location.href).href)).builderPage.state;await state.enrichmentReady;});
   const metrics=await page.evaluate(()=>{
    const timed=fn=>{const start=performance.now();fn();return performance.now()-start;};
    const levelMs=timed(()=>{const field=document.querySelector('#builderLevel');field.value='18';field.dispatchEvent(new Event('change',{bubbles:true}));});
    const targetMs=timed(()=>document.querySelector('#targetEnabled').click());
    const itemPickerMs=timed(()=>document.querySelector('[data-slot="0"]').click());
    const itemSearchMs=timed(()=>{const field=document.querySelector('#modalItemSearch');field.value='Amplifying';field.dispatchEvent(new Event('input',{bubbles:true}));});document.querySelector('#closeItemModalBtn').click();
    return {levelMs,targetMs,itemPickerMs,itemSearchMs};
   });
   const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,abilityCards:[...document.querySelectorAll('[data-ability-slot]')].map(node=>{const r=node.getBoundingClientRect();return {slot:node.dataset.abilitySlot,width:Math.round(r.width),height:Math.round(r.height)};}),slots:document.querySelectorAll('#itemSlots button').length}));
   assert.equal(layout.overflow,false,kind+' desktop overflow');
   await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,kind+' mobile overflow');await page.setViewportSize({width:1440,height:900});
   samples.push({kind,mode,trial,visit,pickerReadyMs,...metrics,layout});
  }
  await context.close();console.log('Measured '+kind+' '+mode+' trial '+(trial+1));
 }
 const summary=[];for(const mode of ['fallback','advanced'])for(const visit of ['fresh-context','repeat-context']){
  const select=kind=>samples.filter(row=>row.kind===kind&&row.mode===mode&&row.visit===visit);
  const old=select('baseline'),next=select('refactor');const measurements={};
  for(const key of ['pickerReadyMs','levelMs','targetMs','itemPickerMs','itemSearchMs']){
   const medianBaseline=quantile(old.map(row=>row[key]),.5),medianRefactor=quantile(next.map(row=>row[key]),.5),p95Baseline=quantile(old.map(row=>row[key]),.95),p95Refactor=quantile(next.map(row=>row[key]),.95);
   const limit=key==='pickerReadyMs'?Math.max(medianBaseline*1.25,medianBaseline+250):Math.max(100,p95Baseline*1.25+10);
   const observed=key==='pickerReadyMs'?medianRefactor:p95Refactor;assert.ok(observed<=limit,mode+' '+visit+' '+key+': '+observed.toFixed(1)+'ms exceeds '+limit.toFixed(1)+'ms');
   measurements[key]={medianBaseline,medianRefactor,p95Baseline,p95Refactor,limit,passed:true};
  }
  assert.deepEqual(next[0].layout,old[0].layout,mode+' '+visit+' layout changed');summary.push({mode,visit,measurements,layoutEquivalent:true});
 }
 assert.deepEqual(errors,[]);
 const report={date:new Date().toISOString(),passed:true,browser:browser.version(),node:process.version,baselineCommit,trialsPerPair:5,ordering:'Alternating baseline/refactor per trial; fresh context then repeat context',apiDelayMs:20,method:'Actual page entries; memory-served local assets; intercepted fixed 16.18.1 JSON and placeholder remote artwork. Routing disables HTTP cache: repeat-context is not a CDN/disk-cache benchmark. No CPU/network throttling; run other browser jobs idle.',budgets:'Startup median <= max(baseline x1.25, baseline +250ms); synchronous interaction p95 <= max(100ms, baseline p95 x1.25 +10ms). Budgets fixed before measurements. Desktop/mobile overflow and ability geometry equivalent.',summary,samples};
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log('PASS 40 real-entry visits; baseline layout and controlled performance budgets.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
