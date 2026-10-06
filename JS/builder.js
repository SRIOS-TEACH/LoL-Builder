function builderEvaluation(scenario={target:BUILDER.target,gameTimeMinutes:BUILDER.gameTimeMinutes}) {
 return window.CalculationPipeline.create({build:window.BuildInputs.readBuildInputs(BUILDER),scenario,
  data:{champion:BUILDER.championData,championRaw:BUILDER.cdragonRaw,abilities:BUILDER.cdragonAbilityData,
   items:BUILDER.items,advancedItems:getItemLookupShared().getState().cdragonById,runes:RUNE_DATA.runeLookup,
   strings:BUILDER.strings,stringsReady:BUILDER.stringsReady,stringsLoading:BUILDER.stringsLoading}});
}
const STAT_ICONS = {
  "On-hit": "💥",
  "HP": "❤️",
  "MP": "🔷",
  "HP/5": "💚",
  "MP/5": "💙",
  "AD": "🗡️",
  "AP": "✨",
  "Range": "🏹",
  "AH": "⏱️",
  "Arm": "🛡️",
  "MR": "🔮",
  "AS": "⚡",
  "MS": "👟",
  "Crit %": "🎯",
  "Crit Dmg": "💥",
  "ARPen": "🪓",
  "MRPen": "🔹",
  "Lifesteal": "🩸",
  "Tenacity": "🦶"
};

const builderRepository=window.SourceRepositories.createRepository();
const BUILDER = {
  ...window.BuildInputs.createBuildInputs(),
  ...window.ScenarioInputs.createScenarioInputs(),
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

const RUNE_DATA = {
  pathDefaults: {},
  paths: {},
  runeLookup: {
    "adaptive-force": { name: "Adaptive", desc: "+9 Adaptive Force", longDesc: "+9 Adaptive Force", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAdaptiveForceIcon.png" },
    "attack-speed": { name: "Attack Speed", desc: "+10% Attack Speed", longDesc: "+10% Attack Speed", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAttackSpeedIcon.png" },
    "ability-haste": { name: "Ability Haste", desc: "+8 Ability Haste", longDesc: "+8 Ability Haste", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsCDRScalingIcon.png" },
    "move-speed": { name: "Move Speed", desc: "+2.5% Move Speed", longDesc: "+2.5% Move Speed", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsMovementSpeedIcon.png" },
    "scaling-health": { name: "Scaling Health", desc: "+10-200 Bonus Health", longDesc: "+10-200 Bonus Health", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png" },
    health: { name: "Health", desc: "+65 Bonus Health", longDesc: "+65 Bonus Health", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthPlusIcon.png" },
    "tenacity-slow-resist": { name: "Tenacity & Slow Resist", desc: "+15% Tenacity and Slow Resist", longDesc: "+15% Tenacity and Slow Resist", icon: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsTenacityIcon.png" },
  },
  shardOptions: ["adaptive-force", "attack-speed", "ability-haste", "move-speed", "scaling-health", "health", "tenacity-slow-resist"],
};

function slugifyRuneName(...args) { return window.RuneSource.slugifyRuneName(...args); }
function toDdragonPerkIcon(...args) { return window.RuneSource.toDdragonPerkIcon(...args); }
function stripHtml(...args) { return window.TextValues.stripHtml(...args); }
function buildPathDefaults(...args) { return window.RuneSource.buildPathDefaults(...args); }

function initializeRuneSelections() {
 BUILDER.runeSelections=window.RuneInputRules.createRules(RUNE_DATA).initialize(BUILDER.runeSelections);
}

function isApAdaptiveChampion(...args) { return builderEvaluation().stats.isApAdaptiveChampion(...args); }

async function hydrateRunesFromDdragon(version) {
  const runes = await builderRepository.loadRunes(version).then(result=>{BUILDER.runeSource=result.source;return result.records;}).catch(() => null);
  if (!Array.isArray(runes) || !runes.length) return;

  Object.assign(RUNE_DATA, window.RuneSource.normalizeRunes(runes,RUNE_DATA.paths,RUNE_DATA.runeLookup));
  initializeRuneSelections();
}

function setStatus(message, isError = false) {
  const el = document.getElementById("builderStatus");
  el.textContent = message || "";
  el.classList.toggle("status-error", isError);
}

async function initBuilder() {
  try {
    setStatus("Loading champion and item data...");
    wireLevelOptions();
    initTargetSettings();
    await loadBuilderData();
    renderChampionSelect();
    renderItemSlots();
    initItemModal();
    initChampionModal();
    renderRunePanel();
    renderAbilityCards();
    renderStats();
    wireBuilderUiEvents();
    BUILDER.uiReady=true;
    document.getElementById("passiveModal").addEventListener("click", (event) => {
      if (event.target.id === "passiveModal") closePassiveModal();
    });
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus("Failed to load data. Check internet connection and refresh.", true);
  }
}

function initTargetSettings() {
  const modal = document.getElementById('targetModal');
  document.getElementById('targetSettingsBtn').addEventListener('click', () => modal.showModal());
  document.getElementById('closeTargetModal').addEventListener('click', () => modal.close());
  modal.addEventListener('close', () => document.getElementById('targetSettingsBtn').focus());
  let backdrop = false;
  modal.addEventListener('pointerdown', event => { backdrop = event.target === modal && (event.offsetX < 0 || event.offsetY < 0 || event.offsetX > modal.clientWidth || event.offsetY > modal.clientHeight); });
  modal.addEventListener('click', event => { if (backdrop && event.target === modal) modal.close(); backdrop = false; });
  const fields={targetMaxHp:'maxHp',targetCurrentHp:'currentHp',targetArmor:'armor',targetMr:'mr',targetDamageReduction:'damageReduction'};
  const sync=()=>{
    BUILDER.target=window.TargetDamage.normalize(BUILDER.target);
    for(const [id,key]of Object.entries(fields))document.getElementById(id).value=BUILDER.target[key];
    document.getElementById('targetCurrentHp').max=BUILDER.target.maxHp;
    const button=document.getElementById('targetEnabled');
    button.setAttribute('aria-pressed',String(BUILDER.target.enabled));button.textContent=BUILDER.target.enabled?'On':'Off';
    document.getElementById('targetFields').classList.toggle('target-inactive',!BUILDER.target.enabled);
    document.getElementById('targetStatus').textContent=BUILDER.target.enabled?'On: damage against this target. True damage ignores defences and reduction.':'Off: damage before target defences. Target values are retained.';
  };
  let rendered=JSON.stringify(BUILDER.target);
  const update=(commit=true)=>{
    if(commit)sync();
    const next=JSON.stringify(BUILDER.target);
    if(next===rendered)return;
    rendered=next;renderStats();renderAbilityCards();if(BUILDER.activeSlot!==null)renderModalItemDetail(BUILDER.inspectedItemId);
  };
  document.getElementById('targetEnabled').addEventListener('click',()=>{BUILDER.target.enabled=!BUILDER.target.enabled;update();});
  const read=()=>{
    const draft={...BUILDER.target};
    for(const [id,key]of Object.entries(fields)){
      const input=document.getElementById(id),value=Number(input.value);
      if(input.value.trim()&&Number.isFinite(value))draft[key]=value;
    }
    BUILDER.target=window.TargetDamage.normalize(draft);
  };
  for(const id of Object.keys(fields)){
    const input=document.getElementById(id);
    input.addEventListener('input',()=>{read();update(false);});
    // Damage updates while typing, so a later blur does not replace the button
    // the user is in the middle of clicking. Commit only formats/clamps fields.
    input.addEventListener('change',()=>{read();update();});
  }
  sync();
}

function wireBuilderUiEvents() {
  initRuneControls();
  document.getElementById("championPickerBtn").addEventListener("click", openChampionModal);
  document.getElementById("passiveToggleBtn").addEventListener("click", togglePassivePanel);
  document.getElementById("resetItemFilters").addEventListener("click", clearModalFilters);
  document.getElementById("closeItemModalBtn").addEventListener("click", closeItemModal);
  document.getElementById("closeChampModalBtn").addEventListener("click", closeChampionModal);
  document.getElementById("closeRuneModalBtn").addEventListener("click", closeRuneModal);
  document.getElementById("closePassiveModalBtn").addEventListener("click", closePassiveModal);

  document.getElementById("modalChampGrid").addEventListener("mouseover", (event) => {
    const btn = event.target.closest("[data-champ]");
    if (!btn) return;
    if(BUILDER.hoveredChampion!==btn.dataset.champ){BUILDER.hoveredChampion=btn.dataset.champ;renderChampionModalDetail(btn.dataset.champ);}
  });
  document.getElementById("modalChampGrid").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-champ]");
    if (!btn) return;
    setChampionFromModal(btn.dataset.champ);
  });
  document.getElementById("itemSlots").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-slot]");
    if (!btn) return;
    openItemModal(Number(btn.dataset.slot));
  });
  document.getElementById("modalItemGrid").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-item-id]");
    if (!btn) return;
    renderModalItemDetail(btn.dataset.itemId);
  });
  document.getElementById("modalItemDetail").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-set-item-id]");
    if (!btn) return;
    setSlotItem(btn.dataset.setItemId);
  });
  document.getElementById("runePanel").addEventListener("click", (event) => {
    const quickBtn = event.target.closest("[data-rune-choice-target][data-rune-choice-id]");
    if (quickBtn && !quickBtn.disabled) {
      BUILDER.runeModalTarget = quickBtn.dataset.runeChoiceTarget;
      selectRuneOption(quickBtn.dataset.runeChoiceId);
      return;
    }
    const btn = event.target.closest("[data-rune-target]");
    if (!btn) return;
    openRuneModal(btn.dataset.runeTarget);
  });
  document.getElementById("runeModalList").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-rune-option-id]");
    if (!btn || btn.disabled) return;
    selectRuneOption(btn.dataset.runeOptionId);
  });
}

