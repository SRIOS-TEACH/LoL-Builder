const BUILDER = {
  version: "",
  champions: {},
  items: {},
  selectedChampion: "",
  championData: null,
  level: 1,
  abilityRanks: { q: 0, w: 0, e: 0, r: 0 },
  itemSlots: Array(6).fill(""),
  activeSlot: null,
  itemTags: new Set(),
  champTags: new Set(),
  modalItemFiltered: [],
  modalChampFiltered: [],
  championDetailCache: {},
  cdragonAbilityData: null,
  championModalRequestId: 0,
  runeModalTarget: null,
  runeSelections: {
    primaryPath: "",
    secondaryPath: "",
    primary: [],
    secondary: [],
    shards: ["adaptive-force", "adaptive-force", "scaling-health"],
  },
};

const RUNE_DATA = {
  pathDefaults: {},
  paths: {},
  runeLookup: {
    "adaptive-force": { name: "Adaptive", desc: "+9 Adaptive Force", longDesc: "+9 Adaptive Force", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAdaptiveForceIcon.png" },
    "attack-speed": { name: "Attack Speed", desc: "+10% Attack Speed", longDesc: "+10% Attack Speed", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAttackSpeedIcon.png" },
    "ability-haste": { name: "Ability Haste", desc: "+8 Ability Haste", longDesc: "+8 Ability Haste", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsCDRScalingIcon.png" },
    "move-speed": { name: "Move Speed", desc: "+2.5% Move Speed", longDesc: "+2.5% Move Speed", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsMovementSpeedIcon.png" },
    "scaling-health": { name: "Scaling Health", desc: "+10-200 Bonus Health", longDesc: "+10-200 Bonus Health", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png" },
    health: { name: "Health", desc: "+65 Bonus Health", longDesc: "+65 Bonus Health", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthPlusIcon.png" },
    "tenacity-slow-resist": { name: "Tenacity & Slow Resist", desc: "+15% Tenacity and Slow Resist", longDesc: "+15% Tenacity and Slow Resist", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsTenacityIcon.png" },
  },
  shardOptions: ["adaptive-force", "attack-speed", "ability-haste", "move-speed", "scaling-health", "health", "tenacity-slow-resist"],
};

const RUNE_PATH_ID_TO_KEY = {
  8100: "domination",
  8000: "precision",
  8200: "sorcery",
  8300: "inspiration",
  8400: "resolve",
  // Legacy fallback ids kept for compatibility with older/static payloads.
  7200: "domination",
  7201: "precision",
  7202: "sorcery",
  7203: "inspiration",
  7204: "resolve",
};

function slugifyRuneName(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toDdragonPerkIcon(version, iconPath) {
  if (!iconPath) return "";
  return `http://ddragon.leagueoflegends.com/cdn/img/${String(iconPath).replace(/^\/+/, "")}`;
}

// Shared format/strip helpers are centralized here to avoid redeclaration drift.
function stripHtml(text) {
  return String(text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function buildPathDefaults(paths) {
  return Object.fromEntries(
    Object.entries(paths).map(([id, path]) => [
      id,
      (path.primaryRows || []).map((row) => row[0]).filter(Boolean).slice(0, 4),
    ]),
  );
}

function initializeRuneSelections() {
  const pathIds = Object.keys(RUNE_DATA.paths);
  const primaryPath = pathIds[0] || "";
  const secondaryPath = pathIds.find((id) => id !== primaryPath) || primaryPath;

  BUILDER.runeSelections.primaryPath = primaryPath;
  BUILDER.runeSelections.secondaryPath = secondaryPath;
  BUILDER.runeSelections.primary = getPathPrimaryDefaults(primaryPath);
  BUILDER.runeSelections.secondary = getPathSecondaryDefaults(secondaryPath);
}

function isApAdaptiveChampion() {
  const tags = new Set(BUILDER.championData?.tags || []);
  if (tags.has("Mage")) return true;
  if (tags.has("Marksman") || tags.has("Fighter") || tags.has("Assassin")) return false;
  return true;
}

async function hydrateRunesFromDdragon(version) {
  const runes = await window.ApiClient.fetchRunesReforged(version).catch(() => null);
  if (!Array.isArray(runes) || !runes.length) return;

  const nextPaths = { ...RUNE_DATA.paths };
  const nextLookup = { ...RUNE_DATA.runeLookup };

  runes.forEach((path) => {
    const key = RUNE_PATH_ID_TO_KEY[path.id];
    if (!key) return;

    const pathIcon = toDdragonPerkIcon(version, path.icon);
    const primaryRows = (path.slots || []).map((slot) => (slot.runes || []).map((rune) => {
      const slug = slugifyRuneName(rune.name);
      nextLookup[slug] = {
        name: rune.name,
        desc: stripHtml(rune.longDesc || rune.shortDesc || ""),
        icon: toDdragonPerkIcon(version, rune.icon),
      };
      return slug;
    }));

    nextPaths[key] = {
      ...nextPaths[key],
      name: path.name,
      icon: pathIcon || nextPaths[key]?.icon || "",
      splash: `url(${pathIcon || nextPaths[key]?.icon || ""})`,
      primaryRows: primaryRows.length ? primaryRows : (nextPaths[key]?.primaryRows || []),
    };
  });

  RUNE_DATA.paths = nextPaths;
  RUNE_DATA.runeLookup = nextLookup;
  RUNE_DATA.pathDefaults = buildPathDefaults(nextPaths);
  initializeRuneSelections();
}

function setStatus(message, isError = false) {
  const el = document.getElementById("builderStatus");
  el.textContent = message || "";
  el.classList.toggle("status-error", isError);
}

async function initBuilder() {
  try {
    setStatus("Loading champion and item data...");
    wireLevelOptions();
    await loadBuilderData();
    renderChampionSelect();
    renderItemSlots();
    initItemModal();
    initChampionModal();
    renderRunePanel();
    renderAbilityCards();
    renderStats();
    wireBuilderUiEvents();
    document.getElementById("passiveModal").addEventListener("click", (event) => {
      if (event.target.id === "passiveModal") closePassiveModal();
    });
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus("Failed to load data. Check internet connection and refresh.", true);
  }
}

function wireBuilderUiEvents() {
  document.getElementById("championPickerBtn").addEventListener("click", openChampionModal);
  document.getElementById("passiveToggleBtn").addEventListener("click", togglePassivePanel);
  document.getElementById("clearModalFiltersBtn").addEventListener("click", clearModalFilters);
  document.getElementById("closeItemModalBtn").addEventListener("click", closeItemModal);
  document.getElementById("closeChampModalBtn").addEventListener("click", closeChampionModal);
  document.getElementById("closeRuneModalBtn").addEventListener("click", closeRuneModal);
  document.getElementById("closePassiveModalBtn").addEventListener("click", closePassiveModal);

  document.getElementById("modalChampGrid").addEventListener("mouseover", (event) => {
    const btn = event.target.closest("[data-champ]");
    if (!btn) return;
    renderChampionModalDetail(btn.dataset.champ);
  });
  document.getElementById("modalChampGrid").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-champ]");
    if (!btn) return;
    setChampionFromModal(btn.dataset.champ);
  });
  document.getElementById("itemSlots").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-slot]");
    if (!btn) return;
    openItemModal(Number(btn.dataset.slot));
  });
  document.getElementById("modalItemGrid").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-item-id]");
    if (!btn) return;
    renderModalItemDetail(btn.dataset.itemId);
  });
  document.getElementById("modalItemDetail").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-set-item-id]");
    if (!btn) return;
    setSlotItem(btn.dataset.setItemId);
  });
  document.getElementById("runePanel").addEventListener("click", (event) => {
    const quickBtn = event.target.closest("[data-rune-choice-target][data-rune-choice-id]");
    if (quickBtn && !quickBtn.disabled) {
      BUILDER.runeModalTarget = quickBtn.dataset.runeChoiceTarget;
      selectRuneOption(quickBtn.dataset.runeChoiceId);
      return;
    }
    const btn = event.target.closest("[data-rune-target]");
    if (!btn) return;
    openRuneModal(btn.dataset.runeTarget);
  });
  document.getElementById("runeModalList").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-rune-option-id]");
    if (!btn || btn.disabled) return;
    selectRuneOption(btn.dataset.runeOptionId);
  });
}

function wireLevelOptions() {
  const level = document.getElementById("builderLevel");
  level.innerHTML = Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  level.addEventListener("change", () => {
    BUILDER.level = Number(level.value);
    enforceAbilityRules();
    renderAbilityCards();
    renderStats();
  });
}

const BUILDER_FORCE_INCLUDE_ITEM_IDS = window.ItemPolicy.FORCE_INCLUDE_ITEM_IDS;

function getItemLookupShared() {
  return (typeof window !== "undefined" && window.ItemLookupShared) ? window.ItemLookupShared : null;
}

function isPurchasableBuilderItem(id, item) {
  const shared = getItemLookupShared();
  if (shared?.isPurchasableItem) return shared.isPurchasableItem(id, item);
  return window.ItemPolicy.isPurchasableItem(id, item);
}

function dedupeBuilderItems(itemEntries, preferredMaps = [11]) {
  const shared = getItemLookupShared();
  if (shared?.dedupeByNameWithMapPriority) return shared.dedupeByNameWithMapPriority(itemEntries, new Set(preferredMaps));
  return window.ItemPolicy.dedupeByNameWithMapPriority(itemEntries, new Set(preferredMaps));
}

async function loadBuilderData() {
  BUILDER.version = await window.ApiClient.fetchLatestVersion();
  await hydrateRunesFromDdragon(BUILDER.version);

  const champions = await window.ApiClient.fetchChampionIndex(BUILDER.version);
  BUILDER.champions = champions.data;

  const [items, cdtbData] = await Promise.all([
    window.ApiClient.fetchItemIndex(BUILDER.version),
    window.ApiClient.fetchCommunityDragonItems().catch(() => null),
  ]);
  const cdtbByIdFallback = buildCdtbItemsById(cdtbData);

  const shared = getItemLookupShared();
  let sharedCdtbById = null;
  if (shared?.getState) {
    const state = shared.getState();
    state.version = BUILDER.version;
    state.items = items.data;
    if (shared.loadCommunityDragonCalcs) await shared.loadCommunityDragonCalcs();
    sharedCdtbById = state.cdragonById || null;
  }

  const dedupedItemEntries = dedupeBuilderItems(
    Object.entries(items.data).filter(([id, item]) => isPurchasableBuilderItem(id, item)),
    [11],
  ).filter(([id, item]) => item.maps?.[11] || BUILDER_FORCE_INCLUDE_ITEM_IDS.has(String(id)));

  dedupedItemEntries.forEach(([id, item]) => {
    const cdtbEntry = sharedCdtbById?.[String(id)] || cdtbByIdFallback.get(String(id));
    const stats = buildMergedItemStats(item.stats || {}, cdtbEntry);
    const mergedItem = { ...item, stats };
    BUILDER.items[id] = mergedItem;
    (mergedItem.tags || []).forEach((tag) => BUILDER.itemTags.add(tag));
  });

  if (shared?.getState) {
    const state = shared.getState();
    state.version = BUILDER.version;
    state.items = BUILDER.items;
  }
}

function buildCdtbItemsById(cdtbData) {
  const byId = new Map();
  Object.entries(cdtbData || {}).forEach(([key, entry]) => {
    const rawItemId = entry?.itemID
      ?? entry?.mItemDataClient?.mId
      ?? entry?.id
      ?? entry?.mId
      ?? key;
    const itemId = Number(String(rawItemId).match(/(\d+)(?:\D*)$/)?.[1]);
    if (!itemId) return;
    byId.set(String(itemId), entry);
  });
  return byId;
}

function readNumericStat(entry, base, aliases) {
  const entryValues = aliases
    .map((key) => entry?.[key])
    .filter((v) => v !== undefined && v !== null && v !== "")
    .map((v) => Number(v) || 0);
  const baseValues = aliases
    .map((key) => base?.[key])
    .filter((v) => v !== undefined && v !== null && v !== "")
    .map((v) => Number(v) || 0);

  const nonZeroEntry = entryValues.find((v) => v !== 0);
  if (nonZeroEntry !== undefined) return nonZeroEntry;
  const nonZeroBase = baseValues.find((v) => v !== 0);
  if (nonZeroBase !== undefined) return nonZeroBase;

  if (entryValues.length) return entryValues[0];
  if (baseValues.length) return baseValues[0];
  return 0;
}

