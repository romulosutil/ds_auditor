import type { FigmaLayer, AuditIssue } from './auditEngine';

/**
 * Component Completeness & Structure Analysis
 */
export function checkComponentCompleteness(layers: FigmaLayer[], _allLayers: FigmaLayer[]): AuditIssue[] {
  const issues: AuditIssue[] = [];

  layers.forEach(layer => {
    // Focamos em COMPONENT_SET (Variantes no Figma)
    if (layer.type === 'COMPONENT_SET') {
      const variantNames = (layer.children || []).map(child => child.name.toLowerCase());
      
      const isButton = layer.name.toLowerCase().includes('button') || layer.name.toLowerCase().includes('botão');
      const isInput = layer.name.toLowerCase().includes('input') || layer.name.toLowerCase().includes('campo');

      if (isButton || isInput) {
        const requiredStates = ['hover', 'disabled'];
        const missingStates = requiredStates.filter(state => 
          !variantNames.some(name => name.includes(state))
        );

        if (missingStates.length > 0) {
          issues.push({
            category: 'components',
            severity: 'warning',
            message: `Componente Incompleto: Faltam estados essenciais (${missingStates.join(', ')}).`,
            suggestion: `Para garantir um Design System robusto, adicione variantes para os estados: ${missingStates.map(s => s.toUpperCase()).join(', ')}.`,
            layerId: layer.id,
            layerName: layer.name,
            x: layer.x,
            y: layer.y,
            width: layer.width,
            height: layer.height
          });
        }
      }
    }

    // Detached Components
    const suspectNames = ['button', 'input', 'dropdown', 'checkbox', 'toggle'];
    if ((layer.type === 'FRAME' || layer.type === 'GROUP') && suspectNames.some(name => layer.name.toLowerCase().includes(name))) {
       const hasInstances = (layer.children || []).some(c => c.type === 'INSTANCE');
       if (!hasInstances && layer.width > 20) {
          issues.push({
            category: 'components',
            severity: 'warning',
            message: 'Possível componente desvinculado (Detached).',
            suggestion: 'Este elemento parece um componente mas está estruturado como um Frame comum. Vincule-o à biblioteca DS4FUN.',
            layerId: layer.id,
            layerName: layer.name,
            x: layer.x,
            y: layer.y,
            width: layer.width,
            height: layer.height
          });
       }
    }
  });

  return issues;
}
