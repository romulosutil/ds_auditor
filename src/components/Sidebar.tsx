import { useState, useEffect } from 'react';
import { Layers, Palette, Baseline, ScanLine, Maximize, FileText, CheckCircle2, Search, AlertCircle, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { checkProxyHealth } from '../services/figmaService';

interface SidebarProps {
  onStartAudit: (url: string, activeCategories: Set<string>) => void;
  isAuditing: boolean;
  url: string;
  setUrl: (url: string) => void;
}

const CATEGORIES = [
  { id: 'colors', label: 'Cores', icon: Palette },
  { id: 'typography', label: 'Tipografia', icon: Baseline },
  { id: 'spacing', label: 'Espaçamento', icon: Maximize },
  { id: 'components', label: 'Componentes', icon: Layers },
  { id: 'radii', label: 'Raios', icon: ScanLine },
  { id: 'naming', label: 'Naming', icon: FileText },
];

export function Sidebar({ onStartAudit, isAuditing, url, setUrl }: SidebarProps) {
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.id)));
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

  const toggleCategory = (id: string) => {
    const next = new Set(activeCategories);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setActiveCategories(next);
  };

  const handleAudit = () => {
    if (url.trim()) {
        onStartAudit(url, activeCategories);
    }
  };

  return (
    <aside className="no-print w-80 shrink-0 border-r border-[#E4E4E7] bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-[#E4E4E7]">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-[#18181B] p-2 rounded-lg">
            <ScanLine className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[#18181B]">DS Auditor</h1>
          <span className="text-[10px] font-bold bg-[#F4F4F5] text-[#71717A] px-1.5 py-0.5 rounded border border-[#E4E4E7]">v3.0</span>
        </div>
        
        <div className={cn(
          "flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-full w-fit transition-colors uppercase tracking-wider",
          isConnected 
            ? "text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0]" 
            : "text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA]"
        )}>
          {isConnected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {isConnected ? "MCP Conectado" : "MCP Desconectado"}
        </div>
      </div>

      {/* Main Content Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* URL Input */}
        <div className="space-y-3">
          <label htmlFor="figma-url" className="block text-[11px] font-bold text-[#A1A1AA] uppercase tracking-widest">
            Figma URL ou Node ID
          </label>
          <div className="relative">
            <input
              id="figma-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAudit()}
              placeholder="Cole o link do frame..."
              className="w-full pl-10 pr-4 py-3 bg-[#F4F4F5] border border-[#E4E4E7] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all placeholder:text-[#A1A1AA]"
            />
            <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
          </div>
          
          {url && !isAuditing && (
             <div className="text-[10px] text-[#71717A] flex items-center gap-1.5 px-1 font-medium bg-[#FAFAFA] p-2 rounded-lg border border-[#F4F4F5]">
                <Zap className="w-3 h-3 text-[#EAB308]" />
                <span>Pronto para análise v3.0</span>
             </div>
          )}
        </div>

        {/* Categories */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-widest">Filtros de Auditoria</h3>
            <span className="text-[10px] font-bold text-[#6366F1] bg-[#6366F1]/10 px-2 py-0.5 rounded-full">{activeCategories.size}/{CATEGORIES.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(({ id, label, icon: Icon }) => {
              const isActive = activeCategories.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleCategory(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border shadow-sm",
                    isActive 
                      ? "bg-[#18181B] text-white border-[#18181B] scale-105" 
                      : "bg-white text-[#71717A] border-[#E4E4E7] hover:border-[#D4D4D8] hover:bg-[#F4F4F5]"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* DS Context Info */}
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
                 <div className="w-3 h-3 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" title="Library Active" />
              </div>

              <div className="space-y-2 relative z-10">
                 <div className="flex items-center justify-between text-[10px] font-bold text-[#71717A] uppercase tracking-tighter">
                    <span>Tokens Status</span>
                    <span>Load Success</span>
                 </div>
                 <div className="flex flex-wrap gap-1.5">
                    {['Cores', 'Tipografia', 'Espaçamento'].map(token => (
                      <div key={token} className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-1 rounded text-[9px] text-[#A1A1AA] font-bold">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                        {token}
                      </div>
                    ))}
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-xs relative z-10 pt-2 border-t border-white/5">
                 <div className="flex flex-col">
                    <span className="font-bold text-white text-base">786</span>
                    <span className="text-[9px] text-[#71717A] uppercase font-bold tracking-widest">Variáveis</span>
                 </div>
                 <div className="flex flex-col">
                    <span className="font-bold text-white text-base">42</span>
                    <span className="text-[9px] text-[#71717A] uppercase font-bold tracking-widest">Components</span>
                 </div>
              </div>
           </div>
        </div>

      </div>

      {/* Footer Action */}
      <div className="p-6 border-t border-[#E4E4E7] bg-white">
        <button 
           onClick={handleAudit}
           disabled={isAuditing || !url.trim()}
           className={cn(
            "w-full py-4 px-4 rounded-2xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg",
            isAuditing || !url.trim() ? "bg-[#A1A1AA] cursor-not-allowed" : "bg-[#6366F1] hover:bg-[#4F46E5] hover:shadow-indigo-200 active:scale-95"
           )}
        >
          {isAuditing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Executando Motor v3.0...
            </>
          ) : (
             <>
               <Zap className="w-4 h-4 fill-current" />
               Auditar Design
             </>
          )}
        </button>
      </div>
    </aside>
  );
}
