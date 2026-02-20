const ITEM_STATE = {
  version: "",
  items: {},
  filteredIds: [],
  tags: new Set(),
  selectedTags: new Set(),
  selectedId: null,
};

function isSummonersRiftItem(item) {
  return item.gold?.purchasable && item.maps?.[11] && !item.requiredAlly;
}

function dedupeByNameKeepingLatest(itemEntries) {
  const byName = {};
  itemEntries.forEach(([id, item]) => {
    const key = item.name.trim().toLowerCase();
    const current = byName[key];
    if (!current || Number(id) > Number(current.id)) {
      byName[key] = { id, item };
    }
  });
  return Object.values(byName).map(({ id, item }) => [id, item]);
}

async function initItemLookup() {
  const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then((r) => r.json());
  ITEM_STATE.version = versions[0];
  const itemJson = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/data/en_US/item.json`).then((r) => r.json());

  const srItems = Object.entries(itemJson.data).filter(([, item]) => isSummonersRiftItem(item));
  const deduped = dedupeByNameKeepingLatest(srItems);

  deduped.forEach(([id, item]) => {
    ITEM_STATE.items[id] = item;
    (item.tags || []).forEach((tag) => ITEM_STATE.tags.add(tag));
  });

  document.getElementById("itemSearch").addEventListener("input", applyItemFilters);
  renderTagFilters("itemFilters", applyItemFilters);
  applyItemFilters();
}

function renderTagFilters(targetId, onChange) {
  const root = document.getElementById(targetId);
  root.innerHTML = Array.from(ITEM_STATE.tags)
    .sort((a, b) => a.localeCompare(b))
    .map((tag) => `<label class="tag-pill"><input type="checkbox" value="${tag}" class="tag-checkbox"> ${tag}</label>`)
    .join("");

  root.querySelectorAll(".tag-checkbox").forEach((cb) => cb.addEventListener("change", onChange));
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

  renderItemGrid();

  const stillExists = ITEM_STATE.selectedId && ITEM_STATE.filteredIds.includes(ITEM_STATE.selectedId);
  if (!stillExists) {
    ITEM_STATE.selectedId = ITEM_STATE.filteredIds[0] || null;
  }

  if (ITEM_STATE.selectedId) {
    showItem(ITEM_STATE.selectedId);
  } else {
    clearItemDetails();
  }
}

function renderItemGrid() {
  const grid = document.getElementById("itemGrid");
  document.getElementById("itemCount").textContent = `${ITEM_STATE.filteredIds.length} items`;

  grid.innerHTML = ITEM_STATE.filteredIds
    .map((id) => {
      const item = ITEM_STATE.items[id];
      const selectedClass = ITEM_STATE.selectedId === id ? " item-button-selected" : "";
      return `<button class="item-button-icon${selectedClass}" onclick="showItem('${id}')" title="${item.name}" aria-label="${item.name}">
        <img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/img/item/${id}.png" alt="${item.name}">
      </button>`;
    })
    .join("");
}

function clearItemDetails() {
  document.getElementById("itemName").textContent = "No item selected";
  document.getElementById("itemIcon").removeAttribute("src");
  document.getElementById("itemMeta").textContent = "";
  document.getElementById("itemDescription").textContent = "Try changing search or filters.";
}

function showItem(id) {
  const item = ITEM_STATE.items[id];
  if (!item) return;

  ITEM_STATE.selectedId = id;
  renderItemGrid();

  document.getElementById("itemName").textContent = item.name;
  document.getElementById("itemIcon").src = `https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/img/item/${id}.png`;
  document.getElementById("itemMeta").innerHTML = `<strong>Cost:</strong> ${item.gold.total}g <br><strong>Sell:</strong> ${item.gold.sell}g <br><strong>Tags:</strong> ${(item.tags || []).join(", ")}`;
  document.getElementById("itemDescription").innerHTML = item.description;
}
