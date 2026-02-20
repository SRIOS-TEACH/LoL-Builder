const ITEM_STATE = { version: "", items: {}, filteredIds: [], tags: new Set(), selectedTags: new Set() };

function isSummonersRiftItem(item) {
  return item.gold?.purchasable && item.maps?.[11] && !item.requiredAlly;
}

async function initItemLookup() {
  const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then((r) => r.json());
  ITEM_STATE.version = versions[0];
  const itemJson = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/data/en_US/item.json`).then((r) => r.json());

  Object.entries(itemJson.data).forEach(([id, item]) => {
    if (!isSummonersRiftItem(item)) return;
    ITEM_STATE.items[id] = item;
    (item.tags || []).forEach((tag) => ITEM_STATE.tags.add(tag));
  });

  const search = document.getElementById("itemSearch");
  search.addEventListener("input", applyItemFilters);

  renderTagFilters("itemFilters", applyItemFilters);
  applyItemFilters();
}

function renderTagFilters(targetId, onChange) {
  const root = document.getElementById(targetId);
  root.innerHTML = Array.from(ITEM_STATE.tags)
    .sort((a, b) => a.localeCompare(b))
    .map((tag) => `<label class="tag-pill"><input type="checkbox" value="${tag}" class="tag-checkbox"> ${tag}</label>`)
    .join("");

  root.querySelectorAll(".tag-checkbox").forEach((cb) => {
    cb.addEventListener("change", onChange);
  });
}

function getSelectedTags(rootId) {
  return new Set(Array.from(document.querySelectorAll(`#${rootId} .tag-checkbox:checked`)).map((cb) => cb.value));
}

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

  const grid = document.getElementById("itemGrid");
  grid.innerHTML = ITEM_STATE.filteredIds
    .map((id) => `<button class="item-button" onclick="showItem('${id}')">
      <img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/img/item/${id}.png" alt="${ITEM_STATE.items[id].name}">
      <span>${ITEM_STATE.items[id].name}</span>
    </button>`)
    .join("");

  if (ITEM_STATE.filteredIds.length && !document.getElementById("itemName").dataset.selected) {
    showItem(ITEM_STATE.filteredIds[0]);
  }
}

function showItem(id) {
  const item = ITEM_STATE.items[id];
  document.getElementById("itemName").dataset.selected = id;
  document.getElementById("itemName").textContent = item.name;
  document.getElementById("itemIcon").src = `https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/img/item/${id}.png`;
  document.getElementById("itemMeta").innerHTML = `<strong>Cost:</strong> ${item.gold.total}g | <strong>Sell:</strong> ${item.gold.sell}g`;
  document.getElementById("itemDescription").innerHTML = item.description;
}
