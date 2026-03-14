import { useRef, useState } from 'react';
import { Download, HelpCircle, ShieldCheck } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { ScoreCards } from './ScoreCards';
import { CategoryDetails } from './CategoryDetails';
import { cn } from '../lib/utils';
import type { AuditResults, AuditCategory, AuditIssue } from '../services/auditEngine';

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  colors: 'Cores',
  typography: 'Tipografia',
  spacing: 'Espaçamento',
  radii: 'Raios',
  components: 'Componentes',
  naming: 'Nomenclatura',
  a11y: 'Acessibilidade',
  heuristics: 'Heurísticas',
  styles: 'Estilos (Sombras/Bordas)',
};

interface MainPanelProps {
  results: AuditResults | null;
  isAuditing: boolean;
  previewUrl: string | null;
  frameName: string | undefined;
  fileName?: string | undefined;
  progress: number;
  status: string;
}

export function MainPanel({ results, isAuditing, previewUrl, frameName, fileName, progress, status }: MainPanelProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [hoveredIssue, setHoveredIssue] = useState<AuditIssue | null>(null);
  const [imageScale, setImageScale] = useState({ x: 1, y: 1 });

  // Calcular escala da imagem para o Highlight v3.0
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const displayedWidth = img.clientWidth;
    const displayedHeight = img.clientHeight;
    
    // Pegamos a largura original do frame (assumindo a primeira categoria com erro ou 1440 padrão)
    const originalWidth = results?.totalLayers ? (results?.categories.colors?.[0]?.width || 1440) : 1440;
    const originalHeight = results?.totalLayers ? (results?.categories.colors?.[0]?.height || 1024) : 1024;

    setImageScale({
      x: displayedWidth / originalWidth,
      y: displayedHeight / originalHeight
    });
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    
    // Feedback visual opcional ou apenas execução direta
    const element = printRef.current;
    
    // Opções otimizadas para v3.0
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `ds-auditor-v3-${frameName || 'report'}-${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        letterRendering: true,
        scrollY: 0,
        windowWidth: 1200,
        onclone: (clonedDoc: Document) => {
          // 1. Remove all link tags to avoid external oklch/modern CSS
          const links = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
          links.forEach(l => l.remove());

          // 2. Aggressive sanitization of all <style> tags
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach(s => {
            if (s.textContent) {
              s.textContent = s.textContent
                .replace(/oklch\([^)]+\)/g, '#71717a')
                .replace(/oklab\([^)]+\)/g, '#71717a')
                .replace(/color-mix\([^)]+\)/g, '#71717a');
            }
          });

          // 3. Sanitize inline styles in all elements
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach(el => {
            if (el instanceof HTMLElement) {
              const style = el.getAttribute('style');
              if (style && (style.includes('okl') || style.includes('color-mix'))) {
                el.setAttribute('style', style
                  .replace(/oklch\([^)]+\)/g, '#71717a')
                  .replace(/oklab\([^)]+\)/g, '#71717a')
                  .replace(/color-mix\([^)]+\)/g, '#71717a')
                );
              }
            }
          });
        }
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: '.border.rounded-xl' }
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Houve um erro ao gerar o PDF. Verifique o console para mais detalhes.');
    }
  };

  if (isAuditing) {
    return (
      <main className="flex-1 flex items-center justify-center bg-white">
         <div className="flex flex-col items-center gap-6 max-w-sm w-full p-8 text-center text-render">
            <div className="relative w-24 h-24">
               <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle className="text-[#F4F4F5] stroke-[8]" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" />
                  <circle 
                    className="text-[#6366F1] stroke-[8] transition-all duration-500 ease-out" 
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - progress / 100)}
                    strokeLinecap="round"
                    stroke="currentColor" 
                    fill="transparent" 
                    r="40" cx="50" cy="50" 
                  />
               </svg>
               <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#6366F1]">
                  {progress}%
               </div>
            </div>
            <div className="space-y-3 w-full">
               <h3 className="text-lg font-semibold text-[#18181B] animate-pulse">{status}</h3>
               <div className="w-full bg-[#F4F4F5] h-2 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="h-full bg-[#6366F1] transition-all duration-500 ease-out" 
                    style={{ width: `${progress}%` }}
                  />
               </div>
               <p className="text-[10px] text-[#A1A1AA] uppercase tracking-widest font-bold">Processando via Figma MCP SSE</p>
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
             <h2 className="text-lg font-semibold text-[#18181B] mb-2">Aguardando Auditoria</h2>
             <p className="text-sm text-[#71717A]">Cole a URL do Figma e selecione as categorias para iniciar o processo v3.0.</p>
          </div>
      </main>
    );
  }

  const categoryEntries = Object.entries(results.categories) as [AuditCategory, typeof results.categories[AuditCategory]][];

  return (
    <main className="flex-1 overflow-y-auto bg-[#FAFAFA] relative">
      <div className="sticky top-0 z-20 bg-[#FAFAFA]/80 backdrop-blur-md border-b border-[#E4E4E7] px-8 py-4 flex items-center justify-between no-print">
         <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider">Ficheiro Figma</span>
              <h2 className="text-lg font-semibold tracking-tight text-[#18181B] leading-tight truncate max-w-[200px]" title={fileName}>
                {fileName || 'Arquivo'}
              </h2>
            </div>
            <div className="h-8 w-px bg-[#E4E4E7]" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider">Frame Analisado</span>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                 <h3 className="text-sm font-medium text-[#3F3F46] leading-tight truncate max-w-[150px]" title={frameName}>
                   {frameName || 'Seleção'}
                 </h3>
              </div>
            </div>
         </div>
         <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E4E4E7] rounded-xl text-sm font-medium text-[#3F3F46] hover:bg-[#F4F4F5] shadow-sm">
            <Download className="w-4 h-4" />
            PDF Relatório
         </button>
      </div>

      <div ref={printRef} className="p-8 max-w-6xl mx-auto space-y-8 bg-[#FAFAFA] pdf-capture">
          <ScoreCards 
             score={results.score} 
             compliance={results.compliance} 
             criticalErrors={results.criticalErrors} 
             alerts={results.alerts} 
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
             <div className="space-y-4">
                 <h3 className="text-sm font-semibold text-[#27272A]">Figma Preview (Highlight v3.0)</h3>
                 <div className="bg-[#E4E4E7] rounded-2xl border border-[#D4D4D8] overflow-hidden relative group aspect-video lg:aspect-square xl:aspect-[4/3]">
                    {previewUrl ? (
                        <div className="relative w-full h-full">
                          <img 
                            src={previewUrl}
                            alt="Figma Frame Preview" 
                            onLoad={handleImageLoad}
                            className={cn(
                               "object-contain w-full h-full transition-all duration-500",
                               hoveredIssue ? "opacity-30 blur-[1px] grayscale" : "opacity-100"
                            )}
                          />
                          {hoveredIssue && hoveredIssue.width && hoveredIssue.height && (
                            <div 
                              className="absolute border-2 border-[#6366F1] bg-[#6366F1]/20 shadow-[0_0_15px_rgba(99,102,241,0.4)] z-30 transition-all duration-200"
                              style={{
                                left: `${(hoveredIssue.x || 0) * imageScale.x}px`,
                                top: `${(hoveredIssue.y || 0) * imageScale.y}px`,
                                width: `${hoveredIssue.width * imageScale.x}px`,
                                height: `${hoveredIssue.height * imageScale.y}px`,
                              }}
                            >
                               <div className="absolute top-0 right-0 translate-y-[-100%] bg-[#6366F1] text-white text-[8px] font-bold px-1 py-0.5 rounded-t">
                                  {hoveredIssue.severity.toUpperCase()}
                               </div>
                            </div>
                          )}
                        </div>
                    ) : (
                        <div className="p-6 text-center space-y-2 flex flex-col items-center justify-center h-full">
                           <ShieldCheck className="w-8 h-8 text-[#A1A1AA]" />
                           <p className="text-[10px] text-[#71717A] max-w-[150px]">Preview indisponível. Verifique conexão com MCP.</p>
                        </div>
                    )}
                 </div>
                 
                 <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-sm flex items-center justify-between">
                    <div>
                       <h4 className="text-[10px] font-bold text-[#A1A1AA] mb-1 uppercase tracking-wider">Métricas</h4>
                       <div className="flex gap-4">
                          <div className="text-sm"><span className="text-[#71717A]">Camadas:</span> <span className="font-bold">{results.totalLayers}</span></div>
                          <div className="text-sm"><span className="text-[#71717A]">Analizado:</span> <span className="font-bold">{new Date(results.auditedAt).toLocaleTimeString()}</span></div>
                       </div>
                    </div>
                    <div className="text-right">
                       <h4 className="text-[10px] font-bold text-[#A1A1AA] mb-1 uppercase tracking-wider">Compliance</h4>
                       <div className="text-2xl font-bold text-[#10B981]">{results.compliance}%</div>
                    </div>
                 </div>
             </div>

             <div className="space-y-6">
                 <h3 className="text-lg font-semibold tracking-tight text-[#18181B] mb-4">Inspeção Detalhada</h3>
                 <div className="space-y-4">
                   {categoryEntries.map(([catId, issues]) =>
                       issues && issues.length > 0 ? (
                         <div key={catId} className="break-inside-avoid">
                           <CategoryDetails 
                             title={CATEGORY_LABELS[catId]} 
                             type={issues.some(i => i.severity === 'error') ? 'error' : 'warning'} 
                             issues={issues} 
                             onHoverIssue={setHoveredIssue}
                           />
                         </div>
                       ) : null
                   )}
                 </div>
             </div>
          </div>
      </div>
    </main>
  );
}