function initRuneControls() {
  const time = document.getElementById('gameTime');
  const updateBuild = () => { renderStats(); renderAbilityCards(); };
  time.value = BUILDER.gameTimeMinutes;
  time.addEventListener('input', () => {
    if (!time.value.trim()) return;
    BUILDER.gameTimeMinutes = window.ScenarioInputs.normalizeGameTime(time.value);
    updateBuild();
  });
  time.addEventListener('change', () => { BUILDER.gameTimeMinutes = window.ScenarioInputs.normalizeGameTime(time.value); time.value = BUILDER.gameTimeMinutes; updateBuild(); });

  const modal = document.getElementById('runeStacksModal');
  const close = () => { modal.classList.add('hidden'); document.getElementById('runeStacksBtn').focus(); };
  document.getElementById('runeStacksBtn').addEventListener('click', () => {
    hideRuneTooltip(); renderRuneStacks(); modal.classList.remove('hidden');
    (modal.querySelector('input') || document.getElementById('closeRuneStacksBtn')).focus();
  });
  document.getElementById('closeRuneStacksBtn').addEventListener('click', close);
  let backdropPressed = false;
  modal.addEventListener('pointerdown', event => { backdropPressed = event.target === modal; });
  modal.addEventListener('click', event => { if (backdropPressed && event.target === modal) close(); backdropPressed = false; });
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const controls = [...modal.querySelectorAll('button, input')], first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  const updateStack = (event, commit) => {
    const input = event.target.closest('[data-rune-stack]');
    if (!input || (!commit && !input.value.trim())) return;
    const id = input.dataset.runeStack, field = window.RuneEffects.fields(BUILDER, RUNE_DATA.runeLookup).find(field => field.id === id);
    if (!field) return;
    BUILDER.runeStacks[id] = window.RuneEffects.normalize(input.value, field);
    if (commit) input.value = BUILDER.runeStacks[id];
    updateBuild();
    const note = document.getElementById(`rune-stack-note-${id}`);
    if (note) note.textContent = getStackRuneEffects().notes[id] || '';
  };
  document.getElementById('runeStacksList').addEventListener('input', event => updateStack(event, false));
  document.getElementById('runeStacksList').addEventListener('change', event => updateStack(event, true));

  const panel = document.getElementById('runePanel');
  for (const type of ['mouseover', 'focusin']) panel.addEventListener(type, event => {
    const button = event.target.closest('[data-desc]');
    if (button) showRuneTooltip(button);
  });
  panel.addEventListener('mouseout', event => { if (!event.target.closest('[data-desc]')?.contains(event.relatedTarget)) hideRuneTooltip(); });
  panel.addEventListener('focusout', hideRuneTooltip);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hideRuneTooltip(); });
  window.addEventListener('resize', hideRuneTooltip);
  document.addEventListener('scroll', hideRuneTooltip, true);
}

function getStackRuneEffects(...args) { return builderEvaluation().stats.getStackRuneEffects(...args); }

function renderRuneStacks() {
  const fields = window.RuneEffects.fields(BUILDER, RUNE_DATA.runeLookup), notes = getStackRuneEffects().notes;
  const escape = window.ItemDescriptions.escape;
  document.getElementById('runeStacksList').innerHTML = fields.length ? fields.map(field => `<div class="rune-stack-row"><label for="rune-stack-${field.id}"><strong>${escape(field.name)}</strong><span>${escape(field.label)}</span></label><input id="rune-stack-${field.id}" class="form-control" type="number" min="0" ${field.max === undefined ? '' : `max="${field.max}"`} step="1" data-rune-stack="${field.id}" value="${window.RuneEffects.normalize(BUILDER.runeStacks[field.id], field)}" aria-describedby="rune-stack-note-${field.id}"><small id="rune-stack-note-${field.id}" class="text-muted">${escape(notes[field.id] || '')}</small></div>`).join('') : '<p class="text-muted">Your selected runes have no stack counters.</p>';
}

function hideRuneTooltip() {
  document.getElementById('runeTooltip').hidden = true;
  document.querySelectorAll('[aria-describedby="runeTooltip"]').forEach(button => button.removeAttribute('aria-describedby'));
}

function showRuneTooltip(button) {
  const tooltip = document.getElementById('runeTooltip');
  hideRuneTooltip();
  if (!button.dataset.desc) return;
  tooltip.textContent = button.dataset.desc;
  tooltip.hidden = false;
  button.setAttribute('aria-describedby', 'runeTooltip');
  const box = button.getBoundingClientRect(), gap = 10, width = tooltip.offsetWidth, height = tooltip.offsetHeight;
  const right = box.right + gap, left = right + width <= innerWidth - gap ? right : box.left - width - gap;
  tooltip.style.left = `${Math.max(gap, Math.min(innerWidth - width - gap, left))}px`;
  tooltip.style.top = `${Math.max(gap, Math.min(innerHeight - height - gap, box.top))}px`;
}

function wireLevelOptions() {
  const level = document.getElementById("builderLevel");
  level.innerHTML = Array.from({ length: roleLevelCap() }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  level.value = String(BUILDER.level);
  level.onchange = () => {
    BUILDER.level = Number(level.value);
    enforceAbilityRules();
    renderAbilityCards();
    renderStats();
  };
}

function getItemLookupShared() {
  return window.ItemLookupShared;
}

async function loadBuilderData() {
  BUILDER.version = await window.ApiClient.fetchLatestVersion();
  BUILDER.runesLoading=true;
  const runeData = hydrateRunesFromDdragon(BUILDER.version).catch(()=>null).finally(()=>{BUILDER.runesLoading=false;});
  const catalog=await builderRepository.loadCatalogs(BUILDER.version);
  BUILDER.catalogSources={champions:catalog.champions.source,items:catalog.items.source};
  const advancedItems=window.ItemLookupShared.loadCommunityDragonCalcs().catch(()=>null);
  BUILDER.champions=catalog.champions.records;
  const shop=window.CatalogQueries.builderCatalog(catalog.items.records);
  BUILDER.midBootIds=new Set(shop.midBootIds);BUILDER.questItemIds=new Set(shop.questItemIds);
  const entries=Object.entries(shop.items);
  const updateItemStats = () => { const state=window.ItemLookupShared.getState();
    BUILDER.items = window.ItemSource.prepareItems(Object.fromEntries(entries),state.cdragonById,window.BuildStats);
  };
  updateItemStats();
  advancedItems.then(()=>{
    updateItemStats();
    if(BUILDER.uiReady && BUILDER.activeSlot!==null) renderModalItemGrid();
  }).catch(error=>console.warn('Item filter data unavailable',error));
  BUILDER.enrichmentReady = Promise.all([advancedItems,runeData]).then(()=>{
    updateItemStats();
    if(!BUILDER.uiReady) return;
    renderRunePanel();renderStats();renderAbilityCards();
    if(BUILDER.activeSlot!==null)renderModalItemGrid();
  }).catch(error=>console.warn('Optional builder data unavailable',error));
  BUILDER.itemTags = new Set(Object.values(BUILDER.items).flatMap(item => item.tags || []));
}

function readNumericStat(...args) { return window.ItemSource.readNumericStat(...args); }
function buildMergedItemStats(...args) { return window.ItemSource.buildMergedItemStats(...args); }

function renderChampionSelect() {
  Object.keys(BUILDER.champions).forEach((name) => {
    (BUILDER.champions[name].tags || []).forEach((tag) => BUILDER.champTags.add(tag));
  });
  document.getElementById("championPickerBtn").innerHTML = "+";
  document.getElementById("championPickerBtn").setAttribute("aria-label", "Select champion");
}

function wirePickerDismissal(id, close) {
  const modal=document.getElementById(id); let backdropPress=false;
  modal.addEventListener('pointerdown',event=>{backdropPress=event.target===modal;});
  modal.addEventListener('click',event=>{if(backdropPress && event.target===modal) close();backdropPress=false;});
  modal.addEventListener('keydown',event=>{if(event.key==='Escape'){close();}});
}
function selectSearchOnClick(id) {
  const input=document.getElementById(id);
  input.addEventListener('click',()=>input.select());
}

function initChampionModal() {
  const modal = document.getElementById("champModal");
  document.getElementById("modalChampSearch").addEventListener("input", renderChampionModalGrid);
  wirePickerDismissal('champModal',closeChampionModal);
  selectSearchOnClick('modalChampSearch');
  const root = document.getElementById("modalChampFilters");
  root.innerHTML = Array.from(BUILDER.champTags).sort((a, b) => a.localeCompare(b))
    .map((tag) => `<label class="tag-pill"><input type="checkbox" class="champ-tag" value="${tag}"> ${tag}</label>`).join("");
  root.querySelectorAll(".champ-tag").forEach((cb) => cb.addEventListener("change", renderChampionModalGrid));
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
  BUILDER.modalChampFiltered=window.CatalogQueries.queryChampions(BUILDER.champions,{search:text,tags});

  document.getElementById("modalChampResults").textContent = `${BUILDER.modalChampFiltered.length} champions`;
  document.getElementById("modalChampGrid").innerHTML = BUILDER.modalChampFiltered
    .map((name) => `<button class="item-button-icon" data-champ="${name}" title="${name}"><img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${BUILDER.champions[name].image.full}" alt="${name}" loading="lazy" decoding="async"><span class="picker-champ-name">${BUILDER.champions[name].name}</span></button>`)
    .join("");
  renderChampionModalDetail(BUILDER.modalChampFiltered[0] || null);
}

async function renderChampionModalDetail(name) {
  BUILDER.hoveredChampion=name;
  const root = document.getElementById("modalChampDetail");
  if (!name) {
    ++BUILDER.championModalRequestId;
    root.innerHTML = "<p class='text-muted'>No champion found.</p>";
    return;
  }

  const reqId = ++BUILDER.championModalRequestId;
  const c = BUILDER.champions[name];
  root.innerHTML = `<h3>${name}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${c.image.full}' alt='${name}'><p><strong>Tags:</strong> ${(c.tags || []).join(", ")}</p><p>${c.blurb}</p><div class='champ-ability-strip'><span class='text-muted'>Loading abilities...</span></div>`;

  if (!BUILDER.championDetailCache[name]) {
    const data = await builderRepository.loadChampionDetails(BUILDER.version,name).catch(()=>null);
    BUILDER.championDetailCache[name] = data?.record || null;
  }
  if (reqId !== BUILDER.championModalRequestId) return;

  const detail = BUILDER.championDetailCache[name];
  const spells = detail?.spells || [];
  const icons = spells.map((s) => `<img class='champ-ability-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/spell/${s.image.full}' title='${s.name}' alt='${s.name}' loading='lazy'>`).join("");
  root.innerHTML = `<h3>${name}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${c.image.full}' alt='${name}'><p><strong>Tags:</strong> ${(c.tags || []).join(", ")}</p><p>${c.blurb}</p><div class='champ-ability-strip'>${icons || "<span class='text-muted'>No abilities found.</span>"}</div>`;
}

function setChampionFromModal(name) {
  setChampion(name);
  closeChampionModal();
}

function getRuneMeta(id) {
  return RUNE_DATA.runeLookup[id] || { name: "Select", desc: "Pick a rune", longDesc: "Pick a rune", icon: "" };
}

function runeImgTag(meta, className = "") {
  const fallback = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2NCcgaGVpZ2h0PSc2NCc+PHJlY3Qgd2lkdGg9JzY0JyBoZWlnaHQ9JzY0JyByeD0nMzInIGZpbGw9JyMxMTFmM2QnLz48Y2lyY2xlIGN4PSczMicgY3k9JzMyJyByPScyNicgZmlsbD0nIzI3M2Q3MCcvPjwvc3ZnPg==";
  return `<img class="${className}" src="${meta.icon || fallback}" alt="${meta.name}" data-fallback="${fallback}" onerror="this.onerror=null;this.src=this.dataset.fallback">`;
}

function normalizeCdragonChampionPath(...args) { return window.ChampionSource.normalizeCdragonChampionPath(...args); }
function normalizeCdragonRecordPath(...args) { return window.ChampionSource.normalizeCdragonRecordPath(...args); }
function resolveCdragonRecord(...args) { return window.ChampionSource.resolveCdragonRecord(...args); }
function extractCdragonSpell(...args) { return window.ChampionSource.extractCdragonSpell(...args); }
function normalizeSpellRecordName(...args) { return window.ChampionSource.normalizeSpellRecordName(...args); }
function extractTooltipTokens(...args) { return window.ChampionSource.extractTooltipTokens(...args); }
function spellDataValueName(...args) { return window.ChampionSource.spellDataValueName(...args); }
function scoreSpellChildCandidate(...args) { return window.ChampionSource.scoreSpellChildCandidate(...args); }
function chooseBestSpellChild(...args) { return window.ChampionSource.chooseBestSpellChild(...args); }
function addSpellPayloadAlias(...args) { return window.ChampionSource.addSpellPayloadAlias(...args); }
function buildSpellPayloadLookupEntry(...args) { return window.ChampionSource.buildSpellPayloadLookupEntry(...args); }
function getObjectPathTail(...args) { return window.ChampionSource.getObjectPathTail(...args); }
function buildSpellAliasMetadata(...args) { return window.ChampionSource.buildSpellAliasMetadata(...args); }
function registerSpellPayloadAliases(...args) { return window.ChampionSource.registerSpellPayloadAliases(...args); }
function extractAbilityDataFromRoot(...args) { return window.ChampionSource.extractAbilityDataFromRoot(...args); }
function extractChampionStatsFromBinRoot(...args) { return window.ChampionSource.extractChampionStatsFromBinRoot(...args); }

const verifiedSplashes = new Set();
function splashAvailable(url) {
  if (verifiedSplashes.has(url)) return Promise.resolve(true);
  return new Promise(resolve => {
    const image = new Image();
    const timer = setTimeout(() => finish(false), 10000);
    const finish = ok => { clearTimeout(timer); image.onload = image.onerror = null; if(ok) verifiedSplashes.add(url); resolve(ok); };
    image.onload = () => finish(image.naturalWidth > 0);
    image.onerror = () => finish(false);
    image.src = url;
  });
}
async function populateSkinSelector(name, records, requestId) {
  const selector = document.getElementById('skinSelector');
  selector.replaceChildren(new Option('Checking splash art…', '')); selector.disabled = true;
  // Data Dragon's chromas flag means the base skin HAS chromas, not that it IS one.
  // Named colour variants use a parenthetical suffix; yearly prestige editions are separate skins.
  const candidates = records.filter(skin => !/\([^)]*\)$/.test(skin.name) || /\(\d{4}\)$/.test(skin.name));
  const available = await Promise.all(candidates.map(async skin => ({skin, ok:await splashAvailable(`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_${skin.num}.jpg`)})));
  if(requestId !== BUILDER.championRequestId) return;
  selector.replaceChildren();
  available.filter(entry=>entry.ok).forEach(({skin})=>selector.add(new Option(skin.num===0?'Original':skin.name,String(skin.num))));
  selector.disabled = !selector.options.length;
  if(selector.disabled) selector.add(new Option('No splash art available',''));
  selector.onchange = () => { if(selector.value !== '') document.body.style.setProperty('--builder-splash-url',`url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_${selector.value}.jpg)`); };
}

