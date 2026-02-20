const CHAMP_LOOKUP_STATE = {
  version: "",
  champions: {},
  current: null,
};

async function initChampionLookup() {
  const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then((r) => r.json());
  CHAMP_LOOKUP_STATE.version = versions[0];
  const champs = await fetch(`https://ddragon.leagueoflegends.com/cdn/${CHAMP_LOOKUP_STATE.version}/data/en_US/champion.json`).then((r) => r.json());
  CHAMP_LOOKUP_STATE.champions = champs.data;

  const select = document.getElementById("champLookupSelect");
  select.innerHTML = Object.keys(CHAMP_LOOKUP_STATE.champions)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `<option value="${name}">${name}</option>`)
    .join("");

  select.addEventListener("change", () => loadChampionLookup(select.value));
  await loadChampionLookup(select.value || Object.keys(CHAMP_LOOKUP_STATE.champions)[0]);
}

async function loadChampionLookup(championKey) {
  const detail = await fetch(`https://ddragon.leagueoflegends.com/cdn/${CHAMP_LOOKUP_STATE.version}/data/en_US/champion/${championKey}.json`).then((r) => r.json());
  CHAMP_LOOKUP_STATE.current = detail.data[championKey];
  const champ = CHAMP_LOOKUP_STATE.current;

  document.getElementById("champLookupSelect").value = championKey;
  document.getElementById("champLookupSplash").src = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championKey}_0.jpg`;
  document.getElementById("champLookupLore").textContent = champ.lore;

  const passive = champ.passive;
  const passiveHtml = `<div class="ability-card"><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${CHAMP_LOOKUP_STATE.version}/img/passive/${passive.image.full}" alt="${passive.name}"/><strong>Passive - ${passive.name}</strong><div>${passive.description}</div></div>`;
  const spellsHtml = champ.spells
    .map((spell, idx) => `<div class="ability-card"><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${CHAMP_LOOKUP_STATE.version}/img/spell/${spell.image.full}" alt="${spell.name}"/><strong>${["Q", "W", "E", "R"][idx]} - ${spell.name}</strong><div>${spell.description}</div><div>Cooldown: ${spell.cooldownBurn}</div><div>Cost: ${spell.costBurn || '0'}</div></div>`)
    .join("");

  document.getElementById("champAbilityGrid").innerHTML = passiveHtml + spellsHtml;
}
