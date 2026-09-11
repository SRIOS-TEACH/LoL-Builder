const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.APP_ROOT || path.join(__dirname, '..');
function effectState(champion, slot, entries, values={}, rank=1) {
 return {selectedChampion:champion,level:18,championData:{stats:{}},abilityRanks:{[slot]:rank},combatValues:values,
  cdragonAbilityData:{[slot]:{dataValues:Object.entries(entries).map(([name,value])=>({name,values:Array(7).fill(value)})),calculations:{}}}};
}
test('Feast adds bonus health and capped range once, and respects unlearned R',()=>{
 const c=app(),state=effectState('Chogath','r',{RHealthPerStack:123,AttackRangePerStack:7,MaxBonusAttackRange:75},{'buff:{8682fc00}':20});
 const base={hp:1000,attackRange:125};
 const result=c.ChampionEffects.model(state).apply(base);
 assert.equal(result.hp,3460);assert.equal(result.attackRange,200);assert.equal(base.hp,1000);
 assert.equal(c.ChampionEffects.model(state).apply(base).hp,result.hp);
 state.abilityRanks.r=0;assert.equal(c.ChampionEffects.model(state).apply(base).hp,1000);
});
test('Poppy amplifies pre-W resistances and doubles only below the live health threshold',()=>{
 const c=app(),state=effectState('Poppy','w',{PassiveResistPercent:0.16,PassiveEmpoweredHealthPercent:0.4});
 const base={armor:100,mr:50};
 assert.equal(c.ChampionEffects.model(state).apply(base).armor,116);
 state.combatValues['self:healthPercent:0']=0.4;assert.equal(c.ChampionEffects.model(state).apply(base).armor,116);
 state.combatValues['self:healthPercent:0']=0.39;assert.equal(c.ChampionEffects.model(state).apply(base).armor,132);
});
test('Malphite shield state changes the armor multiplier without multiplying its own bonus',()=>{
 const c=app(),state=effectState('Malphite','w',{BonusArmorPassive:0.2,BonusArmorPassiveMultiplier:3});
 assert.equal(c.ChampionEffects.model(state).apply({armor:100}).armor,120);
 state.combatValues['state:graniteShield']=true;assert.equal(c.ChampionEffects.model(state).apply({armor:100}).armor,160);
});
test('Senna grants range and crit only at completed stack milestones',()=>{
 const c=app(),state=effectState('Senna','p',{ADPerStack:0.75,StacksForBonus:20,BonusRange:20,BonusCritChance:10},{'buff:{e88568f8}':39});
 const result=c.ChampionEffects.model(state).apply({ad:50,attackRange:600,critChance:95});
 assert.equal(result.ad,79.25);assert.equal(result.attackRange,620);assert.equal(result.critChance,100);
});
test('localization expands nested names and all Aphelios weapon outcomes',()=>{
 const c=app();c.run("BUILDER.strings={spell_gangplankqwrapper_tooltip_1:'Damage @ShotDamage@ {{spell_gangplankr_name}}',spell_gangplankr_name:'Cannon Barrage'}");
 assert.equal(c.expandAbilityLocalization('{{Spell_GangplankQWrapper_Tooltip_{{ gamemodeinteger }}}}'),'Damage {{ ShotDamage }} Cannon Barrage');
 const text=c.expandAbilityLocalization('{{ Spell_ApheliosR_WeaponMod_{{ f1 }} }}');
 assert.equal((text.match(/Spell_ApheliosR_WeaponMod_/g)||[]).length,5);
});
function app(fetchImpl = async () => ({ok:true,json:async()=>({})})) {
  const context = vm.createContext({console, fetch:fetchImpl, AbortController, setTimeout, clearTimeout,
    document:{addEventListener(){}}, module:{exports:{}}});
  context.window = context;
  for (const file of ['shared/apiClient','shared/itemPolicy','shared/abilityRules','shared/abilityDps','shared/buildStats','shared/calculations','shared/combatInputs','shared/championEffects','shared/itemData','builder']) {
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
 const c=app();assert.equal(c.getCalcStatSource({mStat:2,mStatFormula:2,mDataValue:'APRatio'},{ap:300,totalAd:150,bonusAd:50}).value,50);
});
test('conditional formulas require a condition rather than choosing the first branch',()=>{
 const c=app();const result=c.evaluateGameCalculation({__type:'GameCalculationConditional',mConditionalGameCalculation:'yes'},[],1,{}, {yes:{__type:'GameCalculation',mFormulaParts:[{__type:'NumberCalculationPart',mNumber:100}]}});assert.ok(c.isMissingGameCalculation(result));
});

