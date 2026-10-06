const test=require('node:test');
const assert=require('node:assert/strict');const RuneEffects=require('../JS/shared/runeEffects.js').default;
const {runes}=require('./rune-excerpts.json');
const state=(ids,stacks={},time=0)=>({level:18,runeSelections:{primary:ids,secondary:[]},runeStacks:stacks,gameTimeMinutes:time});
const calculate=(ids,stacks={},time=0,options={})=>RuneEffects.calculate(state(ids,stacks,time),runes,options).totals;
test('Manaflow and Ultimate Hunter counters apply independently and respect caps',()=>{
 const s=state(['manaflow-band','ultimate-hunter'],{'manaflow-band':7,'ultimate-hunter':3});
 let result=RuneEffects.calculate(s,runes).totals;
 assert.equal(result.mp,175);assert.equal(result.ultimateHaste,21);assert.equal(result.haste,0);
 s.runeStacks={'manaflow-band':50,'ultimate-hunter':50};
 result=RuneEffects.calculate(s,runes).totals;
 assert.equal(result.mp,250);assert.equal(result.ultimateHaste,31);
 s.runeSelections.primary=[];assert.equal(RuneEffects.calculate(s,runes).totals.mp,0);
 assert.equal(RuneEffects.fields(s,runes).length,0);
});
test('Legend stacks change their matching stats and only full Bloodline adds health',()=>{
 assert.equal(calculate(['legend-alacrity'],{'legend-alacrity':10}).asPct,18);
 assert.equal(calculate(['legend-haste'],{'legend-haste':10}).basicHaste,15);
 assert.equal(calculate(['legend-bloodline'],{'legend-bloodline':14}).hp,0);
 const full=calculate(['legend-bloodline'],{'legend-bloodline':15});
 assert.equal(full.hp,85);assert.equal(full.physicalVamp,6.75);
});
test('game time drives Gathering Storm and Conditioning at their stated milestones',()=>{
 for(const [time,ap] of [[9.99,0],[10,8],[20,24],[30,48],[60,168]])assert.equal(calculate(['gathering-storm'],{},time,{adaptiveAp:true}).ap,ap);
 assert.ok(Math.abs(calculate(['gathering-storm'],{},20).ad-14.4)<.00001);
 assert.equal(calculate(['conditioning'],{},11.9).armor,0);
 const after=calculate(['conditioning'],{},12);assert.equal(after.armor,8);assert.equal(after.mr,8);assert.equal(after.armorPct,3);
});
test('health, adaptive and attack-speed stack bonuses use patch descriptions',()=>{
 assert.equal(calculate(['grasp-of-the-undying'],{'grasp-of-the-undying':10},0,{ranged:true}).hp,20);
 const growth=calculate(['overgrowth'],{overgrowth:120});assert.equal(growth.hp,45);assert.equal(growth.hpPct,3.5);
 assert.equal(calculate(['biscuit-delivery'],{'biscuit-delivery':3}).hp,90);
 assert.equal(calculate(['conqueror'],{conqueror:12},0,{adaptiveAp:true}).ap,48);
 assert.equal(calculate(['lethal-tempo'],{'lethal-tempo':6},0,{ranged:true}).asPct,24);
 const jack=calculate(['jack-of-all-trades'],{'jack-of-all-trades':10},0,{adaptiveAp:true});assert.equal(jack.haste,10);assert.equal(jack.ap,20);
});
test('inputs are bounded integers, selections are unique, and unsupported effects are explicit',()=>{
 const field=RuneEffects.definition('ultimate-hunter',runes['ultimate-hunter']);
 for(const [input,want]of [[-3,0],[2.9,2],['',0],[Infinity,0],[100,5]])assert.equal(RuneEffects.normalize(input,field),want);
 assert.equal(calculate(['manaflow-band','manaflow-band'],{'manaflow-band':2}).mp,50);
 const result=RuneEffects.calculate(state(['dark-harvest'],{'dark-harvest':20}),runes);
 assert.match(result.notes['dark-harvest'],/not included/);
 const missing=RuneEffects.calculate(state(['manaflow-band'],{'manaflow-band':10}),{});
 assert.equal(missing.totals.mp,0);assert.match(missing.notes['manaflow-band'],/not included/);
});
