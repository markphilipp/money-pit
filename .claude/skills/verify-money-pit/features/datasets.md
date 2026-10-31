# Uploaded files (datasets)

**Entry points.** Account menu "Settings…" (always shown), then "Uploaded files" in the Settings nav, or
`/settings/datasets` directly (`/datasets` redirects). The page also holds its own drop zone for adding
files.

**Drive (signed out).**

1. Upload `june.csv` and `july.csv` on `/`: the heading shows `(11)`. They overlap on LOWES and SPOTIFY.
2. Account menu → "Settings…" (lands on `/settings/rules`) → nav "Uploaded files". Each row shows its file name, count and date range; each Remove
   button is named `Remove <file>`.
3. `Remove june.csv` → the alertdialog reads "Removes 6 transactions. 2 more also appear in other
   files and stay." → "Remove file".
4. "← Dashboard" → heading `(6)`, LOWES and SPOTIFY rows still present, DUKE-ENERGY gone.
5. Reload: still `(6)`. `sessionStorage['money-pit'].state` holds `datasets` (one, `july.csv`) and no `rawRows`.
6. Remove `july.csv` (dialog says it is the only file) → empty state, and `/settings/rules` still lists the rules.

**Proves.** Removal is exact for overlapping files, persists across reload, and removing the last file
resets data but not categories or rules. Privacy: no external requests and no POSTs.

Signed in is covered by the `@signed-in` e2e spec, which needs the Neon `dev` branch migrated.
