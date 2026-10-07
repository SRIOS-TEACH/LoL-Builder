# Refactoring plan

Status: revised proposal for review, 30 September 2026. Reviewed against future item/champion explorers and build comparison. No runtime code has been changed by either planning pass.

Progress update, 8 October 2026: **Phases 0–6 are complete with documented baseline exceptions.** Both branches and the protected baseline tag were published to GitHub and their saved commits verified on 1 October. See [the action checklist](REFACTOR-ACTIONS.md) for completion tracking, [the baseline report](REFACTOR-BASELINE.md) for verification, and [protection/recovery instructions](REFACTOR-PROTECTION.md) for restoration. Phase 2 delivery cleanup is complete; [its ledger](REFACTOR-PHASE2.md) records generated preview parity, retained capabilities and passing checks. Phase 3 is complete; [its contracts and evidence](REFACTOR-PHASE3.md) cover reusable sources, queries and independent input records. Phase 4 is complete; [its explicit calculation contracts](REFACTOR-PHASE4.md) and [verification](phase4-verification.json) cover headless builds, abilities/items and isolated combo health steps. Phase 5 is complete; [its scoped component contracts](REFACTOR-PHASE5.md) and [verification](phase5-verification.json) cover native modules, independent controls, disposal and unchanged page workflows. Phase 6 is complete; [release and handover evidence](REFACTOR-PHASE6.md) covers regression/performance comparison, independent recovery, clean-source checks and guarded preview publication. See [extension recipes](EXTENDING.md) for future functionality. Calculation algorithms remain unchanged.

## Outcome and scope

Make the calculator easier to understand, extend and reuse in another interface while preserving its current results, interactions and documented limitations. Remove demonstrably redundant code, give each concern a clear owner, and separate calculations from browser state and rendering.

This is an incremental refactor, not a rewrite. New mechanics, complete explorer/comparison pages, save/load features, framework adoption, visual redesign and corrections to existing calculation behavior belong in separately reviewed changes. The refactor must demonstrate reuse through small integration harnesses; future pages must not need to import Builder or recreate its rules.

The unit of design is a capability with one responsibility and an explicit contract, not a file or a page. A capability may contain several cohesive functions. Split code when its reasons for change, dependencies or state ownership differ; do not split simply to meet a line-count target.

## Findings from the current checkout

- Starting commit: `f51fc14`, on `codex/combo-rune-item-effects`, tracking the same remote branch in `SRIOS-TEACH/LoL-Builder`.
- Existing uncommitted work: two README additions and untracked `docs/ROADMAP.md`. Preserve both in the baseline; do not reset or silently exclude them.
- `JS/builder.js` is 2,865 total lines. It owns data retrieval, source normalization, build and interface state, champion/role/item/rune rules, ability resolution, derived calculations and rendering.
- `JS/comboUI.js` reads `BUILDER` and calls global functions from the Builder controller. Its action catalog and source interpretation are mixed with interface behavior, although the scheduler already lives in `JS/shared/comboTester.js`.
- Useful modules already exist for stats, formula evaluation, target damage, attacks, runes and combo scheduling. Preserve and refine these rather than replacing working logic indiscriminately.
- Production uses ordered script tags and global APIs. Several tests load scripts into a VM and depend on those names. Changing module format requires a deliberate test-loader migration.
- The tracked `preview/` tree contains 38 files. Comparison found no differences between preview files and their matching root files. It is duplicate maintenance, but existing preview URLs and relative asset paths need to keep working.
- Champion and item lookup pages currently show unavailable notices. Preserve and extract useful lookup capabilities for future explorers before retiring page controllers. Dormant page code is not evidence that its underlying feature is unwanted.
- `itemData.js` combines source loading/indexing, recommendations, formula evaluation and HTML decoration. `buildStats.js` combines calculation math with source merging and description parsing. `combatInputs.js` combines input discovery/context application with DOM controls that mutate a supplied values object. Existing shared files are starting points, not final responsibility boundaries.
- `comboUI.js` temporarily replaces `BUILDER.target` while resolving damage at successive health values, then restores it. That coupling must be removed to support independently evaluated builds; merely passing the existing controller into a comparison page would retain the problem.
- `ItemDescriptions.escape` is used by unrelated UI such as combos. Basic escaping/formatting should not require importing item-description logic. Conversely, source token canonicalization, ranked values and damage rules are domain-specific even when several features use them.
- `CSS/lolBuilder.css` is 1,386 total lines. Dynamic classes, dialogs and responsive states must be considered before removing selectors.
- CI runs unit tests; Pages deployment separately uploads the entire repository on pushes to `main`, and also supports manual dispatch. Test success is not presently an explicit dependency of deployment.
- Architecture/README descriptions and the roadmap lag implementation in places: targets and combos already exist. Reconcile the roadmap against actual behavior rather than treating its milestones as a feature inventory.

