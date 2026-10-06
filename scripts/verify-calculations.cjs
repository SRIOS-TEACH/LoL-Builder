// Repeatable headless characterization against the protected fixture records.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pipeline,combo,items,builds,source}=require('../tests/helpers/calculation-runtime.cjs');
const queries=require('../JS/domain/catalogQueries.js'),itemSource=require('../JS/data/itemSource.js'),runeSource=require('../JS/data/runeSource.js');
const root=path.resolve(__dirname,'..'),fixtures=path.resolve(process.env.FIXTURES_DIR || path.join(root,'tests/fixtures'));
const output=path.resolve(process.env.CALCULATION_OUTPUT || path.join(root,'test-results/phase4/headless.json'));
const used=new Map(),cache=new Map(),freeze=globalThis.RecordValues.deepFreeze;
function read(name){
 const actual=fs.readdirSync(fixtures).find(file=>file.toLowerCase()===name.toLowerCase());
 if(!cache.has(actual)){
  const bytes=fs.readFileSync(path.join(fixtures,actual));used.set(actual,crypto.createHash('sha256').update(bytes).digest('hex'));
  cache.set(actual,freeze(JSON.parse(bytes)));
 }
 return cache.get(actual);
}
const json=value=>JSON.parse(JSON.stringify(value));
// Prose is presentation. Compare numeric fields, status, labels and typed packet structure separately.
function numeric(value){
 if(Array.isArray(value))return value.map(numeric);
 if(value && typeof value==='object')return Object.fromEntries(Object.entries(value)
  .filter(([key,row])=>typeof row!=='string' || ['type','label','status'].includes(key)).map(([key,row])=>[key,numeric(row)]));
 return value;
}
function near(a,b,label){
 if(typeof a==='number' && typeof b==='number')assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a)),label+': '+a+' versus '+b);
 else if(a && typeof a==='object'){
  assert.deepEqual(Object.keys(a),Object.keys(b),label+' fields');
  for(const key of Object.keys(a))near(a[key],b[key],label+'.'+key);
 }else assert.equal(b,a,label);
}
const fullItems=read('items.json').data,shop=queries.builderCatalog(fullItems);
const advanced=itemSource.indexAdvancedItems(read('cd-items.json'));
const strings=read('lol.stringtable.json').entries;
const runes=runeSource.normalizeRunes(read('runes.json')).runeLookup;
function prepare(record,mode){
 const input=record.inputs,champion=read(input.champion+'.json').data[input.champion];
 const prepared=source.prepareChampion(champion,mode==='advanced'?read(input.champion+'.bin.json'):null,input.champion,globalThis.BuildStats);
 const catalog=mode==='advanced'?itemSource.prepareItems(shop.items,advanced,globalThis.BuildStats):itemSource.prepareItems(shop.items,{},globalThis.BuildStats);
 return freeze({build:builds.readBuildInputs({selectedChampion:input.champion,level:input.level,abilityRanks:input.ranks,itemSlots:input.items,
  runeSelections:input.runes,combatValues:input.combatValues,runeStacks:input.runeStacks,disabledItemPassives:input.disabledItemPassives}),
  scenario:{target:input.target,gameTimeMinutes:input.gameTimeMinutes},data:{champion:prepared.champion,championRaw:prepared.raw,abilities:prepared.abilities,
   items:catalog,advancedItems:mode==='advanced'?advanced:{},strings:mode==='advanced'?strings:{},stringsReady:mode==='advanced',runes}});
}
function evaluate(input){
 const run=pipeline.create(input),stats=run.stats.computeDerivedBuildStats(),attack=run.stats.computeAutoAttackProfile(stats);
 const abilities=input.data.champion.spells.map((spell,index)=>run.evaluateAbility(spell,input.build.abilityRanks[['q','w','e','r'][index]],['q','w','e','r'][index]));
 return {stats,attack,abilities};
}
function sequence(input,record){
 const catalog=combo.actions(pipeline.create(input)),missing=[];
 const steps=record.requestedSequence.flatMap(key=>{
  const action=key.includes(':')?catalog.find(row=>row.id===key):catalog.find(row=>row.group===key && /Combined total/.test(row.label) && !row.stage) || catalog.find(row=>row.group===key && !row.stage);
  if(!action || action.unavailable){missing.push(key);return [];}
  return [{actionId:action.id,snapshot:action,overrides:{}}];
 });
 assert.deepEqual(missing,record.unavailableSequenceActions);
 const before=JSON.stringify([input,steps]),result=combo.evaluate({...input,steps});
 assert.equal(JSON.stringify([input,steps]),before,'Combo must not mutate build/scenario/data/steps');
 assert.deepEqual(combo.evaluate({...input,steps}),result,'Repeated combo must match');
 const expected=record.comboDisplay;
 assert.equal(result.total.toFixed(1),expected.match(/Total damage\n([\d.]+)/)[1]);
 assert.equal(result.duration.toFixed(2),expected.match(/Minimum time\n([\d.]+)/)[1]);
 if(input.scenario.target.enabled)assert.equal(result.remainingHp.toFixed(1),expected.match(/Target HP remaining\n([\d.]+)/)[1]);
 assert.equal(!!result.damageWarnings.length,expected.includes('Missing damage counts'));
 assert.equal(!!result.timeWarnings.length,expected.includes('Missing timing counts'));
 return {id:record.id,total:result.total,duration:result.duration,remainingHp:result.remainingHp,damageWarnings:result.damageWarnings.length,timeWarnings:result.timeWarnings.length};
}
const cases=[],runs=[];
for(const mode of ['advanced','fallback']){
 const baseline=JSON.parse(fs.readFileSync(path.join(root,'docs/refactor-baseline/cases-'+mode+'.json'))).cases;
 for(const record of baseline){
  const input=prepare(record,mode),before=JSON.stringify(input),result=evaluate(input);
  assert.deepEqual(json(result.stats),record.stats,record.id+' stats');
  assert.deepEqual(json(result.attack),record.attack,record.id+' attack');
  for(const [index,ability] of result.abilities.entries())near(numeric(record.abilities[index].result),numeric(json(ability.damage)),record.id+' ability '+index);
  assert.equal(JSON.stringify(input),before,'Source/input mutation');
  runs.push(input);cases.push({mode,...sequence(input,record),statsExact:true,attackExact:true,abilityNumbersMatch:true});
 }
}
const a=runs[0],b=runs[1],first=json(evaluate(a));evaluate(b);assert.deepEqual(json(evaluate(a)),first,'A/B/A evaluation');
const explorer=pipeline.create({build:builds.readBuildInputs(a.build),scenario:json(a.scenario),data:a.data});
assert.deepEqual(json(explorer.stats.computeDerivedBuildStats()),first.stats,'Equivalent explorer context');
const forms=[];
for(const id of ['Jayce','Elise','Nidalee','Aphelios']){
 const prepared=source.prepareChampion(read(id+'.json').data[id],read(id+'.bin.json'),id,globalThis.BuildStats);
 if(id==='Aphelios')assert.equal(prepared.abilities.q,undefined,'Baseline has no primary Aphelios Q payload');else assert.ok(prepared.abilities.q);
 assert.ok(Object.keys(prepared.abilities.byAlias).length>4);
 forms.push({champion:id,aliases:Object.keys(prepared.abilities.byAlias).length,selectedQ:prepared.abilities.q?.spellData.mScriptName || prepared.abilities.q?.spellData.mClientData?.mTooltipData?.mLocKeys?.keyName || null});
}
// Compare independently constructed item contexts with the same source and inputs.
const run=pipeline.create(b),context=run.stats.calculationContext(run.stats.getComputedChampionStatsForTooltips());
const itemArgs={id:'3042',item:b.data.items['3042'],source:advanced['3042'],strings,context};
assert.deepEqual(items.evaluate(itemArgs),items.evaluate({...itemArgs,context:json(context)}));
for(const [name,hash] of used)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(fixtures,name))).digest('hex'),hash,name+' fixture changed');
assert.equal(typeof document,'undefined');assert.equal(typeof window,'undefined');assert.equal(typeof BUILDER,'undefined');
const report={date:new Date().toISOString(),noPageApis:true,baselineCases:cases,numericTolerance:{relative:1e-9,absolute:1e-9},
 comboComparison:'Matches protected display precision: damage/HP 1 decimal, duration 2 decimals; unrounded current results recorded above.',
 twoBuildsOrderIndependent:true,inputsAndFixturesUnchanged:true,equivalentExplorerContexts:true,formFixtures:forms,
 fixtures:[...used].map(([name,sha256])=>({name,sha256}))};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log('PASS 10 headless baseline cases; exact stats/attacks, ability numbers and statuses, rounded combo baselines, A/B/A and immutable inputs.');
