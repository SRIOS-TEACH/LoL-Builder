# Architecture

This is a static HTML/CSS/JavaScript app with no production dependencies. Root pages and their JS, CSS and assets can be served directly. A dependency-free copy step generates preview and deployment output from that single source; see [delivery](REFACTOR-PHASE2.md).

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

## Extracted reusable capabilities

JS/data owns source loading, provenance and champion/item/rune normalization. JS/domain owns catalog queries, recommendations and build/rune/scenario inputs. JS/application/catalogSession.js provides independent browsing sessions. JS/core contains the shared record/text operations used by these consumers. Inputs and queries are separate from read-only source catalogs. The Builder and dormant lookup controllers call these capabilities through compatibility adapters; calculation and UI extraction are still planned. See [contracts, composition and current limits](REFACTOR-PHASE3.md).
