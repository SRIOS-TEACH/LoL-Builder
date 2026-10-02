# Refactoring action list

Updated: 2 October 2026. Phases 0–2 are complete with the documented baseline exceptions. Phase 3 is next; runtime calculations remain unchanged.

This is the working checklist for [the refactoring plan](REFACTOR-PLAN.md). Check an action only after its work and verification are complete. Record the completion date and supporting test results or commit beside completed future actions. A phase is complete only when its gate passes. Keep the protected baseline fixed; make new changes on `codex/modular-refactor`.

## Phase 0 — Protect the working application

- [x] P0.1 Preserve the existing source, README changes, roadmap and baseline reports in a saved checkpoint.
- [x] P0.2 Create the fixed baseline tag and the separate baseline and refactoring branches.
- [x] P0.3 Create a separate managed refactoring checkout.
- [x] P0.4 Back up repository history, ignored fixtures and baseline captures; verify archive checksums.
- [x] P0.5 Restore fixtures into the refactoring checkout and verify its application against the baseline.
- [x] P0.6 Restore the baseline independently from the backup and check repository integrity and unit tests.
- [x] P0.7 Publish both branches and the baseline tag to GitHub; verify their exact saved commits.
- [x] P0.8 Record recovery instructions and make the preserved baseline available for local testing.
- [x] P0 gate: original application remains available, isolated checkout matches the snapshot, and independent restoration works.

Completed 1 October 2026. Saved commit: `16d63581c385b07c7c6b3fae70f6ed9365d0b3b1`; tag: `baseline/pre-refactor-2026-09-30`. GitHub references were verified. Restoration passed 201 unit tests; the refactoring checkout also passed the broad advanced browser check and matched all five representative case records. See [protection and recovery](REFACTOR-PROTECTION.md) and the external backup's protection manifest.

## Phase 1 — Record behavior and reuse boundaries

- [x] P1.1 Inventory source files, page routes, script ordering, assets and dynamic classes.
- [x] P1.2 Map capabilities, dependencies, global state and side effects.
- [x] P1.3 Define responsibility and input/output boundaries for Builder, item/champion explorers and build comparison.
- [x] P1.4 Inventory reusable dormant lookup logic separately from obsolete page wiring.
- [x] P1.5 Freeze fixtures and capture source/data versions, hashes and the test environment.
- [x] P1.6 Run unit and root/preview browser checks, including advanced-data and fallback paths.
- [x] P1.7 Capture representative numerical and interaction results for later comparisons.
- [x] P1.8 Record audit failures, unsupported inputs, unresolved tokens and baseline limitations.
- [x] P1 gate: behavior evidence, known failures, dependency map and proposed contracts are recorded reproducibly.

Completed 1 October 2026. All 201 unit tests and 28 browser runs passed, as did four supplementary audits. The original ability audit has an outdated six-slot readiness check; the corrected diagnostic reported unresolved tokens in 13 champion passives. These remain documented exceptions, not resolved defects. See [the baseline report](REFACTOR-BASELINE.md) and [captured evidence](refactor-baseline/).

## Phase 2 — Remove duplicate maintenance carefully

- [x] P2.1 Confirm the authoritative runtime source and choose the smallest preview/deployment generation mechanism.
- [x] P2.2 Generate preview or deployment output from that source while preserving public routes and relative assets.
- [x] P2.3 Verify generated output parity before removing tracked duplicate files.
- [x] P2.4 Create a deletion ledger with each candidate's purpose, callers, runtime references and supporting checks.
- [x] P2.5 Remove only proven redundant code; retain reusable lookup behavior, fallbacks, attribution and unsupported-result reporting.
- [x] P2.6 Review equivalent helpers and consolidate only where justified after comparing units, rounding, unknown values and caller semantics.
- [x] P2 gate: one source reduces maintenance, public routes and supported interactions are retained, and every deletion has evidence.

P2.1–P2.6 completed 2 October 2026; see [delivery and deletion evidence](REFACTOR-PHASE2.md). Generated-file parity passed before removal. Helper review identified extraction candidates without merging different contracts. The phase gate passed: 203 unit tests and 28 browser runs passed; 20 representative-case comparisons matched the baseline exactly. Artwork attribution remains in generated output.

