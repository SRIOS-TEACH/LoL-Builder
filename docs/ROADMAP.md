# Roadmap to v1.0

Planning baseline: 13 September 2026. This is a proposed delivery sequence, not a commitment to dates or a claim that the features below already exist.

The v1.0 goal is: **create a build, save it, load it later, choose a target, test a combo, compare alternatives, and share a reproducible result.** Keep the desktop dashboard compact; use dedicated library/combo panels for larger workflows.

Profiles initially mean named saved build/scenario configurations, not online user accounts. Local saves and portable exports belong in v1.0. Account login, cross-device sync and automated guide-site imports are follow-up work.

## Starting point

The current app has champion/item lookup, a build dashboard, runes, role-dependent slot/level choices, ability and average attack calculations, conditional inputs, splash selection and source-provided recommendations. It is still a sandbox rather than a time-based combat simulator. Existing coverage and assumptions are documented in ON-ATTACK.md, DPS.md and AUDIT.md; browser coverage alone does not establish in-game numerical accuracy.

The repository already contains a GitHub Pages deployment workflow. It publishes the repository on pushes to main, separately from the unit-test workflow. Live deployment health and repository protection settings have not been verified for this roadmap.

## Delivery milestones

| Order | Milestone | Completion gate |
|---|---|---|
| M1 | Attack targets and mitigation | Verified target-dependent damage |
| M2 | Combo explorer | Deterministic action timeline |
| M3 | Versioned build/scenario model and data baseline | Reproducible inputs and data |
| M4 | Profile library, save/load and portable builds | Complete round-trip without data loss |
| M5 | Compare and share | Reproducible comparisons |
| M6 | Beta and release testing | Accuracy, recovery and performance gates pass |
| M7 | Production deployment | Tested release and rehearsed rollback |
| M8 | Guide imports and cloud accounts | Compatible providers and secure user data |

Targets and combos are the first two feature deliveries. Introduce their necessary in-memory models and fixed test fixtures during M1/M2; full serialization remains M3. Hosting selection and patch-release design proceed alongside feature development.
## M1 — Target stats and actual damage

Replace scattered target fields with one canonical target model. Offer:

- Manual target: maximum/current HP, bonus HP, armor, magic resistance and optional physical/magic/general shields.
- Champion target: champion, level and optional defensive build, with clearly marked manual overrides.
- Editable presets: squishy, bruiser, tank and training dummy. Label their assumed values rather than presenting them as universal targets.

Show raw damage and damage after mitigation for physical, magic and true damage. Model penetration/reduction in the correct order, including negative resistance behavior and champion-versus-item modifiers. Keep target-dependent ability scaling separate from mitigation. Support changing current HP without requiring a full champion target build.

Add game time and combat-state inputs only where an implemented effect consumes them. Gathering Storm, timed stacks and quest progress need named, verified effect bindings; a time field alone must not imply those effects are working.

**Gate:** numerical reference cases cover resistance signs, penetration ordering, true damage, shields, percentage-health and missing-health effects. The same target produces consistent results in the attack card, ability cards and saved scenarios.

## M2 — Explore combos

Provide a Combo panel with an action sequence: attack, Q/W/E/R, recast, item active and wait. Allow adding, reordering, duplicating and removing actions; save named sequences and provide a small set of verified starter combos.

The engine advances time and state. Track learned ranks, cooldowns, recast windows, cast times, attack timing, resources, buffs, stacks, on-hit events and target health after each hit. Do not add independently averaged DPS figures together: an actual sequence must account for shared time and proc state.

Show total damage, duration, DPS over that duration, damage by source/type, remaining target HP and an expandable event log. Highlight an illegal action at the point it occurs; never silently skip it. Distinguish theoretical earliest execution from a user-supplied delay. Stop at target death for time-to-kill reporting, with optional overkill shown separately.

For v1.0, support one stationary target, explicit timing, landed skillshots and documented supported mechanics. Use average critical damage where expected damage is valid, but label approximations when crit-dependent procs or changing HP make simple averages insufficient. Defer Monte Carlo simulations, pathing, dodging, multi-target bouncing and exhaustive combo optimisation.

**Gate:** verified examples include an attack reset, multi-stage recast, alternative ability form, damage-over-time refresh, shared item proc cooldown and changing-health execute/missing-health behavior. Unsupported mechanics remain visible as limitations rather than producing authoritative totals.

## M3 — A reproducible foundation

