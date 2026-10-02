// Demonstrate explorer browsing and independent build inputs with captured data, without a page.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createRepository}=require('../JS/data/sourceRepositories.js');
const {createCatalogSession}=require('../JS/application/catalogSession.js');
const queries=require('../JS/domain/catalogQueries.js');
const builds=require('../JS/domain/buildInputs.js');
const scenarios=require('../JS/domain/scenarioInputs.js');
const runeSource=require('../JS/data/runeSource.js');
const runeInputs=require('../JS/domain/runeInputs.js');
const stats=require('../JS/shared/buildStats.js');
const {deepFreeze}=require('../JS/core/records.js');
const fixtures=path.resolve(process.env.FIXTURES_DIR || path.join(__dirname,'../tests/fixtures'));
const output=path.resolve(process.env.REUSE_OUTPUT || path.join(__dirname,'../test-results/phase3/reuse.json'));
const used=new Map();
function read(name) {
 const bytes=fs.readFileSync(path.join(fixtures,name));
 used.set(name,crypto.createHash('sha256').update(bytes).digest('hex'));
 return deepFreeze(JSON.parse(bytes));
}
const version=read('versions.json')[0];
const cache=new Map();
const cached=name=>{if(!cache.has(name))cache.set(name,read(name));return cache.get(name);};
const api={
 fetchLatestVersion:async()=>version,
 fetchChampionIndex:async()=>cached('champions.json'),fetchItemIndex:async()=>cached('items.json'),
 fetchChampionDetails:async(revision,id)=>{assert.equal(revision,version);return cached(id+'.json');},
 fetchCommunityDragonChampion:async id=>cached(id.toLowerCase()+'.bin.json'),
 fetchCommunityDragonItems:async()=>cached('cd-items.json'),
 fetchRunesReforged:async()=>cached('runes.json')
};
(async()=>{
 assert.equal(typeof document,'undefined');assert.equal(typeof BUILDER,'undefined');
 const repository=createRepository({api,statsAdapter:stats});
 const catalog=await repository.loadCatalogs(version);
 const championExplorer=createCatalogSession({catalog:catalog.champions,kind:'champion',loadDetail:id=>repository.loadChampionDetails(version,id)});
 const itemExplorer=createCatalogSession({catalog:catalog.items,kind:'item'});
 const allChampions=championExplorer.search(),allItems=itemExplorer.search();
 assert.equal(allChampions.length,Object.keys(catalog.champions.records).length);
 assert.equal(allItems.length,Object.keys(catalog.items.records).length);
 const ashe=(await championExplorer.inspect('Ashe')).detail;
 assert.ok(ashe.record.lore);assert.ok(ashe.record.skins.length);assert.equal(ashe.record.spells.length,4);
 await itemExplorer.inspect('3006');
 championExplorer.search({search:'Ashe'});itemExplorer.search({search:'Boots'});
 assert.equal(championExplorer.snapshot().selectedId,'Ashe');assert.equal(itemExplorer.snapshot().selectedId,'3006');
 assert.equal(Object.keys(catalog.items.records).length,allItems.length);
 const a=builds.createBuildInputs({selectedChampion:'Ashe'}),b=builds.createBuildInputs({selectedChampion:'Garen'});
 const shop=queries.builderCatalog(catalog.items.records);
 const changed=builds.transitionInventory(a,0,'3006',shop);assert.ok(changed.accepted);
 const aBefore=JSON.stringify(a),bBefore=JSON.stringify(b);
 assert.equal(a.itemSlots[0],'');assert.equal(b.itemSlots[0],'');
 const runeData=runeSource.normalizeRunes(await api.fetchRunesReforged(version));
 const rules=runeInputs.createRules(runeData);
 const aRunes=rules.initialize(a.runeSelections),bRunes=rules.initialize(b.runeSelections);
 const selected=rules.selectOption(aRunes,'shard_0','ability-haste');
 assert.equal(selected.shards[0],'ability-haste');assert.equal(bRunes.shards[0],'adaptive-force');
 assert.equal(JSON.stringify(a),aBefore);assert.equal(JSON.stringify(b),bBefore);
 const scenarioA=scenarios.createScenarioInputs(),scenarioB=scenarios.createScenarioInputs();
 scenarioA.target.armor=0;assert.equal(scenarioB.target.armor,100);
 const prepared=await repository.loadChampion(version,'Ashe');
 assert.ok(prepared.abilities.q);assert.ok(Object.isFrozen(prepared.raw));
 const advanced=await repository.loadAdvancedItems();assert.equal(advanced.status,'ready');
 const enriched=require('../JS/data/itemSource.js').prepareItems(shop.items,advanced.records,stats);
 assert.ok(enriched['3006'].stats);assert.equal(Object.keys(catalog.items.records).length,allItems.length);
 for(const [name,hash] of used)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(fixtures,name))).digest('hex'),hash,name+' fixture changed');
 const report={version,champions:allChampions.length,fullItems:allItems.length,builderItems:Object.keys(shop.items).length,
  noBuilderOrDom:true,twoIndependentQueries:true,twoIndependentBuilds:true,twoIndependentScenarios:true,
  basicProfileIncludesLoreSkinsAndAbilities:true,advancedSourcePrepared:true,sourceCatalogRetained:true,fixturesUnchanged:true,
  provenance:catalog.items.source,fixtures:[...used].map(([name,sha256])=>({name,sha256}))};
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log('PASS headless reuse: '+allChampions.length+' champions, '+allItems.length+' full items, '+report.builderItems+' Builder items; isolated queries/builds/scenarios.');
})().catch(error=>{console.error(error);process.exitCode=1;});