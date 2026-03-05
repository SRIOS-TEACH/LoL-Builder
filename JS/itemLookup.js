/**
 * Item Lookup page + shared item helpers for Builder.
 *
 * This module intentionally exposes a small `window.ItemLookupShared` API that Builder reuses
 * so item parsing logic is implemented once in one place.
 */

/**
 * Reactive state for item lookup and shared caches.
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
 * Human-readable labels for Data Dragon raw item stat keys.
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
 * Supported map filters for the item browser.
 */
const MAP_OPTIONS = [
  { id: 11, label: "Summoners Rift" },
  { id: 12, label: "ARAM" },
  { id: 30, label: "Arena" },
];

/**
 * Items forced into catalog even if Data Dragon marks them special-case.
 */
const FORCE_INCLUDE_ITEM_IDS = new Set(["3040", "3042", "3121"]);

/**
 * Keyword->color rules for tooltip highlighting.
 */
const STAT_COLOR_RULES = [
  ["health", "#1F995C"], ["hp", "#1F995C"],
  ["attack damage", "orange"], ["attack's damage", "orange"], ["ad", "orange"],
  ["physical damage", "#FF8C34"],
  ["ability power", "#7A6DFF"], ["ap", "#7A6DFF"],
  ["magic damage", "#00B0F0"],
  ["true damage", "#F9966B"],
  ["omnivamp", "#CC2051"], ["life steal", "#CC2051"],
  ["mana", "#0099CC"], ["energy", "yellow"],
  ["critical strike chance", "orangered"], ["crit chance", "orangered"],
  ["critical strike damage", "#944B00"], ["crit damage", "#944B00"], ["crit", "#944B00"],
  ["movement speed", "#FFFDC9"], ["move speed", "#FFFDC9"], ["ms", "#FFFDC9"],
  ["gold", "#FFD700"],
  ["heal and shield power", "#60E08F"], ["heal", "#60E08F"],
  ["ability haste", "#7ADECD"], ["ah", "#7ADECD"],
  ["lethality", "tomato"], ["armor penetration", "tomato"],
  ["armor", "yellow"],
  ["magic penetration", "violet"],
  ["magic resist", "#00FFFF"], ["mr", "#00FFFF"],
  ["attack range", "#AEB3BD"],
  ["attack speed", "#F5EE99"], ["as", "#F5EE99"],
].sort((a, b) => b[0].length - a[0].length);

/**
 * Returns true when an item should be considered purchasable by the app.
 */
function isPurchasableItem(id, item) {
  if (FORCE_INCLUDE_ITEM_IDS.has(String(id))) return true;
  const mapEnabled = Object.values(item.maps || {}).some(Boolean);
  return item.gold?.purchasable && mapEnabled && !item.requiredAlly;
}

/**
 * Checks if an item is available in any currently selected map filter.
 */
function itemMatchesSelectedMaps(item) {
  const maps = item.maps || {};
  return Array.from(ITEM_STATE.selectedMaps).some((mapId) => maps[mapId]);
}

/**
 * Deduplicates item entries by normalized item name and keeps best map candidate.
 */
function dedupeByNameWithMapPriority(itemEntries, selectedMaps = ITEM_STATE.selectedMaps) {
  const selectedOrder = MAP_OPTIONS.map((m) => m.id).filter((id) => selectedMaps.has(id));
  const byName = {};

  const rankItem = (id, item) => {
    const maps = item.maps || {};
    const selectedIdx = selectedOrder.findIndex((mapId) => maps[mapId]);
    const enabledMapCount = Object.values(maps).filter(Boolean).length;
    return {
      selectedIdx: selectedIdx === -1 ? Number.MAX_SAFE_INTEGER : selectedIdx,
      enabledMapCount,
      numericId: Number(id),
    };
  };

  itemEntries.forEach(([id, item]) => {
    const key = String(item.name || "").trim().toLowerCase();
    if (!key) return;
    if (!byName[key]) {
      byName[key] = { id, item };
      return;
    }
    const current = byName[key];
    const incomingRank = rankItem(id, item);
    const currentRank = rankItem(current.id, current.item);
    const better = incomingRank.selectedIdx < currentRank.selectedIdx
      || (incomingRank.selectedIdx === currentRank.selectedIdx && incomingRank.enabledMapCount > currentRank.enabledMapCount)
      || (incomingRank.selectedIdx === currentRank.selectedIdx
        && incomingRank.enabledMapCount === currentRank.enabledMapCount
        && incomingRank.numericId < currentRank.numericId);
    if (better) byName[key] = { id, item };
  });

  return Object.values(byName).map(({ id, item }) => [id, item]);
}