let gameTextRequest=null;
function ensureGameText() {
  if(BUILDER.stringsReady) return Promise.resolve(BUILDER.strings);
  if(gameTextRequest) return gameTextRequest;
  BUILDER.stringsLoading=true;
  gameTextRequest=builderRepository.loadLocalization()
    .then(data=>{BUILDER.localizationSource=data.source;if(data.status!=='ready')throw new Error('Game descriptions unavailable');BUILDER.strings=data.entries;BUILDER.stringsReady=true;return BUILDER.strings;})
    .catch(()=>null).finally(()=>{
      gameTextRequest=null;BUILDER.stringsLoading=false;
      if(BUILDER.uiReady){renderStats();renderAbilityCards();if(BUILDER.activeSlot!==null)renderModalItemDetail(BUILDER.inspectedItemId);}
    });
  return gameTextRequest;
}
function gameTooltip(...args) { return builderEvaluation().resolution.gameTooltip(...args); }

async function setChampion(name) {
  const requestId = ++BUILDER.championRequestId;
  setStatus(`Loading ${name}...`);
  try {
    ensureGameText();
    const prepared=await builderRepository.loadChampion(BUILDER.version,name);
    if (requestId !== BUILDER.championRequestId) return;
    const {champion,raw,abilities}=prepared;
    BUILDER.selectedChampion=name;
    BUILDER.championData=champion;
    BUILDER.cdragonAbilityData=abilities;
    BUILDER.cdragonRaw=raw;
    BUILDER.championSources=prepared.sources;
    const nextInputs=window.BuildInputs.transitionChampion(BUILDER,name,Number(document.getElementById('builderLevel').value)||1);
    BUILDER.combatValues=nextInputs.combatValues;BUILDER.abilityRanks=nextInputs.abilityRanks;BUILDER.level=nextInputs.level;
    document.getElementById('dashboardChampionName').textContent = champion.name;
    document.getElementById('dashboardChampionTitle').textContent = champion.title;
    populateSkinSelector(name, champion.skins || [{num:0,name:'Original'}], requestId);
    document.body.style.setProperty('--builder-splash-url', `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg)`);
    document.getElementById('championPickerBtn').innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/champion/${champion.image.full}" alt="${name}">`;
    document.getElementById('championPickerBtn').setAttribute('aria-label', `Selected champion: ${name}`);
    enforceAbilityRules();
    renderAbilityCards();
    renderStats();
    setStatus(raw ? '' : 'Basic stats loaded. Advanced ability data is unavailable.');
  } catch (error) {
    if (requestId !== BUILDER.championRequestId) return;
    console.warn('Champion selection failed', error);
    setStatus(`Could not load ${name}. Select the champion again to retry.`, true);
  }
}

function renderItemSlots() {
  const root = document.getElementById("itemSlots");
  root.innerHTML = BUILDER.itemSlots.map((_, i) => `<button class="item-slot-btn ${i===6?'role-quest-slot':i===7?'bot-boots-slot':''}" aria-label="${i===6?'Role quest':i===7?'Bot quest boots':'Item slot '+(i+1)}" title="${i===6?'Role quest item':'Item slot '+(i+1)}" data-slot="${i}"><div id="slotText${i}" class="item-slot-empty">+</div></button>`).join("");
  refreshSlotLabels();
}

function refreshSlotLabels() {
  BUILDER.itemSlots.forEach((id, i) => {
    const root = document.getElementById(`slotText${i}`);
    if (!id) {
      root.className = "item-slot-empty";
      root.textContent = "+";
      return;
    }
    const item = BUILDER.items[id];
    root.className = "";
    root.innerHTML = `<img class="item-slot-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${id}.png" alt="${item.name}" title="${item.name}">`;
  });
  const cost = BUILDER.itemSlots.reduce((total, id, slot) => {
    if (slot === 6 || !id) return total;
    const gold = Number(BUILDER.items[id]?.gold?.total);
    return total + (Number.isFinite(gold) ? gold : 0);
  }, 0);
  const label = document.getElementById('buildGoldCost');
  label.textContent = cost.toLocaleString('en-US');
  label.parentElement.setAttribute('aria-label', `Total build cost: ${cost.toLocaleString('en-US')} gold`);
}

function initItemModal() {
  renderBuilderTagFilters();
  document.getElementById("modalItemSearch").addEventListener("input", renderModalItemGrid);
  wirePickerDismissal('itemModal',closeItemModal);
  selectSearchOnClick('modalItemSearch');
  document.getElementById('allItemsTab').onclick=()=>{BUILDER.recommendedOnly=false;BUILDER.itemRole='';renderModalItemGrid();};
  document.getElementById('recommendedItemsTab').onclick=()=>{BUILDER.itemRole='';BUILDER.recommendedOnly=true;renderModalItemGrid();};
}

function clearModalFilters() {
  document.getElementById("modalItemSearch").value = "";
  document.querySelectorAll('[data-item-filter]').forEach(button=>button.setAttribute('aria-pressed','false'));
  BUILDER.recommendedOnly=false;
  BUILDER.itemRole='';
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
function matchesShopStat(id,item,tag) { return window.CatalogQueries.matchesShopStat(id,item,tag,[...BUILDER.midBootIds]); }
function renderBuilderTagFilters() {
  const root=document.getElementById('modalItemFilters');
  root.innerHTML=SHOP_FILTER_GROUPS.map(([name, filters])=>`<div class="shop-filter-group" role="group" aria-label="${name}">${filters.map(([tag,label,stat])=>`<button type="button" class="shop-filter" data-item-filter="${tag}" aria-label="${label}" title="${label}" aria-pressed="false"><span class="stat-icon" aria-hidden="true">${STAT_ICONS[stat]}</span></button>`).join('')}</div>`).join('');
  root.querySelectorAll('button').forEach(button=>button.onclick=()=>{button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));renderModalItemGrid();});
  document.getElementById('modalItemRoles').innerHTML=SHOP_ROLES.map(([name])=>`<button type="button" class="shop-category" data-item-role="${name}" aria-label="${name}" title="${name}" aria-pressed="false"><img src="assets/shop/${name.toLowerCase()}.png" alt=""></button>`).join('');
  document.querySelectorAll('[data-item-role]').forEach(button=>button.onclick=()=>{
    BUILDER.itemRole=BUILDER.itemRole===button.dataset.itemRole?'':button.dataset.itemRole;
    BUILDER.recommendedOnly=false;
    renderModalItemGrid();
  });
}
function recommendedItemIds() { return window.Recommendations.recommendedItemIds(BUILDER.cdragonRaw,BUILDER.championData,BUILDER.items); }

function openItemModal(slot) {
  ensureGameText();
  BUILDER.activeSlot = slot;
  if(slot>=6){BUILDER.recommendedOnly=false;BUILDER.itemRole='';document.getElementById('modalItemSearch').value='';document.querySelectorAll('[data-item-filter]').forEach(button=>button.setAttribute('aria-pressed','false'));}
  document.getElementById("itemModalTitle").textContent = BUILDER.activeSlot === 6 ? "Select Role Quest" : BUILDER.activeSlot === 7 ? "Select Boots" : "Select Item";
  document.getElementById("itemModal").classList.remove("hidden");
  renderModalItemGrid();
  document.getElementById('modalItemSearch').focus();document.getElementById('modalItemSearch').select();
}

