// Rebuild small, offline regression records from the downloaded audit fixtures.
const fs=require('node:fs'),path=require('node:path');
const Source=require('../JS/data/championSource.js').default,Stats=require('../JS/shared/buildStats.js').default;
const root=path.resolve(__dirname,'..'),directory=path.join(root,'tests/fixtures');
const read=name=>JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
const strings=read('lol.stringtable.json').entries;
const names='Kaisa Khazix Viktor Syndra Jayce Nidalee Elise Gnar RekSai Shyvana MasterYi Ahri Garen MissFortune Katarina Lucian Malzahar Cassiopeia Teemo Rumble Kennen Velkoz Taliyah Yuumi Xerath Gwen Aatrox'.split(' ');
const clean=p=>p?{dataValues:p.dataValues,effects:p.effects,calculations:p.calculations,spellData:Object.fromEntries(Object.entries(p.spellData||{}).filter(([k])=>['mCastTime','spellCastTime','mChannelDuration','cooldownTime','mSpellTags','mClientData'].includes(k)))}:null;
const result={};
for(const name of names){
 const champion=read(name+'.json').data[name],raw=read(name+'.bin.json'),prepared=Source.prepareChampion(champion,raw,name,Stats);
 const abilities=Object.fromEntries(['p','q','w','e','r'].map(slot=>[slot,clean(prepared.abilities[slot])]));
 abilities.byAlias=Object.fromEntries(Object.entries(prepared.abilities.byAlias).filter(([key])=>!key.startsWith('characters')).map(([key,v])=>[key,{payload:clean(v.payload)}]));
 const locKeys=new Set(Object.values(prepared.abilities.byAlias).flatMap(v=>Object.values(v.payload?.spellData?.mClientData?.mTooltipData?.mLocKeys||{})).map(k=>String(k).toLowerCase()));
 const championRaw=Object.fromEntries(Object.entries(raw).filter(([,r])=>r.__type==='CharacterRecord'||r.mSpell).map(([key,r])=>[key,r.mSpell?{mScriptName:r.mScriptName,mSpell:clean(Source.extractCdragonSpell(r)).spellData}:r]));
 result[name]={champion:prepared.champion,abilities,championRaw,strings:Object.fromEntries(Object.entries(strings).filter(([k])=>k.includes(name.toLowerCase())||locKeys.has(k)))};
}
fs.writeFileSync(path.join(root,'tests/mechanics-excerpts.json'),JSON.stringify(result));
console.log('Wrote regression excerpts for '+names.length+' champions.');
