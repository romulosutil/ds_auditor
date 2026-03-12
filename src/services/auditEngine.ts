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
export type AuditCategory = 'colors' | 'typography' | 'spacing' | 'radii' | 'components' | 'naming';

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
export const DS4FUN_RADII = new Set([0, 8, 16, 9999]);
export const DS4FUN_SPACING = new Set([0, 4, 8, 12, 16, 24, 32, 40, 48]);

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
    if (l.cornerRadius !== undefined && !DS4FUN_RADII.has(l.cornerRadius)) {
      issues.push({
        category: 'radii',
        severity: 'warning',
        message: `Raio de borda incorreto: ${l.cornerRadius}px.`,
        suggestion: 'Use 8px (componentes), 16px (containers) ou 9999px (pill).',
        layerId: l.id, layerName: l.name,
        x: l.x, y: l.y, width: l.width, height: l.height
      });
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
  return layers
    .filter(l => l.name.startsWith('Frame ') || l.name.startsWith('Group '))
    .map(l => ({
      category: 'naming',
      severity: 'warning',
      message: `Camada com nome genérico detectada: ${l.name}.`,
      suggestion: 'Renomeie a camada para descrever sua função (ex: CardContent, IconButton).',
      layerId: l.id, layerName: l.name,
      x: l.x, y: l.y, width: l.width, height: l.height
    }));
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
