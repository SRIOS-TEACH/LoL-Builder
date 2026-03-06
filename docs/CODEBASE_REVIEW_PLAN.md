# LoL-Builder Codebase Review and Consolidation Plan

## Scope and review method

This review focuses on **code quality**, **structure**, **redundancy**, and **documentation maturity** across the main app surfaces:

- `JS/builder.js`
- `JS/itemLookup.js`
- `JS/champLookup.js`
- HTML entry points (`Builder.html`, `itemLookup.html`, `champ.html`, `main.html`)
- top-level project documentation (`README.md`)

The review is static (source inspection) and does not attempt to alter behavior.

---

## Executive summary

The project is functional and already includes meaningful inline comments in key files, but maintainability risk is growing due to:

1. **A very large, mixed-responsibility `builder.js` file (1,700+ lines).**
2. **Cross-file coupling through global state and `window` APIs** (`window.ItemLookupShared`).
3. **Repeated API-fetch/bootstrap patterns and repeated UI shell markup** across pages.
4. **Direct DOM-manipulation and inline HTML event handlers** that make behavior harder to trace and test.
5. **Inconsistent documentation depth** (good in `itemLookup.js`/`champLookup.js`, sparse in `builder.js`).

A phased consolidation plan is proposed below to improve structure without risky rewrites.

---

## Detailed findings

## 1) Structure and modularity concerns

### 1.1 `builder.js` is monolithic and mixes domains

`builder.js` currently contains many distinct concerns in one file: data loading, champion selection modal logic, item modal logic, runes, passive parsing, ability formula evaluation, and stat rendering. This creates high cognitive load and slows safe changes.

**Impact**
- Harder onboarding and code review.
- High regression risk for unrelated edits.
- Difficult to unit test isolated behavior.

### 1.2 Shared logic exists, but interface boundaries are weak

There is a positive step toward reuse via `window.ItemLookupShared`, but it relies on globals and optional fallbacks from Builder (`getItemLookupShared`, `isPurchasableBuilderItem`, `dedupeBuilderItems`). This blurs ownership and can drift over time.

**Impact**
- Behavior can diverge subtly between pages.
- Harder to reason about source-of-truth for item rules.

---

## 2) Redundant or repeated patterns

### 2.1 Repeated bootstrap fetch flow across pages

Multiple controllers independently fetch Data Dragon versions and then fetch endpoint-specific payloads. This is repeated in `champLookup.js`, `itemLookup.js`, and `builder.js`.

**Opportunity**
- Create a shared data client (`getLatestVersion`, `fetchChampionIndex`, `fetchItemIndex`, etc.) with common error handling and retry behavior.

### 2.2 Repeated navigation shell in static HTML pages

The navbar structure is duplicated in each HTML page. Any nav label/link update requires editing multiple files.

**Opportunity**
- Move shared nav into a small JS/HTML partial injection helper or a lightweight template step.

### 2.3 Repeated inline handler style

`Builder.html` relies heavily on `onclick="..."` attributes for modal and interaction actions.

**Impact**
- Event wiring split between HTML and JS.
- Harder to search interactions and to test event registration.

**Opportunity**
- Standardize on JS-side `addEventListener` wiring during init.

---

## 3) Code quality and maintainability risks

### 3.1 Global mutable state objects are large and untyped

`BUILDER` and `ITEM_STATE` are effective for prototyping but provide no schema validation and no guardrails on mutation.

**Impact**
- Hidden side effects.
- Harder debugging when state transitions are implicit.

### 3.2 Long functions with mixed responsibilities

`loadBuilderData`, render/selection functions, and ability/passive parsing paths include heavy logic branches and direct DOM writes in the same blocks.

**Impact**
- Difficult to isolate bugs.
- Increases coupling between data and presentation.

### 3.3 String-based HTML assembly everywhere

Large portions of UI are assembled via template strings and assigned through `innerHTML`.

**Impact**
- Hard to maintain complex markup.
- Raises accidental XSS risk if any upstream payload assumptions change.

---

## 4) Documentation quality review

### 4.1 Positive areas

