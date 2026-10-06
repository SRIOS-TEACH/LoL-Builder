/** Legacy ability/passive HTML adapter for structured resolution results. Formatting never supplies game numbers. */
(function(scope){
function formatAbilityStatLabel(label) {
  const m = {
    "bonus ad": "BonusAD",
    ad: "AD",
    ap: "AP",
    hp: "HP",
    mana: "Mana",
    armor: "Armor",
    "bonus armor": "BonusArmor",
    mr: "MR",
    "bonus mr": "BonusMR",
  };
  return m[String(label || "").toLowerCase()] || String(label || "Stat").replace(/\s+/g, "");
}
function formatAbilityNumber(value, isPercent = false) {
  const n = Number(value || 0);
  if (isPercent) return `${n.toFixed(1)}%`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
function formatCalculationTerms(terms, fallbackValue = 0) {
  if (!Array.isArray(terms)) return formatAbilityNumber(fallbackValue);
  const joined = terms
    .map((row) => String(row?.text || "").trim())
    .filter(Boolean)
    .join(" + ");
  return joined || formatAbilityNumber(fallbackValue);
}
function legacyToken(row){
 if(row.kind==='missing')return null;
 let html='';
 if(row.kind==='unavailable')html=`<span class="ability-detail-eq">${row.text}</span>`;
 else if(row.kind==='calculation')html=`<span class="ability-detail-number">${formatAbilityNumber(row.numeric,row.isPercent)} <span class="ability-detail-eq">(${formatCalculationTerms(row.calculation.terms,row.numeric)})</span></span>`;
 else if(row.kind==='known')html=`<span class="ability-detail-number">${row.display}</span>`;
 else if(row.kind==='scaling')html=`<span class="ability-detail-number">${formatAbilityNumber(row.numeric)} <span class="ability-detail-eq">(${(row.coefficient*100).toFixed(0)}% ${formatAbilityStatLabel(row.statLabel)})</span></span>`;
 else if(row.kind==='product')html=`${row.multiplier} × (${legacyToken(row.operand)?.html || ''})`;
 else if(row.kind!=='empty')html=`<span class="ability-detail-number">${formatAbilityNumber(row.numeric)}</span>`;
 return {...row,html};
}
function create(state,statsEngine,resolution,tokenAdapter){
const {buildAbilityContext,gameTooltip,expandAbilityLocalization}=resolution;
const resolveAbilityToken=tokenAdapter || ((token,ctx)=>legacyToken(resolution.resolveAbilityToken(token,ctx)));
function buildDetailedPassiveText() {
  const passive=state.championData?.passive;
  if(!passive)return '';
  const payload=state.cdragonAbilityData?.p;
  const raw=gameTooltip(payload,passive.description||'');
  const dummy={id:'passive',effectBurn:[],vars:[],costType:'',description:passive.description,tooltip:raw};
  const ctx=buildAbilityContext(dummy,1,'p');
  let text=buildDetailedAbilityText(dummy,1,'p',ctx);
  const passiveResult=statsEngine.passiveEvaluation(ctx.stats),summary=passiveResult.summary;
  const f=scope.ItemDescriptions.number;
  if(summary?.type==='ezreal')text+=`<p class="passive-current-value">${summary.stacks}/${summary.maxStacks} stacks: <attackSpeed>+${f(summary.bonusAttackSpeed*100)}% Attack Speed</attackSpeed>.</p>`;
  if(summary?.type==='aurora'){
    // Current script has no movement-speed buff; old unused BIN calculations remain.
    const {baseFraction,apCoefficient}=passiveResult;
    text=`Damaging an enemy 3 times with abilities or attacks deals <magicDamage>${f(summary.healthFraction*100)}% ((${f(baseFraction*100)}) + (${f(apCoefficient*100)}% Ability Power))% of their maximum HP as magic damage</magicDamage>. Against champions, this frees a spirit for ${f(summary.spiritDuration)} seconds. Each spirit restores <healing>${f(summary.healPerSpirit)} HP per second</healing>, up to ${summary.maxSpirits} spirits.<br><br><span class="passive-current-value">${summary.spirits}/${summary.maxSpirits} spirits: <healing>${f(summary.healingPerSecond)} HP per second</healing>.</span><br><rules>Damage against monsters is capped at 100–270, based on level.</rules>`;
    if(state.target.enabled){
      const amount=scope.DamageText.damage(passiveResult.targetDamage,'magic',{target:state.target,stats:ctx.stats},`${f(summary.healthFraction*100)}% × ${state.target.maxHp} target max HP`);
      text=text.replace('maximum HP as magic damage',`maximum HP as magic damage (${amount} against target)`);
    }
  }
  if(!state.stringsReady && !summary)text+=`<p class="text-muted">${state.stringsLoading?'Loading detailed game description…':'Detailed game description unavailable; showing the summary.'}</p>`;
  return text;
}

function buildDetailedAbilityText(spell, rank, spellKey, context) {
  let raw = expandAbilityLocalization(spell.tooltip || spell.description || "");
  if(state.selectedChampion==='Aurora' && spellKey==='q')raw=raw.replace(/up to\s+(?=<magicDamage>\s*(?:\{\{|@)\s*q2damagemax)/i,'');
  if (!(Number(rank) > 0)) return spell.description || "";
  const ctx = context || buildAbilityContext(spell, rank, spellKey);
  const replaced = scope.DamageText.render(raw,token=>resolveAbilityToken(token,ctx),{target:state.target,stats:ctx.stats});

  return replaced
    .replace(/<physicalDamage>/gi, '<span class="ability-damage-physical">')
    .replace(/<\/physicalDamage>/gi, '</span>')
    .replace(/<magicDamage>/gi, '<span class="ability-damage-magic">')
    .replace(/<\/magicDamage>/gi, '</span>')
    .replace(/<trueDamage>/gi, '<span class="ability-damage-true">')
    .replace(/<\/trueDamage>/gi, '</span>')
    .replace(/<healing>/gi, '<span class="ability-healing">')
    .replace(/<\/healing>/gi, '</span>')
    .replace(/<status>/gi, '<span class="ability-status">')
    .replace(/<\/status>/gi, '</span>')
    .replace(/[{}]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function abilityEffectValues(payload,rank) {
  // Target mode presents damage through typed prose and outcome tables. Raw
  // calculation records also contain ratios/hidden totals with no damage type.
  if(state.target.enabled)return '';
  if(!payload || !rank)return '';
  const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rows=resolution.effectValues(payload,rank).map(({name,row,value,displayAsPercent})=>{
   const shown=value===null?row.text:scope.Calculations.format(value*(displayAsPercent?100:1))+(displayAsPercent?'%':'');
   return `<div>${escape(name.replace(/([a-z])([A-Z])/g,'$1 $2'))}: ${escape(shown)}</div>`;
  });
  return rows.length?`<details class="ability-effect-values"><summary>Effect values</summary>${rows.join('')}</details>`:'';
}
return {buildDetailedPassiveText,buildDetailedAbilityText,abilityEffectValues};
}
const AbilityPresentation={create,legacyToken,formatAbilityStatLabel,formatAbilityNumber,formatCalculationTerms};
 scope.AbilityPresentation=AbilityPresentation;
 if(typeof module!=="undefined")module.exports=AbilityPresentation;
})(typeof window!=="undefined"?window:globalThis);
