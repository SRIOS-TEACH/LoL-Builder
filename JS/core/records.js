
/** Clone/freeze plain source and input records; no feature defaults. */

function copyRecord(value) {
 if(Array.isArray(value)) return value.map(copyRecord);
 if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,copyRecord(entry)]));
 return value;
}
function deepFreeze(value) {
 if(value && typeof value==='object' && !Object.isFrozen(value)) {
  Object.freeze(value); Object.values(value).forEach(deepFreeze);
 }
 return value;
}
const api={copyRecord,deepFreeze};const exportedApi = api;

export default exportedApi;
