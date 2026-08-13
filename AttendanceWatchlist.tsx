import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from './AppContext';
import { AttendanceActionPlan, SystemicAttendanceAlert, AttendanceEscalationStatus } from './types';
import { getHodDepartments, normalizeProgram, SYSTEMIC_ATTENDANCE_CAUSES, ATTENDANCE_THRESHOLDS } from './data';
import {
    calculateRollingAttendance, detectSystemicAttendanceDeclines,
    StudentBatchAttendance, StudentModuleAttendance, SystemicDeclineCandidate
} from './analyticsService';
import {
    AlertTriangle, TrendingDown, TrendingUp, Minus, X, Save, ShieldAlert,
    CheckCircle, Loader2
} from 'lucide-react';

// ICAT-internal early-warning levels — NOT university/statutory attendance-eligibility
// rules. See ATTENDANCE_THRESHOLDS in data.ts.

interface AttendanceWatchlistProps {
    scope: 'my-modules' | 'department';
    title?: string;
}

const warningBadge = (level: string) => {
    if (level === 'Critical') return 'bg-red-100 text-red-700 border-red-200';
    if (level === 'Early Warning') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-green-100 text-green-700 border-green-200';
};

const TrendIcon: React.FC<{ trend: string }> = ({ trend }) => {
    if (trend === 'Improving') return <TrendingUp size={12} className="text-green-500" />;
    if (trend === 'Declining') return <TrendingDown size={12} className="text-red-500" />;
    if (trend === 'Stable') return <Minus size={12} className="text-gray-400" />;
    return <span className="text-[10px] text-gray-400">n/a</span>;
};

