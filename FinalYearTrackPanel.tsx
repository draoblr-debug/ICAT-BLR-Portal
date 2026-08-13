import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from './AppContext';
import { Role, User, PortfolioReview, PlacementReadinessStatus, FinalYearProject } from './types';
import {
    PORTFOLIO_REVIEW_DIMENSIONS, RUBRIC_GRADE_LEVELS, PLACEMENT_STATUS_OPTIONS,
    ENTREPRENEURIAL_POTENTIAL_OPTIONS, AWARD_READINESS_OPTIONS
} from './data';
import { calculatePlacementReadinessRate, calculateAwardPipelineStatus, DepartmentAwardSubmission } from './kpiService';
import { KpiResult } from './types';
import {
    GraduationCap, Plus, X, Save, Star, Award, Briefcase, Loader2
} from 'lucide-react';

interface FinalYearTrackPanelProps {
    students: User[];
    title?: string;
}

const kpiStatusColor: Record<KpiResult['status'], string> = {
    'On Track': 'bg-green-100 text-green-700',
    'At Risk': 'bg-yellow-100 text-yellow-700',
    'Off Track': 'bg-red-100 text-red-700',
    'No Data': 'bg-gray-100 text-gray-500',
};

const emptyReviewDimensions = () => PORTFOLIO_REVIEW_DIMENSIONS.reduce((acc, d) => ({ ...acc, [d.key]: '' }), {} as PortfolioReview['dimensions']);

const studentBatch = (student: User) => `${student.programId} • Year ${student.year ?? '?'}`;

