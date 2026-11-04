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

 await page.goto(base+'/Builder.html');await page.waitForFunction(()=>document.querySelectorAll('#itemSlots button').length===7);
 const samples=await page.evaluate(async()=>{const {builderPage:page}=await import('./JS/builder.js');const {captureBuild}=await import('./JS/application/buildSnapshot.mjs');const samples=[];for(const champion of ['Morgana','Aatrox','Velkoz','Ahri','Sivir','Yasuo','Mel']){await page.inspect.setChampion(champion);page.state.level=18;page.state.abilityRanks={q:5,w:5,e:5,r:3};page.state.itemSlots=['3040','3155','4632',null,null,null,null];page.inspect.enforceAbilityRules();page.inspect.renderItemSlots();page.inspect.renderStats();page.inspect.renderAbilityCards();const build=captureBuild(page,document.body,{},champion);const {default:Saved}=await import('./JS/shared/savedBuilds.js');Saved.save(build);samples.push({champion,shields:build.shieldOptions,abilities:build.abilitySummary.map(a=>({slot:a.slot,dps:a.abilityDps,charges:a.charges}))});}return samples;});
 console.log('Captured shield and charge profiles for Morgana, Aatrox, Velkoz and Ahri');assert.ok(samples[0].shields.some(s=>s.name==="Seraph's Embrace"&&s.amount>0));assert.ok(samples[0].shields.some(s=>s.name==='Hexdrinker'&&s.type==='magic'&&s.amount>0));assert.ok(samples[0].shields.some(s=>s.name==='Black Shield'&&s.type==='magic'&&s.amount>0));assert.ok(samples[1].abilities.find(a=>a.slot==='q').dps.every(r=>r.dps!=='—'));assert.ok(samples[2].abilities.find(a=>a.slot==='w').dps.every(r=>r.dps!=='—'));assert.equal(samples[2].abilities.find(a=>a.slot==='w').charges.max,2);assert.equal(samples[3].abilities.find(a=>a.slot==='r').charges.max,3);
 await page.goto(base+'/Comparator.html');await page.waitForFunction(()=>document.querySelectorAll('.compare-card').length===7);
 const vel=page.locator('.compare-card').filter({has:page.getByRole('heading',{name:'Velkoz',exact:true})}).locator('[data-slot="w"]');assert.equal(await vel.locator('.charge-badge').innerText(),'1 / 2');const first=await vel.locator('span').innerText();await vel.click();assert.equal(await vel.locator('.charge-badge').innerText(),'2 / 2');assert.notEqual(await vel.locator('span').innerText(),first);assert.equal(await page.locator('#quickBuildEditor').isVisible(),false);await vel.click();assert.equal(await vel.locator('.charge-badge').innerText(),'1 / 2');
 const ahri=page.locator('.compare-card').filter({has:page.getByRole('heading',{name:'Ahri',exact:true})}).locator('[data-slot="r"]');assert.equal(await ahri.locator('.charge-badge').innerText(),'1 / 3');await ahri.click();assert.equal(await ahri.locator('.charge-badge').innerText(),'2 / 3');await ahri.press('Enter');assert.equal(await ahri.locator('.charge-badge').innerText(),'3 / 3');await ahri.click();assert.equal(await ahri.locator('.charge-badge').innerText(),'1 / 3');
 const defense=page.locator('.defense-panel').first();assert.match(await defense.innerText(),/actual HP/);await defense.getByRole('button',{name:'Add shield',exact:true}).click();await page.locator('.build-picker').getByRole('button',{name:/Black Shield/}).click();await page.getByRole('button',{name:'Add',exact:true}).click();assert.match(await defense.locator('.selected-shields').innerText(),/Black Shield/);await defense.locator('.shield-row').click();await page.getByLabel('Shield HP',{exact:true}).fill('500');await page.getByRole('button',{name:'Save changes',exact:true}).click();assert.match(await defense.locator('.selected-shields').innerText(),/500 HP/);
 const beforeSpell=await defense.locator('.defense-total').innerText();await defense.getByRole('button',{name:'Add shield',exact:true}).click();await page.getByRole('button',{name:'Custom spellshield',exact:true}).click();await page.getByLabel('Shield name',{exact:true}).fill('Test protection');await page.getByRole('button',{name:'Add',exact:true}).click();assert.match(await defense.locator('.selected-shields').innerText(),/Test protection - Spellshield/);assert.equal(await defense.locator('.defense-total').innerText(),beforeSpell);await defense.getByRole('button',{name:'Test protection - Spellshield',exact:true}).click();await page.getByRole('button',{name:'Remove shield',exact:true}).click();assert.equal(await defense.locator('.shield-row').count(),1);
 await defense.getByRole('slider').evaluate(e=>{e.value='80';e.dispatchEvent(new Event('input',{bubbles:true}));});await defense.getByRole('button',{name:'Apply split to compared builds',exact:true}).click();assert.ok((await page.locator('.defense-panel input[type="range"]').evaluateAll(es=>es.map(e=>e.value))).every(v=>v==='80'));assert.equal(await page.locator('.shield-row').count(),1);
 const firstCard=page.locator('.compare-card').first();await firstCard.getByRole('button',{name:'Target settings · Off',exact:true}).click();await page.getByLabel('Flat armor penetration',{exact:true}).fill('20');await page.locator('#quickBuildHost #closeTargetModal').click();await page.locator('#applyBuildChanges').click();const firstId=await firstCard.getAttribute('data-build-id');assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('lol-buildsmith.defense.v1:'+id)).armorPenFlat,firstId),20);
 await firstCard.getByRole('button',{name:'Target settings · Off',exact:true}).click();await page.getByLabel('Flat armor penetration',{exact:true}).fill('30');await page.locator('#quickBuildHost #closeTargetModal').click();await page.locator('#cancelBuildChanges').click();assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('lol-buildsmith.defense.v1:'+id)).armorPenFlat,firstId),20);
 assert.ok(samples[4].shields.some(s=>s.name==='Spell Shield'&&s.type==='spell'&&s.amount===0));assert.ok(samples[5].shields.some(s=>/Wind Wall/.test(s.name)&&s.type==='spell'));assert.ok(samples[6].shields.some(s=>/Rebuttal/.test(s.name)&&s.type==='spell'));assert.ok(samples[0].shields.some(s=>/Verdant/.test(s.name)&&s.type==='spell'));assert.equal(await page.getByRole('button',{name:'Target settings · penetration',exact:true}).count(),0);
 assert.doesNotMatch(await page.locator('body').innerText(),/prototype|TEST ONLY/);await firstCard.screenshot({path:'test-results/defense-layout.png'});assert.deepEqual(errors,[]);console.log('PASS typed shields, penetration, live labels, Velkoz 1–2 wrap, Ahri 1–3 keyboard cycling');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
