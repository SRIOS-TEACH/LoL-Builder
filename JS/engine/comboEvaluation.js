import CalculationPipeline from './calculationPipeline.js';
import ItemEvaluation from './itemEvaluation.js';
import AbilityDps from '../shared/abilityDps.js';
import AttackEffects from '../shared/attackEffects.js';
import Calculations from '../shared/calculations.js';
import ChampionEffects from '../shared/championEffects.js';
import ComboTester from '../shared/comboTester.js';
import RuneEffects from '../shared/runeEffects.js';
import TargetDamage from '../shared/targetDamage.js';
/** Build-specific action definitions and isolated health-step evaluation. UI owns only sequence editing and display. */

 const finite=Number.isFinite;
  const dataValue = (payload, key, rank) => Calculations.dataValue(payload?.dataValues || [], key, rank).value;
  const castTime = (spell,rank=1) => {
    const cast = finite(spell?.mCastTime) ? spell.mCastTime : finite(spell?.spellCastTime) ? spell.spellCastTime : null;
    const channel = Array.isArray(spell?.mChannelDuration) ? spell.mChannelDuration[Math.min(rank,spell.mChannelDuration.length-1)] : spell?.mChannelDuration;
    return finite(cast) ? cast + (finite(channel) ? channel : 0) : null;
  };

  function actions(evaluation,presentation={}) {
    const {state,data,stats,resolution}=evaluation;
    const advancedItems=data.advancedItems || {};
    const {computeDerivedBuildStats,computeAutoAttackProfile,calculationContext,getComputedChampionStatsForTooltips,itemPassiveEnabled,isApAdaptiveChampion}=stats;
    const {buildAbilityContext,expandAbilityLocalization,gameTooltip}=resolution;
    const resolveAbilityToken=(token,ctx)=>{
      const row=resolution.resolveAbilityToken(token,ctx),view=presentation.presentToken?.({...row});
      return view?{...row,html:view.html,text:view.text || row.text}:row;
    };
    const resolveItemDescriptionHtml=(item,id)=>ItemEvaluation.evaluate({id,item,source:data.advancedItems?.[id],strings:state.strings,context:calculationContext(getComputedChampionStatsForTooltips())});
    const rawSpell = name => Object.values(state.cdragonRaw || {}).find(r => r.mScriptName === name)?.mSpell;
    if (!state.championData) return [];
    const computed = computeDerivedBuildStats(), attack = computeAutoAttackProfile(computed);
    const record = Object.entries(state.cdragonRaw || {}).find(([path,r]) => /\/CharacterRecords\/Root$/i.test(path) && r.__type === 'CharacterRecord')?.[1];
    const source = advancedItems;
    const override = record?.basicAttack?.mOverrideAutoattackCastTime?.mOverrideAutoattackCastTimeCalculation;
    const overrideTime = override ? Calculations.evaluate(override,calculationContext(getComputedChampionStatsForTooltips())).value : null;
    const windup = ComboTester.attackWindup(record,computed.asTotal,computed.base.attackspeed,overrideTime);
    const result = ['no-crit','crit'].map(outcome => {
      const hit = AttackEffects.model(state,source).profile(computed,{critOutcome:outcome});
      return {id:`aa:${outcome}`,group:'aa',label:outcome === 'crit' ? 'AA crit' : 'AA no crit',shortcut:'AA',
        damage:hit.baseAttackDamage,damageType:hit.baseAttackType,
        cooldown:computed.asTotal > 0 ? 1/computed.asTotal : null,castTime:windup,
        note:'One '+(outcome === 'crit' ? 'critical' : 'non-critical')+' attack. Bonus effects are added separately. Windup uses the champion attack record and current attack speed. Special attack cycles and resets are not simulated.'};
    });
    for (const [index, spell] of state.championData.spells.entries()) {
      const slot = ['q','w','e','r'][index], rank = state.abilityRanks[slot];
      if (!rank) continue;
      const context = buildAbilityContext(spell,rank,slot), payload = context.cdragonSpell;
      const cooldown = AbilityDps.cooldown(spell,rank,context.stats,payload);
      const profile = AbilityDps.profile({spell,rank,cooldown,slot,champion:state.selectedChampion,
        tooltip:expandAbilityLocalization(spell.tooltip || spell.description || ''),
        resolve:token => resolveAbilityToken(token,context),payload,target:state.target,stats:context.stats,
        timing:{delay:state.combatValues[`dps:${slot}:delay`],overlap:state.combatValues[`dps:${slot}:overlap`]}});
      const read = key => dataValue(payload,key,rank);
      const sequences = {
        AatroxQ:{stages:[0,1,2],delay:1,window:read('QExtensionTime'),starts:'last',cast:castTime(rawSpell('AatroxQWrapperCast'))},
        RivenTriCleave:{stages:[0,1,2],delay:0.5,starts:'first'},
        AuroraQ:{stages:[0,1],delay:null,window:read('MarkDuration'),starts:'first'},
        CamilleQ:{stages:[0,1],delay:read('QRampUpTime'),starts:'last'},
        AkaliR:{stages:[0,1,1],delay:read('CooldownBetweenCasts'),starts:'first'},
        GwenR:{stages:[0,1,2],delay:read('LockoutTime'),starts:'first'},
        NaafiriQ:{stages:[0,0,1,1],delay:read('RecastLockout'),starts:'first'},
        ZaahenQ:{stages:[0,1],delay:read('TimeBetweenAttacks'),starts:'last'},
      };
      const timed = ['AkaliE','KledE','VexR','OrnnR','RenektonSliceAndDice','LeeSinQOne'].includes(spell.id);
      const sequence = sequences[spell.id] || (timed ? {stages:[0,1,0,1],delay:state.combatValues[`dps:${slot}:delay`],
        starts:state.combatValues[`dps:${slot}:overlap`] === false ? 'last' : 'first'} : null);
      const rows = profile.rows.length ? profile.rows : [{label:profile.status,damage:{value:profile.status === 'No direct damage' ? 0 : null}}];
      for (const [rowIndex,row] of rows.entries()) {
        if (/^Combined/i.test(row.label) && (sequence || payload?.spellData?.mSpellTags?.includes('Trait_RecastOrReplaceSpell'))) continue;
        const stage = sequence?.stages[rowIndex] || 0;
        const entry = {id:`${slot}:${rowIndex}`, group:slot, label:`${slot.toUpperCase()}${stage ? ` recast ${stage + 1}` : ''} — ${row.label}`,
          damage:row.damage.value,components:row.damage.components,shortcut:slot.toUpperCase()+(stage ? stage+1 : ''),icon:spell.image?.full, cooldown, stage, recastDelay:sequence?.delay ?? null,
          recastWindow:sequence?.window ?? null,cooldownStarts:sequence?.starts,lastStage:sequence ? Math.max(...sequence.stages) : 0,
          castTime:sequence?.cast ?? (spell.id === 'AuroraQ' && stage ? castTime(rawSpell('AuroraQRecast')) : castTime(payload?.spellData,rank)),
          note:profile.note || profile.status};
        result.push(entry);
        if (row.sweet) result.push({...entry,id:entry.id+':sweet',label:entry.label+' (sweet spot)',damage:row.sweet.value,components:row.sweet.components});
      }
      if (!sequence && payload?.spellData?.mSpellTags?.includes('Trait_RecastOrReplaceSpell')) {
        result.push({id:`${slot}:recast`,group:slot,label:`${slot.toUpperCase()} — custom recast`,stage:1,
          damage:null,castTime:null,recastDelay:null,cooldown,cooldownStarts:'first',shortcut:slot.toUpperCase()+'2',icon:spell.image?.full,
          note:'Enter this recast’s damage, cast time and minimum interval. Cooldown starts at the initial cast; override if needed. Champion-specific recast conditions are not modeled.'});
      }
    }
    // A passive is an explicit proc, independent of sustained-attack toggles.
    const passive = state.championData.passive;
    if (passive) {
      const rows = new Map();
      const collect = profile => profile.rows.filter(r => r.source === 'champion' && r.sourceSlot === 'p' && !r.replacementDebit && ['physical','magic','true'].includes(r.type))
        .forEach(r => { if (!rows.has(r.label)) rows.set(r.label,r); });
      collect(attack);
      for (const control of attack.controls.filter(c => c.slot === 'p' && c.type === 'toggle' && !c.disabled)) {
        collect(AttackEffects.model({...state,combatValues:{...state.combatValues,[control.key]:true}},source).profile(computed));
      }
      const base = {group:'p',shortcut:'P',icon:passive.image?.full,iconGroup:'passive',castTime:0,cooldown:null};
      for (const [label,row] of rows) result.push({...base,id:`p:${label}`,label:`P — ${label}`,
        damage:finite(row.value) && row.dot ? row.value * row.duration : row.value,damageType:row.type,
        cooldown:row.cooldown ?? null,note:'One explicit passive trigger; satisfy its trigger conditions before this step. Damage over time is counted in full at this step. '+(row.formula || '')});
      if (!rows.size) {
        const spell = {id:'passive',effectBurn:[],vars:[],description:passive.description,tooltip:gameTooltip(state.cdragonAbilityData?.p,passive.description)};
        const context = buildAbilityContext(spell,1,'p');
        const profile = AbilityDps.profile({spell,rank:1,slot:'p',champion:state.selectedChampion,tooltip:expandAbilityLocalization(spell.tooltip),
          resolve:token => resolveAbilityToken(token,context),payload:context.cdragonSpell,target:state.target,stats:context.stats});
        const summary = ChampionEffects.model(state).passiveSummary(context.stats);
        const damage = summary?.type === 'aurora' ? TargetDamage.apply(state.target.enabled ? summary.healthFraction * state.target.maxHp : null,'magic',{target:state.target,stats:context.stats}) : profile.rows[0]?.damage;
        result.push({...base,id:'p:passive',label:`P — ${passive.name}`,damage:damage?.value ?? (profile.status === 'No direct damage' ? 0 : null),
          components:damage?.components,damageType:summary?.type === 'aurora' ? 'magic' : undefined,
          note:'One explicit passive trigger. Utility and stat effects use the configured build; this action does not grant stacks automatically. '+(profile.note || profile.status || '')});
      }
    }
    // Expose each equipped active/passive, including effects the attack model cannot resolve.
    for (const id of [...new Set(state.itemSlots.filter(Boolean))]) {
      const item = state.items[id];
      if (!item) continue;
      for (const section of resolveItemDescriptionHtml(item,id).sections || []) {
        const binding = AttackEffects.itemPassiveBindings?.[id]?.[section.key];
        const procState = {...state,combatValues:{...state.combatValues,...(binding ? {[binding]:true} : {})}};
        const profile = binding ? AttackEffects.model(procState,source).profile(computed) : attack;
        const row = profile.rows.find(r => String(r.itemId) === String(id) && r.passiveKey === section.key);
        const options = row ? [{value:row.value,components:[{value:row.value,type:row.type}]}] : section.damageOptions || [];
        if (!section.active && !options.length) continue;
        // Some tooltips split the ACTIVE cooldown header from its named effect.
        if (section.active && section.key === 'active' && !options.length) continue;
        const cooldown = row?.cooldown ?? section.cooldown ?? (section.active ? ItemEvaluation.activeCooldown(data.advancedItems?.[id]) : null) ?? (row && !Object.hasOwn(row,'interval') ? 0 : null);
        for (const [index,option] of (options.length ? options : [{value:null}]).entries()) {
          result.push({id:`item:${id}:${section.key}`+(index ? `:damage:${index}` : ''),group:row?.spellbladeId ? 'spellblade' : `item:${id}:${section.key}`,
            label:`${section.active ? 'Active' : 'Passive'} · ${item.name} — ${section.label}`+(option.label ? ` — ${option.label}` : ''),shortcut:'?',itemId:id,
            damage:option.value,components:option.components,damageType:option.components?.[0]?.type,castTime:section.active ? null : 0,cooldown,
            unavailable:!section.active && !itemPassiveEnabled(id,section.key),
            note:(presentation.presentItemSection?.({id,item,source:source[id],section,strings:state.strings,context:calculationContext(getComputedChampionStatsForTooltips())}) ?? section.text) + ' One explicit trigger; satisfy its conditions before this step. Select one outcome, or add distinct damage components separately. Unmodeled values require an override.'});
        }
      }
    }
    for (const [index,row] of attack.rows.entries()) {
      if (row.source !== 'champion' || row.sourceSlot === 'p' || row.replacementDebit || !['physical','magic','true'].includes(row.type)) continue;
      result.push({id:`bonus:${index}:${row.label}`,group:`bonus:${row.label}`,label:`Champion bonus — ${row.label}`,
        damage:row.value,damageType:row.type,shortcut:'?',castTime:0,cooldown:row.cooldown ?? null,note:'One explicit bonus trigger, not included in AA. '+row.formula});
    }
    result.push(...RuneEffects.damageActions(state,data.runes || {},getComputedChampionStatsForTooltips(),{adaptiveAp:isApAdaptiveChampion()}));
    return result;
  }

