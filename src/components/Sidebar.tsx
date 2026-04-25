import { useState, useEffect } from 'react';
import { Layers, Palette, Baseline, ScanLine, Maximize, FileText, CheckCircle2, Search, AlertCircle, Zap, Accessibility, Sparkles, Plus, X, FlaskConical, Map, BarChart3 } from 'lucide-react';
import { cn } from '../lib/utils';
import { checkProxyHealth } from '../services/figmaService';

export type SidebarMode = 'journey' | 'component' | 'dashboard';

interface SidebarProps {
  onStartAudit: (urls: string[], activeCategories: Set<string>) => void;
  onStartComponentTest: (url: string) => void;
  isAuditing: boolean;
  mode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
}

const CATEGORIES = [
  { id: 'colors',     label: 'Cores',                     icon: Palette       },
  { id: 'typography', label: 'Tipografia',                icon: Baseline      },
  { id: 'spacing',    label: 'Espaçamento',               icon: Maximize      },
  { id: 'components', label: 'Componentes',               icon: Layers        },
  { id: 'radii',      label: 'Raios',                     icon: ScanLine      },
  { id: 'naming',     label: 'Nomenclatura',              icon: FileText      },
  { id: 'a11y',       label: 'Acessibilidade',            icon: Accessibility },
  { id: 'heuristics', label: 'Heurísticas',               icon: Zap           },
  { id: 'styles',     label: 'Estilos (Shadows/Borders)', icon: Sparkles      },
];

