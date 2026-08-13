import { SurveyResponse, Module, User, TutorAllocation, FeedbackCycle, ActionPoint, KpiResult, IndustryEngagement, PlacementReadinessStatus, FinalYearProject } from './types';
import { CYCLE_FEEDBACK_QUESTIONS, CYCLE_FEEDBACK_CATEGORIES, normalizeProgram, INDUSTRY_ENGAGEMENT_COUNTED_STAGES, INDUSTRY_ENGAGEMENT_TARGET_PER_MODULE, AWARD_PIPELINE_MENTORING_TARGET } from './data';

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
