/**
 * Builder page controller.
 *
 * Responsibilities:
 * - Champion/level/item selection state.
 * - Item modal search + tag filtering UX.
 * - Ability-rank validation by level constraints.
 * - Aggregate base+item stats and render summary cards.
 *
 * Flow:
 * 1) `initBuilder` loads patch data, champions, and item catalog.
 * 2) User selects champion/level/items, then `enforceAbilityRules` keeps ranks valid.
 * 3) Stat + ability panels are re-rendered from combined champion and item state.
 */
const BUILDER = {
  version: "",
  champions: {},
  items: {},
  selectedChampion: "",
  championData: null,
  level: 1,
  abilityRanks: { q: 1, w: 0, e: 0, r: 0 },
  itemSlots: Array(6).fill(""),
  activeSlot: null,
  itemTags: new Set(),
  champTags: new Set(),
  modalItemFiltered: [],
  modalChampFiltered: [],
};

/**
 * Writes a builder status message and toggles error styling when needed.
 */
function setStatus(message, isError = false) {
  const el = document.getElementById("builderStatus");
  el.textContent = message;
  el.classList.toggle("status-error", isError);
}

/**
 * Initializes Builder page data, selectors, modal wiring, and default render state.
 */
async function initBuilder() {
  try {
    setStatus("Loading champion and item data...");
    wireLevelOptions();
    await loadBuilderData();
    renderChampionSelect();
    renderItemSlots();
    initItemModal();
    initChampionModal();
    setStatus("Data loaded successfully.");
  } catch (error) {
    console.error(error);
    setStatus("Failed to load data. Check internet connection and refresh.", true);
  }
}

/**
 * Builds level dropdown options and wires level-change refresh behavior.
 */
function wireLevelOptions() {
  const level = document.getElementById("builderLevel");
  level.innerHTML = Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  level.addEventListener("change", () => {
    BUILDER.level = Number(level.value);
    enforceAbilityRules();
    renderAbilityControls();
    renderAbilityCards();
    renderStats();
  });
}

/**
 * Returns true when an item can be bought on Summoner's Rift.
 */
function isSummonersRiftItem(id, item) {
  if (["3040", "3042", "3121"].includes(String(id))) return true;
  return item.gold?.purchasable && item.maps?.[11] && !item.requiredAlly;
}

/**
 * Loads latest patch metadata, champion index, and item catalog for builder usage.
 */
async function loadBuilderData() {
  const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then((r) => r.json());
  BUILDER.version = versions[0];

  const champions = await fetch(`https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/data/en_US/champion.json`).then((r) => r.json());
  BUILDER.champions = champions.data;

  const items = await fetch(`https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/data/en_US/item.json`).then((r) => r.json());
  Object.entries(items.data).forEach(([id, item]) => {
    if (!isSummonersRiftItem(id, item)) return;
    BUILDER.items[id] = item;
    (item.tags || []).forEach((tag) => BUILDER.itemTags.add(tag));
  });
}

/**
 * Renders champion dropdown options and wires champion-change handling.
 */
function renderChampionSelect() {
  const names = Object.keys(BUILDER.champions).sort((a, b) => a.localeCompare(b));
  names.forEach((name) => {
    const champ = BUILDER.champions[name];
    (champ.tags || []).forEach((tag) => BUILDER.champTags.add(tag));
  });
  initChampionModal();
  setChampion(names[0]);
}

/**
 * Initializes champion picker modal search/filter wiring.
 */
function initChampionModal() {
  const modal = document.getElementById("champModal");
  if (!modal) return;

  document.getElementById("modalChampSearch").addEventListener("input", renderChampionModalGrid);
  modal.addEventListener("click", (event) => {
    if (event.target.id === "champModal") closeChampionModal();
  });

  const root = document.getElementById("modalChampFilters");
  root.innerHTML = Array.from(BUILDER.champTags)
    .sort((a, b) => a.localeCompare(b))
    .map((tag) => `<label class="tag-pill"><input type="checkbox" class="champ-tag" value="${tag}"> ${tag}</label>`)
    .join("");
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
      const nameOk = !text || name.toLowerCase().includes(text);
      const tagOk = !tags.size || Array.from(tags).every((t) => c.tags?.includes(t));
      return nameOk && tagOk;
    })
    .sort((a, b) => a.localeCompare(b));

  document.getElementById("modalChampResults").textContent = `${BUILDER.modalChampFiltered.length} champions`;
  document.getElementById("modalChampGrid").innerHTML = BUILDER.modalChampFiltered
    .map((name) => `<button class="item-button-icon" onclick="setChampionFromModal('${name.replace("'", "\'")}')" title="${name}"><img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${BUILDER.champions[name].image.full}" alt="${name}"></button>`)
    .join("");

  const pick = BUILDER.modalChampFiltered[0];
  renderChampionModalDetail(pick || null);
}

