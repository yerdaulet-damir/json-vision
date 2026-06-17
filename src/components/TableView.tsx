import React, { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUp, ArrowDown } from 'lucide-react';
import type { DataSource } from '../data/types';
import type { SortSpec } from '../data/query';
import { useRowWindow } from '../data/useRowWindow';
import { getPath, displayValue } from '../data/flatten';

interface TableViewProps {
  source: DataSource;
  totalRows: number;
  columns: string[];
  order: number[] | null;
  sort: SortSpec | null;
  onSort: (col: string) => void;
}

const ROW_H = 44;
const COL_W = 220;

export const TableView: React.FC<TableViewProps> = ({ source, totalRows, columns, order, sort, onSort }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const { getRow, ensureRange, version } = useRowWindow(source, order, totalRows);

  const rowVirt = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  const items = rowVirt.getVirtualItems();
  useEffect(() => {
    if (items.length) ensureRange(items[0].index, items[items.length - 1].index);
  }, [items, ensureRange]);

  const gridWidth = columns.length * COL_W;

  return (
    <div className="w-full h-full p-6 flex flex-col">
      <div className="w-full rounded-2xl bg-white/5 border border-white/10 shadow-2xl overflow-hidden flex-1 flex flex-col">
        {/* Sticky header (outside the scroller so it never repaints per row) */}
        <div
          ref={parentRef}
          className="overflow-auto w-full h-full custom-scrollbar"
        >
          <div style={{ width: gridWidth, minWidth: '100%' }}>
            <div
              className="flex sticky top-0 z-10 bg-black/60 backdrop-blur-xl border-b border-white/10"
              style={{ width: gridWidth, minWidth: '100%' }}
            >
              <div
                className="shrink-0 px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-widest sticky left-0 bg-black/70 backdrop-blur-xl"
                style={{ width: 64 }}
              >
                #
              </div>
              {columns.map((col) => {
                const active = sort?.path === col;
                return (
                  <button
                    key={col}
                    onClick={() => onSort(col)}
                    className={`shrink-0 px-4 py-3 font-semibold uppercase tracking-widest text-[10px] truncate text-left flex items-center gap-1 hover:text-white transition-colors ${
                      active ? 'text-blue-300' : 'text-slate-300'
                    }`}
                    style={{ width: COL_W }}
                    title={`Sort by ${col}`}
                  >
                    <span className="truncate">
                      {col.split('.').pop()}
                      {col.includes('.') && (
                        <span className="text-slate-600 normal-case tracking-normal"> · {col.split('.').slice(0, -1).join('.')}</span>
                      )}
                    </span>
                    {active && (sort!.dir === 'asc' ? <ArrowUp className="w-3 h-3 shrink-0" /> : <ArrowDown className="w-3 h-3 shrink-0" />)}
                  </button>
                );
              })}
            </div>

            <div style={{ height: rowVirt.getTotalSize(), position: 'relative' }}>
              {items.map((vi) => {
                const row = getRow(vi.index);
                return (
                  <div
                    key={vi.key}
                    className="flex items-stretch border-b border-white/5 hover:bg-white/5 transition-colors absolute top-0 left-0"
                    style={{ height: ROW_H, transform: `translateY(${vi.start}px)`, width: gridWidth, minWidth: '100%' }}
                  >
                    <div
                      className="shrink-0 px-3 flex items-center text-xs text-slate-600 font-mono sticky left-0 bg-[#0a0a0f]/80 backdrop-blur-sm"
                      style={{ width: 64 }}
                    >
                      {vi.index + 1}
                    </div>
                    {columns.map((col) => {
                      const val = row ? getPath(row, col) : undefined;
                      const text = row ? displayValue(val) : '';
                      return (
                        <div
                          key={col}
                          className="shrink-0 px-4 flex items-center text-slate-300 text-[13px] truncate"
                          style={{ width: COL_W }}
                          title={text}
                        >
                          {row ? (
                            <span className="truncate">{text}</span>
                          ) : (
                            <span className="h-3 w-2/3 rounded bg-white/5 animate-pulse" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="pt-3 text-xs text-slate-500" data-version={version}>
        {totalRows.toLocaleString()} rows · {columns.length} columns
      </div>
    </div>
  );
};
