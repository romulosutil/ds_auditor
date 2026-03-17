import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import type { SidebarMode } from './components/Sidebar';
import { MainPanel } from './components/MainPanel';
import { runAudit } from './services/auditEngine';
import type { AuditResults } from './services/auditEngine';
import { runHandoffAnalysis } from './services/handoffEngine';
import type { HandoffResults } from './services/handoffEngine';
import { runComponentTest } from './services/componentTestEngine';
import type { ComponentTestResults } from './services/componentTestEngine';
import type { FigmaNode as FigmaServiceNode, FigmaLayer } from './services/figmaService';
import { runDesignVsCodeComparison } from './services/designVsCodeEngine';
import type { DesignVsCodeReport, ExtractedViewport } from './services/designVsCodeEngine';

// ─── Types ────────────────────────────────────────────────────────────────

export interface JourneyFrame {
  url: string;
  frameName: string;
  fileName: string;
  previewUrl: string | null;
  auditResults: AuditResults;
  handoffResults: HandoffResults;
  annotations: string | null;
}

export interface DesignVsCodeResult {
  devUrl: string;
  figmaFrames: Array<{
    url: string;
    frameName: string;
    previewUrl: string | null;
    width: number;
    node: FigmaLayer;
  }>;
  viewportResults: ExtractedViewport[];
  report: DesignVsCodeReport;
}

// ─── SSE Helper ───────────────────────────────────────────────────────────

function streamAuditUrl(
  url: string,
  onProgress: (progress: number, status: string) => void
): Promise<FigmaServiceNode & { fileName?: string }> {
  return new Promise((resolve, reject) => {
    const es = new EventSource(`/api/audit/stream?url=${encodeURIComponent(url)}`);
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.step === 'complete') {
        es.close();
        resolve(data.data);
      } else if (data.step === 'error') {
        es.close();
        reject(new Error(data.message));
      } else {
        onProgress(data.progress ?? 0, data.message ?? '');
      }
    };
    es.onerror = () => {
      es.close();
      reject(new Error('Erro de conexão com o servidor.'));
    };
  });
}

// ─── App ──────────────────────────────────────────────────────────────────

