# Calculation audit — 2026-09-10

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

## Combat inputs

Builder, item selection details and Item Lookup now expose required inputs from the live formula dependencies. Inputs begin unset. Enter stacks (zero if inactive), elapsed duration percentages, target maximum/current health and nearby-ally conditions. Item Lookup also supports attacker stats and champion level for standalone calculations.

Build-derived base/bonus stats are supplied automatically. Current and missing health are derived consistently from maximum health and the entered percentage. Health cast requirements use target health. Named effect values are available even when Data Dragon's prose contains no numeric placeholder.

Buff activation chooses the referenced conditional branch. If the condition is false and the source supplies no alternate branch, the result is explicitly **Inactive (no alternate effect)**, not invented zero damage. A named branch that is actually missing still reports a source error. This handles the six conditional records previously classified as unresolved: items 3865/3866, Elise R, Jax W/R and Zed passive.

Stack inputs feed the formulas that reference those counters. They do not automatically simulate every scripted passive stat bonus, on-hit interaction or game event. For example, entering stacks is not a complete simulation of all health/stat changes caused by acquiring those stacks in-game.

## Validation

28 unit regressions pass. Browser tests pass with advanced data available and unavailable: 173 champions at four levels, 230 builder items and 600 item tooltips. Interactive tests enter and clear Cho'Gath stacks, derive target health for Zed and update Seraph's standalone shield/AP values.

`tests/combat-audit.cjs` exercises the same input discovery and context application used by the UI. All 2,808 captured records are tested in two scenarios with different activation, health and stack values:

| Result | Scenarios |
|---|---:|
| Numeric result | 5,603 |
| Explicitly inactive | 7 |
| Missing input control | 0 |
| Known source defect | 6 (three records, tested twice) |

Thus the previous 128 input gaps now have a control or a build-derived value. These counts validate execution and input plumbing, not every game mechanic or all possible combat states. Newly introduced source defects fail the audit; the three known exceptions remain listed explicitly.

## Three remaining source defects

Rechecked against the live sources on 2026-09-10; they remain unchanged:

- **Runaan's Hurricane variant 773085, ChampRange:** both conditional branches refer back to ChampRange. This variant is listed for maps 12/453, not Summoner's Rift. Its BoltDamage calculation remains independent and evaluable. [Live item source](https://raw.communitydragon.org/latest/game/items.cdtb.bin.json)
- **K'Sante KSanteQ3Missile, TotalDamage:** references Effect 1 but supplies no effect array.
- **K'Sante KSanteRMissile1, TotalDamage:** same missing Effect 1. These are missile records, distinct from primary ability calculation records. [Live champion source](https://raw.communitydragon.org/latest/game/data/characters/ksante/ksante.bin.json)

These definitions remain explicitly unavailable. Resolving them numerically requires a verified replacement reference/effect definition or an authoritative indication that they are unused. Do not borrow a similarly named formula or interpret a missing effect array as zero without that evidence.

## Remaining game-level acceptance work

All calculations are **not yet certified game-correct**. Full passive application, item interactions, damage mitigation and effects implemented only in scripts remain outside the interpreter's coverage. Ability DPS is still labeled unmodeled. Validate those against the selected patch before moving to unrelated layout/features.
