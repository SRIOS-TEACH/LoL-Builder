# On-attack calculations

The Attack card reports **On-attack damage** and **On-Attack DPS**. Hover either number for the calculation, or expand Calculation breakdown on a keyboard or touch device.

The ordinary contribution is `AD × (1 + clamp(critChance, 0, 1) × (critDamageMultiplier − 1))`. Critical damage comes from the champion record, with a 200% Data Dragon-only fallback. Infinity Edge is included before champion modifiers. Explicit rules cover Yasuo/Yone doubled chance and excess-crit AD, Senna's crit modifier and existing Mist stats, Tryndamere Fury, Ashe Frost Shot, and Jhin's AD/crit conversion. Jhin averages three ordinary shots and a guaranteed fourth critical strike plus its missing-health damage. His idealized magazine rate is `4 / (3 / attackSpeed + reloadTime)`; animation windup is not simulated.

Values are before mitigation with Target settings off. Enabling [Target settings](TARGETS.md) shares entered health and defenses across attacks, abilities, passives and item descriptions. Values assume one champion at constant target health. Missing health, proc timing, or formula data makes the result unavailable instead of dropping the effect.

## Effects and controls

Always-on and every-N-hit bindings include Senna, Warwick, Tahm Kench, Lulu, Orianna, Teemo, Varus, Kayle, Kassadin, Diana, Neeko, Kennen, Xin Zhao, Vi, Twisted Fate, Vayne, Jax and Kai'Sa. Teemo poison refreshes instead of adding its full duration on every hit.

Conditional bonuses have buttons in their owning ability box, disabled for unlearned abilities. Single-use bonuses request the actual interval between empowered attacks. Sustained buffs calculate damage while enabled.

Item bindings cover Recurve Bow, Nashor's Tooth, Wit's End, Rageblade, Muramana, Terminus, Titanic Hydra, BORK, Kraken Slayer, Spellblade, energized effects, Ardent Censer, Voltaic Cyclosword, Umbral Glaive, Sundered Sky, Fiendhunter Bolts and Shadowflame, where available in the item catalog. Rageblade increases supported on-hit frequency without multiplying ordinary AD/crit damage. Spellblade selects the largest supported grouped proc, constrained by cooldown and the supplied interval. Conditional procs default off.

Damage is **amortized per attack**, not next-hit burst: a 100-damage proc every two seconds at two attacks per second contributes 25 damage per attack and 50 DPS.

The Passives window combines game-authored descriptions with current calculated values and stores independent enabled states. Registered attack effects and supported stat passives (Muramana/Seraph Awe, Deathcap and Warmog's Vitality) honor those states without removing the item's flat stats. Conditional attack toggles stay synchronized with their Passives controls. The source Spellblade cooldown supplies both the default and minimum interval (currently 1.5 seconds); the breakdown distinguishes full proc damage from its average contribution.

Description coverage is broader than combat coverage. Muramana's ability-triggered Shock is displayed separately using 3% maximum mana for ranged champions and 4% for melee champions, but is not added to Q/W/E/R damage-per-cooldown tables. Those tables report champion ability damage, without an item-proc timeline. Other unregistered passives remain reference effects; changing their enabled state does not simulate healing, shielding, utility, or unregistered damage triggers.

## Special attacks and item interactions

`JS/shared/attackChampions.js` supplies explicit bindings for every champion previously flagged by the attack model's partial-coverage catalog. These include Aphelios' five weapon profiles and upgrades; Graves' pellets and reload; Zeri's Q and charged/uncharged right-click; Kalista's hopping interval; Akshan's second shot; Sett's alternating punches; Bel'Veth's true form; Elise, Gnar, Jayce and Nidalee forms; and the empowered attacks, damage-over-time passives and temporary stat buffs in that catalog. Caitlyn's Headshot, Yunara's critical magic damage and Samira's melee passive are also bound.

Form buttons change melee/ranged item ratios as well as champion damage. Aphelios has a weapon selector in his ability card. Camille Q2 converts its attack damage and, when explicitly aligned, Spellblade damage to true damage. Viktor, Galio and Nidalee replace the ordinary attack packet instead of counting it twice. Urgot's Purge uses its fixed attack rate, excludes ordinary crit damage and reduces on-hit damage. Zeri's right-click does not apply attack on-hit items.

The item registry now also includes Dusk & Dawn's extra on-hit, Hullbreaker's fifth attack, Dead Man's Plate momentum, Yun Tal's earned crit and Flurry, and Hexoptics, Lord Dominik's Regards and Shojin amplification. Extra on-hit events from Dusk & Dawn, multi-hit attacks and Rageblade are additive and cannot recursively trigger themselves. Item damage remains separate from champion ability damage for Shojin; Hexoptics applies to attack packets; Giant Slayer excludes true damage. Sundered Sky and Fiendhunter share the forced critical strike instead of adding two physical crit bonuses. Shadowflame affects eligible magic/true packets. Each active contribution appears in the breakdown.

## Combat assumptions

The result is a sustained, single-target estimate at the supplied health and state. Counts, charges, forms and temporary buffs are explicit controls. Reload, hopping, projectile-return and empowered-attack intervals describe the chosen attack sequence; supply them when that sequence is enabled. The calculation does not infer movement, target distance, cooldown resets or buff uptime from a build. Missing required inputs produce an unavailable result with an explanation.

Kraken amplification derives from missing-health proportion when Target settings are enabled. Shadowflame similarly checks the configured current-health threshold. Splash damage, Runaan bolts on other enemies, execute thresholds, pets, external ally buffs beyond explicit controls, and rune damage are outside this attack model. The registered bindings cover the previously documented gaps, but this is not an assertion that every possible combat sequence or future patch is numerically certified.

## Verification

Committed formula excerpts come from the downloaded Community Dragon snapshot used with Data Dragon 16.18.1. `tests/attack-interactions.json` adds named source calculations for special attacks and item combinations. Numerical tests cover crit/IE, Yasuo/Yone excess crit, Senna, Jhin, item on-hits, Rageblade, target health, Spellblade intervals, attack replacements, conversion, amplification scope and refreshed damage over time. Browser tests require finite, non-partial results for all 173 configured champion scenarios and exercise actual weapon/form controls, available registered item effects, labels, hover content and API-failure fallback. These execution scenarios complement numerical regressions; they are not in-game certification.

Script-level rules are checked against the captured data and Riot's patch descriptions, including [26.1 critical-strike and Kindred changes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/) and the [3.0 baseline attack-speed cap](https://www.leagueoflegends.com/en-ph/news/game-updates/patch-2025-s1-3-notes/). Refresh fixtures and revalidate named bindings when changing patches.
