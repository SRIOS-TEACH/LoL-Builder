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
const CHAMP_STATE = { version: "", champions: {}, selected: "", requestId: 0 };

/**
 * Bootstraps the Champion Lookup page by loading versions/champions and wiring UI events.
 */
async function initChampionLookup() {
  try {
  CHAMP_STATE.version = await window.ApiClient.fetchLatestVersion();
  const championJson = await window.ApiClient.fetchChampionIndex(CHAMP_STATE.version);
  CHAMP_STATE.champions = championJson.data;

  const select = document.getElementById("champSelect");
  select.innerHTML = Object.keys(CHAMP_STATE.champions)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `<option value="${name}">${CHAMP_STATE.champions[name].name}</option>`)
    .join("");

  select.addEventListener("change", () => renderChampion(select.value));
  await renderChampion(select.value);
  } catch (error) {
    document.getElementById("champName").textContent = "Could not load champions. Check your connection and refresh to retry.";
    console.warn('Champion lookup failed', error);
  }
}

/**
 * Fetches and renders a single champion's detail payload into splash/lore/ability cards.
 * @param {string} name Data Dragon champion key (e.g. "Ahri").
 */
async function renderChampion(name) {
  const requestId = ++CHAMP_STATE.requestId;
  try {
  CHAMP_STATE.selected = name;
  const details = await window.ApiClient.fetchChampionDetails(CHAMP_STATE.version, name);
  if (requestId !== CHAMP_STATE.requestId) return;
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
  } catch (error) {
    if (requestId !== CHAMP_STATE.requestId) return;
    document.getElementById("champName").textContent = `Could not load ${name}. Choose a champion to retry.`;
    document.getElementById("champLore").textContent = '';
    document.getElementById("abilities").textContent = '';
    console.warn('Champion details failed', error);
  }
}

document.addEventListener("DOMContentLoaded", initChampionLookup);
