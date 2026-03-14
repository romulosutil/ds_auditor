/**
 * componentTestEngine.ts
 *
 * Testa componentes individuais do Figma verificando:
 * - Cobertura de estados por tipo de variante (Primary, Secondary, etc.)
 * - Matriz de cobertura: para cada Type, quais States existem?
 * - Uso de tokens DS4FUN
 * - Acessibilidade básica
 * - Nomenclatura (formato Figma: Property=Value)
 */

import type { FigmaNode, FigmaLayer } from './figmaService';

// ─── Types ────────────────────────────────────────────────────────────────

export type StateStatus = 'present' | 'missing' | 'extra';

export interface ComponentState {
  name: string;
  status: StateStatus;
  foundAs?: string;
  required: boolean;
  description: string;
}

export interface VariantProperty {
  name: string;      // ex: "Type", "State", "Size"
  values: string[];  // ex: ["Primary", "Secondary", "Ghost"]
}

export interface TypeStateCoverage {
  typeValue: string;          // ex: "Primary"
  presentStates: string[];    // ex: ["Default", "Hover"]
  missingStates: string[];    // ex: ["Disabled", "Focus"]
}

export interface ComponentTestCategory {
  id: string;
  title: string;
  score: number;
  items: ComponentTestItem[];
}

export interface ComponentTestItem {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warning';
  detail?: string;
  tip?: string;
}

export interface ComponentTestResults {
  componentType: string;
  componentName: string;
  variantProperties: VariantProperty[];
  typeProperty: string;            // qual prop é "Type" (ex: "Type", "Tipo")
  stateProperty: string;           // qual prop é "State" (ex: "State", "Estado")
  typeStateCoverage: TypeStateCoverage[];
  states: ComponentState[];        // cobertura global de estados
  statesCoverage: number;
  categories: ComponentTestCategory[];
  overallScore: number;
  analyzedAt: string;
}

// ─── Required States per Component Type ───────────────────────────────────

