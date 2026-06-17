# Contributing to JSON Vision

Thanks for helping make the large‑JSON pain go away. 🙌

## Dev setup

```bash
# Web app
npm install
npm run dev          # http://localhost:5173

# Extension
cd extension
npm install
npm run build        # build:web (-> media/) + build:host (-> dist/)
# then press F5 in VS Code, or:
npm run package      # -> json-vision-<version>.vsix
```

## Project shape

- `src/data/` — the runtime‑agnostic data layer. The pure query engine lives in `query.ts` and is shared by **both** the browser worker and the Node extension host, so behaviour can't diverge.
- `src/components/` — `TableView`, `CardsView` (Posts), `GraphView`, `Toolbar`.
- `extension/src/` — the VS Code host (`extension.ts`) and its `fs` paging engine (`indexer.ts`).

## Guidelines

- **Never commit datasets.** `.gitignore` blocks `*.jsonl`/`*.ndjson` (except the tiny synthetic `sample.jsonl`). Don't add real data.
- **Keep it local.** No network calls, no telemetry — privacy is a feature.
- **Keep memory flat.** Anything that touches data must page; never load a whole file.
- Run `npm run build` (web) and `cd extension && npm run typecheck` before opening a PR.

## Good first issues

- Row detail panel (click a card → JSON tree on the side)
- Export the filtered slice to a new `.jsonl`
- Numeric field distribution charts
- More record‑shape auto‑detectors for the Posts view
