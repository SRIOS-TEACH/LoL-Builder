const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.APP_ROOT || path.join(__dirname, '..');

function app(fetchImpl) {
  const context = vm.createContext({ fetch: fetchImpl, AbortController, setTimeout, clearTimeout, console: { warn() {} } });
  context.window = context;
  for (const file of ['apiClient', 'itemPolicy', 'itemData']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'JS/shared', file + '.js'), 'utf8'), context);
  }
  return context;
}

test('versioned picker indexes reuse disk cache without pinning latest game data', async () => {
  const calls = [];
  const c = app(async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({}) }; });
  await Promise.all([c.ApiClient.fetchItemIndex('16.18.1'), c.ApiClient.fetchChampionIndex('16.18.1'), c.ApiClient.fetchCommunityDragonItems()]);
  assert.deepEqual(calls.map(call => call.options.cache), ['force-cache', 'force-cache', 'default']);
});

test('concurrent item hydration shares one request and indexes only after completion', async () => {
  let complete, calls = 0;
  const payload = { 'Items/3006': { itemID: 3006, mFlatMovementSpeedMod: 45 }, 'Items/Particles/Effect': {} };
  const c = app(async () => { calls++; await new Promise(resolve => { complete = resolve; }); return { ok: true, json: async () => payload }; });
  const first = c.ItemLookupShared.loadCommunityDragonCalcs();
  const second = c.ItemLookupShared.loadCommunityDragonCalcs();
  assert.equal(first, second);
  assert.equal(c.ItemLookupShared.getState().status, 'loading');
  assert.deepEqual(Object.keys(c.ItemLookupShared.getState().cdragonById), []);
  await Promise.resolve();
  complete();
  assert.equal(await first, true);
  assert.equal(c.ItemLookupShared.getState().status, 'ready');
  assert.deepEqual(Object.keys(c.ItemLookupShared.getState().cdragonById), ['3006']);
  assert.equal(c.ItemLookupShared.getState().cdragonById['3006'], payload['Items/3006']);
  await c.ItemLookupShared.loadCommunityDragonCalcs();
  assert.equal(calls, 1);
});

test('a failed optional item download can retry instead of freezing picker hydration', async () => {
  let calls = 0;
  const c = app(async () => {
    if (++calls === 1) throw new Error('temporary network failure');
    return { ok: true, json: async () => ({ 'Items/3006': { itemID: 3006 } }) };
  });
  assert.equal(await c.ItemLookupShared.loadCommunityDragonCalcs(), false);
  assert.equal(c.ItemLookupShared.getState().status, 'unavailable');
  assert.equal(await c.ItemLookupShared.loadCommunityDragonCalcs(), true);
  assert.equal(calls, 2);
});

test('recommendations use matching game mode and omit unavailable IDs without mutating source', () => {
  const c = app();
  // Shape and IDs from Aurora's ItemRecommendationOverrideSet in patch 16.18.
  const raw = { '{59689bee}': { __type: 'ItemRecommendationOverrideSet', mOverrides: [
    { mOverrideContexts: [{ mMapID: 11, mModeNameStringId: 'CLASSIC' }],
      StartingItemBundles: [{ items: ['Items/1056', 'Items/2003', 'Items/2003'] }, { items: ['Items/2033'] }],
      mRecItemRanges: [{ items: ['Items/6653', 'Items/6657', 'Items/4633'] }, { items: ['Items/3020', 'Items/6653'] }] },
    { mOverrideContexts: [{ mMapID: 11, mModeNameStringId: 'SWIFTPLAY' }], mRecItemRanges: [{ items: ['Items/4645'] }] },
    { mOverrideContexts: [{ mMapID: 30, mModeNameStringId: 'cherry' }], mRecItemRanges: [{ items: ['Items/223020'] }] },
  ] } };
  const snapshot = JSON.stringify(raw);
  const items = Object.fromEntries(['1056', '2003', '6653', '4633', '3020', '4645', '223020'].map(id => [id, {}]));
  const recommended = c.ItemLookupShared.getRecommendedItems(raw, { items });
  assert.deepEqual(Array.from(recommended.starting), ['1056', '2003']);
  assert.deepEqual(Array.from(recommended.core), ['6653', '4633', '3020']);
  assert.deepEqual(Array.from(c.ItemLookupShared.getRecommendedItems(raw, { items, mode: 'SWIFTPLAY' }).core), ['4645']);
  assert.deepEqual(Array.from(c.ItemLookupShared.getRecommendedItems(raw, { items, mapId: 12 }).core), []);
  assert.equal(JSON.stringify(raw), snapshot);
});
