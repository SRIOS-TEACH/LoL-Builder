import AbilityPresentation from '../presentation/abilityPresentation.js';
import AbilityDps from '../shared/abilityDps.js';
import AbilityRules from '../shared/abilityRules.js';
import Calculations from '../shared/calculations.js';
import ChampionEffects from '../shared/championEffects.js';
import CombatInputs from '../shared/combatInputs.js';
import DamageText from '../shared/damageText.js';
import {createLifecycle,createView,createIdPrefix} from './lifecycle.mjs';
export function createAbilityControls({elements, initial, evaluate, onChange, idPrefix = createIdPrefix()}) {
const document=createView(elements,idPrefix);let model=initial,renderLife=createLifecycle(),disposed=false,combatRoots=new Set();
const builderEvaluation=()=>evaluate();
const notify=()=>onChange({abilityRanks:{...model.abilityRanks},combatValues:{...model.combatValues}});
const enforceAbilityRules=()=>{model.abilityRanks=AbilityRules.enforceAbilityRules(model.level,model.abilityRanks);};
const abilityMaxByLevel=(level,key)=>AbilityRules.abilityMaxByLevel(level,key);
const resolveAbilityToken=(...args)=>AbilityPresentation.legacyToken(builderEvaluation().resolution.resolveAbilityToken(...args));
const presentation=()=>{const e=builderEvaluation();return AbilityPresentation.create(e.state,e.stats,e.resolution,resolveAbilityToken);};
const buildDetailedPassiveText=(...args)=>presentation().buildDetailedPassiveText(...args);
const buildDetailedAbilityText=(...args)=>presentation().buildDetailedAbilityText(...args);
const abilityEffectValues=(...args)=>presentation().abilityEffectValues(...args);
const computeDerivedBuildStats=(...args)=>builderEvaluation().stats.computeDerivedBuildStats(...args);
const computeAutoAttackProfile=(...args)=>builderEvaluation().stats.computeAutoAttackProfile(...args);
const getComputedChampionStatsForTooltips=(...args)=>builderEvaluation().stats.getComputedChampionStatsForTooltips(...args);
const baseCalculationContext=(...args)=>builderEvaluation().stats.baseCalculationContext(...args);
const parseByRank=(...args)=>builderEvaluation().resolution.parseByRank(...args);
const buildAbilityContext=(...args)=>builderEvaluation().resolution.buildAbilityContext(...args);
const canonicalizeToken=(...args)=>builderEvaluation().resolution.canonicalizeToken(...args);
function renderAlternateAbilityDps(spell,rank,slot) {
 const result=builderEvaluation().evaluateAlternate(spell,rank,slot,{presentToken:AbilityPresentation.legacyToken});
 if(!result)return '';
 if(result.status==='unsupported')return `<div class="ability-dps"><strong>${result.label} Damage:</strong> Alternate form data unavailable</div>`;
 return `<div class="ability-dps-form"><strong>${result.label}</strong>${AbilityDps.render(result.damage)}</div>`;
}

function combatSources() {
  const buffNames={};
  for(const [path,record] of Object.entries(model.cdragonRaw||{})) {
    for(const name of [path.split('/').pop(),record?.ObjectName,record?.mScriptName].filter(Boolean))buffNames[Calculations.hash(name)]=name;
  }
  const sources=[];
  const seen=new Set();
  const allTooltipText=[model.championData?.passive?.description,...(model.championData?.spells||[]).map(s=>s.tooltip)].join(' ');
  const add=(payload,slot,label)=>{
    if(!payload||seen.has(payload.calculations))return;
    seen.add(payload.calculations);
    const calculations=Object.fromEntries(Object.entries(payload.calculations||{}).filter(([key,calc])=>
      (!calc.tooltipOnly&&!/^tooltiponly_/i.test(key)) || allTooltipText.toLowerCase().includes(key.toLowerCase())
    ));
    sources.push({...payload,calculations,slot,label,buffNames});
  };
  for(const slot of ['p','q','w','e','r']){
    const spell=slot==='p'?model.championData?.passive:model.championData?.spells?.[['q','w','e','r'].indexOf(slot)];
    add(model.cdragonAbilityData?.[slot],slot,`${slot.toUpperCase()} ${spell?.name||''}`);
  }
  for(const [i,spell]of (model.championData?.spells||[]).entries()){
    for(const match of (spell.tooltip||'').matchAll(/spell\.([^:}]+):/gi)){
      const ref=model.cdragonAbilityData?.byAlias?.[canonicalizeToken(match[1])];
      add(ref?.payload,['q','w','e','r'][i],`${['Q','W','E','R'][i]} ${spell.name}`);
    }
  }

  return sources;
}

