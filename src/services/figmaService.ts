/**
 * figmaService.ts
 */

export interface FigmaNode {
  nodeId: string;
  fileKey: string | null;
  name: string;
  width: number;
  height: number;
  previewUrl: string | null;
  layers: FigmaLayer[];
  rawMcpData?: unknown;
}

export interface FigmaLayer {
  id: string;
  name: string;
  type: string;
  fills?: FigmaFill[];
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  cornerRadius?: number;
  gap?: number;
  padding?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: FigmaLayer[];
  componentId?: string; // v2.0
}

export interface FigmaFill {
  type: string;
  hex?: string;
  variableName?: string | null;
}

/**
 * Main entry point. Tries the real Figma proxy first, falls back to mock data.
 */
export async function fetchFigmaNode(url: string): Promise<FigmaNode> {
  try {
    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Proxy retornou ${res.status}`);
    }

    const node = await res.json() as FigmaNode;
    
    // Buscar imagem separadamente se nodeId existir
    if (node.nodeId) {
      try {
        const imgRes = await fetch(`/api/figma/image?nodeId=${encodeURIComponent(node.nodeId)}`);
        const imgData = await imgRes.json();
        node.previewUrl = imgData.imageUrl;
      } catch (err) {
        console.warn('[figmaService] Erro ao buscar imagem:', err);
        node.previewUrl = null;
      }
    }

    return node;
  } catch (err) {
    console.warn('[figmaService] Erro ao buscar dados reais, usando mock:', err);
    await new Promise(r => setTimeout(r, 800));
    return getMockFigmaNode(url);
  }
}

function getMockFigmaNode(_url: string): FigmaNode {
  return {
    nodeId: 'mock-1',
    fileKey: 'mock',
    name: 'Header_v2 (Mock)',
    width: 1440,
    height: 680,
    previewUrl: 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356?auto=format&fit=crop&w=800&q=80',
    layers: [
      { id: '1', name: 'Header', type: 'FRAME', padding: 20, gap: 10, x: 0, y: 0, width: 1440, height: 80 }
    ]
  };
}

export async function checkProxyHealth(): Promise<{ connected: boolean }> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { connected: false };
    const data = await res.json();
    return { connected: data.mcpConnected === true };
  } catch {
    return { connected: false };
  }
}