const captured=require('./calculation-excerpts.json');
const C=require('../JS/shared/calculations.js');
test('live Feast formulas include rank, AP and bonus health',()=>{
 const spell=captured.feast, context={rank:3,level:18,stats:{ap:200,bonusHp:1000},dataValues:spell.DataValues,calculations:spell.mSpellCalculations};
 assert.ok(Math.abs(C.evaluate(spell.mSpellCalculations.RDamage,context).value-850)<.001);
 assert.ok(Math.abs(C.evaluate(spell.mSpellCalculations.RMonsterDamage,context).value-1400)<.001);
});
test('live Seraph calculations and description use total versus bonus mana',()=>{
 const c=app();c.ItemLookupShared.getState().cdragonById['3040']=captured['3040'];
 const rows=c.ItemLookupShared.buildExtractedFormulas('3040',{stats:{mp:2000,bonusMp:1000}}).lines;
 assert.ok(Math.abs(rows.find(r=>r.key==='ShieldValue').value-360)<.001);
 assert.ok(Math.abs(rows.find(r=>r.key==='BonusAPCalc').value-20)<.001);
 const html=c.ItemLookupShared.injectItemCalculationValues('Gain <scaleAP> Ability Power</scaleAP> and a <shield> Shield</shield>',rows);
 assert.match(html,/20 Ability Power/);assert.match(html,/360 Shield/);
 assert.equal(c.ItemLookupShared.inferActiveCooldownSeconds('3040'),90);
 assert.match(c.ItemLookupShared.injectActiveCooldown('<passive>Lifeline</passive> (0s)',90),/90s/);
});
test('Sheen uses base AD, not total or bonus AD',()=>{
 const item=captured['3057'];const row=C.evaluate(item.mItemCalculations.SpellbladeDamage,{stats:{totalAd:180,bonusAd:80},dataValues:item.mDataValues});
 assert.ok(Math.abs(row.value-100)<.001);
});
test('typed omitted defaults differ from missing data and missing combat inputs',()=>{
 assert.equal(C.dataValue([{name:'zero',__type:'SpellDataValue'}],'zero').value,0);
 assert.equal(C.dataValue([],'absent').value,null);
 const row=C.partValue({__type:'BuffCounterByCoefficientCalculationPart',mBuffName:'stacks',mCoefficient:5},{});
 assert.equal(row.value,null);assert.deepEqual(row.inputs,['buff:stacks']);
});
test('products, clamping, rank overrides and scalar item effects preserve arithmetic',()=>{
 const n=v=>({__type:'NumberCalculationPart',mNumber:v});
 assert.equal(C.partValue({__type:'ProductOfSubPartsCalculationPart',mPart1:n(3),mPart2:n(4)}).value,12);
 assert.equal(C.partValue({__type:'ClampSubPartsCalculationPart',mSubparts:[n(40)],mCeiling:20}).value,20);
 assert.equal(C.partValue({__type:'EffectValueCalculationPart',mEffectIndex:1},{effects:[60]}).value,60);
 const calculations={base:{__type:'GameCalculation',mFormulaParts:[{__type:'NamedDataValueCalculationPart',mDataValue:'damage'}]}};
 assert.equal(C.evaluate({__type:'GameCalculationModified',mModifiedGameCalculation:'base',mOverrideSpellLevel:2},{rank:1,calculations,dataValues:[{name:'damage',values:[0,10,20,30,40,50,60]}]}).value,20);
});

