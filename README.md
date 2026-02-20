# LoL-Builder
A web app to experiment with different League of Legends champion builds.

## Project goals
This repository is focused on three practical workflows:
1. **Champion lookup** (verify ability/stat/source data).
2. **Item lookup** (search/filter items and inspect detailed item formulas).
3. **Build sandbox** (combine champion + items + levels and inspect resulting stats).

The app intentionally validates data and readability first before adding advanced simulation features.

---

## File map (what each major file does)

### HTML entry points
- `index.html` — lightweight redirect entry for static hosting.
- `main.html` — simple navigation landing page.
- `champ.html` — Champion Lookup UI shell.
- `itemLookup.html` — Item Lookup UI shell.
- `Builder.html` — Build sandbox UI shell.

### JavaScript
- `JS/champLookup.js` — loads champion data from Data Dragon and renders splash/lore/abilities.
- `JS/itemLookup.js` — loads Data Dragon item list + CommunityDragon calculation payloads, applies filters, dedupes items, and renders readable formula details.
- `JS/builder.js` — champion/item/level setup logic, item modal UX, ability rank validation, and stat rendering.
- `JS/app.js` — earlier experimental app controller (kept for reference while migrating logic into focused page modules).
- `JS/LoLBuilder.js` — legacy prototype logic retained for reference/debugging.

### CSS
- `CSS/lolBuilder.css` — project-specific layout/theme styles for all pages.
- `CSS/halfmoon-variables.css` — framework/theme variables.

---

## Data sources
- **Data Dragon**: stable champion/item catalog and icons.
- **CommunityDragon**: richer item calculation payloads used for readable formula rendering.

---
