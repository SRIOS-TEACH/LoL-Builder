/** Champion attack scripts. Named game-data calculations supply balance values;
 * inputs describe the combat state (form, charges, hit frequency, target health).
 * These bindings never select an arbitrary damage calculation from a spell.
 */
(function(scope){
  const finite=Number.isFinite,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const covered=new Set('Aphelios Graves Zeri Kalista Akshan Sett Belveth Bard Braum Camille Darius DrMundo Elise Fiora Fizz Galio Gangplank Gnar Illaoi JarvanIV Jayce Jinx Kindred Nautilus Nidalee Nilah Nocturne Pantheon RekSai Renekton Rengar Rumble Sejuani Shyvana Skarner Sylas Talon Thresh Twitch Udyr Urgot Viktor Zed'.split(' '));
  function apply(a){
    const {name,s,data,calc,values,rank}=a,out={...s};
    const active=k=>values['attack:'+k]===true;
    const n=k=>Number(values['attack:'+k])||0;
    const add=(stat,v)=>{if(finite(v))out[stat]+=v;else out.attackStatsMissing=true;};
    const speed=v=>{if(!finite(v)){out.attackStatsMissing=true;return;}add('asTotal',(s.base.attackspeedratio??s.base.attackspeed)*v);out.bonusAttackSpeedFromChampion=(out.bonusAttackSpeedFromChampion||0)+v;};
    if(name==='Gnar')out.ranged=!active('mega');
    if(name==='Elise')out.ranged=!active('spider');
    if(name==='Nidalee')out.ranged=!active('cougar');
    if(name==='Jayce')out.ranged=active('cannon');
    if(name==='Darius'&&active('noxianMight'))add('ad',calc('p','NoxianMightBonusAD',out).value);
    if(name==='DrMundo'&&rank('e'))add('ad',calc('e','PassiveBonusAD',out).value);
    if(name==='Twitch'&&active('spray')&&rank('r'))add('ad',data('r','BonusAD'));
    if(name==='Rengar'){
      const stacks=Math.floor(clamp(n('bonetooth'),0,5)),bonus=[0,.01,.04,.09,.16,.25][stacks];
      const base=s.base.attackdamage+s.base.attackdamageperlevel*scope.BuildStats.growthFactor(s.level);
      add('ad',(out.ad-base)*bonus);
    }
    if(name==='Aphelios'){
      add('ad',clamp(n('apheliosAD'),0,6)*data('{267f31a5}','ADPerRank'));
      speed(clamp(n('apheliosAS'),0,6)*data('{267f31a5}','ASPerRank'));
    }
    if(name==='Gnar'){
      if(active('mega')){
        for(const [stat,key]of [['ad','TotalMegaGnarAD'],['hp','TotalMegaGnarHealth'],['armor','TotalMegaGnarArmor'],['mr','TotalMegaGnarMR']])add(stat,calc('p',key,out).value);
      }else {const bonus=calc('p','TotalAS',out).value;speed(finite(bonus)?bonus-s.base.attackspeedperlevel*scope.BuildStats.growthFactor(s.level)/100:NaN);}
    }
    if(name==='Jinx'&&rank('q')){
      if(!active('rockets'))speed(clamp(n('minigun'),0,data('q','MinigunAttackSpeedStacks'))/data('q','MinigunAttackSpeedStacks')*data('q','MinigunAttackSpeedMax')/100);
      if(active('rockets'))out.asTotal*=1-data('q','RocketASPDPenalty');
      if(active('excited'))out.asTotal*=1+data('p','ASBuff')/100;
    }
    if(name==='Belveth'&&active('trueForm')&&rank('r'))out.asTotal*=1+data('r','TotalASMod');
    if(name==='Sylas'&&active('petricite'))speed(data('p','PassiveAttackSpeed'));
    if(name==='Rumble'&&active('overheat'))speed(calc('p','OverheatAS',out).value);
    if(name==='RekSai'&&active('queensWrath')&&rank('q'))speed(data('q','AttackSpeed'));
    if(name==='Skarner'&&active('rock')&&rank('q'))speed(data('q','AttackSpeed'));
    if(name==='Udyr'&&active('wilding')&&rank('q'))speed(data('q','AttackSpeedBase'));
    if(name==='Yunara'&&active('cultivation')&&rank('q'))speed(calc('q','Calc_Attack_Speed',out).value);
    if(name==='Rengar'&&active('savagery')&&rank('q'))speed(active('savageryEmpowered')?calc('q','EmpoweredQAS',out).value:data('q','ASBonus')/100);
    if(name==='Nilah'&&active('formless')&&rank('q'))speed(calc('q','BonusAttackSpeedCalc',out).value/100);
    if(name==='Zeri'){
      const cap=data('q','AttackSpeedCap'),conversion=data('q','ExcessAttackSpeedToADMult');
      if(finite(cap)&&finite(conversion)){
        const ratio=s.base.attackspeedratio??s.base.attackspeed;
        add('ad',Math.max(0,(out.asTotal-cap)/ratio)*100*conversion);out.asTotal=Math.min(cap,out.asTotal);
      }else out.attackStatsMissing=true;
    }
    // Standard Summoner's Rift ceiling; the named uncapping passives are exceptions.
    // Riot 2025.S1.3 changed the displayed baseline ceiling to 3 attacks/second.
    const cap=name==='Belveth'?9999:name==='Jinx'&&active('excited')?90:3;
    out.asTotal=clamp(out.asTotal,.2,cap);
    return out;
  }
  function profile(a){
    const {name,s,data,calc,rank,toggle,input,row,values,rows}=a;
    let {base,rate}=a,onHitScale=1,baseType='physical';
    const notes=[],chance=s.critChance/100,crit=s.critDamage/100;
    const avg=v=>finite(v)?scope.AttackEffects.averageCrit(v,chance,crit):null;
    const v=(slot,key,r)=>calc(slot,key,s,r).value;
    const hp=(key='hp')=>input('attack','target:'+key,'Target '+({hp:'maximum health',currentHp:'current health',bonusHp:'bonus health'}[key]||key));
    const missing=()=>{const max=hp(),current=hp('currentHp');return finite(max)&&finite(current)?Math.max(0,max-current):null;};
    const times=(slot,key,label)=>input(slot,key,label,{min:.01});
    const proc=(slot,id,label,value,type='magic',extra={})=>{
      const interval=times(slot,id+'Interval','Seconds between '+label+' hits');
      row(label,value,type,1,extra.formula||label,{onHit:false,interval:finite(interval)&&interval>0?interval:null,...extra});
    };
    const damage=(slot,key,label,type='magic',cadence=1,extra={})=>{const r=calc(slot,key,s);row(label,r.value,type,cadence,r.text,extra);};
    const dot=(slot,key,label,type,duration,stacks=1)=>{const total=v(slot,key);row(label,finite(total)&&finite(duration)&&duration>0?total*stacks/duration:null,type,1,`${key} × stacks / ${duration}s`,{dot:true,duration});};
    const healthProc=(slot,id,label,key,type='magic',stat='hp')=>{
      if(toggle(slot,id,label+' procs enabled')){const health=stat==='missing'?missing():hp(stat),fraction=v(slot,key);proc(slot,id,label,finite(health)&&finite(fraction)?health*fraction:null,type,{formula:`${key} × target ${stat}`});}
    };
    if(name==='Caitlyn'){
      const brush=toggle('p','brush','Attacking from brush'),cadence=Math.ceil((data('p','AttacksPerHeadshot')+1)/(brush?1+data('p','BrushStackBonus'):1));
      damage('p','HeadShotBonusDamage','Headshot','physical',cadence,{onHit:false,attackDamage:true});
      if(toggle('w','trapHeadshot','Trap Headshots enabled'))proc('w','trapHeadshot','Yordle Snap Trap Headshot',v('w','HeadShotBonusDamage')+v('p','HeadShotBonusDamage'),'physical',{attackDamage:true});
    }
    if(name==='Yunara'){
      const amp=v('p','Calc_Damage_Amp');row('Vow of the First Lands',finite(amp)?s.ad*crit*chance*amp:null,'magic',1,'AD × critical multiplier × critical chance × passive ratio',{onHit:false});
      if(rank('q'))damage('q',toggle('q','cultivation','Cultivation of Spirit active')?'Calc_Damage':'Calc_Passive_Damage','Cultivation of Spirit');
    }
    if(name==='Samira'&&toggle('p','samiraMelee','Melee attacks')){const max=hp(),current=hp('currentHp'),d=v('p','BonusMeleeDamage');row('Daredevil Impulse',finite(max)&&max>0&&finite(current)&&finite(d)?d*(1+clamp(1-current/max,0,1)):null,'magic',1,'BonusMeleeDamage × (1 + target missing-health fraction)',{onHit:false});}
    if(name==='Darius'){
      toggle('p','noxianMight','Noxian Might active');
      const stacks=input('p','hemorrhage','Hemorrhage stacks',{max:data('p','MaxStacks')})??0;
      dot('p','BleedDamagePerStack','Hemorrhage','physical',data('p','BleedDuration'),stacks);
    }
    if(name==='DrMundo'&&toggle('e','bluntForce','Blunt Force Trauma enabled')){
      const missing=input('e','mundoMissing','Your missing health (%)',{max:100}),d=v('e','AdditionalDamage');
      const factor=finite(missing)?1+clamp(missing/100/data('e','MaxMissingHealthThreshold'),0,1)*(data('e','MaxDamageAmp')-1):null;
      proc('e','bluntForce','Blunt Force Trauma',finite(d)&&finite(factor)?d*factor:null,'physical');
    }
    if(name==='Bard'&&toggle('p','meeps','Meep attacks enabled')){
      const chimes=input('p','chimes','Chimes collected')??0,d=v('p','MeepDamageNoChime');
      proc('p','meeps','Traveler’s Call',finite(d)?d+Math.floor(chimes/data('p','TooltipChimeDamageCheckpoint'))*data('p','DamagePerCheckpoint'):null);
    }
    if(name==='Braum'){
      if(toggle('p','concussive','Concussive Blows stun procs enabled'))proc('p','concussive','Concussive Blows',v('p','TotalDamage'));
      if(toggle('p','concussiveImmune','Target in Concussive Blows immunity window'))damage('p','OnHitDamage','Concussive Blows follow-up');
    }
    if(name==='Belveth'){
      toggle('r','trueForm','True Form active');
      if(rank('r')){const stacks=input('r','belvethRamp','Royal Maelstrom existing same-target stacks')??0,d=v('r','FinalOnHitDamage');row('Royal Maelstrom',finite(d)?d*(stacks+1):null,'true',2,'(existing stacks + 1) × FinalOnHitDamage',{onHit:false});}
    }
    if(name==='Fiora'){
      healthProc('p','vital','Duelist’s Dance','PassiveDamageTotal','true');
      if(toggle('e','bladework','Bladework pair enabled')){
        const first=s.ad*data('e','AttackOnePercentTAD'),second=s.ad*(data('e','AttackTwoPercentTAD')+(s.item.critDamage+s.rune.critDamage)/100);
        proc('e','bladework','Bladework (two attacks)',first+second-2*base,'physical',{attackDamage:true});
      }
    }
    if(name==='Fizz'&&rank('w')){
      dot('w','DoTDamage','Seastone Trident bleed','magic',data('w','BleedDuration'));
      if(toggle('w','trident','Seastone Trident active'))damage('w','OnHitBuffDamage','Seastone Trident on-hit');
      if(toggle('w','tridentFirst','Seastone Trident empowered first hit'))proc('w','tridentFirst','Seastone Trident first-hit bonus',v('w','ActiveDamage')-(values['attack:trident']?v('w','OnHitBuffDamage'):0));
    }
    if(name==='Gangplank'&&toggle('p','trial','Trial by Fire procs enabled'))proc('p','trial','Trial by Fire',v('p','TotalDamage'),'true');
    if(name==='Galio'&&toggle('p','colossal','Colossal Smash procs enabled')){
      proc('p','colossal','Colossal Smash replacement',v('p','TotalDamage'),'magic');
      proc('p','colossal','Replaced ordinary attack',finite(base)?-base:null,'physical',{attackDamage:true,replacementDebit:true});
    }
    if(name==='Gnar'){
      const mega=toggle('p','mega','Mega Gnar form');
      if(!mega&&rank('w')){const max=hp(),d=v('w','MiniTotalDamage'),fraction=data('w','MiniPercentHPDamage');row('Hyper',finite(d)&&finite(max)&&finite(fraction)?d+max*fraction:null,'magic',3,'MiniTotalDamage + MiniPercentHPDamage × target HP');}
    }
    if(name==='Illaoi')healthProc('w','harshLesson','Harsh Lesson','HealthPercentTotal','physical');
    if(name==='JarvanIV'&&toggle('p','cadence','Martial Cadence procs enabled')){
      const current=hp('currentHp'),fraction=data('p','TooltipCurrentHealthDamage');
      proc('p','cadence','Martial Cadence',finite(current)&&finite(fraction)?Math.max(data('p','MinimumCadenceDamage'),current*fraction):null,'physical');
    }
    if(name==='Nautilus'){
      if(toggle('p','stagger','Staggering Blow procs enabled'))proc('p','stagger','Staggering Blow',v('p','BonusDamage'),'physical');
      if(toggle('w','titansWrath','Titan’s Wrath shield active'))damage('w','DotDamageCalc','Titan’s Wrath');
    }
    if(name==='Talon'&&toggle('p','bladesEnd','Blade’s End procs enabled'))proc('p','bladesEnd','Blade’s End',v('p','BleedDamage'),'physical');
    if(name==='Thresh'&&rank('e')){
      const elapsed=input('e','flayCharge','Seconds charged before each attack',{max:data('e','FullChargeDuration')})??0,min=v('e','PAttackDamageMin'),max=v('e','PAttackDamageMax');
      row('Flay',finite(min)&&finite(max)?min+(max-min)*clamp(elapsed/data('e','FullChargeDuration'),0,1):null,'magic',1,'minimum + (maximum − minimum) × charge fraction');
    }
    if(name==='Twitch'){
      toggle('r','spray','Spray and Pray active');
      const stacks=input('p','venomStacks','Deadly Venom stacks',{max:data('p','MaxStacks')})??0,d=v('p','DamagePerSecond');
      row('Deadly Venom',finite(d)?d*stacks:null,'true',1,'DamagePerSecond × stacks',{dot:true,duration:data('p','Duration')});
    }
    if(name==='Rumble'&&toggle('p','overheat','Overheat active')){
      const max=hp(),d=v('p','TotalBaseDamage'),fraction=data('p','OverheatPercBonusDamage');
      row('Overheat',finite(d)&&finite(max)&&finite(fraction)?d+fraction*max:null,'magic',1,'TotalBaseDamage + OverheatPercBonusDamage × target HP');
    }
    if(name==='Sejuani')healthProc('p','icebreaker','Icebreaker','PercentHPDamage');
    if(name==='Skarner'){
      if(toggle('p','quaking','Quaking sustained three-stack damage')){const max=hp(),fraction=v('p','PercentHealthDamage'),duration=data('p','Duration');row('Quaking',finite(max)&&finite(fraction)&&duration>0?max*fraction/duration:null,'magic',1,'target HP × PercentHealthDamage / duration',{dot:true,duration});}
      if(toggle('q','rock','Shattered Earth active')){damage('q','AbilityDamage','Shattered Earth attacks','physical');const max=hp();row('Shattered Earth third attack',finite(max)?max*data('q','MaxHPPercent'):null,'physical',3,'MaxHPPercent × target HP',{onHit:false});}
    }
    if(name==='RekSai'&&toggle('q','queensWrath','Queen’s Wrath active'))damage('q','TotalDamageTooltip','Queen’s Wrath','physical');
    if(name==='Sylas'&&toggle('p','petricite','Petricite Burst attacks active')){base=v('p','PassiveDamage');baseType='magic';}
    if(name==='Viktor'&&toggle('q','siphon','Siphon Power attacks enabled')){
      proc('q','siphon','Siphon Power replacement',v('q','AttackTotalDMG'),'magic');proc('q','siphon','Replaced ordinary attack',finite(base)?-base:null,'physical',{attackDamage:true,replacementDebit:true});
    }
    if(name==='Zed'&&toggle('p','contempt','Contempt for the Weak procs enabled')){
      const max=hp(),current=hp('currentHp'),fraction=v('p','MaxHPDamage');
      proc('p','contempt','Contempt for the Weak',finite(max)&&finite(current)&&finite(fraction)?(current<max*data('p','CurrentHealthThreshold')?max*fraction:0):null);
    }
    if(name==='Camille'&&toggle('q','precision','Precision Protocol pair enabled')){
      const first=v('q','BonusDamage'),second=v('q','EmpoweredBonusDamage'),rawConversion=v('q','DamageConversionPercentage'),conversion=finite(rawConversion)?clamp(rawConversion,0,1):null;
      proc('q','precision','Precision Protocol Q1 bonus',finite(first)?s.ad+first-base:null,'physical',{attackDamage:true});
      proc('q','precision','Precision Protocol Q2 physical',finite(second)&&finite(conversion)?(s.ad+second)*(1-conversion)-base:null,'physical',{attackDamage:true});
      proc('q','precision','Precision Protocol Q2 true damage',finite(second)&&finite(conversion)?(s.ad+second)*conversion:null,'true',{attackDamage:true,camilleConversion:conversion});
      toggle('q','precisionSpellblade','Spellblade procs coincide with empowered Q2');
    }
    if(name==='Nocturne'&&toggle('p','umbra','Umbra Blades procs enabled')){
      const normal=v('p','TotalDamageNoCrit'),critical=v('p','TotalDamageCrit');
      proc('p','umbra','Umbra Blades bonus',finite(normal)&&finite(critical)?normal*(1-chance)+critical*crit*chance-base:null,'physical',{attackDamage:true});
    }
    if(name==='Renekton'&&toggle('w','ruthless','Ruthless Predator enabled')){
      const empowered=toggle('w','ruthlessEmpowered','Empowered Ruthless Predator'),d=v('w',empowered?'EmpTotalDamage':'BasicTotalDamage');
      proc('w','ruthless','Ruthless Predator replacement',finite(d)?d-base:null,'physical',{extraHit:empowered?2:1,attackDamage:true});
    }
    if(name==='Pantheon'&&toggle('w','shieldVault','Empowered Shield Vault attacks enabled')){
      const multiplier=v('w','EmpoweredDamageMultCalcModified');
      proc('w','shieldVault','Shield Vault triple attack',finite(multiplier)?base*(multiplier-1):null,'physical',{extraHit:2,attackDamage:true});
    }
    if(name==='Rengar'){
      input('p','bonetooth','Bonetooth Necklace trophies',{max:5});
      if(toggle('q','savagery','Savagery enabled')){const empowered=toggle('q','savageryEmpowered','Empowered Savagery'),d=v('q',empowered?'EmpoweredQTotalDamage':'QTotalDamage');proc('q','savagery','Savagery bonus',finite(d)?d-s.ad:null,'physical',{attackDamage:true});}
    }
    if(name==='Kindred'&&toggle('e','mountingDread','Mounting Dread procs enabled')){
      const health=missing(),flat=v('e','BaseBiteDamage'),fraction=v('e','PercentBiteDamage');
      proc('e','mountingDread','Mounting Dread',finite(flat)&&finite(fraction)&&finite(health)?flat+fraction*health:null,'physical');
    }
    if(name==='Nidalee'&&toggle('r','cougar','Cougar form')){
      if(toggle('q','takedown','Takedown enabled')){const max=hp(),current=hp('currentHp'),d=v('AspectOfTheCougar','TotalTakedownDamage',Math.max(1,rank('r'))),hunted=toggle('q','hunted','Hunted target');
        const amp=data('r','TakedownDamageAmp');
        proc('q','takedown','Takedown replacement',finite(d)&&finite(max)&&max>0&&finite(current)?d*(1+Math.min(2,Math.max(0,1-current/max)*2))* (hunted?amp:1):null,'magic');
        proc('q','takedown','Replaced ordinary attack',finite(base)?-base:null,'physical',{attackDamage:true,replacementDebit:true});
      }
    }
    if(name==='Elise'&&toggle('r','spider','Spider form'))damage('r','PassiveTotalDamage','Spider form on-hit');
    if(name==='Jayce'){
      const cannon=toggle('r','cannon','Cannon stance');
      if(cannon&&toggle('w','hyperCharge','Hyper Charge active')){base=avg(v('JayceHyperCharge','ActualDamage',Math.max(1,rank('w'))));rate=3;}
      if(!cannon&&toggle('r','hammerFirst','First hammer attack enabled'))proc('r','hammerFirst','Mercury Hammer first attack',v('JayceStanceHtG','Damage'));
    }
    if(name==='Jinx'){
      toggle('p','excited','Get Excited active');
      if(toggle('q','rockets','Fishbones rockets'))base=avg(v('q','RocketDamage'));
      else input('q','minigun','Pow-Pow stacks',{max:data('q','MinigunAttackSpeedStacks')});
    }
    if(name==='Nilah')toggle('q','formless','Formless Blade buff active');
    if(name==='Udyr'&&toggle('q','wilding','Wilding Claw stance')){
      damage('q','OnHitDamage','Wilding Claw stance on-hit','physical');
      if(toggle('q','clawFirst','First two Wilding Claw attacks enabled')){const awakened=toggle('q','awakened','Awakened Wilding Claw'),max=hp(),fraction=v('q',awakened?'Q2TotalOnHitHPDamage':'MaxHPOnHit1');proc('q','clawFirst','Wilding Claw empowered pair',finite(max)&&finite(fraction)?2*max*fraction:null,'physical');
        if(awakened){const bounces=input('q','clawBounces','Lightning hits on this target per empowered attack',{min:1,max:data('q','Bounces')})??1,lightning=v('q','EmpoweredLightningBonus');proc('q','clawFirst','Awakened lightning pair',finite(max)&&finite(lightning)?2*max*lightning*bounces:null,'magic');}
      }
    }
    if(name==='Shyvana'){
      const dragon=toggle('r','dragon','Dragon form');
      if(toggle('q','shyvanaQ','Shyvana Q attacks enabled')){const d=v('q',dragon?'Calc_Dragon_Form_Damage':'Calc_Damage'),max=hp(),fraction=v('q','Calc_Max_Health_Damage');proc('q','shyvanaQ','Shyvana Q replacement',finite(d)&&finite(max)&&finite(fraction)?d+max*fraction-base:null,'physical',{attackDamage:true});}
    }
    if(name==='Urgot'){
      if(toggle('w','purge','Purge active')){base=v('w','DamagePerShot');rate=data('w','WAttacksPerSecond');onHitScale=data('w','OnHitDamageReduction');}
      if(toggle('p','shotgun','Echoing Flames procs enabled')){const max=hp(),flat=v('p','ADDamage'),fraction=v('p','PercentHPRatio');proc('p','shotgun','Echoing Flames',finite(max)&&finite(flat)&&finite(fraction)?flat+max*fraction:null,'physical');}
    }
    if(name==='Zeri'){
      // Burst Fire is Zeri's attack. Right-click is a spell and never crits/on-hits.
      if(toggle('q','zeriRightClick','Use right-click zap instead of Burst Fire')){const charged=toggle('q','zeriCharged','Fully charged zap');base=v('q',charged?'PassiveMaxDamage':'MinDamage');baseType='magic';onHitScale=0;if(charged){const max=hp(),fraction=v('q','PassiveMaxChargePercentHealth');base=finite(base)&&finite(max)&&finite(fraction)?base+max*fraction:null;}notes.push('Right-click zap is spell damage and does not apply attack on-hit items.');}
      else base=avg(v('q','ActiveDamageThatCanCrit'));
    }
    if(name==='Graves'){
      const pellets=input('p','pellets','Normal pellets hitting target',{min:1,max:4})??4,critPellets=input('p','critPellets','Critical pellets hitting target',{min:1,max:6})??6;
      const first=v('p','SingleBulletDamage'),extra=v('p','MultiBulletDamage'),critBonus=v('p','CritDamageMult');
      base=finite(first)&&finite(extra)&&finite(critBonus)?(first+(pellets-1)*extra)*(1-chance)+(first+(critPellets-1)*extra)*(1+critBonus)*chance:null;
      const reload=times('p','reload','Reload duration (seconds; affected by attack speed)');rate=finite(reload)?2/(1/rate+reload):null;
    }
    if(name==='Sett')rate=2/(1/rate+1/(rate*(1+data('p','AttackSpeed'))));
    if(name==='Kalista'&&toggle('p','martialPoise','Martial Poise hopping')){const cycle=times('p','hopCycle','Seconds between attacks while hopping');rate=finite(cycle)?Math.min(rate,1/cycle):null;}
    if(name==='Akshan'){
      damage('p','PassiveProcDamage','Dirty Fighting three-hit damage','magic',3);
      if(toggle('p','secondShot','Fire Dirty Fighting second shot')){const d=v('p','SecondAutoDamage'),interval=times('p','secondShotInterval','Seconds between double-shot pairs');row('Dirty Fighting second shot',avg(d),'physical',1,'SecondAutoDamage with average crit',{onHit:false,extraHit:1,interval:finite(interval)?interval:null});}
    }
    if(name==='Aphelios'){
      input('p','apheliosAD','AD upgrade ranks',{max:6});input('p','apheliosAS','Attack-speed upgrade ranks',{max:6});
      const weapon=a.choice('p','weapon','Main-hand weapon',['Calibrum','Severum','Gravitum','Infernum','Crescendum']);
      const aliases=['{9501e989}','{c872c72d}','{b3ce4169}','{d29e7023}','{ad4cfba9}'];
      base=avg(v(aliases[weapon],'AttackDamage'));
      if(weapon===0&&toggle('q','calibrumMark','Consume Calibrum mark'))proc('q','calibrumMark','Calibrum mark bonus',v(aliases[0],'BonusDamagePerMark'),'physical');
      if(weapon===4){const n=input('p','chakrams','Mirror chakrams',{max:20})??0,max=data(aliases[4],'MiniDamageRatioMax'),min=data(aliases[4],'MiniDamageRatioMin'),decrement=data(aliases[4],'MiniDamageRatioDecPer');let ratio=0;for(let i=0;i<n;i++)ratio+=Math.max(min,max-i*decrement);row('Crescendum mirror chakrams',avg(s.ad*ratio),'physical',1,'AD × sum of diminishing mirror ratios × average crit',{onHit:false,attackDamage:true});const cycle=times('p','chakramCycle','Seconds between Crescendum attacks (return flight included)');rate=finite(cycle)?1/cycle:null;}
    }
    return {base,rate,onHitScale,baseType,notes,covered:covered.has(name)};
  }
  scope.AttackChampions={apply,profile,covered};
})(typeof window!=='undefined'?window:globalThis);
