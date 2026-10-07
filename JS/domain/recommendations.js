
/** Pure rules with explicit data and input records. */

function getRecommendedItems(raw, { mapId = 11, mode = 'CLASSIC', items = {} } = {}) {
  const starting = new Set(), core = new Set();
  const add = (target, refs) => {
    for (const ref of refs || []) {
      const id = typeof ref === 'string' ? ref.match(/^Items\/(\d+)$/i)?.[1] : null;
      if (id && Object.prototype.hasOwnProperty.call(items, id)) target.add(id);
    }
  };
  for (const record of Object.values(raw || {})) {
    if (record?.__type !== 'ItemRecommendationOverrideSet') continue;
    for (const override of record.mOverrides || []) {
      if (!(override.mOverrideContexts || []).some(context =>
        Number(context.mMapID) === Number(mapId) && context.mModeNameStringId === mode)) continue;
      for (const bundle of override.StartingItemBundles || []) add(starting, bundle.items);
      for (const range of override.mRecItemRanges || []) add(core, range.items);
    }
  }
  return { starting: [...starting], core: [...core] };
}

function recommendedItemIds(raw,champion,items) {
  const source=getRecommendedItems(raw,{mapId:11,mode:'CLASSIC',items});
  const ids=new Set([...(source?.starting||[]),...(source?.core||[])]);
  for(const set of champion?.recommended||[]) {
    if(set.map && !['SR','11'].includes(String(set.map))) continue;
    for(const block of set.blocks||[])for(const item of block.items||[])if(items[String(item.id)]) ids.add(String(item.id));
  }
  return ids;
}


const api={getRecommendedItems, recommendedItemIds};const exportedApi = api;

export default exportedApi;
