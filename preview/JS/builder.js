const BUILDER = {
  version: "",
  champions: {},
  items: {},
  selectedChampion: "",
  championData: null,
  level: 1,
  abilityRanks: { q: 0, w: 0, e: 0, r: 0 },
  itemSlots: Array(7).fill(""),
  activeSlot: null,
  itemTags: new Set(),
  champTags: new Set(),
  modalItemFiltered: [],
  modalChampFiltered: [],
  championDetailCache: {},
  cdragonAbilityData: null,
  combatValues: {},
  inspectedItemId: null,
  championModalRequestId: 0,
  championRequestId: 0,
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

const CDRAGON_STAT_HASH_TO_NAME = {
  "{18956a21}": "armorPerLevel",
  "{4af40dc3}": "baseDamage",
  "{4d37af28}": "hpPerLevel",
  "{836cc82a}": "attackSpeed",
  "{7bd4b298}": "attackRange",
  "{4f89c991}": "attackSpeedRatio",
  "{8662cf12}": "baseHP",
  "{913157bb}": "hpRegenPerLevel",
  "{9eedebad}": "baseStaticHPRegen",
  "{b9f2b365}": "attackSpeedPerLevel",
  "{e2b5d80d}": "damagePerLevel",
  "{e62d9d92}": "baseMoveSpeed",
  "{ea6100d5}": "baseArmor",
};

const CDRAGON_TO_DDRAGON_STAT_KEY = {
  baseDamage: "attackdamage",
  damagePerLevel: "attackdamageperlevel",
  baseHP: "hp",
  hpPerLevel: "hpperlevel",
  baseArmor: "armor",
  armorPerLevel: "armorperlevel",
  attackRange: "attackrange",
  attackSpeed: "attackspeed",
  attackSpeedPerLevel: "attackspeedperlevel",
  baseMoveSpeed: "movespeed",
  baseStaticHPRegen: "hpregen",
  hpRegenPerLevel: "hpregenperlevel",
  baseMP: "mp",
  mpPerLevel: "mpperlevel",
  baseStaticMPRegen: "mpregen",
  mpRegenPerLevel: "mpregenperlevel",
  baseSpellBlock: "spellblock",
  spellBlockPerLevel: "spellblockperlevel",
  baseCrit: "crit",
  critPerLevel: "critperlevel",
  baseCritDamage: "critdamage",
};

const DEFAULT_CHAMPION_BASE_STATS = {
  hp: 0,
  hpperlevel: 0,
  mp: 0,
  mpperlevel: 0,
  hpregen: 0,
  hpregenperlevel: 0,
  mpregen: 0,
  mpregenperlevel: 0,
  attackdamage: 0,
  attackdamageperlevel: 0,
  attackspeed: 0,
  attackspeedperlevel: 0,
  armor: 0,
  armorperlevel: 0,
  spellblock: 0,
  spellblockperlevel: 0,
  movespeed: 0,
  attackrange: 0,
  crit: 0,
  critperlevel: 0,
  critdamage: 0,
};

function slugifyRuneName(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toDdragonPerkIcon(version, iconPath) {
  if (!iconPath) return "";
  return `https://ddragon.leagueoflegends.com/cdn/img/${String(iconPath).replace(/^\/+/, "")}`;
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

function getItemLookupShared() {
  return window.ItemLookupShared;
}

async function loadBuilderData() {
  BUILDER.version = await window.ApiClient.fetchLatestVersion();
  const [champions, items] = await Promise.all([
    window.ApiClient.fetchChampionIndex(BUILDER.version),
    window.ApiClient.fetchItemIndex(BUILDER.version),
    hydrateRunesFromDdragon(BUILDER.version),
    window.ItemLookupShared.loadCommunityDragonCalcs(),
  ]);
  BUILDER.champions = champions.data;
  const state = window.ItemLookupShared.getState();
  const entries = window.ItemPolicy.dedupeByNameWithMapPriority(
    Object.entries(items.data).filter(([id, item]) =>
      window.ItemPolicy.isPurchasableItem(id, item) && item.maps?.[11]),
    new Set([11]),
  );
  const questEntries = Object.entries(items.data).filter(([id,item]) => /quest/i.test(item.name) && /^(109[0-4]|12[0-2][0-9])$/.test(id));
  BUILDER.questItemIds = new Set(questEntries.map(([id])=>id));
  for(const entry of questEntries) if(!entries.some(([id])=>id===entry[0])) entries.push(entry);
  BUILDER.items = Object.fromEntries(entries.map(([id, item]) => [id, {
    ...item, stats: buildMergedItemStats(window.BuildStats.itemStatsFromDescription(item.description, item.stats), state.cdragonById[id]),
  }]));
  BUILDER.itemTags = new Set(Object.values(BUILDER.items).flatMap(item => item.tags || []));
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
    ++BUILDER.championModalRequestId;
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
  const spellCandidates = [
    spellRecord?.mSpell,
    spellRecord?.mClientData?.mSpell,
    spellRecord?.mSpellData,
    spellRecord,
  ].filter(Boolean);
  if (!spellCandidates.length) return null;

  const normalizeDataValues = (rawDataValues) => {
    if (Array.isArray(rawDataValues)) return rawDataValues;
    if (!rawDataValues || typeof rawDataValues !== "object") return [];
    return Object.entries(rawDataValues).map(([name, entry]) => {
      if (entry && typeof entry === "object") {
        return {
          mName: entry.mName || entry.name || entry.mDataValue || name,
          mValues: entry.mValues || entry.values || entry.mValue || entry.value || [],
        };
      }
      return { mName: name, mValues: [entry] };
    });
  };

  const normalizeCalculations = (rawCalculations) => {
    if (!rawCalculations || typeof rawCalculations !== "object") return {};
    return rawCalculations;
  };

  const parsedCandidate = spellCandidates
    .map((candidate) => ({
      spellData: candidate,
      effects: candidate?.mEffectAmount || [],
      dataValues: normalizeDataValues(
        candidate?.mDataValues
        || candidate?.DataValues
        || candidate?.dataValues
        || candidate?.mDataValuesMap
        || {},
      ),
      calculations: normalizeCalculations(
        candidate?.mSpellCalculations
        || candidate?.SpellCalculations
        || candidate?.spellCalculations
        || candidate?.mCalculations
        || {},
      ),
    }))
    .sort((a, b) => ((Object.keys(b.calculations || {}).length * 4) + (b.dataValues?.length || 0))
      - ((Object.keys(a.calculations || {}).length * 4) + (a.dataValues?.length || 0)))[0];

  if (!parsedCandidate) return null;
  return {
    spellData: parsedCandidate.spellData,
    effects: parsedCandidate.effects || [],
    dataValues: parsedCandidate.dataValues || [],
    calculations: parsedCandidate.calculations || {},
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
  return entry?.mName || entry?.mId || entry?.mDataValue || entry?.name || entry?.mKey || entry?.key || "";
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

function getObjectPathTail(value) {
  const path = String(value || "").trim();
  if (!path) return "";
  const segments = path.split("/").filter(Boolean);
  return segments[segments.length - 1] || "";
}

function buildSpellAliasMetadata({ slot, spell = null, selectedChild = null, abilityRecord = null, nameCandidates = [] }) {
  return {
    slot,
    scriptName: selectedChild?.record?.mScriptName || abilityRecord?.mScriptName || "",
    objectPathTail: getObjectPathTail(
      selectedChild?.record?.mObjectPath
      || selectedChild?.path
      || abilityRecord?.mObjectPath
      || "",
    ),
    spellIdCandidate: String(spell?.id || ""),
    spellNameCandidate: String(spell?.name || ""),
    matchCandidates: nameCandidates.map((candidate) => String(candidate || "")).filter(Boolean),
  };
}

function registerSpellPayloadAliases(byAlias, payload, metadata, aliases = []) {
  aliases.forEach((aliasRaw) => {
    const normalized = normalizeSpellRecordName(aliasRaw);
    const canonical = canonicalizeToken(normalized);
    if (!canonical || byAlias[canonical]) return;
    byAlias[canonical] = {
      payload,
      metadata,
      alias: normalized,
      canonicalAlias: canonical,
    };
  });
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
  const byAlias = {};

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

    const childSpells = [...new Set([abilityRecord?.mRootSpell,...(abilityRecord?.mChildSpells||[])].filter(Boolean))];
    if (!childSpells.length) return;
    const rootRecord=resolveCdragonRecord(raw,pathIndex,abilityRecord?.mRootSpell);
    const rootParsed=extractCdragonSpell(rootRecord);
    let selectedChild = rootParsed ? {path:abilityRecord.mRootSpell,record:rootRecord,parsed:rootParsed} : chooseBestSpellChild(raw, pathIndex, childSpells, spell, slot);
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

    const metadata = buildSpellAliasMetadata({
      slot,
      spell,
      selectedChild,
      abilityRecord,
      nameCandidates,
    });

    const aliases = [
      slot,
      spell?.name,
      spell?.id,
      ...nameCandidates,
      abilityRecord?.mScriptName,
      abilityRecord?.mObjectPath,
      getObjectPathTail(abilityRecord?.mObjectPath),
      abilityRecord?.mName,
      selectedChild?.record?.mScriptName,
      selectedChild?.record?.mObjectPath,
      getObjectPathTail(selectedChild?.record?.mObjectPath),
      selectedChild?.record?.mName,
      selectedChild?.path,
      getObjectPathTail(selectedChild?.path),
    ];
    buildSpellPayloadLookupEntry(byRef, parsed, aliases);
    registerSpellPayloadAliases(byAlias, parsed, metadata, aliases);
  });

  const passivePathCandidates = [
    root?.mCharacterPassiveSpell,
    `Characters/${championName}/Spells/${championName}PassiveAbility`,
    `Characters/${pathName}/Spells/${pathName}PassiveAbility`,
  ];
  const passiveRecord = passivePathCandidates
    .map((candidate) => resolveCdragonRecord(raw, pathIndex, candidate))
    .find(Boolean)
    || null;
  if (passiveRecord) {
    const childSpells = Array.isArray(passiveRecord?.mChildSpells) ? passiveRecord.mChildSpells : [];
    const directRecord=passiveRecord.mSpell?passiveRecord:resolveCdragonRecord(raw,pathIndex,passiveRecord.mRootSpell);
    const directParsed=extractCdragonSpell(directRecord);
    let selectedChild = directParsed?{record:directRecord,parsed:directParsed,path:root?.mCharacterPassiveSpell||passiveRecord.mRootSpell}:chooseBestSpellChild(raw, pathIndex, childSpells, null, "p");
    if (!selectedChild?.parsed) {
      const primaryChild = resolveCdragonRecord(raw, pathIndex, childSpells[0]);
      selectedChild = { parsed: extractCdragonSpell(primaryChild), path: childSpells[0], record: primaryChild };
    }
    const parsed = selectedChild?.parsed || null;
    if (parsed) bySlot.p = parsed;

    if (parsed) {
      const metadata = buildSpellAliasMetadata({
        slot: "p",
        spell: { id: `${championName}Passive`, name: "Passive" },
        selectedChild,
        abilityRecord: passiveRecord,
        nameCandidates: passivePathCandidates,
      });
      const aliases = [
        "p",
        "passive",
        `${championName}passive`,
        `${pathName}passive`,
        ...passivePathCandidates,
        passiveRecord?.mScriptName,
        passiveRecord?.mObjectPath,
        getObjectPathTail(passiveRecord?.mObjectPath),
        passiveRecord?.mName,
        selectedChild?.record?.mScriptName,
        selectedChild?.record?.mObjectPath,
        getObjectPathTail(selectedChild?.record?.mObjectPath),
        selectedChild?.record?.mName,
        selectedChild?.path,
        getObjectPathTail(selectedChild?.path),
      ];
      buildSpellPayloadLookupEntry(byRef, parsed, aliases);
      registerSpellPayloadAliases(byAlias, parsed, metadata, aliases);
    }
  }

  // Qualified tooltip references can point to auxiliary or hashed passive records.
  // Register exact source names; do not choose a similarly named damage formula.
  for(const [path,record] of Object.entries(raw||{})){
    if(!record?.mSpell)continue;
    const payload=extractCdragonSpell(record);
    const aliases=[record.ObjectName,record.mScriptName,record.objectPath,path,getObjectPathTail(path)].filter(Boolean);
    buildSpellPayloadLookupEntry(byRef,payload,aliases);
    registerSpellPayloadAliases(byAlias,payload,{slot:null},aliases);
  }
  if (!Object.keys(bySlot).length) return null;
  bySlot.byRef = byRef;
  bySlot.byAlias = byAlias;
  return bySlot;
}

// Read only present, finite values. Missing fields are not zero-valued stats.
function extractChampionStatsFromBinRoot(raw, championName, pathName) {
  const rootPath = `characters/${championName || pathName}/characterrecords/root`.toLowerCase();
  const root = Object.entries(raw || {}).find(([key]) => key.toLowerCase() === rootPath)?.[1];
  if (!root) return {};
  const stats = {};
  const mapping = { ...CDRAGON_TO_DDRAGON_STAT_KEY, attackSpeedRatio: 'attackspeedratio' };
  for (const [source, target] of Object.entries(mapping)) {
    const hash = Object.keys(CDRAGON_STAT_HASH_TO_NAME).find(key => CDRAGON_STAT_HASH_TO_NAME[key] === source);
    const rawValue = root[source + 'Modifiable'] ?? root[source] ?? root[hash];
    const value = typeof rawValue === 'object' && rawValue !== null ? rawValue.baseValue : rawValue;
    if (typeof value === 'number' && Number.isFinite(value)) stats[target] = value;
  }
  return stats;
}


const verifiedSplashes = new Set();
function splashAvailable(url) {
  if (verifiedSplashes.has(url)) return Promise.resolve(true);
  return new Promise(resolve => {
    const image = new Image();
    const timer = setTimeout(() => finish(false), 10000);
    const finish = ok => { clearTimeout(timer); image.onload = image.onerror = null; if(ok) verifiedSplashes.add(url); resolve(ok); };
    image.onload = () => finish(image.naturalWidth > 0);
    image.onerror = () => finish(false);
    image.src = url;
  });
}
async function populateSkinSelector(name, records, requestId) {
  const selector = document.getElementById('skinSelector');
  selector.replaceChildren(new Option('Checking splash art…', '')); selector.disabled = true;
  // Data Dragon's chromas flag means the base skin HAS chromas, not that it IS one.
  // Named colour variants use a parenthetical suffix; yearly prestige editions are separate skins.
  const candidates = records.filter(skin => !/\([^)]*\)$/.test(skin.name) || /\(\d{4}\)$/.test(skin.name));
  const available = await Promise.all(candidates.map(async skin => ({skin, ok:await splashAvailable(`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_${skin.num}.jpg`)})));
  if(requestId !== BUILDER.championRequestId) return;
  selector.replaceChildren();
  available.filter(entry=>entry.ok).forEach(({skin})=>selector.add(new Option(skin.num===0?'Original':skin.name,String(skin.num))));
  selector.disabled = !selector.options.length;
  if(selector.disabled) selector.add(new Option('No splash art available',''));
  selector.onchange = () => { if(selector.value !== '') document.body.style.setProperty('--builder-splash-url',`url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_${selector.value}.jpg)`); };
}

async function setChampion(name) {
  const requestId = ++BUILDER.championRequestId;
  setStatus(`Loading ${name}...`);
  try {
    const [details, raw, strings] = await Promise.all([
      window.ApiClient.fetchChampionDetails(BUILDER.version, name),
      window.ApiClient.fetchCommunityDragonChampion(name).catch(() => null),
      ['Akshan','Gangplank','Aphelios','Jayce','Nidalee','Elise','Gnar'].includes(name)
        ? window.ApiClient.fetchJson('https://raw.communitydragon.org/latest/game/en_us/data/menu/en_us/lol.stringtable.json').catch(()=>null)
        : null,
    ]);
    if (requestId !== BUILDER.championRequestId) return;
    const champion = details.data?.[name];
    if (!champion?.stats || !champion.spells) throw new Error('Champion data is incomplete');
    const extraStats = extractChampionStatsFromBinRoot(raw, name, name.toLowerCase());
    // Data Dragon supplies patch-consistent base stats and regeneration units.
    const stats = { ...DEFAULT_CHAMPION_BASE_STATS, ...champion.stats };
    if (extraStats.attackspeedratio > 0) stats.attackspeedratio = extraStats.attackspeedratio;
    const characterRoot = raw?.[`Characters/${name}/CharacterRecords/Root`];
    if (Number.isFinite(characterRoot?.critDamageMultiplier)) stats.critdamage = characterRoot.critDamageMultiplier;
    const abilityData = raw ? extractAbilityDataFromRoot(raw, name, normalizeCdragonChampionPath(name), champion.spells) : null;
    BUILDER.selectedChampion = name;
    BUILDER.championData = { ...champion, stats };
    BUILDER.cdragonAbilityData = abilityData;
    BUILDER.cdragonRaw = raw;
    BUILDER.strings = strings?.entries || {};
    BUILDER.combatValues = {};
    BUILDER.abilityRanks = { q: 0, w: 0, e: 0, r: 0 };
    BUILDER.level = Number(document.getElementById('builderLevel').value) || 1;
    document.getElementById('dashboardChampionName').textContent = champion.name;
    document.getElementById('dashboardChampionTitle').textContent = champion.title;
    populateSkinSelector(name, champion.skins || [{num:0,name:'Original'}], requestId);
    document.body.style.setProperty('--builder-splash-url', `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg)`);
    document.getElementById('championPickerBtn').innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${champion.image.full}" alt="${name}">`;
    document.getElementById('championPickerBtn').setAttribute('aria-label', `Selected champion: ${name}`);
    enforceAbilityRules();
    renderAbilityCards();
    renderStats();
    setStatus(raw ? '' : 'Basic stats loaded. Advanced ability data is unavailable.');
  } catch (error) {
    if (requestId !== BUILDER.championRequestId) return;
    console.warn('Champion selection failed', error);
    setStatus(`Could not load ${name}. Select the champion again to retry.`, true);
  }
}

function renderItemSlots() {
  const root = document.getElementById("itemSlots");
  root.innerHTML = BUILDER.itemSlots.map((_, i) => `<button class="item-slot-btn ${i===6?'role-quest-slot':''}" aria-label="${i===6?'Role quest item':'Item slot '+(i+1)}" title="${i===6?'Role quest item':'Item slot '+(i+1)}" data-slot="${i}"><div id="slotText${i}" class="item-slot-empty">+</div></button>`).join("");
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
  document.getElementById("itemModalTitle").textContent = BUILDER.activeSlot === 6 ? "Select Role Quest Item" : "Select Item";
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
    .filter(([id]) => BUILDER.activeSlot === 6 ? BUILDER.questItemIds.has(id) : !BUILDER.questItemIds.has(id))
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
  BUILDER.inspectedItemId=id;
  renderCombatInputs();
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
  const pctStats = new Set(["FlatCritChanceMod", "FlatCritDamageMod", "PercentBaseHPRegenMod", "PercentBaseMPRegenMod", "PercentAttackSpeedMod", "PercentMovementSpeedMod", "PercentCritChanceMod", "PercentCritDamageMod"]);
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
  const controls=document.createElement('div');controls.className='combat-inputs';controls.dataset.open='true';root.append(controls);
  window.CombatInputs.render(controls,{
    sources:[window.CombatInputs.itemSource(id,window.ItemLookupShared.getState().cdragonById[id],item.name)],
    base:baseCalculationContext(getComputedChampionStatsForTooltips()),values:BUILDER.combatValues,
    onChange:()=>{renderStats();renderAbilityCards();renderModalItemDetail(id);},
  });

}

function setSlotItem(itemId) {
  if (!Number.isInteger(BUILDER.activeSlot) || BUILDER.activeSlot < 0 || BUILDER.activeSlot >= 7) return;
  if (itemId && !BUILDER.items[itemId]) return;
  if (itemId && (BUILDER.activeSlot===6) !== BUILDER.questItemIds.has(itemId)) return;
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
  if (valueBurn === undefined || valueBurn === null || valueBurn === "") return "-";
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
    ? (shared.buildExtractedFormulas(String(itemId || ""), calculationContext(getComputedChampionStatsForTooltips()))?.lines || [])
    : [];

  html = shared.injectItemCalculationValues(html, formulaRows);
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
  const selectedItems = [...new Set(BUILDER.itemSlots)]
    .filter((id) => id && BUILDER.items[id])
    .map((id) => ({ id: String(id), item: BUILDER.items[id] }));
  const passiveEffects = [];
  const additiveMods = { ad: 0, ap: 0 };
  let apMultiplier = 1;
  let hasRabadon = false;

  selectedItems.forEach(({ id, item }) => {
    const resolvedDescriptionHtml = item.description || "";
    extractPassiveDescriptionsFromHtml(resolvedDescriptionHtml).forEach(({ label, impact }) => {
      passiveEffects.push({ source: "Item", owner: item.name, label, impact });
    });

    const source = window.ItemLookupShared.getState().cdragonById[id];
    if (!source) return;
    const b = BUILDER.championData?.stats;
    const bonusMana = itemTotals.mp + runeTotals.mp;
    const baseMana = b ? b.mp + b.mpperlevel * window.BuildStats.growthFactor(BUILDER.level) : 0;
    const context = {level:BUILDER.level, stats:{mp:baseMana+bonusMana,bonusMp:bonusMana},
      dataValues:source.mDataValues || [], calculations:source.mItemCalculations || {}};
    // Effect bindings identify the passive; coefficients and formulas come from live data.
    if (id === "3089") {
      const amp = window.Calculations.dataValue(context.dataValues, "APAmp").value;
      if (amp !== null) { hasRabadon=true; apMultiplier *= 1+amp; }
    }
    const binding = {"3042":["BonusADFromMana","ad"], "3040":["BonusAPCalc","ap"]}[id];
    if (binding && b) {
      const [key,stat] = binding;
      const row = window.Calculations.evaluate(window.Calculations.lookup(context.calculations,key),context);
      if (row.value !== null) {
        additiveMods[stat] += row.value;
        passiveEffects.push({source:"Item",owner:item.name,label:"Awe",impact:`+${row.value.toFixed(1)} ${stat.toUpperCase()} (${row.text})`});
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

  return { passiveEffects, statMods, apMultiplier };
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

  const hp = (base.hp + base.hpperlevel * window.BuildStats.growthFactor(L) + item.hp + rune.hp);
  const baseHp5 = base.hpregen + base.hpregenperlevel * window.BuildStats.growthFactor(L);
  const hp5 = (baseHp5 * (1 + item.hp5PctBase / 100) + item.hp5 + rune.hp5);
  const mp = (base.mp + base.mpperlevel * window.BuildStats.growthFactor(L) + item.mp + rune.mp);
  const baseMp5 = base.mpregen + base.mpregenperlevel * window.BuildStats.growthFactor(L);
  const mp5 = (baseMp5 * (1 + item.mp5PctBase / 100) + item.mp5 + rune.mp5);
  const ad = (base.attackdamage + base.attackdamageperlevel * window.BuildStats.growthFactor(L) + item.ad + rune.ad + passiveAd);
  const ap = item.ap + rune.ap + passiveAp;
  const armor = (base.armor + base.armorperlevel * window.BuildStats.growthFactor(L) + item.armor + rune.armor);
  const mr = (base.spellblock + base.spellblockperlevel * window.BuildStats.growthFactor(L) + item.mr + rune.mr);
  const asTotal = window.BuildStats.attackSpeed(base.attackspeed, base.attackspeedperlevel, base.attackspeedratio, L, item.asPct + rune.asPct);
  const abilityHaste = item.haste + rune.haste;
  const critChance = Math.min(100, (base.crit + base.critperlevel * window.BuildStats.growthFactor(L)) * 100 + item.critChance + rune.critChance);
  const critDamage = (base.critdamage ? base.critdamage * 100 : 200) + item.critDamage + rune.critDamage;
  const attackRange = (base.attackrange || 0) + item.attackRange + rune.attackRange + getChampionPassiveRangeBonus();
  const moveSpeed = (base.movespeed + item.msFlat + rune.msFlat) * (1 + (item.msPct + rune.msPct) / 100);

  const computed = {
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
  const applied = window.AttackEffects.model(BUILDER, window.ItemLookupShared.getState().cdragonById).apply(window.ChampionEffects.model(BUILDER).apply(computed));
  // Deathcap also amplifies AP gained from champion stacks.
  if (['Veigar','Thresh'].includes(BUILDER.selectedChampion))applied.ap += (applied.ap - computed.ap) * (ledger.apMultiplier - 1);
  if(applied.championBonuses.ap)applied.championBonuses.ap=applied.ap-computed.ap;
  for(const [stat,value] of Object.entries(applied.championBonuses))if(value)ledger.passiveEffects.push({source:"Champion",owner:BUILDER.selectedChampion,label:"Ability / stack bonus",impact:`${value>=0?"+":""}${value.toFixed(2)} ${stat}`});
  return applied;
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
  return window.AttackEffects.model(BUILDER, window.ItemLookupShared.getState().cdragonById).profile(computed);
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
    ...buildResolvedSpellPayload(cdragonPassive, 1, getComputedChampionStatsForTooltips()),
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

  const baseAd = base.attackdamage + base.attackdamageperlevel * window.BuildStats.growthFactor(L);
  const totalAd = ad;
  const baseAp = 0;
  const totalAp = ap;
  const baseArmor = base.armor + base.armorperlevel * window.BuildStats.growthFactor(L);
  const totalArmor = armor;
  const baseMr = base.spellblock + base.spellblockperlevel * window.BuildStats.growthFactor(L);
  const totalMr = mr;
  const baseHp = base.hp + base.hpperlevel * window.BuildStats.growthFactor(L);
  const totalHp = hp;
  const baseMp = base.mp + base.mpperlevel * window.BuildStats.growthFactor(L);
  const totalMp = mp;

  return {
    ap: totalAp, baseAp: 0,
    healShieldPower: BUILDER.itemSlots.filter(Boolean).reduce((sum,id)=>sum+(window.ItemLookupShared.getState().cdragonById[id]?.mPercentHealingAmountMod||0),0),
    attackSpeed: computed.asTotal,
    bonusAttackSpeed: (base.attackspeedperlevel * window.BuildStats.growthFactor(L) + item.asPct + rune.asPct) / 100 + (computed.bonusAttackSpeedFromChampion || 0),
    moveSpeed: computed.moveSpeed, baseMoveSpeed: base.movespeed,
    critChance: computed.critChance / 100, bonusCritChance: (item.critChance + rune.critChance) / 100,
    critDamage: computed.critDamage / 100, bonusCritDamage: (item.critDamage + rune.critDamage) / 100,
    haste: computed.abilityHaste,
    cooldownReduction: computed.abilityHaste / (100 + computed.abilityHaste),
    lifeSteal: (item.physicalVamp + (computed.championLifeSteal||0)) / 100, physicalVamp: (item.physicalVamp + (computed.championLifeSteal||0)) / 100, omniVamp: item.omniVamp / 100,
    magicPenFlat: item.mrPenFlat, lethality: item.arPenFlat, tenacity: item.tenacity / 100,
    attackRange: computed.attackRange, baseAttackRange: base.attackrange,
    bonusAttackRange: computed.attackRange - base.attackrange,
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
  const value = window.Calculations.dataValue(dataValues, tokenName, rank, BUILDER.level);
  if (value.missing) return null;
  return { current: value.value, rankValues: [1,2,3,4,5].map(r => window.Calculations.dataValue(dataValues, tokenName, r, BUILDER.level).value) };
}

function getCalcStatSource(part, stats) {
  const value = window.Calculations.stat(part, {stats});
  return { ...value, label: value.text };
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

function isMissingGameCalculation(result) {
  if (!result || !Array.isArray(result.terms) || !result.terms.length) return true;
  return result.terms.every((term) => term?.missing === true);
}

function baseCalculationContext(stats, dataValues = [], rank = 1, calculations = {}, effects = []) {
  return {
    stats, dataValues, rank, calculations, effects, level: BUILDER.level, targetFormulaOnly:true, automaticSelfStats:true,
    resolveExternal: (path, key) => {
      const record=window.Calculations.lookup(BUILDER.cdragonRaw,path);
      const payload=extractCdragonSpell(record);
      return window.Calculations.dataValue(payload?.dataValues,key,rank,BUILDER.level);
    },
    ranged: BUILDER.championData ? BUILDER.championData.stats.attackrange > 300 : undefined,
    itemCounts: BUILDER.itemSlots.filter(Boolean).reduce((counts,id) => {
      const rarity=window.ItemLookupShared.getState().cdragonById[id]?.epicness;
      if (rarity !== undefined) counts[rarity]=(counts[rarity]||0)+1;
      return counts;
    }, {0:0,1:0,2:0,3:0,4:0,5:0,6:0}),
  };
}

function calculationContext(...args) {
  const defaults=Object.fromEntries(window.ChampionEffects.model(BUILDER).fields.filter(f=>f.defaultValue!==undefined).map(f=>[f.key,f.defaultValue]));
  const state=Object.fromEntries(Object.entries({...defaults,...BUILDER.combatValues}).filter(([key])=>!key.startsWith('target:')&&(!key.startsWith('self:')||key==='self:healthPercent:0')));
  return window.CombatInputs.apply(baseCalculationContext(...args),state);
}

function combatSources() {
  const buffNames={};
  for(const [path,record] of Object.entries(BUILDER.cdragonRaw||{})) {
    for(const name of [path.split('/').pop(),record?.ObjectName,record?.mScriptName].filter(Boolean))buffNames[window.Calculations.hash(name)]=name;
  }
  const sources=[];
  const seen=new Set();
  const allTooltipText=[BUILDER.championData?.passive?.description,...(BUILDER.championData?.spells||[]).map(s=>s.tooltip)].join(' ');
  const add=(payload,slot,label)=>{
    if(!payload||seen.has(payload.calculations))return;
    seen.add(payload.calculations);
    const calculations=Object.fromEntries(Object.entries(payload.calculations||{}).filter(([key,calc])=>
      (!calc.tooltipOnly&&!/^tooltiponly_/i.test(key)) || allTooltipText.toLowerCase().includes(key.toLowerCase())
    ));
    sources.push({...payload,calculations,slot,label,buffNames});
  };
  for(const slot of ['p','q','w','e','r']){
    const spell=slot==='p'?BUILDER.championData?.passive:BUILDER.championData?.spells?.[['q','w','e','r'].indexOf(slot)];
    add(BUILDER.cdragonAbilityData?.[slot],slot,`${slot.toUpperCase()} ${spell?.name||''}`);
  }
  for(const [i,spell]of (BUILDER.championData?.spells||[]).entries()){
    for(const match of (spell.tooltip||'').matchAll(/spell\.([^:}]+):/gi)){
      const ref=BUILDER.cdragonAbilityData?.byAlias?.[canonicalizeToken(match[1])];
      add(ref?.payload,['q','w','e','r'][i],`${['Q','W','E','R'][i]} ${spell.name}`);
    }
  }

  return sources;
}

function renderCombatInputs() {
  document.getElementById('combatInputs')?.replaceChildren();
  const sources=combatSources(),base=baseCalculationContext(getComputedChampionStatsForTooltips());
  const extra=window.ChampionEffects.model(BUILDER).fields.concat((BUILDER.championData?.spells||[])
    .flatMap((spell,i)=>window.AbilityDps.timingFields(spell.id,['q','w','e','r'][i])));
  const all=window.CombatInputs.descriptors(sources,base).filter(f=>!extra.some(e=>e.key===f.key)).concat(extra);
  const usage=new Map();
  for(const source of sources){
    for(const field of window.CombatInputs.descriptors([source],base)){
      if(!usage.has(field.key))usage.set(field.key,new Set());usage.get(field.key).add(source.slot);
    }
  }
  const fieldOwner=field=>{
    if(field.slot)return field.slot;
    const slots=[...usage.get(field.key)||[]];
    if(slots.includes('p'))return 'p';
    if(field.kind==='buff'){
      const index=(BUILDER.championData?.spells||[]).findIndex(spell=>window.Calculations.hash(spell.id)===field.key.slice(5));
      const slot=['q','w','e','r'][index];if(slots.includes(slot))return slot;
    }
    return slots.length>1?'p':slots[0];
  };
  for(const slot of ['p','q','w','e','r']){
    const fields=all.filter(field=>fieldOwner(field)===slot).map(field=>{
      const slots=[...usage.get(field.key)||[]];
      if(!field.slot && field.kind==='buff' && fieldOwner(field)==='p'){
        const passive=BUILDER.championData?.passive?.name||'Passive';
        const sharedCounters=all.filter(f=>f.kind==='buff'&&fieldOwner(f)==='p');
        return {...field,label:sharedCounters.length===1?`${passive} stacks`:`${passive} — ${field.label}`};
      }
      return field;
    });
    window.CombatInputs.render(document.querySelector(`[data-ability-slot="${slot}"] .ability-inputs`),{
      fields,inline:true,sources:[],base,values:BUILDER.combatValues,
      onChange:()=>{renderStats();renderAbilityCards();},
    });
  }
}

function adaptCalculation(row) {
  return {...row, total:row.value, terms:[{text:row.text,value:row.value,missing:row.missing}]};
}

function evaluateCalculationPart(part, dataValues, rank, stats, calculationsMap = {}) {
  return window.Calculations.partValue(part, calculationContext(stats,dataValues,rank,calculationsMap));
}

function evaluateGameCalculation(calc, dataValues, rank, stats, calculationsMap = {}, effects = []) {
  return adaptCalculation(window.Calculations.evaluate(calc, calculationContext(stats,dataValues,rank,calculationsMap,effects)));
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
    const evaluated = stats ? evaluateGameCalculation(calc, dataValues, safeRank, stats, calculations, payload?.effects || []) : null;
    return [String(k).toLowerCase(), evaluated];
  }));
  return {
    cdragonSpell: payload,
    calcLookup,
    calcLookupCanonicalMap: buildCanonicalTokenMap(Object.keys(calcLookup)),
    dataValueCanonicalMap: buildCanonicalTokenMap(dataValues.map((d) => String(d?.mName || d?.name || "").toLowerCase())),
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


  };

  tryTrimEdge(String(token || "").trim().toLowerCase());
  return candidates;
}

function resolveAbilityToken(tokenRaw, ctx) {
  const token = String(tokenRaw || "").trim().toLowerCase().replace(/\.\d+(?=\*|$)/, "");
  const denylist = new Set(["gamemodeinteger", "gamemodeinteger1", "gamemodeinteger2", "gamemodeinteger3"]);
  const multiplierMatchRegex = /^(?<left>[a-z0-9_:.]+)\*(?<mult>-?\d+(?:\.\d+)?)$/;

  const getQualifiedCtx = (spellRefRaw, localCtx) => {
    const normalizedRef = normalizeSpellRecordName(spellRefRaw);
    const canonicalRef = canonicalizeToken(normalizedRef);
    if (!canonicalRef) return null;

    const aliasEntry = localCtx.allSpellPayloadByAlias?.[canonicalRef] || null;
    const payload = aliasEntry?.payload || localCtx.allSpellPayloadByRef?.[canonicalRef];
    if (!payload) return null;

    return {
      ...localCtx,
      cdragonSpell: payload.cdragonSpell,
      calcLookup: payload.calcLookup,
      calcLookupCanonicalMap: payload.calcLookupCanonicalMap,
      dataValueCanonicalMap: payload.dataValueCanonicalMap,
      qualifiedSpellAlias: aliasEntry?.metadata || null,
    };
  };

  const resolveSimple = (baseToken, localCtx = ctx) => {
    const candidates = getDeterministicTokenCandidates(baseToken);

    const resolveCalc = (lookupToken) => {
      if (denylist.has(canonicalizeToken(lookupToken))) return { html: "", numeric: null };

      let calc = window.Calculations.lookup(localCtx.calcLookup, lookupToken);
      if (!calc) {
        const canonicalKey = localCtx.calcLookupCanonicalMap?.[canonicalizeToken(lookupToken)];
        if (canonicalKey) calc = localCtx.calcLookup[canonicalKey];
      }
      if (!calc) return null;

      if (calc.missing || calc.total === null) return {
        html: `<span class="ability-detail-eq">${calc.unsupported?.length ? 'Value unavailable' : calc.text}</span>`,
        numeric: null,
      };
      const shown = calc.displayAsPercent ? (calc.total * 100) : calc.total;
      const eq = formatCalculationTerms(calc.terms, shown);
      return {
        html: `<span class="ability-detail-number">${formatAbilityNumber(shown, calc.displayAsPercent)} <span class="ability-detail-eq">(${eq})</span></span>`,
        numeric: shown,
        isPercent: calc.displayAsPercent === true,
      };
    };

    const resolveDataValue = (lookupToken) => {
      let dataValue = getSpellDataValue(localCtx.cdragonSpell?.dataValues || [], lookupToken, localCtx.safeRank);
      if (!dataValue) {
        const canonicalKey = localCtx.dataValueCanonicalMap?.[canonicalizeToken(lookupToken)];
        if (canonicalKey) dataValue = getSpellDataValue(localCtx.cdragonSpell?.dataValues || [], canonicalKey, localCtx.safeRank);
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
      if (!left) return null;
      const mult = Number(multMatch.groups.mult);
      if(left.numeric===null)return {html:`${mult} × (${left.html})`,numeric:null};
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

  if ((/^f\d+$/.test(baseToken)||['bonusarmor','bonusmr','resistsfortooltip','bonusattackrange'].includes(baseToken)) && ctx.stats) {
    const value=window.ChampionEffects.model(BUILDER).token(ctx.spell.id,baseToken,ctx.stats,computeDerivedBuildStats());
    if(Number.isFinite(value))return {html:`<span class="ability-detail-number">${formatAbilityNumber(value)}</span>`,numeric:value};
  }
  const direct = resolveToken(baseToken, simpleCtx, simpleCtx);
  if (direct) return direct;

  return null;
}


function getSpellRankValueAt(spell, rawValue, safeRank) {
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
}

function getSpellTokenValueAtRank(spell, baseToken, safeRank) {
  const token = String(baseToken || "").toLowerCase();
  const toCamelCase = (value) => String(value || "").replace(/[_-]+([a-z0-9])/gi, (_, chr) => chr.toUpperCase());
  const camel = toCamelCase(token);
  const candidateKeys = [token, `${token}burn`, camel, `${camel}Burn`];
  for (const key of candidateKeys) {
    if (!Object.prototype.hasOwnProperty.call(spell, key)) continue;
    const resolved = getSpellRankValueAt(spell, spell[key], safeRank);
    if (resolved !== "-") return resolved;
  }
  return "-";
}

function expandAbilityLocalization(text) {
  // This Builder selects Summoner's Rift items; game-mode variant 1 is the standard ruleset.
  let result=String(text).replace(/\{\{\s*(Spell_\w+_Tooltip_)\{\{\s*gamemodeinteger\s*\}\}\s*\}\}/gi,(_,prefix)=>`{{ ${prefix}1 }}`);
  // Show every weapon outcome rather than silently assume Aphelios's main hand.
  result=result.replace(/\{\{\s*Spell_ApheliosR_WeaponMod_\{\{\s*f1\s*\}\}\s*\}\}/gi,
    ()=>[1,2,3,4,5].map(i=>`{{ Spell_ApheliosR_WeaponMod_${i} }}`).join(''));
  for(let depth=0;depth<8;depth++){
    const expanded=result.replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(full,key)=>BUILDER.strings?.[key.trim().toLowerCase()]??full);
    if(expanded===result)break;result=expanded;
  }
  return result.replace(/@([^@]+)@/g,(_,key)=>`{{ ${key} }}`);
}

function buildAbilityContext(spell, rank, spellKey) {
  const safeRank = Math.max(1, Number(rank) || 1);
  const stats = getComputedChampionStatsForTooltips();
  const vars = Object.fromEntries((spell.vars || []).map((v) => [String(v.key || "").toLowerCase(), v]));
  
  const cdragonSpell = BUILDER.cdragonAbilityData?.[spellKey] || null;
  const resolvedSpellPayload = buildResolvedSpellPayload(cdragonSpell, safeRank, stats);
  const calcLookup = resolvedSpellPayload.calcLookup;

  const getSpellTokenValue = (baseToken) => getSpellTokenValueAtRank(spell, baseToken, safeRank);
  const nearbyAmmoTokens = Object.fromEntries(
    Object.keys(spell || {})
      .filter((tokenKey) => /(ammo|recharge|stock)/i.test(String(tokenKey || "")))
      .map((tokenKey) => [String(tokenKey || "").toLowerCase(), getSpellRankValueAt(spell, spell[tokenKey], safeRank)])
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
  const allSpellPayloadByAlias = Object.entries(BUILDER.cdragonAbilityData?.byAlias || {}).reduce((acc, [aliasKey, entry]) => {
    if (!entry?.payload) return acc;
    acc[aliasKey] = {
      ...entry,
      payload: buildResolvedSpellPayload(entry.payload, safeRank, stats),
    };
    return acc;
  }, {});

  return {
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
    allSpellPayloadByAlias,
  };
}

function buildDetailedAbilityText(spell, rank, spellKey, context) {
  const raw = expandAbilityLocalization(spell.tooltip || spell.description || "");
  if (!(Number(rank) > 0)) return spell.description || "";
  const ctx = context || buildAbilityContext(spell, rank, spellKey);
  const replaced = raw.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full, tokenRaw) => {
    const resolved = resolveAbilityToken(tokenRaw, ctx);
    if (resolved) return resolved.html;
    return `<span class="ability-detail-missing">[value unavailable]</span>`;
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

function abilityEffectValues(payload,rank) {
  if(!payload || !rank)return '';
  const context=calculationContext(getComputedChampionStatsForTooltips(),payload.dataValues,rank,payload.calculations,payload.effects);
  const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rows=Object.entries(payload.calculations||{}).filter(([name,calc])=>!name.startsWith('{')&&!calc.tooltipOnly&&!/^tooltiponly_/i.test(name)).map(([name,calc])=>{
    const row=window.Calculations.evaluate(calc,context);
    const slot=['q','w','e','r'].find(slot=>BUILDER.cdragonAbilityData?.[slot]===payload);
    const id=BUILDER.championData?.spells?.[['q','w','e','r'].indexOf(slot)]?.id;
    const bindings={GarenE:{NumberOfStrikes:'f1'},BelvethE:{TotalStrikes:'f2'},SettW:{MaxDamage:'f1'},PoppyW:{BonusArmor:'bonusarmor',BonusMR:'bonusmr'},GarenW:{ResistsForTooltip:'resistsfortooltip'},Feast:{BonusAttackRange:'bonusattackrange'}};
    const key=bindings[id]?.[name];
    const corrected=key?window.ChampionEffects.model(BUILDER).token(id,key,context.stats,computeDerivedBuildStats()):null;
    const value=Number.isFinite(corrected)?window.Calculations.format(corrected):row.value===null?row.text:window.Calculations.format(row.value*(row.displayAsPercent?100:1))+(row.displayAsPercent?'%':'');
    return `<div>${escape(name.replace(/([a-z])([A-Z])/g,'$1 $2'))}: ${escape(value)}</div>`;
  });
  return rows.length?`<details class="ability-effect-values"><summary>Effect values</summary>${rows.join('')}</details>`:'';
}

function renderAlternateAbilityDps(spell, rank, slot) {
  const forms={JavelinToss:['Takedown','Cougar Q'],Bushwhack:['Pounce','Cougar W'],PrimalSurge:['Swipe','Cougar E'],
    JayceToTheSkies:['JayceShockBlast','Cannon Q'],JayceStaticField:['JayceHyperCharge','Cannon W'],JayceThunderingBlow:['JayceAccelerationGate','Cannon E'],
    EliseHumanQ:['EliseSpiderQCast','Spider Q'],EliseHumanW:['EliseSpiderW','Spider W'],EliseHumanE:['EliseSpiderE','Spider E'],
    GnarQ:['GnarBigQ','Mega Q'],GnarW:['GnarBigW','Mega W'],GnarE:['GnarBigE','Mega E']};
  const form=forms[spell.id];
  if(!form || !(rank>0))return '';
  const payload=BUILDER.cdragonAbilityData?.byAlias?.[canonicalizeToken(form[0])]?.payload;
  const loc=payload?.spellData?.mClientData?.mTooltipData?.mLocKeys;
  const raw=BUILDER.strings?.[loc?.keyTooltip?.toLowerCase()];
  if(!payload || !raw)return `<div class="ability-dps"><strong>${form[1]} DPS:</strong> Alternate form data unavailable</div>`;
  // Cougar skills scale with Aspect of the Cougar rather than their human skill ranks.
  const formRank=['Takedown','Pounce','Swipe'].includes(form[0])?Math.max(1,BUILDER.abilityRanks.r):rank;
  const alternate={...spell,id:form[0],tooltip:raw,cooldown:payload.spellData.cooldownTime?.slice(1)};
  const context=buildAbilityContext(alternate,formRank,slot);
  Object.assign(context,buildResolvedSpellPayload(payload,formRank,context.stats));
  const result=window.AbilityDps.profile({spell:alternate,rank:formRank,payload,
    tooltip:expandAbilityLocalization(raw),resolve:token=>resolveAbilityToken(token,context),
    cooldown:window.AbilityDps.cooldown(alternate,formRank,context.stats,payload)});
  return `<div class="ability-dps-form"><strong>${form[1]}</strong>${window.AbilityDps.render(result)}</div>`;
}

function renderAbilityCards() {
  const root = document.getElementById("abilityCards");
  const openControls = new Set(root.dataset.champion === BUILDER.selectedChampion ? [...root.querySelectorAll("[data-controls-slot][open]")].map(el=>el.dataset.controlsSlot) : []);
  root.dataset.champion = BUILDER.selectedChampion || "";
  if (!BUILDER.championData) {
    root.innerHTML = "<div class='ability-card'><p class='text-muted'>Select a champion to view abilities.</p></div>";
    document.getElementById("abilityRuleHint").textContent = "";
    return;
  }

  document.getElementById('attackSummary').replaceChildren();
  document.getElementById('attackSettings').replaceChildren();
  const champ = BUILDER.championData;
  const computed = computeDerivedBuildStats();
  const attack = computed ? computeAutoAttackProfile(computed) : null;
  const passiveText = buildDetailedPassiveText();
  const description = (slot,simple,detailed,values='') => `<div class="ability-description" data-description-slot="${slot}"><div class="simple-description">${simple||''}</div><div class="detailed-description" hidden>${detailed}${values}</div><button type="button" class="btn btn-sm detail-toggle" aria-expanded="false">Detailed view</button></div>`;
  const passive = `<div class="ability-card ability-passive-card" data-ability-slot="p"><div class="ability-head"><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/passive/${champ.passive.image.full}" alt="${champ.passive.name}"><strong>Passive - ${champ.passive.name}</strong></div>${description("p",champ.passive.description,passiveText,abilityEffectValues(BUILDER.cdragonAbilityData?.p,1))}<div class="ability-inputs"></div></div>`;
  const escapeAttack = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const attackNumber = (value, key) => `<span class="attack-result" data-attack-result="${key}" tabindex="0" title="${escapeAttack(attack.breakdown)}">${Number.isFinite(value) ? value.toFixed(1) + (attack.partial ? ' (partial)' : '') : 'Unavailable — see calculation'}</span>`;
  const attackCard = `<div class="ability-card ability-attack-card" data-ability-slot="attack"><div class="ability-head"><strong>Attack</strong></div>
  <div><strong>On-attack damage:</strong> ${attack ? attackNumber(attack.autoAttackDamage,'damage') : '-'}</div>
  <div><strong>On-Attack DPS:</strong> ${attack ? attackNumber(attack.attackDps,'dps') : '-'}</div>
  <div><strong>Attack Range:</strong> ${attack ? attack.attackRange.toFixed(1) : '-'}</div>
  <small>Average damage · before mitigation</small>
  <details class="dashboard-detail"><summary>Calculation breakdown</summary><div class="detail-content">${attack?.warnings.map(w=>`<p class="text-muted">${escapeAttack(w)}</p>`).join('')||''}
  <pre style="white-space:pre-wrap">${escapeAttack(attack?.breakdown||'Select a champion')}</pre></div></details></div>`;

  const spells = champ.spells.map((spell, i) => {
    const key = ["q", "w", "e", "r"][i];
    const max = abilityMaxByLevel(BUILDER.level, key);
    const opts = Array.from({ length: max + 1 }, (_, idx) => `<option value="${idx}">${idx}</option>`).join("");
    const rank = BUILDER.abilityRanks[key];
    const cdBase = parseByRank(spell.cooldownBurn, rank);
    const context = rank > 0 ? buildAbilityContext(spell, rank, key) : null;
    const cdNumeric = window.AbilityDps.cooldown(spell, rank, context?.stats, context?.cdragonSpell);
    const cd = cdNumeric !== null
      ? `${cdNumeric.toFixed(2)} (base ${Number(cdBase).toFixed(2)})`
      : cdBase;
    const cost = parseByRank(spell.costBurn, rank);
    const range = parseByRank(spell.rangeBurn, rank);
    const detail = buildDetailedAbilityText(spell, rank, key, context);
    let dps = window.AbilityDps.render(window.AbilityDps.profile({spell, rank, cooldown:cdNumeric,
      tooltip:expandAbilityLocalization(spell.tooltip || spell.description || ''),
      resolve:token=>resolveAbilityToken(token, context), payload:context?.cdragonSpell,
      timing:{delay:BUILDER.combatValues[`dps:${key}:delay`],overlap:BUILDER.combatValues[`dps:${key}:overlap`]}}));
    dps += renderAlternateAbilityDps(spell,rank,key);
    return `<div class="ability-card" data-ability-slot="${key}"><div class="ability-head"><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/spell/${spell.image.full}" alt="${spell.name}"><strong>${key.toUpperCase()} - ${spell.name}</strong></div><div class="ability-rank-row"><label class="label">Rank<select class="form-control" id="rank_${key}">${opts}</select></label></div>${description(key,spell.description,detail,abilityEffectValues(BUILDER.cdragonAbilityData?.[key],rank))}<div class="ability-inputs"></div><div class="ability-meta"><span><strong>Cooldown:</strong> ${cd}</span><span><strong>Cost:</strong> ${cost}</span><span><strong>Range:</strong> ${range}</span></div>${dps}</div>`;
  }).join("");

  const expanded = new Set(root.dataset.descriptionChampion === BUILDER.selectedChampion ? [...root.querySelectorAll('.detail-toggle[aria-expanded="true"]')].map(el=>el.parentElement.dataset.descriptionSlot) : []);
  root.dataset.descriptionChampion = BUILDER.selectedChampion;
  root.innerHTML = passive + attackCard + spells;
  root.querySelectorAll('.detail-toggle').forEach(button=>{
    const container=button.parentElement;
    const update=active=>{button.setAttribute('aria-expanded',String(active));button.textContent=active?'Simple view':'Detailed view';container.querySelector('.simple-description').hidden=active;container.querySelector('.detailed-description').hidden=!active;};
    update(expanded.has(container.dataset.descriptionSlot));
    button.addEventListener('click',()=>update(button.getAttribute('aria-expanded')!=='true'));
  });
  renderCombatInputs();
  for (const control of attack?.controls || []) {
    const card = root.querySelector(`[data-ability-slot="${control.slot}"]`);
    if (!card) continue;
    const wrapper = document.createElement('div'); wrapper.className = 'attack-control';
    const element = document.createElement(control.type === 'toggle' ? 'button' : control.type === 'select' ? 'select' : 'input');
    element.dataset.attackControl = control.key;
    if (control.type === 'toggle') {
      element.type = 'button'; element.className = 'btn btn-outline';
      element.disabled = !!control.disabled;
      const active = BUILDER.combatValues[control.key] === true && !control.disabled;
      element.setAttribute('aria-pressed', String(active));
      element.textContent = `${control.label}: ${active ? 'On' : 'Off'}`;
      element.addEventListener('click', () => { BUILDER.combatValues[control.key] = !active; renderStats(); renderAbilityCards(); });
      wrapper.append(element);
    } else if (control.type === 'select') {
      const label = document.createElement('label'); label.textContent = control.label + ' ';
      control.options.forEach((text, i) => { const option = document.createElement('option'); option.value = String(i); option.textContent = text; element.append(option); });
      element.value = String(BUILDER.combatValues[control.key] ?? 0);
      element.addEventListener('change', () => { BUILDER.combatValues[control.key] = Number(element.value); renderStats(); renderAbilityCards(); });
      label.append(element); wrapper.append(label);
    } else {
      const label = document.createElement('label'); label.textContent = control.label + ' ';
      element.type = 'number'; element.min = String(control.min ?? 0); element.step = 'any';
      if (control.max !== undefined) element.max = String(control.max);
      element.value = BUILDER.combatValues[control.key] ?? ''; element.placeholder = 'Enter value';
      element.addEventListener('change', () => {
        if (element.value.trim() && element.checkValidity() && Number.isFinite(Number(element.value))) BUILDER.combatValues[control.key] = Number(element.value);
        else delete BUILDER.combatValues[control.key];
        renderStats(); renderAbilityCards();
      });
      label.append(element); wrapper.append(label);
    }
    (control.slot === 'attack' || control.key.includes('target:') ? document.getElementById('attackSettings') : card).append(wrapper);
  }
  document.getElementById('attackSummary').append(root.querySelector('.ability-attack-card'));
  document.querySelector('.target-hint').textContent = document.getElementById('attackSettings').children.length ? 'Blank values remain unknown. Enable effects to show their inputs.' : 'No additional target inputs for this build.';
  root.querySelectorAll('.ability-card').forEach(card => {
    const controls = [...card.querySelectorAll(':scope > .attack-control')].filter(control => control.querySelector('input'));
    if (controls.length > 2) {
      const details = document.createElement('details'); details.className = 'dashboard-detail';
      details.dataset.controlsSlot = card.dataset.abilitySlot; details.open = openControls.has(card.dataset.abilitySlot);
      const summary = document.createElement('summary'); summary.textContent = 'Attack controls (' + controls.length + ')';
      const content = document.createElement('div'); content.className = 'detail-content';
      controls.forEach(control => content.append(control)); details.append(summary, content); card.append(details);
    }
  });
  ["q", "w", "e", "r"].forEach((k) => {
    const el = document.getElementById(`rank_${k}`);
    if (!el) return;
    el.value = String(BUILDER.abilityRanks[k]);
    el.addEventListener("change", () => {
      BUILDER.abilityRanks[k] = Number(el.value);
      enforceAbilityRules();
      renderStats();
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
    { name: "HP", icon: "❤️", value: hp, eq: `${base.hp.toFixed(1)} + ${base.hpperlevel.toFixed(1)}*${window.BuildStats.growthFactor(L).toFixed(3)} + ${item.hp.toFixed(1)} + ${rune.hp.toFixed(1)}` },
    { name: "MP", icon: "🔷", value: mp, eq: `${base.mp.toFixed(1)} + ${base.mpperlevel.toFixed(1)}*${window.BuildStats.growthFactor(L).toFixed(3)} + ${item.mp.toFixed(1)} + ${rune.mp.toFixed(1)}` },
    { name: "HP/5", icon: "💚", value: hp5, eq: `(${base.hpregen.toFixed(1)} + ${base.hpregenperlevel.toFixed(2)}*${window.BuildStats.growthFactor(L).toFixed(3)}) * (1 + ${item.hp5PctBase.toFixed(1)}%) + ${item.hp5.toFixed(1)} + ${rune.hp5.toFixed(1)}` },
    { name: "MP/5", icon: "💙", value: mp5, eq: `(${base.mpregen.toFixed(1)} + ${base.mpregenperlevel.toFixed(2)}*${window.BuildStats.growthFactor(L).toFixed(3)}) * (1 + ${item.mp5PctBase.toFixed(1)}%) + ${item.mp5.toFixed(1)} + ${rune.mp5.toFixed(1)}` },
    { name: "AD", icon: "🗡️", value: ad, eq: `${base.attackdamage.toFixed(1)} + ${base.attackdamageperlevel.toFixed(1)}*${window.BuildStats.growthFactor(L).toFixed(3)} + ${item.ad.toFixed(1)} + ${rune.ad.toFixed(1)} + passive(${passiveLedger.statMods.ad.toFixed(1)})` },
    { name: "AP", icon: "✨", value: ap, eq: `0 + ${item.ap.toFixed(1)} + ${rune.ap.toFixed(1)} + passive(${passiveLedger.statMods.ap.toFixed(1)})` },
    { name: "Range", icon: "🏹", value: attackRange, eq: `${(base.attackrange || 0).toFixed(1)} + ${item.attackRange.toFixed(1)} + ${rune.attackRange.toFixed(1)} + passive(${getChampionPassiveRangeBonus().toFixed(1)})` },
    { name: "AH", icon: "⏱️", value: abilityHaste, eq: `0 + ${item.haste.toFixed(1)} + ${rune.haste.toFixed(1)}` },
    { name: "Arm", icon: "🛡️", value: armor, eq: `${base.armor.toFixed(1)} + ${base.armorperlevel.toFixed(1)}*${window.BuildStats.growthFactor(L).toFixed(3)} + ${item.armor.toFixed(1)} + ${rune.armor.toFixed(1)}` },
    { name: "MR", icon: "🔮", value: mr, eq: `${base.spellblock.toFixed(1)} + ${base.spellblockperlevel.toFixed(1)}*${window.BuildStats.growthFactor(L).toFixed(3)} + ${item.mr.toFixed(1)} + ${rune.mr.toFixed(1)}` },
    { name: "AS", icon: "⚡", value: asTotal, eq: `${base.attackspeed.toFixed(3)} + ${(base.attackspeedratio || base.attackspeed).toFixed(3)} * (growth ${window.BuildStats.growthFactor(L).toFixed(3)} * ${base.attackspeedperlevel}% + ${(item.asPct + rune.asPct).toFixed(1)}%)` },
    { name: "MS", icon: "👟", value: moveSpeed, eq: `(${base.movespeed.toFixed(1)} + ${item.msFlat.toFixed(1)} + ${rune.msFlat.toFixed(1)}) * (1 + ${(item.msPct + rune.msPct).toFixed(1)}%)` },
    { name: "Crit %", icon: "🎯", value: critChance, eq: `${base.crit.toFixed(1)} + ${base.critperlevel.toFixed(1)}*${window.BuildStats.growthFactor(L).toFixed(3)} + ${item.critChance.toFixed(1)} + ${rune.critChance.toFixed(1)}` },
    { name: "Crit Dmg", icon: "💥", value: critDamage, eq: `${(base.critdamage ? base.critdamage * 100 : 200).toFixed(1)} + ${item.critDamage.toFixed(1)} + ${rune.critDamage.toFixed(1)}; champion modifier included in displayed value` },
    { name: "ARPen", icon: "🪓", value: 0, eq: `${item.arPenFlat.toFixed(1)} / ${item.arPenPct.toFixed(1)}%` },
    { name: "MRPen", icon: "🔹", value: 0, eq: `${item.mrPenFlat.toFixed(1)} / ${item.mrPenPct.toFixed(1)}%` },
    { name: "Lifesteal", icon: "🩸", value: 0, eq: `${item.physicalVamp.toFixed(1)}% / ${item.omniVamp.toFixed(1)}%` },
    { name: "Tenacity", icon: "🦶", value: 0, eq: `${(100 * (1 - (1 - item.tenacity / 100) * (1 - rune.tenacity / 100))).toFixed(1)}%` },
  ];

  const bonusKeys={HP:"hp",AD:"ad",AP:"ap",Arm:"armor",MR:"mr",AS:"asTotal",Range:"attackRange","Crit %":"critChance"};
  for(const row of rows){const bonus=computed.championBonuses?.[bonusKeys[row.name]];if(bonus)row.eq+=` + champion abilities (${bonus.toFixed(2)})`;}
  const tableHtml = renderPairedRows(rows.map((row) => {
    if (row.name === "ARPen") return { ...row, displayValue: `${item.arPenFlat.toFixed(1)}/${item.arPenPct.toFixed(1)}%` };
    if (row.name === "MRPen") return { ...row, displayValue: `${item.mrPenFlat.toFixed(1)}/${item.mrPenPct.toFixed(1)}%` };
    if (row.name === "Lifesteal") return { ...row, displayValue: `${(item.physicalVamp+(computed.championLifeSteal||0)).toFixed(1)}%/${item.omniVamp.toFixed(1)}%` };
    if (row.name === "Tenacity") return { ...row, displayValue: `${(100 * (1 - (1 - item.tenacity / 100) * (1 - rune.tenacity / 100))).toFixed(1)}%` };
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

  const renderShardIcon = (slotIndex) => {
    const rune = getRuneMeta(BUILDER.runeSelections.shards[slotIndex]);
    return `<button class="rune-grid-btn rune-shard-icon-btn is-active" data-rune-target="shard_${slotIndex}" data-desc="${escapeAttr(`${rune.name}: ${rune.desc || rune.name}`)}" aria-label="${rune.name}" type="button">${runeImgTag(rune)}</button>`;
  };
  const escapeAttr = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;");

  const renderPrimaryRuneGrid = () => {
    const rows = primaryPath.primaryRows || [];
    return `<div class="rune-subpanel-grid rune-subpanel-grid-primary">${rows.map((row, rowIndex) => `<div class="rune-choice-row">${row.map((runeId) => {
      const rune = getRuneMeta(runeId);
      const active = BUILDER.runeSelections.primary[rowIndex] === runeId ? "is-active" : "";
      return `<button class="rune-grid-btn ${active}" data-rune-choice-target="primary_${rowIndex}" data-rune-choice-id="${runeId}" data-desc="${escapeAttr(`${rune.name}: ${rune.desc}`)}" aria-label="${rune.name}">${runeImgTag(rune)}</button>`;
    }).join("")}</div>`).join("")}</div>`;
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
    return `<div class="rune-subpanel-grid">${rows.map((row) => `<div class="rune-choice-row">${row.map((runeId) => {
      const rune = getRuneMeta(runeId);
      const active = selected.has(runeId) ? "is-active" : "";
      return `<button class="rune-grid-btn ${active}" data-rune-choice-target="${getSecondaryChoiceTarget(runeId)}" data-rune-choice-id="${runeId}" data-desc="${escapeAttr(`${rune.name}: ${rune.desc}`)}" aria-label="${rune.name}">${runeImgTag(rune)}</button>`;
    }).join("")}</div>`).join("")}</div>`;
  };

  const renderSelectedRune = (id,target) => { const rune=getRuneMeta(id); return `<button type="button" class="rune-grid-btn is-active" data-rune-target="${target}" title="${escapeAttr(rune.name)}" aria-label="Change ${escapeAttr(rune.name)}">${runeImgTag(rune)}</button>`; };
  ensureSecondarySelectionsValid();

  root.innerHTML = `
    <div class="rune-column-block">
      <div class="rune-column-title"><button class='btn btn-sm rune-path-btn' data-rune-target="primaryPath_0"><img src="${primaryPath.icon}" alt="${primaryPath.name}"><span>${primaryPath.name}</span></button></div>
      ${renderPrimaryRuneGrid()}
    </div>
    <div class="rune-column-block">
      <div class="rune-column-title"><button class='btn btn-sm rune-path-btn' data-rune-target="secondaryPath_0"><img src="${secondaryPath.icon}" alt="${secondaryPath.name}"><span>${secondaryPath.name}</span></button></div>
      ${renderSecondaryRuneGrid()}
      <div class="rune-subpanel-grid rune-shard-icon-row">${[0,1,2].map(i=>getRuneOptions(`shard_${i}`).map(rune=>`<button type="button" class="rune-grid-btn ${BUILDER.runeSelections.shards[i]===rune.id?'is-active':''}" data-rune-choice-target="shard_${i}" data-rune-choice-id="${rune.id}" aria-label="${escapeAttr(rune.name)}" title="${escapeAttr(rune.name)}">${runeImgTag(rune)}</button>`).join('')).join('')}</div>
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
  if (!BUILDER.runeModalTarget) return;
  if (!getRuneOptions(BUILDER.runeModalTarget).some(option => option.id === id && !option.disabled)) return;
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

// Overlays keep the dashboard in place and support keyboard dismissal.
document.addEventListener('keydown', event => { if(event.key === 'Escape') document.querySelectorAll('.dashboard-detail[open]').forEach(detail => {detail.open=false;detail.querySelector('summary').focus();}); });