const COMPONENT_REQUIRED_STATES: Record<string, Array<{ name: string; aliases: string[]; required: boolean; description: string }>> = {
  Button: [
    { name: 'Default',     aliases: ['default', 'normal', 'rest', 'enabled', 'padrão'],                          required: true,  description: 'Estado base quando não há interação.' },
    { name: 'Hover',       aliases: ['hover', 'hovered', 'mouseover'],                                           required: true,  description: 'Feedback visual ao passar o mouse.' },
    { name: 'Active',      aliases: ['active', 'pressed', 'clicking', 'press'],                                  required: true,  description: 'Durante o clique/toque.' },
    { name: 'Focus',       aliases: ['focus', 'focused', 'keyboard-focus', 'focus-visible'],                     required: true,  description: 'Essencial para navegação por teclado (WCAG).' },
    { name: 'Disabled',    aliases: ['disabled', 'desabilitado', 'inactive'],                                    required: true,  description: 'Ação não disponível.' },
    { name: 'Loading',     aliases: ['loading', 'carregando', 'pending', 'spinner'],                             required: false, description: 'Durante operações assíncronas.' },
  ],
  Input: [
    { name: 'Default',     aliases: ['default', 'empty', 'normal', 'padrão', 'vazio'],                           required: true,  description: 'Campo vazio no estado inicial.' },
    { name: 'Hover',       aliases: ['hover', 'hovered'],                                                        required: false, description: 'Indicação de que o campo é interativo.' },
    { name: 'Focus',       aliases: ['focus', 'focused', 'active', 'typing'],                                    required: true,  description: 'Campo ativo — cursor visível.' },
    { name: 'Filled',      aliases: ['filled', 'preenchido', 'with-value', 'has-value', 'typed'],                required: true,  description: 'Campo com conteúdo digitado.' },
    { name: 'Error',       aliases: ['error', 'erro', 'invalid', 'inválido', 'danger'],                          required: true,  description: 'Validação falhou.' },
    { name: 'Disabled',    aliases: ['disabled', 'desabilitado'],                                                required: true,  description: 'Campo não editável.' },
    { name: 'Readonly',    aliases: ['readonly', 'read-only', 'somente-leitura'],                                required: false, description: 'Visualizável mas não editável.' },
    { name: 'Success',     aliases: ['success', 'valid', 'sucesso', 'validated'],                                required: false, description: 'Validação aprovada.' },
  ],
  Checkbox: [
    { name: 'Unchecked',   aliases: ['unchecked', 'desmarcado', 'off', 'false', 'default', 'empty'],             required: true,  description: 'Não selecionado.' },
    { name: 'Checked',     aliases: ['checked', 'marcado', 'on', 'true', 'selected'],                           required: true,  description: 'Selecionado.' },
    { name: 'Indeterminate',aliases: ['indeterminate', 'parcial', 'mixed', 'partial'],                          required: false, description: 'Seleção parcial de filhos.' },
    { name: 'Focus',       aliases: ['focus', 'focused'],                                                        required: true,  description: 'Foco via teclado.' },
    { name: 'Disabled',    aliases: ['disabled', 'desabilitado'],                                                required: true,  description: 'Não interativo.' },
  ],
  Radio: [
    { name: 'Unselected',  aliases: ['unselected', 'desmarcado', 'off', 'default', 'unchecked'],                 required: true,  description: 'Opção não escolhida.' },
    { name: 'Selected',    aliases: ['selected', 'marcado', 'on', 'checked', 'active'],                         required: true,  description: 'Opção escolhida.' },
    { name: 'Focus',       aliases: ['focus', 'focused'],                                                        required: true,  description: 'Foco via teclado.' },
    { name: 'Disabled',    aliases: ['disabled', 'desabilitado'],                                                required: true,  description: 'Não interativo.' },
  ],
  Select: [
    { name: 'Default',     aliases: ['default', 'closed', 'normal', 'padrão'],                                   required: true,  description: 'Dropdown fechado, sem seleção.' },
    { name: 'Open',        aliases: ['open', 'expanded', 'aberto'],                                              required: true,  description: 'Lista de opções visível.' },
    { name: 'Selected',    aliases: ['selected', 'filled', 'with-value', 'has-value'],                          required: true,  description: 'Uma opção foi escolhida.' },
    { name: 'Focus',       aliases: ['focus', 'focused'],                                                        required: true,  description: 'Foco via teclado.' },
    { name: 'Error',       aliases: ['error', 'invalid', 'erro'],                                                required: true,  description: 'Validação falhou.' },
    { name: 'Disabled',    aliases: ['disabled', 'desabilitado'],                                                required: true,  description: 'Não interativo.' },
  ],
  Toggle: [
    { name: 'Off',         aliases: ['off', 'false', 'inactive', 'desligado', 'unchecked'],                      required: true,  description: 'Estado desligado.' },
    { name: 'On',          aliases: ['on', 'true', 'active', 'ligado', 'checked'],                              required: true,  description: 'Estado ligado.' },
    { name: 'Focus',       aliases: ['focus', 'focused'],                                                        required: true,  description: 'Foco via teclado.' },
    { name: 'Disabled',    aliases: ['disabled', 'desabilitado'],                                                required: true,  description: 'Não interativo.' },
  ],
  Card: [
    { name: 'Default',     aliases: ['default', 'normal', 'rest'],                                               required: true,  description: 'Estado base.' },
    { name: 'Hover',       aliases: ['hover', 'hovered'],                                                        required: true,  description: 'Feedback ao interagir.' },
    { name: 'Selected',    aliases: ['selected', 'active'],                                                      required: false, description: 'Card selecionado.' },
    { name: 'Disabled',    aliases: ['disabled'],                                                                 required: false, description: 'Não interativo.' },
  ],
  Modal: [
    { name: 'Default',     aliases: ['default', 'open', 'normal'],                                               required: true,  description: 'Modal aberto.' },
    { name: 'Loading',     aliases: ['loading', 'carregando'],                                                   required: false, description: 'Carregando conteúdo.' },
    { name: 'Success',     aliases: ['success', 'sucesso'],                                                      required: false, description: 'Ação concluída.' },
    { name: 'Error',       aliases: ['error', 'erro'],                                                           required: false, description: 'Erro no processo.' },
  ],
  Toast: [
    { name: 'Info',        aliases: ['info', 'information', 'informação', 'informative'],                        required: true,  description: 'Mensagem informativa.' },
    { name: 'Success',     aliases: ['success', 'sucesso'],                                                      required: true,  description: 'Operação com sucesso.' },
    { name: 'Warning',     aliases: ['warning', 'aviso', 'warn'],                                                required: true,  description: 'Ação com consequências.' },
    { name: 'Error',       aliases: ['error', 'erro', 'danger'],                                                 required: true,  description: 'Operação falhou.' },
  ],
  Tag: [
    { name: 'Default',     aliases: ['default', 'normal'],                                                        required: true,  description: 'Estado base.' },
    { name: 'Selected',    aliases: ['selected', 'active', 'checked'],                                           required: false, description: 'Tag selecionada.' },
    { name: 'Disabled',    aliases: ['disabled'],                                                                 required: false, description: 'Não interativa.' },
    { name: 'Removable',   aliases: ['removable', 'with-close', 'deletable'],                                    required: false, description: 'Pode ser removida.' },
  ],
  Avatar: [
    { name: 'Default',     aliases: ['default', 'image', 'foto', 'photo', 'with-image'],                         required: true,  description: 'Com imagem.' },
    { name: 'Initials',    aliases: ['initials', 'letter', 'letra', 'fallback', 'no-image'],                    required: true,  description: 'Fallback com iniciais.' },
    { name: 'Loading',     aliases: ['loading', 'skeleton'],                                                     required: false, description: 'Carregando imagem.' },
  ],
  Tab: [
    { name: 'Default',     aliases: ['default', 'inactive', 'normal'],                                           required: true,  description: 'Aba inativa.' },
    { name: 'Active',      aliases: ['active', 'selected', 'current'],                                          required: true,  description: 'Aba ativa.' },
    { name: 'Hover',       aliases: ['hover'],                                                                    required: false, description: 'Feedback ao passar o mouse.' },
    { name: 'Disabled',    aliases: ['disabled'],                                                                 required: false, description: 'Aba inacessível.' },
  ],
};

