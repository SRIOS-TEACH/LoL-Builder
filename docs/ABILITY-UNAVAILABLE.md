# Unavailable ability values — 2026-09-10

The actual Builder tooltip resolver was tested for all **173 champions**, at levels **1, 6, 11 and 18**, through every rank permitted by the current rank rules. Passive tooltips were also inspected. No proxy enemy stats were supplied.

The audit initially found **46 affected abilities across 30 champions**. Correcting primary spell selection, hashed passive references, exact auxiliary spell aliases and precision-suffixed tokens repaired 32 affected abilities. **14 abilities across 11 champions still contain an unavailable field** in this version.

This is a list of unresolved fields, not a claim that every calculation in each listed ability is broken. Existing numeric damage/healing values can still work. Symbolic target scaling and unset stack counts are not classified as unavailable values.

## Remaining unavailable fields

| Champion | Ability | Unresolved part | Source placeholder(s) |
|---|---|---|---|
| Akshan | W — Going Rogue | Game-mode-specific tooltip text | `Spell_AkshanW_Tooltip_{{ gamemodeinteger` |
| Aphelios | R — Moonlight Vigil | Main-hand weapon-specific follow-up text | `Spell_ApheliosR_WeaponMod_{{ f1` |
| Bard | W — Caretaker's Shrine | Active shrine counter fields | `f1`, `f2` |
| Bel'Veth | Q — Void Surge | Per-direction cooldown after attack-speed scaling | `f1` |
| Bel'Veth | E — Royal Maelstrom | Number of attacks during the channel | `f2.0` |
| Gangplank | Q — Parrrley | Game-mode-specific tooltip text | `Spell_GangplankQWrapper_Tooltip_{{ gamemodeinteger` |
| Garen | E — Judgment | Number of spins | `f1` |
| Kai'Sa | Q — Icathian Rain | Current AD evolution-progress counter | `f11.1` |
| Kai'Sa | W — Void Seeker | Current AP evolution-progress counter | `f2.1` |
| Kai'Sa | E — Supercharge | Current attack-speed evolution-progress counter | `f10.1` |
| Malphite | W — Thunderclap | Flat armor gained, including Granite Shield amplification | `f1`, `f2` |
| Sett | W — Haymaker | Maximum damage with consumed Grit | `f1` |
| Syndra | W — Force of Will | Slow duration | `f2` |
| Xin Zhao | E — Audacious Charge | Attack-speed bonus percentage | `f1` |

The remaining `f…` fields are script-populated placeholders without an exact value/formula binding in the supplied tooltip context. Akshan, Aphelios and Gangplank also require nested localized-text expansion. Similar-looking formulas have not been substituted. The JSON companion records every unresolved token and its tested ranks/levels.

## Source-level exceptions, separate from primary tooltips

The previously recorded K'Sante Q3/R missile definitions still reference missing Effect 1 arrays; Runaan variant 773085 still has a circular ChampRange reference. The primary K'Sante Q tooltip now resolves through its actual root spell, rather than a missile record. These secondary definitions remain unsupported, not replaced with invented values.

## Self stats, targets and stacks

- Formula parts using the selected champion's stats read the current computed build. Old manual self-stat proxies cannot override those values. Health regeneration and scripted passive simulation remain limited by the existing stat model.
- Enemy stats remain symbolic, e.g. `12% Target Max HP`. Old target inputs are ignored and enemy-stat controls are not offered. Mixed formulas evaluate the known self component while retaining the target term.
- Stack fields appear once in the owning ability card. Counters used by several abilities share one value; a passive counter belongs in the passive card. Exact spell-owned counters such as Feast remain in that ability's card.
- Smolder has one Dragon Practice stack field. His Q/W/E passive scaling uses that same count. An unreferenced tooltip-only crit helper is no longer presented as a second stack counter. Coefficients still come from live Community Dragon data.

Stack entry affects formula references. It does not yet simulate every stat change produced by acquiring those stacks during a real game. A missing current-health state also cannot be inferred from a build; it remains an explicit input where needed.

## Reproduce

Use `tests/ability-audit.cjs` with the advanced fixtures described in TESTING.md. Set `ADVANCED_DATA=1`, `FIXTURES_DIR`, and optionally `AUDIT_OUTPUT`. This audit checks resolution and execution, not every in-game mechanic or later patches. Refresh the fixtures and rerun after a patch.
