
// Note: the DRAO role already exists in this codebase as Role.EducationManager (see
// getHodDepartments in data.ts — 'BLR026' is commented "DRAO (Education Manager acting as
// HOD for Foundation)" — and ManagerDashboard.tsx is that role's dashboard). A separate
// Role.DRAO was not added on top of it to avoid two enum members representing the same
// real position; only VicePrincipal is genuinely new here.
export enum Role {
  Student = 'Student',
  Tutor = 'Tutor',
  HOD = 'HOD',
  EducationManager = 'Education Manager',
  StudentService = 'Student Service',
  SystemAdministrator = 'System Administrator',
  VicePrincipal = 'Vice Principal'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  programId: string;
  year?: number;
  password?: string;
  profilePicture?: string;
}

export interface Module {
  code: string;
  title: string;
  programTitle: string;
  year: number;
  sem: number;
  type: 'Core' | 'Non Core' | 'Elective';
  category?: string;
}

export interface TutorAllocation {
  id: string;
  moduleCode: string; 
  programId: string;
  tutorId: string;
  roomId?: string; 
}

export interface SemesterPlanEntry {
  id: string; 
  programId: string;
  year: number;
  weekNumber: number;
  sessionNumber: 1 | 2 | 3 | 4; 
  moduleCode: string;
  roomId?: string; 
}

export interface Room {
  id: string;
  number: string;
  name: string;
  capacity: number;
  floor: number;
  allocatedDepartment?: string;
}

export interface SurveyResponse {
  id: string;
  studentId: string;
  moduleCode: string;
  rating: number;
  feedback: string;
  timestamp: number;
  detailedRatings?: number[];
  semesterType?: 'Odd' | 'Even';
  // Bi-monthly feedback cycle this response belongs to (FeedbackCycle.id), added for
  // Phase 3. Legacy responses predating cycles have no cycleId and remain readable via
  // semesterType exactly as before — this field is additive, not a replacement.
  cycleId?: string;
}

export interface RubricLevel {
  grade: string;
  description: string;
}

export interface RubricCriteria {
  id: string;
  criteria: string;
  weightage: number;
  levels: RubricLevel[];
}

export interface Deliverable {
  id: string;
  title: string;
  type: 'Image' | 'Link' | 'Video' | 'PDF';
  weekNumber: number;
  deadline: string;
  rubric?: RubricCriteria[]; 
}

export interface AssignmentBrief {
  id: string;
  createdAt: number;
  moduleCode: string;
  tutorId: string;
  status: 'Draft' | 'Pending Approval' | 'Published' | 'Rejected';
  title: string;
  weeks: number;
  startDate?: string;
  learningOutcomes: string[];
  weeklySchedule: { weekNumber: number; topic: string; description: string; rubric?: RubricCriteria[] }[];
  finalDeliverableRequirements: string[];
  deliverables: Deliverable[];
  moduleDescriptor?: string;
  feedback?: string;
  coverImageUrl?: string; // New field for cover image
}

