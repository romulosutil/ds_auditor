import { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp, Layers, Sparkles, Shield, FileText, Grid3x3 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ComponentTestResults, ComponentTestCategory, ComponentState, TypeStateCoverage } from '../services/componentTestEngine';

// ─── Score Ring ───────────────────────────────────────────────────────────

function ScoreRing({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const r    = size === 'sm' ? 22 : 36;
  const sw   = size === 'sm' ? 6  : 8;
  const vb   = size === 'sm' ? 60 : 100;
  const cx   = vb / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ * (1 - score / 100);
  const col  = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div className={cn('relative flex-shrink-0', size === 'sm' ? 'w-14 h-14' : 'w-24 h-24')}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${vb} ${vb}`}>
        <circle stroke="#F4F4F5" strokeWidth={sw} fill="transparent" r={r} cx={cx} cy={cx} />
        <circle stroke={col} strokeWidth={sw} fill="transparent" r={r} cx={cx} cy={cx}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-bold text-[#18181B]', size === 'sm' ? 'text-sm' : 'text-xl')}>{score}</span>
        {size === 'md' && <span className="text-[9px] font-bold text-[#A1A1AA] uppercase tracking-wider">score</span>}
      </div>
    </div>
  );
}

// ─── Coverage Matrix (per type × state) ───────────────────────────────────

function CoverageMatrix({ results }: { results: ComponentTestResults }) {
  const { typeStateCoverage, stateProperty, typeProperty, states } = results;
  const [expanded, setExpanded] = useState(true);

  // Collect all state names for columns
  const allStateNames = states.map(s => s.name);

  if (typeStateCoverage.length === 0 && states.length === 0) return null;

  const hasMatrix = typeStateCoverage.length > 0 && allStateNames.length > 0;

  return (
    <div className="rounded-2xl border border-[#E4E4E7] overflow-hidden bg-white">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-[#18181B] text-left"
      >
        <div className="flex items-center gap-3">
          <Grid3x3 className="w-4 h-4 text-[#A1A1AA]" />
          <div>
            <h4 className="text-sm font-bold text-white">
              Matriz de Cobertura
              {typeProperty && stateProperty && (
                <span className="ml-2 text-[10px] font-normal text-[#71717A]">
                  {typeProperty} × {stateProperty}
                </span>
              )}
            </h4>
            <p className="text-[10px] text-[#71717A]">
              {hasMatrix
                ? `${typeStateCoverage.length} variante(s) de tipo · ${allStateNames.length} estado(s) esperado(s)`
                : 'Visão global dos estados documentados'
              }
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#71717A]" /> : <ChevronDown className="w-4 h-4 text-[#71717A]" />}
      </button>

      {expanded && (
        <div className="p-5 space-y-4">
          {hasMatrix ? (
            /* Matrix table */
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider pb-3 pr-4 min-w-[90px]">
                      {typeProperty}
                    </th>
                    {allStateNames.map(s => (
                      <th key={s} className="text-center text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider pb-3 px-2 min-w-[64px]">
                        {s}
                      </th>
                    ))}
                    <th className="text-right text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider pb-3 pl-4">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F4F5]">
                  {typeStateCoverage.map(row => {
                    const presentCount  = allStateNames.filter(s => !row.missingStates.includes(s)).length;
                    const totalRequired = states.filter(s => s.required).length;
                    const rowScore      = totalRequired > 0
                      ? Math.round((totalRequired - row.missingStates.filter(ms => states.find(s => s.name === ms)?.required).length) / totalRequired * 100)
                      : 100;
                    const scoreColor = rowScore === 100 ? 'text-[#10B981]' : rowScore >= 60 ? 'text-[#F59E0B]' : 'text-[#EF4444]';

                    return (
                      <tr key={row.typeValue} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="py-3 pr-4">
                          <span className="font-bold text-[#18181B] text-xs">{row.typeValue}</span>
                        </td>
                        {allStateNames.map(stateName => {
                          const isMissing  = row.missingStates.includes(stateName);
                          const isRequired = states.find(s => s.name === stateName)?.required ?? true;
                          const foundAs    = row.presentStates.find(ps => {
                            const lower = ps.toLowerCase();
                            return lower === stateName.toLowerCase() || lower.includes(stateName.toLowerCase());
                          });
                          return (
                            <td key={stateName} className="py-3 px-2 text-center">
                              {!isMissing ? (
                                <span title={foundAs ?? stateName} className="inline-flex items-center justify-center">
                                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                                </span>
                              ) : isRequired ? (
                                <span title={`Faltando: ${stateName}`} className="inline-flex items-center justify-center">
                                  <XCircle className="w-4 h-4 text-[#EF4444]" />
                                </span>
                              ) : (
                                <span title={`Opcional: ${stateName}`} className="inline-flex items-center justify-center">
                                  <AlertCircle className="w-4 h-4 text-[#D4D4D8]" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3 pl-4 text-right">
                          <span className={cn('font-bold text-sm', scoreColor)}>{rowScore}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Legend */}
              <div className="flex gap-4 mt-3 pt-3 border-t border-[#F4F4F5]">
                <div className="flex items-center gap-1.5 text-[10px] text-[#71717A]">
                  <CheckCircle2 className="w-3 h-3 text-[#10B981]" /> Presente
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[#71717A]">
                  <XCircle className="w-3 h-3 text-[#EF4444]" /> Faltando (obrigatório)
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[#71717A]">
                  <AlertCircle className="w-3 h-3 text-[#D4D4D8]" /> Faltando (opcional)
                </div>
              </div>
            </div>
          ) : (
            /* Fallback: global state list */
            <GlobalStateList states={states} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Global State List (fallback when no matrix) ──────────────────────────

function GlobalStateList({ states }: { states: ComponentState[] }) {
  return (
    <div className="divide-y divide-[#F4F4F5]">
      {states.map(s => (
        <div key={s.name} className={cn('flex items-start gap-3 py-3', s.status !== 'present' && s.required ? 'bg-red-50/40' : '')}>
          <div className="flex-shrink-0 mt-0.5">
            {s.status === 'present'
              ? <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              : s.required
                ? <XCircle className="w-4 h-4 text-[#EF4444]" />
                : <AlertCircle className="w-4 h-4 text-[#F59E0B]" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-xs font-semibold', s.status === 'present' ? 'text-[#18181B]' : 'text-[#71717A]')}>
                {s.name}
              </span>
              {s.required && s.status !== 'present' && (
                <span className="text-[9px] font-bold bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded-full uppercase">
                  Obrigatório
                </span>
              )}
            </div>
            {s.status === 'present' && s.foundAs && (
              <p className="text-[10px] text-[#10B981] font-medium mt-0.5">"{s.foundAs}"</p>
            )}
            {s.status !== 'present' && (
              <p className="text-[10px] text-[#A1A1AA] mt-0.5 leading-relaxed">{s.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────

const CATEGORY_ICONS = {
  tokens:  Sparkles,
  a11y:    Shield,
  naming:  FileText,
  states:  Layers,
};

function CategoryCard({ cat }: { cat: ComponentTestCategory }) {
  const [expanded, setExpanded] = useState(true);
  const Icon = CATEGORY_ICONS[cat.id as keyof typeof CATEGORY_ICONS] || Layers;
  const passCount  = cat.items.filter(i => i.status === 'pass').length;
  const scoreColor = cat.score >= 80 ? 'text-[#10B981]' : cat.score >= 50 ? 'text-[#F59E0B]' : 'text-[#EF4444]';
  const scoreBg    = cat.score >= 80 ? 'bg-emerald-50 border-emerald-200' : cat.score >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className="rounded-2xl border border-[#E4E4E7] overflow-hidden bg-white">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-3 p-4 bg-[#FAFAFA] text-left hover:bg-[#F4F4F5] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-[#18181B] p-1.5 rounded-lg flex-shrink-0">
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <h4 className="text-sm font-bold text-[#18181B]">{cat.title}</h4>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', scoreBg, scoreColor)}>
            {passCount}/{cat.items.length}
          </span>
          <ScoreRing score={cat.score} size="sm" />
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[#A1A1AA]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#A1A1AA]" />}
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-[#F4F4F5]">
          {cat.items.map(item => (
            <div key={item.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-shrink-0 mt-0.5">
                {item.status === 'pass'
                  ? <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  : item.status === 'warning'
                    ? <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
                    : <XCircle className="w-4 h-4 text-[#EF4444]" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold', item.status === 'pass' ? 'text-[#18181B]' : 'text-[#71717A]')}>
                  {item.label}
                </p>
                {item.detail && <p className="text-[10px] text-[#A1A1AA] mt-0.5">{item.detail}</p>}
                {item.status !== 'pass' && item.tip && (
                  <p className="text-[10px] text-[#6366F1] mt-0.5 font-medium">💡 {item.tip}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

interface ComponentTestPanelProps {
  results: ComponentTestResults;
}

export function ComponentTestPanel({ results }: ComponentTestPanelProps) {
  const missingRequired = results.states.filter(s => s.required && s.status === 'missing').length;
  const scoreColor = results.overallScore >= 80 ? 'text-[#10B981]' : results.overallScore >= 50 ? 'text-[#F59E0B]' : 'text-[#EF4444]';
  const scoreBg    = results.overallScore >= 80 ? 'bg-emerald-50 border-emerald-200' : results.overallScore >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const scoreLabel = results.overallScore >= 80 ? 'Componente Robusto' : results.overallScore >= 50 ? 'Em Desenvolvimento' : 'Precisa de Atenção';
  const isGeneric  = results.componentType === 'Generic';

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className={cn('rounded-2xl border p-6 flex items-center gap-6', scoreBg)}>
        <ScoreRing score={results.overallScore} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-xl font-bold text-[#18181B]">Teste de Componente</h2>
            <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', scoreBg, scoreColor)}>
              {scoreLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-sm font-medium text-[#3F3F46] truncate max-w-[220px]">
              {results.componentName}
            </span>
            <span className="text-[11px] font-bold bg-[#18181B] text-white px-2 py-0.5 rounded-full">
              {results.componentType}
            </span>
            {isGeneric && (
              <span className="text-[10px] text-[#F59E0B] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                Tipo não reconhecido — adicione "Button", "Input" etc. ao nome
              </span>
            )}
          </div>
          <div className="flex gap-6 flex-wrap">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#18181B]">{results.statesCoverage}<span className="text-sm font-normal text-[#A1A1AA]">%</span></div>
              <div className="text-[10px] text-[#A1A1AA] uppercase font-bold tracking-widest">Estados</div>
            </div>
            <div className="text-center">
              <div className={cn('text-2xl font-bold', missingRequired > 0 ? 'text-[#EF4444]' : 'text-[#10B981]')}>
                {missingRequired}
              </div>
              <div className="text-[10px] text-[#A1A1AA] uppercase font-bold tracking-widest">Faltando</div>
            </div>
            {results.typeStateCoverage.length > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-[#18181B]">{results.typeStateCoverage.length}</div>
                <div className="text-[10px] text-[#A1A1AA] uppercase font-bold tracking-widest">Variações</div>
              </div>
            )}
            {results.variantProperties.length > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-[#18181B]">{results.variantProperties.length}</div>
                <div className="text-[10px] text-[#A1A1AA] uppercase font-bold tracking-widest">Propriedades</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detected variant properties */}
      {results.variantProperties.length > 0 && (
        <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5">
          <h4 className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-widest mb-4">
            Propriedades Detectadas ({results.variantProperties.length})
          </h4>
          <div className="space-y-3">
            {results.variantProperties.map(prop => (
              <div key={prop.name} className="flex items-start gap-3">
                <span className={cn(
                  'text-[10px] font-bold px-2 py-1 rounded-lg border flex-shrink-0 min-w-[60px] text-center',
                  prop.name === results.typeProperty
                    ? 'bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20'
                    : prop.name === results.stateProperty
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-[#F4F4F5] text-[#71717A] border-[#E4E4E7]'
                )}>
                  {prop.name}
                  {prop.name === results.typeProperty && <span className="block text-[8px] opacity-60">tipo</span>}
                  {prop.name === results.stateProperty && <span className="block text-[8px] opacity-60">estado</span>}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {prop.values.map(v => (
                    <span key={v} className="text-[10px] bg-[#F4F4F5] text-[#3F3F46] px-2 py-0.5 rounded-lg border border-[#E4E4E7] font-medium">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coverage Matrix */}
      <CoverageMatrix results={results} />

      {/* Category cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {results.categories.map(cat => (
          <CategoryCard key={cat.id} cat={cat} />
        ))}
      </div>

    </div>
  );
}
