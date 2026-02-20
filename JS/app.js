const APP_STATE = {
  version: "",
  champions: {},
  items: {},
  championKey: "",
  championData: null,
  championDetail: null,
  itemSlots: Array(6).fill(""),
  abilityLevels: { q: 1, w: 1, e: 1, r: 1 },
  level: 1,
  savedBuilds: [],
};

const STAT_LABELS = {
  hp: "Health",
  mp: "Mana",
  ad: "Attack Damage",
  ap: "Ability Power",
  armor: "Armor",
  mr: "Magic Resist",
  as: "Attack Speed",
  ah: "Ability Haste",
};

async function initBuilderApp() {
  wireStaticInputs();
  await loadStaticData();
  renderSelectors();
  APP_STATE.championKey = Object.keys(APP_STATE.champions)[0];
  await loadChampion(APP_STATE.championKey);
}

function wireStaticInputs() {
  const levelSelect = document.getElementById("championLevel");
  for (let i = 1; i <= 18; i += 1) {
    levelSelect.innerHTML += `<option value="${i}">${i}</option>`;
  }
  levelSelect.addEventListener("change", (e) => {
    APP_STATE.level = Number(e.target.value);
    refreshAll();
  });

  ["dummyHp", "dummyArmor", "dummyMr"].forEach((id) => {
    document.getElementById(id).addEventListener("input", refreshAll);
  });
}

async function loadStaticData() {
  const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then((r) => r.json());
  APP_STATE.version = versions[0];
  const champList = await fetch(`https://ddragon.leagueoflegends.com/cdn/${APP_STATE.version}/data/en_US/champion.json`).then((r) => r.json());
  APP_STATE.champions = champList.data;
  const itemData = await fetch(`https://ddragon.leagueoflegends.com/cdn/${APP_STATE.version}/data/en_US/item.json`).then((r) => r.json());
  APP_STATE.items = itemData.data;
}

function renderSelectors() {
  const championSelect = document.getElementById("championSelect");
  championSelect.innerHTML = Object.keys(APP_STATE.champions)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `<option value="${key}">${key}</option>`)
    .join("");

  championSelect.addEventListener("change", async (e) => {
    APP_STATE.championKey = e.target.value;
    await loadChampion(APP_STATE.championKey);
  });

  const itemOptions = ['<option value="">Empty slot</option>']
    .concat(
      Object.entries(APP_STATE.items)
        .filter(([, item]) => item.gold?.purchasable)
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .map(([id, item]) => `<option value="${id}">${item.name}</option>`)
    )
    .join("");

  const itemSlots = document.getElementById("itemSlots");
  itemSlots.innerHTML = APP_STATE.itemSlots
    .map(
      (_, idx) => `<div class="col-lg-4 col-12">
      <label class="label">Slot ${idx + 1}
        <select class="form-control item-slot" data-slot="${idx}">${itemOptions}</select>
      </label>
    </div>`
    )
    .join("");

  document.querySelectorAll(".item-slot").forEach((select) => {
    select.addEventListener("change", (e) => {
      APP_STATE.itemSlots[Number(e.target.dataset.slot)] = e.target.value;
      refreshAll();
    });
  });

  const abilityRanks = document.getElementById("abilityRanks");
  abilityRanks.innerHTML = ["q", "w", "e", "r"]
    .map((spell, idx) => {
      const maxRank = idx === 3 ? 3 : 5;
      const options = Array.from({ length: maxRank }, (_, n) => `<option value="${n + 1}">${n + 1}</option>`).join("");
      return `<div class="col-lg-2 col-6"><label class="label">${spell.toUpperCase()}
        <select class="form-control ability-level" data-spell="${spell}">${options}</select>
      </label></div>`;
    })
    .join("");

  document.querySelectorAll(".ability-level").forEach((select) => {
    select.addEventListener("change", (e) => {
      APP_STATE.abilityLevels[e.target.dataset.spell] = Number(e.target.value);
      refreshAll();
    });
  });
}

