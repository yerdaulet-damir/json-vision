import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

// Collapsible, type-colored JSON tree — the canonical "JSON viewer" view.
// Purely presentational and self-contained; one instance per record.

function valueColor(v: unknown): string {
  if (v === null) return 'text-slate-500';
  switch (typeof v) {
    case 'string': return 'text-emerald-300';
    case 'number': return 'text-amber-300';
    case 'boolean': return 'text-purple-300';
    default: return 'text-slate-200';
  }
}

function renderPrimitive(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  return String(v);
}

interface NodeProps {
  k?: string | number;
  value: unknown;
  depth: number;
  defaultOpen: boolean;
}

const Node: React.FC<NodeProps> = ({ k, value, depth, defaultOpen }) => {
  const isObj = value !== null && typeof value === 'object';
  const [open, setOpen] = useState(defaultOpen);

  const keyLabel =
    k !== undefined ? <span className="text-sky-300/90">{typeof k === 'number' ? k : k}</span> : null;

  if (!isObj) {
    return (
      <div className="flex items-baseline gap-1.5 leading-6" style={{ paddingLeft: depth * 14 }}>
        {keyLabel && <>{keyLabel}<span className="text-slate-600">:</span></>}
        <span className={valueColor(value)}>{renderPrimitive(value)}</span>
      </div>
    );
  }

  const entries: [string | number, unknown][] = Array.isArray(value)
    ? value.map((v, i) => [i, v])
    : Object.entries(value as Record<string, unknown>);
  const isArr = Array.isArray(value);
  const summary = isArr ? `[ ${entries.length} ]` : `{ ${entries.length} }`;

  return (
    <div className="leading-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 hover:bg-white/[0.04] rounded px-1 -ml-1 w-full text-left"
        style={{ paddingLeft: depth * 14 }}
      >
        <ChevronRight className={`w-3 h-3 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        {keyLabel && <>{keyLabel}<span className="text-slate-600">:</span></>}
        <span className="text-slate-500 text-xs">{summary}</span>
      </button>
      {open &&
        entries.map(([ck, cv]) => (
          <Node key={ck} k={ck} value={cv} depth={depth + 1} defaultOpen={depth + 1 < 1} />
        ))}
    </div>
  );
};

export const JsonTree: React.FC<{ data: unknown; rootOpen?: boolean }> = ({ data, rootOpen = true }) => (
  <div className="font-mono text-[12.5px]">
    <Node value={data} depth={0} defaultOpen={rootOpen} />
  </div>
);
