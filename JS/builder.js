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
function isSummonersRiftItem(item) {
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
    if (!isSummonersRiftItem(item)) return;
    BUILDER.items[id] = item;
    (item.tags || []).forEach((tag) => BUILDER.itemTags.add(tag));
  });
}

/**
 * Renders champion dropdown options and wires champion-change handling.
 */
function renderChampionSelect() {
  const select = document.getElementById("builderChampion");
  const names = Object.keys(BUILDER.champions).sort((a, b) => a.localeCompare(b));
  select.innerHTML = names.map((n) => `<option value="${n}">${n}</option>`).join("");
  select.addEventListener("change", () => setChampion(select.value));
  setChampion(names[0]);
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

  document.getElementById("builderSplash").src = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg`;
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
    .map((_, i) => `<button class="item-slot-btn" onclick="openItemModal(${i})">Slot ${i + 1}: <span id="slotText${i}">Empty</span></button>`)
    .join("");
  refreshSlotLabels();
}

/**
 * Refreshes item slot labels/icons based on currently selected item ids.
 */
function refreshSlotLabels() {
  BUILDER.itemSlots.forEach((id, i) => {
    const text = id ? BUILDER.items[id].name : "Empty";
    document.getElementById(`slotText${i}`).textContent = text;
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

  const ids = Object.entries(BUILDER.items)
    .filter(([, item]) => {
      const nameOk = !text || item.name.toLowerCase().includes(text);
      const tagOk = !tags.size || Array.from(tags).every((t) => item.tags?.includes(t));
      return nameOk && tagOk;
    })
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([id]) => id);

  document.getElementById("modalResultsCount").textContent = `${ids.length} items shown`;
  document.getElementById("modalItemGrid").innerHTML =
    `<button class="btn btn-sm mb-10" onclick="setSlotItem('')">Clear slot</button>` +
    ids
      .map(
        (id) => `<button class="item-button" onclick="setSlotItem('${id}')">
          <img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${id}.png" alt="${BUILDER.items[id].name}">
          <span>${BUILDER.items[id].name}</span>
        </button>`
      )
      .join("");
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
    totals.haste += s.FlatHasteMod || 0;
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
  const stats = {
    Health: scale(base.hp, base.hpperlevel, L) + item.hp,
    Mana: scale(base.mp, base.mpperlevel, L) + item.mp,
    AD: scale(base.attackdamage, base.attackdamageperlevel, L) + item.ad,
    AP: item.ap,
    Armor: scale(base.armor, base.armorperlevel, L) + item.armor,
    MR: scale(base.spellblock, base.spellblockperlevel, L) + item.mr,
    "Attack Speed": base.attackspeed * (1 + (base.attackspeedperlevel * (L - 1)) / 100) * (1 + item.asPct / 100),
    "Ability Haste": item.haste,
  };

  document.getElementById("statsGrid").innerHTML = Object.entries(stats)
    .map(([k, v]) => `<div class="stat-pill"><strong>${k}</strong><br>${v.toFixed(k === "Attack Speed" ? 3 : 1)}</div>`)
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