async function loadChampion(championKey) {
  const champ = APP_STATE.champions[championKey];
  const champData = await fetch(`https://ddragon.leagueoflegends.com/cdn/${APP_STATE.version}/data/en_US/champion/${championKey}.json`).then((r) => r.json());
  APP_STATE.championData = champData.data[championKey];
  APP_STATE.level = 1;
  APP_STATE.abilityLevels = { q: 1, w: 1, e: 1, r: 1 };
  document.getElementById("championLevel").value = "1";
  document.querySelectorAll(".ability-level").forEach((el) => {
    el.value = "1";
  });
  document.getElementById("championSplash").src = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championKey}_0.jpg`;

  try {
    APP_STATE.championDetail = await fetch(`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/en_us/v1/champions/${champ.key}.json`).then((r) => r.json());
  } catch {
    APP_STATE.championDetail = null;
  }
  refreshAll();
}

function calcAtLevel(base, perLevel, level) {
  return base + perLevel * (level - 1);
}

function getItemTotals() {
  const totals = { hp: 0, mp: 0, ad: 0, ap: 0, armor: 0, mr: 0, asPercent: 0, ah: 0 };
  APP_STATE.itemSlots.forEach((id) => {
    if (!id || !APP_STATE.items[id]?.stats) return;
    const stats = APP_STATE.items[id].stats;
    totals.hp += stats.FlatHPPoolMod || 0;
    totals.mp += stats.FlatMPPoolMod || 0;
    totals.ad += stats.FlatPhysicalDamageMod || 0;
    totals.ap += stats.FlatMagicDamageMod || 0;
    totals.armor += stats.FlatArmorMod || 0;
    totals.mr += stats.FlatSpellBlockMod || 0;
    totals.asPercent += (stats.PercentAttackSpeedMod || 0) * 100;
    totals.ah += stats.FlatHasteMod || 0;
  });
  return totals;
}

function computeFinalStats() {
  const base = APP_STATE.championData.stats;
  const item = getItemTotals();
  const lvl = APP_STATE.level;
  const stats = {
    hp: calcAtLevel(base.hp, base.hpperlevel, lvl) + item.hp,
    mp: calcAtLevel(base.mp, base.mpperlevel, lvl) + item.mp,
    ad: calcAtLevel(base.attackdamage, base.attackdamageperlevel, lvl) + item.ad,
    ap: item.ap,
    armor: calcAtLevel(base.armor, base.armorperlevel, lvl) + item.armor,
    mr: calcAtLevel(base.spellblock, base.spellblockperlevel, lvl) + item.mr,
    as: base.attackspeed * (1 + (base.attackspeedperlevel * (lvl - 1)) / 100) * (1 + item.asPercent / 100),
    ah: item.ah,
  };
  return stats;
}

function renderStats(stats) {
  const grid = document.getElementById("statsGrid");
  grid.innerHTML = Object.entries(stats)
    .map(([key, value]) => `<div class="stat-pill"><strong>${STAT_LABELS[key]}:</strong> ${value.toFixed(key === "as" ? 3 : 1)}</div>`)
    .join("");
}

function cdrFromHaste(ah) {
  return (ah / (100 + ah)) * 100;
}

function evaluatePart(part, spell, spellRank, stats) {
  if (!part || typeof part !== "object") return 0;
  if (part.__type === "NumberCalculationPart") return part.mNumber || 0;
  if (part.__type === "NamedDataValueCalculationPart") {
    const val = spell.mDataValues?.find((v) => v.mName === part.mDataValue)?.mValues?.[spellRank - 1];
    return val || 0;
  }
  if (part.__type === "EffectValueCalculationPart") {
    const val = spell.mEffectAmount?.find((e) => e.key?.toLowerCase().includes(String(part.mEffectIndex)))?.value?.[spellRank - 1];
    return val || 0;
  }
  if (part.__type === "StatByCoefficientCalculationPart") {
    const coef = part.mCoefficient || 0;
    if (part.mStat === 0) return stats.ap * coef;
    if (part.mStat === 2 && part.mStatFormula === 2) return stats.ad * coef;
    if (part.mStat === 2) return (stats.ad - APP_STATE.championData.stats.attackdamage) * coef;
    return 0;
  }
  if (part.__type === "ProductOfSubPartsCalculationPart") {
    return evaluatePart(part.mPart1, spell, spellRank, stats) * evaluatePart(part.mPart2, spell, spellRank, stats);
  }
  if (part.__type === "SumOfSubPartsCalculationPart") {
    return part.mSubparts?.reduce((acc, sub) => acc + evaluatePart(sub, spell, spellRank, stats), 0) || 0;
  }
  if (part.__type === "StatBySubPartCalculationPart") {
    const scalar = evaluatePart(part.mSubpart, spell, spellRank, stats);
    if (part.mStat === 0) return scalar * stats.ap;
    if (part.mStat === 2) return scalar * stats.ad;
  }
  return 0;
}

function evaluateSpellDamage(spell, spellRank, stats) {
  if (!spell) return { raw: 0, cd: 0, damageType: "mixed" };
  let raw = 0;
  if (spell.spellCalculations) {
    Object.values(spell.spellCalculations).forEach((calc) => {
      if (calc.__type === "GameCalculation") {
        raw += calc.mFormulaParts?.reduce((acc, part) => acc + evaluatePart(part, spell, spellRank, stats), 0) || 0;
      }
    });
  }
  if (!raw && spell.effectAmounts) {
    const firstEffect = Object.values(spell.effectAmounts)[0]?.[spellRank - 1] || 0;
    raw = firstEffect;
  }
  const cd = (spell.cooldownCoefficients?.[spellRank - 1] || 1) * (1 - cdrFromHaste(stats.ah) / 100);
  const rt = (spell.dynamicDescription || "").toLowerCase();
  const damageType = rt.includes("magic damage") ? "magic" : rt.includes("physical damage") ? "physical" : "mixed";
  return { raw: Math.max(raw, 0), cd, damageType };
}

function mitigation(amount, resist) {
  if (resist >= 0) return amount * (100 / (100 + resist));
  return amount * (2 - 100 / (100 - resist));
}

function renderAbilityCards(stats) {
  const container = document.getElementById("abilityCards");
  const spells = APP_STATE.championDetail?.spells || [];
  const keys = ["q", "w", "e", "r"];

  const cards = spells.slice(0, 4).map((spell, idx) => {
    const key = keys[idx];
    const rank = APP_STATE.abilityLevels[key];
    const calc = evaluateSpellDamage(spell, rank, stats);
    const iconPath = spell?.abilityIconPath ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/${spell.abilityIconPath.toLowerCase()}` : "";
    return {
      key,
      name: spell.name,
      rank,
      ...calc,
      html: `<div class="ability-card">
        <div class="ability-title-row"><input type="checkbox" class="combo-toggle" data-spell="${key}" checked />
          <strong>${key.toUpperCase()} - ${spell.name}</strong></div>
        <img class="ability-icon" src="${iconPath}" alt="${spell.name}" />
        <div>Raw Damage: ${calc.raw.toFixed(1)}</div>
        <div>Cooldown: ${calc.cd.toFixed(2)}s</div>
        <div>Spell DPS: ${(calc.raw / Math.max(calc.cd, 0.1)).toFixed(1)}</div>
      </div>`,
    };
  });

  container.innerHTML = cards.map((c) => c.html).join("");
  document.querySelectorAll(".combo-toggle").forEach((checkbox) => checkbox.addEventListener("change", () => refreshAll()));

  return cards;
}

