
export enum Role {
  Student = 'Student',
  Tutor = 'Tutor',
  HOD = 'HOD',
  EducationManager = 'Education Manager',
  StudentService = 'Student Service',
  SystemAdministrator = 'System Administrator'
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
  weeklySchedule: { weekNumber: number; topic: string; description: string }[];
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
