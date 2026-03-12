import { Activity, AlertTriangle, ShieldCheck, Target } from 'lucide-react';
import { cn } from '../lib/utils';

interface ScoreCardsProps {
  score: number;
  compliance: number;
  criticalErrors: number;
  alerts: number;
}

export function ScoreCards({ score, compliance, criticalErrors, alerts }: ScoreCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-8">
      {/* Score Geral */}
      <div className="bg-white p-5 rounded-2xl border border-[#E4E4E7] shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-3 text-[#71717A]">
           <Target className="w-4 h-4" />
           <span className="text-sm font-medium">Score Geral</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn(
             "text-3xl font-bold tracking-tight",
             score >= 80 ? "text-[#10B981]" : score >= 60 ? "text-[#F59E0B]" : "text-[#EF4444]"
          )}>{score}</span>
          <span className="text-sm text-[#A1A1AA] font-medium">/100</span>
        </div>
      </div>

      {/* Conformidade DS */}
      <div className="bg-white p-5 rounded-2xl border border-[#E4E4E7] shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-3 text-[#71717A]">
           <ShieldCheck className="w-4 h-4" />
           <span className="text-sm font-medium">Conformidade DS</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn(
             "text-3xl font-bold tracking-tight text-[#27272A]"
          )}>{compliance}%</span>
        </div>
        <p className="text-xs text-[#71717A] mt-2">+12% vs última checagem</p>
      </div>

      {/* Erros Críticos */}
      <div className="bg-white p-5 rounded-2xl border border-[#FEF2F2] shadow-sm flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute inset-0 bg-[#FEF2F2] opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3 text-[#DC2626]">
               <Activity className="w-4 h-4" />
               <span className="text-sm font-medium">Erros Críticos</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight text-[#DC2626]">{criticalErrors}</span>
            </div>
            <p className="text-xs text-[#DC2626]/80 mt-2 font-medium">Bloqueiam Pull Request</p>
        </div>
      </div>

      {/* Total Alertas */}
      <div className="bg-white p-5 rounded-2xl border border-[#FFFBEB] shadow-sm flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute inset-0 bg-[#FFFBEB] opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3 text-[#D97706]">
               <AlertTriangle className="w-4 h-4" />
               <span className="text-sm font-medium">Avisos (Warnings)</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight text-[#D97706]">{alerts}</span>
            </div>
             <p className="text-xs text-[#D97706]/80 mt-2 font-medium">Revisão recomendada</p>
        </div>
      </div>
    </div>
  );
}
