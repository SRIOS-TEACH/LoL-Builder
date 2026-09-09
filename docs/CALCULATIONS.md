# Calculation audit — 2026-09-09

## Runtime data

The application requests the latest Data Dragon version, then its champion, item and rune catalogs. Advanced formulas are requested from Community Dragon's `latest/game` endpoints. There is no runtime dependency on a downloaded game-data repository or test fixture. Browser caching lasts for the page session.

This is not an entirely data-defined game simulator. Stat growth rules, rune shard values, special rank rules, passive effect bindings and Tristana's range rule still exist in JavaScript. Data Dragon and Community Dragon update independently, so `latest` can temporarily refer to different patch data.

## Changes

- Spells and items share one calculation interpreter. Removed the duplicate symbolic item parser, unused formula helpers and ambiguous damage-name matching.
- Current stat formula modes are total (0/default), base (1), bonus (2). Regression cases include Sheen's base AD, Feast's bonus health and Seraph's bonus mana.
- Added resource scaling, named/scalar data, typed zero defaults, sums/products, clamps, level curves, effect values, rank overrides, referenced calculations, conditional expressions, buff counters and cross-spell data references.
- Missing inputs remain symbolic. Unknown parts and circular references never become a plausible zero damage value.
- Seraph's tooltip binds its exact ShieldValue and BonusAPCalc keys. Its shield/AP coefficients and cooldown come from live data. Muramana and Rabadon also read their passive coefficients/formulas from that data.
- Both root and `preview/` runtime files contain the same implementation.

## Validation

22 unit regressions pass. Browser tests pass with advanced data available and unavailable: 173 champions at levels 1, 6, 11 and 18; 230 builder items; 600 item tooltips; champion lookup and startup failures. These are execution/rendering tests, not exhaustive comparisons against the game.

The captured full-data inventory contains 2,808 calculation records, including secondary spells and nonstandard/legacy items. At rank 3, level 18 with a controlled test build:

| Result | Records |
|---|---:|
| Numeric result | 2,671 |
| Needs combat inputs / conditions | 128 |
| Missing source branch/effect or circular reference | 9 |

The last nine are conditional calculations without a default branch on items 3865/3866, Elise R, Jax W/R and Zed passive; a self-reference on item 773085; and missing effect arrays on two K'Sante missile records. This does not imply all nine are visible primary abilities or active Summoner's Rift items. Their intended fallback semantics still need verification.

## Remaining acceptance work

All calculations are **not yet certified game-correct**. The interpreter inventory does not cover scripted effects absent from the published formula records. Buff stacks, target health/resists, empowered forms, nearby units, conditional activation and elapsed durations need explicit combat context. Full passive application, item interactions and damage mitigation also remain incomplete. The builder continues to label ability DPS as unmodeled.

Before moving to layout/features, validate each primary ability and item against its patch and combat conditions, add the missing context, resolve the source ambiguities above, and extend expected-value regressions. Symbolic expressions make missing inputs visible; they do not replace those final checks.
