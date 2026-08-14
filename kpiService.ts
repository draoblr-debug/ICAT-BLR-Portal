import {
    SurveyResponse, Module, User, TutorAllocation, FeedbackCycle, ActionPoint, KpiResult,
    IndustryEngagement, PlacementReadinessStatus, FinalYearProject, AttendanceRecord,
    AssignmentBrief, Submission, SemesterPlanEntry, Holiday, ModuleFeedbackSession,
    FeedbackRecord, AttendanceActionPlan, RvjAssessment, PortfolioReview,
    SystemicAttendanceAlert, Role, LessonPlan, AIClassModule
} from './types';
import {
    CYCLE_FEEDBACK_QUESTIONS, CYCLE_FEEDBACK_CATEGORIES, normalizeProgram,
    INDUSTRY_ENGAGEMENT_COUNTED_STAGES, INDUSTRY_ENGAGEMENT_TARGET_PER_MODULE,
    AWARD_PIPELINE_MENTORING_TARGET, getHodDepartments
} from './data';
import { calculateFeedbackCompliance, calculateRollingAttendance, calculateLessonTracking } from './analyticsService';

// Simulates server-side delay, matching the convention already in analyticsService.ts.
const simulateNetworkDelay = async () => new Promise(resolve => setTimeout(resolve, 100));

// --- BI-MONTHLY FEEDBACK CYCLE ANALYSIS & ACTION-POINT LOOP (KRA/KPI Phase 3) ---
// New file: analyticsService.ts is already at ~600 lines, the threshold the task set for
// splitting analytics functions into a dedicated kpiService.ts.

// Mirrors calculateDetailedAnalysis's return shape (subject/fullQuestion/A/fullMark) so it
// drops into the same Radar-chart usage, but reads against CYCLE_FEEDBACK_QUESTIONS (13
// categories) instead of the legacy 10-question LIKERT_QUESTIONS, and is scoped to one
// cycle. calculateDetailedAnalysis itself is left untouched — kept as a separate function
// rather than a parameterised version of it, so nothing about the existing legacy-survey
// call site in ManagerDashboard.tsx can regress.
export const calculateCycleDetailedAnalysis = async (
    cycleId: string | null,
    moduleCode: string | null,
    surveys: SurveyResponse[]
) => {
    if (!cycleId || !moduleCode) return [];
    await simulateNetworkDelay();

    const relevant = surveys.filter(s => s.cycleId === cycleId && s.moduleCode === moduleCode);
    if (relevant.length === 0) return [];

    const totals = new Array(CYCLE_FEEDBACK_QUESTIONS.length).fill(0);
    let validCount = 0;

    relevant.forEach(s => {
        if (s.detailedRatings && s.detailedRatings.length === CYCLE_FEEDBACK_QUESTIONS.length) {
            s.detailedRatings.forEach((rating, idx) => { totals[idx] += rating; });
            validCount++;
        }
    });

    if (validCount === 0) return [];

    return CYCLE_FEEDBACK_CATEGORIES.map((cat, idx) => ({
        key: cat.key,
        subject: cat.label,
        fullQuestion: cat.question,
        A: parseFloat((totals[idx] / validCount).toFixed(1)),
        fullMark: 5,
        responseCount: validCount,
    }));
};

export type CycleTrendGrouping = 'module' | 'tutor' | 'department' | 'batch' | 'category';

export interface CycleTrendPoint {
    cycleId: string;
    cycleLabel: string;
    averageRating: number;
    responseCount: number;
}

export interface CycleTrendSeries {
    key: string;
    label: string;
    points: CycleTrendPoint[];
}

// Cycle-on-cycle improvement (e.g. 3.1/5 -> action -> 3.8/5), trended by module, tutor,
// department, batch or category. 'category' trends the 13 categories themselves across
// cycles (pooling every response); the other groupings trend each response's overall
// `rating` average within that module/tutor/department/batch.
export const calculateCycleTrends = async (
    surveys: SurveyResponse[],
    cycles: FeedbackCycle[],
    curriculum: Module[],
    allocations: TutorAllocation[],
    users: User[],
    groupBy: CycleTrendGrouping
): Promise<CycleTrendSeries[]> => {
    await simulateNetworkDelay();

    const cycleSurveys = surveys.filter(s => s.cycleId && s.detailedRatings && s.detailedRatings.length === CYCLE_FEEDBACK_QUESTIONS.length);
    const sortedCycles = [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));

    if (groupBy === 'category') {
        return CYCLE_FEEDBACK_CATEGORIES.map((cat, catIdx) => {
            const points = sortedCycles.map(cycle => {
                const responses = cycleSurveys.filter(s => s.cycleId === cycle.id);
                const scores = responses.map(s => s.detailedRatings![catIdx]);
                const averageRating = scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : 0;
                return { cycleId: cycle.id, cycleLabel: cycle.label, averageRating, responseCount: scores.length };
            }).filter(p => p.responseCount > 0);
            return { key: cat.key, label: cat.label, points };
        }).filter(s => s.points.length > 0);
    }

    const keyLabelFor = (survey: SurveyResponse): { key: string; label: string } | null => {
        const module = curriculum.find(m => m.code === survey.moduleCode);
        if (!module) return null;
        if (groupBy === 'module') return { key: module.code, label: module.title };
        if (groupBy === 'batch') return { key: `${module.programTitle}-${module.year}`, label: `${module.programTitle} • Year ${module.year}` };
        if (groupBy === 'department') return { key: normalizeProgram(module.programTitle), label: module.programTitle };
        if (groupBy === 'tutor') {
            const alloc = allocations.find(a => a.moduleCode === module.code);
            const tutor = users.find(u => u.id === alloc?.tutorId);
            return tutor ? { key: tutor.id, label: tutor.name } : null;
        }
        return null;
    };

    const seriesMap = new Map<string, { label: string; byCycle: Map<string, number[]> }>();
    cycleSurveys.forEach(survey => {
        const target = keyLabelFor(survey);
        if (!target) return;
        if (!seriesMap.has(target.key)) seriesMap.set(target.key, { label: target.label, byCycle: new Map() });
        const entry = seriesMap.get(target.key)!;
        if (!entry.byCycle.has(survey.cycleId!)) entry.byCycle.set(survey.cycleId!, []);
        entry.byCycle.get(survey.cycleId!)!.push(survey.rating);
    });

    return Array.from(seriesMap.entries()).map(([key, { label, byCycle }]) => {
        const points = sortedCycles.map(cycle => {
            const scores = byCycle.get(cycle.id) || [];
            const averageRating = scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : 0;
            return { cycleId: cycle.id, cycleLabel: cycle.label, averageRating, responseCount: scores.length };
        }).filter(p => p.responseCount > 0);
        return { key, label, points };
    }).filter(s => s.points.length > 0);
};

