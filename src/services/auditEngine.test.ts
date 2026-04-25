import { describe, it, expect } from 'vitest';
import { checkColors, checkTypography, checkSpacing, checkRadii, DS4FUN_PRIMITIVE_COLORS } from './auditEngine';
import type { FigmaLayer } from './auditEngine';

describe('AuditEngine Core Logic', () => {
  describe('checkColors', () => {
    it('should pass for valid DS4FUN primitive colors', () => {
      const validHex = Array.from(DS4FUN_PRIMITIVE_COLORS)[0];
      const layers: FigmaLayer[] = [{
        id: '1:1',
        name: 'Rect',
        type: 'RECTANGLE',
        x: 0, y: 0, width: 100, height: 100,
        fills: [{ type: 'SOLID', hex: validHex }]
      }];
      const issues = checkColors(layers);
      expect(issues).toHaveLength(0);
    });

    it('should fail for invalid colors', () => {
      const layers: FigmaLayer[] = [{
        id: '1:2',
        name: 'Rect',
        type: 'RECTANGLE',
        x: 0, y: 0, width: 100, height: 100,
        fills: [{ type: 'SOLID', hex: '#FF00FF' }] // Magenta not in DS
      }];
      const issues = checkColors(layers);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Cor não permitida');
    });
  });

  describe('checkTypography', () => {
    it('should pass for Montserrat and Inter', () => {
      const layers: FigmaLayer[] = [
        { id: 't1', name: 'T1', type: 'TEXT', x: 0, y: 0, width: 10, height: 10, fills: [], fontFamily: 'Montserrat' },
        { id: 't2', name: 'T2', type: 'TEXT', x: 0, y: 0, width: 10, height: 10, fills: [], fontFamily: 'Inter' }
      ];
      const issues = checkTypography(layers);
      expect(issues).toHaveLength(0);
    });
  });

  describe('checkRadii', () => {
    it('should pass for valid DS4FUN radii with token simulation', () => {
      const layers: FigmaLayer[] = [{
        id: 'r1', name: 'Button-radius-md', type: 'FRAME', x: 0, y: 0, width: 100, height: 40,
        fills: [], cornerRadius: 8
      }];
      const issues = checkRadii(layers);
      expect(issues).toHaveLength(0);
    });

    it('should fail for radii out of scale', () => {
      const layers: FigmaLayer[] = [{
        id: 'r2', name: 'CustomRect', type: 'FRAME', x: 0, y: 0, width: 100, height: 100,
        fills: [], cornerRadius: 13
      }];
      const issues = checkRadii(layers);
      expect(issues.some(i => i.severity === 'error' && i.message.includes('fora da escala'))).toBe(true);
    });

    it('should warn when valid radius is used without token', () => {
      const layers: FigmaLayer[] = [{
        id: 'r3', name: 'PlainFrame', type: 'FRAME', x: 0, y: 0, width: 100, height: 100,
        fills: [], cornerRadius: 16
      }];
      const issues = checkRadii(layers);
      expect(issues.some(i => i.severity === 'warning' && i.message.includes('sem token'))).toBe(true);
    });
  });

  describe('checkSpacing', () => {
    it('should pass for 8px grid values', () => {
      const layers: FigmaLayer[] = [
        { id: 's1', name: 'S1', type: 'FRAME', x: 0, y: 0, width: 100, height: 100, fills: [], gap: 16 }
      ];
      const issues = checkSpacing(layers);
      expect(issues).toHaveLength(0);
    });
  });

  describe('checkNaming', () => {
    it('should pass for PascalCase frames', () => {
      const layers: FigmaLayer[] = [
        { id: 'n1', name: 'CardHeader', type: 'FRAME', x: 0, y: 0, width: 10, height: 10, fills: [] }
      ];
      const issues = checkNaming(layers);
      expect(issues).toHaveLength(0);
    });

    it('should fail for generic names', () => {
      const layers: FigmaLayer[] = [
        { id: 'n2', name: 'Frame 1', type: 'FRAME', x: 0, y: 0, width: 10, height: 10, fills: [] }
      ];
      const issues = checkNaming(layers);
      expect(issues.some(i => i.severity === 'error' && i.message.includes('genérico'))).toBe(true);
    });

    it('should warn for non-PascalCase frames', () => {
      const layers: FigmaLayer[] = [
        { id: 'n3', name: 'card_header', type: 'FRAME', x: 0, y: 0, width: 10, height: 10, fills: [] }
      ];
      const issues = checkNaming(layers);
      expect(issues.some(i => i.severity === 'warning' && i.message.includes('PascalCase'))).toBe(true);
    });

    it('should warn for instances without category separator', () => {
      const layers: FigmaLayer[] = [
        { id: 'n4', name: 'ButtonPrimary', type: 'INSTANCE', x: 0, y: 0, width: 10, height: 10, fills: [] }
      ];
      const issues = checkNaming(layers);
      expect(issues.some(i => i.severity === 'warning' && i.message.includes('categoria'))).toBe(true);
    });
  });
});
