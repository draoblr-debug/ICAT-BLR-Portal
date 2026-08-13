
import { SurveyResponse, Module, User, TutorAllocation, SemesterPlanEntry, LessonPlan, AIClassModule, Role, Holiday, LeaderboardEntry, AttendanceRecord, Submission, AssignmentBrief, ModuleFeedbackSession } from './types';
import { normalizeProgram, getHodDepartments, LIKERT_QUESTIONS } from './data';

// Simulates server-side delay for better UX flow
const simulateNetworkDelay = async () => new Promise(resolve => setTimeout(resolve, 100));

// --- Gamification Constants ---
const POINTS = {
    ATTENDANCE: 5,
    SUBMISSION_BRIEF: 10,
    SUBMISSION_CLASSWORK: 5,
    ON_TIME_BONUS: 5,
    MAX_GRADING: 20,
    SURVEY: 10,
    QUIZ_PARTICIPATION: 1, // Placeholder
    QUIZ_CORRECT: 2 // Placeholder
};

const RANKS = [
    { level: 1, title: "Novice" },
    { level: 3, title: "Apprentice" },
    { level: 5, title: "Specialist" },
    { level: 7, title: "Elite" },
    { level: 10, title: "Master" },
    { level: 99, title: "Legend" }
];

export const calculateGamificationLeaderboard = async (
    users: User[],
    attendance: AttendanceRecord[],
    submissions: Submission[],
    briefs: AssignmentBrief[],
    surveys: SurveyResponse[],
    semesterStartDate: string
): Promise<LeaderboardEntry[]> => {
    await simulateNetworkDelay();
    
    const students = users.filter(u => u.role === Role.Student);
    const leaderboard: LeaderboardEntry[] = [];
    const semesterStart = semesterStartDate ? new Date(semesterStartDate) : new Date();

    // Optimizing Lookups: Create Maps for O(1) access
    const attendanceMap = new Map<string, number>(); // studentId -> count
    attendance.forEach(record => {
        record.presentStudentIds.forEach(sid => {
            attendanceMap.set(sid, (attendanceMap.get(sid) || 0) + 1);
        });
    });

    const submissionMap = new Map<string, Submission[]>();
    submissions.forEach(sub => {
        if (!submissionMap.has(sub.studentId)) submissionMap.set(sub.studentId, []);
        submissionMap.get(sub.studentId)!.push(sub);
    });

    const surveyMap = new Map<string, number>(); // studentId -> count
    surveys.forEach(s => {
        surveyMap.set(s.studentId, (surveyMap.get(s.studentId) || 0) + 1);
    });

    const briefMap = new Map<string, AssignmentBrief>();
    briefs.forEach(b => briefMap.set(b.id, b));

    // Iterating Students (Scale: ~500)
    for (const student of students) {
        let attendancePoints = 0;
        let submissionPoints = 0;
        let gradingPoints = 0;
        let feedbackPoints = 0;
        let onTimeBonus = 0;
        let quizPoints = 0; // Future integration

        // 1. Attendance Scores
        const attendedSessions = attendanceMap.get(student.id) || 0;
        attendancePoints = attendedSessions * POINTS.ATTENDANCE;

        // 2. Submission Scores
        const studentSubs = submissionMap.get(student.id) || [];
        studentSubs.forEach(sub => {
            // Base Points
            if (sub.briefId) {
                submissionPoints += POINTS.SUBMISSION_BRIEF;
            } else {
                submissionPoints += POINTS.SUBMISSION_CLASSWORK;
            }

            // Grading Points
            if (sub.grade && sub.grade.numericScore !== undefined) {
                // Scale: 100% = 20pts
                gradingPoints += Math.round((sub.grade.numericScore / 100) * POINTS.MAX_GRADING);
            } else if (sub.grade && sub.grade.finalGrade) {
                // Legacy fallback
                const grade = sub.grade.finalGrade.charAt(0);
                if (grade === 'A') gradingPoints += 20;
                else if (grade === 'B') gradingPoints += 15;
                else if (grade === 'C') gradingPoints += 10;
                else gradingPoints += 5;
            }

            // On-Time Bonus Check
            if (sub.briefId && sub.deliverableId) {
                const brief = briefMap.get(sub.briefId);
                if (brief) {
                    const deliverable = brief.deliverables.find(d => d.id === sub.deliverableId);
                    if (deliverable) {
                        // Calculate due date based on week number
                        const dueDate = new Date(semesterStart);
                        dueDate.setDate(dueDate.getDate() + ((deliverable.weekNumber - 1) * 7) + 5); // Assume due Friday of the week
                        // End of day
                        dueDate.setHours(23, 59, 59);
                        
                        if (sub.submittedAt <= dueDate.getTime()) {
                            onTimeBonus += POINTS.ON_TIME_BONUS;
                        }
                    }
                }
            }
        });

        // 3. Survey Scores
        const feedbackCount = surveyMap.get(student.id) || 0;
        feedbackPoints = feedbackCount * POINTS.SURVEY;

        const totalPoints = attendancePoints + submissionPoints + gradingPoints + feedbackPoints + onTimeBonus + quizPoints;

        // Level Calc
        const level = Math.floor(totalPoints / 800);
        const rankObj = RANKS.slice().reverse().find(r => level >= r.level) || RANKS[0];
        const currentLevelProgress = Math.round(((totalPoints % 800) / 800) * 100);

        leaderboard.push({
            studentId: student.id,
            studentName: student.name,
            program: student.programId,
            totalPoints,
            rank: 0, // Placeholder, set after sort
            breakdown: {
                attendancePoints,
                submissionPoints,
                gradingPoints,
                feedbackPoints,
                onTimeBonus,
                quizPoints
            },
            lastUpdated: Date.now(),
            level: level || 1,
            rankTitle: rankObj.title,
            currentLevelProgress
        });
    }

    // Ranking Logic
    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
    leaderboard.forEach((entry, idx) => {
        entry.rank = idx + 1;
    });

    return leaderboard;
};

