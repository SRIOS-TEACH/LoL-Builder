/**
 * Item Lookup controller.
 *
 * Responsibilities:
 * - Load purchasable Data Dragon items and filter by selected maps.
 * - Load CommunityDragon item calculation payloads for richer formula detail.
 * - Render item cost, stats, tooltip body, and tags for the selected item.
 * - Color-code stat keywords in tooltip/details using the shared color table.
 *
 * Flow:
 * 1) `initItemLookup` loads versioned item data + CommunityDragon calculations.
 * 2) Search/tag filters update `ITEM_STATE.filteredIds` then render the icon grid.
 * 3) `showItem` composes the detailed panel (cost/stats/tooltip/tags).
 */
const ITEM_STATE = {
  version: "",
  items: {},
  filteredIds: [],
  tags: new Set(),
  selectedTags: new Set(),
  selectedMaps: new Set([11]),
  selectedId: null,
  cdragonById: {},
  extractedById: {},
};

/**
 * Canonical raw stat key mapping from Data Dragon stat fields to readable labels.
 */
const RAW_STAT_KEYS = {
  FlatHPPoolMod: "Health",
  FlatMPPoolMod: "Mana",
  FlatPhysicalDamageMod: "Attack Damage",
  FlatMagicDamageMod: "Ability Power",
  FlatArmorMod: "Armor",
  FlatSpellBlockMod: "Magic Resist",
  FlatCritChanceMod: "Critical Strike Chance",
  FlatMovementSpeedMod: "Movement Speed",
  FlatEnergyPoolMod: "Energy",
  FlatHasteMod: "Ability Haste",
  PercentAttackSpeedMod: "Attack Speed",
  PercentMovementSpeedMod: "Movement Speed",
  PercentLifeStealMod: "Life Steal",
  PercentOmnivampMod: "Omnivamp",
  PercentSpellVampMod: "Omnivamp",
  PercentArmorPenetrationMod: "Armor Penetration",
  PercentMagicPenetrationMod: "Magic Penetration",
  FlatMagicPenetrationMod: "Magic Penetration",
  FlatLethalityMod: "Lethality",
};

const MAP_OPTIONS = [
  { id: 11, label: "Summoners Rift" },
  { id: 12, label: "ARAM" },
  { id: 30, label: "Arena" },
];

const FORCE_INCLUDE_ITEM_IDS = new Set(["3040", "3042", "3121"]);

/**
 * Ordered keyword->color table used for tooltip/detail stat highlighting.
 */
const STAT_COLOR_RULES = [
  ["health", "#1F995C"], ["hp", "#1F995C"],
  ["attack damage", "orange"], ["attack's damage", "orange"], ["ad", "orange"],
  ["physical damage", "#FF8C34"], ["pd", "#FF8C34"],
  ["ability power", "#7A6DFF"], ["ap", "#7A6DFF"],
  ["magic damage", "#00B0F0"], ["md", "#00B0F0"],
  ["true damage", "#F9966B"], ["td", "#F9966B"],
  ["omnivamp", "#CC2051"], ["leech", "#CC2051"], ["life steal", "#CC2051"],
  ["mana", "#0099CC"], ["energy", "yellow"],
  ["critical strike chance", "orangered"], ["critical chance", "orangered"], ["crit chance", "orangered"],
  ["critical strike damage", "#944B00"], ["critical damage", "#944B00"], ["crit damage", "#944B00"], ["crit", "#944B00"],
  ["movement speed", "#FFFDC9"], ["move speed", "#FFFDC9"], ["ms", "#FFFDC9"],
  ["experience", "#883FD1"], ["xp", "#883FD1"], ["gold", "#FFD700"],
  ["heal and shield power", "#60E08F"], ["hsp", "#60E08F"], ["heal", "#60E08F"],
  ["ability haste", "#7ADECD"], ["ah", "#7ADECD"], ["haste", "#7ADECD"],
  ["lethality", "tomato"], ["armor penetration", "tomato"],
  ["armor", "yellow"], ["ar", "yellow"],
  ["magic penetration", "violet"],
  ["magic resist", "#00FFFF"], ["mr", "#00FFFF"], ["resist", "#00FFFF"],
  ["attack range", "#AEB3BD"],
  ["attack speed", "#F5EE99"], ["as", "#F5EE99"],
  ["buzzword4", "#BB76AC"], ["buzzword3", "#E34D4C"], ["buzzword2", "#56C456"], ["buzzword", "#BD1EBD"],
  ["siphoning strike", "#594BDD"], ["soul", "#5C58C9"], ["mist", "#26DFB0"], ["wild", "#A01D7A"],
  ["placed", "#883FD1"], ["fury", "#FA6533"], ["river", "#43D9FB"], ["terrain", "#B36F21"],
  ["brush", "#96FB97"], ["life point", "#56C456"], ["main", "#CA2697"], ["off%-hand", "#E34D4C"],
  ["sweetspot", "#E34D4C"], ["exalted", "#FF7F00"], ["steel", "#748DD0"], ["azakana", "#E34D4C"],
].sort((a, b) => b[0].length - a[0].length);

/**
 * Returns true when an item is purchasable and available on at least one map.
 */
function isPurchasableItem(id, item) {
  if (FORCE_INCLUDE_ITEM_IDS.has(String(id))) return true;
  const mapEnabled = Object.values(item.maps || {}).some(Boolean);
  return item.gold?.purchasable && mapEnabled && !item.requiredAlly;
}

/**
 * Returns true when an item can be purchased on any currently-selected map.
 */
function itemMatchesSelectedMaps(item) {
  const maps = item.maps || {};
  return Array.from(ITEM_STATE.selectedMaps).some((mapId) => maps[mapId]);
}

/**
 * Chooses one representative item id per normalized item name based on selected map priority.
 */
function dedupeByNameWithMapPriority(itemEntries, selectedMaps = ITEM_STATE.selectedMaps) {
  const selectedOrder = MAP_OPTIONS.map((m) => m.id).filter((id) => selectedMaps.has(id));
  const byName = {};

  function rankItem(id, item) {
    const maps = item.maps || {};
    const selectedIdx = selectedOrder.findIndex((mapId) => maps[mapId]);
    const enabledMapCount = Object.values(maps).filter(Boolean).length;
    const numericId = Number(id);
    return {
      selectedIdx: selectedIdx === -1 ? Number.MAX_SAFE_INTEGER : selectedIdx,
      enabledMapCount,
      numericId,
    };
  }

  function isBetterCandidate(incoming, current) {
    if (incoming.selectedIdx !== current.selectedIdx) return incoming.selectedIdx < current.selectedIdx;
    if (incoming.enabledMapCount !== current.enabledMapCount) return incoming.enabledMapCount > current.enabledMapCount;
    return incoming.numericId < current.numericId;
  }

  itemEntries.forEach(([id, item]) => {
    const key = item.name.trim().toLowerCase();
    const current = byName[key];
    if (!current) {
      byName[key] = { id, item };
      return;
    }

    const currentRank = rankItem(current.id, current.item);
    const incomingRank = rankItem(id, item);
    if (isBetterCandidate(incomingRank, currentRank)) byName[key] = { id, item };
  });

  return Object.values(byName).map(({ id, item }) => [id, item]);
}

/**
 * Fetches CommunityDragon item calculations and indexes them by numeric item id.
 */
async function loadCommunityDragonCalcs() {
  try {
    const payload = await fetch("https://raw.communitydragon.org/latest/game/items.cdtb.bin.json").then((r) => r.json());
    Object.entries(payload).forEach(([key, value]) => {
      const match = key.match(/^Items\/(\d+)$/);
      if (match) ITEM_STATE.cdragonById[match[1]] = value;
    });
  } catch (error) {
    console.warn("CommunityDragon calc data unavailable", error);
  }
}

/**
 * Resolves a generated tooltip token (e.g. e1/e2) to its value from item effect data.
 */
function resolveEffectToken(item, token) {
  if (!item.effect) return null;
  if (item.effect[token] !== undefined) return item.effect[token];
  const tokenUpper = token.toUpperCase();
  if (item.effect[tokenUpper] !== undefined) return item.effect[tokenUpper];
  const match = token.match(/^e(\d+)$/i);
  if (match) {
    const key = `Effect${match[1]}Amount`;
    if (item.effect[key] !== undefined) return item.effect[key];
  }
  return null;
}

/**
 * Replaces Data Dragon formula tokens in item description HTML with concrete values.
 */
function resolveDescriptionFormulas(item, descriptionHtml) {
  return (descriptionHtml || "").replace(/{{\s*([^}\s]+)\s*}}/g, (_, token) => {
    const resolved = resolveEffectToken(item, token);
    return resolved !== null ? String(resolved) : `{{${token}}}`;
  });
}

/**
 * Escapes regex metacharacters in a keyword.
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Applies the configured stat color table to plain text segments while preserving HTML tags.
 */
function colorizeStatsInHtml(html) {
  const segments = String(html).split(/(<[^>]+>)/g);
  const colored = segments.map((segment) => {
    if (segment.startsWith("<") && segment.endsWith(">")) return segment;
    let text = segment;
    STAT_COLOR_RULES.forEach(([keyword, color]) => {
      const pattern = new RegExp(`\\b(${escapeRegExp(keyword)})\\b`, "gi");
      text = text.replace(pattern, `<span class="stat-colored" style="color:${color}">$1</span>`);
    });
    return text;
  });
  return colored.join("");
}

/**
 * Converts a Data Dragon raw stats object into display rows.
 */
