# Phase 4 — Explicit calculation pipeline

Implemented 6 October 2026 on codex/modular-refactor. This phase preserves the saved application behavior and known data limitations. The protected baseline and main application remain separate.

## Ownership and reusable contracts

| Capability | Owns | Explicit inputs / outputs |
|---|---|---|
| engine/buildEvaluation.js | Item/rune totals, passive stat ledger, champion/item stat application, attacks and stat contributions | One input snapshot and prepared source records; full-precision derived stats and attack packets |
| engine/combatContext.js | Formula input discovery and applying explicit combat values | Sources, base context and values; descriptors or an independent context |
| engine/calculationContext.js | Build/scenario context for formulas, external references and item counts | Build, target/time and prepared data; context closures tied to this run |
| engine/abilityResolution.js | Ranked values, canonical token candidates, qualified aliases, localization and formula resolution | Spell/rank/slot and run context; semantic numeric/text rows and diagnostics |
| engine/itemEvaluation.js | Source item template expansion, section interpretation, token evaluation and typed damage outcomes | Item, advanced source, strings and calculation context; numeric outcomes and status |
| engine/calculationPipeline.js | Composition for a build, primary/alternate abilities and on-hit results | BuildInputs, ScenarioInputs and data; evaluateBuild, evaluateAbility and evaluateAlternate |
| engine/comboEvaluation.js | Action construction, selection/overrides and sequential target-health evaluation | Build/scenario/data plus edited steps; independent catalog or full-precision timeline |
| presentation/abilityPresentation.js | Ability/passive descriptions and legacy token HTML | Structured resolution results and an evaluation context; formatted descriptions |
| presentation/damagePresentation.js | Damage/DPS tables | Already evaluated damage packets; display HTML |
| shared/itemDescriptions.js | Item display, including existing Muramana explanatory prose | ItemEvaluation results; formatted description/section views |

Existing BuildStats, Calculations, TargetDamage, ChampionEffects, AttackEffects, RuneEffects, AbilityDps, AbilityOnHit and ComboTester remain the underlying engines. This is extraction and composition, not a formula rewrite. CombatInputs retains its browser control renderer and delegates pure discovery/application to CombatContext. AbilityDps retains a compatibility render method that delegates to DamagePresentation.

The pipeline copies only canonical build fields and the explicit scenario. It shares prepared sources as read-only data. It neither fetches data nor mounts a page. The public data record contains champion, championRaw, abilities, items, advancedItems, runes, strings and optional stringsReady/stringsLoading. Page selection, modal state, caches and query filters never become calculation inputs.

Create inputs with BuildInputs/ScenarioInputs and prepare sources with Phase 3 repositories before evaluation. readBuildInputs copies an already validated build without changing its ranks; createBuildInputs applies ordinary input validation. This distinction preserves the captured calculator behavior.

## Using the capabilities

A Builder panel, champion explorer experiment and build comparison can all construct the same evaluation:

    const run = CalculationPipeline.create({build, scenario, data});
    const summary = run.evaluateBuild();
    const ability = run.evaluateAbility(data.champion.spells[0], build.abilityRanks.q, 'q');
    const alternate = run.evaluateAlternate(data.champion.spells[0], build.abilityRanks.q, 'q');
    const item = ItemEvaluation.evaluate({id, item: data.items[id],
      source: data.advancedItems[id], strings: data.strings,
      context: run.stats.calculationContext(run.stats.getComputedChampionStatsForTooltips())});
    const result = ComboEvaluation.evaluate({build, scenario, data, steps});

An explorer supplies an independent experimental build; it does not read another page's selection. A comparison tool evaluates A and B independently. A combo uses a new per-step context for the current target HP and keeps its cache local to that run. No temporary assignment to Builder.target remains. Override damage/type/timing and custom actions retain the existing scheduler semantics, including missing values counted as zero with warnings and overkill counted in totals.

Primary ability results expose damage before on-hit additions and onHitDamage after supported additions, so callers cannot accidentally add item packets twice. Alternate forms retain their original rank rules and explicitly report unavailable source/text data. Combo action catalogs deliberately retain separate explicit item/passive triggers; they do not silently adopt a panel's on-hit total.