// ─── Component Type Detection ─────────────────────────────────────────────

const TYPE_KEYWORDS: Record<string, string[]> = {
  Button:   ['button', 'btn', 'botão', 'cta'],
  Input:    ['input', 'textfield', 'text-field', 'field', 'campo', 'textarea'],
  Checkbox: ['checkbox', 'check-box'],
  Radio:    ['radio', 'radio-button'],
  Select:   ['select', 'dropdown', 'combobox'],
  Toggle:   ['toggle', 'switch'],
  Card:     ['card', 'tile', 'cartão'],
  Modal:    ['modal', 'dialog', 'drawer', 'sheet'],
  Toast:    ['toast', 'snackbar', 'notification', 'alert', 'banner'],
  Tag:      ['tag', 'chip', 'badge', 'pill'],
  Avatar:   ['avatar', 'profile-picture', 'user-photo'],
  Tab:      ['tab', 'tabs', 'tabbar'],
};

function detectComponentType(name: string): string {
  const lower = name.toLowerCase();
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return type;
  }
  return 'Generic';
}

// ─── Variant Property Parsing ─────────────────────────────────────────────
// Figma format: "Type=Primary, State=Default, Size=md, Style=Default"

function parseVariantProps(name: string): Record<string, string> {
  const props: Record<string, string> = {};
  if (!name.includes('=')) return props;
  name.split(',').forEach(part => {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) return;
    props[part.substring(0, eqIdx).trim()] = part.substring(eqIdx + 1).trim();
  });
  return props;
}

function collectAllVariantMaps(node: FigmaNode): Array<Record<string, string>> {
  const maps: Array<Record<string, string>> = [];

  function scan(layer: FigmaLayer) {
    const props = parseVariantProps(layer.name);
    if (Object.keys(props).length > 0) maps.push(props);
    if (layer.children) layer.children.forEach(scan);
  }

  node.layers.forEach(scan);
  return maps;
}

function aggregateVariantProperties(maps: Array<Record<string, string>>): Map<string, Set<string>> {
  const allProps = new Map<string, Set<string>>();
  for (const map of maps) {
    for (const [key, val] of Object.entries(map)) {
      if (!allProps.has(key)) allProps.set(key, new Set());
      allProps.get(key)!.add(val);
    }
  }
  return allProps;
}

// ─── Identify Type / State Properties ────────────────────────────────────

const STATE_PROP_CANDIDATES = ['state', 'estado', 'status'];
const TYPE_PROP_CANDIDATES  = ['type', 'tipo', 'kind', 'style', 'variation', 'variant'];

function findPropByCandidate(allProps: Map<string, Set<string>>, candidates: string[]): string {
  for (const candidate of candidates) {
    for (const key of allProps.keys()) {
      if (key.toLowerCase() === candidate) return key;
    }
  }
  // Fallback: the property with most values is likely "Type"
  return '';
}

// ─── Coverage Matrix ──────────────────────────────────────────────────────

