/**
 * designVsCodeEngine.ts — Motor de Comparação Design vs. Código
 *
 * Compara a árvore de nós do Figma com o DOM extraído (computed styles)
 * e gera um relatório de divergências acionáveis.
 */

import type { FigmaLayer } from './figmaService';

// ─── Tipos do DOM Extraído ────────────────────────────────────────────────

export interface DomElementStyles {
  backgroundColor: string;
  color: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  gap: string;
  padding: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  display: string;
  flexDirection: string;
  alignItems: string;
  justifyContent: string;
  borderRadius: string;
  width: string;
  height: string;
  borderWidth: string;
  borderColor: string;
  boxShadow: string;
}

export interface DomElement {
  tagName: string;
  text: string;
  role: string;
  placeholder: string;
  computedStyles: DomElementStyles;
  rect: { x: number; y: number; width: number; height: number };
  children: DomElement[];
}

export interface ExtractedViewport {
  viewport: number;
  title: string;
  elements: DomElement[];
  screenshotBase64: string | null;
}

// FigmaLayer re-exported for external use (App.tsx)
export type { FigmaLayer };

// ─── Tipos do Relatório ───────────────────────────────────────────────────

export type DivergenceSeverity = 'critical' | 'warning' | 'info';

export interface Divergence {
  severity: DivergenceSeverity;
  type: 'color' | 'typography' | 'spacing' | 'layout' | 'missing_frame' | 'devmode';
  element: string;
  frame: string;
  figmaValue: string;
  codeValue: string;
  message: string;
}

export interface DesignVsCodeReport {
  divergences: Divergence[];
  score: number;
  criticalCount: number;
  warningCount: number;
  totalChecks: number;
  framesAnalyzed: number;
}

// ─── Utilitários ─────────────────────────────────────────────────────────

/** Converte "rgb(r, g, b)" ou "rgba(...)" para "#RRGGBB" */
function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb.toLowerCase();
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
}

/** Normaliza px string para número */
function pxToNumber(val: string): number {
  return parseFloat(val.replace('px', '')) || 0;
}

/** Extrai todos os elementos do DOM recursivamente (flat list) */
function flattenDom(elements: DomElement[]): DomElement[] {
  const flat: DomElement[] = [];
  function traverse(els: DomElement[]) {
    for (const el of els) {
      flat.push(el);
      if (el.children.length) traverse(el.children);
    }
  }
  traverse(elements);
  return flat;
}

/** Extrai todos os nós Figma recursivamente com texto (flat list) */
function flattenFigmaLayers(node: FigmaLayer): FigmaLayer[] {
  const flat: FigmaLayer[] = [node];
  for (const child of node.children ?? []) {
    flat.push(...flattenFigmaLayers(child));
  }
  return flat;
}

/** Normaliza texto para comparação */
function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Tenta encontrar um elemento DOM correspondente ao nome/texto do nó Figma.
 * Estratégia: comparação por texto interno normalizado.
 */
function findDomMatch(figmaName: string, domElements: DomElement[]): DomElement | null {
  const needle = normalizeText(figmaName);
  if (!needle) return null;

  // Busca exata por texto
  const exact = domElements.find(el => normalizeText(el.text) === needle);
  if (exact) return exact;

  // Busca por texto que contém
  const partial = domElements.find(el => {
    const elText = normalizeText(el.text);
    return elText.includes(needle) || needle.includes(elText);
  });
  if (partial) return partial;

  // Busca por placeholder (inputs)
  const byPlaceholder = domElements.find(el =>
    normalizeText(el.placeholder) === needle
  );
  return byPlaceholder ?? null;
}

// ─── Comparadores de Estilo ───────────────────────────────────────────────

function compareColor(
  figmaNode: FigmaLayer,
  domEl: DomElement,
  frameName: string,
  divergences: Divergence[]
) {
  const figmaFill = figmaNode.fills?.find(f => f.type === 'SOLID' && f.hex);
  if (!figmaFill?.hex) return;

  const bgHex = rgbToHex(domEl.computedStyles.backgroundColor);
  const textHex = rgbToHex(domEl.computedStyles.color);

  const figmaHex = figmaFill.hex.toUpperCase();

  if (bgHex !== figmaHex && textHex !== figmaHex) {
    divergences.push({
      severity: 'critical',
      type: 'color',
      element: figmaNode.name,
      frame: frameName,
      figmaValue: figmaHex,
      codeValue: `bg: ${bgHex} / text: ${textHex}`,
      message: `🔴 Divergência Crítica: "${figmaNode.name}" em ${frameName} tem fill ${figmaHex} no Figma, mas no DOM está bg: ${bgHex} / color: ${textHex}.`,
    });
  }
}

