const {test}=require('node:test'),assert=require('node:assert/strict');
const Pipeline=require('../JS/engine/calculationPipeline.js').default,Combo=require('../JS/engine/comboEvaluation.js').default;
const Amounts=require('../JS/shared/comboAmounts.js').default,Variants=require('../JS/shared/abilityVariants.js').default;
const Neutral=require('../JS/shared/neutralBuffs.js').default,fixtures=require('./mechanics-excerpts.json');
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<.001,`${a} != ${b}`);
function input(name,combatValues={},extra={}){return {build:{selectedChampion:name,level:18,abilityRanks:{q:5,w:5,e:5,r:3},combatValues,runeSelections:{primary:[],secondary:[],shards:[]},...extra},scenario:{target:{enabled:true,maxHp:2000,currentHp:1200,armor:0,mr:0,damageReduction:0}},data:fixtures[name]};}
const run=(...args)=>Pipeline.create(input(...args));
const catalog=(...args)=>Combo.actions(run(...args));
const step=(actionId,overrides={})=>({actionId,overrides});
test('Kai’Sa evolution doubles missiles, retaining reduced subsequent-hit damage',()=>{
 const base=catalog('Kaisa').find(a=>a.id==='q:0'),evolved=catalog('Kaisa',{'evolve:q':true}).find(a=>a.id==='q:0');
 assert.equal(base.maxHits,6);assert.equal(evolved.maxHits,12);
 const first=Amounts.apply(base,{hitCount:1}),two=Amounts.apply(base,{hitCount:2});
 near(two.damage,first.damage*1.25);near(base.damage,first.damage*2.25);near(evolved.damage,first.damage*3.75);
});
test('Viktor aftershock and Syndra true damage exist only with the relevant upgrade',()=>{
 const e=values=>catalog('Viktor',values).filter(a=>a.group==='e');
 assert.equal(e({}).length,1);assert.equal(e({'evolve:e':true}).length,2);assert.ok(e({'evolve:e':true})[1].damage>e({})[0].damage);
 const w=values=>catalog('Syndra',values).find(a=>a.id==='w:0');
 assert.ok(!w({}).components.some(p=>p.type==='true'));
 assert.ok(w({'evolve:w':true}).components.some(p=>p.type==='true'&&p.value>0));
});
test('Kha’Zix evolved isolation changes repeat cooldown without amplifying damage',()=>{
 const get=v=>run('Khazix',v).evaluateAbility(fixtures.Khazix.champion.spells[0],5,'q').damage.rows[1];
 const a=get({}),b=get({'evolve:q':true});near(a.damage.value,b.damage.value);near(b.period,a.period*.55);
});
for(const name of Object.keys(Variants.forms))test(name+' exposes both forms and a working combo form switch',()=>{
 const x=input(name),all=Combo.actions(Pipeline.create(x)),alt=all.find(a=>a.id==='form:q:0');
 assert.ok(alt,`${name} alternate Q missing`);assert.ok(Number.isFinite(alt.damage),`${name} alternate Q unresolved`);
 const bad=Combo.evaluate({...x,steps:[step(alt.id)]});assert.equal(bad.timeline[0].action.unavailable,true);
 const good=Combo.evaluate({...x,steps:[step('form:switch'),step(alt.id),step('form:switch'),step('q:0')]});
 assert.ok(!good.timeline[1].action.unavailable);assert.ok(!good.timeline[3].action.unavailable);near(good.timeline[1].damage,alt.damage);
 assert.deepEqual(x.build.combatValues,{});
 const untargeted={...x,scenario:{target:{enabled:false}}};
 assert.ok(!Combo.evaluate({...untargeted,steps:[step('form:switch'),step(alt.id)]}).timeline[1].action.unavailable);
});
for(const [name,id,max]of [['Kaisa','q:0',6],['Ahri','w:1',3],['Ahri','q:2',2],['Syndra','r:0',7],['MissFortune','r:0',18],['Katarina','r:0',15],['Lucian','r:0',22],['Kennen','r:0',6],['Velkoz','w:0',2],['Taliyah','q:0',5],['Gwen','q:1',6],['Aatrox','w:1',2]])test(name+' '+id+' defaults to all hits and supports partial hits',()=>{
 const entry=catalog(name).find(a=>a.id===id);assert.equal(entry.maxHits,max);assert.ok(Number.isFinite(entry.damage));
 near(Amounts.apply(entry,{}).damage,entry.damage);near(Amounts.apply(entry,{hitCount:0}).damage,0);
 assert.ok(Amounts.apply(entry,{hitCount:1}).damage<entry.damage);
 near(Amounts.apply(entry,{hitCount:999}).damage,entry.damage);
 near(Amounts.apply(entry,{hitCount:1,damage:123}).damage,123);
});
test('mixed damage hit selection preserves outgoing magic and returning true damage',()=>{
 const entry=catalog('Ahri').find(a=>a.id==='q:2');
 assert.ok(Amounts.apply(entry,{hitCount:1}).components.every(p=>p.type==='magic'));
 assert.ok(Amounts.apply(entry,{hitCount:2}).components.some(p=>p.type==='true'));
});
for(const [name,id,seconds]of [['Malzahar','e:0',4],['Cassiopeia','q:0',3],['Cassiopeia','w:0',5],['Teemo','r:0',4],['Rumble','q:0',3],['Rumble','r:0',4.5],['Nidalee','w:0',4]])test(name+' '+id+' burn duration defaults to maximum and scales only its burn',()=>{
 const entry=catalog(name).find(a=>a.id===id);assert.equal(entry.maxBurnDuration,seconds);assert.ok(Number.isFinite(entry.damage));
 near(Amounts.apply(entry,{burnDuration:seconds/2}).damage,entry.damage/2);
 near(Amounts.apply(entry,{burnDuration:0}).damage,0);near(Amounts.apply(entry,{burnDuration:99}).damage,entry.damage);
});
test('Shyvana enabled Q contributes a full proc while haste affects only its sustained cadence',()=>{
 const base=run('Shyvana').evaluateBuild(),active=run('Shyvana',{'attack:shyvanaQ':true}).evaluateBuild();
 const row=active.attack.rows.find(r=>r.label==='Shyvana Q replacement');assert.ok(row);assert.ok(row.interval>0);
 near(row.perHit,row.value);near(row.perSecond,row.value*Math.min(active.attack.rate,1/row.interval));
 assert.ok(!active.attack.controls.some(c=>c.key==='attack:shyvanaQInterval'));
 assert.notEqual(active.attack.autoAttackDamage,base.attack.autoAttackDamage);
});
test('Master Yi E remains an active per-hit stim without an uptime penalty',()=>{
 const active=run('MasterYi',{'attack:championOnHit':true}).evaluateBuild().attack;
 const row=active.rows.find(r=>r.sourceSlot==='e');assert.ok(row);assert.ok(!Object.hasOwn(row,'interval'));near(row.perSecond,row.perHit*active.rate);
});
test('map buffs are opt-in, dragon stacks start at zero, and blue scales with level',()=>{
 for(const level of [1,6,11,18]){
  const base=run('Ahri',{}, {level}).evaluateBuild().computed,buff=run('Ahri',{'neutral:blue':true},{level}).evaluateBuild().computed;
  near(buff.abilityHaste-base.abilityHaste,level>=11?20:level>=6?15:10);
 }
 const base=run('Ahri').evaluateBuild().computed,zero=run('Ahri',{'neutral:infernal':true}).evaluateBuild().computed;
 near(base.ad,zero.ad);near(base.ap,zero.ap);
 const two=run('Ahri',{'neutral:infernal':true,'neutral:infernal:stacks':2}).evaluateBuild().computed;near(two.ad,base.ad*1.06);
 const mountain=run('Ahri',{'neutral:mountain':true,'neutral:mountain:stacks':2}).evaluateBuild().computed;near(mountain.armor,base.armor*1.1);near(mountain.mr,base.mr*1.1);
});
test('red burn refreshes, and neutral buff calculations leave saved build inputs unchanged',()=>{
 const x=input('Ahri',{'neutral:red':true,'neutral:baron':true}),before=JSON.stringify(x.build),r=Pipeline.create(x),p=r.evaluateBuild().attack;
 const burn=p.rows.find(row=>row.label==='Red buff burn');assert.ok(burn&&burn.dot);near(burn.perSecond,burn.value*Math.min(1,p.rate*burn.duration));
 near(r.evaluateBuild().computed.ad,run('Ahri').evaluateBuild().computed.ad+12);
 assert.equal(JSON.stringify(x.build),before);
 for(const name of Object.keys(Neutral.dragons))assert.equal(Neutral.model({combatValues:{['neutral:'+name]:true}}).count(name),0);
});

