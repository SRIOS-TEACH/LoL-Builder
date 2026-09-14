const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../JS/shared/targetDamage.js');
const DamageText=require('../JS/shared/damageText.js');

const target={enabled:true,maxHp:2000,currentHp:500,armor:100,mr:300,damageReduction:20};
const resolve=values=>key=>typeof values[key]==='number'?{numeric:values[key],html:String(values[key])}:values[key]||null;
const render=(template,values={},extra={},syntax='ability')=>DamageText.render(template,resolve(values),{target,...extra},syntax);
const packets=html=>[...html.matchAll(/<span class="target-damage-number"[^>]*data-raw-damage="([^"]+)"[^>]*data-damage-type="([^"]+)"[^>]*>([^<]+)<\/span>/g)]
  .map(([,raw,type,value])=>({raw:Number(raw),type,value:Number(value.replace(/,/g,''))}));

test('typed physical damage uses armor even when its formula scales with AP',()=>{
 const html=render('<physicalDamage>{{ hit }} physical damage</physicalDamage>',{
   hit:{numeric:150,html:'150 (50 + 100% AP)'},
 },{stats:{magicPenFlat:300,armorPenPct:50}});
 assert.deepEqual(packets(html),[{raw:150,type:'physical',value:80}]);
 assert.match(html,/50 \+ 100% AP/);assert.match(html,/effective armor/);
});

test('the same Ahri token keeps different types in outgoing and return text',()=>{
 const html=render('Deals <magicDamage>{{ totaldamage }} magic damage</magicDamage> out and <trueDamage>{{ totaldamage }} true damage</trueDamage> back.',{totaldamage:100});
 assert.deepEqual(packets(html),[{raw:100,type:'magic',value:20},{raw:100,type:'true',value:100}]);
 assert.match(html,/ignores armor, magic resistance and generic damage reduction/);
});

test('physical stat buffs and amplification percentages are not damage packets',()=>{
 const html=render('Gain <physicalDamage>{{ ad }} Attack Damage</physicalDamage> and <magicDamage>{{ ap }} Ability Power</magicDamage>; <physicalDamage>{{ reduction }}% damage reduction</physicalDamage>.',
   {ad:50,ap:80,reduction:10});
 assert.equal(packets(html).length,0);
 assert.match(html,/50 Attack Damage/);assert.match(html,/80 Ability Power/);assert.match(html,/10% damage reduction/);
});

test('healing, shields, cooldowns and scaling ratios keep their ordinary values',()=>{
 const html=render('<healing>{{ heal }} Health</healing>; <shield>{{ shield }} Shield</shield>; cooldown {{ cd }} seconds; <magicDamage>{{ ratio }}% AP</magicDamage>.',
   {heal:100,shield:250,cd:12,ratio:60});
 assert.equal(packets(html).length,0);
 assert.match(html,/100 Health/);assert.match(html,/250 Shield/);assert.match(html,/cooldown 12 seconds/);assert.match(html,/60% AP/);
});

test('flat plus percent max HP damage mitigates both terms and retains the coefficient',()=>{
 const html=render('<magicDamage>{{ flat }} + {{ percent }}% max Health magic damage</magicDamage>',{flat:50,percent:10});
 assert.deepEqual(packets(html),[{raw:50,type:'magic',value:10},{raw:200,type:'magic',value:40}]);
 assert.match(html,/10% \(/);assert.match(html,/10% × 2,000 target max HP/);
});

test('current and missing HP percentages use the configured target health',()=>{
 const html=render('<physicalDamage>{{ current }}% current Health physical damage</physicalDamage> and <trueDamage>{{ missing }}% of the target\'s missing Health true damage</trueDamage>',{current:10,missing:10});
 assert.deepEqual(packets(html),[{raw:50,type:'physical',value:20},{raw:150,type:'true',value:150}]);
 const percentage=render('<magicDamage>{{ coefficient }} max Health magic damage</magicDamage>',{coefficient:{numeric:5,isPercent:true,html:'5%'}});
 assert.deepEqual(packets(percentage),[{raw:100,type:'magic',value:20}]);
 assert.doesNotMatch(percentage,/5%%/);
});

test('self-health percentages remain coefficients rather than target health damage',()=>{
 const html=render('<magicDamage>{{ percent }}% of your max Health magic damage</magicDamage>',{percent:10});
 assert.equal(packets(html).length,0);assert.match(html,/10% of your max Health/);
});

test('standalone literal damage uses its explicit type',()=>{
 const html=render('<physicalDamage>100 physical damage</physicalDamage>, <magicDamage>100 magic damage</magicDamage>, <trueDamage>100 true damage</trueDamage>');
 assert.deepEqual(packets(html),[{raw:100,type:'physical',value:40},{raw:100,type:'magic',value:20},{raw:100,type:'true',value:100}]);
});

test('item @tokens@ share typed mitigation while ordinary stats stay intact',()=>{
 const html=render('Grants @AD@ Attack Damage. <magicDamage>@Damage@ magic damage</magicDamage>; <physicalDamage>@Percent@% current Health physical damage</physicalDamage>.',
   {AD:45,Damage:200,Percent:10},{},'item');
 assert.match(html,/Grants 45 Attack Damage/);
 assert.deepEqual(packets(html),[{raw:200,type:'magic',value:40},{raw:50,type:'physical',value:20}]);
 assert.doesNotMatch(html,/@Damage@|@Percent@/);
});

test('100% reduction leaves true damage intact and zeroes other types',()=>{
 const html=render('<physicalDamage>{{ hit }} damage</physicalDamage><magicDamage>{{ hit }} damage</magicDamage><trueDamage>{{ hit }} damage</trueDamage>',
   {hit:100},{target:{...target,damageReduction:100}});
 assert.deepEqual(packets(html).map(p=>p.value),[0,0,100]);
});

test('negative resistances amplify only their matching typed damage',()=>{
 const html=render('<physicalDamage>{{ hit }} damage</physicalDamage><magicDamage>{{ hit }} damage</magicDamage>',{hit:100},
   {target:{...target,armor:-100,mr:-50,damageReduction:0}});
 assert.deepEqual(packets(html).map(p=>p.value),[150,133.33]);
});

test('disabled target mode preserves ordinary numeric descriptions',()=>{
 const html=render('<physicalDamage>{{ hit }} physical damage</physicalDamage>; <magicDamage>{{ percent }}% max Health magic damage</magicDamage>; <trueDamage>100 true damage</trueDamage>',
   {hit:100,percent:10},{target:{...target,enabled:false}});
 assert.equal(html,'<physicalDamage>100 physical damage</physicalDamage>; <magicDamage>10% max Health magic damage</magicDamage>; <trueDamage>100 true damage</trueDamage>');
 assert.equal(packets(html).length,0);
});

test('literal flat damage alongside a formula is mitigated too',()=>{
 const html=render('<magicDamage>15 + {{ bonus }} magic damage</magicDamage>',{bonus:100});
 assert.deepEqual(packets(html),[{raw:15,type:'magic',value:3},{raw:100,type:'magic',value:20}]);
});

test('Yorick Maiden Magic Attack Damage describes damage rather than an AD stat buff',()=>{
 const html=render('<magicDamage>{{ yorickbigghouldamage }} Magic Attack Damage</magicDamage>',{yorickbigghouldamage:100});
 assert.deepEqual(packets(html),[{raw:100,type:'magic',value:20}]);
});
