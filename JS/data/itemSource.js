/** Reusable capability; no page initialization or DOM dependency. */
(function(scope){
function readNumericStat(entry, base, aliases) {
  const entryValues = aliases
    .map((key) => entry?.[key])
    .filter((v) => v !== undefined && v !== null && v !== "")
    .map((v) => Number(v) || 0);
  const baseValues = aliases
    .map((key) => base?.[key])
    .filter((v) => v !== undefined && v !== null && v !== "")
    .map((v) => Number(v) || 0);

  const nonZeroEntry = entryValues.find((v) => v !== 0);
  if (nonZeroEntry !== undefined) return nonZeroEntry;
  const nonZeroBase = baseValues.find((v) => v !== 0);
  if (nonZeroBase !== undefined) return nonZeroBase;

  if (entryValues.length) return entryValues[0];
  if (baseValues.length) return baseValues[0];
  return 0;
}

function buildMergedItemStats(ddragonStats, cdtbEntry) {
  const base = { ...(ddragonStats || {}) };
  if (!cdtbEntry) return base;

  const cdtbStats = {
    FlatHPPoolMod: readNumericStat(cdtbEntry, base, ["mFlatHPPoolMod", "flatHPPoolMod", "FlatHPPoolMod"]),
    FlatMPPoolMod: readNumericStat(cdtbEntry, base, ["mFlatMPPoolMod", "flatMPPoolMod", "FlatMPPoolMod"]),
    FlatPhysicalDamageMod: readNumericStat(cdtbEntry, base, ["mFlatPhysicalDamageMod", "flatPhysicalDamageMod", "FlatPhysicalDamageMod"]),
    FlatMagicDamageMod: readNumericStat(cdtbEntry, base, ["mFlatMagicDamageMod", "flatMagicDamageMod", "FlatMagicDamageMod"]),
    FlatArmorMod: readNumericStat(cdtbEntry, base, ["mFlatArmorMod", "flatArmorMod", "FlatArmorMod"]),
    FlatSpellBlockMod: readNumericStat(cdtbEntry, base, ["mFlatSpellBlockMod", "flatSpellBlockMod", "FlatSpellBlockMod"]),
    PercentAttackSpeedMod: readNumericStat(cdtbEntry, base, ["mPercentAttackSpeedMod", "percentAttackSpeedMod", "PercentAttackSpeedMod"]),
    FlatMovementSpeedMod: readNumericStat(cdtbEntry, base, ["mFlatMovementSpeedMod", "flatMovementSpeedMod", "FlatMovementSpeedMod"]),
    PercentMovementSpeedMod: readNumericStat(cdtbEntry, base, ["mPercentMovementSpeedMod", "percentMovementSpeedMod", "PercentMovementSpeedMod"]),
    FlatHPRegenMod: readNumericStat(cdtbEntry, base, ["mFlatHPRegenMod", "flatHPRegenMod", "FlatHPRegenMod"]),
    FlatMPRegenMod: readNumericStat(cdtbEntry, base, ["mFlatMPRegenMod", "flatMPRegenMod", "FlatMPRegenMod"]),
    PercentBaseHPRegenMod: readNumericStat(cdtbEntry, base, ["mPercentBaseHPRegenMod", "percentBaseHPRegenMod", "mPercentHPRegenMod", "percentHPRegenMod", "PercentBaseHPRegenMod", "PercentHPRegenMod"]),
    PercentBaseMPRegenMod: readNumericStat(cdtbEntry, base, ["mPercentBaseMPRegenMod", "percentBaseMPRegenMod", "mPercentMPRegenMod", "percentMPRegenMod", "PercentBaseMPRegenMod", "PercentMPRegenMod"]),
    FlatCritChanceMod: readNumericStat(cdtbEntry, base, ["mFlatCritChanceMod", "flatCritChanceMod", "FlatCritChanceMod"]),
    PercentCritChanceMod: readNumericStat(cdtbEntry, base, ["mPercentCritChanceMod", "percentCritChanceMod", "PercentCritChanceMod"]),
    FlatCritDamageMod: readNumericStat(cdtbEntry, base, ["mFlatCritDamageMod", "flatCritDamageMod", "FlatCritDamageMod"]),
    PercentCritDamageMod: readNumericStat(cdtbEntry, base, ["mPercentCritDamageMod", "percentCritDamageMod", "PercentCritDamageMod"]),
    FlatAttackRangeMod: readNumericStat(cdtbEntry, base, ["mFlatAttackRangeMod", "flatAttackRangeMod", "FlatAttackRangeMod"]),
    FlatLethalityMod: readNumericStat(cdtbEntry, base, ["mFlatLethalityMod", "flatLethalityMod", "FlatLethalityMod"]),
    PercentArmorPenetrationMod: readNumericStat(cdtbEntry, base, ["mPercentArmorPenetrationMod", "percentArmorPenetrationMod", "PercentArmorPenetrationMod"]),
    FlatMagicPenetrationMod: readNumericStat(cdtbEntry, base, ["mFlatMagicPenetrationMod", "flatMagicPenetrationMod", "FlatMagicPenetrationMod"]),
    PercentMagicPenetrationMod: readNumericStat(cdtbEntry, base, ["mPercentMagicPenetrationMod", "percentMagicPenetrationMod", "PercentMagicPenetrationMod"]),
    PercentLifeStealMod: readNumericStat(cdtbEntry, base, ["mPercentLifeStealMod", "percentLifeStealMod", "PercentLifeStealMod"]),
    PercentOmnivampMod: readNumericStat(cdtbEntry, base, ["mPercentOmnivampMod", "percentOmnivampMod", "PercentOmnivampMod"]),
    PercentPhysicalVampMod: readNumericStat(cdtbEntry, base, ["mPercentPhysicalVampMod", "percentPhysicalVampMod", "PercentPhysicalVampMod"]),
    PercentTenacityMod: readNumericStat(cdtbEntry, base, ["mPercentTenacityMod", "percentTenacityMod", "PercentTenacityMod"]),
  };

  const haste = readNumericStat(cdtbEntry, base, ["mAbilityHasteMod", "mFlatHasteMod", "flatHasteMod", "FlatHasteMod", "FlatAbilityHasteMod", "AbilityHaste"]);
  cdtbStats.FlatHasteMod = haste;
  cdtbStats.FlatAbilityHasteMod = haste;
  cdtbStats.AbilityHaste = haste;

  return { ...base, ...cdtbStats };
}


function indexAdvancedItems(payload) {
  const records = {};
  Object.entries(payload || {}).forEach(([key,value]) => {
    const id = String(key).match(/Items\/(\d+)$/)?.[1] || String(value?.itemID || value?.id || "").match(/(\d+)$/)?.[1];
    if (id) records[id] = value;
  });
  if (!Object.keys(records).length) throw new Error('The item calculation index is empty or invalid.');
  return records;
}
function prepareItems(items, advanced, statsAdapter) {
  return Object.fromEntries(Object.entries(items).map(([id,item]) => [id,{...item,stats:buildMergedItemStats(statsAdapter.itemStatsFromDescription(item.description,item.stats),advanced?.[id])}]));
}

const api = {readNumericStat, buildMergedItemStats, indexAdvancedItems, prepareItems};
scope.ItemSource = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
