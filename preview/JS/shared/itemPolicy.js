/**
 * Shared item rules used by Item Lookup and Builder.
 */
(function initItemPolicy(globalScope) {
  const FORCE_INCLUDE_ITEM_IDS = new Set(["3040", "3042", "3121"]);

  const MAP_OPTIONS = [
    { id: 11, label: "Summoners Rift" },
    { id: 12, label: "ARAM" },
    { id: 30, label: "Arena" },
  ];

  function isPurchasableItem(id, item) {
    if (FORCE_INCLUDE_ITEM_IDS.has(String(id))) return true;
    const mapEnabled = Object.values(item.maps || {}).some(Boolean);
    return item.gold?.purchasable && mapEnabled && !item.requiredAlly;
  }

  function dedupeByNameWithMapPriority(itemEntries, selectedMaps = new Set([11])) {
    const selectedOrder = MAP_OPTIONS.map((m) => m.id).filter((id) => selectedMaps.has(id));
    const byName = {};

    const rankItem = (id, item) => {
      const maps = item.maps || {};
      const selectedIdx = selectedOrder.findIndex((mapId) => maps[mapId]);
      const enabledMapCount = Object.values(maps).filter(Boolean).length;
      return {
        selectedIdx: selectedIdx === -1 ? Number.MAX_SAFE_INTEGER : selectedIdx,
        enabledMapCount,
        numericId: Number(id),
      };
    };

    itemEntries.forEach(([id, item]) => {
      const key = String(item.name || "").trim().toLowerCase();
      if (!key) return;
      if (!byName[key]) {
        byName[key] = { id, item };
        return;
      }
      const current = byName[key];
      const incomingRank = rankItem(id, item);
      const currentRank = rankItem(current.id, current.item);
      const better = incomingRank.selectedIdx < currentRank.selectedIdx
        || (incomingRank.selectedIdx === currentRank.selectedIdx && incomingRank.enabledMapCount > currentRank.enabledMapCount)
        || (incomingRank.selectedIdx === currentRank.selectedIdx
          && incomingRank.enabledMapCount === currentRank.enabledMapCount
          && incomingRank.numericId < currentRank.numericId);
      if (better) byName[key] = { id, item };
    });

    return Object.values(byName).map(({ id, item }) => [id, item]);
  }

  const api = {
    MAP_OPTIONS,
    FORCE_INCLUDE_ITEM_IDS,
    isPurchasableItem,
    dedupeByNameWithMapPriority,
  };

  globalScope.ItemPolicy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
