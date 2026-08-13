
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from './AppContext';
import { normalizeProgram, LIKERT_QUESTIONS, CAMPUS_LIKERT_QUESTIONS, CAMPUS_FEEDBACK_CODE, getLocalDateString } from './data';
import { Module, Submission, SemesterPlanEntry, LessonPlan } from './types';
import { 
    Send, CheckCircle, BookOpen, List, Building2, FileText, Upload, Video, 
    Link as LinkIcon, Calendar, Users, ChevronRight, Clock, Lock, MessageSquare, 
    X, PieChart, AlertCircle, LayoutGrid, MapPin, ArrowRight, ChevronLeft, 
    Layers, Trophy, ChevronDown, ChevronUp, Star, Zap, Shield, Target, Award,
    TrendingUp, Activity, Info, BrainCircuit, PlayCircle, Download, FileQuestion
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LiveClassSession } from './LiveClassSession';

// --- GAMIFICATION CONSTANTS ---
// Kept for reference but data now comes from leaderboard
const SUBJECTIVE_QUESTIONS = [
    "What aspects of this module did you find most valuable?",
    "What specific suggestions do you have for improvement?"
];

const CAMPUS_SUBJECTIVE_QUESTIONS = [
    "What do you enjoy most about the campus environment?",
    "What suggestions do you have for improving student life?"
];

// Helper for rubric colors
const getGradeColor = (grade: string) => {
    switch (grade) {
        case 'Excellent': return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'Very Good': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'Good': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        case 'Average': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
        case 'Poor': return 'bg-red-500/20 text-red-400 border-red-500/30';
        default: return 'bg-gray-700 text-gray-300';
    }
};

