const test=require('node:test'),assert=require('node:assert/strict');
const TargetDamage=require('../JS/shared/targetDamage.js');
require('../JS/shared/calculations.js');require('../JS/shared/buildStats.js');
require('../JS/shared/attackEffects.js');
require('../JS/shared/attackChampions.js');
const fixture=require('./attack-excerpts.json');
const interactions=require('./attack-interactions.json');
const near=(actual,expected)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<.001,`${actual} != ${expected}`);
const target=extra=>({enabled:true,maxHp:2000,currentHp:1000,armor:100,mr:300,damageReduction:20,...extra});
const calculate=(damage,type,t=target(),stats={})=>TargetDamage.apply(damage,type,{target:t,stats});
const stats=()=>({base:{attackdamage:100,attackdamageperlevel:0,attackspeed:1,attackspeedratio:1,attackspeedperlevel:0,attackrange:550,hp:1000,hpperlevel:0,mp:500,mpperlevel:0,armor:30,armorperlevel:0,spellblock:30,spellblockperlevel:0,crit:0,critperlevel:0},item:{critChance:0,critDamage:0,asPct:0},rune:{critChance:0,critDamage:0,asPct:0},level:18,ad:100,ap:100,hp:1000,mp:500,armor:30,mr:30,asTotal:2,critChance:0,critDamage:200,attackRange:550,championBonuses:{}});
const state=(ids=[],combatValues={},extra={})=>({selectedChampion:'Ahri',level:18,itemSlots:ids,abilityRanks:{q:5,w:5,e:5,r:3},combatValues,cdragonAbilityData:{},target:target(),...extra});
test('target normalization bounds health/reduction and preserves negative resistances',()=>{
  assert.deepEqual(TargetDamage.normalize({enabled:true,maxHp:1000,currentHp:1500,armor:-40,mr:-60,damageReduction:120}),{enabled:true,maxHp:1000,currentHp:1000,armor:-40,mr:-60,damageReduction:100});
  const t=TargetDamage.targetStats(target());near(t.healthPercent,.5);near(t.missingHealthPercent,.5);near(t.missingHp,1000);
  assert.deepEqual(TargetDamage.targetStats(target({enabled:false})),{});
  near(TargetDamage.normalize({maxHp:0,currentHp:-1}).maxHp,1);near(TargetDamage.normalize({maxHp:0,currentHp:-1}).currentHp,0);
});
test('physical, magic and true damage use their own defenses independently of AD/AP',()=>{
  near(calculate(100,'physical').value,40);near(calculate(100,'magic').value,20);near(calculate(100,'true').value,100);
  near(calculate(100,'physical',target(),{ap:10000}).value,40);
  near(calculate(100,'magic',target(),{totalAd:10000}).value,20);
  const missing=calculate(100,null);assert.equal(missing.value,null);near(missing.rawValue,100);assert.equal(missing.multiplier,null);assert.match(missing.text,/damage type is not identified/);
  assert.equal(calculate(null,'magic').value,null);
});
test('percentage penetration applies before flat penetration, with resistance floor zero',()=>{
  near(calculate(100,'physical',target({damageReduction:0}),{armorPenPct:30,armorPenFlat:20}).value,100/1.5);
  near(calculate(100,'magic',target({damageReduction:0}),{magicPenPct:40,magicPenFlat:30}).value,40);
  near(calculate(100,'physical',target({damageReduction:0}),{armorPenFlat:200}).value,100);
  near(calculate(100,'magic',target({damageReduction:0}),{magicPenPct:150}).value,100);
});
test('builder penetration aliases and canonical totals produce the same result without double counting',()=>{
  const item={arPenPct:30,arPenFlat:10,mrPenPct:40,mrPenFlat:20},rune={arPenFlat:10,mrPenFlat:10};
  near(calculate(100,'physical',target({damageReduction:0}),{item,rune}).value,100/1.5);
  near(calculate(100,'magic',target({damageReduction:0}),{item,rune}).value,40);
  near(calculate(100,'physical',target({damageReduction:0}),{armorPenPct:30,armorPenFlat:20,item,rune}).value,100/1.5);
  near(calculate(100,'physical',target({armor:0,damageReduction:0}),{lethality:30}).value,100);
});
test('negative resistance amplifies damage and ignores penetration',()=>{
  near(calculate(120,'physical',target({armor:-50,damageReduction:0})).value,160);
  near(calculate(120,'physical',target({armor:-50,damageReduction:25}),{armorPenPct:50,armorPenFlat:100}).value,120);
  near(calculate(120,'magic',target({mr:-50,damageReduction:0})).value,160);
});
test('full generic reduction removes non-true damage while target off restores raw damage',()=>{
  for(const type of ['physical','magic'])near(calculate(100,type,target({damageReduction:100})).value,0);
  near(calculate(100,'true',target({damageReduction:100})).value,100);
  for(const type of ['physical','magic','true'])near(calculate(100,type,target({enabled:false})).value,100);
});
test('explicit outgoing damage multipliers precede target defenses and are ignored when settings are off',()=>{
  const outgoing={physicalDamageMultiplier:1.5,magicDamageMultiplier:1.2,trueDamageMultiplier:1.2};
  near(calculate(100,'physical',target(),outgoing).value,60);
  near(calculate(100,'magic',target(),outgoing).value,24);
  const pure=calculate(100,'true',target({damageReduction:100}),outgoing);near(pure.value,120);near(pure.rawValue,100);near(pure.multiplier,1.2);
  assert.match(pure.text,/× 1.2 outgoing damage multiplier/);assert.match(pure.text,/ignores armor/);
  for(const type of ['physical','magic','true'])near(calculate(100,type,target({enabled:false}),outgoing).value,100);
});
test('hybrid on-attack totals mitigate each packet once and retain raw proc and DPS values',()=>{
  const x=state(['3153','3115','3179'],{'attack:umbral':true,'attack:umbralInterval':2}),p=AttackEffects.model(x,fixture.items).profile(stats());
  // 100 physical attack + 60 physical BORK + 30 magic Nashor + 50 true
  // Umbral every 2s at 2 attacks/s (12.5 averaged true damage per attack).
  near(p.rawAutoAttackDamage,202.5);near(p.autoAttackDamage,82.5);near(p.attackDps,165);near(p.rawAttackDps,405);
  const bork=p.rows.find(r=>r.label==='Blade of the Ruined King'),nashor=p.rows.find(r=>r.label==='Nashor’s Tooth'),umbral=p.rows.find(r=>r.label==='Umbral Glaive');
  near(bork.rawValue,60);near(bork.value,24);near(nashor.rawValue,30);near(nashor.value,6);near(umbral.rawValue,50);near(umbral.value,50);
  near(umbral.rawPerHit,12.5);near(umbral.perHit,12.5);assert.match(p.breakdown,/After target mitigation/);assert.match(p.breakdown,/effective armor/);
  assert.ok(!p.controls.some(c=>['attack:target:hp','attack:target:currentHp'].includes(c.key)));
});
test('current-health items use the shared target and discard stale per-attack target inputs',()=>{
  const x=state(['3153'],{'attack:target:currentHp':9000}),m=AttackEffects.model(x,fixture.items),s=stats();
  near(m.profile(s).rows[0].rawValue,60);x.target.currentHp=500;near(m.profile(s).rows[0].rawValue,30);
  x.target.currentHp=0;near(m.profile(s).rows[0].rawValue,0);near(m.profile(s).autoAttackDamage,40);
  x.target.enabled=false;assert.equal(m.profile(s).rows[0].value,null);assert.equal(m.profile(s).autoAttackDamage,null);
  delete x.target;near(m.profile(s).rows[0].value,540);
});
test('target toggles restore ordinary attack and magic on-hit values without changing crit averaging',()=>{
  const x=state(['3115']),s=stats();s.critChance=50;
  const m=AttackEffects.model(x,fixture.items);near(m.profile(s).autoAttackDamage,66);
  x.target.enabled=false;near(m.profile(s).autoAttackDamage,180);
});
test('Spellblade mitigation retains the source proc and shares the same cadence for raw and target DPS',()=>{
  const p=AttackEffects.model(state(['3100'],{'attack:spellblade':true}),fixture.items).profile(stats()),proc=p.rows[0];
  near(proc.rawValue,120);near(proc.value,24);near(proc.perSecond,16);near(proc.rawPerSecond,80);near(p.attackDps,96);
});
test('Kog Maw health-scaling magic attack reads the shared target rather than an obsolete control',()=>{
  const x=state([],{'attack:championOnHit':true,'attack:target:hp':9999},{selectedChampion:'KogMaw',cdragonAbilityData:{w:fixture.champions.KogMaw.KogMawBioArcaneBarrage}});
  const p=AttackEffects.model(x,fixture.items).profile(stats());near(p.rows[0].rawValue,150);near(p.rows[0].value,30);
});
test('a magic replacement attack also mitigates the physical debit, so the replaced attack cancels once',()=>{
  const x=state(['3115'],{'attack:siphon':true,'attack:siphonInterval':2},{selectedChampion:'Viktor',cdragonAbilityData:interactions.champions.Viktor}),p=AttackEffects.model(x,fixture.items).profile(stats());
  const replacement=p.rows.find(r=>r.label==='Siphon Power replacement'),debit=p.rows.find(r=>r.replacementDebit);
  near(replacement.value,replacement.rawValue*.2);near(debit.rawValue,-100);near(debit.value,-40);
  near(p.autoAttackDamage,40+p.rows.reduce((sum,r)=>sum+r.perHit,0));
});
test('Camille converts the selected physical Spellblade portion before target mitigation',()=>{
  const x=state(['3057'],{'attack:precision':true,'attack:precisionInterval':1.5,'attack:precisionSpellblade':true,'attack:spellblade':true},{selectedChampion:'Camille',cdragonAbilityData:interactions.champions.Camille}),p=AttackEffects.model(x,fixture.items).profile(stats());
  const physical=p.rows.find(r=>r.spellbladeId===3057&&r.type==='physical'),converted=p.rows.find(r=>r.spellbladeId===3057&&r.type==='true');
  assert.ok(converted,'the shared Spellblade proc has a true damage packet');near(converted.value,converted.rawValue);near(physical.value,physical.rawValue*.4);
  x.target.damageReduction=100;const blocked=AttackEffects.model(x,fixture.items).profile(stats());
  near(blocked.autoAttackDamage,blocked.rows.filter(r=>r.type==='true').reduce((sum,r)=>sum+r.perHit,0));
});
test('Shadowflame derives its threshold from managed target health and respects its passive switch',()=>{
  const x=state(['3115','4645'],{'attack:shadowflame':true}),m=AttackEffects.model(x,fixture.items),s=stats();
  near(m.profile(s).rows[0].rawValue,30);x.target.currentHp=800;near(m.profile(s).rows[0].rawValue,30);
  x.target.currentHp=799;near(m.profile(s).rows[0].rawValue,36);near(m.profile(s).rows[0].value,7.2);
  assert.ok(!m.profile(s).controls.some(c=>c.key==='attack:shadowflame'));
  x.disabledItemPassives={'4645:cinderbloom':true};near(m.profile(s).rows[0].rawValue,30);
  delete x.disabledItemPassives;x.target.enabled=false;near(m.profile(s).rows[0].value,36);
  x.combatValues['attack:shadowflame']=false;near(m.profile(s).rows[0].value,30);
});
test('Kraken interpolates source missing-health amplification with no additional threshold',()=>{
  // CD DamageAmount/MaxAmpNumber + Riot patch25.14's 0–75% based on missing
  // health: linear interpolation over 0–100% missing, not an invented cap.
  const x=state(['6672'],{'attack:krakenAmp':75}),m=AttackEffects.model(x,fixture.items),s=stats();
  x.target.currentHp=2000;const base=m.profile(s).rows[0].rawValue;
  x.target.currentHp=1000;near(m.profile(s).rows[0].rawValue,base*1.375);
  x.target.currentHp=500;near(m.profile(s).rows[0].rawValue,base*1.5625);
  x.target.currentHp=0;near(m.profile(s).rows[0].rawValue,base*1.75);near(m.profile(s).rows[0].value,base*1.75*.4);
  assert.match(m.profile(s).breakdown,/75.00% × 100.00% target missing health/);
  assert.ok(!m.profile(s).controls.some(c=>c.key==='attack:krakenAmp'));
  x.target.enabled=false;near(m.profile(s).rows[0].value,base*1.75);
});
test('legacy target bonus health is unavailable while the shared target is disabled',()=>{
  const x=state(['3036'],{'attack:target:bonusHp':2000}),m=AttackEffects.model(x,interactions.items),s=stats();
  assert.ok(Number.isFinite(m.profile(s).autoAttackDamage));assert.ok(m.profile(s).controls.some(c=>c.key==='attack:target:bonusHp'));
  x.target.enabled=false;assert.equal(m.profile(s).autoAttackDamage,null);assert.ok(!m.profile(s).controls.some(c=>c.key==='attack:target:bonusHp'));
  delete x.target;assert.ok(Number.isFinite(m.profile(s).autoAttackDamage));
});
