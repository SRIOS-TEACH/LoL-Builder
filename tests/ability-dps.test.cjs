const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../JS/shared/targetDamage.js');
const dps=require('../JS/shared/abilityDps.js');
const resolve=values=>name=>Object.hasOwn(values,name)?{numeric:values[name],html:String(values[name])}:null;
const profile=(id,values,extra={})=>dps.profile({spell:{id},rank:1,cooldown:10,resolve:resolve(values),...extra});
test('damage / haste-adjusted cooldown, rank changes and unlearned or zero cooldown',()=>{
 const spell={id:'Test',cooldown:[10,8]};
 assert.equal(dps.cooldown(spell,1,{haste:100}),5);
 assert.equal(dps.cooldown(spell,2,{haste:100}),4);
 assert.equal(dps.cooldown(spell,0),null);
 assert.equal(dps.cooldown({cooldown:[0]},1),null);
 assert.equal(dps.cooldown({cooldown:[10]},1,{haste:100},{spellData:{mSpellTags:['Trait_NotBenefitFromHaste']}}),10);
 const result=profile('Test',{damage:120},{tooltip:'Deals <magicDamage>{{ damage }} magic damage</magicDamage>.'});
 assert.equal(result.rows[0].damage.value,120);assert.match(dps.render(result),/>12\.0<\/td>/);
});
test('Aatrox Q uses additive ramp, paired sweet spots and two static recast delays',()=>{
 const result=profile('AatroxQ',{QDamage:120,QEdgeDamage:210,QRampBonus:0.25},{cooldown:6});
 assert.deepEqual(result.rows.map(r=>r.damage.value),[120,150,180,450]);
 assert.deepEqual(result.rows.map(r=>r.sweet.value),[210,262.5,315,787.5]);
 assert.equal(result.rows[3].period,8);
 assert.match(dps.render(result),/56\.3 \(98\.4\)/);
 assert.equal(profile('AatroxQ',{QDamage:120,QEdgeDamage:210,QRampBonus:0.25},{cooldown:3}).rows[3].period,5);
});
test('missing ramp or damage never becomes a numeric combined total',()=>{
 for(const values of [{QDamage:120,QRampBonus:0.25},{QDamage:120,QEdgeDamage:210}]) {
   const result=profile('AatroxQ',values);
   assert.equal(result.rows[3].sweet.value,null);
   assert.doesNotMatch(dps.render(result),/NaN|Infinity|undefined/);
 }
});
test('Ziggs R orders outer damage first and centre damage in parentheses',()=>{
 const result=profile('ZiggsR',{BlastDamage:195,EmpoweredDamage:300},{cooldown:100});
 assert.match(dps.render(result),/195\.0 \(300\.0\)/);
 assert.match(dps.render(result),/2\.0 \(3\.0\)/);
});
test('Yasuo Q variants share damage and use attack speed rather than haste',()=>{
 const spell={id:'YasuoQ1Wrapper',cooldown:[4]};
 assert.equal(dps.cooldown(spell,1,{haste:100,bonusAttackSpeed:0}),4);
 assert.equal(dps.cooldown(spell,1,{haste:100,bonusAttackSpeed:0.5}),2.8);
 assert.ok(Math.abs(dps.cooldown(spell,1,{bonusAttackSpeed:2})-4/3)<0.0001);
 const rows=profile(spell.id,{TotalDamage:100}).rows;
 assert.equal(rows.length,3);assert.ok(rows.every(r=>r.damage.value===100));
});
test('cooldown that starts on first cast overlaps recast delays',()=>{
 assert.equal(dps.cycleTime(10,[1,1],'first'),10);
 assert.equal(dps.cycleTime(1,[1,1],'first'),2);
 assert.equal(dps.cycleTime(10,[1,1],'last'),12);
 assert.equal(dps.cycleTime(10,[null],'last'),null);
 const rows=profile('AhriR',{RCalculatedDamage:100,RMaxCasts:3,RDashCooldown:1}).rows;
 assert.equal(rows[1].damage.value,300);assert.equal(rows[1].period,10);
});
test('paired outgoing/return damage and reduced subsequent hits sum correctly',()=>{
 assert.equal(profile('AhriQ',{TotalDamage:100}).rows[2].damage.value,200);
 assert.equal(profile('AhriW',{SingleFireDamage:100,MultiFireDamage:30}).rows[1].damage.value,160);
 assert.equal(profile('CamilleQ',{BonusDamage:40,EmpoweredBonusDamage:80,QRampUpTime:1.5}).rows[2].period,11.5);
});
test('generic alternatives stay separate and percentages never become flat damage',()=>{
 const tooltip='<physicalDamage>{{ basic }} physical damage</physicalDamage> or <physicalDamage>{{ empowered }} physical damage</physicalDamage>; <magicDamage>{{ percent }}% max Health magic damage</magicDamage>; gain <physicalDamage>{{ ad }} Attack Damage</physicalDamage>';
 const result=profile('Test',{basic:100,empowered:150,percent:10,ad:50},{tooltip});
 assert.equal(result.rows.length,3);assert.equal(result.rows[0].damage.value,100);assert.equal(result.rows[1].damage.value,150);
 assert.equal(result.rows[2].damage.value,null);assert.match(dps.render(result),/max Health/);
});
test('unknown damage, missing cooldown, unlearned and utility spells are explicit',()=>{
 assert.equal(profile('Test',{}, {rank:0}).status,'Unlearned');
 assert.equal(profile('Test',{}, {tooltip:'Dash and gain a shield.'}).status,'No direct damage');
 assert.equal(profile('Test',{}, {tooltip:'Deals damage.'}).status,'Damage formula unavailable');
 const result=profile('Test',{}, {cooldown:null,tooltip:'<magicDamage>{{ unknown }} magic damage</magicDamage>'});
 assert.match(dps.render(result),/no repeat cooldown/);assert.doesNotMatch(dps.render(result),/NaN|Infinity|undefined/);
});
test('variable recast timing remains unknown until supplied and recalculates the total',()=>{
 const input={InitialDamage:100,RecastDamage:120,EmpoweredDamage:240};
 const unknown=profile('LeeSinQOne',input);
 assert.equal(unknown.rows[2].damage.value,220);assert.equal(unknown.rows[2].period,null);
 assert.match(dps.render(unknown),/Enter recast timing/);
 const result=profile('LeeSinQOne',input,{timing:{delay:2,overlap:false}});
 assert.equal(result.rows[2].period,12);assert.equal(result.rows[4].damage.value,340);
 assert.equal(profile('LeeSinQOne',input,{timing:{delay:2,overlap:true}}).rows[2].period,10);
 assert.equal(dps.timingFields('LeeSinQOne','q').length,2);
});
test('damage ranges resolve to separate numbers and unrelated typed mana is excluded',()=>{
 const result=profile('Test',{min:100,max:300,mana:40},{tooltip:'<magicDamage>{{ min }} to {{ max }} magic damage</magicDamage><magicDamage>{{ mana }} Mana</magicDamage>'});
 assert.deepEqual(result.rows.map(r=>r.damage.value),[100,300]);
 assert.equal(dps.components('<magicDamage>2.5 magic damage</magicDamage>',()=>null)[0].damage.value,2.5);
 assert.equal(dps.components('<magicDamage>{{ percent }} true damage</magicDamage>',()=>({numeric:20,isPercent:true,html:'20%'}))[0].damage.value,null);
});
test('Yone Q uses its own formula key, not Yasuo’s',()=>{
 const result=profile('YoneQ',{QDamage:170});assert.ok(result.rows.every(r=>r.damage.value===170));
});