function renderCombatInputs() {
  document.getElementById('combatInputs')?.replaceChildren();
  const sources=combatSources(),base=baseCalculationContext(getComputedChampionStatsForTooltips());
  const extra=ChampionEffects.model(model).fields.concat((model.championData?.spells||[])
    .flatMap((spell,i)=>AbilityDps.timingFields(spell.id,['q','w','e','r'][i])));
  const all=CombatInputs.descriptors(sources,base).filter(f=>!extra.some(e=>e.key===f.key)).concat(extra);
  const usage=new Map();
  for(const source of sources){
    for(const field of CombatInputs.descriptors([source],base)){
      if(!usage.has(field.key))usage.set(field.key,new Set());usage.get(field.key).add(source.slot);
    }
  }
  const fieldOwner=field=>{
    if(field.slot)return field.slot;
    const slots=[...usage.get(field.key)||[]];
    if(slots.includes('p'))return 'p';
    if(field.kind==='buff'){
      const index=(model.championData?.spells||[]).findIndex(spell=>Calculations.hash(spell.id)===field.key.slice(5));
      const slot=['q','w','e','r'][index];if(slots.includes(slot))return slot;
    }
    return slots.length>1?'p':slots[0];
  };
  for(const slot of ['p','q','w','e','r']){
    const fields=all.filter(field=>fieldOwner(field)===slot).map(field=>{
      const slots=[...usage.get(field.key)||[]];
      if(!field.slot && field.kind==='buff' && fieldOwner(field)==='p'){
        const passive=model.championData?.passive?.name||'Passive';
        const sharedCounters=all.filter(f=>f.kind==='buff'&&fieldOwner(f)==='p');
        return {...field,label:sharedCounters.length===1?`${passive} stacks`:`${passive} — ${field.label}`};
      }
      return field;
    });
    const controlRoot=document.querySelector(`[data-ability-slot="${slot}"] .ability-inputs`);
    if(controlRoot)combatRoots.add(controlRoot);
    CombatInputs.render(controlRoot,{
      fields,inline:true,sources:[],base,values:model.combatValues,
      onChange:()=>{notify();},
    });
  }
}

