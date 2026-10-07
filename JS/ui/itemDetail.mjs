import CombatInputs from '../shared/combatInputs.js';
import {createLifecycle} from './lifecycle.mjs';
export function createItemDetail({root,onSelect,onCombatChange,describe}) {
const life=createLifecycle();let controls=null;
life.on(root,'click',event=>{const button=event.target.closest('[data-set-item-id]');if(button&&root.contains(button))onSelect(button.dataset.setItemId);});
function update({id,item,version,source,base,values}) {
if(life.disposed)return;
if(controls)CombatInputs.dispose(controls);controls=null;
values={...values};




  if (!id) {
    root.innerHTML = "<p class='text-muted'>No items found.</p>";
    return;
  }

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
  const resolvedDescription = describe(item,id);
  const enhancedDescription = resolvedDescription.html;
  root.innerHTML = `<h3>${item.name}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png' alt='${item.name}'><p><strong>Cost:</strong> ${item.gold?.total ?? 0}g</p><div>${statLines}</div><div class='mt-10 item-description'>${enhancedDescription}</div><button class='btn btn-sm mt-10' data-set-item-id='${id}'>Select this item</button><button class='btn btn-sm mt-10 ml-5' data-set-item-id=''>Clear slot</button>`;
  controls=root.ownerDocument.createElement('div');controls.className='combat-inputs';controls.dataset.open='true';root.append(controls);
  CombatInputs.render(controls,{
    sources:[CombatInputs.itemSource(id,source,item.name)],
    base:base,values:values,
    onChange:()=>onCombatChange({...values}),
  });


}
return {update,dispose(){life.dispose();if(controls)CombatInputs.dispose(controls);}};
}
