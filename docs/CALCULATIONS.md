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

## Current tooltip and input behavior

See [the ability report](ABILITY-UNAVAILABLE.md) for the complete current unavailable-field list and testing scope. The renderer audit is broader than the original calculation-record inventory: it also detects unresolved Data Dragon placeholders and incorrect spell selection.

Self scaling reads the current build automatically. Enemy scaling is symbolic while Target settings are off. Enabling [Target settings](TARGETS.md) supplies the entered target health and defenses to formulas and typed mitigation. Shared counters are entered once in the relevant ability/passive card; Smolder's Dragon Practice is one counter for Q/W/E. Counter names and their hashed references normalize to one identity.

Primary records are resolved using their declared mRootSpell, including abilities with no mChildSpells list. Passive records use mCharacterPassiveSpell, including hashed records. Exact named auxiliary spell references are registered for qualified tooltip tokens. Precision suffixes are formatting metadata rather than separate variable names.

36 unit tests pass. Browser checks cover all 173 champions, 230 builder items and 600 lookup items with advanced data available and unavailable. Specific checks cover Smolder's shared stack value, Feast's R input placement, automatic self stats and symbolic enemy health even when stale numeric target inputs exist.

The earlier 128-input/9-source inventory was a formula-engine audit, not a complete tooltip audit. Its synthetic context tests remain useful for engine coverage. Current user-facing unresolved fields are documented in ABILITY-UNAVAILABLE.md.

## Three remaining source defects

Rechecked against the live sources on 2026-09-10; they remain unchanged:

- **Runaan's Hurricane variant 773085, ChampRange:** both conditional branches refer back to ChampRange. This variant is listed for maps 12/453, not Summoner's Rift. Its BoltDamage calculation remains independent and evaluable. [Live item source](https://raw.communitydragon.org/latest/game/items.cdtb.bin.json)
- **K'Sante KSanteQ3Missile, TotalDamage:** references Effect 1 but supplies no effect array.
- **K'Sante KSanteRMissile1, TotalDamage:** same missing Effect 1. These are missile records, distinct from primary ability calculation records. [Live champion source](https://raw.communitydragon.org/latest/game/data/characters/ksante/ksante.bin.json)

These definitions remain explicitly unavailable. Resolving them numerically requires a verified replacement reference/effect definition or an authoritative indication that they are unused. Do not borrow a similarly named formula or interpret a missing effect array as zero without that evidence.

## Remaining game-level acceptance work

All calculations are **not yet certified game-correct**. Full passive application, item interactions and effects implemented only in scripts remain outside the interpreter's coverage. Typed target mitigation is described in [TARGETS.md](TARGETS.md). Ability damage-per-cooldown comparisons, recast models and alternate outcomes are documented in [DPS.md](DPS.md), including remaining unsupported sequence totals. Validate those against the selected patch before moving to unrelated layout/features.
