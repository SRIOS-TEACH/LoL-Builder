import SavedBuilds from '../shared/savedBuilds.js';
/* Persistence stays independent of API payloads and derived calculation state. */
export async function initSavedBuildControls(page) {
  const BUILDER=page.state;
  const {setChampion,enforceAbilityRules,renderItemSlots,renderRunePanel,renderStats,renderAbilityCards}=page.inspect;
  const button=document.getElementById('saveBuild'),status=document.getElementById('saveStatus');
  let editingId=null;
  const fields=['selectedChampion','level','abilityRanks','itemSlots','combatValues','target','disabledItemPassives','runeStacks','gameTimeMinutes','runeSelections'];
  button.disabled=false;
  button.addEventListener('click',()=>{
    try{
      if(!BUILDER.championData)throw new Error('Choose a champion before saving.');
      const state=Object.fromEntries(fields.map(key=>[key,structuredClone(BUILDER[key])]));
      const text=id=>document.getElementById(id)?.innerText || '';
      const build={schema:1,id:editingId||crypto.randomUUID(),name:document.getElementById('buildName').value.trim()||BUILDER.championData.name+' build',savedAt:new Date().toISOString(),version:BUILDER.version,championName:BUILDER.championData.name,state,comboSteps:page.combo?.snapshot(),gold:text('buildGoldCost'),itemNames:Object.fromEntries(BUILDER.itemSlots.filter(Boolean).map(id=>[id,BUILDER.items[id]?.name||id])),stats:text('statsTable'),runes:text('runePanel'),abilitySummary:[...document.querySelectorAll('#abilityCards [data-ability-slot]')].filter(c=>c.dataset.abilitySlot!=='attack').map(c=>({slot:c.dataset.abilitySlot,icon:c.querySelector('img')?.getAttribute('src'),name:c.querySelector('.ability-head strong')?.textContent,damage:c.querySelector('.ability-damage-summary')?.textContent||'See Builder',rank:BUILDER.abilityRanks[c.dataset.abilitySlot]})),abilities:text('abilityCards'),attack:text('attackSummary'),combo:text('comboSequence')+'\n'+text('comboResult')};
      SavedBuilds.save(build);editingId=build.id;status.textContent='Build saved. Ready to compare.';
    }catch(e){status.textContent='Could not save: '+e.message;}
  });
  const id=new URLSearchParams(location.search).get('build');if(!id)return;
  try{
    const build=SavedBuilds.read().find(b=>b.id===id);if(!build)throw new Error('Saved build was not found.');
    document.getElementById('builderLevel').value=build.state.level;
    await setChampion(build.state.selectedChampion);
    if(BUILDER.selectedChampion!==build.state.selectedChampion)throw new Error('Champion could not be loaded.');
    for(const key of fields.filter(k=>k!=='selectedChampion'))if(build.state[key]!==undefined)BUILDER[key]=structuredClone(build.state[key]);
    enforceAbilityRules();renderItemSlots();renderRunePanel();renderStats();renderAbilityCards();
    document.getElementById('gameTime').value=BUILDER.gameTimeMinutes;
    document.getElementById('targetEnabled').textContent=BUILDER.target.enabled?'On':'Off';document.getElementById('targetEnabled').setAttribute('aria-pressed',String(BUILDER.target.enabled));
    for(const [input,key]of Object.entries({targetMaxHp:'maxHp',targetCurrentHp:'currentHp',targetArmor:'armor',targetMr:'mr',targetDamageReduction:'damageReduction'}))document.getElementById(input).value=BUILDER.target[key];
    page.combo?.restore(build.comboSteps||[]);
    document.getElementById('buildName').value=build.name;editingId=id;
    status.textContent=build.version===BUILDER.version?'Saved build loaded.':`Saved on ${build.version}; recalculated with ${BUILDER.version}.`;
  }catch(e){status.textContent=e.message;}
}
