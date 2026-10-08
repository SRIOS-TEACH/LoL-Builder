const fields=['selectedChampion','level','abilityRanks','itemSlots','combatValues','target','disabledItemPassives','runeStacks','gameTimeMinutes','runeSelections'];
export function captureBuild(page,root,previous={},name='') {
 const document={getElementById:id=>root.querySelector('#'+id),querySelectorAll:selector=>root.querySelectorAll(selector)};
 const BUILDER=page.state;
      const state=Object.fromEntries(fields.map(key=>[key,structuredClone(BUILDER[key])]));
      const text=id=>document.getElementById(id)?.innerText || document.getElementById(id)?.textContent || '';
      const build={schema:1,id:previous.id||crypto.randomUUID(),name:name.trim()||previous.name||BUILDER.championData.name+' build',savedAt:new Date().toISOString(),version:BUILDER.version,championName:BUILDER.championData.name,state,comboSteps:page.combo?.snapshot(),gold:text('buildGoldCost'),itemNames:Object.fromEntries(BUILDER.itemSlots.filter(Boolean).map(id=>[id,BUILDER.items[id]?.name||id])),stats:text('statsTable'),runes:text('runePanel'),abilitySummary:[...document.querySelectorAll('#abilityCards [data-ability-slot]')].filter(c=>c.dataset.abilitySlot!=='attack').map(c=>({slot:c.dataset.abilitySlot,icon:c.querySelector('img')?.getAttribute('src'),name:c.querySelector('.ability-head strong')?.textContent,damage:c.querySelector('.ability-damage-summary')?.textContent||'See Builder',rank:BUILDER.abilityRanks[c.dataset.abilitySlot]})),abilities:text('abilityCards'),attack:text('attackSummary'),combo:text('comboSequence')+'\n'+text('comboResult')};

 const evaluation=page.inspect.builderEvaluation(),computed=evaluation.stats.computeDerivedBuildStats(),attack=evaluation.stats.computeAutoAttackProfile(computed),summary=evaluation.stats.summary(computed);
 build.metrics={...Object.fromEntries(Object.entries(computed).filter(([,v])=>Number.isFinite(v))),lifeSteal:summary.lifeSteal,tenacity:summary.tenacity,attackDamage:attack.autoAttackDamage,dps:attack.attackDps,comboDamage:page.combo.result().total,cost:BUILDER.itemSlots.reduce((sum,id)=>sum+(BUILDER.items[id]?.gold?.total||0),0)};
 const result=page.combo.result();
 build.combo=text('comboSequence')+'\nTotal damage: '+result.total.toFixed(1)+'\nMinimum time: '+result.duration.toFixed(2)+' s'+([...result.damageWarnings,...result.timeWarnings].length?'\n'+[...result.damageWarnings,...result.timeWarnings].join('\n'):'');
 build.runeNames=[...state.runeSelections.primary,...state.runeSelections.secondary,...state.runeSelections.shards].map(id=>page.runes.runeLookup[id]?.name||id);
 build.attackNotes=attack.warnings;
 return {...previous,...build};
}
export async function restoreBuild(page,root,build) {
 const state=page.state,view=page.inspect;
 root.querySelector('#builderLevel').value=build.state.level;
 await view.setChampion(build.state.selectedChampion);
 if(state.selectedChampion!==build.state.selectedChampion)throw new Error('Champion could not be loaded.');
 for(const key of fields.filter(k=>k!=='selectedChampion'))if(build.state[key]!==undefined)state[key]=structuredClone(build.state[key]);
 view.enforceAbilityRules();view.renderItemSlots();view.renderRunePanel();view.renderStats();view.renderAbilityCards();
 root.querySelector('#builderLevel').value=state.level;root.querySelector('#gameTime').value=state.gameTimeMinutes;
 page.combo.restore(build.comboSteps||[]);
 root.querySelectorAll('details').forEach(el=>el.open=false);
}
