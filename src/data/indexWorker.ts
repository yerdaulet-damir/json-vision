/// <reference lib="webworker" />
// Runs off the main thread. Owns the File handle, builds a line->byte-offset
// index by scanning for 0x0A (newline is always a single byte in UTF-8, so we
// never need to decode during indexing), then serves row pages via File.slice
// — reading only the bytes of the requested range from disk.

import { inferColumns } from './flatten';
import { buildPredicate, sortKey, compareKeys, isEmptyQuery } from './query';
import type { QuerySpec } from './query';
import type { Row } from './types';

type InMsg =
  | { type: 'init'; id: number; file: File; isJsonl: boolean }
  | { type: 'getRows'; id: number; start: number; count: number }
  | { type: 'getRowsByIndices'; id: number; indices: number[] }
  | { type: 'query'; id: number; spec: QuerySpec };

const NL = 0x0a;
const CHUNK = 8 * 1024 * 1024; // 8MB scan window
const decoder = new TextDecoder('utf-8');

let file: File | null = null;
let lineStarts: number[] = []; // byte offset of each row's first byte
let fileSize = 0;
let totalRows = 0;
// For JSON (non-jsonl array) files we parse once and hold rows in the worker.
let memoryRows: Row[] | null = null;

function post(msg: Record<string, unknown>) {
  (self as unknown as Worker).postMessage(msg);
}

async function buildIndex(f: File, onProgress: (p: number, rows: number) => void) {
  lineStarts = [0];
  fileSize = f.size;
  let scanned = 0;
  let endsWithNewline = false;

  while (scanned < fileSize) {
    const end = Math.min(scanned + CHUNK, fileSize);
    const buf = new Uint8Array(await f.slice(scanned, end).arrayBuffer());
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === NL) {
        const next = scanned + i + 1;
        endsWithNewline = next === fileSize;
        lineStarts.push(next);
      }
    }
    scanned = end;
    onProgress(scanned / fileSize, lineStarts.length);
  }

  if (endsWithNewline) lineStarts.pop();
  totalRows = lineStarts.length;
}

function parseLines(text: string): Row[] {
  const out: Row[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      out.push({ __parseError: true, __raw: t.slice(0, 500) });
    }
  }
  return out;
}

async function readByteRange(byteStart: number, byteEnd: number): Promise<Row[]> {
  if (!file) return [];
  const ab = await file.slice(byteStart, byteEnd).arrayBuffer();
  return parseLines(decoder.decode(new Uint8Array(ab)));
}

async function readRows(start: number, count: number): Promise<Row[]> {
  if (memoryRows) return memoryRows.slice(start, start + count);
  if (!file || totalRows === 0) return [];
  const endRow = Math.min(start + count, totalRows);
  if (start >= endRow) return [];
  const byteEnd = endRow < totalRows ? lineStarts[endRow] : fileSize;
  return readByteRange(lineStarts[start], byteEnd);
}

async function readByIndices(indices: number[]): Promise<Row[]> {
  if (memoryRows) return indices.map((i) => memoryRows![i]);
  if (!file) return [];
  // Read each requested row's bytes individually (only ~visible-window rows).
  const out: Row[] = new Array(indices.length);
  await Promise.all(
    indices.map(async (idx, k) => {
      if (idx < 0 || idx >= totalRows) {
        out[k] = {};
        return;
      }
      const byteEnd = idx + 1 < totalRows ? lineStarts[idx + 1] : fileSize;
      const rows = await readByteRange(lineStarts[idx], byteEnd);
      out[k] = rows[0] ?? {};
    }),
  );
  return out;
}

/** Stream the whole dataset, apply predicate + sort, return display order. */
async function runQuery(spec: QuerySpec, onProgress: (p: number) => void) {
  if (isEmptyQuery(spec)) return { order: null as number[] | null, matched: totalRows };

  const predicate = buildPredicate(spec);
  const sort = spec.sort ?? null;
  const matchedIdx: number[] = [];
  const keys: (number | string)[] = sort ? [] : [];

  const PAGE = 2000;
  for (let start = 0; start < totalRows; start += PAGE) {
    const rows = await readRows(start, PAGE);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (predicate(row)) {
        const absIdx = start + i;
        matchedIdx.push(absIdx);
        if (sort) keys.push(sortKey(row, sort.path));
      }
    }
    onProgress(Math.min(1, (start + PAGE) / totalRows));
  }

  if (sort) {
    const positions = matchedIdx.map((_, k) => k);
    positions.sort((pa, pb) =>
      compareKeys(keys[pa], keys[pb], matchedIdx[pa], matchedIdx[pb], sort.dir),
    );
    const ordered = positions.map((p) => matchedIdx[p]);
    return { order: ordered, matched: ordered.length };
  }

  return { order: matchedIdx, matched: matchedIdx.length };
}

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      file = msg.file;
      memoryRows = null;

      if (msg.isJsonl) {
        await buildIndex(msg.file, (progress, rows) =>
          post({ type: 'progress', id: msg.id, progress, rowsIndexed: rows }),
        );
      } else {
        const text = await msg.file.text();
        const parsed = JSON.parse(text);
        memoryRows = Array.isArray(parsed) ? parsed : [parsed];
        totalRows = memoryRows.length;
        fileSize = msg.file.size;
      }

      const sample = await readRows(0, 200);
      post({
        type: 'ready',
        id: msg.id,
        totalRows,
        byteSize: fileSize,
        columns: inferColumns(sample),
      });
    } else if (msg.type === 'getRows') {
      post({ type: 'rows', id: msg.id, start: msg.start, rows: await readRows(msg.start, msg.count) });
    } else if (msg.type === 'getRowsByIndices') {
      post({ type: 'rowsByIndices', id: msg.id, rows: await readByIndices(msg.indices) });
    } else if (msg.type === 'query') {
      const res = await runQuery(msg.spec, (progress) =>
        post({ type: 'progress', id: msg.id, progress, rowsIndexed: totalRows }),
      );
      post({ type: 'queryResult', id: msg.id, order: res.order, matched: res.matched });
    }
  } catch (err) {
    post({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};
