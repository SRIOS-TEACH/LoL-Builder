# Phase 5 — Reusable UI and native page composition

Implemented 7 October 2026 on `codex/modular-refactor`. The protected baseline remains fixed. This phase preserves calculation behavior and the public page routes; explorer and comparison products remain separate feature work.

## Ownership and contracts

`JS/builder.js` resolves the Builder markup once and starts a private `createBuilderPage` instance from `JS/application/builderPage.mjs`. That controller owns canonical build/scenario inputs, source requests, shop eligibility, recommendation filters and page refresh workflows. Its startup is idempotent; disposal removes listeners and prevents late selection/status updates. No runtime module registers Builder state or capability APIs on `window`.

Every component accepts actual DOM containers or named element slots from its caller. Named slots are an interface, not global document lookups. The page may use its existing IDs; another consumer supplies its own elements. Generated rank, inventory and rune-counter IDs have unique instance prefixes by default. Builder explicitly retains its original IDs so existing accessibility relationships and routes remain stable.

| Component | Owns | Inputs and callbacks |
|---|---|---|
| `ui/catalogList.mjs` | List rendering, inspected/selected visual state | Stable IDs, records and version; inspect/select callbacks. Queries and equip/navigation decisions stay with the caller. |
| `ui/championDetail.mjs` | Current detail request and rendering | Champion summary, version and injected asynchronous detail loader. Latest response wins; pending results cannot write after disposal. |
| `ui/itemDetail.mjs` | Item detail and contextual input rendering | Item/source record, base context, description callback and combat-value draft; select and combat-change callbacks. |
| `ui/inventory.mjs` | Slot and total-cost display | Slots, item records and version; slot-selection callback. Role transitions stay in BuildInputs and the page workflow. |
| `ui/targetControls.mjs` | Target draft, dialog, field formatting and focus restoration | Initial target, supplied controls, normalized target-change callback and update method. |
| `ui/runeControls.mjs` | Rune/path/shard choices, stack dialog and tooltip | Rune records, input draft, explicit stack evaluator and input-change callback. RuneInputRules remains authoritative. |
| `ui/abilityControls.mjs` | Ability/attack cards, expansion state, rank and combat drafts | Prepared ability model, explicit calculation-session provider and rank/combat-change callback. No source fetching or champion selection. |
| `ui/comboControls.mjs` | Sequence, overrides, editing dialogs and damage tooltip | Supplied model and calculation-session provider. Each instance owns its own sequence and health evaluation. |
| `ui/statsView.mjs` | Stat rows and explanation formatting | Evaluated stats, summary and range contribution. It neither fetches data nor edits a build. |
| `shared/combatInputs.js` | Rendering discovered calculation controls | Scoped root, fields/context, value draft and change callback. Replacing a root disposes its previous listeners; `dispose(root)` retires it. |

`ui/lifecycle.mjs` is shared by the controls, combat rendering and page composition. It scopes element access and owns listener/property cleanup. It contains no game rules. Native modules declare dependencies with relative imports; the browser no longer depends on a manually ordered list of scripts. The import graph is acyclic: AttackEffects supplies its existing average-crit function to champion profiles explicitly, removing their former mutual dependency. Node 22.13 or newer is required for the CommonJS test runners to load these native exports synchronously. Production remains a static site with no package dependencies or bundler.

`createApiClient(fetchImpl)` and `createItemLookup({repository})` permit independent transport/cache instances. Source repositories and calculation inputs remain separate from view state. Components hold temporary input drafts, report changes to their owner and receive the resulting authoritative values through `update`.

## Reuse without Builder

A champion explorer composes SourceRepositories, CatalogQueries or CatalogSessions, CatalogList and ChampionDetail. An item explorer uses the full item catalog, its own explicit query policies, CatalogList and ItemDetail. Neither inspection callback equips an item or changes a build unless its owner explicitly requests that workflow.