- Extract build serialization and validation from the page controller. Keep calculations independent of UI and storage.
- Define separate `Build`, `Target`, `CombatScenario` and `Combo` records with schema versions and stable IDs.
- Save champion, level, ranks, items and slot roles, quest choice, runes/shards, skin, toggles, stack counts, timing inputs and notes. Add target and combo references as those milestones land.
- Record Data Dragon version, Community Dragon snapshot/version and calculator version. Avoid mixing a saved patch with an unmarked `latest` payload.
- Save inputs as the source of truth. Recalculate outputs; any cached result must identify the versions that produced it.
- Validate role rules, item IDs, finite numeric ranges and missing values at every load boundary. Distinguish unknown from zero.

**Gate:** a serialized current build round-trips to identical inputs and results on the same data snapshot. Unsupported or incompatible data is explicitly identified. If historical data is unavailable, offer an explained migration instead of silently changing the build.

## M4 — Save profiles and load builds

Add a Build Library with New, Save, Save As, Duplicate, Rename, Delete/Undo, search, champion/role filters and favourites. A profile contains one or more named scenarios, such as “Level 11, two items” and “Full build against a tank.”

Use IndexedDB for the local library and localStorage only for small preferences. Autosave the working draft separately from named saves so experimentation does not overwrite a reference build. Show saved/unsaved state and restore the last draft after a reload. Explain that browser-local data is device/browser-specific and can be cleared.

Support app JSON import/export and full-library backup/restore. Loading a build previews differences before replacing the current work. Handle duplicate names/IDs, corrupted files, unsupported schema versions and older patches. Imports must have size limits and strict data validation; imported names/notes must render as text.

**Gate:** create several profiles, close/reopen the browser, recover the draft, export the library and restore it into an empty browser profile. Simulated failed writes and malformed imports leave existing saves intact.

## M5 — Compare and share

Compare two to four saved builds against the same target and combo. Show damage, DPS, cost, core stats and the difference from a chosen baseline. Include comparison at equal level/item budget; preserve scenario settings while changing builds.

Add a versioned compressed share code or URL for small scenarios. Use JSON downloads when a scenario exceeds the supported link size. Loading a shared scenario opens an import preview, not an automatic overwrite. Store source attribution with imported builds. Server-hosted short links can wait for the backend phase.

**Gate:** a link/code opened in a clean browser recreates the scenario without an account; changing the target updates all compared builds equally. Cross-patch discrepancies are clearly explained.

## M6 — Beta and release gates

- Run unit and browser suites in CI, including save migrations, import failures, role/slot transitions, target arithmetic, combo timelines and existing picker/calculation regressions.
- Maintain a numerical reference matrix for high-risk champion/item combinations. Publish supported mechanics and known limitations for the release snapshot.
- Pin a tested game-data baseline and add a repeatable patch-refresh audit. Detect missing/renamed IDs, formula changes and recommendation regressions before updating production.
- Verify keyboard focus, modal focus containment/restoration, search, screen-reader labels, contrast, touch controls and desktop/mobile overflow.
- Measure cold/warm startup on a documented connection/device. Proposed budgets: picker usable within 3 seconds on a mid-range laptop with a 10 Mbps/100 ms connection; ordinary edits under 100 ms once data is loaded. Adjust only with recorded evidence.
- Exercise offline/timeout behavior, unavailable storage, corrupt saves and concurrent-tab edits. Keep optional data failure from disabling saved-build access.
- Collect beta feedback and fix release-blocking correctness, data-loss and navigation issues before cosmetic additions.

**Gate:** no unresolved data-loss bugs or critical errors in supported calculations; all release checks pass; remaining limitations are documented and visible at the affected result.

## M7 — Release and deployment

Retain the static-app architecture; evaluate managed commercial hosting before launch instead of assuming GitHub Pages is the permanent host for local profiles, target calculations, combo exploration and share codes. These features do not require accounts or a database service.

1. Create a staging environment using the same built artifact as production. Replace the independently triggered deployment with a pipeline that depends on successful tests and a chosen release/tag or promotion step.
2. Produce a clean deploy directory containing only runtime assets. Stop uploading the entire repository, including tests and development files. Generate root/preview assets from one source to prevent drift.
3. Verify HTTPS, base-path navigation, asset URLs, caching, canonical entry page and an optional custom domain. Decide the long-term origin before users rely on browser-local saves; export/import is the recovery path when an origin changes.
4. Add release notes, version/patch display, documentation, feedback route, asset attribution and applicable privacy/terms information. Review Riot's current policies before launch; use a server-side key only if an approved Riot API feature is introduced.
5. Tag v1.0.0, promote the tested artifact, and smoke-test champion selection, profiles, target edits, combo execution, share-code loading and imports on the deployed origin.
6. Retain the previous release artifact and rehearse rollback. Save-schema changes must not make an application rollback destroy user data. Keep backups before migrations.
7. Check uptime and broken data sources after launch, review error reports, and use a documented hotfix/patch-update process. Select monitoring and any telemetry deliberately, with appropriate user disclosure.