// The VP KPI: >=90% of action points closed within their agreed deadline. Measures
// improvement follow-through, not just satisfaction level.
//
// Definition (a judgment call — flagging for VP/DRAO review): an action point counts as
// "due for measurement" once it is Closed, Escalated, or still open past its deadline.
// Points not yet at their deadline are excluded — they haven't had a chance to be timely
// or late yet. "Closed on time" means status is Closed and it was closed (using
// updatedAt as the closure timestamp) on or before its deadline.
export const calculateActionPointClosureRate = async (
    actionPoints: ActionPoint[],
    period: string = 'All Time'
): Promise<KpiResult> => {
    await simulateNetworkDelay();

    const today = new Date().toISOString().split('T')[0];
    const isOverdue = (p: ActionPoint) => !!p.deadline && p.deadline < today;
    const closedOnTime = (p: ActionPoint) => p.status === 'Closed' && new Date(p.updatedAt).toISOString().split('T')[0] <= p.deadline;

    const dueForMeasurement = actionPoints.filter(p =>
        p.status === 'Closed' || p.status === 'Escalated' || isOverdue(p)
    );
    const closedOnTimeCount = dueForMeasurement.filter(closedOnTime).length;

    const actual = dueForMeasurement.length > 0 ? Math.round((closedOnTimeCount / dueForMeasurement.length) * 100) : 0;
    const target = 90;
    const status: KpiResult['status'] = dueForMeasurement.length === 0
        ? 'No Data'
        : actual >= target ? 'On Track' : actual >= target - 15 ? 'At Risk' : 'Off Track';

    return {
        kpiId: 'vp-action-point-closure-rate',
        label: 'Action Points Closed Within Timeline',
        actual,
        target,
        unit: 'percent',
        status,
        period,
    };
};

// --- INDUSTRY, ALUMNI, PORTFOLIO & PLACEMENT (KRA/KPI Phase 4) ---

export interface ModuleIndustryEngagementCoverage {
    moduleCode: string;
    moduleTitle: string;
    countedEngagements: number;
    target: number;
    metTarget: boolean;
}

// Target: >=2 relevant industry experts/seminars per ACTIVE module per semester, measuring
// meaningful engagement and documented outcomes — NOT emails sent. Only engagements that
// reached INDUSTRY_ENGAGEMENT_COUNTED_STAGES (Student Exposure, Document Outcome, Maintain
// Relationship) count; earlier pipeline stages (Identify/Contact/Engage/Schedule/
// Collaborate) are in-progress work, not delivered engagement.
export const calculateIndustryEngagementCoverage = async (
    engagements: IndustryEngagement[],
    curriculum: Module[],
    currentSemesterType: 'Odd' | 'Even'
): Promise<{ byModule: ModuleIndustryEngagementCoverage[]; overall: KpiResult }> => {
    await simulateNetworkDelay();

    const activeModules = curriculum.filter(m => {
        const isOdd = m.sem % 2 !== 0;
        return currentSemesterType === 'Odd' ? isOdd : !isOdd;
    });

    const byModule: ModuleIndustryEngagementCoverage[] = activeModules.map(m => {
        const countedEngagements = engagements.filter(e => e.moduleCode === m.code && INDUSTRY_ENGAGEMENT_COUNTED_STAGES.includes(e.stage)).length;
        return {
            moduleCode: m.code,
            moduleTitle: m.title,
            countedEngagements,
            target: INDUSTRY_ENGAGEMENT_TARGET_PER_MODULE,
            metTarget: countedEngagements >= INDUSTRY_ENGAGEMENT_TARGET_PER_MODULE,
        };
    }).sort((a, b) => a.countedEngagements - b.countedEngagements);

    const modulesMetTarget = byModule.filter(m => m.metTarget).length;
    const actual = activeModules.length > 0 ? Math.round((modulesMetTarget / activeModules.length) * 100) : 0;
    const status: KpiResult['status'] = activeModules.length === 0
        ? 'No Data'
        : actual >= 100 ? 'On Track' : actual >= 60 ? 'At Risk' : 'Off Track';

    return {
        byModule,
        overall: {
            kpiId: 'industry-engagement-coverage',
            label: 'Active Modules Meeting Industry Engagement Target (>=2/semester)',
            actual,
            target: 100,
            unit: 'percent',
            status,
            period: `${currentSemesterType} Semester`,
        },
    };
};