export interface Submission {
  id: string;
  briefId?: string;
  studentId: string;
  deliverableId?: string;
  moduleId?: string; // Linked to AIClassModule for Class Work
  type: 'Image' | 'Link' | 'Video' | 'PDF';
  content: string;
  submittedAt: number;
  grade?: {
      scores: Record<string, string>;
      feedback: string;
      finalGrade: string;
      numericScore?: number; // Added numeric score for cumulative calculation
      gradedBy: string;
      gradedAt: number;
  };
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  date: string;
  moduleCode: string;
  tutorId: string;
  presentStudentIds: string[];
  totalStudents: number;
  markedAt: number;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export type TimeSlot = '9-11' | '11-1' | '2-4' | '4-6';

export interface CustomEvent {
  id: string;
  date: string;
  slot: TimeSlot;
  title: string;
  createdBy: string;
  programId?: string;
  year?: number;
}

export interface SemesterConfig {
  activeType: 'Odd' | 'Even';
  oddStartDate: string;
  oddEndDate: string;
  evenStartDate: string;
  evenEndDate: string;
  feedbackOpen?: boolean;
  portalLogoUrl?: string;
  feedbackOpenOdd?: boolean;
  feedbackOpenEven?: boolean;
}

// --- GAMIFICATION TYPES ---

export interface GamificationBreakdown {
    attendancePoints: number;
    submissionPoints: number;
    gradingPoints: number;
    quizPoints: number;
    feedbackPoints: number;
    onTimeBonus: number;
}

export interface LeaderboardEntry {
    studentId: string;
    studentName: string;
    program: string;
    totalPoints: number;
    rank: number;
    breakdown: GamificationBreakdown;
    lastUpdated: number;
    level: number;
    rankTitle: string;
    currentLevelProgress: number;
}

// --- PEER REVIEW AI TYPES ---

export interface PeerReviewInput {
    reviewerId: string;
    scores: Record<string, number>; // criteriaId -> Numeric Score (0-100)
    feedbackText: string;
}

export interface PeerReviewSynthesisResult {
    consensus_summary: string;
    average_scores_by_criteria: Record<string, number>;
    synthesized_feedback: string;
}

export interface PeerReviewQualityResult {
    review_quality_score: number; // 1-10
    feedback_specificity_rating: 'High' | 'Medium' | 'Low';
    criteria_alignment_notes: string;
    summary_for_tutor: string;
}

// --- AI SMART CLASS TYPES ---

export interface AISlideV2 {
    id: string;
    title: string;
    onScreen: {
        headline: string;
        bullets: string[];
        summary: string;
    };
    speakerNotes: string;
    visualKeyword: string;
    durationSeconds: number;
    captionText?: string;
    showOnProjector: boolean;
}

export interface AIQuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
    exposeToStudent: boolean;
}

export interface AIQuizV2 {
    quizId: string;
    numQuestions: number;
    durationPerQuestionSeconds: number;
    totalDurationSeconds: number;
    questions: AIQuizQuestion[];
    scoring: {
        basePointsPerQuestion: number;
        timeBonusFormula: string;
        example: string;
    };
    joinCode: string;
    tutorControls: {
        startQuiz: boolean;
        forceEnd: boolean;
        revealAnswers: boolean;
    };
}

export type QuizDifficulty = 'Basic' | 'Intermediate' | 'Tough';

// Legacy support for v1
export interface AISlide {
    id: string;
    title: string;
    bulletPoints: string[];
    speakerNotes: string;
    visualKeyword: string;
}

export interface AIClassModule {
    id: string;
    topic: string;
    moduleCode?: string;
    createdAt: number;
    tutorId: string;
    
    // V1 Structure (Legacy/Fallback)
    slides: AISlide[]; 
    preQuiz: AIQuizQuestion[];
    postQuiz: AIQuizQuestion[];
    notes: string;
    quizConfig: {
        pre: QuizDifficulty;
        post: QuizDifficulty;
    };

    // V2 Structure (Rich Content)
    generatedContent?: {
        activity: string; // Lecture, Quiz, etc.
        estimatedTotalDurationSeconds: number;
        slides?: AISlideV2[];
        quiz?: AIQuizV2;
        interaction?: any; // Placeholder for other types
        demo?: any;
        screening?: any;
        tutorControls?: any;
        studentJoin?: any;
        notes?: string;
    };
}

// --- LESSON PLANNER TYPES ---

export type LessonActivityType = 'Lecture' | 'Quiz' | 'Interaction' | 'Demo' | 'Screening' | 'Group Discussion' | 'Class Work' | 'Break';
export type ModuleType = 'Theory' | 'Software Training' | 'Art Workshop' | 'Project' | 'Hybrid';

export interface LessonChunk {
    id: string;
    duration: number; // minutes (10-15 typically)
    activity: LessonActivityType;
    content: string;
    objective: string; 
    aiModuleId?: string; // Link to Smart Class content
}

export interface LessonEfficiency {
    cognitiveLoad: number; // 1-10 
    interactivityLevel: number; // 1-10
    goalAlignment: number; // 1-10
    notes: string;
}

export interface ModuleContext {
    type: ModuleType;
    taughtHours: number;
    gilHours: number;
    customPrompt: string;
}

export interface LessonPlan {
    id: string;
    moduleCode: string;
    tutorId: string;
    sequence: number; // Session Sequence (1, 2, 3...)
    date?: string; // Optional override or cache
    sessionId?: string; 
    topic: string;
    chunks: LessonChunk[];
    efficiency: LessonEfficiency;
    createdAt: number;
    moduleContext?: ModuleContext; // Persist syllabus settings here
    status?: 'Draft' | 'Published'; // Added status for student visibility
}

