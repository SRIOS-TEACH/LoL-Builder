const ChampionSource=require('../JS/data/championSource.js').default;
const RecordValues=require('../JS/core/records.js').default;
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pipeline,combo,items,builds}=require('./helpers/calculation-runtime.cjs');
const freeze=RecordValues.deepFreeze;
const base={hp:600,hpperlevel:100,hpregen:5,hpregenperlevel:1,mp:300,mpperlevel:40,mpregen:7,mpregenperlevel:.5,
 attackdamage:60,attackdamageperlevel:3,armor:30,armorperlevel:4,spellblock:30,spellblockperlevel:1,
 attackspeed:.7,attackspeedratio:.7,attackspeedperlevel:3,attackrange:550,movespeed:330,crit:0,critperlevel:0,critdamage:2};
const spell={id:'TestQ',name:'Test',effect:[null,[10,20,30,40,50]],vars:[],cooldown:[10,9,8,7,6],costBurn:'0',description:'',tooltip:'<magicDamage>{{ Damage }}</magicDamage>'};
const datum=(name,value)=>({mName:name,mValues:Array(7).fill(value)});
const payload={dataValues:[datum('Damage',120.123456789)],calculations:{},spellData:{mSpellTags:['Trait_DamageAbility']}};
function input(extra={}){
 const build=builds.readBuildInputs({selectedChampion:'Test',level:18,abilityRanks:{q:5,w:5,e:5,r:3},runeSelections:{primary:[],secondary:[],shards:[]},...extra});
 return {build,scenario:{target:{enabled:true,maxHp:2000,currentHp:1500,armor:100,mr:100,damageReduction:0},gameTimeMinutes:20},
  data:{champion:{stats:base,tags:['Mage'],spells:[spell]},abilities:{q:payload},items:{},advancedItems:{},runes:{}}};
}
test('calculation and combo capabilities load without page APIs or Builder',()=>{
 assert.equal(typeof window,'undefined');assert.equal(typeof document,'undefined');assert.equal(typeof BUILDER,'undefined');
 const run=pipeline.create(input());assert.equal(run.stats.computeDerivedBuildStats().ad,111);
 assert.equal(run.resolution.resolveAbilityToken('damage',run.resolution.buildAbilityContext(spell,5,'q')).numeric,120.123456789);
});
test('A/B/A evaluation isolates build counters, source records, scenario and returned input snapshots',()=>{
 const a=freeze(input()),b=freeze(input({level:1}));const before=JSON.stringify([a,b]);
 const evaluate=x=>{const run=pipeline.create(x);return {stats:run.stats.computeDerivedBuildStats(),ability:run.evaluateAbility(spell,5,'q').damage};};
 const first=evaluate(a);assert.notEqual(evaluate(b).stats.ad,first.stats.ad);assert.deepEqual(evaluate(a),first);
 assert.equal(JSON.stringify([a,b]),before);
 const snapshot=pipeline.create(a);snapshot.state.combatValues.temporary=true;assert.equal(a.build.combatValues.temporary,undefined);
});
test('qualified aliases, canonical names, sentinel ranks and multipliers share the resolver',()=>{
 const x=input();const child={...payload,dataValues:[{mName:'Child_Value',mValues:[0,7,14,21,28,35,42]}]};
 x.data.abilities.byAlias={alternateform:{payload:child,metadata:{form:'alternate'}}};
 const run=pipeline.create(x),ctx=run.resolution.buildAbilityContext(spell,3,'q');
 assert.equal(run.resolution.resolveAbilityToken('spell.Alternate_Form:childvalue*2',ctx).numeric,42);
 assert.equal(run.resolution.resolveAbilityToken('Effect1Amount',ctx).numeric,30);
 assert.equal(run.resolution.resolveAbilityToken('damage_tooltip',ctx).numeric,120.123456789);
});
test('localization expands nested standard-mode keys and preserves unresolved dynamic keys',()=>{
 const x=input();x.data.strings={spell_test_tooltip_1:'<magicDamage>@Damage@</magicDamage> {{title}}',title:'Test'};
 const run=pipeline.create(x);
 assert.equal(run.resolution.expandAbilityLocalization('{{Spell_Test_Tooltip_{{gamemodeinteger}}}}'),'<magicDamage>{{ Damage }}</magicDamage> Test');
 assert.match(run.resolution.expandAbilityLocalization('{{unknown}}'),/unknown/);
 assert.equal(run.resolution.resolveAbilityToken('unknown',run.resolution.buildAbilityContext(spell,1,'q')).status,'unsupported');
});
test('full precision, omitted text, unknown tokens and unsupported formulas remain distinguishable',()=>{
 const x=input();x.data.abilities.q={...payload,calculations:{Broken:{__type:'GameCalculation',mFormulaParts:[{__type:'UnknownPart'}]}}};
 const run=pipeline.create(x),ctx=run.resolution.buildAbilityContext(spell,1,'q');
 const ready=run.resolution.resolveAbilityToken('damage',ctx);assert.equal(ready.numeric,120.123456789);assert.equal(ready.status,'ready');assert.equal(ready.html,undefined);
 assert.equal(run.resolution.resolveAbilityToken('gamemodeinteger',ctx).status,'omitted');
 const unsupported=run.resolution.resolveAbilityToken('broken',ctx);assert.equal(unsupported.numeric,null);assert.equal(unsupported.status,'unsupported');assert.ok(unsupported.diagnostics.length);
 const partial=run.evaluateAbility({...spell,tooltip:'{{Damage}} {{Broken}}'},1,'q');assert.equal(partial.status,'partial');
});
test('missing advanced payload retains Data Dragon effects and explicit missing results',()=>{
 const x=input();x.data.abilities=null;x.data.advancedItems={};const run=pipeline.create(x),ctx=run.resolution.buildAbilityContext(spell,2,'q');
 assert.equal(run.resolution.resolveAbilityToken('e1',ctx).numeric,20);
 assert.equal(run.resolution.resolveAbilityToken('damage',ctx).numeric,null);
 assert.ok(Number.isFinite(run.stats.computeDerivedBuildStats().hp));
});
test('item outcomes share context without presentation and preserve ready versus unavailable values',()=>{
 const args={id:'1',item:{description:'<active>Blast</active><br><magicDamage>@Damage@ magic damage</magicDamage>'},source:{mDataValues:[{mName:'Damage',mValue:123.456789}]},context:{target:{enabled:false}}};
 const outcome=items.evaluate(freeze(args));assert.equal(outcome.sections[0].damageOptions[0].value,123.456789);
 assert.equal(items.resolve(items.prepare(args),'damage').html,undefined);
 assert.equal(items.resolve(items.prepare(args),'unknown').status,'unsupported');
 assert.equal(items.evaluate({...args,source:null}).status,'unsupported');
});
test('combo health state is per run, changes health-dependent damage and never mutates inputs or step overrides',()=>{
 const x=input();x.data.abilities.q={...payload,calculations:{Damage:{__type:'GameCalculation',mFormulaParts:[{__type:'StatByCoefficientCalculationPart',mStat:13,mStatFormula:0,mCoefficient:0.1,'{a8cb9c14}':true}]}}};
 const catalog=combo.actions(pipeline.create(x));const action=catalog.find(row=>row.group==='q');
 const steps=freeze([{actionId:action.id,snapshot:action,overrides:{}},{actionId:action.id,snapshot:action,overrides:{damage:300}},{actionId:action.id,snapshot:action,overrides:{}}]);
 const before=JSON.stringify([x,steps]),result=combo.evaluate({...x,steps});
 assert.equal(result.timeline[1].hpBefore,result.timeline[0].hpAfter);assert.equal(result.timeline[2].hpBefore,result.timeline[1].hpAfter);
 assert.equal(result.timeline[1].damage,300);assert.ok(result.timeline[2].damage < result.timeline[0].damage);assert.equal(JSON.stringify([x,steps]),before);
 assert.deepEqual(combo.evaluate({...x,steps}),result);
 const b={...input({level:1}),steps};combo.evaluate(b);assert.deepEqual(combo.evaluate({...x,steps}),result);
});

