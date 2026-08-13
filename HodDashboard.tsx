
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from './AppContext';
import { Role, Module, SemesterPlanEntry, TimeSlot, AssignmentBrief, RubricCriteria, ModuleContext, LessonPlan, ModuleType, Deliverable } from './types';
import { Users, ChevronDown, ChevronRight, BookOpen, Mail, Eye, LayoutGrid, Palette, Calculator, Trash2, Clock, Calendar, CheckCircle, XCircle, ArrowLeft, ArrowRight, Plus, Trash, FileText, Save, Edit, MapPin, BrainCircuit, Loader2, List, Layers, Send, BookCopy, Sparkles, X, SaveAll, Image as ImageIcon, Upload, Filter, Monitor } from 'lucide-react';
import { getHodDepartments, normalizeProgram, getLocalDateString, RUBRIC_GRADE_LEVELS } from './data';
import { generateBriefContent, mapSyllabusToTopics, enhanceSyllabusContent } from './geminiService';
import { WeeklyFeedback } from './WeeklyFeedback';
import { AttendanceWatchlist } from './AttendanceWatchlist';

// Fallback color generator
const getFallbackColors = (code: string, type: string) => {
    if (type === 'Non Core') {
        return { bg: '#E2E8F0', border: '#64748B', text: '#334155' };
    }
    let hash = 0;
    for (let i = 0; i < code.length; i++) { hash = code.charCodeAt(i) + ((hash << 5) - hash); }
    const hue = Math.abs(hash % 360);
    return { bg: `hsl(${hue}, 85%, 92%)`, border: `hsl(${hue}, 60%, 45%)`, text: `hsl(${hue}, 75%, 25%)` };
};

const mapHodKeyToDeptName = (key: string) => {
    const map: Record<string, string> = { 'animation': 'Animation', 'game': 'Game Design', 'graphics': 'Graphic Design', 'interior': 'Interior Design', 'multimedia': 'Multimedia', 'photography': 'Photography', 'ui': 'UI/UX', 'visualeffects': 'Visual Effects', 'vfx': 'Visual Effects', 'foundation': 'Foundation (BVA)' };
    return map[key] || key;
};

// Rubric Templates Constant
const RUBRIC_TEMPLATES: Record<string, any[]> = {
    "Design Project": [
        { id: 'crit-1', criteria: "Concept & Originality", weightage: 30, levels: [{grade: 'Excellent', description: 'Exceptional and unique concept.'},{grade: 'Very Good', description: 'Strong concept with good originality.'},{grade: 'Good', description: 'Clear concept, some originality.'},{grade: 'Average', description: 'Basic concept, lacks originality.'},{grade: 'Poor', description: 'No clear concept.'}] },
        { id: 'crit-2', criteria: "Technical Execution", weightage: 40, levels: [{grade: 'Excellent', description: 'Flawless execution.'},{grade: 'Very Good', description: 'High quality execution.'},{grade: 'Good', description: 'Good execution with minor flaws.'},{grade: 'Average', description: 'Acceptable execution.'},{grade: 'Poor', description: 'Poor execution.'}] },
        { id: 'crit-3', criteria: "Presentation", weightage: 30, levels: [{grade: 'Excellent', description: 'Professional presentation.'},{grade: 'Very Good', description: 'Strong presentation.'},{grade: 'Good', description: 'Clear presentation.'},{grade: 'Average', description: 'Basic presentation.'},{grade: 'Poor', description: 'Messy presentation.'}] }
    ],
    "Written Assignment": [
        { id: 'crit-1', criteria: "Content & Research", weightage: 40, levels: [{grade: 'Excellent', description: 'Deep research.'},{grade: 'Very Good', description: 'Good research.'},{grade: 'Good', description: 'Adequate research.'},{grade: 'Average', description: 'Basic research.'},{grade: 'Poor', description: 'No research.'}] },
        { id: 'crit-2', criteria: "Critical Analysis", weightage: 30, levels: [{grade: 'Excellent', description: 'Insightful analysis.'},{grade: 'Very Good', description: 'Good analysis.'},{grade: 'Good', description: 'Some analysis.'},{grade: 'Average', description: 'Little analysis.'},{grade: 'Poor', description: 'No analysis.'}] },
        { id: 'crit-3', criteria: "Structure & Grammar", weightage: 30, levels: [{grade: 'Excellent', description: 'Perfect structure.'},{grade: 'Very Good', description: 'Good structure.'},{grade: 'Good', description: 'Readable.'},{grade: 'Average', description: 'Poor structure.'},{grade: 'Poor', description: 'Unreadable.'}] }
    ]
};

// Helper to safely deep copy simple data objects without crashing on cycles
const safeDeepCopy = <T,>(obj: T): T => {
    try {
        return structuredClone(obj);
    } catch (e) {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (jsonError) {
            console.error("Deep copy failed (circular ref or invalid object), returning shallow copy", jsonError);
            return (typeof obj === 'object' && obj !== null) ? { ...obj } : obj;
        }
    }
};

