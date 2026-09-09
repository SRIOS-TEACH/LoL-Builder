// Repeatable full-corpus check using the same inputs and context code as the UI.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../JS/shared/calculations');
const Inputs=require('../JS/shared/combatInputs');
const fixtures=process.env.FIXTURES_DIR||path.join(__dirname,'fixtures');
const base={rank:3,level:18,ranged:false,stats:{ap:200,baseAp:0,totalAd:180,bonusAd:80,armor:100,bonusArmor:40,mr:80,bonusMr:30,hp:3000,bonusHp:1000,mp:2000,bonusMp:1000,haste:50,attackSpeed:1,bonusAttackSpeed:.3,moveSpeed:380,baseMoveSpeed:345,critChance:.25,critDamage:1.75,bonusCritDamage:0,cooldownReduction:1/3,lifeSteal:.1,physicalVamp:0,omniVamp:0,magicPenFlat:0,lethality:0,tenacity:0,attackRange:125,baseAttackRange:125,bonusAttackRange:0,healShieldPower:0},itemCounts:{0:0,1:0,2:0,3:0,4:0,5:0,6:0}};
const summary={records:0,scenarios:0,numeric:0,inactive:0,needsInputs:[],sourceIssues:[]};
function walk(node,raw,file,record=''){
 if(!node||typeof node!=='object')return;
 for(const [key,value]of Object.entries(node)){
  if(key==='mSpellCalculations'||key==='mItemCalculations'){
   const source={label:record,calculations:value,dataValues:node.DataValues||node.mDataValues,effects:node.mEffectAmount};
   const context={...base,...source,resolveExternal:(ref,key)=>{const spell=C.lookup(raw,ref)?.mSpell;return C.dataValue(spell?.DataValues||spell?.mDataValues,key,3,18);}};
   const fields=Inputs.descriptors([source],context);
   summary.records+=Object.keys(value).length;
   // Both activation states and different health/stack values, without overriding results.
   for(const active of [false,true]){
    const values=Object.fromEntries(fields.map(f=>[f.key,f.boolean?active:f.percent?(active?.25:.9):f.kind==='buff'?(active?5:0):f.key.includes(':hp:')?2500:1]));
    const supplied=Inputs.apply(context,values);
    for(const [name,calc]of Object.entries(value)){
     const row=C.evaluate(calc,supplied);summary.scenarios++;
     if(row.unsupported.length)summary.sourceIssues.push({file,record,name,active,reasons:row.unsupported});
     else if(row.inactive)summary.inactive++;
     else if(row.value===null)summary.needsInputs.push({file,record,name,active,inputs:row.inputs});
     else {assert.ok(Number.isFinite(row.value));summary.numeric++;}
    }
   }
  }else walk(value,raw,file,record?record+'/'+key:key);
 }
}
for(const file of fs.readdirSync(fixtures).filter(f=>f.endsWith('.bin.json')||f==='cd-items.json')){const raw=JSON.parse(fs.readFileSync(path.join(fixtures,file)));walk(raw,raw,file);}
assert.ok(summary.records>0,'Advanced fixtures required');
console.log(JSON.stringify(summary,null,2));
assert.deepEqual(summary.needsInputs,[],'Some required inputs have no UI control');
const knownSourceIssues=new Map([
 ['Items/773085/ChampRange','circular calculation'],
 ['Characters/KSante/Spells/KSanteRAbility/KSanteRMissile1/mSpell/TotalDamage','effect:1'],
 ['Characters/KSante/Spells/KSanteQAbility/KSanteQ3Missile/mSpell/TotalDamage','effect:1'],
]);
for(const issue of summary.sourceIssues)assert.deepEqual(issue.reasons,[knownSourceIssues.get(`${issue.record}/${issue.name}`)],'New source problem requires review');
if(process.env.AUDIT_OUTPUT)fs.writeFileSync(process.env.AUDIT_OUTPUT,JSON.stringify(summary,null,2));
