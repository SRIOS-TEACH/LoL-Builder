# Phase 0 — Protected baseline and isolated refactoring

Checkpoint date: 1 October 2026. Application code and existing tests are unchanged from the Phase 1 baseline. The preserved version retains the documented audit exceptions; it is not a claim of complete game accuracy.

## Checkpoint identities

- Baseline tag: `baseline/pre-refactor-2026-09-30`. The date identifies the captured Phase 1 baseline. Keep this annotated tag fixed; never move or overwrite it.
- Refactoring branch: `codex/modular-refactor`.
- Original checkout: `C:/Users/Shannon/My Drive/WORK/LOL Optimised/Codex Project`, retained on `codex/combo-rune-item-effects`.
- Managed refactoring checkout: `C:/Users/Shannon/.codex/worktrees/modular-refactor/Codex Project`.
- Independent backup folder: `C:/Users/Shannon/My Drive/WORK/LOL Optimised/Backups/LoL-Builder/pre-refactor-2026-10-01`.
- Intended remote baseline branch: `codex/pre-refactor-baseline` in `SRIOS-TEACH/LoL-Builder`.

The first preservation commit, `a4dfe0e635709575b70bb198cba98c005f2d0069`, captures the existing README/roadmap work, refactoring plan, Phase 1 evidence and capture tools. A subsequent documentation/tooling commit adds these recovery instructions and the ignored-data preservation helper. The baseline tag identifies the final checkpoint; its exact commit and archive hashes are recorded in `protection-manifest.json` beside the independent backup.

The original repository and managed worktree share Git history, but have separate checked-out files and branches. Future implementation must use the managed refactoring path explicitly. The original checkout remains available to run and inspect the preserved implementation. There has been no switch to `main`, merge, deployment or application refactor.

## Backup contents

| File | Purpose |
|---|---|
| `repository.bundle` | Git history, baseline tag and local branch references; restorable without GitHub or the original `.git` directory |
| `ignored-data.zip` | Existing `tests/fixtures/` and the complete `test-results/refactor-baseline-2026-09-30/` capture, including raw audits, screenshots and source copies |
| `protection-manifest.json` | Exact checkpoint identities, file hashes, verification outcomes and remote publication status |
| `restore-check/` | Independent checkout created from the bundle to rehearse source restoration |

The ignored-data archive contains 1,336 files totaling 257,456,474 uncompressed bytes. Every archive entry has a SHA-256 in its embedded `PRESERVATION-MANIFEST.json`; every entry was read back and checked after packing. Archive SHA-256:

```text
8464dac81668ee4469dd90b5a52099c22ca5cee89f2eed1bc1b254cd6d94a88a
```

There were no local `node_modules` to preserve. The working browser/Node/Python tool paths and versions are recorded in the Phase 1 manifest, but installed runtimes themselves are not bundled. The sibling backup folder is independent of this repository's Git metadata and checkout. It is on the same local device/Drive location; cloud synchronization or an off-device backup has not been verified.

## Verification

- Runtime and original test contents were checked against the Phase 1 capture before checkpoint creation.
- Both checkouts initially shared the exact preservation commit. The final documentation/tooling commit is fast-forwarded into the refactoring branch so both begin at the same tagged checkpoint.
- All 377 original fixture files, including screenshots, were restored from the verified archive into the managed refactoring checkout. Restoration refuses to overwrite existing files.
- In that checkout, **201 unit tests passed**, and the advanced broad browser suite passed across **173 champions at four levels and 236 Builder items**, including selection races and failure states.
- All five advanced scenario records exactly matched the committed Phase 1 records, including full numerical outputs and combo displays.
- Bundle verification and an independent clone/checkout test establish that restoration does not depend on the managed worktree or original checkout. Exact outcomes are recorded in the external protection manifest.
- The existing stale six-slot ability-audit startup check and 13-passive diagnostic findings remain documented; they have not been hidden or fixed during preservation.

The full Phase 1 test matrix did not need repeating: runtime files and fixtures are unchanged, and the restored copy passed targeted reproduction checks. New tests should be chosen for subsequent changes rather than repeatedly re-running the unchanged baseline.

## Restore without changing existing work

Use a new empty destination. Do not reset or overwrite a checkout that contains later work.

