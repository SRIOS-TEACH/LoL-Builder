# On-attack calculations

The Attack card reports **On-attack damage** and **On-Attack DPS**. Hover either number for the calculation, or expand Calculation breakdown on a keyboard or touch device.

The ordinary contribution is `AD × (1 + clamp(critChance, 0, 1) × (critDamageMultiplier − 1))`. Critical damage comes from the champion record, with a 200% Data Dragon-only fallback. Infinity Edge is included before champion modifiers. Explicit rules cover Yasuo/Yone doubled chance and excess-crit AD, Senna's crit modifier and existing Mist stats, Tryndamere Fury, Ashe Frost Shot, and Jhin's AD/crit conversion. Jhin averages three ordinary shots and a guaranteed fourth critical strike plus its missing-health damage. His idealized magazine rate is `4 / (3 / attackSpeed + reloadTime)`; animation windup is not simulated.

Values are before mitigation against one champion at constant target health. Target inputs affect only this attack model; ability tooltips keep symbolic target formulas. Missing health, proc timing, or formula data makes the result unavailable instead of dropping the effect.

## Effects and controls

Always-on and every-N-hit bindings include Senna, Warwick, Tahm Kench, Lulu, Orianna, Teemo, Varus, Kayle, Kassadin, Diana, Neeko, Kennen, Xin Zhao, Vi, Twisted Fate, Vayne, Jax and Kai'Sa. Teemo poison refreshes instead of adding its full duration on every hit.

Conditional bonuses have buttons in their owning ability box, disabled for unlearned abilities. Single-use bonuses request the actual interval between empowered attacks. Sustained buffs calculate damage while enabled.

Item bindings cover Recurve Bow, Nashor's Tooth, Wit's End, Rageblade, Muramana, Terminus, Titanic Hydra, BORK, Kraken Slayer, Spellblade, energized effects, Ardent Censer, Voltaic Cyclosword, Umbral Glaive, Sundered Sky, Fiendhunter Bolts and Shadowflame, where available in the item catalog. Rageblade increases supported on-hit frequency without multiplying ordinary AD/crit damage. Spellblade selects the largest supported grouped proc, constrained by cooldown and the supplied interval. Conditional procs default off.

Damage is **amortized per attack**, not next-hit burst: a 100-damage proc every two seconds at two attacks per second contributes 25 damage per attack and 50 DPS.

## Coverage limits

This is not complete coverage of every champion/item interaction. Weapon/stance replacements, some multi-hit attacks, special attack-speed rules, many temporary stat buffs, and several passives still need verified bindings. Known champion gaps are marked **partial**, with the missing mechanics named in the breakdown. The `unsupported` catalog in `JS/shared/attackEffects.js` records these cases.

Remaining item interactions include Dusk & Dawn's extra on-hit, Hexoptics/Lord Dominik's Regards/Shojin amplification, Hullbreaker, Dead Man's Plate, Yun Tal's earned crit, conditional crit-item combinations, and the complete phantom-hit interaction matrix. Kraken amplification uses an explicit percentage control; blank means minimum damage. Splash damage, Runaan bolts on other enemies, execute thresholds, pets, external ally buffs beyond explicit controls, and rune damage are excluded. Only effects listed in the breakdown contribute.

Do not describe this update as universal coverage of all on-hit effects and passives. It supplies the engine, requested presentation, critical-strike rules and listed bindings; the remaining coverage needs further work.

## Verification

Committed formula excerpts come from the downloaded Community Dragon snapshot used with Data Dragon 16.18.1. Numerical tests cover crit/IE, Yasuo/Yone excess crit, Senna, Jhin, item on-hits, Rageblade, target health, Spellblade intervals, Kog'Maw and Teemo. Browser tests exercise all 173 champion selections and new controls, available registered item effects, labels, hover content and missing-data fallback. Rendering checks do not certify every game mechanic numerically.
