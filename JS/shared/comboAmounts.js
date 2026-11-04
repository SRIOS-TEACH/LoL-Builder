import Calculations from './calculations.js';
const finite=Number.isFinite,clamp=(n,max,integer=false)=>Math.min(max,Math.max(0,integer?Math.floor(n):n));
const burns={MalzaharE:'Duration',CassiopeiaQ:'PoisonDuration',CassiopeiaW:'CloudDuration',TeemoR:'DebuffDuration',Bushwhack:'DotDuration',RumbleFlameThrower:'FlamespitterDuration',RumbleCarpetBomb:'TrailDuration',MissFortuneScattershot:'BaseDuration',RenektonReignOfTheTyrant:'BuffDuration'};
const repeated={MissFortuneBulletTime:['BaseWaves'],LucianR:['NumShots'],KatarinaR:['TicksPerSecond','Duration'],KennenShurikenStorm:['KennenRDuration','KennenRTickRate','divide']};
const scale=(packets,n)=>packets.map(p=>({...p,value:finite(p.value)?p.value*n:null}));
function describe({spell,row,profile,context,rank,resolve}){
 const read=key=>Calculations.dataValue(context.cdragonSpell?.dataValues||[],key,rank).value;
 const result={};
 if(row.hitPackets){result.hitPackets=row.hitPackets.map(p=>p.components);result.maxHits=result.hitPackets.length;}
 else if(repeated[spell.id]){
  const [first,second,op]=repeated[spell.id],count=read(first)*(second?(op==='divide'?1/read(second):read(second)):1);
  if(finite(count)&&count>1&&count<=100){
   result.maxHits=Math.round(count);
   // Named channel bindings describe full-channel damage, not one missile.
   result.hitPackets=Array.from({length:result.maxHits},()=>scale(row.damage.components,1/result.maxHits));
  }
 }
 const duration=burns[spell.id]?read(burns[spell.id]):row.burnDuration??row.onHitTiming?.dotDuration;
 if(finite(duration)&&duration>0&&!row.onHitTiming?.duration){result.maxBurnDuration=duration;result.burnPackets=row.damage.components;}
 if(result.maxHits)result.hitCount=result.maxHits;
 if(result.maxBurnDuration)result.burnDuration=result.maxBurnDuration;
 return result;
}
function apply(entry,overrides={}){
 const action={...entry,...overrides};
 let packets=null;
 if(entry.maxHits&&entry.hitPackets){
  action.hitCount=clamp(finite(overrides.hitCount)?overrides.hitCount:entry.maxHits,entry.maxHits,true);
  packets=entry.hitPackets.slice(0,action.hitCount).flat();
 }
 if(entry.maxBurnDuration&&entry.burnPackets){
  action.burnDuration=clamp(finite(overrides.burnDuration)?overrides.burnDuration:entry.maxBurnDuration,entry.maxBurnDuration);
  packets=scale(entry.burnPackets,action.burnDuration/entry.maxBurnDuration);
 }
 if(packets&&!Object.hasOwn(overrides,'damage')){
  action.components=packets;
  action.damage=packets.every(p=>finite(p.value))?packets.reduce((s,p)=>s+p.value,0):null;
 }
 return action;
}
export default {describe,apply,burns,repeated};
