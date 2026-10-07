const {createPageAdapter}=require('./page-adapter.mjs');
// Native modules remain private in production; aliases exist only inside test contexts.
const path=require('node:path'),vm=require('node:vm');
const modules={
  "CatalogSessions": "JS/application/catalogSession.js",
  "RecordValues": "JS/core/records.js",
  "TextValues": "JS/core/text.js",
  "ChampionSource": "JS/data/championSource.js",
  "ItemSource": "JS/data/itemSource.js",
  "RuneSource": "JS/data/runeSource.js",
  "SourceRepositories": "JS/data/sourceRepositories.js",
  "BuildInputs": "JS/domain/buildInputs.js",
  "CatalogQueries": "JS/domain/catalogQueries.js",
  "Recommendations": "JS/domain/recommendations.js",
  "RuneInputRules": "JS/domain/runeInputs.js",
  "ScenarioInputs": "JS/domain/scenarioInputs.js",
  "AbilityResolution": "JS/engine/abilityResolution.js",
  "BuildEvaluation": "JS/engine/buildEvaluation.js",
  "CalculationContext": "JS/engine/calculationContext.js",
  "CalculationPipeline": "JS/engine/calculationPipeline.js",
  "CombatContext": "JS/engine/combatContext.js",
  "ComboEvaluation": "JS/engine/comboEvaluation.js",
  "ItemEvaluation": "JS/engine/itemEvaluation.js",
  "AbilityPresentation": "JS/presentation/abilityPresentation.js",
  "DamagePresentation": "JS/presentation/damagePresentation.js",
  "AbilityDps": "JS/shared/abilityDps.js",
  "AbilityOnHit": "JS/shared/abilityOnHit.js",
  "AbilityRules": "JS/shared/abilityRules.js",
  "ApiClient": "JS/shared/apiClient.js",
  "AttackChampions": "JS/shared/attackChampions.js",
  "AttackEffects": "JS/shared/attackEffects.js",
  "BuildStats": "JS/shared/buildStats.js",
  "Calculations": "JS/shared/calculations.js",
  "ChampionEffects": "JS/shared/championEffects.js",
  "CombatInputs": "JS/shared/combatInputs.js",
  "ComboTester": "JS/shared/comboTester.js",
  "DamageText": "JS/shared/damageText.js",
  "ItemLookupShared": "JS/shared/itemData.js",
  "ItemDescriptions": "JS/shared/itemDescriptions.js",
  "ItemPolicy": "JS/shared/itemPolicy.js",
  "RuneEffects": "JS/shared/runeEffects.js",
  "TargetDamage": "JS/shared/targetDamage.js"
};
function loadCapabilities(root) {
 return Object.fromEntries(Object.entries(modules).map(([name,file])=>[name,require(path.join(root,file)).default]));
}
function createTestContext({root,fetchImpl=async()=>({ok:true,json:async()=>({})})}) {
 const services=loadCapabilities(root);
 const api=require(path.join(root,'JS/shared/apiClient.js')).createApiClient(fetchImpl);
 const repository=services.SourceRepositories.createRepository({api});
 const itemLookup=require(path.join(root,'JS/shared/itemData.js')).createItemLookup({repository});
 const page=require(path.join(root,'JS/application/builderPage.mjs')).createBuilderPage({api,repository,itemLookup});
 let context;const adapter=createPageAdapter(page,services,{resolve:(...args)=>context.resolveAbilityToken(...args)});
 context=vm.createContext({...services,...adapter,ApiClient:api,ItemLookupShared:itemLookup,BUILDER:page.state,RUNE_DATA:page.runes,console});
 context.window=context;context.run=code=>vm.runInContext(code,context);
 return context;
}
async function installBrowserHarness(page,root) {
 const fs=require('node:fs');
 await page.route('**/JS/builder.js',async route=>{
  let entry=fs.readFileSync(path.join(root,'JS/builder.js'),'utf8').replace('await builderPage.start();','');
  entry+='\nconst testServices={};\n';
  for(const [name,file]of Object.entries(modules))entry+=`testServices.${name}=(await import('./${file.slice(3)}')).default;\n`;
  entry+='const createPageAdapter='+createPageAdapter.toString()+';\n';
  entry+='Object.assign(globalThis,testServices,createPageAdapter(builderPage,testServices,{resolve:(...args)=>globalThis.resolveAbilityToken(...args)}),{BUILDER:builderPage.state,RUNE_DATA:builderPage.runes,ItemLookupShared:builderPage.inspect.getItemLookupShared()});\nawait builderPage.start();\n';
  await route.fulfill({contentType:'text/javascript',body:entry});
 });
}
module.exports={loadCapabilities,createTestContext,installBrowserHarness};
