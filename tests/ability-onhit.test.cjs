const {test}=require('node:test');
const assert=require('node:assert/strict');const TargetDamage=require('../JS/shared/targetDamage.js').default;const Calculations=require('../JS/shared/calculations.js').default;const BuildStats=require('../JS/shared/buildStats.js').default;const AttackEffects=require('../JS/shared/attackEffects.js').default;
const dps=require('../JS/shared/abilityDps.js').default;
const onhit=require('../JS/shared/abilityOnHit.js').default;
const fixtures=require('./attack-excerpts.json');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const stats=()=>({base:{attackdamage:100,attackdamageperlevel:0,attackspeed:1,attackspeedratio:1,attackspeedperlevel:0,attackrange:550,hp:1000,hpperlevel:0,mp:500,mpperlevel:0,armor:30,armorperlevel:0,crit:0,critperlevel:0},item:{critChance:25,critDamage:30,asPct:0},rune:{critChance:0,critDamage:0,asPct:0},level:18,ad:200,ap:100,hp:1000,mp:500,armor:30,mr:30,asTotal:2,critChance:25,critDamage:230,attackRange:550,championBonuses:{}});
function attack(ids=['3115','3057'],values={'attack:spellblade':true},extra={}){
 return AttackEffects.model({selectedChampion:'Ezreal',level:18,itemSlots:ids,abilityRanks:{q:5,w:5,e:5,r:3},combatValues:values,...extra},fixtures.items).profile(stats());
}
const physical=key=>`<physicalDamage>{{ ${key} }} physical damage</physicalDamage>`;
function profile(id='EzrealQ',extra={}){
 const options={spell:{id},rank:1,slot:'q',cooldown:5,tooltip:physical('damage'),resolve:()=>({numeric:200,html:'200'}),...extra};
 return onhit.apply(dps.profile(options),{...options,attack:extra.attack||attack()});
}
test('Ezreal Q adds full typed on-hit and enabled Spellblade without basic attack or attack crits',()=>{
 const row=profile().rows[0];near(row.damage.value,330);
 assert.deepEqual(row.damage.components.map(c=>c.type),['physical','magic','physical']);
 assert.match(row.damage.breakdownText,/100.00 physical.*Spellblade/);
 near(profile('EzrealQ',{attack:attack(['3115','3057'],{})}).rows[0].damage.value,230);
 near(profile('EzrealQ',{attack:attack(['3115','3057'],{'attack:spellblade':true},{disabledItemPassives:{'3057:spellblade':true}})}).rows[0].damage.value,230);
});
test('ability physical and item magic damage receive separate target mitigation once',()=>{
 const target={enabled:true,maxHp:2000,currentHp:1000,armor:100,mr:300,damageReduction:0};
 const row=profile('EzrealQ',{target,attack:attack(undefined,undefined,{target})}).rows[0];
 near(row.damage.value,157.5);near(row.damage.rawValue,330);
});

test('outgoing amplification already present in attack packets is not applied twice',()=>{
 const target={enabled:true,maxHp:2000,currentHp:500,armor:100,mr:100,damageReduction:0};
 const effects=[{label:'Amplified magic on-hit',rawValue:120,type:'magic',source:'item'}];
 const row=profile('EzrealQ',{target,stats:{magicDamageMultiplier:1.2},attack:{rows:effects}}).rows[0];
 near(row.damage.value,160); // 200 physical / 2 + already-amplified 120 magic / 2.
});
test('short cooldown DPS respects Spellblade interval while damage shows the full ready proc',()=>{
 const row=profile('EzrealQ',{cooldown:1}).rows[0];
 near(row.damage.value,330);near(row.dpsAmount.value,230+100/1.5);
});
test('Smolder primary physical and Dragon Practice magic damage combine before adding on-hit once',()=>{
 const tooltip=physical('damage')+' + <magicDamage>{{ stacks }} magic damage</magicDamage>; <trueDamage>{{ burn }} true damage</trueDamage>';
 const result=profile('SmolderQ',{tooltip,resolve:key=>({numeric:{damage:200,stacks:40,burn:20}[key],html:key})});
 assert.equal(result.rows.length,2);near(result.rows[0].damage.value,370);near(result.rows[1].damage.value,20);
 assert.equal(result.rows[0].label,'Primary hit + on-hit');
});
test('Rageblade attack cadence is not an extra on-hit application for a spell',()=>{
 const row=profile('EzrealQ',{attack:attack(['3115','3124'],{'attack:rageStacks':4})}).rows[0];
 near(row.damage.value,260);
});
test('own spell on-hit rows, attack-only damage and poison DPS are excluded',()=>{
 const effects=[
  {label:'Own Q',rawValue:200,type:'physical',source:'champion',sourceSlot:'q'},
  {label:'Passive',rawValue:12,type:'magic',source:'champion',sourceSlot:'p'},
  {label:'Attack only',rawValue:500,type:'physical',onHit:false},
  {label:'Refreshed poison',rawValue:90,type:'magic',dot:true},
 ];
 near(profile('EzrealQ',{attack:{rows:effects}}).rows[0].damage.value,212);
});
test('unknown target health on-hit remains unavailable and unrelated spells receive no proc',()=>{
 assert.equal(profile('EzrealQ',{attack:attack(['3153'],{})}).rows[0].damage.value,null);
 near(profile('AhriW').rows[0].damage.value,200);
});
test('Dusk and Dawn adds one extra on-hit application without recursively duplicating itself',()=>{
 const effects=[{label:'Nashor',rawValue:30,type:'magic'},
  {label:'Spellblade',rawValue:100,type:'magic',spellbladeId:2510,extraHit:true,interval:1.5}];
 near(profile('EzrealQ',{attack:{rows:effects}}).rows[0].damage.value,360);
});
test('Alpha Strike scales repeated on-hits from source data and consumes Spellblade once',()=>{
 const payload={dataValues:[['BaseOnHitMultiplier',.75],['SubsequentHitMultiplier',.25],['AlphaStrikeBounces',4]].map(([name,value])=>({name,values:[value,value]}))};
 const tooltip=['damage','sub','total'].map(physical).join(';');
 const result=profile('AlphaStrike',{payload,tooltip,resolve:key=>({numeric:{damage:200,sub:50,total:350}[key],html:key})});
 near(result.rows[0].damage.value,200+30*.75+100*.75);
 near(result.rows[1].damage.value,50+30*.75*.25);
 near(result.rows[2].damage.value,350+30*.75*1.75+100*.75);
});
test('spell amplification applies to champion damage and never to appended item packets',()=>{
 const row=profile('EzrealQ',{stats:{abilityDamageMultiplier:1.12}}).rows[0];
 near(row.damage.value,224+30+100);
});
