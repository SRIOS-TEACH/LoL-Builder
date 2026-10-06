/** Resolve game-authored item prose with the same calculations as the builder. */
(function(scope){
  scope.ItemEvaluation ||= typeof require==='function' ? require('../engine/itemEvaluation.js') : null;
  const text=scope.TextValues || (typeof require==='function'?require('../core/text.js'):null);
  const escape=text.escapeHtml;
  const slug=scope.ItemEvaluation.slug;
  const number=value=>Number.isFinite(value)?Number(value.toFixed(2)).toLocaleString('en-US'):'value unavailable';
  const percent=value=>number(Number.isFinite(value)?value*100:NaN);
  const {tagDamageProse,splitSections,damageOptions}=scope.ItemEvaluation;
  function describe({id,item,source,strings={},context={}}){
    const prepared=scope.ItemEvaluation.prepare({id,item,source,strings,context});
    const {data,calc,value,rangeKey}=prepared;
    let html=prepared.template;
    const localized=prepared.localized;
    const resolveToken=token=>{
      const row=scope.ItemEvaluation.resolve(prepared,token);
      if(row.numeric===null)return {html:`<span class="ability-detail-missing" title="${escape(row.text || 'Missing game value')}">[value unavailable]</span>`,numeric:null};
      return {html:`<span class="item-calculated-value" title="${escape(row.text)}">${number(row.numeric)}${row.isPercent?'%':''}</span>`,numeric:row.numeric,isPercent:row.isPercent};
    };
    html=tagDamageProse(html).replace(/%i:[^%]+%/g,'');
    html=(scope.DamageText?scope.DamageText.render(html,resolveToken,context,'item'):html.replace(/@([^@]+)@/g,(_full,token)=>resolveToken(token).html))
      .replace(/%i:[^%]+%/g,'').replace(/\{\{[^{}]*\}\}/g,'<span class="ability-detail-missing">[text unavailable]</span>');
    // Muramana has distinct attack/ability procs. Keep percentages and results together.
    if(String(id)==='3042' && source){
      const awe=calc('BonusADFromMana'),hit=calc('OnHitDamage'),ability=calc(rangeKey);
      const damage=value=>context.target?.enabled&&scope.DamageText?scope.DamageText.damage(value,'physical',context):number(value);
      const ratio=data(context.ranged?'AbilityManaRatioRangedTOOLTIPONLY':'AbilityManaRatioMeleeTOOLTIPONLY');
      const abilityAmount=typeof context.ranged==='boolean'?`${percent(ratio)}% (${damage(ability.value)})`:
        `${percent(data('AbilityManaRatioRangedTOOLTIPONLY'))}% (${damage(calc('RangedItemCalcValue').value)}) for ranged champions or ${percent(data('AbilityManaRatioMeleeTOOLTIPONLY'))}% (${damage(calc('MeleeItemCalcValue').value)}) for melee champions`;
      html=`<passive>Awe</passive><br>Gain ${percent(data('BonusADManaRatioTOOLTIPONLY'))}% max Mana as bonus Attack Damage (<scaleAD>+${number(awe.value)} AD</scaleAD>).<br><br>`+
        `<passive>Shock (On-Hit)</passive><br>Attacks against champions deal ${percent(data('OnHitManaRatioTOOLTIPONLY'))}% (${damage(hit.value)}) max Mana as bonus physical damage.<br><br>`+
        `<passive>Shock</passive><br>Dealing ability damage to champions with a champion ability deals ${abilityAmount} max Mana as bonus physical damage.${typeof context.ranged==='boolean'?` <rules>${context.ranged?'Ranged':'Melee'} champion scaling.</rules>`:''}`;
    }
    html=html.replace(/<\/?mainText>/gi,'');
    const evaluated=scope.ItemEvaluation.evaluate({id,item,source,strings,context});
    const sections=splitSections(html).map(section=>{
      const row=evaluated.sections.find(row=>row.key===section.key);
      return {...section,damageOptions:row?.damageOptions || [],cooldown:row?.cooldown ?? value('Cooldown').value ?? value('ItemCooldown').value};
    });
    return {html,sections,localized};
  }
  scope.ItemDescriptions={describe,slug,escape,number,tagDamageProse,damageOptions};
  if(typeof module!=='undefined')module.exports=scope.ItemDescriptions;
})(typeof window!=='undefined'?window:globalThis);
