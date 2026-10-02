/** Pure rules with explicit data and input records. */
(function(scope){
const values=scope.RecordValues || (typeof require==='function'?require('../core/records.js'):null);
function createRules(data) {
function getSecondaryRows(pathId) {
  return (data.paths[pathId]?.primaryRows || []).slice(1);
}

function getSecondaryRowIndex(pathId, runeId) {
  const rows = getSecondaryRows(pathId);
  return rows.findIndex((row) => row.includes(runeId));
}

function getPathPrimaryDefaults(pathId) {
  return (data.pathDefaults[pathId] || []).slice(0, 4);
}

function getPathSecondaryDefaults(pathId) {
  const rows = getSecondaryRows(pathId);
  const first = rows[0]?.[0] || "";
  const second = rows[1]?.[0] || rows[0]?.[1] || first;
  return [first, second];
}

function ensureSecondarySelectionsValid(initial) {
  const selection=values.copyRecord(initial);
  const pathId = selection.secondaryPath;
  const rows = getSecondaryRows(pathId);
  const [first, second] = selection.secondary;
  const firstRow = getSecondaryRowIndex(pathId, first);
  const secondRow = getSecondaryRowIndex(pathId, second);

  if (firstRow < 0) selection.secondary[0] = rows[0]?.[0] || first;
  if (secondRow < 0) selection.secondary[1] = rows[1]?.[0] || rows[0]?.[1] || second;

  const nextFirstRow = getSecondaryRowIndex(pathId, selection.secondary[0]);
  const nextSecondRow = getSecondaryRowIndex(pathId, selection.secondary[1]);
  if (nextFirstRow >= 0 && nextFirstRow === nextSecondRow) {
    const fallback = rows.find((_row, idx) => idx !== nextFirstRow)?.[0];
    selection.secondary[1] = fallback || selection.secondary[1];
  }
  return selection;
}

function applySecondaryRuneSelection(initial,runeId) {
  const selection=values.copyRecord(initial);
  const pathId = selection.secondaryPath;
  const selectedRows = selection.secondary.map((id) => getSecondaryRowIndex(pathId, id));
  const targetRow = getSecondaryRowIndex(pathId, runeId);
  if (targetRow < 0) return selection;

  if (selectedRows[0] === targetRow) {
    selection.secondary[0] = runeId;
    return selection;
  }
  if (selectedRows[1] === targetRow) {
    selection.secondary[1] = runeId;
    return selection;
  }

  // FIFO: slot 0 is oldest branch, slot 1 is newest branch.
  selection.secondary = [selection.secondary[1], runeId];
  return selection;
}

function initialize(initial) {
 const selection=values.copyRecord(initial),ids=Object.keys(data.paths);
 selection.primaryPath=ids[0] || "";
 selection.secondaryPath=ids.find(id=>id!==selection.primaryPath) || selection.primaryPath;
 selection.primary=getPathPrimaryDefaults(selection.primaryPath);
 selection.secondary=getPathSecondaryDefaults(selection.secondaryPath);
 return selection;
}
function applyOption(initial,target,id) {
 const selection=values.copyRecord(initial),[group,index]=target.split("_");
 if(group==="primary")selection.primary[Number(index)]=id;
 if(group==="secondary")return ensureSecondarySelectionsValid(applySecondaryRuneSelection(selection,id));
 if(group==="shard")selection.shards[Number(index)]=id;
 if(group==="primaryPath"){
  selection.primaryPath=id;selection.primary=getPathPrimaryDefaults(id);
  if(selection.secondaryPath===id){
   const fallback=Object.keys(data.paths).find(path=>path!==id)||id;
   selection.secondaryPath=fallback;selection.secondary=getPathSecondaryDefaults(fallback);
  }
 }
 if(group==="secondaryPath"){
  if(id!==selection.primaryPath){selection.secondaryPath=id;selection.secondary=getPathSecondaryDefaults(id);}
  return ensureSecondarySelectionsValid(selection);
 }
 return selection;
}
function choices(selection,target) {
 if(target.startsWith("primaryPath"))return Object.keys(data.paths).map(id=>({id}));
 if(target.startsWith("secondaryPath"))return Object.keys(data.paths).map(id=>({id,disabled:id===selection.primaryPath}));
 if(target.startsWith("primary"))return (data.paths[selection.primaryPath]?.primaryRows?.[Number(target.split("_")[1])] || []).map(id=>({id}));
 if(/^secondary_\d+$/.test(target))return getSecondaryRows(selection.secondaryPath).flatMap((row,rowIndex)=>row.map(id=>({id,rowIndex})));
 const rows=[["adaptive-force","attack-speed","ability-haste"],["adaptive-force","move-speed","scaling-health"],["health","tenacity-slow-resist","scaling-health"]];
 return (rows[Number(target.split("_")[1])] || data.shardOptions || []).map(id=>({id}));
}
function transition(initial,target,id) {
 if(!choices(initial,target).some(option=>option.id===id&&!option.disabled))return {accepted:false,reason:"Rune is not allowed for this selection."};
 return {accepted:true,selection:applyOption(initial,target,id)};
}
function selectOption(initial,target,id) {
 const result=transition(initial,target,id);
 return result.accepted?result.selection:values.copyRecord(initial);
}
return {getSecondaryRows,getSecondaryRowIndex,getPathPrimaryDefaults,getPathSecondaryDefaults,ensureSecondarySelectionsValid,applySecondaryRuneSelection,initialize,selectOption,choices,transition};

}

const api={createRules};scope.RuneInputRules=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
