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
 const readyArtwork=async()=>{if(process.env.REAL_ART){await page.waitForFunction(()=>[...document.images].filter(i=>{const r=i.getBoundingClientRect();return i.loading!=='lazy'||(r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0);}).every(i=>i.complete));}};
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 let failCore=false;
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin===base){if(process.env.STALE_STYLES && url.pathname==='/CSS/lolBuilder.css')return route.fulfill({contentType:'text/css',body:fs.readFileSync(path.join(root,'CSS/lolBuilder.css'),'utf8').replace(/@import[^;]*item-explorer[^;]*;/g,'')});return route.fallback();}
   requests.push(url.href);
   if(!url.pathname.endsWith('.json') && process.env.REAL_ART)return route.continue();
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

 await page.goto(base+'/champ.html');
 await page.waitForFunction(()=>document.querySelectorAll('#abilities .ability-card').length===5);
 assert.equal(await page.locator('#champRoster button').count(),Object.keys(index).length);
 await page.locator('#champSearch').fill('Aurora');await page.waitForFunction(()=>document.querySelector('#champName').textContent==='Aurora');
 assert.match(await page.locator('#champHeroCard').getAttribute('style'),/Aurora_0/);
 assert.equal(await page.locator('#champStats .champion-stat').count(),10);
 assert.equal(await page.locator('#champRoster [aria-pressed="true"]').count(),1);
 await page.locator('#champSearch').fill('not-a-champion');assert.equal(await page.locator('#champDetails').isVisible(),false);assert.match(await page.locator('#champStatus').innerText(),/No champions/);
 await page.locator('#champSearch').fill('');await page.locator('#champSelect').selectOption('Ahri');await page.locator('#champSelect').selectOption('Garen');await page.waitForFunction(()=>document.querySelector('#champName').textContent==='Garen');
 await page.locator('#champRoster [data-champion="Aurora"]').click();await page.waitForFunction(()=>document.querySelector('#champName').textContent==='Aurora');
 if(process.env.REAL_ART)await page.waitForFunction(()=>[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0;}).every(i=>i.complete));
 fs.mkdirSync('test-results/explorer-design',{recursive:true});
 await readyArtwork();await page.screenshot({path:'test-results/explorer-design/champion-desktop.png',fullPage:true});
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'champion overflow '+width);assert.ok(await page.evaluate(()=>document.querySelector('.navbar').getBoundingClientRect().bottom<=document.querySelector('.explorer-heading').getBoundingClientRect().top),'navigation overlaps content');if(width===390)await readyArtwork();await page.screenshot({path:'test-results/explorer-design/champion-mobile.png',fullPage:true});}
 await page.goto(base+'/itemLookup.html');await page.waitForFunction(()=>document.querySelectorAll('#itemGrid button').length>0);
 assert.equal(await page.locator('#explorerItemRoles button').count(),6);
 assert.equal(await page.locator('#itemFilters [data-item-filter]').count(),14);
 assert.equal(await page.locator('.item-catalog-cost').count(),0);
 const dimensions=await page.evaluate(()=>{const layout=document.querySelector('.item-explorer-layout').getBoundingClientRect();const detail=document.querySelector('.item-inspector').getBoundingClientRect();const grid=document.querySelector('#itemGrid');return {detailWidth:detail.width,expected:(layout.width-24)/2.3*.8,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,tile:grid.querySelector('button').getBoundingClientRect().width};});
 assert.ok(Math.abs(dimensions.detailWidth-dimensions.expected)<2,JSON.stringify(dimensions));assert.ok(dimensions.columns>=6&&dimensions.tile<110,JSON.stringify(dimensions));
 if(process.env.ADVANCED_DATA){await page.waitForFunction(()=>!document.querySelector('[data-item-role="Mage"]').disabled);await page.locator('[data-item-role="Mage"]').click();assert.equal(await page.locator('[data-item-role="Mage"]').getAttribute('aria-pressed'),'true');const records=JSON.parse(read('cd-items.json'));const classIds=new Set(Object.entries(records).filter(([,v])=>v.mItemAttributes?.includes(16)).map(([key,v])=>key.match(/Items\/(\d+)$/)?.[1] || String(v.itemID || v.id || "").match(/(\d+)$/)?.[1]).filter(Boolean));const shown=await page.locator('#itemGrid button').evaluateAll(buttons=>buttons.map(b=>b.dataset.itemId));assert.ok(shown.length>0);assert.ok(shown.every(id=>classIds.has(id)));await page.locator('#itemFilters [data-item-filter="AbilityHaste"]').click();assert.ok(await page.locator('#itemGrid button').count()>0);await page.locator('#explorerAllItems').click();assert.equal(await page.locator('#itemFilters [data-item-filter="AbilityHaste"]').getAttribute('aria-pressed'),'true');await page.locator('#resetItemFilters').click();}
 else {await page.waitForFunction(()=>document.querySelector('#itemRoleStatus').textContent.includes('unavailable'));assert.equal(await page.locator('[data-item-role="Mage"]').isDisabled(),true);}

 await page.locator('#itemSearch').fill('Long Sword');await page.locator('#itemGrid button').first().click();assert.equal(await page.locator('#itemName').innerText(),'Long Sword');assert.match(await page.locator('#itemCost').innerText(),/350 gold/);assert.equal(await page.locator('#itemGrid button:focus').count(),1);
 await page.locator('#itemSearch').fill('not-an-item');assert.equal(await page.locator('#itemIcon').isVisible(),false);assert.match(await page.locator('#itemGrid').innerText(),/No matching/);
 await page.locator('#resetItemFilters').click();assert.ok(await page.locator('#itemGrid button').count()>100);
 await page.locator('.map-checkbox:checked').uncheck();assert.equal(await page.locator('#itemGrid button').count(),0);await page.locator('#resetItemFilters').click();
 await page.locator('#itemFilters [data-item-filter="Armor"]').click();assert.ok(await page.locator('#itemGrid button').count()>0);await page.locator('#resetItemFilters').click();
 await page.locator('#itemGrid [data-item-id="3031"]').click();assert.equal(await page.locator('#itemName').innerText(),'Infinity Edge');
 await readyArtwork();await page.screenshot({path:'test-results/explorer-design/items-desktop.png',fullPage:true});
 for(const width of [390,768,900,1100,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'item overflow '+width);if(width>=768)assert.ok(await page.evaluate(()=>{const search=document.querySelector('#itemSearch').getBoundingClientRect(),maps=document.querySelector('#mapFilters').getBoundingClientRect();return search.width<=300&&maps.left>=search.right&&Math.abs(maps.bottom-search.bottom)<3;}),'search/maps same row '+width);assert.ok(await page.evaluate(()=>{const rail=document.querySelector('#itemFilters').getBoundingClientRect(),grid=document.querySelector('#itemGrid').getBoundingClientRect();return rail.right<=grid.left&&rail.width<50;}),'stat rail beside grid '+width);if(width===390){await page.locator('#itemGrid [data-item-id="3031"]').click();await readyArtwork();await page.screenshot({path:'test-results/explorer-design/items-mobile.png',fullPage:true});}}
 failCore=true;
 for(const [file,selector] of [['champ.html','#champStatus'],['itemLookup.html','#itemCount']]){await page.goto(base+'/'+file);await page.waitForFunction(selector=>/could not/i.test(document.querySelector(selector).textContent),selector);}
 assert.deepEqual(errors,[]);console.log('PASS explorer design: search, role roster, latest selection, named items, filters, keyboard focus, empty/error states and 390/768/1440px layouts');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