// Denominator is deliberately the set of students staff have actually started tracking
// (i.e. who have a PlacementReadinessStatus record), not an auto-detected "final year"
// population — there's no reliable signal in Module/User for how many years a given
// program runs, so guessing which students are in their final year would risk a wrong and
// silently misleading denominator. Target: 100% Placed OR on a documented track.
export const calculatePlacementReadinessRate = async (
    placementReadiness: PlacementReadinessStatus[]
): Promise<KpiResult> => {
    await simulateNetworkDelay();

    const total = placementReadiness.length;
    const onTrack = placementReadiness.filter(p => p.placementStatus === 'Placed' || p.documentedTrack.trim().length > 0).length;
    const actual = total > 0 ? Math.round((onTrack / total) * 100) : 0;
    const status: KpiResult['status'] = total === 0
        ? 'No Data'
        : actual >= 100 ? 'On Track' : actual >= 75 ? 'At Risk' : 'Off Track';

    return {
        kpiId: 'placement-readiness-rate',
        label: 'Tracked Final-Year Students Placed or on a Documented Track',
        actual,
        target: 100,
        unit: 'percent',
        status,
        period: 'Current Tracking Cohort',
    };
};

export interface DepartmentAwardSubmission {
    department: string;
    submittedCount: number;
    metTarget: boolean;
}

// Two-level award pipeline: >=1 project per department submitted externally per year, and
// >=3 projects campus-wide identified with genuine award potential receiving extra
// mentoring. "Department" is derived from FinalYearProject.batch (same "{programTitle} •
// Year {n}" convention used throughout — see batchLabel in WeeklyFeedback.tsx /
// AttendanceWatchlist.tsx), taking the programTitle portion as a department proxy.
export const calculateAwardPipelineStatus = async (
    projects: FinalYearProject[]
): Promise<{ byDepartment: DepartmentAwardSubmission[]; mentoringKpi: KpiResult }> => {
    await simulateNetworkDelay();

    const deptOf = (batch: string) => batch.split(' • ')[0] || batch;

    const byDeptProjects = new Map<string, FinalYearProject[]>();
    projects.forEach(p => {
        const dept = deptOf(p.batch);
        if (!byDeptProjects.has(dept)) byDeptProjects.set(dept, []);
        byDeptProjects.get(dept)!.push(p);
    });

    const byDepartment: DepartmentAwardSubmission[] = Array.from(byDeptProjects.entries()).map(([department, projs]) => {
        const submittedCount = projs.filter(p => p.submittedExternally).length;
        return { department, submittedCount, metTarget: submittedCount >= 1 };
    }).sort((a, b) => a.submittedCount - b.submittedCount);

    const mentoringCount = projects.filter(p => p.identifiedForExtraMentoring).length;
    const status: KpiResult['status'] = projects.length === 0
        ? 'No Data'
        : mentoringCount >= AWARD_PIPELINE_MENTORING_TARGET ? 'On Track' : mentoringCount >= 1 ? 'At Risk' : 'Off Track';

    return {
        byDepartment,
        mentoringKpi: {
            kpiId: 'award-pipeline-mentoring',
            label: 'Projects Identified for Extra Award Mentoring',
            actual: mentoringCount,
            target: AWARD_PIPELINE_MENTORING_TARGET,
            unit: 'count',
            status,
            period: 'Current Year',
        },
    };
};

// --- ROLE-BASED KRA/KPI DASHBOARDS (Phase 5) ---
// Wires everything from Phases 1-4 into three fixed KpiResult[] lists, one per role. The
// task itemized Module Tutor's 16 KPIs by name; HOD's 11 HOD-only KPIs and the Vice
// Principal's 19 were given only as category phrases with a total count, not named items —
// see KPI_IMPLEMENTATION.md for the full reasoning behind how each category was broken down
// into named, individually-computed KPIs here. Every judgment call (an informal target
// where the task gave none, a proxy metric where no direct signal exists) is flagged in a
// comment at the point it's made.

// Almost the entire app's state — these functions are per-role dashboard aggregators, not
// narrow calculators, so they need broad access. Components pass their useApp() value
// directly; TS structural typing accepts the extra fields useApp() carries (event handlers
// etc.) that this interface doesn't list.
export interface KraDataBag {
    curriculum: Module[];
    users: User[];
    allocations: TutorAllocation[];
    attendance: AttendanceRecord[];
    briefs: AssignmentBrief[];
    submissions: Submission[];
    semesterPlans: SemesterPlanEntry[];
    holidays: Holiday[];
    semesterStartDate: string;
    currentSemesterType: 'Odd' | 'Even';
    lessonPlans: LessonPlan[];
    aiModules: AIClassModule[];
    feedbackSessions: ModuleFeedbackSession[];
    feedbackRecords: FeedbackRecord[];
    attendanceActionPlans: AttendanceActionPlan[];
    rvjAssessments: RvjAssessment[];
    industryEngagements: IndustryEngagement[];
    placementReadiness: PlacementReadinessStatus[];
    finalYearProjects: FinalYearProject[];
    portfolioReviews: PortfolioReview[];
    surveys: SurveyResponse[];
    feedbackCycles: FeedbackCycle[];
    actionPoints: ActionPoint[];
    systemicAttendanceAlerts: SystemicAttendanceAlert[];
}

// Ratio-based status banding used by every KPI built in this section: >=100% of target is
// On Track, >=70% is At Risk, below that is Off Track. This is a single consistent rule
// introduced for Phase 5's own new KPIs; it does NOT change the bespoke status logic already
// shipped inside individual Phase 1-4 functions (e.g. calculateActionPointClosureRate),
// which are left exactly as committed.
const kpiStatus = (actual: number, target: number): KpiResult['status'] => {
    if (target <= 0) return actual <= 0 ? 'On Track' : 'Off Track';
    const ratio = actual / target;
    if (ratio >= 1) return 'On Track';
    if (ratio >= 0.7) return 'At Risk';
    return 'Off Track';
};

