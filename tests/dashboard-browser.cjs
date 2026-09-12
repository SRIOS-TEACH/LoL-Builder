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
 await page.waitForFunction(()=>document.querySelectorAll('#itemSlots button').length===6);
 const select=async name=>page.evaluate(async name=>{
   await setChampion(name);BUILDER.level=18;document.getElementById('builderLevel').value='18';BUILDER.abilityRanks={q:5,w:5,e:5,r:3};renderStats();renderAbilityCards();
 },name);

 const out=path.join(fixtures,'screenshots');fs.mkdirSync(out,{recursive:true});
 await page.setViewportSize({width:1440,height:900});
 await select('Aatrox');
 assert.equal(await page.locator('#attackSummary [data-attack-result="damage"]').count(),1);
 assert.equal(await page.locator('#runePanel [data-rune-target]').count(),11);
 const fit=()=>page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
 let size=await fit();assert.ok(size.scrollWidth<=size.width&&size.scrollHeight<=size.height,JSON.stringify(size));
 assert.match(await page.locator('body').getAttribute('style'),/Aatrox_0.jpg/);
 const clipped=await page.locator('[data-ability-slot="q"]').evaluate(e=>e.scrollHeight>e.clientHeight+1);assert.equal(clipped,false,'Aatrox Q results fit inside card');
 await page.screenshot({path:path.join(out,'dashboard-desktop.png')});
 await page.locator('[data-ability-slot="q"] > details > summary').click();
 assert.equal(await page.locator('[data-ability-slot="q"] > details').getAttribute('open'),'');
 await page.keyboard.press('Escape');assert.equal(await page.locator('[data-ability-slot="q"] > details').getAttribute('open'),null);
 await page.locator('#runePanel [data-rune-target="primary_0"]').click();assert.ok(await page.locator('#runeModal').isVisible());
 await page.locator('#closeRuneModalBtn').click();
 await select('Aphelios');assert.match(await page.locator('body').getAttribute('style'),/Aphelios_0.jpg/);
 await page.locator('[data-attack-control="attack:weapon"]').selectOption('4');
 await page.setViewportSize({width:390,height:844});
 size=await fit();assert.ok(size.scrollWidth<=size.width,JSON.stringify(size));
 await page.screenshot({path:path.join(out,'dashboard-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('Dashboard layout, overlays, rune picker, splash switching and mobile width passed');
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
