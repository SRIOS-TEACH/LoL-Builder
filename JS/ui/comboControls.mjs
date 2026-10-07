import TextValues from '../core/text.js';
import BuildInputs from '../domain/buildInputs.js';
import ComboEvaluation from '../engine/comboEvaluation.js';
import AbilityPresentation from '../presentation/abilityPresentation.js';
import ItemDescriptions from '../shared/itemDescriptions.js';
import {createLifecycle,createView} from './lifecycle.mjs';
export function createComboControls({elements,events,initial,evaluate}) {
 const life=createLifecycle(),document=createView(elements),viewport=events.ownerDocument.defaultView;let model=initial;

  const finite = Number.isFinite, escape = value => TextValues.escapeHtml(String(value));
  const number = value => finite(value) ? Number(value.toFixed(3)) : '';
  let champion = '', steps = [], catalog = [], nextId = 1, editingId = null;
  // Descriptions annotate evaluated packets; they never supply damage/timing inputs.
  const comboPresentation={
    presentToken:AbilityPresentation.legacyToken,
    presentItemSection:({id,item,source,strings,context,section})=>{
      const view=ItemDescriptions.describe({id,item,source,strings,context}).sections.find(row=>row.key===section.key);
      return view?.html.replace(/<[^>]*>/g,' ') ?? section.text;
    },
  };
  function actions() { return ComboEvaluation.actions(evaluate(),comboPresentation); }

  const customBase = {label:'Custom Action',shortcut:'?',damage:null,castTime:null,cooldown:null,damageType:'physical',
    note:'Name this action and enter its damage and timing. Damage is the final amount after target defences. Blank values count as zero.'};
  const leagueMark = '<svg class="combo-league-mark" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="3"/><path fill="currentColor" d="M16 9h11l-3 4v21h10l5-4-3 10H13l3-5z"/></svg>';
  const copyMark = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';
  function icon(action) {
    const url = action.iconUrl || (action.icon ? `https://ddragon.leagueoflegends.com/cdn/${model.version}/img/${action.iconGroup || 'spell'}/${action.icon}`
      : action.itemId ? `https://ddragon.leagueoflegends.com/cdn/${model.version}/img/item/${action.itemId}.png` : null);
    return `<span class="combo-action-icon" aria-hidden="true">${action.group === 'aa'
      ? `<span class="combo-ad-symbol">${'🗡️'}</span>`
      : `${url ? `<img src="${escape(url)}" alt="">` : leagueMark}<span class="combo-key">${escape(action.shortcut || '?')}</span>`}</span>`;
  }
  function selectedActions(entries=catalog) { return ComboEvaluation.selectActions(steps,entries,customBase); }
  function simulate() {
    const evaluation=evaluate();
    return ComboEvaluation.evaluate({build:BuildInputs.readBuildInputs(evaluation.state),
      scenario:{target:model.target,gameTimeMinutes:model.gameTimeMinutes},data:evaluation.data,steps,customBase,presentation:comboPresentation});
  }
  const breakdownAttribute = parts => `data-combo-breakdown="${escape(JSON.stringify(parts))}" aria-describedby="${document.getElementById('comboDamageTooltip').id}"`;
  const warning = text => `<span class="combo-alert" aria-label="${escape(text)}" title="${escape(text)}">!</span>`;
  function render() {
    hideDamageTooltip();
    const result = simulate(), selected = result.timeline.map(row => row.action);
    document.getElementById('comboSequence').textContent = selected.length ? selected.map(a => a.shortcut || '?').join(' → ') : 'Build your combo';
    document.getElementById('comboSteps').innerHTML = selected.map((action,index) => {
      const step = steps[index], row = result.timeline[index];
      return `<li data-step="${step.id}"><div class="combo-step-box">
        <button type="button" class="combo-step-edit" data-op="edit" aria-label="Edit step ${index+1}: ${escape(action.label)}" title="${escape(action.label)} · ${row.start.toFixed(2)}s" ${breakdownAttribute(row.breakdown)}>
          ${icon(action)}<span class="combo-step-damage">${Number(row.damage.toFixed(1))}${row.errors.length ? warning(row.errors.join(' ')) : ''}${model.target.enabled ? `<small class="combo-step-hp" data-combo-hp="${row.hpAfter}">${row.hpAfter.toFixed(1)} HP left</small>` : ''}</span>
        </button><button type="button" class="combo-icon-button" data-op="copy" aria-label="Copy step ${index+1}" title="Copy action">${copyMark}</button><button type="button" class="combo-icon-button" data-op="remove" aria-label="Remove step ${index+1}" title="Remove action">×</button>
        </div><div class="combo-step-move"><button type="button" data-op="up" aria-label="Move step ${index+1} up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-op="down" aria-label="Move step ${index+1} down" ${index === steps.length-1 ? 'disabled' : ''}>↓</button></div></li>`;
    }).join('');
    const damageWarning = result.damageWarnings.length, timeWarning = result.timeWarnings.length;
    document.getElementById('comboResult').innerHTML = `<div><span>Total damage</span><strong tabindex="0" ${breakdownAttribute(result.breakdown)}><span data-combo-total>${result.total.toFixed(1)}</span>${damageWarning ? warning(result.damageWarnings.join('\n')) : ''}</strong></div>
      ${damageWarning ? '<small class="combo-result-note" data-damage-note>Missing damage counts as 0; unknown damage types are flagged.</small>' : ''}
      <div><span>Minimum time</span><strong><span data-combo-duration>${result.duration.toFixed(2)} s</span>${timeWarning ? warning(result.timeWarnings.join('\n')) : ''}</strong></div>
      ${timeWarning ? '<small class="combo-result-note" data-time-note>Missing timing counts as 0. Check flagged steps for timing or order.</small>' : ''}
      ${model.target.enabled ? `<div><span>Target HP remaining</span><strong data-combo-remaining>${result.remainingHp.toFixed(1)}</strong></div><small>Health effects update per action. Damage includes overkill.</small>` : ''}
      <small>${model.target.enabled ? 'Against target' : 'Before target defences'} · ${steps.length} actions · estimate</small>`;
    document.getElementById('comboClear').disabled = !steps.length;
  }
  function renderPicker() {
    const groups = [ ['Attacks', a => a.group === 'aa'], ['Abilities & recasts', a => ['q','w','e','r'].includes(a.group)], ['Champion passive', a => a.group === 'p'], ['Rune damage', a => !!a.runeId], ['Item & champion damage', a => !a.runeId && a.group !== 'p' && a.group !== 'aa' && !['q','w','e','r'].includes(a.group)] ];
    document.getElementById('comboActionList').innerHTML = groups.map(([title,filter]) => {
      const entries = catalog.filter(filter);
      return entries.length ? `<section><h4>${title}</h4>${entries.map(action => `<button type="button" class="combo-picker-action" data-action-id="${escape(action.id)}" ${action.unavailable ? 'disabled' : ''}>${icon(action)}<span><strong>${escape(action.label)}</strong><small>${finite(action.damage) ? number(action.damage) : '0 (damage missing)'} damage${action.unavailable ? ' · disabled in build' : ''}</small></span></button>`).join('')}</section>` : '';
    }).join('') + `<button type="button" class="combo-picker-action combo-custom-choice" data-custom-action>${icon(customBase)}<span><strong>Custom Action</strong><small>Add a blank action with your own name, damage and timing</small></span></button>`;
  }
  function refresh() {
    if (!document.getElementById('comboSteps')) return;
    if (champion !== model.selectedChampion) {
      champion = model.selectedChampion; steps = []; editingId = null;
      document.getElementById('comboEditModal').close();
    }
    catalog = actions();
    document.getElementById('comboQuick').innerHTML = ['q','w','e','r','aa'].map(key => {
      const action = catalog.find(a => a.group === key && /Combined total/.test(a.label) && !a.stage) || catalog.find(a => a.group === key && !a.stage);
      const spell = model.championData?.spells[['q','w','e','r'].indexOf(key)];
      return `<button type="button" class="combo-quick-button" data-add="${escape(action?.id || '')}" aria-label="Add ${key === 'aa' ? 'AA no crit' : key.toUpperCase()}" title="${key === 'aa' ? 'AA no crit' : key.toUpperCase()}" ${action ? '' : 'disabled'}>${icon(action || {group:key,shortcut:key.toUpperCase(),icon:spell?.image?.full})}</button>`;
    }).join('')+`<button type="button" class="combo-quick-button" data-open-custom aria-label="Custom Action" title="Choose an action">${icon(customBase)}</button>`;
    renderPicker(); render();
  }
  function add(id,custom=false) {
    const action = custom ? customBase : catalog.find(a => a.id === id);
    if (!action || action.unavailable) return;
    const uid = nextId++;
    steps.push({id:uid,actionId:custom ? `custom:${uid}` : id,custom,snapshot:{...action},overrides:{}});
    render(); return uid;
  }
  function edit(id) {
    editingId = id;
    const index = steps.findIndex(s => s.id === id), step = steps[index], action = simulate().timeline[index]?.action;
    if (!action) return;
    const field = (key,label) => `<label>${label}<input class="form-control" type="number" min="0" step="any" data-field="${key}" value="${number(step.overrides[key])}" placeholder="${finite(action[key]) ? number(action[key]) : '0 (missing)'}"></label>`;
    document.getElementById('comboEditTitle').textContent = step.custom ? 'Custom Action' : action.label;
    document.getElementById('comboEditFields').innerHTML = `${step.custom ? `<label>Action name<input class="form-control" data-field="label" maxlength="80" value="${escape(action.label)}"></label>` : ''}
      <p class="combo-edit-note">${escape(action.note || '')}</p><p>Blank fields use build values when available, otherwise 0. Overrides stay fixed when the build changes.</p>
      <div class="combo-fields">${field('damage','Damage')}<label>Damage type<select class="form-control" data-field="damageType" aria-label="Damage type"><option value="">${step.custom ? 'Physical (default)' : 'Use ability / item damage type'}</option>${[['physical','Physical'],['magic','Magical'],['true','True']].map(([value,label]) => `<option value="${value}" ${step.overrides.damageType === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      ${field('castTime','Cast / attack windup (s)')}${field('cooldown','Repeat cooldown (s)')}${action.stage ? field('recastDelay','Recast interval (s)')+field('recastWindow','Recast window (s)') : ''}</div>
      ${action.stage ? `<label>Cooldown starts<select class="form-control" data-field="cooldownStarts" aria-label="Cooldown starts"><option value="first" ${action.cooldownStarts !== 'last' ? 'selected' : ''}>First cast</option><option value="last" ${action.cooldownStarts === 'last' ? 'selected' : ''}>Last recast</option></select></label>` : ''}
      <p class="combo-edit-warnings">${escape(simulate().timeline[index].errors.join(' '))}</p>`;
    const modal = document.getElementById('comboEditModal');
    if (!modal.open) modal.showModal();
    (modal.querySelector('input') || document.getElementById('closeComboEdit')).focus();
  }
  function hideDamageTooltip() {
    const tooltip = document.getElementById('comboDamageTooltip');
    if (tooltip) tooltip.hidden = true;
  }
  function showDamageTooltip(element) {
    const parts = JSON.parse(element.dataset.comboBreakdown), tooltip = document.getElementById('comboDamageTooltip');
    tooltip.innerHTML = '<strong>Damage breakdown</strong>'+[['physical','Physical'],['magic','Magical'],['true','True'],['untyped','Unknown type']].filter(([type])=>type !== 'untyped' || parts[type] > 0).map(([type,label])=>`<div class="combo-type-${type}"><span>${label}</span><b>${(parts[type] || 0).toFixed(1)}</b></div>`).join('');
    tooltip.hidden = false;
    const rect = element.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    tooltip.style.left = Math.max(8,Math.min(rect.left,viewport.innerWidth-box.width-8))+'px';
    tooltip.style.top = Math.max(8,rect.bottom+box.height+10 < viewport.innerHeight ? rect.bottom+8 : rect.top-box.height-8)+'px';
  }
  function bindDialog(id,closeId,restore) {
    const modal = document.getElementById(id);
    life.property(document.getElementById(closeId),'onclick',() => modal.close());
    life.on(modal,'close',restore);
    let backdrop = false;
    life.on(modal,'pointerdown',event => { const r = modal.getBoundingClientRect(); backdrop = event.target === modal && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom); });
    life.on(modal,'click',event => { if (backdrop && event.target === modal) modal.close(); backdrop = false; });
  }
  function mount() {
    bindDialog('comboActionModal','closeComboActions',()=>document.querySelector('[data-open-custom]')?.focus());
    bindDialog('comboEditModal','closeComboEdit',()=>document.querySelector(`[data-step="${editingId}"] [data-op="edit"]`)?.focus());
    life.property(document.getElementById('comboQuick'),'onclick',event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.hasAttribute('data-open-custom')) { renderPicker(); const modal = document.getElementById('comboActionModal'); modal.showModal(); modal.scrollTop = 0; document.getElementById('closeComboActions').focus({preventScroll:true}); }
      else add(button.dataset.add);
    });
    life.property(document.getElementById('comboActionList'),'onclick',event => {
      const button = event.target.closest('button'); if (!button || button.disabled) return;
      const custom = button.hasAttribute('data-custom-action'), id = add(button.dataset.actionId,custom);
      document.getElementById('comboActionModal').close();
      if (custom && id) edit(id);
    });
    life.property(document.getElementById('comboClear'),'onclick',() => { steps = []; render(); });
    life.property(document.getElementById('comboSteps'),'onclick',event => {
      const button = event.target.closest('[data-op]'); if (!button) return;
      const index = steps.findIndex(step => String(step.id) === button.closest('li').dataset.step);
      if (index < 0) return;
      const op = button.dataset.op, id = steps[index].id;
      if (op === 'edit') return edit(id);
      if (op === 'remove') steps.splice(index,1);
      if (op === 'copy') steps.splice(index+1,0,{...steps[index],id:nextId++,overrides:{...steps[index].overrides}});
      if (op === 'up' && index > 0) [steps[index-1],steps[index]] = [steps[index],steps[index-1]];
      if (op === 'down' && index < steps.length-1) [steps[index+1],steps[index]] = [steps[index],steps[index+1]];
      render();
      const focusRow = document.querySelector(`[data-step="${id}"]`) || document.getElementById('comboSteps').querySelector('li:last-child');
      (focusRow?.querySelector(`[data-op="${op}"]:not(:disabled)`) || focusRow?.querySelector('[data-op="edit"]') || document.querySelector('[data-open-custom]'))?.focus();
    });
    life.on(document.getElementById('comboEditFields'),'input',event => {
      const input = event.target.closest('[data-field]'), step = steps.find(s => s.id === editingId);
      if (!input || !step) return;
      const key = input.dataset.field;
      if (!input.value.trim()) delete step.overrides[key];
      else if (input.tagName === 'SELECT' || key === 'label') step.overrides[key] = input.value;
      else if (input.validity.valid && finite(Number(input.value))) step.overrides[key] = Number(input.value);
      render();
      const index = steps.findIndex(s=>s.id === editingId);
      document.querySelector('.combo-edit-warnings').textContent = simulate().timeline[index].errors.join(' ');
    });
    life.property(document.getElementById('comboResetStep'),'onclick',() => {
      const step = steps.find(s=>s.id === editingId); if (!step) return;
      step.overrides = {}; render(); edit(editingId);
    });
    life.on(events,'pointerover',event => { const el = event.target.closest('[data-combo-breakdown]'); if (el) showDamageTooltip(el); });
    life.on(events,'pointerout',event => { if (event.target.closest('[data-combo-breakdown]') && !event.target.closest('[data-combo-breakdown]').contains(event.relatedTarget)) hideDamageTooltip(); });
    life.on(events,'focusin',event => { const el = event.target.closest('[data-combo-breakdown]'); if (el) showDamageTooltip(el); });
    life.on(events,'focusout',hideDamageTooltip);
    life.on(events,'scroll',hideDamageTooltip,true);
    life.on(viewport,'resize',hideDamageTooltip);
    life.on(events,'keydown',event=>{if(event.key==='Escape')hideDamageTooltip();});
    refresh();
  }
  mount();
  return {update(next){if(life.disposed)return;model=next;refresh();},dispose(){life.dispose();hideDamageTooltip();for(const name of ['comboActionModal','comboEditModal'])document.getElementById(name).close();}};
}
