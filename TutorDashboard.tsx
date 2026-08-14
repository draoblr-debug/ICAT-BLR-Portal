
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from './AppContext';
import { AssignmentBrief, Module, Role, Submission, AttendanceRecord, LessonPlan, LessonChunk, LessonActivityType, AIClassModule, AISlide, AIQuizQuestion, ModuleContext, ModuleType, KpiResult } from './types';
import { getLocalDateString, normalizeProgram, RUBRIC_GRADE_LEVELS } from './data';
import { generateBriefContent, generateGradingFeedback, generateLessonPlan, generateChunkSmartContent } from './geminiService';
import { Plus, CheckCircle, BrainCircuit, FileText, Clock, BookOpen, ArrowLeft, X, Check, ArrowRight, Loader2, Upload, Save, Send, ChevronDown, ChevronUp, Sliders, Trash2, LayoutList, Timer, Sparkles, PlayCircle, Edit, RefreshCw, Eye, EyeOff, Info, BookCopy, XCircle, Image as ImageIcon } from 'lucide-react';
import { LiveClassSession } from './LiveClassSession';
import { WeeklyFeedback } from './WeeklyFeedback';
import { AttendanceWatchlist } from './AttendanceWatchlist';
import { KpiGrid } from './KpiGrid';
import { calculateModuleTutorKpis } from './kpiService';

// Grading Constants
const GRADE_RANGES = [
    { label: 'Poor', min: 0, max: 39, color: 'bg-red-100 text-red-800 border-red-200', activeColor: 'bg-red-600 text-white border-red-600' },
    { label: 'Average', min: 40, max: 59, color: 'bg-orange-100 text-orange-800 border-orange-200', activeColor: 'bg-orange-500 text-white border-orange-500' },
    { label: 'Good', min: 60, max: 74, color: 'bg-yellow-100 text-yellow-800 border-yellow-200', activeColor: 'bg-yellow-500 text-white border-yellow-500' },
    { label: 'Very Good', min: 75, max: 89, color: 'bg-blue-100 text-blue-800 border-blue-200', activeColor: 'bg-blue-600 text-white border-blue-600' },
    { label: 'Excellent', min: 90, max: 100, color: 'bg-green-100 text-green-800 border-green-200', activeColor: 'bg-green-600 text-white border-green-600' }
];

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

const ACTIVITY_TYPES: LessonActivityType[] = ['Lecture', 'Quiz', 'Interaction', 'Demo', 'Screening', 'Group Discussion', 'Class Work', 'Break'];

// Helper to safely deep copy simple data objects without crashing on cycles
const safeDeepCopy = <T,>(obj: T): T => {
    try {
        return structuredClone(obj);
    } catch (e) {
        // Fallback for non-cloneable objects or legacy environments: simple JSON copy
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (jsonError) {
            console.error("Deep copy failed (circular ref or invalid object), returning shallow copy", jsonError);
            // Last resort: shallow copy or null if it's not an object
            return (typeof obj === 'object' && obj !== null) ? { ...obj } : obj;
        }
    }
};

