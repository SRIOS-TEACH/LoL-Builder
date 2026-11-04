import AbilityVariants from '../shared/abilityVariants.js';
import RecordValues from '../core/records.js';
import BuildInputs from '../domain/buildInputs.js';
import ScenarioInputs from '../domain/scenarioInputs.js';
import AbilityResolution from './abilityResolution.js';
import BuildEvaluation from './buildEvaluation.js';
import AbilityDps from '../shared/abilityDps.js';
import AbilityOnHit from '../shared/abilityOnHit.js';
/** One evaluation session from BuildInputs, ScenarioInputs and prepared data. Owns a copied build/scenario; source records are read only. */

function create({build,scenario={},data={}}){
 const state={...BuildInputs.readBuildInputs(build),
  target:RecordValues.copyRecord(scenario.target || ScenarioInputs.normalizeTarget()),
  gameTimeMinutes:scenario.gameTimeMinutes ?? 20,
  championData:data.champion || null,cdragonRaw:data.championRaw || {},cdragonAbilityData:data.abilities || null,
  items:data.items || {},strings:data.strings || {},stringsReady:!!data.stringsReady,stringsLoading:!!data.stringsLoading};
 AbilityVariants.prepare(state);
 const stats=BuildEvaluation.create(state,data);
 const resolution=AbilityResolution.create(state,data,stats);
 const evaluateAbility=(spell,rank,slot,options={})=>{
  const context=options.context || resolution.buildAbilityContext(spell,rank,slot);
  const tooltip=resolution.expandAbilityLocalization(spell.tooltip || spell.description || '');
  const resolve=token=>{
   const row=resolution.resolveAbilityToken(token,context);
   // Presentation can annotate explanations, but cannot replace numeric results.
   const view=options.presentToken?.({...row});
   return view?{...row,html:view.html,text:view.text || row.text}:row;
  };
  const tokens=[...tooltip.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map(match=>resolution.resolveAbilityToken(match[1],context));
  const cooldown=AbilityDps.cooldown(spell,rank,context.stats,context.cdragonSpell);
  const damage=AbilityDps.profile({spell,rank,slot,champion:state.selectedChampion,tooltip,resolve,
   payload:context.cdragonSpell,target:state.target,stats:context.stats,cooldown,
   timing:{delay:state.combatValues?.[`dps:${slot}:delay`],overlap:state.combatValues?.[`dps:${slot}:overlap`]}});
  const computed=stats.computeDerivedBuildStats();
  const attack=options.attack || (computed?stats.computeAutoAttackProfile(computed):null);
  const onHitDamage=AbilityOnHit.apply(damage,{spell,rank,slot,champion:state.selectedChampion,
   payload:context.cdragonSpell,target:state.target,stats:context.stats,attack});
  const unresolved=tokens.filter(row=>row.status==='unsupported');
  const missingDamage=damage.status==='Damage formula unavailable' || damage.rows.some(row=>row.damage.value===null);
  const status=!(rank>0)?'unlearned':unresolved.length || missingDamage?(tokens.some(row=>row.status==='ready') || damage.rows.some(row=>Number.isFinite(row.damage.value))?'partial':'unsupported'):'ready';
  return {status,tokens,cooldown,damage,onHitDamage,context};
 };
 const evaluateAlternate=(spell,rank,slot,options={})=>{
  const formRule=AbilityVariants.forms[state.selectedChampion],index=['q','w','e'].indexOf(slot);
  const alias=formRule?.aliases[index];
  const form=alias?[alias,formRule.names[1]+' '+slot.toUpperCase()]:null;if(!form || !(rank>0))return null;
  const payload=state.cdragonAbilityData?.byAlias?.[resolution.canonicalizeToken(form[0])]?.payload;
  const loc=payload?.spellData?.mClientData?.mTooltipData?.mLocKeys,raw=state.strings?.[loc?.keyTooltip?.toLowerCase()] || (alias===spell.id?spell.tooltip:null);
  if(!payload || !raw)return {label:form[1],status:'unsupported'};
  const formRank=['Takedown','Pounce','Swipe'].includes(form[0])?Math.max(1,state.abilityRanks.r):rank;
  const alternate={...spell,id:form[0],tooltip:raw,cooldown:payload.spellData.cooldownTime?.slice(1)};
  const alternateState={...state,combatValues:{...state.combatValues,['attack:'+formRule.key]:true}};
  const alternateStats=BuildEvaluation.create(alternateState,data),alternateResolution=AbilityResolution.create(alternateState,data,alternateStats);
  const context=alternateResolution.buildAbilityContext(alternate,formRank,slot);
  Object.assign(context,alternateResolution.buildResolvedSpellPayload(payload,formRank,context.stats));
  // Alternate tables historically omit primary-form on-hit additions and custom recast timing.
  const resolve=token=>{const row=resolution.resolveAbilityToken(token,context);const view=options.presentToken?.({...row});return view?{...row,html:view.html,text:view.text || row.text}:row;};
  context.stats={...context.stats,alternateForm:true};
  const damage=AbilityDps.profile({spell:alternate,rank:formRank,payload,champion:state.selectedChampion,slot,
   tooltip:resolution.expandAbilityLocalization(raw),resolve,cooldown:AbilityDps.cooldown(alternate,formRank,context.stats,payload),target:state.target,stats:context.stats});
  return {label:form[1],status:'ready',spell:alternate,rank:formRank,cooldown:AbilityDps.cooldown(alternate,formRank,context.stats,payload),damage,context};
 };
 const evaluateBuild=()=>{
  const computed=stats.computeDerivedBuildStats();
  if(!computed)return {status:'unsupported',computed:null,attack:null};
  const attack=stats.computeAutoAttackProfile(computed);
  return {status:attack.partial?'partial':'ready',computed,attack,summary:stats.summary(computed),passive:AbilityDps.passiveProfile(attack)};
 };
 return {state,data,stats,resolution,evaluateAbility,evaluateAlternate,evaluateBuild};
}
const CalculationPipeline={create};
 const exportedApi = CalculationPipeline;

export default exportedApi;
