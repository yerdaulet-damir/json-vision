import type { DataSource, DataSourceStats, IndexProgress, QueryResult, RowsPage, Row } from './types';
import type { QuerySpec } from './query';

/** Browser DataSource: pages a File from disk via a Web Worker (File.slice). */
export class FileDataSource implements DataSource {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<number, (v: unknown) => void>();
  private file: File;

  constructor(file: File) {
    this.file = file;
    this.worker = new Worker(new URL('./indexWorker.ts', import.meta.url), {
      type: 'module',
    });
  }

  private call<T>(msg: Record<string, unknown>, onProgress?: (p: IndexProgress) => void): Promise<T> {
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        const data = e.data;
        if (data.id !== id) return;
        if (data.type === 'progress') {
          onProgress?.({
            phase: 'indexing',
            progress: data.progress,
            rowsIndexed: data.rowsIndexed,
          });
          return;
        }
        this.worker.removeEventListener('message', handler);
        if (data.type === 'error') reject(new Error(data.message));
        else resolve(data as T);
      };
      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ ...msg, id });
    });
  }

  async init(onProgress?: (p: IndexProgress) => void): Promise<DataSourceStats> {
    const isJsonl = this.file.name.toLowerCase().endsWith('.jsonl');
    const res = await this.call<{
      totalRows: number;
      byteSize: number;
      columns: string[];
    }>({ type: 'init', file: this.file, isJsonl }, onProgress);
    onProgress?.({ phase: 'ready', progress: 1, rowsIndexed: res.totalRows });
    return {
      totalRows: res.totalRows,
      byteSize: res.byteSize,
      name: this.file.name,
      columns: res.columns,
    };
  }

  async getRows(start: number, count: number): Promise<RowsPage> {
    const res = await this.call<{ start: number; rows: RowsPage['rows'] }>({
      type: 'getRows',
      start,
      count,
    });
    return { start: res.start, rows: res.rows };
  }

  async getRowsByIndices(indices: number[]): Promise<Row[]> {
    const res = await this.call<{ rows: Row[] }>({ type: 'getRowsByIndices', indices });
    return res.rows;
  }

  async query(spec: QuerySpec, onProgress?: (p: IndexProgress) => void): Promise<QueryResult> {
    const res = await this.call<{ order: number[] | null; matched: number }>(
      { type: 'query', spec },
      onProgress,
    );
    return { order: res.order, matched: res.matched };
  }

  dispose(): void {
    this.worker.terminate();
    this.pending.clear();
  }
}