function extractRawStats(item) {
  const stats = item.stats || {};
  return Object.entries(stats)
    .filter(([, value]) => Number(value) !== 0)
    .map(([key, value]) => {
      const label = RAW_STAT_KEYS[key] || key;
      const numeric = Number(value);
      const pct = key.startsWith("Percent") ? `${(numeric * 100).toFixed(2).replace(/\.00$/, "")}%` : `${numeric}`;
      const signed = numeric > 0 ? `+${pct}` : pct;
      return { key, label, value: signed };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Infers a friendly stat label from a calculation data-value key name.
 */
function inferStatFromDataValueName(name) {
  const key = (name || "").toLowerCase();
  if (!key) return null;
  if (key.includes("ap") || key.includes("magicdamage") || key.includes("spelldamage")) return "AP";
  if (key.includes("ad") || key.includes("physical")) return "AD";
  if (key.includes("armor") || key.includes("resist") || key.includes("mr")) return "resistances";
  if (key.includes("as") || key.includes("attackspeed")) return "attack speed";
  if (key.includes("ms") || key.includes("movespeed")) return "move speed";
  if (key.includes("crit")) return "critical strike chance";
  if (key.includes("health") || key.includes("hp")) return "health";
  return null;
}

/**
 * Builds a readable label for a stats-calculation part using known stat ids or inferred names.
 */
function statLabel(part, dataValueName = "") {
  const labels = {
    0: "AP", 1: "armor", 2: "AD", 3: "attack speed", 4: "attack speed", 5: "magic resist", 6: "magic resist",
    7: "move speed", 8: "critical strike chance", 11: "AP", 12: "max health", 18: "lethality", 19: "armor penetration",
    20: "magic penetration", 21: "magic penetration", 29: "target max health", 30: "bonus health", 31: "total health", 34: "attack speed",
  };

  if (part?.mStat === 2) {
    if (part.mStatFormula === 1) return "base AD";
    if (part.mStatFormula === 2) return "bonus AD";
    return "total AD";
  }

  if (part?.mStat === undefined || part?.mStat === null) return inferStatFromDataValueName(dataValueName) || "AP";
  return labels[part?.mStat] || inferStatFromDataValueName(dataValueName) || "scaling stat";
}

/**
 * Converts a calculation requirement object into a user-facing text snippet.
 */
function calcRequirementToText(req) {
  if (!req || typeof req !== "object") return "condition";
  if (req.__type === "IsRangedCastRequirement") return "ranged users";
  return req.__type || "condition";
}

/**
 * Converts one CommunityDragon formula part into readable text.
 */
function formulaPartToText(part, dataValueMap, calcMap) {
  if (!part) return "0";
  switch (part.__type) {
    case "NumberCalculationPart":
      return String(part.mNumber ?? 0);
    case "StatByCoefficientCalculationPart": {
      const coef = Number(part.mCoefficient ?? 0);
      return `${(coef * 100).toFixed(coef % 1 ? 1 : 0)}% ${statLabel(part, part.mDataValue)}`;
    }
    case "NamedDataValueCalculationPart": {
      const val = dataValueMap[part.mDataValue];
      return val !== undefined ? `${val}` : part.mDataValue;
    }
    case "StatByNamedDataValueCalculationPart": {
      const val = dataValueMap[part.mDataValue];
      if (val !== undefined) return `${(Number(val) * 100).toFixed(Number(val) % 1 ? 1 : 0)}% ${statLabel(part, part.mDataValue)}`;
      return `${part.mDataValue} × ${statLabel(part, part.mDataValue)}`;
    }
    case "AbilityResourceByCoefficientCalculationPart": {
      const coef = Number(part.mCoefficient ?? 0);
      return `${(coef * 100).toFixed(coef % 1 ? 1 : 0)}% mana`;
    }
    case "ByCharLevelInterpolationCalculationPart":
      return `${part.mStartValue ?? 0} → ${part.mEndValue ?? 0} (levels 1-18)`;
    case "ByCharLevelBreakpointsCalculationPart": {
      const first = Number(part.mLevel1Value ?? 0);
      const bps = (part.mBreakpoints || []).map((bp) => {
        const lvl = bp.mLevel ?? "?";
        const add = Number(bp.mAdditionalBonusAtThisLevel ?? 0);
        const per = Number(bp.mBonusPerLevelAtAndAfter ?? 0);
        if (add) return `L${lvl}: ${add > 0 ? "+" : ""}${add}`;
        if (per) return `L${lvl}: ${per > 0 ? "+" : ""}${per}/lvl`;
        return `L${lvl}`;
      }).join(", ");
      return `${first} at L1${bps ? `; ${bps}` : ""}`;
    }
    case "BuffCounterByCoefficientCalculationPart":
      return `${part.mCoefficient ?? 1} × buffCount(${part.mBuffName || "buff"})`;
    case "BuffCounterByNamedDataValueCalculationPart": {
      const val = dataValueMap[part.mDataValue];
      return `${val !== undefined ? val : part.mDataValue} × buffCount(${part.mBuffName || "buff"})`;
    }
    case "EffectValueCalculationPart":
      return `effect[${part.mEffectIndex}]`;
    case "ProductOfSubPartsCalculationPart":
      return `(${formulaPartToText(part.mPart1, dataValueMap, calcMap)}) × (${formulaPartToText(part.mPart2, dataValueMap, calcMap)})`;
    case "SumOfSubPartsCalculationPart":
      return (part.mSubparts || []).map((p) => `(${formulaPartToText(p, dataValueMap, calcMap)})`).join(" + ");
    case "StatBySubPartCalculationPart":
      return `(${formulaPartToText(part.mSubpart, dataValueMap, calcMap)}) × ${statLabel(part, part.mDataValue)}`;
    case "ClampSubPartsCalculationPart": {
      const sum = (part.mSubparts || []).map((p) => `(${formulaPartToText(p, dataValueMap, calcMap)})`).join(" + ");
      return `min(${part.mCeiling ?? "ceiling"}, ${sum})`;
    }
    case "GameCalculationPart": {
      const nested = calcMap[part.mCalculation];
      return nested ? gameCalculationToText(part.mCalculation, nested, calcMap, dataValueMap) : part.mCalculation;
    }
    default:
      return `[${part.__type || "unknown part"}]`;
  }
}

/**
 * Converts a full game calculation entry into a single readable sentence.
 */
function gameCalculationToText(calcName, calc, calcMap, dataValueMap) {
  if (!calc || typeof calc !== "object") return "";
  if (Array.isArray(calc.mFormulaParts)) {
    const base = (calc.mFormulaParts || []).map((p) => formulaPartToText(p, dataValueMap, calcMap)).join(" + ");
    if (calc.mRangedMultiplier) {
      const ranged = formulaPartToText(calc.mRangedMultiplier, dataValueMap, calcMap);
      return `${base} (${ranged} for ranged)`;
    }
    return base;
  }

  if (calc.__type === "GameCalculationModified") {
    const base = calcMap[calc.mModifiedGameCalculation];
    const baseText = base ? gameCalculationToText(calc.mModifiedGameCalculation, base, calcMap, dataValueMap) : calc.mModifiedGameCalculation;
    return `(${baseText}) × (${formulaPartToText(calc.mMultiplier, dataValueMap, calcMap)})`;
  }

  if (calc.__type === "GameCalculationConditional") {
    const req = calcRequirementToText(calc.mConditionalCalculationRequirements);
    const def = calcMap[calc.mDefaultGameCalculation]
      ? gameCalculationToText(calc.mDefaultGameCalculation, calcMap[calc.mDefaultGameCalculation], calcMap, dataValueMap)
      : calc.mDefaultGameCalculation;
    const cond = calcMap[calc.mConditionalGameCalculation]
      ? gameCalculationToText(calc.mConditionalGameCalculation, calcMap[calc.mConditionalGameCalculation], calcMap, dataValueMap)
      : calc.mConditionalGameCalculation;
    return `${def} (or ${cond} for ${req})`;
  }

  return `[${calc.__type || calcName}]`;
}

/**
 * Humanizes a calc key for display.
 */
function prettyCalcName(name) {
  if (!name) return "Calculation";
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bDps\b/i, "DPS")
    .trim();
}

/**
 * Categorizes item effect lines for later builder integration.
 */
function categorizeEffect(name, text) {
  const v = `${name} ${text}`.toLowerCase();
  if (v.includes("spellblade")) return "Spellblade";
  if (v.includes("on-hit") || v.includes("on hit")) return "On-hit";
  if (v.includes("active") || v.includes("cooldown") || v.includes(" range")) return "Active";
  if (v.includes("burn")) return "Burn";
  if (v.includes("ability") || v.includes("spell")) return "On-ability";
  return "On-ability";
}

/**
 * Builds calculation rows and a serializable extraction payload for one item.
 */
function buildExtractedFormulas(itemId) {
  const cItem = ITEM_STATE.cdragonById[itemId];
  if (!cItem || !cItem.mItemCalculations) return { lines: [], extracted: [] };

  const calcMap = cItem.mItemCalculations || {};
  const dataValueMap = {};
  (cItem.mDataValues || []).forEach((d) => {
    dataValueMap[d.mName] = d.mValue;
  });

  const lines = [];
  const extracted = [];
  Object.entries(calcMap).forEach(([name, calc]) => {
    const formula = gameCalculationToText(name, calc, calcMap, dataValueMap);
    if (!formula) return;
    const isPureNumeric = /^\s*[0-9.]+\s*$/.test(formula);
    if (isPureNumeric && !/damage|shield|heal|cooldown/i.test(name)) return;
    const cleanName = prettyCalcName(name);
    const category = categorizeEffect(cleanName, formula);
    lines.push({ name: cleanName, formula, category });
    extracted.push({ key: name, name: cleanName, category, formula });
  });

  const burnExtras = buildBurnMetrics(dataValueMap);
  burnExtras.forEach((b) => {
    lines.push({ name: b.name, formula: b.formula, category: "Burn" });
    extracted.push({ key: b.key, name: b.name, category: "Burn", formula: b.formula, meta: b.meta });
  });

  return { lines, extracted };
}

/**
 * Builds a name->value map for CommunityDragon mDataValues for one item.
 */
function getCdragonDataValueMap(itemId) {
  const cItem = ITEM_STATE.cdragonById[itemId];
  const map = {};
  (cItem?.mDataValues || []).forEach((d) => {
    map[d.mName] = Number(d.mValue);
  });
  return map;
}

/**
 * Attempts to infer an item active cooldown from CommunityDragon data values.
 * Prefers generic active cooldown keys (e.g. Cooldown/ActiveCooldown) and avoids passive-only keys like SpellbladeCooldown.
 */
function inferActiveCooldownSeconds(itemId) {
  const values = getCdragonDataValueMap(itemId);
  const entries = Object.entries(values)
    .filter(([name, value]) => /cooldown/i.test(name) && Number.isFinite(value) && value > 0);
  if (!entries.length) return null;

  const preferredMatchers = [
    /^Cooldown$/i,
    /Active.*Cooldown/i,
    /Item.*Cooldown/i,
    /SpellDamage.*Cooldown/i,
  ];

  for (const matcher of preferredMatchers) {
    const hit = entries.find(([name]) => matcher.test(name));
    if (hit) return Number(hit[1]);
  }

  const nonPassive = entries.find(([name]) => !/spellblade|sheen|onhit/i.test(name));
  if (nonPassive) return Number(nonPassive[1]);

  return null;
}


/**
 * Bolds ACTIVE cooldown headers and injects computed active damage formulas into tooltip text.
 */
function enhanceActiveTooltip(descriptionHtml, formulaLines) {
  let enhanced = String(descriptionHtml || "");
  enhanced = enhanced.replace(/(ACTIVE\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");

  const activeDamage = (formulaLines || []).find((line) => /active\s*damage/i.test(line.name))
    || (formulaLines || []).find((line) => line.category === "Active" && /damage/i.test(line.name));

  if (activeDamage) {
    enhanced = enhanced.replace(/dealing\s+magic damage/i, `dealing ${activeDamage.formula} magic damage`);
  }

  return enhanced;
}

/**
 * Replaces placeholder ACTIVE cooldown text with inferred cooldown seconds.
 */
function injectActiveCooldown(descriptionHtml, cooldownSeconds) {
  if (cooldownSeconds === null || cooldownSeconds === undefined) return String(descriptionHtml || "");
  let normalized = String(descriptionHtml || "");
  normalized = normalized.replace(/(<active>\s*ACTIVE\s*<\/active>\s*)\((?:0|0\.0+)s\)/i, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, `$1${cooldownSeconds}s$2`);
  return normalized;
}

/**
 * Bolds ACTIVE cooldown headers and injects computed active damage formulas into tooltip text.
 */
function enhanceActiveTooltip(descriptionHtml, formulaLines) {
  let enhanced = String(descriptionHtml || "");
  enhanced = enhanced.replace(/(<active>\s*ACTIVE\s*<\/active>\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");
  enhanced = enhanced.replace(/(ACTIVE\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");

  const activeDamage = (formulaLines || []).find((line) => /active\s*damage/i.test(line.name))
    || (formulaLines || []).find((line) => line.category === "Active" && /damage/i.test(line.name));

  if (activeDamage) {
    enhanced = enhanced.replace(/dealing\s*<magicDamage>\s*magic damage\s*<\/magicDamage>/i, `dealing ${activeDamage.formula} magic damage`);
    enhanced = enhanced.replace(/dealing\s+magic damage/i, `dealing ${activeDamage.formula} magic damage`);
  }

  return enhanced;
}

/**
 * Replaces placeholder ACTIVE cooldown text with inferred cooldown seconds.
 */
function injectActiveCooldown(descriptionHtml, cooldownSeconds) {
  if (cooldownSeconds === null || cooldownSeconds === undefined) return String(descriptionHtml || "");
  let normalized = String(descriptionHtml || "");
  normalized = normalized.replace(/(<active>\s*ACTIVE\s*<\/active>\s*)\((?:0|0\.0+)s\)/i, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, `$1${cooldownSeconds}s$2`);
  return normalized;
}

/**
 * Colors numeric tokens in formulas by damage type for readability.
 */
function colorFormulaNumbers(formulaText, damageType) {
  const colors = { magic: "#00B0F0", physical: "#FF8C34", true: "#F9966B" };
  const color = colors[damageType];
  if (!color) return formulaText;
  return formulaText.replace(/\b\d+(?:\.\d+)?%?\b/g, (n) => `<span class="stat-colored" style="color:${color}">${n}</span>`);
}

/**
 * Injects extracted damage formulas into generic damage phrases across item tooltips.
 */
function injectDamageFormulaText(descriptionHtml, formulaLines) {
  let enhanced = String(descriptionHtml || "");
  const damageLines = (formulaLines || []).filter((line) => /damage/i.test(`${line.name} ${line.formula}`));
  if (!damageLines.length) return enhanced;

  const patterns = [
    { type: "magic", regex: /dealing\s*<magicDamage>\s*magic damage\s*<\/magicDamage>/i },
    { type: "physical", regex: /dealing\s*<physicalDamage>\s*physical damage\s*<\/physicalDamage>/i },
    { type: "true", regex: /dealing\s*<trueDamage>\s*true damage\s*<\/trueDamage>/i },
    { type: "magic", regex: /dealing\s+magic damage/i },
    { type: "physical", regex: /dealing\s+physical damage/i },
    { type: "true", regex: /dealing\s+true damage/i },
  ];

  patterns.forEach(({ type, regex }) => {
    if (!regex.test(enhanced)) return;
    const line = damageLines.find((l) => new RegExp(type, "i").test(`${l.name} ${l.formula}`)) || damageLines[0];
    const coloredFormula = colorFormulaNumbers(line.formula, type);
    enhanced = enhanced.replace(regex, `dealing ${coloredFormula} ${type} damage`);
  });

  return enhanced;
}

/**
 * Bolds ACTIVE headers and formats active name inline with cooldown.
 */
function enhanceActiveTooltip(descriptionHtml) {
  let enhanced = String(descriptionHtml || "");
  enhanced = enhanced.replace(
    /<active>\s*ACTIVE\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*<active>([^<]+)<\/active>/i,
    (_match, cooldown, name) => `<strong><active>ACTIVE - ${name.trim()} (${cooldown})</active></strong>`
  );
  enhanced = enhanced.replace(/(ACTIVE\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");
  return enhanced;
}

/**
 * Replaces placeholder ACTIVE cooldown text with inferred cooldown seconds.
 */
function injectActiveCooldown(descriptionHtml, cooldownSeconds) {
  if (cooldownSeconds === null || cooldownSeconds === undefined) return String(descriptionHtml || "");
  let normalized = String(descriptionHtml || "");
  normalized = normalized.replace(/(<active>\s*ACTIVE\s*<\/active>\s*)\((?:0|0\.0+)s\)/i, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, `$1${cooldownSeconds}s$2`);
  return normalized;
}

/**
 * Colors numeric tokens in formulas by damage type for readability.
 */
function colorFormulaNumbers(formulaText, damageType) {
  const colors = { magic: "#00B0F0", physical: "#FF8C34", true: "#F9966B" };
  const color = colors[damageType];
  if (!color) return formulaText;
  return formulaText.replace(/\b\d+(?:\.\d+)?%?\b/g, (n) => `<span class="stat-colored" style="color:${color}">${n}</span>`);
}

/**
 * Injects extracted damage formulas into generic damage phrases across item tooltips.
 */
function injectDamageFormulaText(descriptionHtml, formulaLines) {
  let enhanced = String(descriptionHtml || "");
  const damageLines = (formulaLines || []).filter((line) => /damage/i.test(`${line.name} ${line.formula}`));
  if (!damageLines.length) return enhanced;

  const patterns = [
    { type: "magic", regex: /dealing\s*<magicDamage>\s*magic damage\s*<\/magicDamage>/i },
    { type: "physical", regex: /dealing\s*<physicalDamage>\s*physical damage\s*<\/physicalDamage>/i },
    { type: "true", regex: /dealing\s*<trueDamage>\s*true damage\s*<\/trueDamage>/i },
    { type: "magic", regex: /dealing\s+magic damage/i },
    { type: "physical", regex: /dealing\s+physical damage/i },
    { type: "true", regex: /dealing\s+true damage/i },
  ];

  patterns.forEach(({ type, regex }) => {
    if (!regex.test(enhanced)) return;
    const line = damageLines.find((l) => new RegExp(type, "i").test(`${l.name} ${l.formula}`)) || damageLines[0];
    const coloredFormula = colorFormulaNumbers(line.formula, type);
    enhanced = enhanced.replace(regex, `dealing ${coloredFormula} ${type} damage`);
  });

  return enhanced;
}

/**
 * Bolds ACTIVE headers and formats active name inline with cooldown.
 */
function enhanceActiveTooltip(descriptionHtml) {
  let enhanced = String(descriptionHtml || "");
  enhanced = enhanced.replace(
    /<active>\s*ACTIVE\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*<active>([^<]+)<\/active>/i,
    (_match, cooldown, name) => `<strong><active>ACTIVE - ${name.trim()} (${cooldown})</active></strong>`
  );
  enhanced = enhanced.replace(/(ACTIVE\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");
  return enhanced;
}

/**
 * Replaces placeholder ACTIVE cooldown text with inferred cooldown seconds.
 */
function injectActiveCooldown(descriptionHtml, cooldownSeconds) {
  if (cooldownSeconds === null || cooldownSeconds === undefined) return String(descriptionHtml || "");
  let normalized = String(descriptionHtml || "");
  normalized = normalized.replace(/(<active>\s*ACTIVE\s*<\/active>\s*)\((?:0|0\.0+)s\)/i, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(<active>\s*[^<]+\s*<\/active>\s*)\((?:0|0\.0+)s\)/i, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, `$1${cooldownSeconds}s$2`);
  return normalized;
}

/**
 * Colors numeric tokens in formulas by damage type for readability.
 */
function colorFormulaNumbers(formulaText, damageType) {
  const colors = { magic: "#00B0F0", physical: "#FF8C34", true: "#F9966B" };
  const color = colors[damageType];
  if (!color) return formulaText;
  return formulaText.replace(/\b\d+(?:\.\d+)?%?\b/g, (n) => `<span class="stat-colored" style="color:${color}">${n}</span>`);
}

/**
 * Injects extracted damage formulas into generic damage phrases across item tooltips.
 */
function injectDamageFormulaText(descriptionHtml, formulaLines) {
  let enhanced = String(descriptionHtml || "");
  const damageLines = (formulaLines || []).filter((line) => /damage/i.test(`${line.name} ${line.formula}`));
  if (!damageLines.length) return enhanced;

  const bestLineForType = (type) => damageLines.find((l) => new RegExp(type, "i").test(`${l.name} ${l.formula}`)) || damageLines[0];
  const replacements = [
    { type: "magic", regex: /<magicDamage>\s*magic damage\s*<\/magicDamage>/i },
    { type: "physical", regex: /<physicalDamage>\s*physical damage\s*<\/physicalDamage>/i },
    { type: "true", regex: /<trueDamage>\s*true damage\s*<\/trueDamage>/i },
    { type: "magic", regex: /\b(?:dealing|deals)\s+magic damage\b/i, withVerb: true },
    { type: "physical", regex: /\b(?:dealing|deals)\s+physical damage\b/i, withVerb: true },
    { type: "true", regex: /\b(?:dealing|deals)\s+true damage\b/i, withVerb: true },
  ];

  replacements.forEach(({ type, regex, withVerb }) => {
    if (!regex.test(enhanced)) return;
    const line = bestLineForType(type);
    const coloredFormula = colorFormulaNumbers(line.formula, type);
    enhanced = enhanced.replace(regex, withVerb ? `dealing ${coloredFormula} ${type} damage` : `${coloredFormula} ${type} damage`);
  });

  return enhanced;
}

/**
 * Bolds ACTIVE headers and formats active name inline with cooldown.
 */
function enhanceActiveTooltip(descriptionHtml) {
  let enhanced = String(descriptionHtml || "");
  enhanced = enhanced.replace(
    /<active>\s*ACTIVE\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*<active>([^<]+)<\/active>/i,
    (_match, cooldown, name) => `<strong><active>ACTIVE - ${name.trim()} (${cooldown})</active></strong>`
  );
  enhanced = enhanced.replace(
    /<active>\s*([^<]+)\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)/i,
    (_match, name, cooldown) => {
      const cleanName = name.trim();
      if (/^active$/i.test(cleanName)) return `<strong><active>ACTIVE (${cooldown})</active></strong>`;
      return `<strong><active>ACTIVE - ${cleanName} (${cooldown})</active></strong>`;
    }
  );
  enhanced = enhanced.replace(
    /\bACTIVE\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*([^<\n]+)\b/i,
    (_match, cooldown, name) => `<strong>ACTIVE - ${name.trim()} (${cooldown})</strong>`
  );
  enhanced = enhanced.replace(/(ACTIVE\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");
  return enhanced;
}

/**
 * Replaces placeholder ACTIVE cooldown text with inferred cooldown seconds.
 */
function injectActiveCooldown(descriptionHtml, cooldownSeconds) {
  if (cooldownSeconds === null || cooldownSeconds === undefined) return String(descriptionHtml || "");
  let normalized = String(descriptionHtml || "");
  normalized = normalized.replace(/(<active>\s*ACTIVE\s*<\/active>\s*)\((?:0|0\.0+)s\)/i, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(<active>\s*[^<]+\s*<\/active>\s*)\((?:0|0\.0+)s\)/i, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, `$1${cooldownSeconds}s$2`);
  return normalized;
}

/**
 * Colors numeric tokens in formulas by damage type for readability.
 */
function colorFormulaNumbers(formulaText, damageType) {
  const colors = { magic: "#00B0F0", physical: "#FF8C34", true: "#F9966B" };
  const color = colors[damageType];
  if (!color) return formulaText;
  return formulaText.replace(/\b\d+(?:\.\d+)?%?\b/g, (n) => `<span class="stat-colored" style="color:${color}">${n}</span>`);
}

/**
 * Bolds named ability headers emitted by tooltip tags (active/passive/unique/on-hit).
 */
function emphasizeAbilityHeaders(descriptionHtml) {
  let html = String(descriptionHtml || "");
  html = html.replace(/<(active|passive|unique|onhit)>\s*([^<]+?)\s*<\/\1>/gi, (_m, tag, name) => `<${tag}><strong>${name}</strong></${tag}>`);
  return html;
}

function injectDamageFormulaText(descriptionHtml, formulaLines) {
  let enhanced = String(descriptionHtml || "");
  const damageLines = (formulaLines || []).filter((line) => /damage/i.test(`${line.name} ${line.formula}`));
  if (!damageLines.length) return enhanced;

  const bestLineForType = (type) => damageLines.find((l) => new RegExp(type, "i").test(`${l.name} ${l.formula}`)) || damageLines[0];
  const replacements = [
    { type: "magic", regex: /<magicDamage>\s*(?:bonus\s+)?magic damage\s*<\/magicDamage>/i },
    { type: "physical", regex: /<physicalDamage>\s*(?:bonus\s+)?physical damage\s*<\/physicalDamage>/i },
    { type: "true", regex: /<trueDamage>\s*(?:bonus\s+)?true damage\s*<\/trueDamage>/i },
    { type: "magic", regex: /\b(?:dealing|deals)\s+(?:bonus\s+)?magic damage\b/i, withVerb: true },
    { type: "physical", regex: /\b(?:dealing|deals)\s+(?:bonus\s+)?physical damage\b/i, withVerb: true },
    { type: "true", regex: /\b(?:dealing|deals)\s+(?:bonus\s+)?true damage\b/i, withVerb: true },
  ];

  replacements.forEach(({ type, regex, withVerb }) => {
    if (!regex.test(enhanced)) return;
    const line = bestLineForType(type);
    const coloredFormula = colorFormulaNumbers(line.formula, type);
    enhanced = enhanced.replace(regex, withVerb ? `dealing ${coloredFormula} ${type} damage` : `${coloredFormula} ${type} damage`);
  });

  return enhanced;
}

/**
 * Bolds ACTIVE headers and formats active name inline with cooldown.
 */
function enhanceActiveTooltip(descriptionHtml) {
  let enhanced = String(descriptionHtml || "");
  enhanced = enhanced.replace(
    /<active>\s*ACTIVE\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*<active>([^<]+)<\/active>/i,
    (_match, cooldown, name) => `<strong><active>ACTIVE - ${name.trim()} (${cooldown})</active></strong>`
  );
  enhanced = enhanced.replace(
    /<active>\s*([^<]+)\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)/i,
    (_match, name, cooldown) => {
      const cleanName = name.trim();
      if (/^active$/i.test(cleanName)) return `<strong><active>ACTIVE (${cooldown})</active></strong>`;
      return `<strong><active>ACTIVE - ${cleanName} (${cooldown})</active></strong>`;
    }
  );
  enhanced = enhanced.replace(
    /\bACTIVE\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*([^<\n]+)\b/i,
    (_match, cooldown, name) => `<strong>ACTIVE - ${name.trim()} (${cooldown})</strong>`
  );
  enhanced = enhanced.replace(/(ACTIVE\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");
  return enhanced;
}

/**
 * Replaces placeholder ACTIVE cooldown text with inferred cooldown seconds.
 */
function injectActiveCooldown(descriptionHtml, cooldownSeconds) {
  let normalized = String(descriptionHtml || "");
  if (cooldownSeconds === null || cooldownSeconds === undefined) {
    normalized = normalized.replace(/(<[a-zA-Z]+>\s*[^<]+\s*<\/[a-zA-Z]+>\s*)\((?:0|0\.0+)s\)/ig, "$1");
    normalized = normalized.replace(/\((?:0|0\.0+)s\)/ig, "");
    normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, "ACTIVE");
    return normalized;
  }
  normalized = normalized.replace(/(<active>\s*ACTIVE\s*<\/active>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(<active>\s*[^<]+\s*<\/active>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(<[a-zA-Z]+>\s*[^<]+\s*<\/[a-zA-Z]+>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/\((?:0|0\.0+)s\)/ig, `(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, `$1${cooldownSeconds}s$2`);
  return normalized;
}

/**
 * Colors numeric tokens in formulas by damage type for readability.
 */
function colorFormulaNumbers(formulaText, damageType) {
  const colors = { magic: "#00B0F0", physical: "#FF8C34", true: "#F9966B" };
  const color = colors[damageType];
  if (!color) return formulaText;
  return formulaText.replace(/\b\d+(?:\.\d+)?%?\b/g, (n) => `<span class="stat-colored" style="color:${color}">${n}</span>`);
}

/**
 * Bolds named ability headers emitted by tooltip tags (active/passive/unique/on-hit).
 */
function emphasizeAbilityHeaders(descriptionHtml) {
  let html = String(descriptionHtml || "");
  html = html.replace(/<(active|passive|unique|onhit)>\s*([^<]+?)\s*<\/\1>/gi, (_m, tag, name) => `<${tag}><strong>${name}</strong></${tag}>`);
  return html;
}

function inferFallbackMetric(itemId, metricType) {
  const values = getCdragonDataValueMap(itemId);
  const entries = Object.entries(values).filter(([name, value]) => Number.isFinite(value) && value > 0);
  if (!entries.length) return null;

  const patterns = {
    damage: /damage|onhit/i,
    cooldown: /cooldown/i,
    shield: /shield/i,
  };
  const pattern = patterns[metricType];
  if (!pattern) return null;

  const filtered = entries
    .filter(([name]) => pattern.test(name) && !/multiplier|ratio|amp|percent/i.test(name))
    .map(([, value]) => Number(value));
  if (!filtered.length) return null;

  const uniq = Array.from(new Set(filtered)).sort((a, b) => a - b);
  if (metricType === "cooldown") {
    return uniq.length > 1 ? `${uniq[uniq.length - 1]} → ${uniq[0]}s` : `${uniq[0]}s`;
  }
  return uniq.length > 1 ? `${uniq[0]} → ${uniq[uniq.length - 1]}` : `${uniq[0]}`;
}

function injectDamageFormulaText(descriptionHtml, formulaLines, itemId = null) {
  let enhanced = String(descriptionHtml || "");
  const damageLines = (formulaLines || []).filter((line) => /damage/i.test(`${line.name} ${line.formula}`));

  if (!damageLines.length && itemId !== null) {
    const fallbackDamage = inferFallbackMetric(itemId, "damage");
    if (fallbackDamage) {
      enhanced = enhanced.replace(/<magicDamage>\s*(?:bonus\s+)?magic damage\s*<\/magicDamage>/i, `${fallbackDamage} magic damage`);
      enhanced = enhanced.replace(/<physicalDamage>\s*(?:bonus\s+)?physical damage\s*<\/physicalDamage>/i, `${fallbackDamage} physical damage`);
      enhanced = enhanced.replace(/<trueDamage>\s*(?:bonus\s+)?true damage\s*<\/trueDamage>/i, `${fallbackDamage} true damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?magic damage\b/i, `dealing ${fallbackDamage} magic damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?physical damage\b/i, `dealing ${fallbackDamage} physical damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?true damage\b/i, `dealing ${fallbackDamage} true damage`);
    }
  }

  if (damageLines.length) {
    const bestLineForType = (type) => damageLines.find((l) => new RegExp(type, "i").test(`${l.name} ${l.formula}`)) || damageLines[0];
    const replacements = [
      { type: "magic", regex: /<magicDamage>\s*(?:bonus\s+)?magic damage\s*<\/magicDamage>/i },
      { type: "physical", regex: /<physicalDamage>\s*(?:bonus\s+)?physical damage\s*<\/physicalDamage>/i },
      { type: "true", regex: /<trueDamage>\s*(?:bonus\s+)?true damage\s*<\/trueDamage>/i },
      { type: "magic", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?magic damage\b/i, withVerb: true },
      { type: "physical", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?physical damage\b/i, withVerb: true },
      { type: "true", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?true damage\b/i, withVerb: true },
    ];

    replacements.forEach(({ type, regex, withVerb }) => {
      if (!regex.test(enhanced)) return;
      const line = bestLineForType(type);
      const coloredFormula = colorFormulaNumbers(line.formula, type);
      enhanced = enhanced.replace(regex, withVerb ? `dealing ${coloredFormula} ${type} damage` : `${coloredFormula} ${type} damage`);
    });
  }

  if (/\bwith a cooldown\b/i.test(enhanced)) {
    const cooldownLine = (formulaLines || []).find((l) => /cooldown/i.test(`${l.name} ${l.formula}`));
    const cooldownText = cooldownLine?.formula || (itemId !== null ? inferFallbackMetric(itemId, "cooldown") : null);
    if (cooldownText) enhanced = enhanced.replace(/\bwith a cooldown\b/i, `with a ${cooldownText} cooldown`);
  }

  const shieldLine = (formulaLines || []).find((l) => /shield/i.test(`${l.name} ${l.formula}`));
  if (/\bgain a shield\b/i.test(enhanced)) {
    const shieldText = shieldLine?.formula || (itemId !== null ? inferFallbackMetric(itemId, "shield") : null);
    if (shieldText) enhanced = enhanced.replace(/\bgain a shield\b/i, `Gain a ${shieldText} Shield`);
  }

  return enhanced;
}

/**
 * Bolds ACTIVE headers and formats active name inline with cooldown.
 */
function enhanceActiveTooltip(descriptionHtml) {
  let enhanced = String(descriptionHtml || "");
  enhanced = enhanced.replace(
    /<active>\s*ACTIVE\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*<active>([^<]+)<\/active>/i,
    (_match, cooldown, name) => `<strong><active>ACTIVE - ${name.trim()} (${cooldown})</active></strong>`
  );
  enhanced = enhanced.replace(
    /<active>\s*([^<]+)\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)/i,
    (_match, name, cooldown) => {
      const cleanName = name.trim();
      if (/^active$/i.test(cleanName)) return `<strong><active>ACTIVE (${cooldown})</active></strong>`;
      return `<strong><active>ACTIVE - ${cleanName} (${cooldown})</active></strong>`;
    }
  );
  enhanced = enhanced.replace(
    /\bACTIVE\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*([^<\n]+)\b/i,
    (_match, cooldown, name) => `<strong>ACTIVE - ${name.trim()} (${cooldown})</strong>`
  );

  enhanced = enhanced.replace(
    /<active>\s*<strong>Active\s*-<\/strong>\s*<\/active>\s*<active>\s*<strong>([^<:]+):<\/strong>\s*<\/active>/i,
    (_m, name) => `<active><strong>ACTIVE - ${name.trim()}:</strong></active>`
  );
  enhanced = enhanced.replace(/(ACTIVE\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");
  return enhanced;
}

/**
 * Replaces placeholder ACTIVE cooldown text with inferred cooldown seconds.
 */
function injectActiveCooldown(descriptionHtml, cooldownSeconds) {
  let normalized = String(descriptionHtml || "");
  if (cooldownSeconds === null || cooldownSeconds === undefined) {
    normalized = normalized.replace(/(<[a-zA-Z]+>\s*[^<]+\s*<\/[a-zA-Z]+>\s*)\((?:0|0\.0+)s\)/ig, "$1");
    normalized = normalized.replace(/\((?:0|0\.0+)s\)/ig, "");
    normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, "ACTIVE");
    return normalized;
  }
  normalized = normalized.replace(/(<active>\s*ACTIVE\s*<\/active>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(<active>\s*[^<]+\s*<\/active>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(<[a-zA-Z]+>\s*[^<]+\s*<\/[a-zA-Z]+>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/\((?:0|0\.0+)s\)/ig, `(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, `$1${cooldownSeconds}s$2`);
  return normalized;
}

/**
 * Colors numeric tokens in formulas by damage type for readability.
 */
function colorFormulaNumbers(formulaText, damageType) {
  const colors = { magic: "#00B0F0", physical: "#FF8C34", true: "#F9966B" };
  const color = colors[damageType];
  if (!color) return formulaText;
  return formulaText.replace(/\b\d+(?:\.\d+)?%?\b/g, (n) => `<span class="stat-colored" style="color:${color}">${n}</span>`);
}

/**
 * Bolds named ability headers emitted by tooltip tags (active/passive/unique/on-hit).
 */
function emphasizeAbilityHeaders(descriptionHtml) {
  let html = String(descriptionHtml || "");
  html = html.replace(/<(active|passive|unique|onhit)>\s*([^<]+?)\s*<\/\1>/gi, (_m, tag, name) => `<${tag}><strong>${name}</strong></${tag}>`);
  return html;
}

function inferFallbackMetric(itemId, metricType) {
  const values = getCdragonDataValueMap(itemId);
  const entries = Object.entries(values).filter(([name, value]) => Number.isFinite(value) && value > 0);
  if (!entries.length) return null;

  const patterns = {
    damage: /damage|onhit/i,
    cooldown: /cooldown/i,
    shield: /shield/i,
  };
  const pattern = patterns[metricType];
  if (!pattern) return null;

  const filtered = entries
    .filter(([name]) => pattern.test(name) && !/multiplier|ratio|amp|percent/i.test(name))
    .map(([, value]) => Number(value));
  if (!filtered.length) return null;

  const uniq = Array.from(new Set(filtered)).sort((a, b) => a - b);
  if (metricType === "cooldown") {
    return uniq.length > 1 ? `${uniq[uniq.length - 1]} → ${uniq[0]}s` : `${uniq[0]}s`;
  }
  return uniq.length > 1 ? `${uniq[0]} → ${uniq[uniq.length - 1]}` : `${uniq[0]}`;
}

function injectDamageFormulaText(descriptionHtml, formulaLines, itemId = null) {
  let enhanced = String(descriptionHtml || "");
  const damageLines = (formulaLines || []).filter((line) => /damage/i.test(`${line.name} ${line.formula}`));

  if (!damageLines.length && itemId !== null) {
    const fallbackDamage = inferFallbackMetric(itemId, "damage");
    if (fallbackDamage) {
      enhanced = enhanced.replace(/<magicDamage>\s*(?:bonus\s+)?magic damage\s*<\/magicDamage>/i, `${fallbackDamage} magic damage`);
      enhanced = enhanced.replace(/<physicalDamage>\s*(?:bonus\s+)?physical damage\s*<\/physicalDamage>/i, `${fallbackDamage} physical damage`);
      enhanced = enhanced.replace(/<trueDamage>\s*(?:bonus\s+)?true damage\s*<\/trueDamage>/i, `${fallbackDamage} true damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?magic damage\b/i, `dealing ${fallbackDamage} magic damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?physical damage\b/i, `dealing ${fallbackDamage} physical damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?true damage\b/i, `dealing ${fallbackDamage} true damage`);
    }
  }

  if (damageLines.length) {
    const bestLineForType = (type) => damageLines.find((l) => new RegExp(type, "i").test(`${l.name} ${l.formula}`)) || damageLines[0];
    const replacements = [
      { type: "magic", regex: /<magicDamage>\s*(?:bonus\s+)?magic damage\s*<\/magicDamage>/i },
      { type: "physical", regex: /<physicalDamage>\s*(?:bonus\s+)?physical damage\s*<\/physicalDamage>/i },
      { type: "true", regex: /<trueDamage>\s*(?:bonus\s+)?true damage\s*<\/trueDamage>/i },
      { type: "magic", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?magic damage\b/i, withVerb: true },
      { type: "physical", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?physical damage\b/i, withVerb: true },
      { type: "true", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?true damage\b/i, withVerb: true },
    ];

    replacements.forEach(({ type, regex, withVerb }) => {
      if (!regex.test(enhanced)) return;
      const line = bestLineForType(type);
      const coloredFormula = colorFormulaNumbers(line.formula, type);
      enhanced = enhanced.replace(regex, withVerb ? `dealing ${coloredFormula} ${type} damage` : `${coloredFormula} ${type} damage`);
    });
  }

  if (/\bwith a cooldown\b/i.test(enhanced)) {
    const cooldownLine = (formulaLines || []).find((l) => /cooldown/i.test(`${l.name} ${l.formula}`));
    const cooldownText = cooldownLine?.formula || (itemId !== null ? inferFallbackMetric(itemId, "cooldown") : null);
    if (cooldownText) enhanced = enhanced.replace(/\bwith a cooldown\b/i, `with a ${cooldownText} cooldown`);
  }

  const shieldLine = (formulaLines || []).find((l) => /shield/i.test(`${l.name} ${l.formula}`))
    || (formulaLines || []).find((l) => /\d/.test(l.formula));
  if (/shield/i.test(enhanced)) {
    const shieldText = shieldLine?.formula || (itemId !== null ? inferFallbackMetric(itemId, "shield") : null);
    if (shieldText) {
      enhanced = enhanced.replace(/\bgain a shield\b/i, `Gain a ${shieldText} Shield`);
      enhanced = enhanced.replace(/\bgain a magic shield\b/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/\bto a shield\b/i, `to a ${shieldText} Shield`);
      enhanced = enhanced.replace(/\bgrants? a (?:magic damage )?shield\b/i, `grants a ${shieldText} magic Shield`);

      enhanced = enhanced.replace(/to a\s*<shield>\s*shield\s*<\/shield>/i, `to a ${shieldText} Shield`);
      enhanced = enhanced.replace(/grants? a\s*<shield>\s*magic damage shield\s*<\/shield>/i, `grants a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/gain a\s*<shield>\s*<\/shield>\s*<magicDamage>\s*magic\s*<\/magicDamage>\s*<shield>\s*shield\s*<\/shield>/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/gain a\s*(?:<magicDamage>\s*magic(?: damage)?\s*<\/magicDamage>\s*)?<shield>\s*shield\s*<\/shield>/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/grants? a\s*(?:<magicDamage>\s*magic(?: damage)?\s*<\/magicDamage>\s*)?<shield>\s*shield\s*<\/shield>/i, `grants a ${shieldText} magic Shield`);
    }
  }

  return enhanced;
}

/**
 * Bolds ACTIVE headers and formats active name inline with cooldown.
 */
function enhanceActiveTooltip(descriptionHtml) {
  let enhanced = String(descriptionHtml || "");
  enhanced = enhanced.replace(
    /<active>\s*ACTIVE\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*<active>([^<]+)<\/active>/i,
    (_match, cooldown, name) => `<strong><active>ACTIVE - ${name.trim()} (${cooldown})</active></strong>`
  );
  enhanced = enhanced.replace(
    /<active>\s*([^<]+)\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)/i,
    (_match, name, cooldown) => {
      const cleanName = name.trim();
      if (/^active$/i.test(cleanName)) return `<strong><active>ACTIVE (${cooldown})</active></strong>`;
      return `<strong><active>ACTIVE - ${cleanName} (${cooldown})</active></strong>`;
    }
  );
  enhanced = enhanced.replace(
    /\bACTIVE\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*([^<\n]+)\b/i,
    (_match, cooldown, name) => `<strong>ACTIVE - ${name.trim()} (${cooldown})</strong>`
  );

  enhanced = enhanced.replace(
    /<active>\s*<strong>Active\s*-<\/strong>\s*<\/active>\s*<active>\s*<strong>([^<:]+):<\/strong>\s*<\/active>/i,
    (_m, name) => `<active><strong>ACTIVE - ${name.trim()}:</strong></active>`
  );
  enhanced = enhanced.replace(/(ACTIVE\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");
  return enhanced;
}

/**
 * Replaces placeholder ACTIVE cooldown text with inferred cooldown seconds.
 */
function injectActiveCooldown(descriptionHtml, cooldownSeconds) {
  let normalized = String(descriptionHtml || "");
  if (cooldownSeconds === null || cooldownSeconds === undefined) {
    normalized = normalized.replace(/(<[a-zA-Z]+>\s*[^<]+\s*<\/[a-zA-Z]+>\s*)\((?:0|0\.0+)s\)/ig, "$1");
    normalized = normalized.replace(/\((?:0|0\.0+)s\)/ig, "");
    normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, "ACTIVE");
    return normalized;
  }
  normalized = normalized.replace(/(<active>\s*ACTIVE\s*<\/active>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(<active>\s*[^<]+\s*<\/active>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(<[a-zA-Z]+>\s*[^<]+\s*<\/[a-zA-Z]+>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/\((?:0|0\.0+)s\)/ig, `(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, `$1${cooldownSeconds}s$2`);
  return normalized;
}

/**
 * Colors numeric tokens in formulas by damage type for readability.
 */
function colorFormulaNumbers(formulaText, damageType) {
  const colors = { magic: "#00B0F0", physical: "#FF8C34", true: "#F9966B" };
  const color = colors[damageType];
  if (!color) return formulaText;
  return formulaText.replace(/\b\d+(?:\.\d+)?%?\b/g, (n) => `<span class="stat-colored" style="color:${color}">${n}</span>`);
}

/**
 * Bolds named ability headers emitted by tooltip tags (active/passive/unique/on-hit).
 */
function emphasizeAbilityHeaders(descriptionHtml) {
  let html = String(descriptionHtml || "");
  html = html.replace(/<(active|passive|unique|onhit)>\s*([^<]+?)\s*<\/\1>/gi, (_m, tag, name) => `<${tag}><strong>${name}</strong></${tag}>`);
  return html;
}

function inferFallbackMetric(itemId, metricType) {
  const values = getCdragonDataValueMap(itemId);
  const entries = Object.entries(values).filter(([name, value]) => Number.isFinite(value) && value > 0);
  if (!entries.length) return null;

  const patterns = {
    damage: /damage|onhit/i,
    cooldown: /cooldown/i,
    shield: /shield/i,
  };
  const pattern = patterns[metricType];
  if (!pattern) return null;

  const filtered = entries
    .filter(([name]) => pattern.test(name) && !/multiplier|ratio|amp|percent/i.test(name))
    .map(([, value]) => Number(value));
  if (!filtered.length) return null;

  const uniq = Array.from(new Set(filtered)).sort((a, b) => a - b);
  if (metricType === "cooldown") {
    return uniq.length > 1 ? `${uniq[uniq.length - 1]} → ${uniq[0]}s` : `${uniq[0]}s`;
  }
  return uniq.length > 1 ? `${uniq[0]} → ${uniq[uniq.length - 1]}` : `${uniq[0]}`;
}

function injectDamageFormulaText(descriptionHtml, formulaLines, itemId = null) {
  let enhanced = String(descriptionHtml || "");
  const damageLines = (formulaLines || []).filter((line) => /damage/i.test(`${line.name} ${line.formula}`));

  if (!damageLines.length && itemId !== null) {
    const fallbackDamage = inferFallbackMetric(itemId, "damage");
    if (fallbackDamage) {
      enhanced = enhanced.replace(/<magicDamage>\s*(?:bonus\s+)?magic damage\s*<\/magicDamage>/i, `${fallbackDamage} magic damage`);
      enhanced = enhanced.replace(/<physicalDamage>\s*(?:bonus\s+)?physical damage\s*<\/physicalDamage>/i, `${fallbackDamage} physical damage`);
      enhanced = enhanced.replace(/<trueDamage>\s*(?:bonus\s+)?true damage\s*<\/trueDamage>/i, `${fallbackDamage} true damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?magic damage\b/i, `dealing ${fallbackDamage} magic damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?physical damage\b/i, `dealing ${fallbackDamage} physical damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?true damage\b/i, `dealing ${fallbackDamage} true damage`);
    }
  }

  if (damageLines.length) {
    const bestLineForType = (type) => damageLines.find((l) => new RegExp(type, "i").test(`${l.name} ${l.formula}`)) || damageLines[0];
    const replacements = [
      { type: "magic", regex: /<magicDamage>\s*(?:bonus\s+)?magic damage\s*<\/magicDamage>/i },
      { type: "physical", regex: /<physicalDamage>\s*(?:bonus\s+)?physical damage\s*<\/physicalDamage>/i },
      { type: "true", regex: /<trueDamage>\s*(?:bonus\s+)?true damage\s*<\/trueDamage>/i },
      { type: "magic", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?magic damage\b/i, withVerb: true },
      { type: "physical", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?physical damage\b/i, withVerb: true },
      { type: "true", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?true damage\b/i, withVerb: true },
    ];

    replacements.forEach(({ type, regex, withVerb }) => {
      if (!regex.test(enhanced)) return;
      const line = bestLineForType(type);
      const coloredFormula = colorFormulaNumbers(line.formula, type);
      enhanced = enhanced.replace(regex, withVerb ? `dealing ${coloredFormula} ${type} damage` : `${coloredFormula} ${type} damage`);
    });
  }

  if (/\bwith a cooldown\b/i.test(enhanced)) {
    const cooldownLine = (formulaLines || []).find((l) => /cooldown/i.test(`${l.name} ${l.formula}`));
    const cooldownText = cooldownLine?.formula || (itemId !== null ? inferFallbackMetric(itemId, "cooldown") : null);
    if (cooldownText) enhanced = enhanced.replace(/\bwith a cooldown\b/i, `with a ${cooldownText} cooldown`);
  }

  const shieldLine = (formulaLines || []).find((l) => /shield/i.test(`${l.name} ${l.formula}`))
    || (formulaLines || []).find((l) => /\d/.test(l.formula));
  if (/shield/i.test(enhanced)) {
    const shieldText = shieldLine?.formula || (itemId !== null ? inferFallbackMetric(itemId, "shield") : null);
    if (shieldText) {
      enhanced = enhanced.replace(/\bgain a shield\b/i, `Gain a ${shieldText} Shield`);
      enhanced = enhanced.replace(/\bgain a magic shield\b/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/\bto a shield\b/i, `to a ${shieldText} Shield`);
      enhanced = enhanced.replace(/\bgrants? a (?:magic damage )?shield\b/i, `grants a ${shieldText} magic Shield`);

      enhanced = enhanced.replace(/to a\s*<shield>\s*shield\s*<\/shield>/i, `to a ${shieldText} Shield`);
      enhanced = enhanced.replace(/grants? a\s*<shield>\s*magic damage shield\s*<\/shield>/i, `grants a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/gain a\s*<shield>\s*<\/shield>\s*<magicDamage>\s*magic\s*<\/magicDamage>\s*<shield>\s*shield\s*<\/shield>/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/gain a\s*(?:<magicDamage>\s*magic(?: damage)?\s*<\/magicDamage>\s*)?<shield>\s*shield\s*<\/shield>/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/grants? a\s*(?:<magicDamage>\s*magic(?: damage)?\s*<\/magicDamage>\s*)?<shield>\s*shield\s*<\/shield>/i, `grants a ${shieldText} magic Shield`);
    }
  }

  return enhanced;
}

/**
 * Bolds ACTIVE headers and formats active name inline with cooldown.
 */
function enhanceActiveTooltip(descriptionHtml) {
  let enhanced = String(descriptionHtml || "");
  enhanced = enhanced.replace(
    /<active>\s*ACTIVE\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*<active>([^<]+)<\/active>/i,
    (_match, cooldown, name) => `<strong><active>ACTIVE - ${name.trim()} (${cooldown})</active></strong>`
  );
  enhanced = enhanced.replace(
    /<active>\s*([^<]+)\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)/i,
    (_match, name, cooldown) => {
      const cleanName = name.trim();
      if (/^active$/i.test(cleanName)) return `<strong><active>ACTIVE (${cooldown})</active></strong>`;
      return `<strong><active>ACTIVE - ${cleanName} (${cooldown})</active></strong>`;
    }
  );
  enhanced = enhanced.replace(
    /\bACTIVE\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*([^<\n]+)\b/i,
    (_match, cooldown, name) => `<strong>ACTIVE - ${name.trim()} (${cooldown})</strong>`
  );

  enhanced = enhanced.replace(
    /<active>\s*<strong>Active\s*-<\/strong>\s*<\/active>\s*<active>\s*<strong>([^<:]+):<\/strong>\s*<\/active>/i,
    (_m, name) => `<active><strong>ACTIVE - ${name.trim()}:</strong></active>`
  );
  enhanced = enhanced.replace(/(ACTIVE\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");
  return enhanced;
}

/**
 * Replaces placeholder ACTIVE cooldown text with inferred cooldown seconds.
 */
function injectActiveCooldown(descriptionHtml, cooldownSeconds) {
  let normalized = String(descriptionHtml || "");
  if (cooldownSeconds === null || cooldownSeconds === undefined) {
    normalized = normalized.replace(/(<[a-zA-Z]+>\s*[^<]+\s*<\/[a-zA-Z]+>\s*)\((?:0|0\.0+)s\)/ig, "$1");
    normalized = normalized.replace(/\((?:0|0\.0+)s\)/ig, "");
    normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, "ACTIVE");
    return normalized;
  }
  normalized = normalized.replace(/(<active>\s*ACTIVE\s*<\/active>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(<active>\s*[^<]+\s*<\/active>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(<[a-zA-Z]+>\s*[^<]+\s*<\/[a-zA-Z]+>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/\((?:0|0\.0+)s\)/ig, `(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, `$1${cooldownSeconds}s$2`);
  return normalized;
}

/**
 * Colors numeric tokens in formulas by damage type for readability.
 */
function colorFormulaNumbers(formulaText, damageType) {
  const colors = { magic: "#00B0F0", physical: "#FF8C34", true: "#F9966B" };
  const color = colors[damageType];
  if (!color) return formulaText;
  return formulaText.replace(/\b\d+(?:\.\d+)?%?\b/g, (n) => `<span class="stat-colored" style="color:${color}">${n}</span>`);
}

/**
 * Bolds named ability headers emitted by tooltip tags (active/passive/unique/on-hit).
 */
function emphasizeAbilityHeaders(descriptionHtml) {
  let html = String(descriptionHtml || "");
  html = html.replace(/<(active|passive|unique|onhit)>\s*([^<]+?)\s*<\/\1>/gi, (_m, tag, name) => `<${tag}><strong>${name}</strong></${tag}>`);
  return html;
}

function inferFallbackMetric(itemId, metricType) {
  const values = getCdragonDataValueMap(itemId);
  const entries = Object.entries(values).filter(([name, value]) => Number.isFinite(value) && value > 0);
  if (!entries.length) return null;

  const patterns = {
    damage: /damage|onhit/i,
    cooldown: /cooldown/i,
    shield: /shield/i,
  };
  const pattern = patterns[metricType];
  if (!pattern) return null;

  const filtered = entries
    .filter(([name]) => pattern.test(name) && !/multiplier|ratio|amp|percent/i.test(name))
    .map(([, value]) => Number(value));
  if (!filtered.length) return null;

  const uniq = Array.from(new Set(filtered)).sort((a, b) => a - b);
  if (metricType === "cooldown") {
    return uniq.length > 1 ? `${uniq[uniq.length - 1]} → ${uniq[0]}s` : `${uniq[0]}s`;
  }
  return uniq.length > 1 ? `${uniq[0]} → ${uniq[uniq.length - 1]}` : `${uniq[0]}`;
}

function injectDamageFormulaText(descriptionHtml, formulaLines, itemId = null) {
  let enhanced = String(descriptionHtml || "");
  const damageLines = (formulaLines || []).filter((line) => /damage/i.test(`${line.name} ${line.formula}`));

  if (!damageLines.length && itemId !== null) {
    const fallbackDamage = inferFallbackMetric(itemId, "damage");
    if (fallbackDamage) {
      enhanced = enhanced.replace(/<magicDamage>\s*(?:bonus\s+)?magic damage\s*<\/magicDamage>/i, `${fallbackDamage} magic damage`);
      enhanced = enhanced.replace(/<physicalDamage>\s*(?:bonus\s+)?physical damage\s*<\/physicalDamage>/i, `${fallbackDamage} physical damage`);
      enhanced = enhanced.replace(/<trueDamage>\s*(?:bonus\s+)?true damage\s*<\/trueDamage>/i, `${fallbackDamage} true damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?magic damage\b/i, `dealing ${fallbackDamage} magic damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?physical damage\b/i, `dealing ${fallbackDamage} physical damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?true damage\b/i, `dealing ${fallbackDamage} true damage`);
    }
  }

  if (damageLines.length) {
    const bestLineForType = (type) => damageLines.find((l) => new RegExp(type, "i").test(`${l.name} ${l.formula}`)) || damageLines[0];
    const replacements = [
      { type: "magic", regex: /<magicDamage>\s*(?:bonus\s+)?magic damage\s*<\/magicDamage>/i },
      { type: "physical", regex: /<physicalDamage>\s*(?:bonus\s+)?physical damage\s*<\/physicalDamage>/i },
      { type: "true", regex: /<trueDamage>\s*(?:bonus\s+)?true damage\s*<\/trueDamage>/i },
      { type: "magic", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?magic damage\b/i, withVerb: true },
      { type: "physical", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?physical damage\b/i, withVerb: true },
      { type: "true", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?true damage\b/i, withVerb: true },
    ];

    replacements.forEach(({ type, regex, withVerb }) => {
      if (!regex.test(enhanced)) return;
      const line = bestLineForType(type);
      const coloredFormula = colorFormulaNumbers(line.formula, type);
      enhanced = enhanced.replace(regex, withVerb ? `dealing ${coloredFormula} ${type} damage` : `${coloredFormula} ${type} damage`);
    });
  }

  if (/\bwith a cooldown\b/i.test(enhanced)) {
    const cooldownLine = (formulaLines || []).find((l) => /cooldown/i.test(`${l.name} ${l.formula}`));
    const cooldownText = cooldownLine?.formula || (itemId !== null ? inferFallbackMetric(itemId, "cooldown") : null);
    if (cooldownText) enhanced = enhanced.replace(/\bwith a cooldown\b/i, `with a ${cooldownText} cooldown`);
  }

  const shieldLine = (formulaLines || []).find((l) => /shield/i.test(`${l.name} ${l.formula}`))
    || (formulaLines || []).find((l) => /\d/.test(l.formula));
  if (/shield/i.test(enhanced)) {
    const shieldText = shieldLine?.formula || (itemId !== null ? inferFallbackMetric(itemId, "shield") : null);
    if (shieldText) {
      enhanced = enhanced.replace(/\bgain a shield\b/i, `Gain a ${shieldText} Shield`);
      enhanced = enhanced.replace(/\bgain a magic shield\b/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/\bto a shield\b/i, `to a ${shieldText} Shield`);
      enhanced = enhanced.replace(/\bgrants? a (?:magic damage )?shield\b/i, `grants a ${shieldText} magic Shield`);

      enhanced = enhanced.replace(/to a\s*<shield>\s*shield\s*<\/shield>/i, `to a ${shieldText} Shield`);
      enhanced = enhanced.replace(/grants? a\s*<shield>\s*magic damage shield\s*<\/shield>/i, `grants a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/gain a\s*<shield>\s*<\/shield>\s*<magicDamage>\s*magic\s*<\/magicDamage>\s*<shield>\s*shield\s*<\/shield>/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/gain a\s*(?:<magicDamage>\s*magic(?: damage)?\s*<\/magicDamage>\s*)?<shield>\s*shield\s*<\/shield>/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/grants? a\s*(?:<magicDamage>\s*magic(?: damage)?\s*<\/magicDamage>\s*)?<shield>\s*shield\s*<\/shield>/i, `grants a ${shieldText} magic Shield`);
    }
  }

  return enhanced;
}

/**
 * Bolds ACTIVE headers and formats active name inline with cooldown.
 */
function enhanceActiveTooltip(descriptionHtml) {
  let enhanced = String(descriptionHtml || "");
  enhanced = enhanced.replace(
    /<active>\s*ACTIVE\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*<active>([^<]+)<\/active>/i,
    (_match, cooldown, name) => `<strong><active>ACTIVE - ${name.trim()} (${cooldown})</active></strong>`
  );
  enhanced = enhanced.replace(
    /<active>\s*([^<]+)\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)/i,
    (_match, name, cooldown) => {
      const cleanName = name.trim();
      if (/^active$/i.test(cleanName)) return `<strong><active>ACTIVE (${cooldown})</active></strong>`;
      return `<strong><active>ACTIVE - ${cleanName} (${cooldown})</active></strong>`;
    }
  );
  enhanced = enhanced.replace(
    /\bACTIVE\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*([^<\n]+)\b/i,
    (_match, cooldown, name) => `<strong>ACTIVE - ${name.trim()} (${cooldown})</strong>`
  );

  enhanced = enhanced.replace(
    /<active>\s*<strong>Active\s*-<\/strong>\s*<\/active>\s*<active>\s*<strong>([^<:]+):<\/strong>\s*<\/active>/i,
    (_m, name) => `<active><strong>ACTIVE - ${name.trim()}:</strong></active>`
  );
  enhanced = enhanced.replace(/(ACTIVE\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");
  return enhanced;
}

/**
 * Replaces placeholder ACTIVE cooldown text with inferred cooldown seconds.
 */
function injectActiveCooldown(descriptionHtml, cooldownSeconds) {
  let normalized = String(descriptionHtml || "");
  if (cooldownSeconds === null || cooldownSeconds === undefined) {
    normalized = normalized.replace(/(<[a-zA-Z]+>\s*[^<]+\s*<\/[a-zA-Z]+>\s*)\((?:0|0\.0+)s\)/ig, "$1");
    normalized = normalized.replace(/\((?:0|0\.0+)s\)/ig, "");
    normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, "ACTIVE");
    return normalized;
  }
  normalized = normalized.replace(/(<active>\s*ACTIVE\s*<\/active>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(<active>\s*[^<]+\s*<\/active>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(<[a-zA-Z]+>\s*[^<]+\s*<\/[a-zA-Z]+>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/\((?:0|0\.0+)s\)/ig, `(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, `$1${cooldownSeconds}s$2`);
  return normalized;
}

/**
 * Colors numeric tokens in formulas by damage type for readability.
 */
function colorFormulaNumbers(formulaText, damageType) {
  const colors = { magic: "#00B0F0", physical: "#FF8C34", true: "#F9966B" };
  const color = colors[damageType];
  if (!color) return formulaText;
  return formulaText.replace(/\b\d+(?:\.\d+)?%?\b/g, (n) => `<span class="stat-colored" style="color:${color}">${n}</span>`);
}

/**
 * Bolds named ability headers emitted by tooltip tags (active/passive/unique/on-hit).
 */
function emphasizeAbilityHeaders(descriptionHtml) {
  let html = String(descriptionHtml || "");
  html = html.replace(/<(active|passive|unique|onhit)>\s*([^<]+?)\s*<\/\1>/gi, (_m, tag, name) => `<${tag}><strong>${name}</strong></${tag}>`);
  return html;
}

function inferFallbackMetric(itemId, metricType) {
  const values = getCdragonDataValueMap(itemId);
  const entries = Object.entries(values).filter(([name, value]) => Number.isFinite(value) && value > 0);
  if (!entries.length) return null;

  const patterns = {
    damage: /damage|onhit/i,
    cooldown: /cooldown/i,
    shield: /shield/i,
  };
  const pattern = patterns[metricType];
  if (!pattern) return null;

  const filtered = entries
    .filter(([name]) => pattern.test(name) && !/multiplier|ratio|amp|percent/i.test(name))
    .map(([, value]) => Number(value));
  if (!filtered.length) return null;

  const uniq = Array.from(new Set(filtered)).sort((a, b) => a - b);
  if (metricType === "cooldown") {
    return uniq.length > 1 ? `${uniq[uniq.length - 1]} → ${uniq[0]}s` : `${uniq[0]}s`;
  }
  return uniq.length > 1 ? `${uniq[0]} → ${uniq[uniq.length - 1]}` : `${uniq[0]}`;
}

function injectDamageFormulaText(descriptionHtml, formulaLines, itemId = null) {
  let enhanced = String(descriptionHtml || "");
  const damageLines = (formulaLines || []).filter((line) => /damage/i.test(`${line.name} ${line.formula}`));

  if (!damageLines.length && itemId !== null) {
    const fallbackDamage = inferFallbackMetric(itemId, "damage");
    if (fallbackDamage) {
      enhanced = enhanced.replace(/<magicDamage>\s*(?:bonus\s+)?magic damage\s*<\/magicDamage>/i, `${fallbackDamage} magic damage`);
      enhanced = enhanced.replace(/<physicalDamage>\s*(?:bonus\s+)?physical damage\s*<\/physicalDamage>/i, `${fallbackDamage} physical damage`);
      enhanced = enhanced.replace(/<trueDamage>\s*(?:bonus\s+)?true damage\s*<\/trueDamage>/i, `${fallbackDamage} true damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?magic damage\b/i, `dealing ${fallbackDamage} magic damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?physical damage\b/i, `dealing ${fallbackDamage} physical damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?true damage\b/i, `dealing ${fallbackDamage} true damage`);
    }
  }

  if (damageLines.length) {
    const bestLineForType = (type) => damageLines.find((l) => new RegExp(type, "i").test(`${l.name} ${l.formula}`)) || damageLines[0];
    const replacements = [
      { type: "magic", regex: /<magicDamage>\s*(?:bonus\s+)?magic damage\s*<\/magicDamage>/i },
      { type: "physical", regex: /<physicalDamage>\s*(?:bonus\s+)?physical damage\s*<\/physicalDamage>/i },
      { type: "true", regex: /<trueDamage>\s*(?:bonus\s+)?true damage\s*<\/trueDamage>/i },
      { type: "magic", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?magic damage\b/i, withVerb: true },
      { type: "physical", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?physical damage\b/i, withVerb: true },
      { type: "true", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?true damage\b/i, withVerb: true },
    ];

    replacements.forEach(({ type, regex, withVerb }) => {
      if (!regex.test(enhanced)) return;
      const line = bestLineForType(type);
      const coloredFormula = colorFormulaNumbers(line.formula, type);
      enhanced = enhanced.replace(regex, withVerb ? `dealing ${coloredFormula} ${type} damage` : `${coloredFormula} ${type} damage`);
    });
  }

  if (/\bwith a cooldown\b/i.test(enhanced)) {
    const cooldownLine = (formulaLines || []).find((l) => /cooldown/i.test(`${l.name} ${l.formula}`));
    const cooldownText = cooldownLine?.formula || (itemId !== null ? inferFallbackMetric(itemId, "cooldown") : null);
    if (cooldownText) enhanced = enhanced.replace(/\bwith a cooldown\b/i, `with a ${cooldownText} cooldown`);
  }

  const shieldLine = (formulaLines || []).find((l) => /shield/i.test(`${l.name} ${l.formula}`))
    || (formulaLines || []).find((l) => /\d/.test(l.formula));
  if (/shield/i.test(enhanced)) {
    const shieldText = shieldLine?.formula || (itemId !== null ? inferFallbackMetric(itemId, "shield") : null);
    if (shieldText) {
      enhanced = enhanced.replace(/\bgain a shield\b/i, `Gain a ${shieldText} Shield`);
      enhanced = enhanced.replace(/\bgain a magic shield\b/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/\bto a shield\b/i, `to a ${shieldText} Shield`);
      enhanced = enhanced.replace(/\bgrants? a (?:magic damage )?shield\b/i, `grants a ${shieldText} magic Shield`);

      enhanced = enhanced.replace(/to a\s*<shield>\s*shield\s*<\/shield>/i, `to a ${shieldText} Shield`);
      enhanced = enhanced.replace(/grants? a\s*<shield>\s*magic damage shield\s*<\/shield>/i, `grants a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/gain a\s*<shield>\s*<\/shield>\s*<magicDamage>\s*magic\s*<\/magicDamage>\s*<shield>\s*shield\s*<\/shield>/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/gain a\s*(?:<magicDamage>\s*magic(?: damage)?\s*<\/magicDamage>\s*)?<shield>\s*shield\s*<\/shield>/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/grants? a\s*(?:<magicDamage>\s*magic(?: damage)?\s*<\/magicDamage>\s*)?<shield>\s*shield\s*<\/shield>/i, `grants a ${shieldText} magic Shield`);
    }
  }

  return enhanced;
}

/**
 * Bolds ACTIVE headers and formats active name inline with cooldown.
 */
function enhanceActiveTooltip(descriptionHtml) {
  let enhanced = String(descriptionHtml || "");
  enhanced = enhanced.replace(
    /<active>\s*ACTIVE\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*<active>([^<]+)<\/active>/i,
    (_match, cooldown, name) => `<strong><active>ACTIVE - ${name.trim()} (${cooldown})</active></strong>`
  );
  enhanced = enhanced.replace(
    /<active>\s*([^<]+)\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)/i,
    (_match, name, cooldown) => {
      const cleanName = name.trim();
      if (/^active$/i.test(cleanName)) return `<strong><active>ACTIVE (${cooldown})</active></strong>`;
      return `<strong><active>ACTIVE - ${cleanName} (${cooldown})</active></strong>`;
    }
  );
  enhanced = enhanced.replace(
    /\bACTIVE\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*([^<\n]+)\b/i,
    (_match, cooldown, name) => `<strong>ACTIVE - ${name.trim()} (${cooldown})</strong>`
  );

  enhanced = enhanced.replace(
    /<active>\s*<strong>Active\s*-<\/strong>\s*<\/active>\s*<active>\s*<strong>([^<:]+):<\/strong>\s*<\/active>/i,
    (_m, name) => `<active><strong>ACTIVE - ${name.trim()}:</strong></active>`
  );
  enhanced = enhanced.replace(/(ACTIVE\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");
  return enhanced;
}

/**
 * Replaces placeholder ACTIVE cooldown text with inferred cooldown seconds.
 */
function injectActiveCooldown(descriptionHtml, cooldownSeconds) {
  let normalized = String(descriptionHtml || "");
  if (cooldownSeconds === null || cooldownSeconds === undefined) {
    normalized = normalized.replace(/(<[a-zA-Z]+>\s*[^<]+\s*<\/[a-zA-Z]+>\s*)\((?:0|0\.0+)s\)/ig, "$1");
    normalized = normalized.replace(/\((?:0|0\.0+)s\)/ig, "");
    normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, "ACTIVE");
    return normalized;
  }
  normalized = normalized.replace(/(<active>\s*ACTIVE\s*<\/active>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(<active>\s*[^<]+\s*<\/active>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(<[a-zA-Z]+>\s*[^<]+\s*<\/[a-zA-Z]+>\s*)\((?:0|0\.0+)s\)/ig, `$1(${cooldownSeconds}s)`);
  normalized = normalized.replace(/\((?:0|0\.0+)s\)/ig, `(${cooldownSeconds}s)`);
  normalized = normalized.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, `$1${cooldownSeconds}s$2`);
  return normalized;
}

/**
 * Colors numeric tokens in formulas by damage type for readability.
 */
function colorFormulaNumbers(formulaText, damageType) {
  const colors = { magic: "#00B0F0", physical: "#FF8C34", true: "#F9966B" };
  const color = colors[damageType];
  if (!color) return formulaText;
  return formulaText.replace(/\b\d+(?:\.\d+)?%?\b/g, (n) => `<span class="stat-colored" style="color:${color}">${n}</span>`);
}

/**
 * Bolds named ability headers emitted by tooltip tags (active/passive/unique/on-hit).
 */
function emphasizeAbilityHeaders(descriptionHtml) {
  let html = String(descriptionHtml || "");
  html = html.replace(/<(active|passive|unique|onhit)>\s*([^<]+?)\s*<\/\1>/gi, (_m, tag, name) => `<${tag}><strong>${name}</strong></${tag}>`);
  return html;
}

function inferFallbackMetric(itemId, metricType) {
  const values = getCdragonDataValueMap(itemId);
  const entries = Object.entries(values).filter(([name, value]) => Number.isFinite(value) && value > 0);
  if (!entries.length) return null;

  const patterns = {
    damage: /damage|onhit/i,
    cooldown: /cooldown/i,
    shield: /shield/i,
  };
  const pattern = patterns[metricType];
  if (!pattern) return null;

  const filtered = entries
    .filter(([name]) => pattern.test(name) && !/multiplier|ratio|amp|percent/i.test(name))
    .map(([, value]) => Number(value));
  if (!filtered.length) return null;

  const uniq = Array.from(new Set(filtered)).sort((a, b) => a - b);
  if (metricType === "cooldown") {
    return uniq.length > 1 ? `${uniq[uniq.length - 1]} → ${uniq[0]}s` : `${uniq[0]}s`;
  }
  return uniq.length > 1 ? `${uniq[0]} → ${uniq[uniq.length - 1]}` : `${uniq[0]}`;
}

function injectDamageFormulaText(descriptionHtml, formulaLines, itemId = null) {
  let enhanced = String(descriptionHtml || "");
  const damageLines = (formulaLines || []).filter((line) => /damage/i.test(`${line.name} ${line.formula}`));

  if (!damageLines.length && itemId !== null) {
    const fallbackDamage = inferFallbackMetric(itemId, "damage");
    if (fallbackDamage) {
      enhanced = enhanced.replace(/<magicDamage>\s*(?:bonus\s+)?magic damage\s*<\/magicDamage>/i, `${fallbackDamage} magic damage`);
      enhanced = enhanced.replace(/<physicalDamage>\s*(?:bonus\s+)?physical damage\s*<\/physicalDamage>/i, `${fallbackDamage} physical damage`);
      enhanced = enhanced.replace(/<trueDamage>\s*(?:bonus\s+)?true damage\s*<\/trueDamage>/i, `${fallbackDamage} true damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?magic damage\b/i, `dealing ${fallbackDamage} magic damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?physical damage\b/i, `dealing ${fallbackDamage} physical damage`);
      enhanced = enhanced.replace(/\b(?:deal|dealing|deals)\s+(?:bonus\s+)?true damage\b/i, `dealing ${fallbackDamage} true damage`);
    }
  }

  if (damageLines.length) {
    const bestLineForType = (type) => damageLines.find((l) => new RegExp(type, "i").test(`${l.name} ${l.formula}`)) || damageLines[0];
    const replacements = [
      { type: "magic", regex: /<magicDamage>\s*(?:bonus\s+)?magic damage\s*<\/magicDamage>/i },
      { type: "physical", regex: /<physicalDamage>\s*(?:bonus\s+)?physical damage\s*<\/physicalDamage>/i },
      { type: "true", regex: /<trueDamage>\s*(?:bonus\s+)?true damage\s*<\/trueDamage>/i },
      { type: "magic", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?magic damage\b/i, withVerb: true },
      { type: "physical", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?physical damage\b/i, withVerb: true },
      { type: "true", regex: /\b(?:deal|dealing|deals)\s+(?:bonus\s+)?true damage\b/i, withVerb: true },
    ];

    replacements.forEach(({ type, regex, withVerb }) => {
      if (!regex.test(enhanced)) return;
      const line = bestLineForType(type);
      const coloredFormula = colorFormulaNumbers(line.formula, type);
      enhanced = enhanced.replace(regex, withVerb ? `dealing ${coloredFormula} ${type} damage` : `${coloredFormula} ${type} damage`);
    });
  }

  if (/\bwith a cooldown\b/i.test(enhanced)) {
    const cooldownLine = (formulaLines || []).find((l) => /cooldown/i.test(`${l.name} ${l.formula}`));
    const cooldownText = cooldownLine?.formula || (itemId !== null ? inferFallbackMetric(itemId, "cooldown") : null);
    if (cooldownText) enhanced = enhanced.replace(/\bwith a cooldown\b/i, `with a ${cooldownText} cooldown`);
  }

  const shieldLine = (formulaLines || []).find((l) => /shield/i.test(`${l.name} ${l.formula}`))
    || (formulaLines || []).find((l) => /\d/.test(l.formula));
  if (/shield/i.test(enhanced)) {
    const shieldText = shieldLine?.formula || (itemId !== null ? inferFallbackMetric(itemId, "shield") : null);
    if (shieldText) {
      enhanced = enhanced.replace(/\bgain a shield\b/i, `Gain a ${shieldText} Shield`);
      enhanced = enhanced.replace(/\bgain a magic shield\b/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/\bto a shield\b/i, `to a ${shieldText} Shield`);
      enhanced = enhanced.replace(/\bgrants? a (?:magic damage )?shield\b/i, `grants a ${shieldText} magic Shield`);

      enhanced = enhanced.replace(/to a\s*<shield>\s*shield\s*<\/shield>/i, `to a ${shieldText} Shield`);
      enhanced = enhanced.replace(/grants? a\s*<shield>\s*magic damage shield\s*<\/shield>/i, `grants a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/gain a\s*<shield>\s*<\/shield>\s*<magicDamage>\s*magic\s*<\/magicDamage>\s*<shield>\s*shield\s*<\/shield>/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/gain a\s*(?:<magicDamage>\s*magic(?: damage)?\s*<\/magicDamage>\s*)?<shield>\s*shield\s*<\/shield>/i, `Gain a ${shieldText} magic Shield`);
      enhanced = enhanced.replace(/grants? a\s*(?:<magicDamage>\s*magic(?: damage)?\s*<\/magicDamage>\s*)?<shield>\s*shield\s*<\/shield>/i, `grants a ${shieldText} magic Shield`);
    }
  }

  return enhanced;
}

/**
 * Bolds ACTIVE headers and formats active name inline with cooldown.
 */
function enhanceActiveTooltip(descriptionHtml) {
  let enhanced = String(descriptionHtml || "");
  enhanced = enhanced.replace(
    /<active>\s*ACTIVE\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*<active>([^<]+)<\/active>/i,
    (_match, cooldown, name) => `<strong><active>ACTIVE - ${name.trim()} (${cooldown})</active></strong>`
  );
  enhanced = enhanced.replace(
    /<active>\s*([^<]+)\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)/i,
    (_match, name, cooldown) => {
      const cleanName = name.trim();
      if (/^active$/i.test(cleanName)) return `<strong><active>ACTIVE (${cooldown})</active></strong>`;
      return `<strong><active>ACTIVE - ${cleanName} (${cooldown})</active></strong>`;
    }
  );
  enhanced = enhanced.replace(
    /\bACTIVE\s*\((\d+(?:\.\d+)?s)\)\s*<br>\s*([^<\n]+)\b/i,
    (_match, cooldown, name) => `<strong>ACTIVE - ${name.trim()} (${cooldown})</strong>`
  );

  enhanced = enhanced.replace(
    /<active>\s*<strong>Active\s*-<\/strong>\s*<\/active>\s*<active>\s*<strong>([^<:]+):<\/strong>\s*<\/active>/i,
    (_m, name) => `<active><strong>ACTIVE - ${name.trim()}:</strong></active>`
  );
  enhanced = enhanced.replace(/(ACTIVE\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");
  return enhanced;
}

/**
 * Extracts burn DPS and total-damage helper rows from data values where possible.
 */
function buildBurnMetrics(dataValueMap) {
  const keys = Object.keys(dataValueMap);
  const durationKey = keys.find((k) => /burn.*duration|duration.*burn/i.test(k));
  const dpsKey = keys.find((k) => /burn.*dps|dps.*burn/i.test(k));
  const totalKey = keys.find((k) => /burn.*damage|damage.*burn/i.test(k));

  const duration = durationKey ? Number(dataValueMap[durationKey]) : null;
  const dps = dpsKey ? Number(dataValueMap[dpsKey]) : null;
  const total = totalKey ? Number(dataValueMap[totalKey]) : null;

  const rows = [];
  if (duration && dps) {
    rows.push({
      key: "burn_dps_total",
      name: "Burn DPS / Total",
      formula: `${dps} DPS for ${duration}s (total ${Number(dps * duration).toFixed(2)})`,
      meta: { duration, dps, total: dps * duration },
    });
  } else if (duration && total) {
    rows.push({
      key: "burn_total_dps",
      name: "Burn DPS / Total",
      formula: `${total} total over ${duration}s (${Number(total / duration).toFixed(2)} DPS)`,
      meta: { duration, total, dps: total / duration },
    });
  }

  return rows;
}


/**
 * Initializes Item Lookup: load data, build filters, bind events, and render first state.
 */
async function initItemLookup() {
  const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then((r) => r.json());
  ITEM_STATE.version = versions[0];
  const itemJson = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/data/en_US/item.json`).then((r) => r.json());

  Object.entries(itemJson.data)
    .filter(([id, item]) => isPurchasableItem(id, item))
    .forEach(([id, item]) => {
      ITEM_STATE.items[id] = item;
      (item.tags || []).forEach((tag) => ITEM_STATE.tags.add(tag));
    });

  await loadCommunityDragonCalcs();

  document.getElementById("itemSearch").addEventListener("input", applyItemFilters);
  renderTagFilters("itemFilters", applyItemFilters);
  renderMapFilters("mapFilters", applyItemFilters);
  applyItemFilters();
}

/**
 * Renders tag filter checkboxes into a target container and wires change callbacks.
 */
function renderTagFilters(targetId, onChange) {
  const root = document.getElementById(targetId);
  root.innerHTML = Array.from(ITEM_STATE.tags)
    .sort((a, b) => a.localeCompare(b))
    .map((tag) => `<label class="tag-pill"><input type="checkbox" value="${tag}" class="tag-checkbox"> ${tag}</label>`)
    .join("");
  root.querySelectorAll(".tag-checkbox").forEach((cb) => cb.addEventListener("change", onChange));
}


/**
 * Renders map toggle checkboxes for manual map selection.
 */
function renderMapFilters(targetId, onChange) {
  const root = document.getElementById(targetId);
  root.innerHTML = MAP_OPTIONS
    .map((map) => `<label class="tag-pill mr-5"><input type="checkbox" value="${map.id}" class="map-checkbox" ${ITEM_STATE.selectedMaps.has(map.id) ? "checked" : ""}> ${map.label}</label>`)
    .join("");
  root.querySelectorAll(".map-checkbox").forEach((cb) => cb.addEventListener("change", onChange));
}

/**
 * Reads selected map checkboxes and returns map ids.
 */
function getSelectedMaps() {
  const checkboxes = Array.from(document.querySelectorAll("#mapFilters .map-checkbox"));
  const picked = checkboxes.filter((cb) => cb.checked).map((cb) => Number(cb.value));
  return new Set(picked);
}

/**
 * Reads selected tag checkboxes from a filter container and returns normalized tag names.
 */
function getSelectedTags(rootId) {
  return new Set(Array.from(document.querySelectorAll(`#${rootId} .tag-checkbox:checked`)).map((cb) => cb.value));
}

/**
 * Applies search and tag filters, then updates filtered item ids and rendered results.
 */
function applyItemFilters() {
  ITEM_STATE.selectedTags = getSelectedTags("itemFilters");
  ITEM_STATE.selectedMaps = getSelectedMaps();
  const text = document.getElementById("itemSearch").value.trim().toLowerCase();

  const filteredEntries = Object.entries(ITEM_STATE.items)
    .filter(([, item]) => itemMatchesSelectedMaps(item))
    .filter(([, item]) => {
      const nameOk = !text || item.name.toLowerCase().includes(text);
      const tagOk = !ITEM_STATE.selectedTags.size || Array.from(ITEM_STATE.selectedTags).every((t) => item.tags?.includes(t));
      return nameOk && tagOk;
    });

  ITEM_STATE.filteredIds = dedupeByNameWithMapPriority(filteredEntries)
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([id]) => id);

  renderItemGrid();
  const stillExists = ITEM_STATE.selectedId && ITEM_STATE.filteredIds.includes(ITEM_STATE.selectedId);
  if (!stillExists) ITEM_STATE.selectedId = ITEM_STATE.filteredIds[0] || null;
  if (ITEM_STATE.selectedId) showItem(ITEM_STATE.selectedId);
  else clearItemDetails();
}

/**
 * Renders the filtered item icon/button grid and count summary.
 */
function renderItemGrid() {
  const grid = document.getElementById("itemGrid");
  document.getElementById("itemCount").textContent = `${ITEM_STATE.filteredIds.length} items`;

  grid.innerHTML = ITEM_STATE.filteredIds.map((id) => {
    const item = ITEM_STATE.items[id];
    const selectedClass = ITEM_STATE.selectedId === id ? " item-button-selected" : "";
    return `<button class="item-button-icon${selectedClass}" onclick="showItem('${id}')" title="${item.name}" aria-label="${item.name}">
      <img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/img/item/${id}.png" alt="${item.name}">
    </button>`;
  }).join("");
}

/**
 * Resets the right-side item details panel to an empty state.
 */
function clearItemDetails() {
  document.getElementById("itemName").textContent = "No item selected";
  document.getElementById("itemIcon").removeAttribute("src");
  document.getElementById("itemMeta").textContent = "";
  document.getElementById("itemCost").textContent = "";
  document.getElementById("itemTooltipMain").innerHTML = "Try changing search or filters.";
}

/**
 * Renders one selected item with cost, stats, and enhanced tooltip body.
 */
function showItem(id) {
  const item = ITEM_STATE.items[id];
  if (!item) return;

  ITEM_STATE.selectedId = id;
  renderItemGrid();

  const resolvedDescription = resolveDescriptionFormulas(item, item.description || "");
  const { lines, extracted } = buildExtractedFormulas(id);
  const hasExplicitActive = /<active>|\bACTIVE\b/i.test(item.description || "");
  const hasCooldownPlaceholder = /\(0s\)/i.test(item.description || "");
  const inferredCooldown = (hasExplicitActive || hasCooldownPlaceholder) ? inferActiveCooldownSeconds(id) : null;
  const normalizedDescription = injectActiveCooldown(resolvedDescription, inferredCooldown);
  const formulaEnhancedDescription = injectDamageFormulaText(normalizedDescription, lines, id);
  const titledDescription = emphasizeAbilityHeaders(formulaEnhancedDescription);
  const tooltipMain = enhanceActiveTooltip(titledDescription);

  ITEM_STATE.extractedById[id] = extracted;

  document.getElementById("itemName").textContent = item.name;
  document.getElementById("itemIcon").src = `https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/img/item/${id}.png`;
  document.getElementById("itemCost").innerHTML = `<strong>Cost:</strong> ${item.gold?.total ?? 0}g`;
  document.getElementById("itemMeta").innerHTML = `<strong>Tags:</strong> ${(item.tags || []).join(", ") || "-"}`;
  document.getElementById("itemTooltipMain").innerHTML = colorizeStatsInHtml(tooltipMain);
}


window.ItemLookupShared = {
  MAP_OPTIONS,
  RAW_STAT_KEYS,
  isPurchasableItem,
  dedupeByNameWithMapPriority,
  resolveDescriptionFormulas,
  colorizeStatsInHtml,
  buildExtractedFormulas,
  injectDamageFormulaText,
  emphasizeAbilityHeaders,
  enhanceActiveTooltip,
  inferActiveCooldownSeconds,
  injectActiveCooldown,
  loadCommunityDragonCalcs,
  getState: () => ITEM_STATE,
};