function buildMergedItemStats(ddragonStats, cdtbEntry) {
  const base = { ...(ddragonStats || {}) };
  if (!cdtbEntry) return base;

  const cdtbStats = {
    FlatHPPoolMod: readNumericStat(cdtbEntry, base, ["mFlatHPPoolMod", "flatHPPoolMod", "FlatHPPoolMod"]),
    FlatMPPoolMod: readNumericStat(cdtbEntry, base, ["mFlatMPPoolMod", "flatMPPoolMod", "FlatMPPoolMod"]),
    FlatPhysicalDamageMod: readNumericStat(cdtbEntry, base, ["mFlatPhysicalDamageMod", "flatPhysicalDamageMod", "FlatPhysicalDamageMod"]),
    FlatMagicDamageMod: readNumericStat(cdtbEntry, base, ["mFlatMagicDamageMod", "flatMagicDamageMod", "FlatMagicDamageMod"]),
    FlatArmorMod: readNumericStat(cdtbEntry, base, ["mFlatArmorMod", "flatArmorMod", "FlatArmorMod"]),
    FlatSpellBlockMod: readNumericStat(cdtbEntry, base, ["mFlatSpellBlockMod", "flatSpellBlockMod", "FlatSpellBlockMod"]),
    PercentAttackSpeedMod: readNumericStat(cdtbEntry, base, ["mPercentAttackSpeedMod", "percentAttackSpeedMod", "PercentAttackSpeedMod"]),
    FlatMovementSpeedMod: readNumericStat(cdtbEntry, base, ["mFlatMovementSpeedMod", "flatMovementSpeedMod", "FlatMovementSpeedMod"]),
    PercentMovementSpeedMod: readNumericStat(cdtbEntry, base, ["mPercentMovementSpeedMod", "percentMovementSpeedMod", "PercentMovementSpeedMod"]),
    FlatHPRegenMod: readNumericStat(cdtbEntry, base, ["mFlatHPRegenMod", "flatHPRegenMod", "FlatHPRegenMod"]),
    FlatMPRegenMod: readNumericStat(cdtbEntry, base, ["mFlatMPRegenMod", "flatMPRegenMod", "FlatMPRegenMod"]),
    PercentBaseHPRegenMod: readNumericStat(cdtbEntry, base, ["mPercentBaseHPRegenMod", "percentBaseHPRegenMod", "mPercentHPRegenMod", "percentHPRegenMod", "PercentBaseHPRegenMod", "PercentHPRegenMod"]),
    PercentBaseMPRegenMod: readNumericStat(cdtbEntry, base, ["mPercentBaseMPRegenMod", "percentBaseMPRegenMod", "mPercentMPRegenMod", "percentMPRegenMod", "PercentBaseMPRegenMod", "PercentMPRegenMod"]),
    FlatCritChanceMod: readNumericStat(cdtbEntry, base, ["mFlatCritChanceMod", "flatCritChanceMod", "FlatCritChanceMod"]),
    PercentCritChanceMod: readNumericStat(cdtbEntry, base, ["mPercentCritChanceMod", "percentCritChanceMod", "PercentCritChanceMod"]),
    FlatCritDamageMod: readNumericStat(cdtbEntry, base, ["mFlatCritDamageMod", "flatCritDamageMod", "FlatCritDamageMod"]),
    PercentCritDamageMod: readNumericStat(cdtbEntry, base, ["mPercentCritDamageMod", "percentCritDamageMod", "PercentCritDamageMod"]),
    FlatAttackRangeMod: readNumericStat(cdtbEntry, base, ["mFlatAttackRangeMod", "flatAttackRangeMod", "FlatAttackRangeMod"]),
    FlatLethalityMod: readNumericStat(cdtbEntry, base, ["mFlatLethalityMod", "flatLethalityMod", "FlatLethalityMod"]),
    PercentArmorPenetrationMod: readNumericStat(cdtbEntry, base, ["mPercentArmorPenetrationMod", "percentArmorPenetrationMod", "PercentArmorPenetrationMod"]),
    FlatMagicPenetrationMod: readNumericStat(cdtbEntry, base, ["mFlatMagicPenetrationMod", "flatMagicPenetrationMod", "FlatMagicPenetrationMod"]),
    PercentMagicPenetrationMod: readNumericStat(cdtbEntry, base, ["mPercentMagicPenetrationMod", "percentMagicPenetrationMod", "PercentMagicPenetrationMod"]),
    PercentLifeStealMod: readNumericStat(cdtbEntry, base, ["mPercentLifeStealMod", "percentLifeStealMod", "PercentLifeStealMod"]),
    PercentOmnivampMod: readNumericStat(cdtbEntry, base, ["mPercentOmnivampMod", "percentOmnivampMod", "PercentOmnivampMod"]),
    PercentPhysicalVampMod: readNumericStat(cdtbEntry, base, ["mPercentPhysicalVampMod", "percentPhysicalVampMod", "PercentPhysicalVampMod"]),
    PercentTenacityMod: readNumericStat(cdtbEntry, base, ["mPercentTenacityMod", "percentTenacityMod", "PercentTenacityMod"]),
  };

  const haste = readNumericStat(cdtbEntry, base, ["mAbilityHasteMod", "mFlatHasteMod", "flatHasteMod", "FlatHasteMod", "FlatAbilityHasteMod", "AbilityHaste"]);
  cdtbStats.FlatHasteMod = haste;
  cdtbStats.FlatAbilityHasteMod = haste;
  cdtbStats.AbilityHaste = haste;

  return { ...base, ...cdtbStats };
}

function renderChampionSelect() {
  Object.keys(BUILDER.champions).forEach((name) => {
    (BUILDER.champions[name].tags || []).forEach((tag) => BUILDER.champTags.add(tag));
  });
  document.getElementById("championPickerBtn").innerHTML = "+";
  document.getElementById("championPickerBtn").setAttribute("aria-label", "Select champion");
}

function initChampionModal() {
  const modal = document.getElementById("champModal");
  document.getElementById("modalChampSearch").addEventListener("input", renderChampionModalGrid);
  modal.addEventListener("click", (event) => {
    if (event.target.id === "champModal") closeChampionModal();
  });
  const root = document.getElementById("modalChampFilters");
  root.innerHTML = Array.from(BUILDER.champTags).sort((a, b) => a.localeCompare(b))
    .map((tag) => `<label class="tag-pill"><input type="checkbox" class="champ-tag" value="${tag}"> ${tag}</label>`).join("");
  root.querySelectorAll(".champ-tag").forEach((cb) => cb.addEventListener("change", renderChampionModalGrid));
}

function openChampionModal() {
  document.getElementById("champModal").classList.remove("hidden");
  renderChampionModalGrid();
}

function closeChampionModal() {
  document.getElementById("champModal").classList.add("hidden");
}

function renderChampionModalGrid() {
  const text = document.getElementById("modalChampSearch").value.trim().toLowerCase();
  const tags = new Set(Array.from(document.querySelectorAll(".champ-tag:checked")).map((cb) => cb.value));
  BUILDER.modalChampFiltered = Object.keys(BUILDER.champions)
    .filter((name) => {
      const c = BUILDER.champions[name];
      return (!text || name.toLowerCase().includes(text)) && (!tags.size || Array.from(tags).every((t) => c.tags?.includes(t)));
    })
    .sort((a, b) => a.localeCompare(b));

  document.getElementById("modalChampResults").textContent = `${BUILDER.modalChampFiltered.length} champions`;
  document.getElementById("modalChampGrid").innerHTML = BUILDER.modalChampFiltered
    .map((name) => `<button class="item-button-icon" data-champ="${name}" title="${name}"><img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${BUILDER.champions[name].image.full}" alt="${name}"></button>`)
    .join("");
  renderChampionModalDetail(BUILDER.modalChampFiltered[0] || null);
}

async function renderChampionModalDetail(name) {
  const root = document.getElementById("modalChampDetail");
  if (!name) {
    root.innerHTML = "<p class='text-muted'>No champion found.</p>";
    return;
  }

  const reqId = ++BUILDER.championModalRequestId;
  const c = BUILDER.champions[name];
  root.innerHTML = `<h3>${name}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${c.image.full}' alt='${name}'><p><strong>Tags:</strong> ${(c.tags || []).join(", ")}</p><p>${c.blurb}</p><div class='champ-ability-strip'><span class='text-muted'>Loading abilities...</span></div>`;

  if (!BUILDER.championDetailCache[name]) {
    const data = await window.ApiClient.fetchChampionDetails(BUILDER.version, name).catch(() => null);
    BUILDER.championDetailCache[name] = data?.data?.[name] || null;
  }
  if (reqId !== BUILDER.championModalRequestId) return;

  const detail = BUILDER.championDetailCache[name];
  const spells = detail?.spells || [];
  const icons = spells.map((s) => `<img class='champ-ability-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/spell/${s.image.full}' title='${s.name}' alt='${s.name}' loading='lazy'>`).join("");
  root.innerHTML = `<h3>${name}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${c.image.full}' alt='${name}'><p><strong>Tags:</strong> ${(c.tags || []).join(", ")}</p><p>${c.blurb}</p><div class='champ-ability-strip'>${icons || "<span class='text-muted'>No abilities found.</span>"}</div>`;
}

function setChampionFromModal(name) {
  setChampion(name);
  closeChampionModal();
}

function getRuneMeta(id) {
  return RUNE_DATA.runeLookup[id] || { name: "Select", desc: "Pick a rune", longDesc: "Pick a rune", icon: "" };
}

function runeImgTag(meta, className = "") {
  const fallback = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2NCcgaGVpZ2h0PSc2NCc+PHJlY3Qgd2lkdGg9JzY0JyBoZWlnaHQ9JzY0JyByeD0nMzInIGZpbGw9JyMxMTFmM2QnLz48Y2lyY2xlIGN4PSczMicgY3k9JzMyJyByPScyNicgZmlsbD0nIzI3M2Q3MCcvPjwvc3ZnPg==";
  return `<img class="${className}" src="${meta.icon || fallback}" alt="${meta.name}" data-fallback="${fallback}" onerror="this.onerror=null;this.src=this.dataset.fallback">`;
}

function normalizeCdragonChampionPath(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeCdragonRecordPath(path) {
  return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function resolveCdragonRecord(raw, index, path) {
  if (!path) return null;
  const key = index.get(normalizeCdragonRecordPath(path));
  return key ? raw[key] : null;
}

function extractCdragonSpell(spellRecord) {
  const spell = spellRecord?.mSpell || null;
  if (!spell) return null;
  return {
    dataValues: spell.mDataValues || spell.DataValues || [],
    calculations: spell.mSpellCalculations || {},
  };
}

function normalizeSpellRecordName(name) {
  return String(name || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

const DEBUG_CDRAGON_CHILD_SELECTION = false;

function extractTooltipTokens(tooltip) {
  const tokens = new Set();
  const rawTooltip = String(tooltip || "");
  const re = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
  let match = re.exec(rawTooltip);
  while (match) {
    const token = normalizeSpellRecordName(match[1]);
    if (token) tokens.add(token);
    match = re.exec(rawTooltip);
  }
  return tokens;
}

function spellDataValueName(entry) {
  return entry?.mName || entry?.mId || entry?.mDataValue || entry?.name || "";
}

function scoreSpellChildCandidate(parsed, tooltipTokens) {
  if (!parsed) return null;

  const calcKeys = Object.keys(parsed.calculations || {});
  const calcKeySet = new Set(calcKeys.map((key) => normalizeSpellRecordName(key)).filter(Boolean));
  const dataValues = Array.isArray(parsed.dataValues) ? parsed.dataValues : [];
  const dataValueNames = dataValues
    .map((entry) => normalizeSpellRecordName(spellDataValueName(entry)))
    .filter(Boolean);
  const dataValueSet = new Set(dataValueNames);

  let overlapCount = 0;
  (tooltipTokens || new Set()).forEach((token) => {
    if (calcKeySet.has(token) || dataValueSet.has(token)) overlapCount += 1;
  });

  const calculationCount = calcKeys.length;
  const dataValueCount = dataValues.length;
  const score = (calculationCount * 4) + (dataValueCount * 2) + (overlapCount * 6);

  return {
    score,
    overlapCount,
    calculationCount,
    dataValueCount,
  };
}

function chooseBestSpellChild(raw, pathIndex, childSpellPaths, ddSpell, slot = "") {
  const tooltipTokens = extractTooltipTokens(ddSpell?.tooltip);

  const candidates = childSpellPaths
    .map((path, index) => {
      const record = resolveCdragonRecord(raw, pathIndex, path);
      const parsed = extractCdragonSpell(record);
      if (!parsed) return null;
      const scoreMeta = scoreSpellChildCandidate(parsed, tooltipTokens);
      return {
        path,
        index,
        record: resolveCdragonRecord(raw, pathIndex, path),
        parsed,
        score: scoreMeta?.score || 0,
        overlapCount: scoreMeta?.overlapCount || 0,
        calculationCount: scoreMeta?.calculationCount || 0,
        dataValueCount: scoreMeta?.dataValueCount || 0,
      };
    })
    .filter(Boolean);

  if (!candidates.length) return null;

  const best = candidates
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.overlapCount !== a.overlapCount) return b.overlapCount - a.overlapCount;
      if (b.calculationCount !== a.calculationCount) return b.calculationCount - a.calculationCount;
      if (b.dataValueCount !== a.dataValueCount) return b.dataValueCount - a.dataValueCount;
      return a.index - b.index;
    })[0];

  if (DEBUG_CDRAGON_CHILD_SELECTION) {
    console.debug("[CDragon child selection]", {
      slot,
      ddSpell: ddSpell?.id || ddSpell?.name || "",
      tooltipTokens: Array.from(tooltipTokens),
      selected: { path: best.path, score: best.score, overlapCount: best.overlapCount, calculationCount: best.calculationCount, dataValueCount: best.dataValueCount },
      candidates: candidates.map((candidate) => ({
        path: candidate.path,
        score: candidate.score,
        overlapCount: candidate.overlapCount,
        calculationCount: candidate.calculationCount,
        dataValueCount: candidate.dataValueCount,
      })),
    });
  }

  return {
    parsed: best.parsed,
    path: best.path,
    record: best.record,
  };
}

function addSpellPayloadAlias(lookup, payload, aliasRaw) {
  const normalized = normalizeSpellRecordName(aliasRaw);
  const canonical = canonicalizeToken(normalized);
  if (!canonical || lookup[canonical]) return;
  lookup[canonical] = payload;
}

function buildSpellPayloadLookupEntry(lookup, payload, aliases = []) {
  aliases.forEach((alias) => addSpellPayloadAlias(lookup, payload, alias));
}

function extractAbilityDataFromRoot(raw, championName, pathName, ddSpells = []) {
  const pathIndex = new Map(Object.keys(raw || {}).map((key) => [normalizeCdragonRecordPath(key), key]));
  const rootCandidates = [
    `Characters/${championName}/CharacterRecords/Root`,
    `Characters/${pathName}/CharacterRecords/Root`,
  ];
  const rootPath = rootCandidates
    .map((candidate) => pathIndex.get(normalizeCdragonRecordPath(candidate)))
    .find(Boolean)
    || null;

  const root = rootPath ? raw[rootPath] : null;
  const abilities = Array.isArray(root?.mAbilities) ? root.mAbilities : [];
  if (!abilities.length) return null;

  const abilityByName = new Map();

  abilities.forEach((abilityPath) => {
    const abilityRecord = resolveCdragonRecord(raw, pathIndex, abilityPath);
    if (!abilityRecord) return;
    const thisName = normalizeSpellRecordName(abilityRecord?.mScriptName || abilityRecord?.mObjectPath || abilityRecord?.mName);
    if (thisName) abilityByName.set(thisName, abilityRecord);
  });

  const bySlot = {};
  const byRef = {};

  ddSpells.forEach((spell, idx) => {
    const slot = ["q", "w", "e", "r"][idx];
    if (!slot) return;

    const nameCandidates = [
      `Characters/${championName}/Spells/${spell?.name}Ability`,
      `Characters/${pathName}/Spells/${spell?.name}Ability`,
      `Characters/${championName}/Spells/${spell?.id}Ability`,
      `Characters/${pathName}/Spells/${spell?.id}Ability`,
      spell?.name,
      spell?.id,
    ].filter(Boolean);

    let abilityRecord = nameCandidates
      .map((candidate) => resolveCdragonRecord(raw, pathIndex, candidate))
      .find(Boolean)
      || null;

    if (!abilityRecord) {
      const normalizedCandidates = nameCandidates.map((candidate) => normalizeSpellRecordName(candidate));
      abilityRecord = normalizedCandidates
        .map((candidate) => abilityByName.get(candidate))
        .find(Boolean)
        || null;
    }

    const childSpells = Array.isArray(abilityRecord?.mChildSpells) ? abilityRecord.mChildSpells : [];
    if (!childSpells.length) return;

    let selectedChild = chooseBestSpellChild(raw, pathIndex, childSpells, spell, slot);
    if (!selectedChild?.parsed) {
      const fallbackChild = childSpells
        .map((path) => ({ path, record: resolveCdragonRecord(raw, pathIndex, path) }))
        .map((entry) => ({ ...entry, parsed: extractCdragonSpell(entry.record) }))
        .find((entry) => entry.parsed);
      selectedChild = fallbackChild || null;
    }

    const parsed = selectedChild?.parsed || null;
    if (!parsed) return;
    bySlot[slot] = parsed;

    const aliases = [
      slot,
      spell?.name,
      spell?.id,
      abilityRecord?.mScriptName,
      abilityRecord?.mObjectPath,
      abilityRecord?.mName,
      selectedChild?.record?.mScriptName,
      selectedChild?.record?.mObjectPath,
      selectedChild?.record?.mName,
      selectedChild?.path,
    ];
    buildSpellPayloadLookupEntry(byRef, parsed, aliases);
  });

  const passivePathCandidates = [
    `Characters/${championName}/Spells/${championName}PassiveAbility`,
    `Characters/${pathName}/Spells/${pathName}PassiveAbility`,
  ];
  const passiveRecord = passivePathCandidates
    .map((candidate) => resolveCdragonRecord(raw, pathIndex, candidate))
    .find(Boolean)
    || null;
  if (passiveRecord) {
    const childSpells = Array.isArray(passiveRecord?.mChildSpells) ? passiveRecord.mChildSpells : [];
    let selectedChild = chooseBestSpellChild(raw, pathIndex, childSpells, null, "p");
    if (!selectedChild?.parsed) {
      const primaryChild = resolveCdragonRecord(raw, pathIndex, childSpells[0]);
      selectedChild = { parsed: extractCdragonSpell(primaryChild), path: childSpells[0], record: primaryChild };
    }
    const parsed = selectedChild?.parsed || null;
    if (parsed) bySlot.p = parsed;

    if (parsed) {
      const aliases = [
        "p",
        "passive",
        `${championName}passive`,
        `${pathName}passive`,
        passiveRecord?.mScriptName,
        passiveRecord?.mObjectPath,
        passiveRecord?.mName,
        selectedChild?.record?.mScriptName,
        selectedChild?.record?.mObjectPath,
        selectedChild?.record?.mName,
        selectedChild?.path,
      ];
      buildSpellPayloadLookupEntry(byRef, parsed, aliases);
    }
  }

  if (!Object.keys(bySlot).length) return null;
  bySlot.byRef = byRef;
  return bySlot;
}

async function loadCdragonAbilityData(championName, ddSpells = []) {
  const pathName = normalizeCdragonChampionPath(championName);
  const url = `https://raw.communitydragon.org/latest/game/data/characters/${pathName}/${pathName}.bin.json`;
  const raw = await fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!raw) return null;

  return extractAbilityDataFromRoot(raw, championName, pathName, ddSpells)
    || null;
}