// ... Existing exports ...
export const calculateModulePerformance = async (
    surveys: SurveyResponse[],
    curriculum: Module[]
) => {
    await simulateNetworkDelay();
    const stats: Record<string, { total: number, count: number, name: string }> = {};
    
    surveys.forEach(s => {
      if (!stats[s.moduleCode]) stats[s.moduleCode] = { total: 0, count: 0, name: s.moduleCode };
      stats[s.moduleCode].total += s.rating;
      stats[s.moduleCode].count += 1;
    });

    return Object.entries(stats).map(([code, data]) => {
      const mod = curriculum.find(m => m.code === code);
      return {
        code,
        name: mod ? mod.title.substring(0, 15) + '...' : code,
        fullName: mod ? mod.title : code,
        avg: parseFloat((data.total / data.count).toFixed(1)),
        responses: data.count
      };
    }).sort((a, b) => b.avg - a.avg);
};

export const calculateDetailedAnalysis = async (
    moduleCode: string | null,
    surveys: SurveyResponse[]
) => {
    if (!moduleCode) return [];
    await simulateNetworkDelay();

    const modSurveys = surveys.filter(s => s.moduleCode === moduleCode);
    if (modSurveys.length === 0) return [];

    const questionTotals = new Array(LIKERT_QUESTIONS.length).fill(0);
    let validCount = 0;

    modSurveys.forEach(s => {
        if (s.detailedRatings && s.detailedRatings.length === LIKERT_QUESTIONS.length) {
            s.detailedRatings.forEach((rating, idx) => {
                questionTotals[idx] += rating;
            });
            validCount++;
        }
    });

    if (validCount === 0) return [];

    return LIKERT_QUESTIONS.map((q, idx) => ({
        subject: q.length > 20 ? q.substring(0, 20) + '...' : q,
        fullQuestion: q,
        A: parseFloat((questionTotals[idx] / validCount).toFixed(1)),
        fullMark: 5
    }));
};