function App() {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('journey');
  const [isAuditing, setIsAuditing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [auditStatus, setAuditStatus] = useState('');

  // Journey state
  const [journeyFrames, setJourneyFrames] = useState<JourneyFrame[]>([]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0);

  // Component test state
  const [componentTestResult, setComponentTestResult] = useState<ComponentTestResults | null>(null);

  // Design vs. Código state
  const [designVsCodeResult, setDesignVsCodeResult] = useState<DesignVsCodeResult | null>(null);

  // ── Journey: analyze one or many frames ────────────────────────────
  const handleStartAudit = async (urls: string[], activeCategories: Set<string>) => {
    setIsAuditing(true);
    setJourneyFrames([]);
    setSelectedFrameIndex(0);
    setComponentTestResult(null);
    setDesignVsCodeResult(null);

    const accumulated: JourneyFrame[] = [];

    for (let i = 0; i < urls.length; i++) {
      setCurrentProcessingIndex(i);
      setProgress(0);
      setAuditStatus(`Frame ${i + 1}/${urls.length}: Conectando...`);

      try {
        const node = await streamAuditUrl(urls[i], (p, msg) => {
          setProgress(p);
          setAuditStatus(`Frame ${i + 1}/${urls.length}: ${msg}`);
        });

        if (node.previewUrl) {
          node.previewUrl = `/api/image-proxy?url=${encodeURIComponent(node.previewUrl)}`;
        }

        let annotations: string | null = null;
        try {
          const annRes = await fetch(`/api/audit/annotations?nodeId=${encodeURIComponent(node.nodeId)}`);
          if (annRes.ok) {
            const annData = await annRes.json();
            annotations = annData.annotations || null;
          }
        } catch { /* annotations optional */ }

        const [auditResults, handoffResults] = await Promise.all([
          runAudit(node, activeCategories),
          Promise.resolve(runHandoffAnalysis(node)),
        ]);

        const frame: JourneyFrame = {
          url: urls[i],
          frameName: node.name,
          fileName: node.fileName ?? 'Arquivo Figma',
          previewUrl: node.previewUrl,
          auditResults,
          handoffResults,
          annotations,
        };

        accumulated.push(frame);
        setJourneyFrames([...accumulated]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setAuditStatus(`Erro no frame ${i + 1}: ${msg}`);
      }
    }

    setProgress(100);
    setIsAuditing(false);
  };

  // ── Component test ──────────────────────────────────────────────────
  const handleStartComponentTest = async (url: string) => {
    setIsAuditing(true);
    setProgress(0);
    setAuditStatus('Conectando ao Figma MCP...');
    setComponentTestResult(null);
    setJourneyFrames([]);
    setDesignVsCodeResult(null);

    try {
      const node = await streamAuditUrl(url, (p, msg) => {
        setProgress(p);
        setAuditStatus(msg);
      });

      if (node.previewUrl) {
        node.previewUrl = `/api/image-proxy?url=${encodeURIComponent(node.previewUrl)}`;
      }

      const result = runComponentTest(node);
      setComponentTestResult(result);
      setProgress(100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setAuditStatus(`Erro: ${msg}`);
    } finally {
      setIsAuditing(false);
    }
  };

  // ── Design vs. Código ───────────────────────────────────────────────
  const handleStartDesignVsCode = async (devUrl: string, figmaUrls: string[]) => {
    setIsAuditing(true);
    setProgress(0);
    setAuditStatus('Iniciando Design vs. Código...');
    setDesignVsCodeResult(null);
    setJourneyFrames([]);
    setComponentTestResult(null);

    try {
      // 1. Busca os dados de cada frame Figma via MCP
      setAuditStatus('Extraindo frames do Figma...');
      const figmaFrames: DesignVsCodeResult['figmaFrames'] = [];

      for (let i = 0; i < figmaUrls.length; i++) {
        setProgress(Math.round(10 + (i / figmaUrls.length) * 30));
        setAuditStatus(`Figma: frame ${i + 1}/${figmaUrls.length}...`);

        try {
          const node = await streamAuditUrl(figmaUrls[i], (_p, msg) => {
            setAuditStatus(`Figma frame ${i + 1}: ${msg}`);
          });

          if (node.previewUrl) {
            node.previewUrl = `/api/image-proxy?url=${encodeURIComponent(node.previewUrl)}`;
          }

          // Usa a camada raiz (layers[0]) como nó para comparação
          const rootLayer: FigmaLayer = node.layers?.[0] ?? {
            id: node.nodeId,
            name: node.name,
            type: 'FRAME',
            fills: [],
            width: node.width,
            height: node.height,
            children: [],
          };

          figmaFrames.push({
            url: figmaUrls[i],
            frameName: node.name,
            previewUrl: node.previewUrl ?? null,
            width: node.width || 1440,
            node: rootLayer,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro';
          setAuditStatus(`Aviso: frame ${i + 1} do Figma falhou (${msg})`);
        }
      }

      // 2. Extrai o DOM para cada viewport (baseado nas larguras dos frames Figma)
      setProgress(50);
      setAuditStatus('Abrindo navegador e extraindo DOM...');

      const viewports = figmaFrames.map(f => f.width);
      const uniqueViewports = [...new Set(viewports)];

      const extractRes = await fetch('/api/extract-dom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: devUrl, viewports: uniqueViewports }),
      });

      if (!extractRes.ok) {
        const errData = await extractRes.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(`Falha ao extrair DOM: ${errData.error || extractRes.statusText}`);
      }

      const extractData = await extractRes.json();
      const viewportResults: ExtractedViewport[] = extractData.results ?? [];

      // 3. Roda o motor de comparação
      setProgress(80);
      setAuditStatus('Comparando Design vs. Código...');

      const report = runDesignVsCodeComparison(
        figmaFrames.map(f => ({ node: f.node, frameName: f.frameName, width: f.width })),
        viewportResults
      );

      setDesignVsCodeResult({
        devUrl,
        figmaFrames,
        viewportResults,
        report,
      });

      setProgress(100);
      setAuditStatus('Comparação concluída!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setAuditStatus(`Erro: ${msg}`);
    } finally {
      setIsAuditing(false);
    }
  };

  // Derived current frame data
  const currentFrame = journeyFrames[selectedFrameIndex] ?? null;

  return (
    <div className="flex h-screen w-full bg-[#FAFAFA] text-[#18181B] overflow-hidden font-sans">
      <Sidebar
        onStartAudit={handleStartAudit}
        onStartComponentTest={handleStartComponentTest}
        onStartDesignVsCode={handleStartDesignVsCode}
        isAuditing={isAuditing}
        mode={sidebarMode}
        onModeChange={setSidebarMode}
      />
      <MainPanel
        journeyFrames={journeyFrames}
        selectedFrameIndex={selectedFrameIndex}
        onSelectFrame={setSelectedFrameIndex}
        currentFrame={currentFrame}
        componentTestResult={componentTestResult}
        designVsCodeResult={designVsCodeResult}
        sidebarMode={sidebarMode}
        isAuditing={isAuditing}
        progress={progress}
        status={auditStatus}
        currentProcessingIndex={currentProcessingIndex}
      />
    </div>
  );
}

export default App;