function closeItemModal() {
  document.getElementById("itemModal").classList.add("hidden");
  BUILDER.activeSlot = null;
}

function renderModalItemGrid() {
  const text = document.getElementById("modalItemSearch").value.trim().toLowerCase();
  const tags = new Set([...document.querySelectorAll('[data-item-filter][aria-pressed="true"]')].map(button=>button.dataset.itemFilter));
  const recommendations=recommendedItemIds();
  const itemData=window.ItemLookupShared.getState();
  const roleValue=SHOP_ROLES.find(([name])=>name===BUILDER.itemRole)?.[1];
  document.querySelectorAll('[data-item-role]').forEach(button=>{
    button.disabled=itemData.status!=='ready' || BUILDER.activeSlot===6;
    button.title=BUILDER.activeSlot===6 ? `${button.dataset.itemRole} — select a role quest below` : itemData.status==='ready' ? button.dataset.itemRole : `${button.dataset.itemRole} — ${itemData.status==='unavailable'?'class data unavailable':'loading item classes'}`;
    button.setAttribute('aria-pressed',String(BUILDER.itemRole===button.dataset.itemRole));
  });
  document.getElementById('recommendedItemsTab').hidden=!recommendations.size;
  if(!recommendations.size)BUILDER.recommendedOnly=false;
  document.getElementById('allItemsTab').setAttribute('aria-pressed',String(!BUILDER.recommendedOnly && !BUILDER.itemRole));
  document.getElementById('recommendedItemsTab').setAttribute('aria-pressed',String(!!BUILDER.recommendedOnly));
  BUILDER.modalItemFiltered=window.CatalogQueries.queryItems(BUILDER.items,{search:text,tags,sort:'price',
    eligible:id=>roleItemAllowed(id,BUILDER.activeSlot),recommended:BUILDER.recommendedOnly?recommendations:null,
    roleValue,advanced:itemData.cdragonById,shopTags:true,midBootIds:[...BUILDER.midBootIds]});
  const ids = BUILDER.modalItemFiltered;
  document.getElementById("modalResultsCount").textContent = `${ids.length} ${BUILDER.recommendedOnly?'recommended items':'items shown'}`;
  document.getElementById("modalItemGrid").innerHTML = ids
    .map((id) => `<button class="item-button-icon" data-item-id="${id}" title="${BUILDER.items[id].name}"><img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${id}.png" alt="${BUILDER.items[id].name}" loading="lazy" decoding="async"></button>`)
    .join("");
  renderModalItemDetail(ids.includes(BUILDER.itemSlots[BUILDER.activeSlot]) ? BUILDER.itemSlots[BUILDER.activeSlot] : ids[0] || null);
}

function renderModalItemDetail(id) {
  BUILDER.inspectedItemId=id;
  document.querySelectorAll('#modalItemGrid [data-item-id]').forEach(button=>button.classList.toggle('item-button-selected',button.dataset.itemId===id));
  renderCombatInputs();
  const root = document.getElementById("modalItemDetail");
  if (!id) {
    root.innerHTML = "<p class='text-muted'>No items found.</p>";
    return;
  }
  const item = BUILDER.items[id];
  const statNameMap = {
    FlatHPPoolMod: "Health",
    FlatMPPoolMod: "Mana",
    FlatHPRegenMod: "HP/5",
    FlatMPRegenMod: "MP/5",
    PercentBaseHPRegenMod: "Base HP Regen %",
    PercentBaseMPRegenMod: "Base MP Regen %",
    FlatPhysicalDamageMod: "Attack Damage",
    FlatMagicDamageMod: "Ability Power",
    FlatArmorMod: "Armor",
    FlatSpellBlockMod: "Magic Resist",
    PercentAttackSpeedMod: "Attack Speed %",
    FlatMovementSpeedMod: "Move Speed",
    PercentMovementSpeedMod: "Move Speed %",
    FlatCritChanceMod: "Crit Chance",
    PercentCritChanceMod: "Crit Chance %",
    FlatCritDamageMod: "Crit Damage",
    PercentCritDamageMod: "Crit Damage %",
    FlatAttackRangeMod: "Attack Range",
    FlatHasteMod: "Ability Haste",
    FlatAbilityHasteMod: "Ability Haste",
    AbilityHaste: "Ability Haste",
  };
  const pctStats = new Set(["FlatCritChanceMod", "FlatCritDamageMod", "PercentBaseHPRegenMod", "PercentBaseMPRegenMod", "PercentAttackSpeedMod", "PercentMovementSpeedMod", "PercentCritChanceMod", "PercentCritDamageMod"]);
  const statBuckets = new Map();
  const aliasCanonical = {
    FlatAbilityHasteMod: "FlatHasteMod",
    AbilityHaste: "FlatHasteMod",
    PercentHPRegenMod: "PercentBaseHPRegenMod",
    PercentMPRegenMod: "PercentBaseMPRegenMod",
  };
  const seenCanonical = new Set();
  Object.entries(item.stats || {})
    .filter(([, v]) => Number(v) !== 0)
    .forEach(([k, v]) => {
      const canonical = aliasCanonical[k] || k;
      if (seenCanonical.has(canonical)) return;
      seenCanonical.add(canonical);
      const label = statNameMap[canonical] || statNameMap[k] || canonical;
      const isPct = pctStats.has(canonical) || pctStats.has(k);
      const bucketKey = `${label}::${isPct ? 'pct' : 'flat'}`;
      const current = statBuckets.get(bucketKey) || { label, isPct, value: 0 };
      current.value += Number(v) || 0;
      statBuckets.set(bucketKey, current);
    });
  const statLines = Array.from(statBuckets.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((row) => `<div>${row.label}: ${row.isPct ? `${(row.value * 100).toFixed(1)}%` : row.value}</div>`)
    .join("");
  const resolvedDescription = resolveItemDescriptionHtml(item, id, { forModal: true });
  const enhancedDescription = resolvedDescription.html;
  root.innerHTML = `<h3>${item.name}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${id}.png' alt='${item.name}'><p><strong>Cost:</strong> ${item.gold?.total ?? 0}g</p><div>${statLines}</div><div class='mt-10 item-description'>${enhancedDescription}</div><button class='btn btn-sm mt-10' data-set-item-id='${id}'>Select this item</button><button class='btn btn-sm mt-10 ml-5' data-set-item-id=''>Clear slot</button>`;
  const controls=document.createElement('div');controls.className='combat-inputs';controls.dataset.open='true';root.append(controls);
  window.CombatInputs.render(controls,{
    sources:[window.CombatInputs.itemSource(id,window.ItemLookupShared.getState().cdragonById[id],item.name)],
    base:baseCalculationContext(getComputedChampionStatsForTooltips()),values:BUILDER.combatValues,
    onChange:()=>{renderStats();renderAbilityCards();renderModalItemDetail(id);},
  });

}

function inventoryData() { return {items:BUILDER.items,midBootIds:BUILDER.midBootIds,questItemIds:BUILDER.questItemIds}; }
function roleLevelCap() { return window.BuildInputs.roleLevelCap(BUILDER); }
function isBoot(id) { return window.BuildInputs.isBoot(id,inventoryData()); }
function roleItemAllowed(id,slot) { return window.BuildInputs.eligibility(BUILDER,id,slot,inventoryData()).allowed; }
function setSlotItem(itemId) {
 const slot=BUILDER.activeSlot;
 const result=window.BuildInputs.transitionInventory(BUILDER,slot,itemId,inventoryData());
 if(!result.accepted){if(result.reasonCode==='inventory-full')setStatus(result.reason,true);return;}
 BUILDER.itemSlots=result.inputs.itemSlots;BUILDER.level=result.inputs.level;BUILDER.abilityRanks=result.inputs.abilityRanks;
 if(slot===6){wireLevelOptions();enforceAbilityRules();}
 renderItemSlots();renderStats();renderAbilityCards();closeItemModal();setStatus('');
}

function abilityMaxByLevel(level, spellKey) {
  return window.AbilityRules.abilityMaxByLevel(level, spellKey);
}

function enforceAbilityRules() {
  BUILDER.abilityRanks = window.AbilityRules.enforceAbilityRules(BUILDER.level, BUILDER.abilityRanks);
}

function parseByRank(...args) { return builderEvaluation().resolution.parseByRank(...args); }

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
  if(window.ItemDescriptions){
    const context=calculationContext(getComputedChampionStatsForTooltips());
    const result=window.ItemDescriptions.describe({id:itemId,item,source:shared.getState().cdragonById[itemId],strings:BUILDER.strings||{},context});
    return {html:shared.colorizeStatsInHtml(result.html),formulaRows:[],sections:result.sections};
  }
  let html = String(item?.description || "");
  if (!shared) return { html, formulaRows: [] };
  if (shared.resolveDescriptionFormulas) html = shared.resolveDescriptionFormulas(item, html);

  const formulaRows = shared.buildExtractedFormulas
    ? (shared.buildExtractedFormulas(String(itemId || ""), calculationContext(getComputedChampionStatsForTooltips()))?.lines || [])
    : [];

  html = shared.injectItemCalculationValues(html, formulaRows);
  if (shared.injectActiveCooldown) {
    const cd = shared.inferActiveCooldownSeconds ? shared.inferActiveCooldownSeconds(String(itemId || "")) : null;
    html = shared.injectActiveCooldown(html, cd);
  }
  if (forModal && shared.emphasizeAbilityHeaders) html = shared.emphasizeAbilityHeaders(html);
  if (shared.enhanceActiveTooltip) html = shared.enhanceActiveTooltip(html);
  if (forModal && shared.colorizeStatsInHtml) html = shared.colorizeStatsInHtml(html);
  return { html, formulaRows };
}

/**
 * Extracts passive/on-hit/unique sections from an item tooltip and returns display-ready rows.
 * @param {string} descriptionHtml Tooltip html.
 * @returns {{label: string, impact: string}[]} Passive rows.
 */
function extractPassiveDescriptionsFromHtml(...args) { return builderEvaluation().stats.extractPassiveDescriptionsFromHtml(...args); }

function buildPassiveLedger(...args) { return builderEvaluation().stats.buildPassiveLedger(...args); }

function computeDerivedBuildStats(...args) { return builderEvaluation().stats.computeDerivedBuildStats(...args); }

function itemPassiveEnabled(...args) { return builderEvaluation().stats.itemPassiveEnabled(...args); }