export const calculateDepartmentPerformance = async (
    users: User[],
    curriculum: Module[],
    currentSemesterType: 'Odd' | 'Even',
    semesterPlans: SemesterPlanEntry[],
    allocations: TutorAllocation[]
) => {
    await simulateNetworkDelay();
    
    const hods = users.filter(u => u.role === Role.HOD || (u.role === Role.EducationManager && getHodDepartments(u.id).length > 0));
    
    return hods.map(hod => {
        const myDepts = getHodDepartments(hod.id); 
        const displayDept = myDepts.map(d => d).join(', ');
        
        const deptModules = curriculum.filter(m => {
            const isOdd = m.sem % 2 !== 0;
            const semesterMatch = currentSemesterType === 'Odd' ? isOdd : !isOdd;
            if (!semesterMatch) return false;
            
            const normProgram = normalizeProgram(m.programTitle);
            if (myDepts.includes('foundation') && normProgram.includes('visualarts')) return true;
            if (myDepts.includes('game') && normProgram.includes('animation')) return false; 
            return myDepts.some(deptKey => normProgram.includes(deptKey));
        });

        const batches = new Set<string>();
        deptModules.forEach(m => batches.add(`${m.programTitle}::${m.year}`));
        const totalBatches = batches.size;
        
        let plannedBatches = 0;
        batches.forEach(b => {
            const [prog, yearStr] = b.split('::');
            const hasPlan = semesterPlans.some(p => p.programId === prog && p.year === parseInt(yearStr));
            if (hasPlan) plannedBatches++;
        });

        const totalModules = deptModules.length;
        const allocatedTutors = deptModules.filter(m => allocations.some(a => a.moduleCode === m.code && a.tutorId)).length;
        const allocatedRooms = deptModules.filter(m => allocations.some(a => a.moduleCode === m.code && a.roomId)).length;

        return {
            hod,
            departments: displayDept,
            totalModules,
            totalBatches,
            plannedBatches,
            planningProgress: totalBatches > 0 ? Math.round((plannedBatches / totalBatches) * 100) : 0,
            allocatedTutors,
            tutorAllocProgress: totalModules > 0 ? Math.round((allocatedTutors / totalModules) * 100) : 0,
            allocatedRooms,
            roomAllocProgress: totalModules > 0 ? Math.round((allocatedRooms / totalModules) * 100) : 0
        };
    }).sort((a, b) => a.planningProgress - b.planningProgress);
};

export const calculateLessonTracking = async (
    semesterStartDate: string,
    curriculum: Module[],
    currentSemesterType: 'Odd' | 'Even',
    allocations: TutorAllocation[],
    users: User[],
    semesterPlans: SemesterPlanEntry[],
    lessonPlans: LessonPlan[],
    aiModules: AIClassModule[],
    holidays: Holiday[]
) => {
    await simulateNetworkDelay();
    if (!semesterStartDate) return [];

    const activeCoreModules = curriculum.filter(m => {
        const isOdd = m.sem % 2 !== 0;
        const semesterMatch = currentSemesterType === 'Odd' ? isOdd : !isOdd;
        return m.type === 'Core' && semesterMatch;
    });

    const start = new Date(semesterStartDate);

    return activeCoreModules.map(module => {
        const allocation = allocations.find(a => a.moduleCode === module.code);
        const tutor = users.find(u => u.id === allocation?.tutorId);
        const normModProg = normalizeProgram(module.programTitle);
        
        const rawPlans = semesterPlans.filter(p => p.moduleCode === module.code && normalizeProgram(p.programId) === normModProg && p.year === module.year);
        
        let expandedSessions: any[] = [];
        if (rawPlans.length > 0) {
            const validDates: any[] = [];
            rawPlans.forEach(plan => {
                const weekStart = new Date(start);
                weekStart.setDate(start.getDate() + ((Number(plan.weekNumber) || 1) - 1) * 7);
                for (let d = 0; d < 5; d++) {
                    const currentDay = new Date(weekStart);
                    currentDay.setDate(weekStart.getDate() + d);
                    const dateStr = currentDay.toISOString().split('T')[0];
                    if (!holidays.some(h => h.date === dateStr)) validDates.push({ date: currentDay, plan });
                }
            });
            expandedSessions = validDates.map((item, i) => ({ date: item.date, seq: i + 1, plan: item.plan }));
        }

        const totalSessions = expandedSessions.length;
        let sessionsChunked = 0;
        let contentReadyChunks = 0;
        let totalActivities = 0;
        
        expandedSessions.forEach(session => {
            const plan = lessonPlans.find(lp => lp.moduleCode === module.code && lp.sequence === session.seq);
            if (plan && plan.chunks && plan.chunks.length > 0) {
                sessionsChunked++;
                totalActivities += plan.chunks.length;
                const ready = plan.chunks.filter(c => c.aiModuleId && aiModules.some(ai => ai.id === c.aiModuleId)).length;
                contentReadyChunks += ready;
            }
        });

        const chunkProgress = totalSessions > 0 ? Math.round((sessionsChunked / totalSessions) * 100) : 0;
        const contentProgress = totalActivities > 0 ? Math.round((contentReadyChunks / totalActivities) * 100) : 0;
        
        let statusLabel = 'Not Scheduled', statusColor = 'bg-gray-100 text-gray-600 border-gray-200';
        if (totalSessions > 0) {
            if (sessionsChunked === totalSessions) { statusLabel = 'Plan Complete'; statusColor = 'bg-green-100 text-green-700 border-green-200'; } 
            else if (sessionsChunked > 0) { statusLabel = 'Planning In Progress'; statusColor = 'bg-yellow-100 text-yellow-700 border-yellow-200'; } 
            else { statusLabel = 'Planning Pending'; statusColor = 'bg-red-50 text-red-600 border-red-100'; }
        }
        
        let contentStatusLabel = 'No Content', contentStatusColor = 'bg-gray-100 text-gray-400 border-gray-200';
        if (totalActivities > 0) {
            if (contentReadyChunks === totalActivities) { contentStatusLabel = 'Content Ready'; contentStatusColor = 'bg-green-100 text-green-700 border-green-200'; } 
            else if (contentReadyChunks > 0) { contentStatusLabel = 'Content Partial'; contentStatusColor = 'bg-yellow-100 text-yellow-700 border-yellow-200'; } 
            else { contentStatusLabel = 'Content Pending'; contentStatusColor = 'bg-red-50 text-red-600 border-red-100'; }
        }
        
        return { module, tutorName: tutor?.name || 'Unassigned', totalSessions, sessionsChunked, chunkProgress, contentProgress, contentReadyChunks, totalActivities, statusLabel, statusColor, contentStatusLabel, contentStatusColor };
    }).sort((a, b) => a.chunkProgress - b.chunkProgress);
};

