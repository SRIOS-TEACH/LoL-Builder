import STAT_ICONS from '../presentation/statIcons.mjs';
import {createStatsView} from '../ui/statsView.mjs';
import ItemSource from '../data/itemSource.js';
import RuneSource from '../data/runeSource.js';
import SourceRepositories from '../data/sourceRepositories.js';
import BuildInputs from '../domain/buildInputs.js';
import CatalogQueries from '../domain/catalogQueries.js';
import Recommendations from '../domain/recommendations.js';
import RuneInputRules from '../domain/runeInputs.js';
import ScenarioInputs from '../domain/scenarioInputs.js';
import CalculationPipeline from '../engine/calculationPipeline.js';
import AbilityRules from '../shared/abilityRules.js';
import ApiClient from '../shared/apiClient.js';
import AttackEffects from '../shared/attackEffects.js';
import BuildStats from '../shared/buildStats.js';
import ItemDescriptions from '../shared/itemDescriptions.js';
import {createLifecycle,createView} from '../ui/lifecycle.mjs';
import {createCatalogList} from '../ui/catalogList.mjs';
import {createChampionDetail} from '../ui/championDetail.mjs';
import {createItemDetail} from '../ui/itemDetail.mjs';
import {createInventory} from '../ui/inventory.mjs';
import {createTargetControls} from '../ui/targetControls.mjs';
import {createRuneControls} from '../ui/runeControls.mjs';
import {createAbilityControls} from '../ui/abilityControls.mjs';
import {createComboControls} from '../ui/comboControls.mjs';
import {createRuneData} from './runeDefaults.mjs';
import {createItemLookup} from '../shared/itemData.js';
/** Builder workflows compose reusable views; each mounted page owns its state. */
export function createBuilderPage({root=null,elements={},api=ApiClient,repository=SourceRepositories.createRepository({api}),itemLookup=createItemLookup({repository})}={}) {
const life=createLifecycle(),document=root?createView(elements):null,viewport=root?.ownerDocument.defaultView;
let statsView,championList,championDetail,itemList,itemDetail,inventory,targetControls,runeControls,abilityControls,comboControls;
const pick=(...names)=>Object.fromEntries(names.map(name=>[name,elements[name]]));
function builderEvaluation(scenario={target:state.target,gameTimeMinutes:state.gameTimeMinutes}) {
 return CalculationPipeline.create({build:BuildInputs.readBuildInputs(state),scenario,
  data:{champion:state.championData,championRaw:state.cdragonRaw,abilities:state.cdragonAbilityData,
   items:state.items,advancedItems:getItemLookupShared().getState().cdragonById,runes:RUNE_DATA.runeLookup,
   strings:state.strings,stringsReady:state.stringsReady,stringsLoading:state.stringsLoading}});
}
const builderRepository=repository;
const state = {
  ...BuildInputs.createBuildInputs(),
  ...ScenarioInputs.createScenarioInputs(),
  version: "",
  champions: {},
  items: {},
  championData: null,
  activeSlot: null,
  itemTags: new Set(),
  champTags: new Set(),
  modalItemFiltered: [],
  modalChampFiltered: [],
  championDetailCache: {},
  cdragonAbilityData: null,
  inspectedItemId: null,
  championModalRequestId: 0,
  championRequestId: 0,
  runeModalTarget: null,
};

const RUNE_DATA=createRuneData();

function initializeRuneSelections() {
 state.runeSelections=RuneInputRules.createRules(RUNE_DATA).initialize(state.runeSelections);
}
function isApAdaptiveChampion(...args) { return builderEvaluation().stats.isApAdaptiveChampion(...args); }
async function hydrateRunesFromDdragon(version) {
  const runes = await builderRepository.loadRunes(version).then(result=>{state.runeSource=result.source;return result.records;}).catch(() => null);
  if (!Array.isArray(runes) || !runes.length) return;

  Object.assign(RUNE_DATA, RuneSource.normalizeRunes(runes,RUNE_DATA.paths,RUNE_DATA.runeLookup));
  initializeRuneSelections();
}
function setStatus(message, isError = false) {
  if(life.disposed)return;
  const el = document.getElementById("builderStatus");
  el.textContent = message || "";
  el.classList.toggle("status-error", isError);
}
async function initBuilder() {
  try {
    setStatus("Loading champion and item data...");
    mountComponents();
    wireLevelOptions();

    await loadBuilderData();
    if(life.disposed)return;
    mountRunes();
    renderChampionSelect();
    renderItemSlots();
    initItemModal();
    initChampionModal();
    renderRunePanel();
    renderAbilityCards();
    renderStats();
    wireBuilderUiEvents();
    state.uiReady=true;
    life.on(document.getElementById("passiveModal"),"click", (event) => {
      if (event.target === document.getElementById("passiveModal")) closePassiveModal();
    });
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus("Failed to load data. Check internet connection and refresh.", true);
  }
}
function wireBuilderUiEvents() {

  life.on(document.getElementById("championPickerBtn"),"click", openChampionModal);
  life.on(document.getElementById("passiveToggleBtn"),"click", togglePassivePanel);
  life.on(document.getElementById("resetItemFilters"),"click", clearModalFilters);
  life.on(document.getElementById("closeItemModalBtn"),"click", closeItemModal);
  life.on(document.getElementById("closeChampModalBtn"),"click", closeChampionModal);

  life.on(document.getElementById("closePassiveModalBtn"),"click", closePassiveModal);

}

function wireLevelOptions() {
  const level = document.getElementById("builderLevel");
  level.innerHTML = Array.from({ length: roleLevelCap() }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  level.value = String(state.level);
  life.property(level,'onchange',() => {
    state.level = Number(level.value);
    enforceAbilityRules();
    renderAbilityCards();
    renderStats();
  });
}
function getItemLookupShared() {
  return itemLookup;
}
async function loadBuilderData() {
  state.version = await api.fetchLatestVersion();
  state.runesLoading=true;
  const runeData = hydrateRunesFromDdragon(state.version).catch(()=>null).finally(()=>{state.runesLoading=false;});
  const catalog=await builderRepository.loadCatalogs(state.version);
  state.catalogSources={champions:catalog.champions.source,items:catalog.items.source};
  const advancedItems=itemLookup.loadCommunityDragonCalcs().catch(()=>null);
  state.champions=catalog.champions.records;
  const shop=CatalogQueries.builderCatalog(catalog.items.records);
  state.midBootIds=new Set(shop.midBootIds);state.questItemIds=new Set(shop.questItemIds);
  const entries=Object.entries(shop.items);
  const updateItemStats = () => { const itemCache=itemLookup.getState();
    state.items = ItemSource.prepareItems(Object.fromEntries(entries),itemCache.cdragonById,BuildStats);
  };
  updateItemStats();
  advancedItems.then(()=>{
    updateItemStats();
    if(!life.disposed && state.uiReady && state.activeSlot!==null) renderModalItemGrid();
  }).catch(error=>console.warn('Item filter data unavailable',error));
  state.enrichmentReady = Promise.all([advancedItems,runeData]).then(()=>{
    updateItemStats();
    if(life.disposed || !state.uiReady) return;
    renderRunePanel();renderStats();renderAbilityCards();
    if(state.activeSlot!==null)renderModalItemGrid();
  }).catch(error=>console.warn('Optional builder data unavailable',error));
  state.itemTags = new Set(Object.values(state.items).flatMap(item => item.tags || []));
}

function renderChampionSelect() {
  Object.keys(state.champions).forEach((name) => {
    (state.champions[name].tags || []).forEach((tag) => state.champTags.add(tag));
  });
  document.getElementById("championPickerBtn").innerHTML = "+";
  document.getElementById("championPickerBtn").setAttribute("aria-label", "Select champion");
}
function wirePickerDismissal(id, close) {
  const modal=document.getElementById(id); let backdropPress=false;
  life.on(modal,'pointerdown',event=>{backdropPress=event.target===modal;});
  life.on(modal,'click',event=>{if(backdropPress && event.target===modal) close();backdropPress=false;});
  life.on(modal,'keydown',event=>{if(event.key==='Escape'){close();}});
}
function selectSearchOnClick(id) {
  const input=document.getElementById(id);
  life.on(input,'click',()=>input.select());
}
function initChampionModal() {
  const modal = document.getElementById("champModal");
  life.on(document.getElementById("modalChampSearch"),"input", renderChampionModalGrid);
  wirePickerDismissal('champModal',closeChampionModal);
  selectSearchOnClick('modalChampSearch');
  const root = document.getElementById("modalChampFilters");
  root.innerHTML = Array.from(state.champTags).sort((a, b) => a.localeCompare(b))
    .map((tag) => `<label class="tag-pill"><input type="checkbox" class="champ-tag" value="${tag}"> ${tag}</label>`).join("");
  root.querySelectorAll(".champ-tag").forEach((cb) => life.on(cb,"change", renderChampionModalGrid));
}
function openChampionModal() {
  document.getElementById("champModal").classList.remove("hidden");
  renderChampionModalGrid();
  document.getElementById('modalChampSearch').focus();document.getElementById('modalChampSearch').select();
}
function closeChampionModal() {
  document.getElementById("champModal").classList.add("hidden");
}
function renderChampionModalGrid() {
  const text = document.getElementById("modalChampSearch").value.trim().toLowerCase();
  const tags = new Set(Array.from(document.querySelectorAll(".champ-tag:checked")).map((cb) => cb.value));
  state.modalChampFiltered=CatalogQueries.queryChampions(state.champions,{search:text,tags});

  document.getElementById("modalChampResults").textContent = `${state.modalChampFiltered.length} champions`;
  championList.update({ids:state.modalChampFiltered,records:state.champions,version:state.version});
  renderChampionModalDetail(state.modalChampFiltered[0] || null);
}
function setChampionFromModal(name) {
  setChampion(name);
  closeChampionModal();
}

const verifiedSplashes = new Set();
function splashAvailable(url) {
  if (verifiedSplashes.has(url)) return Promise.resolve(true);
  return new Promise(resolve => {
    const image = new viewport.Image();
    const timer = setTimeout(() => finish(false), 10000);
    const finish = ok => { clearTimeout(timer); image.onload = image.onerror = null; if(ok) verifiedSplashes.add(url); resolve(ok); };
    image.onload = () => finish(image.naturalWidth > 0);
    image.onerror = () => finish(false);
    image.src = url;
  });
}
async function populateSkinSelector(name, records, requestId) {
  const selector = document.getElementById('skinSelector');
  selector.replaceChildren(new viewport.Option('Checking splash art…', '')); selector.disabled = true;
  // Data Dragon's chromas flag means the base skin HAS chromas, not that it IS one.
  // Named colour variants use a parenthetical suffix; yearly prestige editions are separate skins.
  const candidates = records.filter(skin => !/\([^)]*\)$/.test(skin.name) || /\(\d{4}\)$/.test(skin.name));
  const available = await Promise.all(candidates.map(async skin => ({skin, ok:await splashAvailable(`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_${skin.num}.jpg`)})));
  if(life.disposed || requestId !== state.championRequestId) return;
  selector.replaceChildren();
  available.filter(entry=>entry.ok).forEach(({skin})=>selector.add(new viewport.Option(skin.num===0?'Original':skin.name,String(skin.num))));
  selector.disabled = !selector.options.length;
  if(selector.disabled) selector.add(new viewport.Option('No splash art available',''));
  life.property(selector,'onchange',() => { if(selector.value !== '') root.style.setProperty('--builder-splash-url',`url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_${selector.value}.jpg)`); });
}

let gameTextRequest=null;
function ensureGameText() {
  if(state.stringsReady) return Promise.resolve(state.strings);
  if(gameTextRequest) return gameTextRequest;
  state.stringsLoading=true;
  gameTextRequest=builderRepository.loadLocalization()
    .then(data=>{state.localizationSource=data.source;if(data.status!=='ready')throw new Error('Game descriptions unavailable');state.strings=data.entries;state.stringsReady=true;return state.strings;})
    .catch(()=>null).finally(()=>{
      gameTextRequest=null;state.stringsLoading=false;
      if(!life.disposed && state.uiReady){renderStats();renderAbilityCards();if(state.activeSlot!==null)renderModalItemDetail(state.inspectedItemId);}
    });
  return gameTextRequest;
}

async function setChampion(name) {
  if(life.disposed)return;
  const requestId = ++state.championRequestId;
  setStatus(`Loading ${name}...`);
  try {
    ensureGameText();
    const prepared=await builderRepository.loadChampion(state.version,name);
    if (life.disposed || requestId !== state.championRequestId) return;
    const {champion,raw,abilities}=prepared;
    state.selectedChampion=name;
    state.championData=champion;
    state.cdragonAbilityData=abilities;
    state.cdragonRaw=raw;
    state.championSources=prepared.sources;
    const nextInputs=BuildInputs.transitionChampion(state,name,Number(document.getElementById('builderLevel').value)||1);
    state.combatValues=nextInputs.combatValues;state.abilityRanks=nextInputs.abilityRanks;state.level=nextInputs.level;
    document.getElementById('dashboardChampionName').textContent = champion.name;
    document.getElementById('dashboardChampionTitle').textContent = champion.title;
    populateSkinSelector(name, champion.skins || [{num:0,name:'Original'}], requestId);
    root.style.setProperty('--builder-splash-url', `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg)`);
    document.getElementById('championPickerBtn').innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${state.version}/img/champion/${champion.image.full}" alt="${name}">`;
    document.getElementById('championPickerBtn').setAttribute('aria-label', `Selected champion: ${name}`);
    enforceAbilityRules();
    renderAbilityCards();
    renderStats();
    setStatus(raw ? '' : 'Basic stats loaded. Advanced ability data is unavailable.');
  } catch (error) {
    if (life.disposed || requestId !== state.championRequestId) return;
    console.warn('Champion selection failed', error);
    setStatus(`Could not load ${name}. Select the champion again to retry.`, true);
  }
}
function initItemModal() {
  renderBuilderTagFilters();
  life.on(document.getElementById("modalItemSearch"),"input", renderModalItemGrid);
  wirePickerDismissal('itemModal',closeItemModal);
  selectSearchOnClick('modalItemSearch');
  life.property(document.getElementById('allItemsTab'),'onclick',()=>{state.recommendedOnly=false;state.itemRole='';renderModalItemGrid();});
  life.property(document.getElementById('recommendedItemsTab'),'onclick',()=>{state.itemRole='';state.recommendedOnly=true;renderModalItemGrid();});
}
function clearModalFilters() {
  document.getElementById("modalItemSearch").value = "";
  document.querySelectorAll('[data-item-filter]').forEach(button=>button.setAttribute('aria-pressed','false'));
  state.recommendedOnly=false;
  state.itemRole='';
  renderModalItemGrid();
}

// Keep the client's filter order, while sharing artwork with Champion Stats.
const SHOP_FILTER_GROUPS = [
  ['Physical', [['Damage','Attack Damage','AD'],['CriticalStrike','Critical Strike','Crit %'],['AttackSpeed','Attack Speed','AS'],['OnHit','On-hit','On-hit'],['ArmorPenetration','Armor Penetration','ARPen']]],
  ['Magic', [['SpellDamage','Ability Power','AP'],['Mana','Mana & Mana Regen','MP'],['MagicPenetration','Magic Penetration','MRPen']]],
  ['Defense', [['Health','Health & Health Regen','HP'],['Armor','Armor','Arm'],['SpellBlock','Magic Resist','MR']]],
  ['Utility', [['AbilityHaste','Ability Haste','AH'],['NonbootsMovement','Move Speed','MS'],['LifeSteal','Lifesteal & Omnivamp','Lifesteal']]],
];
const SHOP_ROLES = [['Fighter',1],['Marksman',2],['Assassin',4],['Mage',16],['Tank',8],['Support',32]];

function renderBuilderTagFilters() {
  const root=document.getElementById('modalItemFilters');
  root.innerHTML=SHOP_FILTER_GROUPS.map(([name, filters])=>`<div class="shop-filter-group" role="group" aria-label="${name}">${filters.map(([tag,label,stat])=>`<button type="button" class="shop-filter" data-item-filter="${tag}" aria-label="${label}" title="${label}" aria-pressed="false"><span class="stat-icon" aria-hidden="true">${STAT_ICONS[stat]}</span></button>`).join('')}</div>`).join('');
  root.querySelectorAll('button').forEach(button=>life.property(button,'onclick',()=>{button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));renderModalItemGrid();}));
  document.getElementById('modalItemRoles').innerHTML=SHOP_ROLES.map(([name])=>`<button type="button" class="shop-category" data-item-role="${name}" aria-label="${name}" title="${name}" aria-pressed="false"><img src="assets/shop/${name.toLowerCase()}.png" alt=""></button>`).join('');
  document.querySelectorAll('[data-item-role]').forEach(button=>life.property(button,'onclick',()=>{
    state.itemRole=state.itemRole===button.dataset.itemRole?'':button.dataset.itemRole;
    state.recommendedOnly=false;
    renderModalItemGrid();
  }));
}
function recommendedItemIds() { return Recommendations.recommendedItemIds(state.cdragonRaw,state.championData,state.items); }
function openItemModal(slot) {
  ensureGameText();
  state.activeSlot = slot;
  if(slot>=6){state.recommendedOnly=false;state.itemRole='';document.getElementById('modalItemSearch').value='';document.querySelectorAll('[data-item-filter]').forEach(button=>button.setAttribute('aria-pressed','false'));}
  document.getElementById("itemModalTitle").textContent = state.activeSlot === 6 ? "Select Role Quest" : state.activeSlot === 7 ? "Select Boots" : "Select Item";
  document.getElementById("itemModal").classList.remove("hidden");
  renderModalItemGrid();
  document.getElementById('modalItemSearch').focus();document.getElementById('modalItemSearch').select();
}
function closeItemModal() {
  document.getElementById("itemModal").classList.add("hidden");
  state.activeSlot = null;
}
function renderModalItemGrid() {
  const text = document.getElementById("modalItemSearch").value.trim().toLowerCase();
  const tags = new Set([...document.querySelectorAll('[data-item-filter][aria-pressed="true"]')].map(button=>button.dataset.itemFilter));
  const recommendations=recommendedItemIds();
  const itemData=itemLookup.getState();
  const roleValue=SHOP_ROLES.find(([name])=>name===state.itemRole)?.[1];
  document.querySelectorAll('[data-item-role]').forEach(button=>{
    button.disabled=itemData.status!=='ready' || state.activeSlot===6;
    button.title=state.activeSlot===6 ? `${button.dataset.itemRole} — select a role quest below` : itemData.status==='ready' ? button.dataset.itemRole : `${button.dataset.itemRole} — ${itemData.status==='unavailable'?'class data unavailable':'loading item classes'}`;
    button.setAttribute('aria-pressed',String(state.itemRole===button.dataset.itemRole));
  });
  document.getElementById('recommendedItemsTab').hidden=!recommendations.size;
  if(!recommendations.size)state.recommendedOnly=false;
  document.getElementById('allItemsTab').setAttribute('aria-pressed',String(!state.recommendedOnly && !state.itemRole));
  document.getElementById('recommendedItemsTab').setAttribute('aria-pressed',String(!!state.recommendedOnly));
  state.modalItemFiltered=CatalogQueries.queryItems(state.items,{search:text,tags,sort:'price',
    eligible:id=>roleItemAllowed(id,state.activeSlot),recommended:state.recommendedOnly?recommendations:null,
    roleValue,advanced:itemData.cdragonById,shopTags:true,midBootIds:[...state.midBootIds]});
  const ids = state.modalItemFiltered;
  document.getElementById("modalResultsCount").textContent = `${ids.length} ${state.recommendedOnly?'recommended items':'items shown'}`;
  itemList.update({ids:ids,records:state.items,version:state.version});
  renderModalItemDetail(ids.includes(state.itemSlots[state.activeSlot]) ? state.itemSlots[state.activeSlot] : ids[0] || null);
}
function inventoryData() { return {items:state.items,midBootIds:state.midBootIds,questItemIds:state.questItemIds}; }
function roleLevelCap() { return BuildInputs.roleLevelCap(state); }

