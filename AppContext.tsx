
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
    User, Module, SurveyResponse, Role, TutorAllocation, 
    SemesterPlanEntry, AssignmentBrief, Submission, AttendanceRecord, 
    Holiday, CustomEvent, SemesterConfig, Room, AIClassModule, LessonPlan, ModuleSyllabus, LeaderboardEntry 
} from '../types';
import { parseCurriculum, parseUsers, parseRooms } from '../services/data';
import { db } from '../services/firebase';
import { calculateGamificationLeaderboard } from '../services/analyticsService';
import { 
    collection, doc, setDoc, updateDoc, deleteDoc, 
    onSnapshot, writeBatch 
} from 'firebase/firestore';

const safeLogError = (msg: string, error: any) => {
    console.error(`${msg}:`, error?.message || (typeof error === 'string' ? error : 'Unknown error'));
};

// Safe stringify to handle circular references
const safeStringify = (obj: any) => {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) {
                // Circular reference found, discard key
                return;
            }
            // Store value in our collection
            cache.add(value);
        }
        return value;
    });
};

const deepClean = (input: any, visited = new WeakSet()): any => {
    if (input === null || typeof input !== 'object') return input;
    
    // Handle Date
    if (input instanceof Date) return input.toISOString(); 

    // Handle Firestore Timestamp
    if (typeof input.toDate === 'function') {
        try {
            return input.toDate().toISOString();
        } catch (e) {
            // ignore
        }
    }

    // Cycle detection
    if (visited.has(input)) return null;
    visited.add(input);

    if (Array.isArray(input)) {
        return input.map(item => deepClean(item, visited));
    }

    const output: any = {};
    for (const key of Object.keys(input)) {
        // Skip internal/private properties often found in Firestore objects
        if (key.startsWith('_') || key.includes('$') || key === 'auth' || key === 'proactiveRefresh') continue;

        try {
            const value = deepClean(input[key], visited);
            if (value !== undefined) {
                output[key] = value;
            }
        } catch (e) {
            // ignore
        }
    }
    return output;
};

