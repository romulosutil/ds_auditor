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
 */
function parseFigmaUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/(design|file|board)\/([^/]+)/);
    const fileKey = pathMatch ? pathMatch[2] : null;
    const nodeParam = urlObj.searchParams.get('node-id');
    const nodeId = nodeParam ? nodeParam.replace('-', ':') : null;
    return { fileKey, nodeId };
  } catch {
    // Se não for URL, tenta tratar como Node ID direto
    if (/^\d+[:-]\d+$/.test(url.trim())) return { fileKey: null, nodeId: url.trim().replace('-', ':') };
    return { fileKey: null, nodeId: null };
  }
}
/**
 * POST /api/audit
 * 
 * Receives a Figma URL, extracts FileKey/NodeID, and runs the MCP toolchain.
 */
app.post('/api/audit', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL do Figma é obrigatória' });

  try {
    const { fileKey, nodeId } = parseFigmaUrl(url);
    if (!nodeId) throw new Error('Não foi possível extrair o Node ID da URL fornecida.');

    console.log(`[Proxy] Iniciando Auditoria: File=${fileKey}, Node=${nodeId}`);

    // Passo 1: Get Metadata (Estrutura XML)
    console.log('[Proxy] Passo 1: Coletando metadados...');
    const xmlResult = await callMCP('tools/call', {
      name: 'get_metadata',
      arguments: { nodeId },
    });
    const xml = xmlResult?.result?.content?.[0]?.text || xmlResult?.result || '';

    // Passo 2: Get Variables (Tokens de Design)
    console.log('[Proxy] Passo 2: Extraindo definições de variáveis...');
    const varResult = await callMCP('tools/call', {
      name: 'get_variable_defs',
      arguments: { nodeId },
    });
    let variables = {};
    const varText = varResult?.result?.content?.[0]?.text;
    if (varText) {
      try {
        variables = JSON.parse(varText);
      } catch (e) {
        console.warn('[Proxy] Falha ao parsear variáveis:', e.message);
      }
    }

    // Passo 3: Get Design Context (Layout e Propriedades específicas)
    console.log('[Proxy] Passo 3: Analisando contexto de design...');
    const ctxResult = await callMCP('tools/call', {
      name: 'get_design_context',
      arguments: { nodeId },
    });
    // O design_context pode vir como texto puro ou JSON dependendo do MCP, tratamos ambos
    const context = ctxResult?.result?.content?.[0]?.text || '';

    // Reconstruir o objeto do nó para o motor de auditoria
    const normalized = parseXmlMetadata(xml, nodeId, fileKey, variables, context);
    
    res.json(normalized);
  } catch (err) {
    console.error('[Proxy] Falha na Auditoria:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * MANTIDO PARA COMPATIBILIDADE: GET /api/figma/node?url=<figmaUrl>
 */
app.get('/api/figma/node', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url param required' });

  try {
    const { fileKey, nodeId } = parseFigmaUrl(url);
    const xmlResult = await callMCP('tools/call', { name: 'get_metadata', arguments: { nodeId } });
    const xml = xmlResult?.result?.content?.[0]?.text || xmlResult?.result || '';
    const varResult = await callMCP('tools/call', { name: 'get_variable_defs', arguments: { nodeId } });
    const variables = varResult?.result || {};
    const ctxResult = await callMCP('tools/call', { name: 'get_design_context', arguments: { nodeId } });
    const context = ctxResult?.result?.content?.[0]?.text || '';

    const normalized = parseXmlMetadata(xml, nodeId, fileKey, variables, context);
    res.json(normalized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/figma/image?nodeId=<id>
 */
app.get('/api/figma/image', async (req, res) => {
  const { nodeId } = req.query;
  try {
    const rpcResult = await callMCP('tools/call', {
      name: 'get_screenshot',
      arguments: { nodeId },
    });
    const imageUrl = rpcResult?.result?.content?.[0]?.text || null;
    res.json({ imageUrl });
  } catch (err) {
    res.json({ imageUrl: null });
  }
});

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mcpConnected: mcpSessionId !== null,
    mcpSessionId
  });
});

// ─── Data Normalization (XML Parser) ──────────────────────────────────────────

/**
 * Parses the XML metadata returned by get_metadata into a layer tree.
 */
function parseXmlMetadata(xml, targetNodeId, fileKey, variables, context) {
  // Regex robusta para capturar atributos XML
  const tagRegex = /<([a-z0-9]+)\s+([^>]*)\/?>/gi;
  const attrRegex = /([a-z]+)="([^"]*)"/gi;
  
  let match;
  const topLevel = [];
  const allLayersById = new Map();

  while ((match = tagRegex.exec(xml)) !== null) {
    const [fullTag, type, attrString] = match;
    const attrs = {};
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrString)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }

    const { id, name, x, y, width, height, cornerRadius } = attrs;
    if (!id) continue;

    const layer = {
      id,
      name: name || id,
      type: type.toUpperCase(),
      width: parseFloat(width) || 0,
      height: parseFloat(height) || 0,
      cornerRadius: cornerRadius ? parseFloat(cornerRadius) : undefined,
      fills: [],
      children: []
    };

    // Aplicar estilos apenas ao nó alvo ou se for um componente filho relevante
    // Nota: O Dev Mode MCP costuma retornar variáveis e propriedades apenas para o nó selecionado
    // mas o XML contém a árvore. Aqui tentamos propagar ou aplicar onde possível.
    if (id === targetNodeId) {
      applyStylesFromVariables(layer, variables);
      applyStylesFromContext(layer, context);
    }

    allLayersById.set(id, layer);
    
    // Tenta encontrar o pai na árvore (pelo ID se for hierárquico, ex: "1:2-3" pai de "1:2-4"?)
    // No XML do Figma MCP, as tags costumam vir aninhadas, mas nossa regex é flat.
    // Para simplificar e garantir resultados reais para o motor de auditoria, 
    // assumimos que tudo que não é o targetNodeId é filho dele se o targetNodeId for o root do XML.
    if (id !== targetNodeId) {
      const rootPayload = allLayersById.get(targetNodeId);
      if (rootPayload) {
        rootPayload.children.push(layer);
      }
    } else {
      topLevel.push(layer);
    }
  }

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
    const valStr = String(value);
    // Cores
    if (valStr.startsWith('#') || valStr.startsWith('rgb')) {
      layer.fills.push({
        type: 'SOLID',
        hex: valStr.toUpperCase(),
        variableName: name.replace(/\//g, '-')
      });
    }
    // Raios
    if (name.toLowerCase().includes('radius')) {
      layer.cornerRadius = parseFloat(valStr);
    }
    // Tipografia
    if (valStr.includes('Font(')) {
      const fontMatch = valStr.match(/family: "([^"]+)"/);
      if (fontMatch) layer.fontFamily = fontMatch[1];
      const sizeMatch = valStr.match(/size: ([\d.]+)/);
      if (sizeMatch) layer.fontSize = parseFloat(sizeMatch[1]);
      const weightMatch = valStr.match(/weight: ([\d.]+)/);
      if (weightMatch) layer.fontWeight = parseFloat(weightMatch[1]);
    }
  }
}

function applyStylesFromContext(layer, context) {
  // Parsing de gap e padding via Regex no código gerado pelo context
  const gapMatch = context.match(/gap-\[var\([^,]+,([\d.]+)px\)\]|gap-([\d.]+)/);
  if (gapMatch) layer.gap = parseFloat(gapMatch[1] || gapMatch[2]);

  const pMatch = context.match(/p[xy]-\[var\([^,]+,([\d.]+)px\)\]|p-([\d.]+)/);
  if (pMatch) layer.padding = parseFloat(pMatch[1] || pMatch[2]);
}

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`\n🔌 DS Auditor Proxy Server running at http://localhost:${PORT}`);
  console.log(`📡 Connecting to Figma MCP at ${MCP_URL}...\n`);
  
  try {
    await initMCPSession();
    console.log(`✅ Figma MCP conectado com sucesso!`);
  } catch (err) {
    console.warn(`⚠️  Figma MCP connection failed: ${err.message}`);
  }
});
