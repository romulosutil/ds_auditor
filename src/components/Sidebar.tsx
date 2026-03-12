import { useState } from 'react';
import { Layers, Palette, Baseline, ScanLine, Maximize, FileText, CheckCircle2, Search } from 'lucide-react';
import { cn } from '../lib/utils';

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
          <h1 className="text-xl font-semibold tracking-tight">DS Auditor</h1>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-[#059669] font-medium bg-[#ECFDF5] px-3 py-1.5 rounded-full w-fit">
          <CheckCircle2 className="w-4 h-4" />
          MCP Conectado
        </div>
      </div>

      {/* Main Content Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* URL Input */}
        <div className="space-y-3">
          <label htmlFor="figma-url" className="block text-sm font-medium text-[#27272A]">
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
              className="w-full pl-10 pr-4 py-2.5 bg-[#F4F4F5] border border-[#E4E4E7] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all placeholder:text-[#A1A1AA]"
            />
            <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
          </div>
          
          {/* Status do Frame (Mock) */}
          {url && !isAuditing && (
             <div className="text-xs text-[#71717A] flex items-center justify-between px-1">
                <span>Analisando Frame: <b>Header_v2</b></span>
                <span>1440x680px</span>
             </div>
          )}
        </div>

        {/* Categories */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#27272A]">Filtros de Auditoria</h3>
            <span className="text-xs text-[#A1A1AA]">{activeCategories.size}/{CATEGORIES.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(({ id, label, icon: Icon }) => {
              const isActive = activeCategories.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleCategory(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                    isActive 
                      ? "bg-[#18181B] text-white border-[#18181B]" 
                      : "bg-white text-[#71717A] border-[#E4E4E7] hover:bg-[#F4F4F5]"
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
        <div className="space-y-3">
           <h3 className="text-sm font-medium text-[#27272A]">Contexto do Design System</h3>
           <div className="bg-[#F4F4F5] p-4 rounded-xl space-y-3 border border-[#E4E4E7]">
              <div className="flex justify-between items-center">
                 <span className="text-sm font-semibold text-[#18181B]">DS4FUN</span>
                 <span className="text-xs font-medium text-[#6366F1] bg-[#EEF2FF] px-2 py-0.5 rounded">v2.4.0</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-[#71717A]">
                 <div className="flex flex-col">
                    <span className="font-medium text-[#27272A]">786</span>
                    Variáveis
                 </div>
                 <div className="flex flex-col">
                    <span className="font-medium text-[#27272A]">42</span>
                    Base Components
                 </div>
                 <div className="flex flex-col">
                    <span className="font-medium text-[#27272A]">Light/Dark</span>
                    Temas
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
            "w-full py-3 px-4 rounded-xl text-white font-medium text-sm transition-all flex items-center justify-center gap-2",
            isAuditing || !url.trim() ? "bg-[#A1A1AA] cursor-not-allowed" : "bg-[#6366F1] hover:bg-[#4F46E5] shadow-sm hover:shadow"
           )}
        >
          {isAuditing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analisando Interface...
            </>
          ) : (
             <>
               <ScanLine className="w-4 h-4" />
               Iniciar Auditoria
             </>
          )}
        </button>
      </div>
    </aside>
  );
}
