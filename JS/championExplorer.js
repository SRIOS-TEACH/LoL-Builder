import ApiClient from './shared/apiClient.js';
const state = {version:'', champions:{}, selected:'', requestId:0};
const el = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const image = (folder, name) => `https://ddragon.leagueoflegends.com/cdn/${state.version}/img/${folder}/${name}`;

function message(text) {
  el('champStatus').textContent = text;
  el('champStatus').hidden = !text;
}
function highlightChampion() {
  el('champRoster').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.champion === state.selected)));
}
function filterChampions() {
  const query = el('champSearch').value.trim().toLowerCase();
  const matches = Object.entries(state.champions).filter(([,c]) => `${c.name} ${(c.tags || []).join(' ')}`.toLowerCase().includes(query)).sort((a,b) => a[1].name.localeCompare(b[1].name));
  el('champSelect').replaceChildren(...matches.map(([id,c]) => new Option(c.name,id)));
  el('champSelect').disabled = !matches.length;
  el('champCount').textContent = `${matches.length} champions`;
  el('champRoster').innerHTML = matches.map(([id,c]) => `<button type="button" data-champion="${escape(id)}" aria-label="View ${escape(c.name)}" aria-pressed="false"><img src="${image('champion',c.image.full)}" alt="" loading="lazy"><span>${escape(c.name)}</span></button>`).join('');
  if (!matches.length) {
    ++state.requestId;
    el('champDetails').hidden = true;
    message('No champions found. Try another name or role, such as Mage or Support.');
    return;
  }
  const selected = matches.some(([id]) => id === state.selected) ? state.selected : matches[0][0];
  el('champSelect').value = selected;
  renderChampion(selected);
}
const statDefinitions = [
  ['hp','Health','hpperlevel'],['mp','Resource','mpperlevel'],['attackdamage','Attack damage','attackdamageperlevel'],['armor','Armor','armorperlevel'],['spellblock','Magic resist','spellblockperlevel'],
  ['attackspeed','Attack speed','attackspeedperlevel','%'],['movespeed','Move speed'],['attackrange','Attack range'],['hpregen','Health regen / 5s','hpregenperlevel'],['mpregen','Resource regen / 5s','mpregenperlevel'],
];
async function renderChampion(id) {
  const requestId = ++state.requestId;
  state.selected = id;
  el('champSelect').value = id;
  highlightChampion();
  message(`Loading ${state.champions[id].name}…`);
  el('champDetails').hidden = true;
  try {
    const data = await ApiClient.fetchChampionDetails(state.version,id);
    if (requestId !== state.requestId) return;
    const champ = data.data[id];
    el('champHeroCard').style.setProperty('--champ-splash-url',`url("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg")`);
    el('champName').textContent = champ.name;
    el('champTitle').textContent = champ.title;
    el('champLore').textContent = champ.lore || champ.blurb;
    el('champTags').innerHTML = [...(champ.tags || []),champ.partype].filter(Boolean).map(tag=>`<span>${escape(tag)}</span>`).join('');
    const stats = [...statDefinitions];
    if (champ.stats.crit || champ.stats.critperlevel) stats.push(['crit','Critical chance','critperlevel','%']);
    el('champStats').innerHTML = stats.map(([key,label,growth,suffix='']) => `<div class="champion-stat"><span>${escape(label)}</span><strong>${escape(champ.stats[key] ?? '—')}</strong><small>${growth ? `+${escape(champ.stats[growth] ?? 0)}${suffix} per level` : 'Base stat'}</small></div>`).join('');
    const abilities = [{...champ.passive,key:'P',kind:'Passive',folder:'passive'},...champ.spells.map((spell,i)=>({...spell,key:['Q','W','E','R'][i],kind:i===3?'Ultimate':'Ability',folder:'spell'}))];
    el('abilities').innerHTML = abilities.map(ability=>`<article class="ability-card"><div class="explorer-ability-heading"><img class="ability-icon" src="${image(ability.folder,ability.image.full)}" alt=""><div><small>${ability.key} · ${ability.kind}</small><h3>${escape(ability.name)}</h3></div></div><p>${ability.description}</p>${ability.key==='P'?'':`<dl class="explorer-ability-values"><div><dt>Cooldown (seconds)</dt><dd>${escape(ability.cooldownBurn)}</dd></div><div><dt>Cost</dt><dd>${escape(ability.costBurn || 'No cost')}</dd></div><div><dt>Range</dt><dd>${escape(ability.rangeBurn)}</dd></div></dl>`}</article>`).join('');
    el('champDetails').hidden = false;
    message('');
  } catch(error) {
    if (requestId !== state.requestId) return;
    message(`Could not load ${state.champions[id].name}. Select the champion again to retry.`);
    console.warn('Champion details failed',error);
  }
}
async function init() {
  el('champSearch').addEventListener('input',filterChampions);
  el('champSelect').addEventListener('change',event=>renderChampion(event.target.value));
  el('champRoster').addEventListener('click',event=>{const button=event.target.closest('[data-champion]');if(button)renderChampion(button.dataset.champion);});
  try {
    state.version = await ApiClient.fetchLatestVersion();
    state.champions = (await ApiClient.fetchChampionIndex(state.version)).data;
    el('champPatch').textContent = `Patch ${state.version}`;
    filterChampions();
  } catch(error) {
    el('champDetails').hidden = true;
    el('champCount').textContent = 'Roster unavailable';
    el('champPatch').textContent = 'Patch unavailable';
    message('Could not load champions. Check your connection and refresh to retry.');
    console.warn('Champion explorer failed',error);
  }
}
document.addEventListener('DOMContentLoaded',init);
