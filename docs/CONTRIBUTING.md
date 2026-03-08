# Contributing Guide

## Coding standards
- Keep business logic separate from DOM rendering.
- Prefer `addEventListener` over inline HTML event handlers.
- Reuse helpers from `JS/shared/` before adding page-local duplicates.
- Add JSDoc for non-trivial pure helper functions.

## Data fetching
- Use `window.ApiClient` for all remote calls.
- Handle fetch failures with clear user status messages.
- Avoid silently swallowing errors unless there is a documented fallback.

## State management
- Mutate only the owning page state object (`CHAMP_STATE`, `ITEM_STATE`, `BUILDER`).
- Keep derived values computed in helper functions; avoid ad-hoc mutations in render methods.

## Before opening a PR
1. Run syntax checks for the edited JavaScript files (for example: `node --check JS/builder.js`).
2. Validate core flows manually:
   - Champion lookup renders champion and abilities.
   - Item lookup search/filter/detail interactions work.
   - Builder champion/rune/item modals still function.
3. Update docs if data sources or architecture boundaries changed.