function renderPassivePanel() {
  const root=document.getElementById('passiveModalList');
  if(!root)return;
  const rows=[];
  const computed=computeDerivedBuildStats();
  for(const id of [...new Set(BUILDER.itemSlots.filter(Boolean))]){
    if(BUILDER.questItemIds?.has(id))continue;
    const item=BUILDER.items[id];
    if(!item)continue;
    const result=resolveItemDescriptionHtml(item,id);
    for(const section of result.sections||[]){
      if(section.active)continue;
      const key=`${id}:${section.key}`,activation=id==='4645'&&BUILDER.target.enabled?null:window.AttackEffects.itemPassiveBindings?.[id]?.[section.key];
      const modeled=Object.hasOwn(window.AttackEffects.itemPassiveBindings?.[id]||{},section.key)
        || ['3042:awe','3040:awe','3089:magical-opus','3083:warmog-s-vitality'].includes(key);
      const enabled=itemPassiveEnabled(id,section.key) && (!activation || BUILDER.combatValues[activation]===true);
      let html=section.html;
      if(id==='3089' && section.key==='magical-opus' && computed){
        const amount=enabled?builderEvaluation().stats.itemContribution(id,section.key,computed):0;
        html+=` <scaleAP>(+${window.ItemDescriptions.number(amount)} AP)</scaleAP>`;
      }
      rows.push(`<section class="ability-card passive-effect-card${enabled?'':' passive-disabled'}" data-passive-section="${key}"><div class="passive-effect-heading"><strong>${window.ItemDescriptions.escape(item.name)} — ${window.ItemDescriptions.escape(section.label)}</strong><button type="button" class="btn btn-sm" data-item-passive="${key}" aria-pressed="${enabled}" aria-label="${window.ItemDescriptions.escape(item.name+' — '+section.label)}">${enabled?'On':'Off'}</button></div><div class="passive-description">${html}</div>${modeled?'':'<p class="text-muted passive-coverage">Reference effect: not included in damage or stat totals.</p>'}</section>`);
    }
  }
  root.innerHTML=rows.join('')||`<p class="text-muted">${BUILDER.stringsLoading?'Loading passive descriptions…':'Equip items to inspect their passives.'}</p>`;
  root.querySelectorAll('[data-item-passive]').forEach(button=>button.onclick=()=>{
    const key=button.dataset.itemPassive;
    const [id,passive]=key.split(':'),enabled=button.getAttribute('aria-pressed')==='true';
    BUILDER.disabledItemPassives[key]=enabled;
    const activation=window.AttackEffects.itemPassiveBindings?.[id]?.[passive];
    if(!enabled && activation)BUILDER.combatValues[activation]=true;
    renderStats();renderAbilityCards();
    if(BUILDER.activeSlot!==null)renderModalItemDetail(BUILDER.inspectedItemId);
  });
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

/**
 * Computes auto-attack profile from derived stats and supported on-hit item passives.
 * @param {ReturnType<typeof computeDerivedBuildStats>} computed Derived build stats.
 * @returns {{autoAttackDamage:number,attackDps:number,attackRange:number,onHitRows:string[]}}
 */
function computeAutoAttackProfile(...args) { return builderEvaluation().stats.computeAutoAttackProfile(...args); }

function summarizePassiveNumericData(cdragonPassive) {
  const rows = (cdragonPassive?.dataValues || [])
    .map((d) => {
      const vals = (d.mValues || []).map((v) => Number(v) || 0).filter((v, i, arr) => Number.isFinite(v) && (v !== 0 || arr.every((x) => x === 0)));
      if (!vals.length) return null;
      const nonZero = vals.filter((v) => v !== 0);
      if (!nonZero.length) return null;
      const shown = vals.slice(0, 6).map((v) => (Number.isInteger(v) ? String(v) : v.toFixed(2))).join("/");
      const label = String(d.mName || "Value").replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
      return `${label}: ${shown}`;
    })
    .filter(Boolean)
    .slice(0, 3);
  return rows;
}

function buildDetailedPassiveText(...args) { const evaluation=builderEvaluation(); return window.AbilityPresentation.create(evaluation.state,evaluation.stats,evaluation.resolution,resolveAbilityToken).buildDetailedPassiveText(...args); }
function getComputedChampionStatsForTooltips(...args) { return builderEvaluation().stats.getComputedChampionStatsForTooltips(...args); }

function getSpellScalingSource(...args) { return builderEvaluation().resolution.getSpellScalingSource(...args); }

function getRankedValueIndex(...args) { return builderEvaluation().resolution.getRankedValueIndex(...args); }

function getSpellDataValue(...args) { return builderEvaluation().resolution.getSpellDataValue(...args); }

function getCalcStatSource(...args) { return builderEvaluation().resolution.getCalcStatSource(...args); }

function formatAbilityStatLabel(...args) { return window.AbilityPresentation.formatAbilityStatLabel(...args); }

function formatAbilityNumber(...args) { return window.AbilityPresentation.formatAbilityNumber(...args); }

function formatCalculationTerms(...args) { return window.AbilityPresentation.formatCalculationTerms(...args); }

function isMissingGameCalculation(...args) { return builderEvaluation().resolution.isMissingGameCalculation(...args); }

function baseCalculationContext(...args) { return builderEvaluation().stats.baseCalculationContext(...args); }

function calculationContext(...args) { return builderEvaluation().stats.calculationContext(...args); }

function combatSources() {
  const buffNames={};
  for(const [path,record] of Object.entries(BUILDER.cdragonRaw||{})) {
    for(const name of [path.split('/').pop(),record?.ObjectName,record?.mScriptName].filter(Boolean))buffNames[window.Calculations.hash(name)]=name;
  }
  const sources=[];
  const seen=new Set();
  const allTooltipText=[BUILDER.championData?.passive?.description,...(BUILDER.championData?.spells||[]).map(s=>s.tooltip)].join(' ');
  const add=(payload,slot,label)=>{
    if(!payload||seen.has(payload.calculations))return;
    seen.add(payload.calculations);
    const calculations=Object.fromEntries(Object.entries(payload.calculations||{}).filter(([key,calc])=>
      (!calc.tooltipOnly&&!/^tooltiponly_/i.test(key)) || allTooltipText.toLowerCase().includes(key.toLowerCase())
    ));
    sources.push({...payload,calculations,slot,label,buffNames});
  };
  for(const slot of ['p','q','w','e','r']){
    const spell=slot==='p'?BUILDER.championData?.passive:BUILDER.championData?.spells?.[['q','w','e','r'].indexOf(slot)];
    add(BUILDER.cdragonAbilityData?.[slot],slot,`${slot.toUpperCase()} ${spell?.name||''}`);
  }
  for(const [i,spell]of (BUILDER.championData?.spells||[]).entries()){
    for(const match of (spell.tooltip||'').matchAll(/spell\.([^:}]+):/gi)){
      const ref=BUILDER.cdragonAbilityData?.byAlias?.[canonicalizeToken(match[1])];
      add(ref?.payload,['q','w','e','r'][i],`${['Q','W','E','R'][i]} ${spell.name}`);
    }
  }

  return sources;
}

function renderCombatInputs() {
  document.getElementById('combatInputs')?.replaceChildren();
  const sources=combatSources(),base=baseCalculationContext(getComputedChampionStatsForTooltips());
  const extra=window.ChampionEffects.model(BUILDER).fields.concat((BUILDER.championData?.spells||[])
    .flatMap((spell,i)=>window.AbilityDps.timingFields(spell.id,['q','w','e','r'][i])));
  const all=window.CombatInputs.descriptors(sources,base).filter(f=>!extra.some(e=>e.key===f.key)).concat(extra);
  const usage=new Map();
  for(const source of sources){
    for(const field of window.CombatInputs.descriptors([source],base)){
      if(!usage.has(field.key))usage.set(field.key,new Set());usage.get(field.key).add(source.slot);
    }
  }
  const fieldOwner=field=>{
    if(field.slot)return field.slot;
    const slots=[...usage.get(field.key)||[]];
    if(slots.includes('p'))return 'p';
    if(field.kind==='buff'){
      const index=(BUILDER.championData?.spells||[]).findIndex(spell=>window.Calculations.hash(spell.id)===field.key.slice(5));
      const slot=['q','w','e','r'][index];if(slots.includes(slot))return slot;
    }
    return slots.length>1?'p':slots[0];
  };
  for(const slot of ['p','q','w','e','r']){
    const fields=all.filter(field=>fieldOwner(field)===slot).map(field=>{
      const slots=[...usage.get(field.key)||[]];
      if(!field.slot && field.kind==='buff' && fieldOwner(field)==='p'){
        const passive=BUILDER.championData?.passive?.name||'Passive';
        const sharedCounters=all.filter(f=>f.kind==='buff'&&fieldOwner(f)==='p');
        return {...field,label:sharedCounters.length===1?`${passive} stacks`:`${passive} — ${field.label}`};
      }
      return field;
    });
    window.CombatInputs.render(document.querySelector(`[data-ability-slot="${slot}"] .ability-inputs`),{
      fields,inline:true,sources:[],base,values:BUILDER.combatValues,
      onChange:()=>{renderStats();renderAbilityCards();},
    });
  }
}

function adaptCalculation(...args) { return builderEvaluation().resolution.adaptCalculation(...args); }

function evaluateCalculationPart(...args) { return builderEvaluation().resolution.evaluateCalculationPart(...args); }

function evaluateGameCalculation(...args) { return builderEvaluation().resolution.evaluateGameCalculation(...args); }

function canonicalizeToken(...args) { return builderEvaluation().resolution.canonicalizeToken(...args); }

function buildCanonicalTokenMap(...args) { return builderEvaluation().resolution.buildCanonicalTokenMap(...args); }

function buildResolvedSpellPayload(...args) { return builderEvaluation().resolution.buildResolvedSpellPayload(...args); }

function getDeterministicTokenCandidates(...args) { return builderEvaluation().resolution.getDeterministicTokenCandidates(...args); }

function resolveAbilityToken(...args) { return window.AbilityPresentation.legacyToken(builderEvaluation().resolution.resolveAbilityToken(...args)); }


function getSpellRankValueAt(...args) { return builderEvaluation().resolution.getSpellRankValueAt(...args); }

function getSpellTokenValueAtRank(...args) { return builderEvaluation().resolution.getSpellTokenValueAtRank(...args); }

function expandAbilityLocalization(...args) { return builderEvaluation().resolution.expandAbilityLocalization(...args); }

function buildAbilityContext(...args) { return builderEvaluation().resolution.buildAbilityContext(...args); }

function buildDetailedAbilityText(...args) { const evaluation=builderEvaluation(); return window.AbilityPresentation.create(evaluation.state,evaluation.stats,evaluation.resolution,resolveAbilityToken).buildDetailedAbilityText(...args); }