const makeKpi = (kpiId: string, label: string, actual: number, target: number, unit: KpiResult['unit'], period: string, hasData: boolean = true): KpiResult => ({
    kpiId,
    label,
    actual: hasData ? Math.round(actual * 10) / 10 : 0,
    target,
    unit,
    status: hasData ? kpiStatus(actual, target) : 'No Data',
    period,
});

// For KpiResults borrowed whole from a Phase 1-4 function (calculateActionPointClosureRate,
// calculatePlacementReadinessRate, calculateAwardPipelineStatus's mentoringKpi) — re-tags the
// id only. Deliberately does NOT run the value back through makeKpi/kpiStatus: those
// functions each have their own bespoke status rule (e.g. an absolute point-margin for
// closure, a >=1-count "At Risk" step for award mentoring) that would silently change if
// recomputed by this section's generic ratio rule.
const rekey = (original: KpiResult, kpiId: string): KpiResult => ({ ...original, kpiId });

const pct = (numerator: number, denominator: number): number => denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

// A Published brief is "quality" when it states outcomes AND every weekly milestone is
// actually filled in — the same structural-completeness check calculateDepartmentPerformance
// uses (analyticsService.ts), duplicated here at the single-module grain rather than shared
// as an export, since it's five lines and pulling it across files isn't worth the coupling.
const hasQualityBrief = (moduleCode: string, briefs: AssignmentBrief[]): boolean => {
    const brief = briefs.find(b => b.moduleCode === moduleCode && b.status === 'Published');
    if (!brief) return false;
    if (!brief.learningOutcomes || brief.learningOutcomes.length === 0) return false;
    if (!brief.weeklySchedule || brief.weeklySchedule.length === 0) return false;
    return brief.weeklySchedule.every(w => w.topic?.trim() && w.description?.trim());
};

// Same program-matching rule HodDashboard.tsx uses for isMyModule — duplicated locally so
// this service file doesn't import business logic out of a UI component.
const isModuleInDepartments = (m: Module, deptKeys: string[]): boolean => {
    const normProgram = normalizeProgram(m.programTitle);
    if (deptKeys.includes('foundation') && normProgram.includes('visualarts')) return true;
    if (deptKeys.includes('game') && normProgram.includes('animation')) return false;
    return deptKeys.some(deptKey => normProgram.includes(deptKey));
};

// Scheduled teaching days (Mon-Fri, minus holidays) from semester start through today —
// shared by the "daily attendance recording/monitoring" KPIs at tutor, HOD and VP grain.
const scheduledTeachingDays = (semesterStartDate: string, holidays: Holiday[]): string[] => {
    if (!semesterStartDate) return [];
    const start = new Date(semesterStartDate);
    const today = new Date();
    if (start > today) return [];
    const days: string[] = [];
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow === 0 || dow === 6) continue;
        const dateStr = d.toISOString().split('T')[0];
        if (holidays.some(h => h.date === dateStr)) continue;
        days.push(dateStr);
    }
    return days;
};

const attendanceRecordingRate = (moduleCodes: string[], bag: KraDataBag): { actual: number; hasData: boolean } => {
    const scheduledDays = scheduledTeachingDays(bag.semesterStartDate, bag.holidays);
    if (scheduledDays.length === 0 || moduleCodes.length === 0) return { actual: 0, hasData: false };
    const recordedDates = new Set(bag.attendance.filter(a => moduleCodes.includes(a.moduleCode)).map(a => a.date));
    const daysWithRecording = scheduledDays.filter(d => recordedDates.has(d)).length;
    return { actual: pct(daysWithRecording, scheduledDays.length), hasData: true };
};

const gradesForModules = (moduleCodes: string[], bag: KraDataBag): number[] => {
    const briefModuleMap = new Map(bag.briefs.map(b => [b.id, b.moduleCode]));
    return bag.submissions
        .filter(s => s.briefId && briefModuleMap.has(s.briefId) && moduleCodes.includes(briefModuleMap.get(s.briefId)!) && s.grade?.numericScore !== undefined)
        .map(s => s.grade!.numericScore!);
};

const activeModulesFor = (allModules: Module[], currentSemesterType: 'Odd' | 'Even'): Module[] =>
    allModules.filter(m => {
        const isOdd = m.sem % 2 !== 0;
        return currentSemesterType === 'Odd' ? isOdd : !isOdd;
    });

