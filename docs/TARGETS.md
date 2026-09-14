# Target settings

The Builder has a Target settings switch, initially off. Maximum HP, current HP, armor, magic resistance and percentage damage reduction retain their values when switching targets off or changing champions, within the current page session. Maximum HP is at least 1, current HP stays between zero and maximum HP, and reduction stays between 0% and 100%. Negative defenses are supported.

When enabled, the shared target supplies maximum/current/missing health to ability, passive and item formulas. Typed attack packets, ability outcomes, alternate forms, combined totals and sweet spots are reduced separately, then added. Detailed prose and compact damage numbers use the same target. Hovering damage/DPS shows raw damage, penetration, resistance and cooldown or attack cadence. Healing, shields, AD/AP stats, costs, ranges, durations and scaling coefficients are not reduced. Percentage-health coefficients retain their explanation and show resulting target damage alongside them.

Switching off restores damage before target defenses and stops supplying target health. Health-dependent results remain symbolic or unavailable when a target is required. Raw effect-record tables are omitted in target mode because they include untyped intermediate values; typed descriptions and damage tables provide the applicable calculations.

## Damage rules

- Physical damage uses armor; magic damage uses MR. AD/AP scaling does not determine damage type.
- Apply percentage penetration before flat penetration. Penetration cannot push nonnegative defense below zero and does not alter already negative defense. Independent champion/item percentage sources combine multiplicatively.
- Innate source bindings include Darius E, Pantheon R, Mordekaiser E, Nilah Q and Aphelios' capped lethality upgrades. Champion stats, attacks and ability/item descriptions use the same combined penetration totals.
- For effective defense `R >= 0`, multiply damage by `100 / (100 + R)`. For negative defense, use `2 - 100 / (100 - R)`.
- Apply additional reduction as `1 - reductionPercent / 100` to physical and magic damage. True damage ignores both defenses and this generic reduction.
- Outgoing modifiers are separate. Shadowflame's source-defined amplification can increase magic and true damage below its health threshold, including ability/item prose. Its passive switch still applies.
- Mixed outcomes retain types: Ahri Q combines magic and true damage; Yone R combines physical and magic; Lillia Q adds true outer-edge damage. Camille Q2 and Gwen Q center use source-defined conversion proportions before mitigation.

[Riot's 14.1 notes](https://www.leagueoflegends.com/en-gb/news/game-updates/patch-14-1-notes/) establish one-for-one lethality/flat armor penetration. [Community Dragon item data](https://raw.communitydragon.org/latest/game/items.cdtb.bin.json) supplies item values and Shadowflame/Kraken coefficients. Kraken's 0–75% missing-health increase appears in [Riot's 25.14 notes](https://www.leagueoflegends.com/en-ph/news/game-updates/patch-25-14-notes/); the implementation interprets that range linearly over missing-health proportion, without assuming an extra health threshold.

## Scope and verification

This compares damage at the specified target state. It does not consume target HP after each hit, apply shields, infer active resistance debuffs, or add previously unsupported item procs to champion ability totals. A formula requiring separate bonus HP still needs that additional input; maximum HP cannot establish a target's base/bonus split. Missing data or unidentified damage types remain explicit.

`npm run test:targets` checks controls, retention, typed/mixed damage, penetration, health scaling, descriptions, hover, Shadowflame and direct clicks after typing. `TARGET_SETTINGS=1 ADVANCED_DATA=1 npm run test:dps` audits all 173 champions and 692 ability cards. Against the 16.18.1 snapshot, all 749 previously numeric outcomes stayed numeric and 48 additional health-dependent outcomes resolved. This is regression coverage, not certification of every combat mechanic.
