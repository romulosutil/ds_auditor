import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { AuditIssue } from '../services/auditEngine';

interface CategoryDetailsProps {
    title: string;
    issues: AuditIssue[];
    type: 'error' | 'warning';
    onHoverIssue?: (issue: AuditIssue | null) => void;
}

export function CategoryDetails({ title, issues, type, onHoverIssue }: CategoryDetailsProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!issues || issues.length === 0) return null;

    return (
        <div className={cn(
          "border rounded-xl overflow-hidden mb-4 shadow-sm transition-all duration-300",
          type === 'error' ? "bg-white border-[#E4E4E7]" : "bg-white border-[#E4E4E7]"
        )}>
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 bg-[#FAFAFA] hover:bg-[#F4F4F5] transition-colors border-b border-[#E4E4E7]"
            >
                <div className="flex items-center gap-3">
                   {type === 'error' ? (
                       <XCircle className="w-5 h-5 text-[#DC2626]" />
                   ) : (
                       <AlertCircle className="w-5 h-5 text-[#D97706]" />
                   )}
                   <span className="font-semibold text-[#18181B]">{title}</span>
                   <span className={cn(
                     "text-xs px-2 py-0.5 rounded-full font-medium",
                     type === 'error' 
                       ? "bg-[#FEF2F2] text-[#DC2626]" 
                       : "bg-[#FFFBEB] text-[#D97706]"
                   )}>
                       {issues.length} {issues.length === 1 ? 'problema' : 'problemas'}
                   </span>
                </div>
                {isExpanded ? <ChevronDown className="w-4 h-4 text-[#A1A1AA]" /> : <ChevronRight className="w-4 h-4 text-[#A1A1AA]" />}
            </button>

            {isExpanded && (
                <div className="p-4 bg-white space-y-3">
                    {issues.map((issue, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-start gap-3 text-sm group/issue cursor-default p-2 rounded-lg hover:bg-[#F4F4F5] transition-all duration-200"
                          onMouseEnter={() => onHoverIssue?.(issue)}
                          onMouseLeave={() => onHoverIssue?.(null)}
                        >
                            <div className={cn(
                              "mt-1.5 w-2 h-2 rounded-full shrink-0 shadow-sm",
                              type === 'error' ? "bg-[#DC2626]" : "bg-[#D97706]"
                            )} />
                            <div className="flex flex-col gap-1 w-full">
                              <p className="text-[#3F3F46] leading-relaxed group-hover/issue:text-[#18181B]">{issue.message}</p>
                              {issue.suggestion && (
                                <p className="text-[11px] text-[#71717A] bg-[#FAFAFA] group-hover/issue:bg-white px-2 py-1.5 rounded-lg border border-transparent group-hover/issue:border-[#E4E4E7] transition-colors">
                                  💡 {issue.suggestion}
                                </p>
                              )}
                              {issue.layerName && (
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-[9px] font-bold text-[#A1A1AA] uppercase tracking-tighter">Camada:</span>
                                    <span className="text-[10px] font-mono text-[#6366F1] bg-[#6366F1]/5 px-1.5 py-0.5 rounded">
                                      {issue.layerName}
                                    </span>
                                </div>
                              )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
