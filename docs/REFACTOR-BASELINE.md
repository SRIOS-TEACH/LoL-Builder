# Phase 1 — Behavior inventory and refactoring baseline

Completed 1 October 2026. Test execution took place on 30 September 2026 (UTC timestamps are recorded in the evidence). This establishes the behavior of the existing implementation, including its known limitations; it does not certify complete in-game accuracy.

**Result:** 201 unit tests passed. All 28 browser runs passed across the root and preview apps. Four supplementary numerical/catalog audit runs passed. One existing ability audit failed at a stale startup check. A separately recorded diagnostic copy completed after that check was corrected and reported unresolved tokens in 13 champion passives. The baseline is documented with exceptions, not an all-green release certification.

## Exact version and preservation

- Commit: `f51fc1491eff764e77cd19a1bc8ea753bdfd6abe` (`codex/combo-rune-item-effects`). Runtime and existing test files were unchanged by this work.
- Existing local README edits and untracked roadmap/refactoring-plan documents were preserved in the local snapshot.
- Source and fixtures were copied before execution into `test-results/refactor-baseline-2026-09-30/`. Tests ran against that source copy, using separate fixture folders for root and preview runs. The original fixtures were not redownloaded or changed.
- Before/after integrity checks found **zero changed original source files and zero changed original fixture files**. All 38 tracked preview files matched their root counterparts by SHA-256.
- This is a Phase 1 evidence capture. Phase 0's Git snapshot/tag, independent backup, remote checkpoint and managed refactoring worktree remain outstanding. The local source copy is not a replacement for those protections. Complete Phase 0 before runtime changes.

The [manifest](refactor-baseline/manifest.json) records every captured source/fixture hash, initial working-tree status, runtime versions and absolute capture locations. The [integrity result](refactor-baseline/integrity.json) applies to the test run before this report and the plan status were updated.

## Test environment and data

| Setting | Captured value |
|---|---|
| Runtime | Node 24.19.0, Windows x64 |
| Browser automation | Playwright 1.62.1 |
| Headless browser | Microsoft Edge 154.0.4258.48; executable hash in manifest |
| Data Dragon fixture version | 16.18.1; 173 champions |
| Captured fixture directory | 360 JSON files, 77,190,736 bytes |
| Advanced source data | Existing Community Dragon captures, including item/champion BIN records and English localization |
| Fixture provenance limitation | Download script used mutable `latest` URLs; original capture timestamps and immutable Community Dragon revision were not recorded |
| Artwork | Browser suites replace remote artwork with placeholders |
| Network behavior | Fixture interception; advanced mode serves captured JSON, fallback mode returns HTTP 503 for Community Dragon |

The 360-file manifest includes existing audit/probe JSON in the fixture directory as well as source payloads. Browser tests consume the catalog/champion/localization files they request; numerical corpus audits scan champion `.bin.json` files, `map11.bin.json` and `cd-items.json`. Do not interpret 360 as the number of production downloads. The recorded bytes make the local dataset reproducible; they do not establish that every source was captured on the same upstream patch.

## Executed verification matrix

Full commands, environment overrides, exit codes, timings and log paths are in [results.json](refactor-baseline/results.json). Logs are retained under [logs](refactor-baseline/logs/).