async function setChampion(name) {
  const details = await window.ApiClient.fetchChampionDetails(BUILDER.version, name);
  BUILDER.selectedChampion = name;
  BUILDER.championData = details.data[name];
  BUILDER.cdragonAbilityData = await loadCdragonAbilityData(name, BUILDER.championData?.spells || []);
  BUILDER.level = Number(document.getElementById("builderLevel").value) || 1;

  const splashUrl = `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg)`;
  const primaryRunePath = RUNE_DATA.paths[BUILDER.runeSelections.primaryPath]
    || RUNE_DATA.paths[Object.keys(RUNE_DATA.paths)[0]]
    || null;
  document.body.style.setProperty("--builder-splash-url", splashUrl);
  document.getElementById("runesCard").style.setProperty("--rune-splash-url", primaryRunePath?.splash || "none");
  document.getElementById("championPickerBtn").innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${BUILDER.championData.image.full}" alt="${name}">`;
  document.getElementById("championPickerBtn").setAttribute("aria-label", `Selected champion: ${name}`);

  enforceAbilityRules();
  renderAbilityCards();
  renderStats();
}

function renderItemSlots() {
  const root = document.getElementById("itemSlots");
  root.innerHTML = BUILDER.itemSlots.map((_, i) => `<button class="item-slot-btn" data-slot="${i}"><div id="slotText${i}" class="item-slot-empty">+</div></button>`).join("");
  refreshSlotLabels();
}

function refreshSlotLabels() {
  BUILDER.itemSlots.forEach((id, i) => {
    const root = document.getElementById(`slotText${i}`);
    if (!id) {
      root.className = "item-slot-empty";
      root.textContent = "+";
      return;
    }
    const item = BUILDER.items[id];
    root.className = "";
    root.innerHTML = `<img class="item-slot-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${id}.png" alt="${item.name}" title="${item.name}">`;
  });
}

function initItemModal() {
  renderBuilderTagFilters();
  document.getElementById("modalItemSearch").addEventListener("input", renderModalItemGrid);
  document.getElementById("itemModal").addEventListener("click", (event) => {
    if (event.target.id === "itemModal") closeItemModal();
  });
}

function clearModalFilters() {
  document.getElementById("modalItemSearch").value = "";
  document.querySelectorAll(".modal-tag").forEach((cb) => { cb.checked = false; });
  renderModalItemGrid();
}

function renderBuilderTagFilters() {
  const root = document.getElementById("modalItemFilters");
  root.innerHTML = Array.from(BUILDER.itemTags).sort((a, b) => a.localeCompare(b))
    .map((tag) => `<label class="tag-pill"><input type="checkbox" class="modal-tag" value="${tag}"> ${tag}</label>`).join("");
  root.querySelectorAll(".modal-tag").forEach((cb) => cb.addEventListener("change", renderModalItemGrid));
}

function openItemModal(slot) {
  BUILDER.activeSlot = slot;
  document.getElementById("itemModalTitle").textContent = "Select Item";
  document.getElementById("itemModal").classList.remove("hidden");
  renderModalItemGrid();
}

function closeItemModal() {
  document.getElementById("itemModal").classList.add("hidden");
  BUILDER.activeSlot = null;
}

function renderModalItemGrid() {
  const text = document.getElementById("modalItemSearch").value.trim().toLowerCase();
  const tags = new Set(Array.from(document.querySelectorAll(".modal-tag:checked")).map((cb) => cb.value));
  BUILDER.modalItemFiltered = Object.entries(BUILDER.items)
    .filter(([, item]) => (!text || item.name.toLowerCase().includes(text)) && (!tags.size || Array.from(tags).every((t) => item.tags?.includes(t))))
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([id]) => id);
  const ids = BUILDER.modalItemFiltered;
  document.getElementById("modalResultsCount").textContent = `${ids.length} items shown`;
  document.getElementById("modalItemGrid").innerHTML = ids
    .map((id) => `<button class="item-button-icon" data-item-id="${id}" title="${BUILDER.items[id].name}"><img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${id}.png" alt="${BUILDER.items[id].name}"></button>`)
    .join("");
  renderModalItemDetail(ids[0] || null);
}

