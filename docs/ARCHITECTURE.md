# Architecture Overview

## Application surfaces
- `main.html`: static navigation landing page.
- `champ.html` + `JS/champLookup.js`: champion lookup and ability rendering.
- `itemLookup.html` + `JS/itemLookup.js`: item search/filter/detail explorer.
- `Builder.html` + `JS/builder.js`: build sandbox (champion, items, runes, abilities, stats).

## Shared browser modules
- `JS/shared/apiClient.js`: all Data Dragon / Community Dragon HTTP helpers.
- `JS/shared/itemPolicy.js`: shared item eligibility and dedupe logic.
- `JS/shared/abilityRules.js`: shared level/rank constraints for spells.

## Data flow
1. Page controller boots on `DOMContentLoaded`.
2. Controller loads latest game version from Data Dragon.
3. Feature-specific data is fetched (champions/items/cdragon calcs).
4. State object is updated.
5. DOM is rendered from state.

## State ownership
- `CHAMP_STATE` is owned by `champLookup.js`.
- `ITEM_STATE` is owned by `itemLookup.js`.
- `BUILDER` is owned by `builder.js`.
- Shared modules are stateless/pure except network calls.

## Integration boundary
`builder.js` consumes `window.ItemLookupShared` when available for tooltip enhancement logic, while item-policy and API concerns now come from dedicated shared modules.
