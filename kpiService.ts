import { SurveyResponse, Module, User, TutorAllocation, FeedbackCycle, ActionPoint, KpiResult } from './types';
import { CYCLE_FEEDBACK_QUESTIONS, CYCLE_FEEDBACK_CATEGORIES, normalizeProgram } from './data';

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