| Check | Root | Preview | Evidence/coverage |
|---|---|---|---|
| Unit suite | 201/201 pass | Same runtime bytes; not separately rerun | 16 test files; no skipped/cancelled tests |
| Broad browser — advanced and fallback | Both pass | Both pass | 173 champions at levels 1/6/11/18, 236 Builder items, selection races, add/remove, rune changes, startup failure and disabled lookup routes |
| Ability DPS — advanced and fallback | Both pass | Both pass | 173 champions / 692 abilities per run |
| Ability DPS — advanced with targets | Pass | Pass | Typed damage and target-enabled numerical outcomes |
| Attack browser — advanced and fallback | Both pass | Both pass | 173 champions, controls, available registered effects and advanced finite/non-partial expectations |
| Dashboard | Pass | Pass | Role slots, level caps, boots movement, rune controls, overlays, skins, desktop/mobile layout |
| Pickers | Pass | Pass | Optional-data readiness/failure, search/filter behavior, backdrop handling, fixed panels, recommendations and gold totals |
| Passives | Pass | Pass | Growth, stacks, item prose/toggles, Spellblade cadence, specialized haste and Shojin |
| Targets | Pass | Pass | Physical/magic/true/mixed damage, penetration, HP scaling, clamping and retained disabled values |
| Combo editor | Pass | Pass | Recasts, explicit crit outcomes, custom values, warnings, sequencing, target preservation and layout |
| Combo effects | Pass | Pass | Rune procs, item alternatives, full burns, mitigation once, removed effects and changing target HP |
| Champion effects | Pass | Pass | Captured champion stat/stack and repeated-computation checks |
| Combat input corpus | Pass | Identical engines; root only | 2,809 records / 5,618 scenarios: 5,605 numerical, 7 inactive, 6 instances of 3 known source issues; no missing controls |
| Formula corpus | Completed | Identical engines; root only | 2,672 numerical, 134 needing inputs, 3 unsupported of 2,809 records; this is a diagnostic inventory, not an all-numeric assertion |
| Item descriptions — ranged and melee | Both pass | Identical engines; root only | Each: 236 complete descriptions, 185 localized, 34 named actives, zero incomplete/missing actives; 13 test cases pass |
| Existing all-rank ability audit | **Fails startup** | Not repeated | Waits for 6 item slots although startup now has 7 |
| Readiness-corrected diagnostic audit | Completes with findings | Not repeated | 173 champions; 30 unique unresolved-token entries across 13 passive abilities |

No application fixes were bundled into this phase. Existing browser tests and numerical tests were not edited to make the results pass. Some numerical browser assertions compare two paths through the same calculation implementation; those are consistency checks, not independent game references.

## Known failures, limitations and follow-up gates

| ID | Finding | Required handling |
|---|---|---|
| B1 | `tests/ability-audit.cjs:41` waits for exactly six item-slot buttons. Current startup has seven. Original run times out after 30 seconds. | Preserve the original failure. Before ability-resolver extraction, repair the audit readiness contract in a separate test-maintenance change and rerun it. |
| B2 | With only that predicate changed from 6 to 7, the diagnostic reports 30 unresolved token entries across 13 passives: Aphelios, Aurelion Sol, Bard, Kai'Sa, Kalista, Kayn, Ornn, Quinn, Smolder, Swain, Twisted Fate, Xayah and Zilean. | Preserve [diagnostic output](refactor-baseline/ability-audit-readiness.json). This contradicts treating the older “zero unavailable” documentation as current certification. Classify localization/script placeholders versus actual missing numerical formulas before extraction. The audit observes resolver calls; it does not prove every recorded call survives unchanged in final rendered prose. |
| B3 | Three known source defects: Runaan variant `773085/ChampRange` is circular; K'Sante Q3/R missile helper damage records reference missing `Effect1`. | Keep existing unsupported diagnostics. The combat-input audit checks the same defects in two activation states. |
| B4 | Community Dragon captures lack an immutable source revision; production still resolves live sources. | Preserve exact fixture bytes and checksums. Do not claim full patch pinning; design/version promotion remains separate work. |
| B5 | Comparison isolation and reusable multi-instance UI do not exist yet. Combo resolution temporarily swaps `BUILDER.target`; renderers depend on global IDs/state. | Add the planned A/B/A evaluation and simultaneous-component checks as the boundaries are extracted. Current restoration tests are weaker than true isolation. |
| B6 | Explorer pages are disabled and their old controllers do not execute in active browser tests. | Retain useful dormant behavior. Add catalog/detail characterization at extraction; passing unavailable-page link checks does not certify the old explorer UI. |
| B7 | Combat model remains bounded: actions may aggregate hits, omitted timings/damage use warned zero fallbacks, and resets/resources/movement/proc prerequisites are not universally simulated. | Preserve warning/status semantics. Accuracy changes require separate reference cases and review. |
| B8 | Historical architecture/audit/roadmap prose lags current target/combo behavior and the new audit findings. | Use this report as the current baseline; reconcile historical docs during handover without erasing prior evidence. |

The diagnostic copy lives in the evidence folder, with the exact original audit preserved in the captured source. It changes only `length===6` to `length===7`. Its successful process exit means the audit ran, not that its unresolved-token report is empty.