/**
 * Loads Community Dragon item payload and indexes by numeric item id.
 */
async function loadCommunityDragonCalcs() {
  try {
    const payload = await fetch("https://raw.communitydragon.org/latest/game/items.cdtb.bin.json").then((r) => r.json());
    ITEM_STATE.cdragonById = {};
    Object.entries(payload || {}).forEach(([key, value]) => {
      const id = String(key).match(/Items\/(\d+)$/)?.[1]
        || String(value?.itemID || value?.id || "").match(/(\d+)$/)?.[1];
      if (id) ITEM_STATE.cdragonById[id] = value;
    });
  } catch (error) {
    console.warn("Community Dragon item calculations unavailable", error);
  }
}

/**
 * Resolves a token like e1/e2 from Data Dragon item effect fields.
 */
function resolveEffectToken(item, token) {
  if (!item?.effect) return null;
  if (item.effect[token] !== undefined) return item.effect[token];
  if (item.effect[token.toUpperCase()] !== undefined) return item.effect[token.toUpperCase()];
  const effectIndex = String(token).match(/^e(\d+)$/i)?.[1];
  if (!effectIndex) return null;
  return item.effect[`Effect${effectIndex}Amount`] ?? null;
}

/**
 * Replaces `{{token}}` fields in Data Dragon item descriptions using item.effect values.
 */
function resolveDescriptionFormulas(item, descriptionHtml) {
  return String(descriptionHtml || "").replace(/{{\s*([^}\s]+)\s*}}/g, (_full, token) => {
    const resolved = resolveEffectToken(item, token);
    return resolved !== null ? String(resolved) : `{{${token}}}`;
  });
}

/**
 * Escapes regex metacharacters for safe dynamic regex creation.
 */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Applies stat term coloring to text nodes while preserving HTML tag structure.
 */
function colorizeStatsInHtml(html) {
  const segments = String(html || "").split(/(<[^>]+>)/g);
  return segments.map((segment) => {
    if (segment.startsWith("<") && segment.endsWith(">")) return segment;
    let text = segment;
    STAT_COLOR_RULES.forEach(([keyword, color]) => {
      text = text.replace(new RegExp(`\\b(${escapeRegExp(keyword)})\\b`, "gi"), `<span class=\"stat-colored\" style=\"color:${color}\">$1</span>`);
    });
    return text;
  }).join("");
}

/**
 * Maps stat ids used in calc payloads to readable labels.
 */
function statLabelFromId(statId) {
  const labels = {
    0: "AP", 1: "Armor", 2: "AD", 3: "Attack Speed", 4: "Attack Speed", 5: "MR", 6: "MR", 7: "Move Speed",
    8: "Crit Chance", 11: "AP", 12: "Max Health", 18: "Lethality", 19: "Armor Pen", 20: "Magic Pen", 21: "Magic Pen",
    29: "Target Max Health", 30: "Bonus Health", 31: "Total Health", 34: "Attack Speed",
  };
  return labels[Number(statId)] || `Stat ${statId}`;
}

/**
 * Converts a calculation part object into readable text.
 */
