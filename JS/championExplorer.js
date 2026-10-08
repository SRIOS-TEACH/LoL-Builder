import ApiClient from './shared/apiClient.js';
import CatalogQueries from './domain/catalogQueries.js';
import {createCatalogList} from './ui/catalogList.mjs';
import {createStatsView} from './ui/statsView.mjs';
import CalculationPipeline from './engine/calculationPipeline.js';
const state = {version:'', champions:{}, selected:'', requestId:0};
const el = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const image = (folder, name) => `https://ddragon.leagueoflegends.com/cdn/${state.version}/img/${folder}/${name}`;

function message(text) {
  el('champStatus').textContent = text;
  el('champStatus').hidden = !text;
}
let championList, statsView;
function highlightChampion(){el('champRoster').querySelectorAll('[data-champ]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.champ===state.selected)));}
function filterChampions() {
 const tags=[...el('champFilters').querySelectorAll('input:checked')].map(input=>input.value);
 const ids=CatalogQueries.queryChampions(state.champions,{search:el('champSearch').value,tags,searchBy:'name'});
 championList.update({ids,records:state.champions,version:state.version});
 highlightChampion();
 el('champCount').textContent=ids.length+' '+(ids.length===1?'champion':'champions');
 message(ids.length?'':'No champions found. Try another name or role.');
}
async function renderChampion(id) {
  const requestId = ++state.requestId;
  state.selected = id;
  championList.select(id);
  highlightChampion();
  el('champPicker').open = false;
  el('champPickerLabel').textContent = 'Change champion · '+state.champions[id].name;
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
    const evaluation=CalculationPipeline.create({build:{selectedChampion:id,level:1,runeSelections:{primaryPath:'',secondaryPath:'',primary:[],secondary:[],shards:[]}},data:{champion:champ}});
    const computed=evaluation.stats.computeDerivedBuildStats();
    statsView.update({computed,summary:evaluation.stats.summary(computed),rangeBonus:evaluation.stats.getChampionPassiveRangeBonus()});
    const abilities = [{...champ.passive,key:'P',kind:'Passive',folder:'passive'},...champ.spells.map((spell,i)=>({...spell,key:['Q','W','E','R'][i],kind:i===3?'Ultimate':'Ability',folder:'spell'}))];
    el('abilities').innerHTML = abilities.map(ability=>`<article class="ability-card"><div class="explorer-ability-heading"><img class="ability-icon" src="${image(ability.folder,ability.image.full)}" alt=""><div><small>${ability.key} · ${ability.kind}</small><h3>${escape(ability.name)}</h3></div></div><p>${ability.description}</p>${ability.key==='P'?'':`<dl class="explorer-ability-values"><div><dt>Cooldown (seconds)</dt><dd>${escape(ability.cooldownBurn)}</dd></div><div><dt>Cost</dt><dd>${escape(ability.costBurn || 'No cost')}</dd></div><div><dt>Range</dt><dd>${escape(ability.rangeBurn)}</dd></div></dl>`}</article>`).join('');
    el('champDetails').hidden = false;
    message('');
    el('champHeroCard').focus({preventScroll:true});
  } catch(error) {
    if (requestId !== state.requestId) return;
    el('champPicker').open = true;
    message(`Could not load ${state.champions[id].name}. Select the champion again to retry.`);
    console.warn('Champion details failed',error);
  }
}
async function init() {
  el('champSearch').addEventListener('input',filterChampions);
  championList=createCatalogList({root:el('champRoster'),kind:'champion',onSelect:renderChampion});
  statsView=createStatsView({root:el('champStats')});
  el('champFilters').addEventListener('change',filterChampions);
  try {
    state.version = await ApiClient.fetchLatestVersion();
    state.champions = (await ApiClient.fetchChampionIndex(state.version)).data;
    el('champPatch').textContent = `Patch ${state.version}`;
    const tags=[...new Set(Object.values(state.champions).flatMap(champ=>champ.tags || []))].sort();
    el('champFilters').innerHTML=tags.map(tag=>`<label class="tag-pill"><input type="checkbox" value="${escape(tag)}"> ${escape(tag)}</label>`).join('');
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