const target={enabled:true,maxHp:2000,currentHp:500,armor:100,mr:300,damageReduction:20};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
test('Ahri Q preserves outgoing magic and return true portions in the combined total',()=>{
 const result=profile('AhriQ',{TotalDamage:100},{target});
 assert.deepEqual(result.rows.map(r=>r.damage.value),[20,100,120]);
 assert.equal(result.rows[2].damage.rawValue,200);
 assert.deepEqual(result.rows[2].damage.components.map(c=>c.type),['magic','true']);
 assert.match(dps.render(result),/title="[^"]*magic resistance/);
 assert.match(dps.render(result),/ignores armor/);
 assert.match(result.note,/after target mitigation/);
 assert.deepEqual(profile('AhriQ',{TotalDamage:100},{target:{...target,enabled:false}}).rows.map(r=>r.damage.value),[100,100,200]);
});
test('Lillia sweet spot and Yone ultimate mitigate each hybrid component independently',()=>{
 const lillia=profile('LilliaQ',{TotalDamage:100,BonusTrueDamage:100},{target}).rows[0];
 assert.equal(lillia.damage.value,20);assert.equal(lillia.sweet.value,120);
 assert.equal(lillia.sweet.rawValue,200);
 const yone=profile('YoneR',{TooltipDamage:100},{target}).rows[0];
 assert.equal(yone.damage.value,60);assert.equal(yone.damage.rawValue,200);
 assert.deepEqual(yone.damage.components.map(c=>c.type),['physical','magic']);
});
test('AP scaling remains physical when that is the damage type, including penetration',()=>{
 const result=dps.profile({spell:{id:'Test'},rank:1,cooldown:10,target,stats:{magicPenFlat:300,armorPenPct:50},
   tooltip:'Deals <physicalDamage>{{ damage }} physical damage</physicalDamage>.',resolve:()=>({numeric:150,html:'150 (50 + 100% AP)'})});
 near(result.rows[0].damage.value,80);
 assert.equal(result.rows[0].damage.components[0].type,'physical');
});
test('multi-part recasts and sweet spots receive mitigation once after composition',()=>{
 const aatrox=profile('AatroxQ',{QDamage:120,QEdgeDamage:210,QRampBonus:.25},{target,cooldown:6});
 assert.deepEqual(aatrox.rows.map(r=>r.damage.value),[48,60,72,180]);
 near(aatrox.rows[3].sweet.value,315);assert.equal(aatrox.rows[3].period,8);
 const sequence=profile('AkaliE',{E1Damage:100,E2DamageCalc:200},{target,timing:{delay:2,overlap:false}});
 assert.deepEqual(sequence.rows.map(r=>r.damage.value),[20,40,60]);assert.equal(sequence.rows[2].period,12);
 assert.ok(sequence.rows[2].damage.components.every(c=>c.type==='magic'));
});
test('percent target health, current health and mixed flat plus percent resolve before resistance',()=>{
 const tooltip='<magicDamage>{{ max }}% max Health magic damage</magicDamage>; <physicalDamage>{{ current }}% current Health physical damage</physicalDamage>; <trueDamage>{{ missing }}% of the target\'s missing Health true damage</trueDamage>; <magicDamage>{{ flat }} + {{ max }}% max Health magic damage</magicDamage>';
 const values={max:10,current:10,missing:10,flat:50};
 const rows=profile('Test',values,{tooltip,target}).rows;
 assert.deepEqual(rows.map(r=>r.damage.rawValue),[200,50,150,250]);
 assert.deepEqual(rows.map(r=>r.damage.value),[40,20,150,50]);
 assert.ok(profile('Test',values,{tooltip,target:{...target,enabled:false}}).rows.every(r=>r.damage.value===null));
 const percent=dps.profile({spell:{id:'Test'},rank:1,cooldown:5,target,
   tooltip:'<physicalDamage>{{ percent }} max Health physical damage</physicalDamage>',resolve:()=>({numeric:5,isPercent:true,html:'5%'})});
 assert.equal(percent.rows[0].damage.value,40);
 // A self-health ratio is not multiplied by the target's health.
 assert.equal(profile('Test',{max:10},{target,tooltip:'<magicDamage>{{ max }}% of your max Health magic damage</magicDamage>'}).rows[0].damage.value,null);
});
test('Camille and Gwen convert only their defined damage portion to true damage',()=>{
 const resolveCamille=percent=>name=>({BonusDamage:{numeric:40,html:'40'},EmpoweredBonusDamage:{numeric:80,html:'80'},
   QRampUpTime:{numeric:1.5,html:'1.5'},DamageConversionPercentage:{numeric:percent,isPercent:true,html:`${percent}%`}}[name]);
 const level1=dps.profile({spell:{id:'CamilleQ'},rank:1,cooldown:10,target,resolve:resolveCamille(40)});
 near(level1.rows[1].damage.value,51.2);near(level1.rows[2].damage.value,67.2);
 const level16=dps.profile({spell:{id:'CamilleQ'},rank:1,cooldown:10,target,resolve:resolveCamille(100)});
 assert.equal(level16.rows[1].damage.value,80);assert.equal(level16.rows[2].damage.value,96);
 const gwen=profile('GwenQ',{MiniSwipeDamage:20,FinalSwipeDamage:80,MaxDamage:180,TrueDamageConversion:.5},{target});
 assert.equal(gwen.rows[0].damage.value,20);assert.equal(gwen.rows[0].sweet.value,60);
 assert.equal(gwen.rows[1].damage.value,36);assert.equal(gwen.rows[1].sweet.value,108);
});
test('a missing damage-conversion formula is explicit rather than guessed physical',()=>{
 const result=profile('CamilleQ',{BonusDamage:40,EmpoweredBonusDamage:80,QRampUpTime:1.5},{target});
 assert.equal(result.rows[1].damage.value,null);assert.equal(result.rows[2].damage.value,null);
 assert.match(dps.render(result),/Unavailable \(damage type not identified\)/);
 assert.equal(result.rows[1].damage.rawValue,80);
});
test('Yorick Maiden Magic Attack Damage resolves as an actual magic damage outcome',()=>{
 const result=profile('YorickR',{yorickbigghouldamage:100},{target,
   tooltip:'The Maiden has <magicDamage>{{ yorickbigghouldamage }} Magic Attack Damage</magicDamage>.'});
 assert.equal(result.rows[0].damage.value,20);assert.equal(result.rows[0].damage.rawValue,100);
 assert.equal(result.rows[0].damage.components[0].type,'magic');
});
