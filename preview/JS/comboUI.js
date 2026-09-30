/* Builder adapter. The scheduler lives in shared/comboTester.js. */
(function() {
  const finite = Number.isFinite, escape = value => window.ItemDescriptions.escape(String(value));
  const number = value => finite(value) ? Number(value.toFixed(3)) : '';
  let champion = '', steps = [], catalog = [], nextId = 1, editingId = null;
  const dataValue = (payload, key, rank) => window.Calculations.dataValue(payload?.dataValues || [], key, rank).value;
  const rawSpell = name => Object.values(BUILDER.cdragonRaw || {}).find(r => r.mScriptName === name)?.mSpell;
  const castTime = (spell,rank=1) => {
    const cast = finite(spell?.mCastTime) ? spell.mCastTime : finite(spell?.spellCastTime) ? spell.spellCastTime : null;
    const channel = Array.isArray(spell?.mChannelDuration) ? spell.mChannelDuration[Math.min(rank,spell.mChannelDuration.length-1)] : spell?.mChannelDuration;
    return finite(cast) ? cast + (finite(channel) ? channel : 0) : null;
  };

  function actions() {
    if (!BUILDER.championData) return [];
    const computed = computeDerivedBuildStats(), attack = computeAutoAttackProfile(computed);
    const record = Object.entries(BUILDER.cdragonRaw || {}).find(([path,r]) => /\/CharacterRecords\/Root$/i.test(path) && r.__type === 'CharacterRecord')?.[1];
    const source = window.ItemLookupShared.getState().cdragonById;
    const override = record?.basicAttack?.mOverrideAutoattackCastTime?.mOverrideAutoattackCastTimeCalculation;
    const overrideTime = override ? window.Calculations.evaluate(override,calculationContext(getComputedChampionStatsForTooltips())).value : null;
    const windup = window.ComboTester.attackWindup(record,computed.asTotal,computed.base.attackspeed,overrideTime);
    const result = ['no-crit','crit'].map(outcome => {
      const hit = window.AttackEffects.model(BUILDER,source).profile(computed,{critOutcome:outcome});
      return {id:`aa:${outcome}`,group:'aa',label:outcome === 'crit' ? 'AA crit' : 'AA no crit',shortcut:'AA',
        damage:hit.baseAttackDamage,damageType:hit.baseAttackType,
        cooldown:computed.asTotal > 0 ? 1/computed.asTotal : null,castTime:windup,
        note:'One '+(outcome === 'crit' ? 'critical' : 'non-critical')+' attack. Bonus effects are added separately. Windup uses the champion attack record and current attack speed. Special attack cycles and resets are not simulated.'};
    });
    for (const [index, spell] of BUILDER.championData.spells.entries()) {
      const slot = ['q','w','e','r'][index], rank = BUILDER.abilityRanks[slot];
      if (!rank) continue;
      const context = buildAbilityContext(spell,rank,slot), payload = context.cdragonSpell;
      const cooldown = window.AbilityDps.cooldown(spell,rank,context.stats,payload);
      const profile = window.AbilityDps.profile({spell,rank,cooldown,slot,champion:BUILDER.selectedChampion,
        tooltip:expandAbilityLocalization(spell.tooltip || spell.description || ''),
        resolve:token => resolveAbilityToken(token,context),payload,target:BUILDER.target,stats:context.stats,
        timing:{delay:BUILDER.combatValues[`dps:${slot}:delay`],overlap:BUILDER.combatValues[`dps:${slot}:overlap`]}});
      const read = key => dataValue(payload,key,rank);
      const sequences = {
        AatroxQ:{stages:[0,1,2],delay:1,window:read('QExtensionTime'),starts:'last',cast:castTime(rawSpell('AatroxQWrapperCast'))},
        RivenTriCleave:{stages:[0,1,2],delay:0.5,starts:'first'},
        AuroraQ:{stages:[0,1],delay:null,window:read('MarkDuration'),starts:'first'},
        CamilleQ:{stages:[0,1],delay:read('QRampUpTime'),starts:'last'},
        AkaliR:{stages:[0,1,1],delay:read('CooldownBetweenCasts'),starts:'first'},
        GwenR:{stages:[0,1,2],delay:read('LockoutTime'),starts:'first'},
        NaafiriQ:{stages:[0,0,1,1],delay:read('RecastLockout'),starts:'first'},
        ZaahenQ:{stages:[0,1],delay:read('TimeBetweenAttacks'),starts:'last'},
      };
      const timed = ['AkaliE','KledE','VexR','OrnnR','RenektonSliceAndDice','LeeSinQOne'].includes(spell.id);
      const sequence = sequences[spell.id] || (timed ? {stages:[0,1,0,1],delay:BUILDER.combatValues[`dps:${slot}:delay`],
        starts:BUILDER.combatValues[`dps:${slot}:overlap`] === false ? 'last' : 'first'} : null);
      const rows = profile.rows.length ? profile.rows : [{label:profile.status,damage:{value:profile.status === 'No direct damage' ? 0 : null}}];
      for (const [rowIndex,row] of rows.entries()) {
        if (/^Combined/i.test(row.label) && (sequence || payload?.spellData?.mSpellTags?.includes('Trait_RecastOrReplaceSpell'))) continue;
        const stage = sequence?.stages[rowIndex] || 0;
        const entry = {id:`${slot}:${rowIndex}`, group:slot, label:`${slot.toUpperCase()}${stage ? ` recast ${stage + 1}` : ''} — ${row.label}`,
          damage:row.damage.value,components:row.damage.components,shortcut:slot.toUpperCase()+(stage ? stage+1 : ''),icon:spell.image?.full, cooldown, stage, recastDelay:sequence?.delay ?? null,
          recastWindow:sequence?.window ?? null,cooldownStarts:sequence?.starts,lastStage:sequence ? Math.max(...sequence.stages) : 0,
          castTime:sequence?.cast ?? (spell.id === 'AuroraQ' && stage ? castTime(rawSpell('AuroraQRecast')) : castTime(payload?.spellData,rank)),
          note:profile.note || profile.status};
        result.push(entry);
        if (row.sweet) result.push({...entry,id:entry.id+':sweet',label:entry.label+' (sweet spot)',damage:row.sweet.value,components:row.sweet.components});
      }
      if (!sequence && payload?.spellData?.mSpellTags?.includes('Trait_RecastOrReplaceSpell')) {
        result.push({id:`${slot}:recast`,group:slot,label:`${slot.toUpperCase()} — custom recast`,stage:1,
          damage:null,castTime:null,recastDelay:null,cooldown,cooldownStarts:'first',shortcut:slot.toUpperCase()+'2',icon:spell.image?.full,
          note:'Enter this recast’s damage, cast time and minimum interval. Cooldown starts at the initial cast; override if needed. Champion-specific recast conditions are not modeled.'});
      }
    }
    // Expose each equipped active/passive, including effects the attack model cannot resolve.
    for (const id of [...new Set(BUILDER.itemSlots.filter(Boolean))]) {
      const item = BUILDER.items[id];
      if (!item) continue;
      for (const section of resolveItemDescriptionHtml(item,id).sections || []) {
        const binding = window.AttackEffects.itemPassiveBindings?.[id]?.[section.key];
        const state = {...BUILDER,combatValues:{...BUILDER.combatValues,...(binding ? {[binding]:true} : {})}};
        const profile = binding ? window.AttackEffects.model(state,source).profile(computed) : attack;
        const row = profile.rows.find(r => String(r.itemId) === String(id) && r.passiveKey === section.key);
        // The description resolver already applies target mitigation. Only a single
        // unambiguous typed scalar is safe to adopt; alternatives remain unresolved.
        const packets = window.AbilityDps.components(section.html.replace(/(\d),(?=\d{3}\b)/g,'$1'),()=>null);
        const describedDamage = packets.length === 1 && packets[0].damage.components.length === 1 ? packets[0].damage.value : null;
        if (!section.active && !row && !packets.length) continue;
        const activeCooldown = section.active ? getItemLookupShared().inferActiveCooldownSeconds?.(id) : null;
        result.push({id:`item:${id}:${section.key}`,group:row?.spellbladeId ? 'spellblade' : `item:${id}:${section.key}`,
          label:`${section.active ? 'Active' : 'Passive'} · ${item.name} — ${section.label}`,shortcut:'?',itemId:id,
          damage:row?.value ?? describedDamage,damageType:row?.type ?? packets[0]?.damage.components[0]?.type,castTime:section.active ? null : 0,cooldown:row?.cooldown ?? activeCooldown ?? (row && !Object.hasOwn(row,'interval') ? 0 : null),
          unavailable:!section.active && !itemPassiveEnabled(id,section.key),
          note:section.html.replace(/<[^>]*>/g,' ') + ' One explicit trigger; satisfy its conditions before this step. Unmodeled values require an override.'});
      }
    }
    for (const [index,row] of attack.rows.entries()) {
      if (row.source !== 'champion' || row.replacementDebit || !['physical','magic','true'].includes(row.type)) continue;
      result.push({id:`bonus:${index}:${row.label}`,group:`bonus:${row.label}`,label:`Champion bonus — ${row.label}`,
        damage:row.value,damageType:row.type,shortcut:'?',castTime:0,cooldown:row.cooldown ?? null,note:'One explicit bonus trigger, not included in AA. '+row.formula});
    }
    return result;
  }

  const customBase = {label:'Custom Action',shortcut:'?',damage:null,castTime:null,cooldown:null,damageType:'physical',
    note:'Name this action and enter its damage and timing. Damage is the final amount after target defences. Blank values count as zero.'};
  const leagueMark = '<svg class="combo-league-mark" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="3"/><path fill="currentColor" d="M16 9h11l-3 4v21h10l5-4-3 10H13l3-5z"/></svg>';
  const copyMark = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';
  function icon(action) {
    const url = action.icon ? `https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/spell/${action.icon}`
      : action.itemId ? `https://ddragon.leagueoflegends.com/cdn/${BUILDER.version}/img/item/${action.itemId}.png` : null;
    return `<span class="combo-action-icon" aria-hidden="true">${action.group === 'aa'
      ? `<span class="combo-ad-symbol">${STAT_ICONS.AD}</span>`
      : `${url ? `<img src="${escape(url)}" alt="">` : leagueMark}<span class="combo-key">${escape(action.shortcut || '?')}</span>`}</span>`;
  }
  function selectedActions() {
    return steps.map(step => {
      const entry = step.custom ? {...customBase,id:step.actionId,group:step.actionId} : catalog.find(a => a.id === step.actionId);
      const action = {...(entry || {...step.snapshot,unavailable:true}),...step.overrides};
      if (step.overrides.damageType) action.components = null;
      return action;
    });
  }
  const breakdownAttribute = parts => `data-combo-breakdown="${escape(JSON.stringify(parts))}" aria-describedby="comboDamageTooltip"`;
  const warning = text => `<span class="combo-alert" aria-label="${escape(text)}" title="${escape(text)}">!</span>`;
  function render() {
    hideDamageTooltip();
    const selected = selectedActions(), result = window.ComboTester.simulate(selected);
    document.getElementById('comboSequence').textContent = selected.length ? selected.map(a => a.shortcut || '?').join(' → ') : 'Build your combo';
    document.getElementById('comboSteps').innerHTML = selected.map((action,index) => {
      const step = steps[index], row = result.timeline[index];
      return `<li data-step="${step.id}"><div class="combo-step-box">
        <button type="button" class="combo-step-edit" data-op="edit" aria-label="Edit step ${index+1}: ${escape(action.label)}" title="${escape(action.label)} · ${row.start.toFixed(2)}s" ${breakdownAttribute(row.breakdown)}>
          ${icon(action)}<span class="combo-step-damage">${Number(row.damage.toFixed(1))}${row.errors.length ? warning(row.errors.join(' ')) : ''}</span>
        </button><button type="button" class="combo-icon-button" data-op="copy" aria-label="Copy step ${index+1}" title="Copy action">${copyMark}</button><button type="button" class="combo-icon-button" data-op="remove" aria-label="Remove step ${index+1}" title="Remove action">×</button>
        </div><div class="combo-step-move"><button type="button" data-op="up" aria-label="Move step ${index+1} up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-op="down" aria-label="Move step ${index+1} down" ${index === steps.length-1 ? 'disabled' : ''}>↓</button></div></li>`;
    }).join('');
    const damageWarning = result.damageWarnings.length, timeWarning = result.timeWarnings.length;
    document.getElementById('comboResult').innerHTML = `<div><span>Total damage</span><strong tabindex="0" ${breakdownAttribute(result.breakdown)}><span data-combo-total>${result.total.toFixed(1)}</span>${damageWarning ? warning(result.damageWarnings.join('\n')) : ''}</strong></div>
      ${damageWarning ? '<small class="combo-result-note" data-damage-note>Missing damage counts as 0; unknown damage types are flagged.</small>' : ''}
      <div><span>Minimum time</span><strong><span data-combo-duration>${result.duration.toFixed(2)} s</span>${timeWarning ? warning(result.timeWarnings.join('\n')) : ''}</strong></div>
      ${timeWarning ? '<small class="combo-result-note" data-time-note>Missing timing counts as 0. Check flagged steps for timing or order.</small>' : ''}
      <small>${BUILDER.target.enabled ? 'Against target' : 'Before target defences'} · ${steps.length} actions · estimate</small>`;
    document.getElementById('comboClear').disabled = !steps.length;
  }
  function renderPicker() {
    const groups = [ ['Attacks', a => a.group === 'aa'], ['Abilities & recasts', a => ['q','w','e','r'].includes(a.group)], ['Item & champion damage', a => a.group !== 'aa' && !['q','w','e','r'].includes(a.group)] ];
    document.getElementById('comboActionList').innerHTML = groups.map(([title,filter]) => {
      const entries = catalog.filter(filter);
      return entries.length ? `<section><h4>${title}</h4>${entries.map(action => `<button type="button" class="combo-picker-action" data-action-id="${escape(action.id)}" ${action.unavailable ? 'disabled' : ''}>${icon(action)}<span><strong>${escape(action.label)}</strong><small>${finite(action.damage) ? number(action.damage) : '0 (damage missing)'} damage${action.unavailable ? ' · disabled in build' : ''}</small></span></button>`).join('')}</section>` : '';
    }).join('') + `<button type="button" class="combo-picker-action combo-custom-choice" data-custom-action>${icon(customBase)}<span><strong>Custom Action</strong><small>Add a blank action with your own name, damage and timing</small></span></button>`;
  }
  function refresh() {
    if (!document.getElementById('comboSteps')) return;
    if (champion !== BUILDER.selectedChampion) {
      champion = BUILDER.selectedChampion; steps = []; editingId = null;
      document.getElementById('comboEditModal').close();
    }
    catalog = actions();
    document.getElementById('comboQuick').innerHTML = ['q','w','e','r','aa'].map(key => {
      const action = catalog.find(a => a.group === key && /Combined total/.test(a.label) && !a.stage) || catalog.find(a => a.group === key && !a.stage);
      const spell = BUILDER.championData?.spells[['q','w','e','r'].indexOf(key)];
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
    const index = steps.findIndex(s => s.id === id), step = steps[index], action = selectedActions()[index];
    if (!action) return;
    const field = (key,label) => `<label>${label}<input class="form-control" type="number" min="0" step="any" data-field="${key}" value="${number(step.overrides[key])}" placeholder="${finite(action[key]) ? number(action[key]) : '0 (missing)'}"></label>`;
    document.getElementById('comboEditTitle').textContent = step.custom ? 'Custom Action' : action.label;
    document.getElementById('comboEditFields').innerHTML = `${step.custom ? `<label>Action name<input class="form-control" data-field="label" maxlength="80" value="${escape(action.label)}"></label>` : ''}
      <p class="combo-edit-note">${escape(action.note || '')}</p><p>Blank fields use build values when available, otherwise 0. Overrides stay fixed when the build changes.</p>
      <div class="combo-fields">${field('damage','Damage')}<label>Damage type<select class="form-control" data-field="damageType" aria-label="Damage type"><option value="">${step.custom ? 'Physical (default)' : 'Use ability / item damage type'}</option>${[['physical','Physical'],['magic','Magical'],['true','True']].map(([value,label]) => `<option value="${value}" ${step.overrides.damageType === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      ${field('castTime','Cast / attack windup (s)')}${field('cooldown','Repeat cooldown (s)')}${action.stage ? field('recastDelay','Recast interval (s)')+field('recastWindow','Recast window (s)') : ''}</div>
      ${action.stage ? `<label>Cooldown starts<select class="form-control" data-field="cooldownStarts" aria-label="Cooldown starts"><option value="first" ${action.cooldownStarts !== 'last' ? 'selected' : ''}>First cast</option><option value="last" ${action.cooldownStarts === 'last' ? 'selected' : ''}>Last recast</option></select></label>` : ''}
      <p class="combo-edit-warnings">${escape(window.ComboTester.simulate(selectedActions()).timeline[index].errors.join(' '))}</p>`;
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
    tooltip.style.left = Math.max(8,Math.min(rect.left,innerWidth-box.width-8))+'px';
    tooltip.style.top = Math.max(8,rect.bottom+box.height+10 < innerHeight ? rect.bottom+8 : rect.top-box.height-8)+'px';
  }
  function bindDialog(id,closeId,restore) {
    const modal = document.getElementById(id);
    document.getElementById(closeId).onclick = () => modal.close();
    modal.addEventListener('close',restore);
    let backdrop = false;
    modal.addEventListener('pointerdown',event => { const r = modal.getBoundingClientRect(); backdrop = event.target === modal && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom); });
    modal.addEventListener('click',event => { if (backdrop && event.target === modal) modal.close(); backdrop = false; });
  }
  document.addEventListener('DOMContentLoaded', () => {
    bindDialog('comboActionModal','closeComboActions',()=>document.querySelector('[data-open-custom]')?.focus());
    bindDialog('comboEditModal','closeComboEdit',()=>document.querySelector(`[data-step="${editingId}"] [data-op="edit"]`)?.focus());
    document.getElementById('comboQuick').onclick = event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.hasAttribute('data-open-custom')) { renderPicker(); const modal = document.getElementById('comboActionModal'); modal.showModal(); modal.scrollTop = 0; document.getElementById('closeComboActions').focus({preventScroll:true}); }
      else add(button.dataset.add);
    };
    document.getElementById('comboActionList').onclick = event => {
      const button = event.target.closest('button'); if (!button || button.disabled) return;
      const custom = button.hasAttribute('data-custom-action'), id = add(button.dataset.actionId,custom);
      document.getElementById('comboActionModal').close();
      if (custom && id) edit(id);
    };
    document.getElementById('comboClear').onclick = () => { steps = []; render(); };
    document.getElementById('comboSteps').onclick = event => {
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
      const focusRow = document.querySelector(`[data-step="${id}"]`) || document.querySelector('#comboSteps li:last-child');
      (focusRow?.querySelector(`[data-op="${op}"]:not(:disabled)`) || focusRow?.querySelector('[data-op="edit"]') || document.querySelector('[data-open-custom]'))?.focus();
    };
    document.getElementById('comboEditFields').addEventListener('input',event => {
      const input = event.target.closest('[data-field]'), step = steps.find(s => s.id === editingId);
      if (!input || !step) return;
      const key = input.dataset.field;
      if (!input.value.trim()) delete step.overrides[key];
      else if (input.tagName === 'SELECT' || key === 'label') step.overrides[key] = input.value;
      else if (input.validity.valid && finite(Number(input.value))) step.overrides[key] = Number(input.value);
      render();
      const index = steps.findIndex(s=>s.id === editingId);
      document.querySelector('.combo-edit-warnings').textContent = window.ComboTester.simulate(selectedActions()).timeline[index].errors.join(' ');
    });
    document.getElementById('comboResetStep').onclick = () => {
      const step = steps.find(s=>s.id === editingId); if (!step) return;
      step.overrides = {}; render(); edit(editingId);
    };
    document.addEventListener('pointerover',event => { const el = event.target.closest('[data-combo-breakdown]'); if (el) showDamageTooltip(el); });
    document.addEventListener('pointerout',event => { if (event.target.closest('[data-combo-breakdown]') && !event.target.closest('[data-combo-breakdown]').contains(event.relatedTarget)) hideDamageTooltip(); });
    document.addEventListener('focusin',event => { const el = event.target.closest('[data-combo-breakdown]'); if (el) showDamageTooltip(el); });
    document.addEventListener('focusout',hideDamageTooltip);
    document.addEventListener('scroll',hideDamageTooltip,true);
    window.addEventListener('resize',hideDamageTooltip);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')hideDamageTooltip();});
    refresh();
  });
  window.ComboUI = {refresh};
})();