test('source roots take precedence over richer children; missing roots select the scored child and aliases retain first collision',()=>{
 const source=ChampionSource;
 const root='Characters/Test/CharacterRecords/Root',ability='Characters/Test/Spells/TestQAbility';
 const child1='Characters/Test/Spells/RootSpell',child2='Characters/Test/Spells/AlternateForm';
 const raw={[root]:{mAbilities:[ability]},[ability]:{mRootSpell:child1,mChildSpells:[child2],mScriptName:'TestQ'},
  [child1]:{mScriptName:'RootSpell',mSpell:{mDataValues:[datum('Damage',7)]}},
  [child2]:{mScriptName:'AlternateForm',mSpell:{mDataValues:[datum('Damage',42),datum('Extra',3)]}}};
 const before=JSON.stringify(raw),first=source.extractAbilityDataFromRoot(raw,'Test','test',[spell]);
 assert.equal(first.q.dataValues[0].mValues[1],7);
 const withoutRoot={...raw,[ability]:{...raw[ability],mRootSpell:'missing'}};
 const fallback=source.extractAbilityDataFromRoot(withoutRoot,'Test','test',[spell]);
 assert.equal(fallback.q.dataValues[0].mValues[1],42);
 const aliases={};source.registerSpellPayloadAliases(aliases,first.q,{form:'base'},['Same']);source.registerSpellPayloadAliases(aliases,fallback.q,{form:'other'},['Same']);
 assert.equal(aliases.same.payload,first.q);assert.equal(JSON.stringify(raw),before);
});

test('presentation annotations cannot replace authoritative numeric token or combo results',()=>{
 const x=input(),run=pipeline.create(x),plain=run.evaluateAbility(spell,5,'q');
 const presented=run.evaluateAbility(spell,5,'q',{presentToken:()=>({numeric:0,html:'Formatted explanation'})});
 assert.equal(presented.damage.rows[0].damage.value,plain.damage.rows[0].damage.value);
 assert.equal(presented.tokens[0].numeric,120.123456789);assert.equal(presented.tokens[0].html,undefined);
 const action=combo.actions(run).find(row=>row.group==='q'),steps=[{actionId:action.id,snapshot:action,overrides:{}}];
 const a=combo.evaluate({...x,steps}),b=combo.evaluate({...x,steps,presentation:{presentToken:()=>({numeric:0,html:'Formatted explanation'})}});
 assert.equal(b.total,a.total);assert.equal(b.duration,a.duration);
});
