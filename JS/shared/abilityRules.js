/**
 * Ability rank constraints for level-gated skill points.
 */
(function initAbilityRules(globalScope) {
  function abilityMaxByLevel(level, spellKey) {
    if (spellKey === 'r') {
      if (level >= 16) return 3;
      if (level >= 11) return 2;
      if (level >= 6) return 1;
      return 0;
    }
    return Math.min(5, Math.ceil(level / 2));
  }

  function enforceAbilityRules(level, ranks) {
    const next = { ...ranks };
    ['q', 'w', 'e', 'r'].forEach((k) => {
      next[k] = Math.min(next[k] || 0, abilityMaxByLevel(level, k));
    });
    let total = Object.values(next).reduce((a, b) => a + b, 0);
    while (total > level) {
      const pick = ['q', 'w', 'e', 'r']
        .sort((a, b) => next[b] - next[a])
        .find((k) => next[k] > 0);
      next[pick] -= 1;
      total -= 1;
    }
    return next;
  }

  const api = { abilityMaxByLevel, enforceAbilityRules };
  globalScope.AbilityRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
