/**
 * Ability rank constraints for level-gated skill points.
 */
(function initAbilityRules(globalScope) {
  function normalizeLevel(level) {
    return Math.max(1, Math.min(18, Math.floor(Number(level) || 1)));
  }
  function abilityMaxByLevel(level, spellKey) {
    level = normalizeLevel(level);
    if (!['q', 'w', 'e', 'r'].includes(spellKey)) return 0;
    if (spellKey === 'r') {
      if (level >= 16) return 3;
      if (level >= 11) return 2;
      if (level >= 6) return 1;
      return 0;
    }
    return Math.min(5, Math.ceil(level / 2));
  }

  function enforceAbilityRules(level, ranks = {}) {
    level = normalizeLevel(level);
    const next = {};
    ['q', 'w', 'e', 'r'].forEach((k) => {
      const value = Number(ranks[k]);
      next[k] = Number.isFinite(value) ? Math.max(0, Math.min(Math.floor(value), abilityMaxByLevel(level, k))) : 0;
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
