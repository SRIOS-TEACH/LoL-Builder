const APP_STATE = {
  version: "",
  champions: {},
  items: {},
  championKey: "",
  championData: null,
  itemSlots: Array(6).fill(""),
  abilityLevels: { q: 1, w: 1, e: 1, r: 1 },
  level: 1,
  modalSlot: 0,
  itemPool: [],
};

const MAP_SUMMONERS_RIFT = 11;

async function initBuilderApp() {
  await loadStaticData();
  initLevelSelector();
  renderChampionSelector();
  initItemModal();
  renderItemSlots();
  APP_STATE.championKey = Object.keys(APP_STATE.champions).sort((a, b) => a.localeCompare(b))[0];
  document.getElementById("championSelect").value = APP_STATE.championKey;
  await loadChampion(APP_STATE.championKey);
}

async function loadStaticData() {
  const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then((r) => r.json());
  APP_STATE.version = versions[0];
  const champData = await fetch(`https://ddragon.leagueoflegends.com/cdn/${APP_STATE.version}/data/en_US/champion.json`).then((r) => r.json());
  APP_STATE.champions = champData.data;
  const itemData = await fetch(`https://ddragon.leagueoflegends.com/cdn/${APP_STATE.version}/data/en_US/item.json`).then((r) => r.json());
  APP_STATE.items = itemData.data;
  APP_STATE.itemPool = Object.entries(APP_STATE.items)
    .filter(([, item]) => item.gold?.purchasable && item.maps?.[MAP_SUMMONERS_RIFT] && !item.requiredAlly)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function initLevelSelector() {
  const level = document.getElementById("championLevel");
  level.innerHTML = Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  level.addEventListener("change", () => {
    APP_STATE.level = Number(level.value);
    clampAbilityLevelsToChampionLevel();
    refreshAll();
  });
}

function renderChampionSelector() {
  const championSelect = document.getElementById("championSelect");
  championSelect.innerHTML = Object.keys(APP_STATE.champions)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `<option value="${name}">${name}</option>`)
    .join("");
  championSelect.addEventListener("change", async () => {
    await loadChampion(championSelect.value);
  });
}

async function loadChampion(championKey) {
  const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${APP_STATE.version}/data/en_US/champion/${championKey}.json`).then((r) => r.json());
  APP_STATE.championKey = championKey;
  APP_STATE.championData = response.data[championKey];
  APP_STATE.level = 1;
  APP_STATE.abilityLevels = { q: 1, w: 1, e: 1, r: 1 };
  document.getElementById("championLevel").value = "1";
  document.getElementById("championSplash").src = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championKey}_0.jpg`;
  renderAbilitySelectors();
  refreshAll();
}

function renderItemSlots() {
  const root = document.getElementById("itemSlots");
  root.innerHTML = APP_STATE.itemSlots
    .map(
      (_, idx) => `<button class="item-slot-btn" type="button" onclick="openItemModal(${idx})">
        <img id="slotIcon${idx}" src="https://ddragon.leagueoflegends.com/cdn/${APP_STATE.version || '14.1.1'}/img/item/1001.png" alt="slot" />
        <span id="slotText${idx}">Select item ${idx + 1}</span>
      </button>`
    )
    .join("");
  updateItemSlotDisplay();
}

function updateItemSlotDisplay() {
  APP_STATE.itemSlots.forEach((itemId, idx) => {
    const text = document.getElementById(`slotText${idx}`);
    const icon = document.getElementById(`slotIcon${idx}`);
    if (itemId) {
      text.textContent = APP_STATE.items[itemId].name;
      icon.src = `https://ddragon.leagueoflegends.com/cdn/${APP_STATE.version}/img/item/${itemId}.png`;
    } else {
      text.textContent = `Select item ${idx + 1}`;
      icon.src = "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/item/7050.png";
    }
  });
}

function initItemModal() {
  const search = document.getElementById("itemSearch");
  search.addEventListener("input", renderItemModalList);

  const tags = [...new Set(APP_STATE.itemPool.flatMap((item) => item.tags || []))].sort((a, b) => a.localeCompare(b));
  document.getElementById("itemTagFilters").innerHTML = tags
    .map((tag) => `<label><input type="checkbox" value="${tag}" onchange="renderItemModalList()"/> ${tag}</label>`)
    .join("");
}

function openItemModal(slotIndex) {
  APP_STATE.modalSlot = slotIndex;
  document.getElementById("itemModal").classList.remove("hidden");
  renderItemModalList();
}

function closeItemModal() {
  document.getElementById("itemModal").classList.add("hidden");
}

function renderItemModalList() {
  const q = document.getElementById("itemSearch").value.toLowerCase().trim();
  const tags = Array.from(document.querySelectorAll('#itemTagFilters input:checked')).map((node) => node.value);

  const list = APP_STATE.itemPool.filter((item) => {
    const matchName = !q || item.name.toLowerCase().includes(q);
    const matchTag = !tags.length || tags.every((tag) => item.tags?.includes(tag));
    return matchName && matchTag;
  });

  document.getElementById("itemModalGrid").innerHTML = list
    .map(
      (item) => `<button type="button" class="item-pick" onclick="pickItem('${item.id}')">
        <img src="https://ddragon.leagueoflegends.com/cdn/${APP_STATE.version}/img/item/${item.id}.png" alt="${item.name}"/>
        <span>${item.name}</span>
      </button>`
    )
    .join("");
}

