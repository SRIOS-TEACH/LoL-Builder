/** Independent browsing/query/inspection state, without a Builder or DOM. */
(function(scope){
const queries=scope.CatalogQueries || (typeof require==='function'?require('../domain/catalogQueries.js'):null);
const values=scope.RecordValues || (typeof require==='function'?require('../core/records.js'):null);
function createCatalogSession({catalog,kind,loadDetail}) {
 let query={},selectedId=null,detail=null,requestId=0;
 const run=kind==='champion'?queries.queryChampions:queries.queryItems;
 function search(next={}) {query=values.copyRecord({...next,tags:[...(next.tags||[])],maps:next.maps==null?null:[...next.maps],recommended:next.recommended==null?null:[...next.recommended]});return run(catalog.records,query);}
 async function inspect(id) {
  const ticket=++requestId;
  if(id===null){selectedId=null;detail=null;return {current:true,detail:null};}
  try{
   const loaded=loadDetail?await loadDetail(id):catalog.records[id];
   if(ticket!==requestId)return {current:false};
   if(!loaded)throw new Error('Record is unavailable.');
   selectedId=id;detail=loaded;return {current:true,detail};
  }catch(error){return ticket===requestId?{current:true,error}:{current:false};}
 }
 function snapshot(){return {query:values.copyRecord(query),selectedId,detail,source:catalog.source};}
 function dispose(){requestId++;selectedId=null;detail=null;}
 return {search,inspect,snapshot,dispose};
}
const api={createCatalogSession};scope.CatalogSessions=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);