test('Hextech, Chemtech, Ocean and Cloud bonuses are independent and bounded',()=>{
 const base=run('Ahri').evaluateBuild().computed;
 const hex=run('Ahri',{'neutral:hextech':true,'neutral:hextech:stacks':2}).evaluateBuild().computed;
 near(hex.abilityHaste-base.abilityHaste,10);near(hex.asTotal-base.asTotal,(base.base.attackspeedratio??base.base.attackspeed)*.1);
 const chem=run('Ahri',{'neutral:chemtech':true,'neutral:chemtech:stacks':2}).stats.getComputedChampionStatsForTooltips();near(chem.healShieldPower,.12);near(chem.tenacity,.12);
 const ocean=run('Ahri',{'neutral:ocean':true,'neutral:ocean:stacks':2,'self:healthPercent:0':.5}).evaluateBuild().computed;near(ocean.hp5-base.hp5,base.hp*.5*.04);
 const cloud=run('Ahri',{'neutral:cloud':true,'neutral:cloud:stacks':2,'neutral:outOfCombat':true}).evaluateBuild().computed;near(cloud.moveSpeed,base.moveSpeed*1.1);
 near(run('Ahri',{'neutral:cloud':true,'neutral:cloud:stacks':2}).evaluateBuild().computed.moveSpeed,base.moveSpeed);
 assert.equal(Neutral.model({combatValues:{'neutral:infernal':true,'neutral:infernal:stacks':99}}).count('infernal'),4);
});
test('blue regeneration and Elder burn use their source duration and game time',()=>{
 const base=run('Ahri').evaluateBuild().computed,blue=run('Ahri',{'neutral:blue':true}).evaluateBuild().computed;
 near(blue.mp5-base.mp5,5+base.mp*.01);
 const model=t=>Neutral.model({level:18,gameTimeMinutes:t,combatValues:{'neutral:elder':true}}).burns()[0];
 near(model(25).total,75);near(model(45).total,225);near(model(99).total,225);near(model(25).duration,3);
});
test('evolved Kai’Sa W refund affects its cooldown while hit damage stays unchanged',()=>{
 const a=run('Kaisa'),b=run('Kaisa',{'evolve:w':true}),spell=fixtures.Kaisa.champion.spells[1];
 const x=a.evaluateAbility(spell,5,'w'),y=b.evaluateAbility(spell,5,'w');near(y.cooldown,x.cooldown*.25);near(x.damage.rows[0].damage.value,y.damage.rows[0].damage.value);
});

test('Rek’Sai W changes form and unburrowing deals damage before returning to the normal kit',()=>{
 const x=input('RekSai'),result=Combo.evaluate({...x,steps:[step('w:0'),step('form:q:0'),step('form:w:0'),step('q:0')]});
 near(result.timeline[0].damage,0);assert.ok(result.timeline[2].damage>0);
 assert.ok(result.timeline.every(row=>!row.action.unavailable));
});
