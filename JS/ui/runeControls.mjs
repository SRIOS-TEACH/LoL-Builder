import RecordValues from '../core/records.js';
import RuneInputRules from '../domain/runeInputs.js';
import ScenarioInputs from '../domain/scenarioInputs.js';
import ItemDescriptions from '../shared/itemDescriptions.js';
import RuneEffects from '../shared/runeEffects.js';
import {createLifecycle,createView,createIdPrefix} from './lifecycle.mjs';
export function createRuneControls({elements, events, initial, data, evaluateStacks, onChange, idPrefix = createIdPrefix()}) {
const life=createLifecycle(), document=createView(elements,idPrefix), viewport=events.ownerDocument.defaultView;
let model=RecordValues.copyRecord(initial), RUNE_DATA=data;
const notify=()=>onChange({runeSelections:RecordValues.copyRecord(model.runeSelections),runeStacks:{...model.runeStacks},gameTimeMinutes:model.gameTimeMinutes});
const getStackRuneEffects=()=>evaluateStacks(model);
function initRuneControls() {
  const time = document.getElementById('gameTime');
  const updateBuild = () => { notify(); };
  time.value = model.gameTimeMinutes;
  life.on(time,'input', () => {
    if (!time.value.trim()) return;
    model.gameTimeMinutes = ScenarioInputs.normalizeGameTime(time.value);
    updateBuild();
  });
  life.on(time,'change', () => { model.gameTimeMinutes = ScenarioInputs.normalizeGameTime(time.value); time.value = model.gameTimeMinutes; updateBuild(); });

  const modal = document.getElementById('runeStacksModal');
  const close = () => { modal.classList.add('hidden'); document.getElementById('runeStacksBtn').focus(); };
  life.on(document.getElementById('runeStacksBtn'),'click', () => {
    hideRuneTooltip(); renderRuneStacks(); modal.classList.remove('hidden');
    (modal.querySelector('input') || document.getElementById('closeRuneStacksBtn')).focus();
  });
  life.on(document.getElementById('closeRuneStacksBtn'),'click', close);
  let backdropPressed = false;
  life.on(modal,'pointerdown', event => { backdropPressed = event.target === modal; });
  life.on(modal,'click', event => { if (backdropPressed && event.target === modal) close(); backdropPressed = false; });
  life.on(modal,'keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const controls = [...modal.querySelectorAll('button, input')], first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  const updateStack = (event, commit) => {
    const input = event.target.closest('[data-rune-stack]');
    if (!input || (!commit && !input.value.trim())) return;
    const id = input.dataset.runeStack, field = RuneEffects.fields(model, RUNE_DATA.runeLookup).find(field => field.id === id);
    if (!field) return;
    model.runeStacks[id] = RuneEffects.normalize(input.value, field);
    if (commit) input.value = model.runeStacks[id];
    updateBuild();
    const note = document.getElementById(`${document.id('rune-stack-note-'+id)}`);
    if (note) note.textContent = getStackRuneEffects().notes[id] || '';
  };
  life.on(document.getElementById('runeStacksList'),'input', event => updateStack(event, false));
  life.on(document.getElementById('runeStacksList'),'change', event => updateStack(event, true));

  const panel = document.getElementById('runePanel');
  for (const type of ['mouseover', 'focusin']) life.on(panel,type, event => {
    const button = event.target.closest('[data-desc]');
    if (button) showRuneTooltip(button);
  });
  life.on(panel,'mouseout', event => { if (!event.target.closest('[data-desc]')?.contains(event.relatedTarget)) hideRuneTooltip(); });
  life.on(panel,'focusout', hideRuneTooltip);
  life.on(events,'keydown', event => { if (event.key === 'Escape') hideRuneTooltip(); });
  life.on(viewport,'resize',hideRuneTooltip);
  life.on(events,'scroll', hideRuneTooltip, true);
}

function getRuneMeta(id) {
  return RUNE_DATA.runeLookup[id] || { name: "Select", desc: "Pick a rune", longDesc: "Pick a rune", icon: "" };
}

function runeImgTag(meta, className = "") {
  const fallback = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2NCcgaGVpZ2h0PSc2NCc+PHJlY3Qgd2lkdGg9JzY0JyBoZWlnaHQ9JzY0JyByeD0nMzInIGZpbGw9JyMxMTFmM2QnLz48Y2lyY2xlIGN4PSczMicgY3k9JzMyJyByPScyNicgZmlsbD0nIzI3M2Q3MCcvPjwvc3ZnPg==";
  return `<img class="${className}" src="${meta.icon || fallback}" alt="${meta.name}" data-fallback="${fallback}" onerror="this.onerror=null;this.src=this.dataset.fallback">`;
}

function renderRuneStacks() {
  const fields = RuneEffects.fields(model, RUNE_DATA.runeLookup), notes = getStackRuneEffects().notes;
  const escape = ItemDescriptions.escape;
  document.getElementById('runeStacksList').innerHTML = fields.length ? fields.map(field => `<div class="rune-stack-row"><label for="${document.id('rune-stack-'+field.id)}"><strong>${escape(field.name)}</strong><span>${escape(field.label)}</span></label><input id="${document.id('rune-stack-'+field.id)}" class="form-control" type="number" min="0" ${field.max === undefined ? '' : `max="${field.max}"`} step="1" data-rune-stack="${field.id}" value="${RuneEffects.normalize(model.runeStacks[field.id], field)}" aria-describedby="${document.id('rune-stack-note-'+field.id)}"><small id="${document.id('rune-stack-note-'+field.id)}" class="text-muted">${escape(notes[field.id] || '')}</small></div>`).join('') : '<p class="text-muted">Your selected runes have no stack counters.</p>';
}

function hideRuneTooltip() {
  document.getElementById('runeTooltip').hidden = true;
  document.querySelectorAll(`[aria-describedby="${document.getElementById('runeTooltip').id}"]`).forEach(button => button.removeAttribute('aria-describedby'));
}

function showRuneTooltip(button) {
  const tooltip = document.getElementById('runeTooltip');
  hideRuneTooltip();
  if (!button.dataset.desc) return;
  tooltip.textContent = button.dataset.desc;
  tooltip.hidden = false;
  button.setAttribute('aria-describedby', document.getElementById('runeTooltip').id);
  const box = button.getBoundingClientRect(), gap = 10, width = tooltip.offsetWidth, height = tooltip.offsetHeight;
  const right = box.right + gap, left = right + width <= viewport.innerWidth - gap ? right : box.left - width - gap;
  tooltip.style.left = `${Math.max(gap, Math.min(viewport.innerWidth - width - gap, left))}px`;
  tooltip.style.top = `${Math.max(gap, Math.min(viewport.innerHeight - height - gap, box.top))}px`;
}

function renderRunePanel() {
  hideRuneTooltip();
  const root = document.getElementById("runePanel");
  const pathIds = Object.keys(RUNE_DATA.paths);
  const fallbackPrimaryPathId = pathIds[0] || "";
  const primaryPathId = RUNE_DATA.paths[model.runeSelections.primaryPath] ? model.runeSelections.primaryPath : fallbackPrimaryPathId;
  const fallbackSecondaryPathId = pathIds.find((id) => id !== primaryPathId) || primaryPathId;
  const secondaryPathId = (model.runeSelections.secondaryPath !== primaryPathId && RUNE_DATA.paths[model.runeSelections.secondaryPath])
    ? model.runeSelections.secondaryPath
    : fallbackSecondaryPathId;
  model.runeSelections.primaryPath = primaryPathId;
  model.runeSelections.secondaryPath = secondaryPathId;
  const primaryPath = RUNE_DATA.paths[primaryPathId] || null;
  const secondaryPath = RUNE_DATA.paths[secondaryPathId] || null;
  if (!primaryPath || !secondaryPath) {
    root.innerHTML = `<p class="muted">${model.runesLoading ? "Loading rune choices…" : "Rune data is unavailable."}</p>`;
    document.getElementById("runesCard").style.setProperty("--rune-splash-url", "none");
    return;
  }
  document.getElementById("runesCard").style.setProperty("--rune-splash-url", primaryPath.splash || "none");

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
      const active = model.runeSelections.primary[rowIndex] === runeId ? "is-active" : "";
      return `<button class="rune-grid-btn ${active}" data-rune-choice-target="primary_${rowIndex}" data-rune-choice-id="${runeId}" data-desc="${escapeAttr(`${rune.name}: ${rune.desc}`)}" aria-label="${rune.name}">${runeImgTag(rune)}</button>`;
    }).join("")}</div>`).join("")}</div>`;
  };

  const getSecondaryChoiceTarget = (runeId) => {
    const row = getSecondaryRowIndex(model.runeSelections.secondaryPath, runeId);
    const [first, second] = model.runeSelections.secondary;
    if (runeId === first) return "secondary_0";
    if (runeId === second) return "secondary_1";
    const firstRow = getSecondaryRowIndex(model.runeSelections.secondaryPath, first);
    const secondRow = getSecondaryRowIndex(model.runeSelections.secondaryPath, second);
    if (row === firstRow) return "secondary_1";
    if (row === secondRow) return "secondary_0";
    return "secondary_0";
  };

  const renderSecondaryRuneGrid = () => {
    const rows = getSecondaryRows(model.runeSelections.secondaryPath);
    const selected = new Set(model.runeSelections.secondary);
    return `<div class="rune-subpanel-grid">${rows.map((row) => `<div class="rune-choice-row">${row.map((runeId) => {
      const rune = getRuneMeta(runeId);
      const active = selected.has(runeId) ? "is-active" : "";
      return `<button class="rune-grid-btn ${active}" data-rune-choice-target="${getSecondaryChoiceTarget(runeId)}" data-rune-choice-id="${runeId}" data-desc="${escapeAttr(`${rune.name}: ${rune.desc}`)}" aria-label="${rune.name}">${runeImgTag(rune)}</button>`;
    }).join("")}</div>`).join("")}</div>`;
  };

  ensureSecondarySelectionsValid();

  root.innerHTML = `
    <div class="rune-column-block">
      <div class="rune-column-title"><button class='btn btn-sm rune-path-btn' data-rune-target="primaryPath_0"><img src="${primaryPath.icon}" alt="${primaryPath.name}"><span>${primaryPath.name}</span></button></div>
      ${renderPrimaryRuneGrid()}
    </div>
    <div class="rune-column-block">
      <div class="rune-column-title"><button class='btn btn-sm rune-path-btn' data-rune-target="secondaryPath_0"><img src="${secondaryPath.icon}" alt="${secondaryPath.name}"><span>${secondaryPath.name}</span></button></div>
      ${renderSecondaryRuneGrid()}
      <div class="rune-subpanel-grid rune-shard-icon-row">${[0,1,2].map(i=>getRuneOptions(`shard_${i}`).map(rune=>`<button type="button" class="rune-grid-btn ${model.runeSelections.shards[i]===rune.id?'is-active':''}" data-rune-choice-target="shard_${i}" data-rune-choice-id="${rune.id}" aria-label="${escapeAttr(rune.name)}" data-desc="${escapeAttr(`${rune.name}: ${rune.desc}`)}">${runeImgTag(rune)}</button>`).join('')).join('')}</div>
    </div>
  `;
}

