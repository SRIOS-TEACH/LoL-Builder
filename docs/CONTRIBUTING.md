# Contributing

1. Reproduce a defect and add a focused regression test.
2. Fix it with the smallest clear change. Put pure shared logic under `JS/shared` rather than importing another page's controller.
3. Run `npm test`; run the browser suite for changes to page behavior or data integration.
4. Keep raw API data immutable. Do not invent zero values for missing data or guess calculation coefficients from prose.
5. Record unsupported game mechanics in `docs/AUDIT.md` and include verification evidence in a pull request.

Do not bundle UI redesign or new simulation features into reliability fixes. The application needs no npm install to run or to execute its unit tests. Browser testing uses a separately installed Playwright package and browser.
