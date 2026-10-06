/** Formula context from one build/scenario and prepared sources; no page fields or target mutation. */
(function(scope){
function create(state,data){
const advancedItems=data.advancedItems || {};
function baseCalculationContext(stats, dataValues = [], rank = 1, calculations = {}, effects = []) {
  return {
    stats, dataValues, rank, calculations, effects, level: state.level,
    target:state.target, targetStats:scope.TargetDamage.targetStats(state.target), targetFormulaOnly:!state.target.enabled, managedTarget:true, automaticSelfStats:true,
    resolveExternal: (path, key) => {
      const record=scope.Calculations.lookup(state.cdragonRaw,path);
      const payload=scope.ChampionSource.extractCdragonSpell(record);
      return scope.Calculations.dataValue(payload?.dataValues,key,rank,state.level);
    },
    ranged: stats?.ranged ?? (state.championData ? state.championData.stats.attackrange > 300 : undefined),
    itemCounts: state.itemSlots.filter(Boolean).reduce((counts,id) => {
      const rarity=advancedItems[id]?.epicness;
      if (rarity !== undefined) counts[rarity]=(counts[rarity]||0)+1;
      return counts;
    }, {0:0,1:0,2:0,3:0,4:0,5:0,6:0}),
  };
}

function calculationContext(...args) {
  const defaults=Object.fromEntries(scope.ChampionEffects.model(state).fields.filter(f=>f.defaultValue!==undefined).map(f=>[f.key,f.defaultValue]));
  const combatState=Object.fromEntries(Object.entries({...defaults,...state.combatValues}).filter(([key])=>!key.startsWith('target:')&&(!key.startsWith('self:')||key==='self:healthPercent:0')));
  return scope.CombatContext.apply(baseCalculationContext(...args),combatState);
}

return {baseCalculationContext,calculationContext};
}
const CalculationContext={create};scope.CalculationContext=CalculationContext;
if(typeof module!=="undefined")module.exports=CalculationContext;
})(typeof window!=="undefined"?window:globalThis);