## Protect the working version first

Selected approach: retain this repository and its history, preserve a baseline, and create a separate refactoring branch in a managed worktree. The user selected baseline plus branch during planning. A baseline is a named saved checkpoint; a branch holds the new work; a worktree is a separate working folder that lets both versions run side by side. These are independent of deployment: creating a branch does not itself replace the live site.

Before any runtime edits:

1. Inventory tracked, untracked and ignored material. Explicitly include the existing README/roadmap work in a baseline snapshot commit. Identify local fixtures and any other ignored material needed to reproduce the working application; preserve them separately with source/version and checksum information. A Git tag alone will not save ignored or uncommitted files.
2. Record the snapshot as an unverified preservation checkpoint, including test prerequisites. Phase 1 certifies this same snapshot after the isolated checkout exists; do not postpone preserving current work until all browser checks are available.
3. Create a non-moving annotated tag, proposed name `baseline/pre-refactor-2026-09-30`, at that snapshot. Check for an existing name first and never overwrite a baseline tag. Push the checkpoint and tag to the existing remote and retain an independent Git bundle backup. Verify the saved reference resolves to the intended commit.
4. Create a managed worktree from the exact snapshot commit and use branch `codex/modular-refactor`. Do not implicitly start from `main`: the present branch contains newer combo work. Keep the original checkout available for comparison.
5. Confirm the new checkout reproduces the baseline, including fixture availability. Keep production deployment on its current path during development; do not manually dispatch Pages from the refactoring branch.
6. Land small, independently reviewable changes with checks at each boundary. Roll back a refactoring change by reverting it; restore the complete baseline code/data artifact if a release must be rolled back. Rehearse that restoration before promotion.

If a separate GitHub repository is selected, retain full Git history, explicitly transfer the snapshot and tag, verify its contents, and leave publishing disabled until its deployment target is intentionally configured. A remote fork alone does not capture local uncommitted files or ignored fixtures.

The baseline branch/worktree and backup procedure are now implemented locally; see [the Phase 0 record](REFACTOR-PROTECTION.md). No separate remote repository is required. Public publication is a distinct final step and does not change the live site.

## Proposed boundaries

Keep the current static app and plain JavaScript. Use explicit inputs and outputs; make the calculation layer runnable without a DOM, network request or browser-global state. Organize by responsibility within the areas below, using names such as `itemCatalog`, `inventoryRules`, `abilityEvaluation` and `itemDetailView`, rather than broad `itemUtils` or `builderHelpers` modules. Paths are provisional; the contracts and allowed dependencies are the design.

