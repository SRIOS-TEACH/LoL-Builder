# LoL-Builder
A web app to experiment with different League of Legends champion builds.

## Local preview
Run a static server from the repo root:

```bash
python3 -m http.server 8000
```

Open:
- `http://127.0.0.1:8000/main.html`
- `http://127.0.0.1:8000/itemLookup.html`
- `http://127.0.0.1:8000/Builder.html`

## Visual self-test screenshots (recommended)
If Codex/browser-container screenshots are flaky, capture screenshots locally with Playwright:

```bash
npm init -y
npm install --save-dev playwright
npx playwright install
```

Create `screenshot.mjs`:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 2000 } });

await page.goto('http://127.0.0.1:8000/itemLookup.html', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'itemLookup.png', fullPage: true });

await browser.close();
```

Then run:

```bash
node screenshot.mjs
```

This gives a deterministic screenshot workflow you can run outside Codex runtime constraints.
