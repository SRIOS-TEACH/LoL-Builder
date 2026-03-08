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

### Quick sanity checks
Before committing JavaScript changes, you can run fast syntax checks from the repository root:

```bash
node --check JS/champLookup.js
node --check JS/itemLookup.js
node --check JS/builder.js
```

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
- `JS/shared/abilityRules.js` — shared ability rank constraints and normalization helpers.
- `JS/champLookup.js` — loads champion data from Data Dragon and renders splash/lore/abilities.
- `JS/itemLookup.js` — loads Data Dragon item list + CommunityDragon calculation payloads, applies filters, dedupes items, and renders readable formula details.
- `JS/builder.js` — champion/item/level setup logic, item modal UX, ability rank validation, and stat rendering.

### Additional docs
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
