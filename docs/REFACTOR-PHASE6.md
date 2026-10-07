# Phase 6 — Release verification and handover

Release work dated 8 October 2026 on `codex/modular-refactor`. All release checks, publication and live verification pass. Production and the protected baseline remain separate.

## Release boundary

The current release is the modular-refactor preview, preserving existing public page workflows and numerical behavior. Complete item/champion explorers, saved builds, a comparison product, patch pinning, new game mechanics and a hosting migration remain separate feature work. No production application merge is part of this release.

The runtime-only build uses one authoritative source and emits root and nested preview copies. A deterministic local ZIP contains 142 generated files with exact Git bytes and no development files; [artifact evidence](phase6-artifact.json) records its checksum. The guarded combined deployment rehearsal preserves all 133 production files and verifies all 142 refactor files byte-for-byte. CI runs units/build/release-fingerprint checks, and Pages validates the release fingerprint before upload alongside exact production/refactor byte comparisons. Local full browser/performance/recovery evidence is bound to the runtime hashes; it is not described as a browser suite executed on GitHub.

## Deletion and behavior review

| Change | Evidence / resulting behavior |
|---|---|
| 38 manually maintained preview runtime copies removed in Phase 2 | Original bytes matched root. Build output regenerates both routes; relative links/assets and attribution are verified. No second editable runtime tree remains. |
| Dormant `champLookup.js` and `itemLookup.js` retired | Their public routes already showed notices. Complete data records, query policies, descriptions and list/detail views are independently exercised. Notice pages and Builder links remain. |
| `comboUI.js` migrated to scoped ComboControls | Editing, callbacks, tooltips, dialog focus and sequences remain covered. Each instance owns its own draft; it no longer subscribes to global Builder state. |
| 57 forwarding/diagnostic functions, two unused rune renderers and unreachable description wiring removed | [Exact forwarding list](phase5-removed-forwarders.json) and [Phase 5 ledger](REFACTOR-PHASE5.md). Migrated native capabilities have caller/reuse coverage; optional-source fallback and unavailable outcomes remain. |
| Global/CommonJS runtime registration and manually ordered scripts removed | Relative native import graph resolves and is acyclic. Native entry and simultaneous components work without compatibility globals. Historical characterization aliases are test-only and excluded from the artifact. |
| Shared state/request/event ownership changed | Build/scenario snapshots, combo health progression and control instances are independent. Latest detail response wins; disposed instances ignore late writes and retained controls. These are intentional lifecycle improvements, not new damage rules. |
| Target control model synchronization and attack-module dependency corrected | Authoritative external target changes update the draft without reformatting equivalent typed values. AttackChampions receives the existing average-crit callback, eliminating a circular import with unchanged arithmetic. |
| Source audits and historical documentation reconciled | The stale six-slot audit predicate was repaired separately in Phase 4. All 30 classified passive-token findings and the three known source defects remain. Historical evidence is retained and current boundaries are explicit. |
| Release verification tools and deployment guard added | New tooling does not alter runtime results. A changed/missing/added runtime file or incomplete/failed release proof blocks refactor upload. Reviewed future numerical changes require a completed difference/reference review, not overwriting historical expectations. |

No CSS, optional-data fallbacks or artwork attribution were removed without usage evidence. Numeric coercion, percent/rank bounds, unavailable labels and formatting precision retain their existing owner semantics. Source-derived coefficients and selected aliases remain unchanged. The preserved five scenarios per mode compare complete displayed records; headless checks separately retain full-precision values and statuses. The original combo baseline recorded rounded totals, so its one-decimal damage/HP and two-decimal duration remain the comparison contract.

## Handover

[Architecture](ARCHITECTURE.md) maps ownership and release boundaries. [Extension recipes](EXTENDING.md) show a data adapter, an effect, a scoped panel, an explorer composition and separate comparison candidates. [Contributing](CONTRIBUTING.md) and [Testing](TESTING.md) explain development checks, preserved fixtures, release proof and clean-source reproduction. [Roadmap](ROADMAP.md) distinguishes structural readiness from remaining product/mechanics work.

Retained integration coverage includes catalog browsing without a build, 173 champions and all 868 item records, Builder's 236-item policy, A/B/A calculations, immutable sources/inputs, equivalent explorer contexts, form/alias fixtures, independent combo health steps, two sets of ten UI components, pending request races and mount/update/dispose behavior. The actual native Builder entry is also exercised without test compatibility aliases.

[Recovery](REFACTOR-PROTECTION.md) uses the independent bundle and checked ignored-data archive in a fresh checkout. Its rehearsal is offline source/data restoration, not a production deployment change. The baseline tag and branch stay fixed.

## Evidence

All 227 units and 32 browser checks pass across generated root and preview routes. Twenty complete advanced/fallback case comparisons match exactly. Source/combat/ability audits and ranged/melee item-description audits retain classified baseline outcomes. Ten headless cases and catalog/component reuse pass. Original/copied fixture JSON and all runtime files remain unchanged during verification.

A final clean staged-source archive passes 227 units, build, ten headless cases, catalog reuse, and independent UI/native-entry checks on both routes. The independent recovery clone passes 201 original units, two broad browser modes and ten exact baseline cases; bundle/archive hashes and all 1,336 archive entries were verified.

The actual-entry performance comparison alternates five trials per version/mode, with a fresh context and repeat visit (40 visits). Measured medians and maximum edit/picker p95 values:

| Data / visit | Original ready (ms) | Refactor ready (ms) | Highest refactor interaction p95 (ms) |
|---|---:|---:|---:|
| fallback / fresh-context | 149.5 | 192.5 | 18.6 |
| fallback / repeat-context | 134.2 | 176.1 | 6.2 |
| advanced / fresh-context | 147.9 | 200.7 | 22.6 |
| advanced / repeat-context | 137.1 | 177.6 | 19.2 |

The 40–53 ms startup increase is disclosed, with all results within the predeclared budgets. It is consistent with additional native import loading/composition; the benchmark does not isolate individual causes. Ordinary measured interactions remain below 23 ms. Local assets are served from memory, API fixtures have a fixed 20 ms delay, and remote artwork is replaced. Routing disables HTTP cache, so repeat-context visits are not real CDN/disk-cache measurements. Desktop/mobile overflow and ability geometry match the original.

See [complete checks](phase6-verification.json), [performance samples/method/budgets](phase6-performance.json), [independent recovery](phase6-recovery.json), [headless values](phase6-headless.json), and [source-bound release proof](phase6-release.json). Full logs and isolated fixture/source copies remain in ignored local test-results folders. Known limitations are the preserved baseline limitations, including optional live/unversioned Community Dragon data and bounded simulation support; this refactor is not new-patch or universal game-accuracy certification.

## Verified publication

Application/tooling commit `2a9852827fa4748967f5bef6e18f6e0971e563df` passed [GitHub regression/build/release checks](https://github.com/SRIOS-TEACH/LoL-Builder/actions/runs/37636770137) and [Pages deployment](https://github.com/SRIOS-TEACH/LoL-Builder/actions/runs/37636770282). All 71 runtime files on both live routes match saved Git bytes; native JavaScript MIME types are correct. Both actual hosted entries pass core interactions with preserved API fixtures. Seven production smoke files, including riot.txt, match the unchanged main commit; the deployment workflow verifies all production bytes before upload. The baseline branch/tag remain fixed. [Publication evidence](phase6-publication.json) records the verified revisions and file hashes. Completion-documentation updates retain the identical runtime. [Open the refactor preview](https://srios-teach.github.io/LoL-Builder/modular-refactor/Builder.html).
