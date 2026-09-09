const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.APP_ROOT || path.join(__dirname, '..');
function app(fetchImpl = async () => ({ok:true,json:async()=>({})})) {
  const context = vm.createContext({console, fetch:fetchImpl, AbortController, setTimeout, clearTimeout,
    document:{addEventListener(){}}, module:{exports:{}}});
  context.window = context;
  for (const file of ['shared/apiClient','shared/itemPolicy','shared/abilityRules','shared/buildStats','shared/itemData','builder']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'JS',file+'.js'),'utf8'),context);
  }
  context.run = code => vm.runInContext(code,context);
  return context;
}
test('rune requests use the selected patch',async()=>{
 const urls=[];const c=app(async url=>{urls.push(url);return {ok:true,json:async()=>[]}});
 await c.ApiClient.fetchRunesReforged('99.2.1');assert.match(urls[0],/99\.2\.1/);
});
test('missing Community Dragon stats preserve Data Dragon values',()=>{
 const c=app();c.run('BUILDER.championData={stats:{hp:650,attackdamage:60}}');
 const stats=c.extractChampionStatsFromBinRoot({'Characters/Ashe/CharacterRecords/Root':{}},'Ashe','ashe');
 assert.notEqual(stats.hp,0); // Missing data must never masquerade as a real zero.
});
test('ability ranks reject negative, fractional and foreign entries',()=>{
 const c=app();const ranks=c.AbilityRules.enforceAbilityRules(6,{q:-1,w:2.9,e:Infinity,r:1,extra:10});
 assert.deepEqual(Object.keys(ranks).sort(),['e','q','r','w']);
 assert.ok(Object.values(ranks).every(x=>Number.isInteger(x)&&x>=0));
 assert.ok(Object.values(ranks).reduce((a,b)=>a+b,0)<=6);
});
test('unknown nested formula parts remain unresolved',()=>{
 const c=app();const result=c.evaluateGameCalculation({__type:'GameCalculation',mFormulaParts:[{__type:'SumOfSubPartsCalculationPart',mSubparts:[{__type:'NumberCalculationPart',mNumber:50},{__type:'UnknownPart'}]}]},[],1,{});
 assert.ok(c.isMissingGameCalculation(result));
});
test('a missing multiplier cannot silently produce the base result',()=>{
 const c=app();const result=c.evaluateGameCalculation({__type:'GameCalculation',mFormulaParts:[{__type:'NumberCalculationPart',mNumber:50}],mMultiplier:{__type:'UnknownPart'}},[],1,{});
 assert.ok(c.isMissingGameCalculation(result));
});
test('rune artwork uses HTTPS',()=>assert.match(app().toDdragonPerkIcon('16.1.1','perk-images/test.png'),/^https:/));
test('zero resource cost is displayed as zero',()=>assert.equal(app().parseByRank('0',1),'0'));
test('item formula cycles terminate without stack overflow',()=>{
 const c=app(), calc={__type:'GameCalculationModified',mModifiedGameCalculation:'loop'};
 assert.match(c.ItemLookupShared.gameCalculationToText('loop',calc,{loop:calc},{}),/unresolved|circular/i);
});
test('missing item haste falls back to the stat block, not passive text',()=>{
 const c=app();
 const stats=c.BuildStats.itemStatsFromDescription('<stats><attention>10</attention> Ability Haste<br><attention>45</attention> Move Speed</stats><passive>Gain 50 Ability Haste</passive>',{FlatMovementSpeedMod:45});
 assert.equal(stats.FlatHasteMod,10);assert.equal(stats.FlatMovementSpeedMod,45);
});
test('percent item stats are fractions and numeric catalog values take priority',()=>{
 const c=app();const stats=c.BuildStats.itemStatsFromDescription('<stats><attention>25%</attention> Critical Strike Chance<br><attention>30%</attention> Critical Strike Damage</stats>',{FlatCritChanceMod:0.2});
 assert.equal(stats.FlatCritChanceMod,0.2);assert.equal(stats.FlatCritDamageMod,0.3);
});
test('growth reaches 72% of a growth stat at level 2 and 17 times at level 18',()=>{
 const c=app();assert.equal(c.BuildStats.growthFactor(1),0);assert.equal(c.BuildStats.growthFactor(2),0.72);assert.equal(c.BuildStats.growthFactor(18),17);
});
test('attack speed bonuses add using the ratio rather than multiply level bonuses',()=>{
 const c=app();assert.ok(Math.abs(c.BuildStats.attackSpeed(0.7,3,0.625,18,40)-(0.7+0.625*0.91))<1e-9);
});
test('shared API deduplicates concurrent requests and retries errors',async()=>{
 let calls=0;const c=app(async()=>{calls++;if(calls===1)throw Error('offline');return {ok:true,json:async()=>({ok:true})}});
 await assert.rejects(c.ApiClient.fetchJson('test'));await Promise.all([c.ApiClient.fetchJson('test'),c.ApiClient.fetchJson('test')]);assert.equal(calls,2);
});
test('version API rejects an empty list',async()=>{
 const c=app(async()=>({ok:true,json:async()=>[]}));await assert.rejects(c.ApiClient.fetchLatestVersion(),/empty or invalid/);
});
test('unknown stat IDs cannot silently use AP',()=>{
 const c=app();const value=c.evaluateCalculationPart({__type:'StatByCoefficientCalculationPart',mStat:999,mCoefficient:1},[],1,{ap:100});assert.equal(value.missing,true);
});
test('AD scaling distinguishes bonus from total and ignores misleading token names',()=>{
 const c=app();assert.equal(c.getCalcStatSource({mStat:2,mStatFormula:1,mDataValue:'APRatio'},{ap:300,totalAd:150,bonusAd:50}).value,50);
});
test('conditional formulas require a condition rather than choosing the first branch',()=>{
 const c=app();const result=c.evaluateGameCalculation({__type:'GameCalculationConditional',mConditionalGameCalculation:'yes'},[],1,{}, {yes:{__type:'GameCalculation',mFormulaParts:[{__type:'NumberCalculationPart',mNumber:100}]}});assert.ok(c.isMissingGameCalculation(result));
});