export interface ModuleSyllabus {
    id: string; // moduleCode
    moduleCode: string;
    syllabusText: string;
    config: ModuleContext;
    lastUpdated: number;
}

// --- LEARNING STYLE TYPES ---
export type LearningStyleKey = 'Visual' | 'Auditory' | 'ReadWrite' | 'Kinesthetic';

// --- WEEKLY MODULE FEEDBACK (KRA/KPI Phase 1) ---
// Institutional rule: every module gets its OWN dedicated 60-minute weekly feedback
// session, for both Module Tutors and HODs teaching their own modules. Never a
// combined session covering several modules.

export interface ModuleFeedbackSession {
  id: string;
  moduleCode: string;
  batch: string;            // e.g. "BVA ANM IV"
  staffId: string;          // tutor OR hod — both use this field
  scheduledDay: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday';
  scheduledTime: string;    // "16:00-17:00"
  weekNumber: number;
  conducted: boolean;
  conductedAt?: number;
  documentationComplete: boolean;
  // Session-level review checklist — see SESSION_CHECKLIST_ITEMS in data.ts for the
  // canonical 14 points. Keyed by checklist item id.
  checklist: Record<string, boolean>;
  emailSent: boolean;       // manual confirmation — dispatch is not automated, see WeeklyFeedback.tsx
  emailSentAt?: number;
  notes?: string;
}

// Score for one weekly-milestone rubric criterion (AssignmentBrief.weeklySchedule[].rubric).
// criteriaId/criteria are snapshotted at scoring time so historical records stay readable
// even if a tutor edits the brief's rubric text later.
export interface FeedbackRubricScore {
  criteriaId: string;
  criteria: string;
  grade: string;   // one of that criterion's RubricLevel.grade values (e.g. 'Excellent'..'Poor')
  notes?: string;
}

export interface FeedbackActionPoint {
  id: string;
  description: string;
  deadline: string;   // ISO date
  completed: boolean;
  completedAt?: number;
}

export interface FeedbackRecord {   // one per student, per module, per week
  id: string;
  sessionId: string;
  studentId: string;
  moduleCode: string;
  batch: string;
  weekNumber: number;
  currentBriefStage: string;
  learningOutcomeAddressed: string;
  // Scored against the SAME rubric attached to that week's milestone in the brief
  // (AssignmentBrief.weeklySchedule[weekNumber].rubric). Empty if that week has no rubric yet.
  rubricScores: FeedbackRubricScore[];
  feedbackGiven: string;
  areasForImprovement: string;
  designDecisionsDiscussed: string;
  rvjObservations: string;
  actionPoints: FeedbackActionPoint[];
  deadline: string;              // ISO date — earliest outstanding action point, for quick sorting/display
  interventionRequired: boolean;
  feedbackEmailSent: boolean;
  feedbackEmailDate?: string;    // ISO date
  markedAt: number;
}

// Reflective Visual Journal — per-student, per-module quality assessment.
// Graded on the same Excellent/Very Good/Good/Average/Poor scale as RubricLevel,
// so it reads consistently alongside weekly rubric scores. Auditable by HOD and VP
// via the auditedBy* flags rather than a separate audit log.
export interface RvjAssessment {
  id: string;
  studentId: string;
  moduleCode: string;
  batch: string;
  weekNumber: number;
  assessedBy: string;   // staffId
  assessedAt: number;
  dimensions: {
    researchEvidence: string;
    theoreticalDeconstruction: string;
    masterPractitionerAnalysis: string;
    designThinking: string;
    ideation: string;
    multipleSolutions: string;
    experimentation: string;
    evaluation: string;
    iteration: string;
    feedbackIncorporation: string;
    designDecisionRationale: string;
    targetAudienceRelationship: string;
    evolutionOfFinalDesign: string;
  };
  overallNotes: string;
  auditedByHod?: boolean;
  auditedByHodAt?: number;
  auditedByVp?: boolean;
  auditedByVpAt?: number;
}

