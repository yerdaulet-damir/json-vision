import type { DataSource, DataSourceStats, IndexProgress, QueryResult, RowsPage, Row } from './types';
import type { QuerySpec } from './query';

interface VsCodeApi {
  postMessage(msg: unknown): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

/**
 * DataSource for the VS Code / Antigravity / Cursor webview. All paging happens
 * in the extension host (Node fs), which streams huge files from disk and sends
 * back only the requested rows over postMessage.
 */
export class VscodeDataSource implements DataSource {
  private vscode: VsCodeApi;
  private seq = 0;

  constructor(vscode: VsCodeApi) {
    this.vscode = vscode;
  }

  static isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function';
  }

  private call<T>(msg: Record<string, unknown>, onProgress?: (p: IndexProgress) => void): Promise<T> {
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        const data = e.data;
        if (!data || data.id !== id) return;
        if (data.type === 'progress') {
          onProgress?.({
            phase: 'indexing',
            progress: data.progress,
            rowsIndexed: data.rowsIndexed,
          });
          return;
        }
        window.removeEventListener('message', handler);
        if (data.type === 'error') reject(new Error(data.message));
        else resolve(data as T);
      };
      window.addEventListener('message', handler);
      this.vscode.postMessage({ ...msg, id });
    });
  }

  async init(onProgress?: (p: IndexProgress) => void): Promise<DataSourceStats> {
    const res = await this.call<{
      totalRows: number;
      byteSize: number;
      name: string;
      columns: string[];
    }>({ type: 'init' }, onProgress);
    onProgress?.({ phase: 'ready', progress: 1, rowsIndexed: res.totalRows });
    return res;
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
    /* host owns the file; nothing to release here */
  }
}
