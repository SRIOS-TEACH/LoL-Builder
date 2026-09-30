# Combo Tester

The Builder has an ordered combo editor. Target settings and attack conditions are in a dialog opened between Items and Skin, with a separate mitigation toggle.

## Controls

- Square Q/W/E/R buttons use the champion ability artwork with translucent key labels. AA uses the same AD symbol as Champion Stats and adds **AA no crit**. The League-style question-mark button opens **Custom Action**.
- The picker lists individual action buttons for attacks, ability variants/recasts, item actives, damage-dealing passives, and selected rune damage triggers. **AA no crit** and **AA crit** are separate outcomes. Stat-only item passives are excluded. A Champion passive section exposes explicit P triggers independently of sustained-attack toggles, with passive artwork. Utility passives remain selectable and do not automatically grant stacks. **Custom Action** at the bottom creates a blank, renameable action and opens its editor.
- The summary under the buttons shows the action sequence. Each action row has its icon and damage (plus target HP remaining when enabled), copy/delete controls, and external up/down arrows. Click the action to edit it in a dialog.
- Damage, damage type and timing may be overridden. Blank fields use the source values if available, otherwise zero. Custom actions default to physical damage until another type is selected. Copying preserves the action's cooldown identity. **Use build values** clears overrides.
- Hover or focus damage to see color-coded physical, magical and true contributions. Unknown damage types are listed separately rather than assigned a type. Mixed ability damage preserves its typed portions; changing only the total scales the portions proportionally. Selecting a damage type explicitly replaces that distribution.
- Build, rank, combat-input and target changes refresh automatic values. Overrides remain fixed. Changing champion clears the sequence. Unequipping an item/unlearning an ability retains its action as unavailable, counted as zero with a warning.

## Calculation contract

`JS/shared/comboTester.js` schedules in the chosen order. Each start is the later of the prior cast's completion and the action's availability. Attack starts are spaced by `1 / attacks per second`; the final windup is included. Ability variants share slot cooldowns. Recasts use preceding stages, supplied lockouts and known windows. A last-recast cooldown waits for an abandoned chain's known window to expire.

Every combo returns numeric damage and time. Missing values contribute zero; known portions of partially resolved damage are retained. Red exclamation marks and notes identify the affected totals. Missing repeat cooldowns are flagged when an action repeats. Invalid recast order/windows are flagged while retaining the numerical estimate. This fallback is specific to the Combo Tester; existing ability and attack calculators retain their original missing-data behavior.

The adapter reuses existing typed ability profiles, haste-adjusted cooldowns, cast times and available channel durations. Aatrox Q uses the source wrapper's cast time and existing DPS recast interval. Aurora Q uses its first/recall damage formulas and source cast times; an unspecified recall interval contributes zero with a warning.

AA no crit and AA crit force the individual outcome without changing the build's critical chance or the main Attack card's averages. Jhin's individual base hit is not averaged with a fourth shot. Existing champion exceptions such as Ashe's Frost Shot remain in effect. Item and champion bonus triggers are added explicitly, excluding them from AA to avoid double-counting. Proc conditions are assumed satisfied, not simulated. Spellblade entries share a cooldown group.

Item damage uses a modeled single proc when available, otherwise structured damage outcomes from the same source formulas as the item description. These retain full calculation precision and receive target mitigation once. Luden’s single echo and maximum isolated-target damage are separate choices sharing a cooldown; distinct components and alternatives are never silently summed. Explicit untagged damage such as Gunblade’s Lightning Bolt is recognized and also receives mitigation in its description. Percentage-health burns with a stated duration use the full duration. Missing/ambiguous item damage or cast times still contribute zero with warnings. Item cooldowns come from the source data.

Selected rune procs appear under Rune damage with their artwork. Supported calculations include Scorch, Sudden Impact, Electrocute, Arcane Comet (base and maximum distance), Summon Aery, Dark Harvest, Lethal Tempo, Press the Attack’s proc, Grasp and Aftershock. Numbers are parsed from the selected patch’s rune descriptions; changes the parser cannot recognize remain missing rather than falling back to old values. Adaptive damage uses AP versus bonus AD, with the builder’s champion preference as a tie-break. Dark Harvest checks the target HP at its step and uses the configured soul count. Lethal Tempo uses configured bonus attack speed; configure maximum stacks to include its attack-speed buff.

Rune actions represent explicit triggers, not automatic detection of hits, dashes, stacks or timing windows. Impact/travel delays and cooldown refunds are not simulated. Press the Attack’s continuing amplification is not applied automatically. First Strike is exposed as an unresolved action needing a damage override because its active-window damage is not tracked. Rune healing, shielding, gold and new permanent stacks are not added.

With Target Settings enabled, the adapter re-evaluates every selected action against the HP remaining before that action. This includes supported current/missing-health formulas and enabled health-threshold effects such as Shadowflame. Veigar R resolves its missing-health multiplier instead of displaying a static minimum/maximum range. Reordering, removing or editing a step recalculates subsequent HP. Custom damage overrides stay fixed after mitigation. The configured target and combat inputs are preserved.

Total damage includes overkill, while remaining HP clamps at zero. Steps after defeat are hypothetical. Each selected action resolves as one event: a full-duration or multi-hit row is not split into individual ticks/hits, and passive/item procs must still be added explicitly. No regeneration is applied between actions. Other combat conditions stay fixed. There is no movement, projectile travel, resource, buff-state, cooldown-refund, attack-reset or animation-cancel simulation. Special cycles such as reloads require timing adjustments. Duration measures execution rather than the last damage-over-time tick; full-duration rows may require a longer cast/channel override.

## Attack windup

Windup reads the champion's root `basicAttack` record. Explicit cast/total times produce a windup fraction; the alternative offset format uses `0.3 + mAttackDelayCastOffsetPercent`. Both resolve against current attack speed. Explicit windup scaling modifiers interpolate between base-speed and current-speed windup. Source override calculations, such as Senna's level-based cast time, are evaluated first. Missing records remain missing and therefore contribute zero with a warning; they do not silently receive a generic cast time.

The two timing representations and the 30% global base are corroborated by [BasicAttackInfo](https://github.com/LeagueSandbox/GameServer/blob/indev/GameServerLib/Content/BasicAttackInfo.cs) and [GlobalCharacterDataConstants](https://github.com/LeagueSandbox/GameServer/blob/indev/GameServerLib/Content/GlobalData/GlobalCharacterDataConstants.cs). Current champion values come from the app's Community Dragon payloads, not that older server implementation. Special scripted attack animations remain outside the model.

## Verification

`npm test` covers scheduling, missing-value fallbacks, recast order/expiry, shared cooldowns, typed damage, sequential HP/overkill/thresholds, attack-windup formats/modifiers, and individual critical outcomes. `npm run test:combos` uses the existing advanced fixtures and Playwright environment to check icons, both dialogs, custom naming/escaping, damage hover, zero fallbacks, discrete criticals, Aatrox/Aurora recasts, offset-format windup, item filtering/mitigation, passive discovery, Aurora passive damage, Veigar R sequencing/reordering, Shadowflame threshold crossing, target state preservation and desktop/mobile layout. Root and `preview/` runtime files are mirrored.

`npm run test:combo-effects` checks live-fixture rune actions, item formula transfer and alternatives, full burns, target mitigation, rune removal, and health-dependent ordering.
