# Testing

## Unit regressions

Requires Node 20 or newer, no package installation:

```sh
npm test
```

The tests cover patch selection, request retry/deduplication, missing champion stats, malformed ranks, incomplete/circular/conditional formulas, stat sources, HTTPS artwork URLs, zero resource costs, item stat fallback, growth and attack-speed math.

## Browser regressions

Ability DPS has an additional fixture-backed browser suite: `npm run test:dps`. Run with and without `ADVANCED_DATA=1` using the same environment below. See [DPS.md](DPS.md) for its coverage and timing conventions.

Install Playwright separately (`npm install --no-save playwright`, then `npx playwright install chromium`) or point `PLAYWRIGHT_PATH` at an existing package and `BROWSER_PATH` at an existing Chromium/Edge executable.

Download fixtures first:

```sh
python scripts/download-test-data.py
npm run test:browser
```

`FIXTURES_DIR` may override `tests/fixtures`. The downloader preserves already-downloaded files; remove the fixture directory deliberately when changing patches. Game data is not committed.

The default suite uses captured Data Dragon payloads, replaces artwork with neutral placeholders, and responds with HTTP 503 for Community Dragon. Set `ADVANCED_DATA=1` for both the downloader and browser suite to exercise captured Community Dragon payloads as well. These fixtures are used only by tests; the application fetches its data from the public APIs.

The advanced suite includes numeric checks for Cho'Gath's Feast and Seraph's tooltip. Unit tests also use a small, attributed `calculation-excerpts.json` containing source formula excerpts. No production HTML imports this file.

Run `node tests/calculation-audit.cjs` with the same `FIXTURES_DIR` to inventory every calculation record. Optional `AUDIT_OUTPUT` writes the detailed JSON report. Numeric coverage measures interpreter execution with an artificial build at rank 3, level 18; it is not an in-game correctness score. Conditional mechanics, combat inputs and the selection of the right spell record need separate validation.

Optional `SCREENSHOT_DIR` saves a Builder screenshot. The screenshot contains placeholder artwork and is layout evidence only.

## Manual/live validation still required

Run `python -m http.server 8000` from the repository root. Visit `http://127.0.0.1:8000/main.html`. Verify current Community Dragon access, compare supported calculations to the current game patch, and exercise the remaining items in `AUDIT.md` before declaring game-level correctness.


## Combat input audit

After downloading with `ADVANCED_DATA=1`, run `npm run test:combat` with the same `FIXTURES_DIR`. This uses the production input-discovery and context functions, supplies both active and inactive scenarios and asserts that no required input lacks a control. Three named source defects are allowed; any new one fails. Set `AUDIT_OUTPUT` to save the complete result. The browser suite also edits real input controls and verifies that displayed results update.


## Actual ability tooltip audit

Run `node tests/ability-audit.cjs` with `ADVANCED_DATA=1`, `FIXTURES_DIR` and the browser runtime variables above. The audit calls the real tooltip resolver for all champions and records unavailable tokens at every permitted rank across four levels. `AUDIT_OUTPUT` selects a JSON destination. See `ABILITY-UNAVAILABLE.md` for the current human-readable findings. Synthetic target values used by the separate engine audit are never applied in the Builder's formula-only target mode.

## Champion stat effects

Run `ADVANCED_DATA=1 node tests/champion-effects.cjs` with the same fixture/browser environment as the browser suite. Checks cover stack-to-stat changes, bonus health, range caps, rank changes, repeated computation, clearing values, resistance states, unique input ownership, and repaired numeric tooltips. The advanced downloader now includes the live localization table. `node tests/ability-audit.cjs` verifies actual tooltip resolution, including all five Aphelios R weapon variants.

## On-attack calculations

`npm run test:attacks` uses the same Playwright/browser and fixture variables as the other browser suites. Run with `ADVANCED_DATA=1` for live formula excerpts and with it unset for API-failure fallback. It checks numerical examples, labels/hover text, Kog'Maw's actual button, target health controls, all champion control configurations, and registered effects available in the item catalog. `SCREENSHOT_DIR` writes an attack-panel screenshot. `AUDIT_OUTPUT` writes per-champion results. `npm test` also runs the standalone numerical tests in `tests/attack-effects.test.cjs` without downloads.

`tests/attack-interactions.test.cjs` adds arithmetic regressions using the captured formula excerpts in `attack-interactions.json`: multi-hit item combinations, earned crit, forced-crit overlap, replacement attacks, true conversion, amplification scope and refreshed poison. The advanced attack browser audit now rejects partial or non-finite results for all 173 configured champions and tests the real Aphelios weapon selector and Elise form button. Inputs in that audit are synthetic scenarios, not recommended gameplay values.

## Compact dashboard

`npm run test:dashboard` uses the same captured fixtures and Playwright/browser environment. It checks that the 1440×900 desktop has no page overflow, Aatrox's full Q results fit in the card, the selected rune picker works, descriptions dismiss with Escape, champion selection changes the splash URL, and mobile has no horizontal overflow. Screenshots are written to the ignored fixture screenshots directory; artwork is replaced by neutral placeholders, so these images validate layout rather than the remote artwork itself. Narrow or short viewports stack panels; unusually large sets of combat inputs can scroll within their panel. Calculation and description overlays keep the main dashboard stationary.
