import { useRef, useState } from 'react';
import { Download, HelpCircle, ShieldCheck, ScanLine, ClipboardCheck, FlaskConical, ChevronLeft, ChevronRight } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { ScoreCards } from './ScoreCards';
import { CategoryDetails } from './CategoryDetails';
import { HandoffPanel } from './HandoffPanel';
import { ComponentTestPanel } from './ComponentTestPanel';
import { cn } from '../lib/utils';
import type { AuditResults, AuditCategory, AuditIssue } from '../services/auditEngine';
import type { ComponentTestResults } from '../services/componentTestEngine';
import type { JourneyFrame } from '../App';
import type { SidebarMode } from './Sidebar';

// ─── Constants ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  colors:     'Cores',
  typography: 'Tipografia',
  spacing:    'Espaçamento',
  radii:      'Raios',
  components: 'Componentes',
  naming:     'Nomenclatura',
  a11y:       'Acessibilidade',
  heuristics: 'Heurísticas',
  styles:     'Estilos (Sombras/Bordas)',
};

type TabId = 'audit' | 'handoff';

// ─── Props ────────────────────────────────────────────────────────────────

interface MainPanelProps {
  journeyFrames: JourneyFrame[];
  selectedFrameIndex: number;
  onSelectFrame: (i: number) => void;
  currentFrame: JourneyFrame | null;
  componentTestResult: ComponentTestResults | null;
  sidebarMode: SidebarMode;
  isAuditing: boolean;
  progress: number;
  status: string;
  currentProcessingIndex: number;
}

// ─── Frame Navigator ──────────────────────────────────────────────────────

function FrameNavigator({
  frames,
  selectedIndex,
  onSelect,
}: {
  frames: JourneyFrame[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  if (frames.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
      <button
        onClick={() => onSelect(Math.max(0, selectedIndex - 1))}
        disabled={selectedIndex === 0}
        className="flex-shrink-0 p-1.5 text-[#A1A1AA] hover:text-[#3F3F46] disabled:opacity-30 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {frames.map((frame, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={cn(
            'flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border',
            i === selectedIndex
              ? 'bg-[#18181B] text-white border-[#18181B]'
              : 'bg-white text-[#71717A] border-[#E4E4E7] hover:border-[#D4D4D8]'
          )}
        >
          <span className="text-[9px] font-bold opacity-60">{i + 1}</span>
          <span className="max-w-[100px] truncate">{frame.frameName}</span>
          {/* Score badge */}
          <span className={cn(
            'text-[9px] font-bold px-1 py-0.5 rounded-full',
            frame.auditResults.score >= 80
              ? 'bg-emerald-100 text-emerald-700'
              : frame.auditResults.score >= 50
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-600'
          )}>
            {frame.auditResults.score}
          </span>
        </button>
      ))}

      <button
        onClick={() => onSelect(Math.min(frames.length - 1, selectedIndex + 1))}
        disabled={selectedIndex === frames.length - 1}
        className="flex-shrink-0 p-1.5 text-[#A1A1AA] hover:text-[#3F3F46] disabled:opacity-30 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Loading / Empty States ───────────────────────────────────────────────

function LoadingState({ progress, status, totalFrames, currentIndex }: {
  progress: number;
  status: string;
  totalFrames: number;
  currentIndex: number;
}) {
  return (
    <main className="flex-1 flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full p-8 text-center">
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
          {totalFrames > 1 && (
            <p className="text-xs font-bold text-[#6366F1] uppercase tracking-wider">
              Frame {currentIndex + 1} de {totalFrames}
            </p>
          )}
          <h3 className="text-lg font-semibold text-[#18181B] animate-pulse">{status}</h3>
          <div className="w-full bg-[#F4F4F5] h-2 rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-[#6366F1] transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[10px] text-[#A1A1AA] uppercase tracking-widest font-bold">Processando via Figma MCP SSE</p>
        </div>
      </div>
    </main>
  );
}

function EmptyState({ mode }: { mode: SidebarMode }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="bg-white p-6 rounded-3xl border border-[#E4E4E7] shadow-sm max-w-sm">
        <div className="w-12 h-12 bg-[#F4F4F5] rounded-xl flex items-center justify-center mb-4 mx-auto">
          <HelpCircle className="w-6 h-6 text-[#A1A1AA]" />
        </div>
        <h2 className="text-lg font-semibold text-[#18181B] mb-2">
          {mode === 'component' ? 'Aguardando Componente' : 'Aguardando Análise'}
        </h2>
        <p className="text-sm text-[#71717A]">
          {mode === 'component'
            ? 'Cole a URL de um componente Figma e clique em "Testar Componente".'
            : 'Cole a URL dos frames da jornada e clique em "Analisar Jornada".'}
        </p>
      </div>
    </main>
  );
}

