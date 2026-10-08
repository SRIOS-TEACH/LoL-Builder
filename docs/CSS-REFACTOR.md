# CSS refactor review

Completed on `codex/css-refactor`, based on production commit `dec545072a02196260df10837258b857caa805f0`. This is a review candidate; production is unchanged.

- [x] Inventory public HTML, generated controls, class prefixes, media rules and custom-property dependencies.
- [x] Replace the full framework with a maintained, attributed foundation subset.
- [x] Remove 2,143 unused framework rules and 1,237 unused framework variables.
- [x] Retire 73 obsolete project rules and remove 79 superseded declarations without changing numeric logic.
- [x] Separate shared theme, dialog and state helpers from stats, inventory, catalogs, runes, abilities, combat, combos and Builder composition.
- [x] Preserve public page layouts, selected/disabled states, modal visibility, heading precedence and responsive behavior.
- [x] Verify 60 baseline visual states: computed standard CSS properties, pseudo-elements, geometry and screenshots all match.
- [x] Pass all 230 units, 32 two-route browser checks and 20 exact baseline comparisons.
- [x] Reproduce units/build/imports/headless/reuse and both native entries from clean staged source.
- [x] Pass 40 controlled actual-entry timing visits against the immediate pre-CSS production version.
- [x] Preserve historical release/recovery evidence and record reviewed current fingerprints.

| Maintained stylesheet source | Before | After | Reduction |
|---|---:|---:|---:|
| Physical lines, including comments and blanks | 16,118 | 4,547 | 71.8% |
| UTF-8 bytes, normalizing CRLF/LF | 547,104 | 98,892 | 81.9% |
| Files | 2 | 13 | Focused owners |

The reduction is primarily the unused framework. Project styles alone occupy fewer bytes, but more physical lines after expanding dense one-line declarations for readability. These figures describe source bytes, not gzip transfer sizes or performance gains.

[Stylesheet ownership and extension](STYLES.md) explains the retained foundation surface, component dependencies, existing markup-specific selectors and page composition. The original Halfmoon/Bootstrap attribution remains in the foundation. Public pages link the new foundation; `lolBuilder.css` is an import manifest. No production dependency or CSS build toolchain was added.

Shared backgrounds can be used without importing Builder layout. Target/combo dialogs share `.tool-dialog`/`.dialog-header` styles, with existing class names preserved as aliases. Stat filters belong to catalogs; generic numeric icons remain reusable. Builder-specific compact variants remain separate.

## Controlled timing

| Data / visit | Previous startup median (ms) | CSS refactor median (ms) | Highest interaction p95 (ms) |
|---|---:|---:|---:|
| fallback / fresh-context | 179.4 | 184.2 | 17.7 |
| fallback / repeat-context | 160.7 | 168.8 | 5.4 |
| advanced / fresh-context | 180.2 | 180.9 | 21.4 |
| advanced / repeat-context | 161.3 | 171.2 | 19.2 |

Startup is approximately 1–10 ms slower in these samples, while all fixed budgets and layout comparisons pass. The payload reduction does not establish a startup speedup. Local assets are memory-served, APIs have a fixed fixture delay, artwork is replaced and browser routing disables HTTP caching; actual CDN/device performance was not measured. Visual checks use the available Chromium/Edge engine, not every browser or real artwork.

[Review and visual proof](css-refactor-review.json), [full verification](css-refactor-verification.json), [timing samples](css-refactor-performance.json), and [current release proof](release.json) record the reviewed source. The original `phase6-*` evidence remains unchanged. The original independent backup still protects the fixed pre-refactor baseline; this task does not claim a new backup-recovery drill.
