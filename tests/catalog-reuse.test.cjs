const test=require('node:test'),assert=require('node:assert/strict');
const {deepFreeze}=require('../JS/core/records.js');
const text=require('../JS/core/text.js');
const queries=require('../JS/domain/catalogQueries.js');
const builds=require('../JS/domain/buildInputs.js');
const scenarios=require('../JS/domain/scenarioInputs.js');
const runes=require('../JS/domain/runeInputs.js');
const runeSource=require('../JS/data/runeSource.js');
const {createCatalogSession}=require('../JS/application/catalogSession.js');
const {createRepository}=require('../JS/data/sourceRepositories.js');
const stats=require('../JS/shared/buildStats.js');

const item=(name,maps={11:true},extra={})=>({name,maps,tags:[],gold:{purchasable:true,total:100},...extra});
const full=deepFreeze({
 '1':item('Sword'),'2':item('Sword',{12:true}),'3':item('Hidden',{11:true},{gold:{purchasable:false}}),
 '3006':item('Boots',{11:true},{tags:['Boots']}),'3170':item('Upgraded',{11:true},{from:['3006']}),
 '1200':item('Top'),'1201':item('Mid'),'1202':item('Bot')
});
const shop=queries.builderCatalog(full);
const data={...shop};

test('full catalog retains map variants and unavailable purchases; Builder policy is explicit',()=>{
 assert.equal(queries.queryItems(full).length,8);
 assert.deepEqual(queries.queryItems(full,{maps:[12]}),['2']);
 assert.ok(!queries.queryItems(full,{purchasable:true}).includes('3'));
 assert.ok(!Object.keys(shop.items).includes('2'));
 assert.ok(shop.midBootIds.includes('3170'));
 assert.deepEqual(queries.queryItems(full,{search:' sword ',maps:[11],dedupe:true}),['1']);
 assert.equal(Object.keys(full).length,8);
});

test('query sessions isolate filters, selections, failed loads and latest-request handling',async()=>{
 let finish;
 const catalog={records:full,source:{provider:'DataDragon',version:'fixture'}};
 const first=createCatalogSession({kind:'item',catalog,loadDetail:id=>id==='slow'?new Promise(resolve=>{finish=resolve}):id==='fail'?Promise.reject(Error('offline')):Promise.resolve(full[id])});
 const second=createCatalogSession({kind:'item',catalog});
 assert.deepEqual(first.search({search:'Sword',maps:new Set([11])}),['1']);
 assert.equal(second.search().length,8);
 await second.inspect('2');
 const slow=first.inspect('slow');
 await first.inspect('1');finish(full['2']);
 assert.equal((await slow).current,false);
 assert.equal(first.snapshot().selectedId,'1');
 assert.ok((await first.inspect('fail')).error);
 assert.equal(first.snapshot().selectedId,'1');
 assert.equal(second.snapshot().selectedId,'2');
 const pending=first.inspect('slow');first.dispose();finish(full['2']);
 assert.equal((await pending).current,false);
 assert.equal(first.snapshot().selectedId,null);
 assert.equal(second.snapshot().selectedId,'2');
});

test('two canonical builds own arrays, counters and rune choices and exclude page/scenario state',()=>{
 const initial={itemSlots:['1','','','','','',''],runeSelections:{primary:['rune']},combatValues:{stack:0},target:{enabled:true},championData:{stats:{}}};
 const a=builds.createBuildInputs(initial),b=builds.createBuildInputs(initial);
 a.itemSlots[0]='3006';a.runeSelections.primary[0]='other';a.combatValues.stack=9;
 assert.equal(b.itemSlots[0],'1');assert.equal(b.runeSelections.primary[0],'rune');assert.equal(b.combatValues.stack,0);
 assert.equal('target' in a,false);assert.equal('championData' in a,false);
 assert.equal(initial.itemSlots[0],'1');
});

test('inventory transitions preserve boots and reject losing them when a full build leaves Bot',()=>{
 const original=builds.createBuildInputs({itemSlots:['3006','1','1','1','1','1','']});
 const bot=builds.transitionInventory(original,6,'1202',data);
 assert.equal(bot.accepted,true);assert.equal(bot.inputs.itemSlots[7],'3006');assert.equal(bot.inputs.itemSlots[0],'');
 assert.equal(original.itemSlots[0],'3006');
 const fullBot={...bot.inputs,itemSlots:['1','1','1','1','1','1','1202','3006']};
 const saved=JSON.stringify(fullBot);
 const rejected=builds.transitionInventory(fullBot,6,'1200',data);
 assert.equal(rejected.accepted,false);assert.equal(rejected.reasonCode,'inventory-full');assert.equal(JSON.stringify(fullBot),saved);
 const back=builds.transitionInventory(bot.inputs,6,'1200',data);
 assert.equal(back.inputs.itemSlots.length,7);assert.equal(back.inputs.itemSlots[0],'3006');
 assert.equal(builds.eligibility(bot.inputs,'3006',0,data).allowed,false);
 assert.equal(builds.eligibility(bot.inputs,'3006',7,data).allowed,true);
});

test('Mid downgrade, Top level cap and ordinary rank constraints remain independent rules',()=>{
 const mid=builds.createBuildInputs({itemSlots:['3170','','','','','','1201'],level:18});
 const changed=builds.transitionInventory(mid,6,'1200',data);
 assert.equal(changed.inputs.itemSlots[0],'3006');
 const top=builds.createBuildInputs({itemSlots:['','','','','','','1200'],level:20,abilityRanks:{r:9,q:9}});
 assert.equal(top.level,20);assert.equal(top.abilityRanks.r,3);assert.equal(top.abilityRanks.q,5);
 assert.equal(builds.transitionInventory(top,6,'',data).inputs.level,18);
 assert.equal(builds.transitionInventory(top,8,'1',data).accepted,false);
 assert.equal(builds.transitionInventory(top,0,'missing',data).accepted,false);
});

