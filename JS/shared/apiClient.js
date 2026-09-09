/**
 * Shared API client helpers for Data Dragon / Community Dragon fetches.
 */
(function initApiClient(globalScope) {
  const requests = new Map();
  function fetchJson(url) {
    if (requests.has(url)) return requests.get(url);
    const request = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
        return await response.json();
      } finally {
        clearTimeout(timer);
      }
    })();
    requests.set(url, request);
    request.catch(() => requests.delete(url));
    return request;
  }

  async function fetchLatestVersion() {
    const versions = await fetchJson("https://ddragon.leagueoflegends.com/api/versions.json");
    if (!Array.isArray(versions) || typeof versions[0] !== 'string' || !versions[0]) {
      throw new Error('The game version list is empty or invalid.');
    }
    return versions[0];
  }

  function fetchChampionIndex(version) {
    return fetchJson(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
  }

  function fetchChampionDetails(version, championName) {
    return fetchJson(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${championName}.json`);
  }

  function fetchItemIndex(version) {
    return fetchJson(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`);
  }

  function fetchRunesReforged(version) {
    return fetchJson(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`);
  }

  function fetchCommunityDragonItems() {
    return fetchJson("https://raw.communitydragon.org/latest/game/items.cdtb.bin.json");
  }

  function fetchCommunityDragonChampion(championName) {
    const path = String(championName).toLowerCase();
    return fetchJson(`https://raw.communitydragon.org/latest/game/data/characters/${path}/${path}.bin.json`);
  }

  const api = {
    fetchJson,
    fetchLatestVersion,
    fetchChampionIndex,
    fetchChampionDetails,
    fetchItemIndex,
    fetchCommunityDragonChampion,
    fetchCommunityDragonItems,
    fetchRunesReforged,
  };

  globalScope.ApiClient = api;
})(typeof window !== "undefined" ? window : globalThis);