const Combat=require('../JS/shared/combatInputs');
test('health inputs derive current, missing and percentage values without a full-health default',()=>{
 const base={stats:{hp:3000},targetStats:{}};
 assert.equal(Combat.apply(base,{}).stats.currentHp,undefined);
 const ctx=Combat.apply(base,{'self:healthPercent:0':.25,'target:hp:0':2000,'target:healthPercent:0':.6});
 assert.equal(ctx.stats.currentHp,750);assert.equal(ctx.stats.missingHp,2250);
 assert.equal(ctx.targetStats.currentHp,1200);assert.equal(ctx.targetStats.missingHealthPercent,.4);
});
test('stack values, zero stacks and clearing a value remain distinct',()=>{
 const calc={__type:'GameCalculation',mFormulaParts:[{__type:'BuffCounterByCoefficientCalculationPart',mBuffName:'Feast',mCoefficient:5}]};
 assert.equal(C.evaluate(calc,Combat.apply({},{})).value,null);
 assert.equal(C.evaluate(calc,Combat.apply({},{'buff:Feast':0})).value,0);
 assert.equal(C.evaluate(calc,Combat.apply({},{'buff:Feast':6})).value,30);
});
test('conditional activation distinguishes inactive effects from missing references',()=>{
 const calc={__type:'GameCalculationConditional',mConditionalGameCalculation:'hit',mConditionalCalculationRequirements:{__type:'HasBuffCastRequirement',mBuffName:'ready'}};
 const base={calculations:{hit:{__type:'GameCalculation',mFormulaParts:[{__type:'NumberCalculationPart',mNumber:100}]}}};
 assert.equal(C.evaluate(calc,Combat.apply(base,{'buff:ready':0})).inactive,true);
 assert.equal(C.evaluate(calc,Combat.apply(base,{'buff:ready':1})).value,100);
 assert.equal(C.evaluate(calc,base).value,null);
 assert.ok(C.evaluate({...calc,mConditionalGameCalculation:'missing'},Combat.apply(base,{'buff:ready':1})).unsupported.length);
});
test('target health thresholds use the target, not the attacking champion',()=>{
 const req={__type:'AboveHealthPercentCastRequirement',mCurrentPercentHealth:.5};
 assert.equal(C.condition(req,{stats:{healthPercent:1},targetStats:{healthPercent:.2}}).value,false);
 assert.equal(C.condition(req,{stats:{healthPercent:.1},targetStats:{healthPercent:.8}}).value,true);
});
test('execution threshold and nearby-ally predicates respond to explicit context',()=>{
 const req={__type:'{43b8e695}','{6166b756}':'threshold',mInvertResult:true};
 const context={targetStats:{hp:2000,healthPercent:.2},calculations:{threshold:{__type:'GameCalculation',mFormulaParts:[{__type:'NumberCalculationPart',mNumber:500}]}}};
 assert.equal(C.condition(req,context).value,true);
 assert.equal(C.condition(req,{...context,targetStats:{hp:2000,healthPercent:.8}}).value,false);
 const nearby={__type:'HasNNearbyVisibleUnitsRequirement',mRange:1300};
 assert.equal(C.condition(nearby,{}).value,null);
 assert.equal(C.condition(nearby,Combat.apply({},{['condition:'+C.conditionKey(nearby)]:true})).value,true);
});
test('all discovered stack and elapsed controls feed the calculation interpreter',()=>{
 const source={label:'Test',calculations:{damage:{__type:'GameCalculation',mFormulaParts:[{__type:'BuffCounterByCoefficientCalculationPart',mBuffName:'stacks',mCoefficient:10},{__type:'PercentageOfBuffNameElapsed',buffName:'duration',Coefficient:100}]}}};
 const fields=Combat.descriptors([source],{});assert.deepEqual(fields.map(f=>f.key).sort(),[`buff:${C.hash('stacks')}`,`elapsed:${C.hash('duration')}`]);
 const context=Combat.apply({},{'buff:stacks':3,'elapsed:duration':.5});
 assert.equal(C.evaluate(source.calculations.damage,context).value,80);
});

test('target scaling remains symbolic and self scaling is evaluated in a mixed formula',()=>{
 const calc={__type:'GameCalculation',mFormulaParts:[{__type:'StatByCoefficientCalculationPart',mCoefficient:.5},{__type:'StatByCoefficientCalculationPart',mStat:12,'{a8cb9c14}':true,mCoefficient:.12}]};
 const row=C.evaluate(calc,{stats:{ap:300},targetStats:{hp:2000},targetFormulaOnly:true});
 assert.equal(row.value,null);assert.match(row.text,/150/);assert.match(row.text,/12% Target Max HP/);assert.doesNotMatch(row.text,/240/);
});
test('named and hashed references to the same buff share one input',()=>{
 const calc=buff=>({__type:'GameCalculation',mFormulaParts:[{__type:'BuffCounterByCoefficientCalculationPart',mBuffName:buff,mCoefficient:1}]});
 const fields=Combat.descriptors([{label:'Passive',calculations:{p:calc('SharedStacks')}},{label:'Q',calculations:{q:calc(C.hash('SharedStacks'))}}],{});
 assert.equal(fields.length,1);assert.equal(fields[0].key,`buff:${C.hash('SharedStacks')}`);
 const context=Combat.apply({},{[fields[0].key]:100});
 assert.equal(C.evaluate(calc('SharedStacks'),context).value,100);assert.equal(C.evaluate(calc(C.hash('SharedStacks')),context).value,100);
});
test('builder self stats cannot be replaced by old manually entered proxies',()=>{
 const c=app();c.run('BUILDER.combatValues={"self:ap:0":999,"target:hp:0":2000}');
 const ctx=c.calculationContext({ap:70,hp:1000});assert.equal(ctx.stats.ap,70);assert.equal(ctx.targetStats.hp,undefined);assert.equal(ctx.targetFormulaOnly,true);
});