const SmartContentEditor = ({ module, onSave, onClose }: { module: AIClassModule, onSave: (m: AIClassModule) => void, onClose: () => void }) => {
    // Initialize with safe copy
    const [localModule, setLocalModule] = useState<AIClassModule>(() => safeDeepCopy(module));
    
    const [activeTab, setActiveTab] = useState<'slides' | 'quiz' | 'notes'>('slides');
    const [selectedSlideIdx, setSelectedSlideIdx] = useState(0);
    const [selectedQuestionIdx, setSelectedQuestionIdx] = useState(0);

    const handleSave = () => {
        onSave(localModule);
    };

    const getVisualUrl = (keyword: string) => {
        if (!keyword) return '';
        if (keyword.startsWith('http') || keyword.startsWith('data:')) return keyword;
        return `https://image.pollinations.ai/prompt/${encodeURIComponent(keyword)}`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white w-full max-w-5xl h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Sparkles className="text-indigo-600" size={18}/> Edit Smart Content</h3>
                        <p className="text-xs text-gray-500">{localModule.topic}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-md text-sm font-medium">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-md text-sm font-medium flex items-center"><Save size={16} className="mr-2"/> Save Changes</button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b bg-white">
                    <button onClick={() => setActiveTab('slides')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'slides' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Slides ({localModule.slides.length})</button>
                    <button onClick={() => setActiveTab('quiz')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'quiz' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Quiz ({localModule.postQuiz.length})</button>
                    <button onClick={() => setActiveTab('notes')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'notes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Notes</button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden bg-gray-50 p-6">
                    {activeTab === 'slides' && (
                        <div className="flex h-full gap-6">
                            {/* Slide List */}
                            <div className="w-1/4 bg-white rounded-lg border overflow-y-auto flex flex-col">
                                {localModule.slides.map((slide, idx) => (
                                    <button 
                                        key={slide.id} 
                                        onClick={() => setSelectedSlideIdx(idx)}
                                        className={`p-3 text-left border-b last:border-b-0 hover:bg-gray-50 transition-colors ${selectedSlideIdx === idx ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''}`}
                                    >
                                        <div className="text-xs font-bold text-gray-500 mb-1">Slide {idx + 1}</div>
                                        <div className="text-sm font-medium truncate">{slide.title}</div>
                                    </button>
                                ))}
                                <button 
                                    onClick={() => {
                                        const newSlide: AISlide = { id: `s-${Date.now()}`, title: 'New Slide', bulletPoints: ['Point 1'], speakerNotes: '', visualKeyword: 'abstract technology' };
                                        setLocalModule({...localModule, slides: [...localModule.slides, newSlide]});
                                        setSelectedSlideIdx(localModule.slides.length);
                                    }}
                                    className="p-3 text-center text-indigo-600 font-bold text-sm hover:bg-indigo-50"
                                >
                                    + Add Slide
                                </button>
                            </div>
                            
                            {/* Editor */}
                            {localModule.slides[selectedSlideIdx] && (
                                <div className="flex-1 bg-white rounded-lg border p-6 overflow-y-auto space-y-4 shadow-sm flex flex-col">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-bold text-gray-700">Slide {selectedSlideIdx + 1} Editor</h4>
                                        <button 
                                            onClick={() => {
                                                const newSlides = localModule.slides.filter((_, i) => i !== selectedSlideIdx);
                                                setLocalModule({...localModule, slides: newSlides});
                                                setSelectedSlideIdx(Math.max(0, selectedSlideIdx - 1));
                                            }}
                                            className="text-red-500 hover:text-red-700 text-xs font-bold"
                                        >
                                            Delete Slide
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Title</label>
                                            <input 
                                                className="w-full border p-2 rounded text-sm font-bold" 
                                                value={localModule.slides[selectedSlideIdx].title}
                                                onChange={e => {
                                                    const newSlides = [...localModule.slides];
                                                    newSlides[selectedSlideIdx].title = e.target.value;
                                                    setLocalModule({...localModule, slides: newSlides});
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Visual (Image URL or Keyword)</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    className="flex-1 border p-2 rounded text-xs text-gray-600" 
                                                    value={localModule.slides[selectedSlideIdx].visualKeyword}
                                                    onChange={e => {
                                                        const newSlides = [...localModule.slides];
                                                        newSlides[selectedSlideIdx].visualKeyword = e.target.value;
                                                        setLocalModule({...localModule, slides: newSlides});
                                                    }}
                                                    placeholder="Enter URL (https://...) or Keyword for AI generation"
                                                />
                                            </div>
                                            <div className="mt-2 h-40 bg-gray-100 rounded border overflow-hidden relative group">
                                                <img 
                                                    src={getVisualUrl(localModule.slides[selectedSlideIdx].visualKeyword)} 
                                                    className="w-full h-full object-cover" 
                                                    alt="Slide Visual"
                                                    onError={(e) => (e.currentTarget.src = "https://placehold.co/600x400?text=Invalid+Image")}
                                                />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity pointer-events-none">
                                                    Preview
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Bullet Points (One per line)</label>
                                            <textarea 
                                                className="w-full border p-2 rounded text-sm h-32" 
                                                value={localModule.slides[selectedSlideIdx].bulletPoints.join('\n')}
                                                onChange={e => {
                                                    const newSlides = [...localModule.slides];
                                                    newSlides[selectedSlideIdx].bulletPoints = e.target.value.split('\n');
                                                    setLocalModule({...localModule, slides: newSlides});
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Speaker Notes</label>
                                            <textarea 
                                                className="w-full border p-2 rounded text-sm h-24 bg-yellow-50" 
                                                value={localModule.slides[selectedSlideIdx].speakerNotes}
                                                onChange={e => {
                                                    const newSlides = [...localModule.slides];
                                                    newSlides[selectedSlideIdx].speakerNotes = e.target.value;
                                                    setLocalModule({...localModule, slides: newSlides});
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'quiz' && (
                        <div className="flex h-full gap-6">
                            {/* Question List */}
                            <div className="w-1/4 bg-white rounded-lg border overflow-y-auto flex flex-col">
                                {localModule.postQuiz.map((q, idx) => (
                                    <button 
                                        key={q.id} 
                                        onClick={() => setSelectedQuestionIdx(idx)}
                                        className={`p-3 text-left border-b last:border-b-0 hover:bg-gray-50 transition-colors ${selectedQuestionIdx === idx ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''}`}
                                    >
                                        <div className="text-xs font-bold text-gray-500 mb-1">Question {idx + 1}</div>
                                        <div className="text-sm font-medium truncate">{q.question}</div>
                                    </button>
                                ))}
                                <button 
                                    onClick={() => {
                                        const newQ: AIQuizQuestion = { id: `q-${Date.now()}`, question: 'New Question', options: ['Option 1', 'Option 2'], correctIndex: 0, exposeToStudent: false };
                                        setLocalModule({...localModule, postQuiz: [...localModule.postQuiz, newQ]});
                                        setSelectedQuestionIdx(localModule.postQuiz.length);
                                    }}
                                    className="p-3 text-center text-indigo-600 font-bold text-sm hover:bg-indigo-50"
                                >
                                    + Add Question
                                </button>
                            </div>

                            {/* Editor */}
                            {localModule.postQuiz[selectedQuestionIdx] && (
                                <div className="flex-1 bg-white rounded-lg border p-6 overflow-y-auto space-y-4 shadow-sm">
                                    <div className="flex justify-between">
                                        <h4 className="font-bold text-gray-700">Question {selectedQuestionIdx + 1} Editor</h4>
                                        <button 
                                            onClick={() => {
                                                const newQuiz = localModule.postQuiz.filter((_, i) => i !== selectedQuestionIdx);
                                                setLocalModule({...localModule, postQuiz: newQuiz});
                                                setSelectedQuestionIdx(Math.max(0, selectedQuestionIdx - 1));
                                            }}
                                            className="text-red-500 hover:text-red-700 text-xs font-bold"
                                        >
                                            Delete Question
                                        </button>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Question Text</label>
                                        <input 
                                            className="w-full border p-2 rounded text-sm font-bold" 
                                            value={localModule.postQuiz[selectedQuestionIdx].question}
                                            onChange={e => {
                                                const newQuiz = [...localModule.postQuiz];
                                                newQuiz[selectedQuestionIdx].question = e.target.value;
                                                setLocalModule({...localModule, postQuiz: newQuiz});
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2">Options</label>
                                        <div className="space-y-2">
                                            {localModule.postQuiz[selectedQuestionIdx].options.map((opt, oIdx) => (
                                                <div key={oIdx} className="flex gap-2 items-center">
                                                    <input 
                                                        type="radio" 
                                                        name="correctOption" 
                                                        checked={localModule.postQuiz[selectedQuestionIdx].correctIndex === oIdx}
                                                        onChange={() => {
                                                            const newQuiz = [...localModule.postQuiz];
                                                            newQuiz[selectedQuestionIdx].correctIndex = oIdx;
                                                            setLocalModule({...localModule, postQuiz: newQuiz});
                                                        }}
                                                    />
                                                    <input 
                                                        className="flex-1 border p-2 rounded text-sm"
                                                        value={opt}
                                                        onChange={e => {
                                                            const newQuiz = [...localModule.postQuiz];
                                                            newQuiz[selectedQuestionIdx].options[oIdx] = e.target.value;
                                                            setLocalModule({...localModule, postQuiz: newQuiz});
                                                        }}
                                                    />
                                                    <button 
                                                        onClick={() => {
                                                            const newQuiz = [...localModule.postQuiz];
                                                            newQuiz[selectedQuestionIdx].options = newQuiz[selectedQuestionIdx].options.filter((_, i) => i !== oIdx);
                                                            if (newQuiz[selectedQuestionIdx].correctIndex >= oIdx) newQuiz[selectedQuestionIdx].correctIndex = Math.max(0, newQuiz[selectedQuestionIdx].correctIndex - 1);
                                                            setLocalModule({...localModule, postQuiz: newQuiz});
                                                        }}
                                                        className="text-gray-400 hover:text-red-500"
                                                    ><X size={14}/></button>
                                                </div>
                                            ))}
                                            <button 
                                                onClick={() => {
                                                    const newQuiz = [...localModule.postQuiz];
                                                    newQuiz[selectedQuestionIdx].options.push(`Option ${newQuiz[selectedQuestionIdx].options.length + 1}`);
                                                    setLocalModule({...localModule, postQuiz: newQuiz});
                                                }}
                                                className="text-xs text-indigo-600 font-bold ml-6"
                                            >
                                                + Add Option
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className="h-full bg-white rounded-lg border p-4">
                            <textarea 
                                className="w-full h-full resize-none outline-none text-sm leading-relaxed"
                                value={localModule.notes}
                                onChange={e => setLocalModule({...localModule, notes: e.target.value})}
                                placeholder="Enter lecture notes, reading materials, or instructions here..."
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const TutorDashboard = () => {
    const appState = useApp();
    const { currentUser, curriculum, allocations, briefs, addBrief, updateBrief, submissions, updateSubmission, users, semesterPlans, semesterStartDate, holidays, attendance, markAttendance, lessonPlans, addLessonPlan, updateLessonPlan, moduleSyllabi, rooms, addAiModule, aiModules, updateAiModule, deleteAiModule, saveModuleSyllabus } = appState;
    const [activeTab, setActiveTab] = useState<'assigned_modules' | 'grading' | 'attendance' | 'weekly_feedback' | 'watchlist' | 'kpis'>('assigned_modules');
    const [tutorKpis, setTutorKpis] = useState<KpiResult[]>([]);
    const [isLoadingKpis, setIsLoadingKpis] = useState(false);

    useEffect(() => {
        if (activeTab !== 'kpis' || !currentUser) return;
        setIsLoadingKpis(true);
        calculateModuleTutorKpis(currentUser.id, appState).then(result => {
            setTutorKpis(result);
            setIsLoadingKpis(false);
        });
    }, [activeTab, currentUser, appState]);

    // --- Module Management State ---
    const [selectedModule, setSelectedModule] = useState<Module | null>(null);
    const [moduleView, setModuleView] = useState<'list' | 'briefs' | 'lesson_planner'>('list');

    // --- State for Briefs ---
    const [isBriefModalOpen, setIsBriefModalOpen] = useState(false);
    const [editingBrief, setEditingBrief] = useState<Partial<AssignmentBrief>>({});
    const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
    const [briefEditorTab, setBriefEditorTab] = useState<'general' | 'schedule' | 'rubric' | 'preview'>('general');
    const [selectedRubricDeliverableId, setSelectedRubricDeliverableId] = useState<string>('');
    const [expandedRubricWeek, setExpandedRubricWeek] = useState<number | null>(null);
    const coverImageInputRef = useRef<HTMLInputElement>(null);

    // --- Syllabus State ---
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [syllabusTargetModule, setSyllabusTargetModule] = useState<Module | null>(null);
    const [syllabusText, setSyllabusText] = useState('');
    const [syllabusConfig, setSyllabusConfig] = useState<ModuleContext>({ type: 'Theory', taughtHours: 40, gilHours: 20, customPrompt: '' });
    const [isSavingSyllabus, setIsSavingSyllabus] = useState(false);
    const syllabusFileRef = useRef<HTMLInputElement>(null);

    // --- State for Grading ---
    const [selectedBriefForGrading, setSelectedBriefForGrading] = useState<AssignmentBrief | null>(null);
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
    const [gradingValues, setGradingValues] = useState<Record<string, number>>({});
    const [gradingFeedback, setGradingFeedback] = useState('');
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);

    // --- State for Attendance ---
    const [attendanceDate, setAttendanceDate] = useState(getLocalDateString());
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [attendanceStatus, setAttendanceStatus] = useState<Record<string, boolean>>({}); 

    // --- State for Lesson Planner ---
    const [selectedSequence, setSelectedSequence] = useState<number | null>(null);
    const [editingLessonPlan, setEditingLessonPlan] = useState<LessonPlan | null>(null);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
    const [generatingChunkId, setGeneratingChunkId] = useState<string | null>(null);
    const [editingContentId, setEditingContentId] = useState<string | null>(null);
    const [previewContentId, setPreviewContentId] = useState<string | null>(null);

    const myModules = useMemo(() => {
        if (!currentUser) return [];
        const myAllocations = allocations.filter(a => a.tutorId === currentUser.id);
        const codes = myAllocations.map(a => a.moduleCode);
        return curriculum.filter(m => codes.includes(m.code));
    }, [currentUser, allocations, curriculum]);

    const myBriefs = useMemo(() => {
        const myCodes = myModules.map(m => m.code);
        return briefs.filter(b => myCodes.includes(b.moduleCode));
    }, [briefs, myModules]);

    // --- Handlers for Briefs ---
    const applyRubricTemplate = (templateName: string) => {
        if (!selectedRubricDeliverableId) return;
        const template = RUBRIC_TEMPLATES[templateName];
        if (!template) return;
        
        // Use structuredClone for safe deep copy of rubric templates
        const clonedRubric = safeDeepCopy(template);
        
        const newDeliverables = [...(editingBrief.deliverables || [])];
        const delIdx = newDeliverables.findIndex(d => d.id === selectedRubricDeliverableId);
        if (delIdx === -1) return;
        (clonedRubric as any[]).forEach((r: any) => r.id = `crit-${Date.now()}-${Math.random()}`);
        newDeliverables[delIdx].rubric = clonedRubric as any;
        setEditingBrief({ ...editingBrief, deliverables: newDeliverables });
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

    const currentDeliverable = useMemo(() => {
        return (editingBrief.deliverables || []).find(d => d.id === selectedRubricDeliverableId);
    }, [editingBrief.deliverables, selectedRubricDeliverableId]);

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

    const handleCoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 750 * 1024) { alert("File > 750KB. Please use a link or smaller image."); return; }
        const reader = new FileReader();
        reader.onloadend = () => setEditingBrief({ ...editingBrief, coverImageUrl: reader.result as string });
        reader.readAsDataURL(file);
    };

    const handleGenerateBrief = async () => {
        if (!editingBrief.moduleCode || !editingBrief.title) { alert("Please select a module and enter a title first."); return; }
        setIsGeneratingBrief(true);
        try {
            const module = myModules.find(m => m.code === editingBrief.moduleCode);
            const descriptorText = `${module?.title} covers fundamental concepts suitable for ${module?.programTitle}.`;
            const generated = await generateBriefContent(editingBrief.title, descriptorText, editingBrief.weeks || 8, "Final Submission");
            setEditingBrief(prev => ({ ...prev, ...generated }));
            if (generated.deliverables && generated.deliverables.length > 0) setSelectedRubricDeliverableId(generated.deliverables[0].id);
            setBriefEditorTab('schedule');
        } catch (e) { alert("Failed to generate brief content."); } finally { setIsGeneratingBrief(false); }
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
            coverImageUrl: editingBrief.coverImageUrl || ''
        };
        if (editingBrief.id) updateBrief(newBrief); else addBrief(newBrief);
        setIsBriefModalOpen(false); setEditingBrief({});
        if (status === 'Pending Approval') alert("Brief submitted for approval.");
    };

    // --- Syllabus Handlers ---
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

    // --- LESSON PLANNER HANDLERS ---
    const handleSelectSession = (seq: number) => {
        const existing = lessonPlans.find(p => p.moduleCode === selectedModule?.code && p.sequence === seq);
        if (existing) {
            setEditingLessonPlan(existing);
        } else {
            // Create draft shell
            setEditingLessonPlan({
                id: `lp-${selectedModule?.code}-${seq}-${Date.now()}`,
                moduleCode: selectedModule!.code,
                tutorId: currentUser!.id,
                sequence: seq,
                topic: '',
                chunks: [],
                efficiency: { cognitiveLoad: 5, interactivityLevel: 5, goalAlignment: 5, notes: '' },
                createdAt: Date.now(),
                status: 'Draft'
            });
        }
        setSelectedSequence(seq);
    };

    const handleAutoPlanSession = async () => {
        if (!editingLessonPlan || !selectedModule) return;
        setIsGeneratingPlan(true);
        try {
            // Find syllabus context
            const syllabus = moduleSyllabi.find(s => s.moduleCode === selectedModule.code);
            const chunks = await generateLessonPlan(editingLessonPlan.topic, 60, syllabus?.config); // Default 60 min session
            setEditingLessonPlan({ ...editingLessonPlan, chunks });
        } catch (e) {
            alert("Failed to auto-generate plan.");
        } finally {
            setIsGeneratingPlan(false);
        }
    };

    const handleSaveLessonPlan = () => {
        if (!editingLessonPlan) return;
        if (lessonPlans.some(p => p.id === editingLessonPlan.id)) {
            updateLessonPlan(editingLessonPlan);
        } else {
            addLessonPlan(editingLessonPlan);
        }
        alert("Lesson Plan saved.");
    };

    const handleAddChunk = () => {
        if (!editingLessonPlan) return;
        const newChunk: LessonChunk = {
            id: `chunk-${Date.now()}`,
            duration: 10,
            activity: 'Lecture',
            content: '',
            objective: ''
        };
        setEditingLessonPlan({ ...editingLessonPlan, chunks: [...editingLessonPlan.chunks, newChunk] });
    };

    const updateChunk = (idx: number, field: keyof LessonChunk, value: any) => {
        if (!editingLessonPlan) return;
        const newChunks = [...editingLessonPlan.chunks];
        newChunks[idx] = { ...newChunks[idx], [field]: value };
        setEditingLessonPlan({ ...editingLessonPlan, chunks: newChunks });
    };

    const deleteChunk = (idx: number) => {
        if (!editingLessonPlan) return;
        const newChunks = editingLessonPlan.chunks.filter((_, i) => i !== idx);
        setEditingLessonPlan({ ...editingLessonPlan, chunks: newChunks });
    };

    const handleGenerateChunkContent = async (chunk: LessonChunk, idx: number) => {
        if (!editingLessonPlan || !selectedModule) return;
        setGeneratingChunkId(chunk.id);
        try {
            const smartContent = await generateChunkSmartContent(chunk.activity, chunk.content, selectedModule.title, chunk.duration);
            // Create AI Module
            const aiMod: AIClassModule = {
                id: chunk.aiModuleId || `ai-${Date.now()}`, // Reuse ID if regenerating
                topic: chunk.content || editingLessonPlan.topic,
                moduleCode: selectedModule.code,
                tutorId: currentUser!.id,
                createdAt: Date.now(),
                slides: smartContent.slides || [],
                preQuiz: smartContent.preQuiz || [],
                postQuiz: smartContent.postQuiz || [],
                notes: smartContent.notes || '',
                quizConfig: { pre: 'Basic', post: 'Basic' },
                generatedContent: smartContent.generatedContent
            };
            if (chunk.aiModuleId) {
                updateAiModule(aiMod);
            } else {
                addAiModule(aiMod);
                // Link to chunk
                updateChunk(idx, 'aiModuleId', aiMod.id);
            }
        } catch (e) {
            alert("Failed to generate content.");
        } finally {
            setGeneratingChunkId(null);
        }
    };

    const handleClearChunkContent = (idx: number) => {
        if (!editingLessonPlan) return;
        if (confirm("Are you sure you want to clear the AI content for this chunk? This cannot be undone.")) {
            const chunk = editingLessonPlan.chunks[idx];
            if (chunk.aiModuleId) {
                deleteAiModule(chunk.aiModuleId);
            }
            updateChunk(idx, 'aiModuleId', undefined);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Navigation */}
            <div className="bg-white shadow rounded-lg p-2 flex gap-2 w-fit">
                <button onClick={() => setActiveTab('assigned_modules')} className={`px-4 py-2 rounded text-sm font-medium ${activeTab === 'assigned_modules' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>My Modules</button>
                <button onClick={() => setActiveTab('grading')} className={`px-4 py-2 rounded text-sm font-medium ${activeTab === 'grading' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Grading Stack</button>
                <button onClick={() => setActiveTab('attendance')} className={`px-4 py-2 rounded text-sm font-medium ${activeTab === 'attendance' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Attendance</button>
                <button onClick={() => setActiveTab('weekly_feedback')} className={`px-4 py-2 rounded text-sm font-medium ${activeTab === 'weekly_feedback' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Weekly Feedback</button>
                <button onClick={() => setActiveTab('watchlist')} className={`px-4 py-2 rounded text-sm font-medium ${activeTab === 'watchlist' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Watchlist</button>
                <button onClick={() => setActiveTab('kpis')} className={`px-4 py-2 rounded text-sm font-medium ${activeTab === 'kpis' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>KPIs</button>
            </div>

            {activeTab === 'kpis' && (
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">My KRA/KPI Scorecard</h3>
                    <p className="text-sm text-gray-500 mb-4">16 Module Tutor KPIs, computed live from your modules, briefs, sessions and attendance.</p>
                    <KpiGrid kpis={tutorKpis} isLoading={isLoadingKpis} />
                </div>
            )}

            {activeTab === 'weekly_feedback' && <WeeklyFeedback title="Weekly Module Feedback" />}
            {activeTab === 'watchlist' && <AttendanceWatchlist scope="my-modules" title="Attendance Watchlist" />}

            {/* Content Area */}
            {activeTab === 'assigned_modules' && !selectedModule && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myModules.map(module => (
                        <div key={module.code} onClick={() => { setSelectedModule(module); setModuleView('list'); }} className="bg-white p-6 rounded-lg shadow hover:shadow-md cursor-pointer border border-transparent hover:border-indigo-500 transition-all">
                            <h3 className="font-bold text-lg text-gray-900">{module.title}</h3>
                            <p className="text-sm text-gray-500 mb-4">{module.code} • Year {module.year}</p>
                            <div className="flex justify-between items-center text-xs text-gray-400">
                                <span>{myBriefs.filter(b => b.moduleCode === module.code).length} Briefs</span>
                                <ArrowRight size={16}/>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'assigned_modules' && selectedModule && (
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSelectedModule(null)} className="p-2 hover:bg-gray-200 rounded-full"><ArrowLeft size={20}/></button>
                        <h2 className="text-xl font-bold text-gray-900">{selectedModule.title}</h2>
                        <div className="flex bg-white rounded-lg shadow-sm p-1 ml-auto">
                            <button onClick={() => handleOpenImportSyllabus(selectedModule)} className="px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded flex items-center gap-1 border-r mr-2"><BookCopy size={14}/> Manage Syllabus</button>
                            <button onClick={() => setModuleView('list')} className={`px-4 py-1.5 text-sm rounded ${moduleView === 'list' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-500'}`}>Overview</button>
                            <button onClick={() => setModuleView('briefs')} className={`px-4 py-1.5 text-sm rounded ${moduleView === 'briefs' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-500'}`}>Briefs</button>
                            <button onClick={() => setModuleView('lesson_planner')} className={`px-4 py-1.5 text-sm rounded ${moduleView === 'lesson_planner' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-500'}`}>Lesson Planner</button>
                        </div>
                    </div>

                    {moduleView === 'briefs' && (
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <h3 className="text-lg font-bold">Assignment Briefs</h3>
                                <button onClick={() => { setEditingBrief({ moduleCode: selectedModule.code }); setBriefEditorTab('general'); setIsBriefModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2"><Plus size={16}/> Create Brief</button>
                            </div>
                            {myBriefs.filter(b => b.moduleCode === selectedModule.code).map(brief => (
                                <div key={brief.id} className="bg-white p-4 rounded-lg shadow border flex justify-between items-center">
                                    <div>
                                        <div className="font-bold">{brief.title}</div>
                                        <div className="text-xs text-gray-500">{brief.status} • {brief.weeks} Weeks</div>
                                    </div>
                                    <button onClick={() => { setEditingBrief(brief); setBriefEditorTab('preview'); setIsBriefModalOpen(true); }} className="text-indigo-600 text-sm font-bold">Edit</button>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {moduleView === 'lesson_planner' && (
                        <div className="space-y-6">
                            {/* Session Navigator */}
                            {!selectedSequence ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {Array.from({ length: 20 }, (_, i) => i + 1).map(seq => {
                                        const plan = lessonPlans.find(p => p.moduleCode === selectedModule.code && p.sequence === seq);
                                        return (
                                            <div key={seq} onClick={() => handleSelectSession(seq)} className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${plan ? 'bg-white border-indigo-200' : 'bg-gray-50 border-dashed border-gray-300'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-bold text-gray-500 text-xs uppercase">Session {seq}</span>
                                                    {plan && <CheckCircle size={14} className="text-green-500"/>}
                                                </div>
                                                <div className="font-medium text-sm text-gray-800 line-clamp-2 h-10">
                                                    {plan?.topic || "Unplanned"}
                                                </div>
                                                {plan && (
                                                    <div className="mt-2 flex gap-1">
                                                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{plan.chunks.length} Parts</span>
                                                        {plan.chunks.some(c => c.aiModuleId) && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex items-center"><Sparkles size={8} className="mr-1"/> AI</span>}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                // Editor View
                                <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col h-[calc(100vh-200px)]">
                                   {/* Toolbar */}
                                   <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                                       <div className="flex items-center gap-4">
                                           <button onClick={() => setSelectedSequence(null)} className="p-2 hover:bg-gray-200 rounded-full"><ArrowLeft size={20}/></button>
                                           <div>
                                               <h3 className="font-bold text-lg">Session {selectedSequence} Planning</h3>
                                               <input 
                                                   className="bg-transparent border-b border-gray-300 focus:border-indigo-500 outline-none text-sm w-64" 
                                                   placeholder="Enter Session Topic..." 
                                                   value={editingLessonPlan?.topic || ''}
                                                   onChange={(e) => setEditingLessonPlan(prev => prev ? {...prev, topic: e.target.value} : null)}
                                               />
                                           </div>
                                       </div>
                                       <div className="flex gap-2">
                                           <button 
                                               onClick={handleAutoPlanSession}
                                               disabled={isGeneratingPlan || !editingLessonPlan?.topic}
                                               className="flex items-center px-4 py-2 bg-purple-600 text-white rounded text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
                                           >
                                               {isGeneratingPlan ? <Loader2 className="animate-spin mr-2"/> : <BrainCircuit className="mr-2"/>} Auto-Plan
                                           </button>
                                           <button onClick={handleSaveLessonPlan} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold hover:bg-indigo-700">
                                               <Save className="mr-2" size={16}/> Save
                                           </button>
                                       </div>
                                   </div>
                                   
                                   {/* Workspace */}
                                   <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
                                       {/* Chunks */}
                                       <div className="space-y-4 max-w-4xl mx-auto">
                                           {editingLessonPlan?.chunks.map((chunk, idx) => (
                                               <div key={chunk.id} className="bg-white p-4 rounded-lg shadow border border-gray-200 group">
                                                   <div className="flex justify-between items-start gap-4">
                                                       <div className="flex items-center gap-3">
                                                           <div className="bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center font-bold text-gray-500">{idx + 1}</div>
                                                           <select 
                                                               className="border rounded p-1 text-sm font-medium"
                                                               value={chunk.activity}
                                                               onChange={(e) => updateChunk(idx, 'activity', e.target.value)}
                                                           >
                                                               {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                           </select>
                                                           <div className="flex items-center text-xs text-gray-500">
                                                               <Clock size={12} className="mr-1"/>
                                                               <input 
                                                                   type="number" 
                                                                   className="w-12 border-b text-center" 
                                                                   value={chunk.duration}
                                                                   onChange={(e) => updateChunk(idx, 'duration', parseInt(e.target.value))}
                                                               /> min
                                                           </div>
                                                       </div>
                                                       <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                           <button onClick={() => deleteChunk(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                                       </div>
                                                   </div>
                                                   
                                                   <div className="mt-3 pl-11">
                                                       <textarea 
                                                           className="w-full text-sm border-gray-200 rounded bg-gray-50 p-2 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                                                           rows={2}
                                                           value={chunk.content}
                                                           onChange={(e) => updateChunk(idx, 'content', e.target.value)}
                                                           placeholder="Describe the activity..."
                                                       />
                                                       
                                                       <div className="mt-3 flex justify-between items-center">
                                                           <input 
                                                               className="text-xs border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none text-gray-500 w-1/2"
                                                               placeholder="Learning Objective..."
                                                               value={chunk.objective}
                                                               onChange={(e) => updateChunk(idx, 'objective', e.target.value)}
                                                           />
                                                           
                                                           {/* SMART CONTENT BUTTONS */}
                                                           <div className="flex items-center gap-2">
                                                               {chunk.aiModuleId ? (
                                                                   <>
                                                                       <button 
                                                                           onClick={() => setPreviewContentId(chunk.aiModuleId!)}
                                                                           className="p-1.5 text-gray-500 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded border border-gray-200"
                                                                           title="Preview Content"
                                                                       >
                                                                           <Eye size={14}/>
                                                                       </button>
                                                                       <button 
                                                                           onClick={() => setEditingContentId(chunk.aiModuleId!)}
                                                                           className="p-1.5 text-gray-500 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded border border-gray-200"
                                                                           title="Edit Content"
                                                                       >
                                                                           <Edit size={14}/>
                                                                       </button>
                                                                       <button 
                                                                           onClick={() => handleGenerateChunkContent(chunk, idx)}
                                                                           className="p-1.5 text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200"
                                                                           title={generatingChunkId === chunk.id ? "Generating..." : "Regenerate Content"}
                                                                           disabled={generatingChunkId === chunk.id}
                                                                       >
                                                                           {generatingChunkId === chunk.id ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>}
                                                                       </button>
                                                                       <button 
                                                                           onClick={() => handleClearChunkContent(idx)}
                                                                           className="p-1.5 text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded border border-gray-200"
                                                                           title="Clear Content"
                                                                       >
                                                                           <XCircle size={14}/>
                                                                       </button>
                                                                   </>
                                                               ) : (
                                                                   <button 
                                                                       onClick={() => handleGenerateChunkContent(chunk, idx)}
                                                                       disabled={generatingChunkId === chunk.id}
                                                                       className="flex items-center gap-2 text-xs font-bold text-gray-600 bg-white border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
                                                                   >
                                                                       {generatingChunkId === chunk.id ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} 
                                                                       Generate Content
                                                                   </button>
                                                               )}
                                                           </div>
                                                       </div>
                                                   </div>
                                               </div>
                                           ))}
                                           
                                           <button 
                                               onClick={handleAddChunk}
                                               className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 font-medium hover:border-indigo-400 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2"
                                           >
                                               <Plus size={16}/> Add Activity Chunk
                                           </button>
                                       </div>
                                   </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* RECONSTRUCTED: this modal's JSX was missing from the source export — isBriefModalOpen,
                editingBrief, briefEditorTab and the Create/Edit Brief buttons above (moduleView === 'briefs')
                all existed and referenced it, but nothing rendered it. Adapted from HodDashboard.tsx's
                brief modal for the single-module Tutor context (no program/year picker — the module is
                already fixed via selectedModule). Please verify this matches the intended layout. */}
            {isBriefModalOpen && selectedModule && (
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
                                                <div className="bg-white border rounded-lg p-4">
                                                    <span className="text-xs font-medium text-gray-500">Module</span>
                                                    <div className="font-bold text-sm text-gray-900">{selectedModule.title} <span className="text-xs text-gray-400 font-normal">({selectedModule.code})</span></div>
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
                                                                    <LayoutList size={10} /> Milestone Rubric{rubricCount > 0 ? ` (${rubricCount})` : ''}
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
                                                        {currentDeliverable.rubric?.map((criteria) => (
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

            {/* Syllabus Modal - Kept same as previous update */}
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

            {/* Smart Content Editor Modal */}
            {editingContentId && (
                <SmartContentEditor 
                    module={aiModules.find(m => m.id === editingContentId) || { id: 'error', topic: 'Error', slides: [], preQuiz: [], postQuiz: [], notes: '', quizConfig: {pre:'Basic', post:'Basic'}, createdAt: 0, tutorId: '' }} 
                    onSave={(updatedModule) => {
                        updateAiModule(updatedModule);
                        setEditingContentId(null);
                    }}
                    onClose={() => setEditingContentId(null)}
                />
            )}

            {/* Preview Modal */}
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
        </div>
    );
};