| Area | Owns | Must not own |
|---|---|---|
| `JS/domain/` | Build, target, rune and scenario input shapes; normalization; ranks and inventory/role rules | DOM, fetch, modal state |
| `JS/data/` | API/cache access, source records, champion/item normalization, localization, source-version metadata | Rendering or mutations of the active build |
| `JS/engine/` | Formula evaluation, derived stats, abilities, attacks, mitigation, effects and combo scheduling | Fetch, DOM, storage, global `BUILDER` |
| `JS/application/` | Selection workflows, explicit state updates, calculation orchestration and request-race protection | HTML creation or source-specific formula parsing |
| `JS/presentation/` | Pure view-model construction, display labels/units, number formatting and description presentation | Fetch, DOM events, changing calculation results |
| `JS/ui/` | Mountable controls, lists, detail panels, dialogs and page layout | Independent damage/stat rules or data retrieval inside display components |
| `JS/core/` | Small general-purpose value/text helpers with established shared callers | Champion/item knowledge, page state, DOM or game defaults |
| Page entry points | Construct dependencies, connect events, start the page | Feature implementation |

Dependency direction: page entry points assemble UI and application capabilities; UI receives view models and calls injected operations; application uses domain, data, engine and presentation functions; engine uses domain inputs and explicit calculation data. Presentation consumes records/results without calling calculation engines or data loaders. Domain and core have no dependency on higher layers. Browser helpers stay within UI; transport helpers stay within data. Avoid circular imports and a replacement global service object that simply relocates the current coupling.

Separate four kinds of state: user inputs, read-only source data/caches, derived results, and temporary interface state. Saveable input records should not contain DOM nodes, caches or calculated output. Define only the input models needed by the current app; full storage and migration features remain roadmap work.

Use champion/item/rune-specific rule modules behind explicit effect contracts where real behavior requires them. Extract existing rules first. Introduce registries only for demonstrated repeated extension patterns; do not invent a universal plugin framework or one file per tiny function.

During extraction, retain thin compatibility wrappers for the existing global APIs. Once callers and tests use explicit module interfaces, move to native ES modules in a separate change, verifying static hosting, MIME types and URL casing. No bundler, TypeScript conversion or UI framework is required for this plan.

## Reuse by page and workflow

| Capability | Builder | Item explorer | Champion explorer | Build comparison |
|---|---|---|---|---|
| Item/champion catalogs and queries | Select champions/items | Browse item records | Browse champion records | Select/edit candidates |
| Item descriptions and effect evaluation | Equipped and inspected items | Inspect effects with optional scenario inputs | Show recommended items/details where needed | Explain item contributions per build |
| Champion profile and ability evaluation | Selected champion/abilities | Optional champion context for an item | Lore, skins, stats, abilities and scaling | Champion/ability results per build |
| Build input validation and inventory/rune rules | Edit build | Only if offering a trial build | Only if offering a trial build | Edit each candidate independently |
| Build/scenario evaluation | Current build and target | Optional explicit test scenario | Optional explicit test scenario | Evaluate every candidate with the same rules |
| Combo evaluation | Current sequence | Not required for basic browsing | Optional ability experiments | Reuse the same sequence where valid |
| Lists, detail panels, stat/damage rows, tooltips | Compact controls | Expanded browsing layout | Expanded browsing layout | Multiple isolated panels and aligned result rows |

Share behavior and data contracts; share visual components only where their behavior fits. A modal picker and a full-page explorer can use the same catalog query and detail view without being the same large configurable component. Browse/inspect/select are separate operations from equip/change champion. An explorer must not silently create or modify a build to display a record.

An item explorer may expose map variants or non-purchasable records that Builder deliberately excludes. Retain the full normalized catalog by stable ID; apply map, purchasability and deduplication as explicit query policies. Inventory eligibility is a separate build rule returning a reason. Keep current Builder policies unchanged during extraction. Champion browsing likewise needs identity, lore, skins and base ability descriptions without requiring a complete combat scenario or advanced source availability.

## Functional blocks and contracts

Each block owns one outcome. Inputs/outputs below are proposed interfaces, to be refined against fixtures before implementation. Use plain records and JSDoc; no new type system is required.

