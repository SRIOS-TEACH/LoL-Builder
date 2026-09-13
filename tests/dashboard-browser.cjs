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
 try {res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}
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
   if(url.origin===base)return route.continue();
   requests.push(url.href);
   if(url.pathname.endsWith('/splash/Aatrox_3.jpg')) return route.fulfill({status:404,body:'Missing splash'});
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
 const select=async name=>page.evaluate(async name=>{
   await setChampion(name);BUILDER.level=18;document.getElementById('builderLevel').value='18';BUILDER.abilityRanks={q:5,w:5,e:5,r:3};renderStats();renderAbilityCards();
 },name);

 const out=path.join(fixtures,'screenshots');fs.mkdirSync(out,{recursive:true});
 await page.setViewportSize({width:1440,height:900});
 await select('Aatrox');
 await page.waitForFunction(()=>!document.getElementById('skinSelector').disabled);
 const skinValues=await page.locator('#skinSelector option').evaluateAll(es=>es.map(e=>e.value));
 assert.ok(skinValues.includes('2'),'base skin with chromas remains');
 assert.ok(skinValues.includes('20'),'prestige year edition remains');
 assert.ok(!skinValues.includes('4'),'chroma omitted');
 assert.ok(!skinValues.includes('3'),'missing splash omitted');
 assert.equal(await page.locator('#attackSummary [data-attack-result="damage"]').count(),1);
 assert.ok(await page.locator('#runePanel [data-rune-choice-id]').count()>25);
 const fit=()=>page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
 let size=await fit();assert.ok(size.scrollWidth<=size.width&&size.scrollHeight<=size.height,JSON.stringify(size));
 assert.match(await page.locator('body').getAttribute('style'),/Aatrox_0.jpg/);

 await page.screenshot({path:path.join(out,'dashboard-desktop.png')});

 const q=page.locator('[data-ability-slot="q"]');
 assert.ok(await q.locator('.simple-description').isVisible());await q.locator('.detail-toggle').click();
 assert.ok(await q.locator('.detailed-description').isVisible());assert.equal(await q.locator('.simple-description').isVisible(),false);
 await q.locator('.detail-toggle').click();assert.ok(await q.locator('.simple-description').isVisible());
 await page.locator('#skinSelector').selectOption({index:1});assert.match(await page.locator('body').getAttribute('style'),/Aatrox_[1-9]/);
 assert.ok((await page.locator('#dashboardChampionTitle').innerText()).length>0);
 await page.locator('[data-slot="6"]').click();
 assert.ok((await page.locator('#modalItemGrid').innerText())!==undefined);
 const ids=await page.locator('#modalItemGrid [data-item-id]').evaluateAll(es=>es.map(e=>e.dataset.itemId));assert.deepEqual([...ids].sort(),['1200','1201','1202','1203','1204']);
 await page.locator('[data-item-id="1200"]').click();await page.locator('[data-set-item-id="1200"]').click();assert.equal(await page.evaluate(()=>BUILDER.itemSlots[6]),'1200');
 await page.evaluate(()=>{BUILDER.activeSlot=6;setSlotItem('3031');});assert.equal(await page.evaluate(()=>BUILDER.itemSlots[6]),'1200','regular items cannot occupy the quest slot');
 await page.locator('[data-slot="6"]').click();await page.locator('[data-set-item-id=""]').click();assert.equal(await page.evaluate(()=>BUILDER.itemSlots[6]),'');

 const role=async id=>{await page.locator('[data-slot="6"]').click();await page.locator('[data-item-id="'+id+'"]').click();await page.locator('[data-set-item-id="'+id+'"]').click();};
 await role('1200');await page.locator('#builderLevel').selectOption('20');assert.equal(await page.evaluate(()=>BUILDER.level),20);
 const hp20=await page.evaluate(()=>computeDerivedBuildStats().hp);await page.locator('#builderLevel').selectOption('18');assert.ok(hp20>await page.evaluate(()=>computeDerivedBuildStats().hp));
 await role('1201');assert.equal(await page.locator('#builderLevel option').count(),18);
 await page.locator('[data-slot="0"]').click();assert.ok(await page.locator('[data-item-id="3175"]').isVisible());await page.locator('[data-item-id="3175"]').click();await page.locator('[data-set-item-id="3175"]').click();
 await role('1202');assert.equal(await page.locator('#itemSlots button').count(),8);assert.equal(await page.evaluate(()=>BUILDER.itemSlots[0]),'');assert.equal(await page.evaluate(()=>BUILDER.itemSlots[7]),'3020');
 await page.locator('[data-slot="7"]').click();assert.equal(await page.locator('[data-item-id="3031"]').count(),0);await page.locator('#closeItemModalBtn').click();
 await page.evaluate(()=>{for(let i=0;i<6;i++)BUILDER.itemSlots[i]='3031';renderItemSlots();});await role('1200');assert.equal(await page.evaluate(()=>BUILDER.itemSlots[6]),'1202');await page.locator('#closeItemModalBtn').click();
 await page.evaluate(()=>{BUILDER.itemSlots[0]='';});await role('1200');assert.equal(await page.evaluate(()=>BUILDER.itemSlots[0]),'3020');assert.equal(await page.locator('#itemSlots button').count(),7);
 assert.equal(await q.locator('.ability-dps').isVisible(),false);assert.ok(await q.locator('.ability-damage-summary').isVisible());await q.locator('.detail-toggle').click();assert.ok(await q.locator('.ability-dps').isVisible());assert.equal(await q.locator('.ability-dps th').first().innerText(),'Part');await q.locator('.detail-toggle').click();
 const sizes=await page.locator('[data-ability-slot="q"],[data-ability-slot="w"],[data-ability-slot="e"],[data-ability-slot="r"]').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));assert.ok(sizes.every(s=>Math.abs(s.w-sizes[0].w)<1&&Math.abs(s.h-sizes[0].h)<1));
 await select('Aphelios');assert.match(await page.locator('body').getAttribute('style'),/Aphelios_0.jpg/);
 await page.locator('[data-attack-control="attack:weapon"]').selectOption('4');
 await page.setViewportSize({width:390,height:844});
 size=await fit();assert.ok(size.scrollWidth<=size.width,JSON.stringify(size));
 await page.screenshot({path:path.join(out,'dashboard-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('Dashboard layout, overlays, rune picker, splash switching and mobile width passed');
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