export function Sidebar({ onStartAudit, onStartComponentTest, isAuditing, mode, onModeChange }: SidebarProps) {
  // Journey mode state
  const [frames, setFrames] = useState<string[]>(['']);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.id)));

  // Component mode state
  const [componentUrl, setComponentUrl] = useState('');

  // MCP status
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { connected } = await checkProxyHealth();
      setIsConnected(connected);
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Journey helpers ──────────────────────────────────────────────────
  const addFrame = () => setFrames(f => [...f, '']);
  const removeFrame = (i: number) => setFrames(f => f.filter((_, idx) => idx !== i));
  const updateFrame = (i: number, val: string) => setFrames(f => { const n = [...f]; n[i] = val; return n; });

  const toggleCategory = (id: string) => {
    const next = new Set(activeCategories);
    if (next.has(id)) next.delete(id); else next.add(id);
    setActiveCategories(next);
  };

  const handleAudit = () => {
    const validUrls = frames.filter(u => u.trim());
    if (validUrls.length > 0) onStartAudit(validUrls, activeCategories);
  };

  const handleComponentTest = () => {
    if (componentUrl.trim()) onStartComponentTest(componentUrl.trim());
  };

  const readyFrames = frames.filter(u => u.trim()).length;

  return (
    <aside className="no-print w-80 shrink-0 border-r border-[#E4E4E7] bg-white flex flex-col h-full">

      {/* Header */}
      <div className="p-6 border-b border-[#E4E4E7]">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#18181B] p-2 rounded-lg">
            <ScanLine className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[#18181B]">DS Auditor</h1>
          <span className="text-[10px] font-bold bg-[#F4F4F5] text-[#71717A] px-1.5 py-0.5 rounded border border-[#E4E4E7]">v4.0</span>
        </div>

        <div className={cn(
          'flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-full w-fit transition-colors uppercase tracking-wider mb-4',
          isConnected
            ? 'text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0]'
            : 'text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA]'
        )}>
          {isConnected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {isConnected ? 'MCP Conectado' : 'MCP Desconectado'}
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-[#F4F4F5] rounded-xl p-1 gap-1">
          <button
            onClick={() => onModeChange('journey')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-all',
              mode === 'journey'
                ? 'bg-white text-[#18181B] shadow-sm'
                : 'text-[#71717A] hover:text-[#3F3F46]'
            )}
          >
            <Map className="w-3.5 h-3.5" />
            Jornada
          </button>
          <button
            onClick={() => onModeChange('component')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-all',
              mode === 'component'
                ? 'bg-white text-[#18181B] shadow-sm'
                : 'text-[#71717A] hover:text-[#3F3F46]'
            )}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Comp
          </button>
          <button
            onClick={() => onModeChange('dashboard')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-all',
              mode === 'dashboard'
                ? 'bg-white text-[#18181B] shadow-sm'
                : 'text-[#71717A] hover:text-[#3F3F46]'
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Saúde
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* ── DASHBOARD MODE ── */}
        {mode === 'dashboard' && (
          <div className="space-y-4">
             <div className="bg-[#6366F1]/10 border border-[#6366F1]/20 rounded-2xl p-4">
                <p className="text-[11px] text-[#6366F1] font-bold uppercase tracking-wider mb-1">Métricas de Evolução</p>
                <p className="text-xs text-[#4F46E5] leading-relaxed">
                  Acompanhe a saúde do seu Design System através de dados históricos consolidados.
                </p>
             </div>
          </div>
        )}

        {/* ── JOURNEY MODE ── */}
        {mode === 'journey' && (
          <>
            {/* Frames da Jornada */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-widest">
                  Frames da Jornada
                </label>
                <span className="text-[10px] font-bold text-[#6366F1] bg-[#6366F1]/10 px-2 py-0.5 rounded-full">
                  {readyFrames} frame{readyFrames !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2">
                {frames.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={url}
                        onChange={e => updateFrame(i, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            if (i === frames.length - 1) addFrame();
                            else handleAudit();
                          }
                        }}
                        placeholder={i === 0 ? 'Frame inicial da jornada...' : `Frame ${i + 1}...`}
                        className="w-full pl-8 pr-3 py-2.5 bg-[#F4F4F5] border border-[#E4E4E7] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all placeholder:text-[#A1A1AA]"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#A1A1AA]">
                        {i + 1}
                      </span>
                    </div>
                    {frames.length > 1 && (
                      <button
                        onClick={() => removeFrame(i)}
                        className="flex-shrink-0 p-1.5 text-[#A1A1AA] hover:text-[#EF4444] hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addFrame}
                className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-[#E4E4E7] rounded-xl text-xs font-semibold text-[#A1A1AA] hover:border-[#6366F1] hover:text-[#6366F1] hover:bg-[#6366F1]/5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar frame
              </button>
            </div>

            {/* Filtros de Auditoria */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-widest">Filtros de Auditoria</h3>
                <span className="text-[10px] font-bold text-[#6366F1] bg-[#6366F1]/10 px-2 py-0.5 rounded-full">
                  {activeCategories.size}/{CATEGORIES.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(({ id, label, icon: Icon }) => {
                  const isActive = activeCategories.has(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleCategory(id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border shadow-sm',
                        isActive
                          ? 'bg-[#18181B] text-white border-[#18181B] scale-105'
                          : 'bg-white text-[#71717A] border-[#E4E4E7] hover:border-[#D4D4D8] hover:bg-[#F4F4F5]'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── COMPONENT MODE ── */}
        {mode === 'component' && (
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="block text-[11px] font-bold text-[#A1A1AA] uppercase tracking-widest">
                URL do Componente
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={componentUrl}
                  onChange={e => setComponentUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleComponentTest()}
                  placeholder="Cole o link do componente..."
                  className="w-full pl-10 pr-4 py-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all placeholder:text-[#A1A1AA]"
                />
                <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>
        )}

        {/* DS Context (shared) */}
        <div className="space-y-4">
          <h3 className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-widest">Contexto do Design System</h3>
          <div className="bg-[#18181B] p-5 rounded-2xl space-y-4 border border-[#27272A] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <ScanLine className="w-16 h-16 text-white" />
            </div>
            <div className="flex justify-between items-center relative z-10">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-tight">DS4FUN Library</span>
                <span className="text-[10px] text-[#A1A1AA] font-mono">v1.4.0 (Stable)</span>
              </div>
              <div className="w-3 h-3 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
            </div>
          </div>
        </div>

      </div>

      {/* Footer Action */}
      <div className="p-6 border-t border-[#E4E4E7] bg-white">
        {mode === 'journey' && (
          <button
            onClick={handleAudit}
            disabled={isAuditing || readyFrames === 0}
            className={cn(
              'w-full py-4 px-4 rounded-2xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg',
              isAuditing || readyFrames === 0
                ? 'bg-[#A1A1AA] cursor-not-allowed'
                : 'bg-[#6366F1] hover:bg-[#4F46E5] active:scale-95'
            )}
          >
            <Zap className="w-4 h-4 fill-current" />
            {isAuditing ? 'Analisando...' : 'Analisar Jornada'}
          </button>
        )}
        {mode === 'component' && (
          <button
            onClick={handleComponentTest}
            disabled={isAuditing || !componentUrl.trim()}
            className={cn(
              'w-full py-4 px-4 rounded-2xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg',
              isAuditing || !componentUrl.trim()
                ? 'bg-[#A1A1AA] cursor-not-allowed'
                : 'bg-[#10B981] hover:bg-[#059669] active:scale-95'
            )}
          >
            <FlaskConical className="w-4 h-4" />
            {isAuditing ? 'Testando...' : 'Testar Componente'}
          </button>
        )}
        {mode === 'dashboard' && (
           <div className="text-center">
              <p className="text-[10px] text-[#A1A1AA] font-bold uppercase">Visão Analítica Ativa</p>
           </div>
        )}
      </div>
    </aside>
  );
}