- `README.md` is clear on project goals, run instructions, and data sources.
- `itemLookup.js` and `champLookup.js` include useful file-level and function comments.

### 4.2 Gaps

- `builder.js` has minimal JSDoc coverage despite being the most complex module.
- No architecture-level docs explaining data flow across pages and shared logic boundaries.
- No contributor-focused conventions (state ownership, naming, expected function shape, error-handling approach).

---

## Prioritized improvement plan

## Phase 0 (quick wins, 1-2 days)

1. **Document architecture and boundaries**
   - Add `docs/ARCHITECTURE.md` with page responsibilities and shared module ownership.
   - Add `docs/CONTRIBUTING.md` with conventions for state, DOM updates, and fetch error handling.

2. **Add module headers in `builder.js`**
   - Create clear section headers and top-level responsibility notes for each major block (runes, item modal, ability evaluation, rendering).

3. **Standardize error/status messaging**
   - Introduce a single helper for network failure messaging and fallback behavior across pages.

## Phase 1 (safe structural refactor, 3-5 days)

1. **Extract shared data API helpers** into `JS/shared/apiClient.js`
   - `fetchLatestVersion()`
   - `fetchChampionIndex(version)`
   - `fetchChampionDetails(version, key)`
   - `fetchItemIndex(version)`
   - `fetchCommunityDragonItems()`

2. **Extract shared item policy helpers** into `JS/shared/itemPolicy.js`
   - Purchasability filter
   - Map-priority dedupe
   - Token/formula utility functions that are pure and page-agnostic

3. **Reduce globals by introducing explicit module exports**
   - Keep a small compatibility layer for current pages.
   - Replace `window.ItemLookupShared` dependency with explicit imports (or staged namespace wrapping if no bundler).

## Phase 2 (builder decomposition, 1-2 weeks)

Split `builder.js` into focused modules while preserving behavior:

- `builder/state.js` (state container + mutators)
- `builder/dataLoader.js` (all network/data merge)
- `builder/championModal.js`
- `builder/itemModal.js`
- `builder/runes.js`
- `builder/abilities.js` (formula evaluation + rendering helpers)
- `builder/stats.js`
- `builder/passives.js`
- `builder/index.js` (bootstrap only)

**Success criteria**
- No module exceeds ~300-400 lines.
- Rendering and data logic are separated enough to unit-test pure helpers.

## Phase 3 (quality gates and docs maturity, 3-5 days)

1. **Introduce linting/formatting**
   - ESLint + Prettier with basic browser-safe config.

2. **Add targeted unit tests for pure helpers**
   - `dedupeByNameWithMapPriority`
   - formula token resolution and calculation conversion
   - ability level/rank constraints

3. **Add smoke checks in CI**
   - `node --check` on all app JS files
   - optional lightweight headless smoke test for page bootstrap

4. **Write maintenance docs**
   - `docs/DATA_SOURCES.md` (what each external payload is used for)
   - `docs/TESTING.md` (what to run before commits)

---

## Consolidation roadmap by risk

### Low risk
- Documentation files
- Section headers and naming cleanup
- Shared helper extraction without behavior changes

### Medium risk
- Event handler migration from inline attributes to JS wiring
- Introducing centralized API client with consistent error paths

### High risk
- Ability/passive formula evaluator refactors
- Large-scale state model changes

Recommendation: execute in **small PRs**, one concern at a time, with before/after behavior checks on the three user flows (champ lookup, item lookup, builder).

---

## Suggested milestones

1. **Milestone A:** docs baseline + lint config + quick sectioning in `builder.js`.
2. **Milestone B:** shared API/item policy modules and reduced duplication.
3. **Milestone C:** builder module split with no UX changes.
4. **Milestone D:** unit tests for pure logic and CI checks.

---

## Definition of done for the consolidation effort

- No major page controller exceeds agreed size threshold.
- Shared logic exists in one place with clear ownership.
- Documentation includes architecture, contributor workflow, and testing guidance.
- At least core pure helpers are unit-tested.
- All three workflows continue to function with no visual regressions.
