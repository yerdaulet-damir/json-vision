import React from 'react';
import {
  Heart, Repeat2, MessageCircle, Eye, BadgeCheck, Quote,
  User, Bot, Cog, Wrench,
  AlertOctagon, AlertTriangle, Info, Bug,
  GitBranch, Star, GitFork, ExternalLink,
} from 'lucide-react';
import type { Row } from '../data/types';
import { flatten, displayValue, getPath } from '../data/flatten';

// ── Pluggable card-renderer registry ──────────────────────────────────────
// Each renderer declares how to DETECT its data shape and how to RENDER a row.
// CardsView samples the dataset, picks the renderer matching the majority of
// rows, and lets the user override the choice. This is how JSON Vision adapts
// to tweets, chat/LLM logs, server logs, REST entities, or anything else.

export interface CardRenderer {
  id: string;
  label: string;
  /** Does this row look like this shape? */
  match: (row: Row) => boolean;
  Card: React.FC<{ row: Row; index: number }>;
}

// ── shared helpers ─────────────────────────────────────────────────────────
function fmt(n: unknown): string {
  const num = typeof n === 'number' ? n : Number(n);
  if (!isFinite(num)) return '0';
  if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(num) >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(num);
}

function firstString(row: Row, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = getPath(row, k);
    if (typeof v === 'string' && v) return v;
  }
  return undefined;
}

function asText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    // OpenAI/Anthropic content-parts: [{type:'text', text:'…'}, …]
    return v
      .map((p) => (typeof p === 'string' ? p : typeof p === 'object' && p ? String((p as any).text ?? (p as any).content ?? '') : ''))
      .filter(Boolean)
      .join('\n');
  }
  if (v && typeof v === 'object') return JSON.stringify(v);
  return v == null ? '' : String(v);
}