// Module Tutor — 16 KPIs, itemized by name in the task:
// timely delivery; learning outcomes defined; briefs aligned to outcomes; dedicated weekly
// feedback per module; feedback documented; documented feedback reaching students; feedback
// emails sent; at-risk identified and actioned; daily attendance recording; attendance
// >=75%; >=2 industry experts per module; 100% pass; >=50% above 60%; >=20% above 80%;
// weekly report to HOD; >=25% students posting >=10 module posts.
export const calculateModuleTutorKpis = async (tutorId: string, bag: KraDataBag): Promise<KpiResult[]> => {
    await simulateNetworkDelay();

    const period = `${bag.currentSemesterType} Semester`;
    const myModuleCodes = bag.allocations.filter(a => a.tutorId === tutorId).map(a => a.moduleCode);
    const myModules = bag.curriculum.filter(m => myModuleCodes.includes(m.code));
    const myActiveModules = activeModulesFor(myModules, bag.currentSemesterType);
    const myActiveModuleCodes = myActiveModules.map(m => m.code);

    // 1. Timely delivery — reuses the existing calculateLessonTracking (pre-dates this
    // project) as the best available signal for "content delivered on schedule": sessions
    // chunked/planned vs. total sessions expected to date. Core modules only, since that
    // function scopes to Core — matches its existing behavior everywhere else it's used.
    const lessonTracking = await calculateLessonTracking(
        bag.semesterStartDate, bag.curriculum, bag.currentSemesterType, bag.allocations,
        bag.users, bag.semesterPlans, bag.lessonPlans, bag.aiModules, bag.holidays
    );
    const myLessonTracking = lessonTracking.filter(t => myModuleCodes.includes(t.module.code));
    const timelyDeliveryActual = myLessonTracking.length > 0
        ? myLessonTracking.reduce((s, t) => s + t.chunkProgress, 0) / myLessonTracking.length
        : 0;

    // 2 & 3. Learning outcomes / brief alignment structural-completeness checks.
    const modulesWithOutcomes = myActiveModules.filter(m => {
        const brief = bag.briefs.find(b => b.moduleCode === m.code);
        return !!brief && brief.learningOutcomes && brief.learningOutcomes.length > 0;
    }).length;
    const modulesWithAlignedBriefs = myActiveModules.filter(m => hasQualityBrief(m.code, bag.briefs)).length;

    // 4-7. Weekly feedback session compliance (Phase 1).
    const feedbackCompliance = await calculateFeedbackCompliance(bag.feedbackSessions, bag.users, bag.curriculum);
    const myCompliance = feedbackCompliance.byTutor.find(row => row.id === tutorId);
    const mySessions = bag.feedbackSessions.filter(s => s.staffId === tutorId);
    const myRecords = bag.feedbackRecords.filter(r => mySessions.some(s => s.id === r.sessionId));
    const recordsEmailedToStudents = myRecords.filter(r => r.feedbackEmailSent).length;

    // 8. At-risk identified and actioned (Phase 2).
    const rolling = await calculateRollingAttendance(bag.attendance, bag.users, bag.curriculum);
    const myWatchlist = rolling.byStudentModule.filter(r => myModuleCodes.includes(r.moduleCode) && r.warningLevel !== 'On Track');
    const watchlistStudentIds = Array.from(new Set(myWatchlist.map(r => r.studentId)));
    const watchlistWithPlan = watchlistStudentIds.filter(id => bag.attendanceActionPlans.some(p => p.studentId === id)).length;

    // 9-10. Attendance recording completeness and the >=75% threshold (Phase 2).
    const recording = attendanceRecordingRate(myModuleCodes, bag);
    const myStudentModuleRows = rolling.byStudentModule.filter(r => myModuleCodes.includes(r.moduleCode) && r.totalSessions > 0);
    const studentsAboveThreshold = myStudentModuleRows.filter(r => r.warningLevel !== 'Critical').length;

    // 11. Industry engagement (Phase 4).
    const industryCoverage = await calculateIndustryEngagementCoverage(bag.industryEngagements, myActiveModules, bag.currentSemesterType);

    // 12-14. Grade bands, using the existing GRADE_RANGES convention from TutorDashboard.tsx
    // (Poor: 0-39) to define "pass" as >=40, rather than inventing a new cutoff.
    const grades = gradesForModules(myModuleCodes, bag);
    const passCount = grades.filter(g => g >= 40).length;
    const above60Count = grades.filter(g => g >= 60).length;
    const above80Count = grades.filter(g => g >= 80).length;

    return [
        makeKpi('tutor-timely-delivery', 'Timely Delivery', timelyDeliveryActual, 100, 'percent', period, myLessonTracking.length > 0),
        makeKpi('tutor-outcomes-defined', 'Learning Outcomes Defined', pct(modulesWithOutcomes, myActiveModules.length), 100, 'percent', period, myActiveModules.length > 0),
        makeKpi('tutor-briefs-aligned', 'Briefs Aligned to Outcomes', pct(modulesWithAlignedBriefs, myActiveModules.length), 100, 'percent', period, myActiveModules.length > 0),
        makeKpi('tutor-weekly-feedback', 'Dedicated Weekly Feedback per Module', myCompliance?.conductedPercent ?? 0, 100, 'percent', period, !!myCompliance),
        makeKpi('tutor-feedback-documented', 'Feedback Documented', myCompliance?.documentedPercent ?? 0, 100, 'percent', period, !!myCompliance),
        makeKpi('tutor-feedback-reaching-students', 'Documented Feedback Reaching Students', pct(recordsEmailedToStudents, myRecords.length), 100, 'percent', period, myRecords.length > 0),
        makeKpi('tutor-feedback-emails-sent', 'Feedback Emails Sent', myCompliance?.emailedPercent ?? 0, 100, 'percent', period, !!myCompliance),
        makeKpi('tutor-at-risk-actioned', 'At-Risk Students Identified & Actioned', pct(watchlistWithPlan, watchlistStudentIds.length), 100, 'percent', period, watchlistStudentIds.length > 0),
        makeKpi('tutor-attendance-recording', 'Daily Attendance Recording', recording.actual, 100, 'percent', period, recording.hasData),
        makeKpi('tutor-attendance-threshold', 'Students at or Above 75% Attendance', pct(studentsAboveThreshold, myStudentModuleRows.length), 100, 'percent', period, myStudentModuleRows.length > 0),
        makeKpi('tutor-industry-experts', '>=2 Industry Experts per Module', industryCoverage.overall.actual, 100, 'percent', period, myActiveModules.length > 0),
        makeKpi('tutor-pass-rate', '100% Pass', pct(passCount, grades.length), 100, 'percent', period, grades.length > 0),
        makeKpi('tutor-above-60', '>=50% Students Above 60%', pct(above60Count, grades.length), 50, 'percent', period, grades.length > 0),
        makeKpi('tutor-above-80', '>=20% Students Above 80%', pct(above80Count, grades.length), 20, 'percent', period, grades.length > 0),
        // No entity anywhere in this codebase tracks HOD status-report submissions or a
        // student discussion/posting feature — returning No Data honestly rather than a
        // fabricated number. See KPI_IMPLEMENTATION.md for what would need to be built.
        makeKpi('tutor-weekly-report-hod', 'Weekly Report to HOD', 0, 100, 'percent', period, false),
        makeKpi('tutor-student-posts', '>=25% Students Posting >=10 Module Posts', 0, 25, 'percent', period, false),
    ];
};

