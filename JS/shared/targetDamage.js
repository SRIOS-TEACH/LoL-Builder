/** Shared target health and mitigation rules. Damage type is explicit: AP/AD
 * scaling alone does not identify whether a damage packet is magic/physical.
 */
(function(scope){
  const finite=Number.isFinite,clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const numeric=(value,fallback)=>value!==null&&value!==''&&finite(Number(value))?Number(value):fallback;
  const format=value=>finite(value)?Number(value.toFixed(4)).toString():'unavailable';
  function normalize(target={}){
    const maxHp=Math.max(1,numeric(target?.maxHp,2000));
    return {enabled:target?.enabled===true,maxHp,currentHp:clamp(numeric(target?.currentHp,maxHp),0,maxHp),
      armor:numeric(target?.armor,100),mr:numeric(target?.mr,100),damageReduction:clamp(numeric(target?.damageReduction,0),0,100)};
  }
  function targetStats(target){
    const t=normalize(target);if(!t.enabled)return {};
    return {hp:t.maxHp,currentHp:t.currentHp,armor:t.armor,mr:t.mr,healthPercent:t.currentHp/t.maxHp,
      missingHp:t.maxHp-t.currentHp,missingHealthPercent:1-t.currentHp/t.maxHp};
  }
  function stat(stats,keys){
    for(const key of keys)if(finite(stats?.[key]))return stats[key];
    return ['item','rune'].reduce((sum,source)=>sum+(keys.map(key=>stats?.[source]?.[key]).find(finite)??0),0);
  }
  function apply(value,type,{target,stats={}}={}){
    const t=normalize(target),rawValue=finite(value)?value:null;
    const normalizedType=({physical:'physical',magic:'magic',magical:'magic',true:'true',
      physicaldamage:'physical',magicdamage:'magic',truedamage:'true'})[String(type||'').toLowerCase().replace(/[\s_-]/g,'')]||type;
    const result={value:rawValue,rawValue,type:normalizedType,multiplier:1,text:'Target settings off: damage before mitigation.'};
    if(!t.enabled)return result;
    if(!['physical','magic','true'].includes(normalizedType))return {...result,value:null,multiplier:null,text:'Target mitigation unavailable: damage type is not identified.'};
    const outgoingKey=`${normalizedType}DamageMultiplier`,outgoingMultiplier=finite(stats?.[outgoingKey])?Math.max(0,stats[outgoingKey]):1;
    const outgoingText=outgoingMultiplier===1?'':` × ${format(outgoingMultiplier)} outgoing damage multiplier`;
    if(normalizedType==='true')return {...result,value:rawValue===null?null:rawValue*outgoingMultiplier,multiplier:outgoingMultiplier,
      text:`${format(rawValue)} raw true damage${outgoingText} = ${format(rawValue===null?null:rawValue*outgoingMultiplier)}; ignores armor, magic resistance and generic damage reduction.`};
    const physical=normalizedType==='physical',label=physical?'armor':'magic resistance',resistance=physical?t.armor:t.mr;
    const percent=clamp(stat(stats,physical?['armorPenPct','arPenPct']:['magicPenPct','mrPenPct']),0,100);
    const flat=Math.max(0,stat(stats,physical?['armorPenFlat','arPenFlat','lethality']:['magicPenFlat','mrPenFlat']));
    // Penetration ignores resistance; it cannot turn nonnegative resistance
    // negative. An already-negative resistance is unaffected by penetration.
    const effective=resistance<0?resistance:Math.max(0,resistance*(1-percent/100)-flat);
    const resistanceMultiplier=effective>=0?100/(100+effective):2-100/(100-effective);
    const reductionMultiplier=1-t.damageReduction/100,multiplier=outgoingMultiplier*resistanceMultiplier*reductionMultiplier;
    const resistanceText=resistance<0?`${format(resistance)} ${label} (penetration does not affect negative resistance)`:
      `${format(resistance)} ${label} × (1 − ${format(percent)}% penetration) − ${format(flat)} flat penetration = ${format(effective)} effective ${label} (minimum 0)`;
    return {...result,value:rawValue===null?null:rawValue*multiplier,multiplier,
      text:`${format(rawValue)} raw ${normalizedType} damage; ${resistanceText}; damage${outgoingText} × ${format(resistanceMultiplier)} × (1 − ${format(t.damageReduction)}% damage reduction) = ${format(rawValue===null?null:rawValue*multiplier)}.`};
  }
  scope.TargetDamage={normalize,targetStats,apply};
  if(typeof module!=='undefined')module.exports=scope.TargetDamage;
})(typeof window!=='undefined'?window:globalThis);