function renderChampionModalDetail(name) {
  const root = document.getElementById("modalChampDetail");
  if (!name) {
    root.innerHTML = "<p class='text-muted'>No champion found.</p>";
    return;
  }
  const c = BUILDER.champions[name];
  root.innerHTML = `<h3>${name}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${c.image.full}' alt='${name}'><p><strong>Tags:</strong> ${(c.tags||[]).join(", ")}</p><p><strong>Title:</strong> ${c.title}</p><p>${c.blurb}</p>`;
}

function setChampionFromModal(name) {
  setChampion(name);
  closeChampionModal();
}

/**
 * Loads selected champion details and refreshes splash, stats, abilities, and controls.
 */
async function setChampion(name) {
  const details = await fetch(`https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/data/en_US/champion/${name}.json`).then((r) => r.json());
  BUILDER.selectedChampion = name;
  BUILDER.championData = details.data[name];
  BUILDER.level = Number(document.getElementById("builderLevel").value) || 1;
  BUILDER.abilityRanks = { q: 1, w: 0, e: 0, r: 0 };

  const splashUrl = `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg)`;
  document.getElementById("builderHeroCard").style.setProperty("--champ-splash-url", splashUrl);
  document.body.style.setProperty("--builder-splash-url", splashUrl);
  document.getElementById("championPickerBtn").textContent = name;
  enforceAbilityRules();
  renderAbilityControls();
  renderAbilityCards();
  renderStats();
}

/**
 * Creates clickable item slot UI for opening the item-selection modal.
 */
function renderItemSlots() {
  const root = document.getElementById("itemSlots");
  root.innerHTML = BUILDER.itemSlots
    .map((_, i) => `<button class="item-slot-btn" onclick="openItemModal(${i})"><div class="item-slot-label">${i + 1}</div><div id="slotText${i}" class="item-slot-empty">+</div></button>`)
    .join("");
  refreshSlotLabels();
}

/**
 * Refreshes item slot labels/icons based on currently selected item ids.
 */
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

/**
 * Wires modal search/filter controls and close/cancel interactions.
 */
function initItemModal() {
  renderBuilderTagFilters();
  document.getElementById("modalItemSearch").addEventListener("input", renderModalItemGrid);
  document.getElementById("itemModal").addEventListener("click", (event) => {
    if (event.target.id === "itemModal") closeItemModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeItemModal();
  });
}

/**
 * Resets modal search text and selected tag filters before re-rendering item grid.
 */
function clearModalFilters() {
  document.getElementById("modalItemSearch").value = "";
  document.querySelectorAll(".modal-tag").forEach((cb) => {
    cb.checked = false;
  });
  renderModalItemGrid();
}

/**
 * Renders modal tag filters derived from current builder item data.
 */
function renderBuilderTagFilters() {
  const root = document.getElementById("modalItemFilters");
  root.innerHTML = Array.from(BUILDER.itemTags)
    .sort((a, b) => a.localeCompare(b))
    .map((tag) => `<label class="tag-pill"><input type="checkbox" class="modal-tag" value="${tag}"> ${tag}</label>`)
    .join("");
  root.querySelectorAll(".modal-tag").forEach((cb) => cb.addEventListener("change", renderModalItemGrid));
}

/**
 * Opens the item modal for a specific slot and renders available filtered items.
 */
function openItemModal(slot) {
  BUILDER.activeSlot = slot;
  document.getElementById("itemModalTitle").textContent = `Select Item for Slot ${slot + 1}`;
  document.getElementById("itemModal").classList.remove("hidden");
  renderModalItemGrid();
}

/**
 * Closes item modal and clears active slot tracking.
 */
function closeItemModal() {
  document.getElementById("itemModal").classList.add("hidden");
  BUILDER.activeSlot = null;
}

/**
 * Renders modal item candidates after applying current search and tag filters.
 */
function renderModalItemGrid() {
  const text = document.getElementById("modalItemSearch").value.trim().toLowerCase();
  const tags = new Set(Array.from(document.querySelectorAll(".modal-tag:checked")).map((cb) => cb.value));

  BUILDER.modalItemFiltered = Object.entries(BUILDER.items)
    .filter(([, item]) => {
      const nameOk = !text || item.name.toLowerCase().includes(text);
      const tagOk = !tags.size || Array.from(tags).every((t) => item.tags?.includes(t));
      return nameOk && tagOk;
    })
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([id]) => id);

  const ids = BUILDER.modalItemFiltered;
  document.getElementById("modalResultsCount").textContent = `${ids.length} items shown`;
  document.getElementById("modalItemGrid").innerHTML = ids
    .map((id) => `<button class="item-button-icon" onclick="previewAndSelectItem('${id}')" title="${BUILDER.items[id].name}"><img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${id}.png" alt="${BUILDER.items[id].name}"></button>`)
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
  const statLines = Object.entries(item.stats || {})
    .filter(([, v]) => Number(v) !== 0)
    .map(([k, v]) => `<div>${k}: ${v}</div>`)
    .join("");
  root.innerHTML = `<h3>${item.name}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${id}.png' alt='${item.name}'><p><strong>Cost:</strong> ${item.gold?.total ?? 0}g</p><div>${statLines}</div><div class='mt-10'>${item.description || ""}</div><p class='mt-10'><strong>Tags:</strong> ${(item.tags || []).join(", ")}</p><button class='btn btn-sm mt-10' onclick="setSlotItem('${id}')">Select this item</button><button class='btn btn-sm mt-10 ml-5' onclick="setSlotItem('')">Clear slot</button>`;
}

