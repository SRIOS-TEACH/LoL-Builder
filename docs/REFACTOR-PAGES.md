# Refactor Pages preview

The modular refactor is served at https://srios-teach.github.io/LoL-Builder/modular-refactor/Builder.html. The original application remains at https://srios-teach.github.io/LoL-Builder/Builder.html.

The Pages workflow assembles both versions into a single deployment:
- Production files come from main, unchanged.
- The refactor is tested and built from codex/modular-refactor, then placed under modular-refactor/.
- Every production file and generated refactor file is compared before upload.
- modular-refactor/deployment.json identifies both deployed commits.
- Pushes to either branch rebuild the combined site. The shared deployment queue prevents simultaneous uploads.
- Only the Pages workflow is updated on main for this setup; refactor application changes remain on their branch. The protected baseline is unchanged.

## Setup actions

- [x] Verify existing Pages settings and production URL.
- [x] Prepare the combined workflow and artifact verifier.
- [x] Verify locally: 132 production files unchanged, 78 generated refactor files copied exactly.
- [x] Allow the exact refactoring branch in the Pages deployment environment.
- [x] Publish the workflow to the refactoring branch and update only the workflow on main.
- [x] Confirm successful GitHub deployment and verify both live routes.

Recorded: 2 October 2026. Future pushes update the preview automatically after checks pass.
Verified live on 2 October 2026: production workflow commit d79da286c18d3c443f9db37a91f2d2d411d1207d; initial refactor deployment f137654ece72bb312c025a71693ac6e57c6eee4a. Runs [36973499251](https://github.com/SRIOS-TEACH/LoL-Builder/actions/runs/36973499251) and [36973559700](https://github.com/SRIOS-TEACH/LoL-Builder/actions/runs/36973559700) succeeded. Live Builder HTML, JavaScript and stylesheet matched both sources. The sole main change was .github/workflows/static.yml.

## Refactor release guard — 8 October 2026

The refactor now includes a source-bound local verification record, checked by `verify-release.cjs`. GitHub regression checks and the combined Pages verifier reject changed, missing or added runtime files or incomplete/failed verification evidence. Full browser/performance/recovery checks run locally with preserved fixtures; CI runs units/build/fingerprint checks. Phase 6 publication verified 71 runtime files on both preview routes, module MIME types, live native-entry interactions, and unchanged production/baseline references. See [release evidence](REFACTOR-PHASE6.md). Production application promotion remains a separate decision.
