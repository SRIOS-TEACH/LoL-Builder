import AbilityDps from '../shared/abilityDps.js';
import Calculations from '../shared/calculations.js';
import TargetDamage from '../shared/targetDamage.js';
/** Item source prose interpretation and numeric outcomes. Source tags identify damage types; formatted HTML is never numeric input. */

 const C=Calculations;
 const slug=text=>String(text).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
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
    if (!AbilityDps) return [];
    const text=template.replace(/@([^@]+)@/g,(_,key)=>'{{ '+key+' }}');
    return AbilityDps.components(text,resolve,{target:context.target}).map((row,index,rows)=>{
      const before=text.slice(0,text.indexOf(row.identity.slice(row.identity.indexOf(':')+1)));
      const label=/Maximum:\s*<[^>]+>\s*$/i.test(before) ? 'Maximum (isolated target)' : rows.length>1 ? (index===0?'Single hit / first component':`Damage component ${index+1}`) : '';
      const components=row.damage.components.map(p=>TargetDamage.apply(p.value,p.type,context));
      return {label,value:components.every(p=>Number.isFinite(p.value))?components.reduce((n,p)=>n+p.value,0):null,components};
    });
  }
  function prepare({id,item,source,strings={},context={}}){
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
    return {ctx,data,calc,value,rangeKey,template:html,localized:!!localized?.trim()};
  }

 function resolve(prepared,token){
  const match=token.trim().match(/^([^*.]+)(?:\.(\d+))?(?:\*(-?[\d.]+))?$/);
  if(!match)return {kind:'missing',status:'unsupported',numeric:null,text:'Missing game value'};
  const [,key,,multiplier]=match,row=prepared.value(key),scale=multiplier?Number(multiplier):row.displayAsPercent?100:1;
  const numeric=row.value===null || row.value===undefined?null:row.value*scale;
  return {kind:'item-value',status:Number.isFinite(numeric)?'ready':'unsupported',numeric,
   text:row.text || key,isPercent:!!row.displayAsPercent&&!multiplier,diagnostics:row.unsupported || []};
 }
 function evaluate(input){
  const prepared=prepare(input),context=input.context || {};
  const template=tagDamageProse(prepared.template).replace(/%i:[^%]+%/g,'');
  const definitions=String(input.id)==='3042' && input.source?
   [{key:'awe',label:'Awe',html:'',active:false},{key:'shock-on-hit',label:'Shock (On-Hit)',html:'',active:false},{key:'shock',label:'Shock',html:'',active:false}]:splitSections(template);
  const sections=definitions.map(section=>{
   let outcomes=damageOptions(section.html,token=>resolve(prepared,token),context);
   if(String(input.id)==='3042' && input.source && ['shock','shock-on-hit'].includes(section.key)){
    const raw=prepared.calc(section.key==='shock-on-hit'?'OnHitDamage':prepared.rangeKey);
    const packet=TargetDamage.apply(raw.value,'physical',context);
    outcomes=[{label:'',value:packet.value,components:[packet]}];
   }
   return {key:section.key,label:section.label,active:section.active,
    text:section.html.replace(/@([^@]+)@/g,(_,token)=>{const row=resolve(prepared,token);return Number.isFinite(row.numeric)?String(row.numeric):'value unavailable';}).replace(/<[^>]*>/g,' '),
    damageOptions:outcomes,cooldown:prepared.value('Cooldown').value ?? prepared.value('ItemCooldown').value};
  });
  const tokens=[...template.matchAll(/@([^@]+)@/g)].map(match=>({token:match[1],...resolve(prepared,match[1])}));
  const unknown=tokens.some(row=>row.status==='unsupported') || sections.some(section=>section.damageOptions.some(row=>row.value===null));
  const available=tokens.some(row=>row.status==='ready') || sections.some(section=>section.damageOptions.some(row=>Number.isFinite(row.value)));
  return {localized:prepared.localized,sections,tokens,status:unknown?(available?'partial':'unsupported'):'ready'};
 }
 function activeCooldown(source){
  const values=(source?.mDataValues || []).map(row=>[row.mName,Number(row.mValue)]).filter(([key,value])=>/cooldown/i.test(key)&&Number.isFinite(value)&&value>0);
  for(const matcher of [/^Cooldown$/i,/Active.*Cooldown/i,/Item.*Cooldown/i]){const hit=values.find(([name])=>matcher.test(name));if(hit)return hit[1];}
  return values.find(([name])=>!/spellblade|sheen|onhit/i.test(name))?.[1] ?? null;
 }
 const ItemEvaluation={slug,prepare,resolve,evaluate,activeCooldown,splitSections,damageOptions,tagDamageProse};
 const exportedApi = ItemEvaluation;

export default exportedApi;
