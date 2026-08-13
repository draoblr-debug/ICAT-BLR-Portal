
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from './AppContext';
import { AssignmentBrief, Module, Role, Submission, AttendanceRecord, LessonPlan, LessonChunk, LessonActivityType, AIClassModule, AISlide, AIQuizQuestion, ModuleContext, ModuleType } from './types';
import { getLocalDateString, normalizeProgram } from './data';
import { generateBriefContent, generateGradingFeedback, generateLessonPlan, generateChunkSmartContent } from './geminiService';
import { Plus, CheckCircle, BrainCircuit, FileText, Clock, BookOpen, ArrowLeft, X, Check, ArrowRight, Loader2, Upload, Save, Send, ChevronDown, ChevronUp, Sliders, Trash2, LayoutList, Timer, Sparkles, PlayCircle, Edit, RefreshCw, Eye, EyeOff, Info, BookCopy, XCircle, Image as ImageIcon } from 'lucide-react';
import { LiveClassSession } from './LiveClassSession';

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
    const { currentUser, curriculum, allocations, briefs, addBrief, updateBrief, submissions, updateSubmission, users, semesterPlans, semesterStartDate, holidays, attendance, markAttendance, lessonPlans, addLessonPlan, updateLessonPlan, moduleSyllabi, rooms, addAiModule, aiModules, updateAiModule, deleteAiModule, saveModuleSyllabus } = useApp();
    const [activeTab, setActiveTab] = useState<'assigned_modules' | 'grading' | 'attendance'>('assigned_modules');

    // --- Module Management State ---
    const [selectedModule, setSelectedModule] = useState<Module | null>(null);
    const [moduleView, setModuleView] = useState<'list' | 'briefs' | 'lesson_planner'>('list');

    // --- State for Briefs ---
    const [isBriefModalOpen, setIsBriefModalOpen] = useState(false);
    const [editingBrief, setEditingBrief] = useState<Partial<AssignmentBrief>>({});
    const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
    const [briefEditorTab, setBriefEditorTab] = useState<'general' | 'schedule' | 'rubric' | 'preview'>('general');
    const [selectedRubricDeliverableId, setSelectedRubricDeliverableId] = useState<string>('');
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
            </div>

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
