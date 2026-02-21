/**
 * Champion lookup page controller.
 *
 * Loads champion list/details from Data Dragon and renders:
 * - splash
 * - name/lore
 * - passive + Q/W/E/R cards
 *
 * Flow:
 * 1) `initChampionLookup` loads latest game version + champion index.
 * 2) The champion dropdown is rendered and wired to change events.
 * 3) `renderChampion` fetches full champion details and paints the UI.
 */
const CHAMP_STATE = { version: "", champions: {}, selected: "" };

/**
 * Bootstraps the Champion Lookup page by loading versions/champions and wiring UI events.
 */
async function initChampionLookup() {
  const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then((r) => r.json());
  CHAMP_STATE.version = versions[0];
  const championJson = await fetch(`https://ddragon.leagueoflegends.com/cdn/${CHAMP_STATE.version}/data/en_US/champion.json`).then((r) => r.json());
  CHAMP_STATE.champions = championJson.data;

  const select = document.getElementById("champSelect");
  select.innerHTML = Object.keys(CHAMP_STATE.champions)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `<option value="${name}">${name}</option>`)
    .join("");

  select.addEventListener("change", () => renderChampion(select.value));
  renderChampion(Object.keys(CHAMP_STATE.champions).sort((a, b) => a.localeCompare(b))[0]);
}

/**
 * Fetches and renders a single champion's detail payload into splash/lore/ability cards.
 * @param {string} name Data Dragon champion key (e.g. "Ahri").
 */
async function renderChampion(name) {
  CHAMP_STATE.selected = name;
  const details = await fetch(`https://ddragon.leagueoflegends.com/cdn/${CHAMP_STATE.version}/data/en_US/champion/${name}.json`).then((r) => r.json());
  const champ = details.data[name];

  document.getElementById("champSelect").value = name;
  document.getElementById("champHeroCard").style.setProperty("--champ-splash-url", `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg)`);
  document.getElementById("champName").textContent = `${champ.name} — ${champ.title}`;
  document.getElementById("champLore").textContent = champ.blurb;

  const passiveCard = `<div class="ability-card"><strong>Passive - ${champ.passive.name}</strong>
    <img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${CHAMP_STATE.version}/img/passive/${champ.passive.image.full}" alt="${champ.passive.name}">
    <p>${champ.passive.description}</p></div>`;

  const spellCards = champ.spells
    .map((spell, idx) => `<div class="ability-card">
      <strong>${["Q", "W", "E", "R"][idx]} - ${spell.name}</strong>
      <img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${CHAMP_STATE.version}/img/spell/${spell.image.full}" alt="${spell.name}">
      <p>${spell.description}</p>
      <div><strong>Cooldown:</strong> ${spell.cooldownBurn}</div>
      <div><strong>Cost:</strong> ${spell.costBurn || "No cost"}</div>
      <div><strong>Range:</strong> ${spell.rangeBurn}</div>
    </div>`)
    .join("");

  document.getElementById("abilities").innerHTML = passiveCard + spellCards;
}
