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
  children?: FigmaLayer[];
}

interface FigmaFill {
  type: string;
  hex?: string;
  variableName?: string | null;
}

// ─── Proxy Health Check ───────────────────────────────────────────────────

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

/**
 * Main entry point. Tries the real Figma proxy first, falls back to mock data only if explicitly needed.
 */
export async function fetchFigmaNode(url: string): Promise<FigmaNode> {
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
  
  if (node.nodeId) {
    try {
      const imgRes = await fetch(`/api/figma/image?nodeId=${encodeURIComponent(node.nodeId)}`);
      const imgData = await imgRes.json();
      node.previewUrl = imgData.imageUrl;
    } catch {
      node.previewUrl = null;
    }
  }

  return node;
}


