/**
 * Item Lookup controller.
 *
 * Responsibilities:
 * - Load and dedupe Summoner's Rift purchasable items from Data Dragon.
 * - Load CommunityDragon item calculation payloads for richer formula detail.
 * - Render item cost, raw stats, tooltip body, active details, and extracted formulas.
 * - Color-code stat keywords in tooltip/details using the shared color table.
 *
 * Flow:
 * 1) `initItemLookup` loads versioned item data + CommunityDragon calculations.
 * 2) Search/tag filters update `ITEM_STATE.filteredIds` then render the icon grid.
 * 3) `showItem` composes the detailed panel (cost/stats/tooltip/actives/formulas).
 */
const ITEM_STATE = {
  version: "",
  items: {},
  filteredIds: [],
  tags: new Set(),
  selectedTags: new Set(),
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
 * Returns true when an item is purchasable and available on Summoner's Rift.
 */
function isSummonersRiftItem(item) {
  return item.gold?.purchasable && item.maps?.[11] && !item.requiredAlly;
}

/**
 * Deduplicates item entries by normalized name, keeping the highest numeric item id.
 */
function dedupeByNameKeepingLatest(itemEntries) {
  const byName = {};
  itemEntries.forEach(([id, item]) => {
    const key = item.name.trim().toLowerCase();
    const current = byName[key];
    if (!current || Number(id) > Number(current.id)) byName[key] = { id, item };
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
      const first = part.mLevel1Value ?? 0;
      const bps = (part.mBreakpoints || []).map((bp) => `L${bp.mLevel}: +${bp.mBonusPerLevelAtAndAfter}/lvl`).join(", ");
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
  if (calc.__type === "GameCalculation") return (calc.mFormulaParts || []).map((p) => formulaPartToText(p, dataValueMap, calcMap)).join(" + ");

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
    if (!formula || /^\s*[0-9.]+\s*$/.test(formula)) return;
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

  const deduped = dedupeByNameKeepingLatest(Object.entries(itemJson.data).filter(([, item]) => isSummonersRiftItem(item)));
  deduped.forEach(([id, item]) => {
    ITEM_STATE.items[id] = item;
    (item.tags || []).forEach((tag) => ITEM_STATE.tags.add(tag));
  });

  await loadCommunityDragonCalcs();

  document.getElementById("itemSearch").addEventListener("input", applyItemFilters);
  renderTagFilters("itemFilters", applyItemFilters);
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
  const text = document.getElementById("itemSearch").value.trim().toLowerCase();

  ITEM_STATE.filteredIds = Object.entries(ITEM_STATE.items)
    .filter(([, item]) => {
      const nameOk = !text || item.name.toLowerCase().includes(text);
      const tagOk = !ITEM_STATE.selectedTags.size || Array.from(ITEM_STATE.selectedTags).every((t) => item.tags?.includes(t));
      return nameOk && tagOk;
    })
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
  const inferredCooldown = inferActiveCooldownSeconds(id);
  const normalizedDescription = inferredCooldown !== null
    ? resolvedDescription.replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, `$1${inferredCooldown}s$2`)
    : resolvedDescription;
  const tooltipMain = enhanceActiveTooltip(normalizedDescription, lines);

  ITEM_STATE.extractedById[id] = extracted;

  document.getElementById("itemName").textContent = item.name;
  document.getElementById("itemIcon").src = `https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/img/item/${id}.png`;
  document.getElementById("itemMeta").innerHTML = `<strong>Tags:</strong> ${(item.tags || []).join(", ") || "-"}`;
  document.getElementById("itemCost").innerHTML = `<strong>Cost:</strong> ${item.gold?.total ?? 0}g`;
  document.getElementById("itemTooltipMain").innerHTML = colorizeStatsInHtml(tooltipMain);
}
