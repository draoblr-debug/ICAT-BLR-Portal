import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from './AppContext';
import { Role, User, ActionPoint, FeedbackCycle, KpiResult } from './types';
import { normalizeProgram } from './data';
import { calculateRollingAttendance, calculateFeedbackCompliance, StudentBatchAttendance } from './analyticsService';
import {
    calculateCycleDetailedAnalysis, calculateCycleTrends, calculateActionPointClosureRate, CycleTrendGrouping, CycleTrendSeries,
    calculateIndustryEngagementCoverage, calculatePlacementReadinessRate, calculateAwardPipelineStatus, calculateVicePrincipalKpis
} from './kpiService';
import { KpiGrid } from './KpiGrid';
import {
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    ShieldCheck, Plus, X, Save, TrendingUp, AlertTriangle,
    ClipboardList, Users, BarChart2, Info, Loader2
} from 'lucide-react';

// Deliberate reuse from prior phases rather than re-implementing: campus attendance uses
// Phase 2's calculateRollingAttendance unscoped (no module filter = whole campus), and the
// HOD audit uses Phase 1's calculateFeedbackCompliance filtered down to HOD staff after the
// fact, since it already groups by staffId for any role.

const DEPARTMENT_OPTIONS: { key: string; label: string }[] = [
    { key: 'interior', label: 'Interior Design' },
    { key: 'graphics', label: 'Graphic Design' },
    { key: 'animation', label: 'Animation' },
    { key: 'game', label: 'Game Design' },
    { key: 'ui', label: 'UI/UX' },
    { key: 'photography', label: 'Photography' },
    { key: 'visualeffects', label: 'Visual Effects' },
    { key: 'multimedia', label: 'Multimedia' },
    { key: 'foundation', label: 'Foundation (BVA)' },
];

const RECURRING_PROBLEM_THRESHOLD = 3.5; // out of 5 — flagged for review, not a hard institutional number

const statusColor: Record<ActionPoint['status'], string> = {
    'Open': 'bg-gray-100 text-gray-600',
    'In Progress': 'bg-blue-100 text-blue-700',
    'Verified': 'bg-purple-100 text-purple-700',
    'Closed': 'bg-green-100 text-green-700',
    'Escalated': 'bg-red-100 text-red-700',
};

const kpiStatusColor: Record<KpiResult['status'], string> = {
    'On Track': 'bg-green-100 text-green-700',
    'At Risk': 'bg-yellow-100 text-yellow-700',
    'Off Track': 'bg-red-100 text-red-700',
    'No Data': 'bg-gray-100 text-gray-500',
};

