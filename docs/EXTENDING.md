# Extending the refactored application

The refactor supplies reusable capabilities; new explorer and comparison products are still feature work. Add a vertical slice through data, inputs, evaluation, presentation and a scoped view. Read [Architecture](ARCHITECTURE.md), [component contracts](REFACTOR-PHASE5.md) and [Testing](TESTING.md) first.

## Choose the owner

| Responsibility | Location | Boundary |
|---|---|---|
| Copy/freeze records, normalize search text, escape text | `JS/core` | General operations, no champion or page rules |
| Provider transport and source preparation | `JS/data` and `shared/apiClient.js` | Immutable records plus provider/version provenance; optional failure is explicit |
| Catalog eligibility, rune/role constraints, saved input snapshots | `JS/domain` | Rules over explicit inputs; no DOM or fetching |
| Formula, build, ability, item and combo evaluation | `JS/engine`, established `JS/shared` effect modules | Full-precision numbers, units and ready/partial/unsupported outcomes |
| Text and result formatting | `JS/presentation`, established description helpers | Evaluated data to display; HTML never becomes numeric input |
| List/detail rendering and edit controls | `JS/ui` | Supplied elements, input draft, callbacks, update and disposal |
| Loading, committing selections, sequencing refreshes | `JS/application` | One page's canonical state and source/request ownership |
| Page startup | `JS/builder.js` or a new page entry | Resolve markup, compose capabilities, start the page |

Existing shared effect files remain the authoritative rule implementations; folder placement alone is not a reason to duplicate or rewrite them. Required capabilities are relative native imports. Do not add runtime globals, ordered-script dependencies or imports of Builder from another page. A general helper must preserve its callers' coercion, null handling, rounding and escaping semantics.

## Add a data adapter

1. Capture a small provider fixture and record the provider, URL, selected version and exact bytes. Keep full downloaded data in the ignored fixture store and independent backup; do not silently replace the protected expectations.
2. Normalize in a data module. Preserve stable champion/item/action IDs, raw references and unknown fields needed by supported formulas. Return immutable records and source provenance. Data Dragon remains authoritative for the selected patch's base champion stats; optional Community Dragon fields cannot replace the entire base record.
3. Inject transport through `createApiClient(fetchImpl)` and `SourceRepositories.createRepository({api})`, or inject a detail loader into a catalog session/component. Match the relevant repository result contract (`records`/`record`, `source`, and explicit optional-data status). Do not make a view fetch a provider directly.
4. Test invalid/missing records, absent optional data, concurrent requests/retry, normalization and unchanged raw payloads. Pass the same prepared records to a headless calculation session and a view.

A new provider requires an intentional provenance policy. The existing Community Dragon source is `latest`; this refactor does not pin a historical snapshot or promise cross-patch saves.

## Add an effect rule

First determine whether the value is a base stat, stat passive, attack/on-hit rule, ability result or combo event. Keep each rule in its owner: ChampionEffects for champion stat/source bindings, AttackChampions/AttackEffects for attack behavior, ItemEvaluation for structured item outcomes, and ComboEvaluation for supported sequence composition. Do not implement the same rule separately in a tooltip and combo panel.

For an item passive, use its stable item ID and existing section key in `AttackEffects.itemPassiveBindings`. Read coefficients from the named/hashed source calculation or data value; a tooltip mentioning damage is not proof that the effect is modeled. Explicit activation, stack and timing values belong in build combat inputs; descriptor discovery and context application belong in CombatContext. CombatInputs only renders those descriptors.

For a champion attack profile, the caller supplies the existing average-crit calculation explicitly along with source/rank/control callbacks. Do not import AttackEffects back into AttackChampions: that recreates a circular dependency.

Keep damage packet type, units, raw/mitigated values and unavailable/partial status explicit. Format only after evaluation. Test one independently justified numeric example plus interaction boundaries such as disabled activation, unknown versus zero, rank/stack limits, mitigation, shared proc interval and A/B/A isolation. New mechanics intentionally change results and need their own reference cases; do not relabel a difference as refactor equivalence.

