/** On-hit delivery by spells. Bindings describe one target, not splash targets.
 * Reuse the attack model's raw effect packets, never its averaged attack total.
 */
(function(scope){
  const finite=Number.isFinite, fmt=n=>finite(n)?n.toFixed(2):'unavailable';
  const simple=new Set(['EzrealQ','GangplankQWrapper','IreliaQ','KatarinaEWrapper','SennaQ','WarwickQ','ViegoR']);
  const alternatives=new Set(['YasuoQ1Wrapper','YoneQ','MissFortuneRicochetShot']);
  function data(payload,key,rank){
    const values=payload?.dataValues||payload?.spellData?.DataValues||[];
    const entry=values.find(v=>String(v.mName||v.name).toLowerCase()===key.toLowerCase());
    const list=entry?.mValues||entry?.values;
    return list?list[Math.min(rank,list.length-1)]:entry?.mValue;
  }
  function sum(amounts){
    const total=key=>amounts.every(a=>finite(a[key]))?amounts.reduce((n,a)=>n+a[key],0):null;
    return {value:total('value'),rawValue:total('rawValue'),components:amounts.flatMap(a=>a.components||[]),
      text:amounts.map(a=>a.text).join(' + '),breakdownText:amounts.map(a=>a.breakdownText||a.text).filter(Boolean).join('\n')};
  }
  function plans(spell,rows,payload,rank){
    if(simple.has(spell.id))return [{indexes:[0],hits:1,procs:1}];
    if(alternatives.has(spell.id))return rows.map((_,i)=>({indexes:[i],hits:1,procs:1}));
    if(['SmolderQ','FizzQ'].includes(spell.id))return rows.length>=2?[{indexes:[0,1],hits:1,procs:1,label:'Primary hit + on-hit'}]:[];
    if(spell.id==='WarwickR')return [{indexes:[0],hits:3,procs:1}];
    if(spell.id==='AlphaStrike'){
      const scale=data(payload,'BaseOnHitMultiplier',rank),sub=data(payload,'SubsequentHitMultiplier',rank),count=data(payload,'AlphaStrikeBounces',rank);
      return [{indexes:[0],hits:scale,procs:scale},{indexes:[1],hits:scale*sub,procs:0},
        {indexes:[2],hits:scale*(1+sub*(count-1)),procs:scale}];
    }
    if(spell.id==='KatarinaR'){
      const scale=data(payload,'OnHitRatio',rank),ticks=data(payload,'TicksPerSecond',rank)*data(payload,'Duration',rank);
      return rows.length>=4?[{indexes:[0,1],hits:scale,procs:scale,label:'First knife + on-hit'},
        {indexes:[2,3],hits:scale*ticks,procs:scale,label:'Full channel + on-hit'}]:[];
    }
    return [];
  }
  function apply(result,{spell,rank=1,slot,payload,attack,target,stats={}}){
    if(!result?.rows?.length||!attack)return result;
    const bindings=plans(spell,result.rows,payload,rank);
    if(!bindings.length)return result;
    // Own ability damage already exists in the spell table. On-attack-only
    // bonuses, attack replacements and poison refresh DPS are not on-hit packets.
    const effects=(attack.rows||[]).filter(r=>r.spellbladeId||
      (r.onHit!==false&&!r.dot&&!r.replacementDebit&&!(r.source==='champion'&&r.sourceSlot===slot)));
    const proc=effects.find(r=>r.spellbladeId),ordinary=effects.filter(r=>!r.spellbladeId);
    const consumed=new Set(),replacements=new Map();
    for(const binding of bindings){
      const selected=binding.indexes.map(i=>result.rows[i]);
      if(selected.some(r=>!r))continue;
      const period=selected[0].period;
      const packet=(effect,events,dps=false)=>{
        const interval=effect.spellbladeId?effect.interval:null;
        const availability=dps&&finite(period)&&period>0&&finite(interval)?Math.min(1,period/interval):1;
        const cadence=effect.spellbladeId?1:(effect.cadence||1);
        const value=finite(effect.rawValue)&&finite(events)?effect.rawValue*events/cadence*availability:null;
        // AttackEffects raw packets already include outgoing item/champion
        // amplification. Apply only the target defenses here, once.
        const packetStats={...stats,physicalDamageMultiplier:1,magicDamageMultiplier:1,trueDamageMultiplier:1};
        const out=scope.TargetDamage?scope.TargetDamage.apply(value,effect.type,{target,stats:packetStats}):{value,rawValue:value};
        const text=`${effect.label}: ${fmt(effect.rawValue)} ${effect.type} × ${fmt(events)} on-hit applications${cadence>1?' ÷ '+cadence+' hit cadence':''}${effect.spellbladeId?' (enabled Spellblade proc)':''}`;
        return {...out,text,components:[{...out,type:effect.type,source:effect.source,label:effect.label}],breakdownText:text+(out.text?'\n'+out.text:'')};
      };
      const additions=dps=>{
        // Dusk & Dawn creates one extra on-hit event when the proc is available;
        // that extra event cannot trigger Spellblade again.
        const procAvailability=dps&&finite(period)&&period>0&&finite(proc?.interval)?Math.min(1,period/proc.interval):1;
        const extra=proc?.extraHit?Number(proc.extraHit)*binding.procs*procAvailability:0;
        return [...ordinary.map(r=>packet(r,binding.hits+extra,dps)),...(proc&&binding.procs!==0?[packet(proc,binding.procs,dps)]:[])];
      };
      const core=selected.length===1?selected[0].damage:sum(selected.map(r=>r.damage));
      const added=additions(false),damage=added.length?sum([core,...added]):core;
      const row={...selected[0],label:binding.label||(added.length?selected[0].label+' + on-hit':selected[0].label),damage};
      if(added.length){
        row.dpsAmount=sum([core,...additions(true)]);
        if(row.sweet){row.sweet=sum([row.sweet,...added]);row.sweetDpsAmount=sum([selected[0].sweet,...additions(true)]);}
      }
      replacements.set(binding.indexes[0],row);binding.indexes.slice(1).forEach(i=>consumed.add(i));
    }
    return {...result,rows:result.rows.flatMap((row,i)=>consumed.has(i)?[]:[replacements.get(i)||row]),
      note:(result.note||'')+' On-hit totals apply to the primary target (the first target for piercing attacks). Registered enabled on-hit effects use their own damage type; repeated-hit passives use their hit cadence. Spellblade adds its full proc to damage and is limited by its selected interval in DPS. On-attack-only effects and splash procs are excluded.'};
  }
  const api={apply};scope.AbilityOnHit=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
