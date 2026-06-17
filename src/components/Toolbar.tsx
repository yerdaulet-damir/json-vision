import React, { useState } from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, X, Plus, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Filter, FilterOp, QuerySpec, SortSpec } from '../data/query';

interface ToolbarProps {
  columns: string[];
  spec: QuerySpec;
  onChange: (next: QuerySpec) => void;
  matched: number;
  total: number;
  querying: boolean;
}

const OPS: { value: FilterOp; label: string; needsValue: boolean }[] = [
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'eq', label: '=', needsValue: true },
  { value: 'neq', label: '≠', needsValue: true },
  { value: 'gt', label: '>', needsValue: true },
  { value: 'gte', label: '≥', needsValue: true },
  { value: 'lt', label: '<', needsValue: true },
  { value: 'lte', label: '≤', needsValue: true },
  { value: 'exists', label: 'exists', needsValue: false },
  { value: 'empty', label: 'is empty', needsValue: false },
];

const leaf = (p: string) => p.split('.').pop();

export const Toolbar: React.FC<ToolbarProps> = ({ columns, spec, onChange, matched, total, querying }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [draft, setDraft] = useState<Filter>({ path: columns[0] ?? '', op: 'contains', value: '' });

  const filters = spec.filters ?? [];

  const setSearch = (search: string) => onChange({ ...spec, search });
  const setSort = (sort: SortSpec | null) => onChange({ ...spec, sort });
  const setFilters = (next: Filter[]) => onChange({ ...spec, filters: next });

  const addFilter = () => {
    if (!draft.path) return;
    setFilters([...filters, { ...draft }]);
    setDraft({ path: columns[0] ?? '', op: 'contains', value: '' });
  };

  const filtered = matched !== total;

  return (
    <div className="relative z-20 px-5 pt-4">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-full px-4 h-10 flex-1 min-w-[220px] focus-within:border-blue-400/50 transition-colors">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            value={spec.search ?? ''}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all fields…"
            className="bg-transparent outline-none text-sm text-slate-100 placeholder:text-slate-600 w-full"
          />
          {spec.search && (
            <button onClick={() => setSearch('')} className="text-slate-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => { setShowSort((s) => !s); setShowFilters(false); }}
            className={`flex items-center gap-2 h-10 px-4 rounded-full border text-sm font-medium transition-colors ${
              spec.sort ? 'bg-blue-500/15 border-blue-400/40 text-blue-200' : 'bg-black/30 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <ArrowUpDown className="w-4 h-4" />
            {spec.sort ? <span className="max-w-[120px] truncate">{leaf(spec.sort.path)}</span> : 'Sort'}
            {spec.sort && (spec.sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
          </button>
          <AnimatePresence>
            {showSort && (
              <Popover onClose={() => setShowSort(false)}>
                <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Sort by</div>
                <div className="flex gap-2">
                  <select
                    value={spec.sort?.path ?? ''}
                    onChange={(e) => setSort(e.target.value ? { path: e.target.value, dir: spec.sort?.dir ?? 'asc' } : null)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 h-9 text-sm text-slate-200 outline-none"
                  >
                    <option value="">— none —</option>
                    {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    disabled={!spec.sort}
                    onClick={() => setSort(spec.sort ? { ...spec.sort, dir: spec.sort.dir === 'asc' ? 'desc' : 'asc' } : null)}
                    className="h-9 px-3 rounded-lg bg-black/40 border border-white/10 text-slate-200 disabled:opacity-30 flex items-center gap-1 text-sm"
                  >
                    {spec.sort?.dir === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                    {spec.sort?.dir === 'desc' ? 'Desc' : 'Asc'}
                  </button>
                </div>
              </Popover>
            )}
          </AnimatePresence>
        </div>

        {/* Filters */}
        <div className="relative">
          <button
            onClick={() => { setShowFilters((s) => !s); setShowSort(false); }}
            className={`flex items-center gap-2 h-10 px-4 rounded-full border text-sm font-medium transition-colors ${
              filters.length ? 'bg-blue-500/15 border-blue-400/40 text-blue-200' : 'bg-black/30 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters{filters.length ? ` · ${filters.length}` : ''}
          </button>
          <AnimatePresence>
            {showFilters && (
              <Popover onClose={() => setShowFilters(false)} wide>
                <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Add filter</div>
                <div className="flex gap-2 mb-3">
                  <select
                    value={draft.path}
                    onChange={(e) => setDraft({ ...draft, path: e.target.value })}
                    className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-2 h-9 text-sm text-slate-200 outline-none"
                  >
                    {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    value={draft.op}
                    onChange={(e) => setDraft({ ...draft, op: e.target.value as FilterOp })}
                    className="bg-black/40 border border-white/10 rounded-lg px-2 h-9 text-sm text-slate-200 outline-none"
                  >
                    {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {OPS.find((o) => o.value === draft.op)?.needsValue && (
                    <input
                      value={draft.value ?? ''}
                      onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addFilter()}
                      placeholder="value"
                      className="w-24 bg-black/40 border border-white/10 rounded-lg px-2 h-9 text-sm text-slate-200 outline-none"
                    />
                  )}
                  <button onClick={addFilter} className="h-9 w-9 shrink-0 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                </div>
                {filters.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {filters.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                        <span className="truncate">
                          <span className="text-slate-500">{leaf(f.path)}</span>{' '}
                          <span className="text-blue-300">{OPS.find((o) => o.value === f.op)?.label}</span>{' '}
                          {f.value && <span className="text-slate-200">"{f.value}"</span>}
                        </span>
                        <button onClick={() => setFilters(filters.filter((_, k) => k !== i))} className="text-slate-500 hover:text-red-400 shrink-0 ml-2">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Popover>
            )}
          </AnimatePresence>
        </div>

        {/* Count */}
        <div className="flex items-center gap-2 text-xs text-slate-400 ml-auto pl-2 shrink-0">
          {querying && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />}
          <span className={filtered ? 'text-blue-300 font-medium' : ''}>
            {matched.toLocaleString()}
          </span>
          {filtered && <span className="text-slate-600">/ {total.toLocaleString()}</span>}
          <span className="text-slate-600">rows</span>
        </div>
      </div>
    </div>
  );
};

const Popover: React.FC<{ children: React.ReactNode; onClose: () => void; wide?: boolean }> = ({ children, onClose, wide }) => (
  <>
    <div className="fixed inset-0 z-10" onClick={onClose} />
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={`absolute right-0 mt-2 z-20 rounded-2xl bg-[#11131a]/95 backdrop-blur-2xl border border-white/10 shadow-2xl p-4 ${wide ? 'w-[420px]' : 'w-[320px]'}`}
    >
      {children}
    </motion.div>
  </>
);
