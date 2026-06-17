import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Sparkles } from 'lucide-react';
import type { DataSource } from '../data/types';
import { useRowWindow } from '../data/useRowWindow';
import { cardRenderers, pickRenderer, rendererById } from './cards';

interface CardsViewProps {
  source: DataSource;
  totalRows: number;
  order: number[] | null;
}

export const CardsView: React.FC<CardsViewProps> = ({ source, totalRows, order }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const { getRow, ensureRange, version } = useRowWindow(source, order, totalRows);

  // Sample the dataset once to auto-detect the record shape.
  const [autoId, setAutoId] = useState<string>('generic');
  const [forcedId, setForcedId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    source.getRows(0, 80).then(({ rows }) => alive && setAutoId(pickRenderer(rows).id));
    return () => { alive = false; };
  }, [source]);

  const renderer = useMemo(() => rendererById(forcedId ?? autoId), [forcedId, autoId]);

  const virt = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const items = virt.getVirtualItems();
  useEffect(() => {
    if (items.length) ensureRange(items[0].index, items[items.length - 1].index);
  }, [items, ensureRange]);

  const Card = renderer.Card;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Style switcher — auto-detected, manually overridable */}
      <div className="flex items-center gap-2 px-6 pt-4 pb-2">
        <Sparkles className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[11px] text-slate-500 mr-1">Style</span>
        <div className="flex items-center gap-1 bg-black/20 p-1 rounded-full border border-white/5">
          <button
            onClick={() => setForcedId(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${forcedId === null ? 'bg-white/10 text-white border border-white/10' : 'text-slate-400 hover:text-slate-200'}`}
            title={`Auto-detected: ${rendererById(autoId).label}`}
          >
            Auto · {rendererById(autoId).label}
          </button>
          {cardRenderers.map((r) => (
            <button
              key={r.id}
              onClick={() => setForcedId(r.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${forcedId === r.id ? 'bg-white/10 text-white border border-white/10' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6">
        <div className="max-w-2xl mx-auto" data-version={version}>
          <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
            {items.map((vi) => {
              const row = getRow(vi.index);
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virt.measureElement}
                  className="absolute top-0 left-0 w-full pb-4"
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  {row ? (
                    <Card row={row} index={vi.index} />
                  ) : (
                    <div className="h-40 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
