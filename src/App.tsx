import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { MainPanel } from './components/MainPanel';
import { fetchFigmaNode } from './services/figmaService';
import { runAudit } from './services/auditEngine';
import type { AuditResults } from './services/auditEngine';

function App() {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResults, setAuditResults] = useState<AuditResults | null>(null);
  const [url, setUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [frameName, setFrameName] = useState<string | undefined>();

  const handleStartAudit = async (inputUrl: string, activeCategories: Set<string>) => {
    setUrl(inputUrl);
    setIsAuditing(true);
    setAuditResults(null);

    try {
      // Step 1: Fetch Figma node data (mocked)
      const node = await fetchFigmaNode(inputUrl);
      setPreviewUrl(node.previewUrl);
      setFrameName(node.name);

      // Step 2: Run the audit engine against the node
      const results = await runAudit(node, activeCategories);
      setAuditResults(results);
    } catch (err) {
      console.error('Audit failed:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#FAFAFA] text-[#18181B] overflow-hidden font-sans">
      <Sidebar onStartAudit={handleStartAudit} isAuditing={isAuditing} url={url} setUrl={setUrl} />
      <MainPanel results={auditResults} isAuditing={isAuditing} previewUrl={previewUrl} frameName={frameName} />
    </div>
  );
}

export default App;