## Current page, script and asset inventory

The [machine-readable inventory](refactor-baseline/inventory.json) covers 21 JavaScript modules, five root pages, two stylesheets, named-function locations, global API references, DOM IDs, event types, data attributes and dynamic class/asset source lines. It is a conservative text scan, not a complete call graph or evidence that an unreferenced selector is dead.

| Route (also under `/preview/`) | Current role | Preservation requirement |
|---|---|---|
| `/index.html` | Redirects to `main.html` | Preserve static entry and relative redirect |
| `/main.html` | Navigation/Builder landing page | Preserve Builder link and shared theme |
| `/Builder.html` | Active calculator and combo dashboard | Preserve capital `B`, relative scripts/assets and behavior |
| `/champ.html` | Champion Lookup unavailable notice | Preserve notice/link until an explorer is intentionally restored |
| `/itemLookup.html` | Item Lookup unavailable notice | Same; do not mistake its dormant controller for certified live behavior |

Builder script order is currently: `apiClient → itemPolicy → abilityRules → targetDamage → damageText → abilityDps → abilityOnHit → buildStats → runeEffects → calculations → combatInputs → championEffects → attackEffects → attackChampions → itemData → itemDescriptions → comboTester → builder → comboUI`. These are classic scripts, not imports. Several modules defer dependency access until invocation; `CombatInputs`, `ChampionEffects` and item descriptions also capture global dependencies. Preserve startup order during intermediate extraction steps.

Runtime assets include `CSS/halfmoon-variables.css`, `CSS/lolBuilder.css`, local `assets/shop/*.png`, Data Dragon champion/item/spell/passive/rune icons and splash URLs, and Community Dragon rune icons/localization. Only Builder loads application scripts; the other current root pages are static. Linux/static-host path casing still requires verification when modules move.

Dynamic CSS/DOM contracts include `hidden`, `status-error`, `target-inactive`, `is-disabled`, `dashboard-detail[open]`, selected picker/rune classes, dynamically generated damage-type classes, `data-ability-slot`, `data-attack-control`, `data-combat-key`, combo `data-action-id`/`data-step` attributes, and `--builder-splash-url`/`--champ-splash-url`. Dialog open state, tooltip visibility, media queries and the dynamically populated card/picker markup must be checked before deleting selectors. Framework variables remain a separate concern from component CSS.

CI currently runs unit tests on pushes/PRs. Pages independently publishes the entire repository on pushes to `main` and manual dispatch. This phase did not change deployment or verify remote repository protection settings.

## Observed behavior to preserve

| Workflow | Current behavior and owner | Existing evidence |
|---|---|---|
| Startup | Data Dragon champion/item indexes gate readiness. Runes and advanced item enrichment complete separately; optional failure preserves usable selection and equipped items. `loadBuilderData`, `initBuilder`. | Broad browser, pickers, API unit tests |
| Champion selection | Latest request wins; failed selection preserves existing build. Successful selection copies champion stats, resets ranks/combat values, preserves target and inventory/runes, refreshes views; changed champion clears combo steps. `setChampion`, `ComboUI.refresh`. | Broad browser races/failure, targets, combos |
| Champion inspection | Hover detail has its own request counter/cache; inspect and select are separate intentions despite shared controller state. | Picker/browser checks; retain distinction during extraction |
| Catalog querying | Builder filters map 11/purchasable variants, adds role/boot entries, then applies slot/class/stat/recommendation policies and sorts by cost/name. Dormant Item Lookup supports map/tag search and name sorting. | Picker-data, picker browser; dormant UI itself not exercised |
| Equip and role changes | Slot 6 is role quest; Top permits level 20; Mid enables tier-three boots; Bot adds boots slot 7. Leaving Bot moves boots into a free normal slot or rejects the change without discarding inventory; leaving Mid downgrades boots. | Dashboard, pickers |
| Ability ranks | Q/W/E and R caps plus point budget are enforced by shared rules; role level 20 does not raise ordinary ability rank caps. | Unit regressions, dashboard |
| Runes and time | Primary/secondary path rules, shards, selected counters and game time affect supported stats/effects. Retained-only/unbound rune mechanics stay documented. | Rune unit suites, dashboard, combo effects |
| Conditional inputs | Sources discover fields; shared keys link owners. UI writes values and re-renders. Clearing an input preserves unknown/default semantics rather than inventing a calculation coefficient. | Combat audit, browser/passives/champion-effects |
| Targets | Off by default; edited values retained while off. On applies explicit typed mitigation and supported HP scaling. Switching champions retains target. True damage bypasses resistance/general reduction. | Target and damage unit/browser suites |
| Abilities and attacks | Simple/detailed descriptions, damage rows and cooldown-based/active DPS use current formula and effect bindings. Unsupported results remain explicit. | DPS/attack suites, item/ability unit suites |
| Combos | Ordered actions/recasts, explicit critical outcomes, editable fixed overrides, item/rune/passive actions and warned zero fallbacks. Target health updates per action; HP clamps at zero, damage includes overkill. | Combo unit/browser/effects suites |
| Layout and interactions | Compact desktop and stacked mobile; isolated scroll regions; dialog focus/escape/backdrop behavior; tooltip placement; skin splash changes. | Dashboard, pickers, targets, combo screenshots |