function roleItemAllowed(id,slot) { return BuildInputs.eligibility(state,id,slot,inventoryData()).allowed; }
function setSlotItem(itemId) {
 if(life.disposed)return;
 const slot=state.activeSlot;
 const result=BuildInputs.transitionInventory(state,slot,itemId,inventoryData());
 if(!result.accepted){if(result.reasonCode==='inventory-full')setStatus(result.reason,true);return;}
 state.itemSlots=result.inputs.itemSlots;state.level=result.inputs.level;state.abilityRanks=result.inputs.abilityRanks;
 if(slot===6){wireLevelOptions();enforceAbilityRules();}
 renderItemSlots();renderStats();renderAbilityCards();closeItemModal();setStatus('');
}
function abilityMaxByLevel(level, spellKey) {
  return AbilityRules.abilityMaxByLevel(level, spellKey);
}
function enforceAbilityRules() {
  state.abilityRanks = AbilityRules.enforceAbilityRules(state.level, state.abilityRanks);
}

function extractPassiveLabelsFromText(...args) { return builderEvaluation().stats.extractPassiveLabelsFromText(...args); }

/**
 * Resolves an item description using shared Item Lookup transformers so formulas/cooldowns are concrete.
 * @param {object} item Data Dragon item payload.
 * @param {string} itemId Numeric item id.
 * @param {object} options Resolution options.
 * @param {boolean} [options.forModal=false] Applies modal-only formatting helpers.
 * @returns {{html: string, formulaRows: {name: string, formula: string}[]}} Enhanced tooltip and extracted formulas.
 */