function calculationPartToText(part, calcMap, dataValueMap) {
  if (!part) return "";
  const type = String(part.__type || "");

  if (type === "NumberCalculationPart") return String(Number(part.mNumber || 0));
  if (type === "NamedDataValueCalculationPart") return String(dataValueMap[part.mDataValue] ?? part.mDataValue ?? 0);

  if (type === "StatByCoefficientCalculationPart") {
    const coeff = Number(part.mCoefficient || 0) * 100;
    return `${coeff.toFixed(Number.isInteger(coeff) ? 0 : 1)}% ${statLabelFromId(part.mStat)}`;
  }

  if (type === "StatByNamedDataValueCalculationPart") {
    const coeff = Number(dataValueMap[part.mDataValue] || 0) * 100;
    return `${coeff.toFixed(Number.isInteger(coeff) ? 0 : 1)}% ${statLabelFromId(part.mStat)}`;
  }

  if (type === "ProductOfSubPartsCalculationPart") {
    const parts = (part.mPart1 ? [part.mPart1] : []).concat(part.mPart2 ? [part.mPart2] : []).concat(part.mSubparts || []);
    const rows = parts.map((p) => calculationPartToText(p, calcMap, dataValueMap)).filter(Boolean);
    return rows.join(" × ");
  }

  if (type === "SumOfSubPartsCalculationPart") {
    const rows = (part.mSubparts || []).map((p) => calculationPartToText(p, calcMap, dataValueMap)).filter(Boolean);
    return rows.join(" + ");
  }

  if (type === "ByCharLevelBreakpointsCalculationPart") {
    const level1 = Number(part.mLevel1Value || 0);
    const steps = (part.mBreakpoints || []).map((bp) => Number(bp?.mAdditionalBonusAtThisLevel || 0)).filter((v) => v !== 0);
    if (!steps.length) return String(level1);
    const avgStep = steps.reduce((a, b) => a + b, 0) / steps.length;
    return `${level1} + ${avgStep.toFixed(2)}/lvl`;
  }

  if (type === "ClampSubPartsCalculationPart") {
    const valueText = calculationPartToText(part.mSubPart, calcMap, dataValueMap);
    const minText = calculationPartToText(part.mFloor, calcMap, dataValueMap);
    const maxText = calculationPartToText(part.mCeiling, calcMap, dataValueMap);
    return `clamp(${valueText}, ${minText || "-∞"}, ${maxText || "+∞"})`;
  }

  return `[${type || "CalculationPart"}]`;
}

/**
 * Converts a game-calculation object into readable formula text.
 */
function gameCalculationToText(calcName, calc, calcMap, dataValueMap) {
  if (!calc) return "";
  const type = String(calc.__type || "");

  if (type === "GameCalculation") {
    const rows = (calc.mFormulaParts || []).map((p) => calculationPartToText(p, calcMap, dataValueMap)).filter(Boolean);
    return rows.join(" + ");
  }

  if (type === "GameCalculationModified") {
    const base = calcMap[calc.mModifiedGameCalculation]
      ? gameCalculationToText(calc.mModifiedGameCalculation, calcMap[calc.mModifiedGameCalculation], calcMap, dataValueMap)
      : String(calc.mModifiedGameCalculation || "");
    const mult = calculationPartToText(calc.mMultiplier, calcMap, dataValueMap);
    return mult ? `${base} × (${mult})` : base;
  }

  if (type === "GameCalculationConditional") {
    const conditional = calcMap[calc.mConditionalGameCalculation]
      ? gameCalculationToText(calc.mConditionalGameCalculation, calcMap[calc.mConditionalGameCalculation], calcMap, dataValueMap)
      : String(calc.mConditionalGameCalculation || "");
    const fallback = calcMap[calc.mDefaultGameCalculation]
      ? gameCalculationToText(calc.mDefaultGameCalculation, calcMap[calc.mDefaultGameCalculation], calcMap, dataValueMap)
      : String(calc.mDefaultGameCalculation || "");
    return `${fallback} (or ${conditional})`;
  }

  return `[${type || calcName}]`;
}

/**
 * Converts internal calc keys (camel/snake) into display names.
 */
function prettyCalcName(name) {
  return String(name || "Calculation")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bDps\b/i, "DPS")
    .trim();
}

/**
 * Categorizes extracted formula rows for downstream display usage.
 */
