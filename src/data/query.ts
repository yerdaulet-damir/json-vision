import type { Row } from './types';
import { getPath } from './flatten';

// Pure, runtime-agnostic query engine shared by the browser worker and the
// Node extension host. Given a QuerySpec it produces a row-level predicate and
// a sort comparator. The engines stream the file once and turn rows into an
// "order": an array of source row indices (filtered, then sorted).

export type FilterOp =
  | 'contains'
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'exists'
  | 'empty';

export interface Filter {
  path: string;
  op: FilterOp;
  value?: string;
}

export interface SortSpec {
  path: string;
  dir: 'asc' | 'desc';
}

export interface QuerySpec {
  search?: string;
  filters?: Filter[];
  sort?: SortSpec | null;
}

export function isEmptyQuery(q: QuerySpec | null | undefined): boolean {
  if (!q) return true;
  return !q.search?.trim() && (!q.filters || q.filters.length === 0) && !q.sort;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return null;
}

function matchFilter(row: Row, f: Filter): boolean {
  const val = getPath(row, f.path);
  switch (f.op) {
    case 'exists':
      return val !== undefined && val !== null;
    case 'empty':
      return val === undefined || val === null || val === '';
    case 'contains':
      return String(val ?? '').toLowerCase().includes((f.value ?? '').toLowerCase());
    case 'eq':
      return String(val ?? '') === (f.value ?? '');
    case 'neq':
      return String(val ?? '') !== (f.value ?? '');
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = asNumber(val);
      const b = asNumber(f.value);
      if (a === null || b === null) {
        const sa = String(val ?? '');
        const sb = f.value ?? '';
        if (f.op === 'gt') return sa > sb;
        if (f.op === 'gte') return sa >= sb;
        if (f.op === 'lt') return sa < sb;
        return sa <= sb;
      }
      if (f.op === 'gt') return a > b;
      if (f.op === 'gte') return a >= b;
      if (f.op === 'lt') return a < b;
      return a <= b;
    }
    default:
      return true;
  }
}

/** Build a row predicate from search text + filters. */
export function buildPredicate(spec: QuerySpec): (row: Row) => boolean {
  const term = spec.search?.trim().toLowerCase();
  const filters = spec.filters ?? [];
  return (row: Row) => {
    if (term) {
      // Full-text over the serialized row — fast single pass, matches any field.
      if (!JSON.stringify(row).toLowerCase().includes(term)) return false;
    }
    for (const f of filters) {
      if (!matchFilter(row, f)) return false;
    }
    return true;
  };
}

/** Comparable sort key for a row under a sort spec. */
export function sortKey(row: Row, path: string): number | string {
  const v = getPath(row, path);
  const n = asNumber(v);
  return n !== null ? n : String(v ?? '').toLowerCase();
}

/** Stable comparator over (sortKey, originalIndex) tuples. */
export function compareKeys(
  ka: number | string,
  kb: number | string,
  ia: number,
  ib: number,
  dir: 'asc' | 'desc',
): number {
  let r: number;
  if (typeof ka === 'number' && typeof kb === 'number') r = ka - kb;
  else r = String(ka) < String(kb) ? -1 : String(ka) > String(kb) ? 1 : 0;
  if (r === 0) return ia - ib; // stable
  return dir === 'asc' ? r : -r;
}
