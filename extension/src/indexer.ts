import * as fs from 'fs';
import { inferColumns } from '../../src/data/flatten';
import { buildPredicate, sortKey, compareKeys, isEmptyQuery } from '../../src/data/query';
import type { QuerySpec } from '../../src/data/query';

// Node-side paging engine. Mirrors the browser worker exactly, sharing the same
// pure query module so behaviour can never diverge. It scans the file for
// newline byte offsets (streaming, never loading the whole file), then reads row
// ranges or arbitrary rows by seeking to byte offsets. Flat memory on GB files.

type Row = Record<string, unknown>;
const NL = 0x0a;

export interface IndexResult {
  totalRows: number;
  byteSize: number;
  name: string;
  columns: string[];
}

export class JsonlIndexer {
  private lineStarts: number[] = [];
  private fileSize = 0;
  private totalRows = 0;
  private isJsonl: boolean;
  private memoryRows: Row[] | null = null;

  constructor(private fsPath: string, private fileName: string) {
    this.isJsonl = /\.(jsonl|ndjson)$/i.test(fsPath);
  }

  async init(onProgress: (progress: number, rows: number) => void): Promise<IndexResult> {
    const stat = await fs.promises.stat(this.fsPath);
    this.fileSize = stat.size;

    if (!this.isJsonl) {
      const text = await fs.promises.readFile(this.fsPath, 'utf-8');
      const parsed = JSON.parse(text);
      this.memoryRows = Array.isArray(parsed) ? parsed : [parsed];
      this.totalRows = this.memoryRows.length;
    } else {
      await this.buildIndex(onProgress);
    }

    const sample = await this.getRows(0, 200);
    return {
      totalRows: this.totalRows,
      byteSize: this.fileSize,
      name: this.fileName,
      columns: inferColumns(sample),
    };
  }

  private buildIndex(onProgress: (progress: number, rows: number) => void): Promise<void> {
    this.lineStarts = [0];
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(this.fsPath, { highWaterMark: 8 * 1024 * 1024 });
      let pos = 0;
      let endsWithNewline = false;
      let lastTick = 0;
      stream.on('data', (data: string | Buffer) => {
        const chunk = data as Buffer;
        for (let i = 0; i < chunk.length; i++) {
          if (chunk[i] === NL) {
            const next = pos + i + 1;
            endsWithNewline = next === this.fileSize;
            this.lineStarts.push(next);
          }
        }
        pos += chunk.length;
        const now = Date.now();
        if (now - lastTick > 80) {
          lastTick = now;
          onProgress(pos / this.fileSize, this.lineStarts.length);
        }
      });
      stream.on('end', () => {
        if (endsWithNewline) this.lineStarts.pop();
        this.totalRows = this.lineStarts.length;
        onProgress(1, this.totalRows);
        resolve();
      });
      stream.on('error', reject);
    });
  }

  private parseLines(text: string): Row[] {
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

  private async readByteRange(byteStart: number, byteEnd: number): Promise<Row[]> {
    const fd = await fs.promises.open(this.fsPath, 'r');
    try {
      const length = byteEnd - byteStart;
      const buf = Buffer.allocUnsafe(length);
      await fd.read(buf, 0, length, byteStart);
      return this.parseLines(buf.toString('utf-8'));
    } finally {
      await fd.close();
    }
  }

  async getRows(start: number, count: number): Promise<Row[]> {
    if (this.memoryRows) return this.memoryRows.slice(start, start + count);
    if (this.totalRows === 0) return [];
    const endRow = Math.min(start + count, this.totalRows);
    if (start >= endRow) return [];
    const byteEnd = endRow < this.totalRows ? this.lineStarts[endRow] : this.fileSize;
    return this.readByteRange(this.lineStarts[start], byteEnd);
  }

  async getRowsByIndices(indices: number[]): Promise<Row[]> {
    if (this.memoryRows) return indices.map((i) => this.memoryRows![i]);
    const out: Row[] = new Array(indices.length);
    const fd = await fs.promises.open(this.fsPath, 'r');
    try {
      for (let k = 0; k < indices.length; k++) {
        const idx = indices[k];
        if (idx < 0 || idx >= this.totalRows) {
          out[k] = {};
          continue;
        }
        const byteStart = this.lineStarts[idx];
        const byteEnd = idx + 1 < this.totalRows ? this.lineStarts[idx + 1] : this.fileSize;
        const buf = Buffer.allocUnsafe(byteEnd - byteStart);
        await fd.read(buf, 0, byteEnd - byteStart, byteStart);
        out[k] = this.parseLines(buf.toString('utf-8'))[0] ?? {};
      }
      return out;
    } finally {
      await fd.close();
    }
  }

  async query(
    spec: QuerySpec,
    onProgress: (progress: number) => void,
  ): Promise<{ order: number[] | null; matched: number }> {
    if (isEmptyQuery(spec)) return { order: null, matched: this.totalRows };

    const predicate = buildPredicate(spec);
    const sort = spec.sort ?? null;
    const matchedIdx: number[] = [];
    const keys: (number | string)[] = [];

    const PAGE = 5000;
    for (let start = 0; start < this.totalRows; start += PAGE) {
      const rows = await this.getRows(start, PAGE);
      for (let i = 0; i < rows.length; i++) {
        if (predicate(rows[i])) {
          matchedIdx.push(start + i);
          if (sort) keys.push(sortKey(rows[i], sort.path));
        }
      }
      onProgress(Math.min(1, (start + PAGE) / this.totalRows));
    }

    if (sort) {
      const positions = matchedIdx.map((_, k) => k);
      positions.sort((pa, pb) => compareKeys(keys[pa], keys[pb], matchedIdx[pa], matchedIdx[pb], sort.dir));
      const ordered = positions.map((p) => matchedIdx[p]);
      return { order: ordered, matched: ordered.length };
    }
    return { order: matchedIdx, matched: matchedIdx.length };
  }
}
