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
 assert.equal(await page.locator('#builderStatus').textContent(),'');
 await page.locator('#championPickerBtn').click();
 await page.locator('#modalChampSearch').fill('Ashe');
 await page.locator('[data-champ="Ashe"]').click();
 await page.waitForFunction(()=>document.querySelector('#championPickerBtn').getAttribute('aria-label')==='Selected champion: Ashe');
 assert.doesNotMatch(await page.locator('#statsTable').innerText(),/NaN|undefined/);
 await page.locator('#builderLevel').selectOption('18');
 await page.locator('#rank_q').selectOption('5');
 await page.locator('#rank_r').selectOption('3');
 await page.locator('#builderLevel').selectOption('1');
 assert.equal(await page.locator('#rank_r').inputValue(),'0');
 await page.locator('[data-slot="0"]').click();
 await page.locator('#modalItemSearch').fill('Long Sword');
 await page.locator('#modalItemGrid [data-item-id="1036"]').click();
 await page.locator('[data-set-item-id="1036"]').click();
 assert.equal(await page.locator('#slotText0 img').getAttribute('alt'),'Long Sword');
 await page.locator('[data-slot="0"]').click();
 await page.locator('[data-set-item-id=""]').click();
 assert.equal((await page.locator('#slotText0').innerText()).trim(),'+');
 await page.locator('[data-rune-target="shard_0"]').click();
 await page.locator('[data-rune-option-id="ability-haste"]').click();
 assert.equal(await page.evaluate(()=>getRuneStats().haste),8);
 if(process.env.SCREENSHOT_DIR){
   fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});
   await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'builder.png'),fullPage:true});
 }
 await page.evaluate(async()=>{await Promise.all([setChampion('Ahri'),setChampion('Garen')]);});
 assert.equal(await page.evaluate(()=>BUILDER.selectedChampion),'Garen');
 console.log('PASS builder UI: champion, level, abilities, item add/remove, rune, request race');
 if(process.env.ADVANCED_DATA){
   const details=await page.evaluate(async()=>{
     await setChampion('Chogath');BUILDER.level=18;BUILDER.abilityRanks={q:5,w:5,e:5,r:3};
     BUILDER.activeSlot=0;setSlotItem('3040');renderStats();renderAbilityCards();renderModalItemDetail('3040');
     const stats=getComputedChampionStatsForTooltips();
     const payload=buildResolvedSpellPayload(BUILDER.cdragonAbilityData.r,3,stats);
     const feast=Calculations.lookup(payload.calcLookup,'RDamage');
     if(Math.abs(feast.total-(650+.5*stats.ap+.1*stats.bonusHp))>.001)throw Error('Feast formula mismatch');
     const html=resolveItemDescriptionHtml(BUILDER.items['3040'],'3040').html;
     if(!/20 Ability Power/.test(html)||!/[\d.]+ Shield/.test(html))throw Error('Seraph numeric values missing');
     if(/AbilityResourceByCoefficientCalculationPart|\(0s\)|<scaleAP>\s*Ability Power/.test(html))throw Error('Seraph unresolved display');
     return {feast:feast.total,html,stats,abilityText:document.querySelector('#abilities')?.innerText};
   });
   console.log('PASS live-data Feast and Seraph integration: Feast '+details.feast);
   const stacks=page.locator('#abilityCards [data-combat-key="buff:{8682fc00}"]');
   assert.equal(await stacks.count(),1);
   assert.equal(await page.locator('[data-ability-slot="r"] [data-combat-key="buff:{8682fc00}"]').count(),1);
   await stacks.fill('6');await stacks.press('Tab');
   assert.equal(await page.evaluate(()=>calculationContext(getComputedChampionStatsForTooltips()).buffs['{8682fc00}']),6);
   await page.locator('#abilityCards [data-combat-key="buff:{8682fc00}"]').fill('');
   await page.locator('#abilityCards [data-combat-key="buff:{8682fc00}"]').press('Tab');
   assert.equal(await page.evaluate(()=>calculationContext(getComputedChampionStatsForTooltips()).buffs['{8682fc00}']),undefined);
   await page.evaluate(async()=>{await setChampion('Smolder');BUILDER.level=18;BUILDER.abilityRanks={q:5,w:5,e:5,r:3};renderAbilityCards();});
   assert.equal(await page.locator('#abilityCards [data-combat-key^="buff:"]').count(),1);
   const smolder=page.locator('[data-ability-slot="p"] [data-combat-key="buff:{32bcea5d}"]');
   await smolder.fill('100');await smolder.press('Tab');
   const scaled=await page.evaluate(()=>{
     const p=BUILDER.cdragonAbilityData.p;const context=calculationContext(getComputedChampionStatsForTooltips(),p.dataValues,1,p.calculations);
     return ['Passive_QDamageIncrease','Passive_WDamageIncrease','EBonusDamage'].map(key=>Calculations.evaluate(p.calculations[key],context).value);
   });
   for(const [i,want]of [25,55,8].entries())assert.ok(Math.abs(scaled[i]-want)<.001);
   assert.doesNotMatch(await page.locator('#abilityCards').innerText(),/value unavailable/i);
   if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'smolder-shared-stacks.png'),fullPage:true});
   await page.evaluate(async()=>{await setChampion('Zed');BUILDER.combatValues={'target:hp:0':2000,'target:healthPercent:0':.25};renderAbilityCards();});
   assert.equal(await page.locator('[data-combat-key^="target:"]').count(),0);
   const target=await page.evaluate(()=>{
     const calc={__type:'GameCalculation',mFormulaParts:[{__type:'StatByCoefficientCalculationPart',mStat:12,'{a8cb9c14}':true,mCoefficient:.12}]};
     return Calculations.evaluate(calc,calculationContext(getComputedChampionStatsForTooltips()));
   });
   assert.equal(target.value,null);assert.match(target.text,/12% Target Max HP/);
   console.log('PASS shared Smolder stacks, per-ability controls and formula-only target scaling');
   if(process.env.SCREENSHOT_DIR){
     fs.writeFileSync(path.join(process.env.SCREENSHOT_DIR,'calculation-details.json'),JSON.stringify(details,null,2));
     await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'calculations.png'),fullPage:true});
   }
 }
 // Exercise the entire downloaded catalog through the real renderers and calculations.
 const champions=Object.keys(index);
 for(const name of champions){
   await page.evaluate(async name=>{
     await setChampion(name);
     if(BUILDER.selectedChampion!==name)throw Error('Champion not selected: '+name);
     for(const level of [1,6,11,18]){
       BUILDER.level=level;BUILDER.abilityRanks={q:5,w:5,e:5,r:3};enforceAbilityRules();renderStats();renderAbilityCards();
       if(/NaN|undefined/.test(document.querySelector('#statsTable').innerText))throw Error('Invalid stats: '+name);
     }
   },name);
 }
 console.log(`PASS ${champions.length} champions at levels 1, 6, 11, 18 (advanced data: ${!!process.env.ADVANCED_DATA})`);
 const builderItems=await page.evaluate(()=>{
   const ids=Object.keys(BUILDER.items);
   for(const id of ids){
     BUILDER.activeSlot=0;setSlotItem(id);renderModalItemDetail(id);
     const stats=computeDerivedBuildStats();
     for(const key of ['hp','ad','ap','abilityHaste','asTotal','critChance']){
       if(!Number.isFinite(stats[key]))throw Error(id+': invalid '+key);
     }
   }
   BUILDER.activeSlot=0;setSlotItem('3158');
   if(getItemStats().haste!==10)throw Error('Ionian Boots lost haste');
   return ids.length;
 });
 console.log(`PASS ${builderItems} builder items: equip, stats, details; item haste fallback`);
 await page.goto(base+'/itemLookup.html');
 await page.waitForFunction(()=>document.querySelectorAll('#itemGrid button').length>0);
 if(process.env.ADVANCED_DATA){
   await page.evaluate(()=>showItem('3040'));
   await page.locator('#combatInputs summary').click();
   for(const [key,value]of [['self:mp:0','2000'],['self:mp:2','1000']]){
     await page.locator(`[data-combat-key="${key}"]`).fill(value);
     await page.locator(`[data-combat-key="${key}"]`).press('Tab');
   }
   assert.match(await page.locator('#itemTooltipMain').innerText(),/360 Shield/);
   assert.match(await page.locator('#itemTooltipMain').innerText(),/20 Ability Power/);
   console.log('PASS standalone item inputs update shield and AP values');
 }
 const itemCount=await page.evaluate(()=>{
   const ids=Object.keys(ITEM_STATE.items);
   for(const id of ids)showItem(id);
   return ids.length;
 });
 await page.locator('#itemSearch').fill('zz-no-item');
 assert.equal(await page.locator('#itemCount').textContent(),'0 items');
 assert.equal(await page.locator('#itemName').textContent(),'No item selected');
 await page.locator('#itemSearch').fill('');
 await page.locator('.map-checkbox:checked').uncheck();
 assert.equal(await page.locator('#itemCount').textContent(),'0 items');
 console.log(`PASS ${itemCount} item tooltips; empty search and map filters`);
 await page.goto(base+'/champ.html');
 await page.waitForFunction(()=>document.querySelectorAll('#abilities .ability-card').length===5);
 await page.evaluate(async()=>{await Promise.all([renderChampion('Ahri'),renderChampion('Garen')]);});
 assert.match(await page.locator('#champName').textContent(),/Garen/);
 for(const name of champions)await page.evaluate(name=>renderChampion(name),name);
 console.log(`PASS champion lookup: ${champions.length} champions and selection race`);
 failCore=true;
 for(const [file,selector] of [['Builder.html','#builderStatus'],['itemLookup.html','#itemCount'],['champ.html','#champName']]){
   await page.goto(base+'/'+file);
   await page.waitForFunction(selector=>/could not|failed/i.test(document.querySelector(selector).textContent),selector);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS all three startup failure states; no uncaught browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
