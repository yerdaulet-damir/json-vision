import React, { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { DataSource } from '../data/types';
import { useRowWindow } from '../data/useRowWindow';
import { JsonTree } from './JsonTree';

interface TreeViewProps {
  source: DataSource;
  totalRows: number;
  order: number[] | null;
}

export const TreeView: React.FC<TreeViewProps> = ({ source, totalRows, order }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const { getRow, ensureRange, version } = useRowWindow(source, order, totalRows);

  const virt = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 6,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const items = virt.getVirtualItems();
  useEffect(() => {
    if (items.length) ensureRange(items[0].index, items[items.length - 1].index);
  }, [items, ensureRange]);

  return (
    <div ref={parentRef} className="w-full h-full overflow-y-auto custom-scrollbar px-6 py-6">
      <div className="max-w-4xl mx-auto" data-version={version}>
        <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
          {items.map((vi) => {
            const row = getRow(vi.index);
            return (
              <div
                key={vi.key}
                data-index={vi.index}
                ref={virt.measureElement}
                className="absolute top-0 left-0 w-full pb-3"
                style={{ transform: `translateY(${vi.start}px)` }}
              >
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">#{vi.index + 1}</div>
                  {row ? (
                    <JsonTree data={row} rootOpen />
                  ) : (
                    <div className="h-16 rounded bg-white/[0.03] animate-pulse" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