function abilityEffectValues(...args) { const evaluation=builderEvaluation(); return window.AbilityPresentation.create(evaluation.state,evaluation.stats,evaluation.resolution,resolveAbilityToken).abilityEffectValues(...args); }

function renderAlternateAbilityDps(spell,rank,slot) {
 const result=builderEvaluation().evaluateAlternate(spell,rank,slot,{presentToken:window.AbilityPresentation.legacyToken});
 if(!result)return '';
 if(result.status==='unsupported')return `<div class="ability-dps"><strong>${result.label} Damage:</strong> Alternate form data unavailable</div>`;
 return `<div class="ability-dps-form"><strong>${result.label}</strong>${window.AbilityDps.render(result.damage)}</div>`;
}

function renderAbilityCards() {
  window.ComboUI?.refresh();
  const root = document.getElementById("abilityCards");
  const openControls = new Set(root.dataset.champion === BUILDER.selectedChampion ? [...root.querySelectorAll("[data-controls-slot][open]")].map(el=>el.dataset.controlsSlot) : []);
  root.dataset.champion = BUILDER.selectedChampion || "";
  if (!BUILDER.championData) {
    root.innerHTML = "<div class='ability-card'><p class='text-muted'>Select a champion to view abilities.</p></div>";
    document.getElementById("abilityRuleHint").textContent = "";
    return;
  }

  document.getElementById('attackSummary').replaceChildren();
  document.getElementById('attackSettings').replaceChildren();
  const champ = BUILDER.championData;
  const computed = computeDerivedBuildStats();
  const attack = computed ? computeAutoAttackProfile(computed) : null;
  const passiveText = buildDetailedPassiveText();
  const passiveDps = window.AbilityDps.passiveProfile(attack);
  const description = (slot,simple,detailed,values='') => `<div class="ability-description" data-description-slot="${slot}"><div class="simple-description">${BUILDER.target.enabled?window.DamageText.render(simple,token=>({html:'{{'+token+'}}',numeric:null}),{target:BUILDER.target,stats:getComputedChampionStatsForTooltips()}):simple||''}</div><div class="detailed-description" hidden>${detailed}${values}</div><button type="button" class="btn btn-sm detail-toggle" aria-expanded="false">Detailed view</button></div>`;
  const passive = `<div class="ability-card ability-passive-card" data-ability-slot="p"><div class="ability-head"><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/passive/${champ.passive.image.full}" alt="${champ.passive.name}"><strong>Passive - ${champ.passive.name}</strong></div>${description("p",champ.passive.description,passiveText,passiveDps.rows.length?window.AbilityDps.render(passiveDps):'')}<div class="ability-inputs"></div></div>`;
  const escapeAttack = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const attackNumber = (value, key) => `<span class="attack-result" data-attack-result="${key}" tabindex="0" title="${escapeAttack(attack.breakdown)}">${Number.isFinite(value) ? value.toFixed(1) + (attack.partial ? ' (partial)' : '') : 'Unavailable — see calculation'}</span>`;
  const attackCard = `<div class="ability-card ability-attack-card" data-ability-slot="attack"><div class="ability-head"><strong>Attack</strong></div>
  <div><strong>On-attack damage:</strong> ${attack ? attackNumber(attack.autoAttackDamage,'damage') : '-'}</div>
  <div><strong>On-Attack DPS:</strong> ${attack ? attackNumber(attack.attackDps,'dps') : '-'}</div>
  <div><strong>Attack Range:</strong> ${attack ? attack.attackRange.toFixed(1) : '-'}</div>
  <small>Average damage · ${BUILDER.target.enabled?'against target':'before target defences'}</small>
  <details class="dashboard-detail"><summary>Calculation breakdown</summary><div class="detail-content">${attack?.warnings.map(w=>`<p class="text-muted">${escapeAttack(w)}</p>`).join('')||''}
  <pre style="white-space:pre-wrap">${escapeAttack(attack?.breakdown||'Select a champion')}</pre></div></details></div>`;

  const spells = champ.spells.map((spell, i) => {
    const key = ["q", "w", "e", "r"][i];
    const max = abilityMaxByLevel(BUILDER.level, key);
    const opts = Array.from({ length: max + 1 }, (_, idx) => `<option value="${idx}">${idx}</option>`).join("");
    const rank = BUILDER.abilityRanks[key];
    const cdBase = parseByRank(spell.cooldownBurn, rank);
    const context = rank > 0 ? buildAbilityContext(spell, rank, key) : null;
    const abilityResult=builderEvaluation().evaluateAbility(spell,rank,key,{context:context || undefined,attack,presentToken:window.AbilityPresentation.legacyToken});
    const cdNumeric = abilityResult.cooldown;
    const cd = cdNumeric !== null
      ? `${cdNumeric.toFixed(2)} (base ${Number(cdBase).toFixed(2)})`
      : cdBase;
    const cost = parseByRank(spell.costBurn, rank);
    const range = parseByRank(spell.rangeBurn, rank);
    const detail = buildDetailedAbilityText(spell, rank, key, context);
    let dps=window.AbilityDps.render(abilityResult.onHitDamage);
    dps += renderAlternateAbilityDps(spell,rank,key);
    const parsed = document.createElement('div'); parsed.innerHTML=dps;
    const damageNumbers=[...parsed.querySelectorAll('tbody tr')].map(row=>row.children[1]?.innerHTML.trim()).filter(Boolean);
    const damageSummary=damageNumbers.length ? damageNumbers.join(' / ') : '—';
    return `<div class="ability-card" data-ability-slot="${key}"><div class="ability-head"><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/spell/${spell.image.full}" alt="${spell.name}"><strong>${key.toUpperCase()} - ${spell.name}</strong></div><div class="ability-rank-row"><label class="label">Rank<select class="form-control" id="rank_${key}">${opts}</select></label></div>${description(key,spell.description,detail,abilityEffectValues(BUILDER.cdragonAbilityData?.[key],rank)+dps)}<div class="ability-inputs"></div><div class="ability-meta"><span><strong>Cooldown:</strong> ${cd}</span><span><strong>Cost:</strong> ${cost}</span><span><strong>Range:</strong> ${range}</span><span class="ability-damage-summary"><strong>Damage:</strong> ${damageSummary}</span></div></div>`;
  }).join("");

  const expanded = new Set(root.dataset.descriptionChampion === BUILDER.selectedChampion ? [...root.querySelectorAll('.detail-toggle[aria-expanded="true"]')].map(el=>el.closest('.ability-card').querySelector('.ability-description').dataset.descriptionSlot) : []);
  root.dataset.descriptionChampion = BUILDER.selectedChampion;
  root.innerHTML = passive + attackCard + spells;
  root.querySelectorAll('.detail-toggle').forEach(button=>{
    const container=button.parentElement;
    container.closest('.ability-card').querySelector('.ability-head').append(button);
    const update=active=>{button.setAttribute('aria-expanded',String(active));button.textContent=active?'Simple view':'Detailed view';container.querySelector('.simple-description').hidden=active;container.querySelector('.detailed-description').hidden=!active;};
    update(expanded.has(container.dataset.descriptionSlot));
    button.addEventListener('click',()=>update(button.getAttribute('aria-expanded')!=='true'));
  });
  renderCombatInputs();
  for (const control of attack?.controls || []) {
    const card = root.querySelector(`[data-ability-slot="${control.slot}"]`);
    if (!card) continue;
    const wrapper = document.createElement('div'); wrapper.className = 'attack-control';
    const element = document.createElement(control.type === 'toggle' ? 'button' : control.type === 'select' ? 'select' : 'input');
    element.dataset.attackControl = control.key;
    if (control.type === 'toggle') {
      element.type = 'button'; element.className = 'btn btn-outline';
      element.disabled = !!control.disabled;
      const active = BUILDER.combatValues[control.key] === true && !control.disabled;
      element.setAttribute('aria-pressed', String(active));
      element.textContent = `${control.label}: ${active ? 'On' : 'Off'}`;
      element.addEventListener('click', () => { BUILDER.combatValues[control.key] = !active; renderStats(); renderAbilityCards(); });
      wrapper.append(element);
    } else if (control.type === 'select') {
      const label = document.createElement('label'); label.textContent = control.label + ' ';
      control.options.forEach((text, i) => { const option = document.createElement('option'); option.value = String(i); option.textContent = text; element.append(option); });
      element.value = String(BUILDER.combatValues[control.key] ?? 0);
      element.addEventListener('change', () => { BUILDER.combatValues[control.key] = Number(element.value); renderStats(); renderAbilityCards(); });
      label.append(element); wrapper.append(label);
    } else {
      const label = document.createElement('label'); label.textContent = control.label + ' ';
      element.type = 'number'; element.min = String(control.min ?? 0); element.step = 'any';
      if (control.max !== undefined) element.max = String(control.max);
      element.value = BUILDER.combatValues[control.key] ?? control.defaultValue ?? ''; element.placeholder = 'Enter value';
      element.addEventListener('change', () => {
        if (element.value.trim() && Number.isFinite(Number(element.value))) BUILDER.combatValues[control.key] = Math.max(control.min??0,Math.min(Number.isFinite(control.max)?control.max:Infinity,Number(element.value)));
        else delete BUILDER.combatValues[control.key];
        renderStats(); renderAbilityCards();
      });
      label.append(element); wrapper.append(label);
    }
    (control.slot === 'attack' || control.key.includes('target:') ? document.getElementById('attackSettings') : card).append(wrapper);
  }
  document.getElementById('attackSummary').append(root.querySelector('.ability-attack-card'));
  document.querySelector('.attack-settings-hint').textContent = document.getElementById('attackSettings').children.length ? 'Enable effects to show their inputs.' : 'No additional attack settings for this build.';
  root.querySelectorAll('.ability-card').forEach(card => {
    const controls = [...card.querySelectorAll(':scope > .attack-control')].filter(control => control.querySelector('input'));
    if (controls.length > 2) {
      const details = document.createElement('details'); details.className = 'dashboard-detail';
      details.dataset.controlsSlot = card.dataset.abilitySlot; details.open = openControls.has(card.dataset.abilitySlot);
      const summary = document.createElement('summary'); summary.textContent = 'Attack controls (' + controls.length + ')';
      const content = document.createElement('div'); content.className = 'detail-content';
      controls.forEach(control => content.append(control)); details.append(summary, content); card.append(details);
    }
  });
  ["q", "w", "e", "r"].forEach((k) => {
    const el = document.getElementById(`rank_${k}`);
    if (!el) return;
    el.value = String(BUILDER.abilityRanks[k]);
    el.addEventListener("change", () => {
      BUILDER.abilityRanks[k] = Number(el.value);
      enforceAbilityRules();
      renderStats();
      renderAbilityCards();
    });
  });
  document.getElementById("abilityRuleHint").textContent = `At level ${BUILDER.level}: basic max ${abilityMaxByLevel(BUILDER.level, "q")}, R max ${abilityMaxByLevel(BUILDER.level, "r")}, total points ${BUILDER.level}.`;
}

