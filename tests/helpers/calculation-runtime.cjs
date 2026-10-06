// Load only reusable capabilities. No window, document, fetch or Builder adapter.
const path=require('node:path');
const root=process.env.APP_ROOT || path.join(__dirname,'../..');
for(const name of ['core/records','core/text','shared/abilityRules','domain/scenarioInputs','domain/buildInputs',
 'shared/targetDamage','shared/calculations','shared/buildStats','shared/runeEffects','shared/championEffects',
 'shared/attackEffects','shared/attackChampions','shared/abilityDps','shared/abilityOnHit','shared/comboTester',
 'data/championSource','data/itemSource','data/runeSource','engine/combatContext','engine/calculationContext',
 'engine/buildEvaluation','engine/abilityResolution','engine/itemEvaluation','engine/calculationPipeline','engine/comboEvaluation'])
 require(path.join(root,'JS',name+'.js'));
module.exports={pipeline:globalThis.CalculationPipeline,combo:globalThis.ComboEvaluation,
 items:globalThis.ItemEvaluation,builds:globalThis.BuildInputs,source:globalThis.ChampionSource};
