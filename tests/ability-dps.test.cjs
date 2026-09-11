const {test}=require('node:test');
const assert=require('node:assert/strict');
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
