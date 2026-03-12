import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { MainPanel } from './components/MainPanel';
import { runAudit } from './services/auditEngine';
import type { AuditResults } from './services/auditEngine';

function App() {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResults, setAuditResults] = useState<AuditResults | null>(null);
  const [url, setUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [frameName, setFrameName] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();
  const [progress, setProgress] = useState(0);
  const [auditStatus, setAuditStatus] = useState('');

  const handleStartAudit = (inputUrl: string, activeCategories: Set<string>) => {
    setUrl(inputUrl);
    setIsAuditing(true);
    setAuditResults(null);
    setProgress(0);
    setAuditStatus('Iniciando...');

    const eventSource = new EventSource(`/api/audit/stream?url=${encodeURIComponent(inputUrl)}`);

    eventSource.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      if (data.step === 'complete') {
        eventSource.close();
        const node = data.data;
        
        // Proxy de imagem v2.0
        if (node.previewUrl) {
          node.previewUrl = `/api/image-proxy?url=${encodeURIComponent(node.previewUrl)}`;
        }
        
        setPreviewUrl(node.previewUrl);
        setFrameName(node.name);
        setFileName(node.fileName);
        
        // Rodar auditoria local com os dados recebidos do MCP
        const results = await runAudit(node, activeCategories);
        setAuditResults(results);
        setIsAuditing(false);
        setProgress(100);
      } else if (data.step === 'error') {
        eventSource.close();
        setAuditStatus(`Erro: ${data.message}`);
        setIsAuditing(false);
      } else {
        setAuditStatus(data.message);
        setProgress(data.progress);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setIsAuditing(false);
      setAuditStatus('Erro de conexão com o servidor.');
    };
  };

  return (
    <div className="flex h-screen w-full bg-[#FAFAFA] text-[#18181B] overflow-hidden font-sans">
      <Sidebar onStartAudit={handleStartAudit} isAuditing={isAuditing} url={url} setUrl={setUrl} />
      <MainPanel 
        results={auditResults} 
        isAuditing={isAuditing} 
        previewUrl={previewUrl} 
        frameName={frameName} 
        fileName={fileName}
        progress={progress}
        status={auditStatus}
      />
    </div>
  );
}

export default App;