function renderAbilityCards() {
  renderLife.dispose();renderLife=createLifecycle();
  combatRoots.forEach(root=>CombatInputs.dispose(root));combatRoots=new Set();

  const root = document.getElementById("abilityCards");
  const openControls = new Set(root.dataset.champion === model.selectedChampion ? [...root.querySelectorAll("[data-controls-slot][open]")].map(el=>el.dataset.controlsSlot) : []);
  root.dataset.champion = model.selectedChampion || "";
  if (!model.championData) {
    root.innerHTML = "<div class='ability-card'><p class='text-muted'>Select a champion to view abilities.</p></div>";
    document.getElementById("abilityRuleHint").textContent = "";
    return;
  }

  document.getElementById('attackSummary').replaceChildren();
  document.getElementById('attackSettings').replaceChildren();
  const champ = model.championData;
  const computed = computeDerivedBuildStats();
  const attack = computed ? computeAutoAttackProfile(computed) : null;
  const passiveText = buildDetailedPassiveText();
  const passiveDps = AbilityDps.passiveProfile(attack);
  const description = (slot,simple,detailed,values='') => `<div class="ability-description" data-description-slot="${slot}"><div class="simple-description">${model.target.enabled?DamageText.render(simple,token=>({html:'{{'+token+'}}',numeric:null}),{target:model.target,stats:getComputedChampionStatsForTooltips()}):simple||''}</div><div class="detailed-description" hidden>${detailed}${values}</div><button type="button" class="btn btn-sm detail-toggle" aria-expanded="false">Detailed view</button></div>`;
  const passive = `<div class="ability-card ability-passive-card" data-ability-slot="p"><div class="ability-head"><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${model.version}/img/passive/${champ.passive.image.full}" alt="${champ.passive.name}"><strong>Passive - ${champ.passive.name}</strong></div>${description("p",champ.passive.description,passiveText,passiveDps.rows.length?AbilityDps.render(passiveDps):'')}<div class="ability-inputs"></div></div>`;
  const escapeAttack = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const attackNumber = (value, key) => `<span class="attack-result" data-attack-result="${key}" tabindex="0" title="${escapeAttack(attack.breakdown)}">${Number.isFinite(value) ? value.toFixed(1) + (attack.partial ? ' (partial)' : '') : 'Unavailable — see calculation'}</span>`;
  const attackCard = `<div class="ability-card ability-attack-card" data-ability-slot="attack"><div class="ability-head"><strong>Attack</strong></div>
  <div><strong>On-attack damage:</strong> ${attack ? attackNumber(attack.autoAttackDamage,'damage') : '-'}</div>
  <div><strong>On-Attack DPS:</strong> ${attack ? attackNumber(attack.attackDps,'dps') : '-'}</div>
  <div><strong>Attack Range:</strong> ${attack ? attack.attackRange.toFixed(1) : '-'}</div>
  <small>Average damage · ${model.target.enabled?'against target':'before target defences'}</small>
  <details class="dashboard-detail"><summary>Calculation breakdown</summary><div class="detail-content">${attack?.warnings.map(w=>`<p class="text-muted">${escapeAttack(w)}</p>`).join('')||''}
  <pre style="white-space:pre-wrap">${escapeAttack(attack?.breakdown||'Select a champion')}</pre></div></details></div>`;

  const spells = champ.spells.map((spell, i) => {
    const key = ["q", "w", "e", "r"][i];
    const max = abilityMaxByLevel(model.level, key);
    const opts = Array.from({ length: max + 1 }, (_, idx) => `<option value="${idx}">${idx}</option>`).join("");
    const rank = model.abilityRanks[key];
    const cdBase = parseByRank(spell.cooldownBurn, rank);
    const context = rank > 0 ? buildAbilityContext(spell, rank, key) : null;
    const abilityResult=builderEvaluation().evaluateAbility(spell,rank,key,{context:context || undefined,attack,presentToken:AbilityPresentation.legacyToken});
    const cdNumeric = abilityResult.cooldown;
    const cd = cdNumeric !== null
      ? `${cdNumeric.toFixed(2)} (base ${Number(cdBase).toFixed(2)})`
      : cdBase;
    const cost = parseByRank(spell.costBurn, rank);
    const range = parseByRank(spell.rangeBurn, rank);
    const detail = buildDetailedAbilityText(spell, rank, key, context);
    let dps=AbilityDps.render(abilityResult.onHitDamage);
    dps += renderAlternateAbilityDps(spell,rank,key);
    const parsed = document.createElement('div'); parsed.innerHTML=dps;
    const damageNumbers=[...parsed.querySelectorAll('tbody tr')].map(row=>row.children[1]?.innerHTML.trim()).filter(Boolean);
    const damageSummary=damageNumbers.length ? damageNumbers.join(' / ') : '—';
    return `<div class="ability-card" data-ability-slot="${key}"><div class="ability-head"><img class="ability-icon" src="https://ddragon.leagueoflegends.com/cdn/${model.version}/img/spell/${spell.image.full}" alt="${spell.name}"><strong>${key.toUpperCase()} - ${spell.name}</strong></div><div class="ability-rank-row"><label class="label">Rank<select class="form-control" id="${document.id('rank_'+key)}">${opts}</select></label></div>${description(key,spell.description,detail,abilityEffectValues(model.cdragonAbilityData?.[key],rank)+dps)}<div class="ability-inputs"></div><div class="ability-meta"><span><strong>Cooldown:</strong> ${cd}</span><span><strong>Cost:</strong> ${cost}</span><span><strong>Range:</strong> ${range}</span><span class="ability-damage-summary"><strong>Damage:</strong> ${damageSummary}</span></div></div>`;
  }).join("");

  const expanded = new Set(root.dataset.descriptionChampion === model.selectedChampion ? [...root.querySelectorAll('.detail-toggle[aria-expanded="true"]')].map(el=>el.closest('.ability-card').querySelector('.ability-description').dataset.descriptionSlot) : []);
  root.dataset.descriptionChampion = model.selectedChampion;
  root.innerHTML = passive + attackCard + spells;
  root.querySelectorAll('.detail-toggle').forEach(button=>{
    const container=button.parentElement;
    container.closest('.ability-card').querySelector('.ability-head').append(button);
    const update=active=>{button.setAttribute('aria-expanded',String(active));button.textContent=active?'Simple view':'Detailed view';container.querySelector('.simple-description').hidden=active;container.querySelector('.detailed-description').hidden=!active;};
    update(expanded.has(container.dataset.descriptionSlot));
    renderLife.on(button,'click',()=>update(button.getAttribute('aria-expanded')!=='true'));
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
      const active = model.combatValues[control.key] === true && !control.disabled;
      element.setAttribute('aria-pressed', String(active));
      element.textContent = `${control.label}: ${active ? 'On' : 'Off'}`;
      renderLife.on(element,'click', () => { model.combatValues[control.key] = !active; notify(); });
      wrapper.append(element);
    } else if (control.type === 'select') {
      const label = document.createElement('label'); label.textContent = control.label + ' ';
      control.options.forEach((text, i) => { const option = document.createElement('option'); option.value = String(i); option.textContent = text; element.append(option); });
      element.value = String(model.combatValues[control.key] ?? 0);
      renderLife.on(element,'change', () => { model.combatValues[control.key] = Number(element.value); notify(); });
      label.append(element); wrapper.append(label);
    } else {
      const label = document.createElement('label'); label.textContent = control.label + ' ';
      element.type = 'number'; element.min = String(control.min ?? 0); element.step = 'any';
      if (control.max !== undefined) element.max = String(control.max);
      element.value = model.combatValues[control.key] ?? control.defaultValue ?? ''; element.placeholder = 'Enter value';
      renderLife.on(element,'change', () => {
        if (element.value.trim() && Number.isFinite(Number(element.value))) model.combatValues[control.key] = Math.max(control.min??0,Math.min(Number.isFinite(control.max)?control.max:Infinity,Number(element.value)));
        else delete model.combatValues[control.key];
        notify();
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
    el.value = String(model.abilityRanks[k]);
    renderLife.on(el,"change", () => {
      model.abilityRanks[k] = Number(el.value);
      enforceAbilityRules();
      notify();
    });
  });
  document.getElementById("abilityRuleHint").textContent = `At level ${model.level}: basic max ${abilityMaxByLevel(model.level, "q")}, R max ${abilityMaxByLevel(model.level, "r")}, total points ${model.level}.`;
}
return {update(next){if(disposed)return;model={...next,abilityRanks:{...next.abilityRanks},combatValues:{...next.combatValues}};renderAbilityCards();},
 dispose(){disposed=true;renderLife.dispose();combatRoots.forEach(root=>CombatInputs.dispose(root));combatRoots=new Set();},
 refreshCombat(){if(!disposed)renderCombatInputs();}};
}
