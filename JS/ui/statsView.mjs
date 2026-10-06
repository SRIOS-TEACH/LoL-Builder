import BuildStats from '../shared/buildStats.js';
import ItemDescriptions from '../shared/itemDescriptions.js';
import STAT_ICONS from '../presentation/statIcons.mjs';
export function createStatsView({root}) {
let disposed=false;
return {update({computed,summary,rangeBonus}) {
if(disposed)return;


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

  if (!computed) {
    root.innerHTML = renderPairedRows(emptyRows.map((row) => ({ ...row, displayValue: "--" })));

    return;
  }


  if (!computed) return;
  const {
    base, item, rune, level: L,
    hp, hp5, mp, mp5, ad, ap, armor, mr,
    asTotal, abilityHaste, critChance, critDamage, attackRange, moveSpeed,
    passiveLedger,
  } = computed;


  const summaries=summary;
  const rows = [
    { name: "HP", icon: STAT_ICONS["HP"], value: hp, eq: `${base.hp.toFixed(1)} + ${base.hpperlevel.toFixed(1)}*${BuildStats.growthFactor(L).toFixed(3)} + ${item.hp.toFixed(1)} + ${rune.hp.toFixed(1)} + passive(${(passiveLedger.statMods.hp||0).toFixed(1)})` },
    { name: "MP", icon: STAT_ICONS["MP"], value: mp, eq: `${base.mp.toFixed(1)} + ${base.mpperlevel.toFixed(1)}*${BuildStats.growthFactor(L).toFixed(3)} + ${item.mp.toFixed(1)} + ${rune.mp.toFixed(1)}` },
    { name: "HP/5", icon: STAT_ICONS["HP/5"], value: hp5, eq: `(${base.hpregen.toFixed(1)} + ${base.hpregenperlevel.toFixed(2)}*${BuildStats.growthFactor(L).toFixed(3)}) * (1 + ${item.hp5PctBase.toFixed(1)}%) + ${item.hp5.toFixed(1)} + ${rune.hp5.toFixed(1)}` },
    { name: "MP/5", icon: STAT_ICONS["MP/5"], value: mp5, eq: `(${base.mpregen.toFixed(1)} + ${base.mpregenperlevel.toFixed(2)}*${BuildStats.growthFactor(L).toFixed(3)}) * (1 + ${item.mp5PctBase.toFixed(1)}%) + ${item.mp5.toFixed(1)} + ${rune.mp5.toFixed(1)}` },
    { name: "AD", icon: STAT_ICONS["AD"], value: ad, eq: `${base.attackdamage.toFixed(1)} + ${base.attackdamageperlevel.toFixed(1)}*${BuildStats.growthFactor(L).toFixed(3)} + ${item.ad.toFixed(1)} + ${rune.ad.toFixed(1)} + passive(${passiveLedger.statMods.ad.toFixed(1)})` },
    { name: "AP", icon: STAT_ICONS["AP"], value: ap, eq: `0 + ${item.ap.toFixed(1)} + ${rune.ap.toFixed(1)} + passive(${passiveLedger.statMods.ap.toFixed(1)})` },
    { name: "Range", icon: STAT_ICONS["Range"], value: attackRange, eq: `${(base.attackrange || 0).toFixed(1)} + ${item.attackRange.toFixed(1)} + ${rune.attackRange.toFixed(1)} + passive(${rangeBonus.toFixed(1)})` },
    { name: "AH", icon: STAT_ICONS["AH"], value: abilityHaste, eq: `Ability haste: ${item.haste.toFixed(1)} from items + ${rune.haste.toFixed(1)} from runes. Brackets show bonus basic / ultimate ability haste. Add each bonus to the general value: Q/W/E use ${(abilityHaste+computed.basicHaste).toFixed(1)} AH; R uses ${(abilityHaste+computed.ultimateHaste).toFixed(1)} AH. Cooldown = base cooldown / (1 + applicable AH / 100). Abilities with special cooldown rules keep those rules.` },
    { name: "Arm", icon: STAT_ICONS["Arm"], value: armor, eq: `${base.armor.toFixed(1)} + ${base.armorperlevel.toFixed(1)}*${BuildStats.growthFactor(L).toFixed(3)} + ${item.armor.toFixed(1)} + ${rune.armor.toFixed(1)}` },
    { name: "MR", icon: STAT_ICONS["MR"], value: mr, eq: `${base.spellblock.toFixed(1)} + ${base.spellblockperlevel.toFixed(1)}*${BuildStats.growthFactor(L).toFixed(3)} + ${item.mr.toFixed(1)} + ${rune.mr.toFixed(1)}` },
    { name: "AS", icon: STAT_ICONS["AS"], value: asTotal, eq: `${base.attackspeed.toFixed(3)} + ${(base.attackspeedratio || base.attackspeed).toFixed(3)} * (growth ${BuildStats.growthFactor(L).toFixed(3)} * ${base.attackspeedperlevel}% + ${(item.asPct + rune.asPct).toFixed(1)}%)` },
    { name: "MS", icon: STAT_ICONS["MS"], value: moveSpeed, eq: `(${base.movespeed.toFixed(1)} + ${item.msFlat.toFixed(1)} + ${rune.msFlat.toFixed(1)}) * (1 + ${(item.msPct + rune.msPct).toFixed(1)}%)` },
    { name: "Crit %", icon: STAT_ICONS["Crit %"], value: critChance, eq: `${base.crit.toFixed(1)} + ${base.critperlevel.toFixed(1)}*${BuildStats.growthFactor(L).toFixed(3)} + ${item.critChance.toFixed(1)} + ${rune.critChance.toFixed(1)}` },
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
    if (row.name === "AH") return { ...row, displayValue: `${ItemDescriptions.number(abilityHaste)} (${ItemDescriptions.number(computed.basicHaste)}/${ItemDescriptions.number(computed.ultimateHaste)})` };
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


},dispose(){disposed=true;}};
}
