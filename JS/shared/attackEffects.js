/** Explicit attack-script bindings. Coefficients come from the loaded game data.
 * Damage is before mitigation, against one champion. Procs are amortised over
 * their cadence; optional effects require an explicit activation/interval.
 */
(function(scope){
  const C=scope.Calculations, finite=Number.isFinite, clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const averageCrit=(ad,chance,multiplier)=>ad*(1+clamp(chance,0,1)*(multiplier-1));
  const normalise=v=>v?.mName?[v]:v||[];
  // Stable source-passive keys shared with the Passives window. A control key
  // means the effect additionally needs that combat activation; null is innate.
  const itemPassiveBindings={
    1043:{sting:null},3115:{'icathian-bite':null},3091:{fray:null},
    3124:{wrath:null,'seething-strike':null},3042:{'shock-on-hit':null},
    3302:{shadow:null},3748:{cleave:null,'titanic-crescent':'attack:titanic'},
    3032:{'practice-makes-lethal':null,flurry:'attack:flurry'},3153:{'mist-s-edge':null},
    6672:{'bring-it-down':null},
    3057:{spellblade:'attack:spellblade'},3078:{spellblade:'attack:spellblade'},
    3100:{spellblade:'attack:spellblade'},6662:{spellblade:'attack:spellblade'},
    3508:{spellblade:'attack:spellblade'},3877:{spellblade:'attack:spellblade'},2510:{spellblade:'attack:spellblade'},
    3094:{sharpshooter:'attack:proc3094'},3095:{bolt:'attack:proc3095'},
    2015:{jolt:'attack:proc2015'},3087:{electrospark:'attack:proc3087'},
    3504:{sanctify:'attack:ardent'},6699:{firmament:'attack:voltaic'},
    3179:{nightstalker:'attack:umbral'},3181:{skipper:null},
    3742:{shipwrecker:'attack:shipwrecker'},2512:{'opening-barrage':'attack:fiendhunter'},
    6610:{'lightshield-strike':'attack:sundered'},3161:{'focused-will':null},
    2523:{magnification:null},3036:{'giant-slayer':null},4645:{cinderbloom:'attack:shadowflame'}
  };
  function model(state,items={}){
    const name=state.selectedChampion, values=state.combatValues||{}, ranks=state.abilityRanks||{};
    const level=Number(state.level)||1, equipped=[...new Set(state.itemSlots.filter(Boolean).map(String))];
    const has=id=>equipped.includes(String(id));
    const enabled=(id,key)=>has(id)&&state.disabledItemPassives?.[`${id}:${key}`]!==true
      &&!(id===3153&&state.disabledItemPassives?.['3153:mists-edge']===true);
    const payload=slot=>state.cdragonAbilityData?.[slot]||state.cdragonAbilityData?.byAlias?.[slot.toLowerCase().replace(/[^a-z0-9]/g,'')]?.payload;
    const rank=slot=>slot==='p'||slot.length>1?1:ranks[slot]||0;
    const read=(p,key,r=1)=>C.dataValue(normalise(p?.dataValues??p?.mDataValues),key,r,level).value;
    const data=(slot,key)=>read(payload(slot),key,Math.max(1,rank(slot)));
    const itemData=(id,key)=>read(items[id],key);
    const context=(s)=>{
      const growth=scope.BuildStats.growthFactor(level),baseAd=s.base.attackdamage+s.base.attackdamageperlevel*growth;
      const targetStats={};
      for(const key of ['hp','currentHp','bonusHp'])if(finite(values['attack:target:'+key]))targetStats[key]=values['attack:target:'+key];
      const stats={totalAd:s.ad,baseAd,bonusAd:s.ad-baseAd,ap:s.ap,hp:s.hp,mp:s.mp,
        bonusHp:s.hp-s.base.hp-s.base.hpperlevel*growth,bonusMp:s.mp-s.base.mp-s.base.mpperlevel*growth,
        armor:s.armor,bonusArmor:s.armor-s.base.armor-s.base.armorperlevel*growth,mr:s.mr,bonusMr:s.mr-s.base.spellblock-s.base.spellblockperlevel*growth,
        critChance:s.critChance/100,critDamage:s.critDamage/100,bonusCritDamage:((s.item.critDamage||0)+(s.rune.critDamage||0))/100,
        attackSpeed:s.asTotal,bonusAttackSpeed:(s.base.attackspeedperlevel*growth+s.item.asPct+s.rune.asPct)/100+(s.bonusAttackSpeedFromChampion||0),
        lethality:(s.item.lethality||0)+(s.rune.lethality||0)};
      const defaults=Object.fromEntries((scope.ChampionEffects?.model(state).fields||[]).filter(f=>f.key.startsWith('buff:')).map(f=>[f.key,f.defaultValue]));
      const buffs=Object.fromEntries(Object.entries({...defaults,...values}).filter(([k])=>k.startsWith('buff:')).map(([k,v])=>[k.slice(5),v]));
      if(name==='Nasus')buffs['{1b1d7345}']=values['attack:nasusStacks']??0;
      return {stats,targetStats,buffs,level,ranged:s.ranged??s.base.attackrange>300};
    };
    const evaluate=(p,key,s,r=1)=>{
      const ctx={...context(s),dataValues:normalise(p?.dataValues??p?.mDataValues),calculations:p?.calculations??p?.mItemCalculations,rank:r,effects:p?.effects},formula=C.lookup(ctx.calculations,key);
      let result=C.evaluate(formula,ctx);
      // Unspecified buff stacks mean inactive, as in the ability-box controls.
      // Missing stats, data values and formulas must still remain unavailable.
      for(let pass=0;pass<3;pass++){
        const keys=(result.inputs||[]).filter(k=>k.startsWith('buff:')&&ctx.buffs[k.slice(5)]===undefined);
        if(!keys.length)break;
        for(const k of keys)ctx.buffs[k.slice(5)]=0;
        result=C.evaluate(formula,ctx);
      }
      return result;
    };
    const calc=(slot,key,s,overrideRank)=>evaluate(payload(slot),key,s,overrideRank??Math.max(1,rank(slot)));
    const controls=[];
    const toggle=(slot,key,label)=>{
      const innateForm=slot==='r'&&['Elise','Nidalee','Jayce'].includes(name)&&['spider','cougar','cannon'].includes(key);
      const disabled=slot!=='attack'&&slot!=='p'&&!rank(slot)&&!innateForm;
      controls.push({slot,key:'attack:'+key,label,type:'toggle',disabled});return values['attack:'+key]===true&&!disabled;
    };
    const input=(slot,key,label,extra={})=>{controls.push({slot,key:'attack:'+key,label,type:'number',min:0,...extra});return values['attack:'+key];};
    const choice=(slot,key,label,options)=>{controls.push({slot,key:'attack:'+key,label,type:'select',options});return clamp(Number(values['attack:'+key])||0,0,options.length-1);};
    const speedBuff={Ashe:['q','BonusAS','Ranger’s Focus',100,'asheQ'],MasterYi:['r','RASBonus','Highlander',100],Tristana:['q','AttackSpeedMod','Rapid Fire',1],Twitch:['q','AttackSpeedMod','Ambush',1],Draven:['w','AttackSpeed','Blood Rush',1],Teemo:['p','BonusAttackSpeed','Guerrilla Warfare',1,null,true],Gwen:['e','BonusAttackSpeed','Skip ’n Slash',100,null,true]};
    function apply(s){
      const out={...s,championBonuses:{...s.championBonuses}};
      const earnedCrit=enabled(3032,'practice-makes-lethal')?clamp(Number(values['attack:yunTalCrit'])||0,0,itemData(3032,'CritMax')):0;
      const rawCrit=(s.base.crit+s.base.critperlevel*scope.BuildStats.growthFactor(level))*100+s.item.critChance+s.rune.critChance+earnedCrit;
      out.critChance=clamp(out.critChance+earnedCrit,0,100);
      if(name==='Senna'){
        const stacks=Number(values['buff:{e88568f8}'])||0,bonus=Math.floor(stacks/data('p','StacksForBonus'))*data('p','BonusCritChance');
        out.championLifeSteal=Math.max(0,rawCrit+bonus-100)*data('p','CritToLifestealConversionPercent');
      }
      if(name==='Yasuo'||name==='Yone'){
        const multiplier=data('p','CritChanceMultiplier'),conversion=data('p',name+'CritToAD');
        if(finite(multiplier)&&finite(conversion)){
          out.critChance=clamp(rawCrit*(1+multiplier),0,100);
          out.ad+=Math.max(0,rawCrit*(1+multiplier)-100)/100*conversion;
        }
      }
      if(['Yasuo','Yone','Senna'].includes(name)){
        const mod=data('p','CritDamageMod');if(finite(mod))out.critDamage*=mod;else out.attackStatsMissing=true;
      }
      if(name==='Tryndamere'){
        const fury=clamp(Number(values['attack:fury'])||0,0,100),rate=calc('p','PassiveCritConversionTooltip',out).value;
        if(finite(rate))out.critChance=clamp(rawCrit+fury*rate,0,100);
      }
      if(enabled(3124,'seething-strike')){
        const stacks=clamp(Number(values['attack:rageStacks'])||0,0,itemData(3124,'MaxStacks')??4),bonus=stacks*itemData(3124,'AttackSpeedPerStack');
        if(finite(bonus)){out.asTotal+=(s.base.attackspeedratio??s.base.attackspeed)*bonus;out.bonusAttackSpeedFromChampion=(out.bonusAttackSpeedFromChampion||0)+bonus;}
      }
      if(speedBuff[name]){
        const [slot,key,,divisor,stateKey='speedBuff',isCalc]=speedBuff[name];
        if(values['attack:'+(stateKey||'speedBuff')]===true&&rank(slot)){
          const bonus=(isCalc?calc(slot,key,out).value:data(slot,key));
          if(finite(bonus)){out.asTotal+=(s.base.attackspeedratio??s.base.attackspeed)*bonus/divisor;out.bonusAttackSpeedFromChampion=(out.bonusAttackSpeedFromChampion||0)+bonus/divisor;}
        }
      }
      for(const [id,key,dataKey,passive]of [[3504,'ardent','AttackSpeedMin','sanctify'],[2512,'fiendhunter','BonusAS','opening-barrage'],[3032,'flurry','ASMod','flurry']])if(enabled(id,passive)&&values['attack:'+key]===true){
        const bonus=itemData(id,dataKey);if(finite(bonus)){out.asTotal+=(s.base.attackspeedratio??s.base.attackspeed)*bonus;out.bonusAttackSpeedFromChampion=(out.bonusAttackSpeedFromChampion||0)+bonus;}
      }
      if(scope.AttackChampions)Object.assign(out,scope.AttackChampions.apply({name,s:out,data,calc,values,rank}));
      if(name==='Jhin'){
        const reduction=data('p','CritReductionPercent');if(finite(reduction))out.critDamage*=1-reduction;
        const adBonus=calc('p','TotalADPercent',out).value;if(finite(adBonus))out.ad*=1+adBonus;
        const baseAS=data('p','BaseAttackSpeed'),perLevel=data('p','PercentAttackSpeedPerLevel');
        if(finite(baseAS)&&finite(perLevel))out.asTotal=baseAS*(1+perLevel*scope.BuildStats.growthFactor(level));
      }
      for(const stat of ['ad','critChance','critDamage','asTotal'])if(out[stat]!==s[stat])out.championBonuses[stat]=(out.championBonuses[stat]||0)+out[stat]-s[stat];
      return out;
    }
    function profile(s){
      controls.length=0;
      const ctx=context(s),chance=clamp(s.critChance/100,0,1),crit=s.critDamage/100,rows=[],warnings=[];
      let base=averageCrit(s.ad,chance,crit),rate=s.asTotal;
      if(s.attackStatsMissing){base=null;warnings.push('Champion critical-strike data unavailable.');}
      if(speedBuff[name]&&name!=='Ashe'){const [slot,,label,,key]=speedBuff[name];toggle(slot,key||'speedBuff',label+' attack speed active');}
      const row=(label,value,type='magic',cadence=1,formula='',extra={})=>rows.push({label,value:finite(value)?value:null,type,cadence,formula,...extra});
      const ability=(slot,key,label,type='magic',cadence=1,extra={})=>{const r=calc(slot,key,s);row(label,r.value,type,cadence,r.text,extra);};
      if(name==='Tryndamere')input('p','fury','Fury',{max:100});
      if(name==='Nasus')input('q','nasusStacks','Siphoning Strike stacks');
      if(name==='Ashe'){
        const frost=toggle('p','frost','Target affected by Frost Shot');
        base=s.ad;if(frost){const r=calc('p','DamageBonus',s);base=finite(r.value)?s.ad*r.value:null;}
        if(toggle('q','asheQ',"Ranger’s Focus active")){const r=calc('q','EmpoweredDamage',s);base=finite(r.value)&&finite(base)?base/s.ad*r.value:null;}
      }
      if(name==='Jhin'){
        const missing=input('p','target:currentHp','Target current health'),max=input('p','target:hp','Target maximum health');
        const execute=calc('p','FourthShotExecutePercent',s).value;
        base=(3*base+s.ad*crit)/4;
        row('Whisper fourth-shot execute',finite(max)&&finite(missing)&&finite(execute)?Math.max(0,max-missing)*execute:null,'physical',4,'Target missing HP × fourth-shot execute fraction', {onHit:false});
        const reload=data('p','ReloadTime');
        // Reload begins on the last shot; three inter-shot intervals per magazine.
        rate=finite(reload)?4/(3/s.asTotal+reload):null;
      }
      if(name==='Senna')ability('p','BonusOnHitDamage','Absolution','physical');
      if(name==='Corki'){
        const r=calc('p','BasicAttackTOOLTIP',s);row('Hextech Munitions',finite(r.value)?averageCrit(r.value,chance,crit):null,'true',1,r.text,{onHit:false});
      }
      if(name==='Orianna'){
        ability('p','TotalDamage','Clockwork Windup');
        const stacks=input('p','oriannaStacks','Consecutive-hit stacks',{max:2});
        if(stacks>0){const r=calc('p','StackDamage',s);row('Clockwork stacks',finite(r.value)?r.value*clamp(stacks,0,2):null);}
      }
      const permanent={Teemo:['e','ImpactCalculatedDamage','Toxic Shot'],Varus:['w','OnHitDamage','Blighted Quiver'],Kayle:['e','EPassiveTotalDamage','Starfire Spellblade'],Jax:['r','OnHitDamage','Grandmaster’s Might','magic',3],TwistedFate:['e','BonusDamage','Stacked Deck','magic',4],Vayne:['w','TotalDamage','Silver Bolts','true',3],
        Warwick:['p','OnHitDamage','Eternal Hunger'],TahmKench:['p','TotalDamage','An Acquired Taste'],Lulu:['p','CombinedDamage','Pix (all bolts hit)'],Kassadin:['w','OnHitDamage','Nether Blade'],Diana:['p','CleaveDamage','Moonsilver Blade','magic',3],Neeko:['w','PassiveBonusDamageCalc','Shapesplitter','magic',3],Kennen:['w','TotalDamagePassive','Electrical Surge','magic',5],XinZhao:['p','TotalDamage','Determination','physical',3],Sett:['p','RightPunchBonus','Right punch','physical',2],Vi:['w','TotalDamageTooltip','Denting Blows','physical',3],Blitzcrank:['r','PassiveDamage','Static Field']};
      if(permanent[name]&&rank(permanent[name][0])){ability(...permanent[name]);if(['TwistedFate','Kennen','Sett'].includes(name))rows.at(-1).onHit=false;}
      const conditional={
        Akali:['p','Damage','Assassin’s Mark'],Alistar:['e','AttackBonusDamage','Trample'],
        Draven:['q','TotalDamage','Spinning Axe','physical','continuous'],Ekko:['e','TotalDamage','Phase Dive'],
        Gwen:['e','OnHitDamage','Skip ’n Slash','magic','continuous'],Irelia:['p','OnHitBonus','Ionian Fervor at full stacks','magic','continuous'],
        Khazix:['p','TotalDamage','Unseen Threat'],Leona:['q','TotalDamageTooltip','Shield of Daybreak'],
        MissFortune:['p','TotalDamage','Love Tap (new target)','physical'],MonkeyKing:['q','BonusDamageTT','Crushing Blow','physical'],
        Nami:['e','TotalDamage','Tidecaller’s Blessing'],Poppy:['p','TotalDamage','Iron Ambassador'],
        Qiyana:['w','OnHitDamage','Terrashape (holding an element)','magic','continuous'],Quinn:['p','BonusDamage','Harrier','physical'],
        Riven:['p','TotalDamage','Runic Blade','physical'],Sona:['p','PowerChordDamage','Power Chord'],
        Taric:['p','TotalDamage','Bravado'],Volibear:['p','ChainLightningDamage','The Relentless Storm at full stacks','magic','continuous'],
        XinZhao:['q','BonusDamage','Three Talon Strike','physical'],Yorick:['q','BonusDamage','Last Rites','physical'],
        Zoe:['p','PassiveDamage','More Sparkles!'],Kassadin:['w','ActiveDamage','Nether Blade active'],
        Malphite:['w','TotalBonusDamage','Thunderclap','physical','continuous'],
      };
      if(conditional[name]){
        const [slot,key,label,type='magic',mode]=conditional[name];
        if(toggle(slot,'bonusAttack',label+' enabled')){
          const interval=mode==='continuous'?undefined:input(slot,'bonusInterval','Seconds between '+label+' hits',{min:0.01});
          ability(slot,key,label,type,1,mode==='continuous'?{}:{interval:finite(interval)&&interval>0?interval:null,onHit:false});
          if(name==='Riven'&&finite(rows.at(-1).value))rows.at(-1).value=averageCrit(rows.at(-1).value,chance,crit);
        }
      }
      const percent=(slot,key,label,stat='hp',type='magic',extra={})=>{
        const hp=input('attack','target:'+stat,'Target '+(stat==='hp'?'maximum':'current')+' health'),r=calc(slot,key,s);
        row(label,finite(hp)&&finite(r.value)?hp*r.value:null,type,1,r.text+' × target '+stat,extra);
      };
      if(name==='Gwen')percent('p','PercentHealth1000Cuts','A Thousand Cuts');
      if(name==='Viego'&&rank('q'))percent('q','TotalPercentHealthOnHit','Blade of the Ruined King','currentHp','physical');
      if(name==='Aatrox'&&toggle('p','deathbringer','Deathbringer Stance procs enabled')){
        const interval=input('p','deathbringerInterval','Seconds between Deathbringer Stance hits',{min:0.01});
        percent('p','PDamage','Deathbringer Stance','hp','magic',{interval:finite(interval)&&interval>0?interval:null,onHit:false});
      }
      if(name==='Chogath'&&toggle('e','spikes','Vorpal Spikes active')){ability('e','FlatDamageCalc','Vorpal Spikes flat damage');percent('e','MaxHealthPercentCalc','Vorpal Spikes health damage');}
      if(name==='Shen'&&toggle('q','spiritBlade','Twilight Assault active')){
        ability('q','BaseFlatDamage','Twilight Assault flat damage');
        percent('q',toggle('q','bladeThrough','Spirit blade passed through champion')?'EmpPercentHealth':'BasePercentHealth','Twilight Assault health damage');
      }
      if(name==='Kaisa'){
        ability('p','PBaseDamage','Plasma base damage');
        const stack=calc('p','PCurrentPerStackDamage',s);row('Plasma stacks (five-hit cycle)',finite(stack.value)?2*stack.value:null,'magic',1,stack.text+' × average 2 existing stacks');
        const hp=input('attack','target:hp','Target maximum health'),current=input('attack','target:currentHp','Target current health'),r=calc('p','PExecutePercentage',s);
        row('Caustic Wounds',finite(hp)&&finite(current)&&finite(r.value)?Math.max(0,hp-current)*r.value:null,'magic',5,r.text+' × target missing HP');
      }
      if(name==='Lucian'&&toggle('p','lightslinger','Lightslinger procs enabled')){
        const interval=input('p','lightslingerInterval','Seconds between Lightslinger procs',{min:0.01}),normal=calc('p','TotalDamage',s),critical=calc('p','CritDamage',s);
        row('Lightslinger second shot',finite(normal.value)&&finite(critical.value)?normal.value*(1-chance)+critical.value*chance:null,'physical',1,normal.text+' (with average critical strikes)',{interval:finite(interval)&&interval>0?interval:null,onHit:false,extraHit:true});
      }
      if(name==='Teemo'&&rank('e')){const r=calc('e','TickCalculatedDamage',s);row('Toxic Shot poison (refreshes; does not stack)',r.value,'magic',1,r.text,{dot:true,duration:data('e','PoisonDuration')});}
      const active={
        MasterYi:['e','TotalDamage','Wuju Style','true'],
        Jax:['w','TotalDamage','Empower'],Vayne:['q','ADRatioBonus','Tumble','physical'],
        Sona:['q','TotalOnHitDamage','Hymn of Valor'],
        Shaco:['p','BasicAttackDamage','Backstab','physical'],
      };
      if(active[name]){
        const [slot,key,label,type]=active[name];
        if(toggle(slot,'championOnHit',label+' active')){
          const single=['Jax','Vayne','Sona'].includes(name),interval=single?input(slot,'onHitInterval','Seconds between '+label+' attacks',{min:0.01}):undefined;
          ability(slot,key,label,type,1,single?{interval:finite(interval)&&interval>0?interval:null,onHit:false}:{});
          if(name==='Shaco'&&finite(rows.at(-1).value))rows.at(-1).value=averageCrit(rows.at(-1).value,chance,crit);
        }
      }
      if(name==='KogMaw'&&toggle('w','championOnHit','Bio-Arcane Barrage active')){
        const fraction=calc('w','TotalHealthDamage',s),hp=values['attack:target:hp'];
        row('Bio-Arcane Barrage',finite(hp)&&finite(fraction.value)?hp*fraction.value:null,'magic',1,`${fraction.text} × target maximum HP`);
      }
      const replacement={Nasus:['q','TotalDamage','Siphoning Strike'],Trundle:['q','TotalDamage','Chomp'],Garen:['q','TotalDamage','Decisive Strike']};
      if(replacement[name]){
        const [slot,key,label]=replacement[name];
        if(toggle(slot,'empowered',label+' attacks enabled')){
          const interval=input(slot,'empoweredInterval','Seconds between '+label+' attacks',{min:0.01});
          const r=calc(slot,key,s);let total=r.value;
          if(name==='Nasus'){const critical=calc(slot,'CritDamage',s).value;total=finite(total)&&finite(critical)?total*(1-chance)+critical*chance:null;}
          row(label+' bonus over a normal attack',finite(total)?total-(name==='Nasus'?base:s.ad):null,'physical',1,r.text,{onHit:false,interval:finite(interval)&&interval>0?interval:null});
        }
      }
      if(name==='MasterYi'&&toggle('p','doubleStrike','Repeated attacks: Double Strike'))ability('p','TotalDamage','Double Strike','physical',data('p','AttackCount'),{onHit:false,extraHit:1});
      if(name==='Kayle'&&level>=11&&toggle('p','kayleWaves','Exalted: waves active'))ability('p','PassiveWaveDamage','Divine Ascent waves','magic',1,{onHit:false});
      if(['Vayne','KogMaw'].includes(name))input('attack','target:hp','Target maximum health');
      const extended=scope.AttackChampions?.profile({name,s,data,calc,rank,toggle,input,choice,row,values,rows,base,rate})||{base,rate,onHitScale:1,baseType:'physical',notes:[]};
      base=extended.base;rate=extended.rate;warnings.push(...extended.notes);
      const championRows=rows.length;
      let phantom=1;
      if(enabled(3032,'practice-makes-lethal'))input('attack','yunTalCrit','Yun Tal earned critical chance (%)',{max:itemData(3032,'CritMax')});
      if(enabled(3032,'flurry'))toggle('attack','flurry','Yun Tal Flurry active');
      if(enabled(3124,'seething-strike')){
        const stacks=input('attack','rageStacks','Guinsoo’s Rageblade stacks',{max:itemData(3124,'MaxStacks')??4});
        if(stacks>=itemData(3124,'MaxStacks'))phantom=4/3;
      }
      const always={1043:['OnHitDamage','Recurve Bow','physical','data','sting'],3115:['TotalOnHitDamage',"Nashor’s Tooth",'magic',null,'icathian-bite'],3091:['OnHitDamage',"Wit’s End",'magic',null,'fray'],3124:['OnHitDamage',"Guinsoo’s Rageblade",'magic','data','wrath'],3042:['OnHitDamage','Muramana','physical',null,'shock-on-hit'],3302:['OnHitDamage','Terminus','magic',null,'shadow'],3748:['OnHitDamageCalc','Titanic Hydra','physical',null,'cleave']};
      for(const id of equipped){
        if(always[id]){const [key,label,type='magic',source,passive]=always[id];if(!enabled(id,passive))continue;const r=source==='data'?{value:itemData(id,key),text:key}:evaluate(items[id],key,s);row(label,r.value,type,1,r.text,{itemId:Number(id),passiveKey:passive});}
      }
      if(enabled(3153,'mist-s-edge')){
        const hp=input('attack','target:currentHp','Target current health'),ratio=itemData(3153,ctx.ranged?'RangedValue':'MeleeValue');
        row('Blade of the Ruined King',finite(hp)&&finite(ratio)?hp*ratio:null,'physical',1,`${finite(ratio)?(ratio*100).toFixed(1)+'%':'ratio unavailable'} × target current HP`);
      }
      if(enabled(6672,'bring-it-down')){
        const amp=input('attack','krakenAmp','Kraken missing-health amplification (%)',{max:((itemData(6672,'MaxAmpNumber')??1)-1)*100});
        const r=evaluate(items[6672],'DamageAmount',s);row('Kraken Slayer (every third hit)',finite(r.value)?r.value*(1+(Number(amp)||0)/100):null,'physical',itemData(6672,'AttackCount')||3,r.text+' × selected amplification',{onHit:false});
      }
      const spellblade=[3057,3078,3100,6662,3508,3877,2510].filter(id=>enabled(id,'spellblade'));
      if(spellblade.length){
        if(toggle('attack','spellblade','Spellblade procs enabled')){
          // Spellblade effects share a group; choose the strongest eligible hit.
          const candidates=spellblade.map(id=>({id,r:evaluate(items[id],'SpellbladeDamage',s)}));
          const best=candidates.every(x=>finite(x.r.value))?candidates.reduce((a,b)=>a.r.value>b.r.value?a:b):candidates.find(x=>!finite(x.r.value));
          // The specific field is authoritative; older snapshots use Cooldown.
          const cooldown=[itemData(best.id,'SpellbladeCooldown'),itemData(best.id,'Cooldown'),1.5].find(value=>finite(value)&&value>0);
          const requested=input('attack','spellbladeInterval','Seconds between Spellblade attacks',{min:cooldown,defaultValue:cooldown,step:0.1});
          const interval=finite(requested)?Math.max(requested,cooldown):cooldown;
          row(state.items?.[best.id]?.name||'Spellblade',best.r.value,[3100,2510].includes(best.id)?'magic':'physical',1,best.r.text,{interval,onHit:false,spellbladeId:best.id,itemId:best.id,passiveKey:'spellblade',cooldown,extraHit:best.id===2510});
        }
      }
      const energized={3094:['BonusDamage','Rapid Firecannon','data','sharpshooter'],3095:['TotalProcDamage','Stormrazor',null,'bolt'],2015:['EnergizedDamage','Scout’s Slingshot','data','jolt'],3087:['ChainDamage','Statikk Shiv','data','electrospark']};
      for(const id of equipped)if(energized[id]&&enabled(id,energized[id][3])&&toggle('attack','proc'+id,(state.items?.[id]?.name||energized[id][1])+' procs enabled')){
        const interval=input('attack','interval'+id,'Seconds between '+energized[id][1]+' procs',{min:0.01});
        const [key,label,source]=energized[id],r=source==='data'?{value:itemData(id,key),text:key}:evaluate(items[id],key,s);
        row(label,r.value,'magic',1,r.text,{interval:finite(interval)&&interval>0?interval:null,onHit:false});
      }
      if(enabled(3504,'sanctify')&&toggle('attack','ardent','Ardent Censer buff active'))row('Sanctify',itemData(3504,'OnHitMin'));
      if(enabled(6699,'firmament')&&toggle('attack','voltaic','Voltaic Cyclosword procs enabled')){
        const hp=input('attack','target:currentHp','Target current health'),interval=input('attack','voltaicInterval','Seconds between Firmament procs',{min:0.01}),fraction=itemData(6699,ctx.ranged?'PercentCurrentHPRanged':'PercentCurrentHPMelee');
        row('Firmament',finite(hp)&&finite(fraction)?hp*fraction/100:null,'physical',1,'Current target HP × Firmament percentage',{interval:finite(interval)&&interval>0?interval:null,onHit:false});
      }
      if(enabled(3179,'nightstalker')&&toggle('attack','umbral','Umbral Glaive unseen procs enabled')){
        const interval=input('attack','umbralInterval','Seconds between unseen attacks',{min:0.01}),r=evaluate(items[3179],'ProcDamage',s);
        row('Umbral Glaive',r.value,'true',1,r.text,{interval:finite(interval)&&interval>0?interval:null,onHit:false});
      }
      if(enabled(3748,'titanic-crescent')&&toggle('attack','titanic','Titanic Crescent procs enabled')){
        const interval=input('attack','titanicInterval','Seconds between Titanic Crescent attacks',{min:itemData(3748,'Cooldown')??0.01}),r=evaluate(items[3748],'CalcValueC',s);
        row('Titanic Crescent',r.value,'physical',1,r.text,{interval:finite(interval)&&interval>0?interval:null,onHit:false});
      }
      if(enabled(3181,'skipper')){const r=evaluate(items[3181],'MaxStackDamage',s);row('Hullbreaker: Skipper',r.value,'physical',5,r.text,{onHit:false});}
      if(enabled(3742,'shipwrecker')&&toggle('attack','shipwrecker','Dead Man’s Plate procs enabled')){
        const stacks=input('attack','momentum','Momentum discharged per attack',{max:itemData(3742,'MaxStacks')}),interval=input('attack','momentumInterval','Seconds between Shipwrecker attacks',{min:0.01}),r=evaluate(items[3742],'MaxDamageCalc',s);
        row('Shipwrecker',finite(stacks)&&finite(r.value)?r.value*stacks/itemData(3742,'MaxStacks'):null,'physical',1,`${r.text} × momentum / maximum momentum`,{onHit:false,interval:finite(interval)&&interval>0?interval:null});
      }
      const fiendActive=enabled(2512,'opening-barrage')&&values['attack:fiendhunter']===true;
      const itemCritChance=name==='Jhin'?(3*chance+1)/4:chance;
      if(enabled(6610,'lightshield-strike')&&toggle('attack','sundered','Sundered Sky procs enabled')){
        const interval=input('attack','sunderedInterval','Seconds between Lightshield Strike attacks',{min:itemData(6610,'Cooldown')??0.01}),mod=itemData(6610,'CritModifier');
        const previous=fiendActive?crit*itemData(2512,'CritModifier'):1;
        row('Lightshield Strike bonus over average attack',finite(mod)?(name==='Ashe'?0:s.ad*(1-itemCritChance)*Math.max(0,crit*mod-previous)):null,'physical',1,'Non-critical chance × AD × additional forced-crit multiplier (shared forced crit does not stack)',{interval:finite(interval)&&interval>0?interval:null,onHit:false,attackDamage:true});
        if(fiendActive)row('Opening Barrage on Lightshield Strike',s.ad*crit*mod*(1-itemCritChance)*itemData(2512,'BonusTrueDamage'),'true',1,'Previously non-critical chance × Lightshield critical damage × Opening Barrage ratio',{interval:finite(interval)&&interval>0?interval:null,onHit:false});
      }
      if(enabled(2512,'opening-barrage')&&toggle('attack','fiendhunter','Fiendhunter Bolts post-ultimate attacks active')){
        const mod=itemData(2512,'CritModifier'),bonus=itemData(2512,'BonusTrueDamage');
        row('Opening Barrage physical bonus',finite(mod)?(name==='Ashe'?0:s.ad*(1-itemCritChance)*(crit*mod-1)):null,'physical',1,'Non-critical chance × AD × (Opening Barrage crit multiplier − 1)',{onHit:false,attackDamage:true});
        row('Opening Barrage true bonus',finite(bonus)?s.ad*crit*itemCritChance*bonus:null,'true',1,'Critical chance × critical damage × Opening Barrage true-damage ratio',{onHit:false});
      }
      const amplify=(factor,predicate,label)=>{for(const r of rows)if(predicate(r)){r.value=finite(r.value)&&finite(factor)?r.value*factor:null;r.formula=`(${r.formula||r.label}) × ${finite(factor)?factor.toFixed(4):'required input'} [${label}]`;}};
      rows.forEach((r,i)=>r.source=i<championRows?'champion':'item');
      if(name==='Zeri'&&values['attack:zeriRightClick'])rows.splice(championRows);
      if(name==='Camille'&&values['attack:precisionSpellblade']){
        const conversion=rows.find(r=>r.camilleConversion!==undefined)?.camilleConversion;
        for(const r of rows.filter(r=>r.spellbladeId&&r.type==='physical')){
          const amount=finite(r.value)&&finite(conversion)?r.value*conversion:null;
          rows.push({...r,label:r.label+' (Precision Protocol true portion)',value:amount,type:'true'});
          r.value=finite(r.value)&&finite(amount)?r.value-amount:null;
        }
      }
      if(enabled(3161,'focused-will')){
        const stacks=input('attack','shojinStacks','Focused Will stacks',{max:itemData(3161,'StackCount')}),factor=1+(Number(stacks)||0)*itemData(3161,'SpellDamageIncrease')*(ctx.ranged?itemData(3161,'RangedMod'):1);
        amplify(factor,r=>r.source==='champion'&&!r.replacementDebit,'Focused Will');
      }
      if(enabled(2523,'magnification')){
        const distance=input('attack','distance','Distance to target'),factor=finite(distance)?1+clamp(distance/itemData(2523,'MaxRange'),0,1)*itemData(2523,'MaxDamageAmp'):null;
        base=finite(base)&&finite(factor)?base*factor:null;
        // Magnification modifies the attack damage packet, not independent on-hits.
        amplify(factor,r=>r.attackDamage===true,'Magnification');
        warnings.push(`Magnification: attack damage × ${finite(factor)?factor.toFixed(4):'unavailable (enter distance)'}. Independent on-hit packets are not attack damage.`);
      }
      if(enabled(3036,'giant-slayer')){
        const hp=input('attack','target:bonusHp','Target bonus health'),factor=finite(hp)?1+clamp(hp/itemData(3036,'MaxBonusHealth'),0,1)*itemData(3036,'MaxBonusDamagePercent'):null;
        base=finite(base)&&finite(factor)?base*factor:null;
        amplify(factor,r=>r.type!=='true','Giant Slayer');
        warnings.push(`Giant Slayer: non-true damage × ${finite(factor)?factor.toFixed(4):'unavailable (enter target bonus HP)'}.`);
      }
      if(enabled(4645,'cinderbloom')&&toggle('attack','shadowflame','Shadowflame: target below health threshold')){
        const amp=itemData(4645,'SpellItemDamageAmp');for(const r of rows)if(['magic','true'].includes(r.type))r.value=finite(r.value)&&finite(amp)?r.value*(1+amp):null;
        if(['magic','true'].includes(extended.baseType))base=finite(base)&&finite(amp)?base*(1+amp):null;
      }
      const unsupported={Aphelios:'weapon-specific attacks',Graves:'pellets and reload',Zeri:'charged right-click and Q attacks',Kalista:'attack timing',Akshan:'double-shot timing',Sett:'alternating-punch timing',
        Belveth:'R true damage and special attack-speed rules',Bard:'meep availability and chime scaling',Braum:'Concussive Blows',Camille:'Precision Protocol conversion',Darius:'Hemorrhage and Noxian Might',DrMundo:'Blunt Force Trauma',Elise:'spider-form attacks',Fiora:'vitals and Bladework',Fizz:'Seastone Trident',Galio:'Colossal Smash',Gangplank:'Trial by Fire',Gnar:'Hyper and transformation stats',Illaoi:'Harsh Lesson',JarvanIV:'Martial Cadence',Jayce:'stance-specific attacks',Jinx:'Switcheroo and Get Excited',Kindred:'Mounting Dread',Nautilus:'Staggering Blow and Titan’s Wrath',Nidalee:'Takedown',Nilah:'Formless Blade',Nocturne:'Umbra Blades',Pantheon:'empowered Shield Vault',RekSai:'Queen’s Wrath',Renekton:'Ruthless Predator',Rengar:'Savagery and Bonetooth Necklace',Rumble:'Overheat',Sejuani:'Icebreaker',Shyvana:'form-specific attacks',Skarner:'Shattered Earth',Sylas:'Petricite Burst',Talon:'Blade’s End',Thresh:'Flay charge',Twitch:'Deadly Venom and Spray and Pray',Udyr:'stance-specific attacks',Urgot:'Purge and shotgun legs',Viktor:'Siphon Power',Zed:'Contempt for the Weak'};
      if(unsupported[name]&&!extended.covered)warnings.push(`${name}: ${unsupported[name]} are not yet modeled; this is a partial estimate.`);
      let damage=base,dps=finite(base)&&finite(rate)?base*rate:null;
      const formula=[`Average attack = ${s.ad.toFixed(2)} AD × (1 + ${(chance*100).toFixed(2)}% × (${crit.toFixed(3)} − 1))`,`${name==='Jhin'?'Magazine-adjusted':'Attack'} rate = ${finite(rate)?rate.toFixed(3):'unavailable'} attacks/s`];
      formula.push(`Stats: ${ctx.stats.baseAd.toFixed(2)} base AD + ${ctx.stats.bonusAd.toFixed(2)} bonus AD; ${s.ap.toFixed(2)} AP; ${s.hp.toFixed(2)} own HP; ${s.mp.toFixed(2)} own mana.`);
      if(Object.keys(ctx.targetStats).length)formula.push('Target: '+Object.entries(ctx.targetStats).map(([k,v])=>`${k} = ${v}`).join(', '));
      if(name==='Jhin')formula.push('Whisper: average the first three probabilistic critical strikes and a guaranteed fourth critical strike; add missing-health damage on the fourth shot. Rate = 4 / (3 / attack speed + reload seconds), excluding animation windup.');
      if(name==='Ashe')formula.push('Frost Shot replaces the ordinary critical-strike formula. Only frosted targets receive its damage bonus; Ranger’s Focus multiplies that attack when enabled.');
      formula.push(`Attack contribution after champion rules = ${finite(base)?base.toFixed(2):'unavailable'}`);
      const extraHitRates=rows.filter(r=>r.extraHit).map(r=>Object.hasOwn(r,'interval')?(finite(r.interval)&&r.interval>0&&finite(rate)?Math.min(rate,1/r.interval)*Number(r.extraHit):null):(finite(rate)&&r.cadence>0?rate/r.cadence*Number(r.extraHit):null));
      const extraHits=extraHitRates.some(r=>r===null)?null:extraHitRates.reduce((a,b)=>a+b,0);
      for(const r of rows){
        const multiplier=r.onHit===false||r.dot?1:extraHits===null?null:(phantom+(rate>0?extraHits/rate:0))*extended.onHitScale;
        let perHit=r.value===null||multiplier===null?null:r.value*multiplier/r.cadence;
        let perSecond=perHit===null||!finite(rate)?null:perHit*rate;
        if(Object.hasOwn(r,'interval')){
          perSecond=finite(r.interval)&&r.interval>0&&r.value!==null&&finite(rate)?r.value*Math.min(rate,1/r.interval):null;
          perHit=perSecond!==null&&rate>0?perSecond/rate:null;
        }
        if(r.dot){perSecond=r.value!==null&&finite(rate)?r.value*Math.min(1,rate*r.duration):null;perHit=perSecond!==null&&rate>0?perSecond/rate:null;}
        r.perHit=perHit;r.perSecond=perSecond;
        damage=damage!==null&&perHit!==null?damage+perHit:null;
        dps=dps!==null&&perSecond!==null?dps+perSecond:null;
        const proc=r.spellbladeId?`${finite(r.value)?r.value.toFixed(2):'unavailable'} ${r.type} per Spellblade proc; minimum cooldown ${r.cooldown}s, selected interval ${r.interval}s → `:'';
        formula.push(`${r.label}: ${r.formula||r.value} → ${proc}${perHit===null?'unavailable (enter required inputs / load data)':perHit.toFixed(2)} ${r.type} per attack${r.spellbladeId?' on average':''}${r.cadence>1?' (every '+r.cadence+' hits)':''}${multiplier!==1?' × phantom-hit average':''}`);
      }
      formula.push('DPS = average on-attack damage × effective attacks per second. Before mitigation; constant target health; continuous attacks on one champion. Enabled procs are averaged over their specified interval. This estimate includes the effects listed above; unlisted effects are not included.');
      if(phantom!==1)warnings.push('Rageblade assumes fully stacked, uninterrupted attacks.');
      formula.push(...warnings);
      return {autoAttackDamage:damage,attackDps:dps,attackRange:s.attackRange,rate,rows,controls:[...new Map(controls.map(c=>[c.key,c])).values()],warnings,partial:!!unsupported[name]&&!extended.covered,breakdown:formula.join('\n')};
    }
    return {apply,profile};
  }
  scope.AttackEffects={model,averageCrit,itemPassiveBindings};
})(typeof window!=='undefined'?window:globalThis);