export const StudentDashboard = () => {
  const { currentUser, curriculum, currentSemesterType, surveys, submitSurvey, allocations, users, briefs, submissions, addSubmission, attendance, semesterConfig, semesterPlans, rooms, semesterStartDate, holidays, aiModules, lessonPlans, leaderboard } = useApp();
  
  // State
  const [activeTab, setActiveTab] = useState<'modules' | 'schedule' | 'feedback'>('modules');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{ type: 'Regular' | 'Elective' | 'Campus', module?: Module, category?: string } | null>(null);
  const [selectedElectiveCode, setSelectedElectiveCode] = useState<string>('');
  const [viewWeek, setViewWeek] = useState<number>(1);
  const [selectedBrief, setSelectedBrief] = useState<any>(null); 
  const [submitFormOpen, setSubmitFormOpen] = useState<string | null>(null); 
  const [submitContent, setSubmitContent] = useState('');
  const [expandedRubricId, setExpandedRubricId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [likertScores, setLikertScores] = useState<number[]>([]);
  const [textAnswers, setTextAnswers] = useState<string[]>([]);
  const [selectedFeedbackSemester, setSelectedFeedbackSemester] = useState<'Active' | 'Odd' | 'Even'>('Active');

  // Lesson Plan Viewing State
  const [viewLessonPlan, setViewLessonPlan] = useState<LessonPlan | null>(null);
  const [previewContentId, setPreviewContentId] = useState<string | null>(null);

  useEffect(() => {
      if (semesterStartDate) {
          const start = new Date(semesterStartDate);
          const now = new Date();
          const diffTime = now.getTime() - start.getTime();
          const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
          const current = Math.max(1, diffWeeks > 0 ? diffWeeks : 1);
          setViewWeek(current);
      }
  }, [semesterStartDate]);

  const allMyModules = useMemo(() => {
    if (!currentUser) return [];
    const normalize = (s: string) => s ? s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '') : '';
    const normUserProgram = normalize(currentUser.programId);
    return curriculum.filter(m => {
        const normModuleProgram = normalize(m.programTitle);
        let programMatch = false;
        if (normUserProgram.includes(normModuleProgram) || normModuleProgram.includes(normUserProgram)) programMatch = true;
        if (currentUser.year === 1 && m.year === 1) {
            const isTargetStudent = normUserProgram.includes('animation') || normUserProgram.includes('graphics');
            const isFoundationModule = normModuleProgram.includes('visualarts'); 
            if (isTargetStudent && isFoundationModule) programMatch = true;
        }
        const yearMatch = currentUser.year ? m.year === currentUser.year : true;
        const isOddSem = m.sem % 2 !== 0;
        const semMatch = currentSemesterType === 'Odd' ? isOddSem : !isOddSem;
        return programMatch && yearMatch && semMatch;
    });
  }, [currentUser, curriculum, currentSemesterType]);

  const publishedBriefs = useMemo(() => {
      const myModuleCodes = allMyModules.map(m => m.code);
      return briefs.filter(b => myModuleCodes.includes(b.moduleCode) && b.status === 'Published');
  }, [allMyModules, briefs]);

  const { regularModules } = useMemo(() => {
      const regular: Module[] = [];
      allMyModules.forEach(m => {
          // Strictly filter for Core and Elective only
          if (m.type === 'Core' || m.type === 'Elective') {
              regular.push(m);
          }
      });
      regular.sort((a, b) => {
          if (a.type === 'Core' && b.type !== 'Core') return -1;
          if (a.type !== 'Core' && b.type === 'Core') return 1;
          return 0;
      });
      return { regularModules: regular };
  }, [allMyModules]);

  // --- GAMIFICATION LOGIC (Cached Read) ---
  const myLeaderboardEntry = useMemo(() => {
      return leaderboard.find(e => e.studentId === currentUser?.id);
  }, [leaderboard, currentUser]);

  const playerStats = useMemo(() => {
      if (myLeaderboardEntry) {
          const subCount = submissions.filter(s => s.studentId === currentUser?.id).length;
          // Calculate avg attendance locally or assume backend did it (backend did it)
          const attended = myLeaderboardEntry.breakdown.attendancePoints / 5; // Reverse eng
          const moduleSessions = attendance.filter(a => regularModules.some(m => m.code === a.moduleCode)).length;
          const avgAtt = moduleSessions > 0 ? Math.round((attended / moduleSessions) * 100) : 100;

          return {
              xp: myLeaderboardEntry.totalPoints,
              level: myLeaderboardEntry.level,
              currentLevelProgress: myLeaderboardEntry.currentLevelProgress,
              rank: { title: myLeaderboardEntry.rankTitle, color: "text-indigo-400" }, // Simple color fallback
              coins: Math.floor(myLeaderboardEntry.totalPoints / 2),
              avgAttendance: avgAtt,
              submissionCount: subCount
          };
      }
      
      // Fallback if no server data
      return { xp: 0, level: 1, currentLevelProgress: 0, rank: { title: "Novice", color: "text-gray-400" }, coins: 0, avgAttendance: 0, submissionCount: 0 };
  }, [myLeaderboardEntry, attendance, regularModules, submissions, currentUser]);

  // --- TIMETABLE DATA ---
  const timetableData = useMemo(() => {
      if (!currentUser || !semesterStartDate) return null;
      const start = new Date(semesterStartDate);
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() + (viewWeek - 1) * 7);
      
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const days = [];

      // Generate week days
      for(let i=0; i<5; i++) {
          const d = new Date(weekStart);
          d.setDate(weekStart.getDate() + i);
          const dateStr = getLocalDateString(d);
          const isToday = dateStr === getLocalDateString(new Date());
          days.push({ name: dayNames[i], date: dateStr, isToday, displayDate: d.getDate() });
      }

      // Filter plans for this week and student's batch
      const normalize = (s: string) => s ? s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '') : '';
      const normUserProgram = normalize(currentUser.programId);
      
      const batchPlans = semesterPlans.filter(p => {
          const normPlanProg = normalize(p.programId);
          const progMatch = normUserProgram.includes(normPlanProg) || normPlanProg.includes(normUserProgram);
          return progMatch && p.year === currentUser.year && p.weekNumber === viewWeek;
      });

      return { days, batchPlans };
  }, [currentUser, semesterStartDate, viewWeek, semesterPlans]);

  // Helper: Find Lesson Plan for a session
  // Updated to replicate Tutor's daily expansion logic for accurate sequencing
  const getLessonPlanForSession = (planEntry: SemesterPlanEntry, currentDayDateStr: string) => {
      if (!planEntry || !semesterStartDate) return undefined;
      
      // 1. Get ALL plans for this module and batch across the entire semester
      const modulePlans = semesterPlans.filter(p => 
          p.moduleCode === planEntry.moduleCode && 
          p.programId === planEntry.programId && 
          p.year === planEntry.year
      );

      // 2. Expand weekly plans into daily sessions (accounting for holidays)
      // This matches the TutorDashboard 'sessionSlots' logic
      const validSessions: { dateStr: string, sessionNumber: number }[] = [];
      const start = new Date(semesterStartDate);
      
      modulePlans.forEach(plan => {
          const weekStart = new Date(start);
          weekStart.setDate(start.getDate() + (plan.weekNumber - 1) * 7);
          for (let d = 0; d < 5; d++) { // Mon-Fri
              const currentDay = new Date(weekStart);
              currentDay.setDate(weekStart.getDate() + d);
              const dateStr = getLocalDateString(currentDay);
              const isHoliday = holidays.some(h => h.date === dateStr);
              if (!isHoliday) {
                  validSessions.push({ dateStr, sessionNumber: plan.sessionNumber });
              }
          }
      });

      // 3. Sort chronologically
      validSessions.sort((a, b) => {
          if (a.dateStr !== b.dateStr) return a.dateStr.localeCompare(b.dateStr);
          return a.sessionNumber - b.sessionNumber;
      });

      // 4. Find the index of the CURRENT session
      const currentIndex = validSessions.findIndex(s => s.dateStr === currentDayDateStr && s.sessionNumber === planEntry.sessionNumber);
      
      if (currentIndex === -1) return undefined;

      const sequence = currentIndex + 1;
      
      // 5. Find matching lesson plan
      return lessonPlans.find(lp => 
          lp.moduleCode === planEntry.moduleCode && 
          lp.sequence === sequence
      );
  };

  const handleDownloadSummary = () => {
      if (!viewLessonPlan) return;
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.text(viewLessonPlan.topic, 14, 20);
      doc.setFontSize(12);
      doc.text(`Module: ${viewLessonPlan.moduleCode} | Session ${viewLessonPlan.sequence}`, 14, 28);
      
      let yPos = 40;

      viewLessonPlan.chunks.forEach((chunk, idx) => {
          // Check page break
          if (yPos > 270) { doc.addPage(); yPos = 20; }

          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text(`${idx + 1}. ${chunk.activity} (${chunk.duration} mins)`, 14, yPos);
          yPos += 7;

          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          const contentLines = doc.splitTextToSize(chunk.content || "No description.", 180);
          doc.text(contentLines, 14, yPos);
          yPos += contentLines.length * 5 + 5;

          // Smart Content Notes
          if (chunk.aiModuleId) {
              const aiMod = aiModules.find(a => a.id === chunk.aiModuleId);
              if (aiMod && aiMod.notes) {
                  if (yPos > 260) { doc.addPage(); yPos = 20; }
                  doc.setFont("helvetica", "italic");
                  doc.setTextColor(100);
                  doc.text("Smart Notes:", 14, yPos);
                  yPos += 5;
                  doc.setTextColor(0);
                  const noteLines = doc.splitTextToSize(aiMod.notes, 170);
                  doc.text(noteLines, 20, yPos);
                  yPos += noteLines.length * 5 + 5;
              }
          }
          yPos += 5;
      });

      doc.save(`Lesson_Summary_${viewLessonPlan.moduleCode}_S${viewLessonPlan.sequence}.pdf`);
  };

  const getAttendanceStats = (moduleCode: string) => {
      if (!currentUser) return { percentage: 0, present: 0, total: 0 };
      const moduleSessions = attendance.filter(a => a.moduleCode === moduleCode);
      const total = moduleSessions.length;
      const present = moduleSessions.filter(a => a.presentStudentIds.includes(currentUser.id)).length;
      return {
          percentage: total === 0 ? 100 : Math.round((present / total) * 100),
          present,
          total
      };
  };

  const getCumulativeGrade = (moduleCode: string) => {
      if (!currentUser) return null;
      const moduleBriefs = publishedBriefs.filter(b => b.moduleCode === moduleCode);
      if (moduleBriefs.length === 0) return null;

      // Find all graded submissions for these briefs
      const mySubs = submissions.filter(s => 
          s.studentId === currentUser.id && 
          moduleBriefs.some(b => b.id === s.briefId) &&
          s.grade
      );

      if (mySubs.length === 0) return null;

      let totalScore = 0;
      let count = 0;

      mySubs.forEach(s => {
          if (s.grade) {
              if (s.grade.numericScore !== undefined) {
                  totalScore += s.grade.numericScore;
              } else {
                  // Fallback mapping for old string grades
                  if (s.grade.finalGrade?.startsWith('A')) totalScore += 95;
                  else if (s.grade.finalGrade?.startsWith('B')) totalScore += 80;
                  else if (s.grade.finalGrade?.startsWith('C')) totalScore += 60;
                  else totalScore += 40;
              }
              count++;
          }
      });

      if (count === 0) return null;
      
      const avg = Math.round(totalScore / count);
      let letter = 'F';
      if (avg >= 85) letter = 'A';
      else if (avg >= 70) letter = 'B';
      else if (avg >= 50) letter = 'C';
      else if (avg >= 40) letter = 'D';

      return { score: avg, letter };
  };

  const handleAssignmentSubmit = (deliverableId: string, type: 'Image' | 'Link' | 'Video' | 'PDF') => {
      if (!currentUser || !selectedBrief) return;
      if (!submitContent) { alert("Please provide content (URL or text)."); return; }

      const submission: Submission = {
          id: `sub-${Date.now()}`,
          briefId: selectedBrief.id,
          studentId: currentUser.id,
          deliverableId: deliverableId,
          type: type, 
          content: submitContent,
          submittedAt: Date.now()
      };

      addSubmission(submission);
      setSubmitContent('');
      setSubmitFormOpen(null);
      alert("Assignment submitted successfully!");
  };

  // --- HANDLERS (Safe wrappers) ---
  const handleOpenModal = (type: 'Regular' | 'Elective' | 'Campus', module?: Module, category?: string) => {
      const actualSemesterType = (selectedFeedbackSemester === 'Active') ? (semesterConfig?.activeType || currentSemesterType) : selectedFeedbackSemester;
      const feedbackOpenOdd = (semesterConfig as any)?.feedbackOpenOdd ?? (semesterConfig?.feedbackOpen ?? false);
      const feedbackOpenEven = (semesterConfig as any)?.feedbackOpenEven ?? (semesterConfig?.feedbackOpen ?? false);
      const isOpen = actualSemesterType === 'Odd' ? feedbackOpenOdd : feedbackOpenEven;
      if (!isOpen) { alert(`Feedback for ${actualSemesterType} semester is currently closed.`); return; }
      setRatingTarget({ type, module, category });
      const targetLikert = type === 'Campus' ? CAMPUS_LIKERT_QUESTIONS : LIKERT_QUESTIONS;
      const targetSubjective = type === 'Campus' ? CAMPUS_SUBJECTIVE_QUESTIONS : SUBJECTIVE_QUESTIONS;
      setLikertScores(new Array(targetLikert.length).fill(0));
      setTextAnswers(new Array(targetSubjective.length).fill(''));
      setSelectedElectiveCode(module ? module.code : ''); 
      setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault(); if (!currentUser) return;
      let targetModuleCode = '';
      if (ratingTarget?.type === 'Regular' && ratingTarget.module) { targetModuleCode = ratingTarget.module.code; } else if (ratingTarget?.type === 'Elective') { targetModuleCode = selectedElectiveCode; } else if (ratingTarget?.type === 'Campus') { targetModuleCode = CAMPUS_FEEDBACK_CODE; }
      if (!targetModuleCode) { alert("Please select a module."); return; }
      if (likertScores.some(s => s === 0)) { alert("Please answer all rating questions."); return; }
      const sum = likertScores.reduce((a, b) => a + b, 0);
      const averageRating = parseFloat((sum / likertScores.length).toFixed(1));
      const questionSet = ratingTarget?.type === 'Campus' ? CAMPUS_SUBJECTIVE_QUESTIONS : SUBJECTIVE_QUESTIONS;
      const combinedFeedback = questionSet.map((q, i) => `Q: ${q}\nA: ${textAnswers[i]}`).join('\n\n');
      const semesterType = (selectedFeedbackSemester === 'Active') ? (semesterConfig?.activeType || currentSemesterType) : selectedFeedbackSemester;
      submitSurvey({ id: Date.now().toString(), studentId: currentUser.id, moduleCode: targetModuleCode, rating: averageRating, feedback: combinedFeedback, timestamp: Date.now(), detailedRatings: likertScores, semesterType } as any);
      setIsModalOpen(false);
  };

  // --- RENDER ---
  return (
    <div className="bg-[#131524] min-h-screen text-gray-200 font-sans p-4 md:p-8 -m-4 md:-m-8 rounded-xl">
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            {/* Profile Card */}
            <div className="lg:col-span-2 bg-[#1E2130] rounded-2xl p-6 relative overflow-hidden border border-gray-800 shadow-xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>
                <div className="flex items-center gap-6 relative z-10">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full border-4 border-[#282b3c] overflow-hidden bg-gray-800">
                            {currentUser?.profilePicture ? (
                                <img src={currentUser.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <Users className="w-full h-full p-4 text-gray-500" />
                            )}
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-[#1E2130]">
                            Lvl {playerStats.level}
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">{currentUser?.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-sm font-bold uppercase tracking-wider ${playerStats.rank.color}`}>
                                {playerStats.rank.title} League
                            </span>
                            <span className="text-gray-600">•</span>
                            <span className="text-sm text-gray-400">{currentUser?.programId}</span>
                        </div>
                        
                        {/* XP Bar */}
                        <div className="mt-4 w-full max-w-xs">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>{playerStats.currentLevelProgress} / 800 XP</span>
                                <span>Next Level</span>
                            </div>
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                                    style={{ width: `${(playerStats.currentLevelProgress / 800) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-[#1E2130] rounded-2xl p-6 border border-gray-800 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-4">
                    <div className="bg-green-500/10 p-3 rounded-xl text-green-400"><Target size={24} /></div>
                    <span className="text-green-400 font-bold text-sm">+12% this week</span>
                </div>
                <div className="text-3xl font-bold text-white">{playerStats.submissionCount}</div>
                <div className="text-sm text-gray-400">Missions & Classwork</div>
            </div>

            <div className="bg-[#1E2130] rounded-2xl p-6 border border-gray-800 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-4">
                    <div className="bg-yellow-500/10 p-3 rounded-xl text-yellow-400"><Award size={24} /></div>
                    <span className="text-white font-bold text-sm flex items-center gap-1">
                        <img src="https://cdn-icons-png.flaticon.com/512/1828/1828884.png" className="w-4 h-4 invert opacity-80" alt="coin" />
                        {playerStats.coins}
                    </span>
                </div>
                <div className="text-3xl font-bold text-white">{playerStats.avgAttendance}%</div>
                <div className="text-sm text-gray-400">Attendance Rate</div>
            </div>
        </div>

        {/* Main Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Modules & Quests */}
            <div className="lg:col-span-2 space-y-8">
                
                {/* Tabs */}
                <div className="flex gap-4 border-b border-gray-800 pb-2">
                    <button 
                        onClick={() => setActiveTab('modules')}
                        className={`pb-2 px-1 text-sm font-bold transition-colors ${activeTab === 'modules' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Active Quests
                    </button>
                    <button 
                        onClick={() => setActiveTab('schedule')}
                        className={`pb-2 px-1 text-sm font-bold transition-colors ${activeTab === 'schedule' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Session Timetable
                    </button>
                    <button 
                        onClick={() => setActiveTab('feedback')}
                        className={`pb-2 px-1 text-sm font-bold transition-colors ${activeTab === 'feedback' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Feedback Deck
                    </button>
                </div>

                {activeTab === 'modules' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {regularModules.map((module) => {
                            const stats = getAttendanceStats(module.code);
                            const activeBriefs = publishedBriefs.filter(b => b.moduleCode === module.code);
                            const cumGrade = getCumulativeGrade(module.code);
                            
                            return (
                                <div key={module.code} className="bg-[#1E2130] border border-gray-800 rounded-xl p-5 hover:border-indigo-500/50 transition-all group relative overflow-hidden flex flex-col">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 group-hover:bg-indigo-400 transition-colors"></div>
                                    
                                    <div className="flex justify-between items-start mb-4 pl-3">
                                        <div className="flex-1">
                                            <h3 className="text-white font-bold text-lg leading-tight group-hover:text-indigo-300 transition-colors">{module.title}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-gray-500 font-mono block">{module.code}</span>
                                                <span className="text-[10px] uppercase font-bold text-gray-600 border border-gray-700 px-1.5 rounded">{module.type}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs border ${stats.percentage >= 75 ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`} title="Attendance">
                                                {stats.percentage}%
                                            </div>
                                            {cumGrade && (
                                                <div className="bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                                                    CA: {cumGrade.score}% ({cumGrade.letter})
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Mission List inside Card */}
                                    <div className="space-y-2 pl-3 mb-4 flex-1">
                                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                                            <Activity size={12} /> Active Missions
                                        </div>
                                        {activeBriefs.length === 0 ? (
                                            <div className="text-sm text-gray-600 italic">No active missions.</div>
                                        ) : (
                                            activeBriefs.slice(0, 2).map(brief => (
                                                <button 
                                                    key={brief.id} 
                                                    onClick={() => setSelectedBrief(brief)}
                                                    className="w-full text-left bg-[#131524] hover:bg-gray-900 p-2 rounded text-sm text-gray-300 flex justify-between items-center transition-colors border border-transparent hover:border-gray-700"
                                                >
                                                    <span className="truncate">{brief.title}</span>
                                                    <ChevronRight size={14} className="text-gray-600" />
                                                </button>
                                            ))
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="pl-3 pt-3 border-t border-gray-800 flex justify-between items-center mt-auto">
                                        <span className="text-xs text-gray-500">{activeBriefs.length} Briefs</span>
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 rounded-full bg-gray-700"></span>
                                            <span className="w-2 h-2 rounded-full bg-gray-700"></span>
                                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {regularModules.length === 0 && (
                            <div className="col-span-2 text-center text-gray-500 py-12">
                                No Core or Elective modules assigned for this semester.
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'schedule' && (
                    <div className="bg-[#1E2130] rounded-xl border border-gray-800 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Calendar className="text-indigo-400" /> Session-wise Timetable
                            </h3>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setViewWeek(Math.max(1, viewWeek - 1))} className="text-gray-400 hover:text-white"><ChevronLeft size={20}/></button>
                                <span className="text-sm font-bold text-white">Week {viewWeek}</span>
                                <button onClick={() => setViewWeek(viewWeek + 1)} className="text-gray-400 hover:text-white"><ChevronRight size={20}/></button>
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm text-left text-gray-300 border-collapse">
                                <thead className="text-xs text-gray-400 uppercase bg-[#252836]">
                                    <tr>
                                        <th className="px-6 py-3 border border-gray-700 w-24">Session</th>
                                        {timetableData?.days.map(d => (
                                            <th key={d.name} className={`px-6 py-3 border border-gray-700 ${d.isToday ? 'bg-indigo-900/30 text-indigo-300' : ''}`}>
                                                {d.name} <span className="ml-1 text-gray-500">{d.displayDate}</span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[1, 2, 3, 4].map((sessionNum) => {
                                        const timeLabel = sessionNum === 1 ? '09:00-11:00' : sessionNum === 2 ? '11:00-01:00' : sessionNum === 3 ? '02:00-04:00' : '04:00-06:00';
                                        
                                        // Find plan for this session number
                                        const planForSession = timetableData?.batchPlans.find(p => p.sessionNumber === sessionNum);
                                        
                                        return (
                                            <tr key={sessionNum} className="bg-[#1A1D2D] hover:bg-[#1E2130]">
                                                <td className="px-6 py-4 font-medium text-white border border-gray-700 whitespace-nowrap">
                                                    S{sessionNum}<br/><span className="text-[10px] text-gray-500">{timeLabel}</span>
                                                </td>
                                                {timetableData?.days.map((d) => {
                                                    // Since we are assuming block teaching / weekly repetition for now based on data constraints:
                                                    // The plan for Session X applies to all days.
                                                    if (!planForSession) {
                                                        return <td key={d.name} className="px-6 py-4 border border-gray-700"></td>;
                                                    }

                                                    // Use the daily-expanded sequence logic
                                                    const lessonPlan = getLessonPlanForSession(planForSession, d.date);
                                                    const module = curriculum.find(m => m.code === planForSession.moduleCode);
                                                    const tutor = users.find(u => u.id === allocations.find(a => a.moduleCode === planForSession.moduleCode)?.tutorId);
                                                    const room = rooms.find(r => r.id === (planForSession.roomId || allocations.find(a => a.moduleCode === planForSession.moduleCode)?.roomId));

                                                    return (
                                                        <td key={d.name} className={`px-4 py-3 border border-gray-700 ${d.isToday ? 'bg-indigo-900/10' : ''}`}>
                                                            <div className="flex flex-col gap-1">
                                                                <div className="font-bold text-white text-xs truncate" title={module?.title}>{module?.title || planForSession.moduleCode}</div>
                                                                <div className="text-[10px] text-gray-400 flex items-center gap-1"><Users size={10}/> {tutor?.name || 'TBA'}</div>
                                                                <div className="text-[10px] text-gray-400 flex items-center gap-1"><MapPin size={10}/> {room?.number || 'TBA'}</div>
                                                                
                                                                {lessonPlan ? (
                                                                    lessonPlan.status === 'Published' ? (
                                                                        <button 
                                                                            onClick={() => setViewLessonPlan(lessonPlan)}
                                                                            className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] py-1 px-2 rounded flex items-center justify-center gap-1 w-full font-bold shadow-sm"
                                                                        >
                                                                            <BookOpen size={10}/> View Lesson
                                                                        </button>
                                                                    ) : (
                                                                        <span className="mt-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] py-1 px-2 rounded flex items-center justify-center gap-1 w-full italic">
                                                                            <Clock size={10}/> Coming Soon
                                                                        </span>
                                                                    )
                                                                ) : (
                                                                    <span className="mt-2 text-gray-600 text-[10px] flex items-center justify-center w-full italic opacity-50">
                                                                        No Content
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'feedback' && (
                    <div className="bg-[#1E2130] rounded-xl border border-gray-800 p-8 text-center">
                        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
                            <MessageSquare size={32} />
                        </div>
                        <h3 className="text-white text-xl font-bold mb-2">Feedback Station</h3>
                        <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">Provide tactical feedback on your modules and campus facilities to earn extra XP.</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button onClick={() => handleOpenModal('Campus')} className="p-4 bg-indigo-600/10 border border-indigo-500/30 rounded-lg hover:bg-indigo-600/20 transition-all text-indigo-300 font-bold flex flex-col items-center gap-2">
                                <Building2 size={24} />
                                Campus Report
                            </button>
                            <button className="p-4 bg-gray-800 border border-gray-700 rounded-lg text-gray-500 font-bold flex flex-col items-center gap-2 cursor-not-allowed">
                                <List size={24} />
                                Module Surveys (Closed)
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column: KPIs & Status */}
            <div className="space-y-6">
                {/* KPIs */}
                <div className="bg-[#1E2130] rounded-2xl p-6 border border-gray-800">
                    <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                        <PieChart size={18} className="text-purple-400" /> Performance
                    </h3>
                    
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2 text-gray-400">
                                <span>Attendance</span>
                                <span className="text-white font-bold">{playerStats.avgAttendance}%</span>
                            </div>
                            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${playerStats.avgAttendance >= 75 ? 'bg-green-500' : 'bg-red-500'}`} 
                                    style={{ width: `${playerStats.avgAttendance}%` }}
                                ></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-2 text-gray-400">
                                <span>Assignment Completion</span>
                                <span className="text-white font-bold">85%</span>
                            </div>
                            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: '85%' }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-800 grid grid-cols-2 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-white">{playerStats.submissionCount}</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Quests Done</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-white">4</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Pending</div>
                        </div>
                    </div>
                </div>

                {/* Upcoming Events / Deadlines Mini */}
                <div className="bg-gradient-to-br from-indigo-900 to-[#1E2130] rounded-2xl p-6 border border-indigo-500/20">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <Zap size={18} className="text-yellow-400" /> Incoming
                    </h3>
                    <div className="space-y-3">
                        {publishedBriefs.slice(0, 3).map(b => (
                            <div key={b.id} className="bg-black/20 p-3 rounded-lg backdrop-blur-sm">
                                <div className="text-indigo-200 text-sm font-bold truncate">{b.title}</div>
                                <div className="text-indigo-400/60 text-xs mt-1">Week {b.weeks} • Due soon</div>
                            </div>
                        ))}
                        {publishedBriefs.length === 0 && <div className="text-indigo-300/50 text-sm italic">No upcoming deadlines.</div>}
                    </div>
                </div>
            </div>
        </div>

        {/* --- MODALS (Dark Theme Styled) --- */}
        
        {/* Lesson Plan View Modal */}
        {viewLessonPlan && (
            <div className="fixed z-50 inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-[#1E2130] w-full max-w-4xl h-[85vh] rounded-2xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-[#131524]">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <BrainCircuit className="text-indigo-500" /> {viewLessonPlan.topic}
                            </h2>
                            <p className="text-gray-400 text-sm mt-1">{viewLessonPlan.moduleCode} • Session {viewLessonPlan.sequence}</p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleDownloadSummary} 
                                className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-sm font-medium border border-gray-600 flex items-center gap-2"
                            >
                                <Download size={14}/> Save Summary
                            </button>
                            <button onClick={() => setViewLessonPlan(null)} className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-full"><X size={24}/></button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Timeline */}
                        <div className="space-y-4">
                            {viewLessonPlan.chunks.map((chunk, idx) => (
                                <div key={chunk.id} className="bg-[#252836] rounded-xl border border-gray-700 overflow-hidden relative">
                                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-indigo-500"></div>
                                    <div className="p-4 pl-6">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{chunk.activity} • {chunk.duration} mins</span>
                                                <h4 className="text-white font-bold text-lg mt-1">{chunk.objective || "Core Concept"}</h4>
                                            </div>
                                            {chunk.aiModuleId && (
                                                <button 
                                                    onClick={() => setPreviewContentId(chunk.aiModuleId!)}
                                                    className="bg-green-600/20 text-green-400 border border-green-500/50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-green-600/30 transition-colors"
                                                >
                                                    <PlayCircle size={14}/> Open Smart Content
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-gray-400 text-sm leading-relaxed">{chunk.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Smart Content Viewer (Preview Mode) */}
        {previewContentId && (
            <div className="fixed z-[60] inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4">
                <div className="w-full h-full max-w-6xl max-h-[90vh] bg-white rounded-lg overflow-hidden relative">
                    <button onClick={() => setPreviewContentId(null)} className="absolute top-4 right-4 z-50 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"><X size={24}/></button>
                    <LiveClassSession 
                        previewMode={true} 
                        previewModuleId={previewContentId} 
                        onClosePreview={() => setPreviewContentId(null)} 
                    />
                </div>
            </div>
        )}

        {/* Brief View Modal - No Changes */}
        {selectedBrief && (
            <div className="fixed z-50 inset-0 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="fixed inset-0 bg-black/80 transition-opacity backdrop-blur-sm" onClick={() => setSelectedBrief(null)}></div>
                    <div className="inline-block align-bottom bg-[#1E2130] rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full border border-gray-700">
                        {/* ... Modal Content Same as Before ... */}
                        <div className="p-6 border-b border-gray-700 flex justify-between items-start bg-[#131524]">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <FileText className="text-indigo-500" /> {selectedBrief.title}
                                </h2>
                                <p className="text-gray-400 text-sm mt-1">{selectedBrief.moduleCode} • {users.find(u => u.id === selectedBrief.tutorId)?.name}</p>
                            </div>
                            <button onClick={() => setSelectedBrief(null)} className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-full"><X size={24}/></button>
                        </div>

                        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-8 bg-[#1E2130] text-gray-300">
                            {selectedBrief.coverImageUrl && (
                                <img src={selectedBrief.coverImageUrl} className="w-full h-48 object-cover rounded-xl border border-gray-700" alt="Cover" />
                            )}

                            {/* Outcomes */}
                            <section>
                                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-3">Mission Objectives</h3>
                                <ul className="space-y-2">
                                    {selectedBrief.learningOutcomes?.map((lo: string, i: number) => (
                                        <li key={i} className="flex gap-3 text-sm bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                                            <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                                            {lo}
                                        </li>
                                    ))}
                                </ul>
                            </section>

                            {/* Submission Requirements (New) */}
                            {selectedBrief.finalDeliverableRequirements && selectedBrief.finalDeliverableRequirements.length > 0 && (
                                <section>
                                    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-3">Submission Requirements</h3>
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                        <ul className="list-disc pl-4 space-y-2 text-sm text-blue-200">
                                            {selectedBrief.finalDeliverableRequirements.map((req: string, i: number) => (
                                                <li key={i}>{req}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </section>
                            )}

                            {/* Deliverables */}
                            <section>
                                <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-3">Deliverables</h3>
                                <div className="space-y-4">
                                    {selectedBrief.deliverables?.map((d: any) => {
                                        const submission = submissions.find(s => s.briefId === selectedBrief.id && s.deliverableId === d.id);
                                        const isRubricExpanded = expandedRubricId === d.id;
                                        const weekMilestone = selectedBrief.weeklySchedule?.find((w: any) => w.weekNumber === d.weekNumber);

                                        return (
                                            <div key={d.id} className="bg-[#131524] border border-gray-700 rounded-xl overflow-hidden">
                                                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                    <div>
                                                        <div className="text-white font-bold flex items-center gap-2">
                                                            {d.title}
                                                            {d.rubric && d.rubric.length > 0 && (
                                                                <button 
                                                                    onClick={() => setExpandedRubricId(isRubricExpanded ? null : d.id)}
                                                                    className="text-[10px] bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded text-gray-300 transition-colors flex items-center gap-1"
                                                                >
                                                                    {isRubricExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                                                    {isRubricExpanded ? 'Hide Criteria' : 'View Criteria'}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">Week {d.weekNumber} • {d.type}</div>
                                                    </div>
                                                    {submission ? (
                                                        <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30 flex items-center gap-1 w-fit">
                                                            <CheckCircle size={12} /> Completed
                                                        </span>
                                                    ) : (
                                                        <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold border border-yellow-500/30 flex items-center gap-1 w-fit">
                                                            <Clock size={12} /> Pending
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Expanded Grading Rubric */}
                                                {isRubricExpanded && d.rubric && (
                                                    <div className="bg-black/20 border-t border-gray-700 p-4 animate-in slide-in-from-top-2 duration-200">
                                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-1">
                                                            <Info size={12}/> Grading Rubric & Slab Descriptors
                                                        </h4>
                                                        <div className="space-y-4">
                                                            {d.rubric.map((crit: any) => (
                                                                <div key={crit.id} className="bg-[#1E2130] rounded-lg border border-gray-700 p-3">
                                                                    <div className="flex justify-between text-sm font-bold text-gray-200 mb-2 border-b border-gray-700 pb-2">
                                                                        <span>{crit.criteria}</span>
                                                                        <span className="text-indigo-400">{crit.weightage}%</span>
                                                                    </div>
                                                                    {/* Horizontal Scrollable Slabs */}
                                                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                                                                        {crit.levels.map((lvl: any, lIdx: number) => (
                                                                            <div key={lIdx} className={`min-w-[140px] max-w-[140px] p-2 rounded border text-[10px] flex flex-col gap-1 ${getGradeColor(lvl.grade)}`}>
                                                                                <div className="font-bold uppercase">{lvl.grade}</div>
                                                                                <div className="text-white/80 leading-snug line-clamp-4" title={lvl.description}>
                                                                                    {lvl.description || "No description."}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* WEEKLY MILESTONE CONTEXT (Always show if available) */}
                                                {weekMilestone && (
                                                     <div className="px-4 py-3 bg-[#1A1D2D] border-t border-gray-700/50">
                                                        <div className="flex gap-3">
                                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div>
                                                            <div>
                                                                <h4 className="text-xs font-bold text-indigo-300 uppercase mb-1">
                                                                    Milestone: {weekMilestone.topic}
                                                                </h4>
                                                                <p className="text-xs text-gray-400 leading-relaxed">
                                                                    {weekMilestone.description}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Action Area */}
                                                {!submission ? (
                                                    <div className="p-4 bg-gray-800/30 border-t border-gray-700/50 border-dashed">
                                                        {submitFormOpen === d.id ? (
                                                            <div className="space-y-3">
                                                                <input 
                                                                    type="text" 
                                                                    placeholder={d.type === 'Link' ? "Paste your URL..." : "Upload not supported in demo"}
                                                                    className="w-full bg-[#131524] border border-gray-600 rounded p-2 text-white text-sm focus:border-indigo-500 outline-none"
                                                                    value={submitContent}
                                                                    onChange={e => setSubmitContent(e.target.value)}
                                                                />
                                                                <div className="flex gap-2">
                                                                    <button onClick={() => handleAssignmentSubmit(d.id, d.type)} className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-500">Submit</button>
                                                                    <button onClick={() => setSubmitFormOpen(null)} className="text-gray-400 px-3 py-1.5 text-sm hover:text-white">Cancel</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => setSubmitFormOpen(d.id)} className="w-full py-2 flex items-center justify-center gap-2 text-indigo-400 hover:text-indigo-300 font-bold text-sm">
                                                                <Upload size={16} /> Submit Work
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    // Grading Feedback
                                                    submission.grade && (
                                                        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-indigo-400 font-bold text-sm">Tutor Feedback</span>
                                                                <span className="text-white font-bold text-lg bg-indigo-600 px-2 rounded">
                                                                    {submission.grade.finalGrade} 
                                                                    {submission.grade.numericScore !== undefined && <span className="text-xs ml-1 opacity-80">({submission.grade.numericScore})</span>}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-gray-300 italic">"{submission.grade.feedback}"</p>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>
            )}

        {/* Feedback Modal - No Changes */}
        {isModalOpen && (
            <div className="fixed z-50 inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-[#1E2130] w-full max-w-2xl rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-white">Submit Feedback</h3>
                        <button onClick={() => setIsModalOpen(false)}><X className="text-gray-400 hover:text-white" /></button>
                    </div>
                    <div className="p-6 max-h-[70vh] overflow-y-auto">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {(ratingTarget?.type === 'Campus' ? CAMPUS_LIKERT_QUESTIONS : LIKERT_QUESTIONS).map((q, i) => (
                                <div key={i} className="space-y-2">
                                    <label className="text-gray-300 text-sm font-medium">{q}</label>
                                    <div className="flex gap-2">
                                        {[1,2,3,4,5].map(val => (
                                            <button 
                                                key={val} 
                                                type="button"
                                                onClick={() => { const n = [...likertScores]; n[i] = val; setLikertScores(n); }}
                                                className={`flex-1 py-2 rounded text-sm font-bold border transition-colors ${likertScores[i] === val ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#131524] border-gray-700 text-gray-500 hover:bg-gray-800'}`}
                                            >
                                                {val}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-green-900/20">
                                Submit & Earn XP
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