| Block | Single responsibility and contract | Starting code |
|---|---|---|
| Source repositories | Retrieve a specified source record/snapshot; return payload and availability/provenance metadata; own request caching/retry only | `apiClient.js`, `loadCommunityDragonCalcs`, `ensureGameText` |
| Source adapters | Convert one provider's records into consistent champion/item/ability/localization data; preserve IDs, source references and unsupported fields | Builder extraction/alias functions, item indexing, `mergeChampionStats`, `itemStatsFromDescription` |
| Catalog queries | Filter/sort/project normalized records from explicit query and policy inputs; return stable IDs and summaries | `applyItemFilters`, `renderModalItemGrid`, `renderChampionModalGrid`, `itemPolicy.js` |
| Recommendations | Return source-provided item groups for a champion/map/mode; do not decide whether a candidate can occupy a build slot | `getRecommendedItems`, `recommendedItemIds` |
| Build input rules | Validate/transition champion, level, ranks, inventory and rune selections; return next inputs or a rejection reason | Role/slot/rank/rune functions in Builder, `abilityRules.js` |
| Scenario input rules | Normalize target/time/condition/stack inputs and their units, preserving unknown values | `targetDamage.normalize`, combat/rune input normalization |
| Required-input discovery | Describe unresolved inputs and their owners from calculation sources; do not create controls | `CombatInputs.descriptors` |
| Context construction | Apply validated values to explicit build/scenario data and construct a calculation context | `CombatInputs.apply`, `baseCalculationContext`, `buildAbilityContext` |
| Formula evaluation | Evaluate a source formula against its context; return value/expression, missing inputs and unsupported diagnostics | `calculations.js`, token-resolution portions of Builder |
| Stat evaluation | Combine champion growth, inventory, rune and passive contributions in the existing order; return totals and contribution records | `computeDerivedBuildStats`, `getItemStats`, `getRuneStats`, `buildPassiveLedger` |
| Ability/item/attack evaluation | Resolve each effect or action into typed results using explicit records and context; no HTML output | `abilityDps.js`, `abilityOnHit.js`, `attackEffects.js`, evaluation within item/ability descriptions |
| Target mitigation | Apply the existing target/penetration rules to typed damage packets once; retain raw and mitigated values | `targetDamage.js`, damage-related parts of `damageText.js` |
| Combo action construction | Create stable action definitions from a build and its supported effects; resolve a step against its current scenario | `comboUI.actions`, `selectedActions` and source/timing helpers |
| Combo scheduling | Advance action timing and per-run combat state; return timeline, totals and diagnostics | `comboTester.js`, orchestration in `comboUI.simulate` |
| View-model construction | Turn records/results into item/champion detail models, ability cards, stat rows and timeline rows | Formatting portions of Builder, `itemData.js`, `itemDescriptions.js`, `damageText.js` |
| UI controls and views | Render supplied models and emit user intentions; own only their interaction state | Lookup renderers, pickers, `CombatInputs.render`, combo editor |

Separate record interpretation from numerical evaluation, and evaluation from its prose/HTML presentation. Do not parse rendered tooltip HTML back into authoritative calculation inputs. Existing prose-derived rules must first be characterized and extracted into explicit interpretation functions, preserving their limitations. Any replacement with better source data is a separate behavior change. Do not make every block a new file immediately; small cohesive functions may live together behind a narrow API.

### Public records and evaluation entry points

