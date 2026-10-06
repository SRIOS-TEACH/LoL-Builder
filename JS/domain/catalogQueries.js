import TextValues from '../core/text.js';
import ItemPolicy from '../shared/itemPolicy.js';
/** Catalog filtering returns IDs without changing source records or build selection. */

const policy=ItemPolicy;
const text=TextValues;
const midBootIds=['3170','3171','3172','3173','3174','3175','3176'];
function builderCatalog(items) {
 const entries=policy.dedupeByNameWithMapPriority(Object.entries(items).filter(([id,item])=>policy.isPurchasableItem(id,item)&&item.maps?.[11]),new Set([11]));
 const quests=Object.entries(items).filter(([id])=>/^120[0-4]$/.test(id));
 const boots=Object.entries(items).filter(([id])=>midBootIds.includes(id));
 for(const entry of [...boots,...quests])if(!entries.some(([id])=>id===entry[0]))entries.push(entry);
 return {items:Object.fromEntries(entries),midBootIds:boots.map(([id])=>id),questItemIds:quests.map(([id])=>id)};
}
function queryChampions(champions,{search='',tags=[],searchBy='id'}={}) {
 const needle=text.searchText(search), selected=[...tags];
 return Object.keys(champions).filter(id=>{
  const record=champions[id],name=searchBy==='name'?record.name:id;
  return (!needle||String(name).toLowerCase().includes(needle))&&selected.every(tag=>record.tags?.includes(tag));
 }).sort((a,b)=>a.localeCompare(b));
}
function matchesShopStat(id,item,tag,boots=[]) {
 const aliases={AbilityHaste:['AbilityHaste','CooldownReduction'],Mana:['Mana','ManaRegen'],Health:['Health','HealthRegen'],SpellBlock:['SpellBlock','MagicResist'],LifeSteal:['LifeSteal','SpellVamp'],NonbootsMovement:['NonbootsMovement','Boots']};
 if(tag==='LifeSteal'&&['PercentLifeStealMod','PercentPhysicalVampMod','PercentOmnivampMod'].some(key=>Number(item.stats?.[key])>0))return true;
 return (aliases[tag]||[tag]).some(value=>item.tags?.includes(value))||(tag==='NonbootsMovement'&&boots.includes(id));
}
function queryItems(items,{search='',tags=[],maps=null,purchasable=false,dedupe=false,sort='name',eligible=()=>true,recommended=null,roleValue=null,advanced={},shopTags=false,midBootIds=[]}={}) {
 const needle=text.searchText(search),selected=[...tags],selectedMaps=maps===null?null:new Set(maps),recommendationIds=recommended===null?null:new Set(recommended);
 let entries=Object.entries(items).filter(([id,item])=>eligible(id)&&(!purchasable||policy.isPurchasableItem(id,item)))
  .filter(([,item])=>selectedMaps===null||[...selectedMaps].some(id=>item.maps?.[id]))
  .filter(([id,item])=>(!recommendationIds||recommendationIds.has(id))&&(!roleValue||advanced[id]?.mItemAttributes?.includes(roleValue)))
  .filter(([id,item])=>(!needle||item.name.toLowerCase().includes(needle))&&selected.every(tag=>shopTags?matchesShopStat(id,item,tag,midBootIds):item.tags?.includes(tag)));
 if(dedupe)entries=policy.dedupeByNameWithMapPriority(entries,selectedMaps||new Set([11]));
 return entries.sort((a,b)=>(sort==='price'?(a[1].gold?.total||0)-(b[1].gold?.total||0):0)||a[1].name.localeCompare(b[1].name)).map(([id])=>id);
}
const api={builderCatalog,queryChampions,queryItems,matchesShopStat};const exportedApi = api;

export default exportedApi;
