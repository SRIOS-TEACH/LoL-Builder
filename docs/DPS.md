# Ability damage per cooldown

Ability cards show damage and DPS for each identified outcome. DPS is damage divided by the current rank's cooldown, adjusted for the build's ability haste. [Target settings](TARGETS.md) optionally apply health scaling, penetration and typed damage mitigation before dividing by cooldown. With the switch off, values are before target defenses. Both root and preview use the same module.

Damage comes from the existing tooltip calculation resolver. Typed damage passages identify the relevant formulas; calculation names are not searched for a plausible damage value. Alternative outcomes and damage ranges are separate rows. Percent-health expressions resolve when enabled Target settings supply the health pool; unresolved stacks and other missing inputs remain formulas. Utility spells and unavailable repeat cooldowns are explicit.

## Sequences and sweet spots

- Aatrox Q: Q1/minimum, Q2, Q3 and combined total. With live ramp `r`, the damage multipliers are `1`, `1+r`, `1+2r`. The full cycle is `adjusted cooldown + 1s + 1s`. Edge damage is shown in parentheses for every damage and DPS value.
- Ziggs R: outer blast first, centre damage in parentheses. Darius Q, Xerath W and Lillia Q also pair normal and sweet-spot outcomes.
- Yasuo Q: thrust, whirlwind and circular strike are separate rows. They deal the same damage per cast. Yasuo/Yone Q cooldown scales with bonus attack speed rather than ability haste. The empowered version requires two prior Q hits; its row is a per-cast rate, not a claim that every cast can be empowered.
- Ahri R, Riven Q, Akali R, Gwen R and Naafiri Q account for recast intervals overlapping a cooldown that starts on the initial cast. The repeat cycle is `max(adjusted cooldown, sum of intervals)`.
- Camille Q, Zaahen Q and Xerath R add the intervals to the final-cast cooldown. Camille/Zaahen rows cover bonus damage only. Xerath assumes all shots hit one champion, including the successive-hit ramp.
- Ahri Q/W, Aatrox W, Gwen Q, Garen E, Yone R, Yuumi R and damage-over-time bindings include explicitly identified full sequences/durations. Procs and underlying attacks are excluded unless named in the row.
- Akali E, Kled E, Vex R, Ornn R, Renekton E and Lee Sin Q expose their cast damage and combined total. Their cards provide a cast-interval input and a cooldown-overlap selector. Blank timing remains unknown. This avoids assigning a guessed travel/attack interval or cooldown-start rule to these sequences.
- Jayce, Nidalee, Elise and Gnar have additional form sections using the alternate spell's own cooldown and localized tooltip. Cougar damage uses the selected R rank (at least rank 1).

The display explains the combined cycle. Individual cast rows always use damage / cooldown for comparison; they are not summed to produce combined DPS.

## Sources and limits

Damage coefficients, available delays and alternate tooltips use the project's existing live Data Dragon and Community Dragon sources. Test fixtures were captured at Data Dragon 16.18.1 on 2026-09-11. Examples:

- [Aatrox data](https://raw.communitydragon.org/latest/game/data/characters/aatrox/aatrox.bin.json): QDamage, QEdgeDamage, QRampBonus. The 1-second static recast interval is script-level behavior documented in the [Aatrox ability reference](https://leagueoflegends.fandom.com/wiki/Aatrox/LoL).
- [Riven data](https://raw.communitydragon.org/latest/game/data/characters/riven/riven.bin.json): FirstSlashDamage and the 0.5-second TriCleaveBuffer cooldown.
- [Ahri data](https://raw.communitydragon.org/latest/game/data/characters/ahri/ahri.bin.json): RMaxCasts and RDashCooldown.
- [Gwen data](https://raw.communitydragon.org/latest/game/data/characters/gwen/gwen.bin.json): per-cast damage and LockoutTime.
- [Ziggs data](https://raw.communitydragon.org/latest/game/data/characters/ziggs/ziggs.bin.json): BlastDamage and EmpoweredDamage.
- [Yasuo ability reference](https://wiki.leagueoflegends.com/en-us/Template%3AData_Yasuo/Steel_Tempest): attack-speed cooldown behavior.

This is a damage-per-cooldown comparison, not a full combat simulation. Unbound repeated attacks, pets, toggled damage, damage storage, resets, passive procs and some scripted multi-part mechanics do not have a certified total. Their listed damage components/formulas must not be interpreted as a complete sequence total. Target-health formulas remain symbolic while Target settings are off; enabling the switch supplies explicitly entered health. Current champion rank constraints are unchanged.

## Verification

`npm test` includes focused unit regressions for arithmetic, haste, recast overlap, sweet spots, alternate Q, missing inputs, zero cooldowns, typed percentages and damage ranges.

`npm run test:dps` uses the same fixture/runtime environment as `test:browser`. It exercises all 173 champions / 692 QWER cards, requested examples, rank/item changes, timing entry/clearing and alternate-form sections. Run with and without `ADVANCED_DATA=1`. `AUDIT_OUTPUT` and `SCREENSHOT_DIR` optionally save evidence. The all-champion pass checks rendering and missing-value safety; it is not an in-game correctness certification for every mechanic.
