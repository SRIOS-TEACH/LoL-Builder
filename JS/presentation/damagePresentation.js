/** Formatting of already evaluated damage packets; never used as numeric input. */
(function(scope){
 const finite=value=>typeof value==='number' && Number.isFinite(value);
 const fmt=value=>finite(value)?(Math.round(value*10)/10).toFixed(1):'Value unavailable';
 const text=scope.TextValues || (typeof require==='function'?require('../core/text.js'):null);
 const escape=value=>text.escapeHtml(String(value));
  function render(result) {
    if (!result.rows.length) return `<div class="ability-dps"><strong>Damage:</strong> ${escape(result.status)}</div>`;
    const damage=a=>finite(a.value)?fmt(a.value):a.text;
    const dps=(a,period)=>!finite(period)||period<=0?'Unavailable (no repeat cooldown)':finite(a.value)?fmt(a.value/period):`(${a.text}) ÷ ${period.toFixed(2)}s`;
    const explanation=r=>[r.damage.breakdownText,r.sweet?`Sweet spot:\n${r.sweet.breakdownText}`:''].filter(Boolean).join('\n');
    const timingExplanation=r=>{
      if(!r.onHitDps)return finite(r.period)?`\nDamage ÷ ${r.period.toFixed(2)}s cooldown/cycle`:'\nRepeat cooldown unavailable';
      const t=r.onHitDps;
      const active=`\nActive DPS: bonus damage × ${fmt(t.rate)} attacks/s ÷ ${t.cadence} attacks per proc.`;
      if(t.dot)return `\nPoison refreshes without stacking: total poison damage × min(${fmt(t.rate)} attacks/s, 1 ÷ ${fmt(t.dotDuration)}s duration).`;
      return active+(t.passive?'':`\nOverall DPS: active DPS × ${fmt(t.duration)}s active duration ÷ (${fmt(t.duration)}s active duration + ${fmt(t.cooldown)}s cooldown). Display order: active / overall.`);
    };
    const renderedDps=r=>r.onHitDps
      ?`${finite(r.onHitDps.activeDps)?fmt(r.onHitDps.activeDps):'Unavailable (damage or attack speed)'}${r.onHitDps.passive?'':` / ${finite(r.onHitDps.overallDps)?fmt(r.onHitDps.overallDps):'Unavailable (damage or timing)'}`}`
      :r.timingMissing?'Enter recast timing':dps(r.dpsAmount||r.damage,r.period);
    return `<div class="ability-dps"><strong>Damage</strong><table class="ability-dps-table"><thead><tr><th>Part</th><th>Damage</th><th>DPS</th></tr></thead><tbody>${result.rows.map(r=>`<tr><td>${escape(r.label)}</td><td title="${escape(explanation(r))}">${escape(damage(r.damage))}${r.sweet?` (${escape(damage(r.sweet))})`:''}</td><td title="${escape(explanation(r)+timingExplanation(r))}">${escape(renderedDps(r))}${r.sweet?` (${escape(dps(r.sweetDpsAmount||r.sweet,r.period))})`:''}</td></tr>`).join('')}</tbody></table><small>${escape(result.note)}</small></div>`;
  }
 const DamagePresentation={render};scope.DamagePresentation=DamagePresentation;
 if(typeof module!=='undefined')module.exports=DamagePresentation;
})(typeof window!=='undefined'?window:globalThis);
