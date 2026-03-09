(function initBuilderAbility(global) {
  function formatAbilityNumber(value, isPercent = false) {
    const n = Number(value || 0);
    if (isPercent) return `${n.toFixed(1)}%`;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function normalizeCalcToken(token) {
    return String(token || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function findBestCalcTokenMatch(calcLookup, token) {
    const keys = Object.keys(calcLookup || {});
    if (!keys.length) return null;
    const normalizedToken = normalizeCalcToken(token);
    const scored = keys.map((key) => {
      const normalizedKey = normalizeCalcToken(key);
      let score = -1;
      if (normalizedKey === normalizedToken) score = 1000;
      else if (normalizedKey.includes(normalizedToken)) score = 700 - (normalizedKey.length - normalizedToken.length);
      else if (normalizedToken.includes(normalizedKey)) score = 500 - (normalizedToken.length - normalizedKey.length);
      return { key, score };
    }).filter((row) => row.score >= 0).sort((a, b) => b.score - a.score);
    return scored.length ? scored[0].key : null;
  }

  function makeMissingGameCalculation(reason, displayAsPercent = false) {
    return { total: 0, terms: [{ text: reason, value: 0 }], displayAsPercent, missing: true };
  }

  function evaluateCalculationPart(part) {
    if (!part) return null;
    if (typeof part.mNumber === 'number') return { text: String(part.mNumber), value: Number(part.mNumber) };
    return null;
  }

  function evaluateGameCalculation(calc) {
    if (!calc) return null;
    const formulaParts = Array.isArray(calc.mFormulaParts) ? calc.mFormulaParts : (Array.isArray(calc.mFormula) ? calc.mFormula : null);
    if (!formulaParts) return makeMissingGameCalculation('missing formula');
    const parts = formulaParts.map((part) => evaluateCalculationPart(part)).filter(Boolean);
    return { total: parts.reduce((a, b) => a + b.value, 0), terms: parts, displayAsPercent: !!calc.mDisplayAsPercent };
  }

  global.BuilderAbility = { formatAbilityNumber, normalizeCalcToken, findBestCalcTokenMatch, evaluateCalculationPart, evaluateGameCalculation };
}(window));
