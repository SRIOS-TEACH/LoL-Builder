const test=require('node:test');
const assert=require('node:assert/strict');
require('../JS/shared/calculations.js');
require('../JS/shared/buildStats.js');
require('../JS/shared/attackEffects.js');
const fixtures=require('./attack-excerpts.json');
const near=(a,b)=>assert.ok(Math.abs(a-b)<0.001,`${a} != ${b}`);
const stats=()=>({base:{attackdamage:100,attackdamageperlevel:0,attackspeed:1,attackspeedratio:1,attackspeedperlevel:0,attackrange:550,hp:1000,hpperlevel:0,mp:500,mpperlevel:0,armor:30,armorperlevel:0,crit:0,critperlevel:0},item:{critChance:25,critDamage:30,asPct:0},rune:{critChance:0,critDamage:0,asPct:0},level:18,ad:100,ap:100,hp:1000,mp:500,armor:30,mr:30,asTotal:1,critChance:25,critDamage:230,attackRange:550,championBonuses:{}});
function state(name='Ahri',ids=[],values={}){
  const slots={Yasuo:['YasuoPassive'],Yone:['YonePassive'],Senna:['SennaPassive'],Jhin:['JhinPassive'],Ashe:['AshePassive','AsheQ'],Teemo:['TeemoPassive',null,null,'TeemoE'],KogMaw:[null,null,'KogMawBioArcaneBarrage'],Vayne:['VaynePassive','VayneTumble','VayneSilveredBolts']};
  const all=fixtures.champions[name]||{},byAlias=Object.fromEntries(Object.entries(all).map(([k,payload])=>[k.toLowerCase(),{payload}]));
  const cdragonAbilityData={byAlias};for(const [i,k]of (slots[name]||[]).entries())cdragonAbilityData[['p','q','w','e'][i]]=all[k];
  // Yasuo and Yone use their short P script identifiers.
  if(name==='Yasuo')cdragonAbilityData.p=all.YasuoPassive||all.YasuoP;
  if(name==='Yone')cdragonAbilityData.p=all.YonePassive||all.YoneP;
  if(name==='Senna')cdragonAbilityData.p=all.SennaPassive||all.SennaP;
  return {selectedChampion:name,level:18,itemSlots:ids,abilityRanks:{q:5,w:5,e:5,r:3},combatValues:values,cdragonAbilityData};
}
test('critical strikes use a bounded probability and full critical multiplier',()=>{
  near(AttackEffects.averageCrit(100,0,2.3),100);
  near(AttackEffects.averageCrit(100,.25,2.3),132.5);
  near(AttackEffects.averageCrit(100,1,2.3),230);
  near(AttackEffects.averageCrit(100,2,2.3),230);
});
test('ordinary item on-hit damage does not inherit the basic-attack crit multiplier',()=>{
  const p=AttackEffects.model(state('Ahri',['3115','3091']),fixtures.items).profile(stats());
  near(p.autoAttackDamage,132.5+30+45);near(p.attackDps,p.autoAttackDamage);
});
test('Rageblade boosts on-hit frequency without multiplying ordinary attack damage',()=>{
  const m=AttackEffects.model(state('Ahri',['3115','3124'],{'attack:rageStacks':4}),fixtures.items),s=m.apply(stats()),p=m.profile(s);
  near(s.asTotal,1.32);near(p.autoAttackDamage,132.5+(30+30)*4/3);near(p.attackDps,p.autoAttackDamage*1.32);
});
test('Yasuo and Yone double uncapped crit chance, convert excess to AD, and modify IE crits',()=>{
  for(const n of ['Yasuo','Yone']){
    const s=stats();s.item.critChance=75;s.critChance=75;
    const out=AttackEffects.model(state(n),fixtures.items).apply(s);
    near(out.critChance,100);near(out.ad,125);near(out.critDamage,218.5);
  }
});
test('Senna applies her full critical damage modifier to Infinity Edge',()=>{
  const out=AttackEffects.model(state('Senna'),fixtures.items).apply(stats());near(out.critDamage,184);
});
test('Jhin converts item attack speed into AD and averages a guaranteed fourth crit plus reload',()=>{
  const s=stats();s.item.asPct=50;s.asTotal=1.5;
  const m=AttackEffects.model(state('Jhin',[],{'attack:target:hp':2000,'attack:target:currentHp':1000}),fixtures.items),out=m.apply(s),p=m.profile(out);
  near(out.ad,100*(1+.44+.25*.35+.5*.3));near(out.critDamage,172.5);
  const expected=(3*AttackEffects.averageCrit(out.ad,.25,1.725)+out.ad*1.725+250)/4;
  near(p.autoAttackDamage,expected);near(p.attackDps,expected*4/(3/out.asTotal+2.5));
});
test('target-dependent on-hits remain unavailable until health is supplied; zero is valid',()=>{
  const m=v=>AttackEffects.model(state('Ahri',['3153'],v),fixtures.items).profile(stats());
  assert.equal(m({}).autoAttackDamage,null);near(m({'attack:target:currentHp':0}).autoAttackDamage,132.5);
  near(m({'attack:target:currentHp':2000}).autoAttackDamage,252.5);
});
test('Spellblade uses base AD and a proc interval bounded by its cooldown',()=>{
  const v={'attack:spellblade':true,'attack:spellbladeInterval':.1},s=stats();s.ad=200;s.asTotal=2;
  const m=AttackEffects.model(state('Ahri',['3057'],v),fixtures.items).profile(s);
  near(m.rows[0].value,100);near(m.rows[0].perSecond,100/1.5);near(m.attackDps,265*2+100/1.5);
  const field=m.controls.find(c=>c.key==='attack:spellbladeInterval');
  near(field.min,1.5);near(field.defaultValue,1.5);
  delete v['attack:spellbladeInterval'];near(AttackEffects.model(state('Ahri',['3057'],v),fixtures.items).profile(s).attackDps,265*2+100/1.5);
});
test('all Spellblade items resolve their game-authored proc formulas independently of average attack crits',()=>{
  const s=stats();s.ad=200;s.asTotal=2;s.ap=200;
  // Source snapshot: Sheen 100% base AD, Trinity 200%, Lich .75 base AD+.45 AP,
  // Iceborn 150%, Essence Reaver 125%+50*critChance, Bloodsong100%, Dusk .75+.1AP.
  for(const [id,expected,type]of [[3057,100,'physical'],[3078,200,'physical'],[3100,165,'magic'],[6662,150,'physical'],[3508,137.5,'physical'],[3877,100,'physical'],[2510,95,'magic']]){
    const p=AttackEffects.model(state('Ahri',[String(id)],{'attack:spellblade':true}),fixtures.items).profile(s),r=p.rows.find(r=>r.spellbladeId===id);
    near(r.value,expected);near(r.interval,1.5);near(r.perSecond,expected/1.5);near(r.perHit,expected/3);assert.equal(r.type,type);
    assert.match(p.breakdown,/per Spellblade proc; minimum cooldown 1.5s/);
  }
});
test('Spellblade accepts slower intervals and is limited by attack speed at slow attack rates',()=>{
  const s=stats(),x=state('Ahri',['3100'],{'attack:spellblade':true,'attack:spellbladeInterval':4});
  near(AttackEffects.model(x,fixtures.items).profile(s).rows[0].perSecond,120/4);
  x.combatValues['attack:spellbladeInterval']=-2;s.asTotal=.25;
  const p=AttackEffects.model(x,fixtures.items).profile(s);near(p.rows[0].interval,1.5);near(p.rows[0].perSecond,120*.25);near(p.rows[0].perHit,120);
});
test('Spellblade specific cooldown overrides generic cooldown and remains enforced if input is absent',()=>{
  const items=structuredClone(fixtures.items),x=state('Ahri',['3100'],{'attack:spellblade':true});
  items[3100].mDataValues.find(v=>v.mName==='SpellbladeCooldown').mValue=2;
  const p=AttackEffects.model(x,items).profile(stats());near(p.rows[0].interval,2);near(p.controls.find(c=>c.key==='attack:spellbladeInterval').min,2);
});
test('disabling Muramana Shock on-hit leaves unrelated damage and input item stats intact',()=>{
  const x=state('Ahri',['3042','3115']),s=stats(),before=structuredClone(s),m=AttackEffects.model(x,fixtures.items);
  const on=m.profile(s);x.disabledItemPassives={'3042:shock-on-hit':true};const off=m.profile(s);
  near(on.autoAttackDamage-off.autoAttackDamage,s.mp*.012);assert.ok(!off.rows.some(r=>r.label==='Muramana'));assert.deepEqual(s,before);
});
test('disabled Spellblade item does not suppress the next eligible item in the shared group',()=>{
  const x=state('Ahri',['3100','3057'],{'attack:spellblade':true}),m=AttackEffects.model(x,fixtures.items);
  assert.equal(m.profile(stats()).rows[0].spellbladeId,3100);
  x.disabledItemPassives={'3100:spellblade':true};assert.equal(m.profile(stats()).rows[0].spellbladeId,3057);
  x.disabledItemPassives['3057:spellblade']=true;assert.equal(m.profile(stats()).rows.length,0);
});
test('Kog Maw toggle multiplies the percentage by target HP and is disabled at rank zero',()=>{
  const s=state('KogMaw',[],{'attack:championOnHit':true,'attack:target:hp':2000});
  near(AttackEffects.model(s,{}).profile(stats()).rows[0].value,150);
  s.abilityRanks.w=0;assert.equal(AttackEffects.model(s,{}).profile(stats()).rows.length,0);
});
test('Teemo poison refreshes instead of contributing its full duration per attack',()=>{
  const s=stats();s.asTotal=2;
  const p=AttackEffects.model(state('Teemo'),{}).profile(s),dot=p.rows.find(r=>r.dot);
  near(dot.perSecond,40);near(dot.perHit,20);
});
