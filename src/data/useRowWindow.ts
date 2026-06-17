import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataSource, Row } from './types';

const PAGE_SIZE = 200;
const MAX_PAGES = 80; // LRU cap -> ~16k rows resident max

/**
 * Windowed, on-demand row access over a DataSource, aware of an optional display
 * `order` (filtered/sorted source indices). Views call `ensureRange` for the
 * rows the virtualizer wants to paint; missing pages are fetched in the
 * background and `version` bumps to repaint. Resident pages are LRU-capped so
 * memory stays flat regardless of total file size.
 *
 * order === null  -> identity: page contiguously via getRows.
 * order is array  -> page by mapping display indices through getRowsByIndices.
 */
export function useRowWindow(
  source: DataSource | null,
  order: number[] | null,
  displayCount: number,
) {
  const cache = useRef(new Map<number, Row[]>());
  const inflight = useRef(new Set<number>());
  const lru = useRef<number[]>([]);
  const [version, setVersion] = useState(0);

  // Reset whenever the source or the ordering changes.
  useEffect(() => {
    cache.current.clear();
    inflight.current.clear();
    lru.current = [];
    setVersion((v) => v + 1);
  }, [source, order]);

  const touch = useCallback((page: number) => {
    const arr = lru.current;
    const idx = arr.indexOf(page);
    if (idx !== -1) arr.splice(idx, 1);
    arr.push(page);
    while (arr.length > MAX_PAGES) {
      const evict = arr.shift()!;
      cache.current.delete(evict);
    }
  }, []);

  const fetchPage = useCallback(
    (page: number) => {
      if (!source || cache.current.has(page) || inflight.current.has(page)) return;
      inflight.current.add(page);
      const start = page * PAGE_SIZE;
      const promise = order
        ? source.getRowsByIndices(order.slice(start, start + PAGE_SIZE))
        : source.getRows(start, PAGE_SIZE).then((p) => p.rows);
      promise
        .then((rows) => {
          cache.current.set(page, rows);
          touch(page);
          inflight.current.delete(page);
          setVersion((v) => v + 1);
        })
        .catch(() => {
          inflight.current.delete(page);
        });
    },
    [source, order, touch],
  );

  const ensureRange = useCallback(
    (start: number, end: number) => {
      if (!source || displayCount === 0) return;
      const first = Math.max(0, Math.floor(start / PAGE_SIZE));
      const last = Math.floor(Math.min(end, displayCount - 1) / PAGE_SIZE);
      for (let p = first; p <= last; p++) fetchPage(p);
    },
    [source, displayCount, fetchPage],
  );

  const getRow = useCallback(
    (index: number): Row | undefined => {
      const page = Math.floor(index / PAGE_SIZE);
      const rows = cache.current.get(page);
      if (rows) {
        touch(page);
        return rows[index - page * PAGE_SIZE];
      }
      return undefined;
    },
    [touch],
  );

  return { getRow, ensureRange, version };
}