function pickItem(itemId) {
  APP_STATE.itemSlots[APP_STATE.modalSlot] = itemId;
  closeItemModal();
  updateItemSlotDisplay();
  refreshAll();
}

function renderAbilitySelectors() {
  const level = APP_STATE.level;
  const maxNonUlt = Math.min(5, Math.floor((level + 1) / 2));
  const maxUlt = level >= 16 ? 3 : level >= 11 ? 2 : level >= 6 ? 1 : 0;

  document.getElementById("abilityRanks").innerHTML = [
    { key: "q", max: maxNonUlt },
    { key: "w", max: maxNonUlt },
    { key: "e", max: maxNonUlt },
    { key: "r", max: maxUlt },
  ]
    .map((entry) => {
      const options = entry.max
        ? Array.from({ length: entry.max }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("")
        : `<option value="0">0</option>`;
      return `<label class="ability-rank-select">${entry.key.toUpperCase()} <select data-spell="${entry.key}" onchange="abilityLevelChanged(event)">${options}</select></label>`;
    })
    .join("");

  document.getElementById("abilityRuleHint").textContent = `At level ${level}, Q/W/E max rank is ${maxNonUlt}. R max rank is ${maxUlt}.`;

  ["q", "w", "e", "r"].forEach((key) => {
    const select = document.querySelector(`select[data-spell="${key}"]`);
    const current = APP_STATE.abilityLevels[key];
    const max = key === "r" ? maxUlt : maxNonUlt;
    const corrected = Math.min(current, max);
    APP_STATE.abilityLevels[key] = max === 0 ? 0 : Math.max(1, corrected || 1);
    select.value = String(APP_STATE.abilityLevels[key]);
  });
}

function abilityLevelChanged(event) {
  APP_STATE.abilityLevels[event.target.dataset.spell] = Number(event.target.value);
}

function clampAbilityLevelsToChampionLevel() {
  renderAbilitySelectors();
}

function calcAtLevel(base, perLevel, level) {
  return base + perLevel * (level - 1);
}

function getItemTotals() {
  const totals = { hp: 0, mp: 0, ad: 0, ap: 0, armor: 0, mr: 0, asPercent: 0, ah: 0 };
  APP_STATE.itemSlots.forEach((id) => {
    if (!id || !APP_STATE.items[id]) return;
    const s = APP_STATE.items[id].stats || {};
    totals.hp += s.FlatHPPoolMod || 0;
    totals.mp += s.FlatMPPoolMod || 0;
    totals.ad += s.FlatPhysicalDamageMod || 0;
    totals.ap += s.FlatMagicDamageMod || 0;
    totals.armor += s.FlatArmorMod || 0;
    totals.mr += s.FlatSpellBlockMod || 0;
    totals.asPercent += (s.PercentAttackSpeedMod || 0) * 100;
    totals.ah += s.FlatHasteMod || 0;
  });
  return totals;
}

function computeFinalStats() {
  const base = APP_STATE.championData.stats;
  const item = getItemTotals();
  const lvl = APP_STATE.level;
return {
    hp: calcAtLevel(base.hp, base.hpperlevel, lvl) + item.hp,
    mp: calcAtLevel(base.mp, base.mpperlevel, lvl) + item.mp,
    ad: calcAtLevel(base.attackdamage, base.attackdamageperlevel, lvl) + item.ad,
    ap: item.ap,
    armor: calcAtLevel(base.armor, base.armorperlevel, lvl) + item.armor,
    mr: calcAtLevel(base.spellblock, base.spellblockperlevel, lvl) + item.mr,
    as: base.attackspeed * (1 + (base.attackspeedperlevel * (lvl - 1)) / 100) * (1 + item.asPercent / 100),
    ah: item.ah,
  };
}

function renderStats(stats) {
  const labels = {
    hp: "Health",
    mp: "Mana",
    ad: "Attack Damage",
    ap: "Ability Power",
    armor: "Armor",
    mr: "Magic Resist",
    as: "Attack Speed",
    ah: "Ability Haste",
  };
  document.getElementById("statsGrid").innerHTML = Object.entries(stats)
    .map(([k, v]) => `<div class="stat-pill"><strong>${labels[k]}:</strong> ${v.toFixed(k === "as" ? 3 : 1)}</div>`)
    .join("");
}

function renderAbilities() {
  if (!APP_STATE.championData) return;
  const passive = APP_STATE.championData.passive;
  const spells = APP_STATE.championData.spells;

  const passiveCard = `<div class="ability-card"><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${APP_STATE.version}/img/passive/${passive.image.full}" alt="${passive.name}"/><strong>Passive - ${passive.name}</strong><div>${passive.description}</div></div>`;
  const spellCards = spells
    .map((spell, idx) => {
      const key = ["Q", "W", "E", "R"][idx];
      return `<div class="ability-card"><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${APP_STATE.version}/img/spell/${spell.image.full}" alt="${spell.name}"/><strong>${key} - ${spell.name}</strong><div>${spell.description}</div><div>Cooldown: ${spell.cooldownBurn}</div><div>Cost: ${spell.costBurn || '0'}</div></div>`;
    })
    .join("");
  document.getElementById("abilityCards").innerHTML = passiveCard + spellCards;
}

function refreshAll() {
  if (!APP_STATE.championData) return;
  renderAbilitySelectors();
  renderStats(computeFinalStats());
  renderAbilities();
}