function categorizeEffect(name, formula) {
  const haystack = `${name} ${formula}`.toLowerCase();
  if (haystack.includes("spellblade")) return "Spellblade";
  if (haystack.includes("on-hit") || haystack.includes("on hit")) return "On-hit";
  if (haystack.includes("active") || haystack.includes("cooldown")) return "Active";
  if (haystack.includes("burn")) return "Burn";
  return "On-ability";
}

/**
 * Extracts readable formula lines from Community Dragon item calculations.
 */
function buildExtractedFormulas(itemId) {
  const cItem = ITEM_STATE.cdragonById[String(itemId)];
  if (!cItem?.mItemCalculations) return { lines: [], extracted: [] };

  const calcMap = cItem.mItemCalculations || {};
  const dataValueMap = {};
  (cItem.mDataValues || []).forEach((d) => {
    dataValueMap[d.mName] = Number(d.mValue ?? 0);
  });

  const lines = [];
  const extracted = [];

  Object.entries(calcMap).forEach(([name, calc]) => {
    const formula = gameCalculationToText(name, calc, calcMap, dataValueMap);
    if (!formula || /^\s*[0-9.]+\s*$/.test(formula)) return;
    const cleanName = prettyCalcName(name);
    const category = categorizeEffect(cleanName, formula);
    const row = { name: cleanName, formula, category };
    lines.push(row);
    extracted.push({ key: name, ...row });
  });

  return { lines, extracted };
}

/**
 * Builds a numeric map of Community Dragon mDataValues for one item.
 */
function getCdragonDataValueMap(itemId) {
  const cItem = ITEM_STATE.cdragonById[String(itemId)];
  const map = {};
  (cItem?.mDataValues || []).forEach((d) => {
    map[d.mName] = Number(d.mValue);
  });
  return map;
}

/**
 * Infers active cooldown in seconds, preferring generic active cooldown fields.
 */
function inferActiveCooldownSeconds(itemId) {
  const values = Object.entries(getCdragonDataValueMap(itemId))
    .filter(([k, v]) => /cooldown/i.test(k) && Number.isFinite(v) && v > 0);
  if (!values.length) return null;

  const preferred = [/^Cooldown$/i, /Active.*Cooldown/i, /Item.*Cooldown/i];
  for (const matcher of preferred) {
    const hit = values.find(([name]) => matcher.test(name));
    if (hit) return Number(hit[1]);
  }

  const nonPassive = values.find(([name]) => !/spellblade|sheen|onhit/i.test(name));
  return nonPassive ? Number(nonPassive[1]) : null;
}

/**
 * Colors numeric parts of formulas based on the damage type context.
 */
function colorFormulaNumbers(formulaText, damageType) {
  const colors = { magic: "#00B0F0", physical: "#FF8C34", true: "#F9966B" };
  const color = colors[damageType];
  if (!color) return formulaText;
  return String(formulaText).replace(/\b\d+(?:\.\d+)?%?\b/g, (n) => `<span class=\"stat-colored\" style=\"color:${color}\">${n}</span>`);
}

/**
 * Injects extracted formula text into generic "deals/dealing X damage" tooltip phrases.
 */
function injectDamageFormulaText(descriptionHtml, formulaLines, itemId = null) {
  let html = String(descriptionHtml || "");
  const damageLines = (formulaLines || []).filter((line) => /damage/i.test(`${line.name} ${line.formula}`));
  if (!damageLines.length) return html;

  const pickFormula = (type) => {
    const matched = damageLines.find((row) => new RegExp(type, "i").test(`${row.name} ${row.formula}`));
    if (matched) return matched.formula;
    return damageLines[0].formula;
  };

  const patterns = [
    { type: "magic", regex: /(deals?|dealing)\s+<magicDamage>\s*magic damage\s*<\/magicDamage>/i },
    { type: "physical", regex: /(deals?|dealing)\s+<physicalDamage>\s*physical damage\s*<\/physicalDamage>/i },
    { type: "true", regex: /(deals?|dealing)\s+<trueDamage>\s*true damage\s*<\/trueDamage>/i },
    { type: "magic", regex: /(deals?|dealing)\s+magic damage/i },
    { type: "physical", regex: /(deals?|dealing)\s+physical damage/i },
    { type: "true", regex: /(deals?|dealing)\s+true damage/i },
  ];

  patterns.forEach(({ type, regex }) => {
    if (!regex.test(html)) return;
    const colored = colorFormulaNumbers(pickFormula(type), type);
    html = html.replace(regex, (_m, verb) => `${verb} ${colored} ${type} damage`);
  });

  if (itemId === "3040") {
    html = html.replace(/below\s+30%\s+health/gi, "that would reduce your Health below 30%");
    html = html.replace(/for\s+3\s*seconds/gi, "for 3 seconds");
  }

  return html;
}

