# Phase 3 — Reusable data, catalog queries and input rules

Work date: 2 October 2026. Status: complete. Functional, baseline and clean-source checks passed.

## Ownership and contracts

| Capability | Entry point | Responsibility |
| --- | --- | --- |
| Source repositories | data/sourceRepositories.js: createRepository({api, statsAdapter}) | Load explicit-version catalogs, basic champion details, optional advanced champion/item records and localization; return provenance and availability. |
| Champion source adapter | data/championSource.js | Interpret character stats, spell records, child selection and aliases using the existing algorithms; prepare a champion from explicit source records and stat adapter. |
| Item source adapter | data/itemSource.js | Index advanced records by stable item ID and prepare copied stat blocks from explicit source inputs. |
| Rune source adapter | data/runeSource.js | Normalize source paths, icons, rune identities/descriptions and path defaults. |
| Catalog queries | domain/catalogQueries.js | Return filtered/sorted stable IDs; retain the full catalog. Builder catalog selection is a separate explicit policy. |
| Recommendations | domain/recommendations.js | Interpret source-provided recommendation groups and preserve the current Data Dragon/Community Dragon union and filtering. |
| Build input rules | domain/buildInputs.js | Construct plain saveable inputs, enforce existing rank/role rules and return independent inventory/champion transitions or rejection reasons. |
| Rune input rules | domain/runeInputs.js | Describe allowed choices and apply path/row/FIFO transitions to copied selection records. |
| Scenario input rules | domain/scenarioInputs.js | Own target and game-time normalization with existing defaults and units. |
| Browsing sessions | application/catalogSession.js | Own a consumer's query and inspected detail; isolate request ordering, failed loads and disposal from other consumers and builds. |
| General record/text helpers | core/records.js, core/text.js | Copy/freeze plain records; preserve the existing text-search, stripped-text and HTML-escaping semantics with real shared callers. |

Paths above are under JS/. These modules load in Node without a page or Builder. Browser script tags and existing global wrappers remain compatibility boundaries until Phase 5's module/entry-point migration. Calculation engines and UI composition remain later phases.

## Data boundaries

A catalog is a read-only record map keyed by source identity plus a source descriptor. The captured item index contains **868 records**; Builder's explicit purchase/map/variant policy retains **236**. Querying does not delete excluded records or equip inspected items. Explorer queries can include non-purchasable and other-map variants. Champion detail loading exposes the full source profile, including lore, skins and basic descriptions, without requesting advanced combat data or item catalogs.

Repositories accept an injected transport and stat adapter. Each repository retains its selected Data Dragon version after discovery; explicit version arguments remain available. Both catalogs in a combined snapshot use one selected revision. Data Dragon metadata records provider, version, language and request URL. Optional Community Dragon metadata identifies the actual latest URL, its mutable revision label and ready/unavailable status where applicable. No new patch pinning or inferred historical Community Dragon revision has been introduced.

ApiClient retains its cache/coalescing, timeout, versioned HTTP-cache policy and failed-request retry. Cached JSON is now recursively read-only. Prepared mutable input records and derived item/champion stat blocks are separate from source payloads. Optional item indexing has moved to the repository; ItemLookupShared retains its existing boolean-loading/status API for current consumers.

Basic champion/item loading, advanced record interpretation, query/inspection and equipment transitions are separate operations. Builder's champion modal, main selection and dormant lookup consumer retain their individual latest-request checks; reusable browsing sessions provide the same isolation for future consumers.

## Input ownership and compatibility

BuildInputs uses current stable field names: selectedChampion, level, abilityRanks, itemSlots, runeSelections, combatValues, disabledItemPassives and runeStacks. Those inputs contain no DOM, source cache, prepared champion payload or query state. ScenarioInputs owns target and gameTimeMinutes. Unknown combat/counter values are retained; they are not converted to invented numeric values.

Inventory transitions preserve the existing role quest slot, Bot boots relocation/full-inventory rejection, Mid boots downgrade and Top level cap. Ordinary ability budgets remain capped at level 18. Rune rules retain path exclusions, allowed shard rows, distinct secondary branches and FIFO replacement. The Builder applies returned records and then renders; the reusable rule does not render or close a modal.

The current Builder still exposes its flat compatibility state to existing calculations. This phase does not claim to have isolated the full evaluation pipeline: the global target swap in combo simulation and calculation/UI separation remain Phase 4 work. The complete explorer/comparison pages remain later features.

Champion source parsing was extracted without changing its existing child scoring, root preference, alias precedence or stat fallback behavior. Formula/token evaluation and localization expansion remain in the current calculation controller for Phase 4. The stale ability audit and unresolved passive-token baseline exceptions remain open.

HTML escaping is shared only between ItemDescriptions and DamageText, whose nullish-input semantics match. Builder/Combo wrappers with different coercion remain unchanged. Stripping source tags creates display text; it does not replace HTML sanitization.

## Reuse harness and verification

Run `node scripts/verify-reuse.cjs` with fixtures available under tests/fixtures or FIXTURES_DIR. REUSE_OUTPUT can select a new report path. The harness imports the capabilities directly, without document, window or Builder initialization. It browses all 173 champions and 868 items, inspects champion lore/skins/abilities and an item, prepares advanced source data, and verifies two independent query, build and scenario instances. Source catalogs and fixture hashes remain unchanged.

Run `npm test` for fixture-free regressions, including ten new tests for complete catalog retention, session request races/failures/disposal, input isolation, role transitions, rune rejection/FIFO behavior, read-only source/provenance, optional retries and shared text semantics. Existing VM test loaders have explicit extraction dependencies; their prior assertions are unchanged.

Generated-root and generated-preview checks use the Phase 2 browser matrix. Representative cases must match the Phase 1 advanced/fallback cases arrays exactly. Numerical tolerances are unnecessary if all captured values and displays remain identical. All 213 unit tests and 28 browser runs passed. All five baseline scenarios matched exactly in both data modes and both generated routes (20 comparisons). After separating target/time normalization from the mitigation engine, the target, dashboard and picker checks passed again on both routes, as did all representative comparisons. Summaries are recorded in [phase3-reuse.json](phase3-reuse.json) and [phase3-verification.json](phase3-verification.json).

A clean archive of the staged source passed all 213 unit tests, generated the site successfully and passed the headless fixture harness with an explicit fixture path. No untracked runtime dependency was needed.

No baseline tag, baseline branch or production application changes are part of this phase.