function compareTypography(
  figmaNode: FigmaLayer,
  domEl: DomElement,
  frameName: string,
  divergences: Divergence[]
) {
  const domFontSize = pxToNumber(domEl.computedStyles.fontSize);
  const domFontFamily = domEl.computedStyles.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
  const domFontWeight = domEl.computedStyles.fontWeight;

  if (figmaNode.fontSize && domFontSize && Math.abs(figmaNode.fontSize - domFontSize) > 1) {
    divergences.push({
      severity: 'critical',
      type: 'typography',
      element: figmaNode.name,
      frame: frameName,
      figmaValue: `${figmaNode.fontSize}px`,
      codeValue: `${domFontSize}px`,
      message: `🔴 Divergência Crítica: "${figmaNode.name}" em ${frameName} tem fontSize ${figmaNode.fontSize}px no Figma, mas ${domFontSize}px no código.`,
    });
  }

  if (figmaNode.fontFamily && domFontFamily) {
    const figmaFamily = figmaNode.fontFamily.split(',')[0].trim();
    if (!domFontFamily.toLowerCase().includes(figmaFamily.toLowerCase())) {
      divergences.push({
        severity: 'warning',
        type: 'typography',
        element: figmaNode.name,
        frame: frameName,
        figmaValue: figmaFamily,
        codeValue: domFontFamily,
        message: `🟡 Aviso: "${figmaNode.name}" em ${frameName} usa fonte "${figmaFamily}" no Figma, mas "${domFontFamily}" no código.`,
      });
    }
  }

  if (figmaNode.fontWeight && domFontWeight) {
    const figmaWeight = String(figmaNode.fontWeight);
    if (figmaWeight !== domFontWeight) {
      divergences.push({
        severity: 'warning',
        type: 'typography',
        element: figmaNode.name,
        frame: frameName,
        figmaValue: figmaWeight,
        codeValue: domFontWeight,
        message: `🟡 Aviso: "${figmaNode.name}" em ${frameName} tem fontWeight ${figmaWeight} no Figma, mas ${domFontWeight} no código.`,
      });
    }
  }
}

function compareSpacing(
  figmaNode: FigmaLayer,
  domEl: DomElement,
  frameName: string,
  divergences: Divergence[]
) {
  const domGap = pxToNumber(domEl.computedStyles.gap);
  const domPaddingTop = pxToNumber(domEl.computedStyles.paddingTop);
  const domPaddingRight = pxToNumber(domEl.computedStyles.paddingRight);
  const domPaddingBottom = pxToNumber(domEl.computedStyles.paddingBottom);
  const domPaddingLeft = pxToNumber(domEl.computedStyles.paddingLeft);

  if (figmaNode.gap !== undefined && domGap !== undefined) {
    if (Math.abs(figmaNode.gap - domGap) > 1) {
      divergences.push({
        severity: 'critical',
        type: 'spacing',
        element: figmaNode.name,
        frame: frameName,
        figmaValue: `gap: ${figmaNode.gap}px`,
        codeValue: `gap: ${domGap}px`,
        message: `🔴 Divergência Crítica: "${figmaNode.name}" em ${frameName} (Desktop) tem gap: ${figmaNode.gap}px no Figma, mas gap: ${domGap}px no HTML renderizado.`,
      });
    }
  }

  if (figmaNode.padding !== undefined) {
    const avgDomPadding = (domPaddingTop + domPaddingRight + domPaddingBottom + domPaddingLeft) / 4;
    if (Math.abs(figmaNode.padding - avgDomPadding) > 2) {
      divergences.push({
        severity: 'warning',
        type: 'spacing',
        element: figmaNode.name,
        frame: frameName,
        figmaValue: `padding: ${figmaNode.padding}px`,
        codeValue: `padding: ${domPaddingTop}px ${domPaddingRight}px ${domPaddingBottom}px ${domPaddingLeft}px`,
        message: `🟡 Aviso: "${figmaNode.name}" em ${frameName} tem padding ${figmaNode.padding}px no Figma, mas ${domPaddingTop}/${domPaddingRight}/${domPaddingBottom}/${domPaddingLeft}px no código.`,
      });
    }
  }
}

