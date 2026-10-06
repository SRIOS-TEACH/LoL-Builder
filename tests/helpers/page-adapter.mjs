/** Test-only compatibility names backed by the same native exports as production. */
export function createPageAdapter(page,services,{resolve}={}) {
 const evaluate=()=>page.inspect.builderEvaluation();
 const adapter={...services.TextValues,...services.ChampionSource,...services.RuneSource,...services.AbilityPresentation,...page.inspect};
 for(const name of Object.keys(evaluate().stats))if(typeof evaluate().stats[name]==='function')adapter[name]=(...args)=>evaluate().stats[name](...args);
 for(const name of Object.keys(evaluate().resolution))if(typeof evaluate().resolution[name]==='function')adapter[name]=(...args)=>evaluate().resolution[name](...args);
 adapter.resolveAbilityToken=(...args)=>services.AbilityPresentation.legacyToken(evaluate().resolution.resolveAbilityToken(...args));
 const presentation=()=>{const e=evaluate();return services.AbilityPresentation.create(e.state,e.stats,e.resolution,(...args)=>(resolve||adapter.resolveAbilityToken)(...args));};
 for(const name of ['buildDetailedPassiveText','buildDetailedAbilityText','abilityEffectValues'])adapter[name]=(...args)=>presentation()[name](...args);
 adapter.abilityMaxByLevel=services.AbilityRules.abilityMaxByLevel;
 return adapter;
}
