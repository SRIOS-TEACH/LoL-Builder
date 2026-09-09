# Data sources and limits

- [Riot Data Dragon documentation](https://developer.riotgames.com/docs/lol#data-dragon): versions, champion index/details, items, runes and artwork. The audit used `16.17.1`.
- [Community Dragon](https://www.communitydragon.org/): optional `latest/game/items.cdtb.bin.json` and `latest/game/data/characters/{name}/{name}.bin.json`. All 14 advanced endpoints requested for this audit returned HTTP 403 from this environment. Live advanced-data correctness is therefore unverified.
- [Community Dragon calculation guide](https://hextechdocs.dev/resolving-variables-in-spell-textsa/): formula structure and the need to distinguish stat sources and calculation conditions.
- [Champion stat growth reference](https://wiki.leagueoflegends.com/en-us/Champion_statistic): standard level growth uses `(level-1) * (0.7025 + 0.0175 * (level-1))`. This is distinct from linear rune shard scaling. Champion-specific exceptions still require validation.

Data Dragon numeric item stats are incomplete. `BuildStats.itemStatsFromDescription` reads only explicit values inside `<stats>`, then lets numeric catalog fields take priority. It never extracts stats from passive prose.

Community Dragon `latest` is not pinned to the Data Dragon patch. Do not treat cross-source results as a verified game simulation. The next advanced-data pass should capture matching-patch fixtures and check current field formats before expanding supported calculations.
