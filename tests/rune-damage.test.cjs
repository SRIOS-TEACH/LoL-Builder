const test=require('node:test');
const assert=require('node:assert/strict');const TargetDamage=require('../JS/shared/targetDamage.js').default;const RuneEffects=require('../JS/shared/runeEffects.js').default;
const {runes}=require('./rune-excerpts.json');
const stats={ap:200,bonusAd:50,hp:3000,bonusHp:1000,bonusAttackSpeed:.5,attackSpeed:1.5,ranged:false};
const state=(ids,extra={})=>({level:18,runeSelections:{primary:ids,secondary:[]},runeStacks:{},...extra});
const action=(id,extra={},s=stats,lookup=runes)=>RuneEffects.damageActions(state([id],extra),lookup,s)[0];
test('selected rune procs use level, AP and bonus AD from patch descriptions',()=>{
 assert.equal(action('scorch').damage,40);assert.equal(action('scorch',{level:1}).damage,20);
 assert.equal(action('sudden-impact').damage,80);assert.equal(action('sudden-impact').damageType,'true');
 assert.equal(action('electrocute').damage,255);assert.equal(action('electrocute').cooldown,20);
 assert.equal(action('summon-aery').damage,65);assert.equal(action('summon-aery').cooldown,null);
 const comet=RuneEffects.damageActions(state(['arcane-comet']),runes,stats);
 assert.deepEqual(comet.map(a=>a.damage),[115,230]);assert.equal(comet[0].cooldown,8);
 assert.equal(action('aftershock').damage,200);assert.equal(action('press-the-attack').damage,160);
});
test('ranged and stack based procs resolve without including heals or stack grants',()=>{
 assert.equal(action('grasp-of-the-undying').damage,105);
 assert.equal(action('grasp-of-the-undying',{}, {...stats,ranged:true}).damage,42);
 assert.equal(action('lethal-tempo').damage,45);
 assert.equal(action('lethal-tempo',{}, {...stats,ranged:true}).damage,36);
 assert.equal(action('dark-harvest',{runeStacks:{'dark-harvest':2}}).damage,67);
});
test('rune damage is mitigated once, adaptive type follows stats, and health gates apply',()=>{
 const target={enabled:true,maxHp:1000,currentHp:500,armor:100,mr:300,damageReduction:0};
 assert.equal(action('electrocute',{target}).damage,63.75);
 assert.equal(action('electrocute',{target},{...stats,ap:0,bonusAd:200}).damage,130);
 assert.equal(action('sudden-impact',{target}).damage,80);
 assert.equal(action('dark-harvest',{target}).damage,0);
 assert.equal(action('dark-harvest',{target:{...target,currentHp:499}}).damage,11.25);
 assert.equal(action('scorch',{target},{...stats,magicDamageMultiplier:1.2}).damage,12);
});
test('unselected and non-damage runes are excluded and missing formulas remain flagged',()=>{
 assert.equal(RuneEffects.damageActions(state(['manaflow-band','scorch','scorch']),runes,stats).length,1);
 assert.equal(action('electrocute',{},stats,{}).damage,null);
 assert.equal(action('first-strike').damage,null);
 const changed={...runes,scorch:{longDesc:'dealing 30 - 70 bonus magic damage based on level. Cooldown: 12s'}};
 assert.equal(action('scorch',{},stats,changed).damage,70);
});