/**
 * Bolds named ability header tags emitted in item tooltip HTML.
 */
function emphasizeAbilityHeaders(descriptionHtml) {
  return String(descriptionHtml || "")
    .replace(/<(active|passive|unique|onhit)>\s*([^<]+?)\s*<\/\1>/gi, (_m, tag, name) => `<${tag}><strong>${name}</strong></${tag}>`)
    .replace(/<active>\s*ACTIVE\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)\s*<br\s*\/?>\s*<active>([^<]+)<\/active>/gi, (_m, cooldown, name) => `<active><strong>ACTIVE - ${name.trim()} (${cooldown})</strong></active>`);
}

/**
 * Replaces 0s placeholders in active descriptions with inferred cooldown seconds.
 */
function injectActiveCooldown(descriptionHtml, cooldownSeconds) {
  if (cooldownSeconds === null || cooldownSeconds === undefined) return String(descriptionHtml || "");
  return String(descriptionHtml || "")
    .replace(/(<active>\s*ACTIVE\s*<\/active>\s*)\((?:0|0\.0+)s\)/i, `$1(${cooldownSeconds}s)`)
    .replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, `$1${cooldownSeconds}s$2`);
}

/**
 * Adds active header emphasis in tooltip text.
 */
function enhanceActiveTooltip(descriptionHtml) {
  return String(descriptionHtml || "").replace(/(ACTIVE\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");
}

/**
 * Loads Data Dragon version + item catalog + optional Community Dragon formulas.
 */
async function initItemLookup() {
  const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then((r) => r.json());
  ITEM_STATE.version = versions[0];

  const itemJson = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/data/en_US/item.json`).then((r) => r.json());
  ITEM_STATE.items = Object.fromEntries(Object.entries(itemJson.data || {}).filter(([id, item]) => isPurchasableItem(id, item)));

  await loadCommunityDragonCalcs();

  ITEM_STATE.tags = new Set();
  Object.values(ITEM_STATE.items).forEach((item) => (item.tags || []).forEach((tag) => ITEM_STATE.tags.add(tag)));

  document.getElementById("itemSearch").addEventListener("input", applyItemFilters);
  renderTagFilters("itemFilters", applyItemFilters);
  renderMapFilters("mapFilters", applyItemFilters);
  applyItemFilters();
}

/**
 * Renders tag filter checkboxes and binds their change handler.
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
 * Renders map filter checkboxes and binds their change handler.
 */
function renderMapFilters(targetId, onChange) {
  const root = document.getElementById(targetId);
  root.innerHTML = MAP_OPTIONS
    .map((map) => `<label class="tag-pill mr-5"><input type="checkbox" value="${map.id}" class="map-checkbox" ${ITEM_STATE.selectedMaps.has(map.id) ? "checked" : ""}> ${map.label}</label>`)
    .join("");
  root.querySelectorAll(".map-checkbox").forEach((cb) => cb.addEventListener("change", onChange));
}

/**
 * Returns selected map IDs from map filter inputs.
 */
function getSelectedMaps() {
  const picked = Array.from(document.querySelectorAll("#mapFilters .map-checkbox"))
    .filter((cb) => cb.checked)
    .map((cb) => Number(cb.value));
  return new Set(picked);
}

/**
 * Returns selected tag values from a given filter container.
 */
function getSelectedTags(rootId) {
  const checked = Array.from(document.querySelectorAll(`#${rootId} .tag-checkbox:checked`)).map((cb) => cb.value);
  return new Set(checked);
}

/**
 * Applies search/tag/map filters to item catalog and updates selection.
 */
function applyItemFilters() {
  ITEM_STATE.selectedTags = getSelectedTags("itemFilters");
  ITEM_STATE.selectedMaps = getSelectedMaps();
  const searchText = String(document.getElementById("itemSearch").value || "").trim().toLowerCase();

  const filteredEntries = Object.entries(ITEM_STATE.items)
    .filter(([, item]) => itemMatchesSelectedMaps(item))
    .filter(([, item]) => {
      const nameOk = !searchText || item.name.toLowerCase().includes(searchText);
      const tagsOk = !ITEM_STATE.selectedTags.size || Array.from(ITEM_STATE.selectedTags).every((tag) => item.tags?.includes(tag));
      return nameOk && tagsOk;
    });

  ITEM_STATE.filteredIds = dedupeByNameWithMapPriority(filteredEntries)
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([id]) => id);

  renderItemGrid();
  const stillSelected = ITEM_STATE.selectedId && ITEM_STATE.filteredIds.includes(ITEM_STATE.selectedId);
  if (!stillSelected) ITEM_STATE.selectedId = ITEM_STATE.filteredIds[0] || null;
  if (ITEM_STATE.selectedId) showItem(ITEM_STATE.selectedId);
  else clearItemDetails();
}

/**
 * Renders filtered item buttons and result count.
 */
function renderItemGrid() {
  const grid = document.getElementById("itemGrid");
  document.getElementById("itemCount").textContent = `${ITEM_STATE.filteredIds.length} items`;
  grid.innerHTML = ITEM_STATE.filteredIds.map((id) => {
    const item = ITEM_STATE.items[id];
    const selectedClass = ITEM_STATE.selectedId === id ? " item-button-selected" : "";
    return `<button class="item-button-icon${selectedClass}" onclick="showItem('${id}')" title="${item.name}" aria-label="${item.name}"><img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/img/item/${id}.png" alt="${item.name}"></button>`;
  }).join("");
}

/**
 * Clears item detail panel when no selected item exists.
 */
function clearItemDetails() {
  document.getElementById("itemName").textContent = "No item selected";
  document.getElementById("itemIcon").removeAttribute("src");
  document.getElementById("itemCost").textContent = "";
  document.getElementById("itemMeta").textContent = "";
  document.getElementById("itemTooltipMain").innerHTML = "Try changing search or filters.";
}

/**
 * Renders the selected item tooltip using shared formula/cooldown/header enhancements.
 */
function showItem(id) {
  const item = ITEM_STATE.items[id];
  if (!item) return;

  ITEM_STATE.selectedId = id;
  renderItemGrid();

  const resolvedDescription = resolveDescriptionFormulas(item, item.description || "");
  const { lines, extracted } = buildExtractedFormulas(id);
  const inferredCooldown = /<active>|\bACTIVE\b|\(0s\)/i.test(item.description || "") ? inferActiveCooldownSeconds(id) : null;
  const withCooldown = injectActiveCooldown(resolvedDescription, inferredCooldown);
  const withDamage = injectDamageFormulaText(withCooldown, lines, id);
  const withHeaders = emphasizeAbilityHeaders(withDamage);
  const tooltipMain = colorizeStatsInHtml(enhanceActiveTooltip(withHeaders));

  ITEM_STATE.extractedById[id] = extracted;

  document.getElementById("itemName").textContent = item.name;
  document.getElementById("itemIcon").src = `https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/img/item/${id}.png`;
  document.getElementById("itemCost").innerHTML = `<strong>Cost:</strong> ${item.gold?.total ?? 0}g`;
  document.getElementById("itemMeta").innerHTML = `<strong>Tags:</strong> ${(item.tags || []).join(", ") || "-"}`;
  document.getElementById("itemTooltipMain").innerHTML = tooltipMain;
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