function getSecondaryRows(pathId) { return RuneInputRules.createRules(RUNE_DATA).getSecondaryRows(pathId); }

function getSecondaryRowIndex(pathId,id) { return RuneInputRules.createRules(RUNE_DATA).getSecondaryRowIndex(pathId,id); }

function getPathPrimaryDefaults(pathId) { return RuneInputRules.createRules(RUNE_DATA).getPathPrimaryDefaults(pathId); }

function getPathSecondaryDefaults(pathId) { return RuneInputRules.createRules(RUNE_DATA).getPathSecondaryDefaults(pathId); }

function ensureSecondarySelectionsValid() { model.runeSelections=RuneInputRules.createRules(RUNE_DATA).ensureSecondarySelectionsValid(model.runeSelections); }

function applySecondaryRuneSelection(id) { model.runeSelections=RuneInputRules.createRules(RUNE_DATA).applySecondaryRuneSelection(model.runeSelections,id); }

function getRuneOptions(target) {
 return RuneInputRules.createRules(RUNE_DATA).choices(model.runeSelections,target).map(option=>{
  if(target.startsWith('primaryPath')){const path=RUNE_DATA.paths[option.id];return {...option,name:path.name,desc:'Set '+path.name+' as primary path',icon:path.icon};}
  if(target.startsWith('secondaryPath')){const path=RUNE_DATA.paths[option.id];return {...option,name:path.name,desc:option.disabled?'Secondary path cannot match primary path':'Set '+path.name+' as secondary path',icon:path.icon};}
  return {...option,...getRuneMeta(option.id)};
 });
}

