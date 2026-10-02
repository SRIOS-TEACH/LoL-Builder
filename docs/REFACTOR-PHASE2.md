# Phase 2 — One runtime source and deletion ledger

Completed: 2 October 2026. Scope: delivery duplication and deletion triage. The authoritative runtime remains the five root HTML pages plus CSS/, JS/ and assets/. No runtime calculations, lookup capabilities, global APIs, selectors or fallback behavior have been changed.

## Delivery

Run `npm run build` to generate dist/. It contains the application at its root and an identical copy under preview/, preserving all five page routes and relative CSS, JavaScript and shop-image paths. The generator copies bytes rather than transforming source. It replaces only its fixed output directory, rejects output symlinks and reads all inputs before replacing the output. No package installation, bundler or framework is required.

Run `npm run build:preview` before serving the repository if you want its /preview/ routes locally. After editing source, generate again. Both preview/ and dist/ are ignored output; never edit them as source. A fresh checkout needs generation before preview URLs exist.

The Pages workflow now runs unit tests and generates dist/ before uploading it. Hosting provider and main-branch trigger are unchanged. Publishing this refactoring branch does not deploy the site. Development docs, tests, scripts, fixture captures and backup evidence are excluded from the site artifact; assets/shop/README.md is included to retain artwork attribution and provenance. The final release review remains Phase 6.

The baseline capture runner generates preview inside its isolated snapshot before running its existing root/preview matrix. Its integrity checks continue to monitor authoritative source files.

## Deletion ledger

| Candidate | Purpose and callers | Decision and evidence |
| --- | --- | --- |
| 38 tracked preview files listed below | Duplicate pages, scripts, styles and shop icons used by /preview/ URLs | Remove tracked copies; regenerate the same files. Before removal all 38 matched generated output byte for byte. Root runtime retains their implementations. Page/asset parity and browser checks cover generated delivery. |
| Champion and item lookup controllers | Dormant page wiring plus useful catalog/detail behavior for future explorers | Retain both root controllers. Disabled pages do not prove the underlying behavior is unnecessary; extract and demonstrate reusable capabilities in Phases 3–5 first. |
| CSS selectors, dynamic classes and theme variables | Current, responsive, modal and dormant page styles | Retain. Text searches are not sufficient proof of absence; Phase 1 inventory records generated class/asset use. |
| Advanced-data fallbacks, attribution and unsupported-result handling | Data-loading and calculation consumers | Retain. Fallback browser checks and baseline cases remain required. |
| General formatting, escaping and clamping candidates | Existing calculation/presentation helpers described below | Retain during delivery cleanup. Complete responsibility extraction with migrated consumers in Phase 3 or 5. |
| Documentation and development evidence in the old Pages upload | Contributor/verification material, no runtime page dependency | Retain in Git; exclude from generated runtime artifact. All current local HTML references resolve in both artifact routes. |

### Removed duplicate paths

- `preview/Builder.html`
- `preview/CSS/halfmoon-variables.css`
- `preview/CSS/lolBuilder.css`
- `preview/JS/builder.js`
- `preview/JS/champLookup.js`
- `preview/JS/comboUI.js`
- `preview/JS/itemLookup.js`
- `preview/JS/shared/abilityDps.js`
- `preview/JS/shared/abilityOnHit.js`
- `preview/JS/shared/abilityRules.js`
- `preview/JS/shared/apiClient.js`
- `preview/JS/shared/attackChampions.js`
- `preview/JS/shared/attackEffects.js`
- `preview/JS/shared/buildStats.js`
- `preview/JS/shared/calculations.js`
- `preview/JS/shared/championEffects.js`
- `preview/JS/shared/combatInputs.js`
- `preview/JS/shared/comboTester.js`
- `preview/JS/shared/damageText.js`
- `preview/JS/shared/itemData.js`
- `preview/JS/shared/itemDescriptions.js`
- `preview/JS/shared/itemPolicy.js`
- `preview/JS/shared/runeEffects.js`
- `preview/JS/shared/targetDamage.js`
- `preview/assets/shop/all.png`
- `preview/assets/shop/assassin.png`
- `preview/assets/shop/fighter.png`
- `preview/assets/shop/gold.png`
- `preview/assets/shop/mage.png`
- `preview/assets/shop/marksman.png`
- `preview/assets/shop/recommended.png`
- `preview/assets/shop/reset.png`
- `preview/assets/shop/support.png`
- `preview/assets/shop/tank.png`
- `preview/champ.html`
- `preview/index.html`
- `preview/itemLookup.html`
- `preview/main.html`

## Helper review

- ItemDescriptions and DamageText contain equivalent HTML escaping for nullish input and the five HTML-sensitive characters. They are valid future general-purpose extraction candidates, but neither owning module is redundant. Their VM test loaders and ordered page scripts currently load the modules independently. Introduce the shared helper with those consumers during the planned capability extraction.
- Builder attack escaping and combo escaping first call String(value), so null and undefined differ from the nullish-empty behavior above. Builder rune attribute escaping uses value || "", which also treats zero and false differently. Do not replace these wrappers indiscriminately.
- ItemDescriptions and DamageText number formatting round finite values to two decimals but use differently capitalized unavailable labels. Combo values round to three decimals; attacks use one fixed decimal and include partial status. Keep those presentation contracts.
- Calculations.number performs numeric coercion and returns null when unavailable; rune number extraction parses source prose. These are different responsibilities despite sharing a name.
- TargetDamage clamping is general arithmetic; rank, rune, level and percentage clamps additionally encode domain bounds, integer/coercion rules or defaults. Move domain rules with their capabilities rather than merging them into a broad utilities module.
- itemData.escapeRegExp escapes regular-expression syntax, not HTML. Keep that security/semantic boundary.

No helper merge is necessary to eliminate preview maintenance. This review completes deletion triage; useful shared helpers remain identified for the subsequent extraction rather than being treated as dead code.

## Verification

All 203 unit tests and 28 browser runs passed. All five representative cases matched the baseline exactly in both advanced and fallback modes, for both artifact routes (20 comparisons). Final results are recorded in [phase2-delivery.json](phase2-delivery.json). The two focused artifact checks also passed after including the artwork attribution file. A clean Git archive of the saved changes built successfully without ignored files, and both artifact checks passed there as well. The Phase 1 ability-audit exceptions remain unchanged. This phase does not establish game accuracy.

Checks cover all 38 root runtime files against the protected Git baseline (normalizing only Git's Windows text line endings); generated root, generated preview and local preview match their authoritative source bytes exactly. Artifact tests cover local page links, exclusion of development files, stale output removal, missing-input preservation and output-symlink rejection.

Run `npm test` and `npm run build` from a clean checkout. With the fixture/browser environment from [Testing](TESTING.md), run the existing browser suites using APP_ROOT set first to the absolute dist directory and then to dist/preview. Run browser, DPS and attack suites with ADVANCED_DATA unset and with 1; run DPS again with TARGET_SETTINGS=1; run dashboard, picker, passives, target, combo, combo-effects and champion-effects with advanced data. Finally use scripts/capture-refactor-cases.cjs in both data modes and compare its cases array to docs/refactor-baseline/cases-advanced.json or cases-fallback.json. Keep new evidence under test-results and do not overwrite the Phase 1 captures.