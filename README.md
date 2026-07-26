# money-pit

Where does it all go? A self-hosted dashboard for digging through credit card statements to find out where the money's actually leaking.

## Contents

- `index.html` — single-file dashboard (Chart.js). Auto-categorizes transactions by merchant keyword, with click-to-filter charts, sortable/searchable transaction table, and manual category correction.
- `data.js` (gitignored) — your real statement data: `window.CSV_DATA = \`...\`` holding CSV rows (`Status,Date,Description,Debit,Credit,Member Name`). If absent, the dashboard falls back to the sample data embedded in `index.html`.

## Status

Prototype stage. Next steps: a way to load new statement exports without hand-editing `data.js`, and expand category rules as new merchants show up.

## Note

Real transaction data lives only in the gitignored `data.js` — don't commit it.
