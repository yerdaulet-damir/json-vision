import React, { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { DataSource, Row } from '../data/types';
import { flatten } from '../data/flatten';

interface GraphViewProps {
  source: DataSource;
  totalRows: number;
}

const SAMPLE = 400;

interface FieldStat {
  path: string;
  depth: number;
  type: string;
  fill: number; // 0..1 over sample
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

export const GraphView: React.FC<GraphViewProps> = ({ source, totalRows }) => {
  const [sample, setSample] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    source.getRows(0, SAMPLE).then(({ rows }) => {
      if (alive) setSample(rows);
    });
    return () => {
      alive = false;
    };
  }, [source]);

  const { nodes, edges } = useMemo(() => {
    if (!sample || sample.length === 0) return { nodes: [], edges: [] };

    const counts = new Map<string, { count: number; types: Set<string> }>();
    for (const row of sample) {
      const flat = flatten(row);
      for (const [path, val] of Object.entries(flat)) {
        const entry = counts.get(path) ?? { count: 0, types: new Set<string>() };
        entry.count++;
        entry.types.add(typeOf(val));
        counts.set(path, entry);
      }
    }

    const fields: FieldStat[] = Array.from(counts.entries())
      .map(([path, e]) => ({
        path,
        depth: path.split('.').length,
        type: Array.from(e.types).join(' | '),
        fill: e.count / sample.length,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));

    const perDepthY = new Map<number, number>();
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Root
    nodes.push({
      id: '__root',
      position: { x: 0, y: 0 },
      data: { label: `Dataset\n${totalRows.toLocaleString()} records` },
      style: rootStyle,
    });

    for (const f of fields) {
      const y = perDepthY.get(f.depth) ?? 0;
      perDepthY.set(f.depth, y + 64);
      const leaf = f.path.split('.').pop()!;
      nodes.push({
        id: f.path,
        position: { x: f.depth * 300, y },
        data: {
          label: `${leaf}\n${f.type}  ·  ${Math.round(f.fill * 100)}%`,
        },
        style: fieldStyle(f.fill),
      });
      const parent = f.path.includes('.') ? f.path.split('.').slice(0, -1).join('.') : '__root';
      edges.push({
        id: `${parent}->${f.path}`,
        source: parent,
        target: f.path,
        style: { stroke: 'rgba(59,130,246,0.35)', strokeWidth: 1.5 },
      });
    }

    return { nodes, edges };
  }, [sample, totalRows]);

  if (!sample) {
    return <div className="w-full h-full flex items-center justify-center text-slate-500">Analyzing structure…</div>;
  }

  return (
    <div className="w-full h-full">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-xs text-slate-500 bg-black/40 px-4 py-1.5 rounded-full border border-white/10">
        Schema inferred from first {Math.min(SAMPLE, sample.length)} records
      </div>
      <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.1} proOptions={{ hideAttribution: true }}>
        <Background color="rgba(255,255,255,0.08)" gap={28} />
        <Controls className="!bg-black/40 !border-white/10" />
      </ReactFlow>
    </div>
  );
};

const rootStyle = {
  background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
  color: '#fff',
  border: 'none',
  borderRadius: 16,
  padding: 14,
  width: 200,
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: 'pre-line' as const,
  textAlign: 'center' as const,
};

function fieldStyle(fill: number) {
  return {
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(12px)',
    color: '#e2e8f0',
    border: `1px solid rgba(59,130,246,${0.2 + fill * 0.5})`,
    borderRadius: 12,
    padding: 10,
    width: 220,
    fontSize: 11,
    fontFamily: 'ui-monospace, monospace',
    whiteSpace: 'pre-line' as const,
  };
}
