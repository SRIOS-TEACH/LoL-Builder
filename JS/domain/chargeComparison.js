/** Per-charge comparison. Ammo refills sequentially; recasts share one cooldown. */
export function chargeOutcomes({max,parts,cooldown,castTime,interval=0,mode='ammo'}){
 if(!Number.isInteger(max)||max<2||max>20)return null;
 return Array.from({length:max},(_,i)=>{
  const count=i+1,execution=Number.isFinite(castTime)&&castTime>=0?castTime+(count-1)*Math.max(castTime,interval):null;
  const cycle=Number.isFinite(cooldown)&&cooldown>0&&execution!==null?(mode==='ammo'?count*cooldown:cooldown)+execution:null;
  const known=parts.length>0&&parts.every(p=>Number.isFinite(p.value));
  return {count,parts:parts.map(p=>({...p,value:Number.isFinite(p.value)?p.value*count:null})),dps:known&&cycle?parts.reduce((n,p)=>n+p.value,0)*count/cycle:null,cycle};
 });
}
