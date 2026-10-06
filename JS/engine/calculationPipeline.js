/** One evaluation session from BuildInputs, ScenarioInputs and prepared data. Owns a copied build/scenario; source records are read only. */
(function(scope){
function create({build,scenario={},data={}}){
 const state={...scope.BuildInputs.readBuildInputs(build),
  target:scope.RecordValues.copyRecord(scenario.target || scope.ScenarioInputs.normalizeTarget()),
  gameTimeMinutes:scenario.gameTimeMinutes ?? 20,
  championData:data.champion || null,cdragonRaw:data.championRaw || {},cdragonAbilityData:data.abilities || null,
  items:data.items || {},strings:data.strings || {},stringsReady:!!data.stringsReady,stringsLoading:!!data.stringsLoading};
 const stats=scope.BuildEvaluation.create(state,data);
 const resolution=scope.AbilityResolution.create(state,data,stats);
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
  const cooldown=scope.AbilityDps.cooldown(spell,rank,context.stats,context.cdragonSpell);
  const damage=scope.AbilityDps.profile({spell,rank,slot,champion:state.selectedChampion,tooltip,resolve,
   payload:context.cdragonSpell,target:state.target,stats:context.stats,cooldown,
   timing:{delay:state.combatValues?.[`dps:${slot}:delay`],overlap:state.combatValues?.[`dps:${slot}:overlap`]}});
  const computed=stats.computeDerivedBuildStats();
  const attack=options.attack || (computed?stats.computeAutoAttackProfile(computed):null);
  const onHitDamage=scope.AbilityOnHit.apply(damage,{spell,rank,slot,champion:state.selectedChampion,
   payload:context.cdragonSpell,target:state.target,stats:context.stats,attack});
  const unresolved=tokens.filter(row=>row.status==='unsupported');
  const missingDamage=damage.status==='Damage formula unavailable' || damage.rows.some(row=>row.damage.value===null);
  const status=!(rank>0)?'unlearned':unresolved.length || missingDamage?(tokens.some(row=>row.status==='ready') || damage.rows.some(row=>Number.isFinite(row.damage.value))?'partial':'unsupported'):'ready';
  return {status,tokens,cooldown,damage,onHitDamage,context};
 };
 const evaluateAlternate=(spell,rank,slot,options={})=>{
  const forms={JavelinToss:['Takedown','Cougar Q'],Bushwhack:['Pounce','Cougar W'],PrimalSurge:['Swipe','Cougar E'],
   JayceToTheSkies:['JayceShockBlast','Cannon Q'],JayceStaticField:['JayceHyperCharge','Cannon W'],JayceThunderingBlow:['JayceAccelerationGate','Cannon E'],
   EliseHumanQ:['EliseSpiderQCast','Spider Q'],EliseHumanW:['EliseSpiderW','Spider W'],EliseHumanE:['EliseSpiderE','Spider E'],
   GnarQ:['GnarBigQ','Mega Q'],GnarW:['GnarBigW','Mega W'],GnarE:['GnarBigE','Mega E']};
  const form=forms[spell.id];if(!form || !(rank>0))return null;
  const payload=state.cdragonAbilityData?.byAlias?.[resolution.canonicalizeToken(form[0])]?.payload;
  const loc=payload?.spellData?.mClientData?.mTooltipData?.mLocKeys,raw=state.strings?.[loc?.keyTooltip?.toLowerCase()];
  if(!payload || !raw)return {label:form[1],status:'unsupported'};
  const formRank=['Takedown','Pounce','Swipe'].includes(form[0])?Math.max(1,state.abilityRanks.r):rank;
  const alternate={...spell,id:form[0],tooltip:raw,cooldown:payload.spellData.cooldownTime?.slice(1)};
  const context=resolution.buildAbilityContext(alternate,formRank,slot);
  Object.assign(context,resolution.buildResolvedSpellPayload(payload,formRank,context.stats));
  // Alternate tables historically omit primary-form on-hit additions and custom recast timing.
  const resolve=token=>{const row=resolution.resolveAbilityToken(token,context);const view=options.presentToken?.({...row});return view?{...row,html:view.html,text:view.text || row.text}:row;};
  const damage=scope.AbilityDps.profile({spell:alternate,rank:formRank,payload,champion:state.selectedChampion,slot,
   tooltip:resolution.expandAbilityLocalization(raw),resolve,cooldown:scope.AbilityDps.cooldown(alternate,formRank,context.stats,payload),target:state.target,stats:context.stats});
  return {label:form[1],status:'ready',damage,context};
 };
 const evaluateBuild=()=>{
  const computed=stats.computeDerivedBuildStats();
  if(!computed)return {status:'unsupported',computed:null,attack:null};
  const attack=stats.computeAutoAttackProfile(computed);
  return {status:attack.partial?'partial':'ready',computed,attack,summary:stats.summary(computed),passive:scope.AbilityDps.passiveProfile(attack)};
 };
 return {state,data,stats,resolution,evaluateAbility,evaluateAlternate,evaluateBuild};
}
const CalculationPipeline={create};
 scope.CalculationPipeline=CalculationPipeline;
 if(typeof module!=="undefined")module.exports=CalculationPipeline;
})(typeof window!=="undefined"?window:globalThis);
