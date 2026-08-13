
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from './AppContext';
import { AIClassModule, AIQuizQuestion, Submission } from './types';
import { Send, Users, ChevronRight, ChevronLeft, BarChart, X, Monitor, Clock, PlayCircle, Eye, Youtube, Upload, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { TutorVerificationModal } from './TutorVerificationModal';

// Helper to extract YouTube ID (duplicated here for standalone usage within session)
const getYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// Helper for image src - handles AI generation vs Direct URL
const getVisualSrc = (keyword: string) => {
    if (!keyword) return '';
    if (keyword.startsWith('http') || keyword.startsWith('data:')) return keyword;
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(keyword)}`;
}

interface LiveSessionState {
    phase: 'LOBBY' | 'PRE_QUIZ' | 'SCREENING' | 'SLIDES' | 'POST_QUIZ' | 'ENDED';
    currentSlideIndex: number;
    currentQuestionIndex: number; 
    currentVideoIndex: number; // For Screening playlist
    revealedAnswer: boolean; 
    answers: Record<string, number>; 
}

interface LiveClassSessionProps {
    previewMode?: boolean;
    previewModuleId?: string;
    previewModuleData?: AIClassModule | null; // Allow passing direct object for unsaved edits
    onClosePreview?: () => void;
}

export const LiveClassSession = ({ previewMode = false, previewModuleId, previewModuleData, onClosePreview }: LiveClassSessionProps) => {
    const { aiModules, currentUser, addSubmission, submissions } = useApp();
    
    const params = new URLSearchParams(window.location.search);
    const urlModuleId = params.get('id');
    const urlRole = params.get('role') as 'tutor' | 'student';
    
    // optional: sessionId and sessionEnd timestamp (ISO) can be passed via URL or fetched from backend
    const urlSessionId = params.get('sessionId') || `${urlModuleId || 'module'}_live`;
    const urlSessionEnd = params.get('sessionEnd'); // ISO timestamp string, optional
    const sessionEnd = urlSessionEnd ? new Date(urlSessionEnd) : null;

    const moduleId = previewMode ? previewModuleId : urlModuleId;
    const role = previewMode ? 'student' : (urlRole || 'student');
    const studentId = params.get('sid') || `anon-${Math.floor(Math.random()*1000)}`;

    const [module, setModule] = useState<AIClassModule | null>(null);
    const [state, setState] = useState<LiveSessionState>({
        phase: 'LOBBY',
        currentSlideIndex: 0,
        currentQuestionIndex: 0,
        currentVideoIndex: 0,
        revealedAnswer: false,
        answers: {}
    });
    
    const [studentScore, setStudentScore] = useState(0);
    const [hasAnsweredCurrent, setHasAnsweredCurrent] = useState(false);

    // Class Work Submission State
    const [submissionContent, setSubmissionContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // For tutor verification modal
    const [verifyOpen, setVerifyOpen] = useState(false);
    const verifyTimerRef = useRef<number | null>(null);
    const AUTO_OPEN_MINUTES_BEFORE = 3; // default minutes before end to auto-open modal

    useEffect(() => {
        // Priority: Passed Data -> ID lookup in Store -> URL ID
        if (previewMode && previewModuleData) {
            setModule(previewModuleData);
        } else if (moduleId) {
            const found = aiModules.find(m => m.id === moduleId);
            if (found) setModule(found);
        }
    }, [moduleId, aiModules, previewMode, previewModuleData]);

    const channel = useMemo(() => !previewMode ? new BroadcastChannel('live_class_sync') : null, [previewMode]);

    useEffect(() => {
        if (!channel) return;
        channel.onmessage = (event) => {
            const data = event.data;
            if (data.type === 'STATE_UPDATE') {
                setState(data.payload);
            }
        };
        return () => channel.close();
    }, [channel, role]);

    useEffect(() => {
        if (role === 'tutor' && channel) {
            const handler = (event: MessageEvent) => {
                if (event.data.type === 'STUDENT_ANSWER') {
                    const { studentId, optionIndex } = event.data.payload;
                    setState(prev => ({ ...prev, answers: { ...prev.answers, [studentId]: optionIndex } }));
                }
            };
            channel.addEventListener('message', handler);
            return () => channel.removeEventListener('message', handler);
        }
    }, [role, channel]);

    useEffect(() => {
        setHasAnsweredCurrent(false);
    }, [state.currentQuestionIndex, state.phase]);

    const updateState = (updates: Partial<LiveSessionState>) => {
        setState(prev => {
            const newState = { ...prev, ...updates };
            if (channel) channel.postMessage({ type: 'STATE_UPDATE', payload: newState });
            return newState;
        });
    };

    // Navigation Logic Helper
    const goToContent = () => {
        // Priority: Screening -> Slides -> PostQuiz
        if (module?.generatedContent?.screening) {
            updateState({ phase: 'SCREENING', currentVideoIndex: 0 });
        } else if (module?.slides && module.slides.length > 0) {
            updateState({ phase: 'SLIDES', currentSlideIndex: 0 });
        } else {
            goToPostQuiz();
        }
    };

    const goToSlidesOrPost = () => {
        if (module?.slides && module.slides.length > 0) {
            updateState({ phase: 'SLIDES', currentSlideIndex: 0 });
        } else {
            goToPostQuiz();
        }
    };

    const goToPostQuiz = () => {
        if (module?.postQuiz && module.postQuiz.length > 0) {
            updateState({ phase: 'POST_QUIZ', currentQuestionIndex: 0, revealedAnswer: false, answers: {} });
        } else {
            updateState({ phase: 'ENDED' });
        }
    };

    const nextStep = () => {
        if (state.phase === 'LOBBY') {
            if (module?.preQuiz && module.preQuiz.length > 0) {
                updateState({ phase: 'PRE_QUIZ', currentQuestionIndex: 0, revealedAnswer: false, answers: {} });
            } else {
                goToContent();
            }
        } 
        else if (state.phase === 'PRE_QUIZ') {
            if (state.currentQuestionIndex < (module?.preQuiz.length || 0) - 1) {
                updateState({ currentQuestionIndex: state.currentQuestionIndex + 1, revealedAnswer: false, answers: {} });
            } else {
                goToContent();
            }
        } 
        else if (state.phase === 'SCREENING') {
             const videos = module?.generatedContent?.screening?.videos || [];
             if (state.currentVideoIndex < videos.length - 1) {
                 updateState({ currentVideoIndex: state.currentVideoIndex + 1 });
             } else {
                 goToSlidesOrPost();
             }
        }
        else if (state.phase === 'SLIDES') {
            if (state.currentSlideIndex < (module?.slides.length || 0) - 1) {
                updateState({ currentSlideIndex: state.currentSlideIndex + 1 });
            } else {
                goToPostQuiz();
            }
        } 
        else if (state.phase === 'POST_QUIZ') {
            if (state.currentQuestionIndex < (module?.postQuiz.length || 0) - 1) {
                updateState({ currentQuestionIndex: state.currentQuestionIndex + 1, revealedAnswer: false, answers: {} });
            } else {
                updateState({ phase: 'ENDED' });
            }
        }
    };

    const prevStep = () => {
        if (state.phase === 'POST_QUIZ') {
            if (state.currentQuestionIndex > 0) {
                updateState({ currentQuestionIndex: state.currentQuestionIndex - 1 });
            } else {
                // Back to Slides or Screening
                if (module?.slides && module.slides.length > 0) {
                    updateState({ phase: 'SLIDES', currentSlideIndex: module.slides.length - 1 });
                } else if (module?.generatedContent?.screening) {
                    const vids = module.generatedContent.screening.videos || [];
                    updateState({ phase: 'SCREENING', currentVideoIndex: Math.max(0, vids.length - 1) });
                } else {
                    // Back to PreQuiz or Lobby
                    if (module?.preQuiz && module.preQuiz.length > 0) updateState({ phase: 'PRE_QUIZ', currentQuestionIndex: module.preQuiz.length - 1 });
                    else updateState({ phase: 'LOBBY' });
                }
            }
        }
        else if (state.phase === 'SLIDES') {
            if (state.currentSlideIndex > 0) {
                updateState({ currentSlideIndex: state.currentSlideIndex - 1 });
            } else {
                // Back to Screening or PreQuiz
                if (module?.generatedContent?.screening) {
                    const vids = module.generatedContent.screening.videos || [];
                    updateState({ phase: 'SCREENING', currentVideoIndex: Math.max(0, vids.length - 1) });
                } else if (module?.preQuiz && module.preQuiz.length > 0) {
                    updateState({ phase: 'PRE_QUIZ', currentQuestionIndex: module.preQuiz.length - 1 });
                } else {
                    updateState({ phase: 'LOBBY' });
                }
            }
        }
        else if (state.phase === 'SCREENING') {
            if (state.currentVideoIndex > 0) {
                updateState({ currentVideoIndex: state.currentVideoIndex - 1 });
            } else {
                // Back to PreQuiz or Lobby
                if (module?.preQuiz && module.preQuiz.length > 0) {
                    updateState({ phase: 'PRE_QUIZ', currentQuestionIndex: module.preQuiz.length - 1 });
                } else {
                    updateState({ phase: 'LOBBY' });
                }
            }
        }
        else if (state.phase === 'PRE_QUIZ') {
            if (state.currentQuestionIndex > 0) {
                 updateState({ currentQuestionIndex: state.currentQuestionIndex - 1 });
            } else {
                 updateState({ phase: 'LOBBY' });
            }
        }
    };

    const handleStudentAnswer = (optionIndex: number) => {
        if (channel) channel.postMessage({ type: 'STUDENT_ANSWER', payload: { studentId, optionIndex } });
        
        setHasAnsweredCurrent(true);
        const currentQuiz = state.phase === 'PRE_QUIZ' ? module?.preQuiz : module?.postQuiz;
        const q = currentQuiz?.[state.currentQuestionIndex];
        
        if (q && optionIndex === q.correctIndex) {
            const difficulty = state.phase === 'PRE_QUIZ' ? module?.quizConfig.pre : module?.quizConfig.post;
            let points = 0.5;
            if (difficulty === 'Intermediate') points = 1.0;
            if (difficulty === 'Tough') points = 2.0;
            setStudentScore(prev => prev + points);
        }
    };

    // Class Work Submission Handler
    const handleClassWorkSubmit = (type: 'Image' | 'Link') => {
        if (!submissionContent) { alert("Please provide content to submit."); return; }
        if (!module || !currentUser) return;

        const sub: Submission = {
            id: `sub-${Date.now()}`,
            studentId: currentUser.id,
            moduleId: module.id,
            type: type,
            content: submissionContent,
            submittedAt: Date.now()
        };
        addSubmission(sub);
        setSubmissionContent('');
        setIsSubmitting(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 1024 * 1024) { alert("File size limit 1MB for demo."); return; }
        const reader = new FileReader();
        reader.onloadend = () => {
            setSubmissionContent(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // ------------ Tutor verification modal scheduling & handlers ------------
    useEffect(() => {
      // If sessionEnd is provided, schedule modal AUTO_OPEN_MINUTES_BEFORE before it
      if (role !== 'tutor' || !sessionEnd) return;
      const msBefore = AUTO_OPEN_MINUTES_BEFORE * 60 * 1000;
      const openAt = sessionEnd.getTime() - msBefore;
      const now = Date.now();
      if (openAt <= now) {
        // already within window — open immediately
        setVerifyOpen(true);
      } else {
        // schedule timer
        const tid = window.setTimeout(() => setVerifyOpen(true), openAt - now);
        verifyTimerRef.current = tid;
        return () => {
          if (verifyTimerRef.current) {
            clearTimeout(verifyTimerRef.current);
            verifyTimerRef.current = null;
          }
        };
      }
    }, [role, sessionEnd]);

    // Manual open handler (tutor clicks button)
    const openVerificationNow = () => {
      setVerifyOpen(true);
    };

    // close handler
    const handleVerifyClose = () => {
      setVerifyOpen(false);
    };

    // helper: ask server to initialize attendance for this session (optional)
    const initializeAttendanceOnServer = async () => {
      try {
        await fetch(`/api/attendance/init?sessionId=${encodeURIComponent(urlSessionId)}&moduleId=${encodeURIComponent(moduleId || '')}`, { method: 'POST', credentials: 'include' });
      } catch (e) {
        console.warn('Attendance init failed', e);
      }
    };

    useEffect(() => {
      // When tutor joins, optionally ensure an attendance doc exists
      if (role === 'tutor') initializeAttendanceOnServer();
    }, [role]);

    // ------------ Rendering ------------
    if (!module) return <div className="h-screen flex items-center justify-center text-gray-500">Loading module or invalid ID...</div>;

    // Common Video Player Renderer
    const renderScreening = () => {
        const video = module.generatedContent?.screening?.videos?.[state.currentVideoIndex];
        const discussion = module.generatedContent?.screening?.discussionPrompt;
        
        if (!video) return <div className="text-center text-white">No video content loaded.</div>;

        const videoId = getYoutubeId(video.url);
        const start = video.startTime ? parseInt(video.startTime) : 0;
        const end = video.endTime ? parseInt(video.endTime) : null;
        // Use origin to prevent CORS issues in some browsers
        const embedSrc = videoId ? `https://www.youtube.com/embed/${videoId}?start=${start}${end ? `&end=${end}` : ''}&autoplay=1&origin=${window.location.origin}` : '';

        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-black">
                <div className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800">
                    {embedSrc ? (
                        <iframe 
                            width="100%" 
                            height="100%" 
                            src={embedSrc} 
                            title="YouTube video player" 
                            frameBorder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowFullScreen
                        ></iframe>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            Video unavailable
                        </div>
                    )}
                </div>
                <div className="mt-6 text-center max-w-4xl">
                    <h2 className="text-2xl font-bold text-white mb-2">{video.title}</h2>
                    <p className="text-gray-400 text-sm mb-4">Focus: {discussion}</p>
                </div>
            </div>
        );
    };

    // --- TUTOR VIEW (non-preview) ---
    if (role === 'tutor' && !previewMode) {
        const currentQuiz = state.phase === 'PRE_QUIZ' ? module.preQuiz : (state.phase === 'POST_QUIZ' ? module.postQuiz : []);
        const currentQ = currentQuiz[state.currentQuestionIndex];
        const currentSlide = module.slides[state.currentSlideIndex];
        const studentCount = Object.keys(state.answers).length;
        const answerCounts = [0,0,0,0];
        Object.values(state.answers).forEach((val) => { const idx = val as number; answerCounts[idx] = (answerCounts[idx] || 0) + 1; });

        return (
            <div className="h-screen flex bg-gray-900 text-white overflow-hidden">
                <div className="flex-1 flex flex-col relative">
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between z-10 bg-gradient-to-b from-black/50 to-transparent">
                        <div className="text-xl font-bold opacity-80">{module.topic}</div>
                        <div className="flex items-center gap-4">
                            <div className="bg-black/40 px-3 py-1 rounded-full flex items-center gap-2 backdrop-blur-md"><Users size={16}/> {studentCount} Answers</div>
                            <div className="bg-red-600 px-3 py-1 rounded-full font-bold text-sm uppercase animate-pulse">Live</div>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-8 bg-black">
                        {state.phase === 'LOBBY' && (
                            <div className="text-center space-y-6">
                                <h1 className="text-5xl font-bold mb-4">Join the Class</h1>
                                <p className="text-2xl mt-4">Waiting for students...</p>
                            </div>
                        )}

                        {(state.phase === 'PRE_QUIZ' || state.phase === 'POST_QUIZ') && currentQ && (
                            <div className="w-full max-w-4xl">
                                <div className="text-sm font-bold text-blue-400 uppercase mb-4 tracking-widest">{state.phase.replace('_', ' ')} • Question {state.currentQuestionIndex + 1}/{currentQuiz.length}</div>
                                <h2 className="text-4xl font-bold mb-8 leading-tight">{currentQ.question}</h2>
                                <div className="grid grid-cols-1 gap-4">
                                    {currentQ.options.map((opt, i) => (
                                        <div key={i} className={`p-6 rounded-lg text-2xl transition-all border-l-8 ${state.revealedAnswer ? (i === currentQ.correctIndex ? 'bg-green-900 border-green-500' : 'bg-gray-800 border-gray-700 opacity-50') : 'bg-gray-800 border-gray-600'} flex justify-between items-center`}>
                                            <span>{opt}</span>
                                            {state.revealedAnswer && <span className="text-sm font-bold opacity-80">{answerCounts[i] || 0} votes</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {state.phase === 'SCREENING' && renderScreening()}

                        {state.phase === 'SLIDES' && currentSlide && (
                            <div className="relative w-full h-full rounded-xl overflow-hidden">
                                <img src={getVisualSrc(currentSlide.visualKeyword)} alt="Slide Visual" className="absolute inset-0 w-full h-full object-cover opacity-40"/>
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                                <div className="relative z-10 h-full flex flex-col justify-end p-12 pb-24">
                                    <h2 className="text-6xl font-bold mb-8 shadow-black drop-shadow-lg">{currentSlide.title}</h2>
                                    <ul className="space-y-4">{currentSlide.bulletPoints.map((bp, i) => (<li key={i} className="text-2xl flex items-start gap-3 drop-shadow-md"><span className="text-indigo-400 mt-1">•</span> {bp}</li>))}</ul>
                                </div>
                            </div>
                        )}

                        {state.phase === 'ENDED' && (
                            <div className="text-center"><h1 className="text-5xl font-bold text-white">Class Dismissed</h1></div>
                        )}
                    </div>

                    <div className="h-24 bg-gray-800 border-t border-gray-700 p-4 flex justify-between items-center gap-4">
                        <div className="flex-1 max-w-xl"><div className="text-xs text-gray-400 uppercase font-bold mb-1">Speaker Notes</div><div className="text-sm text-gray-200 line-clamp-2 leading-relaxed">{state.phase === 'SLIDES' ? module.slides[state.currentSlideIndex]?.speakerNotes : (state.phase === 'SCREENING' ? module.generatedContent?.screening?.discussionPrompt : "Guide the class.")}</div></div>
                        <div className="flex items-center gap-4">
                            {state.phase.includes('QUIZ') && !state.revealedAnswer && <button onClick={() => updateState({ revealedAnswer: true })} className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2"><BarChart size={20}/> Reveal</button>}
                            <button onClick={prevStep} disabled={state.phase==='LOBBY'} className="bg-gray-700 hover:bg-gray-600 p-3 rounded-full"><ChevronLeft size={24}/></button>
                            <button onClick={nextStep} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 text-lg">Next <ChevronRight size={24}/></button>
                            {/* Tutor-only controls */}
                            <div className="flex items-center gap-2 ml-4">
                              <button onClick={openVerificationNow} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm">Review Attendance</button>
                              <button onClick={() => {
                                if (!window.confirm('End session now? This will move class to ENDED.')) return;
                                updateState({ phase: 'ENDED' });
                                // auto-open verification immediately when ending
                                setVerifyOpen(true);
                              }} className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm">End Session</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tutor verification modal */}
                <TutorVerificationModal sessionId={urlSessionId} open={verifyOpen} onClose={handleVerifyClose} apiBase="/api" />
            </div>
        );
    }

    // --- STUDENT VIEW (OR PREVIEW MODE) ---
    const currentQuiz = state.phase === 'PRE_QUIZ' ? module.preQuiz : (state.phase === 'POST_QUIZ' ? module.postQuiz : []);
    const currentQ = currentQuiz[state.currentQuestionIndex];
    const currentSlide = module.slides[state.currentSlideIndex];
    const isClassWork = module.generatedContent?.activity === 'Class Work';
    const mySubmission = submissions.find(s => s.moduleId === module.id && s.studentId === currentUser?.id);

    return (
        <div className={`bg-gray-100 flex flex-col ${previewMode ? 'h-full' : 'h-screen'}`}>
            {previewMode && (
                <div className="bg-indigo-900 text-white px-4 py-2 flex justify-between items-center shadow-md z-20">
                    <div className="flex items-center gap-2 text-sm font-bold"><Eye size={16}/> Student Preview Mode</div>
                    <div className="flex items-center gap-2">
                        <button onClick={prevStep} disabled={state.phase === 'LOBBY'} className="p-1 hover:bg-white/20 rounded"><ChevronLeft size={20}/></button>
                        <span className="text-xs uppercase font-mono w-24 text-center">{state.phase.replace('_', ' ')}</span>
                        <button onClick={nextStep} disabled={state.phase === 'ENDED'} className="p-1 hover:bg-white/20 rounded"><ChevronRight size={20}/></button>
                        {state.phase.includes('QUIZ') && (
                            <button onClick={() => updateState({ revealedAnswer: !state.revealedAnswer })} className={`ml-2 text-xs px-2 py-1 rounded`}>{state.revealedAnswer ? 'Hide Answers' : 'Reveal'}</button>
                        )}
                        <button onClick={onClosePreview} className="ml-4 p-1 hover:bg-red-600 rounded"><X size={20}/></button>
                      </div>
                </div>
            )}

            <div className="flex-1 flex items-center justify-center p-8 bg-gray-100">
                {/* Student rendering */}
                <div className="max-w-4xl w-full">
                    {state.phase === 'LOBBY' && <div className="text-center py-32 text-gray-500 text-xl">Waiting for class to start...</div>}
                    
                    {state.phase.includes('QUIZ') && currentQ && (
                      <div className="bg-white p-8 rounded-xl shadow-lg">
                        <div className="text-xs font-bold text-gray-400 uppercase mb-4">{state.phase.replace('_', ' ')} • Q {state.currentQuestionIndex + 1}</div>
                        <h2 className="text-2xl font-bold mb-6 text-gray-800">{currentQ.question}</h2>
                        <div className="grid gap-3">
                          {currentQ.options.map((opt, i) => (
                            <button 
                                key={i} 
                                disabled={hasAnsweredCurrent} 
                                onClick={() => handleStudentAnswer(i)} 
                                className={`p-4 rounded-lg text-left shadow-sm border transition-all ${
                                    state.revealedAnswer 
                                        ? (i === currentQ.correctIndex ? 'bg-green-100 border-green-500 text-green-900' : 'bg-gray-50 border-gray-200 text-gray-400')
                                        : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                                }`}
                            >
                                {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {state.phase === 'SCREENING' && (
                        <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
                            {renderScreening()}
                        </div>
                    )}

                    {state.phase === 'SLIDES' && (
                        <div className="space-y-6">
                            {currentSlide && (
                                <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
                                    {/* Visual for Student - Non-intrusive but helpful context */}
                                    <div className="mb-6 h-48 w-full rounded-lg overflow-hidden relative bg-gray-100">
                                         <img src={getVisualSrc(currentSlide.visualKeyword)} className="w-full h-full object-cover" alt="Concept Visual" />
                                    </div>
                                    <h2 className="text-3xl font-bold mb-6 text-indigo-900">{currentSlide.title}</h2>
                                    <ul className="space-y-4">
                                    {currentSlide.bulletPoints.map((b, i) => (
                                        <li key={i} className="flex items-start text-lg text-gray-700">
                                            <span className="text-indigo-500 mr-3 mt-1.5 text-xs">●</span>
                                            {b}
                                        </li>
                                    ))}
                                    </ul>
                                </div>
                            )}

                            {/* Class Work Submission Area */}
                            {isClassWork && (
                                <div className="bg-white p-6 rounded-xl shadow-md border-2 border-indigo-100 animate-in slide-in-from-bottom-4 duration-300">
                                    <h3 className="font-bold text-lg text-indigo-700 mb-2 flex items-center gap-2"><Upload size={20}/> Class Work Submission</h3>
                                    <p className="text-sm text-gray-500 mb-4">Please submit a screenshot of your workspace or the final outcome for this activity.</p>
                                    
                                    {mySubmission ? (
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 text-green-800">
                                            <CheckCircle size={24} className="text-green-600"/>
                                            <div>
                                                <div className="font-bold">Work Submitted</div>
                                                <div className="text-xs opacity-75">{new Date(mySubmission.submittedAt).toLocaleString()}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {submissionContent ? (
                                                <div className="space-y-2">
                                                    {submissionContent.startsWith('data:image') ? (
                                                        <img src={submissionContent} className="max-h-48 rounded border" alt="Preview" />
                                                    ) : (
                                                        <div className="p-2 bg-gray-100 rounded text-sm break-all">{submissionContent}</div>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => handleClassWorkSubmit(submissionContent.startsWith('data:') ? 'Image' : 'Link')} 
                                                            className="bg-indigo-600 text-white px-4 py-2 rounded font-bold hover:bg-indigo-700"
                                                        >
                                                            Confirm Submission
                                                        </button>
                                                        <button onClick={() => setSubmissionContent('')} className="text-gray-500 px-3 py-2">Clear</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <button 
                                                        onClick={() => fileInputRef.current?.click()} 
                                                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                                                    >
                                                        <ImageIcon size={24} className="mb-2"/>
                                                        <span className="text-sm font-bold">Upload Screenshot</span>
                                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                                                    </button>
                                                    <div className="flex flex-col gap-2">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Or paste a link..." 
                                                            className="border p-2 rounded text-sm w-full"
                                                            onKeyDown={(e) => { if(e.key === 'Enter') setSubmissionContent(e.currentTarget.value); }}
                                                            onBlur={(e) => { if(e.target.value) setSubmissionContent(e.target.value); }}
                                                        />
                                                        <div className="text-xs text-gray-400">Press Enter to preview</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {state.phase === 'ENDED' && <div className="text-center py-32 text-gray-500 text-xl">Class has ended.</div>}
                </div>
            </div>
        </div>
    );
};