export const FinalYearTrackPanel: React.FC<FinalYearTrackPanelProps> = ({ students, title = 'Final-Year Track' }) => {
    const {
        currentUser, users,
        portfolioReviews, addPortfolioReview, updatePortfolioReview,
        placementReadiness, savePlacementReadiness,
        finalYearProjects, addFinalYearProject, updateFinalYearProject,
    } = useApp();

    const [activeTab, setActiveTab] = useState<'portfolio' | 'placement' | 'projects'>('portfolio');
    const studentIds = useMemo(() => new Set(students.map(s => s.id)), [students]);
    const studentName = (id: string) => users.find(u => u.id === id)?.name || id;

    // Portfolio Reviews
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewDraft, setReviewDraft] = useState<Partial<PortfolioReview>>({});
    const scopedReviews = portfolioReviews.filter(r => studentIds.has(r.studentId)).sort((a, b) => b.reviewDate.localeCompare(a.reviewDate));

    const openNewReview = () => {
        setReviewDraft({
            id: `pr-${Date.now()}`,
            studentId: students[0]?.id || '',
            reviewerType: 'Faculty',
            reviewerId: currentUser?.id,
            reviewDate: new Date().toISOString().split('T')[0],
            dimensions: emptyReviewDimensions(),
            areasForImprovement: '',
        });
        setIsReviewModalOpen(true);
    };

    const saveReview = () => {
        if (!currentUser || !reviewDraft.studentId) { alert('Select a student.'); return; }
        const final: PortfolioReview = {
            id: reviewDraft.id!,
            studentId: reviewDraft.studentId,
            reviewerType: reviewDraft.reviewerType || 'Faculty',
            reviewerId: reviewDraft.reviewerType === 'Faculty' ? (reviewDraft.reviewerId || currentUser.id) : undefined,
            reviewerName: reviewDraft.reviewerType === 'Industry Expert' ? (reviewDraft.reviewerName || '') : undefined,
            reviewDate: reviewDraft.reviewDate || new Date().toISOString().split('T')[0],
            dimensions: reviewDraft.dimensions || emptyReviewDimensions(),
            areasForImprovement: reviewDraft.areasForImprovement || '',
            createdAt: reviewDraft.createdAt || Date.now(),
            createdBy: reviewDraft.createdBy || currentUser.id,
        };
        const exists = portfolioReviews.some(r => r.id === final.id);
        if (exists) updatePortfolioReview(final); else addPortfolioReview(final);
        setIsReviewModalOpen(false);
    };

    // Placement Readiness
    const [isPlacementModalOpen, setIsPlacementModalOpen] = useState(false);
    const [placementDraft, setPlacementDraft] = useState<Partial<PlacementReadinessStatus>>({});
    const scopedPlacement = placementReadiness.filter(p => studentIds.has(p.studentId));
    const [placementKpi, setPlacementKpi] = useState<KpiResult | null>(null);

    useEffect(() => { calculatePlacementReadinessRate(scopedPlacement).then(setPlacementKpi); }, [placementReadiness, studentIds]);

    const openPlacement = (student: User) => {
        const existing = placementReadiness.find(p => p.studentId === student.id);
        setPlacementDraft(existing || {
            id: student.id,
            studentId: student.id,
            portfolioReady: false,
            resumeReady: false,
            skillsAssessment: '',
            communicationReadiness: '',
            interviewReadiness: '',
            applicationsSubmitted: 0,
            interviewsAttended: 0,
            offersReceived: 0,
            placementStatus: 'Not Started',
            documentedTrack: '',
        });
        setIsPlacementModalOpen(true);
    };

    const savePlacement = () => {
        if (!currentUser || !placementDraft.studentId) return;
        if (placementDraft.placementStatus !== 'Placed' && !(placementDraft.documentedTrack || '').trim()) {
            if (!confirm('No documented track and not yet Placed — this student will count against the placement KPI. Save anyway?')) return;
        }
        const final: PlacementReadinessStatus = {
            id: placementDraft.id!,
            studentId: placementDraft.studentId,
            portfolioReady: !!placementDraft.portfolioReady,
            resumeReady: !!placementDraft.resumeReady,
            skillsAssessment: placementDraft.skillsAssessment || '',
            communicationReadiness: placementDraft.communicationReadiness || '',
            interviewReadiness: placementDraft.interviewReadiness || '',
            applicationsSubmitted: placementDraft.applicationsSubmitted || 0,
            interviewsAttended: placementDraft.interviewsAttended || 0,
            offersReceived: placementDraft.offersReceived || 0,
            placementStatus: placementDraft.placementStatus || 'Not Started',
            documentedTrack: placementDraft.documentedTrack || '',
            lastUpdated: Date.now(),
            updatedBy: currentUser.id,
        };
        savePlacementReadiness(final);
        setIsPlacementModalOpen(false);
    };

    // Final-Year Projects
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [projectDraft, setProjectDraft] = useState<Partial<FinalYearProject>>({});
    const scopedProjects = finalYearProjects.filter(p => studentIds.has(p.studentId));
    const [awardStatus, setAwardStatus] = useState<{ byDepartment: DepartmentAwardSubmission[]; mentoringKpi: KpiResult } | null>(null);

    useEffect(() => { calculateAwardPipelineStatus(scopedProjects).then(setAwardStatus); }, [finalYearProjects, studentIds]);

    const openNewProject = () => {
        const first = students[0];
        setProjectDraft({
            id: `fyp-${Date.now()}`,
            studentId: first?.id || '',
            batch: first ? studentBatch(first) : '',
            title: '',
            crossDepartmentCollaboration: false,
            entrepreneurialPotential: 'None',
            awardReadiness: 'Not Assessed',
            submittedExternally: false,
            identifiedForExtraMentoring: false,
        });
        setIsProjectModalOpen(true);
    };

    const saveProject = () => {
        if (!projectDraft.studentId || !projectDraft.title) { alert('Student and title are required.'); return; }
        const now = Date.now();
        const final: FinalYearProject = {
            id: projectDraft.id!,
            studentId: projectDraft.studentId,
            batch: projectDraft.batch || '',
            title: projectDraft.title,
            moduleCode: projectDraft.moduleCode,
            sdgLinkage: projectDraft.sdgLinkage,
            crossDepartmentCollaboration: !!projectDraft.crossDepartmentCollaboration,
            collaboratingDepartments: projectDraft.collaboratingDepartments,
            entrepreneurialPotential: projectDraft.entrepreneurialPotential || 'None',
            awardReadiness: projectDraft.awardReadiness || 'Not Assessed',
            submittedExternally: !!projectDraft.submittedExternally,
            externalAwardName: projectDraft.externalAwardName,
            identifiedForExtraMentoring: !!projectDraft.identifiedForExtraMentoring,
            mentoringNotes: projectDraft.mentoringNotes,
            createdAt: projectDraft.createdAt || now,
            updatedAt: now,
        };
        const exists = finalYearProjects.some(p => p.id === final.id);
        if (exists) updateFinalYearProject(final); else addFinalYearProject(final);
        setIsProjectModalOpen(false);
    };

    if (!currentUser) return null;

    return (
        <div className="space-y-4">
            <div className="bg-white shadow rounded-lg p-6 flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><GraduationCap size={18} className="text-indigo-600" /> {title}</h3>
                    <p className="text-sm text-gray-500 mt-1">Portfolio reviews, placement readiness and final-year project attributes.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
                    <button onClick={() => setActiveTab('portfolio')} className={`px-3 py-1.5 text-sm font-medium rounded-md ${activeTab === 'portfolio' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Portfolio</button>
                    <button onClick={() => setActiveTab('placement')} className={`px-3 py-1.5 text-sm font-medium rounded-md ${activeTab === 'placement' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Placement</button>
                    <button onClick={() => setActiveTab('projects')} className={`px-3 py-1.5 text-sm font-medium rounded-md ${activeTab === 'projects' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Projects</button>
                </div>
            </div>

            {activeTab === 'portfolio' && (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="p-6 border-b flex justify-between items-center">
                        <h4 className="text-sm font-bold text-gray-900 uppercase">Portfolio Reviews ({scopedReviews.length})</h4>
                        <button onClick={openNewReview} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2"><Plus size={14} /> New Review</button>
                    </div>
                    {scopedReviews.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">No portfolio reviews yet.</div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {scopedReviews.map(r => (
                                <li key={r.id} className="px-6 py-3 flex items-center justify-between flex-wrap gap-2 hover:bg-gray-50">
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">{studentName(r.studentId)}</div>
                                        <div className="text-xs text-gray-500">{r.reviewDate} • {r.reviewerType === 'Faculty' ? studentName(r.reviewerId || '') : r.reviewerName}</div>
                                    </div>
                                    <button onClick={() => { setReviewDraft(r); setIsReviewModalOpen(true); }} className="text-xs font-bold text-indigo-600 hover:underline">View / Edit</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {activeTab === 'placement' && (
                <div className="space-y-4">
                    <div className="bg-white shadow rounded-lg p-6 flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <div className="text-xs font-bold text-gray-500 uppercase">{placementKpi?.label || 'Placement Readiness'}</div>
                            {placementKpi ? (
                                <div className="flex items-end gap-2 mt-1">
                                    <span className="text-2xl font-bold text-gray-900">{placementKpi.actual}%</span>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${kpiStatusColor[placementKpi.status]}`}>{placementKpi.status}</span>
                                </div>
                            ) : <Loader2 className="animate-spin text-gray-400" size={16} />}
                        </div>
                    </div>
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="p-6 border-b"><h4 className="text-sm font-bold text-gray-900 uppercase">Students ({students.length})</h4></div>
                        {students.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">No students in scope.</div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {students.map(s => {
                                    const record = placementReadiness.find(p => p.studentId === s.id);
                                    return (
                                        <li key={s.id} className="px-6 py-3 flex items-center justify-between flex-wrap gap-2 hover:bg-gray-50">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 flex items-center gap-1"><Briefcase size={12} className="text-gray-400" /> {s.name}</div>
                                                {record && <div className="text-xs text-gray-500">{record.applicationsSubmitted} applications • {record.interviewsAttended} interviews • {record.offersReceived} offers</div>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${record ? (record.placementStatus === 'Placed' || record.documentedTrack ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700') : 'bg-gray-100 text-gray-500'}`}>{record?.placementStatus || 'Not Tracked'}</span>
                                                <button onClick={() => openPlacement(s)} className="text-xs font-bold text-indigo-600 hover:underline">{record ? 'Update' : 'Track'}</button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'projects' && (
                <div className="space-y-4">
                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Award size={12} /> Award Pipeline</h4>
                            {awardStatus ? (
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${kpiStatusColor[awardStatus.mentoringKpi.status]}`}>
                                    {awardStatus.mentoringKpi.actual}/{awardStatus.mentoringKpi.target} identified for extra mentoring ({awardStatus.mentoringKpi.status})
                                </span>
                            ) : <Loader2 className="animate-spin text-gray-400" size={16} />}
                        </div>
                        {awardStatus && awardStatus.byDepartment.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {awardStatus.byDepartment.map(d => (
                                    <div key={d.department} className={`flex items-center justify-between px-3 py-2 rounded border text-sm ${d.metTarget ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                        <span className="text-gray-800">{d.department}</span>
                                        <span className={`font-bold ${d.metTarget ? 'text-green-700' : 'text-gray-500'}`}>{d.submittedCount} submitted</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h4 className="text-sm font-bold text-gray-900 uppercase">Projects ({scopedProjects.length})</h4>
                            <button onClick={openNewProject} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2"><Plus size={14} /> New Project</button>
                        </div>
                        {scopedProjects.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">No final-year projects logged yet.</div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {scopedProjects.map(p => (
                                    <li key={p.id} className="px-6 py-3 flex items-center justify-between flex-wrap gap-2 hover:bg-gray-50">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 flex items-center gap-1">{p.title} {p.identifiedForExtraMentoring && <Star size={12} className="text-yellow-500" title="Identified for extra mentoring" />}</div>
                                            <div className="text-xs text-gray-500">{studentName(p.studentId)} • {p.batch}{p.sdgLinkage ? ` • ${p.sdgLinkage}` : ''}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {p.submittedExternally && <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">Submitted</span>}
                                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600">{p.awardReadiness}</span>
                                            <button onClick={() => { setProjectDraft(p); setIsProjectModalOpen(true); }} className="text-xs font-bold text-indigo-600 hover:underline">Edit</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {/* Portfolio Review modal */}
            {isReviewModalOpen && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsReviewModalOpen(false)}></div>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                            <div className="bg-white px-6 pt-5 pb-4 border-b flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-900">Portfolio Review</h3>
                                <button onClick={() => setIsReviewModalOpen(false)} className="text-gray-500 hover:text-gray-700"><X size={22} /></button>
                            </div>
                            <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Student</label>
                                        <select className="w-full border rounded p-2 text-sm" value={reviewDraft.studentId || ''} onChange={e => setReviewDraft({ ...reviewDraft, studentId: e.target.value })}>
                                            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Review Date</label>
                                        <input type="date" className="w-full border rounded p-2 text-sm" value={reviewDraft.reviewDate || ''} onChange={e => setReviewDraft({ ...reviewDraft, reviewDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reviewer Type</label>
                                        <select className="w-full border rounded p-2 text-sm" value={reviewDraft.reviewerType || 'Faculty'} onChange={e => setReviewDraft({ ...reviewDraft, reviewerType: e.target.value as any })}>
                                            <option value="Faculty">Faculty</option>
                                            <option value="Industry Expert">Industry Expert</option>
                                        </select>
                                    </div>
                                    {reviewDraft.reviewerType === 'Industry Expert' ? (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reviewer Name / Org</label>
                                            <input className="w-full border rounded p-2 text-sm" value={reviewDraft.reviewerName || ''} onChange={e => setReviewDraft({ ...reviewDraft, reviewerName: e.target.value })} />
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reviewer</label>
                                            <select className="w-full border rounded p-2 text-sm" value={reviewDraft.reviewerId || ''} onChange={e => setReviewDraft({ ...reviewDraft, reviewerId: e.target.value })}>
                                                {users.filter(u => u.role === Role.Tutor || u.role === Role.HOD).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Dimensions</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {PORTFOLIO_REVIEW_DIMENSIONS.map(dim => (
                                            <div key={dim.key} className="flex items-center justify-between gap-2 border rounded p-2">
                                                <span className="text-sm text-gray-800">{dim.label}</span>
                                                <select
                                                    className="border rounded p-1.5 text-xs"
                                                    value={(reviewDraft.dimensions as any)?.[dim.key] || ''}
                                                    onChange={e => setReviewDraft({ ...reviewDraft, dimensions: { ...(reviewDraft.dimensions as any), [dim.key]: e.target.value } })}
                                                >
                                                    <option value="">Grade...</option>
                                                    {RUBRIC_GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Areas for Improvement</label>
                                    <textarea className="w-full border rounded p-2 text-sm h-20" value={reviewDraft.areasForImprovement || ''} onChange={e => setReviewDraft({ ...reviewDraft, areasForImprovement: e.target.value })} />
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                                <button onClick={() => setIsReviewModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm">Close</button>
                                <button onClick={saveReview} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold flex items-center gap-2"><Save size={14} /> Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Placement modal */}
            {isPlacementModalOpen && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsPlacementModalOpen(false)}></div>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full">
                            <div className="bg-white px-6 pt-5 pb-4 border-b flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-900">{studentName(placementDraft.studentId || '')} — Placement Readiness</h3>
                                <button onClick={() => setIsPlacementModalOpen(false)} className="text-gray-500 hover:text-gray-700"><X size={22} /></button>
                            </div>
                            <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!placementDraft.portfolioReady} onChange={e => setPlacementDraft({ ...placementDraft, portfolioReady: e.target.checked })} className="rounded text-indigo-600" /> Portfolio ready</label>
                                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!placementDraft.resumeReady} onChange={e => setPlacementDraft({ ...placementDraft, resumeReady: e.target.checked })} className="rounded text-indigo-600" /> Resume ready</label>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {([
                                        ['skillsAssessment', 'Skills'],
                                        ['communicationReadiness', 'Communication'],
                                        ['interviewReadiness', 'Interview Readiness'],
                                    ] as [keyof PlacementReadinessStatus, string][]).map(([key, label]) => (
                                        <div key={key}>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
                                            <select className="w-full border rounded p-2 text-sm" value={(placementDraft as any)[key] || ''} onChange={e => setPlacementDraft({ ...placementDraft, [key]: e.target.value })}>
                                                <option value="">Grade...</option>
                                                {RUBRIC_GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Applications</label>
                                        <input type="number" min={0} className="w-full border rounded p-2 text-sm" value={placementDraft.applicationsSubmitted ?? 0} onChange={e => setPlacementDraft({ ...placementDraft, applicationsSubmitted: parseInt(e.target.value) || 0 })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Interviews</label>
                                        <input type="number" min={0} className="w-full border rounded p-2 text-sm" value={placementDraft.interviewsAttended ?? 0} onChange={e => setPlacementDraft({ ...placementDraft, interviewsAttended: parseInt(e.target.value) || 0 })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Offers</label>
                                        <input type="number" min={0} className="w-full border rounded p-2 text-sm" value={placementDraft.offersReceived ?? 0} onChange={e => setPlacementDraft({ ...placementDraft, offersReceived: parseInt(e.target.value) || 0 })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Placement Status</label>
                                    <select className="w-full border rounded p-2 text-sm" value={placementDraft.placementStatus || 'Not Started'} onChange={e => setPlacementDraft({ ...placementDraft, placementStatus: e.target.value as any })}>
                                        {PLACEMENT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Documented Track {placementDraft.placementStatus !== 'Placed' && <span className="text-red-500">(required unless Placed)</span>}</label>
                                    <textarea className="w-full border rounded p-2 text-sm h-20" value={placementDraft.documentedTrack || ''} onChange={e => setPlacementDraft({ ...placementDraft, documentedTrack: e.target.value })} placeholder="What is the concrete plan to get this student placed?" />
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                                <button onClick={() => setIsPlacementModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm">Close</button>
                                <button onClick={savePlacement} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold flex items-center gap-2"><Save size={14} /> Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Final-Year Project modal */}
            {isProjectModalOpen && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsProjectModalOpen(false)}></div>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full">
                            <div className="bg-white px-6 pt-5 pb-4 border-b flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-900">{projectDraft.createdAt ? 'Edit Project' : 'New Final-Year Project'}</h3>
                                <button onClick={() => setIsProjectModalOpen(false)} className="text-gray-500 hover:text-gray-700"><X size={22} /></button>
                            </div>
                            <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Student</label>
                                        <select
                                            className="w-full border rounded p-2 text-sm"
                                            value={projectDraft.studentId || ''}
                                            onChange={e => {
                                                const student = students.find(s => s.id === e.target.value);
                                                setProjectDraft({ ...projectDraft, studentId: e.target.value, batch: student ? studentBatch(student) : projectDraft.batch });
                                            }}
                                        >
                                            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                                        <input className="w-full border rounded p-2 text-sm" value={projectDraft.title || ''} onChange={e => setProjectDraft({ ...projectDraft, title: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Entrepreneurial Potential</label>
                                        <select className="w-full border rounded p-2 text-sm" value={projectDraft.entrepreneurialPotential || 'None'} onChange={e => setProjectDraft({ ...projectDraft, entrepreneurialPotential: e.target.value as any })}>
                                            {ENTREPRENEURIAL_POTENTIAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Award Readiness</label>
                                        <select className="w-full border rounded p-2 text-sm" value={projectDraft.awardReadiness || 'Not Assessed'} onChange={e => setProjectDraft({ ...projectDraft, awardReadiness: e.target.value as any })}>
                                            {AWARD_READINESS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">SDG / Social-Impact / NGO Linkage</label>
                                    <input className="w-full border rounded p-2 text-sm" value={projectDraft.sdgLinkage || ''} onChange={e => setProjectDraft({ ...projectDraft, sdgLinkage: e.target.value })} placeholder="e.g. SDG 11 — partnered with [NGO]" />
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!projectDraft.crossDepartmentCollaboration} onChange={e => setProjectDraft({ ...projectDraft, crossDepartmentCollaboration: e.target.checked })} className="rounded text-indigo-600" /> Cross-department collaboration</label>
                                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!projectDraft.submittedExternally} onChange={e => setProjectDraft({ ...projectDraft, submittedExternally: e.target.checked })} className="rounded text-indigo-600" /> Submitted externally</label>
                                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!projectDraft.identifiedForExtraMentoring} onChange={e => setProjectDraft({ ...projectDraft, identifiedForExtraMentoring: e.target.checked })} className="rounded text-indigo-600" /> Identified for extra award mentoring</label>
                                </div>
                                {projectDraft.submittedExternally && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">External Award Name</label>
                                        <input className="w-full border rounded p-2 text-sm" value={projectDraft.externalAwardName || ''} onChange={e => setProjectDraft({ ...projectDraft, externalAwardName: e.target.value })} />
                                    </div>
                                )}
                                {projectDraft.identifiedForExtraMentoring && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mentoring Notes</label>
                                        <textarea className="w-full border rounded p-2 text-sm h-16" value={projectDraft.mentoringNotes || ''} onChange={e => setProjectDraft({ ...projectDraft, mentoringNotes: e.target.value })} />
                                    </div>
                                )}
                            </div>
                            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                                <button onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm">Close</button>
                                <button onClick={saveProject} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold flex items-center gap-2"><Save size={14} /> Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
