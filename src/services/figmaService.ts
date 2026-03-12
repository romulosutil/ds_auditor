/**
 * figmaService.ts
 * 
 * Fetches Figma node data via the DS Auditor proxy server (server.mjs).
 * The proxy translates REST calls into MCP protocol requests to the Figma Dev MCP
 * running at http://127.0.0.1:3845/mcp.
 * 
 * Falls back to rich mock data if the proxy is not running.
 */

const PROXY_BASE = '/api/figma'; // Proxied via Vite → localhost:3001

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
  letterSpacing?: number;
  lineHeight?: number;
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

// ─── URL Parsing ──────────────────────────────────────────────────────────

/**
 * Extracts the file key and node ID from a Figma URL or returns the raw value.
 * e.g. https://figma.com/design/cwW0MoRfB11C40OnJgf8JV/...?node-id=38-826
 */
export function parseFigmaUrl(url: string): { fileKey: string | null; nodeId: string | null } {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/(design|file)\/([^/]+)/);
    const fileKey = pathMatch ? pathMatch[2] : null;
    const nodeParam = urlObj.searchParams.get('node-id');
    const nodeId = nodeParam ? nodeParam.replace('-', ':') : null;
    return { fileKey, nodeId };
  } catch {
    if (/^\d+[:-]\d+$/.test(url.trim())) return { fileKey: null, nodeId: url.trim() };
    return { fileKey: null, nodeId: null };
  }
}

// ─── Proxy Health Check ───────────────────────────────────────────────────

export async function checkProxyHealth(): Promise<{ connected: boolean; tools: string[] }> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { connected: false, tools: [] };
    const data = await res.json();
    return { connected: data.mcpConnected === true, tools: data.availableTools || [] };
  } catch {
    return { connected: false, tools: [] };
  }
}

// ─── Real Figma Fetch (via Proxy) ─────────────────────────────────────────

async function fetchFromProxy(url: string): Promise<FigmaNode> {
  const res = await fetch(`${PROXY_BASE}/node?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Proxy returned ${res.status}`);
  }

  return res.json();
}

// ─── Mock Fallback Data ───────────────────────────────────────────────────

function getMockFigmaNode(url: string): FigmaNode {
  const { nodeId, fileKey } = parseFigmaUrl(url);
  const id = nodeId ?? 'mock-38:826';

  return {
    nodeId: id,
    fileKey,
    name: 'Header_v2 (Mock)',
    width: 1440,
    height: 680,
    previewUrl: 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356?auto=format&fit=crop&w=800&q=80',
    layers: [
      {
        id: `${id}-1`, name: 'Navigation Bar', type: 'FRAME',
        fills: [{ type: 'SOLID', hex: '#FFFFFF', variableName: 'surface-raised' }],
        gap: 24, padding: 16, cornerRadius: 0,
        children: [
          { id: `${id}-1-1`, name: 'Logo', type: 'VECTOR', fills: [{ type: 'SOLID', hex: '#2B3D72', variableName: 'text-primary' }] },
          {
            id: `${id}-1-2`, name: 'Nav Links', type: 'GROUP', gap: 12, children: [
              { id: `${id}-1-2-1`, name: 'Link/Home', type: 'TEXT', fontFamily: 'Inter', fontSize: 14, fontWeight: 500, fills: [{ type: 'SOLID', hex: '#475B8A', variableName: 'text-secondary' }] },
              { id: `${id}-1-2-2`, name: 'Link/Products', type: 'TEXT', fontFamily: 'Arial', fontSize: 14, fontWeight: 400, fills: [{ type: 'SOLID', hex: '#475B8A', variableName: 'text-secondary' }] }, // ❌ Arial
            ],
          },
          { id: `${id}-1-3`, name: 'CTA Button', type: 'INSTANCE', fills: [{ type: 'SOLID', hex: 'rgb(127,86,217)', variableName: null }], cornerRadius: 6 }, // ❌ hardcoded color, wrong radius
        ],
      },
      {
        id: `${id}-2`, name: 'Hero Section', type: 'FRAME',
        fills: [{ type: 'SOLID', hex: '#F1F5F9', variableName: 'surface-canvas' }],
        gap: 262, padding: 10, cornerRadius: 0,  // ❌ gap and padding not tokens
        children: [
          { id: `${id}-2-1`, name: 'Hero Title', type: 'TEXT', fontFamily: 'Montserrat', fontSize: 48, fontWeight: 700, fills: [{ type: 'SOLID', hex: '#2B3D72', variableName: 'text-primary' }] },
          { id: `${id}-2-2`, name: 'Hero Subtitle', type: 'TEXT', fontFamily: 'Inter', fontSize: 13, fontWeight: 400, fills: [{ type: 'SOLID', hex: '#52525B', variableName: null }] }, // ❌ hardcoded color
          { id: `${id}-2-3`, name: 'Hero CTA', type: 'INSTANCE', fills: [{ type: 'SOLID', hex: '#CA5C07', variableName: 'interactive-primary-default' }], cornerRadius: 8 },
          { id: `${id}-2-4`, name: 'Hero Image', type: 'FRAME', cornerRadius: 3, padding: 10 }, // ❌ radius 3 not in DS
        ],
      },
      {
        id: `${id}-3`, name: 'footer_section', type: 'FRAME', // ❌ naming violation
        fills: [{ type: 'SOLID', hex: '#2B3D72', variableName: 'text-primary' }],
        gap: 32, padding: 64,
        children: [
          { id: `${id}-3-1`, name: 'FooterLink', type: 'TEXT', fontFamily: 'Inter', fontSize: 12, fontWeight: 400, fills: [{ type: 'SOLID', hex: '#a8a8a8', variableName: null }] }, // ❌ hardcoded
        ],
      },
    ],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Main entry point. Tries the real Figma proxy first, falls back to mock data.
 */
export async function fetchFigmaNode(urlOrNodeId: string): Promise<FigmaNode> {
  try {
    const node = await fetchFromProxy(urlOrNodeId);
    console.log('[figmaService] Fetched real Figma node:', node.name);
    return node;
  } catch (err) {
    console.warn('[figmaService] Proxy unavailable, using mock data:', err);
    // Simulate a short delay so the loading spinner shows
    await new Promise(r => setTimeout(r, 800));
    return getMockFigmaNode(urlOrNodeId);
  }
}
