/**
 * auditEngine.ts
 * 
 * DS4FUN v1.4.0 compliance rules engine.
 * All token definitions are derived from ds4fun-library.css (source of truth).
 */

import type { FigmaNode } from './figmaService';
import { checkA11y } from './a11y';
import { checkHeuristics } from './heuristics';
import { checkComponentCompleteness } from './componentAnalysis';

// ─── Types ────────────────────────────────────────────────────────────────

export type IssueType = 'error' | 'warning';
export type AuditCategory = 'colors' | 'typography' | 'spacing' | 'radii' | 'components' | 'naming' | 'a11y' | 'heuristics' | 'styles';

export interface AuditIssue {
  category: AuditCategory;
  severity: IssueType;
  message: string;
  suggestion?: string;
  layerId?: string;
  layerName?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface FigmaFill {
  type: string;
  hex?: string;
  variableName?: string | null;
}

export interface FigmaLayer {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius?: number;
  fontSize?: number;
  fontFamily?: string;
  gap?: number;
  padding?: number;
  fills: FigmaFill[];
  children?: FigmaLayer[];
}

export interface AuditResults {
  score: number;
  compliance: number;
  criticalErrors: number;
  alerts: number;
  categories: Partial<Record<AuditCategory, AuditIssue[]>>;
  passedCategories: AuditCategory[];
  totalLayers: number;
  auditedAt: string;
  isRealData: boolean;
}

// ─── DS4FUN Token Registry ────────────────────────────────────────────────

export const DS4FUN_SEMANTIC_TOKENS = new Set([
  'surface-canvas', 'surface-base', 'surface-raised', 'surface-overlay',
  'text-primary', 'text-secondary', 'text-placeholder', 'text-link', 'text-link-hover', 'text-on-interactive',
  'icon-primary', 'icon-secondary', 'icon-on-interactive',
  'interactive-primary-default', 'interactive-primary-hover', 'interactive-primary-active', 'interactive-primary-focus',
  'interactive-secondary-default', 'interactive-secondary-hover', 'interactive-secondary-active', 'interactive-secondary-focus',
  'interactive-tertiary-default', 'interactive-tertiary-hover', 'interactive-tertiary-active', 'interactive-tertiary-focus',
  'interactive-destructive-default', 'interactive-destructive-hover', 'interactive-destructive-active', 'interactive-destructive-focus',
  'interactive-disabled-bg', 'interactive-disabled-text',
  'interactive-surface-hover', 'interactive-surface-active', 'interactive-surface-focus',
  'input-bg-default', 'input-border-default', 'input-border-hover', 'input-border-focus',
  'border-subtle', 'divider-default', 'focus-ring',
  'status-success-bg', 'status-success-text', 'status-warning-bg', 'status-warning-text',
  'status-info-bg', 'status-info-text', 'status-error-bg', 'status-error-text',
]);

export const DS4FUN_PRIMITIVE_COLORS = new Set([
  '#FEEFCD', '#FDDA9C', '#F9BE6A', '#F3A244', '#EC780A', '#CA5C07', '#A94405', '#882F03', '#712101',
  '#F3D4F8', '#E4ABF2', '#C07AD8', '#9451B2', '#5D2380', '#49196E', '#37115C', '#270B4A', '#1B063D',
  '#FBFCFE', '#F7FAFD', '#F1F5F9', '#E9EFF4', '#E0E6EE', '#A3B3CC', '#7084AB', '#475B8A', '#2B3D72',
  '#FFFFFF', '#000000',
  '#FFE6D8', '#FFC7B1', '#FFA18A', '#FF7E6D', '#FF433D', '#DB2C36', '#B71E33', '#931330', '#7A0B2D',
  '#EDFCD4', '#D7FAA9', '#B7F17C', '#96E35A', '#69D129', '#4DB31D', '#369614', '#22790D', '#146407',
  '#FFF4CC', '#FFE799', '#FFD666', '#FFC53F', '#FFAA00', '#DB8A00', '#B76D00', '#935300', '#7A4000',
  '#CFEAFE', '#A0D1FE', '#71B5FE', '#4E9BFD', '#1471FC', '#0E57D8', '#0A40B5', '#062D92', '#031F78',
]);

export const DS4FUN_FONTS = new Set(['Montserrat', 'Inter']);
export const DS4FUN_RADII = new Set([0, 4, 8, 16, 9999]);
export const DS4FUN_SPACING = new Set([0, 2, 4, 8, 12, 16, 24, 32, 40, 48]);
export const DS4FUN_BORDERS = new Set([0, 1, 2]);
export const DS4FUN_SHADOWS = [
  'elevation-sm', 'elevation-md', 'elevation-lg', 'elevation-xl'
];

export const DS4FUN_COMPONENT_PREFIXES = [
  'Button/', 'btn/', 'Btn/', 'Input/', 'input/', 'Checkbox/', 'checkbox/',
  'Radio/', 'radio/', 'Toggle/', 'toggle/', 'Dropdown/', 'dropdown/',
  'Alert/', 'alert/', 'Toast/', 'toast/', 'Modal/', 'modal/', 'Card/', 'card/',
  'Link/', 'Icon/', 'icon/', 'Header/', 'Footer/', 'Nav/', 'Form/', 'Section/',
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function collectAllLayers(layer: FigmaLayer): FigmaLayer[] {
  if (!layer) return [];
  const result: FigmaLayer[] = [layer];
  if (layer.children) {
    for (const child of layer.children) {
      if (child) result.push(...collectAllLayers(child));
    }
  }
  return result;
}

function normalizeHex(hex: string): string {
  if (hex.startsWith('rgb')) {
    const m = hex.match(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/);
    if (m) {
      return `#${parseInt(m[1]).toString(16).padStart(2, '0')}${parseInt(m[2]).toString(16).padStart(2, '0')}${parseInt(m[3]).toString(16).padStart(2, '0')}`.toUpperCase();
    }
  }
  return hex.toUpperCase().replace(/^#/, '#');
}

function isValidDSColor(fill: FigmaFill): boolean {
  if (fill.variableName && DS4FUN_SEMANTIC_TOKENS.has(fill.variableName.replace(/--/g, '').replace(/var\(--/g, '').replace(/\)/g, ''))) {
    return true;
  }
  if (fill.hex && DS4FUN_PRIMITIVE_COLORS.has(normalizeHex(fill.hex))) {
    return true;
  }
  return false;
}

// ─── Core Checks ──────────────────────────────────────────────────────────

export function checkColors(layers: FigmaLayer[]): AuditIssue[] {
  return layers
    .filter(l => l.fills && l.fills.length > 0)
    .flatMap(l => {
      const issues: AuditIssue[] = [];
      l.fills.forEach(f => {
        if (f.type === 'SOLID' && !isValidDSColor(f)) {
          issues.push({
            category: 'colors',
            severity: 'error',
            message: `Cor não permitida: ${f.hex || 'N/A'}.`,
            suggestion: 'Use uma variável semântica (ex: text-primary) ou uma cor da paleta primitiva.',
            layerId: l.id,
            layerName: l.name,
            x: l.x, y: l.y, width: l.width, height: l.height
          });
        }
      });
      return issues;
    });
}

export function checkTypography(layers: FigmaLayer[]): AuditIssue[] {
  return layers
    .filter(l => l.type === 'TEXT')
    .flatMap(l => {
      const issues: AuditIssue[] = [];
      if (l.fontFamily && !DS4FUN_FONTS.has(l.fontFamily)) {
        issues.push({
          category: 'typography',
          severity: 'error',
          message: `Fonte não permitida: ${l.fontFamily}.`,
          suggestion: 'Use Montserrat ou Inter, conforme definido no Design System.',
          layerId: l.id, layerName: l.name,
          x: l.x, y: l.y, width: l.width, height: l.height
        });
      }
      return issues;
    });
}

export function checkSpacing(layers: FigmaLayer[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  layers.forEach(l => {
    if (l.gap !== undefined && !DS4FUN_SPACING.has(l.gap)) {
      issues.push({
        category: 'spacing',
        severity: 'warning',
        message: `Espaçamento (gap) incorreto: ${l.gap}px.`,
        suggestion: 'Mantenha valores na escala de 8px (0, 8, 16, 24, 32, 48).',
        layerId: l.id, layerName: l.name,
        x: l.x, y: l.y, width: l.width, height: l.height
      });
    }
  });
  return issues;
}

export function checkRadii(layers: FigmaLayer[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  layers.forEach(l => {
    // Ignora camadas que naturalmente não teriam raio (como TEXT)
    if (l.type === 'TEXT') return;

    if (l.cornerRadius !== undefined && l.cornerRadius > 0) {
      // 1. Verifica se está na escala
      if (!DS4FUN_RADII.has(l.cornerRadius)) {
        issues.push({
          category: 'radii',
          severity: 'error',
          message: `Raio de borda fora da escala: ${l.cornerRadius}px.`,
          suggestion: 'Use 4px (radius-sm), 8px (radius-md), 16px (radius-lg) ou 9999px (radius-full).',
          layerId: l.id, layerName: l.name,
          x: l.x, y: l.y, width: l.width, height: l.height
        });
      }

      // 2. Verifica se usou token
      // Tentamos inferir o token pelo nome da camada ou por metadados de variáveis
      const hasToken = (l as any).radiusToken !== undefined || 
                       l.name.toLowerCase().includes('radius-') ||
                       (l as any).variableName?.toLowerCase().includes('radius');
      
      if (!hasToken && l.cornerRadius > 0) {
        issues.push({
          category: 'radii',
          severity: 'warning',
          message: `Raio de borda (${l.cornerRadius}px) aplicado sem token.`,
          suggestion: `Vincule este valor a um token de design (ex: radius-${l.cornerRadius === 8 ? 'md' : 'sm'}) para garantir consistência.`,
          layerId: l.id, layerName: l.name,
          x: l.x, y: l.y, width: l.width, height: l.height
        });
      }
    }
  });
  return issues;
}

export function checkComponents(layers: FigmaLayer[]): AuditIssue[] {
  return layers
    .filter(l => l.type === 'INSTANCE')
    .flatMap(l => {
      if (!DS4FUN_COMPONENT_PREFIXES.some(prefix => l.name.startsWith(prefix))) {
        return [{
          category: 'components',
          severity: 'error',
          message: `Instância de componente mal nomeada ou fora do padrão: ${l.name}.`,
          suggestion: 'Certifique-se de que o componente segue o padrão NOME/VARIANTE da biblioteca.',
          layerId: l.id, layerName: l.name,
          x: l.x, y: l.y, width: l.width, height: l.height
        }];
      }
      return [];
    });
}

export function checkNaming(layers: FigmaLayer[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const pascalCaseRegex = /^[A-Z][a-zA-Z0-9]*$/;
  const genericNames = ['Frame', 'Group', 'Retângulo', 'Rectangle', 'Ellipse', 'Vector', 'Vector '];

  layers.forEach(l => {
    const isGeneric = genericNames.some(g => l.name.startsWith(g) && (l.name.length === g.length || /\s\d+$/.test(l.name)));
    
    // 1. Bloqueia nomes genéricos
    if (isGeneric) {
      issues.push({
        category: 'naming',
        severity: 'error',
        message: `Nome genérico detectado: "${l.name}".`,
        suggestion: 'Renomeie a camada para descrever sua função (ex: Header, LoginButton).',
        layerId: l.id, layerName: l.name,
        x: l.x, y: l.y, width: l.width, height: l.height
      });
    }

    // 2. Valida PascalCase para Frames e Grupos (não genéricos)
    if ((l.type === 'FRAME' || l.type === 'GROUP') && !isGeneric) {
      if (!pascalCaseRegex.test(l.name)) {
        issues.push({
          category: 'naming',
          severity: 'warning',
          message: `Nomenclatura fora do padrão PascalCase: "${l.name}".`,
          suggestion: `Use PascalCase para organizar melhor o projeto (ex: ${l.name.charAt(0).toUpperCase() + l.name.slice(1).replace(/[^a-zA-Z0-9]/g, '')}).`,
          layerId: l.id, layerName: l.name,
          x: l.x, y: l.y, width: l.width, height: l.height
        });
      }
    }

    // 3. Valida padrão de instâncias (Categoria/Componente)
    if (l.type === 'INSTANCE' && !l.name.includes('/')) {
      issues.push({
        category: 'naming',
        severity: 'warning',
        message: `Instância sem separador de categoria: "${l.name}".`,
        suggestion: 'Componentes devem seguir o padrão "Categoria/Nome" (ex: Atoms/Button).',
        layerId: l.id, layerName: l.name,
        x: l.x, y: l.y, width: l.width, height: l.height
      });
    }
  });

  return issues;
}

export function checkBorders(layers: FigmaLayer[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  layers.forEach(l => {
    // Figma often represents borders in 'strokes'
    const anyStroke = (l as any).strokes?.length > 0;
    const strokeWeight = (l as any).strokeWeight;
    if (anyStroke && strokeWeight !== undefined && !DS4FUN_BORDERS.has(strokeWeight)) {
      issues.push({
        category: 'styles',
        severity: 'warning',
        message: `Espessura de borda não padronizada: ${strokeWeight}px.`,
        suggestion: 'O DS4FUN utiliza bordas de 1px (padrão) ou 2px (ênfase como Checkbox/Radio).',
        layerId: l.id, layerName: l.name,
        x: l.x, y: l.y, width: l.width, height: l.height
      });
    }
  });
  return issues;
}

export function checkShadows(layers: FigmaLayer[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  layers.forEach(l => {
    const effects = (l as any).effects || [];
    const dropShadows = effects.filter((e: any) => e.type === 'DROP_SHADOW' && e.visible);
    
    if (dropShadows.length > 0) {
      // Simplificação v3.0: Se tem sombra e não é um componente da lib, avisamos para conferir tokens de elevation
      const hasElevationToken = l.name.toLowerCase().includes('elevation') || l.name.toLowerCase().includes('shadow');
      if (!hasElevationToken) {
        issues.push({
          category: 'styles',
          severity: 'warning',
          message: 'Sombra customizada detectada.',
          suggestion: 'Certifique-se de estar usando os tokens de elevação (elevation-sm, md, lg, xl) do DS4FUN.',
          layerId: l.id, layerName: l.name,
          x: l.x, y: l.y, width: l.width, height: l.height
        });
      }
    }
  });
  return issues;
}

function calculateScore(issues: AuditIssue[], totalLayers: number): { score: number; compliance: number } {
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const penalty = (errorCount * 10) + (warningCount * 3);
  const score = Math.max(0, 100 - penalty);
  const compliance = totalLayers === 0 ? 100 : Math.round(Math.max(0, 100 - (errorCount / totalLayers * 100)));
  return { score, compliance };
}

export async function runAudit(
  node: FigmaNode,
  activeCategories: Set<string>
): Promise<AuditResults> {
  await new Promise(r => setTimeout(r, 400));

  const allLayers = (node.layers || [])
    .filter(l => l !== null)
    .flatMap(l => collectAllLayers(l as unknown as FigmaLayer));

  const categories: Partial<Record<AuditCategory, AuditIssue[]>> = {};
  const passedCategories: AuditCategory[] = [];

  const checks: { id: AuditCategory; fn: (l: FigmaLayer[], all: FigmaLayer[]) => AuditIssue[] }[] = [
    { id: 'colors',     fn: checkColors },
    { id: 'typography', fn: checkTypography },
    { id: 'spacing',    fn: checkSpacing },
    { id: 'radii',      fn: checkRadii },
    { id: 'components', fn: checkComponents },
    { id: 'naming',     fn: checkNaming },
    { id: 'styles',     fn: (l) => [...checkBorders(l), ...checkShadows(l)] },
  ];

  const advancedChecks = [
    { fn: checkA11y },
    { fn: checkHeuristics },
    { fn: checkComponentCompleteness }
  ];

  for (const { id, fn } of checks) {
    if (!activeCategories.has(id)) continue;
    const issues = fn(allLayers, allLayers);
    if (issues.length > 0) {
      categories[id] = issues;
    } else {
      passedCategories.push(id);
    }
  }

  advancedChecks.forEach(({ fn }) => {
    const issues = fn(allLayers, allLayers);
    issues.forEach((issue: AuditIssue) => {
      if (!activeCategories.has(issue.category)) return;
      if (!categories[issue.category]) categories[issue.category] = [];
      categories[issue.category]!.push(issue);
      const passIdx = passedCategories.indexOf(issue.category);
      if (passIdx !== -1) passedCategories.splice(passIdx, 1);
    });
  });

  const allIssues = Object.values(categories).flat();
  const { score, compliance } = calculateScore(allIssues, allLayers.length);

  return {
    score,
    compliance,
    criticalErrors: allIssues.filter(i => i.severity === 'error').length,
    alerts: allIssues.filter(i => i.severity === 'warning').length,
    categories,
    passedCategories,
    totalLayers: allLayers.length,
    auditedAt: new Date().toISOString(),
    isRealData: !node.name.includes('(Mock)'),
  };
}
