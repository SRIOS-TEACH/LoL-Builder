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
- [ ] Allow the exact refactoring branch in the Pages deployment environment.
- [ ] Publish the workflow to the refactoring branch and update only the workflow on main.
- [ ] Confirm successful GitHub deployment and verify both live routes.

Recorded: 2 October 2026. Future pushes update the preview automatically after checks pass.