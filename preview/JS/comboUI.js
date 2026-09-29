/* Builder adapter. The scheduler lives in shared/comboTester.js. */
(function() {
  const finite = Number.isFinite, escape = value => window.ItemDescriptions.escape(String(value));
  const number = value => finite(value) ? Number(value.toFixed(3)) : '';
  let champion = '', steps = [], catalog = [], nextId = 1;
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
    const record = Object.values(BUILDER.cdragonRaw || {}).find(r => r.__type === 'CharacterRecord' && r.basicAttack);
    const basic = record?.basicAttack;
    // Explicit bonus rows are selectable separately, never amortised into AA.
    const source = window.ItemLookupShared.getState().cdragonById;
    const baseDamage = attack.baseAttackDamage;
    const result = [{id:'aa', group:'aa', label:'AA — basic attack', damage:baseDamage,
      cooldown:computed.asTotal > 0 ? 1 / computed.asTotal : null,
      castTime:finite(basic?.mAttackCastTime) && basic.mAttackTotalTime > 0 && computed.asTotal > 0
        ? basic.mAttackCastTime / basic.mAttackTotalTime / computed.asTotal : null,
      note:'Base attack with average crits; add bonus effects separately. Windup scales with attack speed. Special attack cycles and resets are not simulated.'}];
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
          damage:row.damage.value, cooldown, stage, recastDelay:sequence?.delay ?? null,
          recastWindow:sequence?.window ?? null,cooldownStarts:sequence?.starts,lastStage:sequence ? Math.max(...sequence.stages) : 0,
          castTime:sequence?.cast ?? (spell.id === 'AuroraQ' && stage ? castTime(rawSpell('AuroraQRecast')) : castTime(payload?.spellData,rank)),
          note:profile.note || profile.status};
        result.push(entry);
        if (row.sweet) result.push({...entry,id:entry.id+':sweet',label:entry.label+' (sweet spot)',damage:row.sweet.value});
      }
      if (!sequence && payload?.spellData?.mSpellTags?.includes('Trait_RecastOrReplaceSpell')) {
        result.push({id:`${slot}:recast`,group:slot,label:`${slot.toUpperCase()} — custom recast`,stage:1,
          damage:null,castTime:null,recastDelay:null,cooldown,cooldownStarts:'first',
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
        const activeCooldown = section.active ? getItemLookupShared().inferActiveCooldownSeconds?.(id) : null;
        result.push({id:`item:${id}:${section.key}`,group:row?.spellbladeId ? 'spellblade' : `item:${id}:${section.key}`,
          label:`${section.active ? 'Active' : 'Passive'} · ${item.name} — ${section.label}`,
          damage:row?.value ?? describedDamage,castTime:section.active ? null : 0,cooldown:row?.cooldown ?? activeCooldown ?? (row && !Object.hasOwn(row,'interval') ? 0 : null),
          unavailable:!section.active && !itemPassiveEnabled(id,section.key),
          note:section.html.replace(/<[^>]*>/g,' ') + ' One explicit trigger; satisfy its conditions before this step. Unmodeled values require an override.'});
      }
    }
    for (const [index,row] of attack.rows.entries()) {
      if (row.source !== 'champion' || row.replacementDebit) continue;
      result.push({id:`bonus:${index}:${row.label}`,group:`bonus:${row.label}`,label:`Champion bonus — ${row.label}`,
        damage:row.value,castTime:0,cooldown:row.cooldown ?? null,note:'One explicit bonus trigger, not included in AA. '+row.formula});
    }
    return result;
  }

  function selectedActions() {
    return steps.map(step => {
      const entry = catalog.find(a => a.id === step.actionId);
      return {...(entry || {id:step.actionId,label:step.label,unavailable:true}),...step.overrides};
    });
  }
  function render() {
    const selected = selectedActions(), result = window.ComboTester.simulate(selected);
    const root = document.getElementById('comboSteps');
    const open = new Set([...root.querySelectorAll('details[open]')].map(el => el.dataset.step));
    root.innerHTML = selected.map((action,index) => {
      const step = steps[index], timing = result.timeline[index];
      const field = (key,label) => `<label>${label}<input class="form-control" type="number" min="0" step="any" data-field="${key}" value="${number(step.overrides[key])}" placeholder="${finite(action[key]) ? number(action[key]) : 'Required'}" aria-label="Step ${index+1} ${label}"></label>`;
      return `<li data-step="${step.id}"><div class="combo-step-heading"><strong>${escape(action.label)}</strong><button class="btn btn-sm" data-op="remove" aria-label="Remove step ${index+1}">×</button></div>
        <small>${finite(action.damage) ? action.damage.toFixed(1) : 'Unknown'} damage · ${timing.start.toFixed(2)}s${timing.wait > 0 ? ` · wait ${timing.wait.toFixed(2)}s` : ''}${result.duration === null ? ' (provisional)' : ''}</small>
        <div class="combo-step-tools"><button class="btn btn-sm" data-op="up" aria-label="Move step ${index+1} up" ${index === 0 ? 'disabled' : ''}>↑</button><button class="btn btn-sm" data-op="down" aria-label="Move step ${index+1} down" ${index === steps.length-1 ? 'disabled' : ''}>↓</button><button class="btn btn-sm" data-op="copy">Repeat</button></div>
        ${timing.errors.length ? `<p class="combo-warning">${escape(timing.errors.join(' '))}</p>` : ''}
        <details data-step="${step.id}" ${open.has(String(step.id)) ? 'open' : ''}><summary>Values & timing${Object.keys(step.overrides).length ? ' · custom' : ''}</summary><p>${escape(action.note || '')}</p><div class="combo-fields">
        ${field('damage','Damage')}${field('castTime','Cast / windup (s)')}${field('cooldown','Repeat cooldown (s)')}${action.stage ? field('recastDelay','Recast interval (s)')+field('recastWindow','Recast window (s)') : ''}</div>
        ${action.stage ? `<label>Cooldown starts<select class="form-control" data-field="cooldownStarts"><option value="first" ${action.cooldownStarts !== 'last' ? 'selected' : ''}>First cast</option><option value="last" ${action.cooldownStarts === 'last' ? 'selected' : ''}>Last recast</option></select></label>` : ''}
        <button class="btn btn-sm" data-op="reset">Use build values</button></details></li>`;
    }).join('');
    document.getElementById('comboResult').innerHTML = steps.length
      ? `<div><span>Total damage</span><strong data-combo-total>${result.total === null ? 'Unavailable' : result.total.toFixed(1)}</strong></div><div><span>Minimum time (estimate)</span><strong data-combo-duration>${result.duration === null ? 'Needs timing / valid order' : result.duration.toFixed(2)+' s'}</strong></div><small>${BUILDER.target.enabled ? 'Against target' : 'Before target defences'} · ${steps.length} actions${result.total === null ? ` · known damage ${result.knownDamage.toFixed(1)}` : ''}</small>`
      : `<p class="text-muted">${BUILDER.championData ? 'Choose an action to start. Rank up abilities to add them.' : 'Select a champion to test a combo.'}</p>`;
    document.getElementById('comboClear').disabled = !steps.length;
  }
  function refresh() {
    if (!document.getElementById('comboSteps')) return;
    if (champion !== BUILDER.selectedChampion) { champion = BUILDER.selectedChampion; steps = []; }
    catalog = actions();
    const select = document.getElementById('comboAction'), previous = select.value;
    select.innerHTML = catalog.map(a => `<option value="${escape(a.id)}" ${a.unavailable ? 'disabled' : ''}>${escape(a.label)}</option>`).join('');
    if (catalog.some(a => a.id === previous)) select.value = previous;
    select.disabled = !catalog.length;
    document.getElementById('comboAdd').disabled = !catalog.length;
    document.getElementById('comboQuick').innerHTML = ['q','w','e','r','aa'].map(key => {
      const action = catalog.find(a => a.group === key && /^.*Combined total/.test(a.label) && !a.stage) || catalog.find(a => a.group === key && !a.stage);
      return `<button class="btn btn-sm" data-add="${escape(action?.id || '')}" ${action ? '' : 'disabled'}>${key.toUpperCase()}</button>`;
    }).join('');
    render();
  }
  function add(id) {
    const action = catalog.find(a => a.id === id);
    if (!action || action.unavailable) return;
    steps.push({id:nextId++,actionId:id,label:action.label,overrides:{}}); render();
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('comboAdd').onclick = () => add(document.getElementById('comboAction').value);
    document.getElementById('comboQuick').onclick = event => { const button = event.target.closest('[data-add]'); if (button) add(button.dataset.add); };
    document.getElementById('comboClear').onclick = () => { steps = []; render(); };
    document.getElementById('comboSteps').onclick = event => {
      const button = event.target.closest('[data-op]'); if (!button) return;
      const index = steps.findIndex(step => String(step.id) === button.closest('li').dataset.step);
      if (index < 0) return;
      const op = button.dataset.op;
      if (op === 'remove') steps.splice(index,1);
      if (op === 'copy') steps.splice(index+1,0,{...steps[index],id:nextId++,overrides:{...steps[index].overrides}});
      if (op === 'reset') steps[index].overrides = {};
      if (op === 'up' && index > 0) [steps[index-1],steps[index]] = [steps[index],steps[index-1]];
      if (op === 'down' && index < steps.length-1) [steps[index+1],steps[index]] = [steps[index],steps[index+1]];
      render();
    };
    document.getElementById('comboSteps').onchange = event => {
      const input = event.target.closest('[data-field]'); if (!input) return;
      const step = steps.find(s => String(s.id) === input.closest('li').dataset.step);
      if (input.tagName === 'SELECT') step.overrides[input.dataset.field] = input.value;
      else if (!input.value.trim()) delete step.overrides[input.dataset.field];
      else if (input.validity.valid && finite(Number(input.value))) step.overrides[input.dataset.field] = Number(input.value);
      render();
    };
    refresh();
  });
  window.ComboUI = {refresh};
})();
