const test=require('node:test'),assert=require('node:assert/strict');
require('../JS/shared/calculations.js');require('../JS/shared/buildStats.js');
require('../JS/shared/attackEffects.js');require('../JS/shared/attackChampions.js');
const fixture=require('./attack-interactions.json'),prior=require('./attack-excerpts.json');
const items={...prior.items,...fixture.items};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<.015,`${a} != ${b}`);
function model(name='Ahri',ids=[],values={}){
  const state={selectedChampion:name,level:18,abilityRanks:{q:5,w:5,e:5,r:3},itemSlots:ids,combatValues:values,cdragonAbilityData:fixture.champions[name]||{}};
  const s={base:{attackdamage:50,attackdamageperlevel:0,attackspeed:1,attackspeedratio:1,attackspeedperlevel:0,attackrange:125,hp:1000,hpperlevel:0,mp:500,mpperlevel:0,armor:30,armorperlevel:0,spellblock:30,spellblockperlevel:0,crit:0,critperlevel:0},item:{critChance:25,critDamage:30,asPct:0},rune:{critChance:0,critDamage:0,asPct:0},ad:100,ap:100,hp:1000,mp:500,armor:30,mr:30,asTotal:2,critChance:25,critDamage:230,attackRange:550,level:18,championBonuses:{}};
  const m=AttackEffects.model(state,items);return {state,s,m,profile:()=>m.profile(m.apply(s))};
}
test('Yun Tal earned crit is added once, capped, and survives repeated calculation',()=>{
  const x=model('Ahri',['3032'],{'attack:yunTalCrit':25});
  near(x.m.apply(x.s).critChance,50);near(x.profile().autoAttackDamage,165);near(x.profile().autoAttackDamage,165);
  x.state.combatValues['attack:flurry']=true;near(x.m.apply(x.s).asTotal,2.3);
});
test('Yun Tal passive toggles isolate earned crit from Flurry attack speed',()=>{
  const x=model('Ahri',['3032'],{'attack:yunTalCrit':25,'attack:flurry':true});
  x.state.disabledItemPassives={'3032:practice-makes-lethal':true};near(x.m.apply(x.s).critChance,25);near(x.m.apply(x.s).asTotal,2.3);
  x.state.disabledItemPassives={'3032:flurry':true};near(x.m.apply(x.s).critChance,50);near(x.m.apply(x.s).asTotal,2);
});
test('Rageblade can disable Wrath damage separately from Seething Strike stacks and phantom hits',()=>{
  const x=model('Ahri',['3124','3115'],{'attack:rageStacks':4});
  x.state.disabledItemPassives={'3124:wrath':true};let p=x.profile();near(p.rate,2.32);near(p.rows.find(r=>r.label==='Nashor’s Tooth').perHit,40);assert.ok(!p.rows.some(r=>r.label==='Guinsoo’s Rageblade'));
  x.state.disabledItemPassives={'3124:seething-strike':true};p=x.profile();near(p.rate,2);near(p.rows.find(r=>r.label==='Nashor’s Tooth').perHit,30);near(p.rows.find(r=>r.label==='Guinsoo’s Rageblade').perHit,30);
});
test('disabling Dusk Spellblade removes its repeated on-hit without removing the other item',()=>{
  const x=model('Ahri',['2510','3115'],{'attack:spellblade':true});
  x.state.disabledItemPassives={'2510:spellblade':true};const p=x.profile();near(p.rows.find(r=>r.label==='Nashor’s Tooth').perSecond,60);assert.ok(!p.rows.some(r=>r.spellbladeId));
});
test('turning off an optional item passive overrides an old combat activation',()=>{
  const x=model('Ahri',['2512','3504','6610'],{'attack:fiendhunter':true,'attack:ardent':true,'attack:sundered':true,'attack:sunderedInterval':10});
  x.state.disabledItemPassives={'2512:opening-barrage':true,'3504:sanctify':true,'6610:lightshield-strike':true};
  const p=x.profile();near(p.rate,2);near(p.autoAttackDamage,132.5);assert.equal(p.rows.length,0);
});
test('disabled amplifiers do not require their target fields or alter champion and item damage',()=>{
  const x=model('Fizz',['3161','2523','3036','4645','3115'],{'attack:shojinStacks':4,'attack:shadowflame':true});
  x.state.disabledItemPassives={'3161:focused-will':true,'2523:magnification':true,'3036:giant-slayer':true,'4645:cinderbloom':true};
  const p=x.profile(),plain=model('Fizz',['3115']).profile();near(p.autoAttackDamage,plain.autoAttackDamage);near(p.attackDps,plain.attackDps);
});
test('Hullbreaker amortizes one Skipper proc per five attacks',()=>{
  const x=model('Ahri',['3181']);near(x.profile().autoAttackDamage,132.5+(50*1.2+1000*.05)/5);
  x.s.base.attackrange=550;near(x.profile().rows[0].value,77);
});
test('Dead Man momentum scales its proc and obeys the supplied interval',()=>{
  const x=model('Ahri',['3742'],{'attack:shipwrecker':true,'attack:momentum':50,'attack:momentumInterval':2});
  near(x.profile().rows[0].value,45);near(x.profile().rows[0].perSecond,22.5);
});
test('Dusk and Dawn repeats Nashor on-hit once per Spellblade proc without recursion',()=>{
  const x=model('Ahri',['2510','3115'],{'attack:spellblade':true,'attack:spellbladeInterval':2}),p=x.profile();
  const nashor=p.rows.find(r=>r.label==='Nashor’s Tooth');near(nashor.perSecond,30*2+30/2);
  near(p.rows.find(r=>r.spellbladeId===2510).perSecond,(.75*50+.1*100)/2);
});
test('Rageblade and Dusk extra hits add and never multiply the base crit packet',()=>{
  const x=model('Ahri',['2510','3115','3124'],{'attack:rageStacks':4,'attack:spellblade':true,'attack:spellbladeInterval':2}),p=x.profile(),rate=2.32;
  near(p.rate,rate);near(p.rows.find(r=>r.label==='Nashor’s Tooth').perSecond,30*(rate*4/3+.5));
});
test('Magnification scales the attack packet while Giant Slayer also scales non-true on-hits',()=>{
  const x=model('Ahri',['2523','3115'],{'attack:distance':250});near(x.profile().autoAttackDamage,132.5*1.05+30);
  const y=model('Ahri',['3036','3115'],{'attack:target:bonusHp':750});near(y.profile().autoAttackDamage,(132.5+30)*1.075);
  delete y.state.combatValues['attack:target:bonusHp'];assert.equal(y.profile().autoAttackDamage,null);
});
test('Sundered Sky and Fiendhunter do not add two forced-crit physical bonuses',()=>{
  const x=model('Ahri',['6610','2512'],{'attack:sundered':true,'attack:sunderedInterval':10,'attack:fiendhunter':true}),p=x.profile();
  near(p.rows.find(r=>r.label.startsWith('Lightshield Strike')).value,0);
  near(p.rows.find(r=>r.label==='Opening Barrage physical bonus').value,100*.75*(2.3*.8-1));
  assert.ok(p.rows.find(r=>r.label==='Opening Barrage on Lightshield Strike').perSecond>0);
});
test('Viktor converts the full attack to magic without adding the normal physical attack twice',()=>{
  const x=model('Viktor',[],{'attack:siphon':true,'attack:siphonInterval':1}),p=x.profile();
  near(p.autoAttackDamage,132.5+(120+50+100-132.5)/2);
  assert.ok(p.rows.some(r=>r.type==='physical'&&r.value<0));
});
test('Urgot Purge replaces crit damage and reduces on-hit damage, not proc count',()=>{
  const x=model('Urgot',['3115'],{'attack:purge':true}),p=x.profile();
  near(p.rate,3);near(p.autoAttackDamage,12+100*.34+30*.5);near(p.attackDps,p.autoAttackDamage*3);
});
test('Camille Q2 converts its full attack and aligned Spellblade damage to true damage',()=>{
  const x=model('Camille',['3057'],{'attack:precision':true,'attack:precisionInterval':4,'attack:precisionSpellblade':true,'attack:spellblade':true,'attack:spellbladeInterval':4}),p=x.profile();
  near(p.rows.find(r=>r.label==='Precision Protocol Q2 true damage').value,180);
  near(p.rows.find(r=>r.label.includes('Spellblade (Precision')).value,50);
  near(p.rows.find(r=>r.spellbladeId===3057&&r.type==='physical').value,0);
});
test('Caitlyn Headshot includes IE crit scaling and brush increases its frequency',()=>{
  const x=model('Caitlyn'),p=x.profile();near(p.rows[0].value,132.5);near(p.rows[0].cadence,6);
  x.state.combatValues['attack:brush']=true;near(x.profile().rows[0].cadence,3);
});
test('Yunara passive magic damage uses the probability of a full critical strike',()=>{
  const x=model('Yunara'),p=x.profile();near(p.rows.find(r=>r.label==='Vow of the First Lands').value,100*2.3*.25*.2);
});
test('Fizz bleed refreshes instead of stacking the full bleed duration per attack',()=>{
  const x=model('Fizz'),p=x.profile();near(p.rows.find(r=>r.dot).perSecond,(90+25)/3);
});
test('Shojin amplifies champion damage but leaves the item on-hit unchanged',()=>{
  const x=model('Fizz',['3161','3115'],{'attack:shojinStacks':4}),p=x.profile();
  near(p.rows.find(r=>r.dot).perSecond,(90+25)/3*1.12);
  near(p.rows.find(r=>r.label==='Nashor’s Tooth').value,30);
});
test('Shojin does not amplify the subtraction of a replaced ordinary attack',()=>{
  const x=model('Viktor',['3161'],{'attack:siphon':true,'attack:siphonInterval':1,'attack:shojinStacks':4}),p=x.profile();
  near(p.rows.find(r=>r.replacementDebit).value,-132.5);
  near(p.rows.find(r=>r.label==='Siphon Power replacement').value,270*1.12);
});
test('Zeri right-click cannot crit or apply attack on-hit items',()=>{
  const x=model('Zeri',['3115'],{'attack:zeriRightClick':true}),p=x.profile();
  near(p.autoAttackDamage,28);assert.equal(p.rows.filter(r=>r.source==='item').length,0);
});
