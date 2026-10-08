import CatalogQueries from './domain/catalogQueries.js';
import STAT_ICONS from './presentation/statIcons.mjs';
import {SHOP_FILTER_GROUPS,SHOP_ROLES} from './presentation/shopFilters.mjs';
import ApiClient from './shared/apiClient.js';
import ItemLookupShared from './shared/itemData.js';
import CombatInputs from './shared/combatInputs.js';
/** Item Lookup page state and DOM rendering. Shared parsing lives in shared/itemData.js. */
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const ITEM_STATE = {
  combatValues:{},
  version: '', items: {}, filteredIds: [],
  itemRole: '', selectedTags: new Set(), selectedMaps: new Set([11]), selectedId: null,
};
const {
  MAP_OPTIONS, isPurchasableItem, resolveDescriptionFormulas, colorizeStatsInHtml,
  buildExtractedFormulas, emphasizeAbilityHeaders,
  enhanceActiveTooltip, inferActiveCooldownSeconds, injectActiveCooldown,
  loadCommunityDragonCalcs, injectItemCalculationValues,
} = ItemLookupShared;
async function initItemLookup() {
  if (!document.getElementById("itemSearch")) return;
  document.getElementById("itemCount").textContent = "Loading items...";
  try {
  ITEM_STATE.version = await ApiClient.fetchLatestVersion();
  document.getElementById('itemPatch').textContent = 'Patch ' + ITEM_STATE.version;
  const itemJson = await ApiClient.fetchItemIndex(ITEM_STATE.version);
  ITEM_STATE.items = Object.fromEntries(Object.entries(itemJson.data || {}).filter(([id, item]) => isPurchasableItem(id, item)));

  document.getElementById("itemSearch").addEventListener("input", applyItemFilters);
  document.getElementById("itemGrid").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-item-id]");
    if (!btn) return;
    showItem(btn.dataset.itemId);
    if (matchMedia('(max-width:700px)').matches) document.querySelector('.item-inspector').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
  });
  document.getElementById('resetItemFilters').addEventListener('click', () => {
    document.getElementById('itemSearch').value = '';
    document.querySelectorAll('#itemFilters button').forEach(button => button.setAttribute('aria-pressed','false'));
    ITEM_STATE.itemRole = '';
    document.querySelectorAll('#mapFilters input').forEach(input => input.checked = input.value === '11');
    applyItemFilters();
  });
  renderShopFilters();
  renderMapFilters("mapFilters", applyItemFilters);
  applyItemFilters();
  // Core browsing is usable while optional class/formula data loads.
  loadCommunityDragonCalcs().then(() => applyItemFilters()).catch(() => updateRoleFilters());
  } catch (error) {
    document.getElementById('itemPatch').textContent = 'Data unavailable';
    document.getElementById('itemGrid').innerHTML = '<p class="catalog-empty">The item catalog could not be loaded. Refresh to retry.</p>';
    console.warn("Item lookup failed", error);
    document.getElementById("itemCount").textContent = "Could not load items. Check your connection and refresh to retry.";
  }
}

