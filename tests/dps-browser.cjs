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
   await setChampion(name);BUILDER.level=18;BUILDER.abilityRanks={q:5,w:5,e:5,r:3};renderStats();renderAbilityCards();
 },name);
 const get=slot=>page.locator(`[data-ability-slot="${slot}"] .ability-dps`).innerText();
 await select('Aatrox');
 assert.match(await get('q'),/Combined total/);
 if(process.env.ADVANCED_DATA) {
   assert.doesNotMatch(await get('q'),/unavailable/i);
   const before=await get('q');await page.locator('#rank_q').selectOption('1');
   assert.notEqual(await get('q'),before);
   await page.evaluate(()=>{BUILDER.itemSlots[0]='3133';renderStats();renderAbilityCards();});
   assert.notEqual(await get('q'),before);
   await page.evaluate(()=>{BUILDER.itemSlots.fill(null);renderStats();renderAbilityCards();});
 }
 await page.locator('#rank_q').selectOption('0');assert.match(await get('q'),/Unlearned/);
 await select('Ziggs');assert.match(await get('r'),/Outer blast \(centre\)/);
 if(process.env.ADVANCED_DATA)assert.doesNotMatch(await get('r'),/unavailable/i);
 await select('Yasuo');assert.match(await get('q'),/whirlwind/);assert.match(await get('q'),/circular strike/);
 await select('Yone');
 if(process.env.ADVANCED_DATA)assert.doesNotMatch(await get('q'),/unavailable/i);
 await select('LeeSin');
 assert.match(await get('q'),/Enter recast timing/);
 await page.locator('[data-combat-key="dps:q:delay"]').fill('2');
 await page.locator('[data-combat-key="dps:q:delay"]').dispatchEvent('change');
 await page.locator('[data-combat-key="dps:q:overlap"]').selectOption('false');
 assert.doesNotMatch(await get('q'),/Enter recast timing/);
 await page.locator('[data-combat-key="dps:q:delay"]').fill('');
 await page.locator('[data-combat-key="dps:q:delay"]').dispatchEvent('change');
 assert.match(await get('q'),/Enter recast timing/);
 if(process.env.ADVANCED_DATA){
   for(const [name,form]of [['Jayce','Cannon Q'],['Nidalee','Cougar Q'],['Gnar','Mega Q'],['Elise','Spider Q']]) {
     await select(name);
     assert.equal(await page.locator('[data-ability-slot="q"] .ability-dps-form').count(),1,`${name}: ${await page.locator('[data-ability-slot="q"]').innerText()}`);
     assert.match(await page.locator('[data-ability-slot="q"] .ability-dps-form').innerText(),new RegExp(form));
     assert.doesNotMatch(await page.locator('[data-ability-slot="q"] .ability-dps-form').innerText(),/Alternate form data unavailable/);
   }
 }
 const audit=[];
 for(const name of Object.keys(index)) {
   await select(name);
   const results=await page.evaluate(()=>BUILDER.championData.spells.map((spell,i)=>{
     const key=['q','w','e','r'][i],rank=BUILDER.abilityRanks[key],ctx=buildAbilityContext(spell,rank,key);
     const tooltip=expandAbilityLocalization(spell.tooltip||spell.description||'');
     const result=AbilityDps.profile({spell,rank,tooltip,payload:ctx.cdragonSpell,
       cooldown:AbilityDps.cooldown(spell,rank,ctx.stats,ctx.cdragonSpell),resolve:token=>resolveAbilityToken(token,ctx)});
     return {id:spell.id,rows:result.rows,status:result.status,tooltip};
   }));
   assert.doesNotMatch(await page.locator('#abilityCards').innerText(),/NaN|Infinity|undefined|Not modeled/);
   audit.push(...results);
 }
 if(process.env.AUDIT_OUTPUT)fs.writeFileSync(process.env.AUDIT_OUTPUT,JSON.stringify(audit,null,2));
 await select('Aatrox');
 if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.locator('#abilityCards').screenshot({path:path.join(process.env.SCREENSHOT_DIR,'ability-dps.png')});}
 assert.deepEqual(errors,[]);
 console.log(`DPS browser checks passed for ${Object.keys(index).length} champions / ${audit.length} abilities (${process.env.ADVANCED_DATA?'advanced':'fallback'} data).`);
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
