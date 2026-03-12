/**
 * server.mjs — DS Auditor MCP Proxy Server
 * 
 * Bridges the React app (browser) to the Figma MCP server at
 * http://127.0.0.1:3845/mcp using the Streamable HTTP transport.
 * 
 * Run: node server.mjs
 * Listens: http://localhost:3001
 * 
 * API Routes:
 *   GET /api/figma/node?url=<figmaUrl>  → Returns node tree from Figma
 *   GET /api/figma/image?nodeId=<id>&fileKey=<key> → Returns image URL
 *   GET /api/health → Status check
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;
const MCP_URL = 'http://127.0.0.1:3845/mcp';

app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
app.use(express.json());

// ─── Session Management ────────────────────────────────────────────────────
// The Figma MCP uses session-based Streamable HTTP transport (MCP spec 2024-11-05)

let mcpSessionId = null;

/**
 * Calls the Figma MCP server with a JSON-RPC request.
 * Handles session initialization if needed.
 */
async function callMCP(method, params = {}) {
  // Ensure we have a session
  if (!mcpSessionId) {
    await initMCPSession();
  }

  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...(mcpSessionId ? { 'Mcp-Session-Id': mcpSessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  // Capture new session ID from response headers
  const newSessionId = response.headers.get('Mcp-Session-Id');
  if (newSessionId) mcpSessionId = newSessionId;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MCP error ${response.status}: ${text}`);
  }

  const contentType = response.headers.get('content-type') || '';

  // Handle SSE stream (collect the single result)
  if (contentType.includes('text/event-stream')) {
    const text = await response.text();
    // Parse the last "data:" line
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith('data: ')) {
        try {
          return JSON.parse(lines[i].slice(6));
        } catch { /* skip */ }
      }
    }
    throw new Error('No parseable data in SSE stream');
  }

  return response.json();
}

/**
 * Initializes an MCP session by sending the `initialize` handshake.
 */
async function initMCPSession() {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'ds-auditor-proxy', version: '1.0.0' },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP init failed: ${response.status}`);
  }

  const sessionId = response.headers.get('Mcp-Session-Id');
  if (sessionId) mcpSessionId = sessionId;

  // Consume the response body
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    await response.text(); // drain
  } else {
    await response.json().catch(() => {});
  }

  // Send initialized notification
  await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...(mcpSessionId ? { 'Mcp-Session-Id': mcpSessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }),
  }).catch(() => {}); // fire-and-forget

  console.log(`[MCP] Session initialized: ${mcpSessionId}`);
}

/**
 * Extracts the file key and node ID from a Figma URL.
 * e.g. https://www.figma.com/design/cwW0MoRfB11C40OnJgf8JV/...?node-id=38-826
 */
function parseFigmaUrl(url) {
  try {
    const urlObj = new URL(url);
    // Match /design/<fileKey>/ or /file/<fileKey>/
    const pathMatch = urlObj.pathname.match(/\/(design|file)\/([^/]+)/);
    const fileKey = pathMatch ? pathMatch[2] : null;
    const nodeParam = urlObj.searchParams.get('node-id');
    // Figma uses - in URL params but : internally
    const nodeId = nodeParam ? nodeParam.replace('-', ':') : null;
    return { fileKey, nodeId };
  } catch {
    // Bare node ID like "38:826"
    return { fileKey: null, nodeId: url.trim() };
  }
}

/**
 * Extracts a list of available MCP tools from the Figma server.
 */
async function getAvailableTools() {
  const response = await callMCP('tools/list', {});
  if (response?.result?.tools) return response.result.tools;
  return [];
}

// ─── Routes ────────────────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  try {
    if (!mcpSessionId) await initMCPSession();
    const tools = await getAvailableTools();
    res.json({
      status: 'ok',
      mcpConnected: true,
      sessionId: mcpSessionId,
      availableTools: tools.map(t => t.name),
    });
  } catch (err) {
    res.status(503).json({ status: 'error', mcpConnected: false, error: err.message });
  }
});

/**
 * GET /api/figma/node?url=<figmaUrl>
 * 
 * Fetches node metadata from the Figma MCP server.
 * Since Dev Mode MCP doesn't have get_node_details, we use get_metadata
 * and get_design_context to reconstruct the tree.
 */
