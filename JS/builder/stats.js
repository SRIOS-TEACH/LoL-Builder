(function initBuilderStats(global) {
  function readNumericStat(entry, base, aliases) {
    const entryValues = aliases.map((key) => entry?.[key]).filter((v) => v !== undefined && v !== null && v !== "").map((v) => Number(v) || 0);
    const baseValues = aliases.map((key) => base?.[key]).filter((v) => v !== undefined && v !== null && v !== "").map((v) => Number(v) || 0);
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
    const aliases = {
      FlatHPPoolMod: ["mFlatHPPoolMod", "flatHPPoolMod", "FlatHPPoolMod"],
      FlatMPPoolMod: ["mFlatMPPoolMod", "flatMPPoolMod", "FlatMPPoolMod"],
      FlatPhysicalDamageMod: ["mFlatPhysicalDamageMod", "flatPhysicalDamageMod", "FlatPhysicalDamageMod"],
      FlatMagicDamageMod: ["mFlatMagicDamageMod", "flatMagicDamageMod", "FlatMagicDamageMod"],
      FlatArmorMod: ["mFlatArmorMod", "flatArmorMod", "FlatArmorMod"],
      FlatSpellBlockMod: ["mFlatSpellBlockMod", "flatSpellBlockMod", "FlatSpellBlockMod"],
      PercentAttackSpeedMod: ["mPercentAttackSpeedMod", "percentAttackSpeedMod", "PercentAttackSpeedMod"],
      FlatMovementSpeedMod: ["mFlatMovementSpeedMod", "flatMovementSpeedMod", "FlatMovementSpeedMod"],
      PercentMovementSpeedMod: ["mPercentMovementSpeedMod", "percentMovementSpeedMod", "PercentMovementSpeedMod"],
      FlatHPRegenMod: ["mFlatHPRegenMod", "flatHPRegenMod", "FlatHPRegenMod"],
      FlatMPRegenMod: ["mFlatMPRegenMod", "flatMPRegenMod", "FlatMPRegenMod"],
      FlatCritChanceMod: ["mFlatCritChanceMod", "flatCritChanceMod", "FlatCritChanceMod"],
      PercentCritChanceMod: ["mPercentCritChanceMod", "percentCritChanceMod", "PercentCritChanceMod"],
      FlatLethalityMod: ["mFlatLethalityMod", "flatLethalityMod", "FlatLethalityMod"],
    };
    const out = { ...base };
    Object.entries(aliases).forEach(([key, list]) => {
      out[key] = readNumericStat(cdtbEntry, base, list);
    });
    const haste = readNumericStat(cdtbEntry, base, ["mAbilityHasteMod", "mFlatHasteMod", "flatHasteMod", "FlatHasteMod", "FlatAbilityHasteMod", "AbilityHaste"]);
    out.FlatHasteMod = haste;
    out.FlatAbilityHasteMod = haste;
    out.AbilityHaste = haste;
    return out;
  }

  global.BuilderStats = { readNumericStat, buildMergedItemStats };
}(window));
