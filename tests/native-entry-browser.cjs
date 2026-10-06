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
 assert.deepEqual(errors,[]);console.log('PASS actual native entry: champion, ranks, inventory, target and combo without injected test globals');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
