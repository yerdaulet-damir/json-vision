// Shared data-layer contracts. The same React UI runs on top of any DataSource:
// a browser File (paged via File.slice) or a VS Code extension host (paged via fs).

import type { QuerySpec } from './query';

export type Row = Record<string, unknown>;

export interface QueryResult {
  /**
   * Source row indices in display order (filtered + sorted), or null when the
   * query is empty (identity order — read contiguously via getRows).
   */
  order: number[] | null;
  /** Number of rows matched by the query. */
  matched: number;
}

export interface RowsPage {
  /** Absolute index of the first row in this page. */
  start: number;
  /** The decoded rows, in order, starting at `start`. */
  rows: Row[];
}

export interface DataSourceStats {
  /** Total number of records (lines for JSONL, array length for JSON). */
  totalRows: number;
  /** File size in bytes, if known. */
  byteSize?: number;
  /** Display name. */
  name: string;
  /** Inferred flattened column paths, sampled from the first rows. */
  columns: string[];
}

export interface IndexProgress {
  phase: 'indexing' | 'ready' | 'error';
  /** 0..1 fraction of the file scanned during indexing. */
  progress: number;
  rowsIndexed: number;
  message?: string;
}

/**
 * A paged, on-demand view over a (potentially huge) JSON/JSONL dataset.
 * Implementations never require the whole dataset in memory at once.
 */
export interface DataSource {
  /** Build the line index and infer columns. Reports progress incrementally. */
  init(onProgress?: (p: IndexProgress) => void): Promise<DataSourceStats>;
  /** Read `count` rows starting at absolute `start`. Reads only those bytes. */
  getRows(start: number, count: number): Promise<RowsPage>;
  /** Read specific rows by absolute source index (random access via offsets). */
  getRowsByIndices(indices: number[]): Promise<Row[]>;
  /** Stream the whole file applying search/filter/sort -> a display order. */
  query(spec: QuerySpec, onProgress?: (p: IndexProgress) => void): Promise<QueryResult>;
  /** Release any workers / handles. */
  dispose(): void;
}