/** Use the same role tabs and stat groups as the Builder's shop. */
function renderShopFilters() {
  const filters = document.getElementById('itemFilters');
  filters.innerHTML = SHOP_FILTER_GROUPS.map(([name,entries]) => `<div class="shop-filter-group" role="group" aria-label="${name}">${entries.map(([tag,label,stat]) => `<button type="button" class="shop-filter" data-item-filter="${tag}" aria-label="${label}" title="${label}" aria-pressed="false"><span class="stat-icon" aria-hidden="true">${STAT_ICONS[stat]}</span></button>`).join('')}</div>`).join('');
  filters.addEventListener('click',event => {
    const button = event.target.closest('[data-item-filter]');
    if (!button) return;
    button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));
    applyItemFilters();
  });
  const roles = document.getElementById('explorerItemRoles');
  roles.innerHTML = SHOP_ROLES.map(([name]) => `<button type="button" class="shop-category" data-item-role="${name}" aria-label="${name}" title="${name}" aria-pressed="false"><img src="assets/shop/${name.toLowerCase()}.png" alt=""><span>${name}</span></button>`).join('');
  roles.addEventListener('click',event => {
    const button = event.target.closest('[data-item-role]');
    if (!button || button.disabled) return;
    ITEM_STATE.itemRole = ITEM_STATE.itemRole===button.dataset.itemRole ? '' : button.dataset.itemRole;
    applyItemFilters();
  });
  document.getElementById('explorerAllItems').onclick = () => {ITEM_STATE.itemRole='';applyItemFilters();};
}
function updateRoleFilters() {
  const {status} = ItemLookupShared.getState();
  document.querySelectorAll('#explorerItemRoles button').forEach(button => {
    button.disabled = status !== 'ready';
    button.setAttribute('aria-pressed',String(ITEM_STATE.itemRole===button.dataset.itemRole));
    button.title = status==='ready' ? button.dataset.itemRole : button.dataset.itemRole+' — '+(status==='unavailable' ? 'class data unavailable' : 'loading item classes');
  });
  document.getElementById('explorerAllItems').setAttribute('aria-pressed',String(!ITEM_STATE.itemRole));
  document.getElementById('itemRoleStatus').textContent = status==='ready' ? '' : status==='unavailable' ? 'Role filters are unavailable. You can still search items and filter by stats.' : 'Loading role filters…';
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
 * Applies search/tag/map filters to item catalog and updates selection.
 */
function applyItemFilters() {
  ITEM_STATE.selectedTags = new Set([...document.querySelectorAll('#itemFilters [aria-pressed="true"]')].map(button => button.dataset.itemFilter));
  ITEM_STATE.selectedMaps = getSelectedMaps();
  updateRoleFilters();
  const roleValue = SHOP_ROLES.find(([name]) => name===ITEM_STATE.itemRole)?.[1];
  ITEM_STATE.filteredIds = CatalogQueries.queryItems(ITEM_STATE.items, {
    search:document.getElementById('itemSearch').value,
    tags:ITEM_STATE.selectedTags, maps:ITEM_STATE.selectedMaps, dedupe:true,
    sort:'price',shopTags:true,roleValue,advanced:ItemLookupShared.getState().cdragonById,
  });

  const stillSelected = ITEM_STATE.selectedId && ITEM_STATE.filteredIds.includes(ITEM_STATE.selectedId);
  if (!stillSelected) ITEM_STATE.selectedId = ITEM_STATE.filteredIds[0] || null;
  if (ITEM_STATE.selectedId) { renderItemGrid(); showItem(ITEM_STATE.selectedId); }
  else { renderItemGrid(); clearItemDetails(); }
}

/**
 * Renders filtered item buttons and result count.
 */
function renderItemGrid() {
  const grid = document.getElementById("itemGrid");
  document.getElementById("itemCount").textContent = `${ITEM_STATE.filteredIds.length} ${ITEM_STATE.filteredIds.length === 1 ? 'item' : 'items'}`;
  grid.innerHTML = ITEM_STATE.filteredIds.length ? ITEM_STATE.filteredIds.map((id) => {
    const item = ITEM_STATE.items[id];
    const selected = ITEM_STATE.selectedId === id;
    return `<button type="button" class="item-button-icon${selected ? ' item-button-selected' : ''}" data-item-id="${id}" aria-pressed="${selected}" aria-label="${escape(item.name)}" title="${escape(item.name)}"><img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/img/item/${id}.png" alt="" loading="lazy"><span class="item-catalog-name">${escape(item.name)}</span></button>`;
  }).join('') : '<p class="catalog-empty">No matching items.<br>Try another name or reset your filters.</p>';
}

/**
 * Clears item detail panel when no selected item exists.
 */
function clearItemDetails() {
  document.getElementById("combatInputs").replaceChildren();
  document.getElementById("itemName").textContent = "No item selected";
  document.getElementById("itemIcon").removeAttribute("src");
  document.getElementById("itemIcon").hidden = true;
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
  document.getElementById("itemIcon").hidden = false;
  document.querySelectorAll('#itemGrid [data-item-id]').forEach(button => {
    const selected = button.dataset.itemId === id;
    button.classList.toggle('item-button-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  const resolvedDescription = resolveDescriptionFormulas(item, item.description || "");
  const source=CombatInputs.itemSource(id,ItemLookupShared.getState().cdragonById[id],item.name);
  const base={level:1,rank:1,allowLevelInput:true,targetFormulaOnly:true};
  CombatInputs.render(document.getElementById('combatInputs'),{sources:[source],base,values:ITEM_STATE.combatValues,onChange:()=>showItem(id)});
  const { lines } = buildExtractedFormulas(id,CombatInputs.apply(base,ITEM_STATE.combatValues));
  const inferredCooldown = /<active>|<passive>|\bACTIVE\b|\(0s\)/i.test(item.description || "") ? inferActiveCooldownSeconds(id) : null;
  const withCooldown = injectActiveCooldown(resolvedDescription, inferredCooldown);
  const withDamage = injectItemCalculationValues(withCooldown, lines);
  const withHeaders = emphasizeAbilityHeaders(withDamage);
  const tooltipMain = colorizeStatsInHtml(enhanceActiveTooltip(withHeaders));

  document.getElementById("itemName").textContent = item.name;
  document.getElementById("itemIcon").src = `https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/img/item/${id}.png`;
  document.getElementById("itemCost").innerHTML = `${item.gold?.total ?? 0} gold <span class="explorer-muted">· Sells for ${item.gold?.sell ?? 0}</span>`;
  document.getElementById("itemMeta").innerHTML = (item.tags || []).map(tag => `<span>${escape(tag.replace(/([a-z])([A-Z])/g, '$1 $2'))}</span>`).join('');
  document.getElementById("itemTooltipMain").innerHTML = tooltipMain;
  const effects=document.createElement('details');effects.className='item-formulas';
  const heading=document.createElement('summary');heading.textContent='Effect calculations';effects.append(heading);
  for(const line of lines){const row=document.createElement('div');row.textContent=`${line.name}: ${line.formula}`;effects.append(row);}
  if(lines.length) document.getElementById('itemTooltipMain').append(effects);
}

document.addEventListener("DOMContentLoaded", initItemLookup);
