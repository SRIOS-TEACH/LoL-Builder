# Reliability audit — 9 September 2026

## Outcome

14 September target settings update: explicit target health, defenses and percentage reduction now feed shared typed mitigation for attacks, abilities and descriptions. Raw mode remains available. See [TARGETS.md](TARGETS.md) for penetration, hybrid/true damage, source bindings and regression coverage. These are fixed-state comparisons; shields, automatic resistance debuffs, health consumption over a sequence and previously unsupported ability-triggered item procs remain outside the model.

14 September passive fix follow-up: AD growth now preserves Community Dragon's named/hashed growth value when Data Dragon supplies zero. Detailed passive/item prose uses the public game localization table, with numerical values in context. All 236 selectable item descriptions resolve in melee and ranged fixture audits. Independent enabled states affect the registered attack effects and supported stat passives; reference-only effects are labeled in the Passives window. In particular, Muramana's ability Shock remains outside the champion-only Q/W/E/R tables. Text resolution and toggling reference state do not establish universal item-trigger simulation. See [ON-ATTACK.md](ON-ATTACK.md) and [TESTING.md](TESTING.md).

First stabilization pass, not a claim of in-game accuracy or zero bugs. The generic lookup/build workflows have repeatable regression coverage. Advanced formulas and special champion systems remain incomplete.

Audited baseline: `main` commit `5f403aa4c7ffe3da8881babb9d4d15abe9b91ded`. Tests used real Data Dragon `16.17.1` payloads. Original source was preserved separately during the audit.

## Fixed

| Problem | Result |
| --- | --- |
| Selecting a champion overwrote complete stats with partial/empty advanced data; absent fields became zero and could crash rendering | Patch-specific Data Dragon stats are preserved; optional advanced data cannot erase them |
| Slow champion selections could overwrite newer ones | Selection commits only the latest request, including error handling |
| Champion Lookup requests could race and failures were unhandled | Latest selection wins; startup and detail failures show a retry message |
| Item Lookup initialization failures produced an empty page | Loading and actionable failure text |
| Duplicate `fetchRunesReforged` silently forced patch 16.5.1 | One versioned implementation |
| Duplicate item downloads and unbounded fetch waits | Shared request cache, concurrent deduplication, 15-second timeout, failed-request retry |
| Basic item stats such as haste and critical damage disappeared without Community Dragon | Explicit tooltip stat-block fallback, with numeric catalog precedence |
| Level growth was linear in totals and tooltip stat inputs | One standard growth factor used consistently |
| Attack-speed item bonuses multiplied level bonuses | Additive bonuses use the attack-speed ratio when available |
| Rune tenacity was omitted from the displayed total | Display combines item/rune contributions |
| Missing formula terms/modifiers became apparently valid partial totals | Missingness propagates; conditional calculations require game state |
| Unknown stat IDs defaulted to AP | Unsupported sources stay unavailable; supported AD sources distinguish base/bonus/total |
| Circular item formulas overflowed the stack | Cycle detection |
| Negative/fractional/foreign ability rank values broke normalization | Finite integer Q/W/E/R ranks within level budget |
| Zero spell resource cost displayed as missing | Zero is preserved |
| Rune artwork requested over HTTP | HTTPS |
| Repeated sandbox items multiplied unique passives repeatedly | Unique item passive ledger applies each item ID once |
| Tooltip highlighting nested overlapping stat names | One longest-match text replacement |
| Tristana range differed between stats and attack panel | Both panels use the same computed range |
| DPS guessed proc damage and summed numbers extracted from prose | Basic attacks are explicitly limited; ability DPS is marked not modeled |

## Refactoring

- Extracted shared item data/formatting from Item Lookup; Builder no longer loads another page's controller.
- Added a small pure stat helper module.
- Removed abandoned stat-key maps, unused fetch wrappers, duplicate indexing/fallback code and unused rune renderers.
- Removed unreferenced Halfmoon JavaScript and the vendored xxhash package/copies. The CSS used by the pages remains.
- Repaired README links/instructions and added architecture, contributor and test documentation.
- Added dependency-free regression tests and a GitHub Actions unit-test job.

## Verification

