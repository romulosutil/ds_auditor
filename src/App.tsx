import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import type { SidebarMode } from './components/Sidebar';
import { MainPanel } from './components/MainPanel';
import { Dashboard } from './components/Dashboard';
import { runAudit } from './services/auditEngine';
import type { AuditResults } from './services/auditEngine';
import { runHandoffAnalysis } from './services/handoffEngine';
import type { HandoffResults } from './services/handoffEngine';
import { runComponentTest } from './services/componentTestEngine';
import type { ComponentTestResults } from './services/componentTestEngine';
import { historyService } from './services/historyService';
import type { FigmaNode } from './services/figmaService';

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

// ─── SSE Helper ───────────────────────────────────────────────────────────

function streamAuditUrl(
  url: string,
  onProgress: (progress: number, status: string) => void
): Promise<FigmaNode & { fileName?: string }> {
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

  // ── Journey: analyze one or many frames ────────────────────────────
  const handleStartAudit = async (urls: string[], activeCategories: Set<string>) => {
    setIsAuditing(true);
    setJourneyFrames([]);
    setSelectedFrameIndex(0);
    setComponentTestResult(null);

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

        // Proxy preview URL
        if (node.previewUrl) {
          node.previewUrl = `/api/image-proxy?url=${encodeURIComponent(node.previewUrl)}`;
        }

        // Fetch dev mode annotations (non-blocking)
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

        // Persistir no Histórico
        historyService.save(node.fileName ?? 'Arquivo Figma', node.name, auditResults, handoffResults);

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

  // Derived current frame data
  const currentFrame = journeyFrames[selectedFrameIndex] ?? null;

  return (
    <div className="flex h-screen w-full bg-[#FAFAFA] text-[#18181B] overflow-hidden font-sans">
      <Sidebar
        onStartAudit={handleStartAudit}
        onStartComponentTest={handleStartComponentTest}
        isAuditing={isAuditing}
        mode={sidebarMode}
        onModeChange={setSidebarMode}
      />
      {sidebarMode === 'dashboard' ? (
        <Dashboard />
      ) : (
        <MainPanel
          journeyFrames={journeyFrames}
          selectedFrameIndex={selectedFrameIndex}
          onSelectFrame={setSelectedFrameIndex}
          currentFrame={currentFrame}
          componentTestResult={componentTestResult}
          sidebarMode={sidebarMode}
          isAuditing={isAuditing}
          progress={progress}
          status={auditStatus}
          currentProcessingIndex={currentProcessingIndex}
        />
      )}
    </div>
  );
}

export default App;
