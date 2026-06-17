import type { Row } from './types';

/** Flatten a nested object into dot-paths: {a:{b:1}} -> {"a.b":1}. Arrays kept whole. */
export function flatten(obj: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    if (prefix) out[prefix] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, path, out);
    } else {
      out[path] = v;
    }
  }
  return out;
}

/** Read a dot-path value out of a row. */
export function getPath(row: Row, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === 'object' && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, row);
}

/** Infer ordered, de-duplicated flattened column paths from a sample of rows. */
export function inferColumns(sample: Row[], limit = 60): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const row of sample) {
    for (const key of Object.keys(flatten(row))) {
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(key);
        if (ordered.length >= limit) return ordered;
      }
    }
  }
  return ordered;
}

/** Compact, human display of any value for table cells. */
export function displayValue(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