**Gate:** a release can be deployed and rolled back reproducibly; the production smoke test and saved-profile recovery test both pass. This roadmap does not change the deployment workflow or deploy a release.

## M8 — External build imports and cloud profiles

All importers should feed the same validated build format, not mutate the current UI directly. A build import means structured choices—champion, role, runes, item groups, skill order—not copying an entire guide.

| Import route | Proposed order | Scope and decision gate |
|---|---|---|
| App JSON and share codes | M4/M5, required | Full round-trip fidelity; no external service dependency |
| Pasted item/rune lists | First optional importer | Match IDs/names, flag ambiguity and let the user resolve missing fields |
| League item-set JSON | Feasibility after M4 | Verify supported format; treat as item groups, since it may not encode a complete build |
| MOBAFire guide URL | Optional adapter | Verify permitted access/exports and page structure; let user choose among build variants; retain author/source link and patch |
| OP.GG build URL | Optional adapter | Resolve conflicting published access guidance, verify a supported retrieval method, and preserve role/patch/region context where available |
| Other guide sites | One adapter at a time | Add only after access, maintenance cost and sample coverage are established |

Each adapter needs fixtures for multiple builds/roles, missing data, retired items, page-layout changes and failure responses. Show an import preview with resolved/unknown fields and explicit variant selection. Preserve starting/core/situational item groups instead of squeezing every recommended item into six slots. Never infer missing target stats, combo timing or quest completion from a guide.

Some URL imports may need a small backend because browser access, provider authentication or rate limits cannot be handled reliably in a static app. If adopted, restrict upstream hosts/redirects, cache responsibly, limit request sizes/timeouts and keep credentials on the server. An arbitrary public URL proxy is not an acceptable importer design. A provider changing its page must disable that adapter gracefully rather than break save/load.

Cloud profiles are a separate expansion: accounts, private-by-default sync, conflict handling, export/deletion, backups and public-share permissions. Define hosting cost and ownership before adding this dependency. Keep local-only use available.

## External-source findings

Checked 13 September 2026. Recheck at adapter implementation and release time.