function resolveItemDescriptionHtml(item, itemId = "", options = {}) {
  const { forModal = false } = options;
  const shared = getItemLookupShared();
  {
    const context=calculationContext(getComputedChampionStatsForTooltips());
    const result=ItemDescriptions.describe({id:itemId,item,source:shared.getState().cdragonById[itemId],strings:state.strings||{},context});
    return {html:shared.colorizeStatsInHtml(result.html),formulaRows:[],sections:result.sections};
  }

}

/**
 * Extracts passive/on-hit/unique sections from an item tooltip and returns display-ready rows.
 * @param {string} descriptionHtml Tooltip html.
 * @returns {{label: string, impact: string}[]} Passive rows.
 */

function computeDerivedBuildStats(...args) { return builderEvaluation().stats.computeDerivedBuildStats(...args); }
function itemPassiveEnabled(...args) { return builderEvaluation().stats.itemPassiveEnabled(...args); }
function renderPassivePanel() {
  const root=document.getElementById('passiveModalList');
  if(!root)return;
  const rows=[];
  const computed=computeDerivedBuildStats();
  for(const id of [...new Set(state.itemSlots.filter(Boolean))]){
    if(state.questItemIds?.has(id))continue;
    const item=state.items[id];
    if(!item)continue;
    const result=resolveItemDescriptionHtml(item,id);
    for(const section of result.sections||[]){
      if(section.active)continue;
      const key=`${id}:${section.key}`,activation=id==='4645'&&state.target.enabled?null:AttackEffects.itemPassiveBindings?.[id]?.[section.key];
      const modeled=Object.hasOwn(AttackEffects.itemPassiveBindings?.[id]||{},section.key)
        || ['3042:awe','3040:awe','3089:magical-opus','3083:warmog-s-vitality'].includes(key);
      const enabled=itemPassiveEnabled(id,section.key) && (!activation || state.combatValues[activation]===true);
      let html=section.html;
      if(id==='3089' && section.key==='magical-opus' && computed){
        const amount=enabled?builderEvaluation().stats.itemContribution(id,section.key,computed):0;
        html+=` <scaleAP>(+${ItemDescriptions.number(amount)} AP)</scaleAP>`;
      }
      rows.push(`<section class="ability-card passive-effect-card${enabled?'':' passive-disabled'}" data-passive-section="${key}"><div class="passive-effect-heading"><strong>${ItemDescriptions.escape(item.name)} — ${ItemDescriptions.escape(section.label)}</strong><button type="button" class="btn btn-sm" data-item-passive="${key}" aria-pressed="${enabled}" aria-label="${ItemDescriptions.escape(item.name+' — '+section.label)}">${enabled?'On':'Off'}</button></div><div class="passive-description">${html}</div>${modeled?'':'<p class="text-muted passive-coverage">Reference effect: not included in damage or stat totals.</p>'}</section>`);
    }
  }
  root.innerHTML=rows.join('')||`<p class="text-muted">${state.stringsLoading?'Loading passive descriptions…':'Equip items to inspect their passives.'}</p>`;

}
function togglePassivePanel() {
  ensureGameText();
  document.getElementById('passiveModal').classList.remove('hidden');
  renderPassivePanel();
}
function closePassiveModal() {
  document.getElementById("passiveModal").classList.add("hidden");
}
function getChampionPassiveRangeBonus(...args) { return builderEvaluation().stats.getChampionPassiveRangeBonus(...args); }

