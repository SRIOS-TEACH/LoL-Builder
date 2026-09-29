/** Ordered, single-target combo scheduling. Missing data never becomes zero. */
(function(scope) {
  const valid = value => Number.isFinite(value) && value >= 0;
  function simulate(actions) {
    let cursor = 0, total = 0, damageKnown = true, timingKnown = true;
    const ready = new Map(), chains = new Map(), timeline = [], issues = [];
    for (const [index, action] of actions.entries()) {
      const errors = [], group = action.group || action.id;
      let start = cursor;
      if (action.unavailable) errors.push('Action is unavailable for this build.');
      if (action.stage > 0) {
        const previous = chains.get(group);
        if (!previous || previous.stage !== action.stage - 1) errors.push('Add the preceding cast before this recast.');
        if (!valid(action.recastDelay)) { errors.push('Enter the recast interval.'); timingKnown = false; }
        if (previous) {
          start = Math.max(start, previous.start + (valid(action.recastDelay) ? action.recastDelay : 0));
          if (valid(action.recastWindow) && start > previous.start + action.recastWindow + 1e-8) errors.push('The recast window has expired.');
        }
      } else {
        const available = ready.get(group);
        if (available === null) { errors.push('Enter a repeat cooldown.'); timingKnown = false; }
        else start = Math.max(start, available || 0);
      }
      if (!valid(action.castTime)) { errors.push('Enter cast time / attack windup.'); timingKnown = false; }
      const end = start + (valid(action.castTime) ? action.castTime : 0);
      if (!valid(action.damage)) { errors.push('Damage is unavailable; enter a damage value.'); damageKnown = false; }
      else total += action.damage;
      if (!action.stage || action.cooldownStarts === 'last') {
        // If a chain is abandoned, a cooldown beginning after the last recast
        // starts only when the outstanding recast opportunity expires.
        const pending = action.cooldownStarts === 'last' && (action.stage || 0) < (action.lastStage || 0);
        const expiry = pending ? action.recastWindow : 0;
        ready.set(group, valid(action.cooldown) && valid(expiry) ? start + expiry + action.cooldown : null);
      }
      chains.set(group, {stage: action.stage || 0, start});
      cursor = end;
      timeline.push({start, end, wait: start - (timeline.at(-1)?.end || 0), errors, action});
      issues.push(...errors.map(message => `Step ${index + 1}: ${message}`));
    }
    const invalid = actions.some(a => a.unavailable) || issues.some(s => /preceding cast|window has expired/.test(s));
    return {timeline, total: damageKnown && !invalid ? total : null, knownDamage: total,
      duration: timingKnown && !invalid ? cursor : null, lowerBound: cursor, issues};
  }
  scope.ComboTester = {simulate};
  if (typeof module !== 'undefined') module.exports = scope.ComboTester;
})(typeof window !== 'undefined' ? window : globalThis);