const departmentStudentsFor = (deptModules: Module[], users: User[]): User[] => {
    const deptProgramsNorm: string[] = Array.from(new Set(deptModules.map(m => normalizeProgram(m.programTitle))));
    return users.filter(u => u.role === Role.Student && deptProgramsNorm.some(dp => normalizeProgram(u.programId).includes(dp) || dp.includes(normalizeProgram(u.programId))));
};

// HOD — 11 HOD-only KPIs (the task's phrasing gave these as a comma-separated list of
// category phrases plus "the same tutor KPIs for modules they personally teach", totaling
// 27; the 16 tutor KPIs are calculateModuleTutorKpis called with the HOD's own id — kept as
// a visually separate "As Module Tutor" section in the UI per the task's explicit
// instruction that the two must not overwrite each other):
// departmental quality control; RVJ quality audit; daily attendance monitoring; industry and
// alumni engagement; cross-department collaboration; SDG projects; award pipeline;
// entrepreneurial assessment; portfolio reviews; placement readiness; social media.
export const calculateHodOnlyKpis = async (hodId: string, bag: KraDataBag): Promise<KpiResult[]> => {
    await simulateNetworkDelay();
    const period = `${bag.currentSemesterType} Semester`;

    const deptKeys = getHodDepartments(hodId);
    const deptModules = deptKeys.length > 0 ? bag.curriculum.filter(m => isModuleInDepartments(m, deptKeys)) : bag.curriculum;
    const deptActiveModules = activeModulesFor(deptModules, bag.currentSemesterType);
    const deptModuleCodes = deptModules.map(m => m.code);
    const deptStudents = departmentStudentsFor(deptModules, bag.users);
    const deptStudentIds = new Set(deptStudents.map(s => s.id));

    const modulesWithQualityBrief = deptActiveModules.filter(m => hasQualityBrief(m.code, bag.briefs)).length;

    const deptRvj = bag.rvjAssessments.filter(r => deptStudentIds.has(r.studentId));
    const rvjAudited = deptRvj.filter(r => r.auditedByHod).length;

    const recording = attendanceRecordingRate(deptModuleCodes, bag);

    const industryCoverage = await calculateIndustryEngagementCoverage(bag.industryEngagements, deptActiveModules, bag.currentSemesterType);

    const deptProjects = bag.finalYearProjects.filter(p => deptStudentIds.has(p.studentId));
    const crossDeptCount = deptProjects.filter(p => p.crossDepartmentCollaboration).length;
    const sdgCount = deptProjects.filter(p => p.sdgLinkage && p.sdgLinkage.trim().length > 0).length;
    const entrepreneurialCount = deptProjects.filter(p => p.entrepreneurialPotential === 'Medium' || p.entrepreneurialPotential === 'High').length;

    const awardStatus = await calculateAwardPipelineStatus(deptProjects);
    const deptAwardMet = awardStatus.byDepartment.some(d => d.metTarget);

    // Portfolio review denominator is students staff have actually started tracking (via a
    // FinalYearProject or PlacementReadinessStatus record) — same reasoning as Phase 4's
    // placement KPI: there's no reliable "final year" auto-detection to fall back on.
    const deptPlacement = bag.placementReadiness.filter(p => deptStudentIds.has(p.studentId));
    const trackedFinalYearIds = new Set<string>([...deptProjects.map(p => p.studentId), ...deptPlacement.map(p => p.studentId)]);
    const deptReviews = bag.portfolioReviews.filter(r => deptStudentIds.has(r.studentId));
    const reviewedStudentIds = new Set(deptReviews.map(r => r.studentId));
    const trackedWithReview = Array.from(trackedFinalYearIds).filter(id => reviewedStudentIds.has(id)).length;

    const placementKpi = await calculatePlacementReadinessRate(deptPlacement);

    return [
        makeKpi('hod-quality-control', 'Departmental Quality Control', pct(modulesWithQualityBrief, deptActiveModules.length), 100, 'percent', period, deptActiveModules.length > 0),
        makeKpi('hod-rvj-audit', 'RVJ Quality Audit', pct(rvjAudited, deptRvj.length), 100, 'percent', period, deptRvj.length > 0),
        makeKpi('hod-attendance-monitoring', 'Daily Attendance Monitoring', recording.actual, 100, 'percent', period, recording.hasData),
        makeKpi('hod-industry-alumni', 'Industry & Alumni Engagement', industryCoverage.overall.actual, 100, 'percent', period, deptActiveModules.length > 0),
        // Informal targets below (20-30%) are my own reasonable defaults, not numbers given
        // by the task — flagged here for HOD/DRAO to replace with real institutional ones.
        makeKpi('hod-cross-dept', 'Cross-Department Collaboration', pct(crossDeptCount, deptProjects.length), 20, 'percent', period, deptProjects.length > 0),
        makeKpi('hod-sdg-projects', 'SDG / Social-Impact Projects', pct(sdgCount, deptProjects.length), 20, 'percent', period, deptProjects.length > 0),
        makeKpi('hod-award-pipeline', 'Award Pipeline (>=1 Submitted Externally)', deptAwardMet ? 100 : 0, 100, 'percent', period, deptProjects.length > 0),
        makeKpi('hod-entrepreneurial', 'Entrepreneurial Potential Identified', pct(entrepreneurialCount, deptProjects.length), 30, 'percent', period, deptProjects.length > 0),
        makeKpi('hod-portfolio-reviews', 'Portfolio Reviews (Tracked Final-Year Students)', pct(trackedWithReview, trackedFinalYearIds.size), 100, 'percent', period, trackedFinalYearIds.size > 0),
        rekey(placementKpi, 'hod-placement-readiness'),
        // No social-media tracking entity exists anywhere in this codebase.
        makeKpi('hod-social-media', 'Social Media Engagement', 0, 100, 'percent', period, false),
    ];
};

