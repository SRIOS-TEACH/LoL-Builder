/** Pure stat helpers. Tooltip fallback reads the stats block, never passive prose. */
(function (scope) {
  function growthFactor(level) {
    const n = Math.max(1, Math.min(18, Number(level) || 1)) - 1;
    return n * (0.7025 + 0.0175 * n);
  }
  function attackSpeed(base, growth, ratio, level, bonusPercent) {
    return base + (ratio > 0 ? ratio : base) * (growth * growthFactor(level) + bonusPercent) / 100;
  }
  const labels = {
    'Health': 'FlatHPPoolMod', 'Mana': 'FlatMPPoolMod',
    'Attack Damage': 'FlatPhysicalDamageMod', 'Ability Power': 'FlatMagicDamageMod',
    'Armor': 'FlatArmorMod', 'Magic Resist': 'FlatSpellBlockMod',
    'Ability Haste': 'FlatHasteMod', 'Attack Speed': 'PercentAttackSpeedMod',
    'Critical Strike Chance': 'FlatCritChanceMod', 'Critical Strike Damage': 'FlatCritDamageMod',
    'Lethality': 'FlatLethalityMod', 'Magic Penetration': 'FlatMagicPenetrationMod',
    'Armor Penetration': 'PercentArmorPenetrationMod', 'Life Steal': 'PercentLifeStealMod',
    'Omnivamp': 'PercentOmnivampMod', 'Tenacity': 'PercentTenacityMod',
    'Base Health Regen': 'PercentBaseHPRegenMod', 'Base Mana Regen': 'PercentBaseMPRegenMod',
  };
  function itemStatsFromDescription(description, numericStats = {}) {
    const stats = {};
    const block = String(description || '').match(/<stats>([\s\S]*?)<\/stats>/i)?.[1] || '';
    for (const line of block.split(/<br\s*\/?\s*>/i)) {
      const text = line.replace(/<[^>]*>/g, '').trim();
      const match = text.match(/^([\d.]+)(%)?\s+(.+)$/);
      if (!match) continue;
      const [, number, percent, label] = match;
      let key = labels[label];
      if (/^(Move|Movement) Speed$/.test(label)) key = percent ? 'PercentMovementSpeedMod' : 'FlatMovementSpeedMod';
      if (label === 'Magic Penetration' && percent) key = 'PercentMagicPenetrationMod';
      if (key && Number.isFinite(Number(number))) stats[key] = Number(number) / (percent ? 100 : 1);
    }
    return { ...stats, ...numericStats };
  }
  scope.BuildStats = { growthFactor, attackSpeed, itemStatsFromDescription };
  if (typeof module !== 'undefined') module.exports = scope.BuildStats;
})(typeof window !== 'undefined' ? window : globalThis);