export const HodDashboard = () => {
  const { currentUser, curriculum, users, allocations, assignTutor, currentSemesterType, semesterStartDate, semesterEndDate, briefs, updateBrief, addBrief, submissions, semesterPlans, toggleSemesterPlan, clearSemesterPlan, holidays, customEvents, addCustomEvent, deleteCustomEvent, rooms, lessonPlans, addLessonPlan, updateLessonPlan, saveModuleSyllabus, moduleSyllabi } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'planner' | 'timetable' | 'briefs' | 'teaching' | 'attendance'>('overview');
  const [expandedPrograms, setExpandedPrograms] = useState<string[]>([]);
  const [expandedYears, setExpandedYears] = useState<string[]>([]);
  const [trackingModule, setTrackingModule] = useState<Module | null>(null);
  
  // Brief Creation State
  const [isBriefModalOpen, setIsBriefModalOpen] = useState(false);
  const [editingBrief, setEditingBrief] = useState<Partial<AssignmentBrief>>({});
  const [briefEditorTab, setBriefEditorTab] = useState<'general' | 'schedule' | 'rubric' | 'preview'>('general');
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [selectedRubricDeliverableId, setSelectedRubricDeliverableId] = useState<string>('');
  const [expandedRubricWeek, setExpandedRubricWeek] = useState<number | null>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  // Selectors for Brief Modal
  const [briefProgram, setBriefProgram] = useState('');
  const [briefYear, setBriefYear] = useState<string>('');

  // Planner State
  const [selectedPlannerBatch, setSelectedPlannerBatch] = useState<{program: string, year: number} | null>(null);
  const [selectedPlannerModule, setSelectedPlannerModule] = useState<string | null>(null); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [timetableWeek, setTimetableWeek] = useState<number>(1);
  const [selectedTimetableBatch, setSelectedTimetableBatch] = useState<{program: string, year: number} | null>(null);

  // Syllabus Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [syllabusTargetModule, setSyllabusTargetModule] = useState<Module | null>(null);
  const [syllabusText, setSyllabusText] = useState('');
  const [syllabusConfig, setSyllabusConfig] = useState<ModuleContext>({ type: 'Theory', taughtHours: 40, gilHours: 20, customPrompt: '' });
  const [isSavingSyllabus, setIsSavingSyllabus] = useState(false);
  const syllabusFileRef = useRef<HTMLInputElement>(null);

  // Helpers
  const tutors = useMemo(() => users.filter(u => u.role === Role.Tutor || u.role === Role.HOD || u.role === Role.EducationManager), [users]);
  const availableRooms = useMemo(() => {
      if (!currentUser) return [];
      const myDeptKeys = getHodDepartments(currentUser.id);
      const myDeptNames = myDeptKeys.map(mapHodKeyToDeptName).filter(Boolean);
      return rooms.filter(r => r.allocatedDepartment && myDeptNames.includes(r.allocatedDepartment));
  }, [rooms, currentUser]);

  const isMyModule = (m: Module, myDepts: string[]) => {
      const normProgram = normalizeProgram(m.programTitle);
      if (myDepts.includes('game') && normProgram.includes('animation')) return false;
      if (myDepts.includes('foundation') && normProgram.includes('visualarts')) return true;
      return myDepts.some(deptKey => normProgram.includes(deptKey));
  };

  const allDepartmentModules = useMemo(() => {
      if (!currentUser) return [];
      const myDepts = getHodDepartments(currentUser.id);
      const strictFilter = myDepts.length > 0;
      if (!strictFilter) return curriculum;
      return curriculum.filter(m => isMyModule(m, myDepts));
  }, [curriculum, currentUser]);

  const departmentBriefs = useMemo(() => {
      const moduleCodes = allDepartmentModules.map(m => m.code);
      return briefs.filter(b => moduleCodes.includes(b.moduleCode));
  }, [briefs, allDepartmentModules]);

  const groupedModules = useMemo(() => {
    if (!currentUser) return {};
    const myDepts = getHodDepartments(currentUser.id);
    const strictFilter = myDepts.length > 0;
    const filtered = curriculum.filter(m => {
         const isOdd = m.sem % 2 !== 0;
         const semMatch = currentSemesterType === 'Odd' ? isOdd : !isOdd;
         if (!semMatch) return false;
         if (!strictFilter) return true;
         return isMyModule(m, myDepts);
    });
    const grouped: Record<string, Record<number, typeof filtered>> = {};
    filtered.forEach(m => {
        if (!grouped[m.programTitle]) grouped[m.programTitle] = {};
        if (!grouped[m.programTitle][m.year]) grouped[m.programTitle][m.year] = [];
        grouped[m.programTitle][m.year].push(m);
    });
    return grouped;
  }, [curriculum, currentUser, currentSemesterType]);

  const briefCreationModules = useMemo(() => {
      const grouped: Record<string, Record<number, Module[]>> = {};
      allDepartmentModules.forEach(m => {
        if (!grouped[m.programTitle]) grouped[m.programTitle] = {};
        if (!grouped[m.programTitle][m.year]) grouped[m.programTitle][m.year] = [];
        grouped[m.programTitle][m.year].push(m);
      });
      return grouped;
  }, [allDepartmentModules]);

  const getAssignedTutorId = (moduleCode: string) => allocations.find(a => a.moduleCode === moduleCode)?.tutorId || '';
  const getAssignedRoomId = (moduleCode: string) => allocations.find(a => a.moduleCode === moduleCode)?.roomId || '';
  
  const handleAssign = (moduleCode: string, programId: string, tutorId: string, roomId?: string) => {
      const currentAlloc = allocations.find(a => a.moduleCode === moduleCode);
      assignTutor({ 
          id: `${moduleCode}-${programId.replace(/[^a-zA-Z0-9]/g, '-')}`, 
          moduleCode, 
          programId, 
          tutorId: tutorId || currentAlloc?.tutorId || '',
          roomId: roomId !== undefined ? roomId : currentAlloc?.roomId
      });
  };

  const handleOpenImportSyllabus = (module: Module) => {
      setSyllabusTargetModule(module);
      const existingSyllabus = moduleSyllabi.find(s => s.moduleCode === module.code);
      if (existingSyllabus) {
          setSyllabusText(existingSyllabus.syllabusText);
          setSyllabusConfig(existingSyllabus.config);
      } else {
          setSyllabusText('');
          setSyllabusConfig({ type: 'Theory', taughtHours: 40, gilHours: 20, customPrompt: '' });
      }
      setIsImportModalOpen(true);
  };

  const handleSyllabusFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          const text = e.target?.result;
          if (typeof text === 'string') {
              setSyllabusText(text);
          }
      };
      reader.readAsText(file);
  };

  const handleSaveSyllabus = async () => {
      if (!syllabusText || !syllabusTargetModule) return;
      setIsSavingSyllabus(true);
      try {
          saveModuleSyllabus({
              id: syllabusTargetModule.code,
              moduleCode: syllabusTargetModule.code,
              syllabusText,
              config: syllabusConfig,
              lastUpdated: Date.now()
          });
          setIsImportModalOpen(false);
          alert(`Syllabus for ${syllabusTargetModule.title} saved successfully.`);
      } catch (e) { alert("Failed to save syllabus."); } finally { setIsSavingSyllabus(false); }
  };

  const handleOpenCreateBrief = () => { setEditingBrief({}); setBriefProgram(''); setBriefYear(''); setBriefEditorTab('general'); setIsBriefModalOpen(true); };
  const handleOpenEditBrief = (brief: AssignmentBrief) => {
      setEditingBrief(brief);
      const mod = curriculum.find(m => m.code === brief.moduleCode);
      if (mod) { setBriefProgram(mod.programTitle); setBriefYear(mod.year.toString()); }
      if (brief.deliverables && brief.deliverables.length > 0) setSelectedRubricDeliverableId(brief.deliverables[0].id);
      setBriefEditorTab('preview');
      setIsBriefModalOpen(true);
  };

  const handleGenerateBrief = async () => {
    if (!editingBrief.moduleCode || !editingBrief.title) { alert("Please select a module and enter a title first."); return; }
    setIsGeneratingBrief(true);
    try {
        const module = allDepartmentModules.find(m => m.code === editingBrief.moduleCode);
        const descriptorText = `${module?.title} covers fundamental concepts and practical applications suitable for ${module?.programTitle} Year ${module?.year}.`;
        const syllabus = moduleSyllabi.find(s => s.moduleCode === editingBrief.moduleCode);
        const contextText = syllabus ? syllabus.syllabusText : '';
        const generated = await generateBriefContent(editingBrief.title, descriptorText, editingBrief.weeks || 8, "Final Portfolio", contextText);
        setEditingBrief(prev => ({ ...prev, ...generated }));
        if (generated.deliverables && generated.deliverables.length > 0) setSelectedRubricDeliverableId(generated.deliverables[0].id);
        setBriefEditorTab('schedule');
    } catch (e: any) { alert("Failed to generate brief content."); } finally { setIsGeneratingBrief(false); }
  };

  const handleSaveBrief = (status: 'Draft' | 'Pending Approval') => {
    if (!editingBrief.moduleCode || !editingBrief.title) { alert("Brief must have a module and title."); return; }
    const newBrief: AssignmentBrief = {
        id: editingBrief.id || `brief-${Date.now()}`,
        createdAt: editingBrief.createdAt || Date.now(),
        moduleCode: editingBrief.moduleCode,
        tutorId: currentUser!.id, 
        status: status, 
        title: editingBrief.title,
        weeks: editingBrief.weeks || 8,
        startDate: editingBrief.startDate || new Date().toISOString().split('T')[0],
        learningOutcomes: editingBrief.learningOutcomes || [],
        weeklySchedule: editingBrief.weeklySchedule || [],
        finalDeliverableRequirements: editingBrief.finalDeliverableRequirements || [],
        deliverables: editingBrief.deliverables || [],
        moduleDescriptor: editingBrief.moduleDescriptor || '',
        feedback: '',
        coverImageUrl: editingBrief.coverImageUrl || ''
    };
    if (editingBrief.id) updateBrief(newBrief); else addBrief(newBrief);
    setIsBriefModalOpen(false); setEditingBrief({});
    if (status === 'Pending Approval') alert("Brief submitted to Education Manager (DRAO) for approval.");
  };

  const handleCoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 750 * 1024) { alert("File > 750KB. Please use a link or smaller image."); return; }
        const reader = new FileReader();
        reader.onloadend = () => setEditingBrief({ ...editingBrief, coverImageUrl: reader.result as string });
        reader.readAsDataURL(file);
  };

  const updateCriteria = (delId: string, criteriaId: string, field: string, value: any) => {
        const newDeliverables = [...(editingBrief.deliverables || [])];
        const delIdx = newDeliverables.findIndex(d => d.id === delId);
        if (delIdx === -1) return;
        const rubrics = [...(newDeliverables[delIdx].rubric || [])];
        const critIdx = rubrics.findIndex(r => r.id === criteriaId);
        if (critIdx === -1) return;
        
        (rubrics[critIdx] as any)[field] = value;
        newDeliverables[delIdx].rubric = rubrics;
        setEditingBrief({ ...editingBrief, deliverables: newDeliverables });
  };

  const updateLevel = (delId: string, criteriaId: string, levelIdx: number, value: string) => {
        const newDeliverables = [...(editingBrief.deliverables || [])];
        const delIdx = newDeliverables.findIndex(d => d.id === delId);
        if (delIdx === -1) return;
        const rubrics = [...(newDeliverables[delIdx].rubric || [])];
        const critIdx = rubrics.findIndex(r => r.id === criteriaId);
        if (critIdx === -1) return;

        rubrics[critIdx].levels[levelIdx].description = value;
        newDeliverables[delIdx].rubric = rubrics;
        setEditingBrief({ ...editingBrief, deliverables: newDeliverables });
    };

    const applyRubricTemplate = (templateName: string) => {
      if (!selectedRubricDeliverableId) return;
      const template = RUBRIC_TEMPLATES[templateName];
      if (!template) return;
      
      const clonedRubric = safeDeepCopy(template);
      
      const newDeliverables = [...(editingBrief.deliverables || [])];
      const delIdx = newDeliverables.findIndex(d => d.id === selectedRubricDeliverableId);
      if (delIdx === -1) return;
      
      (clonedRubric as any[]).forEach((r: any) => r.id = `crit-${Date.now()}-${Math.random()}`);
      
      newDeliverables[delIdx].rubric = clonedRubric as any;
      setEditingBrief({ ...editingBrief, deliverables: newDeliverables });
  };

  // Weekly-milestone rubric editing (Phase 1 KRA/KPI: briefs establish weekly milestones
  // WITH a rubric, so the weekly feedback form can score students against the same rubric).
  const updateWeekCriteria = (weekIdx: number, criteriaId: string, field: string, value: any) => {
      const newSchedule = [...(editingBrief.weeklySchedule || [])];
      const rubric = [...(newSchedule[weekIdx].rubric || [])];
      const critIdx = rubric.findIndex(r => r.id === criteriaId);
      if (critIdx === -1) return;
      rubric[critIdx] = { ...rubric[critIdx], [field]: value };
      newSchedule[weekIdx] = { ...newSchedule[weekIdx], rubric };
      setEditingBrief({ ...editingBrief, weeklySchedule: newSchedule });
  };

  const updateWeekLevel = (weekIdx: number, criteriaId: string, levelIdx: number, value: string) => {
      const newSchedule = [...(editingBrief.weeklySchedule || [])];
      const rubric = [...(newSchedule[weekIdx].rubric || [])];
      const critIdx = rubric.findIndex(r => r.id === criteriaId);
      if (critIdx === -1) return;
      const levels = [...rubric[critIdx].levels];
      levels[levelIdx] = { ...levels[levelIdx], description: value };
      rubric[critIdx] = { ...rubric[critIdx], levels };
      newSchedule[weekIdx] = { ...newSchedule[weekIdx], rubric };
      setEditingBrief({ ...editingBrief, weeklySchedule: newSchedule });
  };

  const applyWeekRubricTemplate = (weekIdx: number, templateName: string) => {
      const template = RUBRIC_TEMPLATES[templateName];
      if (!template) return;
      const cloned = safeDeepCopy(template);
      (cloned as any[]).forEach((r: any) => r.id = `wk-crit-${Date.now()}-${Math.random()}`);
      const newSchedule = [...(editingBrief.weeklySchedule || [])];
      newSchedule[weekIdx] = { ...newSchedule[weekIdx], rubric: cloned as any };
      setEditingBrief({ ...editingBrief, weeklySchedule: newSchedule });
  };

  const addWeekCriterion = (weekIdx: number) => {
      const newSchedule = [...(editingBrief.weeklySchedule || [])];
      const rubric = [...(newSchedule[weekIdx].rubric || [])];
      rubric.push({
          id: `wk-crit-${Date.now()}`,
          criteria: 'New Criterion',
          weightage: 0,
          levels: RUBRIC_GRADE_LEVELS.map(grade => ({ grade, description: '' })),
      });
      newSchedule[weekIdx] = { ...newSchedule[weekIdx], rubric };
      setEditingBrief({ ...editingBrief, weeklySchedule: newSchedule });
  };

  const removeWeekCriterion = (weekIdx: number, criteriaId: string) => {
      const newSchedule = [...(editingBrief.weeklySchedule || [])];
      const rubric = (newSchedule[weekIdx].rubric || []).filter(r => r.id !== criteriaId);
      newSchedule[weekIdx] = { ...newSchedule[weekIdx], rubric };
      setEditingBrief({ ...editingBrief, weeklySchedule: newSchedule });
  };

  const currentDeliverable = useMemo(() => { return (editingBrief.deliverables || []).find(d => d.id === selectedRubricDeliverableId); }, [editingBrief.deliverables, selectedRubricDeliverableId]);
  const toggleProgram = (prog: string) => { setExpandedPrograms(prev => prev.includes(prog) ? prev.filter(p => p !== prog) : [...prev, prog]); };
  const toggleYear = (progYearKey: string) => { setExpandedYears(prev => prev.includes(progYearKey) ? prev.filter(y => y !== progYearKey) : [...prev, progYearKey]); };
  const getCohortStudents = (module: Module) => users.filter(u => u.role === Role.Student && u.year === module.year && (normalizeProgram(u.programId).includes(normalizeProgram(module.programTitle)) || normalizeProgram(module.programTitle).includes(normalizeProgram(u.programId))));
  const programs = Object.keys(groupedModules).sort();
  const plannerWeeks = useMemo(() => { if (!semesterStartDate) return { allWeeks: [], monthGroups: [] }; const start = new Date(semesterStartDate); const weeks = []; const months: Record<string, number[]> = {}; for (let i = 0; i < 20; i++) { const weekStart = new Date(start); weekStart.setDate(start.getDate() + (i * 7)); const monthName = weekStart.toLocaleDateString('en-US', { month: 'long' }); if (!months[monthName]) months[monthName] = []; months[monthName].push(i + 1); weeks.push({ number: i + 1, month: monthName }); } const monthGroups = Object.entries(months).map(([name, weeks]) => ({ name, weeks })); return { allWeeks: weeks, monthGroups }; }, [semesterStartDate]);
  const plannerBatchModules = useMemo(() => { if (!selectedPlannerBatch) return []; return groupedModules[selectedPlannerBatch.program]?.[selectedPlannerBatch.year] || []; }, [selectedPlannerBatch, groupedModules]);
  const batchColorMap = useMemo(() => { const map: Record<string, any> = {}; const modulesToColor = plannerBatchModules.filter(m => m.type !== 'Non Core').sort((a, b) => a.code.localeCompare(b.code)); const step = 360 / (modulesToColor.length || 1); plannerBatchModules.forEach(m => { if (m.type === 'Non Core') { map[m.code] = { bg: '#E2E8F0', border: '#64748B', text: '#334155' }; } else { const index = modulesToColor.findIndex(cm => cm.code === m.code); const hue = Math.floor(index * step); map[m.code] = { bg: `hsl(${hue}, 85%, 92%)`, border: `hsl(${hue}, 60%, 45%)`, text: `hsl(${hue}, 75%, 25%)` }; } }); return map; }, [plannerBatchModules]);
  const plannerStats = useMemo(() => { if (!selectedPlannerBatch || !semesterStartDate) return { totalHours: 0, moduleHours: {} }; const batchEntries = semesterPlans.filter(p => p.programId === selectedPlannerBatch.program && p.year === selectedPlannerBatch.year); const moduleHours: Record<string, number> = {}; const semesterStart = new Date(semesterStartDate); batchEntries.forEach(entry => { let validDays = 0; const weekStartDate = new Date(semesterStart); weekStartDate.setDate(semesterStart.getDate() + (entry.weekNumber - 1) * 7); for (let i = 0; i < 7; i++) { const currentDay = new Date(weekStartDate); currentDay.setDate(weekStartDate.getDate() + i); const dayOfWeek = currentDay.getDay(); if (dayOfWeek !== 0 && dayOfWeek !== 6) { const dateStr = getLocalDateString(currentDay); if (!holidays.some(h => h.date === dateStr)) validDays++; } } moduleHours[entry.moduleCode] = (moduleHours[entry.moduleCode] || 0) + (validDays * 2); }); return { totalHours: Object.values(moduleHours).reduce((a, b) => a + b, 0), moduleHours }; }, [selectedPlannerBatch, semesterPlans, semesterStartDate, holidays]);
  const handlePlannerCellClick = (week: number, session: 1 | 2 | 3 | 4) => { if (!selectedPlannerBatch || !selectedPlannerModule) { alert("Select Module first."); return; } toggleSemesterPlan({ id: `${selectedPlannerBatch.program}_${selectedPlannerBatch.year}_W${week}_S${session}`, programId: selectedPlannerBatch.program, year: selectedPlannerBatch.year, weekNumber: week, sessionNumber: session, moduleCode: selectedPlannerModule }); };
  const handleClearPlan = async () => { if (selectedPlannerBatch && window.confirm("Clear plan?")) { setIsProcessing(true); await clearSemesterPlan(selectedPlannerBatch.program, selectedPlannerBatch.year); setIsProcessing(false); } };
  const weeklyTimetableData = useMemo(() => { if (!selectedTimetableBatch || !semesterStartDate) return null; const start = new Date(semesterStartDate); const weekStart = new Date(start); weekStart.setDate(start.getDate() + (timetableWeek - 1) * 7); const days = []; const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']; for (let i = 0; i < 5; i++) { const currentDay = new Date(weekStart); currentDay.setDate(weekStart.getDate() + i); const dateStr = getLocalDateString(currentDay); days.push({ name: dayNames[i], date: dateStr, displayDate: currentDay.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), isHoliday: holidays.find(h => h.date === dateStr) }); } const relevantPlans = semesterPlans.filter(p => p.programId === selectedTimetableBatch.program && p.year === selectedTimetableBatch.year && p.weekNumber === timetableWeek); const relevantEvents = customEvents.filter(e => { const inRange = days.some(d => d.date === e.date); const batchMatch = (e.programId === selectedTimetableBatch.program && e.year === selectedTimetableBatch.year); return inRange && (batchMatch || !e.programId); }); return { days, plans: relevantPlans, events: relevantEvents }; }, [selectedTimetableBatch, timetableWeek, semesterStartDate, semesterPlans, holidays, customEvents]);

  return (
    <div className="space-y-6">
         {/* ... (Existing code) ... */}
         <div className="bg-white shadow rounded-lg p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-xl font-bold text-gray-900">Department Overview</h2>
                <p className="text-sm text-gray-500 mt-1">Managing allocations and assignments for {currentSemesterType} Semester.</p>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-lg flex-wrap gap-1">
                {['overview', 'briefs', 'planner', 'timetable', 'teaching', 'attendance'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-3 py-2 text-sm font-medium rounded-md ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'} capitalize`}>{tab}</button>
                ))}
            </div>
        </div>

        {/* Modules the HOD personally teaches (allocations where they are the tutor) get the
            same dedicated weekly feedback session as any Module Tutor — HODs are held to the
            same standard, no exemption. */}
        {activeTab === 'teaching' && (
            <WeeklyFeedback title="As Module Tutor — Weekly Feedback" />
        )}

        {activeTab === 'attendance' && (
            <AttendanceWatchlist scope="department" title="Department Attendance Watchlist" />
        )}

        {activeTab === 'overview' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                {programs.length === 0 ? <div className="p-8 text-center text-gray-500">No active programs found.</div> : (
                    <ul className="divide-y divide-gray-200">
                        {programs.map((program) => (
                            <li key={program} className="bg-white">
                                <button onClick={() => toggleProgram(program)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                                    <div className="flex items-center">
                                        {expandedPrograms.includes(program) ? <ChevronDown size={20} className="text-gray-400 mr-2" /> : <ChevronRight size={20} className="text-gray-400 mr-2" />}
                                        <span className="text-lg font-medium text-gray-900">{program}</span>
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">{Object.keys(groupedModules[program]).length} Batches</span>
                                </button>
                                {expandedPrograms.includes(program) && (
                                    <ul className="bg-gray-50 border-t border-gray-100">
                                        {Object.keys(groupedModules[program]).sort().map((yearStr) => (
                                                <li key={yearStr} className="border-b border-gray-100 last:border-0">
                                                    <button onClick={() => toggleYear(`${program}-${yearStr}`)} className="w-full pl-10 pr-6 py-3 flex items-center justify-between hover:bg-gray-100">
                                                        <div className="flex items-center"><span className="text-md font-medium text-gray-700">Year {yearStr}</span></div>
                                                        <span className="text-xs text-gray-500">{groupedModules[program][parseInt(yearStr)].length} Modules</span>
                                                    </button>
                                                    {expandedYears.includes(`${program}-${yearStr}`) && (
                                                        <div className="pl-16 pr-6 pb-4 pt-2">
                                                            <div className="overflow-x-auto">
                                                                <table className="min-w-full divide-y divide-gray-200 border rounded-md">
                                                                    <thead className="bg-gray-100"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Title</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Tutor</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Room</th><th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Action</th></tr></thead>
                                                                    <tbody className="bg-white divide-y">{groupedModules[program][parseInt(yearStr)].map(m => (
                                                                        <tr key={m.code}>
                                                                            <td className="px-4 py-2 text-sm">{m.title} <span className="text-xs text-gray-400">{m.code}</span></td>
                                                                            <td className="px-4 py-2">
                                                                                <select className="text-xs border rounded p-1 w-full" value={getAssignedTutorId(m.code)} onChange={(e) => handleAssign(m.code, m.programTitle, e.target.value)}>
                                                                                    <option value="">Assign Tutor...</option>
                                                                                    {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                                                </select>
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                                <select className="text-xs border rounded p-1 w-full" value={getAssignedRoomId(m.code)} onChange={(e) => handleAssign(m.code, m.programTitle, '', e.target.value)}>
                                                                                    <option value="">Assign Room...</option>
                                                                                    {availableRooms.map(r => <option key={r.id} value={r.id}>{r.number} - {r.name}</option>)}
                                                                                </select>
                                                                            </td>
                                                                            <td className="px-4 py-2 text-center flex justify-center gap-2">
                                                                                <button onClick={() => setTrackingModule(m)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"><Eye size={16}/></button>
                                                                                <button onClick={() => handleOpenImportSyllabus(m)} className="text-teal-600 hover:bg-teal-50 p-1 rounded"><BookCopy size={16}/></button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}</tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}
                                                </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        )}

        {/* RECONSTRUCTED: this tab's body was missing from the source export (handleOpenCreateBrief,
            handleOpenEditBrief and departmentBriefs were defined above but never referenced anywhere).
            Wires those existing handlers into the Brief Creation Modal below. Please verify this
            matches the intended "Briefs" tab layout. */}
        {activeTab === 'briefs' && (
            <div className="bg-white shadow rounded-lg">
                <div className="p-6 flex justify-between items-center border-b">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Assignment Briefs</h3>
                        <p className="text-sm text-gray-500 mt-1">Create and manage briefs for department modules.</p>
                    </div>
                    <button onClick={handleOpenCreateBrief} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700 flex items-center">
                        <Plus size={16} className="mr-2" /> Create Brief
                    </button>
                </div>
                {departmentBriefs.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No briefs created yet.</div>
                ) : (
                    <ul className="divide-y divide-gray-200">
                        {departmentBriefs.slice().sort((a, b) => b.createdAt - a.createdAt).map(brief => {
                            const mod = curriculum.find(m => m.code === brief.moduleCode);
                            const statusStyle: Record<AssignmentBrief['status'], string> = {
                                'Draft': 'bg-gray-100 text-gray-600',
                                'Pending Approval': 'bg-yellow-100 text-yellow-700',
                                'Published': 'bg-green-100 text-green-700',
                                'Rejected': 'bg-red-100 text-red-700',
                            };
                            return (
                                <li key={brief.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                                    <div>
                                        <div className="font-medium text-gray-900">{brief.title}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{mod?.title || brief.moduleCode} &middot; {brief.weeks} weeks</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle[brief.status]}`}>{brief.status}</span>
                                        <button onClick={() => handleOpenEditBrief(brief)} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded"><Edit size={16} /></button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        )}

        {activeTab === 'planner' && (
            <div className="space-y-6">
                {/* Controls */}
                <div className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Semester Planner</h3>
                        <p className="text-sm text-gray-500">Plan module delivery across weeks.</p>
                    </div>
                    <div className="flex gap-4 items-center">
                        <select 
                            className="border p-2 rounded text-sm min-w-[200px]"
                            value={selectedPlannerBatch ? `${selectedPlannerBatch.program}::${selectedPlannerBatch.year}` : ''}
                            onChange={(e) => {
                                if (!e.target.value) setSelectedPlannerBatch(null);
                                else {
                                    const [p, y] = e.target.value.split('::');
                                    setSelectedPlannerBatch({ program: p, year: parseInt(y) });
                                    setSelectedPlannerModule(null);
                                }
                            }}
                        >
                            <option value="">Select Batch...</option>
                            {programs.map(p => 
                                Object.keys(groupedModules[p]).map(y => (
                                    <option key={`${p}-${y}`} value={`${p}::${y}`}>{p} - Year {y}</option>
                                ))
                            )}
                        </select>
                        {selectedPlannerBatch && (
                            <button onClick={handleClearPlan} disabled={isProcessing} className="text-red-600 text-sm hover:underline flex items-center">
                                {isProcessing ? <Loader2 className="animate-spin mr-1" size={14}/> : <Trash2 size={14} className="mr-1"/>} Clear Plan
                            </button>
                        )}
                    </div>
                </div>

                {selectedPlannerBatch ? (
                    <div className="space-y-4">
                        {/* Horizontal Module Palette */}
                        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Module Palette</h4>
                                <div className="text-xs font-mono text-gray-400">Total Planned: {plannerStats.totalHours} hrs</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {plannerBatchModules.map(m => {
                                    const syllabus = moduleSyllabi.find(s => s.moduleCode === m.code);
                                    const totalHours = syllabus?.config?.taughtHours || 40;
                                    const planned = plannerStats.moduleHours[m.code] || 0;
                                    const colors = batchColorMap[m.code] || { bg: '#f3f4f6', border: '#e5e7eb', text: '#374151' };
                                    const isSelected = selectedPlannerModule === m.code;

                                    return (
                                        <button
                                            key={m.code}
                                            onClick={() => setSelectedPlannerModule(m.code)}
                                            className={`
                                                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                                                ${isSelected ? 'ring-2 ring-offset-1 ring-indigo-500 shadow-md transform scale-105' : 'hover:shadow-sm opacity-90 hover:opacity-100'}
                                            `}
                                            style={{ 
                                                backgroundColor: colors.bg, 
                                                borderColor: colors.border,
                                                color: colors.text
                                            }}
                                        >
                                            <span className="font-bold truncate max-w-[200px]">{m.title}</span>
                                            <span className="bg-white/40 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                                {planned}/{totalHours}h
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Horizontal Scroll Grid (Sessions x Weeks) */}
                        <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                            <div className="overflow-x-auto pb-4 custom-scrollbar">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        {/* Row 1: Months */}
                                        <tr className="bg-gray-100 text-gray-600 font-bold uppercase text-xs border-b border-gray-200">
                                            <th className="sticky left-0 z-20 bg-gray-100 px-4 py-2 text-left w-32 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                Timeline
                                            </th>
                                            {plannerWeeks.monthGroups.map((month) => (
                                                <th 
                                                    key={month.name} 
                                                    colSpan={month.weeks.length} 
                                                    className="px-2 py-2 text-center border-r border-gray-200 last:border-r-0"
                                                >
                                                    {month.name}
                                                </th>
                                            ))}
                                        </tr>
                                        {/* Row 2: Weeks */}
                                        <tr className="bg-gray-50 text-gray-500 font-medium text-xs border-b border-gray-200">
                                            <th className="sticky left-0 z-20 bg-gray-50 px-4 py-2 text-left w-32 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] h-10">
                                                Sessions
                                            </th>
                                            {plannerWeeks.allWeeks.map((week) => (
                                                <th key={week.number} className="min-w-[60px] px-1 py-2 text-center border-r border-gray-100 last:border-r-0">
                                                    W{week.number}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {[1, 2, 3, 4].map((session) => (
                                            <tr key={session} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="sticky left-0 z-20 bg-white px-4 py-3 text-left border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                    <div className="font-bold text-gray-800 text-xs uppercase">Session {session}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                                        {session === 1 ? '09:00 - 11:00' : session === 2 ? '11:00 - 13:00' : session === 3 ? '14:00 - 16:00' : '16:00 - 18:00'}
                                                    </div>
                                                </td>
                                                {plannerWeeks.allWeeks.map((week) => {
                                                    const plan = semesterPlans.find(p => 
                                                        p.programId === selectedPlannerBatch.program && 
                                                        p.year === selectedPlannerBatch.year && 
                                                        p.weekNumber === week.number && 
                                                        p.sessionNumber === session
                                                    );
                                                    const moduleCode = plan?.moduleCode;
                                                    const styles = moduleCode ? batchColorMap[moduleCode] : null;

                                                    return (
                                                        <td 
                                                            key={week.number} 
                                                            onClick={() => handlePlannerCellClick(week.number, session as 1|2|3|4)}
                                                            className="p-1 border-r border-gray-100 last:border-r-0 cursor-pointer h-16 min-w-[60px] relative group"
                                                        >
                                                            {moduleCode ? (
                                                                <div 
                                                                    className="w-full h-full rounded flex flex-col items-center justify-center p-1 shadow-sm transition-transform transform hover:scale-[1.05]"
                                                                    style={{ 
                                                                        backgroundColor: styles?.bg, 
                                                                        border: `1px solid ${styles?.border}`,
                                                                        color: styles?.text
                                                                    }}
                                                                    title={`${moduleCode}`}
                                                                >
                                                                    <div className="text-[10px] font-bold truncate w-full text-center">{moduleCode}</div>
                                                                </div>
                                                            ) : (
                                                                <div className="w-full h-full rounded hover:bg-gray-100 flex items-center justify-center transition-colors group">
                                                                    {selectedPlannerModule && (
                                                                        <Plus className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" size={12}/>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <h3 className="text-gray-900 font-medium">Select a Batch to Plan</h3>
                        <p className="text-gray-500 text-sm">Choose a program and year above to start scheduling.</p>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'timetable' && (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
                        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Program</label>
                                <select 
                                    className="w-full border p-2 rounded text-sm"
                                    value={selectedTimetableBatch?.program || ''}
                                    onChange={e => {
                                        const p = e.target.value;
                                        // Find first year or reset
                                        if (p) setSelectedTimetableBatch({ program: p, year: 1 });
                                        else setSelectedTimetableBatch(null);
                                    }}
                                >
                                    <option value="">Select Program...</option>
                                    {programs.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Year</label>
                                <select 
                                    className="w-full border p-2 rounded text-sm"
                                    value={selectedTimetableBatch?.year || ''}
                                    onChange={e => setSelectedTimetableBatch(prev => prev ? { ...prev, year: parseInt(e.target.value) } : null)}
                                    disabled={!selectedTimetableBatch?.program}
                                >
                                    {selectedTimetableBatch?.program && Object.keys(groupedModules[selectedTimetableBatch.program]).map(y => (
                                        <option key={y} value={y}>Year {y}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Week</label>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setTimetableWeek(Math.max(1, timetableWeek - 1))} className="p-2 border rounded hover:bg-gray-50"><ArrowLeft size={14}/></button>
                                    <span className="flex-1 text-center font-bold text-sm bg-gray-50 py-2 rounded border">Week {timetableWeek}</span>
                                    <button onClick={() => setTimetableWeek(Math.min(20, timetableWeek + 1))} className="p-2 border rounded hover:bg-gray-50"><ArrowRight size={14}/></button>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            {/* Export buttons placeholder */}
                        </div>
                    </div>
                </div>

                {weeklyTimetableData ? (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-indigo-900 text-white">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider w-32">Day</th>
                                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider w-1/4">09:00 - 11:00</th>
                                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider w-1/4">11:00 - 13:00</th>
                                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider w-1/4">14:00 - 16:00</th>
                                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider w-1/4">16:00 - 18:00</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {weeklyTimetableData.days.map((day) => (
                                    <tr key={day.name} className={day.isHoliday ? "bg-red-50" : "hover:bg-gray-50"}>
                                        <td className="px-6 py-4 whitespace-nowrap border-r border-gray-100">
                                            <div className="text-sm font-bold text-gray-900">{day.name}</div>
                                            <div className="text-xs text-gray-500">{day.displayDate}</div>
                                            {day.isHoliday && <div className="mt-1 text-[10px] text-red-600 font-bold uppercase">{day.isHoliday.name}</div>}
                                        </td>
                                        {[1, 2, 3, 4].map(session => {
                                            const plan = weeklyTimetableData.plans.find(p => p.sessionNumber === session); // Note: Weekly Data filtering needs to be careful if we have multiple modules for same slot (conflict) - assuming valid plan
                                            // The logic in weeklyTimetableData needs to be robust. For now it returns ALL plans for that batch/week.
                                            // However, `weeklyTimetableData` calculation in the component body above didn't separate by DAY because DB structure is Weekly-Based.
                                            // IF the plan applies to every day (block teaching), we show it. 
                                            // Realistically, we need Day-Specific overrides or just assume Mon-Fri same schedule for the week in this data model unless we add `dayOfWeek` to SemesterPlanEntry.
                                            // Given the Type `SemesterPlanEntry`, it only has `weekNumber` and `sessionNumber`. This implies the plan is for the WHOLE week (e.g. "Week 1, Session 1" means Mon-Fri Session 1 is this module).
                                            
                                            // BUT wait, usually timetable varies by day. The current data model `SemesterPlanEntry` seems to define a "Week Plan" where Session 1 is Module X. This implies Module X runs all week in Session 1? Or just that's the slot?
                                            // Let's assume the user wants to see the plan. If the model is Session 1 = Module A, then for Monday Session 1 it is Module A.
                                            
                                            if (day.isHoliday) return <td key={session} className="px-6 py-4 bg-red-50/50"></td>;

                                            const module = curriculum.find(m => m.code === plan?.moduleCode);
                                            const allocation = allocations.find(a => a.moduleCode === plan?.moduleCode);
                                            const tutor = users.find(u => u.id === allocation?.tutorId);
                                            const room = rooms.find(r => r.id === (plan?.roomId || allocation?.roomId));

                                            return (
                                                <td key={session} className="px-6 py-4 border-l border-gray-100 align-top">
                                                    {plan ? (
                                                        <div className="space-y-1">
                                                            <div className="font-bold text-sm text-indigo-900">{module?.title}</div>
                                                            <div className="text-xs text-gray-600 font-mono">{plan.moduleCode}</div>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                                                                    <Users size={10} className="mr-1"/> {tutor?.name || 'TBA'}
                                                                </span>
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800">
                                                                    <MapPin size={10} className="mr-1"/> {room?.number || 'TBA'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-gray-400 italic">Free</div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded border-dashed border-2">
                        Select a batch to view the timetable.
                    </div>
                )}
            </div>
        )}

        {/* Syllabus Modal - UPDATED with File Upload */}
        {isImportModalOpen && (
            <div className="fixed z-50 inset-0 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-lg w-full max-w-2xl p-6">
                    <h3 className="text-lg font-bold mb-4">Manage Syllabus: {syllabusTargetModule?.title}</h3>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold mb-1">Module Type</label>
                                <select className="w-full border p-2 rounded text-sm" value={syllabusConfig.type} onChange={e => setSyllabusConfig({...syllabusConfig, type: e.target.value as ModuleType})}>
                                    {['Theory', 'Software Training', 'Art Workshop', 'Project', 'Hybrid'].map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="w-24">
                                <label className="block text-xs font-bold mb-1">Taught Hrs</label>
                                <input type="number" className="w-full border p-2 rounded text-sm" value={syllabusConfig.taughtHours} onChange={e => setSyllabusConfig({...syllabusConfig, taughtHours: parseInt(e.target.value)})}/>
                            </div>
                            <div className="w-24">
                                <label className="block text-xs font-bold mb-1">Self Study</label>
                                <input type="number" className="w-full border p-2 rounded text-sm" value={syllabusConfig.gilHours} onChange={e => setSyllabusConfig({...syllabusConfig, gilHours: parseInt(e.target.value)})}/>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold">Syllabus Content (Paste text or Upload)</label>
                                <button onClick={() => syllabusFileRef.current?.click()} className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                                    <Upload size={12} /> Upload File (.txt, .md)
                                </button>
                                <input type="file" ref={syllabusFileRef} className="hidden" accept=".txt,.md" onChange={handleSyllabusFileUpload} />
                            </div>
                            <textarea 
                                className="w-full h-48 border p-2 rounded text-sm font-mono text-xs" 
                                value={syllabusText} 
                                onChange={e => setSyllabusText(e.target.value)} 
                                placeholder="Paste syllabus text here..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Custom Instructions for AI</label>
                            <input className="w-full border p-2 rounded text-sm" value={syllabusConfig.customPrompt} onChange={e => setSyllabusConfig({...syllabusConfig, customPrompt: e.target.value})} placeholder="e.g. Focus heavily on practical assignments"/>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm">Cancel</button>
                            <button onClick={handleSaveSyllabus} disabled={isSavingSyllabus} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold flex items-center hover:bg-indigo-700 disabled:opacity-50">
                                {isSavingSyllabus ? <Loader2 size={14} className="animate-spin mr-2"/> : <Save size={14} className="mr-2"/>} Save Syllabus
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* BRIEF CREATION MODAL - UPDATED with Rubric Templates */}
        {isBriefModalOpen && (
            <div className="fixed z-50 inset-0 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsBriefModalOpen(false)}></div>
                    <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full h-[90vh] flex flex-col">
                         <div className="bg-white px-4 pt-5 pb-4 sm:p-6 border-b flex justify-between items-center">
                             <h3 className="text-xl font-bold text-gray-900">{editingBrief.id ? 'Edit Assignment Brief' : 'Create Assignment Brief'}</h3>
                             <div className="flex gap-2">
                                 <button onClick={() => handleSaveBrief('Draft')} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-50 flex items-center"><Save size={16} className="mr-2"/> Save Draft</button>
                                 <button onClick={() => handleSaveBrief('Pending Approval')} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700 flex items-center"><Send size={16} className="mr-2"/> Submit for Approval</button>
                                 <button onClick={()=>setIsBriefModalOpen(false)} className="text-gray-500 hover:text-gray-700 px-2"><X size={24}/></button>
                             </div>
                         </div>
                         <div className="flex-1 flex overflow-hidden">
                            <div className="w-1/2 border-r border-gray-200 flex flex-col bg-gray-50">
                                <div className="flex border-b bg-white">
                                    {[{id:'general',label:'General'},{id:'schedule',label:'Schedule'},{id:'rubric',label:'Rubric'}].map(t=>(<button key={t.id} onClick={()=>setBriefEditorTab(t.id as any)} className={`flex-1 py-3 text-sm font-medium border-b-2 ${briefEditorTab===t.id?'border-indigo-600 text-indigo-600':'border-transparent'}`}>{t.label}</button>))}
                                </div>
                                <div className="p-6 overflow-y-auto flex-1">
                                    {briefEditorTab==='general' && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold uppercase mb-1">Cover Image</label>
                                                <div className="flex gap-2 mb-2"><input className="flex-1 border p-2 rounded text-sm" placeholder="Paste Image URL..." value={editingBrief.coverImageUrl || ''} onChange={e=>setEditingBrief({...editingBrief, coverImageUrl:e.target.value})}/><button onClick={() => { if(coverImageInputRef.current) coverImageInputRef.current.click(); }} className="bg-gray-100 border text-gray-600 px-3 rounded hover:bg-gray-200"><Upload size={16}/></button><input type="file" ref={coverImageInputRef} className="hidden" accept="image/*" onChange={handleCoverImageUpload} /></div>
                                            </div>
                                            <div className="bg-indigo-50 p-4 rounded-md border border-indigo-100 mb-6">
                                                <div className="text-sm text-indigo-800 mb-2"><span className="font-bold flex items-center gap-1"><BrainCircuit size={14}/> AI Generator</span></div>
                                                <div className="flex gap-2"><input type="text" className="flex-1 border-gray-300 rounded-md text-sm p-1.5" placeholder="Enter Brief Title..." value={editingBrief.title || ''} onChange={e => setEditingBrief({...editingBrief, title: e.target.value})}/><button onClick={handleGenerateBrief} disabled={isGeneratingBrief} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">{isGeneratingBrief ? <Loader2 className="animate-spin mr-1" size={12}/> : <BrainCircuit className="mr-1" size={12}/>} Generate</button></div>
                                            </div>
                                            {/* ... (Selectors for Program/Year same as original) ... */}
                                            <div className="bg-white border rounded-lg p-4 space-y-4">
                                                 <div><label className="block text-xs font-medium text-gray-700 mb-1">Select Program</label><select className="block w-full border border-gray-300 rounded-md p-2 text-sm" value={briefProgram} onChange={(e) => { setBriefProgram(e.target.value); setBriefYear(''); setEditingBrief({...editingBrief, moduleCode: ''}); }}><option value="">-- Select Program --</option>{Object.keys(briefCreationModules).sort().map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                                                 <div>
                                                     <label className="block text-xs font-medium text-gray-700 mb-1">Select Year</label>
                                                     <select 
                                                        className="block w-full border border-gray-300 rounded-md p-2 text-sm" 
                                                        value={briefYear} 
                                                        onChange={(e) => { setBriefYear(e.target.value); setEditingBrief({...editingBrief, moduleCode: ''}); }} 
                                                        disabled={!briefProgram}
                                                     >
                                                        <option value="">-- Select Year --</option>
                                                        {briefProgram && briefCreationModules[briefProgram] && Object.keys(briefCreationModules[briefProgram]).sort().map(y => <option key={y} value={y}>Year {y}</option>)}
                                                     </select>
                                                 </div>
                                                 <div>
                                                     <label className="block text-xs font-medium text-gray-700 mb-1">Select Module</label>
                                                     <select 
                                                        className="block w-full border border-gray-300 rounded-md p-2 text-sm" 
                                                        value={editingBrief.moduleCode || ''} 
                                                        onChange={(e) => setEditingBrief({...editingBrief, moduleCode: e.target.value})} 
                                                        disabled={!briefProgram || !briefYear}
                                                     >
                                                        <option value="">-- Select Module --</option>
                                                        {briefProgram && briefYear && briefCreationModules[briefProgram]?.[parseInt(briefYear)]?.map(m => <option key={m.code} value={m.code}>{m.title} ({m.code})</option>)}
                                                     </select>
                                                 </div>
                                            </div>
                                            <div><label className="block text-xs font-bold text-gray-700 uppercase mb-1">Duration (Weeks)</label><input type="number" className="block w-full border border-gray-300 rounded-md p-2 text-sm" value={editingBrief.weeks || 8} onChange={e => setEditingBrief({...editingBrief, weeks: parseInt(e.target.value)})}/></div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Learning Outcomes</label>
                                                <textarea 
                                                    className="block w-full border border-gray-300 rounded-md p-2 text-sm h-32" 
                                                    value={editingBrief.learningOutcomes?.join('\n') || ''} 
                                                    onChange={e => setEditingBrief({...editingBrief, learningOutcomes: e.target.value.split('\n')})}
                                                    placeholder="One outcome per line..."
                                                />
                                            </div>
                                        </div>
                                     )}
                                     {briefEditorTab==='schedule' && (
                                        <div className="space-y-4">
                                            {(editingBrief.weeklySchedule || []).map((week, idx) => {
                                                const isRubricOpen = expandedRubricWeek === week.weekNumber;
                                                const rubricCount = (week.rubric || []).length;
                                                return (
                                                    <div key={idx} className="bg-white p-4 rounded border border-gray-200">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="text-xs font-bold text-gray-500 uppercase">Week {week.weekNumber}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedRubricWeek(isRubricOpen ? null : week.weekNumber)}
                                                                className={`text-[10px] font-bold px-2 py-1 rounded-full border flex items-center gap-1 ${rubricCount > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                                                            >
                                                                <Layers size={10} /> Milestone Rubric{rubricCount > 0 ? ` (${rubricCount})` : ''}
                                                            </button>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            className="block w-full border-gray-300 rounded-md p-2 text-sm font-bold mb-2"
                                                            value={week.topic}
                                                            onChange={(e) => { const newSched = [...(editingBrief.weeklySchedule || [])]; newSched[idx] = { ...newSched[idx], topic: e.target.value }; setEditingBrief({...editingBrief, weeklySchedule: newSched}); }}
                                                        />
                                                        <textarea
                                                            className="block w-full border-gray-300 rounded-md p-2 text-sm"
                                                            value={week.description}
                                                            onChange={(e) => { const newSched = [...(editingBrief.weeklySchedule || [])]; newSched[idx] = { ...newSched[idx], description: e.target.value }; setEditingBrief({...editingBrief, weeklySchedule: newSched}); }}
                                                        />

                                                        {isRubricOpen && (
                                                            <div className="mt-4 pt-4 border-t border-dashed border-gray-200 space-y-3">
                                                                <div className="flex justify-between items-center flex-wrap gap-2">
                                                                    <span className="text-[10px] font-bold text-gray-500 uppercase">This week's milestone rubric — used by the weekly feedback form</span>
                                                                    <div className="flex gap-1 flex-wrap">
                                                                        {Object.keys(RUBRIC_TEMPLATES).map(tmpl => (
                                                                            <button type="button" key={tmpl} onClick={() => applyWeekRubricTemplate(idx, tmpl)} className="text-[10px] bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-1 rounded text-gray-700">{tmpl}</button>
                                                                        ))}
                                                                        <button type="button" onClick={() => addWeekCriterion(idx)} className="text-[10px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded text-indigo-700 flex items-center gap-1"><Plus size={10}/> Criterion</button>
                                                                    </div>
                                                                </div>
                                                                {(week.rubric || []).length === 0 ? (
                                                                    <div className="text-xs text-gray-400 italic">No rubric yet — students won't be scored for this week's milestone until one is added.</div>
                                                                ) : (
                                                                    (week.rubric || []).map((criteria) => (
                                                                        <div key={criteria.id} className="border rounded-lg p-3 bg-gray-50">
                                                                            <div className="flex justify-between mb-2">
                                                                                <input
                                                                                    className="font-bold text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-2/3"
                                                                                    value={criteria.criteria}
                                                                                    onChange={(e) => updateWeekCriteria(idx, criteria.id, 'criteria', e.target.value)}
                                                                                />
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-xs text-gray-500">Weight:</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        className="w-12 text-xs border rounded p-1 text-center"
                                                                                        value={criteria.weightage}
                                                                                        onChange={(e) => updateWeekCriteria(idx, criteria.id, 'weightage', parseInt(e.target.value))}
                                                                                    />
                                                                                    <span className="text-xs text-gray-500">%</span>
                                                                                    <button type="button" onClick={() => removeWeekCriterion(idx, criteria.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={12}/></button>
                                                                                </div>
                                                                            </div>
                                                                            <div className="grid grid-cols-5 gap-1 mt-2">
                                                                                {criteria.levels.map((level, lIdx) => (
                                                                                    <div key={lIdx} className="text-[10px] p-1 bg-white border rounded">
                                                                                        <div className="font-bold text-indigo-700">{level.grade}</div>
                                                                                        <textarea
                                                                                            className="w-full h-16 border-none resize-none text-[9px] text-gray-600 focus:ring-0 bg-transparent mt-1"
                                                                                            value={level.description}
                                                                                            onChange={(e) => updateWeekLevel(idx, criteria.id, lIdx, e.target.value)}
                                                                                        />
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                     )}
                                     {briefEditorTab === 'rubric' && (
                                        <div className="space-y-6">
                                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                                {(editingBrief.deliverables || []).map((d) => (
                                                    <button
                                                        key={d.id}
                                                        onClick={() => setSelectedRubricDeliverableId(d.id)}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border ${selectedRubricDeliverableId === d.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                                    >
                                                        {d.title} (W{d.weekNumber})
                                                    </button>
                                                ))}
                                            </div>
                                            
                                            {currentDeliverable ? (
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <h4 className="font-bold text-sm text-gray-800">Criteria for {currentDeliverable.title}</h4>
                                                        <div className="flex gap-2">
                                                            <span className="text-xs font-bold text-gray-500 self-center mr-1">Templates:</span>
                                                            {Object.keys(RUBRIC_TEMPLATES).map(tmpl => (
                                                                <button 
                                                                    key={tmpl}
                                                                    onClick={() => applyRubricTemplate(tmpl)}
                                                                    className="text-[10px] bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-1 rounded text-gray-700"
                                                                >
                                                                    {tmpl}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {currentDeliverable.rubric?.map((criteria, cIdx) => (
                                                        <div key={criteria.id} className="border rounded-lg p-3 bg-gray-50">
                                                            <div className="flex justify-between mb-2">
                                                                <input 
                                                                    className="font-bold text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-2/3"
                                                                    value={criteria.criteria}
                                                                    onChange={(e) => updateCriteria(currentDeliverable.id, criteria.id, 'criteria', e.target.value)}
                                                                />
                                                                <div className="flex items-center">
                                                                    <span className="text-xs text-gray-500 mr-2">Weight:</span>
                                                                    <input 
                                                                        type="number" 
                                                                        className="w-12 text-xs border rounded p-1 text-center"
                                                                        value={criteria.weightage}
                                                                        onChange={(e) => updateCriteria(currentDeliverable.id, criteria.id, 'weightage', parseInt(e.target.value))}
                                                                    />
                                                                    <span className="text-xs text-gray-500 ml-1">%</span>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-5 gap-1 mt-2">
                                                                {criteria.levels.map((level, lIdx) => (
                                                                    <div key={lIdx} className="text-[10px] p-1 bg-white border rounded">
                                                                        <div className="font-bold text-indigo-700">{level.grade}</div>
                                                                        <textarea 
                                                                            className="w-full h-16 border-none resize-none text-[9px] text-gray-600 focus:ring-0 bg-transparent mt-1"
                                                                            value={level.description}
                                                                            onChange={(e) => updateLevel(currentDeliverable.id, criteria.id, lIdx, e.target.value)}
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center text-gray-500 py-10">Select a deliverable to view its rubric.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                             </div>
                             <div className="w-1/2 bg-white p-8 overflow-y-auto">
                                 {/* Preview Section */}
                                 {editingBrief.coverImageUrl && (
                                     <div className="w-full h-40 bg-gray-100 rounded-lg overflow-hidden mb-6 border">
                                         <img src={editingBrief.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                                     </div>
                                 )}
                                 <h2 className="text-2xl font-bold mb-4">{editingBrief.title}</h2>
                                 <div className="space-y-6">
                                     {editingBrief.learningOutcomes && editingBrief.learningOutcomes.length > 0 && (
                                         <section>
                                             <h3 className="font-bold text-gray-500 uppercase text-xs mb-2">Learning Outcomes</h3>
                                             <ul className="list-disc pl-4 text-sm space-y-1">
                                                 {editingBrief.learningOutcomes.map((lo, i) => <li key={i}>{lo}</li>)}
                                             </ul>
                                         </section>
                                     )}
                                     <section><h3 className="font-bold text-gray-500 uppercase text-xs mb-2">Schedule</h3><div className="space-y-2">{(editingBrief.weeklySchedule||[]).map((w,i)=><div key={i} className="text-sm border-l-2 border-gray-200 pl-3"><span className="font-bold text-indigo-600">Week {w.weekNumber}:</span> {w.topic}</div>)}</div></section>
                                     {editingBrief.deliverables && (
                                         <section>
                                             <h3 className="font-bold text-gray-500 uppercase text-xs mb-2">Deliverables</h3>
                                             <div className="space-y-2">
                                                 {editingBrief.deliverables.map(d => (
                                                     <div key={d.id} className="text-sm bg-gray-50 p-2 rounded border">
                                                         <span className="font-bold">Week {d.weekNumber}:</span> {d.title} ({d.type})
                                                     </div>
                                                 ))}
                                             </div>
                                         </section>
                                     )}
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
            )}
    </div>
  );
};