interface AppContextType {
    currentUser: User | null;
    users: User[];
    curriculum: Module[];
    surveys: SurveyResponse[];
    allocations: TutorAllocation[];
    semesterPlans: SemesterPlanEntry[];
    briefs: AssignmentBrief[];
    submissions: Submission[];
    attendance: AttendanceRecord[];
    holidays: Holiday[];
    customEvents: CustomEvent[];
    rooms: Room[];
    aiModules: AIClassModule[];
    lessonPlans: LessonPlan[];
    moduleSyllabi: ModuleSyllabus[];
    leaderboard: LeaderboardEntry[];
    semesterConfig: SemesterConfig | null;
    currentSemesterType: 'Odd' | 'Even';
    semesterStartDate: string;
    semesterEndDate: string;
    isOfflineMode: boolean;
    activeRole: Role | null;
    setActiveRole: (role: Role) => void;
    login: (email: string, id: string) => Promise<boolean>;
    logout: () => void;
    submitSurvey: (response: SurveyResponse) => void;
    assignTutor: (allocation: TutorAllocation) => void;
    toggleSemesterPlan: (entry: SemesterPlanEntry) => void;
    clearSemesterPlan: (programId: string, year: number) => Promise<void>;
    addCustomEvent: (event: CustomEvent) => void;
    deleteCustomEvent: (id: string) => void;
    addBrief: (brief: AssignmentBrief) => void;
    updateBrief: (brief: AssignmentBrief) => void;
    addSubmission: (sub: Submission) => void;
    updateSubmission: (sub: Submission) => void;
    markAttendance: (record: AttendanceRecord) => void;
    addUser: (user: User) => void;
    updateUserRole: (userId: string, role: Role) => void;
    updateUserProfile: (userId: string, updates: Partial<User>) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    updateSemesterConfig: (config: SemesterConfig) => void;
    addHoliday: (holiday: Holiday) => void;
    removeHoliday: (id: string) => void;
    addRoom: (room: Room) => void;
    updateRoom: (room: Room) => void;
    deleteRoom: (id: string) => void;
    addAiModule: (mod: AIClassModule) => void;
    updateAiModule: (mod: AIClassModule) => void;
    deleteAiModule: (id: string) => void;
    addLessonPlan: (plan: LessonPlan) => void;
    updateLessonPlan: (plan: LessonPlan) => void;
    saveModuleSyllabus: (syllabus: ModuleSyllabus) => void;
    runGamificationEngine: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children?: ReactNode }) => {
    // State
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        try {
            const saved = localStorage.getItem('current_user');
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });

    const [users, setUsers] = useState<User[]>([]);
    const [curriculum, setCurriculum] = useState<Module[]>([]);
    const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
    const [allocations, setAllocations] = useState<TutorAllocation[]>([]);
    const [semesterPlans, setSemesterPlans] = useState<SemesterPlanEntry[]>([]);
    const [briefs, setBriefs] = useState<AssignmentBrief[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    
    const [aiModules, setAiModules] = useState<AIClassModule[]>(() => {
        try {
            const saved = localStorage.getItem('local_ai_modules');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>(() => {
        try {
            const saved = localStorage.getItem('local_lesson_plans');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    const [moduleSyllabi, setModuleSyllabi] = useState<ModuleSyllabus[]>(() => {
        try {
            const saved = localStorage.getItem('local_module_syllabi');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
        try {
            const saved = localStorage.getItem('local_leaderboard');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    const [semesterConfig, setSemesterConfigState] = useState<SemesterConfig | null>(null);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const [activeRole, setActiveRole] = useState<Role | null>(null);

    const currentSemesterType = semesterConfig?.activeType || 'Odd';
    const semesterStartDate = currentSemesterType === 'Odd' ? (semesterConfig?.oddStartDate || '') : (semesterConfig?.evenStartDate || '');
    const semesterEndDate = currentSemesterType === 'Odd' ? (semesterConfig?.oddEndDate || '') : (semesterConfig?.evenEndDate || '');

    // Persistence Effects
    useEffect(() => {
        if (currentUser) {
            try {
                const cleanUser = deepClean(currentUser);
                localStorage.setItem('current_user', safeStringify(cleanUser));
            } catch (e) {
                console.warn("Failed to persist current_user", e);
            }
        } else {
            localStorage.removeItem('current_user');
        }
    }, [currentUser]);

    useEffect(() => {
        try {
            const cleanModules = deepClean(aiModules);
            localStorage.setItem('local_ai_modules', safeStringify(cleanModules));
        } catch (e) { console.warn("Failed to persist ai_modules", e); }
    }, [aiModules]);

    useEffect(() => {
        try {
            const cleanPlans = deepClean(lessonPlans);
            localStorage.setItem('local_lesson_plans', safeStringify(cleanPlans));
        } catch (e) { console.warn("Failed to persist lesson_plans", e); }
    }, [lessonPlans]);

    useEffect(() => {
        try {
            const cleanSyllabi = deepClean(moduleSyllabi);
            localStorage.setItem('local_module_syllabi', safeStringify(cleanSyllabi));
        } catch (e) { console.warn("Failed to persist module_syllabi", e); }
    }, [moduleSyllabi]);

    useEffect(() => {
        try {
            localStorage.setItem('local_leaderboard', safeStringify(leaderboard));
        } catch (e) { console.warn("Failed to persist leaderboard", e); }
    }, [leaderboard]);

    // Initialization
    useEffect(() => {
        const initData = async () => {
            const loadedUsers = parseUsers();
            const loadedModules = parseCurriculum();
            const loadedRooms = parseRooms();
            setUsers(loadedUsers);
            setCurriculum(loadedModules);
            setRooms(loadedRooms);

            if (db) {
                try {
                    const collections = [
                        { name: 'surveys', setter: setSurveys },
                        { name: 'allocations', setter: setAllocations },
                        { name: 'semester_plans', setter: setSemesterPlans },
                        { name: 'briefs', setter: setBriefs },
                        { name: 'submissions', setter: setSubmissions },
                        { name: 'attendance', setter: setAttendance },
                        { name: 'holidays', setter: setHolidays },
                        { name: 'custom_events', setter: setCustomEvents },
                        { name: 'lesson_plans', setter: setLessonPlans },
                        { name: 'ai_modules', setter: setAiModules },
                        { name: 'module_syllabi', setter: setModuleSyllabi },
                        { name: 'users', setter: (firestoreUsers: any[]) => {
                            const cleanedUsers = deepClean(firestoreUsers);
                            setUsers(prev => {
                                const map = new Map(prev.map(u => [u.id, u]));
                                cleanedUsers.forEach((u: any) => map.set(u.id, u as User));
                                return Array.from(map.values());
                            });
                        }},
                    ];

                    collections.forEach(({ name, setter }) => {
                        onSnapshot(collection(db!, name), (snapshot) => {
                            // Critical: Sanitize data from Firestore before it enters state
                            const data = snapshot.docs.map(doc => doc.data());
                            setter(deepClean(data) as any);
                        }, (error) => {
                             console.warn(`Firestore listener for ${name} failed:`, error?.message);
                             setIsOfflineMode(true);
                        });
                    });

                    onSnapshot(collection(db!, 'rooms'), (snapshot) => {
                         const dbRooms = snapshot.docs.map(doc => doc.data() as Room);
                         setRooms(prev => {
                             const combined = [...parseRooms()]; 
                             const roomMap = new Map(combined.map(r => [r.id, r]));
                             dbRooms.forEach(r => roomMap.set(r.id, r));
                             // Sanitize mixed data
                             return deepClean(Array.from(roomMap.values()));
                         });
                    }, (error) => {
                        console.warn("Firestore listener for rooms failed", error?.message);
                    });
                    
                    onSnapshot(doc(db, 'config', 'semester'), (docSnap) => {
                        if (docSnap.exists()) {
                            setSemesterConfigState(deepClean(docSnap.data()) as SemesterConfig);
                        }
                    }, (error) => {
                        console.warn("Firestore listener for config failed", error?.message);
                    });

                    // Listen for Cached Leaderboard
                    onSnapshot(doc(db, 'leaderboard', 'current_semester'), (docSnap) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            if (data.data && Array.isArray(data.data)) {
                                setLeaderboard(deepClean(data.data) as LeaderboardEntry[]);
                            }
                        }
                    }, (error) => {
                        console.warn("Firestore listener for leaderboard failed", error?.message);
                    });

                } catch (e) {
                    console.error("Firestore connection error", e);
                    setIsOfflineMode(true);
                }
            } else {
                setIsOfflineMode(true);
            }
        };
        initData();
    }, []);

    // Actions

    const login = async (email: string, passwordInput: string): Promise<boolean> => {
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === passwordInput);
        if (user) {
            setCurrentUser(user);
            setActiveRole(null); 
            return true;
        }
        return false;
    };

    const logout = () => {
        setCurrentUser(null);
        setActiveRole(null);
    };

    const saveToFirestore = async (collectionName: string, id: string, data: any) => {
        if (!db || isOfflineMode) return;
        const cleanData = deepClean(data);
        try {
            await setDoc(doc(db, collectionName, id), cleanData);
        } catch (e) {
            safeLogError(`Error saving to ${collectionName}`, e);
        }
    };
    
    const deleteFromFirestore = async (collectionName: string, id: string) => {
        if (!db || isOfflineMode) return;
         try {
            await deleteDoc(doc(db, collectionName, id));
        } catch (e) {
            safeLogError(`Error deleting from ${collectionName}`, e);
        }
    }

    // ... Entity Methods ...

    const submitSurvey = (response: SurveyResponse) => {
        setSurveys(prev => [...prev, response]);
        saveToFirestore('surveys', response.id, response);
    };

    const assignTutor = (allocation: TutorAllocation) => {
        setAllocations(prev => {
            const filtered = prev.filter(a => a.moduleCode !== allocation.moduleCode);
            return [...filtered, allocation];
        });
        saveToFirestore('allocations', allocation.id, allocation);
    };

    const toggleSemesterPlan = async (entry: SemesterPlanEntry) => {
        const safeId = entry.id.replace(/[^a-zA-Z0-9_]/g, '_');
        const myAlloc = allocations.find(a => a.moduleCode.trim() === entry.moduleCode.trim());
        const myRoomId = myAlloc?.roomId;
        const myTutorId = myAlloc?.tutorId;
        const safeEntry: SemesterPlanEntry = { ...entry, id: safeId, roomId: myRoomId };

        const logicalConflicts = semesterPlans.filter(p => 
            p.programId === entry.programId &&
            p.year === entry.year &&
            p.weekNumber === entry.weekNumber &&
            p.sessionNumber === entry.sessionNumber
        );

        let isToggleOff = false;
        if (logicalConflicts.length === 1 && logicalConflicts[0].moduleCode === entry.moduleCode) {
            isToggleOff = true;
        }

        if (!isToggleOff) {
            const conflict = semesterPlans.find(existingPlan => {
                if (existingPlan.weekNumber !== entry.weekNumber || existingPlan.sessionNumber !== entry.sessionNumber) return false;
                if (existingPlan.programId === entry.programId && existingPlan.year === entry.year) return false; 
                const otherAlloc = allocations.find(a => a.moduleCode === existingPlan.moduleCode);
                const otherTutorId = otherAlloc?.tutorId;
                const otherRoomId = existingPlan.roomId || otherAlloc?.roomId;
                if (myTutorId && otherTutorId === myTutorId) return true;
                if (myRoomId && otherRoomId && otherRoomId === myRoomId) return true;
                return false;
            });
            if (conflict) return; 
        }

        if (isToggleOff) {
            setSemesterPlans(prev => prev.filter(p => !logicalConflicts.some(c => c.id === p.id)));
        } else {
            setSemesterPlans(prev => [...prev.filter(p => !logicalConflicts.some(c => c.id === p.id)), safeEntry]);
        }

        if (db && !isOfflineMode) {
            try {
                const batch = writeBatch(db);
                logicalConflicts.forEach(c => batch.delete(doc(db!, "semester_plans", c.id)));
                if (!isToggleOff) batch.set(doc(db!, "semester_plans", safeId), deepClean(safeEntry));
                await batch.commit();
            } catch (e: any) { safeLogError("Error toggling plan", e); }
        }
    };

    const clearSemesterPlan = async (programId: string, year: number) => {
        const toRemove = semesterPlans.filter(p => p.programId === programId && p.year === year);
        setSemesterPlans(prev => prev.filter(p => !(p.programId === programId && p.year === year)));
        if (db && !isOfflineMode) {
            try {
                const batch = writeBatch(db);
                toRemove.forEach(p => batch.delete(doc(db!, 'semester_plans', p.id)));
                await batch.commit();
            } catch (e) { safeLogError("Error clearing plan", e); }
        }
    };

    const addCustomEvent = (event: CustomEvent) => { setCustomEvents(prev => [...prev, event]); saveToFirestore('custom_events', event.id, event); };
    const deleteCustomEvent = (id: string) => { setCustomEvents(prev => prev.filter(e => e.id !== id)); deleteFromFirestore('custom_events', id); };
    const addBrief = (brief: AssignmentBrief) => { setBriefs(prev => [...prev, brief]); saveToFirestore('briefs', brief.id, brief); };
    const updateBrief = (brief: AssignmentBrief) => { setBriefs(prev => prev.map(b => b.id === brief.id ? brief : b)); saveToFirestore('briefs', brief.id, brief); };
    const addSubmission = (sub: Submission) => { setSubmissions(prev => [...prev, sub]); saveToFirestore('submissions', sub.id, sub); };
    const updateSubmission = (sub: Submission) => { setSubmissions(prev => prev.map(s => s.id === sub.id ? sub : s)); saveToFirestore('submissions', sub.id, sub); };
    const markAttendance = (record: AttendanceRecord) => { setAttendance(prev => { const others = prev.filter(a => a.id !== record.id); return [...others, record]; }); saveToFirestore('attendance', record.id, record); };
    const addUser = (user: User) => { setUsers(prev => [...prev, user]); saveToFirestore('users', user.id, user); };
    
    const updateUserRole = (userId: string, role: Role) => {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
        if (db && !isOfflineMode) updateDoc(doc(db, 'users', userId), { role }).catch(e => {});
    };

    const updateUserProfile = async (userId: string, updates: Partial<User>) => {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
        if (currentUser && currentUser.id === userId) setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
        if (db && !isOfflineMode) {
             try { await updateDoc(doc(db, 'users', userId), deepClean(updates)); } catch (e) { 
                 const u = users.find(user => user.id === userId);
                 if(u) await setDoc(doc(db, 'users', userId), deepClean({ ...u, ...updates }));
             }
        }
    };

    const deleteUser = async (userId: string) => { setUsers(prev => prev.filter(u => u.id !== userId)); await deleteFromFirestore('users', userId); };
    
    const updateSemesterConfig = (config: SemesterConfig) => { 
        // Explicitly destructure to avoid React objects/circular refs
        const cleanConfig = { 
            activeType: config.activeType,
            oddStartDate: config.oddStartDate,
            oddEndDate: config.oddEndDate,
            evenStartDate: config.evenStartDate,
            evenEndDate: config.evenEndDate,
            feedbackOpenOdd: (config as any).feedbackOpenOdd,
            feedbackOpenEven: (config as any).feedbackOpenEven,
            feedbackOpen: config.feedbackOpen
        };
        setSemesterConfigState(cleanConfig as SemesterConfig); 
        if (db && !isOfflineMode) setDoc(doc(db, 'config', 'semester'), deepClean(cleanConfig)); 
    };

    const addHoliday = (holiday: Holiday) => { setHolidays(prev => [...prev, holiday]); saveToFirestore('holidays', holiday.id, holiday); };
    const removeHoliday = (id: string) => { setHolidays(prev => prev.filter(h => h.id !== id)); deleteFromFirestore('holidays', id); };
    const addRoom = (room: Room) => { setRooms(prev => [...prev, room]); saveToFirestore('rooms', room.id, room); };
    const updateRoom = (room: Room) => { setRooms(prev => prev.map(r => r.id === room.id ? room : r)); saveToFirestore('rooms', room.id, room); };
    const deleteRoom = (id: string) => { setRooms(prev => prev.filter(r => r.id !== id)); deleteFromFirestore('rooms', id); };
    
    const addAiModule = (mod: AIClassModule) => { 
        // Ensure module data is clean before adding to state to prevent cycle issues later
        const cleanMod = deepClean(mod);
        setAiModules(prev => [...prev, cleanMod]); 
        saveToFirestore('ai_modules', mod.id, cleanMod); 
    };
    
    const updateAiModule = (mod: AIClassModule) => { 
        const cleanMod = deepClean(mod);
        setAiModules(prev => prev.map(m => m.id === mod.id ? cleanMod : m)); 
        saveToFirestore('ai_modules', mod.id, cleanMod); 
    };
    
    const deleteAiModule = (id: string) => { setAiModules(prev => prev.filter(m => m.id !== id)); deleteFromFirestore('ai_modules', id); };
    const addLessonPlan = (plan: LessonPlan) => { setLessonPlans(prev => [...prev, plan]); saveToFirestore('lesson_plans', plan.id, plan); };
    const updateLessonPlan = (plan: LessonPlan) => { setLessonPlans(prev => prev.map(p => p.id === plan.id ? plan : p)); saveToFirestore('lesson_plans', plan.id, plan); };
    
    const saveModuleSyllabus = (syllabus: ModuleSyllabus) => {
        setModuleSyllabi(prev => {
            const filtered = prev.filter(s => s.moduleCode !== syllabus.moduleCode);
            return [...filtered, syllabus];
        });
        saveToFirestore('module_syllabi', syllabus.id, syllabus);
    };

    const runGamificationEngine = async () => {
        // Trigger Server-Side Logic Simulation
        const calculated = await calculateGamificationLeaderboard(
            users, attendance, submissions, briefs, surveys, semesterStartDate
        );
        setLeaderboard(calculated);
        saveToFirestore('leaderboard', 'current_semester', { data: calculated, updatedAt: Date.now() });
    };

    return (
        <AppContext.Provider value={{
            currentUser, users, curriculum, surveys, allocations, semesterPlans,
            briefs, submissions, attendance, holidays, customEvents, rooms, aiModules, lessonPlans, moduleSyllabi, 
            leaderboard, semesterConfig,
            currentSemesterType, semesterStartDate, semesterEndDate, isOfflineMode, activeRole,
            setActiveRole, login, logout, submitSurvey, assignTutor, toggleSemesterPlan,
            clearSemesterPlan, addCustomEvent, deleteCustomEvent, addBrief, updateBrief,
            addSubmission, updateSubmission, markAttendance, addUser, updateUserRole,
            updateUserProfile, deleteUser, updateSemesterConfig, addHoliday, removeHoliday,
            addRoom, updateRoom, deleteRoom, addAiModule, updateAiModule, deleteAiModule,
            addLessonPlan, updateLessonPlan, saveModuleSyllabus, runGamificationEngine
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) throw new Error('useApp must be used within an AppProvider');
    return context;
};