## Capability and state ownership map

Consumer shorthand: **B** Builder, **I** item explorer, **C** champion explorer, **X** build comparison. Entries describe extraction candidates, not implemented new APIs. Each responsibility has a distinct output and state owner even where its code currently shares a file.

| Responsibility / current functions | Explicit inputs → output | Current side effects/state → intended owner | Consumers / evidence |
|---|---|---|---|
| Source retrieval: `ApiClient.fetch*`, `loadCommunityDragonCalcs`, `ensureGameText` | Source identity/version/locale → payload, availability, provenance | Fetch and request caches; `ITEM_DATA`, string loading flags → source repository | B/I/C/X; API retry/coalescing tests |
| Source adaptation: `extractAbilityDataFromRoot`, alias/child helpers, `extractChampionStatsFromBinRoot`, `buildMergedItemStats`, `BuildStats.itemStatsFromDescription` | Raw records and source policy → normalized records/lookup indexes | Reads source payloads; today interleaved with Builder → pure data adapters | B/I/C/X; captured formula/rank cases; highest-risk alias gaps |
| Catalog query: lookup `applyItemFilters`, Builder grid filters, `ItemPolicy` | Full catalog, query and variant policy → ordered IDs | Reads DOM and writes filtered selection/grid → pure query plus page-owned query state | B/I/C/X; picker tests; dormant map workflow gap |
| Recommendation selection: `getRecommendedItems`, `recommendedItemIds` | Champion source, map/mode, catalog → ordered item groups | Builder wrapper applies current catalog/role filters → pure recommendation query | B/C/X; picker-data |
| Build transitions: `roleItemAllowed`, `setSlotItem`, rank/rune selection helpers | Build inputs and user intention → next inputs or reason | Mutates `BUILDER`, status and many views → domain transitions + application command | B/X, optional I/C experiments; role/rune tests |
| Scenario normalization: `TargetDamage.normalize`, rune/input normalization | Explicit target/time/counters → normalized inputs | UI sync currently mutates Builder → scenario owner | B/I/C/X; target/rune tests |
| Input discovery: `CombatInputs.descriptors`, champion effect `fields` | Formula sources and context → field descriptors/owners | Pure discovery mixed with UI in same module → domain/engine discovery | B/I/C/X; combat audit |
| Context application: `CombatInputs.apply`, `baseCalculationContext`, `calculationContext`, `buildAbilityContext` | Build/scenario/prepared records → complete or partial context | Reads Builder, rune/item caches; adds specialized haste → explicit context factory | B/I/C/X; broad/DPS tests; isolation coverage pending |
| Formula evaluation: `Calculations.evaluate`, `resolveAbilityToken` | Formula/token and context → value/expression/diagnostics | Shared formula engine plus Builder/global adapters → calculation engine | B/I/C/X; unit/corpus tests; B1/B2 must be addressed before extraction |
| Stat contributions: `getItemStats`, `getRuneStats`, `buildPassiveLedger`, `computeDerivedBuildStats` | Build and prepared effect records → totals/contributions | Global reads and mutable ledger/results → per-evaluation output | B/X, optional I/C experiments; growth/passive tests |
| Attack/effect rules: `AttackEffects.model`, `AttackChampions`, `ChampionEffects`, `RuneEffects`, `AbilityOnHit` | Explicit state/context → modifiers, typed packets, controls | Model closures retain state; global cross-module calls → evaluation-local models and narrow rule functions | B/I/C/X; attack/rune/passive suites |
| Ability results: `AbilityDps.profile`, cooldown/timing helpers | Spell/rank/context/resolver → typed rows and diagnostics | Also contains HTML `render`; callbacks close over Builder → engine result plus separate presenter | B/C/X, I effect experiments; DPS suites |
| Mitigation: `TargetDamage.apply` | Typed raw packet, target, penetration stats → mitigated packet/explanation | Mostly pure; `DamageText` embeds evaluation in HTML → engine packet plus presentation | B/I/C/X; target/damage tests |
| Combo construction: `comboUI.actions`, `selectedActions` | Build, sequence, overrides and current scenario → actions | Reads global state and captures catalog/step arrays → explicit action builder | B/X, optional C experiments; combo tests |
| Combo scheduling: `ComboTester.simulate`, `comboUI.simulate` | Actions, initial target, step resolver → timeline/totals/warnings | Scheduler local state; UI adapter swaps global target → independent run state | B/X; combo sequencing tests; two-build coverage pending |
| Description/view models: `ItemDescriptions.describe`, `buildDetailedAbilityText`, `buildDetailedPassiveText`, formatting in `itemData`/`DamageText` | Records and evaluated results → display model/text | Evaluation and HTML mixed today → pure presentation after extracting numeric interpretation | B/I/C/X; description/DPS suites |
| Controls/renderers: modal/grid/card functions, `CombatInputs.render`, combo DOM handlers | Model and callbacks → rendered view/user intentions | Fixed IDs, document events, values mutation → mounted UI instance with disposal | B/I/C/X; browser tests; multi-instance coverage pending |
| Foundations: escaping, numeric formatting, ranked reads, source-path helpers | Narrow values and explicit policy → transformed value | Some helpers unnecessarily import item/Builder modules → core, presentation, source or domain module according to semantics | All; consolidate only matching unknown/unit/rounding behavior |

