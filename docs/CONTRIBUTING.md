# Contributing

Use Node 22.13 or newer. The static app and unit suite have no production package dependencies. Browser verification uses separately available Playwright, a compatible browser and the preserved fixture set; see [Testing](TESTING.md).

1. Reproduce the behavior and identify its owner in [Architecture](ARCHITECTURE.md). Add a meaningful focused test for a defect or new rule; avoid duplicating the implementation in the expected result.
2. Edit the authoritative root files. Keep provider records immutable, input rules separate from evaluation, and presentation separate from numeric results. Do not import another page's controller or register globals.
3. Use scoped components with explicit inputs/callbacks and lifecycle cleanup. Follow [extension recipes](EXTENDING.md) for a data adapter, effect, panel, explorer or comparison consumer.
4. Run `npm test` and affected browser suites during development. Before a runtime release run `npm run verify:refactor`, the controlled performance comparison, and the documented clean-source/recovery checks. Preserve fixtures and baseline expectations; classify numerical changes rather than automatically rewriting them.
5. Review the runtime fingerprint and verification evidence. Update `docs/phase6-release.json` only from passing checks against those exact runtime files. `npm run verify:release` rejects absent/failed evidence and any changed, missing or added runtime file.
6. Publish the refactor branch to its separate preview and verify the deployment manifest/live bytes. Production promotion is a separate release decision. Never move the protected baseline tag or force-update its branch.

Run `npm run build:preview` for local preview pages or `npm run build` for runtime-only deployment output. Do not edit or commit generated `preview/` or `dist/`. Documentation, tests, fixtures, local recovery clones and verification logs do not belong in the runtime artifact.

Keep an intentional behavior-change ledger and record unsupported mechanics in [AUDIT](AUDIT.md). No guessed coefficients or prose-derived substitutes for missing calculations. Unknown, unsupported and zero are different states. Numerical and browser regressions establish implementation behavior; new game-accuracy claims require independently justified examples.

For pull requests, explain the trigger, resulting behavior, ownership choice, relevant verification and remaining limitations. Separate UI redesign, new simulations, source-patch changes and hosting migrations from structural refactors.

The exact protected-case comparison is the refactor acceptance contract. A later intentional mechanics release needs an explicitly reviewed comparison/reference set and a documented difference ledger; preserve the historical refactor baseline. The deployment guard requires a completed comparison with zero unexplained differences, rather than permanently freezing numerical behavior.