- OP.GG's help article allows crawling in general with attribution and operational limits, while its published terms prohibit scraping. Treat this as unresolved access guidance and obtain clarification before committing to an automated importer. The help article also says it does not provide its game data to third parties. Sources: [OP.GG data-use help](https://help.op.gg/hc/en-us/articles/31091405109401-Can-I-use-OP-GG-data), [OP.GG terms](https://op.gg/lol/policies/agreement).
- No supported MOBAFire import API/export agreement was verified in this review. Its URL importer remains a feasibility item, not a promised v1.0 feature. [MOBAFire](https://www.mobafire.com/).
- Riot's static data and game APIs are different dependencies. Review [League developer documentation](https://developer.riotgames.com/docs/lol), [general developer policies](https://developer.riotgames.com/policies/general) and [asset-use policy](https://www.riotgames.com/en/legal) for the features actually being shipped. Account/match-history integration should be separately scoped.

## Hosting and operating the site

A domain is the address; DNS points it to the host. The host serves the app over HTTPS, and a CDN caches files near visitors. The browser can continue running calculations. Shared accounts and cloud saves add a separate identity/database service; they do not require moving the calculator to a server.

Proposed launch: custom domain, managed static hosting on Cloudflare Workers Static Assets, and tested deployments from the repository. Cloudflare recommends Workers for new projects. GitHub Pages restricts online-business/commercial-SaaS hosting, so review hosting terms before commercial launch. This is a recommendation, not a purchased service. Sources: [Cloudflare guidance](https://developers.cloudflare.com/pages/), [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

Launch work: domain ownership/renewal, administrator MFA, DNS/HTTPS, preview and production environments, error/uptime monitoring, rollback and account recovery. Budget for domain, hosting/bandwidth, database, authentication email and monitoring; measure usage and configure budget alerts. Free tiers are not a permanent cost guarantee. Managed hosting avoids administering a server operating system. Choose the final domain before users accumulate browser-local saves; origin changes need export/import.

### Code visibility

Browser-delivered HTML/JavaScript can be inspected. Minification reduces download size; obfuscation is not security and is not required for release. A private repository hides unpublished source/history, not delivered code or previously copied public code. Choose a source license deliberately; Riot assets have separate conditions.

Keep database passwords, administrative keys and Riot API secrets server-side. Browser environment variables are not secret. Deploy only runtime assets. Enforce permissions in the server/database, not through hidden controls. Moving proprietary logic server-side can conceal implementation but introduces latency and operating cost; it is unnecessary for this calculator's launch.

### Accounts and public profiles

Local build profiles require no login. Cloud accounts later add identity, cross-device private builds, preferences and optional public shares. Public community profiles, Riot account linking and match history are separately scoped features.

Proposed service: Supabase Auth and PostgreSQL, subject to cost/region/backup review. Use provider-managed login/session/recovery rather than writing password storage. Attach an owner to every saved record and enforce permissions for every database operation. Supabase supports this through row-level security; privileged service keys remain server-side. [Authorization documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

Cloud release gate: user A cannot read/change/delete user B's private builds; logged-out requests cannot access private data; public links expose only intended records. Test expired sessions, recovery, local-to-cloud migration, edit conflicts, export/deletion and backup restoration. Keep guest use. Plan email delivery, abuse limits, retention and privacy disclosures.

## Advertising

Reserve space before final layout acceptance, but enable ads only after quality and provider approval. Trial a desktop side/footer placement without overlays; evaluate mobile separately. Test the smaller usable viewport, ad failure/blocking and layout stability so advertising cannot disrupt calculations.

Riot's general developer policy requires registration/audit and permits monetization for Approved or Acknowledged products with a free access tier, which may contain advertising. Include its required non-endorsement notice and review the actual product/asset usage before launch. [Riot policies](https://developer.riotgames.com/policies/general).

Plan ad-network site review, publisher verification, privacy disclosures, applicable consent configuration and ads.txt where required. Google has certified consent-management requirements for EEA/UK/Swiss visitors; the audience's location matters even for an Australian operator. [Google requirements](https://support.google.com/adsense/answer/13554116).

Do not fund committed costs from assumed ad income. Estimate using measured page views and actual page RPM: revenue = page views / 1,000 × page RPM. Long calculator sessions do not automatically mean many page views. Monitor income alongside performance/retention; do not artificially refresh ads. Subscription features are a later decision with additional billing/support and policy requirements.

## Tested patch promotion

Production should use an approved snapshot rather than resolving latest at visit time. Treat code, formulas and data as one release, like firmware plus calibration data.

Inspection found automatic Data Dragon discovery and Community Dragon latest item/champion URLs in js/shared/apiClient.js, plus a latest string-table URL in js/builder.js. Pinning only Data Dragon leaves mixed-version risk. Include generated/local formula and recommendation datasets in the audit.

Maintain a manifest with game patch, exact Data Dragon build, Community Dragon snapshot, extractor revision, calculator revision and checksums. Preserve immutable numerical input artifacts where permitted, since even version-looking URLs may receive corrections. Key caches by snapshot. Show supported patch and calculator version. Never silently fall back to live latest after a pinned source fails.

Riot notes that a patch can receive multiple Data Dragon builds and regional client versions may differ. Test corrected builds and hotfixes too. [Data Dragon documentation](https://developer.riotgames.com/docs/lol).

Proposed pipeline, not yet configured:

1. Scheduled/manual CI discovers a candidate and opens a change request; production stays unchanged.
2. Capture a coherent snapshot and report changed/missing champion, item, rune and formula fields.
3. Run deterministic tests against approved and candidate snapshots. Classify differences as expected changes, regressions or unresolved mechanics; never automatically overwrite expected results.
4. Deploy the candidate artifact to preview and run browser/performance checks.
5. Review changed mechanics against patch notes and independently verified examples. Explicitly approve expected numerical changes; block unexplained changes to supported mechanics.
6. Promote the same tested artifact, smoke-test production and retain the previous complete release for rollback. Preserve save compatibility and migration backups.

| Test layer | Purpose |
|---|---|
| Data contracts | Validate fields/types, IDs, references and source consistency |
| Numerical references | Independently calculated damage, crit, mitigation and cooldown examples |
| Invariants/property tests | Finite outputs, legal ranges, and isolated positive armor increases never increasing physical damage |
| Interaction matrix | Crit modifiers, on-hit toggles, shared proc cooldowns, role quests and item exclusions |
| Combo timelines | Recasts, attack resets, resources, stacks, periodic damage and changing HP |
| Differential reports | Explain changes between approved and candidate patch results |
| Browser regressions | Selection, tooltips, targets, combos, saves and sharing |
| Recovery/access tests | Failed downloads, migrations, rollback and cloud user isolation |

Existing package.json commands already cover unit, browser, DPS, combat, attack, dashboard and picker tests. Extend them. Keep offline release fixtures separate from live-source compatibility tests. Rendering without errors is not numerical proof: tests cannot discover unmodelled mechanics or supply authoritative expected damage automatically. New/reworked mechanics still need focused review and reference cases.

## Recommended next implementation

Implement M1 attack targets with one canonical target model, consistent mitigation and independently calculated tests, followed by M2's bounded combo timeline. Add only the internal models/fixed fixtures these need; full serialization and library work remain M3/M4. Design patch promotion and hosting alongside this work. This roadmap update does not deploy hosting, enable ads, configure scheduled jobs or create user accounts.
