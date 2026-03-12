import { useRef, useState, useEffect } from 'react';
import { Download, HelpCircle, ShieldCheck, ExternalLink } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { ScoreCards } from './ScoreCards';
import { CategoryDetails } from './CategoryDetails';
import type { AuditResults, AuditCategory } from '../services/auditEngine';

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  colors: 'Cores',
  typography: 'Tipografia',
  spacing: 'Espaçamento',
  radii: 'Raios',
  components: 'Componentes',
  naming: 'Nomenclatura',
};

interface MainPanelProps {
  results: AuditResults | null;
  isAuditing: boolean;
  previewUrl: string | null;
  frameName: string | undefined;
}

export function MainPanel({ results, isAuditing, previewUrl, frameName }: MainPanelProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  const steps = [
    "Conectando ao Proxy...",
    "Buscando frame no Figma...",
    "Lendo estrutura de camadas...",
    "Validando tokens DS4FUN...",
    "Calculando scores de governança...",
    "Gerando relatório final..."
  ];

  useEffect(() => {
    let interval: number | undefined;
    if (isAuditing) {
      setLoadingStep(0);
      interval = window.setInterval(() => {
        setLoadingStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
      }, 1500);
    } else {
      setLoadingStep(0);
      if (interval) clearInterval(interval);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isAuditing]);

  const handleDownloadPDF = () => {
    if (!printRef.current) return;
    
    const element = printRef.current;
    const opt = {
      margin: 10,
      filename: `ds-auditor-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  if (isAuditing) {
    return (
      <main className="flex-1 flex items-center justify-center bg-white">
         <div className="flex flex-col items-center gap-6 max-w-xs w-full">
            <div className="w-12 h-12 border-4 border-[#F4F4F5] border-t-[#6366F1] rounded-full animate-spin shadow-inner" />
            <div className="space-y-2 text-center w-full">
               <p className="text-sm font-semibold text-[#18181B]">{steps[loadingStep]}</p>
               <div className="w-full bg-[#F4F4F5] h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#6366F1] transition-all duration-1000 ease-out" 
                    style={{ width: `${((loadingStep + 1) / steps.length) * 100}%` }}
                  />
               </div>
               <p className="text-[10px] text-[#A1A1AA] uppercase tracking-widest font-bold">Auditoria em Curso</p>
            </div>
         </div>
      </main>
    );
  }

  if (!results) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="bg-white p-6 rounded-3xl border border-[#E4E4E7] shadow-sm max-w-sm">
             <div className="w-12 h-12 bg-[#F4F4F5] rounded-xl flex items-center justify-center mb-4 mx-auto">
                 <HelpCircle className="w-6 h-6 text-[#A1A1AA]" />
             </div>
             <h2 className="text-lg font-semibold text-[#18181B] mb-2">Nenhuma análise ativa</h2>
             <p className="text-sm text-[#71717A]">Cole a URL de um frame do Figma na barra lateral para iniciar a auditoria de Design System.</p>
          </div>
      </main>
    );
  }

  const categoryEntries = Object.entries(results.categories) as [AuditCategory, typeof results.categories[AuditCategory]][];

  return (
    <main className="flex-1 overflow-y-auto bg-[#FAFAFA] relative">
      {/* Top Bar */}
      <div className="sticky top-0 z-20 bg-[#FAFAFA]/80 backdrop-blur-md border-b border-[#E4E4E7] px-8 py-4 flex items-center justify-between no-print">
         <div>
            <h2 className="text-xl font-semibold tracking-tight">Análise da Interface</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="w-2 h-2 rounded-full bg-[#10B981]" />
               <span className="text-xs font-medium text-[#71717A]">Análise concluída em {new Date(results.auditedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
         </div>
         <button 
           onClick={handleDownloadPDF}
           className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E4E4E7] rounded-xl text-sm font-medium text-[#3F3F46] hover:bg-[#F4F4F5] hover:text-[#18181B] transition-colors shadow-sm"
         >
            <Download className="w-4 h-4" />
            Baixar PDF
         </button>
      </div>

      {/* Printable Area Container */}
      <div ref={printRef} className="p-8 max-w-5xl mx-auto space-y-8 bg-[#FAFAFA]">
          {/* Header for PDF only */}
          <div className="hidden print:block mb-8 pb-4 border-b border-[#E4E4E7]">
              <h1 className="text-2xl font-bold tracking-tight mb-2">Relatório de Governança DS Auditor</h1>
              <p className="text-sm text-[#71717A]">Frame analisado: {frameName ?? 'N/A'} | Data: {new Date(results.auditedAt).toLocaleDateString()}</p>
          </div>

          <ScoreCards 
             score={results.score} 
             compliance={results.compliance} 
             criticalErrors={results.criticalErrors} 
             alerts={results.alerts} 
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
             {/* Left Column: Preview Map */}
             <div className="lg:col-span-1 space-y-4">
                 <h3 className="text-sm font-semibold text-[#27272A]">
                    Visualização do Frame
                 </h3>
                 <div className="bg-[#E4E4E7] rounded-2xl aspect-[3/4] flex flex-col items-center justify-center border border-[#D4D4D8] overflow-hidden relative group">
                    {previewUrl ? (
                        <>
                          <img 
                            src={previewUrl}
                            alt="Figma Frame Preview" 
                            className="object-cover w-full h-full opacity-60 grayscale group-hover:grayscale-0 transition-all duration-500"
                          />
                          <a 
                            href={previewUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity no-print"
                          >
                            <div className="bg-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold text-black shadow-lg">
                              <ExternalLink className="w-3 h-3" />
                              ABRIR IMAGEM ↗
                            </div>
                          </a>
                        </>
                    ) : (
                        <div className="p-6 text-center space-y-2">
                           <div className="w-10 h-10 bg-[#D4D4D8] rounded-full flex items-center justify-center mx-auto">
                              <ShieldCheck className="w-5 h-5 text-[#A1A1AA]" />
                           </div>
                           <p className="text-[10px] text-[#71717A] font-bold uppercase tracking-tighter italic">Preview bloqueado por CORS (S3)</p>
                        </div>
                    )}
                 </div>
                 
                 {/* Internal Summary Sidebar */}
                 <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-sm">
                    <h4 className="text-xs font-semibold text-[#71717A] mb-3 uppercase tracking-wider">Resumo da Auditoria</h4>
                    <div className="space-y-2">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-[#3F3F46]">Total de Camadas</span>
                          <span className="font-semibold text-[#27272A]">{results.totalLayers}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-[#3F3F46]">Erros Críticos</span>
                          <span className="font-semibold text-[#DC2626]">{results.criticalErrors}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-[#3F3F46]">Alertas</span>
                          <span className="font-semibold text-[#D97706]">{results.alerts}</span>
                       </div>
                       <div className="pt-2 mt-2 border-t border-[#E4E4E7] flex justify-between items-center text-sm font-medium">
                          <span className="text-[#18181B]">Total Issues</span>
                          <span className="text-[#18181B]">{results.criticalErrors + results.alerts}</span>
                       </div>
                    </div>
                 </div>
             </div>

             {/* Right Column: Detailed Issues */}
             <div className="lg:col-span-2 space-y-6">
                <div>
                   <h3 className="text-lg font-semibold tracking-tight text-[#18181B] mb-4">Detalhamento por Categoria</h3>
                   
                   {categoryEntries.map(([catId, issues]) =>
                       issues && issues.length > 0 ? (
                         <CategoryDetails 
                           key={catId}
                           title={CATEGORY_LABELS[catId]} 
                           type={issues.some(i => i.severity === 'error') ? 'error' : 'warning'} 
                           issues={issues} 
                         />
                       ) : null
                   )}
                   
                   {/* Passed Categories */}
                   {results.passedCategories.length > 0 && (
                     <div className="bg-[#ECFDF5] border border-[#10B981]/20 rounded-xl p-4 flex items-start gap-3 mt-4">
                         <div className="bg-white p-1 rounded-full shadow-sm mt-0.5 shrink-0">
                             <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                         </div>
                         <div>
                            <h4 className="text-sm font-semibold text-[#065F46] mb-1">
                              {results.passedCategories.map(c => CATEGORY_LABELS[c]).join(', ')} — 100% aderentes
                            </h4>
                            <p className="text-xs text-[#065F46]/80">Nenhuma infração encontrada para as categorias selecionadas acima.</p>
                         </div>
                     </div>
                   )}
                </div>
             </div>
          </div>
      </div>
    </main>
  );
}
