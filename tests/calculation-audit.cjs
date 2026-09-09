const fs=require('fs'),path=require('path');
const C=require('../JS/shared/calculations.js');
const stats={ap:200,baseAp:0,totalAd:180,bonusAd:80,armor:100,bonusArmor:40,mr:80,bonusMr:30,hp:3000,bonusHp:1000,mp:2000,bonusMp:1000,haste:50,attackSpeed:1,bonusAttackSpeed:.3,moveSpeed:380,critChance:.25,critDamage:1.75,cooldownReduction:1/3,lifeSteal:.1,physicalVamp:0,omniVamp:0,magicPenFlat:0,lethality:0,tenacity:0,attackRange:125,healShieldPower:0};
const fixtures=path.resolve(process.env.FIXTURES_DIR || path.join(__dirname,'fixtures'));
const report={total:0,numeric:0,inputs:0,unsupported:0,reasons:{},examples:{},unresolved:[]};
function walk(x,file,source,record=''){if(!x||typeof x!=='object')return;
 for(const [key,value]of Object.entries(x)){
  if(key==='mSpellCalculations'||key==='mItemCalculations'){
   for(const [name,calc]of Object.entries(value)){
    const row=C.evaluate(calc,{rank:3,level:18,stats,dataValues:x.mDataValues||x.DataValues||[],effects:x.mEffectAmount||[],calculations:value,resolveExternal:(ref,key)=>{const spell=C.lookup(source,ref)?.mSpell;return C.dataValue(spell?.DataValues||spell?.mDataValues,key,3,18);},ranged:false,itemCounts:{0:0,1:0,2:0,3:0,4:0,5:0,6:0}});
    report.total++;report[row.unsupported.length?'unsupported':row.value===null?'inputs':'numeric']++;
    if(row.unsupported.length)report.unresolved.push({file,record,name,reasons:row.unsupported});
    for(const reason of row.unsupported){report.reasons[reason]=(report.reasons[reason]||0)+1;report.examples[reason]??={file,name,calc,dataValues:x.mDataValues||x.DataValues,effects:x.mEffectAmount};}
   }
  }else walk(value,file,source,record?record+'/'+key:key);
 }
}
for(const file of fs.readdirSync(fixtures).filter(f=>f.endsWith('.bin.json')||f==='cd-items.json')) {
 const source=JSON.parse(fs.readFileSync(path.join(fixtures,file)));walk(source,file,source);
}
if(!report.total)throw Error('No advanced fixtures found. Download with ADVANCED_DATA=1 first.');
console.log(JSON.stringify({...report,examples:undefined},null,2));
if(process.env.AUDIT_OUTPUT)fs.writeFileSync(process.env.AUDIT_OUTPUT,JSON.stringify(report,null,2));