function getComputedChampionStatsForTooltips(...args) { return builderEvaluation().stats.getComputedChampionStatsForTooltips(...args); }

function baseCalculationContext(...args) { return builderEvaluation().stats.baseCalculationContext(...args); }
function calculationContext(...args) { return builderEvaluation().stats.calculationContext(...args); }

function renderStats(){
 targetControls?.update(state.target);
 const evaluation=builderEvaluation(),computed=evaluation.stats.computeDerivedBuildStats();
 statsView?.update({computed,summary:computed?evaluation.stats.summary(computed):null,rangeBonus:computed?evaluation.stats.getChampionPassiveRangeBonus():0});
 renderPassivePanel();
}
function abilityModel(){return {...BuildInputs.readBuildInputs(state),...ScenarioInputs.createScenarioInputs(state),version:state.version,championData:state.championData,cdragonAbilityData:state.cdragonAbilityData,cdragonRaw:state.cdragonRaw};}
function runeModel(){return {runeSelections:state.runeSelections,runeStacks:state.runeStacks,gameTimeMinutes:state.gameTimeMinutes,runesLoading:state.runesLoading};}
function invalidate(){if(life.disposed)return;renderStats();renderAbilityCards();}
function mountComponents(){
 life.on(elements.passiveModalList,'click',event=>{
 const button=event.target.closest('[data-item-passive]');if(!button||!elements.passiveModalList.contains(button))return;
    const key=button.dataset.itemPassive;
    const [id,passive]=key.split(':'),enabled=button.getAttribute('aria-pressed')==='true';
    state.disabledItemPassives[key]=enabled;
    const activation=AttackEffects.itemPassiveBindings?.[id]?.[passive];
    if(!enabled && activation)state.combatValues[activation]=true;
    renderStats();renderAbilityCards();
    if(state.activeSlot!==null)renderModalItemDetail(state.inspectedItemId);

 });
 statsView=createStatsView({root:elements.statsTable});
 championList=createCatalogList({root:elements.modalChampGrid,kind:'champion',onInspect:renderChampionModalDetail,onSelect:setChampionFromModal});
 championDetail=createChampionDetail({root:elements.modalChampDetail,loadDetail:async name=>(await repository.loadChampionDetails(state.version,name)).record});
 itemList=createCatalogList({root:elements.modalItemGrid,kind:'item',onSelect:renderModalItemDetail});
 itemDetail=createItemDetail({root:elements.modalItemDetail,onSelect:setSlotItem,onCombatChange:values=>{state.combatValues=values;invalidate();renderModalItemDetail(state.inspectedItemId);},describe:(item,id)=>resolveItemDescriptionHtml(item,id,{forModal:true})});
 inventory=createInventory({root:elements.itemSlots,cost:elements.buildGoldCost,onSelect:openItemModal,idPrefix:''});
 targetControls=createTargetControls({elements:pick('targetModal','targetSettingsBtn','closeTargetModal','targetMaxHp','targetCurrentHp','targetArmor','targetMr','targetDamageReduction','targetEnabled','targetFields','targetStatus'),initial:state.target,onChange:target=>{state.target=target;invalidate();if(state.activeSlot!==null)renderModalItemDetail(state.inspectedItemId);}});
 abilityControls=createAbilityControls({elements:pick('abilityCards','attackSummary','attackSettings','combatInputs','abilityRuleHint','attackSettingsHint'),initial:abilityModel(),idPrefix:'',evaluate:builderEvaluation,onChange:patch=>{Object.assign(state,patch);invalidate();}});
 comboControls=createComboControls({elements:pick('comboSequence','comboSteps','comboResult','comboClear','comboActionList','comboEditModal','comboQuick','comboEditTitle','comboEditFields','closeComboEdit','comboDamageTooltip','comboActionModal','closeComboActions','comboResetStep'),events:root,initial:abilityModel(),evaluate:builderEvaluation});
}
function mountRunes(){
 runeControls=createRuneControls({elements:pick('gameTime','runeStacksModal','runeStacksBtn','closeRuneStacksBtn','runeStacksList','runePanel','runeTooltip','runesCard','runeModal','runeModalTitle','runeModalList','closeRuneModalBtn'),events:root,initial:runeModel(),idPrefix:'',data:RUNE_DATA,
 evaluateStacks:model=>CalculationPipeline.create({build:{...BuildInputs.readBuildInputs(state),runeSelections:model.runeSelections,runeStacks:model.runeStacks},scenario:{target:state.target,gameTimeMinutes:model.gameTimeMinutes},data:builderEvaluation().data}).stats.getStackRuneEffects(),
 onChange:patch=>{Object.assign(state,patch);renderRunePanel();invalidate();}});
}
function renderChampionModalDetail(id){state.hoveredChampion=id;return championDetail?.update({id,record:state.champions[id],version:state.version});}
function renderModalItemDetail(id){state.inspectedItemId=id;itemList?.select(id);renderCombatInputs();itemDetail?.update({id,item:state.items[id],version:state.version,source:itemLookup.getState().cdragonById[id],base:baseCalculationContext(getComputedChampionStatsForTooltips()),values:state.combatValues});}
function renderItemSlots(){inventory?.update({slots:state.itemSlots,items:state.items,version:state.version});}
function refreshSlotLabels(){renderItemSlots();}
function renderRunePanel(){runeControls?.update(runeModel(),RUNE_DATA);}
function renderAbilityCards(){comboControls?.update(abilityModel());abilityControls?.update(abilityModel());}
function renderCombatInputs(){abilityControls?.refreshCombat();}

function dispose(){
 if(life.disposed)return;state.uiReady=false;state.championRequestId++;life.dispose();
 for(const view of [statsView,championList,championDetail,itemList,itemDetail,inventory,targetControls,runeControls,abilityControls,comboControls])view?.dispose();
 for(const name of ['champModal','itemModal','passiveModal'])elements[name]?.classList.add('hidden');
}

let startRequest=null;
const start=()=>life.disposed?Promise.resolve():startRequest||(startRequest=initBuilder());
return {start,dispose,get combo(){return comboControls;},get state(){return state;},runes:RUNE_DATA,inspect:{resolveItemDescriptionHtml,setChampion,setSlotItem,renderItemSlots,refreshSlotLabels,renderStats,renderAbilityCards,renderRunePanel,renderModalItemDetail,renderModalItemGrid,renderChampionModalGrid,renderChampionModalDetail,openChampionModal,closeChampionModal,openItemModal,closeItemModal,renderPassivePanel,togglePassivePanel,closePassiveModal,ensureGameText,enforceAbilityRules,builderEvaluation,getItemLookupShared,isApAdaptiveChampion}};
}