export const AttendanceWatchlist: React.FC<AttendanceWatchlistProps> = ({ scope, title = 'Attendance Watchlist' }) => {
    const {
        currentUser, curriculum, allocations, users, attendance,
        attendanceActionPlans, addAttendanceActionPlan, updateAttendanceActionPlan,
        systemicAttendanceAlerts, addSystemicAttendanceAlert, updateSystemicAttendanceAlert,
    } = useApp();

    const [byStudentBatch, setByStudentBatch] = useState<StudentBatchAttendance[]>([]);
    const [byStudentModule, setByStudentModule] = useState<StudentModuleAttendance[]>([]);
    const [systemicCandidates, setSystemicCandidates] = useState<SystemicDeclineCandidate[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [planStudentId, setPlanStudentId] = useState<string | null>(null);
    const [planDraft, setPlanDraft] = useState<Partial<AttendanceActionPlan> | null>(null);

    const [investigatingModuleCode, setInvestigatingModuleCode] = useState<string | null>(null);
    const [causesDraft, setCausesDraft] = useState<string[]>([]);
    const [notesDraft, setNotesDraft] = useState('');

    const relevantModuleCodes = useMemo(() => {
        if (!currentUser) return [];
        if (scope === 'my-modules') {
            return allocations.filter(a => a.tutorId === currentUser.id).map(a => a.moduleCode);
        }
        const myDepts = getHodDepartments(currentUser.id);
        if (myDepts.length === 0) return curriculum.map(m => m.code);
        return curriculum.filter(m => {
            const normProgram = normalizeProgram(m.programTitle);
            if (myDepts.includes('game') && normProgram.includes('animation')) return false;
            if (myDepts.includes('foundation') && normProgram.includes('visualarts')) return true;
            return myDepts.some(dept => normProgram.includes(dept));
        }).map(m => m.code);
    }, [currentUser, scope, allocations, curriculum]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            const rolling = await calculateRollingAttendance(attendance, users, curriculum);
            const declines = await detectSystemicAttendanceDeclines(attendance, curriculum);
            if (cancelled) return;
            setByStudentBatch(rolling.byStudentBatch);
            setByStudentModule(rolling.byStudentModule);
            setSystemicCandidates(declines);
            setIsLoading(false);
        };
        load();
        return () => { cancelled = true; };
    }, [attendance, users, curriculum]);

    const relevantStudentIds = useMemo(
        () => new Set(byStudentModule.filter(r => relevantModuleCodes.includes(r.moduleCode)).map(r => r.studentId)),
        [byStudentModule, relevantModuleCodes]
    );
    const watchlistRows = byStudentBatch
        .filter(r => relevantStudentIds.has(r.studentId) && r.warningLevel !== 'On Track')
        .sort((a, b) => a.percent - b.percent);
    const scopedSystemicCandidates = systemicCandidates.filter(c => relevantModuleCodes.includes(c.moduleCode));

    const getLatestPlan = (studentId: string) =>
        attendanceActionPlans.filter(p => p.studentId === studentId).sort((a, b) => b.updatedAt - a.updatedAt)[0];

    const openPlan = (row: StudentBatchAttendance) => {
        const existing = getLatestPlan(row.studentId);
        if (existing && existing.escalationStatus !== 'Resolved') {
            setPlanDraft(existing);
        } else {
            setPlanDraft({
                id: `aap-${row.studentId}-${Date.now()}`,
                studentId: row.studentId,
                batch: row.batch,
                currentAttendancePercent: row.percent,
                trend: row.trend,
                reasonForAbsence: '',
                academicImpact: '',
                interventionTaken: '',
                studentCommitment: '',
                recoveryPlan: '',
                followUpDate: '',
                escalationStatus: row.warningLevel === 'Critical' ? 'Critical - Recovery Plan Active' : 'Early Warning',
            });
        }
        setPlanStudentId(row.studentId);
    };

    const closePlan = () => { setPlanStudentId(null); setPlanDraft(null); };

    const savePlan = () => {
        if (!planDraft || !planDraft.id || !currentUser) return;
        const now = Date.now();
        const finalPlan: AttendanceActionPlan = {
            id: planDraft.id,
            studentId: planDraft.studentId!,
            batch: planDraft.batch!,
            currentAttendancePercent: planDraft.currentAttendancePercent ?? 0,
            trend: planDraft.trend || 'Insufficient Data',
            reasonForAbsence: planDraft.reasonForAbsence || '',
            academicImpact: planDraft.academicImpact || '',
            interventionTaken: planDraft.interventionTaken || '',
            studentCommitment: planDraft.studentCommitment || '',
            recoveryPlan: planDraft.recoveryPlan || '',
            followUpDate: planDraft.followUpDate || '',
            attendanceAfterIntervention: planDraft.attendanceAfterIntervention,
            escalationStatus: planDraft.escalationStatus || 'Early Warning',
            createdAt: planDraft.createdAt || now,
            createdBy: planDraft.createdBy || currentUser.id,
            updatedAt: now,
        };
        const exists = attendanceActionPlans.some(p => p.id === finalPlan.id);
        if (exists) updateAttendanceActionPlan(finalPlan); else addAttendanceActionPlan(finalPlan);
        closePlan();
    };

    const openInvestigation = (candidate: SystemicDeclineCandidate) => {
        const existing = systemicAttendanceAlerts.find(a => a.moduleCode === candidate.moduleCode && a.status !== 'Resolved');
        setCausesDraft(existing?.possibleCauses || []);
        setNotesDraft(existing?.investigationNotes || '');
        setInvestigatingModuleCode(candidate.moduleCode);
    };

    const toggleCause = (cause: string) => {
        setCausesDraft(prev => prev.includes(cause) ? prev.filter(c => c !== cause) : [...prev, cause]);
    };

    const saveInvestigation = (candidate: SystemicDeclineCandidate) => {
        if (!currentUser) return;
        const existing = systemicAttendanceAlerts.find(a => a.moduleCode === candidate.moduleCode && a.status !== 'Resolved');
        const now = Date.now();
        const alert: SystemicAttendanceAlert = existing ? {
            ...existing,
            recentAveragePercent: candidate.recentAveragePercent,
            priorAveragePercent: candidate.priorAveragePercent,
            declinePoints: candidate.declinePoints,
            possibleCauses: causesDraft,
            investigationNotes: notesDraft,
            status: causesDraft.length > 0 ? 'Investigating' : 'Open',
        } : {
            id: `saa-${candidate.moduleCode}-${now}`,
            moduleCode: candidate.moduleCode,
            batch: candidate.batch,
            recentAveragePercent: candidate.recentAveragePercent,
            priorAveragePercent: candidate.priorAveragePercent,
            declinePoints: candidate.declinePoints,
            possibleCauses: causesDraft,
            investigationNotes: notesDraft,
            status: causesDraft.length > 0 ? 'Investigating' as const : 'Open' as const,
            flaggedAt: now,
            flaggedBy: currentUser.id,
        };
        if (existing) updateSystemicAttendanceAlert(alert); else addSystemicAttendanceAlert(alert);
        setInvestigatingModuleCode(null);
    };

    const resolveInvestigation = (candidate: SystemicDeclineCandidate) => {
        const existing = systemicAttendanceAlerts.find(a => a.moduleCode === candidate.moduleCode && a.status !== 'Resolved');
        if (!existing) return;
        updateSystemicAttendanceAlert({ ...existing, status: 'Resolved', resolvedAt: Date.now() });
    };

    if (!currentUser) return null;

    const activeAlertFor = (moduleCode: string) => systemicAttendanceAlerts.find(a => a.moduleCode === moduleCode && a.status !== 'Resolved');

    return (
        <div className="space-y-4">
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><ShieldAlert size={18} className="text-indigo-600" /> {title}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            ICAT-internal early-warning levels — below {ATTENDANCE_THRESHOLDS.EARLY_WARNING}% is a watchlist Early Warning, below {ATTENDANCE_THRESHOLDS.CRITICAL}% requires a documented recovery plan and is escalated to the Vice Principal. Not university eligibility rules.
                        </p>
                    </div>
                    {isLoading && <Loader2 size={16} className="animate-spin text-gray-400" />}
                </div>
            </div>

            {/* Systemic decline alerts — never framed as student indiscipline */}
            {scopedSystemicCandidates.length > 0 && (
                <div className="bg-white shadow rounded-lg p-6">
                    <h4 className="text-sm font-bold text-gray-900 uppercase mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-orange-500" /> Whole-Batch Declines — Investigate the Module, Not the Students</h4>
                    <div className="space-y-3">
                        {scopedSystemicCandidates.map(candidate => {
                            const module = curriculum.find(m => m.code === candidate.moduleCode);
                            const alert = activeAlertFor(candidate.moduleCode);
                            const isInvestigating = investigatingModuleCode === candidate.moduleCode;
                            return (
                                <div key={candidate.moduleCode} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                                    <div className="flex justify-between items-start flex-wrap gap-2">
                                        <div>
                                            <div className="font-bold text-gray-900">{module?.title || candidate.moduleCode}</div>
                                            <div className="text-xs text-gray-500">{candidate.batch} • {candidate.priorAveragePercent}% → {candidate.recentAveragePercent}% (−{candidate.declinePoints} pts, whole batch)</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {alert && <span className="text-xs font-bold px-2 py-1 rounded-full bg-orange-200 text-orange-800">{alert.status}</span>}
                                            {alert?.status !== 'Resolved' && (
                                                <button onClick={() => alert ? resolveInvestigation(candidate) : null} disabled={!alert} className="text-xs font-bold text-green-700 disabled:opacity-30 disabled:cursor-not-allowed hover:underline">Mark Resolved</button>
                                            )}
                                            <button onClick={() => openInvestigation(candidate)} className="text-xs font-bold text-indigo-600 hover:underline">{alert ? 'Update' : 'Investigate'}</button>
                                        </div>
                                    </div>

                                    {isInvestigating && (
                                        <div className="mt-3 pt-3 border-t border-orange-200 space-y-3">
                                            <div>
                                                <div className="text-xs font-bold text-gray-600 uppercase mb-1">Possible causes (select all that apply)</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {SYSTEMIC_ATTENDANCE_CAUSES.map(cause => (
                                                        <button
                                                            key={cause}
                                                            onClick={() => toggleCause(cause)}
                                                            className={`text-xs font-medium px-2.5 py-1 rounded-full border ${causesDraft.includes(cause) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                                        >
                                                            {cause}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <textarea className="w-full border rounded p-2 text-sm" rows={2} placeholder="Investigation notes..." value={notesDraft} onChange={e => setNotesDraft(e.target.value)} />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setInvestigatingModuleCode(null)} className="text-xs px-3 py-1.5 rounded text-gray-600 hover:bg-gray-100">Cancel</button>
                                                <button onClick={() => saveInvestigation(candidate)} className="text-xs font-bold px-3 py-1.5 rounded bg-indigo-600 text-white flex items-center gap-1"><Save size={12} /> Save</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Watchlist */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-6 border-b">
                    <h4 className="text-sm font-bold text-gray-900 uppercase">Watchlist ({watchlistRows.length})</h4>
                </div>
                {watchlistRows.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">No students below the Early Warning threshold right now.</div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {watchlistRows.map(row => {
                            const plan = getLatestPlan(row.studentId);
                            const hasEffectiveness = plan?.attendanceAfterIntervention !== undefined;
                            return (
                                <li key={row.studentId} className="px-6 py-3 flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${warningBadge(row.warningLevel)}`}>{row.percent}%</span>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 flex items-center gap-1">{row.studentName} <TrendIcon trend={row.trend} /></div>
                                            <div className="text-xs text-gray-500">{row.batch} • {row.warningLevel}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {hasEffectiveness && (
                                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                                {plan!.currentAttendancePercent}% → {plan!.attendanceAfterIntervention}%
                                            </span>
                                        )}
                                        {plan && (
                                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600">{plan.escalationStatus}</span>
                                        )}
                                        <button onClick={() => openPlan(row)} className="text-xs font-bold text-indigo-600 hover:underline">
                                            {plan && plan.escalationStatus !== 'Resolved' ? 'View / Update Plan' : 'Open Action Plan'}
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* Action Plan modal */}
            {planStudentId && planDraft && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closePlan}></div>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                            <div className="bg-white px-6 pt-5 pb-4 border-b flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{users.find(u => u.id === planStudentId)?.name}</h3>
                                    <p className="text-xs text-gray-500">{planDraft.batch} • Currently {planDraft.currentAttendancePercent}% attendance</p>
                                </div>
                                <button onClick={closePlan} className="text-gray-500 hover:text-gray-700"><X size={22} /></button>
                            </div>

                            <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reason for Absence</label>
                                        <textarea className="w-full border rounded p-2 text-sm h-16" value={planDraft.reasonForAbsence || ''} onChange={e => setPlanDraft({ ...planDraft, reasonForAbsence: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Academic Impact</label>
                                        <textarea className="w-full border rounded p-2 text-sm h-16" value={planDraft.academicImpact || ''} onChange={e => setPlanDraft({ ...planDraft, academicImpact: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Intervention Taken</label>
                                        <textarea className="w-full border rounded p-2 text-sm h-16" value={planDraft.interventionTaken || ''} onChange={e => setPlanDraft({ ...planDraft, interventionTaken: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Student Commitment</label>
                                        <textarea className="w-full border rounded p-2 text-sm h-16" value={planDraft.studentCommitment || ''} onChange={e => setPlanDraft({ ...planDraft, studentCommitment: e.target.value })} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Written Recovery Plan</label>
                                    <textarea className="w-full border rounded p-2 text-sm h-20" value={planDraft.recoveryPlan || ''} onChange={e => setPlanDraft({ ...planDraft, recoveryPlan: e.target.value })} />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Follow-up Date</label>
                                        <input type="date" className="w-full border rounded p-2 text-sm" value={planDraft.followUpDate || ''} onChange={e => setPlanDraft({ ...planDraft, followUpDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Attendance After Intervention</label>
                                        <input
                                            type="number" min={0} max={100}
                                            className="w-full border rounded p-2 text-sm"
                                            placeholder="Fill in at follow-up"
                                            value={planDraft.attendanceAfterIntervention ?? ''}
                                            onChange={e => setPlanDraft({ ...planDraft, attendanceAfterIntervention: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Escalation Status</label>
                                        <select
                                            className="w-full border rounded p-2 text-sm"
                                            value={planDraft.escalationStatus || 'Early Warning'}
                                            onChange={e => setPlanDraft({ ...planDraft, escalationStatus: e.target.value as AttendanceEscalationStatus })}
                                        >
                                            {(['Early Warning', 'Critical - Recovery Plan Active', 'Escalated to VP', 'Resolved'] as AttendanceEscalationStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {planDraft.currentAttendancePercent !== undefined && planDraft.attendanceAfterIntervention !== undefined && (
                                    <div className={`rounded-lg p-3 text-sm font-bold flex items-center gap-2 ${planDraft.attendanceAfterIntervention >= planDraft.currentAttendancePercent ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                        {planDraft.attendanceAfterIntervention >= planDraft.currentAttendancePercent ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                                        Effectiveness: {planDraft.currentAttendancePercent}% → {planDraft.attendanceAfterIntervention}% ({planDraft.attendanceAfterIntervention >= planDraft.currentAttendancePercent ? '+' : ''}{planDraft.attendanceAfterIntervention - planDraft.currentAttendancePercent} pts)
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                                <button onClick={closePlan} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm">Close</button>
                                <button onClick={savePlan} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold flex items-center gap-2"><Save size={14} /> Save Plan</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