export const VicePrincipalDashboard = () => {
    const appState = useApp();
    const {
        currentUser, curriculum, users, allocations, surveys, attendance, currentSemesterType,
        feedbackCycles, addFeedbackCycle, updateFeedbackCycle,
        actionPoints, addActionPoint, updateActionPoint,
        feedbackSessions, industryEngagements, placementReadiness, finalYearProjects,
    } = appState;

    const [activeTab, setActiveTab] = useState<'overview' | 'cycles' | 'analysis' | 'actions' | 'audit' | 'kpis'>('overview');
    const [vpKpis, setVpKpis] = useState<KpiResult[]>([]);
    const [isLoadingKpis, setIsLoadingKpis] = useState(false);

    useEffect(() => {
        if (activeTab !== 'kpis') return;
        setIsLoadingKpis(true);
        calculateVicePrincipalKpis(appState).then(result => {
            setVpKpis(result);
            setIsLoadingKpis(false);
        });
    }, [activeTab, appState]);

    // Cycles tab
    const [newCycleLabel, setNewCycleLabel] = useState('');
    const [newCycleStart, setNewCycleStart] = useState('');
    const [newCycleEnd, setNewCycleEnd] = useState('');

    // Analysis tab
    const sortedCycles = useMemo(() => [...feedbackCycles].sort((a, b) => b.startDate.localeCompare(a.startDate)), [feedbackCycles]);
    const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
    const [selectedAnalysisModule, setSelectedAnalysisModule] = useState<string>('');
    const [trendGrouping, setTrendGrouping] = useState<CycleTrendGrouping>('module');
    const [categoryAnalysis, setCategoryAnalysis] = useState<any[]>([]);
    const [trendSeries, setTrendSeries] = useState<CycleTrendSeries[]>([]);
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

    useEffect(() => {
        if (!selectedCycleId && sortedCycles.length > 0) setSelectedCycleId(sortedCycles[0].id);
    }, [sortedCycles, selectedCycleId]);

    useEffect(() => {
        setIsLoadingAnalysis(true);
        calculateCycleDetailedAnalysis(selectedCycleId, selectedAnalysisModule || null, surveys).then(r => {
            setCategoryAnalysis(r);
            setIsLoadingAnalysis(false);
        });
    }, [selectedCycleId, selectedAnalysisModule, surveys]);

    useEffect(() => {
        calculateCycleTrends(surveys, feedbackCycles, curriculum, allocations, users, trendGrouping).then(setTrendSeries);
    }, [surveys, feedbackCycles, curriculum, allocations, users, trendGrouping]);

    // Action points
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [editingAction, setEditingAction] = useState<Partial<ActionPoint>>({});
    const [closureKpi, setClosureKpi] = useState<KpiResult | null>(null);

    useEffect(() => { calculateActionPointClosureRate(actionPoints).then(setClosureKpi); }, [actionPoints]);

    // Overview
    const [campusAttendance, setCampusAttendance] = useState<StudentBatchAttendance[]>([]);
    useEffect(() => {
        calculateRollingAttendance(attendance, users, curriculum).then(r => setCampusAttendance(r.byStudentBatch));
    }, [attendance, users, curriculum]);

    // HOD audit
    const [hodAudit, setHodAudit] = useState<Awaited<ReturnType<typeof calculateFeedbackCompliance>>['byTutor']>([]);
    useEffect(() => {
        calculateFeedbackCompliance(feedbackSessions, users, curriculum).then(r => {
            const hodIds = new Set(users.filter(u => u.role === Role.HOD).map(u => u.id));
            setHodAudit(r.byTutor.filter(row => hodIds.has(row.id)));
        });
    }, [feedbackSessions, users, curriculum]);

    // Industry engagement, placement and award pipeline (Phase 4) — campus-wide, unscoped.
    const [industryCoverage, setIndustryCoverage] = useState<Awaited<ReturnType<typeof calculateIndustryEngagementCoverage>> | null>(null);
    useEffect(() => {
        calculateIndustryEngagementCoverage(industryEngagements, curriculum, currentSemesterType).then(setIndustryCoverage);
    }, [industryEngagements, curriculum, currentSemesterType]);

    const [placementKpi, setPlacementKpi] = useState<KpiResult | null>(null);
    useEffect(() => { calculatePlacementReadinessRate(placementReadiness).then(setPlacementKpi); }, [placementReadiness]);

    const [awardStatus, setAwardStatus] = useState<Awaited<ReturnType<typeof calculateAwardPipelineStatus>> | null>(null);
    useEffect(() => { calculateAwardPipelineStatus(finalYearProjects).then(setAwardStatus); }, [finalYearProjects]);

    if (!currentUser) return null;

    const handleCreateCycle = () => {
        if (!newCycleLabel || !newCycleStart || !newCycleEnd) { alert('Fill in a label, start date and end date.'); return; }
        feedbackCycles.filter(c => c.isOpen).forEach(c => updateFeedbackCycle({ ...c, isOpen: false, closedAt: Date.now() }));
        const cycle: FeedbackCycle = {
            id: `cycle-${Date.now()}`,
            label: newCycleLabel,
            startDate: newCycleStart,
            endDate: newCycleEnd,
            isOpen: true,
            createdAt: Date.now(),
            createdBy: currentUser.id,
        };
        addFeedbackCycle(cycle);
        setNewCycleLabel(''); setNewCycleStart(''); setNewCycleEnd('');
        setSelectedCycleId(cycle.id);
    };

    const toggleCycleOpen = (cycle: FeedbackCycle) => {
        if (!cycle.isOpen) {
            feedbackCycles.filter(c => c.isOpen && c.id !== cycle.id).forEach(c => updateFeedbackCycle({ ...c, isOpen: false, closedAt: Date.now() }));
        }
        updateFeedbackCycle({ ...cycle, isOpen: !cycle.isOpen, closedAt: !cycle.isOpen ? undefined : Date.now() });
    };

    const openNewActionPoint = (prefill?: Partial<ActionPoint>) => {
        setEditingAction({
            id: `ap-${Date.now()}`,
            cycleId: selectedCycleId || '',
            issue: '',
            evidenceFromFeedback: '',
            proposedAction: '',
            responsiblePersonId: '',
            departmentId: '',
            deadline: '',
            status: 'Open',
            ...prefill,
        });
        setIsActionModalOpen(true);
    };

    const draftFromRecurringProblem = (category: { subject: string; A: number; responseCount: number }) => {
        const module = curriculum.find(m => m.code === selectedAnalysisModule);
        const cycle = feedbackCycles.find(c => c.id === selectedCycleId);
        const alloc = allocations.find(a => a.moduleCode === selectedAnalysisModule);
        const deptGuess = module ? DEPARTMENT_OPTIONS.find(d => normalizeProgram(module.programTitle).includes(d.key))?.key || '' : '';
        openNewActionPoint({
            issue: `${category.subject} — ${module?.title || selectedAnalysisModule}`,
            evidenceFromFeedback: `Average ${category.A}/5 across ${category.responseCount} responses in ${cycle?.label || 'this cycle'}.`,
            responsiblePersonId: alloc?.tutorId || '',
            departmentId: deptGuess,
        });
    };

    const saveActionPoint = () => {
        if (!editingAction.issue || !editingAction.proposedAction || !editingAction.responsiblePersonId || !editingAction.deadline) {
            alert('Issue, proposed action, responsible person and deadline are required.');
            return;
        }
        const now = Date.now();
        const final: ActionPoint = {
            id: editingAction.id!,
            cycleId: editingAction.cycleId || selectedCycleId || '',
            issue: editingAction.issue,
            evidenceFromFeedback: editingAction.evidenceFromFeedback || '',
            proposedAction: editingAction.proposedAction,
            responsiblePersonId: editingAction.responsiblePersonId,
            departmentId: editingAction.departmentId || '',
            deadline: editingAction.deadline,
            status: editingAction.status || 'Open',
            verificationDate: editingAction.verificationDate,
            outcome: editingAction.outcome,
            createdAt: editingAction.createdAt || now,
            createdBy: editingAction.createdBy || currentUser.id,
            updatedAt: now,
        };
        const exists = actionPoints.some(p => p.id === final.id);
        if (exists) updateActionPoint(final); else addActionPoint(final);
        setIsActionModalOpen(false);
        setEditingAction({});
    };

    const recurringProblems = categoryAnalysis.filter(c => c.A < RECURRING_PROBLEM_THRESHOLD);

    const campusAttendanceSummary = useMemo(() => {
        const tracked = campusAttendance.filter(r => r.totalSessions > 0);
        const onTrack = tracked.filter(r => r.warningLevel === 'On Track').length;
        const earlyWarning = tracked.filter(r => r.warningLevel === 'Early Warning').length;
        const critical = tracked.filter(r => r.warningLevel === 'Critical').length;
        const avg = tracked.length > 0 ? Math.round(tracked.reduce((s, r) => s + r.percent, 0) / tracked.length) : 0;
        return { tracked: tracked.length, avg, onTrack, earlyWarning, critical };
    }, [campusAttendance]);

    return (
        <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6 flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><ShieldCheck className="text-indigo-600" size={22} /> Vice Principal — Institutional Oversight</h2>
                    <p className="text-sm text-gray-500 mt-1">Bi-monthly feedback cycles, the action-point closure loop, campus attendance and HOD accountability.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg flex-wrap gap-1">
                    {['overview', 'cycles', 'analysis', 'actions', 'audit', 'kpis'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-3 py-2 text-sm font-medium rounded-md capitalize ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{tab}</button>
                    ))}
                </div>
            </div>

            {activeTab === 'kpis' && (
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Vice Principal KRA/KPI Scorecard</h3>
                    <p className="text-sm text-gray-500 mb-4">
                        19 KPIs across attendance oversight, bi-monthly cycle completion, action-point closure, satisfaction improvement, quality audits, HOD accountability and placement oversight.
                        The task specified these as category totals rather than 19 named items — see KPI_IMPLEMENTATION.md for the full breakdown.
                    </p>
                    <KpiGrid kpis={vpKpis} isLoading={isLoadingKpis} />
                </div>
            )}

            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white shadow rounded-lg p-6">
                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">{closureKpi?.label || 'Action Point Closure'}</div>
                            {closureKpi ? (
                                <>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-bold text-gray-900">{closureKpi.actual}%</span>
                                        <span className="text-xs text-gray-400 mb-1">target {closureKpi.target}%</span>
                                    </div>
                                    <span className={`inline-block mt-2 text-xs font-bold px-2 py-1 rounded-full ${kpiStatusColor[closureKpi.status]}`}>{closureKpi.status}</span>
                                </>
                            ) : <Loader2 className="animate-spin text-gray-400" size={18} />}
                        </div>

                        <div className="bg-white shadow rounded-lg p-6">
                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Campus-Wide Attendance</div>
                            <div className="text-3xl font-bold text-gray-900">{campusAttendanceSummary.avg}%</div>
                            <div className="text-xs text-gray-500 mt-2 flex gap-3">
                                <span className="text-green-600">{campusAttendanceSummary.onTrack} On Track</span>
                                <span className="text-yellow-600">{campusAttendanceSummary.earlyWarning} Early Warning</span>
                                <span className="text-red-600">{campusAttendanceSummary.critical} Critical</span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">{campusAttendanceSummary.tracked} students tracked, ICAT-internal early-warning levels</div>
                        </div>

                        <div className="bg-white shadow rounded-lg p-6">
                            <div className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Info size={12} /> Weak Industry Engagement</div>
                            {industryCoverage ? (
                                industryCoverage.byModule.length === 0 ? (
                                    <div className="text-sm text-gray-400 italic mt-2">No active modules this semester.</div>
                                ) : (
                                    <>
                                        <div className="text-3xl font-bold text-gray-900">{industryCoverage.overall.actual}%</div>
                                        <div className="text-[10px] text-gray-400 mt-1">of active modules meeting the ≥2/semester target</div>
                                        {industryCoverage.byModule.filter(m => !m.metTarget).length > 0 && (
                                            <div className="mt-2 text-xs text-gray-600">
                                                {industryCoverage.byModule.filter(m => !m.metTarget).length} module{industryCoverage.byModule.filter(m => !m.metTarget).length === 1 ? '' : 's'} below target
                                            </div>
                                        )}
                                    </>
                                )
                            ) : <Loader2 className="animate-spin text-gray-400" size={16} />}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white shadow rounded-lg p-6">
                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">{placementKpi?.label || 'Placement Readiness'}</div>
                            {placementKpi ? (
                                placementKpi.status === 'No Data' ? (
                                    <div className="text-sm text-gray-400 italic">No students tracked yet — see the HOD's Final-Year tab.</div>
                                ) : (
                                    <>
                                        <div className="flex items-end gap-2">
                                            <span className="text-3xl font-bold text-gray-900">{placementKpi.actual}%</span>
                                            <span className="text-xs text-gray-400 mb-1">target {placementKpi.target}%</span>
                                        </div>
                                        <span className={`inline-block mt-2 text-xs font-bold px-2 py-1 rounded-full ${kpiStatusColor[placementKpi.status]}`}>{placementKpi.status}</span>
                                    </>
                                )
                            ) : <Loader2 className="animate-spin text-gray-400" size={16} />}
                        </div>

                        <div className="bg-white shadow rounded-lg p-6">
                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">{awardStatus?.mentoringKpi.label || 'Award Pipeline'}</div>
                            {awardStatus ? (
                                awardStatus.mentoringKpi.status === 'No Data' ? (
                                    <div className="text-sm text-gray-400 italic">No final-year projects logged yet.</div>
                                ) : (
                                    <>
                                        <div className="flex items-end gap-2">
                                            <span className="text-3xl font-bold text-gray-900">{awardStatus.mentoringKpi.actual}</span>
                                            <span className="text-xs text-gray-400 mb-1">target {awardStatus.mentoringKpi.target}</span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-1">{awardStatus.byDepartment.filter(d => d.metTarget).length}/{awardStatus.byDepartment.length} departments with ≥1 external submission this year</div>
                                    </>
                                )
                            ) : <Loader2 className="animate-spin text-gray-400" size={16} />}
                        </div>
                    </div>

                    <div className="bg-white shadow rounded-lg p-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-3">Open Action Points Needing Attention</h3>
                        {actionPoints.filter(p => p.status !== 'Closed').length === 0 ? (
                            <div className="text-sm text-gray-400 italic">No open action points.</div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {actionPoints.filter(p => p.status !== 'Closed').sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 6).map(p => (
                                    <li key={p.id} className="py-2 flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{p.issue}</div>
                                            <div className="text-xs text-gray-500">Due {p.deadline || 'unset'} • {users.find(u => u.id === p.responsiblePersonId)?.name || p.responsiblePersonId}</div>
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColor[p.status]}`}>{p.status}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'cycles' && (
                <div className="space-y-6">
                    <div className="bg-white shadow rounded-lg p-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-3">New Feedback Cycle</h3>
                        <p className="text-xs text-gray-500 mb-3">Opening a cycle opens module/elective feedback campus-wide — every active module, every department, every batch — and closes any other currently open cycle.</p>
                        <div className="flex flex-wrap gap-3 items-end">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Label</label>
                                <input className="border rounded p-2 text-sm" placeholder="e.g. Nov–Dec 2026" value={newCycleLabel} onChange={e => setNewCycleLabel(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label>
                                <input type="date" className="border rounded p-2 text-sm" value={newCycleStart} onChange={e => setNewCycleStart(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">End Date</label>
                                <input type="date" className="border rounded p-2 text-sm" value={newCycleEnd} onChange={e => setNewCycleEnd(e.target.value)} />
                            </div>
                            <button onClick={handleCreateCycle} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2"><Plus size={14} /> Create & Open</button>
                        </div>
                    </div>

                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="p-6 border-b"><h3 className="text-sm font-bold text-gray-900 uppercase">All Cycles ({sortedCycles.length})</h3></div>
                        {sortedCycles.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">No cycles created yet.</div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {sortedCycles.map(cycle => {
                                    const responseCount = surveys.filter(s => s.cycleId === cycle.id).length;
                                    return (
                                        <li key={cycle.id} className="px-6 py-3 flex items-center justify-between flex-wrap gap-2">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{cycle.label}</div>
                                                <div className="text-xs text-gray-500">{cycle.startDate} → {cycle.endDate} • {responseCount} response{responseCount === 1 ? '' : 's'}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${cycle.isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{cycle.isOpen ? 'Open' : 'Closed'}</span>
                                                <button onClick={() => toggleCycleOpen(cycle)} className="text-xs font-bold text-indigo-600 hover:underline">{cycle.isOpen ? 'Close' : 'Reopen'}</button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'analysis' && (
                <div className="space-y-6">
                    <div className="bg-white shadow rounded-lg p-6 flex flex-wrap gap-4 items-end">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Cycle</label>
                            <select className="border rounded p-2 text-sm min-w-[180px]" value={selectedCycleId || ''} onChange={e => setSelectedCycleId(e.target.value || null)}>
                                <option value="">Select cycle...</option>
                                {sortedCycles.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Module (for category breakdown)</label>
                            <select className="border rounded p-2 text-sm min-w-[220px]" value={selectedAnalysisModule} onChange={e => setSelectedAnalysisModule(e.target.value)}>
                                <option value="">Select module...</option>
                                {curriculum.map(m => <option key={m.code} value={m.code}>{m.title} ({m.code})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Trend Grouping</label>
                            <select className="border rounded p-2 text-sm" value={trendGrouping} onChange={e => setTrendGrouping(e.target.value as CycleTrendGrouping)}>
                                {(['module', 'tutor', 'department', 'batch', 'category'] as CycleTrendGrouping[]).map(g => <option key={g} value={g} className="capitalize">{g}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white shadow rounded-lg p-6">
                            <h3 className="text-sm font-bold text-gray-900 uppercase mb-1 flex items-center gap-1"><BarChart2 size={14} /> Category Breakdown</h3>
                            <p className="text-xs text-gray-500 mb-3">1-5 scale across the 13 feedback categories for the selected cycle + module.</p>
                            {isLoadingAnalysis ? (
                                <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
                            ) : categoryAnalysis.length > 0 ? (
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={categoryAnalysis}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 5]} />
                                            <Radar name="Cycle Score" dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.5} />
                                            <Tooltip />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Select a cycle and module with responses.</div>
                            )}
                        </div>

                        <div className="bg-white shadow rounded-lg p-6">
                            <h3 className="text-sm font-bold text-gray-900 uppercase mb-1 flex items-center gap-1"><AlertTriangle size={14} className="text-orange-500" /> Recurring Problems (avg &lt; {RECURRING_PROBLEM_THRESHOLD})</h3>
                            <p className="text-xs text-gray-500 mb-3">Draft an action point directly from a low-scoring category.</p>
                            {recurringProblems.length === 0 ? (
                                <div className="text-sm text-gray-400 italic">No categories below {RECURRING_PROBLEM_THRESHOLD}/5 for this selection.</div>
                            ) : (
                                <ul className="space-y-2">
                                    {recurringProblems.map(cat => (
                                        <li key={cat.key} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded p-2.5">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{cat.subject}</div>
                                                <div className="text-xs text-gray-500">{cat.A}/5 • {cat.responseCount} responses</div>
                                            </div>
                                            <button onClick={() => draftFromRecurringProblem(cat)} className="text-xs font-bold text-indigo-600 hover:underline">Draft Action Point</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="bg-white shadow rounded-lg p-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-1 flex items-center gap-1"><TrendingUp size={14} /> Cycle-on-Cycle Trend — by {trendGrouping}</h3>
                        <p className="text-xs text-gray-500 mb-3">Improvement, not just satisfaction level (e.g. 3.1/5 → action → 3.8/5).</p>
                        {trendSeries.length === 0 ? (
                            <div className="text-sm text-gray-400 italic py-6 text-center">No cycle-tagged responses yet for this grouping.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs font-bold text-gray-500 uppercase border-b">
                                            <th className="py-2 pr-4">{trendGrouping}</th>
                                            {sortedCycles.slice().reverse().map(c => <th key={c.id} className="py-2 px-3 text-center">{c.label}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {trendSeries.map(series => (
                                            <tr key={series.key}>
                                                <td className="py-2 pr-4 font-medium text-gray-800">{series.label}</td>
                                                {sortedCycles.slice().reverse().map(c => {
                                                    const point = series.points.find(p => p.cycleId === c.id);
                                                    return <td key={c.id} className="py-2 px-3 text-center text-gray-600">{point ? `${point.averageRating}` : '—'}</td>;
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'actions' && (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="p-6 border-b flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 uppercase">Action Points ({actionPoints.length})</h3>
                            <p className="text-xs text-gray-500 mt-1">Feedback → Analysis → Recurring Problem → Action Point → Owner → Deadline → Implement → Verify → Close.</p>
                        </div>
                        <button onClick={() => openNewActionPoint()} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2"><Plus size={14} /> New Action Point</button>
                    </div>
                    {actionPoints.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">No action points yet.</div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {actionPoints.slice().sort((a, b) => b.updatedAt - a.updatedAt).map(p => (
                                <li key={p.id} className="px-6 py-3 flex items-center justify-between flex-wrap gap-2 hover:bg-gray-50">
                                    <div className="flex-1 min-w-[240px]">
                                        <div className="text-sm font-medium text-gray-900">{p.issue}</div>
                                        <div className="text-xs text-gray-500">{users.find(u => u.id === p.responsiblePersonId)?.name || p.responsiblePersonId} • Due {p.deadline || 'unset'} • {DEPARTMENT_OPTIONS.find(d => d.key === p.departmentId)?.label || p.departmentId}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColor[p.status]}`}>{p.status}</span>
                                        <button onClick={() => { setEditingAction(p); setIsActionModalOpen(true); }} className="text-xs font-bold text-indigo-600 hover:underline">Edit</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {activeTab === 'audit' && (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="p-6 border-b">
                        <h3 className="text-sm font-bold text-gray-900 uppercase flex items-center gap-1"><Users size={14} /> HOD-Taught Module Feedback Audit</h3>
                        <p className="text-xs text-gray-500 mt-1">HODs are held to the same weekly-feedback standard as Module Tutors for modules they personally teach — no exemption.</p>
                    </div>
                    {hodAudit.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">No HOD-taught modules with scheduled sessions yet.</div>
                    ) : (
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr className="text-left text-xs font-bold text-gray-500 uppercase">
                                    <th className="px-6 py-3">HOD</th>
                                    <th className="px-6 py-3 text-center">Sessions Conducted</th>
                                    <th className="px-6 py-3 text-center">Documented</th>
                                    <th className="px-6 py-3 text-center">Emailed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {hodAudit.map(row => (
                                    <tr key={row.id}>
                                        <td className="px-6 py-3 font-medium text-gray-900">{row.label}</td>
                                        <td className="px-6 py-3 text-center">{row.conductedPercent}% ({row.sessionsConducted}/{row.totalSessions})</td>
                                        <td className="px-6 py-3 text-center">{row.documentedPercent}%</td>
                                        <td className="px-6 py-3 text-center">{row.emailedPercent}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Action Point modal */}
            {isActionModalOpen && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsActionModalOpen(false)}></div>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                            <div className="bg-white px-6 pt-5 pb-4 border-b flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><ClipboardList size={18} /> {editingAction.createdAt ? 'Edit Action Point' : 'New Action Point'}</h3>
                                <button onClick={() => setIsActionModalOpen(false)} className="text-gray-500 hover:text-gray-700"><X size={22} /></button>
                            </div>
                            <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Issue</label>
                                    <input className="w-full border rounded p-2 text-sm" value={editingAction.issue || ''} onChange={e => setEditingAction({ ...editingAction, issue: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Evidence from Feedback</label>
                                    <textarea className="w-full border rounded p-2 text-sm h-16" value={editingAction.evidenceFromFeedback || ''} onChange={e => setEditingAction({ ...editingAction, evidenceFromFeedback: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Proposed Action</label>
                                    <textarea className="w-full border rounded p-2 text-sm h-16" value={editingAction.proposedAction || ''} onChange={e => setEditingAction({ ...editingAction, proposedAction: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Responsible Person</label>
                                        <select className="w-full border rounded p-2 text-sm" value={editingAction.responsiblePersonId || ''} onChange={e => setEditingAction({ ...editingAction, responsiblePersonId: e.target.value })}>
                                            <option value="">Select...</option>
                                            {users.filter(u => u.role === Role.Tutor || u.role === Role.HOD || u.role === Role.EducationManager).map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Department</label>
                                        <select className="w-full border rounded p-2 text-sm" value={editingAction.departmentId || ''} onChange={e => setEditingAction({ ...editingAction, departmentId: e.target.value })}>
                                            <option value="">Select...</option>
                                            {DEPARTMENT_OPTIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deadline</label>
                                        <input type="date" className="w-full border rounded p-2 text-sm" value={editingAction.deadline || ''} onChange={e => setEditingAction({ ...editingAction, deadline: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                                        <select className="w-full border rounded p-2 text-sm" value={editingAction.status || 'Open'} onChange={e => setEditingAction({ ...editingAction, status: e.target.value as ActionPoint['status'] })}>
                                            {(['Open', 'In Progress', 'Verified', 'Closed', 'Escalated'] as ActionPoint['status'][]).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {(editingAction.status === 'Verified' || editingAction.status === 'Closed' || editingAction.status === 'Escalated') && (
                                    <div className="grid grid-cols-2 gap-4 bg-gray-50 border rounded p-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Verification Date</label>
                                            <input type="date" className="w-full border rounded p-2 text-sm" value={editingAction.verificationDate || ''} onChange={e => setEditingAction({ ...editingAction, verificationDate: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Outcome</label>
                                            <input className="w-full border rounded p-2 text-sm" value={editingAction.outcome || ''} onChange={e => setEditingAction({ ...editingAction, outcome: e.target.value })} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                                <button onClick={() => setIsActionModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm">Close</button>
                                <button onClick={saveActionPoint} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold flex items-center gap-2"><Save size={14} /> Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