// --- ATTENDANCE EARLY WARNING & INTERVENTION (KRA/KPI Phase 2) ---
// IMPORTANT: the thresholds behind AttendanceWarningLevel (see ATTENDANCE_THRESHOLDS in
// data.ts) are ICAT-internal early-warning levels used to trigger watchlists and recovery
// plans. They are NOT university/statutory attendance-eligibility rules — do not present
// them as such in any UI copy.
export type AttendanceWarningLevel = 'On Track' | 'Early Warning' | 'Critical';

export type AttendanceEscalationStatus = 'None' | 'Early Warning' | 'Critical - Recovery Plan Active' | 'Escalated to VP' | 'Resolved';

export interface AttendanceActionPlan {
  id: string;
  studentId: string;
  batch: string;
  currentAttendancePercent: number;         // snapshot at time of plan creation/update
  trend: 'Improving' | 'Declining' | 'Stable' | 'Insufficient Data';
  reasonForAbsence: string;
  academicImpact: string;
  interventionTaken: string;
  studentCommitment: string;
  recoveryPlan: string;
  followUpDate: string;                     // ISO date
  // The effectiveness measure the framework actually cares about — filled in at/after
  // followUpDate. Before -> intervention -> after, not just "an intervention was logged".
  attendanceAfterIntervention?: number;
  escalationStatus: AttendanceEscalationStatus;
  createdAt: number;
  createdBy: string;                        // staffId
  updatedAt: number;
}

// Deliberate institutional principle: when a WHOLE BATCH's attendance in one module
// declines together, that is a signal to investigate the module/teaching, not a signal
// of individual student indiscipline. Kept as its own alert type so it is never conflated
// with a single student's AttendanceActionPlan.
export interface SystemicAttendanceAlert {
  id: string;
  moduleCode: string;
  batch: string;
  recentAveragePercent: number;
  priorAveragePercent: number;
  declinePoints: number;
  possibleCauses: string[];                 // subset of SYSTEMIC_ATTENDANCE_CAUSES (data.ts)
  investigationNotes: string;
  status: 'Open' | 'Investigating' | 'Resolved';
  flaggedAt: number;
  flaggedBy: string;                        // staffId
  resolvedAt?: number;
}

// --- BI-MONTHLY FEEDBACK CYCLES & ACTION-POINT LOOP (KRA/KPI Phase 3) ---
// Replaces the old single-window-per-semester model (SemesterConfig.feedbackOpenOdd/Even)
// going forward, WITHOUT removing it — those fields are untouched and still work for any
// code path that hasn't moved to cycles. A cycle is campus-wide: opening one opens feedback
// for every active module, every department, every batch at once.
export interface FeedbackCycle {
  id: string;
  label: string;             // e.g. "Nov–Dec 2026"
  startDate: string;         // ISO date
  endDate: string;           // ISO date
  isOpen: boolean;
  createdAt: number;
  createdBy: string;         // staffId
  closedAt?: number;
}

// The action loop the framework calls the critical missing piece: Feedback -> Analysis ->
// Identify Recurring Problems -> Draft Action Points -> Assign Owner -> Set Deadline ->
// Implement -> Verify -> Close. The VP KPI (>=90% closed within agreed timelines) is
// computed from these records, not from satisfaction scores alone.
export interface ActionPoint {
  id: string;
  cycleId: string;
  issue: string;
  evidenceFromFeedback: string;
  proposedAction: string;
  responsiblePersonId: string;
  departmentId: string;
  deadline: string;
  status: 'Open' | 'In Progress' | 'Verified' | 'Closed' | 'Escalated';
  verificationDate?: string;
  outcome?: string;
  createdAt: number;
  createdBy: string;         // staffId
  updatedAt: number;
}

// --- SHARED KPI SHAPE ---
// Every KRA/KPI function returns actual vs. target vs. a status, never a bare number, so a
// KPI that can't be computed from available data shows as 'No Data' instead of a fabricated
// value. Introduced in Phase 3 for calculateActionPointClosureRate (kpiService.ts) — the
// Phase 1/2 analytics functions predate this and return their own richer breakdown shapes
// instead, which is intentional (those feed detail tables, not single KPI tiles).
export interface KpiResult {
  kpiId: string;
  label: string;
  actual: number;
  target: number;
  unit: 'percent' | 'count' | 'rating';
  status: 'On Track' | 'At Risk' | 'Off Track' | 'No Data';
  period: string;
}