A comparison page creates separate BuildInputs and ScenarioInputs for each candidate, calls CalculationPipeline for each, and mounts independent inventory, rune, target, ability, stats and combo views. Sharing read-only catalog/source records is safe; sharing mutable inputs or component instances is not. Both candidates may be evaluated against equivalent scenario values without sharing target health progress.

`tests/ui-reuse-browser.cjs` mounts two sets of ten components without importing the Builder entry or controller. It browses 173 champions and all 868 item records, checks independent callbacks, target/rune/rank changes and combo sequences, verifies focus restoration and unique DOM identities, races champion detail responses, retains old controls to test disposal, and proves that the second set remains usable after disposing the first. Source records are unchanged.

`tests/native-entry-browser.cjs` exercises the real Builder entry without injecting compatibility aliases. The older characterization suites use `tests/helpers/native-runtime.cjs` and `page-adapter.mjs` to access native exports inside test contexts. Those aliases and helpers are never included in the runtime artifact. The ability audit still observes actual token resolution through this test adapter.

## Removal ledger

| Removed code | Evidence and retained behavior |
|---|---|
| `JS/comboUI.js` | The former global/DOMContentLoaded adapter is replaced by ComboControls. Its UI, sequence editing, focus, dialog, tooltip and responsive behavior are covered by the combo suites and standalone two-instance harness. |
| `JS/champLookup.js` | The inactive notice page imports no controller. Source loading, record preparation and catalog queries were retained in Phase 3; champion list/detail and ability views now have independent coverage. The notice and Builder link remain. |
| `JS/itemLookup.js` | The inactive notice page imports no controller. Full catalog policies, item data/formulas/descriptions and combat controls remain reusable and are verified without Builder. The notice and Builder link remain. |
| 57 unused Builder forwarding/diagnostic functions | Caller review found no production callers after extraction. Native capabilities preserve their operations; tests consume those exports directly through the test adapter. The [exact function list](phase5-removed-forwarders.json) records the deletions. |
| Two unused nested rune renderers | `renderShardIcon` and `renderSelectedRune` had no callers; the active primary/secondary/shard rendering paths remain. |
| Legacy global/CommonJS registration closures and ordered HTML scripts | Native import graph and entry tests verify every runtime dependency and reject global API registration or CommonJS runtime wrappers. Existing arithmetic bodies and source interpretation remain unchanged. |
| Unreachable item-description fallback wiring | ItemDescriptions is a required native dependency. The active description pipeline and unavailable source results remain covered by the item/passive/combo tests. |

No CSS was removed: this phase has no new usage evidence justifying a deletion. Artwork attribution and basic/advanced source fallbacks remain in generated output. The runtime artifact contains 71 files copied from the authoritative source, including both root and nested preview routes.

## Verification

The complete unit suite passes 225 tests. Ten headless calculation cases preserve exact stats/attack records, numeric/status tolerances and A/B/A/input isolation. Data reuse retains the complete catalogs and Builder's 236-item policy. Before application of the entry change and forwarding cleanup, isolated candidates passed browsing, dashboard, picker, target, passive, combo and standalone reuse checks, plus exact advanced/fallback saved case comparisons.

The repaired ability audit exactly matches all 30 saved findings across 13 passive descriptions. The combat audit checks 2,809 source calculations in 5,618 scenarios, with no missing input controls or new source issues.

All 32 distinct browser checks pass across generated root and preview routes. Thirteen affected follow-up browser checks verify the target-state correction and explicit attack-engine dependency; 20 final complete saved case comparisons match exactly. The controls now accept authoritative target updates without reformatting equivalent values during typing. A clean saved-source archive passes 225 units, site generation, ten headless cases, the independent UI harness and the actual native entry. See [verification evidence](phase5-verification.json), [headless records](phase5-headless.json) and the [checked action list](REFACTOR-ACTIONS.md). Publication uses the existing separate preview workflow. Existing unsupported calculations and the 30 classified passive-token findings remain baseline limitations; this phase introduces no game-accuracy changes.
