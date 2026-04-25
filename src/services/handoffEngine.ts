/**
 * handoffEngine.ts
 *
 * "O Handoff Perfeito (As 4 Verdades + Performance)"
 * Analisa um FigmaNode para verificar a completude do handoff para dev,
 * baseado em 5 pilares: Estados, Regras, Escopo, Acessibilidade e Performance DX.
 */

import type { FigmaNode, FigmaLayer } from './figmaService';

// ─── Types ────────────────────────────────────────────────────────────────

export interface HandoffItem {
  id: string;
  label: string;
  found: boolean;
  foundIn?: string;
  required: boolean;
  tip: string;
}

export interface HandoffPillar {
  id: 'states' | 'rules' | 'scope' | 'a11y' | 'performance';
  title: string;
  description: string;
  score: number;
  items: HandoffItem[];
}

export interface HandoffResults {
  overall: number;
  pillars: HandoffPillar[];
  generatedDoc: string;
  frameName: string;
  analyzedAt: string;
}

// ─── Keyword Maps ─────────────────────────────────────────────────────────

const STATE_KEYWORDS = {
  loading: ['loading', 'skeleton', 'spinner', 'carregando', 'carregamento', 'shimmer', 'pending', 'aguardando'],
  empty:   ['empty', 'vazio', 'empty state', 'sem dados', 'no data', 'no items', 'sem resultados', 'sem conteúdo'],
  error:   ['error', 'erro', 'invalid', 'failed', 'falhou', 'falha', 'failure', 'danger', 'destructive', 'inválido'],
  success: ['success', 'sucesso', 'concluído', 'concluido', 'confirmação', 'confirmacao', 'done', 'completed', 'aprovado', 'ok', 'toast'],
};

const RULE_KEYWORDS = {
  conditional: ['admin', 'logged', 'role', 'permission', 'permissão', 'if ', 'condition', 'condicional', 'só para', 'somente'],
  validation:  ['validation', 'valid', 'invalid', 'required', 'obrigatório', 'max', 'limit', 'limite', 'mín', 'min', 'senha', 'password', 'caracteres'],
  navigation:  ['back', 'voltar', 'cancel', 'cancelar', 'close', 'fechar', 'esc', 'dismiss', 'sair'],
};

