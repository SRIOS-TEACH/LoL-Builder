/**
 * Shared API client helpers for Data Dragon / Community Dragon fetches.
 */
(function initApiClient(globalScope) {
  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
    return response.json();
  }

  async function fetchLatestVersion() {
    const versions = await fetchJson("https://ddragon.leagueoflegends.com/api/versions.json");
    return Array.isArray(versions) ? versions[0] : "";
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

  const api = {
    fetchJson,
    fetchLatestVersion,
    fetchChampionIndex,
    fetchChampionDetails,
    fetchItemIndex,
    fetchRunesReforged,
    fetchCommunityDragonItems,
  };

  globalScope.ApiClient = api;
})(typeof window !== "undefined" ? window : globalThis);
