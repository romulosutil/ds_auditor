/**
 * generate_report.js
 * Gera o relatório de DS Auditor com 3 entregáveis:
 * 1. Auditoria de Jornada (8 frames Figma)
 * 2. Design vs. Código (Figma x checkout_app)
 * 3. Análise de Componente (Action Cards)
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, Header, Footer, PageBreak
} = require('docx');
const fs = require('fs');

// ─── Helpers ──────────────────────────────────────────────────────────────

const ACCENT   = "2B3D72";   // azul DS
const GREEN    = "059669";
const RED      = "DC2626";
const YELLOW   = "D97706";
const BLUE     = "3B82F6";
const GRAY     = "71717A";
const LIGHTBG  = "F4F4F5";
const REDBG    = "FEF2F2";
const GREENBG  = "ECFDF5";
const YELLOWBG = "FFFBEB";
const BLUEBG   = "EFF6FF";

const COL_W = 9026; // A4 content width in DXA (1" margins)

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, size: 36, color: ACCENT, font: "Arial" })]
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: ACCENT, font: "Arial" })]
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, color: "18181B", font: "Arial" })]
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, size: 22, font: "Arial", ...opts })]
  });
}
function bullet(text, color = "18181B", icon = "•") {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text: `${icon}  ${text}`, size: 22, font: "Arial", color })]
  });
}
function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "E4E4E7", space: 1 } },
    children: []
  });
}
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}
function badge(text, bgColor, textColor = "FFFFFF") {
  return new TableCell({
    width: { size: 1800, type: WidthType.DXA },
    shading: { fill: bgColor, type: ShadingType.CLEAR },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
    },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 18, color: textColor, font: "Arial" })]
    })]
  });
}

function statusRow(label, value, status) {
  const statusColors = {
    ok:      { bg: GREENBG, fg: GREEN,  icon: "✓ OK" },
    warning: { bg: YELLOWBG,fg: YELLOW, icon: "⚠ Aviso" },
    error:   { bg: REDBG,   fg: RED,    icon: "✗ Erro" },
    info:    { bg: BLUEBG,  fg: BLUE,   icon: "i Info" },
  };
  const s = statusColors[status] || statusColors.info;
  const border = { style: BorderStyle.SINGLE, size: 1, color: "E4E4E7" };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new TableRow({ children: [
    new TableCell({
      width: { size: 3500, type: WidthType.DXA }, borders,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: "Arial" })] })]
    }),
    new TableCell({
      width: { size: 4026, type: WidthType.DXA }, borders,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: value, size: 20, font: "Arial", color: "3F3F46" })] })]
    }),
    new TableCell({
      width: { size: 1500, type: WidthType.DXA }, borders,
      shading: { fill: s.bg, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: s.icon, bold: true, size: 18, font: "Arial", color: s.fg })]
      })]
    }),
  ]});
}

function sectionTable(rows) {
  return new Table({
    width: { size: COL_W, type: WidthType.DXA },
    columnWidths: [3500, 4026, 1500],
    rows
  });
}

// ─── DATA ─────────────────────────────────────────────────────────────────

const FRAMES = [
  { nodeId: "24-776",  name: "Frame (Checkout - Passo 1)",    width: 0,    height: 0,   fills: 0,  font: null,        fontSize: null,   gap: null, padding: null, children: 0,  status: "warning" },
  { nodeId: "24-936",  name: "Frame 1 (Badge/Tag)",            width: 85,   height: 27,  fills: 3,  font: "Inter",     fontSize: 12.8,   gap: null, padding: 8,    children: 1,  status: "warning" },
  { nodeId: "24-995",  name: "Frame 8 (Header/Banner)",        width: 1001, height: 93,  fills: 3,  font: "Montserrat",fontSize: 22.4,   gap: null, padding: null, children: 1,  status: "warning" },
  { nodeId: "24-1061", name: "Frame 5 (Botao/CTA)",            width: 120,  height: 44,  fills: 4,  font: "Inter",     fontSize: 12.8,   gap: null, padding: 8,    children: 2,  status: "ok" },
  { nodeId: "24-1112", name: "Frame (Confirmacao)",            width: 0,    height: 0,   fills: 0,  font: null,        fontSize: null,   gap: null, padding: null, children: 0,  status: "error" },
  { nodeId: "24-1568", name: "Frame 3 (Mobile - Selecao)",     width: 412,  height: 308, fills: 3,  font: "Inter",     fontSize: 16,     gap: null, padding: null, children: 14, status: "ok" },
  { nodeId: "38-431",  name: "Frame (Estado Vazio / Error)",   width: 0,    height: 0,   fills: 0,  font: null,        fontSize: null,   gap: null, padding: null, children: 0,  status: "error" },
  { nodeId: "38-448",  name: "Frame (Sucesso)",                width: 0,    height: 0,   fills: 0,  font: null,        fontSize: null,   gap: null, padding: null, children: 0,  status: "error" },
];

const JOURNEY_ISSUES = [
  { cat: "Nomenclatura", sev: "error",   desc: "Frames nomeados genericamente ('Frame', 'Frame 1', 'Frame 3'...). O DS4FUN requer nomes semânticos no padrão Fluxo/Tela/Breakpoint, ex: 'Checkout/Selecao-Metodo/Desktop'.", frame: "Todos" },
  { cat: "Dimensoes",    sev: "error",   desc: "5 dos 8 frames retornaram dimensoes 0x0 via MCP. Provavelmente sao grupos ou paginas raiz, nao frames com Auto Layout. Corrija convertendo para Frame com tamanho definido.", frame: "24-776, 24-1112, 38-431, 38-448 e outros" },
  { cat: "Tipografia",   sev: "warning", desc: "Font-size 12.8px (0.8rem) detectado nos frames 24-936 e 24-1061. O limite minimo DS4FUN e 12px para captions. Se for corpo de texto, deve ser 14px (0.875rem).", frame: "24-936, 24-1061" },
  { cat: "Tipografia",   sev: "warning", desc: "Font-size 22.4px (1.4rem) no Frame 8. Nao pertence ao scale tipografico DS4FUN (12/14/16/18/20/24/28/32/36/48px). Aproximar para 24px.", frame: "24-995" },
  { cat: "Breakpoints",  sev: "warning", desc: "Frame 8 tem 1001px de largura, nao padrao. DS4FUN define Mobile (375px), Tablet (768px), Desktop (1440px). Considere separar em frames nos breakpoints corretos.", frame: "24-995" },
  { cat: "Dev Mode",     sev: "warning", desc: "Anotacoes do Dev Mode indisponiveis para todos os frames (erro de API do MCP). Verifique se o arquivo Figma esta em modo Dev habilitado e compartilhado.", frame: "Todos" },
  { cat: "Componentes",  sev: "ok",      desc: "Fontes utilizadas (Inter e Montserrat) sao as fontes oficiais do DS4FUN. Conformidade de tipografia de base: aprovada.", frame: "24-936, 24-995, 24-1061, 24-1568" },
  { cat: "Espacamento",  sev: "ok",      desc: "Padding de 8px detectado nos componentes — corresponde ao token spacing-2 do DS4FUN.", frame: "24-936, 24-1061" },
];

const DVC_ISSUES = [
  { sev: "ok",      cat: "Tipografia",      desc: "Fontes Inter e Montserrat aplicadas corretamente conforme DS4FUN. Sem substituicoes ou fontes externas nao autorizadas no corpo principal." },
  { sev: "ok",      cat: "Espacamento",     desc: "Gap entre cards de opcao: 16px (spacing-4 DS4FUN). Card padding: 16px. Container gap: 48px desktop / 32px mobile. Todos os valores estao no scale do DS4FUN." },
  { sev: "ok",      cat: "Responsividade",  desc: "Comportamento responsivo correto: container gap reduz de 48px para 32px e padding horizontal de 32px para 16px entre 1440px e 412px. Implementacao aprovada." },
  { sev: "warning", cat: "Cores",           desc: "Cor de heading rgb(43,61,114) = #2B3D72 e cor de body rgb(71,91,138) = #475B8A. Verificar se estes valores correspondem a tokens semanticos do DS4FUN (ex: color-text-primary, color-text-secondary) ou se foram aplicadas cores hardcoded." },
  { sev: "warning", cat: "Cores",           desc: "Cor de fundo dos icones rgb(247,250,253) = #F7FAFD (card de icone). Nao e um valor padrao do DS4FUN. Verificar se existe token para 'surface-subtle' ou 'background-icon'." },
  { sev: "warning", cat: "Icones",          desc: "Biblioteca 'Material Symbols Outlined' (Google Fonts) sendo usada para o icone de cartao de credito. O DS4FUN pode ter iconografia propria. Verificar se existe token/componente Icon aprovado e substituir para garantir consistencia." },
  { sev: "warning", cat: "H1 Font Size",    desc: "H1 renderizado a 28.8px (1.8rem). Verificar se o DS4FUN define especificamente o tamanho do heading de pagina de checkout. O scale tipografico DS4FUN inclui 28px e 32px — 28.8px sugere uso de rem sem snap ao scale." },
  { sev: "error",   cat: "Interatividade",  desc: "Ausencia de estados visuais hover/focus/active nos cards de selecao de pagamento (Pix, Cartao de debito). Os elementos <a> nao apresentam CSS de estado interativo nos computed styles. Adicionar :hover, :focus-visible e :active com feedback visual (elevacao, borda, cor)." },
  { sev: "error",   cat: "Acessibilidade",  desc: "Os cards de selecao de metodo de pagamento sao elementos <a> sem aria-label descritivo. Ex: <a href='...' aria-label='Selecionar Pix instantaneo'>. Necessario para screen readers (WCAG 2.1 AA)." },
  { sev: "warning", cat: "Acessibilidade",  desc: "Titulo da pagina ('Checkout - Passo 1') indica apenas 1 de N passos, mas nao ha progressbar ou aria-current step no DOM extraido. Verificar se stepper de progresso esta presente na tela." },
  { sev: "warning", cat: "Multiplas Telas", desc: "O checkout_app possui 5 arquivos HTML (index, debit-card, checkout-1click, checkout-processing, checkout-success), cada um corresponde a uma etapa da jornada. A extracao analisou apenas o index.html. Recomendado rodar extracao em cada arquivo individualmente." },
];

const COMP_VARIANTS = [
  { size: "md", selected: "Nao", states: ["Default","Focus","Hover","Disabled"], missing: ["Active/Pressed","Loading","Error"] },
  { size: "md", selected: "Sim", states: ["Default","Evidence"],                 missing: ["Hover","Focus","Active/Pressed","Loading","Disabled"] },
  { size: "sm", selected: "Nao", states: ["Default","Focus","Hover","Disabled"], missing: ["Active/Pressed","Loading","Error"] },
  { size: "sm", selected: "Sim", states: ["Default","Evidence"],                 missing: ["Hover","Focus","Active/Pressed","Loading","Disabled"] },
  { size: "lg", selected: "Nao", states: ["Default","Focus","Hover","Disabled"], missing: ["Active/Pressed","Loading","Error"] },
  { size: "lg", selected: "Sim", states: ["Default","Evidence"],                 missing: ["Hover","Focus","Active/Pressed","Loading","Disabled"] },
];

const COMP_SUGGESTIONS = [
  { priority: "Alta",   state: "Active / Pressed",             desc: "Feedback tatil ao clicar no card. Impacto direto na percepcao de qualidade para o usuario. Aplicar para todos os tamanhos (sm/md/lg) x Selected=False." },
  { priority: "Alta",   state: "Loading",                      desc: "Estado apos selecao, enquanto o sistema processa a escolha do metodo. Essencial para fluxos de checkout assincronos. Aplicar para todos os tamanhos x ambos Selected." },
  { priority: "Alta",   state: "Selected=true + Hover",        desc: "Hover sobre card ja selecionado. Sem este estado, o usuario nao tem feedback visual ao passar o cursor sobre sua escolha." },
  { priority: "Alta",   state: "Selected=true + Focus",        desc: "Foco de teclado sobre card ja selecionado. Obrigatorio para acessibilidade WCAG 2.1 AA (navegacao por teclado)." },
  { priority: "Media",  state: "Error",                        desc: "Metodo de pagamento indisponivel ou com problema. Ex: 'Pix temporariamente indisponivel'. Aplicar para todos os tamanhos." },
  { priority: "Media",  state: "Selected=true + Disabled",     desc: "Opcao selecionada que se torna indisponivel (ex: limite atingido). Usuario precisa entender que sua selecao nao e mais valida." },
  { priority: "Baixa",  state: "Renomear Evidence -> Selected/Highlight", desc: "O nome 'Evidence' nao e intuitivo. Considerar 'Selected/Highlight' ou 'Selected/Active' para maior clareza na biblioteca." },
  { priority: "Baixa",  state: "Documentar transicoes de estado", desc: "Adicionar annotation ou nota no Dev Mode documentando transicoes: Default -> Hover -> Active -> Selected -> Selected+Hover." },
];

// ─── DOCUMENT ─────────────────────────────────────────────────────────────

const border = { style: BorderStyle.SINGLE, size: 1, color: "E4E4E7" };
const borders = { top: border, bottom: border, left: border, right: border };

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: ACCENT },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: ACCENT },
        paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "18181B" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E4E4E7", space: 1 } },
          children: [
            new TextRun({ text: "DS Auditor  |  Relatorio Checkout x DS4FUN  |  2026", size: 18, color: GRAY, font: "Arial" }),
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E4E4E7", space: 1 } },
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: "Pagina ", size: 18, color: GRAY, font: "Arial" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: GRAY, font: "Arial" }),
            new TextRun({ text: " de ", size: 18, color: GRAY, font: "Arial" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: GRAY, font: "Arial" }),
          ]
        })]
      })
    },
    children: [

      // ════ CAPA ════════════════════════════════════════════════════════
      new Paragraph({
        spacing: { before: 1800, after: 400 },
        children: [new TextRun({ text: "DS AUDITOR", bold: true, size: 64, color: ACCENT, font: "Arial" })]
      }),
      new Paragraph({
        spacing: { before: 0, after: 200 },
        children: [new TextRun({ text: "Relatorio de Qualidade de Design", size: 40, color: "3F3F46", font: "Arial" })]
      }),
      new Paragraph({
        spacing: { before: 0, after: 600 },
        children: [new TextRun({ text: "Projeto Checkout  |  Design System DS4FUN v1.4.0", size: 26, color: GRAY, font: "Arial" })]
      }),
      new Table({
        width: { size: COL_W, type: WidthType.DXA },
        columnWidths: [2200, 2200, 2200, 2426],
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 2200, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 160, right: 160 }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "8", bold: true, size: 56, color: "FFFFFF", font: "Arial" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Frames Auditados", size: 18, color: "FFFFFF", font: "Arial" })] }),
            ]
          }),
          new TableCell({ width: { size: 2200, type: WidthType.DXA }, shading: { fill: "475B8A", type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 160, right: 160 }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "18", bold: true, size: 56, color: "FFFFFF", font: "Arial" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Variantes do Comp.", size: 18, color: "FFFFFF", font: "Arial" })] }),
            ]
          }),
          new TableCell({ width: { size: 2200, type: WidthType.DXA }, shading: { fill: RED, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 160, right: 160 }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "4", bold: true, size: 56, color: "FFFFFF", font: "Arial" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Criticos (total)", size: 18, color: "FFFFFF", font: "Arial" })] }),
            ]
          }),
          new TableCell({ width: { size: 2426, type: WidthType.DXA }, shading: { fill: YELLOW, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 160, right: 160 }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "12", bold: true, size: 56, color: "FFFFFF", font: "Arial" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Avisos (total)", size: 18, color: "FFFFFF", font: "Arial" })] }),
            ]
          }),
        ]})]
      }),
      new Paragraph({ spacing: { before: 400, after: 80 }, children: [new TextRun({ text: "Entregaveis neste documento:", bold: true, size: 24, font: "Arial", color: "18181B" })] }),
      body("1.  Auditoria de Jornada — conformidade dos 8 frames com o DS4FUN"),
      body("2.  Design vs. Codigo — comparacao do Figma com a implementacao HTML/CSS"),
      body("3.  Analise de Componente — cobertura de estados do Action Cards"),
      new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: "Gerado por DS Auditor v4.0  •  16/03/2026", size: 18, color: GRAY, font: "Arial" })] }),

      pageBreak(),

      // ════ ENTREGAVEL 1: JORNADA ═══════════════════════════════════════
      h1("Entregavel 1  —  Auditoria de Jornada"),
      body("Analise de aderencia dos 8 frames do fluxo de Checkout ao Design System DS4FUN v1.4.0. A auditoria verifica nomenclatura, tipografia, espacamento, dimensoes e conformidade geral de cada frame."),
      divider(),

      h2("Sumario dos Frames"),
      sectionTable([
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ width: { size: 3500, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "Frame / Node ID", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
            new TableCell({ width: { size: 4026, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "Dados Extraidos", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
            new TableCell({ width: { size: 1500, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Status", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
          ]
        }),
        ...FRAMES.map((f, i) => {
          const details = [
            f.width ? `${f.width}x${f.height}px` : "Sem dimensoes",
            f.font ? `Fonte: ${f.font} ${f.fontSize}px` : "Sem dados de fonte",
            f.fills > 0 ? `${f.fills} fills` : "Sem fills",
            f.padding !== null ? `padding: ${f.padding}px` : null,
            f.children > 0 ? `${f.children} filhos` : null,
          ].filter(Boolean).join("  |  ");
          const statusMap = { ok: GREENBG, warning: YELLOWBG, error: REDBG };
          const statusIcon = { ok: "✓ OK", warning: "⚠ Parcial", error: "✗ Erro" };
          const statusColor = { ok: GREEN, warning: YELLOW, error: RED };
          return new TableRow({ children: [
            new TableCell({ width: { size: 3500, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({ children: [new TextRun({ text: `${i+1}. ${f.name}`, bold: true, size: 19, font: "Arial" })] }),
                new Paragraph({ children: [new TextRun({ text: f.nodeId, size: 17, color: GRAY, font: "Courier New" })] }),
              ] }),
            new TableCell({ width: { size: 4026, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: details, size: 19, font: "Arial", color: "3F3F46" })] })] }),
            new TableCell({ width: { size: 1500, type: WidthType.DXA }, borders, shading: { fill: statusMap[f.status], type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: statusIcon[f.status], bold: true, size: 18, font: "Arial", color: statusColor[f.status] })] })] }),
          ]});
        })
      ]),

      new Paragraph({ spacing: { before: 400, after: 200 }, children: [] }),
      h2("Problemas e Recomendacoes"),

      ...JOURNEY_ISSUES.map(issue => {
        const colors = { error: RED, warning: YELLOW, ok: GREEN };
        const icons  = { error: "[ERRO]", warning: "[AVISO]", ok: "[OK]" };
        return new Paragraph({
          spacing: { before: 100, after: 100 },
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: `${icons[issue.sev]} `, bold: true, size: 20, color: colors[issue.sev], font: "Arial" }),
            new TextRun({ text: `[${issue.cat}] `, bold: true, size: 20, color: "18181B", font: "Arial" }),
            new TextRun({ text: issue.desc, size: 20, font: "Arial", color: "3F3F46" }),
            new TextRun({ text: `  (Frames: ${issue.frame})`, size: 18, color: GRAY, font: "Arial" }),
          ]
        });
      }),

      new Paragraph({ spacing: { before: 300, after: 200 }, children: [] }),
      h2("Acoes Prioritarias para o Designer"),
      sectionTable([
        new TableRow({ tableHeader: true, children: [
          new TableCell({ width: { size: 3500, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Acao", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
          new TableCell({ width: { size: 4026, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Detalhes", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
          new TableCell({ width: { size: 1500, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Prioridade", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
        ]}),
        statusRow("Renomear todos os frames", "Usar padrao: Checkout/Tela/Breakpoint (ex: Checkout/Selecao-Metodo/Desktop)", "error"),
        statusRow("Converter frames 0x0", "Selecionar camada > Criar Frame com Layout definido (1440, 768 ou 375px)", "error"),
        statusRow("Corrigir font-size 12.8px", "Arredondar para 12px (caption) ou 14px (body2) conforme scale DS4FUN", "warning"),
        statusRow("Corrigir 22.4px para 24px", "Alterar fonte do heading do Frame 8 para 24px (DS4FUN: heading-sm)", "warning"),
        statusRow("Habilitar Dev Mode", "Garantir que o arquivo Figma permite acesso a anotacoes via API MCP", "warning"),
        statusRow("Revisar breakpoint 1001px", "Substituir por 1440px (desktop) ou 768px (tablet)", "warning"),
      ]),

      pageBreak(),

      // ════ ENTREGAVEL 2: DESIGN VS. CODIGO ════════════════════════════
      h1("Entregavel 2  —  Design vs. Codigo"),
      body("Comparacao entre os frames Figma do Checkout e a implementacao front-end estatica (checkout_app). O navegador headless (Puppeteer) acessou http://localhost:8080 nos viewports de 1440px (desktop) e 412px (mobile) e extraiu os computed styles do DOM renderizado."),
      divider(),

      h2("Ambiente Analisado"),
      sectionTable([
        statusRow("URL analisada", "http://localhost:8080/index.html (Checkout - Passo 1)", "info"),
        statusRow("Arquivos HTML", "index.html, debit-card.html, checkout-1click.html, checkout-processing.html, checkout-success.html", "info"),
        statusRow("Viewports extraidos", "1440px (Desktop) e 412px (Mobile)", "ok"),
        statusRow("Framework", "HTML/CSS puro — sem framework JS", "ok"),
        statusRow("DOM extraido", "25 elementos relevantes por viewport", "ok"),
      ]),

      new Paragraph({ spacing: { before: 300, after: 160 }, children: [] }),
      h2("Resultados da Comparacao"),

      ...DVC_ISSUES.map(issue => {
        const colors = { error: RED, warning: YELLOW, ok: GREEN };
        const icons  = { error: "[ERRO]", warning: "[AVISO]", ok: "[OK]" };
        return new Paragraph({
          spacing: { before: 100, after: 100 },
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: `${icons[issue.sev]} `, bold: true, size: 20, color: colors[issue.sev], font: "Arial" }),
            new TextRun({ text: `[${issue.cat}] `, bold: true, size: 20, color: "18181B", font: "Arial" }),
            new TextRun({ text: issue.desc, size: 20, font: "Arial", color: "3F3F46" }),
          ]
        });
      }),

      new Paragraph({ spacing: { before: 300, after: 200 }, children: [] }),
      h2("Comparativo de Tokens Detectados"),
      new Table({
        width: { size: COL_W, type: WidthType.DXA },
        columnWidths: [2500, 2500, 2500, 1526],
        rows: [
          new TableRow({ tableHeader: true, children: [
            new TableCell({ width: { size: 2500, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "Propriedade", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
            new TableCell({ width: { size: 2500, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "Valor no Codigo", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
            new TableCell({ width: { size: 2500, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "Token DS4FUN", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
            new TableCell({ width: { size: 1526, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Status", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
          ]}),
          ...[
            ["font-family (body)", "Inter, sans-serif", "font-family-primary: Inter", "ok"],
            ["font-family (heading)", "Montserrat, sans-serif", "font-family-secondary: Montserrat", "ok"],
            ["font-size (body)", "16px", "font-size-base: 16px (1rem)", "ok"],
            ["font-size (card title)", "18px (1.125rem)", "font-size-lg: 18px — verificar token", "warning"],
            ["font-size (H1)", "28.8px (1.8rem)", "Nao alinhado — DS usa 28px ou 32px", "warning"],
            ["gap (entre cards)", "16px", "spacing-4: 16px", "ok"],
            ["gap (container desktop)", "48px", "spacing-12: 48px", "ok"],
            ["gap (container mobile)", "32px", "spacing-8: 32px", "ok"],
            ["padding (card)", "16px", "spacing-4: 16px", "ok"],
            ["color (heading)", "#2B3D72", "Verificar token color-text-primary", "warning"],
            ["color (body)", "#475B8A", "Verificar token color-text-secondary", "warning"],
            ["color (icon bg)", "#F7FAFD", "Sem token definido — possivel hardcode", "warning"],
            ["icon library", "Material Symbols Outlined", "Verificar aprovacao DS4FUN", "warning"],
            ["hover/focus (cards)", "Nao detectado", "Obrigatorio — adicionar estados CSS", "error"],
            ["aria-label (links)", "Ausente", "Obrigatorio WCAG 2.1 AA", "error"],
          ].map(([prop, code, token, status]) => {
            const statusColors = { ok: GREENBG, warning: YELLOWBG, error: REDBG };
            const statusIcons  = { ok: "✓", warning: "⚠", error: "✗" };
            const statusFgs    = { ok: GREEN, warning: YELLOW, error: RED };
            return new TableRow({ children: [
              new TableCell({ width: { size: 2500, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: prop, size: 19, font: "Courier New", color: "18181B" })] })] }),
              new TableCell({ width: { size: 2500, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: code, size: 19, font: "Courier New", color: "3F3F46" })] })] }),
              new TableCell({ width: { size: 2500, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: token, size: 19, font: "Arial", color: "3F3F46" })] })] }),
              new TableCell({ width: { size: 1526, type: WidthType.DXA }, borders, shading: { fill: statusColors[status], type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: statusIcons[status], bold: true, size: 20, color: statusFgs[status], font: "Arial" })] })] }),
            ]});
          })
        ]
      }),

      new Paragraph({ spacing: { before: 300, after: 200 }, children: [] }),
      h2("Acoes Prioritarias para o Desenvolvedor"),
      sectionTable([
        new TableRow({ tableHeader: true, children: [
          new TableCell({ width: { size: 3500, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Acao", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
          new TableCell({ width: { size: 4026, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Como fazer", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
          new TableCell({ width: { size: 1500, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Prioridade", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
        ]}),
        statusRow("Adicionar estados CSS nos cards", "Implementar :hover { box-shadow: ...; border-color: ... }, :focus-visible { outline: ... }, :active { transform: scale(0.98) }", "error"),
        statusRow("Adicionar aria-label nos links", "<a href='...' aria-label='Selecionar metodo Pix instantaneo'>", "error"),
        statusRow("Verificar tokens de cor", "Substituir #2B3D72 e #475B8A por variaveis CSS do DS4FUN: var(--color-text-primary)", "warning"),
        statusRow("Corrigir H1 font-size", "Alterar de 1.8rem para 1.75rem (28px) ou 2rem (32px) conforme scale DS4FUN", "warning"),
        statusRow("Avaliar icon library", "Verificar se Material Symbols tem aprovacao. Se nao, substituir por icones DS4FUN", "warning"),
        statusRow("Expandir extracao DOM", "Rodar DS Auditor em todos os 5 HTMLs: debit-card, 1click, processing, success", "warning"),
        statusRow("Adicionar progressbar", "Incluir indicador visual de progresso (Passo 1 de N) com aria-current='step'", "warning"),
      ]),

      pageBreak(),

      // ════ ENTREGAVEL 3: COMPONENTE ════════════════════════════════════
      h1("Entregavel 3  —  Analise de Componente"),
      body("Analise do componente 'Action Cards' da Biblioteca DS4FUN (Figura 470-2803). O componente representa cards de selecao de opcao — exatamente os utilizados na tela de escolha de metodo de pagamento do Checkout."),
      divider(),

      h2("Cobertura de Estados por Tamanho"),
      body("O componente possui 18 variantes distribuidas em 3 tamanhos (sm, md, lg) x 2 estados de selecao (Selected=False/True) x estados de interacao. Abaixo a matriz completa:"),
      new Paragraph({ spacing: { before: 200, after: 160 }, children: [] }),
      new Table({
        width: { size: COL_W, type: WidthType.DXA },
        columnWidths: [1200, 1200, 2600, 2526, 1500],
        rows: [
          new TableRow({ tableHeader: true, children: [
            new TableCell({ width: { size: 1200, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Size", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
            new TableCell({ width: { size: 1200, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Selected", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
            new TableCell({ width: { size: 2600, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "Estados Presentes", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
            new TableCell({ width: { size: 2526, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "Estados Faltantes", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
            new TableCell({ width: { size: 1500, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Score", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
          ]}),
          ...COMP_VARIANTS.map(v => {
            const score = Math.round(v.states.length / (v.states.length + v.missing.length) * 100);
            const scoreBg = score >= 70 ? GREENBG : score >= 50 ? YELLOWBG : REDBG;
            const scoreFg = score >= 70 ? GREEN : score >= 50 ? YELLOW : RED;
            return new TableRow({ children: [
              new TableCell({ width: { size: 1200, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v.size.toUpperCase(), bold: true, size: 20, font: "Arial" })] })] }),
              new TableCell({ width: { size: 1200, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER,
                shading: { fill: v.selected === "Sim" ? "EEF2FF" : "F9FAFB", type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v.selected, size: 20, font: "Arial", color: v.selected === "Sim" ? ACCENT : GRAY })] })] }),
              new TableCell({ width: { size: 2600, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: v.states.join(", "), size: 19, font: "Arial", color: GREEN })] })] }),
              new TableCell({ width: { size: 2526, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, shading: { fill: REDBG, type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: v.missing.join(", "), size: 19, font: "Arial", color: RED })] })] }),
              new TableCell({ width: { size: 1500, type: WidthType.DXA }, borders, shading: { fill: scoreBg, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${score}%`, bold: true, size: 22, font: "Arial", color: scoreFg })] })] }),
            ]});
          })
        ]
      }),

      new Paragraph({ spacing: { before: 300, after: 200 }, children: [] }),
      h2("Sugestoes de Melhoria por Prioridade"),
      new Table({
        width: { size: COL_W, type: WidthType.DXA },
        columnWidths: [1400, 2600, 5026],
        rows: [
          new TableRow({ tableHeader: true, children: [
            new TableCell({ width: { size: 1400, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Prioridade", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
            new TableCell({ width: { size: 2600, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "Estado / Acao", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
            new TableCell({ width: { size: 5026, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "Justificativa / Impacto", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
          ]}),
          ...COMP_SUGGESTIONS.map(s => {
            const priColors = { "Alta": REDBG, "Media": YELLOWBG, "Baixa": BLUEBG };
            const priFgs    = { "Alta": RED, "Media": YELLOW, "Baixa": BLUE };
            return new TableRow({ children: [
              new TableCell({ width: { size: 1400, type: WidthType.DXA }, borders, shading: { fill: priColors[s.priority], type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.priority, bold: true, size: 19, color: priFgs[s.priority], font: "Arial" })] })] }),
              new TableCell({ width: { size: 2600, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: s.state, bold: true, size: 19, color: "18181B", font: "Arial" })] })] }),
              new TableCell({ width: { size: 5026, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: s.desc, size: 19, font: "Arial", color: "3F3F46" })] })] }),
            ]});
          })
        ]
      }),

      new Paragraph({ spacing: { before: 300, after: 200 }, children: [] }),
      h2("Conclusao do Componente"),
      body("O Action Cards esta bem estruturado com 3 tamanhos e o estado de selecao implementado. Porem, faltam estados criticos para uso em producao, especialmente em fluxos de checkout onde o usuario espera feedback imediato e a acessibilidade por teclado e obrigatoria.", { color: "3F3F46" }),
      new Paragraph({ spacing: { before: 100, after: 100 }, children: [
        new TextRun({ text: "Score geral do componente: ", bold: true, size: 22, font: "Arial" }),
        new TextRun({ text: "44% de cobertura de estados", bold: true, size: 22, color: RED, font: "Arial" }),
        new TextRun({ text: " — 18 de 32 variantes esperadas implementadas.", size: 22, font: "Arial", color: "3F3F46" }),
      ]}),
      body("Com as 8 sugestoes implementadas, a cobertura sobe para 100% e o componente estaria pronto para uso no fluxo de Checkout de forma acessivel e com UX de qualidade."),

      pageBreak(),

      // ════ PROXIMOS PASSOS ═════════════════════════════════════════════
      h1("Proximos Passos Consolidados"),
      body("Lista unificada de acoes prioritarias para a equipe, ordenadas por impacto:"),
      new Paragraph({ spacing: { before: 200, after: 160 }, children: [] }),
      sectionTable([
        new TableRow({ tableHeader: true, children: [
          new TableCell({ width: { size: 800, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "#", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
          new TableCell({ width: { size: 1200, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Responsavel", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
          new TableCell({ width: { size: 5526, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Acao", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
          new TableCell({ width: { size: 1500, type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Prioridade", bold: true, size: 20, color: "FFFFFF", font: "Arial" })] })] }),
        ]}),
        ...[
          ["1",  "Dev",        "[CRITICO] Adicionar :hover, :focus-visible, :active nos cards de selecao de pagamento", "error"],
          ["2",  "Dev",        "[CRITICO] Adicionar aria-label nos links de selecao de metodo de pagamento", "error"],
          ["3",  "Designer",   "Adicionar estado Active/Pressed e Loading ao componente Action Cards (todos os tamanhos)", "error"],
          ["4",  "Designer",   "Renomear frames com nomenclatura semantica: Checkout/Tela/Breakpoint", "error"],
          ["5",  "Designer",   "Criar frames 0x0 com dimensoes corretas (1440px, 768px, 375px)", "error"],
          ["6",  "Dev",        "Substituir cores hardcoded (#2B3D72, #475B8A) por variaveis CSS do DS4FUN", "warning"],
          ["7",  "Designer",   "Adicionar Hover + Focus para Selected=true no Action Cards", "warning"],
          ["8",  "Dev",        "Corrigir H1 font-size: 28.8px -> 28px (token heading-md DS4FUN)", "warning"],
          ["9",  "Dev",        "Avaliar substituicao do Material Symbols por iconografia DS4FUN", "warning"],
          ["10", "Designer",   "Corrigir font-size 22.4px no Frame 8 para 24px (token heading-sm)", "warning"],
          ["11", "Dev",        "Expandir extracao DOM para todos os 5 arquivos HTML do Checkout", "warning"],
          ["12", "Dev",        "Adicionar progressbar de etapas com aria-current='step'", "warning"],
          ["13", "Designer",   "Adicionar estado Error ao Action Cards para metodo de pagamento indisponivel", "warning"],
          ["14", "Designer",   "Adicionar estado Selected+Disabled ao Action Cards", "warning"],
          ["15", "Designer",   "Renomear 'Evidence' para 'Selected/Highlight' na biblioteca", "info"],
          ["16", "Equipe",     "Habilitar e configurar Dev Mode no Figma para anotacoes via API", "info"],
        ].map(([num, resp, desc, sev]) => {
          const sevColors = { error: REDBG, warning: YELLOWBG, info: BLUEBG };
          const sevIcons  = { error: "Alta", warning: "Media", info: "Baixa" };
          const sevFgs    = { error: RED, warning: YELLOW, info: BLUE };
          return new TableRow({ children: [
            new TableCell({ width: { size: 800, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: num, bold: true, size: 20, font: "Arial" })] })] }),
            new TableCell({ width: { size: 1200, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER,
              shading: { fill: resp === "Dev" ? "EFF6FF" : resp === "Designer" ? "F5F3FF" : LIGHTBG, type: ShadingType.CLEAR },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: resp, bold: true, size: 18, font: "Arial", color: resp === "Dev" ? BLUE : resp === "Designer" ? "7C3AED" : GRAY })] })] }),
            new TableCell({ width: { size: 5526, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: desc, size: 19, font: "Arial", color: "3F3F46" })] })] }),
            new TableCell({ width: { size: 1500, type: WidthType.DXA }, borders, shading: { fill: sevColors[sev], type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sevIcons[sev], bold: true, size: 18, font: "Arial", color: sevFgs[sev] })] })] }),
          ]});
        })
      ]),

      new Paragraph({ spacing: { before: 600, after: 200 }, children: [
        new TextRun({ text: "Relatorio gerado por DS Auditor v4.0  •  Checkout x DS4FUN v1.4.0  •  16/03/2026", size: 18, color: GRAY, font: "Arial" })
      ]}),
    ]
  }]
});

const OUT = "C:/Users/sutil/Desktop/DS-Auditor-Checkout-Report.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("OK: " + OUT);
}).catch(e => { console.error("ERRO:", e.message); process.exit(1); });
