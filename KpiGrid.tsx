import React from 'react';
import { KpiResult } from './types';
import { CheckCircle, AlertTriangle, XCircle, HelpCircle, Loader2 } from 'lucide-react';

interface KpiGridProps {
    kpis: KpiResult[];
    isLoading?: boolean;
}

const statusStyle: Record<KpiResult['status'], { bg: string; text: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = {
    'On Track': { bg: 'bg-green-50 border-green-200', text: 'text-green-700', Icon: CheckCircle },
    'At Risk': { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', Icon: AlertTriangle },
    'Off Track': { bg: 'bg-red-50 border-red-200', text: 'text-red-700', Icon: XCircle },
    'No Data': { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-400', Icon: HelpCircle },
};

const formatValue = (kpi: KpiResult) => {
    if (kpi.status === 'No Data') return '—';
    if (kpi.unit === 'percent') return `${kpi.actual}%`;
    if (kpi.unit === 'rating') return `${kpi.actual}/5`;
    return `${kpi.actual}`;
};

const formatTarget = (kpi: KpiResult) => {
    if (kpi.unit === 'percent') return `Target ${kpi.target}%`;
    if (kpi.unit === 'rating') return `vs. ${kpi.target}/5`;
    return `Target ${kpi.target}`;
};

export const KpiGrid: React.FC<KpiGridProps> = ({ kpis, isLoading }) => {
    if (isLoading) {
        return <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="animate-spin" size={20} /></div>;
    }
    if (kpis.length === 0) {
        return <div className="text-center py-8 text-gray-400 text-sm">No KPIs to show.</div>;
    }
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {kpis.map(kpi => {
                const style = statusStyle[kpi.status];
                return (
                    <div key={kpi.kpiId} className={`border rounded-lg p-4 ${style.bg}`}>
                        <div className="flex justify-between items-start gap-2">
                            <span className="text-xs font-bold text-gray-600 leading-tight">{kpi.label}</span>
                            <style.Icon size={14} className={style.text} />
                        </div>
                        <div className="mt-2 flex items-end gap-2">
                            <span className={`text-2xl font-bold ${style.text}`}>{formatValue(kpi)}</span>
                            <span className="text-[10px] text-gray-400 mb-1">{formatTarget(kpi)}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-gray-400">{kpi.period}</div>
                    </div>
                );
            })}
        </div>
    );
};