app.get('/api/figma/node', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url param required' });

  try {
    const { fileKey, nodeId } = parseFigmaUrl(url);
    console.log(`[Proxy] Fetching node (Dev Mode Mode): fileKey=${fileKey}, nodeId=${nodeId}`);

    // 1. Get metadata (XML structure)
    const xmlResult = await callMCP('tools/call', {
      name: 'get_metadata',
      arguments: { nodeId },
    });
    const xml = xmlResult?.result?.content?.[0]?.text || xmlResult?.result || '';

    // 2. Get variables/tokens for the node (to find colors/spacing)
    const varResult = await callMCP('tools/call', {
      name: 'get_variable_defs',
      arguments: { nodeId },
    });
    const variables = varResult?.result || {};

    // 3. Get design context (to find more styles/className)
    const ctxResult = await callMCP('tools/call', {
      name: 'get_design_context',
      arguments: { nodeId },
    });
    const context = ctxResult?.result?.content?.[0]?.text || '';

    // Normalize the MCP response into our FigmaNode format
    console.log('[Proxy] XML snippet:', xml.slice(0, 100));
    console.log('[Proxy] Variables:', JSON.stringify(variables).slice(0, 100));
    const normalized = parseXmlMetadata(xml, nodeId, fileKey, variables, context);
    res.json(normalized);
  } catch (err) {
    console.error('[Proxy] Error fetching node:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/figma/image?nodeId=<id>&fileKey=<key>
 */
app.get('/api/figma/image', async (req, res) => {
  const { nodeId, fileKey } = req.query;
  if (!nodeId || !fileKey) return res.status(400).json({ error: 'nodeId and fileKey required' });

  try {
    const rpcResult = await callMCP('tools/call', {
      name: 'get_screenshot',
      arguments: { nodeId },
    });

    const imageUrl = rpcResult?.result?.content?.[0]?.text || null;
    res.json({ imageUrl });
  } catch (err) {
    console.error('[Proxy] Error fetching image:', err.message);
    res.json({ imageUrl: null });
  }
});

// ─── Data Normalization (XML Parser) ──────────────────────────────────────────

/**
 * Parses the XML metadata returned by get_metadata into a layer tree.
 */
function parseXmlMetadata(xml, targetNodeId, fileKey, variables, context) {
  const layers = [];
  
  // Basic regex to find XML tags and attributes
  // <type id="..." name="..." x="..." y="..." width="..." height="..." [cornerRadius="..."] />
  const tagRegex = /<([a-z]+)\s+id="([^"]+)"\s+name="([^"]+)"\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"([^>]*)\/?>/gi;
  let match;
  
  const allLayersById = new Map();
  const topLevel = [];

  while ((match = tagRegex.exec(xml)) !== null) {
    const [_, type, id, name, x, y, width, height, extra] = match;
    const layer = {
      id,
      name,
      type: type.toUpperCase(),
      width: parseFloat(width) || 0,
      height: parseFloat(height) || 0,
      fills: [],
      children: []
    };

    // Extract cornerRadius if present
    const radiusMatch = extra.match(/cornerRadius="([^"]+)"/i);
    if (radiusMatch) layer.cornerRadius = parseFloat(radiusMatch[1]);

    // Apply tokens if this is the target node or a main component
    if (id === targetNodeId) {
      applyStylesFromVariables(layer, variables);
      applyStylesFromContext(layer, context);
    }

    allLayersById.set(id, layer);
    
    // For simplicity in the auditor, if we can't find parent easily in the flat XML list,
    // we'll just treat them as children based on the XML order (indentation logic is hard with regex)
    // Actually, get_metadata returns a flat list usually but nested nodes have their own tags.
    // In our case, we'll just return the main node and its immediate "children" if found.
    if (id === targetNodeId || targetNodeId === '0:1') {
      topLevel.push(layer);
    }
  }

  // Find the target node
  const root = allLayersById.get(targetNodeId) || topLevel[0] || { id: targetNodeId, name: 'Frame', type: 'FRAME', layers: [] };

  return {
    nodeId: root.id,
    fileKey,
    name: root.name,
    width: root.width,
    height: root.height,
    previewUrl: null,
    layers: topLevel,
    rawVariables: variables,
  };
}

function applyStylesFromVariables(layer, variables) {
  for (const [name, value] of Object.entries(variables)) {
    // Colors
    if (typeof value === 'string' && (value.startsWith('#') || value.startsWith('rgb'))) {
      layer.fills.push({
        type: 'SOLID',
        hex: value,
        variableName: name.replace(/\//g, '-')
      });
    }
    // Radii
    if (name.includes('radius')) {
      layer.cornerRadius = typeof value === 'string' ? parseFloat(value) : (typeof value === 'number' ? value : 0);
    }
    // Typography
    if (typeof value === 'string' && value.includes('Font(')) {
      const fontMatch = value.match(/family: "([^"]+)"/);
      if (fontMatch) layer.fontFamily = fontMatch[1];
      const sizeMatch = value.match(/size: ([^,]+)/);
      if (sizeMatch) layer.fontSize = parseFloat(sizeMatch[1]);
    }
  }
}

function applyStylesFromContext(layer, context) {
  // Search for gap and padding in context code
  const gapMatch = context.match(/gap-\[var\([^,]+,([\d]+)px\)\]/);
  if (gapMatch) layer.gap = parseFloat(gapMatch[1]);

  const padMatch = context.match(/p[xy]?-\[var\([^,]+,([\d]+)px\)\]/);
  if (padMatch) layer.padding = parseFloat(padMatch[1]);
}

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`\n🔌 DS Auditor Proxy Server running at http://localhost:${PORT}`);
  console.log(`📡 Connecting to Figma MCP at ${MCP_URL}...\n`);
  
  try {
    await initMCPSession();
    const tools = await getAvailableTools();
    console.log(`✅ Figma MCP connected! Available tools:`);
    tools.forEach(t => console.log(`   • ${t.name}: ${t.description || ''}`));
  } catch (err) {
    console.warn(`⚠️  Figma MCP connection failed: ${err.message}`);
    console.warn('   Certifique-se que o Figma Desktop App está aberto com o Dev Mode ativo.\n');
  }
});
