# Stylesheet ownership and extension

The CSS refactor preserves the existing UI while removing unused framework features, obsolete project selectors and superseded declarations. It is based on production commit `dec545072a02196260df10837258b857caa805f0`; that commit retains the complete original styles for reference.

## Files and composition

`CSS/foundation.css` is a maintained project subset of Halfmoon 1.1.1, preserving its copyright, MIT license and Bootstrap attribution. It supplies the reset, base typography, navigation, forms, buttons, cards and utility classes used by the current pages and generated controls. It retains referenced custom properties and their transitive dependencies, including light/dark values and interactive states. It is **not the complete Halfmoon API**. The unused library should not be copied back wholesale when a new component is added.

`CSS/lolBuilder.css` is the explicit import manifest. It loads shared theme defaults, reusable components, Builder composition, and finally visibility/status utilities. Imports must remain before style declarations. Each imported file can also be composed into another page without importing Builder layout.

| Owner | File | Responsibility |
|---|---|---|
| Shared appearance | `CSS/shared/theme.css` | Theme tokens, page backgrounds, common surfaces and icons |
| Shared dialogs | `CSS/shared/dialogs.css` | Target/combo frames, backdrops and headers; reusable `.tool-dialog`/`.dialog-header` names retain compatibility with existing classes |
| Shared state | `CSS/shared/state.css` | Visibility and status; loaded last so display defaults do not reopen hidden panels |
| Stats | `CSS/components/stats.css` | Stat tables, labels, numeric values and icons |
| Inventory | `CSS/components/inventory.css` | Equipment slots, empty states and build cost |
| Catalogs | `CSS/components/catalog.css` | Champion/item list/detail controls, picker frames, filters and responsive regions |
| Runes | `CSS/components/runes.css` | Paths, choices, shards, stack controls and tooltips |
| Abilities | `CSS/components/abilities.css` | Cards, descriptions, damage/DPS tables and attack display |
| Combat controls | `CSS/components/combat.css` | Target inputs, combat conditions and passive controls |
| Combos | `CSS/components/combo.css` | Sequences, action selection, editing and tooltips |
| Builder composition | `CSS/pages/builder.css` | Dashboard grid, toolbar, responsive placement and compact variants |

The Builder file intentionally owns `.compact-dashboard` variants. Generic component defaults must not assume this page exists. Current picker/attack roots also use Builder IDs for page-specific geometry; a new page supplies its own layout around the reusable component classes rather than duplicating the Builder toolbar/grid. This refactor does not claim every existing selector is independent of markup.

A champion/item explorer can load the foundation, shared theme, catalog and stat-icon components, and shared state, then supply its own page layout. A comparison page can compose shared dialogs plus stats, inventory, abilities, combat and combo styles around independent control instances. Keep structural page layout in the page stylesheet and control appearance in the component stylesheet. Shared theme tokens have local fallbacks in component declarations.

## Making changes

Add ordinary declarations to their owner, not to the bottom of the import manifest. Keep responsive rules beside the affected component. Before introducing a new generic helper, check whether existing foundation or shared styles provide it. New generated classes must have explicit component styles; do not assume an unused framework utility is still available.

The removal review used selectors from all public HTML, native modules and generated-template prefixes, then retained all referenced variable dependencies. It did not remove styles solely because one browser visit failed to exercise them. Unsupported numeric outcomes, selected/disabled controls, dialogs, hover/focus states and responsive layouts remain part of the supported surface. Automated purging is not part of the production build.

## Verification

`npm run check:styles` checks all public stylesheet links, recursive local imports, import order, cycles, orphan stylesheet files and required custom properties. Unit coverage repeats this on both generated routes and deliberately exercises broken imports, cycles and absent variables.

`npm run test:styles` compares the pre-change source with the candidate using preserved API fixtures and placeholder artwork. Set `CSS_BASELINE_ROOT` to an isolated copy of the pre-change source, and the browser/fixture variables described in [Testing](TESTING.md). `CSS_OUTPUT` selects the evidence directory. The baseline must match the preserved Phase 6 runtime proof; `CSS_BASELINE_EVIDENCE` can explicitly select a different reviewed pre-change proof for future style work. Sixty states across five viewport sizes compare every computed standard CSS property (including `::before`/`::after`), element geometry and screenshots. Removed unused custom properties are excluded from computed-property comparisons; required dependency closure is checked separately. Animation, transitions and caret blinking are disabled consistently for screenshot determinism. These comparisons establish current-layout preservation, not real artwork or every browser-engine compatibility.

`npm run verify:refactor` retains the full advanced/fallback behavior checks, all champions/items, independently composed controls and exact numerical comparisons on both generated routes.

For controlled timing, run the existing performance harness with a clean checkout of the pre-CSS-refactor commit, `BASELINE_ROOT` pointing to it and `BASELINE_COMMIT=dec545072a02196260df10837258b857caa805f0`. The default remains the original protected baseline for historical checks. Run timing separately while other browser jobs are idle. The fixture/local-asset benchmark does not measure real CDN caching, fonts, artwork or network performance.

Release fingerprints must be refreshed from reviewed passing checks for the changed CSS/HTML; the build must not silently bless new source bytes. `docs/release.json` contains the current proof; the verifier falls back to the preserved `docs/phase6-release.json` for historical checkouts. Historical evidence is retained separately. Generated `dist/` and `preview/` remain disposable.
