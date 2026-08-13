import React, { useState, useMemo } from 'react';
import { useApp } from './AppContext';
import {
    Module, Role, ModuleFeedbackSession, FeedbackRecord, FeedbackRubricScore,
    FeedbackActionPoint, RvjAssessment
} from './types';
import { normalizeProgram, SESSION_CHECKLIST_ITEMS, RUBRIC_GRADE_LEVELS, RVJ_DIMENSIONS } from './data';
import {
    Calendar, CheckCircle, Circle, ChevronDown, ChevronRight, Clock, Mail, Users, X,
    AlertTriangle, Plus, Trash2, Save, ClipboardList, BookOpen
} from 'lucide-react';

// Institutional rule: every module gets its OWN dedicated 60-minute weekly feedback
// session — never a combined session covering several modules. Applies to Module
// Tutors and to HODs for modules they personally teach (both use the same query:
// TutorAllocation rows where tutorId === the logged-in staff member's id), so this
// component is shared between TutorDashboard.tsx and HodDashboard.tsx.

const DAY_OPTIONS: ModuleFeedbackSession['scheduledDay'][] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];

const getCurrentWeekNumber = (semesterStartDate: string): number => {
    if (!semesterStartDate) return 1;
    const start = new Date(semesterStartDate);
    const now = new Date();
    const diffWeeks = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
    return Math.max(1, diffWeeks > 0 ? diffWeeks : 1);
};

const batchLabel = (m: Module) => `${m.programTitle} • Year ${m.year}`;

const emptyRvjDimensions = () => RVJ_DIMENSIONS.reduce((acc, d) => ({ ...acc, [d.key]: '' }), {} as RvjAssessment['dimensions']);

interface WeeklyFeedbackProps {
    title?: string;
}