Current authoritative state is split across the global lexical `BUILDER`, mutable `RUNE_DATA`, item cache `ITEM_DATA`, API request map, and the combo IIFE's `champion/steps/catalog/nextId/editingId`. Dormant `CHAMP_STATE` and `ITEM_STATE` are additional page singletons. DOM inputs, open flags and selected attributes are also read as state. Do not replace these with one renamed global “service.” Separate build inputs, scenario inputs, source caches, derived output and UI state explicitly.

Important dependency cycles: Builder rendering calls `ComboUI.refresh`, which calls Builder calculation/context functions; attack effects call `AttackChampions`, which calls attack-effect critical math; damage/description paths combine evaluation and presentation. The first two currently work through deferred globals but require explicit dependency removal or inversion before ES-module conversion. Shared critical math is a candidate for a lower-level domain function; the Builder/combo cycle should become application orchestration of independent evaluations/views.

## Representative contracts for extraction

1. **Catalog query:** `queryItems(catalog, {search, tags, maps, sort, variantPolicy}) → ordered IDs`. No selection/equip side effects. Keep all original IDs available; Builder eligibility is a separate predicate/transition with a reason.
2. **Build transition:** `applyBuildChange(build, intent, rulesData) → {nextBuild, issue}`. A rejected Bot-role change returns the original inventory intact. UI status text and rendering happen outside the rule.
3. **Context factory:** `createContext(buildInputs, scenarioInputs, preparedData) → context`. No implicit selected champion, global target or DOM reads. Preserve rank conventions, units, unknowns and the current stat/effect order.
4. **Evaluation:** `evaluateBuild(build, scenario, data) → {stats, attacks, abilities, diagnostics}`; smaller ability/item operations accept partial context and expose missing requirements. Results retain full precision, stable identities and typed raw/mitigated packets. Equal inputs must produce equal results without mutating them.
5. **Combo:** `evaluateCombo(sequence, build, scenario, data) → {timeline, totals, diagnostics}`. Initial target is copied into run state. A missing action remains an explicit diagnostic; no cross-candidate target/cooldown/stack sharing.
6. **Presentation/control:** `toItemDetailModel(record, evaluation?) → viewModel`; `mountItemDetail(container, model, callbacks) → {update, dispose}`. An explorer can inspect without equipping; two mounted details do not share IDs/listeners or query state.