test('rune selections validate rows and paths, retain FIFO replacement and never edit another input',()=>{
 const data={paths:{a:{primaryRows:[['ka'],['aa','aa2'],['ab'],['ac']]},b:{primaryRows:[['kb'],['ba'],['bb'],['bc']]}},pathDefaults:{a:['ka','aa','ab','ac'],b:['kb','ba','bb','bc']}};
 const rules=runes.createRules(data);
 const a=rules.initialize(builds.createBuildInputs().runeSelections),b=rules.initialize(builds.createBuildInputs().runeSelections);
 assert.deepEqual(a.secondary,['ba','bb']);
 const changed=rules.selectOption(a,'secondary_0','bc');
 assert.deepEqual(changed.secondary,['bb','bc']);assert.deepEqual(a.secondary,['ba','bb']);assert.deepEqual(b.secondary,['ba','bb']);
 assert.equal(rules.transition(a,'secondaryPath','a').accepted,false);
 assert.equal(rules.transition(a,'primary_0','aa').accepted,false);
 assert.equal(rules.transition(a,'shard_0','health').accepted,false);
 assert.equal(rules.transition(a,'shard_0','ability-haste').accepted,true);
});

test('basic profile/catalog loading needs no advanced data, Builder or DOM and records provenance',async()=>{
 const calls=[];
 const champion={name:'Ashe',lore:'lore',skins:[{num:0}],spells:[],stats:{hp:600}};
 const api={fetchLatestVersion:async()=>{calls.push('latest');return '16.18.1';},fetchChampionIndex:async version=>{calls.push(version);return {data:{Ashe:champion}};},fetchItemIndex:async version=>({data:full}),fetchChampionDetails:async(version,id)=>({data:{[id]:champion}})};
 const repository=createRepository({api,statsAdapter:stats});
 const catalog=await repository.loadChampionCatalog();
 const detail=await repository.loadChampionDetails(catalog.source.version,'Ashe');
 assert.equal(detail.record.lore,'lore');assert.equal(detail.record.skins[0].num,0);
 assert.equal(Object.isFrozen(detail.record.skins),true);
 assert.equal(catalog.source.version,'16.18.1');assert.equal(catalog.source.immutable,true);
 await repository.loadChampionCatalog();assert.equal(calls.filter(value=>value==='latest').length,1);
 assert.equal(globalThis.BUILDER,undefined);assert.equal(globalThis.document,undefined);
});

test('advanced item/localization outages remain optional and retry with explicit latest provenance',async()=>{
 let attempts=0,localization=0;
 const payload={'Items/1':{itemID:1}};
 const repository=createRepository({api:{fetchCommunityDragonItems:async()=>{if(++attempts===1)throw Error('offline');return payload;},fetchJson:async()=>{if(++localization===1)throw Error('offline');return {entries:{name:'Name'}};}}});
 const one=repository.loadAdvancedItems(),two=repository.loadAdvancedItems();
 assert.equal(one,two);assert.equal((await one).status,'unavailable');assert.equal(attempts,1);
 const ready=await repository.loadAdvancedItems();
 assert.equal(ready.status,'ready');assert.equal(ready.source.revision,'latest');assert.equal(ready.source.immutable,false);
 assert.equal(ready.records['1'],payload['Items/1']);assert.equal(Object.isFrozen(ready.records['1']),true);
 assert.equal((await repository.loadLocalization()).status,'unavailable');
 assert.equal((await repository.loadLocalization()).entries.name,'Name');
});

test('source preparation copies derived stats and leaves complete source records unchanged',async()=>{
 const raw={'Characters/Ashe/CharacterRecords/Root':{baseDamage:60,damagePerLevel:3.5}};
 const champ={name:'Ashe',stats:{hp:600,attackdamage:59,attackdamageperlevel:0},spells:[],skins:[]};
 const source=JSON.stringify({raw,champ});
 const repository=createRepository({api:{fetchChampionDetails:async()=>({data:{Ashe:champ}}),fetchCommunityDragonChampion:async()=>raw},statsAdapter:stats});
 const prepared=await repository.loadChampion('16.18.1','Ashe');
 assert.equal(prepared.champion.stats.attackdamageperlevel,3.5);assert.equal(JSON.stringify({raw,champ}),source);
 assert.equal(prepared.sources[1].status,'ready');
 assert.notEqual(prepared.champion.stats,champ.stats);
});

test('scenario and general text contracts retain unknown versus zero semantics',()=>{
 const a=scenarios.createScenarioInputs({target:{enabled:true,maxHp:1000,currentHp:0,armor:-20},gameTimeMinutes:200});
 const b=scenarios.createScenarioInputs();
 assert.equal(a.target.currentHp,0);assert.equal(a.target.armor,-20);assert.equal(a.gameTimeMinutes,200);
 a.target.armor=999;assert.equal(b.target.armor,100);
 assert.equal(text.escapeHtml(0),'0');assert.equal(text.escapeHtml(false),'false');assert.equal(text.escapeHtml(null),'');
 assert.equal(text.escapeHtml('<"\'&>'),'&lt;&quot;&#39;&amp;&gt;');
 const source=[{id:8000,name:'Precision',icon:'perk.png',slots:[{runes:[{name:'Test Rune',longDesc:'<p>One</p> <b>two</b>',icon:'rune.png'}]}]}];
 const normalized=runeSource.normalizeRunes(source);
 assert.equal(normalized.runeLookup['test-rune'].desc,'One two');
 assert.equal(source[0].slots[0].runes[0].longDesc,'<p>One</p> <b>two</b>');
});