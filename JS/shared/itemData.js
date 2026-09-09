(function () {
/**
 * Shared item data and tooltip helpers; no page initialization or DOM state.
 *
 * This module intentionally exposes a small `window.ItemLookupShared` API that Builder reuses
 * so item parsing logic is implemented once in one place.
 */

/**
 * Shared optional calculation cache.
 */
const ITEM_DATA = { cdragonById: {} };

/**
 * Supported map filters for the item browser.
 */
const MAP_OPTIONS = window.ItemPolicy.MAP_OPTIONS;

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
  return window.ItemPolicy.isPurchasableItem(id, item);
}

/**
 * Deduplicates item entries by normalized item name and keeps best map candidate.
 */
function dedupeByNameWithMapPriority(itemEntries, selectedMaps = new Set([11])) {
  return window.ItemPolicy.dedupeByNameWithMapPriority(itemEntries, selectedMaps);
}

/**
 * Loads Community Dragon item payload and indexes by numeric item id.
 */
async function loadCommunityDragonCalcs() {
  try {
    const payload = await window.ApiClient.fetchCommunityDragonItems();
    ITEM_DATA.cdragonById = {};
    Object.entries(payload || {}).forEach(([key, value]) => {
      const id = String(key).match(/Items\/(\d+)$/)?.[1]
        || String(value?.itemID || value?.id || "").match(/(\d+)$/)?.[1];
      if (id) ITEM_DATA.cdragonById[id] = value;
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
    const colors = new Map(STAT_COLOR_RULES.map(([word, color]) => [word.toLowerCase(), color]));
    const pattern = new RegExp(`\\b(${STAT_COLOR_RULES.map(([word]) => escapeRegExp(word)).join('|')})\\b`, 'gi');
    return segment.replace(pattern, word => `<span class="stat-colored" style="color:${colors.get(word.toLowerCase())}">${word}</span>`);
  }).join("");
}

function gameCalculationToText(calcName, calc, calcMap, dataValueMap) {
  return window.Calculations.evaluate(calc, {calculations:calcMap,dataValues:dataValueMap}).text;
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
function buildExtractedFormulas(itemId, context = {}) {
  const item = ITEM_DATA.cdragonById[String(itemId)];
  const calculations = item?.mItemCalculations || {};
  const lines = Object.entries(calculations).map(([key, calc]) => {
    const row=window.Calculations.evaluate(calc,{...context,calculations,dataValues:item.mDataValues || [],effects:item.mEffectAmount || []});
    const shown=row.value===null?null:row.value*(row.displayAsPercent?100:1);
    const formula=shown===null ? row.text : `${window.Calculations.format(shown)}${row.displayAsPercent?'%':''} (${row.text})`;
    return {key,name:prettyCalcName(key),formula,expression:row.text,value:shown,category:categorizeEffect(key,formula),inputs:row.inputs,unsupported:row.unsupported};
  });
  return {lines,extracted:lines};
}

function injectItemCalculationValues(html, rows) {
  // Match uniquely named effects; never insert the first arbitrary damage calculation.
  const groups=[
    {pattern:/Gain\s+<scaleAP>\s*Ability Power\s*<\/scaleAP>/i, keys:/^BonusAPCalc$/i, noun:'Ability Power'},
    {pattern:/a\s+<shield>\s*Shield\s*<\/shield>/i, keys:/^ShieldValue$/i, noun:'Shield'},
  ];
  for(const group of groups){
    const matches=rows.filter(row=>group.keys.test(row.key));
    if(matches.length!==1)continue;
    const row=matches[0], value=row.value===null?row.expression:window.Calculations.format(row.value);
    html=html.replace(group.pattern, group.noun==='Ability Power'?`Gain <scaleAP>${value} Ability Power</scaleAP>`:`a <shield>${value} Shield</shield>`);
  }
  return html;
}

/**
 * Builds a numeric map of Community Dragon mDataValues for one item.
 */
function getCdragonDataValueMap(itemId) {
  const cItem = ITEM_DATA.cdragonById[String(itemId)];
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

function emphasizeAbilityHeaders(descriptionHtml) {
  return String(descriptionHtml || "")
    .replace(/<(active|passive|unique|onhit)>\s*([^<]+?)\s*<\/\1>/gi, (_m, tag, name) => `<${tag}><strong>${name}</strong></${tag}>`)
    .replace(/<active>\s*ACTIVE\s*<\/active>\s*\((\d+(?:\.\d+)?s)\)\s*<br\s*\/?>\s*<active>([^<]+)<\/active>/gi, (_m, cooldown, name) => `<active><strong>ACTIVE - ${name.trim()} (${cooldown})</strong></active>`);
}

function injectActiveCooldown(descriptionHtml, cooldownSeconds) {
  if (cooldownSeconds === null || cooldownSeconds === undefined) return String(descriptionHtml || "");
  return String(descriptionHtml || "")
    .replace(/(<(?:active|passive)>[^<]+<\/(?:active|passive)>\s*)\(0(?:\.0+)?s\)/gi, `$1(${cooldownSeconds}s)`)
    .replace(/(<active>\s*ACTIVE\s*<\/active>\s*)\((?:0|0\.0+)s\)/i, `$1(${cooldownSeconds}s)`)
    .replace(/(ACTIVE\s*\()(?:0|0\.0+)s(\))/i, `$1${cooldownSeconds}s$2`);
}

/**
 * Adds active header emphasis in tooltip text.
 */
function enhanceActiveTooltip(descriptionHtml) {
  return String(descriptionHtml || "").replace(/(ACTIVE\s*\(\s*\d+(?:\.\d+)?s\s*\))/gi, "<strong>$1</strong>");
}

window.ItemLookupShared = {
  MAP_OPTIONS,
  isPurchasableItem,
  dedupeByNameWithMapPriority,
  resolveDescriptionFormulas,
  colorizeStatsInHtml,
  buildExtractedFormulas,
  emphasizeAbilityHeaders,
  enhanceActiveTooltip,
  inferActiveCooldownSeconds,
  injectActiveCooldown,
  loadCommunityDragonCalcs,
  gameCalculationToText,
  injectItemCalculationValues,
  getState: () => ITEM_DATA,
};

})();
