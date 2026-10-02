/** Resolve game-authored item prose with the same calculations as the builder. */
(function(scope){
  const C=scope.Calculations;
  const text=scope.TextValues || (typeof require==='function'?require('../core/text.js'):null);
  const escape=text.escapeHtml;
  const slug=text=>String(text).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const number=value=>Number.isFinite(value)?Number(value.toFixed(2)).toLocaleString('en-US'):'value unavailable';
  const percent=value=>number(Number.isFinite(value)?value*100:NaN);
  // Only promote explicit scalar damage prose; percentages and utility stats stay untouched.
  function tagDamageProse(html) {
    return String(html).split(/(<(?:physicalDamage|magicDamage|trueDamage)>[\s\S]*?<\/(?:physicalDamage|magicDamage|trueDamage)>)/gi)
      .map(part => /^<(?:physicalDamage|magicDamage|trueDamage)>/i.test(part) ? part : part.replace(/(@[^@]+@|\b\d+(?:\.\d+)?)\s+((?:bonus |additional )?(physical|magic|true) damage)/gi,
        (full,value,words,type) => `<${type}Damage>${value} ${words}</${type}Damage>`)).join('');
  }
  function splitSections(html) {
    const sections=[];
    html=html.replace(/<\/?mainText>/gi,'');
    const headings=[...html.matchAll(/(?:^|<br\s*\/?>|<\/section>)\s*<(passive|active|unique)>\s*([\s\S]*?)<\/\1>/gi)];
    for(const [index,match] of headings.entries()){
      const label=match[2].replace(/<[^>]+>/g,'').trim();
      const key=slug(label),body=html.slice(match.index+match[0].length,headings[index+1]?.index??html.length).replace(/^(?:\s|<br\s*\/?>)+|(?:\s|<br\s*\/?>)+$/gi,'');
      if(!label||!body)continue;
      const previous=sections.find(section=>section.key===key);
      if(previous){if(!previous.html.includes(body))previous.html+='<br>'+body;}
      else sections.push({key,label,html:body,active:match[1].toLowerCase()==='active'});
    }
    return sections;
  }
  function damageOptions(template,resolve,context) {
    if (!scope.AbilityDps) return [];
    const text=template.replace(/@([^@]+)@/g,(_,key)=>'{{ '+key+' }}');
    return scope.AbilityDps.components(text,resolve,{target:context.target}).map((row,index,rows)=>{
      const before=text.slice(0,text.indexOf(row.identity.slice(row.identity.indexOf(':')+1)));
      const label=/Maximum:\s*<[^>]+>\s*$/i.test(before) ? 'Maximum (isolated target)' : rows.length>1 ? (index===0?'Single hit / first component':`Damage component ${index+1}`) : '';
      const components=row.damage.components.map(p=>scope.TargetDamage.apply(p.value,p.type,context));
      return {label,value:components.every(p=>Number.isFinite(p.value))?components.reduce((n,p)=>n+p.value,0):null,components};
    });
  }
  function describe({id,item,source,strings={},context={}}){
    const ctx={...context,dataValues:source?.mDataValues||[],calculations:source?.mItemCalculations||{},effects:source?.mEffectAmount||[]};
    const data=key=>C.dataValue(ctx.dataValues,key,1,context.level).value;
    const calc=key=>C.evaluate(C.lookup(ctx.calculations,key),ctx);
    const value=key=>{
      if(String(id)==='3083' && key.toLowerCase()==='f2')return {value:Number.isFinite(context.stats?.itemHp)&&Number.isFinite(data('HPAmp'))?context.stats.itemHp*data('HPAmp'):null,text:'Item health × health amplification'};
      const formula=C.lookup(ctx.calculations,key);if(formula)return calc(key);
      const datum=C.dataValue(ctx.dataValues,key,1,context.level);if(datum.value!==null)return datum;
      const effect=key.match(/^Effect(\d+)Amount$/i);
      const fixed=effect?source?.mEffectAmount?.[Number(effect[1])-1]:C.lookup(item?.stats,key)??C.lookup(source,key);
      return Number.isFinite(fixed)?{value:fixed,text:key}:datum;
    };
    const loc=source?.mItemDataClient?.mTooltipData?.mLocKeys;
    const localized=[strings[loc?.keyTooltip?.toLowerCase()],strings[loc?.keyActive?.toLowerCase()]].filter(text=>text?.trim()).join('<br><br>');
    let html=localized?.trim()?localized:String(item?.description||'').replace(/<stats>[\s\S]*?<\/stats>/gi,'');
    // This macro has a dynamic localization key; select the actual champion form.
    const rangeKey=context.ranged?'RangedItemCalcValue':'MeleeItemCalcValue';
    html=html.replace(/\{\{\s*Item_Melee_Ranged_Split(?:_Dynamic)?(_B)?\s*\}\}/gi,(_full,b)=>typeof context.ranged==='boolean'?`@${rangeKey}${b?'B':''}@`:`@MeleeItemCalcValue${b?'B':''}@ (melee) / @RangedItemCalcValue${b?'B':''}@ (ranged)`);
    for(let pass=0;pass<8;pass++){
      const next=html.replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(full,key)=>strings[key.toLowerCase().trim()]??full).replace(/@([^@]+)@/g,(full,key)=>{
        const branch=C.lookup(source?.StringCalculations,key);
        if(branch?.__type!=='{4750ceb6}')return full;
        if(typeof context.ranged==='boolean')return (context.ranged?branch.RangedResult:branch.MeleeResult)||branch.DefaultResult||full;
        return `${branch.MeleeResult||branch.DefaultResult} (melee) / ${branch.RangedResult||branch.DefaultResult} (ranged)`;
      });
      if(next===html)break;html=next;
    }
    const resolveToken=token=>{
      const match=token.trim().match(/^([^*.]+)(?:\.(\d+))?(?:\*(-?[\d.]+))?$/);
      if(!match)return {html:'<span class="ability-detail-missing">[value unavailable]</span>',numeric:null};
      const [,key,,multiplier]=match;
      const row=value(key),scale=multiplier?Number(multiplier):row.displayAsPercent?100:1;
      if(row.value===null||row.value===undefined)return {html:`<span class="ability-detail-missing" title="${escape(row.text||'Missing game value')}">[value unavailable]</span>`,numeric:null};
      const isPercent=!!row.displayAsPercent&&!multiplier;
      return {html:`<span class="item-calculated-value" title="${escape(row.text||key)}">${number(row.value*scale)}${isPercent?'%':''}</span>`,numeric:row.value*scale,isPercent};
    };
    html=tagDamageProse(html).replace(/%i:[^%]+%/g,'');
    const damageSections=splitSections(html);
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
    const sections=splitSections(html).map(section=>{
      const template=damageSections.find(s=>s.key===section.key)?.html || '';
      let outcomes=damageOptions(template,resolveToken,context);
      // Muramana's rewritten prose has two distinct mana-scaling procs.
      if(String(id)==='3042' && source && ['shock','shock-on-hit'].includes(section.key)) {
        const raw=calc(section.key==='shock-on-hit'?'OnHitDamage':rangeKey);
        const packet=scope.TargetDamage.apply(raw.value,'physical',context);
        outcomes=[{label:'',value:packet.value,components:[packet]}];
      }
      return {...section,damageOptions:outcomes,
        cooldown:value('Cooldown').value ?? value('ItemCooldown').value};
    });
    return {html,sections,localized:!!localized?.trim()};
  }
  scope.ItemDescriptions={describe,slug,escape,number,tagDamageProse,damageOptions};
  if(typeof module!=='undefined')module.exports=scope.ItemDescriptions;
})(typeof window!=='undefined'?window:globalThis);