function refreshAll() {
  if (!APP_STATE.championData) return;
  const stats = computeFinalStats();
  renderStats(stats);

  document.getElementById("abilityHaste").textContent = stats.ah.toFixed(1);
  document.getElementById("cdrValue").textContent = `${cdrFromHaste(stats.ah).toFixed(1)}%`;

  const spellCards = renderAbilityCards(stats);
  const selected = new Set(Array.from(document.querySelectorAll(".combo-toggle:checked")).map((c) => c.dataset.spell));
  const combo = spellCards.filter((spell) => selected.has(spell.key));

  const rawBurst = combo.reduce((sum, s) => sum + s.raw, 0);
  const comboWindow = Math.max(...combo.map((s) => s.cd), 1);
  const comboDps = rawBurst / comboWindow;

  document.getElementById("comboBurst").textContent = rawBurst.toFixed(1);
  document.getElementById("comboDps").textContent = comboDps.toFixed(1);

  const dummyHp = Number(document.getElementById("dummyHp").value) || 1;
  const dummyArmor = Number(document.getElementById("dummyArmor").value) || 0;
  const dummyMr = Number(document.getElementById("dummyMr").value) || 0;

  const mitigated = combo.reduce((sum, spell) => {
    if (spell.damageType === "physical") return sum + mitigation(spell.raw, dummyArmor);
    if (spell.damageType === "magic") return sum + mitigation(spell.raw, dummyMr);
    return sum + mitigation(spell.raw * 0.5, dummyArmor) + mitigation(spell.raw * 0.5, dummyMr);
  }, 0);

  document.getElementById("mitigatedCombo").textContent = mitigated.toFixed(1);
  document.getElementById("hpRemoved").textContent = `${((mitigated / dummyHp) * 100).toFixed(1)}%`;
}

function saveCurrentBuild() {
  const stats = computeFinalStats();
  const burst = Number(document.getElementById("comboBurst").textContent) || 0;
  const mitigated = Number(document.getElementById("mitigatedCombo").textContent) || 0;
  APP_STATE.savedBuilds.push({
    champion: APP_STATE.championKey,
    level: APP_STATE.level,
    items: APP_STATE.itemSlots.map((id) => APP_STATE.items[id]?.name || "-").join(", "),
    ad: stats.ad.toFixed(1),
    ap: stats.ap.toFixed(1),
    ah: stats.ah.toFixed(1),
    burst: burst.toFixed(1),
    mitigated: mitigated.toFixed(1),
  });
  renderBuildComparison();
}

function renderBuildComparison() {
  const root = document.getElementById("buildComparison");
  if (!APP_STATE.savedBuilds.length) {
    root.innerHTML = "<p class='mt-10'>No build snapshots yet.</p>";
    return;
  }
  root.innerHTML = `<table class="table w-full mt-10"><thead><tr>
    <th>#</th><th>Champion</th><th>Lv</th><th>Items</th><th>AD</th><th>AP</th><th>AH</th><th>Burst</th><th>Vs Dummy</th>
  </tr></thead><tbody>${APP_STATE.savedBuilds
    .map(
      (b, i) => `<tr><td>${i + 1}</td><td>${b.champion}</td><td>${b.level}</td><td>${b.items}</td><td>${b.ad}</td><td>${b.ap}</td><td>${b.ah}</td><td>${b.burst}</td><td>${b.mitigated}</td></tr>`
    )
    .join("")}</tbody></table>`;
}
