/**
 * historyService.ts
 * 
 * Gerencia a persistência local dos resultados das auditorias.
 */

import type { AuditResults } from './auditEngine';
import type { HandoffResults } from './handoffEngine';

export interface HistoryEntry {
  id: string;
  timestamp: string;
  fileName: string;
  frameName: string;
  auditScore: number;
  handoffScore: number;
  criticalErrors: number;
  alerts: number;
}

const STORAGE_KEY = 'ds_auditor_history';

export const historyService = {
  save(fileName: string, frameName: string, audit: AuditResults, handoff: HandoffResults) {
    const history = this.getAll();
    const newEntry: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      fileName,
      frameName,
      auditScore: audit.score,
      handoffScore: handoff.overall,
      criticalErrors: audit.criticalErrors,
      alerts: audit.alerts
    };

    history.unshift(newEntry);
    // Limita o histórico aos últimos 50 registros para não estourar o localStorage
    const limitedHistory = history.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedHistory));
    return newEntry;
  },

  getAll(): HistoryEntry[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
};
