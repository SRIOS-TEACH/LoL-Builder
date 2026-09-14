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

## Passive descriptions, growth and Spellblade

`npm run test:passives` uses the advanced fixtures and browser environment above. It checks real AD growth, Ezreal's five-stack attack speed, Aurora's four-spirit healing and percentage-health damage description, Muramana's separate passives and melee/ranged values, independent passive toggles, Spellblade activation synchronization, default/minimum proc intervals, and Warmog's item-only health amplification. It also checks that the Passives window has one card and toggle per effect and that item details contain calculated prose without the raw Effects table.

The unit suite includes focused source regressions in `ad-growth.test.cjs`, `champion-passives.test.cjs` and `item-descriptions.test.cjs`. With advanced fixtures downloaded, run `AUDIT_ITEM_DESCRIPTIONS=1 node --test tests/item-descriptions.test.cjs` and repeat with `AUDIT_ITEM_DESCRIPTIONS=melee` to audit the selectable item catalog. The 16.18.1 snapshot resolves all 236 descriptions in both contexts and retains all 34 named active descriptions. This checks text resolution with a synthetic build, not complete combat simulation coverage. See [ON-ATTACK.md](ON-ATTACK.md) for the modeled attack effects.

## Manual/live validation still required

Target settings have a fixture-backed UI suite: `npm run test:targets`. Use the same advanced fixtures and browser environment above. It verifies physical/magic/true/mixed damage, penetration, target-health scaling, descriptions and controls; see [TARGETS.md](TARGETS.md) for coverage and assumptions. `TARGET_SETTINGS=1 ADVANCED_DATA=1 npm run test:dps` adds a full-champion target-enabled audit that rejects damage-type regressions.

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

`npm run test:dashboard` uses the same captured fixtures and Playwright/browser environment. It checks that the 1440×900 desktop has no page overflow, simple Data Dragon descriptions switch inline to detailed text, full rune grids are present, the seventh slot accepts/removes quest items and rejects regular items, champion titles render, and skin selection changes the splash URL, and mobile has no horizontal overflow. Screenshots are written to the ignored fixture screenshots directory; artwork is replaced by neutral placeholders, so these images validate layout rather than the remote artwork itself. Narrow or short viewports stack panels; unusually large sets of combat inputs can scroll within their panel. Calculation overlays keep the main dashboard stationary. Detailed ability descriptions replace the simple text inside the card; long descriptions and complex results can scroll within the card.

## Role quest controls and compact damage

The quest slot offers Top, Mid, Bot, Support and Jungle (source records 1200–1204). Selecting Top unlocks levels 19–20 and base-stat growth through 20; ordinary ability rank caps remain unchanged. Mid unlocks tier-three boots 3170–3176, including Gunmetal Greaves despite its missing Boots tag. Bot adds an eighth UI slot (six regular items, quest, boots), relocates equipped boots, and restricts that slot to boots. Changing away from Bot returns boots to a free regular slot or leaves the role unchanged with an explanation if full. Leaving Mid downgrades tier-three boots to their source recipe's boots. These are build-selection unlocks; quest progress, XP, gold, Smite and ward simulations are not added.

The dashboard browser test covers the five-role catalog, level growth, Mid boots, Bot relocation/restrictions and full-inventory preservation, equal Q/W/E/R dimensions, compact damage, and the detailed-only Damage table with Part/Damage/DPS columns. Long detailed content can scroll inside a fixed-size card. Run the standard unit, attack, DPS and full browser suites as well.

## Champion and item pickers

`npm run test:pickers` checks both picker search fields, drag-out versus genuine backdrop clicks, fixed search/detail positions while result grids scroll, readable icon filters, and the Recommended tab using Aurora's captured game data. Startup tests hold rune and Community Dragon item responses pending while exercising the pickers, then fail those optional requests and verify the build remains usable. `tests/picker-data.test.cjs` covers versioned HTTP caching, shared request coalescing/retry, and recommendation context/catalog filtering.

Picker readiness requires the Data Dragon champion and item indexes; rune choices and advanced item calculations arrive separately. Recommendations come from matching Summoner's Rift CLASSIC `ItemRecommendationOverrideSet` records, with Data Dragon sets as a fallback, and are filtered through the current catalog and role restrictions. No inferred recommendations are shown when those records are absent. Screenshots use placeholder artwork. Long details have their own overflow region and never move the search bar or results frame.