const Avatar: React.FC<{ label: string; className?: string }> = ({ label, className }) => (
  <div className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-white font-semibold shadow-lg ${className ?? 'bg-gradient-to-tr from-blue-500 to-indigo-500'}`}>
    {(label || '?').charAt(0).toUpperCase()}
  </div>
);

const Stat: React.FC<{ icon: React.ReactNode; value: unknown }> = ({ icon, value }) => (
  <span className="flex items-center gap-1.5 text-slate-400 text-xs">{icon}{fmt(value)}</span>
);

const shell = 'bg-white/[0.04] border border-white/10 rounded-2xl p-5 hover:bg-white/[0.06] hover:border-white/20 transition-colors';

// ── 1. Tweet / social ──────────────────────────────────────────────────────
const TweetCard: CardRenderer['Card'] = ({ row }) => {
  const t = (row.tweet_data ?? row) as Record<string, any>;
  const a = (row.author_data ?? row.author ?? row.user ?? {}) as Record<string, any>;
  const m = (t.public_metrics ?? row.public_metrics ?? {}) as Record<string, any>;
  const name = a.name ?? a.username ?? 'Unknown';
  return (
    <div className={shell}>
      <div className="flex items-start gap-3">
        <Avatar label={name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-white truncate">{name}</span>
            {a.verified && <BadgeCheck className="w-4 h-4 text-blue-400 shrink-0" />}
            {a.username && <span className="text-slate-500 text-sm truncate">@{a.username}</span>}
            {t.created_at && (
              <span className="text-slate-600 text-xs ml-auto shrink-0">
                {new Date(t.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {(t.text ?? row.text) && <p className="text-slate-100 text-[15px] leading-relaxed mt-2 whitespace-pre-wrap break-words">{t.text ?? row.text}</p>}
          <div className="flex items-center gap-5 mt-4 flex-wrap">
            <Stat icon={<MessageCircle className="w-3.5 h-3.5" />} value={m.reply_count} />
            <Stat icon={<Repeat2 className="w-3.5 h-3.5" />} value={m.retweet_count} />
            <Stat icon={<Heart className="w-3.5 h-3.5" />} value={m.like_count} />
            <Stat icon={<Quote className="w-3.5 h-3.5" />} value={m.quote_count} />
            <Stat icon={<Eye className="w-3.5 h-3.5" />} value={m.impression_count} />
            {a.public_metrics?.followers_count != null && (
              <span className="ml-auto text-[11px] text-slate-500">{fmt(a.public_metrics.followers_count)} followers</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 2. Chat / LLM messages ──────────────────────────────────────────────────
const roleStyle: Record<string, { icon: React.ReactNode; bubble: string; align: string; chip: string }> = {
  user:      { icon: <User className="w-3.5 h-3.5" />, bubble: 'bg-blue-500/15 border-blue-400/25', align: 'items-end', chip: 'text-blue-300' },
  human:     { icon: <User className="w-3.5 h-3.5" />, bubble: 'bg-blue-500/15 border-blue-400/25', align: 'items-end', chip: 'text-blue-300' },
  assistant: { icon: <Bot className="w-3.5 h-3.5" />, bubble: 'bg-white/[0.06] border-white/10', align: 'items-start', chip: 'text-indigo-300' },
  ai:        { icon: <Bot className="w-3.5 h-3.5" />, bubble: 'bg-white/[0.06] border-white/10', align: 'items-start', chip: 'text-indigo-300' },
  system:    { icon: <Cog className="w-3.5 h-3.5" />, bubble: 'bg-amber-500/10 border-amber-400/20', align: 'items-center', chip: 'text-amber-300' },
  tool:      { icon: <Wrench className="w-3.5 h-3.5" />, bubble: 'bg-emerald-500/10 border-emerald-400/20', align: 'items-start', chip: 'text-emerald-300' },
};

const Bubble: React.FC<{ role: string; content: unknown }> = ({ role, content }) => {
  const r = role.toLowerCase();
  const s = roleStyle[r] ?? { icon: <MessageCircle className="w-3.5 h-3.5" />, bubble: 'bg-white/[0.05] border-white/10', align: 'items-start', chip: 'text-slate-300' };
  return (
    <div className={`flex flex-col ${s.align}`}>
      <span className={`flex items-center gap-1 text-[10px] uppercase tracking-wider mb-1 ${s.chip}`}>{s.icon}{role}</span>
      <div className={`max-w-[88%] rounded-2xl border px-4 py-2.5 ${s.bubble}`}>
        <p className="text-slate-100 text-[14px] leading-relaxed whitespace-pre-wrap break-words">{asText(content)}</p>
      </div>
    </div>
  );
};

const ChatCard: CardRenderer['Card'] = ({ row, index }) => {
  const msgs = Array.isArray((row as any).messages) ? (row as any).messages : null;
  return (
    <div className={shell}>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Conversation #{index + 1}</div>
      <div className="flex flex-col gap-3">
        {msgs ? (
          msgs.map((mm: any, i: number) => (
            <Bubble key={i} role={String(mm.role ?? mm.from ?? mm.sender ?? 'message')} content={mm.content ?? mm.message ?? mm.text} />
          ))
        ) : (
          <Bubble role={String((row as any).role ?? (row as any).from ?? 'message')} content={(row as any).content ?? (row as any).message ?? (row as any).text} />
        )}
      </div>
    </div>
  );
};

// ── 3. Log line ─────────────────────────────────────────────────────────────
const levelStyle = (lvl: string): { icon: React.ReactNode; cls: string } => {
  const l = lvl.toLowerCase();
  if (/(error|err|fatal|crit|alert|emerg)/.test(l)) return { icon: <AlertOctagon className="w-3.5 h-3.5" />, cls: 'bg-red-500/15 text-red-300 border-red-400/30' };
  if (/(warn)/.test(l)) return { icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: 'bg-amber-500/15 text-amber-300 border-amber-400/30' };
  if (/(debug|trace)/.test(l)) return { icon: <Bug className="w-3.5 h-3.5" />, cls: 'bg-slate-500/15 text-slate-300 border-white/10' };
  return { icon: <Info className="w-3.5 h-3.5" />, cls: 'bg-blue-500/15 text-blue-300 border-blue-400/30' };
};

const LogCard: CardRenderer['Card'] = ({ row }) => {
  const level = firstString(row, ['level', 'severity', 'lvl', 'levelname', 'log.level']) ?? 'info';
  const msg = firstString(row, ['message', 'msg', 'log', 'event', 'text']) ?? '';
  const ts = firstString(row, ['timestamp', 'time', 'ts', '@timestamp', 'datetime', 'date']);
  const src = firstString(row, ['logger', 'service', 'source', 'name', 'component', 'module']);
  const s = levelStyle(level);
  const extras = Object.entries(flatten(row))
    .filter(([k]) => !/^(level|severity|lvl|levelname|message|msg|log|event|text|timestamp|time|ts|@timestamp|datetime|date|logger|service|source|name|component|module)$/i.test(k))
    .slice(0, 6);
  return (
    <div className={`${shell} font-mono`}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-wider ${s.cls}`}>{s.icon}{level}</span>
        {ts && <span className="text-slate-500 text-xs">{ts}</span>}
        {src && <span className="text-indigo-300/80 text-xs">{src}</span>}
      </div>
      {msg && <p className="text-slate-100 text-[13px] leading-relaxed mt-2 whitespace-pre-wrap break-words">{msg}</p>}
      {extras.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {extras.map(([k, v]) => (
            <span key={k} className="text-[11px]"><span className="text-slate-500">{k.split('.').pop()}=</span><span className="text-slate-300">{displayValue(v)}</span></span>
          ))}
        </div>
      )}
    </div>
  );
};