- `CatalogQuery`: search text, tags, map/mode, sort and variant policy. Search returns records/IDs without changing selection or the build. Stable IDs remain distinct from display names and array positions.
- `BuildInputs`: champion ID, level/ranks, inventory with slot roles, runes/shards, effect toggles and build-specific counters. `ScenarioInputs`: target, game time and combat assumptions. Assign each field one canonical owner; view components cannot keep a second authoritative copy. Cosmetic skin choice and editor state stay outside numerical evaluation.
- `EvaluationData`: read-only prepared champion/item/rune/ability records and localization/source metadata as needed. Loading and preparation complete before the synchronous engine call. Narrow operations accept only relevant records rather than a whole page/session object.
- `evaluateItem(item, context)` and `evaluateAbility(ability, context)`: support explicit partial contexts, returning unresolved expressions/requirements when values are missing. Catalog-only detail presentation does not require either call. Distinguish a displayed source description from a scenario-specific evaluated result.
- `evaluateBuild(build, scenario, data)`: returns stat, attack and ability results plus diagnostics/provenance using the same lower-level functions consumed by explorer experiments. Offer separate stat/ability operations so a browsing page does not calculate an entire combat report for one card.
- `evaluateCombo(sequence, build, scenario, data)`: owns fresh run state and resolves each action with the current target health. Never swap a global target or reuse another run's mutable stacks/cooldowns.
- Result records distinguish known zero, missing input, unsupported mechanics and partial results; include units, damage type and source/action IDs where relevant. Preserve full calculation precision; round only for display. Adapt existing fallback behavior and warning text at compatibility boundaries rather than silently redefining it.

These contracts are the portability boundary: another page, a Node harness or later another UI can consume them without emulating `BUILDER`, `window`, a tooltip or a page DOM.

### Independent builds and comparison

Build comparison is the strongest test of whether the refactor actually removed page coupling:

1. Create separate input/editor instances for builds A and B. They may share read-only catalogs and prepared data, but not ranks, inventory arrays, rune selections, target progress, combo steps, control values or request counters.
2. Evaluate each against an explicit comparison scenario and data/calculator revision. Start each combo with the same initial target and fresh runtime state. Reordering candidates or evaluating A, B, A must not change A's result.
3. Compare structured results by metric/action identity and unit, not DOM text or row position. A future comparison operation can compute absolute deltas and relative deltas where the baseline is nonzero; missing/unsupported values must remain unavailable. Do not declare an overall winner from partial results.
4. Keep the comparison policy separate from calculation rules: equal level/budget and common target are explicit comparison constraints. A shared combo may contain actions absent from one champion/build; return a compatibility diagnostic rather than silently substituting or omitting them.
5. A future comparison page may display different champions or different data versions, but must label incompatible assumptions. Normal same-scenario comparisons must use a common prepared data baseline; each page must not independently resolve `latest` halfway through evaluation.

The refactor includes a two-build isolation harness and reusable result contracts. The full comparison UI and comparison-specific product choices remain later work. Avoid premature cross-build result caches; scope any cache to immutable data/context or key it by all relevant inputs and revisions. The current per-simulation HP cache is not a safe general-purpose comparison cache.

### Reusable views with explicit lifecycle

Separate catalog query state, selected inspection record, and build editing state. Shared components receive a container, model and callbacks such as `onInspect(id)` or `onEquip(id)`; the page decides which actions exist. Do not introduce `isBuilder`/`isExplorer` switches throughout shared code.

Use instance-scoped DOM queries and unique control IDs so two item details, target editors or build summaries can coexist. Components expose update/dispose behavior; disposal removes listeners and invalidates pending view updates. Loading/error/empty states and latest-request-wins behavior belong to each instance. Dialog focus, keyboard dismissal and tooltip placement may share small browser helpers; page layout remains page-owned. Basic browsing should load catalog/detail capabilities without initializing the combo editor or fetching all advanced records.

## General-purpose functions and shared foundations

Extract utilities only when callers need the same semantics. Prefer standard JavaScript operations for trivial one-off work. A shared helper must have a precise name, narrow inputs and no hidden dependency on a larger feature.

