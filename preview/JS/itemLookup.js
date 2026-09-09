/** Item Lookup page state and DOM rendering. Shared parsing lives in shared/itemData.js. */
const ITEM_STATE = {
  version: '', items: {}, filteredIds: [], tags: new Set(),
  selectedTags: new Set(), selectedMaps: new Set([11]), selectedId: null,
};
const {
  MAP_OPTIONS, isPurchasableItem, resolveDescriptionFormulas, colorizeStatsInHtml,
  buildExtractedFormulas, injectDamageFormulaText, emphasizeAbilityHeaders,
  enhanceActiveTooltip, inferActiveCooldownSeconds, injectActiveCooldown,
  loadCommunityDragonCalcs,
} = window.ItemLookupShared;
function itemMatchesSelectedMaps(item) {
  return Array.from(ITEM_STATE.selectedMaps).some(id => item.maps?.[id]);
}
function dedupeByNameWithMapPriority(entries) {
  return window.ItemPolicy.dedupeByNameWithMapPriority(entries, ITEM_STATE.selectedMaps);
}

async function initItemLookup() {
  if (!document.getElementById("itemSearch")) return;
  document.getElementById("itemCount").textContent = "Loading items...";
  try {
  ITEM_STATE.version = await window.ApiClient.fetchLatestVersion();
  const itemJson = await window.ApiClient.fetchItemIndex(ITEM_STATE.version);
  ITEM_STATE.items = Object.fromEntries(Object.entries(itemJson.data || {}).filter(([id, item]) => isPurchasableItem(id, item)));

  await loadCommunityDragonCalcs();

  ITEM_STATE.tags = new Set();
  Object.values(ITEM_STATE.items).forEach((item) => (item.tags || []).forEach((tag) => ITEM_STATE.tags.add(tag)));

  document.getElementById("itemSearch").addEventListener("input", applyItemFilters);
  document.getElementById("itemGrid").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-item-id]");
    if (!btn) return;
    showItem(btn.dataset.itemId);
  });
  renderTagFilters("itemFilters", applyItemFilters);
  renderMapFilters("mapFilters", applyItemFilters);
  applyItemFilters();
  } catch (error) {
    console.warn("Item lookup failed", error);
    document.getElementById("itemCount").textContent = "Could not load items. Check your connection and refresh to retry.";
  }
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
    return `<button class="item-button-icon${selectedClass}" data-item-id="${id}" title="${item.name}" aria-label="${item.name}"><img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/img/item/${id}.png" alt="${item.name}"></button>`;
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
  const { lines } = buildExtractedFormulas(id);
  const inferredCooldown = /<active>|\bACTIVE\b|\(0s\)/i.test(item.description || "") ? inferActiveCooldownSeconds(id) : null;
  const withCooldown = injectActiveCooldown(resolvedDescription, inferredCooldown);
  const withDamage = injectDamageFormulaText(withCooldown, lines, id);
  const withHeaders = emphasizeAbilityHeaders(withDamage);
  const tooltipMain = colorizeStatsInHtml(enhanceActiveTooltip(withHeaders));



  document.getElementById("itemName").textContent = item.name;
  document.getElementById("itemIcon").src = `https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/img/item/${id}.png`;
  document.getElementById("itemCost").innerHTML = `<strong>Cost:</strong> ${item.gold?.total ?? 0}g`;
  document.getElementById("itemMeta").innerHTML = `<strong>Tags:</strong> ${(item.tags || []).join(", ") || "-"}`;
  document.getElementById("itemTooltipMain").innerHTML = tooltipMain;
}

document.addEventListener("DOMContentLoaded", initItemLookup);