function getItemStats(...args) { return builderEvaluation().stats.getItemStats(...args); }

function getRuneStats(...args) { return builderEvaluation().stats.getRuneStats(...args); }

function renderStats() {
  const root = document.getElementById("statsTable");
  const emptyRows = [
    { name: "HP", icon: STAT_ICONS["HP"] },
    { name: "MP", icon: STAT_ICONS["MP"] },
    { name: "HP/5", icon: STAT_ICONS["HP/5"] },
    { name: "MP/5", icon: STAT_ICONS["MP/5"] },
    { name: "AD", icon: STAT_ICONS["AD"] },
    { name: "AP", icon: STAT_ICONS["AP"] },
    { name: "Range", icon: STAT_ICONS["Range"] },
    { name: "AH", icon: STAT_ICONS["AH"] },
    { name: "Arm", icon: STAT_ICONS["Arm"] },
    { name: "MR", icon: STAT_ICONS["MR"] },
    { name: "AS", icon: STAT_ICONS["AS"] },
    { name: "MS", icon: STAT_ICONS["MS"] },
    { name: "Crit %", icon: STAT_ICONS["Crit %"] },
    { name: "Crit Dmg", icon: STAT_ICONS["Crit Dmg"] },
    { name: "ARPen", icon: STAT_ICONS["ARPen"] },
    { name: "MRPen", icon: STAT_ICONS["MRPen"] },
    { name: "Lifesteal", icon: STAT_ICONS["Lifesteal"] },
    { name: "Tenacity", icon: STAT_ICONS["Tenacity"] },
  ];
  const renderPairedRows = (rows) => {
    const pairRows = [];
    for (let i = 0; i < rows.length; i += 2) {
      pairRows.push([rows[i], rows[i + 1] || null]);
    }
    return `<table class="stats-table">${pairRows.map(([left, right]) => `<tr><td class="stats-label"><span class="stat-icon">${left.icon}</span>${left.name}</td><td class="stats-value" title="${left.eq || ''}">${left.displayValue}</td>${right ? `<td class="stats-label"><span class="stat-icon">${right.icon}</span>${right.name}</td><td class="stats-value" title="${right.eq || ''}">${right.displayValue}</td>` : '<td class="stats-label"></td><td class="stats-value"></td>'}</tr>`).join("")}</table>`;
  };

  if (!BUILDER.championData) {
    root.innerHTML = renderPairedRows(emptyRows.map((row) => ({ ...row, displayValue: "--" })));
    renderPassivePanel(null);
    return;
  }

  const computed = computeDerivedBuildStats();
  if (!computed) return;
  const {
    base, item, rune, level: L,
    hp, hp5, mp, mp5, ad, ap, armor, mr,
    asTotal, abilityHaste, critChance, critDamage, attackRange, moveSpeed,
    passiveLedger,
  } = computed;


  const summaries=builderEvaluation().stats.summary(computed);
  const rows = [
    { name: "HP", icon: STAT_ICONS["HP"], value: hp, eq: `${base.hp.toFixed(1)} + ${base.hpperlevel.toFixed(1)}*${window.BuildStats.growthFactor(L).toFixed(3)} + ${item.hp.toFixed(1)} + ${rune.hp.toFixed(1)} + passive(${(passiveLedger.statMods.hp||0).toFixed(1)})` },
    { name: "MP", icon: STAT_ICONS["MP"], value: mp, eq: `${base.mp.toFixed(1)} + ${base.mpperlevel.toFixed(1)}*${window.BuildStats.growthFactor(L).toFixed(3)} + ${item.mp.toFixed(1)} + ${rune.mp.toFixed(1)}` },
    { name: "HP/5", icon: STAT_ICONS["HP/5"], value: hp5, eq: `(${base.hpregen.toFixed(1)} + ${base.hpregenperlevel.toFixed(2)}*${window.BuildStats.growthFactor(L).toFixed(3)}) * (1 + ${item.hp5PctBase.toFixed(1)}%) + ${item.hp5.toFixed(1)} + ${rune.hp5.toFixed(1)}` },
    { name: "MP/5", icon: STAT_ICONS["MP/5"], value: mp5, eq: `(${base.mpregen.toFixed(1)} + ${base.mpregenperlevel.toFixed(2)}*${window.BuildStats.growthFactor(L).toFixed(3)}) * (1 + ${item.mp5PctBase.toFixed(1)}%) + ${item.mp5.toFixed(1)} + ${rune.mp5.toFixed(1)}` },
    { name: "AD", icon: STAT_ICONS["AD"], value: ad, eq: `${base.attackdamage.toFixed(1)} + ${base.attackdamageperlevel.toFixed(1)}*${window.BuildStats.growthFactor(L).toFixed(3)} + ${item.ad.toFixed(1)} + ${rune.ad.toFixed(1)} + passive(${passiveLedger.statMods.ad.toFixed(1)})` },
    { name: "AP", icon: STAT_ICONS["AP"], value: ap, eq: `0 + ${item.ap.toFixed(1)} + ${rune.ap.toFixed(1)} + passive(${passiveLedger.statMods.ap.toFixed(1)})` },
    { name: "Range", icon: STAT_ICONS["Range"], value: attackRange, eq: `${(base.attackrange || 0).toFixed(1)} + ${item.attackRange.toFixed(1)} + ${rune.attackRange.toFixed(1)} + passive(${getChampionPassiveRangeBonus().toFixed(1)})` },
    { name: "AH", icon: STAT_ICONS["AH"], value: abilityHaste, eq: `Ability haste: ${item.haste.toFixed(1)} from items + ${rune.haste.toFixed(1)} from runes. Brackets show bonus basic / ultimate ability haste. Add each bonus to the general value: Q/W/E use ${(abilityHaste+computed.basicHaste).toFixed(1)} AH; R uses ${(abilityHaste+computed.ultimateHaste).toFixed(1)} AH. Cooldown = base cooldown / (1 + applicable AH / 100). Abilities with special cooldown rules keep those rules.` },
    { name: "Arm", icon: STAT_ICONS["Arm"], value: armor, eq: `${base.armor.toFixed(1)} + ${base.armorperlevel.toFixed(1)}*${window.BuildStats.growthFactor(L).toFixed(3)} + ${item.armor.toFixed(1)} + ${rune.armor.toFixed(1)}` },
    { name: "MR", icon: STAT_ICONS["MR"], value: mr, eq: `${base.spellblock.toFixed(1)} + ${base.spellblockperlevel.toFixed(1)}*${window.BuildStats.growthFactor(L).toFixed(3)} + ${item.mr.toFixed(1)} + ${rune.mr.toFixed(1)}` },
    { name: "AS", icon: STAT_ICONS["AS"], value: asTotal, eq: `${base.attackspeed.toFixed(3)} + ${(base.attackspeedratio || base.attackspeed).toFixed(3)} * (growth ${window.BuildStats.growthFactor(L).toFixed(3)} * ${base.attackspeedperlevel}% + ${(item.asPct + rune.asPct).toFixed(1)}%)` },
    { name: "MS", icon: STAT_ICONS["MS"], value: moveSpeed, eq: `(${base.movespeed.toFixed(1)} + ${item.msFlat.toFixed(1)} + ${rune.msFlat.toFixed(1)}) * (1 + ${(item.msPct + rune.msPct).toFixed(1)}%)` },
    { name: "Crit %", icon: STAT_ICONS["Crit %"], value: critChance, eq: `${base.crit.toFixed(1)} + ${base.critperlevel.toFixed(1)}*${window.BuildStats.growthFactor(L).toFixed(3)} + ${item.critChance.toFixed(1)} + ${rune.critChance.toFixed(1)}` },
    { name: "Crit Dmg", icon: STAT_ICONS["Crit Dmg"], value: critDamage, eq: `${(base.critdamage ? base.critdamage * 100 : 200).toFixed(1)} + ${item.critDamage.toFixed(1)} + ${rune.critDamage.toFixed(1)}; champion modifier included in displayed value` },
    { name: "ARPen", icon: STAT_ICONS["ARPen"], value: 0, eq: `Flat: items ${item.arPenFlat.toFixed(1)} + runes ${rune.arPenFlat.toFixed(1)} + passive ${(computed.championPenetration?.armorPenFlat||0).toFixed(1)}; percent: 100 × (1 − (1 − ${item.arPenPct.toFixed(1)}%) × (1 − ${rune.arPenPct.toFixed(1)}%) × (1 − ${(computed.championPenetration?.armorPenPct||0).toFixed(1)}%))` },
    { name: "MRPen", icon: STAT_ICONS["MRPen"], value: 0, eq: `Flat: items ${item.mrPenFlat.toFixed(1)} + runes ${rune.mrPenFlat.toFixed(1)}; percent: 100 × (1 − (1 − ${item.mrPenPct.toFixed(1)}%) × (1 − ${rune.mrPenPct.toFixed(1)}%) × (1 − ${(computed.championPenetration?.magicPenPct||0).toFixed(1)}%))` },
    { name: "Lifesteal", icon: STAT_ICONS["Lifesteal"], value: 0, eq: `Lifesteal: ${item.physicalVamp.toFixed(1)}% items + ${rune.physicalVamp.toFixed(1)}% runes + ${(computed.championLifeSteal||0).toFixed(1)}% champion; Omnivamp: ${item.omniVamp.toFixed(1)}%` },
    { name: "Tenacity", icon: STAT_ICONS["Tenacity"], value: 0, eq: `${summaries.tenacity.toFixed(1)}%` },
  ];

  const bonusKeys={HP:"hp",AD:"ad",AP:"ap",Arm:"armor",MR:"mr",AS:"asTotal",Range:"attackRange","Crit %":"critChance"};
  for(const row of rows){const bonus=computed.championBonuses?.[bonusKeys[row.name]];if(bonus)row.eq+=` + champion abilities (${bonus.toFixed(2)})`;}
  for(const row of rows){const percent=rune[{HP:'hpPct',Arm:'armorPct',MR:'mrPct'}[row.name]];if(percent)row.eq=`(${row.eq}) × (1 + ${percent}% from runes)`;}
  const tableHtml = renderPairedRows(rows.map((row) => {
    if (row.name === "AH") return { ...row, displayValue: `${window.ItemDescriptions.number(abilityHaste)} (${window.ItemDescriptions.number(computed.basicHaste)}/${window.ItemDescriptions.number(computed.ultimateHaste)})` };
    if (row.name === "ARPen") return { ...row, displayValue: `${computed.armorPenFlat.toFixed(1)}/${computed.armorPenPct.toFixed(1)}%` };
    if (row.name === "MRPen") return { ...row, displayValue: `${computed.magicPenFlat.toFixed(1)}/${computed.magicPenPct.toFixed(1)}%` };
    if (row.name === "Lifesteal") return { ...row, displayValue: `${summaries.lifeSteal.toFixed(1)}%/${item.omniVamp.toFixed(1)}%` };
    if (row.name === "Tenacity") return { ...row, displayValue: `${summaries.tenacity.toFixed(1)}%` };
    return {
      ...row,
      displayValue: row.value.toFixed(row.name === "AS" ? 3 : 1),
    };
  }));

  root.innerHTML = tableHtml;
  renderPassivePanel(passiveLedger);
}

