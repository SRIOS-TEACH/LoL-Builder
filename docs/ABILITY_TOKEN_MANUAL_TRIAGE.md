# Ability Token Manual Triage Notes

This document captures a **human, case-by-case** pass over unresolved ability-token/calc output.

Goal: collect ground-truth evidence from CommunityDragon for broken tooltip substitutions so we can later build a more reliable algorithmic resolver.

## How this triage was done

For each problematic spell:
1. Read the Data Dragon tooltip tokens (e.g., `{{ cast1damage }}`).
2. Open the champion CDragon `.bin.json`.
3. Inspect the exact spell records under `Characters/<Champ>/Spells/...`.
4. Compare token names to:
   - `mSpellCalculations` keys
   - `DataValues` / `mDataValues` names
5. Record what the renderer likely should have used.

---

## Case 1: Aatrox Q (`AatroxQ`)

### Tooltip tokens involved
- `qdamage`
- `qedgedamage`

### Relevant CDragon record
- `Characters/Aatrox/Spells/AatroxQAbility/AatroxQ`

### What exists in CDragon
- `mSpellCalculations` keys:
  - `QDamage`
  - `QEdgeDamage`
  - `QMinionDamage`
- `QEdgeDamage` is a `GameCalculationModified` of `QDamage` with multiplier `(1 + QSweetSpotBonus)`.

### Expected interpretation
- `qdamage` should resolve to `QDamage`.
- `qedgedamage` should resolve to `QEdgeDamage`.
- If output includes repeated `[calc-missing: part has empty game calculation reference]`, that is likely evaluator noise from optional/empty referenced fields being treated as required.

---

## Case 2: Akali R (`AkaliR`)

### Tooltip tokens involved
- `cast1damage`
- `cooldownbetweencasts`
- `cast2damagemax`

### Relevant CDragon records
- `Characters/Akali/Spells/AkaliRAbility/AkaliR`
- `Characters/Akali/Spells/AkaliRAbility/AkaliRb` (alternate child)

### What exists in CDragon
In `.../AkaliR`:
- `mSpellCalculations` keys:
  - `Cast1Damage`
  - `Cast2DamageMin`
  - `Cast2DamageMax`
- `DataValues` includes:
  - `CooldownBetweenCasts`
  - plus other R data values

In `.../AkaliRb`:
- only one calc key (`Cast2DamageMin`) and only 2 `DataValues` entries.

### Expected interpretation
- `cast1damage` -> `Cast1Damage`
- `cast2damagemax` -> `Cast2DamageMax`
- `cooldownbetweencasts` -> `DataValues.CooldownBetweenCasts`

### Likely failure mode
If loader picks `AkaliRb` as the spell payload instead of `AkaliR`, several tokens become unresolved (`cast1damage`, `cast2damagemax`, `cooldownbetweencasts`).

---

## Case 3: Akshan R (`AkshanR`)

### Tooltip tokens involved
- `damageperbulletwithcrit`
- `maxdamageperbullet`

### Relevant CDragon record
- `Characters/Akshan/Spells/AkshanRAbility/AkshanR`

### What exists in CDragon
- `mSpellCalculations` keys:
  - `DamagePerBulletWithCrit`
  - `MaxDamagePerBullet`
- `mStat` codes found in this calc tree:
  - `2`
  - `8`
  - `9`

### Expected interpretation
- `damageperbulletwithcrit` should resolve to `DamagePerBulletWithCrit`.
- `maxdamageperbullet` should resolve to `MaxDamagePerBullet`.

### Why `Stat8` / `Stat9` appears
Current builder stat-code mapping is incomplete and falls back to `Stat <code>` for unknown enum values. This is why intermediate formula output can display `Stat8` / `Stat9` text.

---

## Additional implementation notes from triage

1. **Prefer richer child spell payloads**
   - Some abilities have multiple child records; first child is not always the one matching Data Dragon tooltip tokens.

2. **Use both `DataValues` and `mDataValues` consistently**
   - Akali R stores `CooldownBetweenCasts` in `DataValues`, not `mDataValues`.

3. **Improve stat enum mapping for ability formulas**
   - Reuse/align mapping used elsewhere so `mStat` values do not leak as `StatX` labels.

4. **Suppress synthetic calc errors for absent optional references**
   - Do not emit `calc-missing` when optional referenced fields are empty/null.