function renderModalItemDetail(id) {
  const root = document.getElementById("modalItemDetail");
  if (!id) {
    root.innerHTML = "<p class='text-muted'>No items found.</p>";
    return;
  }
  const item = BUILDER.items[id];
  const statNameMap = {
    FlatHPPoolMod: "Health",
    FlatMPPoolMod: "Mana",
    FlatHPRegenMod: "HP/5",
    FlatMPRegenMod: "MP/5",
    PercentBaseHPRegenMod: "Base HP Regen %",
    PercentBaseMPRegenMod: "Base MP Regen %",
    FlatPhysicalDamageMod: "Attack Damage",
    FlatMagicDamageMod: "Ability Power",
    FlatArmorMod: "Armor",
    FlatSpellBlockMod: "Magic Resist",
    PercentAttackSpeedMod: "Attack Speed %",
    FlatMovementSpeedMod: "Move Speed",
    PercentMovementSpeedMod: "Move Speed %",
    FlatCritChanceMod: "Crit Chance",
    PercentCritChanceMod: "Crit Chance %",
    FlatCritDamageMod: "Crit Damage",
    PercentCritDamageMod: "Crit Damage %",
    FlatAttackRangeMod: "Attack Range",
    FlatHasteMod: "Ability Haste",
    FlatAbilityHasteMod: "Ability Haste",
    AbilityHaste: "Ability Haste",
  };
  const pctStats = new Set(["PercentBaseHPRegenMod", "PercentBaseMPRegenMod", "PercentAttackSpeedMod", "PercentMovementSpeedMod", "PercentCritChanceMod", "PercentCritDamageMod"]);
  const statBuckets = new Map();
  const aliasCanonical = {
    FlatAbilityHasteMod: "FlatHasteMod",
    AbilityHaste: "FlatHasteMod",
    PercentHPRegenMod: "PercentBaseHPRegenMod",
    PercentMPRegenMod: "PercentBaseMPRegenMod",
  };
  const seenCanonical = new Set();
  Object.entries(item.stats || {})
    .filter(([, v]) => Number(v) !== 0)
    .forEach(([k, v]) => {
      const canonical = aliasCanonical[k] || k;
      if (seenCanonical.has(canonical)) return;
      seenCanonical.add(canonical);
      const label = statNameMap[canonical] || statNameMap[k] || canonical;
      const isPct = pctStats.has(canonical) || pctStats.has(k);
      const bucketKey = `${label}::${isPct ? 'pct' : 'flat'}`;
      const current = statBuckets.get(bucketKey) || { label, isPct, value: 0 };
      current.value += Number(v) || 0;
      statBuckets.set(bucketKey, current);
    });
  const statLines = Array.from(statBuckets.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((row) => `<div>${row.label}: ${row.isPct ? `${(row.value * 100).toFixed(1)}%` : row.value}</div>`)
    .join("");
  const passiveLabels = extractPassiveLabelsFromText(stripHtml(item.description || ""));
  const passiveLines = passiveLabels.length
    ? `<div class='mt-10'><strong>Passives</strong>${passiveLabels.map((label) => `<div>${label}</div>`).join("")}</div>`
    : "";

  const resolvedDescription = resolveItemDescriptionHtml(item, id, { forModal: true });
  const enhancedDescription = resolvedDescription.html;
  const extractedFormulaRows = resolvedDescription.formulaRows.length
    ? `<div class='mt-10'><strong>Effects</strong>${resolvedDescription.formulaRows.map((line) => `<div>${line.name}: ${line.formula}</div>`).join("")}</div>`
    : "";

  root.innerHTML = `<h3>${item.name}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${id}.png' alt='${item.name}'><p><strong>Cost:</strong> ${item.gold?.total ?? 0}g</p><div>${statLines}</div>${passiveLines}${extractedFormulaRows}<div class='mt-10'>${enhancedDescription}</div><button class='btn btn-sm mt-10' data-set-item-id='${id}'>Select this item</button><button class='btn btn-sm mt-10 ml-5' data-set-item-id=''>Clear slot</button>`;
}

function setSlotItem(itemId) {
  if (BUILDER.activeSlot === null) return;
  BUILDER.itemSlots[BUILDER.activeSlot] = itemId;
  refreshSlotLabels();
  renderStats();
  renderAbilityCards();
  closeItemModal();
}

function abilityMaxByLevel(level, spellKey) {
  return window.AbilityRules.abilityMaxByLevel(level, spellKey);
}

function enforceAbilityRules() {
  BUILDER.abilityRanks = window.AbilityRules.enforceAbilityRules(BUILDER.level, BUILDER.abilityRanks);
}

function parseByRank(valueBurn, rank) {
  if (!rank) return "-";
  if (!valueBurn || valueBurn === "0") return "-";
  const parts = String(valueBurn).split("/");
  return parts[Math.max(0, Math.min(parts.length - 1, rank - 1))] || parts[0] || "-";
}

function extractPassiveLabelsFromText(text) {
  const labels = [];
  const re = /(?:UNIQUE\s+)?PASSIVE\s*(?:-|:)?\s*([A-Za-z0-9' ]+)?/gi;
  let match;
  while ((match = re.exec(text))) {
    const raw = String(match[1] || "").trim();
    labels.push(raw || "Passive");
  }
  return Array.from(new Set(labels));
}

/**
 * Resolves an item description using shared Item Lookup transformers so formulas/cooldowns are concrete.
 * @param {object} item Data Dragon item payload.
 * @param {string} itemId Numeric item id.
 * @param {object} options Resolution options.
 * @param {boolean} [options.forModal=false] Applies modal-only formatting helpers.
 * @returns {{html: string, formulaRows: {name: string, formula: string}[]}} Enhanced tooltip and extracted formulas.
 */
function resolveItemDescriptionHtml(item, itemId = "", options = {}) {
  const { forModal = false } = options;
  const shared = getItemLookupShared();
  let html = String(item?.description || "");
  if (!shared) return { html, formulaRows: [] };
  if (shared.resolveDescriptionFormulas) html = shared.resolveDescriptionFormulas(item, html);

  const formulaRows = shared.buildExtractedFormulas
    ? (shared.buildExtractedFormulas(String(itemId || ""))?.lines || [])
    : [];

  if (shared.injectDamageFormulaText) html = shared.injectDamageFormulaText(html, formulaRows, String(itemId || ""));
  if (shared.injectActiveCooldown) {
    const cd = shared.inferActiveCooldownSeconds ? shared.inferActiveCooldownSeconds(String(itemId || "")) : null;
    html = shared.injectActiveCooldown(html, cd);
  }
  if (forModal && shared.emphasizeAbilityHeaders) html = shared.emphasizeAbilityHeaders(html);
  if (shared.enhanceActiveTooltip) html = shared.enhanceActiveTooltip(html);
  if (forModal && shared.colorizeStatsInHtml) html = shared.colorizeStatsInHtml(html);
  return { html, formulaRows };
}

/**
 * Extracts passive/on-hit/unique sections from an item tooltip and returns display-ready rows.
 * @param {string} descriptionHtml Tooltip html.
 * @returns {{label: string, impact: string}[]} Passive rows.
 */
function extractPassiveDescriptionsFromHtml(descriptionHtml) {
  const html = String(descriptionHtml || "");
  if (!html) return [];

  const normalized = html.replace(/<br\s*\/?>/gi, "\n");
  const rows = [];
  const sectionRe = /<(passive|onhit|unique)>\s*([^<]*)\s*<\/\1>\s*([\s\S]*?)(?=<(?:passive|onhit|unique|active)>|$)/gi;
  let match;
  while ((match = sectionRe.exec(normalized))) {
    const type = String(match[1] || "").toUpperCase();
    const label = stripHtml(match[2] || "").trim() || type;
    const desc = stripHtml(match[3] || "").trim();
    if (!desc) continue;
    rows.push({ label, impact: desc });
  }

  if (rows.length) return rows;

  const fallback = stripHtml(html);
  const labelFallbacks = extractPassiveLabelsFromText(fallback);
  return labelFallbacks.map((label) => ({ label, impact: fallback }));
}

function buildPassiveLedger(itemTotals, runeTotals) {
  const selectedItems = BUILDER.itemSlots
    .filter((id) => id && BUILDER.items[id])
    .map((id) => ({ id: String(id), item: BUILDER.items[id] }));
  const passiveEffects = [];
  const additiveMods = { ad: 0, ap: 0 };
  let apMultiplier = 1;
  let hasRabadon = false;

  selectedItems.forEach(({ id, item }) => {
    const { html: resolvedDescriptionHtml } = resolveItemDescriptionHtml(item, id);
    extractPassiveDescriptionsFromHtml(resolvedDescriptionHtml).forEach(({ label, impact }) => {
      passiveEffects.push({ source: "Item", owner: item.name, label, impact });
    });

    if (id === "3089") {
      hasRabadon = true;
      apMultiplier *= 1.30;
      passiveEffects.push({ source: "Item", owner: item.name, label: "Magical Opus", impact: "AP multiplier queued (applied after additive passives)" });
    }

    if (id === "3042" && BUILDER.championData) {
      const b = BUILDER.championData.stats;
      const L = BUILDER.level;
      const totalMana = b.mp + b.mpperlevel * (L - 1) + itemTotals.mp + runeTotals.mp;
      const bonusAd = totalMana * 0.02;
      if (bonusAd > 0) {
        additiveMods.ad += bonusAd;
        passiveEffects.push({ source: "Item", owner: item.name, label: "Awe", impact: `+${bonusAd.toFixed(1)} AD (2% max mana)` });
      }
    }

    if (id === "3040" && BUILDER.championData) {
      const b = BUILDER.championData.stats;
      const L = BUILDER.level;
      const baseMana = b.mp + b.mpperlevel * (L - 1);
      const bonusMana = Math.max(0, itemTotals.mp + runeTotals.mp);
      const bonusAp = bonusMana * 0.02;
      if (bonusAp > 0) {
        additiveMods.ap += bonusAp;
        passiveEffects.push({ source: "Item", owner: item.name, label: "Awe", impact: `+${bonusAp.toFixed(1)} AP (2% bonus mana)` });
      }
      if (baseMana > 0) {
        passiveEffects.push({ source: "Item", owner: item.name, label: "Mana context", impact: `Base mana ${baseMana.toFixed(1)}` });
      }
    }
  });

  if (BUILDER.championData?.passive) {
    const champPassiveName = BUILDER.championData.passive.name || "Passive";
    passiveEffects.push({ source: "Champion", owner: BUILDER.selectedChampion, label: champPassiveName, impact: "Champion passive identified" });
  }

  const apBeforeMultiplier = itemTotals.ap + runeTotals.ap + additiveMods.ap;
  const apAmp = Math.max(0, apBeforeMultiplier * (apMultiplier - 1));
  const statMods = {
    ad: additiveMods.ad,
    ap: additiveMods.ap + apAmp,
  };

  if (hasRabadon && apAmp > 0) {
    passiveEffects.push({ source: "Item", owner: "Rabadon's Deathcap", label: "Magical Opus", impact: `+${apAmp.toFixed(1)} AP (multipliers applied last)` });
  }

  return { passiveEffects, statMods };
}

function computeDerivedBuildStats() {
  if (!BUILDER.championData) return null;
  const base = BUILDER.championData.stats;
  const item = getItemStats();
  const rune = getRuneStats();
  const L = BUILDER.level;

  const ledger = buildPassiveLedger(item, rune);
  const passiveAd = ledger.statMods.ad;
  const passiveAp = ledger.statMods.ap;

  const hp = (base.hp + base.hpperlevel * (L - 1) + item.hp + rune.hp);
  const baseHp5 = base.hpregen + base.hpregenperlevel * (L - 1);
  const hp5 = (baseHp5 * (1 + item.hp5PctBase / 100) + item.hp5 + rune.hp5);
  const mp = (base.mp + base.mpperlevel * (L - 1) + item.mp + rune.mp);
  const baseMp5 = base.mpregen + base.mpregenperlevel * (L - 1);
  const mp5 = (baseMp5 * (1 + item.mp5PctBase / 100) + item.mp5 + rune.mp5);
  const ad = (base.attackdamage + base.attackdamageperlevel * (L - 1) + item.ad + rune.ad + passiveAd);
  const ap = item.ap + rune.ap + passiveAp;
  const armor = (base.armor + base.armorperlevel * (L - 1) + item.armor + rune.armor);
  const mr = (base.spellblock + base.spellblockperlevel * (L - 1) + item.mr + rune.mr);
  const asTotal = base.attackspeed * (1 + (base.attackspeedperlevel * (L - 1)) / 100) * (1 + (item.asPct + rune.asPct) / 100);
  const abilityHaste = item.haste + rune.haste;
  const critChance = (base.crit + base.critperlevel * (L - 1) + item.critChance + rune.critChance);
  const critDamage = (base.critdamage ? base.critdamage * 100 : 175) + item.critDamage + rune.critDamage;
  const attackRange = (base.attackrange || 0) + item.attackRange + rune.attackRange;
  const moveSpeed = (base.movespeed + item.msFlat + rune.msFlat) * (1 + (item.msPct + rune.msPct) / 100);

  return {
    base,
    item,
    rune,
    level: L,
    hp,
    hp5,
    mp,
    mp5,
    ad,
    ap,
    armor,
    mr,
    asTotal,
    abilityHaste,
    critChance,
    critDamage,
    attackRange,
    moveSpeed,
    passiveLedger: ledger,
  };
}

function renderPassivePanel(passiveLedger) {
  const root = document.getElementById("passiveModalList");
  if (!root) return;
  if (!passiveLedger) {
    root.innerHTML = "<div class='ability-card'><p class='text-muted'>Select a champion to inspect passive effects.</p></div>";
    return;
  }
  const rows = passiveLedger.passiveEffects
    .map((effect) => `<div class='ability-card'><strong>${effect.source}: ${effect.owner}</strong><div>${effect.label}</div>${effect.impact ? `<div class='text-muted'>${effect.impact}</div>` : ""}</div>`)
    .join("");
  root.innerHTML = rows || "<div class='ability-card'><p class='text-muted'>No passive effects detected.</p></div>";
}

function togglePassivePanel() {
  document.getElementById("passiveModal").classList.remove("hidden");
  const computed = computeDerivedBuildStats();
  renderPassivePanel(computed?.passiveLedger || null);
}

function closePassiveModal() {
  document.getElementById("passiveModal").classList.add("hidden");
}

function getChampionPassiveRangeBonus() {
  if (!BUILDER.championData) return 0;
  if (BUILDER.selectedChampion === "Tristana") {
    return ((Number(BUILDER.level) || 1) - 1) * (136 / 17);
  }
  return 0;
}

/**
 * Computes auto-attack profile from derived stats and supported on-hit item passives.
 * @param {ReturnType<typeof computeDerivedBuildStats>} computed Derived build stats.
 * @returns {{autoAttackDamage:number,attackDps:number,attackRange:number,onHitRows:string[]}}
 */
function computeAutoAttackProfile(computed) {
  const item = computed.item;
  const ap = computed.ap;
  const baseOnHitRows = [];
  let onHitDamage = 0;

  BUILDER.itemSlots.forEach((id) => {
    if (!id) return;
    if (id === "3115") {
      const v = 15 + 0.2 * ap;
      onHitDamage += v;
      baseOnHitRows.push(`Nashor's Tooth ${v.toFixed(1)}`);
    }
    if (id === "3091") {
      const v = 45;
      onHitDamage += v;
      baseOnHitRows.push(`Wit's End ${v.toFixed(1)}`);
    }
    if (id === "3153") {
      const v = 30;
      onHitDamage += v;
      baseOnHitRows.push(`Blade of the Ruined King ${v.toFixed(1)}+HP%`);
    }
    if (id === "3100") {
      const v = 1.5 * computed.base.attackdamage;
      onHitDamage += v;
      baseOnHitRows.push(`Lich Bane ${v.toFixed(1)}`);
    }
  });

  const autoAttackDamage = computed.ad + onHitDamage;
  const attackDps = autoAttackDamage * computed.asTotal;
  const attackRange = computed.attackRange + getChampionPassiveRangeBonus();
  return { autoAttackDamage, attackDps, attackRange, onHitRows: baseOnHitRows };
}

function summarizePassiveNumericData(cdragonPassive) {
  const rows = (cdragonPassive?.dataValues || [])
    .map((d) => {
      const vals = (d.mValues || []).map((v) => Number(v) || 0).filter((v, i, arr) => Number.isFinite(v) && (v !== 0 || arr.every((x) => x === 0)));
      if (!vals.length) return null;
      const nonZero = vals.filter((v) => v !== 0);
      if (!nonZero.length) return null;
      const shown = vals.slice(0, 6).map((v) => (Number.isInteger(v) ? String(v) : v.toFixed(2))).join("/");
      const label = String(d.mName || "Value").replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
      return `${label}: ${shown}`;
    })
    .filter(Boolean)
    .slice(0, 3);
  return rows;
}

function buildDetailedPassiveText() {
  if (!BUILDER.championData?.passive) return "";
  const passive = BUILDER.championData.passive;
  const template = String(passive.description || "");
  const tokenRe = /{{\s*([^{}]+?)\s*}}/g;
  const cdragonPassive = BUILDER.cdragonAbilityData?.p || null;

  if (!cdragonPassive) return template;

  const dummySpell = { effectBurn: [], vars: [], costType: "" };
  const ctx = {
    spell: dummySpell,
    safeRank: 1,
    stats: getComputedChampionStatsForTooltips() || {
      ap: 0, totalAd: 0, bonusAd: 0, armor: 0, bonusArmor: 0, mr: 0, bonusMr: 0, hp: 0, bonusHp: 0, mp: 0, bonusMp: 0,
    },
    vars: [],
    cdragonSpell: cdragonPassive,
    calcLookup: cdragonPassive.calculations || {},
    knownTokens: {
      championlevel: Number(BUILDER.level) || 1,
    },
  };

  const resolved = template.replace(tokenRe, (full, tokenRaw) => {
    const resolved = resolveAbilityToken(tokenRaw, ctx);
    return resolved ? resolved.html : full;
  });

  const numericSummary = summarizePassiveNumericData(cdragonPassive);
  if (!numericSummary.length) return resolved;
  return `${resolved}<br><span class="ability-detail-eq">${numericSummary.join(" • ")}</span>`;
}

function getComputedChampionStatsForTooltips() {
  const computed = computeDerivedBuildStats();
  if (!computed) return null;
  const { base, item, rune, level: L, ad, ap, armor, mr, hp, mp } = computed;

  const baseAd = base.attackdamage + base.attackdamageperlevel * (L - 1);
  const totalAd = ad;
  const baseAp = 0;
  const totalAp = ap;
  const baseArmor = base.armor + base.armorperlevel * (L - 1);
  const totalArmor = armor;
  const baseMr = base.spellblock + base.spellblockperlevel * (L - 1);
  const totalMr = mr;
  const baseHp = base.hp + base.hpperlevel * (L - 1);
  const totalHp = hp;
  const baseMp = base.mp + base.mpperlevel * (L - 1);
  const totalMp = mp;

  return {
    ap: totalAp,
    totalAd,
    bonusAd: totalAd - baseAd,
    armor: totalArmor,
    bonusArmor: totalArmor - baseArmor,
    mr: totalMr,
    bonusMr: totalMr - baseMr,
    hp: totalHp,
    bonusHp: totalHp - baseHp,
    mp: totalMp,
    bonusMp: totalMp - baseMp,
  };
}

function getSpellScalingSource(link, stats) {
  const map = {
    spelldamage: { value: stats.ap, label: "AP" },
    bonusattackdamage: { value: stats.bonusAd, label: "bonus AD" },
    attackdamage: { value: stats.totalAd, label: "AD" },
    armor: { value: stats.armor, label: "Armor" },
    bonusarmor: { value: stats.bonusArmor, label: "bonus Armor" },
    spellblock: { value: stats.mr, label: "MR" },
    bonusspellblock: { value: stats.bonusMr, label: "bonus MR" },
    health: { value: stats.hp, label: "HP" },
    bonushealth: { value: stats.bonusHp, label: "bonus HP" },
    mana: { value: stats.mp, label: "Mana" },
    bonusmana: { value: stats.bonusMp, label: "bonus Mana" },
  };
  return map[String(link || "").toLowerCase()] || null;
}

function getRankedValueIndex(values, rank) {
  if (!Array.isArray(values) || !values.length) return 0;
  const clampedRank = Math.max(0, Number(rank) || 0);
  // CommunityDragon spell arrays commonly have a sentinel value at index 0 and real ranks at 1..N.
  if (values.length >= 7) {
    return Math.max(0, Math.min(values.length - 1, clampedRank));
  }
  return Math.max(0, Math.min(values.length - 1, clampedRank - 1));
}

function getSpellDataValue(dataValues, tokenName, rank) {
  const list = (dataValues || []).find((d) => String(d?.mName || "").toLowerCase() === String(tokenName || "").toLowerCase());
  if (!list || !Array.isArray(list.mValues) || !list.mValues.length) return null;
  const idx = getRankedValueIndex(list.mValues, rank);
  const current = Number(list.mValues[idx]) || 0;

  const rankValues = [];
  for (let i = 1; i <= 5; i += 1) {
    const ridx = getRankedValueIndex(list.mValues, i);
    rankValues.push(Number(list.mValues[ridx] || 0));
  }
  return { current, rankValues };
}

function getCalcStatSource(part, stats) {
  const dataValueName = String(part?.mDataValue || "").toLowerCase();
  if (dataValueName.includes("ap")) return { value: stats.ap, label: "AP" };
  if (dataValueName.includes("bonusad")) return { value: stats.bonusAd, label: "bonus AD" };
  if (dataValueName.includes("ad")) return { value: stats.totalAd, label: "AD" };
  if (dataValueName.includes("health")) return { value: stats.hp, label: "HP" };

  const statCode = Number(part?.mStat);
  if (statCode === 2) return { value: stats.totalAd, label: "AD" };
  if (statCode === 1 || statCode === 0 || Number.isNaN(statCode)) return { value: stats.ap, label: "AP" };
  return { value: stats.ap, label: `Stat ${statCode}` };
}

function formatAbilityStatLabel(label) {
  const m = {
    "bonus ad": "BonusAD",
    ad: "AD",
    ap: "AP",
    hp: "HP",
    mana: "Mana",
    armor: "Armor",
    "bonus armor": "BonusArmor",
    mr: "MR",
    "bonus mr": "BonusMR",
  };
  return m[String(label || "").toLowerCase()] || String(label || "Stat").replace(/\s+/g, "");
}

function formatAbilityNumber(value, isPercent = false) {
  const n = Number(value || 0);
  if (isPercent) return `${n.toFixed(1)}%`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatCalculationTerms(terms, fallbackValue = 0) {
  if (!Array.isArray(terms)) return formatAbilityNumber(fallbackValue);
  const joined = terms
    .map((row) => String(row?.text || "").trim())
    .filter(Boolean)
    .join(" + ");
  return joined || formatAbilityNumber(fallbackValue);
}

function makeMissingCalc(reason, fallbackValue = 0) {
  return { value: fallbackValue, text: `[calc-missing: ${reason}]`, missing: true };
}

function makeMissingGameCalculation(reason, displayAsPercent = false) {
  return {
    total: 0,
    terms: [{ text: `[calc-missing: ${reason}]`, value: 0, missing: true }],
    displayAsPercent: !!displayAsPercent,
  };
}

function hasNonEmptyCalculationReference(ref) {
  if (ref === null || typeof ref === "undefined") return false;
  if (typeof ref === "string") return ref.trim() !== "";
  return true;
}

function evaluateCalculationPart(part, dataValues, rank, stats, calculationsMap = null, seen = new Set(), tracePath = "part", displayAsPercent = false) {
  if (!part) return makeMissingCalc(`${tracePath} has no part payload`);
  const t = String(part?.__type || "");

  if (t === "NumberCalculationPart") {
    const val = Number(part?.mNumber || 0);
    return { value: val, text: formatAbilityNumber(val) };
  }
  if (t === "NamedDataValueCalculationPart") {
    
    const data = getSpellDataValue(dataValues, part?.mDataValue, rank);
    if (!data) return makeMissingCalc(`${tracePath} NamedDataValue ${part?.mDataValue || "<empty>"} not found`);
    return { value: data.current, text: formatAbilityNumber(data.current) };
  }
  if (t === "StatByCoefficientCalculationPart") {
    const src = getCalcStatSource(part, stats);
    const coeff = Number(part?.mCoefficient || 0);
    return { value: src.value * coeff, text: `${(coeff * 100).toFixed(0)}% ${formatAbilityStatLabel(src.label)}` };
  }
  if (t === "StatByNamedDataValueCalculationPart") {
    const src = getCalcStatSource(part, stats);
    const coeffData = getSpellDataValue(dataValues, part?.mDataValue, rank);
    const coeff = coeffData ? coeffData.current : null;
    if (coeff === null) return makeMissingCalc(`${tracePath} StatByNamedDataValue ${part?.mDataValue || "<empty>"} missing`);
    return { value: src.value * coeff, text: `${(coeff * 100).toFixed(0)}% ${formatAbilityStatLabel(src.label)}` };
  }
  if (t === "ByCharLevelBreakpointsCalculationPart") {
    const level = Math.max(1, Number(BUILDER.level) || 1);
    const base = Number(part?.mLevel1Value || 0);
    const bonus = (part?.mBreakpoints || []).reduce((acc, bp) => {
      if (level >= Number(bp?.mLevel || 1)) return acc + Number(bp?.mAdditionalBonusAtThisLevel || 0);
      return acc;
    }, 0);
    const value = base + bonus;
    return { value, text: formatAbilityNumber(value) };
  }

  const resolveReferencedGameCalculation = (ref) => {
    if (!hasNonEmptyCalculationReference(ref)) return makeMissingCalc(`${tracePath} has empty game calculation reference`);
    if (typeof ref === "object") {
      const evaluated = evaluateGameCalculation(ref, dataValues, rank, stats, calculationsMap, new Set(seen), `${tracePath}.inline`, displayAsPercent);
      if (!evaluated) return makeMissingCalc(`${tracePath} inline game calculation unresolved`);
      return { value: evaluated.total, text: formatCalculationTerms(evaluated.terms, evaluated.total) };
    }
    const key = String(ref || "");
    if (!calculationsMap || !key) return makeMissingCalc(`${tracePath} missing calculations map or key`);
    if (seen.has(key)) return makeMissingCalc(`${tracePath} circular reference ${key}`);
    const target = calculationsMap[key];
    if (!target) return makeMissingCalc(`${tracePath} referenced game calculation not found: ${key}`);
    const scopedSeen = new Set(seen);
    scopedSeen.add(key);
    const evaluated = evaluateGameCalculation(target, dataValues, rank, stats, calculationsMap, scopedSeen, `${tracePath}.ref(${key})`, displayAsPercent);
    if (!evaluated) return makeMissingCalc(`${tracePath} referenced game calculation unresolved: ${key}`);
    return { value: evaluated.total, text: formatCalculationTerms(evaluated.terms, evaluated.total) };
  };

  const evaluateChildren = () => {
    const out = [];
    const directArrayKeys = ["mSubparts", "mSubParts", "mParts", "mFormulaParts"];
    directArrayKeys.forEach((key) => {
      (part?.[key] || []).forEach((sub) => {
        const evaluated = evaluateCalculationPart(sub, dataValues, rank, stats, calculationsMap, seen, `${tracePath}.${key}`, displayAsPercent);
        if (evaluated) out.push(evaluated);
      });
    });

    const directPartKeys = ["mPart", "mPart1", "mPart2", "mPart3", "mPart4", "mPart5", "mMultiplier", "mAddend", "mRemainder", "mSubPart", "mSubPart1", "mSubPart2"];
    directPartKeys.forEach((key) => {
      const sub = part?.[key];
      if (!sub || typeof sub !== "object") return;
      const evaluated = evaluateCalculationPart(sub, dataValues, rank, stats, calculationsMap, seen, `${tracePath}.${key}`, displayAsPercent);
      if (evaluated) out.push(evaluated);
    });

    ["mGameCalculation", "mModifiedGameCalculation", "mDefaultGameCalculation", "mConditionalGameCalculation"].forEach((key) => {
      const ref = part?.[key];
      if (!hasNonEmptyCalculationReference(ref)) return;
      const evaluated = resolveReferencedGameCalculation(ref);
      if (evaluated) out.push(evaluated);
    });

    return out;
  };

  if (/SumOfSubParts/i.test(t)) {
    const parts = evaluateChildren();
    if (!parts.length) return makeMissingCalc(`${tracePath} had no resolvable parts`);
    return { value: parts.reduce((a, b) => a + b.value, 0), text: parts.map((p) => p.text).join(" + ") };
  }

  if (/ProductOfSubParts|Multiply|Multiplicative/i.test(t)) {
    const parts = evaluateChildren();
    if (!parts.length) return makeMissingCalc(`${tracePath} had no resolvable parts`);
    return { value: parts.reduce((acc, row) => acc * row.value, 1), text: parts.map((p) => p.text).join(" × ") };
  }

  if (/Difference|Subtract/i.test(t)) {
    const parts = evaluateChildren();
    if (!parts.length) return makeMissingCalc(`${tracePath} had no resolvable parts`);
    if (parts.length === 1) return parts[0];
    return { value: parts.slice(1).reduce((acc, row) => acc - row.value, parts[0].value), text: `${parts[0].text} - ${parts.slice(1).map((p) => p.text).join(" - ")}` };
  }

  if (/Ratio|Divide/i.test(t)) {
    const parts = evaluateChildren();
    if (parts.length < 2) return makeMissingCalc(`${tracePath} ${t} requires 2 parts`);
    if (parts[1].value === 0) return makeMissingCalc(`${tracePath} ${t} divider is zero`);
    return { value: parts[0].value / parts[1].value, text: `${parts[0].text} / ${parts[1].text}` };
  }

  if (/Clamp|Min|Max/i.test(t)) {
    const parts = evaluateChildren();
    if (!parts.length) return makeMissingCalc(`${tracePath} had no resolvable parts`);
    const head = parts[0].value;
    const floor = Number(part?.mFloor ?? part?.mMinimum ?? Number.NEGATIVE_INFINITY);
    const ceil = Number(part?.mCeiling ?? part?.mMaximum ?? Number.POSITIVE_INFINITY);
    const value = Math.min(Math.max(head, floor), ceil);
    return { value, text: formatAbilityNumber(value) };
  }

  if (typeof part?.mCoefficient === "number" || part?.mDataValue || typeof part?.mStat !== "undefined") {
    const src = getCalcStatSource(part, stats);
    const coeffData = part?.mDataValue ? getSpellDataValue(dataValues, part?.mDataValue, rank) : null;
    const coeffRaw = coeffData ? coeffData.current : Number(part?.mCoefficient || 0);
    if (coeffRaw !== 0) {
      return { value: src.value * coeffRaw, text: `${(coeffRaw * 100).toFixed(0)}% ${formatAbilityStatLabel(src.label)}` };
    }
    return makeMissingCalc(`${tracePath} has stat coefficient part with zero/empty coefficient`);
  }

  const fallbackReference = hasNonEmptyCalculationReference(part?.mGameCalculation)
    ? part.mGameCalculation
    : part?.mModifiedGameCalculation;
  const referencedGameCalc = hasNonEmptyCalculationReference(fallbackReference)
    ? resolveReferencedGameCalculation(fallbackReference)
    : null;
  if (referencedGameCalc) return referencedGameCalc;

  return makeMissingCalc(`${tracePath} unsupported part type: ${t || "<unknown>"}`);
}

function applyGameCalculationModifiers(calc, result, dataValues, rank, stats, calculationsMap = null, seen = new Set()) {
  if (!calc || !result) return result;

  const multiplier = hasNonEmptyCalculationReference(calc?.mMultiplier)
    ? evaluateCalculationPart(calc.mMultiplier, dataValues, rank, stats, calculationsMap, seen, "part", !!result.displayAsPercent)
    : null;
  if (multiplier && !multiplier.missing) {
    const multiplied = result.total * multiplier.value;
    result = {
      ...result,
      total: multiplied,
      terms: [{ text: `(${formatCalculationTerms(result.terms, result.total)}) × (${multiplier.text})`, value: multiplied }],
    };
  }

  const addend = hasNonEmptyCalculationReference(calc?.mAddend)
    ? evaluateCalculationPart(calc.mAddend, dataValues, rank, stats, calculationsMap, seen, "part", !!result.displayAsPercent)
    : null;
  if (addend && !addend.missing) {
    const added = result.total + addend.value;
    result = {
      ...result,
      total: added,
      terms: [{ text: `(${formatCalculationTerms(result.terms, result.total)}) + (${addend.text})`, value: added }],
    };
  }

  const subtrahend = hasNonEmptyCalculationReference(calc?.mSubtrahend)
    ? evaluateCalculationPart(calc.mSubtrahend, dataValues, rank, stats, calculationsMap, seen, "part", !!result.displayAsPercent)
    : null;
  if (subtrahend && !subtrahend.missing) {
    const subtracted = result.total - subtrahend.value;
    result = {
      ...result,
      total: subtracted,
      terms: [{ text: `(${formatCalculationTerms(result.terms, result.total)}) - (${subtrahend.text})`, value: subtracted }],
    };
  }

  const divider = hasNonEmptyCalculationReference(calc?.mDivider)
    ? evaluateCalculationPart(calc.mDivider, dataValues, rank, stats, calculationsMap, seen, "part", !!result.displayAsPercent)
    : null;
  if (divider && !divider.missing && divider.value !== 0) {
    const divided = result.total / divider.value;
    result = {
      ...result,
      total: divided,
      terms: [{ text: `(${formatCalculationTerms(result.terms, result.total)}) / (${divider.text})`, value: divided }],
    };
  }

  return result;
}

function evaluateGameCalculation(calc, dataValues, rank, stats, calculationsMap = null, seen = new Set(), tracePath = "calc", displayAsPercent = null) {
  if (!calc) return null;
  const ctype = String(calc.__type || "");
  const resolvedDisplayAsPercent = typeof displayAsPercent === "boolean" ? displayAsPercent : !!calc.mDisplayAsPercent;

  if (ctype === "GameCalculationModified") {
    if (!hasNonEmptyCalculationReference(calc?.mModifiedGameCalculation)) {
      return makeMissingGameCalculation(`${tracePath} missing modified game calculation reference`, resolvedDisplayAsPercent);
    }
    const key = String(calc.mModifiedGameCalculation || "");
    if (!calculationsMap || !key) return makeMissingGameCalculation(`${tracePath} missing calculations map or key`, resolvedDisplayAsPercent);
    if (seen.has(key)) return makeMissingGameCalculation(`${tracePath} circular reference ${key}`, resolvedDisplayAsPercent);
    seen.add(key);
    const base = evaluateGameCalculation(calculationsMap[key], dataValues, rank, stats, calculationsMap, seen, `${tracePath}.modified(${key})`, resolvedDisplayAsPercent);
    if (!base) return null;
    return applyGameCalculationModifiers(
      calc,
      {
        total: base.total,
        terms: base.terms,
        displayAsPercent: resolvedDisplayAsPercent,
      },
      dataValues,
      rank,
      stats,
      calculationsMap,
      seen,
    );
  }

  if (/Conditional/i.test(ctype)) {
    const conditionalParts = [
      calc.mConditionalGameCalculation,
      calc.mGameCalculation,
      calc.mDefaultGameCalculation,
      calc.mFallbackGameCalculation,
    ];
    for (const candidate of conditionalParts) {
      if (!hasNonEmptyCalculationReference(candidate)) continue;
      if (typeof candidate === "object") {
        const evaluated = evaluateGameCalculation(candidate, dataValues, rank, stats, calculationsMap, new Set(seen), `${tracePath}.conditional`, resolvedDisplayAsPercent);
        if (evaluated) return evaluated;
        continue;
      }
      const key = String(candidate || "");
      if (!calculationsMap || !key || seen.has(key) || !calculationsMap[key]) continue;
      const scopedSeen = new Set(seen);
      scopedSeen.add(key);
      const evaluated = evaluateGameCalculation(calculationsMap[key], dataValues, rank, stats, calculationsMap, scopedSeen, `${tracePath}.conditional(${key})`, resolvedDisplayAsPercent);
      if (evaluated) return evaluated;
    }
  }

  const formulaParts = Array.isArray(calc.mFormulaParts)
    ? calc.mFormulaParts
    : Array.isArray(calc.mFormula)
      ? calc.mFormula
      : null;
  if (!Array.isArray(formulaParts)) return makeMissingGameCalculation(`${tracePath} has no formula parts`, resolvedDisplayAsPercent);
  const parts = formulaParts
    .map((part, index) => evaluateCalculationPart(part, dataValues, rank, stats, calculationsMap, seen, `${tracePath}.part${index}`, resolvedDisplayAsPercent))
    .filter(Boolean);
  if (!parts.length) return makeMissingGameCalculation(`${tracePath} had no resolvable parts`, resolvedDisplayAsPercent);

  return applyGameCalculationModifiers(
    calc,
    {
      total: parts.reduce((a, b) => a + b.value, 0),
      terms: parts.map((p) => ({ text: p.text, value: p.value })),
      displayAsPercent: resolvedDisplayAsPercent,
    },
    dataValues,
    rank,
    stats,
    calculationsMap,
    seen,
  );
}

function normalizeCalcToken(token) {
  return canonicalizeToken(token);
}

function canonicalizeToken(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildCanonicalTokenMap(keys = []) {
  return keys.reduce((acc, key) => {
    const canonical = canonicalizeToken(key);
    if (!canonical || acc[canonical]) return acc;
    acc[canonical] = key;
    return acc;
  }, {});
}

function buildResolvedSpellPayload(rawPayload, safeRank, stats) {
  const payload = rawPayload || null;
  const calculations = payload?.calculations || {};
  const dataValues = payload?.dataValues || [];
  const calcLookup = Object.fromEntries(Object.entries(calculations).map(([k, calc]) => {
    const evaluated = stats ? evaluateGameCalculation(calc, dataValues, safeRank, stats, calculations) : null;
    return [String(k).toLowerCase(), evaluated];
  }));
  return {
    cdragonSpell: payload,
    calcLookup,
    calcLookupCanonicalMap: buildCanonicalTokenMap(Object.keys(calcLookup)),
    dataValueCanonicalMap: buildCanonicalTokenMap(dataValues.map((d) => String(d?.mName || "").toLowerCase())),
  };
}

function getDeterministicTokenCandidates(token) {
  const candidates = [];
  const seen = new Set();
  const add = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  const tryTrimEdge = (value) => {
    add(value);
    const effectAmountMatch = value.match(/^effect(\d+)amount$/);
    if (effectAmountMatch) add(`e${effectAmountMatch[1]}`);
    if (value.endsWith("_tooltip")) add(value.slice(0, -8));
    if (value.endsWith("tooltip")) add(value.slice(0, -7));

    ["base", "bonus", "total"].forEach((prefix) => {
      if (value.startsWith(prefix) && value.length > prefix.length) add(value.slice(prefix.length));
    });
    ["base", "bonus", "total", "value", "amount", "damage"].forEach((suffix) => {
      if (value.endsWith(suffix) && value.length > suffix.length) add(value.slice(0, -suffix.length));
    });
  };

  tryTrimEdge(String(token || "").trim().toLowerCase());
  return candidates;
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
    else {
      const strippedToken = normalizedToken.replace(/^(base|bonus|total)/, "").replace(/(damage|value|amount)$/g, "");
      const strippedKey = normalizedKey.replace(/^(base|bonus|total)/, "").replace(/(damage|value|amount)$/g, "");
      if (strippedKey && strippedToken && (strippedKey.includes(strippedToken) || strippedToken.includes(strippedKey))) {
        score = 300 - Math.abs(strippedKey.length - strippedToken.length);
      }
    }
    return { key, score };
  }).filter((row) => row.score >= 0).sort((a, b) => b.score - a.score);
  return scored.length ? scored[0].key : null;
}

function resolveAbilityToken(tokenRaw, ctx) {
  const token = String(tokenRaw || "").trim().toLowerCase();
  const denylist = new Set(["gamemodeinteger", "gamemodeinteger1", "gamemodeinteger2", "gamemodeinteger3"]);
  const multiplierMatchRegex = /^(?<left>[a-z0-9_:.]+)\*(?<mult>-?\d+(?:\.\d+)?)$/;

  const getQualifiedCtx = (spellRefRaw, localCtx) => {
    const normalizedRef = normalizeSpellRecordName(spellRefRaw);
    const canonicalRef = canonicalizeToken(normalizedRef);
    if (!canonicalRef) return null;

    const payload = localCtx.allSpellPayloadByRef?.[canonicalRef];
    if (!payload) return null;

    return {
      ...localCtx,
      cdragonSpell: payload.cdragonSpell,
      calcLookup: payload.calcLookup,
      calcLookupCanonicalMap: payload.calcLookupCanonicalMap,
      dataValueCanonicalMap: payload.dataValueCanonicalMap,
    };
  };

  const resolveSimple = (baseToken, localCtx = ctx) => {
    const candidates = getDeterministicTokenCandidates(baseToken);

    const resolveCalc = (lookupToken) => {
      if (denylist.has(canonicalizeToken(lookupToken))) return { html: "", numeric: null };

      let calc = localCtx.calcLookup[lookupToken];
      if (!calc) {
        const canonicalKey = localCtx.calcLookupCanonicalMap?.[canonicalizeToken(lookupToken)];
        if (canonicalKey) calc = localCtx.calcLookup[canonicalKey];
      }
      if (!calc) {
        const fuzzyKey = findBestCalcTokenMatch(localCtx.calcLookup || {}, lookupToken);
        if (fuzzyKey) calc = localCtx.calcLookup[fuzzyKey];
      }
      if (!calc) return null;

      const shown = calc.displayAsPercent ? (calc.total * 100) : calc.total;
      const eq = formatCalculationTerms(calc.terms, shown);
      return {
        html: `<span class="ability-detail-number">${formatAbilityNumber(shown, calc.displayAsPercent)} <span class="ability-detail-eq">(${eq})</span></span>`,
        numeric: shown,
      };
    };

    const resolveDataValue = (lookupToken) => {
      let dataValue = getSpellDataValue(localCtx.cdragonSpell?.dataValues || [], lookupToken, localCtx.safeRank);
      if (!dataValue) {
        const canonicalKey = localCtx.dataValueCanonicalMap?.[canonicalizeToken(lookupToken)];
        if (canonicalKey) dataValue = getSpellDataValue(localCtx.cdragonSpell?.dataValues || [], canonicalKey, localCtx.safeRank);
      }
      if (!dataValue) {
        const dv = (localCtx.cdragonSpell?.dataValues || []).map((d) => String(d?.mName || "").toLowerCase());
        const fuzzyDv = dv.find((k) => k.includes(lookupToken) || lookupToken.includes(k));
        if (fuzzyDv) dataValue = getSpellDataValue(localCtx.cdragonSpell?.dataValues || [], fuzzyDv, localCtx.safeRank);
      }
      if (!dataValue) return null;
      return {
        html: `<span class="ability-detail-number">${formatAbilityNumber(dataValue.current)}</span>`,
        numeric: dataValue.current,
      };
    };

    const resolveKnownToken = (lookupToken) => {
      let key = lookupToken;
      if (!Object.prototype.hasOwnProperty.call(localCtx.knownTokens, key)) {
        key = localCtx.knownTokenCanonicalMap?.[canonicalizeToken(lookupToken)] || key;
      }
      if (!Object.prototype.hasOwnProperty.call(localCtx.knownTokens, key)) return null;
      const v = localCtx.knownTokens[key];
      if (v === "" || v === "-") return { html: "", numeric: null };
      const parsed = Number(v);
      return {
        html: `<span class="ability-detail-number">${v}</span>`,
        numeric: Number.isFinite(parsed) ? parsed : null,
      };
    };

    for (const normalizedToken of candidates) {
      const calcResolved = resolveCalc(normalizedToken);
      if (calcResolved) return calcResolved;

      const dataResolved = resolveDataValue(normalizedToken);
      if (dataResolved) return dataResolved;

      const effectMatch = normalizedToken.match(/^e(\d+)$/);
      if (effectMatch) {
        const idx = Math.max(1, Number(effectMatch[1]));
        const arr = localCtx.spell.effect?.[idx] || [];
        if (!arr.length) continue;
        const rankIndex = Math.max(0, Math.min(arr.length - 1, localCtx.safeRank - 1));
        const current = Number(arr[rankIndex]) || 0;
        return {
          html: `<span class="ability-detail-number">${formatAbilityNumber(current)}</span>`,
          numeric: current,
        };
      }

      if (/^[af]\d+$/.test(normalizedToken) && localCtx.stats) {
        const v = localCtx.vars[normalizedToken];
        if (!v) continue;
        const source = getSpellScalingSource(v.link, localCtx.stats);
        if (!source) continue;
        const coeffRaw = Array.isArray(v.coeff) ? (v.coeff[getRankedValueIndex(v.coeff, localCtx.safeRank)] ?? v.coeff[0]) : v.coeff;
        const coeff = Number(coeffRaw || 0);
        const scaled = coeff * source.value;
        return {
          html: `<span class="ability-detail-number">${formatAbilityNumber(scaled)} <span class="ability-detail-eq">(${(coeff * 100).toFixed(0)}% ${formatAbilityStatLabel(source.label)})</span></span>`,
          numeric: scaled,
        };
      }

      const knownResolved = resolveKnownToken(normalizedToken);
      if (knownResolved) return knownResolved;
    }

    return null;
  };

  const isNextLevel = token.endsWith("nl");
  const baseToken = isNextLevel ? token.slice(0, -2) : token;
  const nextRank = Math.min(5, ctx.safeRank + 1);
  const simpleCtx = { ...ctx, safeRank: isNextLevel ? nextRank : ctx.safeRank };

  const resolveWithMath = (candidateToken, localCtx, fallbackCtx = localCtx) => {
    const multMatch = candidateToken.match(multiplierMatchRegex);
    if (multMatch?.groups?.left && multMatch?.groups?.mult) {
      const left = resolveToken(multMatch.groups.left, localCtx, fallbackCtx);
      if (!left || left.numeric === null) return null;
      const mult = Number(multMatch.groups.mult);
      const value = left.numeric * mult;
      return {
        html: `<span class="ability-detail-number">${formatAbilityNumber(value)}</span>`,
        numeric: value,
      };
    }

    return resolveSimple(candidateToken, localCtx);
  };

  const resolveToken = (candidateToken, localCtx, fallbackCtx = localCtx) => {
    const qualifiedTokenMatch = candidateToken.match(/^spell\.([^:]+):(.+)$/);
    if (qualifiedTokenMatch) {
      const qualifiedCtx = getQualifiedCtx(qualifiedTokenMatch[1], localCtx);
      const qualifiedBaseToken = String(qualifiedTokenMatch[2] || "").trim().toLowerCase();
      if (qualifiedCtx && qualifiedBaseToken) {
        const qualifiedResolved = resolveWithMath(qualifiedBaseToken, qualifiedCtx, fallbackCtx);
        if (qualifiedResolved) return qualifiedResolved;

        const fallbackResolved = resolveWithMath(qualifiedBaseToken, fallbackCtx, fallbackCtx);
        if (fallbackResolved) return fallbackResolved;
      }
      return null;
    }

    return resolveWithMath(candidateToken, localCtx, fallbackCtx);
  };

  const direct = resolveToken(baseToken, simpleCtx, simpleCtx);
  if (direct) return direct;

  return null;
}

function buildDetailedAbilityText(spell, rank, spellKey) {
  const raw = spell.tooltip || spell.description || "";
  const rawRank = Number(rank) || 0;
  
  if (rawRank <= 0) return spell.description || "";
  
  const safeRank = Math.max(1, rawRank);
  const stats = getComputedChampionStatsForTooltips();
  const vars = Object.fromEntries((spell.vars || []).map((v) => [String(v.key || "").toLowerCase(), v]));
  
  const cdragonSpell = BUILDER.cdragonAbilityData?.[spellKey] || null;
  const resolvedSpellPayload = buildResolvedSpellPayload(cdragonSpell, safeRank, stats);
  const calcLookup = resolvedSpellPayload.calcLookup;

  const toCamelCase = (value) => String(value || "").replace(/[_-]+([a-z0-9])/gi, (_, chr) => chr.toUpperCase());
  const getSpellRankValue = (rawValue) => {
    if (rawValue === null || rawValue === undefined) return "-";
    if (typeof rawValue === "string") {
      if (rawValue.includes("/")) return parseByRank(rawValue, safeRank);
      return rawValue || "-";
    }
    if (Array.isArray(rawValue)) {
      if (!rawValue.length) return "-";
      const idx = Math.max(0, Math.min(rawValue.length - 1, safeRank - 1));
      const picked = rawValue[idx] ?? rawValue[0];
      return picked === null || picked === undefined || picked === "" ? "-" : String(picked);
    }
    const numeric = Number(rawValue);
    if (Number.isFinite(numeric)) return String(rawValue);
    return String(rawValue || "-");
  };
  const getSpellTokenValue = (baseToken) => {
    const token = String(baseToken || "").toLowerCase();
    const camel = toCamelCase(token);
    const candidateKeys = [
      token,
      `${token}burn`,
      camel,
      `${camel}Burn`,
    ];
    for (const key of candidateKeys) {
      if (!Object.prototype.hasOwnProperty.call(spell, key)) continue;
      const resolved = getSpellRankValue(spell[key]);
      if (resolved !== "-") return resolved;
    }
    return "-";
  };
  const nearbyAmmoTokens = Object.fromEntries(
    Object.keys(spell || {})
      .filter((tokenKey) => /(ammo|recharge|stock)/i.test(String(tokenKey || "")))
      .map((tokenKey) => [String(tokenKey || "").toLowerCase(), getSpellRankValue(spell[tokenKey])])
      .filter(([, tokenValue]) => tokenValue !== "-")
  );

  const knownTokens = {
    cost: parseByRank(spell.costBurn, safeRank),
    cooldown: parseByRank(spell.cooldownBurn, safeRank),
    range: parseByRank(spell.rangeBurn, safeRank),
    maxammo: getSpellTokenValue("maxammo"),
    ammorechargetime: getSpellTokenValue("ammorechargetime"),
    abilityresourcename: (spell.costType || "").replace(/<[^>]+>/g, "").replace(/[{}`]/g, "").trim() || "Mana",
    spellmodifierdescriptionappend: "",
    ...nearbyAmmoTokens,
  };

  const calcLookupCanonicalMap = resolvedSpellPayload.calcLookupCanonicalMap;
  const dataValueCanonicalMap = resolvedSpellPayload.dataValueCanonicalMap;
  const knownTokenCanonicalMap = buildCanonicalTokenMap(Object.keys(knownTokens));

  const allSpellPayloadByRef = Object.entries(BUILDER.cdragonAbilityData?.byRef || {}).reduce((acc, [refKey, payload]) => {
    acc[refKey] = buildResolvedSpellPayload(payload, safeRank, stats);
    return acc;
  }, {});

  const ctx = {
    spell,
    safeRank,
    stats,
    vars,
    cdragonSpell: resolvedSpellPayload.cdragonSpell,
    calcLookup,
    knownTokens,
    calcLookupCanonicalMap,
    dataValueCanonicalMap,
    knownTokenCanonicalMap,
    allSpellPayloadByRef,
  };
  const replaced = raw.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full, tokenRaw) => {
    const resolved = resolveAbilityToken(tokenRaw, ctx);
    if (resolved) return resolved.html;
    return `<span class="ability-detail-missing">[token-missing: ${String(tokenRaw || "").trim()}]</span>`;
  });

  return replaced
    .replace(/<physicalDamage>/gi, '<span class="ability-damage-physical">')
    .replace(/<\/physicalDamage>/gi, '</span>')
    .replace(/<magicDamage>/gi, '<span class="ability-damage-magic">')
    .replace(/<\/magicDamage>/gi, '</span>')
    .replace(/<trueDamage>/gi, '<span class="ability-damage-true">')
    .replace(/<\/trueDamage>/gi, '</span>')
    .replace(/<healing>/gi, '<span class="ability-healing">')
    .replace(/<\/healing>/gi, '</span>')
    .replace(/<status>/gi, '<span class="ability-status">')
    .replace(/<\/status>/gi, '</span>')
    .replace(/[{}]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function renderAbilityCards() {
  const root = document.getElementById("abilityCards");
  if (!BUILDER.championData) {
    root.innerHTML = "<div class='ability-card'><p class='text-muted'>Select a champion to view abilities.</p></div>";
    document.getElementById("abilityRuleHint").textContent = "";
    return;
  }

  const champ = BUILDER.championData;
  const computed = computeDerivedBuildStats();
  const attack = computed ? computeAutoAttackProfile(computed) : null;
  const passiveText = buildDetailedPassiveText();
  const passive = `<div class="ability-card ability-passive-card"><div class="ability-head"><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/passive/${champ.passive.image.full}" alt="${champ.passive.name}"><strong>Passive - ${champ.passive.name}</strong></div><p class="ability-detail-text">${passiveText}</p></div>`;
  const attackCard = `<div class="ability-card ability-attack-card"><div class="ability-head"><strong>Attack</strong></div>
  <div><strong>Auto-Attack Damage:</strong> ${attack ? `${attack.autoAttackDamage.toFixed(1)} (${computed.ad.toFixed(1)}${attack.onHitRows.map((r) => ` + ${r}`).join("") || ""})` : "-"}</div>
  <div><strong>Attack DPS:</strong> ${attack ? `${attack.attackDps.toFixed(1)} (${attack.autoAttackDamage.toFixed(1)} × ${computed.asTotal.toFixed(3)})` : "-"}</div>
  <div><strong>Attack Range:</strong> ${attack ? attack.attackRange.toFixed(1) : "-"}</div></div>`;
  const abilityHaste = getItemStats().haste + getRuneStats().haste;
  const cooldownReductionPct = abilityHaste > 0 ? (abilityHaste / (abilityHaste + 100)) : 0;

  const spells = champ.spells.map((spell, i) => {
    const key = ["q", "w", "e", "r"][i];
    const max = abilityMaxByLevel(BUILDER.level, key);
    const opts = Array.from({ length: max + 1 }, (_, idx) => `<option value="${idx}">${idx}</option>`).join("");
    const rank = BUILDER.abilityRanks[key];
    const cdBase = parseByRank(spell.cooldownBurn, rank);
    const cdNumeric = Number(cdBase);
    const cd = Number.isFinite(cdNumeric) && cdNumeric > 0
      ? `${(cdNumeric * (1 - cooldownReductionPct)).toFixed(2)} (base ${cdNumeric.toFixed(2)})`
      : cdBase;
    const cost = parseByRank(spell.costBurn, rank);
    const range = parseByRank(spell.rangeBurn, rank);
    const detail = buildDetailedAbilityText(spell, rank, key);
    return `<div class="ability-card"><div class="ability-head"><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/spell/${spell.image.full}" alt="${spell.name}"><strong>${key.toUpperCase()} - ${spell.name}</strong></div><div class="ability-rank-row"><label class="label">Rank<select class="form-control" id="rank_${key}">${opts}</select></label></div><p class="ability-detail-text">${detail}</p><div><strong>Cooldown:</strong> ${cd}</div><div><strong>Cost:</strong> ${cost}</div><div><strong>Range:</strong> ${range}</div></div>`;
  }).join("");

  root.innerHTML = passive + attackCard + spells;
  ["q", "w", "e", "r"].forEach((k) => {
    const el = document.getElementById(`rank_${k}`);
    if (!el) return;
    el.value = String(BUILDER.abilityRanks[k]);
    el.addEventListener("change", () => {
      BUILDER.abilityRanks[k] = Number(el.value);
      enforceAbilityRules();
      renderAbilityCards();
    });
  });
  document.getElementById("abilityRuleHint").textContent = `At level ${BUILDER.level}: basic max ${abilityMaxByLevel(BUILDER.level, "q")}, R max ${abilityMaxByLevel(BUILDER.level, "r")}, total points ${BUILDER.level}.`;
}

function getItemStats() {
  const totals = {
    hp: 0, hp5: 0, hp5PctBase: 0, mp: 0, mp5: 0, mp5PctBase: 0, ad: 0, ap: 0, armor: 0, mr: 0,
    haste: 0, asPct: 0, critChance: 0, critDamage: 0, attackRange: 0, msFlat: 0, msPct: 0,
    arPenFlat: 0, arPenPct: 0, mrPenFlat: 0, mrPenPct: 0, physicalVamp: 0, omniVamp: 0, tenacity: 0,
  };
  BUILDER.itemSlots.forEach((id) => {
    if (!id) return;
    const s = BUILDER.items[id].stats || {};
    totals.hp += s.FlatHPPoolMod || 0;
    totals.mp += s.FlatMPPoolMod || 0;
    totals.hp5 += s.FlatHPRegenMod || 0;
    totals.hp5PctBase += ((s.PercentBaseHPRegenMod || s.PercentHPRegenMod || 0) * 100);
    totals.mp5 += s.FlatMPRegenMod || 0;
    totals.mp5PctBase += ((s.PercentBaseMPRegenMod || s.PercentMPRegenMod || 0) * 100);
    totals.ad += s.FlatPhysicalDamageMod || 0;
    totals.ap += s.FlatMagicDamageMod || 0;
    totals.armor += s.FlatArmorMod || 0;
    totals.mr += s.FlatSpellBlockMod || 0;
    totals.haste += Number(
      s.FlatHasteMod
      ?? s.FlatAbilityHasteMod
      ?? s.AbilityHaste
      ?? s.FlatCooldownReduction
      ?? 0,
    );
    totals.asPct += (s.PercentAttackSpeedMod || 0) * 100;
    totals.critChance += ((s.FlatCritChanceMod || 0) + (s.PercentCritChanceMod || 0)) * 100;
    totals.critDamage += ((s.FlatCritDamageMod || 0) + (s.PercentCritDamageMod || 0)) * 100;
    totals.attackRange += s.FlatAttackRangeMod || 0;
    totals.msFlat += s.FlatMovementSpeedMod || 0;
    totals.msPct += (s.PercentMovementSpeedMod || 0) * 100;
    totals.arPenFlat += s.FlatLethalityMod || 0;
    totals.arPenPct += (s.PercentArmorPenetrationMod || 0) * 100;
    totals.mrPenFlat += s.FlatMagicPenetrationMod || 0;
    totals.mrPenPct += (s.PercentMagicPenetrationMod || 0) * 100;
    totals.physicalVamp += ((s.PercentPhysicalVampMod || 0) + (s.PercentLifeStealMod || 0)) * 100;
    totals.omniVamp += (s.PercentOmnivampMod || 0) * 100;
    totals.tenacity += (s.PercentTenacityMod || 0) * 100;
  });
  return totals;
}

function getRuneStats() {
  const totals = {
    hp: 0, hp5: 0, hp5PctBase: 0, mp: 0, mp5: 0, mp5PctBase: 0, ad: 0, ap: 0, armor: 0, mr: 0,
    haste: 0, asPct: 0, critChance: 0, critDamage: 0, attackRange: 0, msFlat: 0, msPct: 0,
    arPenFlat: 0, arPenPct: 0, mrPenFlat: 0, mrPenPct: 0, physicalVamp: 0, omniVamp: 0, tenacity: 0,
  };
  const selected = [
    ...BUILDER.runeSelections.primary,
    ...BUILDER.runeSelections.secondary,
    ...BUILDER.runeSelections.shards,
  ];

  selected.forEach((runeId) => {
    if (runeId === "ability-haste") totals.haste += 8;
    if (runeId === "attack-speed") totals.asPct += 10;
    if (runeId === "scaling-health") totals.hp += 10 + ((BUILDER.level - 1) * 190) / 17;
    if (runeId === "health") totals.hp += 65;
    if (runeId === "move-speed") totals.msPct += 2.5;
    if (runeId === "tenacity-slow-resist") totals.tenacity += 15;
    if (runeId === "armor") totals.armor += 6;
    if (runeId === "magic-resist") totals.mr += 10;

    if (runeId === "adaptive-force") {
      if (isApAdaptiveChampion()) totals.ap += 9;
      else totals.ad += 9 * 0.6;
    }

    // Sorcery: +5 Ability Haste at level 5 and again at level 8.
    if (runeId === "transcendence") {
      if (BUILDER.level >= 5) totals.haste += 5;
      if (BUILDER.level >= 8) totals.haste += 5;
    }
  });

  return totals;
}

function renderStats() {
  const root = document.getElementById("statsTable");
  const emptyRows = [
    { name: "HP", icon: "❤️" },
    { name: "MP", icon: "🔷" },
    { name: "HP/5", icon: "💚" },
    { name: "MP/5", icon: "💙" },
    { name: "AD", icon: "🗡️" },
    { name: "AP", icon: "✨" },
    { name: "Range", icon: "🏹" },
    { name: "AH", icon: "⏱️" },
    { name: "Arm", icon: "🛡️" },
    { name: "MR", icon: "🔮" },
    { name: "AS", icon: "⚡" },
    { name: "MS", icon: "👟" },
    { name: "Crit %", icon: "🎯" },
    { name: "Crit Dmg", icon: "💥" },
    { name: "ARPen", icon: "🪓" },
    { name: "MRPen", icon: "🔹" },
    { name: "Lifesteal", icon: "🩸" },
    { name: "Tenacity", icon: "🦶" },
  ];
  const renderPairedRows = (rows) => {
    const pairRows = [];
    for (let i = 0; i < rows.length; i += 2) {
      pairRows.push([rows[i], rows[i + 1] || null]);
    }
    return `<table class="stats-table">${pairRows.map(([left, right]) => `<tr><td class="stats-label"><span class="stat-icon">${left.icon}</span>${left.name}</td><td class="stats-value" title="${left.eq || ''}">${left.displayValue}</td>${right ? `<td class="stats-label"><span class="stat-icon">${right.icon}</span>${right.name}</td><td class="stats-value" title="${right.eq || ''}">${right.displayValue}</td>` : '<td class="stats-label"></td><td class="stats-value"></td>'}</tr>`).join("")}</table>`;
  };

  if (!BUILDER.championData) {
    root.innerHTML = renderPairedRows(emptyRows.map((row) => ({ ...row, displayValue: "--" })));
    renderPassivePanel(null);
    return;
  }

  const computed = computeDerivedBuildStats();
  if (!computed) return;
  const {
    base, item, rune, level: L,
    hp, hp5, mp, mp5, ad, ap, armor, mr,
    asTotal, abilityHaste, critChance, critDamage, attackRange, moveSpeed,
    passiveLedger,
  } = computed;

  const rows = [
    { name: "HP", icon: "❤️", value: hp, eq: `${base.hp.toFixed(1)} + ${base.hpperlevel.toFixed(1)}*${L - 1} + ${item.hp.toFixed(1)} + ${rune.hp.toFixed(1)}` },
    { name: "MP", icon: "🔷", value: mp, eq: `${base.mp.toFixed(1)} + ${base.mpperlevel.toFixed(1)}*${L - 1} + ${item.mp.toFixed(1)} + ${rune.mp.toFixed(1)}` },
    { name: "HP/5", icon: "💚", value: hp5, eq: `(${base.hpregen.toFixed(1)} + ${base.hpregenperlevel.toFixed(2)}*${L - 1}) * (1 + ${item.hp5PctBase.toFixed(1)}%) + ${item.hp5.toFixed(1)} + ${rune.hp5.toFixed(1)}` },
    { name: "MP/5", icon: "💙", value: mp5, eq: `(${base.mpregen.toFixed(1)} + ${base.mpregenperlevel.toFixed(2)}*${L - 1}) * (1 + ${item.mp5PctBase.toFixed(1)}%) + ${item.mp5.toFixed(1)} + ${rune.mp5.toFixed(1)}` },
    { name: "AD", icon: "🗡️", value: ad, eq: `${base.attackdamage.toFixed(1)} + ${base.attackdamageperlevel.toFixed(1)}*${L - 1} + ${item.ad.toFixed(1)} + ${rune.ad.toFixed(1)} + passive(${passiveLedger.statMods.ad.toFixed(1)})` },
    { name: "AP", icon: "✨", value: ap, eq: `0 + ${item.ap.toFixed(1)} + ${rune.ap.toFixed(1)} + passive(${passiveLedger.statMods.ap.toFixed(1)})` },
    { name: "Range", icon: "🏹", value: attackRange, eq: `${(base.attackrange || 0).toFixed(1)} + ${item.attackRange.toFixed(1)} + ${rune.attackRange.toFixed(1)}` },
    { name: "AH", icon: "⏱️", value: abilityHaste, eq: `0 + ${item.haste.toFixed(1)} + ${rune.haste.toFixed(1)}` },
    { name: "Arm", icon: "🛡️", value: armor, eq: `${base.armor.toFixed(1)} + ${base.armorperlevel.toFixed(1)}*${L - 1} + ${item.armor.toFixed(1)} + ${rune.armor.toFixed(1)}` },
    { name: "MR", icon: "🔮", value: mr, eq: `${base.spellblock.toFixed(1)} + ${base.spellblockperlevel.toFixed(1)}*${L - 1} + ${item.mr.toFixed(1)} + ${rune.mr.toFixed(1)}` },
    { name: "AS", icon: "⚡", value: asTotal, eq: `${base.attackspeed.toFixed(3)} * level mult * (1 + ${(item.asPct + rune.asPct).toFixed(1)}%)` },
    { name: "MS", icon: "👟", value: moveSpeed, eq: `(${base.movespeed.toFixed(1)} + ${item.msFlat.toFixed(1)} + ${rune.msFlat.toFixed(1)}) * (1 + ${(item.msPct + rune.msPct).toFixed(1)}%)` },
    { name: "Crit %", icon: "🎯", value: critChance, eq: `${base.crit.toFixed(1)} + ${base.critperlevel.toFixed(1)}*${L - 1} + ${item.critChance.toFixed(1)} + ${rune.critChance.toFixed(1)}` },
    { name: "Crit Dmg", icon: "💥", value: critDamage, eq: `${(base.critdamage ? base.critdamage * 100 : 175).toFixed(1)} + ${item.critDamage.toFixed(1)} + ${rune.critDamage.toFixed(1)}` },
    { name: "ARPen", icon: "🪓", value: 0, eq: `${item.arPenFlat.toFixed(1)} / ${item.arPenPct.toFixed(1)}%` },
    { name: "MRPen", icon: "🔹", value: 0, eq: `${item.mrPenFlat.toFixed(1)} / ${item.mrPenPct.toFixed(1)}%` },
    { name: "Lifesteal", icon: "🩸", value: 0, eq: `${item.physicalVamp.toFixed(1)}% / ${item.omniVamp.toFixed(1)}%` },
    { name: "Tenacity", icon: "🦶", value: 0, eq: `${item.tenacity.toFixed(1)}%` },
  ];

  const tableHtml = renderPairedRows(rows.map((row) => {
    if (row.name === "ARPen") return { ...row, displayValue: `${item.arPenFlat.toFixed(1)}/${item.arPenPct.toFixed(1)}%` };
    if (row.name === "MRPen") return { ...row, displayValue: `${item.mrPenFlat.toFixed(1)}/${item.mrPenPct.toFixed(1)}%` };
    if (row.name === "Lifesteal") return { ...row, displayValue: `${item.physicalVamp.toFixed(1)}%/${item.omniVamp.toFixed(1)}%` };
    if (row.name === "Tenacity") return { ...row, displayValue: `${item.tenacity.toFixed(1)}%` };
    return {
      ...row,
      displayValue: row.value.toFixed(row.name === "AS" ? 3 : 1),
    };
  }));

  root.innerHTML = tableHtml;
  renderPassivePanel(passiveLedger);
}

function renderRunePanel() {
  const root = document.getElementById("runePanel");
  const pathIds = Object.keys(RUNE_DATA.paths);
  const fallbackPrimaryPathId = pathIds[0] || "";
  const primaryPathId = RUNE_DATA.paths[BUILDER.runeSelections.primaryPath] ? BUILDER.runeSelections.primaryPath : fallbackPrimaryPathId;
  const fallbackSecondaryPathId = pathIds.find((id) => id !== primaryPathId) || primaryPathId;
  const secondaryPathId = (BUILDER.runeSelections.secondaryPath !== primaryPathId && RUNE_DATA.paths[BUILDER.runeSelections.secondaryPath])
    ? BUILDER.runeSelections.secondaryPath
    : fallbackSecondaryPathId;
  BUILDER.runeSelections.primaryPath = primaryPathId;
  BUILDER.runeSelections.secondaryPath = secondaryPathId;
  const primaryPath = RUNE_DATA.paths[primaryPathId] || null;
  const secondaryPath = RUNE_DATA.paths[secondaryPathId] || null;
  if (!primaryPath || !secondaryPath) {
    root.innerHTML = "<p class='muted'>Rune data is unavailable.</p>";
    document.getElementById("runesCard").style.setProperty("--rune-splash-url", "none");
    return;
  }
  document.getElementById("runesCard").style.setProperty("--rune-splash-url", primaryPath.splash || "none");

  const renderSlot = (id, label, target) => {
    const rune = getRuneMeta(id);
    return `<div class="rune-slot-row"><button class="rune-slot-btn" data-rune-target="${target}">${runeImgTag(rune)}</button><div class="rune-slot-label"><span class='rune-slot-kicker'>${label}</span><strong>${rune.name}</strong></div></div>`;
  };
  const renderShardIcon = (slotIndex) => {
    const rune = getRuneMeta(BUILDER.runeSelections.shards[slotIndex]);
    return `<button class="rune-shard-icon-btn" data-rune-target="shard_${slotIndex}" type="button">${runeImgTag(rune)}<span class="rune-secondary-hover-desc">${rune.desc || rune.name}</span></button>`;
  };
  const renderSecondaryGrid = () => {
    const rows = getSecondaryRows(BUILDER.runeSelections.secondaryPath);
    const selected = new Set(BUILDER.runeSelections.secondary);
    return rows
      .flat()
      .map((runeId) => {
        const rune = getRuneMeta(runeId);
        const isSelected = selected.has(runeId);
        return `<button class="rune-secondary-cell ${isSelected ? "is-selected" : ""}" data-secondary-rune-id="${runeId}" type="button">${runeImgTag(rune)}<span class="rune-secondary-hover-desc">${rune.desc || rune.name}</span></button>`;
      })
      .join("");
  };

  const escapeAttr = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;");

  const renderPrimaryRuneGrid = () => {
    const rows = primaryPath.primaryRows || [];
    return `<div class="rune-subpanel-grid rune-subpanel-grid-primary">${rows.map((row, rowIndex) => row.map((runeId) => {
      const rune = getRuneMeta(runeId);
      const active = BUILDER.runeSelections.primary[rowIndex] === runeId ? "is-active" : "";
      return `<button class="rune-grid-btn ${active}" data-rune-choice-target="primary_${rowIndex}" data-rune-choice-id="${runeId}" data-desc="${escapeAttr(`${rune.name}: ${rune.desc}`)}" aria-label="${rune.name}">${runeImgTag(rune)}</button>`;
    }).join("")).join("")}</div>`;
  };

  const getSecondaryChoiceTarget = (runeId) => {
    const row = getSecondaryRowIndex(BUILDER.runeSelections.secondaryPath, runeId);
    const [first, second] = BUILDER.runeSelections.secondary;
    if (runeId === first) return "secondary_0";
    if (runeId === second) return "secondary_1";
    const firstRow = getSecondaryRowIndex(BUILDER.runeSelections.secondaryPath, first);
    const secondRow = getSecondaryRowIndex(BUILDER.runeSelections.secondaryPath, second);
    if (row === firstRow) return "secondary_1";
    if (row === secondRow) return "secondary_0";
    return "secondary_0";
  };

  const renderSecondaryRuneGrid = () => {
    const rows = getSecondaryRows(BUILDER.runeSelections.secondaryPath);
    const selected = new Set(BUILDER.runeSelections.secondary);
    return `<div class="rune-subpanel-grid">${rows.map((row) => row.map((runeId) => {
      const rune = getRuneMeta(runeId);
      const active = selected.has(runeId) ? "is-active" : "";
      return `<button class="rune-grid-btn ${active}" data-rune-choice-target="${getSecondaryChoiceTarget(runeId)}" data-rune-choice-id="${runeId}" data-desc="${escapeAttr(`${rune.name}: ${rune.desc}`)}" aria-label="${rune.name}">${runeImgTag(rune)}</button>`;
    }).join("")).join("")}</div>`;
  };

  ensureSecondarySelectionsValid();

  root.innerHTML = `
    <div class="rune-column-block">
      <div class="rune-column-title"><button class='btn btn-sm rune-path-btn' data-rune-target="primaryPath_0"><img src="${primaryPath.icon}" alt="${primaryPath.name}"><span>${primaryPath.name}</span></button></div>
      ${renderPrimaryRuneGrid()}
    </div>
    <div class="rune-column-block">
      <div class="rune-column-title"><button class='btn btn-sm rune-path-btn' data-rune-target="secondaryPath_0"><img src="${secondaryPath.icon}" alt="${secondaryPath.name}"><span>${secondaryPath.name}</span></button></div>
      ${renderSecondaryRuneGrid()}
      <div class="rune-shard-row-wrap">
        <div class='rune-subsection-title rune-subsection-title-shards'>Stat Shards</div>
        <div class="rune-shard-icon-row">${renderShardIcon(0)}${renderShardIcon(1)}${renderShardIcon(2)}</div>
      </div>
    </div>
  `;
}

function getSecondaryRows(pathId) {
  return (RUNE_DATA.paths[pathId]?.primaryRows || []).slice(1);
}

function getSecondaryRowIndex(pathId, runeId) {
  const rows = getSecondaryRows(pathId);
  return rows.findIndex((row) => row.includes(runeId));
}

function getPathPrimaryDefaults(pathId) {
  return (RUNE_DATA.pathDefaults[pathId] || []).slice(0, 4);
}

function getPathSecondaryDefaults(pathId) {
  const rows = getSecondaryRows(pathId);
  const first = rows[0]?.[0] || "";
  const second = rows[1]?.[0] || rows[0]?.[1] || first;
  return [first, second];
}

function ensureSecondarySelectionsValid() {
  const pathId = BUILDER.runeSelections.secondaryPath;
  const rows = getSecondaryRows(pathId);
  const [first, second] = BUILDER.runeSelections.secondary;
  const firstRow = getSecondaryRowIndex(pathId, first);
  const secondRow = getSecondaryRowIndex(pathId, second);

  if (firstRow < 0) BUILDER.runeSelections.secondary[0] = rows[0]?.[0] || first;
  if (secondRow < 0) BUILDER.runeSelections.secondary[1] = rows[1]?.[0] || rows[0]?.[1] || second;

  const nextFirstRow = getSecondaryRowIndex(pathId, BUILDER.runeSelections.secondary[0]);
  const nextSecondRow = getSecondaryRowIndex(pathId, BUILDER.runeSelections.secondary[1]);
  if (nextFirstRow >= 0 && nextFirstRow === nextSecondRow) {
    const fallback = rows.find((_row, idx) => idx !== nextFirstRow)?.[0];
    BUILDER.runeSelections.secondary[1] = fallback || BUILDER.runeSelections.secondary[1];
  }
}

function applySecondaryRuneSelection(runeId) {
  const pathId = BUILDER.runeSelections.secondaryPath;
  const selectedRows = BUILDER.runeSelections.secondary.map((id) => getSecondaryRowIndex(pathId, id));
  const targetRow = getSecondaryRowIndex(pathId, runeId);
  if (targetRow < 0) return;

  if (selectedRows[0] === targetRow) {
    BUILDER.runeSelections.secondary[0] = runeId;
    return;
  }
  if (selectedRows[1] === targetRow) {
    BUILDER.runeSelections.secondary[1] = runeId;
    return;
  }

  // FIFO: slot 0 is oldest branch, slot 1 is newest branch.
  BUILDER.runeSelections.secondary = [BUILDER.runeSelections.secondary[1], runeId];
}

function getRuneOptions(target) {
  if (target.startsWith("primaryPath")) return Object.entries(RUNE_DATA.paths).map(([id, p]) => ({ id, name: p.name, desc: `Set ${p.name} as primary path`, icon: p.icon }));
  if (target.startsWith("secondaryPath")) {
    return Object.entries(RUNE_DATA.paths).map(([id, p]) => ({
      id,
      name: p.name,
      desc: id === BUILDER.runeSelections.primaryPath ? "Secondary path cannot match primary path" : `Set ${p.name} as secondary path`,
      icon: p.icon,
      disabled: id === BUILDER.runeSelections.primaryPath,
    }));
  }
  if (target.startsWith("primary")) {
    const rowIndex = Number(target.split("_")[1]);
    const rows = RUNE_DATA.paths[BUILDER.runeSelections.primaryPath]?.primaryRows || [];
    return (rows[rowIndex] || []).map((id) => ({ id, ...getRuneMeta(id) }));
  }
  if (/^secondary_\d+$/.test(target)) {
    const rows = getSecondaryRows(BUILDER.runeSelections.secondaryPath);
    return rows.flatMap((row, rowIndex) => row.map((id) => ({
      id,
      rowIndex,
      ...getRuneMeta(id),
    })));
  }
  const shardRow = Number(target.split("_")[1]);
  const perRow = [
    ["adaptive-force", "attack-speed", "ability-haste"],
    ["adaptive-force", "move-speed", "scaling-health"],
    ["health", "tenacity-slow-resist", "scaling-health"],
  ];
  return (perRow[shardRow] || RUNE_DATA.shardOptions).map((id) => ({ id, ...getRuneMeta(id) }));
}

function openRuneModal(target) {
  BUILDER.runeModalTarget = target;
  document.getElementById("runeModal").classList.remove("hidden");
  const options = getRuneOptions(target);
  document.getElementById("runeModalTitle").textContent = "Select Rune Option";
  const optionBtn = (o) => {
    const disabled = o.disabled ? "disabled" : "";
    const lockNote = o.disabled ? (o.desc || "This option is unavailable") : (o.desc || "");
    return `<button class="rune-option-btn ${o.disabled ? "is-disabled" : ""}" ${disabled} data-rune-option-id="${o.id}">${runeImgTag(o)}<div><div class="rune-option-name">${o.name}</div><div class="rune-option-desc">${lockNote}</div></div></button>`;
  };

  if (/^secondary_\d+$/.test(target)) {
    const groups = [0, 1, 2]
      .map((rowIndex) => options.filter((o) => o.rowIndex === rowIndex))
      .filter((group) => group.length);
    document.getElementById("runeModalList").innerHTML = groups
      .map((group, idx) => `<section class='rune-option-group'><h4 class='rune-option-group-title'>Secondary Row ${idx + 1}</h4><div class='rune-option-group-grid'>${group.map(optionBtn).join("")}</div></section>`)
      .join("");
  } else {
    document.getElementById("runeModalList").innerHTML = options.map(optionBtn).join("");
  }
  document.getElementById("runeModal").onclick = (e) => {
    if (e.target.id === "runeModal") closeRuneModal();
  };
}

function closeRuneModal() {
  document.getElementById("runeModal").classList.add("hidden");
  BUILDER.runeModalTarget = null;
}

function selectRuneOption(id) {
  const [group, index] = BUILDER.runeModalTarget.split("_");
  if (group === "primary") BUILDER.runeSelections.primary[Number(index)] = id;
  if (group === "secondary") {
    applySecondaryRuneSelection(id);
    ensureSecondarySelectionsValid();
  }
  if (group === "shard") BUILDER.runeSelections.shards[Number(index)] = id;
  if (group === "primaryPath") {
    BUILDER.runeSelections.primaryPath = id;
    BUILDER.runeSelections.primary = getPathPrimaryDefaults(id);
    if (BUILDER.runeSelections.secondaryPath === id) {
      const fallbackSecondary = Object.keys(RUNE_DATA.paths).find((pathId) => pathId !== id) || id;
      BUILDER.runeSelections.secondaryPath = fallbackSecondary;
      BUILDER.runeSelections.secondary = getPathSecondaryDefaults(fallbackSecondary);
    }
  }
  if (group === "secondaryPath") {
    if (id !== BUILDER.runeSelections.primaryPath) {
      BUILDER.runeSelections.secondaryPath = id;
      BUILDER.runeSelections.secondary = getPathSecondaryDefaults(id);
    }
    ensureSecondarySelectionsValid();
  }
  renderRunePanel();
  renderStats();
  renderAbilityCards();
  closeRuneModal();
}

document.addEventListener("DOMContentLoaded", initBuilder);
