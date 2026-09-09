# Architecture

This is a static HTML/CSS/JavaScript app. No production dependencies or build step are required.

- `JS/shared/apiClient.js`: page-lifetime request cache, concurrent request deduplication, HTTP errors and a 15-second timeout. Failed requests leave the cache so selection can retry.
- `JS/shared/itemPolicy.js`: item eligibility and deterministic map/name deduplication.
- `JS/shared/itemData.js`: optional Community Dragon item index and tooltip/formula formatting. It contains no page controller. Both Builder and Item Lookup load it.
- `JS/shared/buildStats.js`: pure growth, attack-speed and item stat-block parsing helpers.
- `JS/shared/abilityRules.js`: generic Q/W/E/R rank normalization and level budget. Champion-specific rank systems are not yet supported.
- `JS/champLookup.js`, `JS/itemLookup.js`: page-specific state, events and rendering.
- `JS/builder.js`: build state, champion selection, rune selection, derived stats, ability resolution and rendering. The ability resolver remains the largest area needing further decomposition, after captured advanced-data tests are available.

Data Dragon is authoritative for the selected patch's base champion stats. Community Dragon is optional and cannot replace the entire stat object. Cached API payloads must be treated as read-only; selection makes its own champion/stat objects.

Champion selection commits its result only if it is still the latest request. Lookup and preview use the same request-counter pattern. A failed selection keeps the existing build and reports the failure.

The app is a stat sandbox, not a combat simulator. Described passives are not necessarily applied. Unsupported calculations stay unavailable instead of being coerced to zero.
