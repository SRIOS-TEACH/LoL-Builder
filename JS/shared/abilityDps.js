/** Damage per cooldown, before mitigation. See docs/DPS.md for timing conventions. */
(function (scope) {
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const fmt = value => finite(value) ? (Math.round(value * 10) / 10).toFixed(1) : 'Value unavailable';
  const plain = text => String(text || '').replace(/<[^>]*>/g, '').trim();
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const amount = (value, text) => ({value:finite(value) ? value : null, text:text || fmt(value)});
  const multiply = (a, n) => amount(finite(a.value) && finite(n) ? a.value * n : null,
    finite(n) ? `${fmt(n)} × (${a.text})` : 'Value unavailable');
  const sum = values => amount(values.every(a=>finite(a.value)) ? values.reduce((n,a)=>n+a.value,0) : null,
    values.map(a=>`(${a.text})`).join(' + '));

  function cooldown(spell, rank, stats = {}, payload) {
    if (!(rank > 0)) return null;
    const values = spell.cooldown || String(spell.cooldownBurn || '').split('/').map(Number);
    const base = Number(values[Math.min(rank - 1, values.length - 1)]);
    if (!finite(base) || base <= 0) return null;
    // Steel Tempest / Mortal Steel use bonus attack speed, not ability haste.
    if (['YasuoQ1Wrapper','YoneQ'].includes(spell.id)) {
      return Math.max(1.33, base * (1 - Math.min(2/3, Math.max(0, stats?.bonusAttackSpeed || 0) * 0.6)));
    }
    if (payload?.spellData?.mSpellTags?.includes('Trait_NotBenefitFromHaste')) return base;
    return base / (1 + Math.max(0, stats?.haste || 0) / 100);
  }

  function cycleTime(cooldown, delays = [], starts = 'last') {
    if (!finite(cooldown) || cooldown <= 0 || delays.some(d=>!finite(d) || d < 0)) return null;
    const elapsed = delays.reduce((a,b)=>a+b,0);
    return starts === 'first' ? Math.max(cooldown, elapsed) : cooldown + elapsed;
  }

  // Only typed damage passages are candidates; never choose a formula by a fuzzy name.
  // Preserve percentages/target-health expressions as formulas instead of treating them as flat damage.
  function components(tooltip, resolve) {
    const rows = [];
    tooltip=tooltip.replace(/<(physicalDamage|magicDamage|trueDamage)>\s*(\{\{[^}]+\}\})\s*(?:to|and|-)\s*(\{\{[^}]+\}\})\s*((?:physical|magic|true) damage)\s*<\/\1>/gi,
      (_,type,low,high,unit)=>`<${type}>${low} ${unit}</${type}> to <${type}>${high} ${unit}</${type}>`);
    for (const match of tooltip.matchAll(/<(physicalDamage|magicDamage|trueDamage)>([\s\S]*?)<\/\1>/gi)) {
      const raw = match[2];
      if (/attack damage|damage reduction|damage (?:is )?reduced|damage amplification|\bmana\b/i.test(plain(raw))) continue;
      if (/suffers\s*$/i.test(plain(tooltip.slice(Math.max(0,match.index-60),match.index)))) continue;
      const tokens = [...raw.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)];
      if (!tokens.length && !/\d/.test(plain(raw))) continue;
      const resolved = tokens.map(m=>resolve(m[1]));
      const text = plain(raw.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_,key)=> {
        const r=resolve(key); return r ? (finite(r.numeric) ? fmt(r.numeric)+(r.isPercent?'%':'') : plain(r.html)) : 'Value unavailable';
      }));
      const skeleton = plain(raw.replace(/\{\{[^}]+\}\}/g, '#'))
        .replace(/\b(?:physical|magic|magical|true|bonus|additional|extra|total|damage)\b/gi,'').trim().replace(/\.$/,'').trim();
      // A complete scalar, or an explicit sum of scalar terms. Other grammar remains symbolic.
      let value = null;
      if (/^#(?:\s*\+\s*#)*$/.test(skeleton) && resolved.every(r=>r && finite(r.numeric) && !r.isPercent)) {
        value = resolved.reduce((n,r)=>n+r.numeric,0);
      } else if (/^\d+(?:\.\d+)?$/.test(skeleton)) value = Number(skeleton);
      const label = tokens.length ? tokens.map(m=>m[1].replace(/^spell\.[^:]+:/i,'').replace(/(?:tooltiponly|tooltip|calc)$/i,'')
        .replace(/([a-z])([A-Z])/g,'$1 $2').replace(/(total|bonus|empowered|minimum|maximum|initial|recast|damage|basic|second|first|third|missile|strike|per|stack)/gi,' $1 ').replace(/_/g,' ').replace(/\s+/g,' ').trim()).join(' + ') : 'Damage';
      const identity=match[1].toLowerCase()+':'+raw.trim();
      let damage=amount(value,text);
      const after=plain(tooltip.slice(match.index+match[0].length));
      if(/per second/i.test(text)||/^per second\b/i.test(after)) {
        const duration=after.match(/^per second for\s*\{\{\s*([^}]+)\s*\}\}\s*seconds/i);
        damage=duration?multiply(damage,resolve(duration[1])?.numeric):amount(null,`(${text}) × active duration in seconds`);
      }
      if (!rows.some(r=>r.identity===identity)) rows.push({label,damage,identity});
    }
    return rows;
  }

  // These sequences have distance/attack-dependent intervals not supplied by the spell record.
  const timedSequences={
    AkaliE:['E1Damage','E2DamageCalc'], KledE:['TotalDamage','TotalDamage'],
    VexR:['RDamageCalc','RecastDamageCalc'], OrnnR:['RDamageCalc','RDamageCalc'],
    RenektonSliceAndDice:['BasicDamage','BasicDamage'], LeeSinQOne:['InitialDamage','RecastDamage'],
  };
  function timingFields(id,slot) {
    if(!timedSequences[id])return [];
    return [
      {key:`dps:${slot}:delay`,slot,kind:'number',label:'Time between casts (seconds)',owners:['Combined ability DPS']},
      {key:`dps:${slot}:overlap`,slot,boolean:true,label:'Cooldown runs during recasts',owners:['Combined ability DPS']},
    ];
  }

  function profile({spell, rank, cooldown:cd, tooltip = '', resolve, payload, timing = {}}) {
    if (!(rank > 0)) return {status:'Unlearned',rows:[]};
    const token = name => {
      const r=resolve(name);
      return amount(r?.numeric, r ? plain(r.html) : 'Value unavailable');
    };
    const number = name => token(name).value;
    const rows=[];
    const add=(label,damage,sweet=null,period=cd)=>rows.push({label,damage,sweet,period});
    let note='Damage ÷ cooldown; before mitigation. Separate outcomes are not added together.';
    const combined=(damage,delays,starts='last',sweet=null,label='Combined total')=> {
      const period=cycleTime(cd,delays,starts);
      add(label,damage,sweet,period);
      note=`Combined cycle: ${finite(cd)?cd.toFixed(2):'?'}s cooldown ${starts==='first'?'overlaps':'+'} ${delays.map(d=>finite(d)?d.toFixed(2):'?').join(' + ')}s between casts. Before mitigation.`;
    };
    if(timedSequences[spell.id]){
      const hits=timedSequences[spell.id].map(token);
      hits.forEach((hit,i)=>add(i===0?'First cast / minimum':'Recast',hit));
      const period=typeof timing.overlap==='boolean'?cycleTime(cd,[timing.delay],timing.overlap?'first':'last'):null;
      add('Combined total',sum(hits),null,period);
      rows[rows.length-1].timingMissing=period===null;
      if(['RenektonSliceAndDice','LeeSinQOne'].includes(spell.id)) {
        const alternative=token(spell.id==='LeeSinQOne'?'EmpoweredDamage':'EmpDamage');
        add('Empowered recast',alternative);
        add('Combined empowered',sum([hits[0],alternative]),null,period);
        rows[rows.length-1].timingMissing=period===null;
      }
      note='Combined damage includes both casts. Enter the cast interval and whether cooldown overlaps it to calculate the full cycle. Before mitigation; excludes resets and extra procs.';
    } else switch(spell.id) {
      case 'AatroxQ': {
        const base=token('QDamage'),edge=token('QEdgeDamage'),ramp=number('QRampBonus');
        const hits=[0,1,2].map(i=>multiply(base,finite(ramp)?1+i*ramp:null));
        const edges=[0,1,2].map(i=>multiply(edge,finite(ramp)?1+i*ramp:null));
        hits.forEach((hit,i)=>add(i===0?'Q1 / minimum':`Q${i+1}`,hit,edges[i]));
        combined(sum(hits),[1,1],'last',sum(edges));
        note+=' Parentheses: sweet spot. Q2/Q3 use 1 + 1/2 × the live ramp bonus.';
        break;
      }
      case 'ZiggsR':
        add('Outer blast (centre)',token('BlastDamage'),token('EmpoweredDamage'));
        note='Damage ÷ cooldown; parentheses show centre sweet-spot damage and DPS. Before mitigation.';
        break;
      case 'DariusCleave':
        add('Handle (blade edge)',token('HandleDamage'),token('BladeDamage'));break;
      case 'XerathArcaneBarrage2':
        add('Outer blast (centre)',token('TotalDamage'),token('SweetSpotTotalDamage'));break;
      case 'LilliaQ':
        add('Inner hit (outer edge)',token('TotalDamage'),sum([token('TotalDamage'),token('BonusTrueDamage')]));break;
      case 'YasuoQ1Wrapper':
      case 'YoneQ':
        add('Basic Q',token(spell.id==='YoneQ'?'QDamage':'TotalDamage'));
        add(spell.id==='YoneQ'?'Empowered Q / dash':'Q3 / whirlwind',token(spell.id==='YoneQ'?'QDamage':'TotalDamage'));
        if(spell.id==='YasuoQ1Wrapper')add('Q during E / circular strike',token('TotalDamage'));
        note='Damage ÷ attack-speed-adjusted cooldown. Empowered Q requires two prior hits; each row describes one cast. Before mitigation.';
        break;
      case 'AhriR': {
        const damage=token('RCalculatedDamage'),count=number('RMaxCasts'),delay=number('RDashCooldown');
        add('One dash / minimum',damage);
        if(finite(count)&&count>=1&&count<=10)combined(multiply(damage,count),Array(count-1).fill(delay),'first');
        note+=' One hit per target per dash; excludes takedown resets.';
        break;
      }
      case 'RivenTriCleave': {
        const damage=token('FirstSlashDamage');
        add('Q1 / minimum',damage);add('Q2',damage);add('Q3',damage);
        combined(multiply(damage,3),[0.5,0.5],'first');
        break;
      }
      case 'CamilleQ': {
        const base=token('BonusDamage'),empowered=token('EmpoweredBonusDamage');
        add('Q1 bonus / minimum',base);add('Empowered Q2 bonus',empowered);
        combined(sum([base,empowered]),[number('QRampUpTime')],'last');
        note+=' Bonus damage only; excludes the underlying attacks.';
        break;
      }
      case 'AkaliR': {
        const first=token('Cast1Damage'),low=token('Cast2DamageMin'),high=token('Cast2DamageMax');
        add('R1 / minimum',first);add('R2 minimum',low);add('R2 maximum',high);
        combined(sum([first,low]),[number('CooldownBetweenCasts')],'first',null,'Combined minimum');
        add('Combined maximum',sum([first,high]),null,cycleTime(cd,[number('CooldownBetweenCasts')],'first'));
        break;
      }
      case 'GwenR': {
        const hits=['TotalDamage','TotalDamage3','TotalDamage5'].map(token);
        hits.forEach((hit,i)=>add(`R${i+1}${i===0?' / minimum':''}`,hit));
        combined(sum(hits),[number('LockoutTime'),number('LockoutTime')],'first');
        note+=' Excludes A Thousand Cuts procs.';break;
      }
      case 'NaafiriQ': {
        const first=token('TotalDamageFirstCast'),bleed=token('TotalBleedDamage'),low=token('TotalMinDamageSecondCast'),high=token('TotalMaxDamageSecondCast');
        add('First hit / minimum',first);add('First hit + full bleed',sum([first,bleed]));
        add('Second hit minimum',low);add('Second hit maximum',high);
        combined(sum([first,bleed,low]),[number('RecastLockout')],'first',null,'Combined minimum');
        add('Combined maximum',sum([first,bleed,high]),null,cycleTime(cd,[number('RecastLockout')],'first'));
        note+=' Counts the bleed once, including the remainder consumed by Q2; excludes Packmates.';break;
      }
      case 'ZaahenQ': {
        const first=token('InitialDamage'),second=token('SecondHitDamage');
        add('First cast bonus / minimum',first);add('Recast bonus',second);
        combined(sum([first,second]),[number('TimeBetweenAttacks')],'last');
        note+=' Bonus damage only; excludes underlying attacks.';break;
      }
      case 'XerathLocusOfPower2': {
        const hit=token('TooltipTotalDamage'),ramp=token('RampDamageCalc'),count=number('NumberOfShots');
        add('One shot / minimum',hit);
        if(finite(count)&&count>=1&&count<=10){
          const hits=Array.from({length:count},(_,i)=>sum([hit,multiply(ramp,i)]));
          combined(sum(hits),Array(count-1).fill(number('CDPerShot')),'last');
          note+=' Assumes every shot hits the same champion, with no other champions hit.';
        }break;
      }
      case 'GarenE': {
        const hit=token('TotalDamage'),bonus=number('NearestEnemyBonus'),count=number('f1');
        add('One spin / minimum',hit,multiply(hit,finite(bonus)?1+bonus:null));
        add('Full duration',multiply(hit,count),multiply(hit,finite(bonus)&&finite(count)?count*(1+bonus):null));
        note='Damage ÷ cooldown; parentheses show nearest-target damage. Full duration uses the current build’s number of spins. Before mitigation.';break;
      }
      case 'YoneR':
        add('Physical + magic total',multiply(token('TooltipDamage'),2));break;
      case 'GwenQ':
        add('No stacks / minimum',sum([token('MiniSwipeDamage'),token('FinalSwipeDamage')]));add('Four stacks',token('MaxDamage'));break;
      case 'YuumiR':
        add('One wave / minimum',token('TotalMissileDamage'));add('All waves',token('MultiMissileTotal'));break;
      case 'AhriQ':
        add('Outgoing / minimum',token('TotalDamage'));add('Return',token('TotalDamage'));
        add('Combined total',multiply(token('TotalDamage'),2));break;
      case 'AhriW':
        add('First fox-fire / minimum',token('SingleFireDamage'));
        add('All three fox-fires',sum([token('SingleFireDamage'),multiply(token('MultiFireDamage'),2)]));break;
      case 'AatroxW':
        add('Initial hit / minimum',token('WDamage'));add('Hit + pull',multiply(token('WDamage'),2));break;
      case 'RenektonReignOfTheTyrant':
        add('Full duration',multiply(token('TotalDamagePerSecond'),number('BuffDuration')));break;
      case 'Bushwhack':
        add('Full bleed duration',multiply(token('DamagePerSecond'),number('DotDuration')));break;
      default:
        components(tooltip,resolve).forEach(row=>add(row.label,row.damage));
    }
    if (!rows.length) {
      // Absence of a typed number does not prove there is no damaging mechanic.
      const utility=['AatroxE','AatroxR','FerociousHowl','AurelionSolW','BraumE','DariusAxeGrabCone','EliseHumanE','GarenW','EyeOfTheStorm','Meditate','MissFortuneViciousStrikes','MordekaiserW','NaafiriR','NilahW','OlafRagnarok','RyzeR','SeraphineW','SonaW','SonaE','TahmKenchE','TaliyahR','TryndamereQ','TryndamereW','TwitchFullAutomatic','VayneInquisition','WarwickE','YuumiE','LockeW'];
      const damaging=!utility.includes(spell.id)&&(payload?.spellData?.mSpellTags?.includes('Trait_DamageAbility') || /\bdamage\b/i.test(plain(tooltip)));
      return {status:damaging?'Damage formula unavailable':'No direct damage',rows:[]};
    }
    if(rows.some(r=>r.sweet)&&!note.includes('Parentheses')&&!note.includes('parentheses'))note+=' Parentheses show the sweet-spot outcome.';
    return {rows,note:note+(rows.some(r=>r.damage.value===null)?' Target-dependent or unresolved damage stays symbolic.':'')};
  }

  function render(result) {
    if (!result.rows.length) return `<div class="ability-dps"><strong>Damage:</strong> ${escape(result.status)}</div>`;
    const damage=a=>finite(a.value)?fmt(a.value):a.text;
    const dps=(a,period)=>!finite(period)||period<=0?'Unavailable (no repeat cooldown)':finite(a.value)?fmt(a.value/period):`(${a.text}) ÷ ${period.toFixed(2)}s`;
    return `<div class="ability-dps"><strong>Damage</strong><table class="ability-dps-table"><thead><tr><th>Part</th><th>Damage</th><th>DPS</th></tr></thead><tbody>${result.rows.map(r=>`<tr><td>${escape(r.label)}</td><td>${escape(damage(r.damage))}${r.sweet?` (${escape(damage(r.sweet))})`:''}</td><td>${r.timingMissing?'Enter recast timing':escape(dps(r.damage,r.period))}${r.sweet?` (${escape(dps(r.sweet,r.period))})`:''}</td></tr>`).join('')}</tbody></table><small>${escape(result.note)}</small></div>`;
  }
  const api={cooldown,cycleTime,components,profile,render,timingFields};
  scope.AbilityDps=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