const SCOPE_KEYWORDS = {
  desktop: ['desktop', '1440', '1280', '1024', 'lg', 'xl', 'web'],
  mobile:  ['mobile', 'celular', 'smartphone', '375', '390', '414', 'sm', 'xs', 'iphone'],
  tablet:  ['tablet', 'ipad', '768', '834', 'md'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function collectLayerNames(layer: FigmaLayer): string[] {
  const names: string[] = [layer.name.toLowerCase()];
  if (layer.children) {
    for (const child of layer.children) {
      names.push(...collectLayerNames(child));
    }
  }
  return names;
}

function findKeyword(names: string[], keywords: string[]): string | undefined {
  for (const name of names) {
    for (const kw of keywords) {
      if (name.includes(kw)) return name;
    }
  }
  return undefined;
}

function collectTokensUsed(layer: FigmaLayer, acc: Set<string> = new Set()): Set<string> {
  if (layer.fills) {
    layer.fills.forEach(f => { if (f.variableName) acc.add(f.variableName); });
  }
  if (layer.fontFamily) acc.add(layer.fontFamily);
  if (layer.children) layer.children.forEach(c => collectTokensUsed(c, acc));
  return acc;
}

function calculateTreeDepth(layer: FigmaLayer): number {
  if (!layer.children || layer.children.length === 0) return 1;
  return 1 + Math.max(...layer.children.map(calculateTreeDepth));
}

function countHiddenLayers(layer: FigmaLayer): number {
  let count = (layer as any).visible === false ? 1 : 0;
  if (layer.children) {
    count += layer.children.reduce((acc, child) => acc + countHiddenLayers(child), 0);
  }
  return count;
}

// ─── Main ──────────────────────────────────────────────────────────────────

export function runHandoffAnalysis(node: FigmaNode): HandoffResults {
  // Collect all layer names from the frame
  const allNames: string[] = [node.name.toLowerCase()];
  for (const layer of node.layers) {
    allNames.push(...collectLayerNames(layer as unknown as FigmaLayer));
  }

  // Collect tokens used across all layers
  const tokensSet = new Set<string>();
  for (const layer of node.layers) {
    collectTokensUsed(layer as unknown as FigmaLayer, tokensSet);
  }
  const tokensUsed = Array.from(tokensSet).slice(0, 12);

  // ── Pilar 1: Estados ─────────────────────────────────────────────────
  const loadingLayer = findKeyword(allNames, STATE_KEYWORDS.loading);
  const emptyLayer   = findKeyword(allNames, STATE_KEYWORDS.empty);
  const errorLayer   = findKeyword(allNames, STATE_KEYWORDS.error);
  const successLayer = findKeyword(allNames, STATE_KEYWORDS.success);

  const statesPillar: HandoffPillar = {
    id: 'states',
    title: '1. Estados',
    description: 'O fim do caminho feliz — o que a interface mostra além do fluxo ideal.',
    score: 0,
    items: [
      {
        id: 'loading',
        label: 'Loading / Skeleton',
        found: !!loadingLayer,
        foundIn: loadingLayer,
        required: true,
        tip: 'Adicione frames ou variantes com "Loading" ou "Skeleton" no nome.',
      },
      {
        id: 'empty',
        label: 'Empty State',
        found: !!emptyLayer,
        foundIn: emptyLayer,
        required: true,
        tip: 'Crie um frame "Empty State" mostrando a interface sem dados.',
      },
      {
        id: 'error',
        label: 'Estado de Erro',
        found: !!errorLayer,
        foundIn: errorLayer,
        required: true,
        tip: 'Documente erros de API, validações de formulário e perda de internet.',
      },
      {
        id: 'success',
        label: 'Estado de Sucesso',
        found: !!successLayer,
        foundIn: successLayer,
        required: false,
        tip: 'Feedback visual após ação concluída (toast, modal, animação).',
      },
    ],
  };
  statesPillar.score = Math.round(
    (statesPillar.items.filter(i => i.found).length / statesPillar.items.length) * 100
  );

  // ── Pilar 2: Regras de Negócio ────────────────────────────────────────
  const conditionalLayer = findKeyword(allNames, RULE_KEYWORDS.conditional);
  const validationLayer  = findKeyword(allNames, RULE_KEYWORDS.validation);
  const navigationLayer  = findKeyword(allNames, RULE_KEYWORDS.navigation);

  const rulesPillar: HandoffPillar = {
    id: 'rules',
    title: '2. Regras de Negócio',
    description: 'Comportamentos não visuais — "Se X, então Y".',
    score: 0,
    items: [
      {
        id: 'conditional',
        label: 'Condicionais de Visualização',
        found: !!conditionalLayer,
        foundIn: conditionalLayer,
        required: false,
        tip: 'Ex: "o botão Excluir só aparece se o usuário for Admin".',
      },
      {
        id: 'validation',
        label: 'Limites e Validações',
        found: !!validationLayer,
        foundIn: validationLayer,
        required: true,
        tip: 'Indique máximo de caracteres, regras de senha, campos obrigatórios.',
      },
      {
        id: 'navigation',
        label: 'Comportamento ao Cancelar/Voltar',
        found: !!navigationLayer,
        foundIn: navigationLayer,
        required: true,
        tip: 'Descreva o que acontece ao clicar em "Voltar" ou "Cancelar".',
      },
    ],
  };
  rulesPillar.score = Math.round(
    (rulesPillar.items.filter(i => i.found).length / rulesPillar.items.length) * 100
  );

  // ── Pilar 3: Prioridades e Escopo ─────────────────────────────────────
  const hasDesktop   = !!findKeyword(allNames, SCOPE_KEYWORDS.desktop);
  const hasMobile    = !!findKeyword(allNames, SCOPE_KEYWORDS.mobile);
  const hasTokens    = tokensUsed.length > 0;
  const hasMultipleFrames = node.layers.length > 1;

  const scopePillar: HandoffPillar = {
    id: 'scope',
    title: '3. Prioridades e Escopo',
    description: 'O que é inegociável vs. o que pode ser simplificado pelo dev.',
    score: 0,
    items: [
      {
        id: 'desktop',
        label: 'Breakpoint Desktop',
        found: hasDesktop,
        required: true,
        tip: 'Nomeie o frame com "Desktop" ou use largura 1440px.',
      },
      {
        id: 'mobile',
        label: 'Breakpoint Mobile',
        found: hasMobile,
        required: false,
        tip: 'Adicione um frame "Mobile" (375 ou 390px) para responsividade.',
      },
      {
        id: 'ds-tokens',
        label: 'Tokens DS4FUN Aplicados',
        found: hasTokens,
        foundIn: hasTokens ? `${tokensUsed.length} variável(is) detectada(s)` : undefined,
        required: true,
        tip: 'Use variáveis do DS4FUN ao invés de valores hardcoded.',
      },
      {
        id: 'multi-frame',
        label: 'Múltiplos Frames / Fluxo',
        found: hasMultipleFrames,
        foundIn: hasMultipleFrames ? `${node.layers.length} camadas` : undefined,
        required: false,
        tip: 'Separe estados e fluxos em frames distintos para clareza.',
      },
    ],
  };
  scopePillar.score = Math.round(
    (scopePillar.items.filter(i => i.found).length / scopePillar.items.length) * 100
  );

  // ── Pilar 4: Acessibilidade e Tokens ──────────────────────────────────
  const hasTabOrder = !!findKeyword(allNames, ['tab order', 'tab-order', 'tabindex', 'foco', 'focus order']);
  const hasAria     = !!findKeyword(allNames, ['aria', 'sr-only', 'screen reader', 'leitor de tela', 'alt text', 'alt:']);
  const hasA11yAnnotation = !!findKeyword(allNames, ['a11y', 'acessibilidade', 'accessibility', 'wcag']);

  const a11yPillar: HandoffPillar = {
    id: 'a11y',
    title: '4. Acessibilidade e Tokens',
    description: 'Requisitos técnicos visuais e de navegação para os devs.',
    score: 0,
    items: [
      {
        id: 'tab-order',
        label: 'Tab Order Documentado',
        found: hasTabOrder,
        required: false,
        tip: 'Anote a ordem de tabulação recomendada nas anotações do frame.',
      },
      {
        id: 'aria',
        label: 'Labels ARIA / Texto Alternativo',
        found: hasAria,
        required: true,
        tip: 'Elementos interativos precisam de labels ARIA para leitores de tela.',
      },
      {
        id: 'a11y-note',
        label: 'Anotação de Acessibilidade',
        found: hasA11yAnnotation,
        required: false,
        tip: 'Adicione uma seção de acessibilidade com notas para o dev.',
      },
      {
        id: 'tokens-applied',
        label: 'Tokens de Cor/Tipografia',
        found: hasTokens,
        foundIn: hasTokens ? tokensUsed.slice(0, 3).join(', ') : undefined,
        required: true,
        tip: 'Use os tokens semânticos do DS4FUN para garantir contraste e consistência.',
      },
    ],
  };
  a11yPillar.score = Math.round(
    (a11yPillar.items.filter(i => i.found).length / a11yPillar.items.length) * 100
  );

  // ── Pilar 5: Performance de Estrutura ───────────────────────────────
  const maxDepth = node.layers.reduce((max, l) => Math.max(max, calculateTreeDepth(l as unknown as FigmaLayer)), 0);
  const hiddenCount = node.layers.reduce((acc, l) => acc + countHiddenLayers(l as unknown as FigmaLayer), 0);
  const totalLayers = allNames.length;

  const performancePillar: HandoffPillar = {
    id: 'performance',
    title: '5. Performance de Estrutura',
    description: 'Qualidade técnica da árvore de camadas (DX - Developer Experience).',
    score: 0,
    items: [
      {
        id: 'tree-depth',
        label: `Profundidade de Árvore (${maxDepth} níveis)`,
        found: maxDepth <= 12,
        required: false,
        tip: 'Árvores muito profundas dificultam a navegação do dev. Tente simplificar grupos aninhados.',
      },
      {
        id: 'hidden-layers',
        label: `Camadas Ocultas (${hiddenCount} detectadas)`,
        found: hiddenCount <= 5,
        required: false,
        tip: 'Muitas camadas ocultas poluem o arquivo e o código gerado. Remova o que não é necessário.',
      },
      {
        id: 'layer-count',
        label: `Complexidade de Frame (${totalLayers} camadas)`,
        found: totalLayers < 250,
        required: true,
        tip: 'Frames com mais de 250 camadas podem causar lentidão no Dev Mode e exportação.',
      }
    ],
  };
  performancePillar.score = Math.round(
    (performancePillar.items.filter(i => i.found).length / performancePillar.items.length) * 100
  );

  // ── Overall Score ──────────────────────────────────────────────────────
  const pillars = [statesPillar, rulesPillar, scopePillar, a11yPillar, performancePillar];
  // Required items weight more
  const requiredItems  = pillars.flatMap(p => p.items.filter(i => i.required));
  const optionalItems  = pillars.flatMap(p => p.items.filter(i => !i.required));
  const requiredScore  = requiredItems.length > 0
    ? requiredItems.filter(i => i.found).length / requiredItems.length
    : 1;
  const optionalScore  = optionalItems.length > 0
    ? optionalItems.filter(i => i.found).length / optionalItems.length
    : 1;
  const overall = Math.round((requiredScore * 0.7 + optionalScore * 0.3) * 100);

  // ── Generate Markdown Document ────────────────────────────────────────
  const generatedDoc = generateHandoffDoc(node.name, pillars, tokensUsed);

  return { overall, pillars, generatedDoc, frameName: node.name, analyzedAt: new Date().toISOString() };
}

// ─── Markdown Generator ────────────────────────────────────────────────────

function generateHandoffDoc(frameName: string, pillars: HandoffPillar[], tokensUsed: string[]): string {
  const date = new Date().toLocaleDateString('pt-BR');

  const sections = pillars.map(p => {
    const found   = p.items.filter(i => i.found);
    const missing = p.items.filter(i => !i.found);

    const foundLines   = found.map(i => `- ✅ **${i.label}**${i.foundIn ? ` *(detectado: "${i.foundIn}")*` : ''}`).join('\n');
    const missingLines = missing.map(i => `- ❌ **${i.label}** — ${i.tip}`).join('\n');

    return [
      `## ${p.title}`,
      `> ${p.description}`,
      '',
      foundLines   || '*(nenhum item detectado automaticamente)*',
      missingLines ? `\n### ⚠️ A Implementar\n${missingLines}` : '',
    ].join('\n');
  });

  const tokensSection = tokensUsed.length > 0
    ? `\n## Tokens Detectados no Frame\n${tokensUsed.map(t => `- \`${t}\``).join('\n')}`
    : '';

  return `# Handoff: ${frameName}

> Documento gerado pelo **DS Auditor v4.0** — ${date}
> Baseado no framework *"O Handoff Perfeito (As 4 Verdades)"*

---

${sections.join('\n\n---\n\n')}
${tokensSection}

---

### Informações da Funcionalidade *(preencha antes de enviar ao dev)*

- **Nome do Fluxo/Ecrã:** ${frameName}
- **Objetivo Principal:** *(descreva o objetivo principal)*
- **O que já está no Design:** *(liste os estados e fluxos entregues)*
- **Dúvidas / Pontos cegos:** *(liste o que ainda precisa de definição)*

---

*Gerado com [DS Auditor](https://github.com) · DS4FUN v1.4.0*`;
}
