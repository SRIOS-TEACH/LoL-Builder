import RecordValues from '../core/records.js';
import AbilityRules from '../shared/abilityRules.js';
/**
 * Saveable build inputs and immutable inventory/champion transitions.
 * @typedef {Object} BuildInputsRecord
 * @property {string} selectedChampion Stable Data Dragon champion ID.
 * @property {number} level Champion level; role cap is separate from ordinary skill budget.
 * @property {{q:number,w:number,e:number,r:number}} abilityRanks
 * @property {string[]} itemSlots Six regular slots, quest slot, and optional Bot boots slot.
 * @property {Object} runeSelections Paths, primary/secondary choices and shards.
 * @property {Object<string, unknown>} combatValues Build-specific explicit conditions/counters.
 * @property {Object<string, boolean>} disabledItemPassives
 * @property {Object<string, unknown>} runeStacks
 */

const values=RecordValues;
const ranks=AbilityRules;
const defaults=()=>({selectedChampion:'',level:1,abilityRanks:{q:0,w:0,e:0,r:0},itemSlots:Array(7).fill(''),runeSelections:{primaryPath:'',secondaryPath:'',primary:[],secondary:[],shards:['adaptive-force','adaptive-force','scaling-health']},combatValues:{},disabledItemPassives:{},runeStacks:{}});
function readBuildInputs(state={}) {
 const next=defaults();
 for(const key of Object.keys(next))if(state[key]!==undefined)next[key]=values.copyRecord(state[key]);
 next.abilityRanks={...defaults().abilityRanks,...next.abilityRanks};
 next.runeSelections={...defaults().runeSelections,...next.runeSelections};
 return next;
}
function roleLevelCap(inputs) {return inputs.itemSlots[6]==='1200'?20:18;}
function isBoot(id,{items,midBootIds=[]}) {return !!items[id]?.tags?.includes('Boots')||new Set(midBootIds).has(id);}
function eligibility(inputs,id,slot,data) {
 const quests=new Set(data.questItemIds),mid=new Set(data.midBootIds);
 if(!data.items[id])return {allowed:false,reason:'Item is unavailable.'};
 const allowed=slot===6?quests.has(id):!quests.has(id)&&(!mid.has(id)||inputs.itemSlots[6]==='1201')&&(slot===7?inputs.itemSlots[6]==='1202'&&isBoot(id,data):!(inputs.itemSlots[6]==='1202'&&isBoot(id,data)));
 return {allowed,reason:allowed?'':'Item is not allowed in this role or slot.'};
}
function createBuildInputs(initial={}) {
 const inputs=readBuildInputs(initial);
 inputs.level=Math.max(1,Math.min(roleLevelCap(inputs),Math.floor(Number(inputs.level)||1)));
 inputs.abilityRanks=ranks.enforceAbilityRules(inputs.level,inputs.abilityRanks);
 return inputs;
}
function transitionInventory(inputs,slot,id,data) {
 const next=readBuildInputs(inputs);
 if(!Number.isInteger(slot)||slot<0||slot>=next.itemSlots.length)return {accepted:false,reasonCode:'invalid-slot',reason:'Invalid inventory slot.'};
 if(id&&!eligibility(next,id,slot,data).allowed)return {accepted:false,reasonCode:'ineligible',reason:eligibility(next,id,slot,data).reason};
 const boot=item=>isBoot(item,data),mid=new Set(data.midBootIds);
 if(slot===6){
  if(next.itemSlots[7]&&id!=='1202'){
   const free=next.itemSlots.slice(0,6).findIndex(item=>!item);
   if(free<0)return {accepted:false,reasonCode:'inventory-full',reason:'Free a regular item slot before changing the Bot quest.'};
   next.itemSlots[free]=next.itemSlots[7];
  }
  next.itemSlots[6]=id;
  if(id==='1202'){
   next.itemSlots[7]=next.itemSlots[7]||'';
   const old=next.itemSlots.slice(0,6).findIndex(boot);
   if(old>=0&&!next.itemSlots[7]){next.itemSlots[7]=next.itemSlots[old];next.itemSlots[old]='';}
  }else next.itemSlots.length=7;
  if(id!=='1201')next.itemSlots=next.itemSlots.map(item=>mid.has(item)?(data.items[item].from?.find(boot)||''):item);
  next.level=Math.min(next.level,roleLevelCap(next));
  next.abilityRanks=ranks.enforceAbilityRules(next.level,next.abilityRanks);
 }else next.itemSlots[slot]=id;
 return {accepted:true,inputs:next};
}
function transitionChampion(inputs,id,level=inputs.level) {
 const next=readBuildInputs(inputs);
 next.selectedChampion=id;next.level=level;next.combatValues={};next.abilityRanks={q:0,w:0,e:0,r:0};
 next.abilityRanks=ranks.enforceAbilityRules(next.level,next.abilityRanks);
 return next;
}
const api={createBuildInputs,readBuildInputs,roleLevelCap,isBoot,eligibility,transitionInventory,transitionChampion};const exportedApi = api;

export default exportedApi;