export const WeeklyFeedback: React.FC<WeeklyFeedbackProps> = ({ title = 'Weekly Module Feedback' }) => {
    const {
        currentUser, curriculum, allocations, users, briefs, semesterStartDate,
        feedbackSessions, addFeedbackSession, updateFeedbackSession,
        feedbackRecords, addFeedbackRecord, updateFeedbackRecord,
        rvjAssessments, addRvjAssessment, updateRvjAssessment,
    } = useApp();

    const [expandedModuleCode, setExpandedModuleCode] = useState<string | null>(null);
    const [scheduleDraft, setScheduleDraft] = useState<{ day: ModuleFeedbackSession['scheduledDay']; time: string }>({ day: 'Monday', time: '16:00-17:00' });
    const [notesDraft, setNotesDraft] = useState<string>('');
    const [studentModalId, setStudentModalId] = useState<string | null>(null);
    const [studentModalTab, setStudentModalTab] = useState<'feedback' | 'rvj'>('feedback');
    const [recordDraft, setRecordDraft] = useState<Partial<FeedbackRecord> | null>(null);
    const [rvjDraft, setRvjDraft] = useState<Partial<RvjAssessment> | null>(null);

    const currentWeek = getCurrentWeekNumber(semesterStartDate);

    const myModules = useMemo(() => {
        if (!currentUser) return [];
        const codes = allocations.filter(a => a.tutorId === currentUser.id).map(a => a.moduleCode);
        return curriculum.filter(m => codes.includes(m.code));
    }, [currentUser, allocations, curriculum]);

    const getSession = (moduleCode: string) =>
        feedbackSessions.find(s => s.moduleCode === moduleCode && s.staffId === currentUser?.id && s.weekNumber === currentWeek);

    const getActiveBrief = (moduleCode: string) =>
        briefs.filter(b => b.moduleCode === moduleCode && b.status === 'Published').sort((a, b) => b.createdAt - a.createdAt)[0];

    const getCohort = (module: Module) => users.filter(u =>
        u.role === Role.Student &&
        u.year === module.year &&
        (normalizeProgram(u.programId).includes(normalizeProgram(module.programTitle)) || normalizeProgram(module.programTitle).includes(normalizeProgram(u.programId)))
    );

    const handleScheduleSession = (module: Module) => {
        if (!currentUser) return;
        const session: ModuleFeedbackSession = {
            id: `mfs-${module.code}-${currentUser.id}-w${currentWeek}`,
            moduleCode: module.code,
            batch: batchLabel(module),
            staffId: currentUser.id,
            scheduledDay: scheduleDraft.day,
            scheduledTime: scheduleDraft.time,
            weekNumber: currentWeek,
            conducted: false,
            documentationComplete: false,
            checklist: {},
            emailSent: false,
        };
        addFeedbackSession(session);
        setExpandedModuleCode(module.code);
    };

    const toggleConducted = (session: ModuleFeedbackSession) => {
        updateFeedbackSession({
            ...session,
            conducted: !session.conducted,
            conductedAt: !session.conducted ? Date.now() : undefined,
        });
    };

    const toggleChecklistItem = (session: ModuleFeedbackSession, itemId: string) => {
        updateFeedbackSession({ ...session, checklist: { ...session.checklist, [itemId]: !session.checklist[itemId] } });
    };

    const saveNotes = (session: ModuleFeedbackSession) => {
        updateFeedbackSession({ ...session, notes: notesDraft });
    };

    // Email dispatch is NOT automated anywhere in this codebase. This is an explicit
    // manual confirmation, timestamped, that the tutor/HOD has sent the documented
    // feedback to the student(s) by whatever channel they actually used.
    const confirmEmailSent = (session: ModuleFeedbackSession) => {
        const now = Date.now();
        const today = new Date(now).toISOString().split('T')[0];
        updateFeedbackSession({ ...session, emailSent: true, emailSentAt: now });
        feedbackRecords
            .filter(r => r.sessionId === session.id)
            .forEach(r => updateFeedbackRecord({ ...r, feedbackEmailSent: true, feedbackEmailDate: today }));
    };

    const recomputeDocumentation = (session: ModuleFeedbackSession, cohortSize: number, recordCountAfterSave: number) => {
        const isComplete = cohortSize > 0 && recordCountAfterSave >= cohortSize;
        if (isComplete !== session.documentationComplete) {
            updateFeedbackSession({ ...session, documentationComplete: isComplete });
        }
    };

    const openStudentModal = (session: ModuleFeedbackSession, studentId: string, moduleCode: string, batch: string) => {
        const existing = feedbackRecords.find(r => r.sessionId === session.id && r.studentId === studentId);
        const brief = getActiveBrief(moduleCode);
        const milestone = brief?.weeklySchedule.find(w => w.weekNumber === session.weekNumber);

        if (existing) {
            setRecordDraft(existing);
        } else {
            setRecordDraft({
                id: `fr-${session.id}-${studentId}`,
                sessionId: session.id,
                studentId,
                moduleCode,
                batch,
                weekNumber: session.weekNumber,
                currentBriefStage: milestone?.topic || '',
                learningOutcomeAddressed: '',
                rubricScores: (milestone?.rubric || []).map(c => ({ criteriaId: c.id, criteria: c.criteria, grade: '', notes: '' })),
                feedbackGiven: '',
                areasForImprovement: '',
                designDecisionsDiscussed: '',
                rvjObservations: '',
                actionPoints: [],
                deadline: '',
                interventionRequired: false,
                feedbackEmailSent: false,
            });
        }

        const existingRvj = rvjAssessments.find(a => a.studentId === studentId && a.moduleCode === moduleCode && a.weekNumber === session.weekNumber);
        setRvjDraft(existingRvj || {
            id: `rvj-${moduleCode}-${studentId}-w${session.weekNumber}`,
            studentId,
            moduleCode,
            batch,
            weekNumber: session.weekNumber,
            assessedBy: currentUser?.id || '',
            dimensions: emptyRvjDimensions(),
            overallNotes: '',
        });

        setStudentModalTab('feedback');
        setStudentModalId(studentId);
    };

    const closeStudentModal = () => { setStudentModalId(null); setRecordDraft(null); setRvjDraft(null); };

    const saveRecord = (session: ModuleFeedbackSession, cohortSize: number) => {
        if (!recordDraft || !recordDraft.id) return;
        const earliestOpenDeadline = (recordDraft.actionPoints || [])
            .filter(a => !a.completed)
            .map(a => a.deadline)
            .filter(Boolean)
            .sort()[0] || '';

        const finalRecord: FeedbackRecord = {
            id: recordDraft.id,
            sessionId: recordDraft.sessionId!,
            studentId: recordDraft.studentId!,
            moduleCode: recordDraft.moduleCode!,
            batch: recordDraft.batch!,
            weekNumber: recordDraft.weekNumber!,
            currentBriefStage: recordDraft.currentBriefStage || '',
            learningOutcomeAddressed: recordDraft.learningOutcomeAddressed || '',
            rubricScores: recordDraft.rubricScores || [],
            feedbackGiven: recordDraft.feedbackGiven || '',
            areasForImprovement: recordDraft.areasForImprovement || '',
            designDecisionsDiscussed: recordDraft.designDecisionsDiscussed || '',
            rvjObservations: recordDraft.rvjObservations || '',
            actionPoints: recordDraft.actionPoints || [],
            deadline: earliestOpenDeadline,
            interventionRequired: !!recordDraft.interventionRequired,
            feedbackEmailSent: !!recordDraft.feedbackEmailSent,
            feedbackEmailDate: recordDraft.feedbackEmailDate,
            markedAt: Date.now(),
        };

        const alreadyExists = feedbackRecords.some(r => r.id === finalRecord.id);
        if (alreadyExists) updateFeedbackRecord(finalRecord); else addFeedbackRecord(finalRecord);

        const recordCountAfterSave = feedbackRecords.filter(r => r.sessionId === session.id).length + (alreadyExists ? 0 : 1);
        recomputeDocumentation(session, cohortSize, recordCountAfterSave);
    };

    const saveRvj = () => {
        if (!rvjDraft || !rvjDraft.id) return;
        const finalAssessment: RvjAssessment = {
            id: rvjDraft.id,
            studentId: rvjDraft.studentId!,
            moduleCode: rvjDraft.moduleCode!,
            batch: rvjDraft.batch!,
            weekNumber: rvjDraft.weekNumber!,
            assessedBy: rvjDraft.assessedBy || currentUser?.id || '',
            assessedAt: Date.now(),
            dimensions: rvjDraft.dimensions || emptyRvjDimensions(),
            overallNotes: rvjDraft.overallNotes || '',
            auditedByHod: rvjDraft.auditedByHod,
            auditedByHodAt: rvjDraft.auditedByHodAt,
            auditedByVp: rvjDraft.auditedByVp,
            auditedByVpAt: rvjDraft.auditedByVpAt,
        };
        const exists = rvjAssessments.some(a => a.id === finalAssessment.id);
        if (exists) updateRvjAssessment(finalAssessment); else addRvjAssessment(finalAssessment);
    };

    const addActionPoint = () => {
        if (!recordDraft) return;
        const newPoint: FeedbackActionPoint = { id: `ap-${Date.now()}`, description: '', deadline: '', completed: false };
        setRecordDraft({ ...recordDraft, actionPoints: [...(recordDraft.actionPoints || []), newPoint] });
    };

    const updateActionPoint = (idx: number, field: keyof FeedbackActionPoint, value: any) => {
        if (!recordDraft) return;
        const points = [...(recordDraft.actionPoints || [])];
        points[idx] = { ...points[idx], [field]: value };
        setRecordDraft({ ...recordDraft, actionPoints: points });
    };

    const removeActionPoint = (idx: number) => {
        if (!recordDraft) return;
        const points = (recordDraft.actionPoints || []).filter((_, i) => i !== idx);
        setRecordDraft({ ...recordDraft, actionPoints: points });
    };

    const updateRubricScore = (criteriaId: string, field: 'grade' | 'notes', value: string) => {
        if (!recordDraft) return;
        const scores = (recordDraft.rubricScores || []).map(s => s.criteriaId === criteriaId ? { ...s, [field]: value } : s);
        setRecordDraft({ ...recordDraft, rubricScores: scores });
    };

    if (!currentUser) return null;

    const modalStudent = studentModalId ? users.find(u => u.id === studentModalId) : null;
    const modalSession = modalStudent ? getSession(recordDraft?.moduleCode || '') : null;
    const modalCohortSize = modalSession ? getCohort(curriculum.find(m => m.code === modalSession.moduleCode)!).length : 0;

    return (
        <div className="space-y-4">
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><ClipboardList size={18} className="text-indigo-600" /> {title}</h3>
                        <p className="text-sm text-gray-500 mt-1">Week {currentWeek} — one dedicated 60-minute session per module. {myModules.length} module{myModules.length === 1 ? '' : 's'} this semester.</p>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Email dispatch is manual — confirm after sending, it is not sent automatically.</span>
                </div>
            </div>

            {myModules.length === 0 && (
                <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">No modules currently allocated to you.</div>
            )}

            {myModules.map(module => {
                const session = getSession(module.code);
                const isExpanded = expandedModuleCode === module.code;
                const cohort = getCohort(module);
                const documentedCount = session ? feedbackRecords.filter(r => r.sessionId === session.id).length : 0;

                return (
                    <div key={module.code} className="bg-white shadow rounded-lg overflow-hidden">
                        <button
                            onClick={() => { setExpandedModuleCode(isExpanded ? null : module.code); setNotesDraft(session?.notes || ''); }}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 text-left"
                        >
                            <div className="flex items-center gap-3">
                                {isExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                                <div>
                                    <div className="font-bold text-gray-900">{module.title}</div>
                                    <div className="text-xs text-gray-500">{module.code} • {batchLabel(module)}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!session ? (
                                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Not scheduled</span>
                                ) : session.conducted ? (
                                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle size={12} /> Conducted</span>
                                ) : (
                                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1"><Clock size={12} /> {session.scheduledDay} {session.scheduledTime}</span>
                                )}
                                {session && (
                                    <span className="text-xs text-gray-400">{documentedCount}/{cohort.length} documented</span>
                                )}
                            </div>
                        </button>

                        {isExpanded && (
                            <div className="border-t border-gray-100 p-6 space-y-6">
                                {!session ? (
                                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4 flex flex-wrap items-end gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Day</label>
                                            <select className="border rounded p-2 text-sm" value={scheduleDraft.day} onChange={e => setScheduleDraft({ ...scheduleDraft, day: e.target.value as any })}>
                                                {DAY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Time (60 min)</label>
                                            <input type="text" className="border rounded p-2 text-sm w-32" placeholder="16:00-17:00" value={scheduleDraft.time} onChange={e => setScheduleDraft({ ...scheduleDraft, time: e.target.value })} />
                                        </div>
                                        <button onClick={() => handleScheduleSession(module)} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2"><Calendar size={14} /> Schedule This Week's Session</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 text-sm text-gray-600">
                                                <Clock size={14} /> {session.scheduledDay}, {session.scheduledTime} — Week {session.weekNumber}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleConducted(session)}
                                                    className={`text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 ${session.conducted ? 'bg-green-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                                >
                                                    <CheckCircle size={14} /> {session.conducted ? 'Marked Conducted' : 'Mark Conducted'}
                                                </button>
                                                <button
                                                    onClick={() => confirmEmailSent(session)}
                                                    disabled={!session.documentationComplete || session.emailSent}
                                                    title={!session.documentationComplete ? 'Document every student first' : ''}
                                                    className={`text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${session.emailSent ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                                >
                                                    <Mail size={14} /> {session.emailSent ? `Emailed ${new Date(session.emailSentAt!).toLocaleDateString()}` : 'Confirm Feedback Email Sent'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* 14-point session review checklist */}
                                        <div>
                                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Session Review Checklist</div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {SESSION_CHECKLIST_ITEMS.map(item => (
                                                    <label key={item.id} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded px-3 py-2 cursor-pointer hover:bg-gray-100">
                                                        <input type="checkbox" checked={!!session.checklist[item.id]} onChange={() => toggleChecklistItem(session, item.id)} className="rounded text-indigo-600" />
                                                        {item.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs font-bold text-gray-500 uppercase mb-1">Session Notes</div>
                                            <div className="flex gap-2">
                                                <textarea className="flex-1 border rounded p-2 text-sm" rows={2} value={notesDraft} onChange={e => setNotesDraft(e.target.value)} placeholder="General notes for this session..." />
                                                <button onClick={() => saveNotes(session)} className="text-xs font-bold px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 h-fit flex items-center gap-1"><Save size={12} /> Save</button>
                                            </div>
                                        </div>

                                        {/* Per-student roster */}
                                        <div>
                                            <div className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Users size={12} /> Students ({cohort.length})</div>
                                            {cohort.length === 0 ? (
                                                <div className="text-sm text-gray-400 italic">No students found for this batch.</div>
                                            ) : (
                                                <ul className="divide-y divide-gray-100 border rounded-lg">
                                                    {cohort.map(student => {
                                                        const record = feedbackRecords.find(r => r.sessionId === session.id && r.studentId === student.id);
                                                        return (
                                                            <li key={student.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50">
                                                                <div className="flex items-center gap-2 text-sm text-gray-800">
                                                                    {record ? <CheckCircle size={14} className="text-green-500" /> : <Circle size={14} className="text-gray-300" />}
                                                                    {student.name}
                                                                    {record?.interventionRequired && <AlertTriangle size={14} className="text-red-500" title="Intervention required" />}
                                                                </div>
                                                                <button
                                                                    onClick={() => openStudentModal(session, student.id, module.code, session.batch)}
                                                                    className="text-xs font-bold text-indigo-600 hover:underline"
                                                                >
                                                                    {record ? 'View / Edit' : 'Log Feedback'}
                                                                </button>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Per-student Feedback / RVJ modal */}
            {studentModalId && modalStudent && recordDraft && modalSession && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeStudentModal}></div>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
                            <div className="bg-white px-6 pt-5 pb-4 border-b flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{modalStudent.name}</h3>
                                    <p className="text-xs text-gray-500">{recordDraft.moduleCode} • Week {recordDraft.weekNumber}</p>
                                </div>
                                <button onClick={closeStudentModal} className="text-gray-500 hover:text-gray-700"><X size={22} /></button>
                            </div>

                            <div className="flex border-b bg-gray-50">
                                <button onClick={() => setStudentModalTab('feedback')} className={`flex-1 py-2.5 text-sm font-medium border-b-2 ${studentModalTab === 'feedback' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-500'}`}>Weekly Feedback</button>
                                <button onClick={() => setStudentModalTab('rvj')} className={`flex-1 py-2.5 text-sm font-medium border-b-2 ${studentModalTab === 'rvj' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-500'}`}>RVJ Assessment</button>
                            </div>

                            <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">
                                {studentModalTab === 'feedback' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Brief Stage</label>
                                                <input className="w-full border rounded p-2 text-sm" value={recordDraft.currentBriefStage || ''} onChange={e => setRecordDraft({ ...recordDraft, currentBriefStage: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Learning Outcome Addressed</label>
                                                <input className="w-full border rounded p-2 text-sm" value={recordDraft.learningOutcomeAddressed || ''} onChange={e => setRecordDraft({ ...recordDraft, learningOutcomeAddressed: e.target.value })} />
                                            </div>
                                        </div>

                                        {/* Rubric scoring — SAME rubric attached to this week's milestone in the brief */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><BookOpen size={12} /> Milestone Rubric Score</label>
                                            {(recordDraft.rubricScores || []).length === 0 ? (
                                                <div className="text-xs text-gray-400 italic bg-gray-50 border border-dashed rounded p-3">
                                                    No rubric attached to Week {recordDraft.weekNumber}'s milestone yet — add one on the brief's Schedule tab to score against it here.
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {(recordDraft.rubricScores || []).map(score => (
                                                        <div key={score.criteriaId} className="border rounded p-2 flex items-center justify-between gap-3">
                                                            <span className="text-sm font-medium text-gray-800 flex-1">{score.criteria}</span>
                                                            <select className="border rounded p-1.5 text-xs" value={score.grade} onChange={e => updateRubricScore(score.criteriaId, 'grade', e.target.value)}>
                                                                <option value="">Grade...</option>
                                                                {RUBRIC_GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
                                                            </select>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Feedback Given</label>
                                                <textarea className="w-full border rounded p-2 text-sm h-20" value={recordDraft.feedbackGiven || ''} onChange={e => setRecordDraft({ ...recordDraft, feedbackGiven: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Areas for Improvement</label>
                                                <textarea className="w-full border rounded p-2 text-sm h-20" value={recordDraft.areasForImprovement || ''} onChange={e => setRecordDraft({ ...recordDraft, areasForImprovement: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Design Decisions Discussed</label>
                                                <textarea className="w-full border rounded p-2 text-sm h-20" value={recordDraft.designDecisionsDiscussed || ''} onChange={e => setRecordDraft({ ...recordDraft, designDecisionsDiscussed: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">RVJ Observations</label>
                                                <textarea className="w-full border rounded p-2 text-sm h-20" value={recordDraft.rvjObservations || ''} onChange={e => setRecordDraft({ ...recordDraft, rvjObservations: e.target.value })} />
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="block text-xs font-bold text-gray-500 uppercase">Action Points</label>
                                                <button onClick={addActionPoint} className="text-xs font-bold text-indigo-600 flex items-center gap-1"><Plus size={12} /> Add</button>
                                            </div>
                                            {(recordDraft.actionPoints || []).length === 0 ? (
                                                <div className="text-xs text-gray-400 italic">No action points logged.</div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {(recordDraft.actionPoints || []).map((ap, idx) => (
                                                        <div key={ap.id} className="flex items-center gap-2 bg-gray-50 border rounded p-2">
                                                            <input type="checkbox" checked={ap.completed} onChange={e => updateActionPoint(idx, 'completed', e.target.checked)} className="rounded text-indigo-600" />
                                                            <input className="flex-1 border rounded p-1.5 text-sm" placeholder="Action required..." value={ap.description} onChange={e => updateActionPoint(idx, 'description', e.target.value)} />
                                                            <input type="date" className="border rounded p-1.5 text-xs" value={ap.deadline} onChange={e => updateActionPoint(idx, 'deadline', e.target.value)} />
                                                            <button onClick={() => removeActionPoint(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14} /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <label className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2 cursor-pointer w-fit">
                                            <input type="checkbox" checked={!!recordDraft.interventionRequired} onChange={e => setRecordDraft({ ...recordDraft, interventionRequired: e.target.checked })} className="rounded text-red-600" />
                                            Intervention required
                                        </label>
                                    </>
                                )}

                                {studentModalTab === 'rvj' && rvjDraft && (
                                    <div className="space-y-3">
                                        <p className="text-xs text-gray-500">Reflective Visual Journal quality assessment — same Excellent/Very Good/Good/Average/Poor scale as the milestone rubric, auditable by HOD and VP.</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {RVJ_DIMENSIONS.map(dim => (
                                                <div key={dim.key} className="flex items-center justify-between gap-2 border rounded p-2">
                                                    <span className="text-sm text-gray-800">{dim.label}</span>
                                                    <select
                                                        className="border rounded p-1.5 text-xs"
                                                        value={(rvjDraft.dimensions as any)?.[dim.key] || ''}
                                                        onChange={e => setRvjDraft({ ...rvjDraft, dimensions: { ...(rvjDraft.dimensions as any), [dim.key]: e.target.value } })}
                                                    >
                                                        <option value="">Grade...</option>
                                                        {RUBRIC_GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Overall Notes</label>
                                            <textarea className="w-full border rounded p-2 text-sm h-20" value={rvjDraft.overallNotes || ''} onChange={e => setRvjDraft({ ...rvjDraft, overallNotes: e.target.value })} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                                <button onClick={closeStudentModal} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm">Close</button>
                                {studentModalTab === 'feedback' ? (
                                    <button onClick={() => { saveRecord(modalSession, modalCohortSize); closeStudentModal(); }} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold flex items-center gap-2"><Save size={14} /> Save Feedback</button>
                                ) : (
                                    <button onClick={() => { saveRvj(); closeStudentModal(); }} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold flex items-center gap-2"><Save size={14} /> Save RVJ</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