## Add a UI panel

Create a factory that accepts actual containers or named element slots, an initial model, evaluation/loading providers where needed, and explicit callbacks. Own only the panel's temporary draft, selection, dialog/tooltip state and event listeners. Use the shared lifecycle helper, the container's owner document and unique generated IDs. An asynchronous detail request must apply only its latest response and ignore completion after disposal.

The page owns authoritative inputs. A control reports a change; the page applies domain rules, evaluates and sends the resulting model back through `update`. Equivalent updates must preserve partially typed input. Disposal retires listeners, dialogs and pending writes; it must be idempotent. Test two simultaneous panels, a retained old control after replacement/disposal, and one instance remaining usable after the other is retired. Use `tests/ui-reuse-browser.cjs` as the composition example.

## Compose explorers

A champion explorer needs a repository, CatalogQueries or an independent CatalogSession, CatalogList and ChampionDetail. The basic catalog retains lore/skins/abilities; advanced data is optional. An item explorer uses the complete catalog with its own explicit map/purchasability/deduplication policy. Builder's 236-item policy must not silently remove records from the 868-item fixture catalog.

This champion-list recipe uses real exported interfaces; the caller supplies its own two containers:

```js
import SourceRepositories from '../data/sourceRepositories.js';
import CatalogQueries from '../domain/catalogQueries.js';
import {createCatalogList} from '../ui/catalogList.mjs';
import {createChampionDetail} from '../ui/championDetail.mjs';

const repository = SourceRepositories.createRepository();
const version = '16.18.1'; // example selected fixture patch, not a pinned live release
const catalog = await repository.loadChampionCatalog(version);
const detail = createChampionDetail({
  root: detailElement,
  loadDetail: async id => (await repository.loadChampionDetails(version, id)).record,
});
const inspect = id => detail.update({id, record: catalog.records[id], version});
const list = createCatalogList({root: listElement, kind: 'champion', onInspect: inspect, onSelect: inspect});
list.update({ids: CatalogQueries.queryChampions(catalog.records, {search: ''}), records: catalog.records, version});
// On page retirement: list.dispose(); detail.dispose();
```

An item detail view receives the item/source record, explicit base/combat context and a description provider. Inspect/select callbacks are intents: only the owning product decides whether to navigate, inspect or equip. Neither explorer needs Builder's page controller.

## Compose build comparison

Create a separate BuildInputs record, ScenarioInputs record, calculation session and component instances for every candidate. Share immutable source catalogs/prepared records when their champion/source baseline matches. A different champion needs its own prepared champion/ability data. Keep combo steps, overrides and target health progress separate, even when candidates use equivalent scenario values.

```js
import BuildInputs from '../domain/buildInputs.js';
import ScenarioInputs from '../domain/scenarioInputs.js';
import CalculationPipeline from '../engine/calculationPipeline.js';
import ComboEvaluation from '../engine/comboEvaluation.js';

const buildA = BuildInputs.createBuildInputs(candidateInputsA);
const buildB = BuildInputs.createBuildInputs(candidateInputsB);
const scenarioA = ScenarioInputs.createScenarioInputs(sharedScenario);
const scenarioB = ScenarioInputs.createScenarioInputs(sharedScenario);
const resultA = CalculationPipeline.create({build: buildA, scenario: scenarioA, data: preparedDataA}).evaluateBuild();
const resultB = CalculationPipeline.create({build: buildB, scenario: scenarioB, data: preparedDataB}).evaluateBuild();
const comboA = ComboEvaluation.evaluate({build: buildA, scenario: scenarioA, data: preparedDataA, steps: stepsA});
const comboB = ComboEvaluation.evaluate({build: buildB, scenario: scenarioB, data: preparedDataB, steps: stepsB});
```

Read metrics from structured results with stable IDs/units and full precision. Preserve partial/unsupported diagnostics and incompatibilities; do not compare a fabricated zero to an available result. Use the same approved data baseline for a meaningful difference. Versioned serialization, local saves, share codes and the complete comparison page remain roadmap features.