function buildTypeStateCoverage(
  variantMaps: Array<Record<string, string>>,
  typeProp: string,
  stateProp: string,
  requiredStates: Array<{ name: string; aliases: string[]; required: boolean }>
): TypeStateCoverage[] {
  if (!typeProp || !stateProp) return [];

  const typeValues = [...new Set(variantMaps.map(m => m[typeProp]).filter(Boolean))];

  return typeValues.map(typeVal => {
    const statesForType = variantMaps
      .filter(m => m[typeProp] === typeVal)
      .map(m => m[stateProp])
      .filter(Boolean);

    const presentStates = [...new Set(statesForType)];

    const missingStates = requiredStates
      .filter(req => req.required)
      .filter(req => {
        return !presentStates.some(s => {
          const lower = s.toLowerCase();
          return req.aliases.some(a => lower === a || lower.includes(a));
        });
      })
      .map(req => req.name);

    return { typeValue: typeVal, presentStates, missingStates };
  });
}

// ─── Global State Coverage (across ALL type variants) ─────────────────────

function buildGlobalStates(
  variantMaps: Array<Record<string, string>>,
  stateProp: string,
  requiredStates: Array<{ name: string; aliases: string[]; required: boolean; description: string }>
): ComponentState[] {
  const allStateValues = stateProp
    ? [...new Set(variantMaps.map(m => m[stateProp]).filter(Boolean))]
    : [];

  return requiredStates.map(req => {
    const foundAs = allStateValues.find(s => {
      const lower = s.toLowerCase();
      return req.aliases.some(a => lower === a || lower.includes(a));
    });
    return {
      name: req.name,
      status: foundAs ? 'present' : 'missing',
      foundAs,
      required: req.required,
      description: req.description,
    } as ComponentState;
  });
}

// ─── DS Token Check ───────────────────────────────────────────────────────

function checkTokenUsage(node: FigmaNode): ComponentTestCategory {
  const tokensUsed = new Set<string>();

  function scan(layer: FigmaLayer) {
    if (layer.fills) layer.fills.forEach(f => { if (f.variableName) tokensUsed.add(f.variableName); });
    if (layer.fontFamily) tokensUsed.add(layer.fontFamily);
    if (layer.children) layer.children.forEach(scan);
  }
  node.layers.forEach(scan);

  const hasColorTokens = Array.from(tokensUsed).some(t => t.includes('-') || t.includes('/'));
  const hasTypography  = Array.from(tokensUsed).some(t => ['Montserrat', 'Inter'].includes(t));

  const items: ComponentTestItem[] = [
    {
      id: 'color-tokens',
      label: 'Tokens de Cor DS4FUN',
      status: hasColorTokens ? 'pass' : 'fail',
      detail: hasColorTokens ? `${tokensUsed.size} variável(is) detectada(s)` : 'Nenhuma variável de cor detectada',
      tip: 'Use variáveis semânticas: text-primary, interactive-primary-default, etc.',
    },
    {
      id: 'typography',
      label: 'Tipografia DS4FUN (Montserrat / Inter)',
      status: hasTypography ? 'pass' : 'warning',
      detail: hasTypography ? 'Fonte DS4FUN detectada' : 'Fonte DS4FUN não detectada',
      tip: 'Títulos → Montserrat. Textos → Inter.',
    },
  ];

  return {
    id: 'tokens',
    title: 'Tokens DS4FUN',
    score: Math.round(items.filter(i => i.status === 'pass').length / items.length * 100),
    items,
  };
}

// ─── A11y Check ───────────────────────────────────────────────────────────

function checkAccessibility(node: FigmaNode, componentType: string, states: ComponentState[]): ComponentTestCategory {
  const touchTargetOk = node.width >= 44 && node.height >= 44;
  const hasFocusState = states.some(s => s.name === 'Focus' && s.status === 'present');
  const interactiveTypes = ['Button', 'Input', 'Checkbox', 'Radio', 'Select', 'Toggle', 'Tab'];
  const needsFocus = interactiveTypes.includes(componentType);

  const items: ComponentTestItem[] = [
    {
      id: 'touch-target',
      label: 'Touch Target ≥ 44×44px',
      status: touchTargetOk ? 'pass' : 'warning',
      detail: `Tamanho: ${node.width}×${node.height}px`,
      tip: 'WCAG 2.5.5 — área de toque mínima de 44×44px.',
    },
    ...(needsFocus ? [{
      id: 'focus-state',
      label: 'Estado de Foco documentado',
      status: (hasFocusState ? 'pass' : 'fail') as 'pass' | 'fail' | 'warning',
      detail: hasFocusState ? 'Variante Focus detectada' : 'Nenhuma variante Focus encontrada',
      tip: 'WCAG 2.4.7 — foco visível para navegação por teclado.',
    }] : []),
  ];

  return {
    id: 'a11y',
    title: 'Acessibilidade',
    score: Math.round(items.filter(i => i.status === 'pass').length / items.length * 100),
    items,
  };
}

