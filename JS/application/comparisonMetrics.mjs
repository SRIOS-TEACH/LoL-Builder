import {chargeOutcomes} from '../domain/chargeComparison.js';
import ItemEvaluation from '../engine/itemEvaluation.js';
import ComboEvaluation from '../engine/comboEvaluation.js';
import {sequenceDps} from '../domain/defenseMetrics.js';
const finite=Number.isFinite;
const shieldType=text=>/magic(?:al)?\s+(?:damage\s+)?shield|magic damage/i.test(text)?'magic':/physical\s+(?:damage\s+)?shield|physical damage/i.test(text)?'physical':'all';
export function enrichComparison(build,evaluation){
 build.metricsVersion=4;build.shieldOptions=[];
 const {state,stats,resolution,data}=evaluation;const actions=ComboEvaluation.actions(evaluation);
 for(const [index,spell]of state.championData.spells.entries()){
  const slot=['q','w','e','r'][index],rank=state.abilityRanks[slot],ability=build.abilitySummary.find(a=>a.slot===slot);if(!rank||!ability)continue;
  const result=evaluation.evaluateAbility(spell,rank,slot),context=resolution.buildAbilityContext(spell,rank,slot),raw=resolution.expandAbilityLocalization(spell.tooltip||spell.description||'');
  const resolve=token=>resolution.resolveAbilityToken(token,context);
  const primary=result.onHitDamage||result.damage,rows=primary.rows||[];
  let selected=rows.filter(r=>/^Combined|full duration|all three|all waves|hit \+ pull|physical \+ magic total/i.test(r.label));if(!selected.length)selected=rows;
  let values=[];
  if(spell.id==='AatroxQ'){
   const casts=[0,1,2].map(stage=>actions.find(a=>a.group===slot&&a.stage===stage&&!a.id.endsWith(':sweet'))?.castTime);
   const combined=rows.find(r=>/^Combined/.test(r.label));if(combined){for(const damage of [combined.damage,combined.sweet].filter(Boolean))values.push(sequenceDps({damage:damage.value,cooldown:result.cooldown,castTimes:casts}));}
  }else if(spell.id==='VelkozW'){
   // One cast triggers both hits. Sustainable DPS uses charge recharge, not the short charge lockout.
   const recharge=resolve('ammorechargetime')?.numeric??context.cdragonSpell?.spellData?.mAmmoRechargeTime?.[rank];
   const haste=context.stats?.haste||0;const damage=rows.every(r=>finite(r.damage.value))?rows.reduce((n,r)=>n+r.damage.value,0):null;
   const cast=actions.find(a=>a.group===slot)?.castTime;
   values=[sequenceDps({damage,cooldown:finite(recharge)?recharge/(1+Math.max(0,haste)/100):null,castTimes:[cast]})];
  }else{
   values=selected.map(r=>r.onHitDps?.activeDps??(finite(r.damage.value)&&finite(r.period)&&r.period>0?r.damage.value/r.period:null));
  }
  const source=context.cdragonSpell?.spellData;
  const max=spell.id==='SyndraQ'?(state.combatValues['evolve:q']===true?resolve('upgrade1maxammo')?.numeric:1):spell.id==='AhriR'?resolve('rmaxcasts')?.numeric:source?.mMaxAmmo?.[rank]??Number(spell.maxammo);
  if(Number.isInteger(max)&&max>1&&max<=20){
   const mode=spell.id==='AhriR'?'recast':'ammo';
   const haste=source?.mSpellTags?.includes('Trait_NotBenefitFromHaste')?0:Math.max(0,context.stats?.haste||0);
   const recharge=source?.mAmmoRechargeTime?.[rank];
   const cooldown=mode==='ammo'?(finite(recharge)?recharge/(1+haste/100):null):result.cooldown;
   const action=actions.find(a=>a.group===slot&&!a.id.endsWith(':sweet'));
   const distance=spell.id==='AhriR'?resolve('rdashdistance')?.numeric:null,speed=spell.id==='AhriR'?resolve('rbasedashspeed')?.numeric:null;
   const cast=finite(action?.castTime)?action.castTime:finite(distance)&&speed>0?distance/speed:null;
   const interval=mode==='recast'?resolve('rdashcooldown')?.numeric??0:result.cooldown??0;
   // Only explicitly combined or known automatic multi-hit outcomes can be added.
   const perCast=spell.id==='VelkozW'?rows:selected.length===1?selected:[];
   const parts=perCast.map(row=>({value:row.damage.value,type:[...new Set((row.damage.components||[]).map(p=>p.type))].length===1?row.damage.components[0]?.type:'mixed'}));
   ability.charges={max,mode,outcomes:chargeOutcomes({max,parts,cooldown,castTime:cast,interval,mode}),note:mode==='ammo'?'DPS includes sequential recharge of every selected charge plus cast / recast time.':'DPS includes one shared cooldown plus cast / recast time. Base charges only; takedown resets excluded.'};
  }
  ability.abilityDps=values.map(value=>({dps:finite(value)?value.toFixed(1):'—'}));
  const protection=/spell ?shield|wind wall|rebuttal|blade whirl|shroud of darkness/i.test(spell.name+' '+raw)||/(block|destroy|reflect)[^.]{0,70}projectile/i.test(raw);
  if(protection){build.shieldOptions.push({id:'ability:'+slot+':block',name:spell.name,type:'spell',amount:0,source:'Ability '+slot.toUpperCase()+' · ability/projectile protection; coverage depends on the ability.'});}
  else if(/shield|absorb/i.test(raw)){
   const chunks=[...raw.matchAll(/<shield>([\s\S]*?)<\/shield>/gi)];
   for(const [n,chunk]of chunks.entries()){const tokens=[...chunk[1].matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)];const resolved=tokens.length===1?resolve(tokens[0][1]):null;build.shieldOptions.push({id:'ability:'+slot+':'+n,name:spell.name,type:shieldType(chunk[1]),amount:finite(resolved?.numeric)&&!resolved.isPercent?resolved.numeric:null,source:'Ability '+slot.toUpperCase()+' · rank '+rank});}
   if(!chunks.length)build.shieldOptions.push({id:'ability:'+slot,name:spell.name,type:shieldType(raw),amount:null,source:'Shield value requires manual input'});
  }
 }
 const context=stats.calculationContext(stats.getComputedChampionStatsForTooltips());
 for(const id of [...new Set(state.itemSlots.filter(Boolean))]){
  const item=state.items[id];if(!item)continue;
  const prepared=ItemEvaluation.prepare({id,item,source:data.advancedItems?.[id],strings:state.strings,context});const text=prepared.template.replace(/<[^>]*>/g,' ');
  if(/spell ?shield|blocks? (?:the )?next (?:enemy )?(?:ability|spell)/i.test(text)){build.shieldOptions.push({id:'item:'+id,name:item.name,type:'spell',amount:0,source:'Equipped item · spell protection'});continue;}
  if(!/shield/i.test(text))continue;
  const matches=[...text.matchAll(/@([\w.*:-]+)@\s*(?:\([^)]*\)\s*)?(?:(?:magic|magical|physical|damage|health|point)\s+)*shield/gi)];
  const values=matches.map(m=>ItemEvaluation.resolve(prepared,m[1])).filter(v=>finite(v.numeric)&&!v.isPercent);
  build.shieldOptions.push({id:'item:'+id,name:item.name,type:shieldType(text),amount:values.length===1?values[0].numeric:null,source:'Equipped item · conditional shield; value editable',group:/lifeline/i.test(text)?'lifeline':undefined});
 }
}
