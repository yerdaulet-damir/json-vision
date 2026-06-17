# JSON Vision - Large JSON & JSONL Viewer

**View large JSON, JSONL and NDJSON files without freezing** - right inside VS Code, Antigravity, Cursor, Windsurf and VSCodium. JSON Vision streams files from disk and renders them as virtualized **tables**, **posts**, collapsible **trees** and **schema graphs**, with live search, filter and sort. **Fully local - your data never leaves your machine.**

![Posts view](https://raw.githubusercontent.com/yerdaulet-damir/json-vision/main/docs/posts.png)

## How it works

JSON Vision is built for big files. Instead of loading the whole document into memory, it streams the file once to index where each line begins, then reads only the rows currently on screen by seeking to their byte offsets. Search, filter and sort run as a single streaming pass. An 84 MB / 72,143-line JSONL file indexes in about 80 ms and scrolls at 60 fps; multi-gigabyte files work the same way, bounded by disk speed rather than memory.

## Features

- **Posts** - auto-detects the record shape and renders rich cards.
- **Table** - virtualized grid with flattened dot-path columns (`a.b.c`); click a header to sort the whole dataset.
- **Tree** - the classic collapsible, type-colored JSON viewer.
- **Schema** - inferred structure graph: every field with its type(s) and fill-rate.
- **Live query** - full-text search, smart filters (`contains`, `=`, `not equal`, `>`, `>=`, `<`, `<=`, `exists`, `is empty`), and sorting over the entire file.

It also adapts to your data: tweets and API feeds render as **posts**, LLM logs (`role` / `content`, `messages[]`) render as a color-coded **chat**, and server logs (`level` + `message`) render with **severity badges**. You can switch styles manually at any time.

![Table view](https://raw.githubusercontent.com/yerdaulet-damir/json-vision/main/docs/table.png)

## Usage

1. Right-click a `.json` / `.jsonl` / `.ndjson` file and choose **Open in JSON Vision**, or
2. Open the file and run **JSON Vision: Open in JSON Vision** from the editor title bar or command palette.

The default text editor is never replaced - JSON Vision opens as an option.

## Privacy

JSON Vision makes no network requests. There is no telemetry, no analytics and no upload - everything runs locally. This matters when the file is a production export or a database dump.

## FAQ

**How large a file can it open?** There is no hard ceiling. Memory stays flat because only on-screen rows are read, so it is bounded by disk speed rather than RAM.

**Does it handle nested JSON and arrays?** Yes. The Table view flattens nested objects into dot-path columns, and the Tree view shows the full nested structure, collapsible and type-colored.

**Does it work in Cursor, Windsurf and Antigravity?** Yes - JSON Vision is also published to Open VSX, the registry those editors use.

**Is my data sent anywhere?** No. Zero network requests, zero telemetry, fully local.

## License

MIT. Source and documentation: https://github.com/yerdaulet-damir/json-vision
