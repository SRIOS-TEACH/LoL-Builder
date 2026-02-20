const LOOKUP_STATE = {
  version: "",
  items: [],
};

const SR_MAP_ID = 11;

async function initItemLookup() {
  const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then((r) => r.json());
  LOOKUP_STATE.version = versions[0];
  const itemJson = await fetch(`https://ddragon.leagueoflegends.com/cdn/${LOOKUP_STATE.version}/data/en_US/item.json`).then((r) => r.json());

  LOOKUP_STATE.items = Object.entries(itemJson.data)
    .filter(([, item]) => item.gold?.purchasable && item.maps?.[SR_MAP_ID] && !item.requiredAlly)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const tags = [...new Set(LOOKUP_STATE.items.flatMap((item) => item.tags || []))].sort((a, b) => a.localeCompare(b));
  document.getElementById("lookupTags").innerHTML = tags
    .map((tag) => `<label><input type="checkbox" value="${tag}" onchange="renderLookupItems()"/> ${tag}</label>`)
    .join("");

  document.getElementById("lookupSearch").addEventListener("input", renderLookupItems);
  renderLookupItems();
}

function renderLookupItems() {
  const query = document.getElementById("lookupSearch").value.toLowerCase().trim();
  const tags = Array.from(document.querySelectorAll('#lookupTags input:checked')).map((n) => n.value);

  const filtered = LOOKUP_STATE.items.filter((item) => {
    const nameMatch = !query || item.name.toLowerCase().includes(query);
    const tagMatch = !tags.length || tags.every((tag) => item.tags?.includes(tag));
    return nameMatch && tagMatch;
  });

  document.getElementById("lookupGrid").innerHTML = filtered
    .map(
      (item) => `<button type="button" class="item-pick" onclick="showItem('${item.id}')">
        <img src="https://ddragon.leagueoflegends.com/cdn/${LOOKUP_STATE.version}/img/item/${item.id}.png" alt="${item.name}"/>
        <span>${item.name}</span>
      </button>`
    )
    .join("");
}

function showItem(itemId) {
  const item = LOOKUP_STATE.items.find((entry) => entry.id === itemId);
  if (!item) return;

  const statLines = Object.entries(item.stats || {})
    .map(([k, v]) => `<li>${k}: ${v}</li>`)
    .join("");

  document.getElementById("itemName").textContent = item.name;
  document.getElementById("itemDescription").innerHTML = `
    <img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${LOOKUP_STATE.version}/img/item/${item.id}.png" alt="${item.name}"/>
    <div>${item.plaintext || item.description}</div>
    <div><strong>Cost:</strong> ${item.gold?.total || 0}</div>
    <ul>${statLines || '<li>No explicit stat block</li>'}</ul>
  `;
}
