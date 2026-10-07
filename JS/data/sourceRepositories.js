import RecordValues from '../core/records.js';
import ChampionSource from './championSource.js';
import ItemSource from './itemSource.js';
import ApiClient from '../shared/apiClient.js';
import BuildStats from '../shared/buildStats.js';
/** Source transport/provenance only. Each repository keeps a selected data revision. */

const records=RecordValues;
const itemSource=ItemSource;
const championSource=ChampionSource;
function createRepository({api=ApiClient,statsAdapter=BuildStats}={}) {
 let revision=null, advancedItems=null, advancedRequest=null;
 const dd=(version,kind)=>({provider:'DataDragon',version,language:'en_US',url:'https://ddragon.leagueoflegends.com/cdn/'+version+'/data/en_US/'+kind+'.json',immutable:true});
 const cd=url=>({provider:'CommunityDragon',revision:'latest',immutable:false,url});
 const freeze=records.deepFreeze;
 async function selectedVersion(version) {
  const selected=version || revision || await api.fetchLatestVersion();revision=selected;return selected;
 }
 async function loadChampionCatalog(version) {
  const selected=await selectedVersion(version),payload=await api.fetchChampionIndex(selected);
  if(!payload?.data)throw new Error('Champion catalog is incomplete');
  return freeze({records:payload.data,source:dd(selected,'champion')});
 }
 async function loadItemCatalog(version) {
  const selected=await selectedVersion(version),payload=await api.fetchItemIndex(selected);
  if(!payload?.data)throw new Error('Item catalog is incomplete');
  return freeze({records:payload.data,source:dd(selected,'item')});
 }
 async function loadCatalogs(version) {
  const selected=await selectedVersion(version);
  const [champions,items]=await Promise.all([loadChampionCatalog(selected),loadItemCatalog(selected)]);
  return freeze({version:selected,champions,items});
 }
 async function loadRunes(version) {
  return freeze({records:await api.fetchRunesReforged(version),source:dd(version,'runesReforged')});
 }
 async function loadChampionDetails(version,id) {
  const payload=await api.fetchChampionDetails(version,id);
  const champion=payload?.data?.[id];
  if(!champion)throw new Error('Champion data is incomplete');
  return freeze({record:champion,source:dd(version,'champion/'+id)});
 }
 async function loadChampion(version,id) {
  const [detail,raw]=await Promise.all([loadChampionDetails(version,id),api.fetchCommunityDragonChampion(id).catch(()=>null)]);
  const prepared=championSource.prepareChampion(detail.record,raw,id,statsAdapter);
  return freeze({...prepared,sources:[detail.source,{...cd('https://raw.communitydragon.org/latest/game/data/characters/'+id.toLowerCase()+'/'+id.toLowerCase()+'.bin.json'),status:raw?'ready':'unavailable'}]});
 }
 function loadAdvancedItems() {
  if(advancedItems)return Promise.resolve(advancedItems);
  if(advancedRequest)return advancedRequest;
  const source=cd('https://raw.communitydragon.org/latest/game/items.cdtb.bin.json');
  advancedRequest=Promise.resolve().then(()=>api.fetchCommunityDragonItems()).then(payload=>{
   advancedItems=freeze({status:'ready',records:itemSource.indexAdvancedItems(payload),source});
   return advancedItems;
  }).catch(()=>freeze({status:'unavailable',records:{},source})).finally(()=>{advancedRequest=null;});
  return advancedRequest;
 }
 async function loadLocalization() {
  const source=cd('https://raw.communitydragon.org/latest/game/en_us/data/menu/en_us/lol.stringtable.json');
  try {
   const payload=await api.fetchJson(source.url);
   if(!payload?.entries)throw new Error('Game descriptions unavailable');
   return freeze({status:'ready',entries:payload.entries,source});
  } catch {return freeze({status:'unavailable',entries:null,source});}
 }
 return {loadCatalogs,loadChampionCatalog,loadItemCatalog,loadRunes,loadChampionDetails,loadChampion,loadAdvancedItems,loadLocalization};
}
const api={createRepository};const exportedApi = api;

export default exportedApi;