// --- WEEKLY MODULE FEEDBACK COMPLIANCE (KRA/KPI Phase 1) ---

export interface FeedbackComplianceEntry {
    id: string;              // staffId or moduleCode
    label: string;           // display name
    totalSessions: number;
    sessionsConducted: number;
    sessionsDocumented: number;  // conducted AND documentationComplete
    emailsSent: number;          // conducted AND emailSent
    conductedPercent: number;    // sessionsConducted / totalSessions
    documentedPercent: number;   // sessionsDocumented / sessionsConducted (of the ones actually held)
    emailedPercent: number;      // emailsSent / sessionsConducted
}

export const calculateFeedbackCompliance = async (
    sessions: ModuleFeedbackSession[],
    users: User[],
    curriculum: Module[]
): Promise<{ byTutor: FeedbackComplianceEntry[]; byModule: FeedbackComplianceEntry[] }> => {
    await simulateNetworkDelay();

    const summarize = (keyFn: (s: ModuleFeedbackSession) => string, labelFor: (key: string) => string): FeedbackComplianceEntry[] => {
        const groups = new Map<string, ModuleFeedbackSession[]>();
        sessions.forEach(s => {
            const key = keyFn(s);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(s);
        });

        return Array.from(groups.entries()).map(([key, group]) => {
            const totalSessions = group.length;
            const sessionsConducted = group.filter(s => s.conducted).length;
            const sessionsDocumented = group.filter(s => s.conducted && s.documentationComplete).length;
            const emailsSent = group.filter(s => s.conducted && s.emailSent).length;
            return {
                id: key,
                label: labelFor(key),
                totalSessions,
                sessionsConducted,
                sessionsDocumented,
                emailsSent,
                conductedPercent: totalSessions > 0 ? Math.round((sessionsConducted / totalSessions) * 100) : 0,
                documentedPercent: sessionsConducted > 0 ? Math.round((sessionsDocumented / sessionsConducted) * 100) : 0,
                emailedPercent: sessionsConducted > 0 ? Math.round((emailsSent / sessionsConducted) * 100) : 0,
            };
        }).sort((a, b) => a.conductedPercent - b.conductedPercent);
    };

    const byTutor = summarize(
        s => s.staffId,
        (id) => users.find(u => u.id === id)?.name || id
    );
    const byModule = summarize(
        s => s.moduleCode,
        (code) => curriculum.find(m => m.code === code)?.title || code
    );

    return { byTutor, byModule };
};
