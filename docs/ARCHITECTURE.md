# Architecture

This is a static HTML/CSS/JavaScript app with no production dependencies. Root pages and their JS, CSS and assets can be served directly. A dependency-free copy step generates preview and deployment output from that single source; see [delivery](REFACTOR-PHASE2.md).

- `JS/shared/apiClient.js`: page-lifetime request cache, concurrent request deduplication, HTTP errors and a 15-second timeout. Failed requests leave the cache so selection can retry.
- `JS/shared/itemPolicy.js`: item eligibility and deterministic map/name deduplication.
- `JS/shared/itemData.js`: optional Community Dragon item index and tooltip/formula formatting. It contains no page controller. Consumers may create independent cache instances.
- `JS/shared/buildStats.js`: pure growth, attack-speed and item stat-block parsing helpers.
- `JS/shared/abilityRules.js`: generic Q/W/E/R rank normalization and level budget. Champion-specific rank systems are not yet supported.
- `JS/ui/`: scoped list/detail, inventory, rune, target, ability, stats and combo components with explicit inputs, callbacks and disposal.
- `JS/builder.js`: native module entry. `JS/application/builderPage.mjs` owns Builder state, source loading and workflow composition. No runtime compatibility globals.

Data Dragon is authoritative for the selected patch's base champion stats. Community Dragon is optional and cannot replace the entire stat object. Cached API payloads must be treated as read-only; selection makes its own champion/stat objects.

Champion selection commits its result only if it is still the latest request. Scoped detail views use their own request-counter pattern. A failed selection keeps the existing build and reports the failure.

The app is a stat sandbox, not a combat simulator. Described passives are not necessarily applied. Unsupported calculations stay unavailable instead of being coerced to zero.

## Extracted reusable capabilities

JS/data owns source loading, provenance and champion/item/rune normalization. JS/domain owns catalog queries, recommendations and build/rune/scenario inputs. JS/application/catalogSession.js provides independent browsing sessions. JS/core contains the shared record/text operations used by these consumers. Inputs and queries are separate from read-only source catalogs. The Builder page composes these native modules through explicit interfaces. Calculation capabilities live in JS/engine and description formatting in JS/presentation. Inactive lookup controllers have been retired after independent component coverage. See [contracts, composition and current limits](REFACTOR-PHASE3.md).

## Explicit calculation sessions

BuildInputs, ScenarioInputs and prepared source data compose through CalculationPipeline. Stat/context evaluation, structured ability/item resolution and combo action/health-step evaluation are reusable without Builder or browser APIs. Formula-only, partial and unsupported results remain explicit. See [Phase 4 contracts and verification](REFACTOR-PHASE4.md).

See [native UI contracts, ownership and reuse](REFACTOR-PHASE5.md). Each component receives containers from its owner; lists/details work without Builder and comparison candidates own separate inputs and component instances.
## Module ownership and release boundaries

| Layer | Inputs | Outputs / owner |
|---|---|---|
| Core | Explicit values | Copies, immutability and text operations; no page/game policy |
| Data | Provider transport plus selected version | Prepared immutable source records and provenance |
| Domain | Catalog plus build/scenario/query inputs | Eligibility, normalized inputs and accepted/rejected transitions |
| Engine | Separate build/scenario snapshots plus prepared data | Full-precision structured outcomes and explicit diagnostics |
| Presentation | Evaluated outcomes/source prose | Display text, labels and explanations |
| UI | Caller-supplied containers, model and providers | A private draft, scoped rendering and callbacks; update/dispose |
| Application / entry | Sources, canonical page inputs, components | Page workflows, selection races and lifecycle composition |

Source catalogs can be shared read-only. Mutable build/scenario records, combo steps/health progression and component instances cannot be shared between comparison candidates. A new page composes these capabilities directly. [Extension recipes](EXTENDING.md) show the supported interfaces and owners.

`npm run build` generates 82 source runtime files under both `dist/` and `dist/preview/`; generated trees are disposable. Development documentation, fixtures, tests and recovery folders are excluded. The combined Pages workflow preserves production bytes and places this artifact only under `/modular-refactor/`.

`verify:refactor` reproduces local fixture/browser characterization and checks runtime/fixture immutability. `verify:release` binds passing local release evidence to normalized-text/binary-exact runtime fingerprints. CI runs units/build/fingerprint verification; the Pages composition verifier repeats the fingerprint check before upload, including deployments triggered from main. Browser, performance and backup-recovery checks require the preserved local fixtures and are not represented as browser tests executed on GitHub.

The API still selects the current Data Dragon patch and optional Community Dragon `latest`. Source version pinning, serialization, storage and complete explorer/comparison products remain separate roadmap work. This structural refactor does not establish universal game accuracy or live compatibility with a newly published patch.

## Stylesheet ownership

The pages load the maintained Halfmoon foundation subset and the explicit project import manifest. Shared theme/state/dialogs, reusable component styles and Builder composition have separate owners. Visibility utilities load last; component imports stay local and resolve on both generated routes. See [Styles](STYLES.md) for composition, supported utilities, reuse dependencies and visual verification. The current release proof is `docs/release.json` when present; the historical Phase 6 proof remains unchanged.
