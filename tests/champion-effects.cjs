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


 const results=await page.evaluate(async()=>{
  const results=[];
  const near=(a,b,message)=>{if(!Number.isFinite(a)||Math.abs(a-b)>0.01)throw Error(`${message}: ${a} != ${b}`);};
  for(const name of ['Chogath','Poppy','Malphite','Swain','Thresh','Veigar','Senna','Belveth','Sion','Garen','Syndra']){
   await setChampion(name);BUILDER.level=18;BUILDER.abilityRanks={q:5,w:5,e:5,r:3};BUILDER.combatValues={};
   const initial=computeDerivedBuildStats(),model=ChampionEffects.model(BUILDER);
   if(name==='Chogath'){
    BUILDER.combatValues['buff:{8682fc00}']=6;
    let current=computeDerivedBuildStats();near(current.hp-initial.hp,6*model.data('r','RHealthPerStack'),'Feast HP');
    near(getComputedChampionStatsForTooltips().bonusHp-(initial.hp-initial.base.hp-initial.base.hpperlevel*BuildStats.growthFactor(18)),6*model.data('r','RHealthPerStack'),'Feast bonus HP');
    near(current.attackRange-initial.attackRange,Math.min(model.data('r','MaxBonusAttackRange'),6*model.data('r','AttackRangePerStack')),'Feast range');
    near(computeDerivedBuildStats().hp,current.hp,'Repeat calculation');
    BUILDER.abilityRanks.r=1;near(computeDerivedBuildStats().hp-initial.hp,6*ChampionEffects.model(BUILDER).data('r','RHealthPerStack'),'Rank change');
   }else if(name==='Poppy'){
    BUILDER.abilityRanks.w=0;const without=computeDerivedBuildStats();BUILDER.abilityRanks.w=5;
    near(initial.armor,without.armor*(1+model.data('w','PassiveResistPercent')),'Poppy armor');
    BUILDER.combatValues['self:healthPercent:0']=0.3;near(computeDerivedBuildStats().mr,without.mr*(1+2*model.data('w','PassiveResistPercent')),'Poppy low health MR');
   }else if(name==='Malphite'){
    BUILDER.combatValues['state:graniteShield']=true;const active=computeDerivedBuildStats();
    const before=initial.armor-initial.championBonuses.armor;
    near(active.armor,before*(1+model.data('w','BonusArmorPassive')*model.data('w','BonusArmorPassiveMultiplier')),'Granite armor');
   }else{
    const field=model.fields.find(f=>!f.boolean);BUILDER.combatValues[field.key]=100;
    const current=computeDerivedBuildStats();const changed=Object.keys(current.championBonuses).some(k=>Math.abs(current[k]-initial[k])>0.01);
    if(name==='Syndra'){BUILDER.combatValues[field.key]=120;BUILDER.itemSlots[0]='3089';if(!(computeDerivedBuildStats().ap>initial.ap))throw Error('Syndra capstone');BUILDER.itemSlots[0]=null;}
    else if(!changed)throw Error(`${name} stacks did not change stats`);
   }
   renderAbilityCards();renderStats();
   for(const f of ChampionEffects.model(BUILDER).fields){if(document.querySelectorAll(`[data-combat-key="${f.key}"]`).length!==1)throw Error(`${name} duplicate/missing ${f.key}`);}
   BUILDER.combatValues={};BUILDER.abilityRanks={q:5,w:5,e:5,r:3};near(computeDerivedBuildStats().hp,initial.hp,'Clear stacks');
   results.push(name);
  }
  for(const [name,slot]of [['Garen','e'],['Belveth','q'],['Belveth','e'],['Sett','w'],['Syndra','w'],['XinZhao','e'],['Kaisa','q'],['Kaisa','w'],['Kaisa','e'],['Bard','w'],['Malphite','w']]){
   await setChampion(name);BUILDER.level=18;BUILDER.abilityRanks={q:5,w:5,e:5,r:3};
   const html=buildDetailedAbilityText(BUILDER.championData.spells[['q','w','e','r'].indexOf(slot)],5,slot);
   if(/value unavailable/i.test(html))throw Error(`${name} ${slot} still unavailable`);
  }

  for(const name of ['Veigar','Thresh','Syndra']){
   await setChampion(name);BUILDER.level=18;BUILDER.abilityRanks={q:5,w:5,e:5,r:3};BUILDER.itemSlots=['3089',null,null,null,null,null];
   const before=computeDerivedBuildStats(),model=ChampionEffects.model(BUILDER),field=model.fields[0];
   BUILDER.combatValues[field.key]=name==='Syndra'?120:100;
   const after=computeDerivedBuildStats();
   const expected=name==='Syndra'?before.ap/before.passiveLedger.apMultiplier*model.data('p','CapstoneAPPerc'):100*(name==='Thresh'?model.data('p','StatValuePerSoul'):model.calc('p','APPerStack'))*before.passiveLedger.apMultiplier;
   near(after.ap-before.ap,expected,`${name} Deathcap interaction`);
  }
  BUILDER.itemSlots=[null,null,null,null,null,null];
  return results;
 });
 console.log('Champion stat effects and repaired numeric tooltips passed:',results.join(', '));
 assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