function openRuneModal(target) {
  model.runeModalTarget = target;
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

}

function closeRuneModal() {
  document.getElementById("runeModal").classList.add("hidden");
  model.runeModalTarget = null;
}

function selectRuneOption(id) {
  if (!model.runeModalTarget) return;
  if (!getRuneOptions(model.runeModalTarget).some(option => option.id === id && !option.disabled)) return;
  model.runeSelections=RuneInputRules.createRules(RUNE_DATA).selectOption(model.runeSelections,model.runeModalTarget,id);
  renderRunePanel();
  notify();
  closeRuneModal();
}
life.on(document.getElementById('runePanel'),'click',event=>{
 const quick=event.target.closest('[data-rune-choice-target][data-rune-choice-id]');
 if(quick&&!quick.disabled){model.runeModalTarget=quick.dataset.runeChoiceTarget;selectRuneOption(quick.dataset.runeChoiceId);return;}
 const button=event.target.closest('[data-rune-target]');if(button)openRuneModal(button.dataset.runeTarget);
});
life.on(document.getElementById('runeModalList'),'click',event=>{const button=event.target.closest('[data-rune-option-id]');if(button&&!button.disabled)selectRuneOption(button.dataset.runeOptionId);});
life.on(document.getElementById('closeRuneModalBtn'),'click',closeRuneModal);
life.on(document.getElementById('runeModal'),'click',event=>{if(event.target===document.getElementById('runeModal'))closeRuneModal();});
initRuneControls();
return {
 update(next,nextData=RUNE_DATA){if(life.disposed)return;model=RecordValues.copyRecord(next);RUNE_DATA=nextData;renderRunePanel();document.getElementById('gameTime').value=model.gameTimeMinutes;},
 dispose(){life.dispose();hideRuneTooltip();document.getElementById('runeModal').classList.add('hidden');document.getElementById('runeStacksModal').classList.add('hidden');},
 open:openRuneModal,close:closeRuneModal,choices:getRuneOptions,
};
}
