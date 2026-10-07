const test=require('node:test');
const assert=require('node:assert/strict');const Calculations=require('../JS/shared/calculations.js').default;const BuildStats=require('../JS/shared/buildStats.js').default;const AttackEffects=require('../JS/shared/attackEffects.js').default;
const {items}=require('./ability-item-excerpts.json');
const state=()=>({itemSlots:['3161','3118','3073'],combatValues:{'attack:shojinStacks':4}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<.00001,`${a} != ${b}`);

test('separate basic and ultimate haste use the loaded item data and individual passive switches',()=>{
  const s=state(),read=()=>AttackEffects.model(s,items).abilityModifiers({ranged:false});
  assert.equal(read().basicHaste,25);assert.equal(read().ultimateHaste,50);
  s.disabledItemPassives={'3161:dragonforce':true,'3118:scorn':true};
  assert.equal(read().basicHaste,0);assert.equal(read().ultimateHaste,30);
  near(read().abilityDamageMultiplier,1.12);
  s.disabledItemPassives['3073:hexcharged']=true;assert.equal(read().ultimateHaste,0);
  s.itemSlots=[];assert.deepEqual(read(),{basicHaste:0,ultimateHaste:0,abilityDamageMultiplier:1});
});

test('Focused Will honors ranged scaling, stack bounds and independent activation',()=>{
  const s=state(),read=ranged=>AttackEffects.model(s,items).abilityModifiers({ranged});
  near(read(false).abilityDamageMultiplier,1.12);near(read(true).abilityDamageMultiplier,1.06);
  for(const [stacks,wanted]of [[20,1.12],[2.9,1.06],[-2,1],[NaN,1]]){
    s.combatValues['attack:shojinStacks']=stacks;near(read(false).abilityDamageMultiplier,wanted);
  }
  s.combatValues['attack:shojinStacks']=4;s.disabledItemPassives={'3161:focused-will':true};
  near(read(false).abilityDamageMultiplier,1);assert.equal(read(false).basicHaste,25);
});

test('missing optional item data does not invent haste or poison results with NaN',()=>{
  assert.deepEqual(AttackEffects.model(state(),{}).abilityModifiers({ranged:true}),{basicHaste:0,ultimateHaste:0,abilityDamageMultiplier:1});
});
