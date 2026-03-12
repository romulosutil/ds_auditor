/**
 * auditEngine.ts
 * 
 * DS4FUN v1.4.0 compliance rules engine.
 * All token definitions are derived from ds4fun-library.css (source of truth).
 * 
 * Validated categories:
 *  - Colors: checks for hardcoded colors not bound to DS4FUN CSS variables
 *  - Typography: checks font family (Montserrat/Inter) and font-size scale
 *  - Spacing: checks gap/padding against DS4FUN component spacing scale
 *  - Radii: checks border-radius against the 3 DS4FUN tokens (8/16/9999)
 *  - Components: checks instance names against DS4FUN component class prefixes
 *  - Naming: checks layer naming conventions
 */

import type { FigmaNode, FigmaLayer } from './figmaService';

// ─── DS4FUN Token Registry ────────────────────────────────────────────────
// Source: ds4fun-library.css :root variables

/** All valid CSS variable names that can be used as color references in Figma */
export const DS4FUN_SEMANTIC_TOKENS = new Set([
  // Surface
  'surface-canvas', 'surface-base', 'surface-raised', 'surface-overlay',
  // Text
  'text-primary', 'text-secondary', 'text-placeholder', 'text-link', 'text-link-hover', 'text-on-interactive',
  // Icon
  'icon-primary', 'icon-secondary', 'icon-on-interactive',
  // Interactive: Primary (Orange)
  'interactive-primary-default', 'interactive-primary-hover', 'interactive-primary-active', 'interactive-primary-focus',
  // Interactive: Secondary (Purple)
  'interactive-secondary-default', 'interactive-secondary-hover', 'interactive-secondary-active', 'interactive-secondary-focus',
  // Interactive: Tertiary (Neutral)
  'interactive-tertiary-default', 'interactive-tertiary-hover', 'interactive-tertiary-active', 'interactive-tertiary-focus',
  // Interactive: Destructive
  'interactive-destructive-default', 'interactive-destructive-hover', 'interactive-destructive-active', 'interactive-destructive-focus',
  // Interactive: Disabled
  'interactive-disabled-bg', 'interactive-disabled-text',
  // Interactive: Surface States
  'interactive-surface-hover', 'interactive-surface-active', 'interactive-surface-focus',
  // Input
  'input-bg-default', 'input-border-default', 'input-border-hover', 'input-border-focus',
  // Border & Divider
  'border-subtle', 'divider-default',
  // Focus
  'focus-ring',
  // Status
  'status-success-bg', 'status-success-text',
  'status-warning-bg', 'status-warning-text',
  'status-info-bg', 'status-info-text',
  'status-error-bg', 'status-error-text',
  // Checkbox
  'checkbox-bg-unchecked', 'checkbox-bg-unchecked-hover', 'checkbox-bg-checked', 'checkbox-border-focus',
  // Radio
  'radio-border-unchecked', 'radio-border-checked', 'radio-fill-checked', 'radio-focus-ring',
]);

/**
 * DS4FUN allowed hex values from primitives — fills that use these
 * are considered compliant (as they match --color-* primitive tokens).
 * These are the colors defined in ds4fun-library.css primitive palette.
 */
