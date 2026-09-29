/* Rune stack bindings. Numeric values come from the selected patch's Data Dragon
 * rune descriptions. Each parser requires a known, explicit numeric clause;
 * missing or changed clauses stay unmodeled instead of using old balance values.
 * Source: https://developer.riotgames.com/docs/lol#data-dragon */
(function(scope) {
  const clean = text => String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const number = (text, pattern, group = 1) => {
    const match = text.match(pattern);
    return match && Number.isFinite(Number(match[group])) ? Number(match[group]) : null;
  };
  const known = {
    'manaflow-band': {label: 'Ability-hit stacks', max: 10},
    'ultimate-hunter': {label: 'Unique champion takedowns', max: 5},
    'relentless-hunter': {label: 'Unique champion takedowns', max: 5},
    'treasure-hunter': {label: 'Unique champion takedowns', max: 5},
    'legend-alacrity': {label: 'Legend stacks', max: 10},
    'legend-haste': {label: 'Legend stacks', max: 10},
    'legend-bloodline': {label: 'Legend stacks', max: 15},
    'conqueror': {label: 'Active stacks', max: 12},
    'lethal-tempo': {label: 'Active stacks', max: 6},
    'dark-harvest': {label: 'Souls harvested'},
    'fleet-footwork': {label: 'Energy stacks', max: 100},
    'grasp-of-the-undying': {label: 'Permanent health procs'},
    'overgrowth': {label: 'Monsters / minions absorbed'},
    'biscuit-delivery': {label: 'Biscuits consumed or sold', max: 3},
    'jack-of-all-trades': {label: 'Different item stats', max: 10},
    'grisly-mementos': {label: 'Mementos collected', max: 18},
    'unsealed-spellbook': {label: 'Unique summoner spells swapped', max: 6},
    'magical-footwear': {label: 'Champion takedowns'},
  };
  const selected = state => [...new Set([...(state.runeSelections?.primary || []), ...(state.runeSelections?.secondary || [])])];
  const minutes = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  function definition(id, meta = {}) {
    const fallback = known[id];
    if (!fallback) return null;
    const text = clean(meta.longDesc || meta.desc);
    const out = {id, name: meta.name || id, min: 0, step: 1, ...fallback};
    const cap = number(text, /max (\d+) stacks/i) ?? number(text, /stacks up to (\d+) times/i);
    if (cap !== null) out.max = cap;
    if (id === 'manaflow-band') {
      const per = number(text, /maximum mana by ([\d.]+)/i), max = number(text, /up to ([\d.]+) mana/i);
      if (per > 0 && max !== null) out.max = Math.floor(max / per);
    }
    return out;
  }
  function normalize(value, field) {
    const parsed = Number(value);
    return Math.min(field?.max ?? Number.MAX_SAFE_INTEGER, Math.max(0, Number.isFinite(parsed) ? Math.floor(parsed) : 0));
  }
  const fields = (state, lookup) => selected(state).map(id => definition(id, lookup[id])).filter(Boolean);
  function calculate(state, lookup = {}, options = {}) {
    const totals = {hp: 0, mp: 0, ad: 0, ap: 0, haste: 0, basicHaste: 0, ultimateHaste: 0, asPct: 0, physicalVamp: 0, hpPct: 0, armor: 0, mr: 0, armorPct: 0, mrPct: 0};
    const notes = {};
    const ranged = Boolean(options.ranged), adaptiveAp = Boolean(options.adaptiveAp);
    const levelFraction = (Math.min(18, Math.max(1, Number(state.level) || 1)) - 1) / 17;
    const adaptive = amount => { totals[adaptiveAp ? 'ap' : 'ad'] += amount * (adaptiveAp ? 1 : 0.6); };
    for (const id of selected(state)) {
      const meta = lookup[id] || {}, text = clean(meta.longDesc || meta.desc);
      const count = normalize(state.runeStacks?.[id], definition(id, meta));
      const read = (pattern, group) => number(text, pattern, group);
      let modeled = false;
      const add = (stat, amount) => { if (amount !== null && Number.isFinite(amount)) { totals[stat] += amount; modeled = true; } };
      if (id === 'manaflow-band') {
        const per = read(/maximum mana by ([\d.]+)/i);
        if (per !== null) { add('mp', per * count); notes[id] = `+${per * count} maximum mana. Missing-mana regeneration is conditional and is not included in MP/5.`; }
      }
      if (id === 'ultimate-hunter') {
        const base = read(/ultimate gains ([\d.]+) Ability Haste/i), per = read(/additional ([\d.]+) Ability Haste per/i);
        if (base !== null && per !== null) { add('ultimateHaste', base + per * count); notes[id] = `+${base + per * count} ultimate ability haste.`; }
      }
      if (id === 'legend-alacrity') {
        const base = read(/Gain ([\d.]+)% attack speed/i), per = read(/additional ([\d.]+)% for every/i);
        if (base !== null && per !== null) add('asPct', base + per * count);
      }
      if (id === 'legend-haste') {
        const per = read(/Gain ([\d.]+) basic ability haste for every/i);
        if (per !== null) add('basicHaste', per * count);
      }
      if (id === 'legend-bloodline') {
        const per = read(/Gain ([\d.]+)% Life Steal/i), health = read(/gain ([\d.]+) max health/i);
        if (per !== null) add('physicalVamp', per * count);
        if (health !== null && count === definition(id, meta).max) add('hp', health);
      }
      if (id === 'biscuit-delivery') {
        const per = read(/increases your max health by ([\d.]+)/i);
        if (per !== null) add('hp', per * count);
      }
      if (id === 'grasp-of-the-undying') {
        const per = read(/increase your health by ([\d.]+)/i), rangePercent = read(/health gained are ([\d.]+)% effective/i);
        if (per !== null && (!ranged || rangePercent !== null)) add('hp', per * count * (ranged ? rangePercent / 100 : 1));
        notes[id] = 'Permanent health is included. The triggered attack damage and healing are not included in attack results.';
      }
      if (id === 'overgrowth') {
        const per = read(/gaining ([\d.]+) maximum health for every/i), group = read(/maximum health for every ([\d.]+)/i);
        const threshold = read(/absorbed ([\d.]+) monsters/i), percent = read(/additional ([\d.]+)% maximum health/i);
        if (per !== null && group > 0) add('hp', Math.floor(count / group) * per);
        if (threshold !== null && percent !== null && count >= threshold) add('hpPct', percent);
      }
      if (id === 'conqueror') {
        const low = read(/gaining ([\d.]+)\s*-\s*([\d.]+) Adaptive Force per stack/i), high = read(/gaining ([\d.]+)\s*-\s*([\d.]+) Adaptive Force per stack/i, 2);
        if (low !== null && high !== null) { adaptive((low + (high - low) * levelFraction) * count); modeled = true; }
        notes[id] = 'Active adaptive-force stacks are included. Full-stack healing is not included in Lifesteal.';
      }
      if (id === 'lethal-tempo') {
        const per = read(ranged ? /\|\|\s*([\d.]+)% Ranged\] Attack Speed/i : /\[([\d.]+)% Melee/i);
        if (per !== null) add('asPct', per * count);
        notes[id] = 'Active attack speed is included. The maximum-stack on-attack damage is not included in attack results.';
      }
      if (id === 'jack-of-all-trades') {
        const per = read(/stack grants you ([\d.]+) Ability Haste/i), low = read(/Gain ([\d.]+) or ([\d.]+) bonus/i), high = read(/Gain ([\d.]+) or ([\d.]+) bonus/i, 2);
        const lowCount = read(/at (\d+) and (\d+) stacks/i), highCount = read(/at (\d+) and (\d+) stacks/i, 2);
        if (per !== null) add('haste', per * count);
        if ([low, high, lowCount, highCount].every(v => v !== null)) { adaptive(count >= highCount ? high : count >= lowCount ? low : 0); modeled = true; }
      }
      if (id === 'gathering-storm') {
        // The explicit milestones establish the cumulative 1+2+…+n schedule.
        const milestones = [...text.matchAll(/(\d+) min\s*:\s*\+\s*([\d.]+) AP/gi)].map(m => [Number(m[1]), Number(m[2])]);
        const interval = milestones[0]?.[0], per = milestones[0]?.[1];
        if (interval > 0 && per > 0 && milestones.length >= 3 && milestones.every(([time, amount], i) => time === interval * (i + 1) && amount === per * (i + 1) * (i + 2) / 2)) {
          const n = Math.floor(minutes(state.gameTimeMinutes) / interval);
          adaptive(per * n * (n + 1) / 2); modeled = true;
        }
      }
      if (id === 'conditioning') {
        const at = read(/After ([\d.]+) min/i), armor = read(/gain \+([\d.]+) Armor/i), mr = read(/and \+([\d.]+) Magic Resist/i), percent = read(/increase your Armor and Magic Resist by ([\d.]+)%/i);
        if (at !== null && minutes(state.gameTimeMinutes) >= at) { add('armor', armor); add('mr', mr); add('armorPct', percent); add('mrPct', percent); }
      }
      if (known[id] && !modeled && !notes[id]) notes[id] = 'Stack count is retained; this rune’s combat, economy or vision effect is not included in champion totals.';
      if (known[id] && modeled && !notes[id]) notes[id] = 'Stack bonuses are included in champion stats and ability calculations.';
    }
    return {totals, notes};
  }
  scope.RuneEffects = {selected, fields, definition, normalize, minutes, calculate};
})(typeof window !== 'undefined' ? window : globalThis);
