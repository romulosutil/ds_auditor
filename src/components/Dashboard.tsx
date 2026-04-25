import { historyService, HistoryEntry } from '../services/historyService';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle2, History } from 'lucide-react';
import { cn } from '../lib/utils';

export function Dashboard() {
  const history = historyService.getAll();

  if (history.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white">
        <div className="w-16 h-16 bg-[#F4F4F5] rounded-2xl flex items-center justify-center mb-6">
          <BarChart3 className="w-8 h-8 text-[#A1A1AA]" />
        </div>
        <h2 className="text-xl font-bold text-[#18181B] mb-2">Sem dados históricos</h2>
        <p className="text-[#71717A] max-w-sm">Execute algumas auditorias para começar a visualizar as métricas de saúde do seu Design System.</p>
      </div>
    );
  }

  const avgAudit = Math.round(history.reduce((acc, curr) => acc + curr.auditScore, 0) / history.length);
  const avgHandoff = Math.round(history.reduce((acc, curr) => acc + curr.handoffScore, 0) / history.length);
  const totalErrors = history.reduce((acc, curr) => acc + curr.criticalErrors, 0);

  return (
    <div className="flex-1 overflow-y-auto p-12 space-y-12 bg-white">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#18181B]">Dashboard de Saúde</h1>
        <p className="text-[#71717A]">Métricas consolidadas baseadas em {history.length} auditorias recentes.</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#F8FAFC] p-6 rounded-3xl border border-[#E2E8F0]">
          <TrendingUp className="w-6 h-6 text-[#6366F1] mb-4" />
          <h3 className="text-sm font-bold text-[#64748B] uppercase tracking-wider mb-1">Média de Auditoria</h3>
          <p className="text-4xl font-bold text-[#1E293B]">{avgAudit}%</p>
        </div>
        <div className="bg-[#F0FDF4] p-6 rounded-3xl border border-[#DCFCE7]">
          <CheckCircle2 className="w-6 h-6 text-[#10B981] mb-4" />
          <h3 className="text-sm font-bold text-[#15803D] uppercase tracking-wider mb-1">Média de Handoff</h3>
          <p className="text-4xl font-bold text-[#166534]">{avgHandoff}%</p>
        </div>
        <div className="bg-[#FEF2F2] p-6 rounded-3xl border border-[#FEE2E2]">
          <AlertTriangle className="w-6 h-6 text-[#EF4444] mb-4" />
          <h3 className="text-sm font-bold text-[#B91C1C] uppercase tracking-wider mb-1">Total de Erros</h3>
          <p className="text-4xl font-bold text-[#991B1B]">{totalErrors}</p>
        </div>
      </div>

      {/* Recent History Table */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-[#18181B]" />
          <h2 className="text-xl font-bold text-[#18181B]">Histórico Recente</h2>
        </div>

        <div className="bg-white border border-[#E4E4E7] rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#E4E4E7]">
                <th className="px-6 py-4 text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider">Frame / Ficheiro</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider text-center">Auditoria</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider text-center">Handoff</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider text-center">Críticos</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-6 py-4 text-xs text-[#71717A]">
                    {new Date(entry.timestamp).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-[#18181B]">{entry.frameName}</span>
                      <span className="text-[10px] text-[#A1A1AA]">{entry.fileName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      'text-xs font-bold px-2.5 py-1 rounded-full',
                      entry.auditScore >= 80 ? 'bg-emerald-100 text-emerald-700' : 
                      entry.auditScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    )}>
                      {entry.auditScore}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-bold text-[#18181B]">{entry.handoffScore}%</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      'text-xs font-bold',
                      entry.criticalErrors > 0 ? 'text-red-600' : 'text-emerald-600'
                    )}>
                      {entry.criticalErrors}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