function previewAndSelectItem(id) {
  renderModalItemDetail(id);
}

/**
 * Assigns an item id to the active slot, then refreshes labels and computed stats.
 */
function setSlotItem(itemId) {
  if (BUILDER.activeSlot === null) return;
  BUILDER.itemSlots[BUILDER.activeSlot] = itemId;
  refreshSlotLabels();
  renderStats();
  closeItemModal();
}

/**
 * Returns max legal rank for an ability key at the current champion level.
 */
function abilityMaxByLevel(level, spellKey) {
  if (spellKey === "r") {
    if (level >= 16) return 3;
    if (level >= 11) return 2;
    if (level >= 6) return 1;
    return 0;
  }
  return Math.min(5, Math.ceil(level / 2));
}

/**
 * Clamps ability ranks so totals and per-skill maxima remain legal for the level.
 */
function enforceAbilityRules() {
  const totalAllowed = BUILDER.level;
  ["q", "w", "e", "r"].forEach((k) => {
    BUILDER.abilityRanks[k] = Math.min(BUILDER.abilityRanks[k], abilityMaxByLevel(BUILDER.level, k));
  });

  let total = Object.values(BUILDER.abilityRanks).reduce((sum, rank) => sum + rank, 0);
  while (total > totalAllowed) {
    const keys = ["q", "w", "e", "r"].sort((a, b) => BUILDER.abilityRanks[b] - BUILDER.abilityRanks[a]);
    const pick = keys.find((k) => BUILDER.abilityRanks[k] > 0);
    BUILDER.abilityRanks[pick] -= 1;
    total -= 1;
  }
}

/**
 * Renders ability rank selectors and wires changes through validation and refresh.
 */
function renderAbilityControls() {
  const root = document.getElementById("abilityRankControls");
  root.innerHTML = ["q", "w", "e", "r"]
    .map((k) => {
      const max = abilityMaxByLevel(BUILDER.level, k);
      const options = Array.from({ length: max + 1 }, (_, i) => `<option value="${i}">${i}</option>`).join("");
      return `<div class="col-lg-3 col-6"><label class="label">${k.toUpperCase()} Rank<select class="form-control" id="rank_${k}">${options}</select></label></div>`;
    })
    .join("");

  ["q", "w", "e", "r"].forEach((k) => {
    const el = document.getElementById(`rank_${k}`);
    el.value = String(BUILDER.abilityRanks[k]);
    el.addEventListener("change", () => {
      BUILDER.abilityRanks[k] = Number(el.value);
      enforceAbilityRules();
      renderAbilityControls();
      renderAbilityCards();
    });
  });

  document.getElementById("abilityRuleHint").textContent = `At level ${BUILDER.level}: basic abilities max ${abilityMaxByLevel(BUILDER.level, "q")}, R max ${abilityMaxByLevel(BUILDER.level, "r")}, total points available ${BUILDER.level}.`;
}

/**
 * Aggregates additive stats from all selected items into a single stats object.
 */
function getItemStats() {
  const totals = { hp: 0, mp: 0, ad: 0, ap: 0, armor: 0, mr: 0, haste: 0, asPct: 0 };
  BUILDER.itemSlots.forEach((id) => {
    if (!id) return;
    const s = BUILDER.items[id].stats || {};
    totals.hp += s.FlatHPPoolMod || 0;
    totals.mp += s.FlatMPPoolMod || 0;
    totals.ad += s.FlatPhysicalDamageMod || 0;
    totals.ap += s.FlatMagicDamageMod || 0;
    totals.armor += s.FlatArmorMod || 0;
    totals.mr += s.FlatSpellBlockMod || 0;
    totals.haste += Number(s.FlatHasteMod || s.FlatAbilityHasteMod || s.AbilityHaste || s.FlatCooldownReduction || 0);
    totals.asPct += (s.PercentAttackSpeedMod || 0) * 100;
  });
  return totals;
}

/**
 * Computes level-scaled base stat growth using Riot's per-level scaling formula.
 */