function checkBorderRadius(
  figmaNode: FigmaLayer,
  domEl: DomElement,
  frameName: string,
  divergences: Divergence[]
) {
  if (figmaNode.cornerRadius === undefined) return;
  const domRadius = pxToNumber(domEl.computedStyles.borderRadius);
  if (Math.abs(figmaNode.cornerRadius - domRadius) > 1) {
    divergences.push({
      severity: 'warning',
      type: 'layout',
      element: figmaNode.name,
      frame: frameName,
      figmaValue: `border-radius: ${figmaNode.cornerRadius}px`,
      codeValue: `border-radius: ${domRadius}px`,
      message: `🟡 Aviso: "${figmaNode.name}" em ${frameName} tem border-radius ${figmaNode.cornerRadius}px no Figma, mas ${domRadius}px no código.`,
    });
  }
}

// ─── Verificação de Frame Mobile ──────────────────────────────────────────

function checkMobileFrame(
  frameWidth: number,
  frameName: string,
  viewportResults: ExtractedViewport[],
  divergences: Divergence[]
) {
  const matchingViewport = viewportResults.find(v => v.viewport === frameWidth);
  if (!matchingViewport) {
    divergences.push({
      severity: 'warning',
      type: 'missing_frame',
      element: 'Frame responsivo',
      frame: frameName,
      figmaValue: `${frameWidth}px`,
      codeValue: 'Não encontrado',
      message: `🟡 Aviso: O frame ${frameName} (Figma) não tem correspondência estrutural no DOM quando a tela foi redimensionada para ${frameWidth}px (falha de responsividade).`,
    });
  }
}

// ─── Motor Principal ──────────────────────────────────────────────────────

/**
 * Executa a comparação entre os dados do Figma e o DOM extraído.
 *
 * @param figmaFrames - Array de nós raiz do Figma (um por frame Desktop/Mobile)
 * @param viewportResults - DOM extraído para cada viewport
 * @param frameNames - Nome de cada frame Figma
 */
export function runDesignVsCodeComparison(
  figmaFrames: Array<{ node: FigmaLayer; frameName: string; width: number }>,
  viewportResults: ExtractedViewport[]
): DesignVsCodeReport {
  const divergences: Divergence[] = [];
  let totalChecks = 0;

  for (const { node, frameName, width } of figmaFrames) {
    // Verifica se existe viewport correspondente
    checkMobileFrame(width, frameName, viewportResults, divergences);

    const matchingViewport = viewportResults.find(v => v.viewport === width);
    if (!matchingViewport) continue;

    const flatDom = flattenDom(matchingViewport.elements);
    const figmaNodes = flattenFigmaLayers(node);

    for (const figmaNode of figmaNodes) {
      // Só compara nós com nome significativo (ignora grupos genéricos)
      const name = figmaNode.name.trim();
      if (!name || name.match(/^(Frame|Group|Rectangle|Vector|Polygon|Star|Line|Ellipse|Component|Instance)\s*\d*$/i)) continue;

      const domMatch = findDomMatch(name, flatDom);

      if (!domMatch) {
        // Elemento Figma sem correspondência no DOM
        if ((figmaNode.fills?.length ?? 0) > 0 || figmaNode.fontSize || figmaNode.gap !== undefined) {
          divergences.push({
            severity: 'info',
            type: 'missing_frame',
            element: name,
            frame: frameName,
            figmaValue: 'Presente no Figma',
            codeValue: 'Não encontrado no DOM',
            message: `ℹ️ Info: Elemento "${name}" do frame ${frameName} não foi localizado no DOM (${width}px).`,
          });
        }
        continue;
      }

      totalChecks++;
      compareColor(figmaNode, domMatch, frameName, divergences);
      compareTypography(figmaNode, domMatch, frameName, divergences);
      compareSpacing(figmaNode, domMatch, frameName, divergences);
      checkBorderRadius(figmaNode, domMatch, frameName, divergences);
    }
  }

  const criticalCount = divergences.filter(d => d.severity === 'critical').length;
  const warningCount = divergences.filter(d => d.severity === 'warning').length;

  // Score: 100 - penalidade por críticos (10pts) e avisos (3pts), mínimo 0
  const score = Math.max(0, 100 - criticalCount * 10 - warningCount * 3);

  return {
    divergences,
    score,
    criticalCount,
    warningCount,
    totalChecks,
    framesAnalyzed: figmaFrames.length,
  };
}
