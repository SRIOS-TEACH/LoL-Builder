/** Ordered single-target scheduling. Missing values contribute zero with explicit warnings. */
(function(scope) {
  const valid = value => Number.isFinite(value) && value >= 0;
  const types = ['physical','magic','true','untyped'];
  function damageParts(action) {
    const parts = Object.fromEntries(types.map(type => [type,0]));
    if (action.unavailable) return parts;
    const packets = action.components || [];
    const sum = packets.reduce((n,p) => n + (valid(p.value) ? p.value : 0),0);
    if (sum > 0) for (const packet of packets) {
      if (valid(packet.value)) parts[types.includes(packet.type) ? packet.type : 'untyped'] += packet.value * (valid(action.damage) ? action.damage / sum : 1);
    } else if (valid(action.damage)) parts[types.includes(action.damageType) ? action.damageType : 'untyped'] = action.damage;
    return parts;
  }
  // Both current BIN representations: explicit times or an offset from the
  // global 30% attack-delay cast fraction. Never apply a default without a record.
  function attackWindup(record, attackSpeed, baseAttackSpeed, overrideCastTime) {
    const basic = record?.basicAttack;
    if (!basic || !(attackSpeed > 0) || !(baseAttackSpeed > 0)) return null;
    let fraction = valid(basic.mAttackCastTime) && basic.mAttackTotalTime > 0
      ? basic.mAttackCastTime / basic.mAttackTotalTime
      : Number.isFinite(basic.mAttackDelayCastOffsetPercent) ? Math.max(0,0.3 + basic.mAttackDelayCastOffsetPercent) : null;
    if (valid(overrideCastTime)) fraction = overrideCastTime * baseAttackSpeed;
    if (fraction === null) return null;
    const modifier = valid(basic.mAttackDelayCastOffsetPercentAttackSpeedRatio) ? basic.mAttackDelayCastOffsetPercentAttackSpeedRatio : 1;
    return Math.max(0, fraction / baseAttackSpeed + (fraction / attackSpeed - fraction / baseAttackSpeed) * modifier);
  }
  function simulate(actions) {
    let cursor = 0, total = 0;
    const ready = new Map(), chains = new Map(), timeline = [], issues = [], damageWarnings = [], timeWarnings = [];
    const breakdown = Object.fromEntries(types.map(type => [type,0]));
    for (const [index,action] of actions.entries()) {
      const errors = [], group = action.group || action.id;
      const warn = (list,message) => { const text = `Step ${index+1}: ${message}`; list.push(text); errors.push(message); issues.push(text); };
      let start = cursor;
      if (action.unavailable) {
        warn(damageWarnings,'Action unavailable; damage assumed 0.');
        warn(timeWarnings,'Action unavailable; timing assumed 0.');
      } else if (action.stage > 0) {
        const previous = chains.get(group);
        if (!previous || previous.stage !== action.stage - 1) warn(timeWarnings,'Recast is missing its preceding cast; check order.');
        if (!valid(action.recastDelay)) warn(timeWarnings,'Recast interval missing; assumed 0.');
        if (previous) {
          start = Math.max(start,previous.start + (valid(action.recastDelay) ? action.recastDelay : 0));
          if (valid(action.recastWindow) && start > previous.start + action.recastWindow + 1e-8) warn(timeWarnings,'Recast window expired; check order.');
        }
      } else {
        const available = ready.get(group);
        if (available?.missing) warn(timeWarnings,'Repeat cooldown or recast window missing; assumed 0.');
        start = Math.max(start,available?.time || 0);
      }
      if (!action.unavailable && !valid(action.castTime)) warn(timeWarnings,'Cast time / attack windup missing; assumed 0.');
      if (!action.unavailable && !valid(action.damage)) warn(damageWarnings,'Damage missing; assumed 0.');
      const end = start + (!action.unavailable && valid(action.castTime) ? action.castTime : 0);
      const parts = damageParts(action);
      for (const type of types) breakdown[type] += parts[type];
      const damage = Object.values(parts).reduce((n,v) => n+v,0);
      total += damage;
      if (parts.untyped > 0) warn(damageWarnings,'Damage type unknown; shown as untyped.');
      if (!action.unavailable && (!action.stage || action.cooldownStarts === 'last')) {
        const pending = action.cooldownStarts === 'last' && (action.stage || 0) < (action.lastStage || 0);
        const expiry = pending ? action.recastWindow : 0;
        ready.set(group,{time:start + (valid(expiry) ? expiry : 0) + (valid(action.cooldown) ? action.cooldown : 0),missing:!valid(expiry) || !valid(action.cooldown)});
      }
      if (!action.unavailable) chains.set(group,{stage:action.stage || 0,start});
      timeline.push({start,end,wait:start-cursor,errors,action,damage,breakdown:parts});
      cursor = end;
    }
    return {timeline,total,duration:cursor,breakdown,issues,damageWarnings,timeWarnings};
  }
  scope.ComboTester = {simulate,damageParts,attackWindup};
  if (typeof module !== 'undefined') module.exports = scope.ComboTester;
})(typeof window !== 'undefined' ? window : globalThis);