These interfaces are proposed handoff contracts, not claims that those exported functions already exist. Characterization tests protect current behavior; later isolation tests prove the new scope boundaries.

## Representative output records

[Advanced cases](refactor-baseline/cases-advanced.json) and [fallback cases](refactor-baseline/cases-fallback.json) retain explicit build/scenario inputs, full stat/attack/ability outputs, warnings, combo display and the target after simulation. Five cases run in each mode. All use level 18, ranks 5/5/5/3, no selected runes/shards/counters, and 20 minutes; targeted cases start at 2,000 HP, 100 armor/MR and 0% generic reduction. Item IDs and sequences are included in each record.

| Advanced case | Items | Displayed combo damage | Displayed duration |
|---|---|---|---|
| Ashe: AA, Q, W; target off | None | 472.5 | 0.72 s |
| Ezreal: Q, AA, W | Trinity Force `3078`, Muramana `3042` | 554.1 | 0.67 s |
| Veigar: Q, R with sequential target HP | Rabadon's `3089`, Shadowflame `4645` | 606.1 | 0.50 s |
| Aatrox: Q, Q2, Q3 | None | 375.9 | 2.60 s |
| Aurora: Q, R | Luden's `6655`, Liandry's `6653` | 348.0 | 0.25 s |

These are captured implementation results, not hand-verified game truths. Combo values are display-rounded; use numerical records and existing tests for engine tolerances. Fallback captures intentionally retain missing timing/formula warnings and unavailable recast actions. Both modes verified that rendering the combo restored the input target. Existing tests additionally cover role preservation, on-hit interactions, shared cooldowns and order-dependent damage; the five captures do not replace that wider coverage.

## Reproducing the baseline

Use the explicit supported Node executable recorded in the manifest; the shell's default Node currently resolves to an older Brackets installation. No production dependency install is required. Supply an existing Playwright package and compatible browser.

```powershell
$phaseNode = 'C:/Users/Shannon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$env:PLAYWRIGHT_PATH = 'C:/Users/Shannon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:BROWSER_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
$env:FIXTURES_DIR = Join-Path (Get-Location) 'tests/fixtures'
$env:BASELINE_OUTPUT = Join-Path (Get-Location) 'test-results/refactor-baseline-rerun'
& $phaseNode scripts/run-refactor-baseline.cjs
```

Use a new output directory for every run; the runner refuses to overwrite evidence. It captures the current checkout and runs the original tests with isolated root/preview fixture folders. A new capture after code changes is a candidate result, not this baseline. To reproduce this exact baseline use the preserved snapshot and fixture hashes. The runner deliberately retains the stale audit failure until test maintenance fixes it; its exit code is therefore currently nonzero.

`scripts/inventory-refactor.cjs` regenerates the conservative inventory using `APP_ROOT` and optional `INVENTORY_OUTPUT`. `scripts/capture-refactor-cases.cjs` captures the five cases using `APP_ROOT`, `FIXTURES_DIR`, `PLAYWRIGHT_PATH`, `BROWSER_PATH`, a new `AUDIT_OUTPUT`, and `ADVANCED_DATA=1` or unset. Those scripts do not refactor the runtime. The capture helper was corrected during development for a disabled empty-combo Clear button and the picker attribute name; only its final successful records are published here.

Full raw audit reports, screenshots, original source and two fixture copies remain in the ignored local capture directory. Compact manifests, logs, diagnostic findings and representative cases are stored alongside this report so they can be committed. Git does not back up the ignored local capture; preserve it or the necessary source fixtures through Phase 0's independent backup procedure.

## Phase 1 exit decision

The behavior inventory, dependency/state map, extraction contracts, fixture/source checksums, executed test matrix and known failures are now recorded. **Phase 1 is complete with documented exceptions B1–B8.** No baseline failure was hidden or converted into a passing assertion. Phase 0 protection still precedes runtime changes. Before extracting the ability resolver, repair the audit harness and explicitly account for its passive findings. The next structural work should prove reusable item/champion catalog behavior before broadly moving files.