## Precision, availability and presentation

Numeric token rows contain kind, numeric, status, token and available diagnostics/calculation data. Missing results have numeric null and unsupported status; intentional omission is distinct from zero. Ability/build/item/combo results retain ready, partial or unsupported outcomes; unlearned abilities are explicit. Legacy Builder wrappers translate missing rows back to the prior null/HTML contract until Phase 5 removes compatibility globals.

Numeric fields retain precision. Token numeric values use the existing tooltip units: percentage display calculations retain isPercent and the underlying formula result, rather than changing percent/fraction conventions. Formatting and explanatory strings never become authoritative numeric input. Source-authored tags still identify damage types; generated result HTML is not parsed to recover numbers. Optional presentToken and presentItemSection annotations restore the existing profile/combo explanations without replacing numeric results. A dedicated test verifies that presentation callbacks cannot replace authoritative token or combo numbers.

Stat-ledger explanations and source section labels remain descriptive metadata. Unsupported effects do not become modeled because their tooltip text is available. ItemEvaluation interprets source templates separately from ItemDescriptions presentation. Builder now calls the same calculation pipeline for primary/alternate abilities and on-hit composition.

## Prerequisite audit and baseline limitations

Commit eed9f77 separately repairs the obsolete six-slot ability-audit startup check to the current ready, seven-slot inventory. The repaired audit covers all 173 fixture champions at four levels and every permitted rank. Its report exactly matches the preserved diagnostic: 30 unresolved calls across 13 passive descriptions. Ten are dynamic localization keys, one an interface hotkey and nineteen unexported script/effect values. See [classification](phase4-ability-classification.json) and [current report](ability-unavailable.json).

These are resolver-call findings, not a count of final visible unavailable markers. No unsupported mechanic or source defect was repaired. The Runaan variant circular reference and K'Sante missile helpers remain documented limitations. Aphelios has no primary Q payload in the saved extraction; that absence is retained rather than fabricated. Existing root-first selection, child scoring, first alias collision and qualified-token fallback semantics remain unchanged.

Focused tests cover aliases, canonical names, sentinel rank arrays, multipliers, alternate references, root/child selection, nested localization, absent advanced data, missing formulas, full precision, omitted values, immutable inputs and A/B/A order independence. Real Jayce, Elise, Nidalee and Aphelios fixtures exercise form/alias source preparation.

## Verification

The headless harness imports only reusable capabilities. It has no window, document, fetch, Builder adapter or emulated page. Run node scripts/verify-calculations.cjs with FIXTURES_DIR; CALCULATION_OUTPUT selects the report. [Saved headless evidence](phase4-headless.json) records ten advanced/fallback baseline cases, unrounded combo results and source hashes. Stats and attack records match exactly. Ability numeric fields, labels, packet types and statuses match with relative/absolute tolerance 1e-9. Formula explanations are presentation metadata and are compared separately by browser characterization.

The original baseline recorded combo display precision, not unrounded combo totals. Headless comparisons therefore require the exact saved one-decimal damage/HP and two-decimal duration, with matching warning states; current unrounded results are retained in the report. The browser characterization compares all five complete saved case records in both data modes and both generated routes exactly.

All 223 unit tests, 28 browser runs and 20 exact complete-case comparisons passed. The repaired audit retains the same 30 findings, and the combat audit has no new source issues. A clean saved-source archive passed the unit suite, build and ten headless cases. The final binding/normalization cleanup also passed 22 focused tests and five exact advanced case comparisons. See [verification summary](phase4-verification.json) and [checked action list](REFACTOR-ACTIONS.md). Six final combo/passive browser follow-ups and another 20 exact comparisons passed after preserving the original combo explanation text. Publication uses the existing test-gated refactor preview workflow; there is no production application merge.

## Remaining work

Phase 5 owns component scoping, page composition, native-module/test-loader migration and removing compatibility globals. The pure engines currently use the established global/CommonJS export conventions; callers load the documented dependencies in order. Complete explorer/comparison products and game accuracy changes remain separate feature work.
