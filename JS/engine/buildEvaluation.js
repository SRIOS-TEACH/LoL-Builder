/** Build and rune stat orchestration, attacks and passive contributions for one explicit input snapshot. */
(function(scope){
function create(state,data={}) {
 const stripHtml=scope.TextValues.stripHtml,advancedItems=data.advancedItems || {};
 const {baseCalculationContext,calculationContext}=scope.CalculationContext.create(state,data);
function isApAdaptiveChampion() {
  const tags = new Set(state.championData?.tags || []);
  if (tags.has("Mage")) return true;
  if (tags.has("Marksman") || tags.has("Fighter") || tags.has("Assassin")) return false;
  return true;
}

function getStackRuneEffects() {
  return scope.RuneEffects.calculate(state, data.runes || {}, {adaptiveAp: isApAdaptiveChampion(), ranged: (state.championData?.stats.attackrange || 0) > 300});
}

function extractPassiveLabelsFromText(text) {
  const labels = [];
  const re = /(?:UNIQUE\s+)?PASSIVE\s*(?:-|:)?\s*([A-Za-z0-9' ]+)?/gi;
  let match;
  while ((match = re.exec(text))) {
    const raw = String(match[1] || "").trim();
    labels.push(raw || "Passive");
  }
  return Array.from(new Set(labels));
}

function extractPassiveDescriptionsFromHtml(descriptionHtml) {
  const html = String(descriptionHtml || "");
  if (!html) return [];

  const normalized = html.replace(/<br\s*\/?>/gi, "\n");
  const rows = [];
  const sectionRe = /<(passive|onhit|unique)>\s*([^<]*)\s*<\/\1>\s*([\s\S]*?)(?=<(?:passive|onhit|unique|active)>|$)/gi;
  let match;
  while ((match = sectionRe.exec(normalized))) {
    const type = String(match[1] || "").toUpperCase();
    const label = stripHtml(match[2] || "").trim() || type;
    const desc = stripHtml(match[3] || "").trim();
    if (!desc) continue;
    rows.push({ label, impact: desc });
  }

  if (rows.length) return rows;

  const fallback = stripHtml(html);
  const labelFallbacks = extractPassiveLabelsFromText(fallback);
  return labelFallbacks.map((label) => ({ label, impact: fallback }));
}

function buildPassiveLedger(itemTotals, runeTotals) {
  const selectedItems = [...new Set(state.itemSlots)]
    .filter((id) => id && state.items[id])
    .map((id) => ({ id: String(id), item: state.items[id] }));
  const passiveEffects = [];
  const additiveMods = { ad: 0, ap: 0, hp: 0 };
  let apMultiplier = 1;
  let hasRabadon = false;

  selectedItems.forEach(({ id, item }) => {
    const resolvedDescriptionHtml = item.description || "";
    extractPassiveDescriptionsFromHtml(resolvedDescriptionHtml).forEach(({ label, impact }) => {
      passiveEffects.push({ source: "Item", owner: item.name, label, impact });
    });

    const source = advancedItems[id];
    if (!source) return;
    if(id==='3083' && itemPassiveEnabled(id,'warmog-s-vitality')){
      const amp=scope.Calculations.dataValue(source.mDataValues,'HPAmp').value;
      if(Number.isFinite(amp))additiveMods.hp+=itemTotals.hp*amp;
    }
    const b = state.championData?.stats;
    const bonusMana = itemTotals.mp + runeTotals.mp;
    const baseMana = b ? b.mp + b.mpperlevel * scope.BuildStats.growthFactor(state.level) : 0;
    const context = {level:state.level, stats:{mp:baseMana+bonusMana,bonusMp:bonusMana},
      dataValues:source.mDataValues || [], calculations:source.mItemCalculations || {}};
    // Effect bindings identify the passive; coefficients and formulas come from live data.
    if (id === "3089" && itemPassiveEnabled(id,'magical-opus')) {
      const amp = scope.Calculations.dataValue(context.dataValues, "APAmp").value;
      if (amp !== null) { hasRabadon=true; apMultiplier *= 1+amp; }
    }
    const binding = {"3042":["BonusADFromMana","ad"], "3040":["BonusAPCalc","ap"]}[id];
    if (binding && b && itemPassiveEnabled(id,'awe')) {
      const [key,stat] = binding;
      const row = scope.Calculations.evaluate(scope.Calculations.lookup(context.calculations,key),context);
      if (row.value !== null) {
        additiveMods[stat] += row.value;
        passiveEffects.push({source:"Item",owner:item.name,label:"Awe",impact:`+${row.value.toFixed(1)} ${stat.toUpperCase()} (${row.text})`});
      }
    }
  });

  if (state.championData?.passive) {
    const champPassiveName = state.championData.passive.name || "Passive";
    passiveEffects.push({ source: "Champion", owner: state.selectedChampion, label: champPassiveName, impact: "Champion passive identified" });
  }

  const apBeforeMultiplier = itemTotals.ap + runeTotals.ap + additiveMods.ap;
  const apAmp = Math.max(0, apBeforeMultiplier * (apMultiplier - 1));
  const statMods = {
    ad: additiveMods.ad,
    ap: additiveMods.ap + apAmp,
    hp: additiveMods.hp,
  };

  if (hasRabadon && apAmp > 0) {
    passiveEffects.push({ source: "Item", owner: "Rabadon's Deathcap", label: "Magical Opus", impact: `+${apAmp.toFixed(1)} AP (multipliers applied last)` });
  }

  return { passiveEffects, statMods, apMultiplier };
}

function computeDerivedBuildStats() {
  if (!state.championData) return null;
  const base = state.championData.stats;
  const item = getItemStats();
  const rune = getRuneStats();
  const L = state.level;

  const ledger = buildPassiveLedger(item, rune);
  const passiveAd = ledger.statMods.ad;
  const passiveAp = ledger.statMods.ap;

  const hp = (base.hp + base.hpperlevel * scope.BuildStats.growthFactor(L) + item.hp + rune.hp + (ledger.statMods.hp||0));
  const baseHp5 = base.hpregen + base.hpregenperlevel * scope.BuildStats.growthFactor(L);
  const hp5 = (baseHp5 * (1 + item.hp5PctBase / 100) + item.hp5 + rune.hp5);
  const mp = (base.mp + base.mpperlevel * scope.BuildStats.growthFactor(L) + item.mp + rune.mp);
  const baseMp5 = base.mpregen + base.mpregenperlevel * scope.BuildStats.growthFactor(L);
  const mp5 = (baseMp5 * (1 + item.mp5PctBase / 100) + item.mp5 + rune.mp5);
  const ad = (base.attackdamage + base.attackdamageperlevel * scope.BuildStats.growthFactor(L) + item.ad + rune.ad + passiveAd);
  const ap = item.ap + rune.ap + passiveAp;
  const armor = (base.armor + base.armorperlevel * scope.BuildStats.growthFactor(L) + item.armor + rune.armor);
  const mr = (base.spellblock + base.spellblockperlevel * scope.BuildStats.growthFactor(L) + item.mr + rune.mr);
  const asTotal = scope.BuildStats.attackSpeed(base.attackspeed, base.attackspeedperlevel, base.attackspeedratio, L, item.asPct + rune.asPct);
  const abilityHaste = item.haste + rune.haste;
  const abilityModifiers = scope.AttackEffects.model(state, advancedItems).abilityModifiers({base});
  const basicHaste = abilityModifiers.basicHaste + (rune.basicHaste || 0);
  const ultimateHaste = abilityModifiers.ultimateHaste + (rune.ultimateHaste || 0);
  const critChance = Math.min(100, (base.crit + base.critperlevel * scope.BuildStats.growthFactor(L)) * 100 + item.critChance + rune.critChance);
  const critDamage = (base.critdamage ? base.critdamage * 100 : 200) + item.critDamage + rune.critDamage;
  const attackRange = (base.attackrange || 0) + item.attackRange + rune.attackRange + getChampionPassiveRangeBonus();
  const moveSpeed = (base.movespeed + item.msFlat + rune.msFlat) * (1 + (item.msPct + rune.msPct) / 100);

  const computed = {
    base,
    item,
    rune,
    level: L,
    hp,
    hp5,
    mp,
    mp5,
    ad,
    ap,
    armor,
    mr,
    asTotal,
    abilityHaste,
    basicHaste,
    ultimateHaste,
    critChance,
    critDamage,
    attackRange,
    moveSpeed,
    passiveLedger: ledger,
  };
  const applied = scope.AttackEffects.model(state, advancedItems).apply(scope.ChampionEffects.model(state).apply(computed));
  // Rune percentage bonuses include health/resistances earned from champion stacks.
  applied.hp *= 1 + (rune.hpPct || 0) / 100;
  applied.armor *= 1 + (rune.armorPct || 0) / 100;
  applied.mr *= 1 + (rune.mrPct || 0) / 100;
  // Deathcap also amplifies AP gained from champion stacks.
  if (['Veigar','Thresh'].includes(state.selectedChampion))applied.ap += (applied.ap - computed.ap) * (ledger.apMultiplier - 1);
  if(applied.championBonuses.ap)applied.championBonuses.ap=applied.ap-computed.ap;
  for(const [stat,value] of Object.entries(applied.championBonuses))if(value)ledger.passiveEffects.push({source:"Champion",owner:state.selectedChampion,label:"Ability / stack bonus",impact:`${value>=0?"+":""}${value.toFixed(2)} ${stat}`});
  return applied;
}

function itemPassiveEnabled(id,key) { return state.disabledItemPassives?.[`${id}:${key}`]!==true; }


function getChampionPassiveRangeBonus() {
  if (!state.championData) return 0;
  if (state.selectedChampion === "Tristana") {
    return ((Number(state.level) || 1) - 1) * (136 / 17);
  }
  return 0;
}

function computeAutoAttackProfile(computed) {
  return scope.AttackEffects.model(state, advancedItems).profile(computed);
}

function getComputedChampionStatsForTooltips() {
  const computed = computeDerivedBuildStats();
  if (!computed) return null;
  const { base, item, rune, level: L, ad, ap, armor, mr, hp, mp } = computed;

  const baseAd = base.attackdamage + base.attackdamageperlevel * scope.BuildStats.growthFactor(L);
  const totalAd = ad;
  const baseAp = 0;
  const totalAp = ap;
  const baseArmor = base.armor + base.armorperlevel * scope.BuildStats.growthFactor(L);
  const totalArmor = armor;
  const baseMr = base.spellblock + base.spellblockperlevel * scope.BuildStats.growthFactor(L);
  const totalMr = mr;
  const baseHp = base.hp + base.hpperlevel * scope.BuildStats.growthFactor(L);
  const totalHp = hp;
  const baseMp = base.mp + base.mpperlevel * scope.BuildStats.growthFactor(L);
  const totalMp = mp;

  let spellDamageMultiplier=1;
  if(state.target.enabled&&state.itemSlots.includes('4645')&&itemPassiveEnabled('4645','cinderbloom')){
    const source=advancedItems['4645'];
    const threshold=scope.Calculations.dataValue(source?.mDataValues,'HealthThreshold').value;
    const amp=scope.Calculations.dataValue(source?.mDataValues,'SpellItemDamageAmp').value;
    if(Number.isFinite(threshold)&&Number.isFinite(amp)&&state.target.currentHp/state.target.maxHp<Number(threshold.toPrecision(7)))spellDamageMultiplier=1+amp;
  }

  return {
    ap: totalAp, baseAp: 0,
    magicDamageMultiplier:spellDamageMultiplier,trueDamageMultiplier:spellDamageMultiplier,
    itemHp: item.hp,
    ranged: computed.ranged ?? base.attackrange > 300,
    healShieldPower: state.itemSlots.filter(Boolean).reduce((sum,id)=>sum+(advancedItems[id]?.mPercentHealingAmountMod||0),0),
    attackSpeed: computed.asTotal,
    bonusAttackSpeed: (base.attackspeedperlevel * scope.BuildStats.growthFactor(L) + item.asPct + rune.asPct) / 100 + (computed.bonusAttackSpeedFromChampion || 0),
    moveSpeed: computed.moveSpeed, baseMoveSpeed: base.movespeed,
    critChance: computed.critChance / 100, bonusCritChance: (item.critChance + rune.critChance) / 100,
    critDamage: computed.critDamage / 100, bonusCritDamage: (item.critDamage + rune.critDamage) / 100,
    haste: computed.abilityHaste,
    basicHaste: computed.basicHaste,
    ultimateHaste: computed.ultimateHaste,
    cooldownReduction: computed.abilityHaste / (100 + computed.abilityHaste),
    lifeSteal: (item.physicalVamp + rune.physicalVamp + (computed.championLifeSteal||0)) / 100, physicalVamp: (item.physicalVamp + rune.physicalVamp + (computed.championLifeSteal||0)) / 100, omniVamp: item.omniVamp / 100,
    magicPenFlat: computed.magicPenFlat, magicPenPct:computed.magicPenPct,
    lethality: computed.armorPenFlat, armorPenFlat:computed.armorPenFlat, armorPenPct:computed.armorPenPct, tenacity: item.tenacity / 100,
    attackRange: computed.attackRange, baseAttackRange: base.attackrange,
    bonusAttackRange: computed.attackRange - base.attackrange,
    totalAd,
    bonusAd: totalAd - baseAd,
    armor: totalArmor,
    bonusArmor: totalArmor - baseArmor,
    mr: totalMr,
    bonusMr: totalMr - baseMr,
    hp: totalHp,
    bonusHp: totalHp - baseHp,
    mp: totalMp,
    bonusMp: totalMp - baseMp,
  };
}

function getItemStats() {
  const totals = {
    hp: 0, hp5: 0, hp5PctBase: 0, mp: 0, mp5: 0, mp5PctBase: 0, ad: 0, ap: 0, armor: 0, mr: 0,
    haste: 0, asPct: 0, critChance: 0, critDamage: 0, attackRange: 0, msFlat: 0, msPct: 0,
    arPenFlat: 0, arPenPct: 0, mrPenFlat: 0, mrPenPct: 0, physicalVamp: 0, omniVamp: 0, tenacity: 0,
  };
  state.itemSlots.forEach((id) => {
    if (!id) return;
    const s = state.items[id].stats || {};
    totals.hp += s.FlatHPPoolMod || 0;
    totals.mp += s.FlatMPPoolMod || 0;
    totals.hp5 += s.FlatHPRegenMod || 0;
    totals.hp5PctBase += ((s.PercentBaseHPRegenMod || s.PercentHPRegenMod || 0) * 100);
    totals.mp5 += s.FlatMPRegenMod || 0;
    totals.mp5PctBase += ((s.PercentBaseMPRegenMod || s.PercentMPRegenMod || 0) * 100);
    totals.ad += s.FlatPhysicalDamageMod || 0;
    totals.ap += s.FlatMagicDamageMod || 0;
    totals.armor += s.FlatArmorMod || 0;
    totals.mr += s.FlatSpellBlockMod || 0;
    totals.haste += Number(
      s.FlatHasteMod
      ?? s.FlatAbilityHasteMod
      ?? s.AbilityHaste
      ?? s.FlatCooldownReduction
      ?? 0,
    );
    totals.asPct += (s.PercentAttackSpeedMod || 0) * 100;
    totals.critChance += ((s.FlatCritChanceMod || 0) + (s.PercentCritChanceMod || 0)) * 100;
    totals.critDamage += ((s.FlatCritDamageMod || 0) + (s.PercentCritDamageMod || 0)) * 100;
    totals.attackRange += s.FlatAttackRangeMod || 0;
    totals.msFlat += s.FlatMovementSpeedMod || 0;
    totals.msPct += (s.PercentMovementSpeedMod || 0) * 100;
    totals.arPenFlat += s.FlatLethalityMod || 0;
    totals.arPenPct += (s.PercentArmorPenetrationMod || 0) * 100;
    totals.mrPenFlat += s.FlatMagicPenetrationMod || 0;
    totals.mrPenPct += (s.PercentMagicPenetrationMod || 0) * 100;
    totals.physicalVamp += ((s.PercentPhysicalVampMod || 0) + (s.PercentLifeStealMod || 0)) * 100;
    totals.omniVamp += (s.PercentOmnivampMod || 0) * 100;
    totals.tenacity += (s.PercentTenacityMod || 0) * 100;
  });
  return totals;
}

function getRuneStats() {
  const totals = {
    hp: 0, hp5: 0, hp5PctBase: 0, mp: 0, mp5: 0, mp5PctBase: 0, ad: 0, ap: 0, armor: 0, mr: 0,
    haste: 0, asPct: 0, critChance: 0, critDamage: 0, attackRange: 0, msFlat: 0, msPct: 0,
    arPenFlat: 0, arPenPct: 0, mrPenFlat: 0, mrPenPct: 0, physicalVamp: 0, omniVamp: 0, tenacity: 0,
  };
  const selected = [
    ...state.runeSelections.primary,
    ...state.runeSelections.secondary,
    ...state.runeSelections.shards,
  ];

  selected.forEach((runeId) => {
    if (runeId === "ability-haste") totals.haste += 8;
    if (runeId === "attack-speed") totals.asPct += 10;
    if (runeId === "scaling-health") totals.hp += 10 + ((state.level - 1) * 190) / 17;
    if (runeId === "health") totals.hp += 65;
    if (runeId === "move-speed") totals.msPct += 2.5;
    if (runeId === "tenacity-slow-resist") totals.tenacity += 15;
    if (runeId === "armor") totals.armor += 6;
    if (runeId === "magic-resist") totals.mr += 10;

    if (runeId === "adaptive-force") {
      if (isApAdaptiveChampion()) totals.ap += 9;
      else totals.ad += 9 * 0.6;
    }

    // Sorcery: +5 Ability Haste at level 5 and again at level 8.
    if (runeId === "transcendence") {
      if (state.level >= 5) totals.haste += 5;
      if (state.level >= 8) totals.haste += 5;
    }
  });

  for (const [stat, value] of Object.entries(getStackRuneEffects().totals)) totals[stat] = (totals[stat] || 0) + value;
  return totals;
}
function passiveEvaluation(stats){
 const model=scope.ChampionEffects.model(state),summary=model.passiveSummary?.(stats);
 if(summary?.type!=='aurora')return {summary};
 const baseFraction=model.passiveSummary({...stats,ap:0}).healthFraction;
 return {summary,baseFraction,apCoefficient:model.passiveSummary({...stats,ap:100}).healthFraction-baseFraction,
  targetDamage:summary.healthFraction*state.target.maxHp};
}
function itemContribution(id,key,computed){
 if(id!=='3089' || key!=='magical-opus' || !computed)return null;
 const amp=scope.Calculations.dataValue(advancedItems[id]?.mDataValues,'APAmp').value;
 return computed.ap-computed.ap/(1+amp);
}
function summary(computed){
 return {lifeSteal:computed.item.physicalVamp+computed.rune.physicalVamp+(computed.championLifeSteal||0),
  tenacity:100*(1-(1-computed.item.tenacity/100)*(1-computed.rune.tenacity/100))};
}
 return {passiveEvaluation,itemContribution,summary,isApAdaptiveChampion,getStackRuneEffects,extractPassiveLabelsFromText,extractPassiveDescriptionsFromHtml,buildPassiveLedger,computeDerivedBuildStats,itemPassiveEnabled,getChampionPassiveRangeBonus,computeAutoAttackProfile,getComputedChampionStatsForTooltips,baseCalculationContext,calculationContext,getItemStats,getRuneStats};
}
const BuildEvaluation={create};
 scope.BuildEvaluation=BuildEvaluation;
 if(typeof module!=="undefined")module.exports=BuildEvaluation;
})(typeof window!=="undefined"?window:globalThis);