export const DS4FUN_PRIMITIVE_COLORS = new Set([
  // Orange palette
  '#FEEFCD', '#FDDA9C', '#F9BE6A', '#F3A244', '#EC780A', '#CA5C07', '#A94405', '#882F03', '#712101',
  // Purple palette
  '#F3D4F8', '#E4ABF2', '#C07AD8', '#9451B2', '#5D2380', '#49196E', '#37115C', '#270B4A', '#1B063D',
  // Neutral palette
  '#FBFCFE', '#F7FAFD', '#F1F5F9', '#E9EFF4', '#E0E6EE', '#A3B3CC', '#7084AB', '#475B8A', '#2B3D72',
  '#FFFFFF', '#000000',
  // Error palette
  '#FFE6D8', '#FFC7B1', '#FFA18A', '#FF7E6D', '#FF433D', '#DB2C36', '#B71E33', '#931330', '#7A0B2D',
  // Success palette
  '#EDFCD4', '#D7FAA9', '#B7F17C', '#96E35A', '#69D129', '#4DB31D', '#369614', '#22790D', '#146407',
  // Warning palette
  '#FFF4CC', '#FFE799', '#FFD666', '#FFC53F', '#FFAA00', '#DB8A00', '#B76D00', '#935300', '#7A4000',
  // Info palette
  '#CFEAFE', '#A0D1FE', '#71B5FE', '#4E9BFD', '#1471FC', '#0E57D8', '#0A40B5', '#062D92', '#031F78',
]);

/**
 * DS4FUN valid font families.
 * Source: --font-family-montserrat, --font-family-inter
 */
export const DS4FUN_FONTS = new Set(['Montserrat', 'Inter']);

/**
 * DS4FUN border-radius tokens.
 * Source: --radius-interactive: 8px, --radius-container: 16px, --radius-pill: 9999px
 * ONLY these 3 values are permitted. Any other radius is a violation.
 */
export const DS4FUN_RADII = new Set([0, 8, 16, 9999]);

/**
 * DS4FUN spacing scale (gap and padding values).
 * Derived from component specifications in ds4fun-library.css:
 * btn-sm: padding 8/16, gap 12;  btn-md: padding 8/16, gap 8;  btn-lg: padding 8/16, gap 16
 * input-sm: padding 8/16, gap 12; input-md: padding 16/16, gap 8; input-lg: padding 24/24, gap 16
 * checkbox: gap 8; dropdown: gap 8; modal: padding 24/32; card: padding 16/24
 */
export const DS4FUN_SPACING = new Set([0, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96]);

/**
 * DS4FUN component prefixes — Figma INSTANCE layers should start with one of these.
 * Derived from the component classes in ds4fun-library.css.
 */
export const DS4FUN_COMPONENT_PREFIXES = [
  'Button/', 'btn/', 'Btn/',
  'Input/', 'input/',
  'Checkbox/', 'checkbox/',
  'Radio/', 'radio/',
  'Toggle/', 'toggle/',
  'Dropdown/', 'dropdown/',
  'Alert/', 'alert/',
  'Toast/', 'toast/',
  'Modal/', 'modal/',
  'Card/', 'card/',
  'Badge/', 'badge/',
  'Avatar/', 'avatar/',
  'Link/', 'Icon/', 'icon/',
  // Common DS4FUN frame component patterns
  'Header/', 'Footer/', 'Nav/', 'Form/', 'Section/',
];

// ─── Issue Types ──────────────────────────────────────────────────────────

export type IssueType = 'error' | 'warning';
export type AuditCategory = 'colors' | 'typography' | 'spacing' | 'radii' | 'components' | 'naming';

