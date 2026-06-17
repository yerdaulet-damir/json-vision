# JSON Vision — Large JSON / JSONL Viewer (no freeze)

**Open multi‑GB JSON, JSONL & NDJSON files without freezing** — right inside VS Code, Antigravity, Cursor, Windsurf, and VSCodium. JSON Vision streams files from disk and renders them as virtualized **tables**, **posts**, and **schema graphs**, with live search, filter, and sort. **100% local — your data never leaves your machine.**

![Posts view](https://raw.githubusercontent.com/yerdaulet-damir/json-vision/main/docs/posts.png)

## Why

Most JSON viewers — and VS Code itself — load the whole file into memory and freeze on big files (a 40 MB / 1.4M‑line file can hang the editor; >50 MB triggers *"Window no longer responding"*). JSON Vision never loads the whole file. It indexes line byte‑offsets once, then reads **only the rows on screen**. An **84 MB / 72,143‑line JSONL indexes in ~80 ms and scrolls at 60 fps**; multi‑gigabyte files work the same way.

## JSON Vision vs. the alternatives

| | JSON Vision | Native VS Code | JSON Crack | Data Preview |
|---|:---:|:---:|:---:|:---:|
| Opens multi‑GB files | ✅ | ❌ freezes | ❌ | ⚠️ tens of MB |
| Streams from disk (flat memory) | ✅ | ❌ | ❌ | ❌ |
| JSONL / NDJSON first‑class | ✅ | ⚠️ | ⚠️ | ✅ |
| Virtualized table | ✅ | ❌ | ❌ | ✅ |
| Schema / structure graph | ✅ | ❌ | ✅ | ❌ |
| Whole‑file search / filter / sort | ✅ | ⚠️ | ❌ | ⚠️ |
| 100% local, zero network | ✅ | ✅ | ⚠️ | ✅ |

## Features

- **📰 Posts** — auto‑detects record shape and renders rich, glassy cards.
- **🧮 Table** — virtualized grid with flattened dot‑path columns (`a.b.c`); click a header to sort the whole dataset.
- **🕸️ Schema** — inferred structure graph: every field with its type(s) and fill‑rate.
- **🔎 Live query** — full‑text search, smart filters (`contains`, `=`, `≠`, `>`, `≥`, `<`, `≤`, `exists`, `is empty`), and sorting over the entire file.

![Table view](https://raw.githubusercontent.com/yerdaulet-damir/json-vision/main/docs/table.png)

## Usage

1. Right‑click a `.json` / `.jsonl` / `.ndjson` file → **Open in JSON Vision**, or
2. Open the file and run **JSON Vision: Open in JSON Vision** from the editor title bar / command palette.

The default text editor is never hijacked — JSON Vision opens as an *option*.

## How it stays fast

| Stage | How |
| --- | --- |
| Indexing | Stream the file once, recording each line's byte offset — no full parse. |
| Reading | Read only the visible rows by seeking to their byte offsets. |
| Search / sort / filter | One streaming pass builds a display order; visible rows are fetched by random access. |
| Rendering | Virtualized — the DOM holds only the ~30 rows/cards on screen. |

## FAQ

**Why does VS Code freeze on large JSON?** It loads and tokenizes the entire file up front. JSON Vision streams from disk and virtualizes instead.

**How big a file can it open?** No hard ceiling — memory stays flat because only on‑screen rows are read. Bounded by disk speed, not RAM.

**Does it work in Cursor / Windsurf / Antigravity?** Yes — published to Open VSX, the marketplace those editors use.

**Is my data sent anywhere?** No. Zero network requests, zero telemetry, fully local.

## License

MIT · [Source on GitHub](https://github.com/yerdaulet-damir/json-vision)
