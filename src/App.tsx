import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TableView } from './components/TableView';
import { CardsView } from './components/CardsView';
import { GraphView } from './components/GraphView';
import { TreeView } from './components/TreeView';
import { LayoutGrid, Table2, Network, ListTree, UploadCloud, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toolbar } from './components/Toolbar';
import type { DataSource, DataSourceStats, IndexProgress } from './data/types';
import type { QuerySpec } from './data/query';
import { isEmptyQuery } from './data/query';
import { FileDataSource } from './data/FileDataSource';
import { VscodeDataSource } from './data/VscodeDataSource';

type ViewMode = 'cards' | 'table' | 'tree' | 'graph';

// acquireVsCodeApi may only be called once per webview lifetime.
const vscodeApi =
  typeof window !== 'undefined' && window.acquireVsCodeApi ? window.acquireVsCodeApi() : null;

function fmtBytes(n?: number): string {
  if (!n) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export default function App() {
  const [source, setSource] = useState<DataSource | null>(null);
  const [stats, setStats] = useState<DataSourceStats | null>(null);
  const [progress, setProgress] = useState<IndexProgress | null>(null);
  const [mode, setMode] = useState<ViewMode>('cards');
  const [error, setError] = useState<string | null>(null);
  const [spec, setSpec] = useState<QuerySpec>({});
  const [order, setOrder] = useState<number[] | null>(null);
  const [matched, setMatched] = useState(0);
  const [querying, setQuerying] = useState(false);
  const sourceRef = useRef<DataSource | null>(null);
  const queryToken = useRef(0);

  const load = useCallback(async (ds: DataSource) => {
    setError(null);
    setStats(null);
    setSpec({});
    setOrder(null);
    setProgress({ phase: 'indexing', progress: 0, rowsIndexed: 0 });
    sourceRef.current?.dispose();
    sourceRef.current = ds;
    try {
      const s = await ds.init((p) => setProgress(p));
      setStats(s);
      setMatched(s.totalRows);
      setSource(ds);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress({ phase: 'error', progress: 0, rowsIndexed: 0 });
    }
  }, []);

  // Run the query (debounced) whenever the spec changes. Empty spec = identity.
  useEffect(() => {
    if (!source || !stats) return;
    const token = ++queryToken.current;
    if (isEmptyQuery(spec)) {
      setOrder(null);
      setMatched(stats.totalRows);
      setQuerying(false);
      return;
    }
    setQuerying(true);
    const t = setTimeout(() => {
      source
        .query(spec)
        .then((res) => {
          if (token !== queryToken.current) return; // stale
          setOrder(res.order);
          setMatched(res.matched);
          setQuerying(false);
        })
        .catch(() => token === queryToken.current && setQuerying(false));
    }, 250);
    return () => clearTimeout(t);
  }, [spec, source, stats]);

  const handleSort = useCallback((col: string) => {
    setSpec((prev) => {
      if (prev.sort?.path !== col) return { ...prev, sort: { path: col, dir: 'asc' } };
      if (prev.sort.dir === 'asc') return { ...prev, sort: { path: col, dir: 'desc' } };
      return { ...prev, sort: null };
    });
  }, []);

  // In a VS Code / Antigravity webview the host owns the file — load it automatically.
  useEffect(() => {
    if (vscodeApi) load(new VscodeDataSource(vscodeApi));
  }, [load]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) load(new FileDataSource(file));
    },
    [load],
  );

  const indexing = progress?.phase === 'indexing';
  const ready = !!source && !!stats;

  return (
    <div className="h-screen w-screen flex flex-col font-sans overflow-hidden text-slate-200">
      {/* Floating Pill Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between px-2 py-2 glass-panel rounded-full w-[92%] max-w-5xl"
      >
        <div className="flex items-center space-x-3 px-4 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)] shrink-0">
            <Network className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-medium text-white tracking-wide leading-none">JSON Vision</h1>
            {stats && (
              <span className="text-[11px] text-slate-500 truncate block">
                {stats.name} · {stats.totalRows.toLocaleString()} rows · {fmtBytes(stats.byteSize)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1 bg-black/20 p-1 rounded-full border border-white/5">
          {([
            ['cards', LayoutGrid, 'Posts'],
            ['table', Table2, 'Table'],
            ['tree', ListTree, 'Tree'],
            ['graph', Network, 'Schema'],
          ] as const).map(([m, Icon, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={!ready}
              className={`relative flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-30 ${
                mode === m ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode === m && (
                <motion.div layoutId="nav-pill" className="absolute inset-0 bg-white/10 rounded-full border border-white/10" />
              )}
              <Icon className="w-4 h-4 relative z-10" />
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>

        {!vscodeApi && (
          <div className="pr-2">
            <label className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-full text-sm font-medium cursor-pointer transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]">
              <UploadCloud className="w-4 h-4" />
              <span>{stats ? 'New File' : 'Open File'}</span>
              <input type="file" accept=".json,.jsonl" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        )}
      </motion.header>

      <main className="flex-1 overflow-hidden relative pt-28 pb-8 px-8 flex justify-center">
        {!ready && !indexing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center text-center max-w-lg"
          >
            <h2 className="text-5xl font-light text-white mb-6 tracking-tight">
              Radically different <br />
              <span className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">data vision</span>
            </h2>
            <p className="text-lg text-slate-300 mb-10 font-light">
              Visualize JSON & JSONL of any size as posts, tables, and schema graphs. Multi-gigabyte files stream from disk — nothing freezes.
            </p>
            <label className="group flex items-center justify-between bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-2 pl-6 pr-2 w-full max-w-md cursor-pointer hover:bg-black/50 transition-all hover:border-white/20">
              <span className="text-slate-400 font-medium">Select a .json or .jsonl file</span>
              <div className="bg-blue-600 text-white rounded-full px-6 py-3 flex items-center space-x-2 font-medium group-hover:bg-blue-500 transition-colors">
                <span>Open</span>
                <ChevronRight className="w-4 h-4" />
              </div>
              <input type="file" accept=".json,.jsonl" className="hidden" onChange={handleFileUpload} />
            </label>
            {error && <p className="mt-6 text-red-400 text-sm">{error}</p>}
          </motion.div>
        )}

        {indexing && (
          <div className="flex flex-col items-center justify-center text-center max-w-md w-full">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center mb-6 animate-pulse">
              <Network className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Indexing file…</h3>
            <p className="text-slate-400 text-sm mb-6">
              {progress!.rowsIndexed.toLocaleString()} records · reading from disk, not loading into memory
            </p>
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-400"
                animate={{ width: `${Math.round(progress!.progress * 100)}%` }}
                transition={{ ease: 'linear' }}
              />
            </div>
          </div>
        )}

        {ready && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-7xl h-full glass-panel rounded-[2rem] overflow-hidden flex flex-col relative"
          >
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            {mode !== 'graph' && (
              <Toolbar
                columns={stats!.columns}
                spec={spec}
                onChange={setSpec}
                matched={matched}
                total={stats!.totalRows}
                querying={querying}
              />
            )}

            <div className="relative flex-1 min-h-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0"
                >
                  {mode === 'table' && (
                    <TableView
                      source={source!}
                      totalRows={matched}
                      columns={stats!.columns}
                      order={order}
                      sort={spec.sort ?? null}
                      onSort={handleSort}
                    />
                  )}
                  {mode === 'cards' && <CardsView source={source!} totalRows={matched} order={order} />}
                  {mode === 'tree' && <TreeView source={source!} totalRows={matched} order={order} />}
                  {mode === 'graph' && <GraphView source={source!} totalRows={stats!.totalRows} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
