const ITEM_STATE = {
  version: "",
  items: {},
  filteredIds: [],
  tags: new Set(),
  selectedTags: new Set(),
  selectedId: null,
  cdragonById: {},
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

async function loadCommunityDragonCalcs() {
  try {
    const payload = await fetch("https://raw.communitydragon.org/latest/game/items.cdtb.bin.json").then((r) => r.json());
    Object.entries(payload).forEach(([key, value]) => {
      const match = key.match(/^Items\/(\d+)$/);
      if (match) {
        ITEM_STATE.cdragonById[match[1]] = value;
      }
    });
  } catch (error) {
    console.warn("CommunityDragon calc data unavailable", error);
  }
}

function resolveEffectToken(item, token) {
  if (!item.effect) return null;
  const effect = item.effect;
  if (effect[token] !== undefined) return effect[token];

  const tokenUpper = token.toUpperCase();
  if (effect[tokenUpper] !== undefined) return effect[tokenUpper];

  const match = token.match(/^e(\d+)$/i);
  if (match) {
    const key = `Effect${match[1]}Amount`;
    if (effect[key] !== undefined) return effect[key];
  }

  return null;
}

function resolveDescriptionFormulas(item, descriptionHtml) {
  return descriptionHtml.replace(/{{\s*([^}\s]+)\s*}}/g, (_, token) => {
    const resolved = resolveEffectToken(item, token);
    return resolved !== null ? String(resolved) : `{{${token}}}`;
  });
}

function statLabel(part) {
  if (part.mStat === 0) return "AP";
  if (part.mStat === 2) {
    if (part.mStatFormula === 1) return "base AD";
    if (part.mStatFormula === 2) return "bonus AD";
    return "total AD";
  }
  return "stat";
}

function formulaPartToText(part, dataValueMap) {
  if (!part) return "0";
  switch (part.__type) {
    case "NumberCalculationPart":
      return String(part.mNumber ?? 0);
    case "StatByCoefficientCalculationPart": {
      const coef = Number(part.mCoefficient ?? 0);
      return `${(coef * 100).toFixed(coef % 1 ? 1 : 0)}% ${statLabel(part)}`;
    }
    case "NamedDataValueCalculationPart": {
      const val = dataValueMap[part.mDataValue];
      return val !== undefined ? `${val}` : part.mDataValue;
    }
    case "ProductOfSubPartsCalculationPart":
      return `(${formulaPartToText(part.mPart1, dataValueMap)}) × (${formulaPartToText(part.mPart2, dataValueMap)})`;
    case "SumOfSubPartsCalculationPart":
      return (part.mSubparts || []).map((p) => `(${formulaPartToText(p, dataValueMap)})`).join(" + ");
    default:
      return part.__type || "unknown";
  }
}

function buildDetailedPassiveText(itemId, item) {
  const cItem = ITEM_STATE.cdragonById[itemId];
  if (!cItem || !cItem.mItemCalculations) return "";

  const dataValueMap = {};
  (cItem.mDataValues || []).forEach((d) => {
    dataValueMap[d.mName] = d.mValue;
  });

  const calcLines = Object.entries(cItem.mItemCalculations).map(([name, calc]) => {
    const parts = (calc.mFormulaParts || []).map((p) => formulaPartToText(p, dataValueMap)).join(" + ");
    return `<li><strong>${name}:</strong> ${parts || "n/a"}</li>`;
  });

  const isSpellblade = item.description.toLowerCase().includes("spellblade");
  if (isSpellblade) {
    const spellbladeExpr = Object.entries(cItem.mItemCalculations)
      .find(([name]) => name.toLowerCase().includes("spellblade"));
    const cooldown = dataValueMap.SpellbladeCooldown ?? dataValueMap.Cooldown;
    const damageTag = item.description.toLowerCase().includes("magic") ? "magic" : "physical";

    if (spellbladeExpr) {
      const expression = (spellbladeExpr[1].mFormulaParts || []).map((p) => formulaPartToText(p, dataValueMap)).join(" + ");
      return `<div><strong>Detailed passive text</strong><p><strong>Unique – Spellblade:</strong> After using an ability, your next basic attack within 10 seconds deals ${expression} bonus ${damageTag} damage on-hit${cooldown ? ` (${cooldown}s cooldown)` : ""}.</p><ul>${calcLines.join("")}</ul></div>`;
    }
  }

  return `<div><strong>Detailed formula breakdown</strong><ul>${calcLines.join("")}</ul></div>`;
}

function buildFormulaSection(item) {
  const effects = Object.entries(item.effect || {})
    .filter(([, value]) => value !== "0" && value !== 0)
    .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
    .join("");

  return effects
    ? `<hr><div><strong>Data Dragon effect values</strong><ul>${effects}</ul></div>`
    : "";
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

  await loadCommunityDragonCalcs();

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

  const resolvedDescription = resolveDescriptionFormulas(item, item.description || "");
  const detailedPassive = buildDetailedPassiveText(id, item);
  const formulaSection = buildFormulaSection(item);

  document.getElementById("itemName").textContent = item.name;
  document.getElementById("itemIcon").src = `https://ddragon.leagueoflegends.com/cdn/${ITEM_STATE.version}/img/item/${id}.png`;
  document.getElementById("itemMeta").innerHTML = `<strong>Cost:</strong> ${item.gold.total}g <br><strong>Sell:</strong> ${item.gold.sell}g <br><strong>Tags:</strong> ${(item.tags || []).join(", ")}`;
  document.getElementById("itemDescription").innerHTML = resolvedDescription + (detailedPassive ? `<hr>${detailedPassive}` : "") + formulaSection;
}
