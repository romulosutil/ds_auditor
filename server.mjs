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
 *   GET /api/audit/stream?url=... → SSE stream for real-time audit
 */

import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
const PORT = 3001;
const MCP_URL = 'http://127.0.0.1:3845/mcp';

app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
app.use(express.json());

// ─── Session Management ────────────────────────────────────────────────────
let mcpSessionId = null;

async function callMCP(method, params = {}) {
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

  const newSessionId = response.headers.get('Mcp-Session-Id');
  if (newSessionId) mcpSessionId = newSessionId;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MCP error ${response.status}: ${text}`);
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('text/event-stream')) {
    const text = await response.text();
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

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    await response.text();
  } else {
    await response.json().catch(() => {});
  }

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
  }).catch(() => {});

  console.log(`[MCP] Session initialized: ${mcpSessionId}`);
}

function parseFigmaUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/(design|file|board)\/([^/]+)\/([^/]+)?/);
    const fileKey = pathMatch ? pathMatch[2] : null;
    const fileName = pathMatch && pathMatch[3] ? decodeURIComponent(pathMatch[3]).replace(/_/g, ' ') : 'Arquivo Figma';
    const nodeParam = urlObj.searchParams.get('node-id');
    const nodeId = nodeParam ? nodeParam.replace('-', ':') : null;
    return { fileKey, nodeId, fileName };
  } catch {
    if (/^\d+[:-]\d+$/.test(url.trim())) return { fileKey: null, nodeId: url.trim().replace('-', ':'), fileName: 'Frame Direto' };
    return { fileKey: null, nodeId: null, fileName: null };
  }
}

/**
 * POST /api/audit
 */
app.post('/api/audit', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL do Figma é obrigatória' });

  try {
    const { fileKey, nodeId, fileName } = parseFigmaUrl(url);
    if (!nodeId) throw new Error('Não foi possível extrair o Node ID.');

    console.log(`[Audit] Iniciando auditoria para: ${fileName} (${nodeId})`);

    // Step 1: Metadata
    const metaResult = await callMCP('tools/call', { name: 'get_metadata', arguments: { nodeId } });
    const xml = metaResult?.result?.content?.[0]?.text || '';
    const metadata = parseXmlMetadata(xml, nodeId);

    // Step 2: Variables
    const varResult = await callMCP('tools/call', { name: 'get_variable_defs', arguments: { nodeId } });
    let variables = {};
    const varText = varResult?.result?.content?.[0]?.text;
    if (varText) {
      try { variables = JSON.parse(varText); } catch(e) {}
    }

    // Step 3: Context
    const ctxResult = await callMCP('tools/call', { name: 'get_design_context', arguments: { nodeId } });
    const context = ctxResult?.result?.content?.[0]?.text || '';

    // Step 4: Image
    let previewUrl = null;
    try {
      // Timeout de 15s para screenshot
      const imgRes = await Promise.race([
        callMCP('tools/call', { name: 'get_screenshot', arguments: { nodeId } }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao capturar screenshot')), 15000))
      ]);
      previewUrl = imgRes?.result?.content?.[0]?.text || null;
    } catch (e) {
      console.warn(`[Audit] Screenshot falhou: ${e.message}`);
    }

    res.json({
      nodeId,
      fileKey,
      fileName,
      name: metadata.name || 'Frame',
      width: metadata.width || 0,
      height: metadata.height || 0,
      previewUrl,
      layers: [parseXmlTree(xml, nodeId, variables, context)]
    });
  } catch (err) {
    console.error(`[Audit] Erro fatal: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/audit/stream?url=...
 */
app.get('/api/audit/stream', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('URL is required');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (step, progress, message, data = null) => {
    res.write(`data: ${JSON.stringify({ step, progress, message, data })}\n\n`);
  };

  try {
    const { fileKey, nodeId, fileName } = parseFigmaUrl(url);
    if (!nodeId) throw new Error('Não foi possível extrair o Node ID.');

    console.log(`[Stream] Iniciando para: ${fileName} (${nodeId})`);
    sendEvent('init', 10, 'Conectando ao Figma MCP...');
    
    sendEvent('metadata', 20, 'Extraindo estrutura XML...');
    const metaResult = await callMCP('tools/call', { name: 'get_metadata', arguments: { nodeId } });
    const xml = metaResult?.result?.content?.[0]?.text || '';
    const metadata = parseXmlMetadata(xml, nodeId);

    sendEvent('variables', 40, 'Buscando Tokens de Design...');
    const varResult = await callMCP('tools/call', { name: 'get_variable_defs', arguments: { nodeId } });
    let variables = {};
    const varText = varResult?.result?.content?.[0]?.text;
    if (varText) {
      try { variables = JSON.parse(varText); } catch(e) {}
    }

    sendEvent('context', 60, 'Analisando Layout e Propriedades...');
    const ctxResult = await callMCP('tools/call', { name: 'get_design_context', arguments: { nodeId } });
    const context = ctxResult?.result?.content?.[0]?.text || '';

    const rootLayer = parseXmlTree(xml, nodeId, variables, context);

    sendEvent('image', 80, 'Renderizando screenshot do frame...');
    let previewUrl = null;
    try {
      const imgRes = await Promise.race([
        callMCP('tools/call', { name: 'get_screenshot', arguments: { nodeId } }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout screenshot')), 15000))
      ]);
      previewUrl = imgRes?.result?.content?.[0]?.text || null;
    } catch (e) {
      console.warn(`[Stream] Falha no screenshot: ${e.message}`);
      // Continuamos sem preview ao invés de travar
    }

    sendEvent('complete', 100, 'Auditoria pronta!', {
      nodeId,
      fileKey,
      fileName,
      name: metadata.name || 'Frame',
      width: metadata.width || 0,
      height: metadata.height || 0,
      previewUrl,
      layers: [rootLayer]
    });

  } catch (err) {
    console.error(`[Stream] Erro: ${err.message}`);
    sendEvent('error', 0, err.message);
  } finally {
    res.end();
  }
});

app.get('/api/figma/image', async (req, res) => {
  const { nodeId } = req.query;
  try {
    const rpcResult = await callMCP('tools/call', { name: 'get_screenshot', arguments: { nodeId } });
    res.json({ imageUrl: rpcResult?.result?.content?.[0]?.text || null });
  } catch (err) {
    res.json({ imageUrl: null });
  }
});

app.get('/api/image-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('URL is required');
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch fail: ${response.status}`);
    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).send('Proxy error');
  }
});

/**
 * GET /api/audit/annotations?nodeId=...
 * Tenta buscar anotações do Dev Mode via MCP.
 * Retorna { annotations: string | null } — nunca falha (graceful degradation).
 */
app.get('/api/audit/annotations', async (req, res) => {
  const { nodeId } = req.query;
  if (!nodeId) return res.json({ annotations: null });

  const toolsToTry = ['get_annotations', 'get_dev_resources', 'get_comments'];
  for (const toolName of toolsToTry) {
    try {
      const result = await callMCP('tools/call', { name: toolName, arguments: { nodeId } });
      const text = result?.result?.content?.[0]?.text;
      if (text && text.trim()) {
        return res.json({ annotations: text.trim() });
      }
    } catch { /* tool may not exist — continue */ }
  }

  res.json({ annotations: null });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mcpConnected: mcpSessionId !== null });
});

/**
 * Robust XML Tree Reconstruction
 */
function parseXmlTree(xml, targetNodeId, variables, context) {
  if (!xml) return null;
  const tagRegex = /<([\w\d]+)\s+([^>]*)\/?>/gi;
  const attrRegex = /([\w\d-]+)="([^"]*)"/gi;
  const allLayers = new Map();
  let match;
  let firstNode = null;

  while ((match = tagRegex.exec(xml)) !== null) {
    const [_, type, attrString] = match;
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
      x: parseFloat(x) || 0,
      y: parseFloat(y) || 0,
      width: parseFloat(width) || 0,
      height: parseFloat(height) || 0,
      cornerRadius: cornerRadius ? parseFloat(cornerRadius) : undefined,
      fills: [],
      children: []
    };

    if (!firstNode) firstNode = layer;

    const normId = id.replace(/:/g, '-');
    const normTarget = targetNodeId.replace(/:/g, '-');

    if (normId === normTarget) {
      applyStylesFromVariables(layer, variables);
      applyStylesFromContext(layer, context);
    }
    
    allLayers.set(id, layer);
  }

  const normTarget = targetNodeId.replace(/:/g, '-');
  const root = Array.from(allLayers.values()).find(l => l.id.replace(/:/g, '-') === normTarget) || firstNode;
  
  if (!root) return null;

  for (const [id, layer] of allLayers) {
    if (layer === root) continue;
    const lastDash = id.lastIndexOf('-');
    if (lastDash !== -1) {
      const parentId = id.substring(0, lastDash);
      const parent = allLayers.get(parentId);
      if (parent) {
        parent.children.push(layer);
        continue;
      }
    }
    if (!root.children.includes(layer)) {
       root.children.push(layer);
    }
  }

  return root;
}

function parseXmlMetadata(xml, targetNodeId) {
  const tagRegex = /<([\w\d]+)\s+([^>]*)\/?>/gi;
  const attrRegex = /([\w\d-]+)="([^"]*)"/gi;
  let match;
  const normTarget = targetNodeId.replace(/:/g, '-');

  while ((match = tagRegex.exec(xml)) !== null) {
    const [_, type, attrString] = match;
    const attrs = {};
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrString)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    if (attrs.id && attrs.id.replace(/:/g, '-') === normTarget) {
      return {
        name: attrs.name,
        width: parseFloat(attrs.width),
        height: parseFloat(attrs.height)
      };
    }
  }
  return { name: 'Frame', width: 0, height: 0 };
}

function applyStylesFromVariables(layer, variables) {
  for (const [name, value] of Object.entries(variables)) {
    const valStr = String(value);
    if (valStr.startsWith('#') || valStr.startsWith('rgb')) {
      layer.fills.push({
        type: 'SOLID',
        hex: valStr.toUpperCase(),
        variableName: name.replace(/\//g, '-')
      });
    }
    if (name.toLowerCase().includes('radius')) layer.cornerRadius = parseFloat(valStr);
    if (valStr.includes('Font(')) {
      const f = valStr.match(/family: "([^"]+)"/);
      if (f) layer.fontFamily = f[1];
      const s = valStr.match(/size: ([\d.]+)/);
      if (s) layer.fontSize = parseFloat(s[1]);
    }
  }
}

function applyStylesFromContext(layer, context) {
  const gMatch = context.match(/gap-\[var\([^,]+,([\d.]+)px\)\]|gap-([\d.]+)/);
  if (gMatch) layer.gap = parseFloat(gMatch[1] || gMatch[2]);
  const pMatch = context.match(/p[xy]-\[var\([^,]+,([\d.]+)px\)\]|p-([\d.]+)/);
  if (pMatch) layer.padding = parseFloat(pMatch[1] || pMatch[2]);
}

/**
 * POST /api/extract-dom
 * Body: { url: string, viewports: number[] }
 *
 * Usa Puppeteer para acessar a URL, aguarda carregamento e extrai
 * uma árvore simplificada do DOM com getComputedStyle por breakpoint.
 * Suporta N frames Figma → resize do viewport por largura.
 */
app.post('/api/extract-dom', async (req, res) => {
  const { url, viewports = [1440] } = req.body;
  if (!url) return res.status(400).json({ error: 'URL é obrigatória' });

  let browser = null;
  try {
    console.log(`[ExtractDOM] Iniciando extração: ${url}`);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const results = [];

    for (const viewportWidth of viewports) {
      const page = await browser.newPage();
      await page.setViewport({ width: viewportWidth, height: 900 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Extrai árvore simplificada do DOM com computed styles
      const domTree = await page.evaluate((width) => {
        const RELEVANT_TAGS = ['button', 'input', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label', 'select', 'textarea', 'nav', 'header', 'footer', 'section', 'main', 'div', 'form', 'li', 'ul', 'ol', 'img'];
        const STYLE_PROPS = ['backgroundColor', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'gap', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'display', 'flexDirection', 'alignItems', 'justifyContent', 'borderRadius', 'width', 'height', 'borderWidth', 'borderColor', 'boxShadow'];

        function extractElement(el, depth = 0) {
          if (depth > 6) return null;
          const tag = el.tagName?.toLowerCase();
          if (!RELEVANT_TAGS.includes(tag)) return null;

          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return null;

          const cs = window.getComputedStyle(el);
          const styles = {};
          for (const prop of STYLE_PROPS) styles[prop] = cs[prop] || '';

          const text = (el.innerText || el.textContent || '').trim().slice(0, 100);
          const children = Array.from(el.children)
            .map(child => extractElement(child, depth + 1))
            .filter(Boolean);

          return {
            tagName: tag,
            text,
            role: el.getAttribute('aria-label') || el.getAttribute('role') || '',
            placeholder: el.getAttribute('placeholder') || '',
            computedStyles: styles,
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
            children,
          };
        }

        const body = document.body;
        return {
          viewport: width,
          title: document.title,
          elements: Array.from(body.children).map(el => extractElement(el, 0)).filter(Boolean),
        };
      }, viewportWidth);

      // Captura screenshot deste viewport
      let screenshotBase64 = null;
      try {
        const screenshot = await page.screenshot({ type: 'png', fullPage: false });
        screenshotBase64 = `data:image/png;base64,${screenshot.toString('base64')}`;
      } catch { /* screenshot opcional */ }

      results.push({ ...domTree, screenshotBase64 });
      await page.close();
      console.log(`[ExtractDOM] Viewport ${viewportWidth}px extraída com sucesso`);
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error(`[ExtractDOM] Erro: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, async () => {
  console.log(`🔌 DS Auditor Proxy running at http://localhost:${PORT}`);
  try {
    await initMCPSession();
  } catch (err) {
    console.warn(`⚠️ MCP connection failed: ${err.message}`);
  }
});
