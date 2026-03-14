import { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Copy, Check, ClipboardList, Layers, BookOpen, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import type { HandoffResults, HandoffPillar, HandoffItem } from '../services/handoffEngine';

// ─── Pillar icon map ───────────────────────────────────────────────────────

const PILLAR_ICONS = {
  states: Layers,
  rules:  BookOpen,
  scope:  ClipboardList,
  a11y:   Shield,
};

const PILLAR_COLORS = {
  states: { bg: 'bg-violet-50',  border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700', ring: 'ring-violet-400' },
  rules:  { bg: 'bg-amber-50',   border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700',   ring: 'ring-amber-400'  },
  scope:  { bg: 'bg-sky-50',     border: 'border-sky-200',    badge: 'bg-sky-100 text-sky-700',       ring: 'ring-sky-400'    },
  a11y:   { bg: 'bg-emerald-50', border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-700',ring: 'ring-emerald-400'},
};

// ─── Score Ring ───────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle stroke="#F4F4F5" strokeWidth="8" fill="transparent" r={r} cx="50" cy="50" />
        <circle
          stroke={color}
          strokeWidth="8"
          fill="transparent"
          r={r}
          cx="50"
          cy="50"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-[#18181B]">{score}</span>
        <span className="text-[9px] font-bold text-[#A1A1AA] uppercase tracking-wider">score</span>
      </div>
    </div>
  );
}

// ─── Pillar Card ──────────────────────────────────────────────────────────

function PillarCard({ pillar }: { pillar: HandoffPillar }) {
  const [expanded, setExpanded] = useState(true);
  const colors = PILLAR_COLORS[pillar.id];
  const Icon = PILLAR_ICONS[pillar.id];
  const foundCount = pillar.items.filter(i => i.found).length;

  return (
    <div className={cn('rounded-2xl border overflow-hidden', colors.border)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className={cn(
          'w-full flex items-center justify-between gap-3 p-4 text-left transition-colors',
          colors.bg
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('p-1.5 rounded-lg', colors.badge)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-[#18181B] leading-tight">{pillar.title}</h4>
            <p className="text-[10px] text-[#71717A] truncate">{pillar.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', colors.badge)}>
            {foundCount}/{pillar.items.length}
          </span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[#A1A1AA]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#A1A1AA]" />}
        </div>
      </button>

      {/* Items */}
      {expanded && (
        <div className="bg-white divide-y divide-[#F4F4F5]">
          {pillar.items.map(item => (
            <HandoffItemRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Item Row ──────────────────────────────────────────────────────────────

function HandoffItemRow({ item }: { item: HandoffItem }) {
  return (
    <div className={cn('flex items-start gap-3 px-4 py-3', !item.found && 'bg-[#FAFAFA]')}>
      <div className="flex-shrink-0 mt-0.5">
        {item.found ? (
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
        ) : item.required ? (
          <XCircle className="w-4 h-4 text-[#EF4444]" />
        ) : (
          <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-xs font-semibold',
            item.found ? 'text-[#18181B]' : 'text-[#71717A]'
          )}>
            {item.label}
          </span>
          {item.required && !item.found && (
            <span className="text-[9px] font-bold bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Obrigatório
            </span>
          )}
        </div>
        {item.found && item.foundIn && (
          <p className="text-[10px] text-[#10B981] font-medium mt-0.5 truncate">
            Detectado em: <span className="font-bold">"{item.foundIn}"</span>
          </p>
        )}
        {!item.found && (
          <p className="text-[10px] text-[#A1A1AA] mt-0.5 leading-relaxed">{item.tip}</p>
        )}
      </div>
    </div>
  );
}

// ─── Generated Doc Viewer ─────────────────────────────────────────────────

function GeneratedDocSection({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-[#E4E4E7] overflow-hidden bg-white">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-[#18181B] text-left"
      >
        <div className="flex items-center gap-3">
          <ClipboardList className="w-4 h-4 text-[#A1A1AA]" />
          <div>
            <h4 className="text-sm font-bold text-white">Documento de Handoff Gerado</h4>
            <p className="text-[10px] text-[#71717A]">Markdown pronto para colar no Notion, Confluence ou enviar ao dev</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {expanded && (
            <button
              onClick={e => { e.stopPropagation(); handleCopy(); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all',
                copied
                  ? 'bg-[#10B981] text-white'
                  : 'bg-white/10 text-white hover:bg-white/20'
              )}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-[#71717A]" />
            : <ChevronDown className="w-4 h-4 text-[#71717A]" />
          }
        </div>
      </button>

      {expanded && (
        <pre className="p-5 text-[11px] text-[#3F3F46] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap bg-[#FAFAFA] max-h-[400px] overflow-y-auto">
          {markdown}
        </pre>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

interface HandoffPanelProps {
  results: HandoffResults;
  frameName: string | undefined;
  fileName: string | undefined;
  annotations?: string | null;
}

export function HandoffPanel({ results, frameName, fileName, annotations }: HandoffPanelProps) {
  const scoreColor = results.overall >= 80 ? 'text-[#10B981]' : results.overall >= 50 ? 'text-[#F59E0B]' : 'text-[#EF4444]';
  const scoreBg    = results.overall >= 80 ? 'bg-emerald-50 border-emerald-200' : results.overall >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const scoreLabel = results.overall >= 80 ? 'Pronto para Handoff' : results.overall >= 50 ? 'Quase lá' : 'Precisa de Atenção';

  const totalItems    = results.pillars.flatMap(p => p.items).length;
  const foundItems    = results.pillars.flatMap(p => p.items).filter(i => i.found).length;
  const missingRequired = results.pillars.flatMap(p => p.items).filter(i => i.required && !i.found).length;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">

      {/* Header Summary */}
      <div className={cn('rounded-2xl border p-6 flex items-center gap-6', scoreBg)}>
        <ScoreRing score={results.overall} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-xl font-bold text-[#18181B]">Handoff Check</h2>
            <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', scoreBg, scoreColor)}>
              {scoreLabel}
            </span>
          </div>
          <p className="text-sm text-[#71717A] mb-3 truncate">
            Frame: <span className="font-semibold text-[#3F3F46]">{frameName || 'Sem nome'}</span>
            {fileName && <> · <span className="text-[#A1A1AA]">{fileName}</span></>}
          </p>
          <div className="flex gap-6 flex-wrap">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#18181B]">{foundItems}<span className="text-sm text-[#A1A1AA] font-normal">/{totalItems}</span></div>
              <div className="text-[10px] text-[#A1A1AA] uppercase font-bold tracking-widest">Itens OK</div>
            </div>
            <div className="text-center">
              <div className={cn('text-2xl font-bold', missingRequired > 0 ? 'text-[#EF4444]' : 'text-[#10B981]')}>
                {missingRequired}
              </div>
              <div className="text-[10px] text-[#A1A1AA] uppercase font-bold tracking-widest">Obrigatórios Faltando</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#18181B]">{results.pillars.length}</div>
              <div className="text-[10px] text-[#A1A1AA] uppercase font-bold tracking-widest">Pilares</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pillars Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {results.pillars.map(pillar => (
          <PillarCard key={pillar.id} pillar={pillar} />
        ))}
      </div>

      {/* Dev Mode Annotations */}
      {annotations && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h4 className="text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-3">
            Anotações do Dev Mode (Figma)
          </h4>
          <pre className="text-[11px] text-amber-800 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
            {annotations}
          </pre>
        </div>
      )}

      {/* Generated Doc */}
      <GeneratedDocSection markdown={results.generatedDoc} />

    </div>
  );
}