- The first eight regression cases failed on the original implementation; all pass after fixes.
- 17 unit regressions pass.
- Browser: 173 champions rendered in Builder at levels 1, 6, 11 and 18, with allocated ability ranks and advanced API failures.
- Browser: 230 Builder items equipped, calculated and rendered; Ionian Boots haste fallback checked explicitly.
- Browser: 600 eligible item tooltips rendered; empty search/map filters checked.
- Browser: all 173 champions rendered in Champion Lookup.
- Browser: item add/remove, level/rank controls, rune shard selection, rapid selection races and all three startup error states.
- No uncaught browser errors in that suite. Artwork was replaced by placeholders; these counts are execution checks, not assertions that every number matches the game.

## Remaining work, in priority order

1. **Advanced source access and patch matching.** Community Dragon item data and 13 representative champion endpoints returned HTTP 403. Successful live advanced-data integration is unverified. Capture a matching patch and add golden expected-value tests before declaring the ability resolver accurate. `latest` may differ from Data Dragon's patch.
2. **Special champion rules.** Generic ranks do not model Jayce/Elise/Nidalee transformations, Udyr's four basics, Aphelios' stat upgrades, or other exceptions. Champion passives, attack-speed ratios when absent, attack-speed caps/exceptions, movement-speed caps, resource exceptions and adaptive damage selection need champion-specific validation. Generic stat controls are a sandbox, not game-legal build validation.
3. **Item/rune effects.** Most selected runes and many passives are descriptive only. Existing Muramana/Seraph/Rabadon modifiers need current advanced-data comparisons. Unique item groups, penetration stacking and conditional buffs are not comprehensively modeled.
4. **Ability calculations.** Only known AP/AD stat sources are evaluated. Other stat IDs, conditions, buff stacks, target stats and unsupported calculation types remain unavailable. The resolver still contains alias/child-selection heuristics that require fixtures. Item formula presentation has older mappings/heuristics and needs the same review.
5. **Combat estimates.** Replace the removed guessing with an explicit model for targets, mitigation, crits, hit counts, charges, proc cooldowns and combat timing. Ability DPS intentionally remains unavailable until then.
6. **Further structural cleanup.** Extract the ability resolver and rune state transitions after their behavior is covered with representative advanced payloads. Keep UI redesign/features for after this accuracy work.

Do not merge on the strength of rendering tests alone if full numerical correctness is the release requirement. This pass is intended to provide a stable, reviewable foundation and a concrete next backlog.

## On-attack calculation update — 11 September 2026

The attack stub is replaced with average critical damage and an explicit champion/item effect registry. Ability controls, item proc intervals, target HP inputs and a hover/touch-accessible breakdown are implemented. See [On-attack calculations](ON-ATTACK.md) for the model, implemented bindings and remaining gaps. **Universal all-item/all-passive coverage is still incomplete**; known special champion gaps are marked partial in the UI. Do not treat broad browser rendering checks as numerical certification of those mechanics.

Validation: 58 unit tests; advanced and fallback attack browser passes for 173 champions; registered available item procs; existing advanced Builder/Lookup suite (173 champions at four levels, 230 Builder items, 600 lookup item tooltips, interactions and startup failures); existing ability DPS suite (692 abilities). No uncaught browser errors. Root and preview runtime files are synchronized.

## Attack passive and item follow-up — 12 September 2026

The special champion bindings and item interactions identified as missing in the 11 September attack update are now implemented. See [On-attack calculations](ON-ATTACK.md) for weapon/form controls, timing inputs, damage replacement, multi-hit ordering and the single-target model boundaries. This supersedes that update's list of unimplemented attack bindings; the older general audit above remains historical context.

Validation: 74 unit tests, including captured-data arithmetic regressions for the new interactions; advanced and fallback attack browser passes for 173 champions; advanced scenarios require finite, non-partial results. Actual Aphelios weapon selection and Elise form/item ratios are checked. The full advanced Builder/Lookup suite passed (173 champions at four levels, 230 Builder items, 600 item tooltips, interaction and startup-failure checks), as did the 692-ability DPS suite. No uncaught browser errors. Root and preview runtime files are synchronized. These checks do not substitute for patch-specific in-game validation of every combat sequence.
