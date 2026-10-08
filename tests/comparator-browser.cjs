// Run with FIXTURES_DIR pointing to downloaded Data Dragon JSON (see docs/TESTING.md).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.env.APP_ROOT || path.join(__dirname,'..'));
const fixtures = path.resolve(process.env.FIXTURES_DIR || 'tests/fixtures');
const read = name => fs.readFileSync(path.join(fixtures,name));
const index = JSON.parse(read('champions.json')).data;
const errors=[], requests=[];
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if (!file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
 try {res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}
 catch {res.writeHead(404);res.end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 let failCore=false;
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin===base)return route.fallback();
   requests.push(url.href);
   if(!url.pathname.endsWith('.json'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#334155"/></svg>'});
   if(url.hostname==='raw.communitydragon.org' && process.env.ADVANCED_DATA && !failCore) {
     const name=url.pathname.endsWith('/items.cdtb.bin.json')?'cd-items.json':fs.readdirSync(fixtures).find(f=>f.toLowerCase()===path.basename(url.pathname));
     return route.fulfill({contentType:'application/json',body:read(name)});
   }
   if(failCore || url.hostname==='raw.communitydragon.org') return route.fulfill({status:503,body:'Unavailable'});
   let file=url.pathname.endsWith('/versions.json')?'versions.json':url.pathname.endsWith('/champion.json')?'champions.json':url.pathname.endsWith('/item.json')?'items.json':url.pathname.endsWith('/runesReforged.json')?'runes.json':path.basename(url.pathname);
   if(file==='Ahri.json')await new Promise(r=>setTimeout(r,100));
   return route.fulfill({contentType:'application/json',body:read(file)});
 });
 await page.goto(base+'/Builder.html');
 await page.waitForFunction(()=>document.querySelectorAll('#itemSlots button').length===7);
 await page.locator('#championPickerBtn').click();await page.locator('#modalChampSearch').fill('Ashe');await page.locator('[data-champ="Ashe"]').click();
 await page.waitForFunction(()=>document.querySelector('#championPickerBtn').getAttribute('aria-label')==='Selected champion: Ashe');
 await page.locator('#builderLevel').selectOption('6');await page.locator('#rank_q').selectOption('3');
 await page.locator('[data-slot="0"]').click();await page.locator('#modalItemSearch').fill('Long Sword');await page.locator('[data-item-id="1036"]').click();await page.locator('[data-set-item-id="1036"]').click();
 assert.equal(await page.locator('#slotText0 img').getAttribute('alt'),'Long Sword');
 await page.locator('#targetEnabled').click();await page.locator('#targetSettingsBtn').click();await page.locator('#targetMaxHp').fill('3000');await page.locator('#closeTargetModal').click();
 await page.locator('[aria-label="Add AA no crit"]').click();assert.equal(await page.locator('#comboSteps li').count(),1);
 assert.doesNotMatch(await page.locator('#statsTable').innerText(),/NaN|undefined/);
 assert.deepEqual(await page.evaluate(()=>['BUILDER','ComboUI','CalculationPipeline','SourceRepositories','BuildStats'].filter(name=>name in window)),[]);
 assert.equal(await page.locator('details[open]').count(),0);const beforeFirstSave=await page.locator('.toolbar-conditions').boundingBox();
 await page.locator('#buildName').fill('Native saved build');await page.locator('#saveBuild').click();assert.match(await page.locator('#saveStatus').innerText(),/Build saved/);

 assert.deepEqual(await page.locator('.toolbar-conditions').boundingBox(),beforeFirstSave);
 await page.evaluate(()=>{const key='lol-buildsmith.builds.v1',builds=JSON.parse(localStorage.getItem(key));delete builds[0].metrics;localStorage.setItem(key,JSON.stringify(builds));});
 const beforeSave=await page.locator('.toolbar-conditions').boundingBox();assert.deepEqual(await page.locator('.toolbar-conditions').boundingBox(),beforeSave);
 await page.goto(base+'/Comparator.html');await page.waitForFunction(()=>document.querySelectorAll('.compare-card').length===1);await page.waitForFunction(()=>document.querySelector('#compareStatus').textContent.includes('Numeric sorting is ready')); 
 await page.getByRole('button',{name:'Copy',exact:true}).click();assert.equal(await page.locator('.compare-card').count(),2);
 await page.locator('.compare-card').first().getByRole('button',{name:'Pin left',exact:true}).click();assert.equal(await page.locator('#pinnedBuild .compare-card').count(),1);
 await page.locator('#compareGrid .compare-card').getByRole('button',{name:'Edit item slot 2: Empty',exact:true}).click();await page.locator('#quickBuildHost #modalItemSearch').fill('Long Sword');await page.locator('#quickBuildHost [data-item-id="1036"]').click();await page.locator('#quickBuildHost [data-set-item-id="1036"]').click();await page.locator('#applyBuildChanges').click();
 await page.waitForFunction(()=>!document.querySelector('#quickBuildEditor').open);assert.equal(await page.locator('#compareGrid .compare-items img').count(),2);assert.equal(await page.locator('#pinnedBuild .compare-items img').count(),1);
 await page.locator('#compareGrid [aria-label^="Edit Q"]').click();await page.locator('#quickBuildHost #rank_q').selectOption('2');await page.locator('#applyBuildChanges').click();assert.match(await page.locator('#compareGrid .compare-abilities').innerText(),/Rank 2/);
 await page.locator('#compareGrid').getByRole('button',{name:/Target:/}).click();await page.locator('#quickBuildHost #targetMaxHp').fill('4000');await page.locator('#quickBuildHost #targetCurrentHp').fill('4000');await page.locator('#quickBuildHost #closeTargetModal').click();await page.locator('#applyBuildChanges').click();assert.match(await page.locator('#compareGrid').innerText(),/4000 HP/);
 await page.locator('#compareGrid summary').filter({hasText:'Combo Tester'}).click();await page.locator('#compareGrid').getByRole('button',{name:'Edit combo',exact:true}).click();await page.locator('#quickBuildHost [aria-label="Add AA no crit"]').click();await page.locator('#applyBuildChanges').click();
 const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('lol-buildsmith.builds.v1')));assert.equal(records[0].comboSteps.length,1);assert.equal(records[1].comboSteps.length,2);assert.ok(records[1].metrics.cost>records[0].metrics.cost);
 await page.locator('#compareGrid').getByRole('button',{name:'Edit build',exact:true}).click();await page.locator('#quickBuildHost #builderLevel').selectOption('1');await page.locator('#cancelBuildChanges').click();assert.match(await page.locator('#compareGrid').innerText(),/Level 6/);
 await page.getByRole('button',{name:'Unpin',exact:true}).click();await page.locator('#buildSort').selectOption('cost');await page.locator('#sortDirection').selectOption('desc');assert.match(await page.locator('#compareGrid .compare-card').first().innerText(),/copy/);
 await page.locator('#compareGrid .compare-card').first().getByRole('button',{name:/Move .* right/}).click();assert.equal(await page.locator('#buildSort').inputValue(),'manual');assert.doesNotMatch(await page.locator('#compareGrid .compare-card').first().locator('h2').innerText(),/copy/);
 await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.compare-card').length===2);assert.doesNotMatch(await page.locator('#compareGrid .compare-card').first().locator('h2').innerText(),/copy/);
 await page.locator('#compareGrid .compare-card').first().getByRole('button',{name:'Pin left',exact:true}).click();const pinnedX=(await page.locator('#pinnedBuild').boundingBox()).x;for(let i=0;i<3;i++)await page.locator('#compareGrid .compare-card').first().getByRole('button',{name:'Copy',exact:true}).click();await page.locator('#nextBuild').click();await page.waitForFunction(()=>document.querySelector('#compareGrid').scrollLeft>0);assert.equal((await page.locator('#pinnedBuild').boundingBox()).x,pinnedX);await page.locator('#previousBuild').click();
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/comparator-editing.png'});
 console.log('PASS editable comparator: independent items, ranks, target, combo, cancel, pin, sort, manual order persistence and mobile layout');

 const buildKey='lol-buildsmith.builds.v1',prefsKey='lol-buildsmith.compare.v1';
 const before=await page.evaluate(()=>localStorage.getItem('lol-buildsmith.builds.v1'));
 await page.evaluate(()=>localStorage.setItem('unrelated-test-data','keep me'));
 await page.locator('.saved-data-settings summary').click();await page.getByRole('button',{name:'Delete all builds',exact:true}).click();
 assert.equal(await page.locator('.saved-data-dialog [data-cancel-clear]:focus').count(),1);await page.locator('.saved-data-dialog [data-cancel-clear]').click();assert.equal(await page.evaluate(key=>localStorage.getItem(key),buildKey),before);
 await page.getByRole('button',{name:'Delete all builds',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.locator('.saved-data-dialog').isVisible(),false);
 await page.getByRole('button',{name:'Delete all builds',exact:true}).click();await page.getByRole('button',{name:'Delete builds',exact:true}).click();assert.equal(await page.locator('.compare-card').count(),0);assert.equal(await page.evaluate(key=>localStorage.getItem(key),buildKey),null);assert.ok(await page.evaluate(key=>localStorage.getItem(key),prefsKey));assert.match(await page.locator('.saved-data-status').innerText(),/deleted/);
 await page.evaluate(()=>localStorage.setItem('lol-buildsmith.builds.v1','invalid JSON'));await page.getByRole('button',{name:'Clear all saved data',exact:true}).click();await page.getByRole('button',{name:'Clear saved data',exact:true}).click();assert.equal(await page.evaluate(key=>localStorage.getItem(key),prefsKey),null);assert.equal(await page.locator('#buildSort').inputValue(),'manual');assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-test-data')),'keep me');
 await page.goto(base+'/main.html');await page.locator('.saved-data-settings summary').click();await page.evaluate(()=>{localStorage.setItem('lol-buildsmith.builds.v1','[]');localStorage.setItem('lol-buildsmith.compare.v1','{}');});await page.getByRole('button',{name:'Clear all saved data',exact:true}).click();await page.getByRole('button',{name:'Clear saved data',exact:true}).click();assert.equal(await page.evaluate(key=>localStorage.getItem(key),buildKey),null);assert.equal(await page.evaluate(key=>localStorage.getItem(key),prefsKey),null);assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-test-data')),'keep me');
 console.log('PASS saved data controls: cancel and Escape preserve builds, delete builds keeps preferences, full reset repairs corrupt data, only app keys removed, available on Home and Comparator');
 await page.goto(base+'/champ.html');await page.waitForFunction(()=>document.querySelectorAll('#abilities .ability-card').length===5);await page.locator('#champSearch').fill('Aurora');await page.waitForFunction(()=>document.querySelector('#champName').textContent.includes('Aurora'));
 await page.goto(base+'/itemLookup.html');await page.waitForFunction(()=>document.querySelectorAll('#itemGrid button').length>0);await page.locator('#itemSearch').fill('Long Sword');await page.locator('#itemGrid button').first().click();assert.match(await page.locator('#itemName').innerText(),/Long Sword/);
 assert.deepEqual(errors,[]);console.log('PASS actual native entry: champion, ranks, inventory, target and combo without injected test globals');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