| Foundation | Candidates and boundaries |
|---|---|
| General text/value helpers (`core`) | HTML text/attribute escaping where needed, regex escaping, finite-value predicates, explicitly defined numeric parsing. Preserve `0`, `false`, empty and unknown distinctions; avoid a universal conversion that silently defaults to zero. |
| Display formatting (`presentation`) | Number/percent/duration formatting and unavailable labels with explicit precision/units. Keep output rounding out of math. Percentage conversion needs an explicit source unit, not a guessed convention. |
| Catalog query helpers (`domain`) | Consistent search normalization and deterministic sort composition where item/champion semantics match. Item variant dedupe and equip rules remain item-specific. |
| Source helpers (`data`) | Record indexes, source-path/asset URL construction, localization lookup and provider-specific token aliases. Canonicalizing source identifiers must preserve collision behavior and provenance. These are not generic string utilities. |
| Calculation foundations (`engine`/`domain`) | Ranked-value access, typed damage packets, stat/effect contributions and result diagnostics. Champion growth, mitigation and formula hashing retain their game/source-specific ownership. |
| Browser primitives (`ui`) | Scoped dialog lifecycle, focus restoration, tooltip positioning and control binding. No game knowledge or catalog requests. |

Initial examples: move escaping out of `ItemDescriptions` so combo UI can use it directly; separate item HTML coloring/header decoration from item data access; split `CombatInputs` into descriptor discovery, context application and field rendering; separate `BuildStats` source parsing/merge policy from growth/attack-speed math. Keep champion/item-specific exceptions near the owning rule rather than hiding them inside a general helper.

Before consolidating superficially similar helpers, compare their unknown-value handling, units, rounding, token rules and callers. Presentation cleanup must preserve existing escaping/sanitization boundaries; coloring or stripping tags is not HTML sanitization. Do not introduce a catch-all `utils.js` or a broad shared module that causes every page to load all engines.

## Delivery phases and completion gates

### Phase 0 — Baseline and isolated workspace

Completed 1 October 2026. Local protection and restored-app verification are recorded in [REFACTOR-PROTECTION.md](REFACTOR-PROTECTION.md). Following explicit user approval and browser sign-in, both branches and the fixed baseline tag were published atomically to GitHub and verified against the saved checkpoint. The external protection manifest records the verified references; main was unchanged.

Carry out the preservation and isolation steps above. Record the snapshot, preserved local material, test environment and restoration instructions. Phase 1 then records the verification status of this exact snapshot.

**Gate:** the original application remains available, the isolated checkout matches the snapshot, and the baseline can be restored independently.

### Phase 1 — Behavior inventory and test baseline

**Completed:** [Phase 1 report and evidence](REFACTOR-BASELINE.md). The 201-test unit suite and all 28 browser runs passed; four additional numerical/catalog audit runs passed. The existing ability audit fails on an outdated six-slot readiness check. A diagnostic copy with that check corrected completed and reported unresolved tokens in 13 passives. These findings are preserved as baseline exceptions, not hidden by changing runtime behavior. Source and fixture integrity checks passed.

Map feature ownership, global dependencies, script order, public page URLs and dynamic asset/class usage. Record current behavior for champion selection, role changes, inventory, runes, conditional inputs, targets, abilities, attacks and combos. For each extraction candidate, record its single responsibility, actual inputs, side effects, state owner and expected consumers from the reuse matrix. Inventory useful dormant lookup behavior separately from its inactive page wiring.

Run the existing unit suite and applicable browser suites against the current root and preview apps, including advanced-data and unavailable-data paths. Capture fixture versions/checksums and representative output records for numerical comparisons. Select cases from existing coverage: role inventory preservation, champion switch races, missing formulas, recasts, on-hit effects, shared proc cooldowns and changing target health.

**Gate:** reproducible baseline results and known failures are recorded, along with a capability/dependency map and representative contracts. Existing inaccuracies remain explicitly identified; matching old behavior does not establish game accuracy.

### Phase 2 — Duplicate delivery cleanup and deletion triage

**Completed 2 October 2026:** [delivery ledger and verification](REFACTOR-PHASE2.md). Preview is generated from root source, all 38 tracked duplicate files were removed after byte parity checks, and Pages uploads a verified generated artifact. The 203 unit tests and 28 browser runs passed; representative cases matched the baseline in both modes and both routes.

