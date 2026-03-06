# Testing and Checks

## Fast syntax checks
```bash
node --check JS/shared/apiClient.js
node --check JS/shared/itemPolicy.js
node --check JS/shared/abilityRules.js
node --check JS/champLookup.js
node --check JS/itemLookup.js
node --check JS/builder.js
```

## Unit tests (pure helpers)
```bash
node tests/itemPolicy.test.js
node tests/abilityRules.test.js
```

## Manual smoke checks
1. `python3 -m http.server 8000`
2. Open each page (`main.html`, `champ.html`, `itemLookup.html`, `Builder.html`).
3. Verify:
   - No console errors on load.
   - Modal interactions and filtering still work.