function scale(base, perLevel, level) {
  return base + perLevel * (level - 1);
}

/**
 * Calculates and renders current champion + item stats into summary cards.
 */
function renderStats() {
  if (!BUILDER.championData) return;
  const base = BUILDER.championData.stats;
  const item = getItemStats();
  const L = BUILDER.level;

  const hpBase = Number(base.hp.toFixed(1));
  const hpGrowth = Number((base.hpperlevel * (L - 1)).toFixed(1));
  const hpTotal = hpBase + hpGrowth + item.hp;

  const mpBase = Number(base.mp.toFixed(1));
  const mpGrowth = Number((base.mpperlevel * (L - 1)).toFixed(1));
  const mpTotal = mpBase + mpGrowth + item.mp;

  const adBase = Number(base.attackdamage.toFixed(1));
  const adGrowth = Number((base.attackdamageperlevel * (L - 1)).toFixed(1));
  const adTotal = adBase + adGrowth + item.ad;

  const armorBase = Number(base.armor.toFixed(1));
  const armorGrowth = Number((base.armorperlevel * (L - 1)).toFixed(1));
  const armorTotal = armorBase + armorGrowth + item.armor;

  const mrBase = Number(base.spellblock.toFixed(1));
  const mrGrowth = Number((base.spellblockperlevel * (L - 1)).toFixed(1));
  const mrTotal = mrBase + mrGrowth + item.mr;

  const asBase = base.attackspeed;
  const asGrowthMult = 1 + (base.attackspeedperlevel * (L - 1)) / 100;
  const asItemMult = 1 + item.asPct / 100;
  const asTotal = asBase * asGrowthMult * asItemMult;

  const rows = [
    { name: "Health", value: hpTotal, eq: `${hpBase} + ${base.hpperlevel.toFixed(1)}*${L - 1} + ${item.hp} = ${hpTotal.toFixed(1)}` },
    { name: "Mana", value: mpTotal, eq: `${mpBase} + ${base.mpperlevel.toFixed(1)}*${L - 1} + ${item.mp} = ${mpTotal.toFixed(1)}` },
    { name: "AD", value: adTotal, eq: `${adBase} + ${base.attackdamageperlevel.toFixed(1)}*${L - 1} + ${item.ad} = ${adTotal.toFixed(1)}` },
    { name: "AP", value: item.ap, eq: `0 + ${item.ap} = ${item.ap.toFixed(1)}` },
    { name: "Armor", value: armorTotal, eq: `${armorBase} + ${base.armorperlevel.toFixed(1)}*${L - 1} + ${item.armor} = ${armorTotal.toFixed(1)}` },
    { name: "MR", value: mrTotal, eq: `${mrBase} + ${base.spellblockperlevel.toFixed(1)}*${L - 1} + ${item.mr} = ${mrTotal.toFixed(1)}` },
    { name: "Attack Speed", value: asTotal, eq: `${asBase.toFixed(3)} * ${asGrowthMult.toFixed(3)} * ${asItemMult.toFixed(3)} = ${asTotal.toFixed(3)}` },
    { name: "Ability Haste", value: item.haste, eq: `0 + ${item.haste} = ${item.haste.toFixed(1)}` },
  ];

  document.getElementById("statsGrid").innerHTML = rows
    .map((r) => {
      const className = `stat-name-${r.name.toLowerCase().replace(/\s+/g, "-")}`;
      const precision = r.name === "Attack Speed" ? 3 : 1;
      return `<div class="stat-pill"><strong class="${className}">${r.name}</strong><br><span class="stat-value">${r.value.toFixed(precision)}</span><div class='stat-eq'>${r.eq}</div></div>`;
    })
    .join("");
}

/**
 * Renders champion passive and spell cards with current rank highlights.
 */
function renderAbilityCards() {
  if (!BUILDER.championData) return;
  const champ = BUILDER.championData;
  const passive = `<div class="ability-card"><strong>Passive - ${champ.passive.name}</strong><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/passive/${champ.passive.image.full}" alt="${champ.passive.name}"><p>${champ.passive.description}</p></div>`;

  const spells = champ.spells
    .map((spell, i) => {
      const key = ["q", "w", "e", "r"][i];
      const rank = BUILDER.abilityRanks[key];
      return `<div class="ability-card"><strong>${key.toUpperCase()} (Rank ${rank}) - ${spell.name}</strong><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/spell/${spell.image.full}" alt="${spell.name}"><p>${spell.description}</p><div><strong>Cooldown:</strong> ${spell.cooldownBurn}</div><div><strong>Cost:</strong> ${spell.costBurn || "No cost"}</div><div><strong>Range:</strong> ${spell.rangeBurn}</div></div>`;
    })
    .join("");

  document.getElementById("abilityCards").innerHTML = passive + spells;
}
