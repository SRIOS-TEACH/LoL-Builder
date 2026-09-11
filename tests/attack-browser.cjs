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

 const result=()=>page.evaluate(()=>({s:computeDerivedBuildStats(),p:computeAutoAttackProfile(computeDerivedBuildStats())}));
 const equip=async ids=>page.evaluate(ids=>{BUILDER.itemSlots=Array.from({length:6},(_,i)=>ids[i]||null);renderStats();renderAbilityCards();},ids);
 const near=(a,b,message)=>assert.ok(Math.abs(a-b)<0.02,message+': '+a+' != '+b);
 await select('Ahri');await equip(['3031']);
 let x=await result();near(x.p.autoAttackDamage,x.s.ad*(1+x.s.critChance/100*(x.s.critDamage/100-1)),'average crit including IE');
 assert.match(await page.locator('.ability-attack-card').innerText(),/On-attack damage:/);
 assert.match(await page.locator('[data-attack-result="damage"]').getAttribute('title'),/Average attack/);
 if(process.env.ADVANCED_DATA){
   for(const n of ['Yasuo','Yone','Senna']){await select(n);await equip(['3031']);x=await result();assert.ok(x.s.critDamage<230,n+' crit modifier');assert.ok(x.p.autoAttackDamage>x.s.ad,n+' averaged crit');}
   await select('Ahri');await equip(['3115','3091','3302']);x=await result();assert.equal(x.p.rows.length,3);assert.ok(x.p.rows.every(r=>r.value>0));
   await equip(['3153']);x=await result();assert.equal(x.p.autoAttackDamage,null);
   await page.locator('[data-attack-control="attack:target:currentHp"]').fill('2000');await page.locator('[data-attack-control="attack:target:currentHp"]').dispatchEvent('change');x=await result();near(x.p.rows[0].value,120,'ranged BORK');
   await select('KogMaw');await equip([]);const initial=(await result()).p.autoAttackDamage;
   await page.locator('[data-attack-control="attack:target:hp"]').fill('2000');await page.locator('[data-attack-control="attack:target:hp"]').dispatchEvent('change');
   await page.locator('[data-ability-slot="w"] [data-attack-control="attack:championOnHit"]').click();x=await result();near(x.p.autoAttackDamage-initial,2000*(0.06+x.s.ap*0.00015),'Kog W health onhit');
   await page.locator('[data-attack-control="attack:championOnHit"]').click();near((await result()).p.autoAttackDamage,initial,'toggle off');
   await select('Teemo');x=await result();assert.ok(x.p.rows.find(r=>r.dot));
   await select('Jhin');x=await result();assert.ok(x.p.rate<x.s.asTotal);assert.equal(x.p.autoAttackDamage,null);
 }
 const audit=[];
 for(const name of Object.keys(index)){
   await select(name);await equip([]);x=await result();await page.evaluate(()=>{for(let pass=0;pass<3;pass++){const p=computeAutoAttackProfile(computeDerivedBuildStats());for(const c of p.controls)BUILDER.combatValues[c.key]=c.type==='toggle'?true:c.key.endsWith(':hp')?2000:c.key.endsWith(':currentHp')?1000:Math.min(c.max??2,2);}renderStats();renderAbilityCards();});x=await result();audit.push({name,damage:x.p.autoAttackDamage,rows:x.p.rows,warnings:x.p.warnings});
   assert.ok(x.p.autoAttackDamage===null||Number.isFinite(x.p.autoAttackDamage),name+' finite damage');
   assert.ok(x.p.attackDps===null||Number.isFinite(x.p.attackDps),name+' finite DPS');
 }
 if(process.env.ADVANCED_DATA){
   await select('Ahri');
   for(const id of ['1043','3115','3091','3124','3153','3042','3302','3748','3057','3078','3100','6662','3508','3877','2510','6672','3094','3095','2015','3087','3504','6699','3179','6610','2512','4645']){
     if(!await page.evaluate(id=>!!BUILDER.items[id],id))continue;
     await equip([id]);await page.evaluate(()=>{BUILDER.combatValues={};for(let pass=0;pass<3;pass++)for(const c of computeAutoAttackProfile(computeDerivedBuildStats()).controls)BUILDER.combatValues[c.key]=c.type==='toggle'?true:c.key.endsWith(':currentHp')?1000:c.key.endsWith(':hp')?2000:Math.min(c.max??10,10);});
     x=await result();assert.ok(Number.isFinite(x.p.autoAttackDamage),'item '+id+': '+x.p.breakdown);
   }
 }
 await select('KogMaw');await equip(['3115','3091']);
 if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.locator('.ability-attack-card details').evaluate(e=>e.open=true);await page.locator('.ability-attack-card').screenshot({path:path.join(process.env.SCREENSHOT_DIR,'on-attack.png')});}
 if(process.env.AUDIT_OUTPUT)fs.writeFileSync(process.env.AUDIT_OUTPUT,JSON.stringify(audit,null,2));
 assert.deepEqual(errors,[]);
 console.log('Attack browser checks passed for '+Object.keys(index).length+' champions');
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});