function selectActions(steps,catalog,customBase){
 return steps.map(step=>{
  const entry=step.custom?{...customBase,id:step.actionId,group:step.actionId}:catalog.find(row=>row.id===step.actionId);
  const action={...(entry || {...step.snapshot,unavailable:true}),...step.overrides};
  if(step.overrides.damageType)action.components=null;
  return action;
 });
}
function evaluate({build,scenario,data,steps,customBase={},presentation={}}){
 const run=CalculationPipeline.create({build,scenario,data});
 const catalog=actions(run,presentation),cache=new Map();
 const result=ComboTester.simulate(selectActions(steps,catalog,customBase),{target:run.state.target,
  resolveAction:(original,current,index)=>{
   if(!cache.has(current.currentHp)){
    const stepRun=CalculationPipeline.create({build,scenario:{...scenario,target:current},data});
    cache.set(current.currentHp,selectActions(steps,actions(stepRun,presentation),customBase));
   }
   return cache.get(current.currentHp)[index];
  }});
 const unresolved=result.damageWarnings.length || result.timeWarnings.length;
 return {...result,status:unresolved?(result.timeline.some(row=>Number.isFinite(row.action.damage))?'partial':'unsupported'):'ready'};
}
const ComboEvaluation={actions,selectActions,evaluate};
 const exportedApi = ComboEvaluation;

export default exportedApi;