Establish one authoritative runtime source. Generate the preview copy or a deploy artifact from that source, preserving existing routes and asset resolution. Choose the smallest mechanism that meets the current hosting needs; verify output parity before removing tracked duplicates.

For each deletion, record what it does, its callers and why it is unnecessary. Search references and check runtime paths, dynamic class generation and tests. Keep useful lookup behavior until its catalog/detail capabilities have been extracted and demonstrated independently in Phases 3–5. Only obsolete page wiring becomes eligible for retirement then; actual explorer restoration is a later feature. Consolidate helpers only when their semantics match. Keep fallbacks, source attribution and unsupported-result reporting unless explicitly superseded.

**Gate:** reduced duplicate maintenance, retained public routes, unchanged supported interactions, and evidence for each removed feature path or helper.

### Phase 3 — Extract reusable catalogs, input rules and data preparation

**Completed 2 October 2026:** [contracts and verification](REFACTOR-PHASE3.md). Headless browsing retains all 868 items and 173 champions, while Builder policy retains 236 items. Independent query/build/scenario instances, source metadata and existing rules are verified. All 213 unit tests and 28 browser runs passed, with exact baseline scenarios and a clean-source reproduction.

Extract source parsing and normalization from Builder and the lookup controllers, then catalog queries/recommendations, canonical input models and inventory/rank/rune rules. Separate inspection/query state from build state. Preserve read-only API caches, retry behavior, optional advanced-data fallbacks and latest-request-wins selection per consumer. Pull out small general-purpose helpers alongside their first real shared consumers rather than designing a utility library in advance.

Add explicit source metadata boundaries now, but keep full patch promotion/version-pinning work separately scoped. Do not silently change which source records or patches produce results during a structural extraction.

**Gate:** normalized inputs can be constructed without a page; a catalog/detail harness can browse champions and items without mounting Builder or silently editing a build; filtering does not discard the original catalog; current Builder selection behavior is unchanged. Two independent build input instances and two query instances coexist without interference.

### Phase 4 — Extract the calculation pipeline

Move stat orchestration, ability context/token resolution and combo action construction behind explicit interfaces, keeping existing shared engines where appropriate. Split evaluation from description/view-model construction even within currently shared files. Derive contexts through the same functions for panels, explorer experiments and combos, each with explicit inputs. Replace the temporary global target swap with per-run state and explicit step contexts. Preserve deliberate per-action state changes, such as remaining target HP in combo evaluation.

Prioritize the ability resolver only after captured source cases exercise aliases, forms, child spell selection, localization and unavailable values. Move one responsibility per change; avoid simultaneous formula rewrites and file moves.

Phase 1 prerequisite: repair the stale ability-audit readiness condition in a separate test-maintenance change and classify the diagnostic passive-token findings before extracting this resolver. The older zero-unavailable claim is not the current verification baseline.

**Gate:** representative builds and combo sequences run without browser APIs and match baseline values/statuses with documented tolerances. A two-build harness proves repeatability, order independence and no input mutation. The same ability/item with equivalent explicit inputs returns matching results through the Builder and explorer adapters. Unsupported/partial outcomes remain distinguishable. UI code no longer performs independent game calculations.

### Phase 5 — Split the interface and remove compatibility globals

Extract reusable list/detail views and controls for champion inspection, items, inventory, runes, targets, ability cards and combos. Keep page composition and workflows separate from shared renderers. Replace whole-page IDs and global subscriptions with container-scoped instances, explicit callbacks and disposal. Maintain an explicit application state/update path and render derived view data. Preserve focus, keyboard controls, tooltip placement, dialog dismissal and desktop/mobile layout.

Migrate test loaders and production entry points together when converting to native ES modules. Remove compatibility wrappers only after their consumers have migrated. Split CSS by stable component ownership after its live selectors have been mapped.