```powershell
$phaseBackup = 'C:/Users/Shannon/My Drive/WORK/LOL Optimised/Backups/LoL-Builder/pre-refactor-2026-10-01'
git bundle verify "$phaseBackup/repository.bundle"
git clone "$phaseBackup/repository.bundle" '<new-empty-restore-folder>'
git -C '<new-empty-restore-folder>' switch --detach baseline/pre-refactor-2026-09-30
```

Then use Python to verify the archive and restore the fixtures into that checkout:

```powershell
python '<new-empty-restore-folder>/scripts/preserve-refactor-data.py' verify "$phaseBackup/ignored-data.zip"
python '<new-empty-restore-folder>/scripts/preserve-refactor-data.py' restore-fixtures "$phaseBackup/ignored-data.zip" --root '<new-empty-restore-folder>'
```

The helper verifies the complete archive before restoring, validates destination paths, and refuses existing destination files. The historical Phase 1 logs/source captures remain in the archive even when only fixtures are restored. They can be inspected directly in the ZIP. Compare archive/bundle hashes to `protection-manifest.json` before relying on a transferred backup.

Run the recorded Node/browser checks from the restored checkout using the environment described in `REFACTOR-BASELINE.md`. To try the restored site manually, serve that directory on a separate local port. Restoring code does not pin the production app's live upstream downloads; the preserved fixtures reproduce the tested baseline.

## Publication status and deployment safety

At checkpoint preparation, automatic approval review rejected the attempted GitHub publication because this is a public repository and the outgoing documentation/evidence includes local machine paths. No remote update was made by that rejected operation. The final remote state is recorded separately in the protection manifest; local recovery does not depend on publication.

The proposed remote payload is the preserved source plus README/roadmap/plans, baseline JSON/logs, recovery instructions and capture/backup helpers. It includes `C:/Users/Shannon/...` paths, tool versions and the existing Git author identity. The ignored raw-data archive, local recovery clone and Git bundle are not included in the GitHub payload. Publication requires explicit approval for this concrete public payload unless automatic review subsequently clears it.

Once authorized, publish only `codex/pre-refactor-baseline`, `codex/modular-refactor` and the baseline tag, without force updates. Verify their remote object IDs against the local checkpoint. `main` is unchanged; the existing Pages workflow only automatically deploys pushes to `main`. Do not dispatch that workflow from either preservation/refactoring branch.

## Next use

Continue implementation in the managed refactoring checkout, starting with the planned Phase 2 work. Keep the baseline tag fixed. Preserve new ignored files before retiring any worktree. Use the app's managed worktree archive/restore lifecycle for later cleanup; keep the independent backup outside the checkout.

## Current recovery and publication procedure — 8 October 2026

The earlier checkpoint/publication paragraphs above describe Phase 0 history. Both preserved references were subsequently published and verified. The refactor now has a separate Pages route; pushing its branch triggers a combined deployment that preserves production. Do not use the historical statement that Pages only deploys main as the current workflow description.

For rollback rehearsal, verify the bundle and ZIP against their recorded SHA-256 values, clone the bundle into a fresh folder, detach at `baseline/pre-refactor-2026-09-30`, verify all 1,336 ZIP entries and restore the 377 fixture files. The fresh Phase 6 rehearsal passed all 201 original unit tests, advanced/fallback browsing and ten exact saved cases, with clean tracked source and valid Git objects. [Phase 6 evidence](phase6-recovery.json) records that independent recovery.

A bad incremental refactor change can be reverted on the refactor branch and reverified. Keep the baseline branch/tag fixed. To restore the whole original application, first recover it into a new checkout and validate it; never force-reset an existing checkout containing later work. Preserve both the refactor commit and required ignored data before any deliberate production restoration.

This rehearsal proves source/data recovery without GitHub or the original Git directory. It does not repoint the live deployment or create a production rollback commit. Production promotion/restoration is a separate release decision; existing production remains unchanged. If restoring the original runtime intentionally, its former script layout needs corresponding reviewed deployment expectations rather than pretending it is the native refactor release fingerprint.

[The current Pages guide](REFACTOR-PAGES.md) identifies both live routes and the manifest. Verify the manifest's refactor and production revisions and compare the downloaded artifact to saved Git bytes after publication. Git reference preservation is distinct from configuring GitHub branch-protection policies.