// ── 4. GitHub / REST entity ─────────────────────────────────────────────────
const EntityCard: CardRenderer['Card'] = ({ row }) => {
  const title = firstString(row, ['full_name', 'name', 'title', 'login', 'id']) ?? 'Entity';
  const desc = firstString(row, ['description', 'body', 'bio', 'summary']);
  const url = firstString(row, ['html_url', 'url', 'link', 'homepage']);
  const lang = firstString(row, ['language']);
  const stars = getPath(row, 'stargazers_count') ?? getPath(row, 'stars');
  const forks = getPath(row, 'forks_count') ?? getPath(row, 'forks');
  return (
    <div className={shell}>
      <div className="flex items-start gap-3">
        <Avatar label={title} className="bg-gradient-to-tr from-slate-600 to-slate-800 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white truncate">{title}</span>
            {url && <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
          </div>
          {desc && <p className="text-slate-300 text-sm mt-1.5 leading-relaxed line-clamp-3">{desc}</p>}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {lang && <span className="flex items-center gap-1 text-xs text-slate-400"><GitBranch className="w-3.5 h-3.5" />{lang}</span>}
            {stars != null && <Stat icon={<Star className="w-3.5 h-3.5" />} value={stars} />}
            {forks != null && <Stat icon={<GitFork className="w-3.5 h-3.5" />} value={forks} />}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 5. Generic key-value (always matches) ───────────────────────────────────
const GenericCard: CardRenderer['Card'] = ({ row, index }) => {
  const entries = Object.entries(flatten(row)).slice(0, 18);
  return (
    <div className={shell}>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Record #{index + 1}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {entries.map(([k, v]) => (
          <div key={k} className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 truncate">{k}</span>
            <span className="text-slate-200 text-sm truncate" title={displayValue(v)}>{displayValue(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── detectors + registry ────────────────────────────────────────────────────
const hasKey = (row: Row, k: string) => row != null && typeof row === 'object' && k in row;
const ROLE_RE = /^(user|assistant|system|tool|human|ai|bot)$/i;

export const cardRenderers: CardRenderer[] = [
  {
    id: 'tweet', label: 'Posts',
    match: (row) => hasKey(row, 'tweet_data') || (hasKey(row, 'text') && (hasKey(row, 'author_id') || hasKey(row, 'author_data') || hasKey(row, 'username'))),
    Card: TweetCard,
  },
  {
    id: 'chat', label: 'Chat',
    match: (row) =>
      (Array.isArray((row as any).messages) && (row as any).messages.some((m: any) => m && (m.role || m.content))) ||
      (typeof (row as any).role === 'string' && ROLE_RE.test((row as any).role) && ((row as any).content != null || (row as any).message != null || (row as any).text != null)),
    Card: ChatCard,
  },
  {
    id: 'log', label: 'Logs',
    match: (row) =>
      (hasKey(row, 'level') || hasKey(row, 'severity') || hasKey(row, 'lvl') || hasKey(row, 'levelname')) &&
      (hasKey(row, 'message') || hasKey(row, 'msg')),
    Card: LogCard,
  },
  {
    id: 'entity', label: 'Entities',
    match: (row) => hasKey(row, 'html_url') || (hasKey(row, 'full_name') && hasKey(row, 'stargazers_count')),
    Card: EntityCard,
  },
  { id: 'generic', label: 'Cards', match: () => true, Card: GenericCard },
];

export const rendererById = (id: string) => cardRenderers.find((r) => r.id === id) ?? cardRenderers[cardRenderers.length - 1];

/** Pick the renderer matching the majority of a sample (generic is the floor). */
export function pickRenderer(sample: Row[]): CardRenderer {
  if (!sample.length) return rendererById('generic');
  for (const r of cardRenderers) {
    if (r.id === 'generic') break;
    const hits = sample.reduce((n, row) => n + (r.match(row) ? 1 : 0), 0);
    if (hits / sample.length >= 0.5) return r;
  }
  return rendererById('generic');
}
