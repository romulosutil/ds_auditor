import type { FigmaLayer, AuditIssue } from './auditEngine';

/**
 * UX Heuristics Audit
 */
export function checkHeuristics(layers: FigmaLayer[], _allLayers: FigmaLayer[]): AuditIssue[] {
  const issues: AuditIssue[] = [];

  layers.forEach(layer => {
    // 1. Touch Targets (Área de Clique)
    const isInteractive = 
      layer.name.toLowerCase().includes('button') || 
      layer.name.toLowerCase().includes('btn') ||
      layer.name.toLowerCase().includes('icon') ||
      layer.name.toLowerCase().includes('link') ||
      layer.type === 'COMPONENT' || 
      layer.type === 'INSTANCE';

    if (isInteractive) {
      const minSize = 44;
      if (layer.width < minSize || layer.height < minSize) {
        issues.push({
          category: 'heuristics',
          severity: 'warning',
          message: `Área de clique reduzida: ${Math.round(layer.width)}x${Math.round(layer.height)}px.`,
          suggestion: `Aumente o tamanho para pelo menos ${minSize}x${minSize}px (Heurística de Usabilidade) ou adicione padding transparente.`,
          layerId: layer.id,
          layerName: layer.name,
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height
        });
      }
    }

    // 2. Alignment Consistency
    if (Math.abs(layer.x - Math.round(layer.x)) > 0.1 || Math.abs(layer.y - Math.round(layer.y)) > 0.1) {
       issues.push({
          category: 'spacing',
          severity: 'warning',
          message: 'Posicionamento sub-pixel detectado.',
          suggestion: 'Arredonde as coordenadas (X, Y) para pixels inteiros para evitar borrões na renderização.',
          layerId: layer.id,
          layerName: layer.name,
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height
       });
    }
  });

  return issues;
}
