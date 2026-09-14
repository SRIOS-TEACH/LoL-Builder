const test=require('node:test');
const assert=require('node:assert/strict');
require('../JS/shared/calculations.js');
require('../JS/shared/championEffects.js');
const excerpts=require('./champion-passive-excerpts.json');
const near=(actual,expected)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<.00001,`${actual} != ${expected}`);
const state=(name,level=1,values={})=>({selectedChampion:name,level,abilityRanks:{},combatValues:values,cdragonAbilityData:{p:excerpts[name]}});

test('Ezreal ability-hit stacks add bonus attack speed with the champion ratio',()=>{
  const s=state('Ezreal'),base={base:{attackspeed:.625,attackspeedratio:.625},asTotal:.625};
  near(ChampionEffects.model(s).apply(base).asTotal,.625);
  s.combatValues['state:risingSpellForceStacks']=3;
  const current=ChampionEffects.model(s).apply(base);
  near(current.asTotal,.8125);near(current.bonusAttackSpeedFromChampion,.3);
  near(current.championBonuses.asTotal,.1875);near(base.asTotal,.625);
  s.combatValues['state:risingSpellForceStacks']=5;
  near(ChampionEffects.model(s).apply(base).asTotal,.9375);
  const summary=ChampionEffects.model(s).passiveSummary({});
  assert.equal(summary.maxStacks,5);assert.equal(summary.duration,6);near(summary.bonusAttackSpeed,.5);
});

test('Ezreal stack counts cannot exceed the data cap or count fractional and negative stacks',()=>{
  const s=state('Ezreal'),base={base:{attackspeed:.625,attackspeedratio:.7},asTotal:1};
  for(const [input,expected]of [[20,1.35],[3.9,1.21],[-4,1],[Infinity,1.35]]){
    s.combatValues['state:risingSpellForceStacks']=input;
    near(ChampionEffects.model(s).apply(base).asTotal,expected);
  }
  const field=ChampionEffects.model(s).fields[0];
  assert.equal(field.slot,'p');assert.equal(field.min,0);assert.equal(field.max,5);assert.equal(field.step,1);
});

test('Aurora reports target max-health magic damage separately from per-spirit healing',()=>{
  const s=state('Aurora',1,{'state:auroraSpirits':1});
  let summary=ChampionEffects.model(s).passiveSummary({ap:0});
  near(summary.healthFraction,.01);near(summary.healPerSpirit,3);near(summary.healingPerSecond,3);
  assert.equal(summary.spiritDuration,4);assert.equal(summary.maxSpirits,4);
  s.level=18;s.combatValues['state:auroraSpirits']=4;
  summary=ChampionEffects.model(s).passiveSummary({ap:100});
  near(summary.healthFraction,.037);near(summary.healPerSpirit,22);near(summary.healingPerSecond,88);
  // Spirit count scales the healing only; the three-hit damage stays 3.7% at 100 AP.
  s.combatValues['state:auroraSpirits']=1;
  summary=ChampionEffects.model(s).passiveSummary({ap:100});
  near(summary.healthFraction,.037);near(summary.healingPerSecond,22);
});

test('Aurora spirit counter caps at four and does not grant legacy passive movement speed',()=>{
  const s=state('Aurora',18),base={moveSpeed:335,asTotal:1};
  for(const [input,spirits]of [[0,0],[1,1],[4,4],[99,4],[2.8,2],[-1,0]]){
    s.combatValues['state:auroraSpirits']=input;
    const model=ChampionEffects.model(s),summary=model.passiveSummary({ap:0});
    assert.equal(summary.spirits,spirits);near(summary.healingPerSecond,20*spirits);
    near(model.apply(base).moveSpeed,335);
  }
  assert.deepEqual(ChampionEffects.model(s).apply(base).championBonuses,{});
});
