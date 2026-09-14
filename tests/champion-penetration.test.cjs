const test=require('node:test'),assert=require('node:assert/strict');
require('../JS/shared/calculations.js');require('../JS/shared/championEffects.js');
const TargetDamage=require('../JS/shared/targetDamage.js');
const fixture=require('./champion-penetration-excerpts.json');
const near=(actual,expected)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<.00001,`${actual} != ${expected}`);
const stats=()=>({critChance:50,item:{arPenPct:30,arPenFlat:18,mrPenPct:40,mrPenFlat:15},rune:{arPenPct:10,arPenFlat:6,mrPenPct:10,mrPenFlat:3}});
const state=name=>({selectedChampion:name,level:18,abilityRanks:{q:5,w:5,e:5,r:3},combatValues:{},cdragonAbilityData:fixture.champions[name]});
const target={enabled:true,maxHp:2000,currentHp:2000,armor:200,mr:200,damageReduction:0};
test('item and rune percentage penetration combine multiplicatively even before champion data loads',()=>{
  const s=stats(),x=state('Ahri');delete x.cdragonAbilityData;const out=ChampionEffects.model(x).apply(s);
  near(out.armorPenPct,37);near(out.magicPenPct,46);near(out.armorPenFlat,24);near(out.magicPenFlat,18);
  assert.equal(s.armorPenPct,undefined);assert.deepEqual(out.championBonuses,{});
});
test('Darius Apprehend reads its rank percentage and combines it with item/rune penetration',()=>{
  const x=state('Darius'),s=stats(),out=ChampionEffects.model(x).apply(s);
  near(out.armorPenPct,62.2);near(out.championBonuses.armorPenPct,25.2);near(out.championPenetration.armorPenPct,40);
  near(TargetDamage.apply(100,'physical',{target,stats:out}).value,100/(1+(200*.378-24)/100));
  x.abilityRanks.e=1;near(ChampionEffects.model(x).apply(s).armorPenPct,49.6);
  x.abilityRanks.e=0;near(ChampionEffects.model(x).apply(s).armorPenPct,37);
});
test('Pantheon Grand Starfall grants source fraction penetration only with a learned ultimate',()=>{
  const x=state('Pantheon'),s=stats();near(ChampionEffects.model(x).apply(s).armorPenPct,55.9);
  x.abilityRanks.r=1;near(ChampionEffects.model(x).apply(s).armorPenPct,43.3);
  x.abilityRanks.r=0;near(ChampionEffects.model(x).apply(s).armorPenPct,37);
});
test('Mordekaiser Deaths Grasp changes magic penetration without altering physical penetration',()=>{
  const x=state('Mordekaiser'),s=stats(),out=ChampionEffects.model(x).apply(s);
  near(out.magicPenPct,54.1);near(out.armorPenPct,37);
  near(TargetDamage.apply(100,'magic',{target,stats:out}).value,100/(1+(200*.459-18)/100));
  x.abilityRanks.e=1;near(ChampionEffects.model(x).apply(s).magicPenPct,48.7);
  x.abilityRanks.e=0;near(ChampionEffects.model(x).apply(s).magicPenPct,46);
});
test('Nilah Formless Blade uses actual crit fraction, bounded to 100%, and its authored calculation',()=>{
  const x=state('Nilah'),s=stats();near(ChampionEffects.model(x).apply(s).armorPenPct,46.45);
  s.critChance=100;near(ChampionEffects.model(x).apply(s).armorPenPct,55.9);
  s.critChance=200;near(ChampionEffects.model(x).apply(s).armorPenPct,55.9);
  s.critChance=0;near(ChampionEffects.model(x).apply(s).armorPenPct,37);
  s.critChance=50;x.abilityRanks.q=0;near(ChampionEffects.model(x).apply(s).armorPenPct,37);
});
test('Aphelios lethality upgrades use the source buff and respect integer rank cap',()=>{
  const x=state('Aphelios'),s=stats(),m=ChampionEffects.model(x),field=m.fields.find(f=>f.key==='buff:{f79080ae}');
  assert.ok(field);assert.equal(field.label,'Lethality upgrade ranks');assert.equal(field.max,6);assert.equal(field.step,1);
  for(const [ranks,expected]of [[0,24],[3,37.5],[6,51],[100,51],[3.9,37.5],[-1,24]]){
    x.combatValues['buff:{f79080ae}']=ranks;const out=m.apply(s);near(out.armorPenFlat,expected);near(out.armorPenPct,37);near(out.championPenetration.armorPenFlat,expected-24);
  }
});
test('missing champion penetration source values do not invent bonuses',()=>{
  for(const champion of ['Darius','Pantheon','Mordekaiser','Nilah','Aphelios']){
    const x=state(champion);x.cdragonAbilityData={};const out=ChampionEffects.model(x).apply(stats());
    near(out.armorPenPct,37);near(out.magicPenPct,46);near(out.armorPenFlat,24);near(out.magicPenFlat,18);
  }
});