// ─── Naming Check (Figma-aware) ───────────────────────────────────────────

function checkNamingConvention(
  node: FigmaNode,
  componentType: string,
  hasVariantProps: boolean,
): ComponentTestCategory {
  const name = node.name;
  const hasGenericName = /^(frame|group|component|layer)\s*\d*/i.test(name);
  const isTypeIdentifiable = componentType !== 'Generic';

  const items: ComponentTestItem[] = [
    {
      id: 'figma-props',
      label: 'Usa formato de variantes Figma (Property=Value)',
      status: hasVariantProps ? 'pass' : 'warning',
      detail: hasVariantProps
        ? 'Formato correto detectado (ex: Type=Primary, State=Default)'
        : 'Variantes no formato Property=Value não detectadas',
      tip: 'Defina variantes no Figma com propriedades nomeadas — ex: Type=Primary, State=Default, Size=md.',
    },
    {
      id: 'identifiable-type',
      label: 'Tipo de componente identificável',
      status: isTypeIdentifiable ? 'pass' : 'warning',
      detail: isTypeIdentifiable
        ? `Tipo "${componentType}" detectado no nome`
        : 'Adicione o tipo ao nome do componente (ex: "Button", "Input")',
      tip: 'O nome do componente deve indicar seu tipo para facilitar a identificação.',
    },
    {
      id: 'no-generic',
      label: 'Nome descritivo (sem "Frame", "Group"...)',
      status: hasGenericName ? 'fail' : 'pass',
      detail: hasGenericName ? `Nome genérico: "${name}"` : `"${name}" ✓`,
      tip: 'Evite nomes como "Frame 1" ou "Group 3".',
    },
  ];

  return {
    id: 'naming',
    title: 'Nomenclatura',
    score: Math.round(items.filter(i => i.status === 'pass').length / items.length * 100),
    items,
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

export function runComponentTest(node: FigmaNode): ComponentTestResults {
  const componentType  = detectComponentType(node.name);
  const requiredStates = COMPONENT_REQUIRED_STATES[componentType] || [];

  // Parse all variant property maps from the component
  const variantMaps    = collectAllVariantMaps(node);
  const allProps       = aggregateVariantProperties(variantMaps);
  const hasVariantProps = variantMaps.length > 0;

  // Identify which property is "State" and which is "Type"
  const stateProp = findPropByCandidate(allProps, STATE_PROP_CANDIDATES);
  const typeProp  = findPropByCandidate(allProps, TYPE_PROP_CANDIDATES);

  // Convert allProps to VariantProperty[]
  const variantProperties: VariantProperty[] = Array.from(allProps.entries())
    .map(([name, valSet]) => ({ name, values: Array.from(valSet).sort() }))
    .sort((a, b) => b.values.length - a.values.length); // most values first

  // Global states coverage (across all type variants)
  const states = buildGlobalStates(variantMaps, stateProp, requiredStates);

  // Per-type coverage matrix
  const typeStateCoverage = buildTypeStateCoverage(variantMaps, typeProp, stateProp, requiredStates);

  // States coverage % (required states present globally)
  const requiredTotal   = states.filter(s => s.required).length;
  const requiredPresent = states.filter(s => s.required && s.status === 'present').length;
  const statesCoverage  = requiredTotal > 0 ? Math.round(requiredPresent / requiredTotal * 100) : 100;

  // Categories
  const tokenCategory  = checkTokenUsage(node);
  const a11yCategory   = checkAccessibility(node, componentType, states);
  const namingCategory = checkNamingConvention(node, componentType, hasVariantProps);
  const categories     = [tokenCategory, a11yCategory, namingCategory];

  const overallScore = Math.round(
    statesCoverage * 0.5 +
    categories.reduce((s, c) => s + c.score, 0) / categories.length * 0.5
  );

  return {
    componentType,
    componentName: node.name,
    variantProperties,
    typeProperty: typeProp,
    stateProperty: stateProp,
    typeStateCoverage,
    states,
    statesCoverage,
    categories,
    overallScore,
    analyzedAt: new Date().toISOString(),
  };
}