function renderRunePanel() {
  hideRuneTooltip();
  const root = document.getElementById("runePanel");
  const pathIds = Object.keys(RUNE_DATA.paths);
  const fallbackPrimaryPathId = pathIds[0] || "";
  const primaryPathId = RUNE_DATA.paths[BUILDER.runeSelections.primaryPath] ? BUILDER.runeSelections.primaryPath : fallbackPrimaryPathId;
  const fallbackSecondaryPathId = pathIds.find((id) => id !== primaryPathId) || primaryPathId;
  const secondaryPathId = (BUILDER.runeSelections.secondaryPath !== primaryPathId && RUNE_DATA.paths[BUILDER.runeSelections.secondaryPath])
    ? BUILDER.runeSelections.secondaryPath
    : fallbackSecondaryPathId;
  BUILDER.runeSelections.primaryPath = primaryPathId;
  BUILDER.runeSelections.secondaryPath = secondaryPathId;
  const primaryPath = RUNE_DATA.paths[primaryPathId] || null;
  const secondaryPath = RUNE_DATA.paths[secondaryPathId] || null;
  if (!primaryPath || !secondaryPath) {
    root.innerHTML = `<p class="muted">${BUILDER.runesLoading ? "Loading rune choices…" : "Rune data is unavailable."}</p>`;
    document.getElementById("runesCard").style.setProperty("--rune-splash-url", "none");
    return;
  }
  document.getElementById("runesCard").style.setProperty("--rune-splash-url", primaryPath.splash || "none");

  const renderShardIcon = (slotIndex) => {
    const rune = getRuneMeta(BUILDER.runeSelections.shards[slotIndex]);
    return `<button class="rune-grid-btn rune-shard-icon-btn is-active" data-rune-target="shard_${slotIndex}" data-desc="${escapeAttr(`${rune.name}: ${rune.desc || rune.name}`)}" aria-label="${rune.name}" type="button">${runeImgTag(rune)}</button>`;
  };
  const escapeAttr = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;");

  const renderPrimaryRuneGrid = () => {
    const rows = primaryPath.primaryRows || [];
    return `<div class="rune-subpanel-grid rune-subpanel-grid-primary">${rows.map((row, rowIndex) => `<div class="rune-choice-row">${row.map((runeId) => {
      const rune = getRuneMeta(runeId);
      const active = BUILDER.runeSelections.primary[rowIndex] === runeId ? "is-active" : "";
      return `<button class="rune-grid-btn ${active}" data-rune-choice-target="primary_${rowIndex}" data-rune-choice-id="${runeId}" data-desc="${escapeAttr(`${rune.name}: ${rune.desc}`)}" aria-label="${rune.name}">${runeImgTag(rune)}</button>`;
    }).join("")}</div>`).join("")}</div>`;
  };

  const getSecondaryChoiceTarget = (runeId) => {
    const row = getSecondaryRowIndex(BUILDER.runeSelections.secondaryPath, runeId);
    const [first, second] = BUILDER.runeSelections.secondary;
    if (runeId === first) return "secondary_0";
    if (runeId === second) return "secondary_1";
    const firstRow = getSecondaryRowIndex(BUILDER.runeSelections.secondaryPath, first);
    const secondRow = getSecondaryRowIndex(BUILDER.runeSelections.secondaryPath, second);
    if (row === firstRow) return "secondary_1";
    if (row === secondRow) return "secondary_0";
    return "secondary_0";
  };

  const renderSecondaryRuneGrid = () => {
    const rows = getSecondaryRows(BUILDER.runeSelections.secondaryPath);
    const selected = new Set(BUILDER.runeSelections.secondary);
    return `<div class="rune-subpanel-grid">${rows.map((row) => `<div class="rune-choice-row">${row.map((runeId) => {
      const rune = getRuneMeta(runeId);
      const active = selected.has(runeId) ? "is-active" : "";
      return `<button class="rune-grid-btn ${active}" data-rune-choice-target="${getSecondaryChoiceTarget(runeId)}" data-rune-choice-id="${runeId}" data-desc="${escapeAttr(`${rune.name}: ${rune.desc}`)}" aria-label="${rune.name}">${runeImgTag(rune)}</button>`;
    }).join("")}</div>`).join("")}</div>`;
  };

  const renderSelectedRune = (id,target) => { const rune=getRuneMeta(id); return `<button type="button" class="rune-grid-btn is-active" data-rune-target="${target}" title="${escapeAttr(rune.name)}" aria-label="Change ${escapeAttr(rune.name)}">${runeImgTag(rune)}</button>`; };
  ensureSecondarySelectionsValid();

  root.innerHTML = `
    <div class="rune-column-block">
      <div class="rune-column-title"><button class='btn btn-sm rune-path-btn' data-rune-target="primaryPath_0"><img src="${primaryPath.icon}" alt="${primaryPath.name}"><span>${primaryPath.name}</span></button></div>
      ${renderPrimaryRuneGrid()}
    </div>
    <div class="rune-column-block">
      <div class="rune-column-title"><button class='btn btn-sm rune-path-btn' data-rune-target="secondaryPath_0"><img src="${secondaryPath.icon}" alt="${secondaryPath.name}"><span>${secondaryPath.name}</span></button></div>
      ${renderSecondaryRuneGrid()}
      <div class="rune-subpanel-grid rune-shard-icon-row">${[0,1,2].map(i=>getRuneOptions(`shard_${i}`).map(rune=>`<button type="button" class="rune-grid-btn ${BUILDER.runeSelections.shards[i]===rune.id?'is-active':''}" data-rune-choice-target="shard_${i}" data-rune-choice-id="${rune.id}" aria-label="${escapeAttr(rune.name)}" data-desc="${escapeAttr(`${rune.name}: ${rune.desc}`)}">${runeImgTag(rune)}</button>`).join('')).join('')}</div>
    </div>
  `;
}

function getSecondaryRows(pathId) { return window.RuneInputRules.createRules(RUNE_DATA).getSecondaryRows(pathId); }
function getSecondaryRowIndex(pathId,id) { return window.RuneInputRules.createRules(RUNE_DATA).getSecondaryRowIndex(pathId,id); }
function getPathPrimaryDefaults(pathId) { return window.RuneInputRules.createRules(RUNE_DATA).getPathPrimaryDefaults(pathId); }
function getPathSecondaryDefaults(pathId) { return window.RuneInputRules.createRules(RUNE_DATA).getPathSecondaryDefaults(pathId); }
function ensureSecondarySelectionsValid() { BUILDER.runeSelections=window.RuneInputRules.createRules(RUNE_DATA).ensureSecondarySelectionsValid(BUILDER.runeSelections); }
function applySecondaryRuneSelection(id) { BUILDER.runeSelections=window.RuneInputRules.createRules(RUNE_DATA).applySecondaryRuneSelection(BUILDER.runeSelections,id); }

function getRuneOptions(target) {
 return window.RuneInputRules.createRules(RUNE_DATA).choices(BUILDER.runeSelections,target).map(option=>{
  if(target.startsWith('primaryPath')){const path=RUNE_DATA.paths[option.id];return {...option,name:path.name,desc:'Set '+path.name+' as primary path',icon:path.icon};}
  if(target.startsWith('secondaryPath')){const path=RUNE_DATA.paths[option.id];return {...option,name:path.name,desc:option.disabled?'Secondary path cannot match primary path':'Set '+path.name+' as secondary path',icon:path.icon};}
  return {...option,...getRuneMeta(option.id)};
 });
}

function openRuneModal(target) {
  BUILDER.runeModalTarget = target;
  document.getElementById("runeModal").classList.remove("hidden");
  const options = getRuneOptions(target);
  document.getElementById("runeModalTitle").textContent = "Select Rune Option";
  const optionBtn = (o) => {
    const disabled = o.disabled ? "disabled" : "";
    const lockNote = o.disabled ? (o.desc || "This option is unavailable") : (o.desc || "");
    return `<button class="rune-option-btn ${o.disabled ? "is-disabled" : ""}" ${disabled} data-rune-option-id="${o.id}">${runeImgTag(o)}<div><div class="rune-option-name">${o.name}</div><div class="rune-option-desc">${lockNote}</div></div></button>`;
  };

  if (/^secondary_\d+$/.test(target)) {
    const groups = [0, 1, 2]
      .map((rowIndex) => options.filter((o) => o.rowIndex === rowIndex))
      .filter((group) => group.length);
    document.getElementById("runeModalList").innerHTML = groups
      .map((group, idx) => `<section class='rune-option-group'><h4 class='rune-option-group-title'>Secondary Row ${idx + 1}</h4><div class='rune-option-group-grid'>${group.map(optionBtn).join("")}</div></section>`)
      .join("");
  } else {
    document.getElementById("runeModalList").innerHTML = options.map(optionBtn).join("");
  }
  document.getElementById("runeModal").onclick = (e) => {
    if (e.target.id === "runeModal") closeRuneModal();
  };
}

function closeRuneModal() {
  document.getElementById("runeModal").classList.add("hidden");
  BUILDER.runeModalTarget = null;
}

function selectRuneOption(id) {
  if (!BUILDER.runeModalTarget) return;
  if (!getRuneOptions(BUILDER.runeModalTarget).some(option => option.id === id && !option.disabled)) return;
  BUILDER.runeSelections=window.RuneInputRules.createRules(RUNE_DATA).selectOption(BUILDER.runeSelections,BUILDER.runeModalTarget,id);
  renderRunePanel();
  renderStats();
  renderAbilityCards();
  closeRuneModal();
}

document.addEventListener("DOMContentLoaded", initBuilder);

// Overlays keep the dashboard in place and support keyboard dismissal.
document.addEventListener('keydown', event => { if(event.key === 'Escape') document.querySelectorAll('.dashboard-detail[open]').forEach(detail => {detail.open=false;detail.querySelector('summary').focus();}); });