// ─── Audit View (existing logic) ──────────────────────────────────────────

function AuditView({
  frame,
  printRef,
  hoveredIssue,
  setHoveredIssue,
}: {
  frame: JourneyFrame;
  printRef: React.RefObject<HTMLDivElement | null>;
  hoveredIssue: AuditIssue | null;
  setHoveredIssue: (issue: AuditIssue | null) => void;
}) {
  const [imageScale, setImageScale] = useState({ x: 1, y: 1 });

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const originalWidth = frame.auditResults.categories.colors?.[0]?.width || 1440;
    const originalHeight = frame.auditResults.categories.colors?.[0]?.height || 1024;
    setImageScale({
      x: img.clientWidth / originalWidth,
      y: img.clientHeight / originalHeight,
    });
  };

  const results: AuditResults = frame.auditResults;
  const categoryEntries = Object.entries(results.categories) as [AuditCategory, typeof results.categories[AuditCategory]][];

  return (
    <div ref={printRef} className="p-8 max-w-6xl mx-auto space-y-8 bg-[#FAFAFA] pdf-capture">
      <ScoreCards
        score={results.score}
        compliance={results.compliance}
        criticalErrors={results.criticalErrors}
        alerts={results.alerts}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#27272A]">Figma Preview</h3>
          <div className="bg-[#E4E4E7] rounded-2xl border border-[#D4D4D8] overflow-hidden relative aspect-video lg:aspect-square xl:aspect-[4/3]">
            {frame.previewUrl ? (
              <div className="relative w-full h-full">
                <img
                  src={frame.previewUrl}
                  alt="Figma Frame Preview"
                  onLoad={handleImageLoad}
                  className={cn(
                    'object-contain w-full h-full transition-all duration-500',
                    hoveredIssue ? 'opacity-30 blur-[1px] grayscale' : 'opacity-100'
                  )}
                />
                {hoveredIssue && hoveredIssue.width && hoveredIssue.height && (
                  <div
                    className="absolute border-2 border-[#6366F1] bg-[#6366F1]/20 shadow-[0_0_15px_rgba(99,102,241,0.4)] z-30 transition-all duration-200"
                    style={{
                      left:   `${(hoveredIssue.x || 0) * imageScale.x}px`,
                      top:    `${(hoveredIssue.y || 0) * imageScale.y}px`,
                      width:  `${hoveredIssue.width * imageScale.x}px`,
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
              <div className="p-6 text-center flex flex-col items-center justify-center h-full">
                <ShieldCheck className="w-8 h-8 text-[#A1A1AA]" />
                <p className="text-[10px] text-[#71717A] max-w-[150px] mt-2">Preview indisponível.</p>
              </div>
            )}
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] shadow-sm flex items-center justify-between">
            <div>
              <h4 className="text-[10px] font-bold text-[#A1A1AA] mb-1 uppercase tracking-wider">Métricas</h4>
              <div className="flex gap-4">
                <div className="text-sm"><span className="text-[#71717A]">Camadas:</span> <span className="font-bold">{results.totalLayers}</span></div>
                <div className="text-sm"><span className="text-[#71717A]">Às:</span> <span className="font-bold">{new Date(results.auditedAt).toLocaleTimeString()}</span></div>
              </div>
            </div>
            <div className="text-right">
              <h4 className="text-[10px] font-bold text-[#A1A1AA] mb-1 uppercase tracking-wider">Compliance</h4>
              <div className="text-2xl font-bold text-[#10B981]">{results.compliance}%</div>
            </div>
          </div>

          {/* Dev Mode Annotations */}
          {frame.annotations && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2">Anotações do Dev Mode</h4>
              <pre className="text-[11px] text-amber-800 whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto">
                {frame.annotations}
              </pre>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-semibold tracking-tight text-[#18181B]">Inspeção Detalhada</h3>
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
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────

export function MainPanel({
  journeyFrames,
  selectedFrameIndex,
  onSelectFrame,
  currentFrame,
  componentTestResult,
  sidebarMode,
  isAuditing,
  progress,
  status,
  currentProcessingIndex,
}: MainPanelProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [hoveredIssue, setHoveredIssue] = useState<AuditIssue | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('audit');

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `ds-auditor-v4-${currentFrame?.frameName || 'report'}-${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2, useCORS: true, letterRendering: true, scrollY: 0, windowWidth: 1200,
        onclone: (clonedDoc: Document) => {
          clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach(l => l.remove());
          clonedDoc.querySelectorAll('style').forEach(s => {
            if (s.textContent) {
              s.textContent = s.textContent
                .replace(/oklch\([^)]+\)/g, '#71717a')
                .replace(/oklab\([^)]+\)/g, '#71717a')
                .replace(/color-mix\([^)]+\)/g, '#71717a');
            }
          });
          clonedDoc.querySelectorAll('*').forEach(el => {
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
      await html2pdf().set(opt).from(printRef.current).save();
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────
  if (isAuditing) {
    return (
      <LoadingState
        progress={progress}
        status={status}
        totalFrames={sidebarMode === 'journey' ? Math.max(1, currentProcessingIndex + 1) : 1}
        currentIndex={currentProcessingIndex}
      />
    );
  }

  // ── Component Test Mode ──────────────────────────────────────────────
  if (sidebarMode === 'component') {
    if (!componentTestResult) return <EmptyState mode="component" />;
    return (
      <main className="flex-1 overflow-y-auto bg-[#FAFAFA]">
        <div className="sticky top-0 z-20 bg-[#FAFAFA]/80 backdrop-blur-md border-b border-[#E4E4E7] px-8 py-4 flex items-center gap-3 no-print">
          <FlaskConical className="w-4 h-4 text-[#10B981]" />
          <div>
            <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider">Teste de Componente</span>
            <h2 className="text-sm font-semibold text-[#18181B] leading-tight">{componentTestResult.componentName}</h2>
          </div>
          <span className="text-[11px] font-bold bg-[#18181B] text-white px-2.5 py-1 rounded-full ml-auto">
            {componentTestResult.componentType}
          </span>
        </div>
        <ComponentTestPanel results={componentTestResult} />
      </main>
    );
  }

  // ── Journey Mode: empty ──────────────────────────────────────────────
  if (journeyFrames.length === 0) return <EmptyState mode="journey" />;

  // ── Journey Mode: results ────────────────────────────────────────────
  if (!currentFrame) return <EmptyState mode="journey" />;

  return (
    <main className="flex-1 overflow-y-auto bg-[#FAFAFA] relative">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-[#FAFAFA]/80 backdrop-blur-md border-b border-[#E4E4E7] px-8 py-4 no-print space-y-3">
        {/* Row 1: file info + tabs + PDF */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider">Ficheiro Figma</span>
              <h2 className="text-lg font-semibold tracking-tight text-[#18181B] leading-tight truncate max-w-[160px]" title={currentFrame.fileName}>
                {currentFrame.fileName}
              </h2>
            </div>
            <div className="h-8 w-px bg-[#E4E4E7]" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider">Frame</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                <h3 className="text-sm font-medium text-[#3F3F46] truncate max-w-[130px]" title={currentFrame.frameName}>
                  {currentFrame.frameName}
                </h3>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Tab switcher */}
            <div className="flex bg-[#F4F4F5] rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab('audit')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  activeTab === 'audit' ? 'bg-white text-[#18181B] shadow-sm' : 'text-[#71717A] hover:text-[#3F3F46]'
                )}
              >
                <ScanLine className="w-3.5 h-3.5" />
                Auditoria DS
              </button>
              <button
                onClick={() => setActiveTab('handoff')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  activeTab === 'handoff' ? 'bg-white text-[#18181B] shadow-sm' : 'text-[#71717A] hover:text-[#3F3F46]'
                )}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                Handoff
                {currentFrame.handoffResults.overall < 80 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] ml-0.5" />
                )}
              </button>
            </div>

            {activeTab === 'audit' && (
              <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E4E4E7] rounded-xl text-sm font-medium text-[#3F3F46] hover:bg-[#F4F4F5] shadow-sm">
                <Download className="w-4 h-4" />
                PDF
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Frame navigator (only if >1 frame) */}
        {journeyFrames.length > 1 && (
          <FrameNavigator
            frames={journeyFrames}
            selectedIndex={selectedFrameIndex}
            onSelect={onSelectFrame}
          />
        )}
      </div>

      {/* Content */}
      {activeTab === 'handoff' ? (
        <HandoffPanel
          results={currentFrame.handoffResults}
          frameName={currentFrame.frameName}
          fileName={currentFrame.fileName}
          annotations={currentFrame.annotations}
        />
      ) : (
        <AuditView
          frame={currentFrame}
          printRef={printRef}
          hoveredIssue={hoveredIssue}
          setHoveredIssue={setHoveredIssue}
        />
      )}
    </main>
  );
}
