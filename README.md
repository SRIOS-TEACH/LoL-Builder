# LoL-Builder
A web app to experiment with different League of Legends champion builds.

## Project goals
This repository is focused on three practical workflows:
1. **Champion lookup** (verify ability/stat/source data).
2. **Item lookup** (search/filter items and inspect detailed item formulas).
3. **Build sandbox** (combine champion + items + levels and inspect resulting stats).

The app intentionally validates data and readability first before adding advanced simulation features.

---

## How to run locally
From the repository root:

```bash
python3 -m http.server 8000
```

Open pages directly:
- `http://127.0.0.1:8000/main.html`
- `http://127.0.0.1:8000/champ.html`
- `http://127.0.0.1:8000/itemLookup.html`
- `http://127.0.0.1:8000/Builder.html`


### Generated preview and deployment

Root HTML, JS, CSS and assets are the only runtime source. Run `npm run build:preview` to generate local `/preview/` pages before serving the repository. Run it again after source changes. Do not edit generated files.

Run `npm run build` to create `dist/` with both the main site and the same preview routes. The Pages workflow verifies that artifact and publishes it under /modular-refactor/ alongside unchanged production files from main. Generated output is ignored by Git. See [delivery and deletion evidence](docs/REFACTOR-PHASE2.md).

[Open the modular refactor preview](https://srios-teach.github.io/LoL-Builder/modular-refactor/Builder.html). Pushes to the refactoring branch update it automatically after checks pass; see [Pages setup](docs/REFACTOR-PAGES.md).

### Tests and current limits

Run `npm test` with Node 20+ for dependency-free regression tests. See [Testing](docs/TESTING.md) for the browser suite and fixture downloads.

Read the [reliability audit](docs/AUDIT.md) for fixed defects, test coverage and the remaining accuracy work. This is a stat sandbox, not a complete combat simulator. Advanced data is optional, unsupported formulas stay unavailable, and champion-specific rules are not fully modeled.

---

## File map (what each major file does)

### HTML entry points
- `index.html` — lightweight redirect entry for static hosting.
- `main.html` — simple navigation landing page.
- `champ.html` — Champion Lookup UI shell.
- `itemLookup.html` — Item Lookup UI shell.
- `Builder.html` — Build sandbox UI shell.

### JavaScript
- `JS/shared/apiClient.js` — shared Data Dragon / Community Dragon fetch helpers.
- `JS/shared/itemPolicy.js` — shared item eligibility and map-priority dedupe helpers.
- `JS/shared/itemData.js` — shared optional item calculations and tooltip formatting.
- `JS/shared/buildStats.js` — pure stat growth, attack-speed and item stat-block parsing.
- `JS/shared/abilityRules.js` — shared ability rank constraints and normalization helpers.
- `JS/champLookup.js` — loads champion data from Data Dragon and renders splash/lore/abilities.
- `JS/itemLookup.js` — controls item search, filters and selection, using shared data/formatting helpers.
- `JS/builder.js` — champion/item/level setup logic, item modal UX, ability rank validation, and stat rendering.

- JS/data/ — read-only source repositories and champion/item/rune adapters with provenance.
- JS/domain/ — catalog queries, recommendations and independent build/rune/scenario rules.
- JS/application/catalogSession.js — isolated browsing sessions for future explorers.
- JS/core/ — shared plain-record and text operations with explicit semantics.

The Builder delegates these responsibilities to reusable capabilities. See [Phase 3 contracts](docs/REFACTOR-PHASE3.md) for reuse examples and remaining calculation/UI work.

### Additional docs

- `docs/ROADMAP.md` — milestones for saved profiles, targets, combos, build imports and a controlled v1.0 release.
- `docs/ARCHITECTURE.md` — high-level ownership and module boundaries.
- `docs/CONTRIBUTING.md` — coding conventions and contributor workflow.
- `docs/DATA_SOURCES.md` — external payload inventory and purpose.

### CSS
- `CSS/lolBuilder.css` — project-specific layout/theme styles for all pages.
- `CSS/halfmoon-variables.css` — framework/theme variables.

---

## Data sources
- **Data Dragon** (version index + game data + art):
  - Versions index: `https://ddragon.leagueoflegends.com/api/versions.json`
  - Champion list: `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json`
  - Champion detail/abilities: `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion/{champion}.json`
  - Item list: `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/item.json`
  - Item icons: `https://ddragon.leagueoflegends.com/cdn/{version}/img/item/{itemId}.png`
  - Champion passive icons: `https://ddragon.leagueoflegends.com/cdn/{version}/img/passive/{file}.png`
  - Champion spell icons: `https://ddragon.leagueoflegends.com/cdn/{version}/img/spell/{file}.png`
  - Champion splash art: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/{champion}_0.jpg`
- **Community Dragon** (advanced calculations + runtime assets):
  - Item calculations: `https://raw.communitydragon.org/latest/game/items.cdtb.bin.json`
  - Champion spell calculations: `https://raw.communitydragon.org/latest/game/data/characters/ashe/ashe.bin.json`
  - Champion Descriptions: `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/en_us/v1/champions/{championId}.json`
  - Rune/perk icons: `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/`

---

## Reusable calculation pipeline

Stat, ability/item and combo calculations now accept independent build/scenario inputs and prepared data. They can run without the Builder page for future explorers and build comparison. See [Phase 4 contracts](docs/REFACTOR-PHASE4.md) and [completion checklist](docs/REFACTOR-ACTIONS.md).

Phase 5: [reusable UI, native modules and composition contracts](docs/REFACTOR-PHASE5.md).

Refactor handover: [Phase 6 release checks](docs/REFACTOR-PHASE6.md), [extension recipes](docs/EXTENDING.md), [contributor workflow](docs/CONTRIBUTING.md), and [recovery](docs/REFACTOR-PROTECTION.md).

## Explorers and saved builds

Champion Explorer (`champ.html`) searches by name or role and shows lore, abilities and patch base stats. Item Explorer (`itemLookup.html`) reuses the shared filters and calculation inputs. The patch-notes link opens Riot's official archive; automatic champion-specific patch history is not currently supplied.

Save a named build in Builder, then open `Comparator.html` to compare portrait cards, copy a build or reopen it for editing. Builds are saved in this browser's local storage, independently for each site origin. Cards capture the Builder's results at save time, including patch, combat settings and combo. Reopening recalculates with the currently loaded patch; saving updates that card. These results inherit the Builder's calculation limits. Only the Builder's single current combo is captured per build.
