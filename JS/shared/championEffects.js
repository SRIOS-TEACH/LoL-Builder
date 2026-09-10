/** Script-to-data bindings. Balance values are read from the loaded champion data. */
(function(scope){
  const C=scope.Calculations;
  function model(state){
    const champion=state.selectedChampion, values=state.combatValues||{}, ranks=state.abilityRanks||{};
    const payload=slot=>state.cdragonAbilityData?.[slot];
    const rank=slot=>slot==='p'?1:(ranks[slot]||0);
    const data=(slot,key)=>C.dataValue(payload(slot)?.dataValues||[],key,Math.max(1,rank(slot)),state.level).value ?? NaN;
    const count=key=>Math.max(0,Number(values[key])||0);
    const calc=(slot,key,stats={})=>{
      const p=payload(slot);if(!p)return NaN;
      const buffs=Object.fromEntries(Object.entries(values).filter(([k])=>k.startsWith('buff:')).map(([k,v])=>[k.slice(5),v]));
      return C.evaluate(C.lookup(p.calculations,key),{dataValues:p.dataValues,calculations:p.calculations,effects:p.effects,rank:Math.max(1,rank(slot)),level:state.level,stats,buffs}).value ?? NaN;
    };
    const fields=[];
    const field=(slot,key,label,extra={})=>fields.push({slot,key,label,kind:key.split(':')[0],owners:new Set([label]),defaultValue:0,...extra});
    if(!state.cdragonAbilityData)return {fields,data,calc,apply:s=>({...s,championBonuses:{}}),token:()=>null};
    if(champion==='Poppy')field('w','self:healthPercent:0','Current health (%) — W resistance bonus',{percent:true,defaultValue:1});
    if(champion==='Malphite')field('p','state:graniteShield','Granite Shield active',{boolean:true,defaultValue:false});
    const stacks={Chogath:['r','buff:{8682fc00}','Feast stacks'],Swain:['p','buff:{0dc6979e}','Soul fragments'],Thresh:['p','buff:{5fbfbf13}','Souls collected'],Senna:['p','buff:{e88568f8}','Mist stacks'],Belveth:['p','buff:{7f3c01cf}','Lavender stacks'],Veigar:['p','state:phenomenalEvil','Phenomenal Evil stacks'],Sion:['w','state:soulFurnaceHealth','Permanent health gained from Soul Furnace'],Garen:['w','buff:{9e10ce18}','Courage kill stacks'],Syndra:['p','state:splinters','Splinters of Wrath']};
    if(stacks[champion])field(...stacks[champion]);
    if(champion==='Bard')field('w','state:shrines','Active shrines',{max:data('w','MaxPacks')});
    const apply=s=>{
      const out={...s,championBonuses:{},bonusAttackSpeedFromChampion:0};
      const add=(stat,value)=>{if(Number.isFinite(value)){out[stat]+=value;out.championBonuses[stat]=(out.championBonuses[stat]||0)+value;}};
      if(champion==='Chogath'&&rank('r')){
        const n=count('buff:{8682fc00}');add('hp',n*data('r','RHealthPerStack'));
        add('attackRange',Math.min(data('r','MaxBonusAttackRange'),n*data('r','AttackRangePerStack')));
      }
      if(champion==='Swain')add('hp',count('buff:{0dc6979e}')*data('p','HealthIncrement'));
      if(champion==='Sion'&&rank('w'))add('hp',count('state:soulFurnaceHealth'));
      if(champion==='Veigar')add('ap',count('state:phenomenalEvil')*calc('p','APPerStack'));
      if(champion==='Thresh'){const n=count('buff:{5fbfbf13}')*data('p','StatValuePerSoul');add('ap',n);add('armor',n);}
      if(champion==='Senna'){
        const n=count('buff:{e88568f8}'),milestones=Math.floor(n/data('p','StacksForBonus'));
        add('ad',n*data('p','ADPerStack'));add('attackRange',milestones*data('p','BonusRange'));
        add('critChance',milestones*data('p','BonusCritChance'));
        const beforeCap=s.item?s.item.critChance+s.rune.critChance+(s.base.crit+s.base.critperlevel*scope.BuildStats.growthFactor(state.level))*100: s.critChance;
        out.championLifeSteal=Math.max(0,beforeCap+milestones*data('p','BonusCritChance')-100)*(data('p','CritToLifestealConversionPercent')||0);
        out.critChance=Math.min(100,out.critChance);
      }
      if(champion==='Belveth'){
        const bonus=count('buff:{7f3c01cf}')*calc('p','AttackSpeedPerStack')/100;
        if(Number.isFinite(bonus)){out.bonusAttackSpeedFromChampion=bonus;add('asTotal',(s.base.attackspeedratio||s.base.attackspeed)*bonus);}
      }
      if(champion==='Garen'&&rank('w')){
        const n=Math.min(data('w','ResistMax'),count('buff:{9e10ce18}')*data('w','ResistGainOnKill'));add('armor',n);add('mr',n);
      }
      if(champion==='Poppy'&&rank('w')){
        const hp=values['self:healthPercent:0']??1;
        const amp=data('w','PassiveResistPercent')*(hp<data('w','PassiveEmpoweredHealthPercent')?2:1);
        add('armor',s.armor*amp);add('mr',s.mr*amp);
      }
      if(champion==='Malphite'&&rank('w'))add('armor',s.armor*data('w','BonusArmorPassive')*(values['state:graniteShield']?data('w','BonusArmorPassiveMultiplier'):1));
      if(champion==='Syndra'&&count('state:splinters')>=data('p','MaxStackAmount'))add('ap',out.ap/(s.passiveLedger?.apMultiplier||1)*data('p','CapstoneAPPerc'));
      return out;
    };
    // f-number names are local script variables, never global aliases.
    function token(id,key,stats,computed){
      if(id==='GarenW'&&key==='resistsfortooltip')return computed.championBonuses?.armor??0;
      if(id==='Feast'&&key==='bonusattackrange')return computed.championBonuses?.attackRange??0;
      if(id==='PoppyW'&&['bonusarmor','bonusmr'].includes(key))return computed.championBonuses?.[key==='bonusarmor'?'armor':'mr']??0;
      const slot={GarenE:'e',BelvethQ:'q',BelvethE:'e',SettW:'w',SyndraW:'w',XinZhaoE:'e',BardW:'w',Obduracy:'w'}[id];
      if(id==='SyndraW'&&key==='f2')return data('w','SlowDuration');
      if(id==='BardW'&&key==='f1')return Math.min(count('state:shrines'),data('w','MaxPacks'));
      if(id==='BardW'&&key==='f2')return data('w','MaxPacks');
      if(id==='SettW'&&key==='f1')return calc('w','DamageCalc',stats)+calc('w','DamageConversion',stats)*calc('w','MaxGrit',stats);
      if(id==='Obduracy'&&['f1','f2'].includes(key)){
        const armor=computed.armor-(computed.championBonuses?.armor||0);
        return armor*data('w','BonusArmorPassive')*(key==='f2'?data('w','BonusArmorPassiveMultiplier'):1);
      }
      const growth=scope.BuildStats.growthFactor(state.level),base=state.championData.stats;
      const permanentAS=(base.attackspeedperlevel*growth+computed.item.asPct)/100;
      if(id==='GarenE'&&key==='f1')return data(slot,'NumTicks')+Math.floor((permanentAS+1e-8)/data(slot,'ASPerTick'));
      if(id==='BelvethQ'&&key==='f1')return data(slot,'PerSideCooldown')/(1+stats.bonusAttackSpeed*data(slot,'PerSideCDAttackSpeedMultiplier'));
      if(id==='BelvethE'&&key==='f2'){
        // The script uses a threshold; the exported TotalStrikes display calculation is stale.
        const coefficient=payload('e')?.calculations?.TotalStrikes?.mFormulaParts?.[1]?.mPart2?.mCoefficient;
        return coefficient>0?data(slot,'NumberOfStrikes')+Math.floor((stats.bonusAttackSpeed+1e-8)/coefficient):null;
      }
      if(id==='XinZhaoE'&&key==='f1')return 100*(data(slot,'ASMod')+stats.ap*data(slot,'APToASRatio')+permanentAS/data(slot,'PermanentASToASRatio'));
      // Living Weapon excludes runes, but includes natural stat growth.
      if(id==='KaisaQ'&&key==='f11')return base.attackdamageperlevel*growth+computed.item.ad+(computed.passiveLedger?.statMods.ad||0);
      if(id==='KaisaW'&&key==='f2')return stats.ap-computed.rune.ap*(computed.passiveLedger?.apMultiplier||1);
      if(id==='KaisaE'&&key==='f10')return permanentAS*100;
      return null;
    }
    return {fields,data,calc,apply,token};
  }
  scope.ChampionEffects={model};
})(typeof window!=='undefined'?window:globalThis);