// Vice Principal — 19 KPIs. The task gave these as 6 category phrases (attendance
// oversight; bi-monthly cycle completion; action-point closure >=90%; satisfaction
// improvement; quality audits; HOD accountability; placement oversight) plus a total count
// of 19, not 19 named items — the breakdown below is my own decomposition, flagged here and
// in KPI_IMPLEMENTATION.md for VP/DRAO review rather than presented as given.
export const calculateVicePrincipalKpis = async (bag: KraDataBag): Promise<KpiResult[]> => {
    await simulateNetworkDelay();
    const period = `${bag.currentSemesterType} Semester`;

    // --- Attendance oversight (3) ---
    const rolling = await calculateRollingAttendance(bag.attendance, bag.users, bag.curriculum);
    const trackedStudents = rolling.byStudentBatch.filter(r => r.totalSessions > 0);
    const campusAvgAttendance = trackedStudents.length > 0 ? trackedStudents.reduce((s, r) => s + r.percent, 0) / trackedStudents.length : 0;
    const studentsNotCritical = trackedStudents.filter(r => r.warningLevel !== 'Critical').length;
    const resolvedAlerts = bag.systemicAttendanceAlerts.filter(a => a.status === 'Resolved').length;

    // --- Bi-monthly cycle completion (3) ---
    const sortedCycles = [...bag.feedbackCycles].sort((a, b) => b.startDate.localeCompare(a.startDate));
    const latestCycle = sortedCycles[0];
    const latestCycleSurveys = latestCycle ? bag.surveys.filter(s => s.cycleId === latestCycle.id) : [];
    const totalStudents = bag.users.filter(u => u.role === Role.Student).length;
    const respondingStudents = new Set(latestCycleSurveys.map(s => s.studentId)).size;
    const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cyclesLast12Months = bag.feedbackCycles.filter(c => new Date(c.startDate) >= oneYearAgo).length;

    const hodDeptKeys = Array.from(new Set(bag.users.filter(u => u.role === Role.HOD).flatMap(u => getHodDepartments(u.id))));
    const deptsRepresented = hodDeptKeys.filter(key => {
        const deptModuleCodes = bag.curriculum.filter(m => isModuleInDepartments(m, [key])).map(m => m.code);
        return latestCycleSurveys.some(s => deptModuleCodes.includes(s.moduleCode));
    }).length;

    // --- Action-point closure (2) ---
    const closureKpi = await calculateActionPointClosureRate(bag.actionPoints);
    const notEscalated = bag.actionPoints.filter(p => p.status !== 'Escalated').length;

    // --- Satisfaction improvement (2) ---
    const priorCycle = sortedCycles[1];
    const priorCycleSurveys = priorCycle ? bag.surveys.filter(s => s.cycleId === priorCycle.id) : [];
    const avgRating = (surveys: SurveyResponse[]) => surveys.length > 0 ? surveys.reduce((s, r) => s + r.rating, 0) / surveys.length : 0;
    const latestAvg = avgRating(latestCycleSurveys);
    const priorAvg = avgRating(priorCycleSurveys);
    const hasTwoCycles = latestCycleSurveys.length > 0 && priorCycleSurveys.length > 0;

    const categoryTrends = await calculateCycleTrends(bag.surveys, bag.feedbackCycles, bag.curriculum, bag.allocations, bag.users, 'category');
    const categoriesImproving = categoryTrends.filter(series => {
        const points = series.points.filter(p => p.cycleId === latestCycle?.id || p.cycleId === priorCycle?.id);
        const latest = points.find(p => p.cycleId === latestCycle?.id);
        const prior = points.find(p => p.cycleId === priorCycle?.id);
        return latest && prior && latest.averageRating >= prior.averageRating;
    }).length;
    const categoriesWithBothCycles = categoryTrends.filter(series =>
        series.points.some(p => p.cycleId === latestCycle?.id) && series.points.some(p => p.cycleId === priorCycle?.id)
    ).length;

    // --- Quality audits (3) ---
    const rvjAudited = bag.rvjAssessments.filter(r => r.auditedByHod || r.auditedByVp).length;

    const trackedFinalYearIdsCampus = new Set<string>([...bag.finalYearProjects.map(p => p.studentId), ...bag.placementReadiness.map(p => p.studentId)]);
    const reviewedIdsCampus = new Set(bag.portfolioReviews.map(r => r.studentId));
    const trackedWithReviewCampus = Array.from(trackedFinalYearIdsCampus).filter(id => reviewedIdsCampus.has(id)).length;

    const feedbackCompliance = await calculateFeedbackCompliance(bag.feedbackSessions, bag.users, bag.curriculum);
    const totalSessionsConducted = feedbackCompliance.byTutor.reduce((s, r) => s + r.sessionsConducted, 0);
    const totalSessionsDocumented = feedbackCompliance.byTutor.reduce((s, r) => s + r.sessionsDocumented, 0);

    // --- HOD accountability (3) ---
    const hodIds = new Set(bag.users.filter(u => u.role === Role.HOD).map(u => u.id));
    const hodAuditRows = feedbackCompliance.byTutor.filter(row => hodIds.has(row.id));
    const hodAvgConducted = hodAuditRows.length > 0 ? hodAuditRows.reduce((s, r) => s + r.conductedPercent, 0) / hodAuditRows.length : 0;

    const hodTaughtModuleCodes = bag.allocations.filter(a => hodIds.has(a.tutorId)).map(a => a.moduleCode);
    const hodTaughtRows = rolling.byStudentModule.filter(r => hodTaughtModuleCodes.includes(r.moduleCode) && r.totalSessions > 0);
    const hodTaughtNotCritical = hodTaughtRows.filter(r => r.warningLevel !== 'Critical').length;

    const teachingHods = Array.from(hodIds).filter(id => bag.allocations.some(a => a.tutorId === id));
    const hodsHittingOwnTarget = teachingHods.filter(id => {
        const row = feedbackCompliance.byTutor.find(r => r.id === id);
        return row && row.conductedPercent >= 100;
    }).length;

    // --- Placement oversight (3) ---
    const placementKpi = await calculatePlacementReadinessRate(bag.placementReadiness);
    const awardStatus = await calculateAwardPipelineStatus(bag.finalYearProjects);
    const deptsMeetingAwardTarget = awardStatus.byDepartment.filter(d => d.metTarget).length;

    return [
        makeKpi('vp-campus-attendance', 'Campus-Wide Attendance', campusAvgAttendance, 85, 'percent', period, trackedStudents.length > 0),
        makeKpi('vp-attendance-above-critical', 'Students at or Above Critical Attendance', pct(studentsNotCritical, trackedStudents.length), 100, 'percent', period, trackedStudents.length > 0),
        makeKpi('vp-systemic-alerts-resolved', 'Systemic Attendance Alerts Resolved', pct(resolvedAlerts, bag.systemicAttendanceAlerts.length), 100, 'percent', period, bag.systemicAttendanceAlerts.length > 0),
        makeKpi('vp-cycle-response-coverage', 'Latest Cycle Response Coverage', pct(respondingStudents, totalStudents), 100, 'percent', period, !!latestCycle && totalStudents > 0),
        // Bi-monthly = 6 cycles/year — a direct reading of "bi-monthly", not a number stated
        // separately in the task.
        makeKpi('vp-cycle-cadence', 'Feedback Cycles Opened (Last 12 Months)', cyclesLast12Months, 6, 'count', period, bag.feedbackCycles.length > 0),
        makeKpi('vp-dept-representation', 'Departments Represented in Latest Cycle', pct(deptsRepresented, hodDeptKeys.length), 100, 'percent', period, !!latestCycle && hodDeptKeys.length > 0),
        rekey(closureKpi, 'vp-action-closure'),
        makeKpi('vp-action-not-escalated', 'Action Points Not Escalated', pct(notEscalated, bag.actionPoints.length), 100, 'percent', period, bag.actionPoints.length > 0),
        makeKpi('vp-satisfaction-trend', 'Satisfaction Trend (Latest vs. Prior Cycle)', latestAvg, priorAvg, 'rating', period, hasTwoCycles),
        makeKpi('vp-categories-improving', 'Feedback Categories Improving Cycle-on-Cycle', pct(categoriesImproving, categoriesWithBothCycles), 100, 'percent', period, categoriesWithBothCycles > 0),
        makeKpi('vp-rvj-audit-coverage', 'RVJ Audit Coverage (Campus)', pct(rvjAudited, bag.rvjAssessments.length), 100, 'percent', period, bag.rvjAssessments.length > 0),
        makeKpi('vp-portfolio-review-coverage', 'Portfolio Review Coverage (Campus)', pct(trackedWithReviewCampus, trackedFinalYearIdsCampus.size), 100, 'percent', period, trackedFinalYearIdsCampus.size > 0),
        makeKpi('vp-feedback-doc-compliance', 'Weekly Feedback Documentation Compliance (Campus)', pct(totalSessionsDocumented, totalSessionsConducted), 100, 'percent', period, totalSessionsConducted > 0),
        makeKpi('vp-hod-feedback-compliance', 'HOD-Taught Module Feedback Compliance', hodAvgConducted, 100, 'percent', period, hodAuditRows.length > 0),
        makeKpi('vp-hod-attendance', 'HOD-Taught Module Attendance >=75%', pct(hodTaughtNotCritical, hodTaughtRows.length), 100, 'percent', period, hodTaughtRows.length > 0),
        makeKpi('vp-hods-meeting-own-target', 'HODs Meeting Their Own Tutor-Standard Target', pct(hodsHittingOwnTarget, teachingHods.length), 100, 'percent', period, teachingHods.length > 0),
        rekey(placementKpi, 'vp-placement-oversight'),
        rekey(awardStatus.mentoringKpi, 'vp-award-mentoring'),
        makeKpi('vp-dept-award-target', 'Departments Meeting Award Submission Target', pct(deptsMeetingAwardTarget, awardStatus.byDepartment.length), 100, 'percent', period, awardStatus.byDepartment.length > 0),
    ];
};