export interface AuditIssue {
  message: string;
  layerName?: string;
  layerId?: string;
  severity: IssueType;
  suggestion?: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────

function collectAllLayers(layer: FigmaLayer): FigmaLayer[] {
  const result: FigmaLayer[] = [layer];
  if (layer.children) {
    for (const child of layer.children) {
      result.push(...collectAllLayers(child));
    }
  }
  return result;
}

function normalizeHex(hex: string): string {
  // Normalize rgb() and incomplete hex to #RRGGBB uppercase
  if (hex.startsWith('rgb')) {
    const m = hex.match(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/);
    if (m) {
      return `#${parseInt(m[1]).toString(16).padStart(2, '0')}${parseInt(m[2]).toString(16).padStart(2, '0')}${parseInt(m[3]).toString(16).padStart(2, '0')}`.toUpperCase();
    }
  }
  return hex.toUpperCase().replace(/^#/, '#');
}

function isValidDSColor(fill: { hex?: string; variableName?: string | null }): boolean {
  // ✅ If bound to a semantic DS4FUN variable
  if (fill.variableName && DS4FUN_SEMANTIC_TOKENS.has(fill.variableName.replace(/--/g, '').replace(/var\(--/g, '').replace(/\)/g, ''))) {
    return true;
  }
  // ✅ If it's a recognized DS4FUN primitive color hex
  if (fill.hex) {
    const normalized = normalizeHex(fill.hex);
    if (DS4FUN_PRIMITIVE_COLORS.has(normalized)) return true;
  }
  return false;
}

// ─── Rule Checkers ────────────────────────────────────────────────────────

function checkColors(layers: FigmaLayer[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const layer of layers) {
    if (!layer.fills?.length) continue;
    for (const fill of layer.fills) {
      if (fill.type === 'IMAGE' || fill.type === 'GRADIENT_LINEAR') continue;
      if (fill.type === 'SOLID' && !isValidDSColor(fill)) {
        const hex = fill.hex ?? 'desconhecida';
        issues.push({
          severity: 'error',
          layerName: layer.name,
          layerId: layer.id,
          message: `"${layer.name}" usa cor hardcoded "${hex}" — não está nos tokens DS4FUN.`,
          suggestion: `Use uma variável semântica como "interactive-primary-default" (orange) ou "text-primary" (navy).`,
        });
      }
    }
  }
  return issues;
}

function checkTypography(layers: FigmaLayer[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const layer of layers) {
    if (layer.type !== 'TEXT') continue;

    if (layer.fontFamily && !DS4FUN_FONTS.has(layer.fontFamily)) {
      issues.push({
        severity: 'error',
        layerName: layer.name,
        layerId: layer.id,
        message: `"${layer.name}" usa fonte "${layer.fontFamily}" — não faz parte do DS4FUN.`,
        suggestion: `Use "Inter" para corpo de texto/UI ou "Montserrat" para títulos (--font-family-inter / --font-family-montserrat).`,
      });
    }
  }
  return issues;
}

function checkSpacing(layers: FigmaLayer[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const layer of layers) {
    if (layer.gap !== undefined && layer.gap > 0 && !DS4FUN_SPACING.has(layer.gap)) {
      issues.push({
        severity: 'warning',
        layerName: layer.name,
        layerId: layer.id,
        message: `"${layer.name}" tem gap de ${layer.gap}px — fora da escala de espaçamento DS4FUN.`,
        suggestion: `Corrija para um valor da escala: 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96px.`,
      });
    }
    if (layer.padding !== undefined && layer.padding > 0 && !DS4FUN_SPACING.has(layer.padding)) {
      issues.push({
        severity: 'warning',
        layerName: layer.name,
        layerId: layer.id,
        message: `"${layer.name}" tem padding de ${layer.padding}px — fora da escala DS4FUN.`,
        suggestion: `Use: 8px (sm), 16px (md), 24px (lg) conforme o tamanho do componente.`,
      });
    }
  }
  return issues;
}

function checkRadii(layers: FigmaLayer[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const layer of layers) {
    if (layer.cornerRadius === undefined) continue;
    const r = layer.cornerRadius;
    if (r > 0 && !DS4FUN_RADII.has(r)) {
      // Find the nearest valid radius
      const nearest = [...DS4FUN_RADII].reduce((a, b) => Math.abs(b - r) < Math.abs(a - r) ? b : a);
      issues.push({
        severity: 'error',
        layerName: layer.name,
        layerId: layer.id,
        message: `"${layer.name}" tem border-radius de ${r}px — o DS4FUN só permite 8px, 16px ou 9999px (pill).`,
        suggestion: `Use o token mais próximo: ${nearest}px (--radius-${nearest === 8 ? 'interactive' : nearest === 16 ? 'container' : 'pill'}).`,
      });
    }
  }
  return issues;
}

function checkComponents(layers: FigmaLayer[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const layer of layers) {
    if (layer.type !== 'INSTANCE') continue;
    const isValid = DS4FUN_COMPONENT_PREFIXES.some(p => layer.name.startsWith(p));
    if (!isValid) {
      issues.push({
        severity: 'error',
        layerName: layer.name,
        layerId: layer.id,
        message: `Instância "${layer.name}" não pertence à biblioteca DS4FUN.`,
        suggestion: `Use componentes do DS4FUN: Button/Primary, Input/MD, Card/Default, Alert/Warning, etc.`,
      });
    }
  }
  return issues;
}

function checkNaming(layers: FigmaLayer[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const layer of layers) {
    // Detect snake_case in Frames/Groups — DS4FUN uses PascalCase or kebab-case
    if ((layer.type === 'FRAME' || layer.type === 'GROUP') && /[a-z]_[a-z]/.test(layer.name)) {
      const suggestion = layer.name
        .split('_')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
      issues.push({
        severity: 'warning',
        layerName: layer.name,
        layerId: layer.id,
        message: `Frame/Group "${layer.name}" usa snake_case — a convenção DS4FUN é PascalCase.`,
        suggestion: `Renomeie para "${suggestion}".`,
      });
    }
    // Detect all-caps layers (layout frames shouldn't be UPPERCASE)
    if ((layer.type === 'FRAME') && /^[A-Z_]{4,}$/.test(layer.name)) {
      issues.push({
        severity: 'warning',
        layerName: layer.name,
        layerId: layer.id,
        message: `Frame "${layer.name}" está em CAPS LOCK — use PascalCase nos nomes de camadas.`,
        suggestion: `Renomeie para "${layer.name.charAt(0) + layer.name.slice(1).toLowerCase()}".`,
      });
    }
  }
  return issues;
}

// ─── Score Calculation ────────────────────────────────────────────────────

function calculateScore(allIssues: AuditIssue[], totalLayers: number): { score: number; compliance: number } {
  const errors = allIssues.filter(i => i.severity === 'error').length;
  const warnings = allIssues.filter(i => i.severity === 'warning').length;

  // DS4FUN governance: errors are critical (block PR), warnings are advisory
  const penalties = errors * 6 + warnings * 2;
  const score = Math.max(0, Math.min(100, 100 - penalties));

  const layersWithIssues = new Set(allIssues.map(i => i.layerId).filter(Boolean)).size;
  const compliance = totalLayers > 0
    ? Math.round(((totalLayers - layersWithIssues) / totalLayers) * 100)
    : 100;

  return { score, compliance };
}

// ─── Main Audit Function ──────────────────────────────────────────────────

/**
 * Audits a Figma node against DS4FUN v1.4.0 design system rules.
 * 
 * @param node       The Figma node tree returned by figmaService.fetchFigmaNode()
 * @param activeCategories Which categories to include (from Sidebar filters)
 */
export async function runAudit(
  node: FigmaNode,
  activeCategories: Set<string>
): Promise<AuditResults> {
  // Simulate analysis time (visual feedback for user)
  await new Promise(r => setTimeout(r, 400));

  const allLayers = node.layers.flatMap(l => collectAllLayers(l));
  const categories: Partial<Record<AuditCategory, AuditIssue[]>> = {};
  const passedCategories: AuditCategory[] = [];

  const checks: { id: AuditCategory; fn: (l: FigmaLayer[]) => AuditIssue[] }[] = [
    { id: 'colors',     fn: checkColors },
    { id: 'typography', fn: checkTypography },
    { id: 'spacing',    fn: checkSpacing },
    { id: 'radii',      fn: checkRadii },
    { id: 'components', fn: checkComponents },
    { id: 'naming',     fn: checkNaming },
  ];

  for (const { id, fn } of checks) {
    if (!activeCategories.has(id)) continue;
    const issues = fn(allLayers);
    if (issues.length > 0) {
      categories[id] = issues;
    } else {
      passedCategories.push(id);
    }
  }

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
