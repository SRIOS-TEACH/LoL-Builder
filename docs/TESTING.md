# Testing

## Unit regressions

Requires Node 20 or newer, no package installation:

```sh
npm test
```

The tests cover patch selection, request retry/deduplication, missing champion stats, malformed ranks, incomplete/circular/conditional formulas, stat sources, HTTPS artwork URLs, zero resource costs, item stat fallback, growth and attack-speed math.

## Browser regressions

Install Playwright separately (`npm install --no-save playwright`, then `npx playwright install chromium`) or point `PLAYWRIGHT_PATH` at an existing package and `BROWSER_PATH` at an existing Chromium/Edge executable.

Download fixtures first:

```sh
python scripts/download-test-data.py
npm run test:browser
```

`FIXTURES_DIR` may override `tests/fixtures`. The downloader preserves already-downloaded files; remove the fixture directory deliberately when changing patches. Game data is not committed.

The suite uses real downloaded Data Dragon payloads, replaces artwork with neutral placeholders, and deliberately responds with HTTP 503 for Community Dragon. It tests browser execution and fallback behavior; it does not verify live advanced data, artwork/CDN availability, every champion's special mechanics or in-game damage values.

Optional `SCREENSHOT_DIR` saves a Builder screenshot. The screenshot contains placeholder artwork and is layout evidence only.

## Manual/live validation still required

Run `python -m http.server 8000` from the repository root. Visit `http://127.0.0.1:8000/main.html`. Verify current Community Dragon access, compare supported calculations to the current game patch, and exercise the remaining items in `AUDIT.md` before declaring game-level correctness.
