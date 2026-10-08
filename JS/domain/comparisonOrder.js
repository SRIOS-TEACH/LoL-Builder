export const statLabels={hp:'Health',mp:'Mana / resource',hp5:'Health regeneration',mp5:'Resource regeneration',ad:'Attack damage (stat)',ap:'Ability power',attackRange:'Attack range',abilityHaste:'Ability haste',basicHaste:'Basic ability haste',ultimateHaste:'Ultimate ability haste',armor:'Armor',mr:'Magic resist',asTotal:'Attack speed',moveSpeed:'Movement speed',critChance:'Critical chance',critDamage:'Critical damage',armorPenFlat:'Flat armor penetration',armorPenPct:'Armor penetration %',magicPenFlat:'Flat magic penetration',magicPenPct:'Magic penetration %',lifeSteal:'Lifesteal',tenacity:'Tenacity'};
export function orderBuilds(builds,{order=[],pinned=null,sort='manual',direction='desc'}={}){
 const positions=new Map(order.map((id,index)=>[id,index]));
 const ranked=[...builds].sort((a,b)=>{
  if(a.id===pinned)return -1;if(b.id===pinned)return 1;
  if(sort==='manual')return (positions.get(a.id)??Infinity)-(positions.get(b.id)??Infinity);
  if(sort==='name')return direction==='asc'?a.name.localeCompare(b.name):b.name.localeCompare(a.name);
  const left=a.metrics?.[sort],right=b.metrics?.[sort];
  if(!Number.isFinite(left))return Number.isFinite(right)?1:0;if(!Number.isFinite(right))return -1;
  return direction==='asc'?left-right:right-left;
 });return ranked;
}
export function moveBuild(order,id,offset){const next=[...order],from=next.indexOf(id),to=from+offset;if(from<0||to<0||to>=next.length)return next;next.splice(from,1);next.splice(to,0,id);return next;}
