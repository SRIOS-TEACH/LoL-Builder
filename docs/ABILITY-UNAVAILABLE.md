# Ability tooltip audit — 2026-09-11

The real Builder tooltip resolver was tested for all **173 champions**, at levels **1, 6, 11 and 18**, through every permitted rank, including passive descriptions. The latest audit reports **0 abilities containing `[value unavailable]`**, down from 14 in PR #111 and 46 before the root-spell repairs. See `ability-unavailable.json` and `tests/ability-audit.cjs`.

## What caused the remaining failures

| Ability | Cause and repair |
|---|---|
| Akshan W; Gangplank Q | Nested game-mode localization, not a numeric formula. Load the live English string table and expand the standard Summoner's Rift variant. |
| Aphelios R | Nested weapon-specific localization. Expand and display all five weapon outcomes without assuming a main-hand weapon. |
| Bard W | Script variables for active shrines and shrine limit. Provide one W input, capped by live MaxPacks. |
| Bel'Veth Q | Script-computed per-direction cooldown. Apply the live attack-speed-to-haste conversion to live PerSideCooldown. |
| Bel'Veth E | Script-computed strike count. The exported TotalStrikes display formula is stale; use the documented threshold rule with the live coefficient. |
| Garen E | Script-computed spin count. Use live NumTicks/ASPerTick and permanent item/level attack speed. |
| Kai'Sa Q/W/E | Script evolution progress. Calculate item/level AD and attack speed, and AP excluding rune contributions. |
| Malphite W | Script armor gains before/after Granite Shield. Compute from pre-W armor to avoid counting the bonus twice. |
| Sett W | Script maximum damage. Combine DamageCalc + DamageConversion × MaxGrit. The separate exported MaxDamage helper disagrees with DamageConversion and must not be used as an alias. |
| Syndra W | Missing script alias to live SlowDuration. |
| Xin Zhao E | Script attack-speed bonus. Combine live ASMod, APToASRatio and PermanentASToASRatio. |

Mappings are specific to champion/spell/token; an `f1` value on one champion is never reused globally. Balance values remain in live Data Dragon/CommunityDragon payloads. Localization is fetched only for the three champions that require it and cached for the session; the full upstream table is approximately 32 MB uncompressed. If that endpoint fails, unresolved localization remains visibly unavailable rather than replaced with invented text.

## Champion stats now connected to abilities

- Cho'Gath: Feast health and capped attack range; health is bonus health for every subsequent scaling formula. Current R rank applies to all Feast stacks.
- Poppy: W armor and magic resistance, doubled below the live health threshold; an explicit current-health field controls the conditional state.
- Malphite: W armor; Granite Shield toggle in the passive box.
- Swain: Soul Fragment health.
- Thresh: soul armor and AP.
- Veigar: Phenomenal Evil AP, including Deathcap amplification.
- Senna: Mist AD, milestone attack range/critical chance, and excess-critical-chance lifesteal.
- Bel'Veth: Lavender attack speed, feeding Q/E calculations.
- Sion: accumulated Soul Furnace health (enter the health earned, since different kills grant different amounts).
- Garen: Courage resistances, capped by the live maximum.
- Syndra: AP amplification at the live maximum Splinter threshold, added to the item AP amplification rather than multiplying it.

Inputs are owned by the relevant ability, shared counters use the same key as formula consumers, and supported permanent counters default to zero. Poppy defaults to full health and Granite Shield defaults to inactive. Changing rank, items, level or state recomputes totals from scratch. Stat explanations and the passive ledger include these bonuses.

## Limits of this result

Zero unavailable fields measures tooltip resolution, not completeness of a combat simulator. Enemy stats intentionally remain symbolic. Other combat-state inputs can remain unknown. This change does not automatically activate temporary abilities or implement every champion's scripted stat conversion, transformation or evolution. In particular, arbitrary temporary buffs and dependencies such as Vladimir/Ryze/Ornn/Jhin need separate mechanic bindings and validation; they are not covered by the eleven champion stat integrations above. Kai'Sa progress is displayed but does not automatically select an evolved ability branch.

The earlier non-primary source defects are separate: Runaan variant 773085 has a self-referential ChampRange record, and K'Sante's Q3/R missile damage helpers reference missing Effect1 arrays. These do not appear in the primary tooltip audit and remain source limitations.

## Mechanical references

- [Riot: Poppy W conditional resistances](https://www.leagueoflegends.com/en-us/news/game-updates/patch-13-8-notes/). Historical balance numbers are not copied; current coefficients come from the loaded spell data.
- [Riot patch 26.15: Bel'Veth Q conversion and E strike threshold](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-15-notes/).
- [Riot patch 26.9: Xin Zhao E permanent-AS/AP scaling](https://www.leagueoflegends.com/en-gb/news/game-updates/league-of-legends-patch-26-9-notes/).