**Gate:** a small browser integration harness mounts two independent build summaries/edit controls and catalog detail panels without loading Builder's page controller. Changing or disposing one instance does not alter the other. Basic browsing works when advanced data is unavailable. Page entry points only assemble the application; no feature relies on an unrelated controller's internal globals; browser workflows and static-host paths pass. No complete new product page is required for this gate.

### Phase 6 — Release verification and handover

**Completed 8 October 2026:** [handover and evidence](REFACTOR-PHASE6.md), [source-bound release proof](phase6-release.json), [verified publication](phase6-publication.json), and [extension guide](EXTENDING.md). The tested release is published to the separate refactor preview; production promotion remains a separate decision.

Run the complete relevant regression matrix, compare outputs to the recorded baseline, check load/interaction performance against baseline, and review all deletions. Generate a runtime-only deployment artifact and make deployment depend on successful required checks before promotion. Keep hosting-provider migration outside this refactor.

Update architecture, test instructions, contribution guidance and the roadmap. Document how to add one effect rule, one data adapter and one UI panel, and how an explorer or comparison page composes existing capabilities. Keep the catalog, two-build and multi-instance harnesses as meaningful integration coverage. Review public interfaces for unnecessary Builder-specific assumptions and remove transitional wrappers only after all consumers have migrated.

**Gate:** no unexplained behavioral or numerical differences, no duplicated editable runtime tree, reproducible checks, documented module ownership and a rehearsed rollback. Promote only the tested artifact.

## Verification and review rules

- Unit tests protect calculations, normalizers and rule boundaries. Add focused characterization tests where extraction exposes a real coverage gap; avoid tests that only assert a new file layout.
- Existing browser suites protect integration, asynchronous behavior and layout. Execute affected suites per change and the complete relevant matrix before release.
- Compare numerical results and unavailable/warning statuses, not just rendered screenshots. Preserve current combo zero-fallback warnings as documented behavior during this refactor; changing them is a separate decision.
- Reuse checks must exercise behavior: browsing without a build, partial-context effect evaluation, identical results from equivalent contexts, A/B/A evaluation, independent target/cooldown/stack progression, independent request races, and mount/update/dispose of simultaneous UI instances. Do not substitute import/file-count checks for these cases.
- Comparison readiness includes stable metric/action IDs and units, preserved precision, explicit incompatible-action diagnostics, and a shared data baseline. Tests should not require the future comparison page to exist.
- Keep live-source checks separate from reproducible fixture tests. A passing fixture suite does not prove compatibility with a newly published patch.
- Track reduced cross-module globals, duplicated responsibilities and ease of isolated testing. Lines deleted and file count are supporting measures, not success criteria.
- Avoid circular imports, hidden state mutation, speculative abstraction and unrelated feature work. Each change should explain its boundary, preserved behavior and validation evidence.

## Planning-pass verification

During the initial planning pass, the existing `tests/*.test.cjs` suite completed successfully on 30 September 2026 using the bundled Node runtime. Root/preview file comparison found no mismatches. The revision inspected the lookup controllers, catalog policies, item descriptions/data, combat inputs, stat helpers, API client and Builder/combo integration; it did not rerun runtime tests because only this plan changed. Browser and live-data suites were not run in either documentation-only pass; full baseline certification remains Phase 1. The default shell resolves Node to a Brackets installation and did not expose npm, so implementation should record a supported Node 20+ runtime explicitly.

## Suggested first implementation slice

Complete baseline protection and the behavior/capability inventory first, then remove manual root/preview duplication in a standalone change. Next extract item/champion data preparation and catalog query functions, demonstrate independent browsing, and separate build/scenario inputs. Prioritize a proven vertical slice (repository → catalog query → detail model → isolated view) over moving every function into a new folder. Follow with the two-build evaluation slice before undertaking broad UI decomposition. This establishes real reuse before touching the highest-risk ability resolver paths.

Treat each phase as a milestone with several small changes rather than one large merge. Estimate delivery after the dependency inventory and browser baseline reveal the actual coverage gaps.