## Phase 3 — Reusable catalogs, inputs and data preparation

- [ ] P3.1 Extract source loading, parsing and normalization into explicit champion and item data capabilities.
- [ ] P3.2 Extract catalog queries and recommendations; keep the full catalog separate from Builder eligibility filters.
- [ ] P3.3 Extract canonical build/scenario inputs and inventory, ability-rank and rune rules.
- [ ] P3.4 Separate explorer query/inspection state from build state.
- [ ] P3.5 Preserve read-only caches, retries, advanced-data fallbacks and latest-request handling independently for each consumer.
- [ ] P3.6 Carry source metadata across boundaries without changing data patches or calculation inputs.
- [ ] P3.7 Extract general-purpose helpers with real shared consumers and consistent semantics.
- [ ] P3.8 Demonstrate champion/item browsing and detail lookup without mounting Builder.
- [ ] P3.9 Verify two independent build-input instances and two query instances; confirm Builder selection parity and no catalog mutation.
- [ ] P3 gate: reusable data and inputs work independently, retain the full catalog, and preserve existing behavior.

## Phase 4 — Explicit calculation pipeline

- [ ] P4.1 Repair the stale ability-audit readiness check in a separate change and classify the unresolved passive tokens.
- [ ] P4.2 Cover aliases, forms, child records, localization and unavailable data before extracting resolution logic.
- [ ] P4.3 Extract stat orchestration and calculation context with explicit inputs and outputs.
- [ ] P4.4 Separate source-token/formula resolution from presentation.
- [ ] P4.5 Extract combo action construction from UI state.
- [ ] P4.6 Replace temporary global target changes with independent per-run scenario and health-step state.
- [ ] P4.7 Return structured, full-precision results with partial and unsupported statuses preserved.
- [ ] P4.8 Compare headless calculations against baseline records with documented tolerances.
- [ ] P4.9 Verify A/B/A evaluation, input immutability and equivalent Builder/explorer contexts.
- [ ] P4 gate: calculation capabilities run without a page and produce equivalent results without shared mutable build state.

## Phase 5 — Reusable UI and page composition

- [ ] P5.1 Extract champion/item lists and details as components with scoped containers and explicit callbacks.
- [ ] P5.2 Extract inventory, rune, target, ability and combo controls while keeping page workflows separate.
- [ ] P5.3 Define component update/disposal behavior and remove reliance on global page IDs or Builder state.
- [ ] P5.4 Preserve focus, keyboard access, dialogs, tooltips and responsive interactions.
- [ ] P5.5 Demonstrate two independent sets of controls/details without Builder; verify updates and disposal do not interfere.
- [ ] P5.6 Verify fallback browsing and all page/script/asset paths.
- [ ] P5.7 Migrate entry points and test loaders together to native modules after consumers are ready.
- [ ] P5.8 Remove migrated global wrappers and obsolete page wiring; remove CSS only with mapped usage evidence.
- [ ] P5 gate: reusable components compose independently and current application interactions remain equivalent.

## Phase 6 — Verify and hand over

- [ ] P6.1 Run relevant regressions and compare numerical results, statuses, layout and performance against the baseline.
- [ ] P6.2 Review the deletion ledger and explain every intentional behavior difference.
- [ ] P6.3 Produce a runtime-only deployment artifact and make required checks gate deployment.
- [ ] P6.4 Update architecture, testing, contributor and roadmap documentation.
- [ ] P6.5 Document how to add data, effects and UI, and how explorers and build comparison compose the shared capabilities.
- [ ] P6.6 Retain meaningful reuse/isolation harnesses and reproduce checks from a clean checkout.
- [ ] P6.7 Rehearse rollback to the protected baseline.
- [ ] P6.8 Publish the tested refactoring artifact when ready.
- [ ] P6 gate: one source, reproducible checks, documented ownership, no unexplained changes and verified recovery.

Complete explorer pages, the build comparison product, new mechanics and fixes to baseline calculation behavior remain separate feature work unless explicitly added to scope.
