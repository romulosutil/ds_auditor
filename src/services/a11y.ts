import type { FigmaLayer, AuditIssue } from './auditEngine';

/**
 * Calculates relative luminance for a single color channel.
 */
function getLuminance(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * Calculates relative luminance of an RGB color.
 */
function calculateRelativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * getLuminance(r) + 0.7152 * getLuminance(g) + 0.0722 * getLuminance(b);
}

/**
 * Calculates contrast ratio between two hex colors.
 */
export function calculateContrastRatio(hex1: string, hex2: string): number {
  const l1 = calculateRelativeLuminance(hex1);
  const l2 = calculateRelativeLuminance(hex2);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * A11y Audit Rules (WCAG 2.1)
 */
export function checkA11y(layers: FigmaLayer[], allLayers: FigmaLayer[]): AuditIssue[] {
  const issues: AuditIssue[] = [];

  layers.forEach(layer => {
    if (layer.type === 'TEXT' && layer.fills && layer.fills.length > 0) {
      const textFill = layer.fills.find(f => f.type === 'SOLID');
      if (textFill && textFill.hex) {
        const backgroundLayer = findBackgroundLayer(layer, allLayers);
        const bgFill = backgroundLayer?.fills?.find(f => f.type === 'SOLID');
        
        const bgHex = bgFill?.hex || '#FFFFFF';
        const contrast = calculateContrastRatio(textFill.hex, bgHex);
        
        const isLargeText = (layer.fontSize || 12) >= 18 || ((layer.fontSize || 12) >= 14 && (layer.name.toLowerCase().includes('bold') || (layer as any).fontWeight === 700));
        const minContrast = isLargeText ? 3.0 : 4.5;

        if (contrast < minContrast) {
          issues.push({
            category: 'colors',
            severity: 'error',
            message: `Baixo contraste detectado: ${contrast.toFixed(2)}:1. (Nível AA exige ${minContrast}:1)`,
            suggestion: `Aumente o contraste entre ${textFill.hex} e o fundo ${bgHex}.`,
            layerId: layer.id,
            layerName: layer.name,
            x: layer.x,
            y: layer.y,
            width: layer.width,
            height: layer.height
          });
        }
      }

      const fontSize = layer.fontSize || 12;
      if (fontSize < 12) {
        issues.push({
          category: 'typography',
          severity: 'warning',
          message: `Texto muito pequeno: ${fontSize}px.`,
          suggestion: 'Design Systems devem evitar fontes menores que 12px para garantir legibilidade.',
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

function findBackgroundLayer(target: FigmaLayer, all: FigmaLayer[]): FigmaLayer | null {
   const possibleBgs = all.filter(l => 
     l.id !== target.id && 
     l.type !== 'TEXT' && 
     l.fills && l.fills.length > 0 &&
     (l.x || 0) <= (target.x || 0) &&
     (l.y || 0) <= (target.y || 0) &&
     ((l.x || 0) + (l.width || 0)) >= ((target.x || 0) + (target.width || 0)) &&
     ((l.y || 0) + (l.height || 0)) >= ((target.y || 0) + (target.height || 0))
   );

   if (possibleBgs.length === 0) return null;
   return possibleBgs.sort((a, b) => ((a.width || 0) * (a.height || 0)) - ((b.width || 0) * (b.height || 0)))[0];
}
