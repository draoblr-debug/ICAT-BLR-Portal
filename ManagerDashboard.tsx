
// components/ManagerDashboard.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from './AppContext';
import { Role, User, AssignmentBrief } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend } from 'recharts';
import { Users, UserPlus, Save, CheckCircle, Clock, Calendar, Settings, FileText, Layout, Zap, ThumbsUp, ThumbsDown, BookOpen, Edit, Trash2, Plus, Filter, X, List, Layers, ArrowRight, BarChart2, RefreshCw, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { normalizeProgram, getHodDepartments, getLocalDateString } from './data';
import { calculateModulePerformance, calculateDepartmentPerformance, calculateLessonTracking, calculateDetailedAnalysis } from './analyticsService';

export const ManagerDashboard = () => {
  const {
    surveys, curriculum, currentSemesterType, users, addUser, updateUserProfile, deleteUser,
    briefs, updateBrief, semesterConfig, updateSemesterConfig, 
    holidays, addHoliday, removeHoliday, semesterPlans, lessonPlans, aiModules, allocations, semesterStartDate
  } = useApp();

  const [activeTab, setActiveTab] = useState<'analytics' | 'dept_performance' | 'lesson_tracking' | 'coursework' | 'users' | 'settings' | 'calendar'>('analytics');

  // Async Data States (Server-Side Aggregation Simulation)
  const [modulePerformance, setModulePerformance] = useState<any[]>([]);
  const [departmentPerformance, setDepartmentPerformance] = useState<any[]>([]);
  const [lessonTrackingData, setLessonTrackingData] = useState<any[]>([]);
  const [detailedAnalysisData, setDetailedAnalysisData] = useState<any[]>([]);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<number>(Date.now());

  // Settings state
  const [configState, setConfigState] = useState({
    activeType: 'Odd' as 'Odd' | 'Even',
    oddStartDate: '',
    oddEndDate: '',
    evenStartDate: '',
    evenEndDate: '',
    feedbackOpenOdd: false,
    feedbackOpenEven: false,
  });

  // User Management State
  const [userSearch, setUserSearch] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User>>({});

  // Lesson Tracking Filters
  const [lessonFilterProgram, setLessonFilterProgram] = useState<string>('All');
  const [lessonFilterYear, setLessonFilterYear] = useState<string>('All');
  const [lessonFilterTutor, setLessonFilterTutor] = useState<string>('All');
  
  // Calendar State
  const [currentCalDate, setCurrentCalDate] = useState(new Date());
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');

  // Brief Approval & Editing State
  const [selectedBrief, setSelectedBrief] = useState<AssignmentBrief | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Analytics Selection
  const [selectedAnalysisModule, setSelectedAnalysisModule] = useState<string | null>(null);

  // --- DATA FETCHING (Simulating Backend Aggregation) ---
  const refreshAnalytics = async () => {
      setIsRefreshing(true);
      
      // Module Performance
      const modPerf = await calculateModulePerformance(surveys, curriculum);
      setModulePerformance(modPerf);

      // Department Performance
      const deptPerf = await calculateDepartmentPerformance(users, curriculum, currentSemesterType, semesterPlans, allocations);
      setDepartmentPerformance(deptPerf);

      // Lesson Tracking
      const lessonTrack = await calculateLessonTracking(semesterStartDate, curriculum, currentSemesterType, allocations, users, semesterPlans, lessonPlans, aiModules, holidays);
      setLessonTrackingData(lessonTrack);

      setLastRefreshed(Date.now());
      setIsRefreshing(false);
  };

  // Initial Load & On Tab Change if Data Missing
  useEffect(() => {
      if (modulePerformance.length === 0) refreshAnalytics();
  }, []);

  // Dedicated effect for Detailed Analysis to avoid re-calculating whole dashboard
  useEffect(() => {
      const loadDetails = async () => {
          if (!selectedAnalysisModule) {
              setDetailedAnalysisData([]);
              return;
          }
          const details = await calculateDetailedAnalysis(selectedAnalysisModule, surveys);
          setDetailedAnalysisData(details);
      };
      loadDetails();
  }, [selectedAnalysisModule, surveys]);

  useEffect(() => {
    if (!semesterConfig) return;
    setConfigState(prev => ({
      ...prev,
      activeType: semesterConfig.activeType || 'Odd',
      oddStartDate: semesterConfig.oddStartDate || '',
      oddEndDate: semesterConfig.oddEndDate || '',
      evenStartDate: semesterConfig.evenStartDate || '',
      evenEndDate: semesterConfig.evenEndDate || '',
      feedbackOpenOdd: (semesterConfig as any).feedbackOpenOdd ?? (semesterConfig.feedbackOpen ?? false),
      feedbackOpenEven: (semesterConfig as any).feedbackOpenEven ?? (semesterConfig.feedbackOpen ?? false),
    }));
  }, [semesterConfig]);

  const handleSaveSettings = () => {
    const payload = {
      activeType: configState.activeType,
      oddStartDate: configState.oddStartDate,
      oddEndDate: configState.oddEndDate,
      evenStartDate: configState.evenStartDate,
      evenEndDate: configState.evenEndDate,
      feedbackOpenOdd: configState.feedbackOpenOdd,
      feedbackOpenEven: configState.feedbackOpenEven
    };
    updateSemesterConfig(payload as any);
    alert('Configuration updated.');
  };

  // --- USER HANDLERS ---
  const handleSaveUser = async () => {
      if (!editingUser.email || !editingUser.name || !editingUser.role) { alert("Missing required fields"); return; }
      const userId = editingUser.id || `user-${Date.now()}`;
      const newUser: User = {
          id: userId,
          name: editingUser.name,
          email: editingUser.email,
          role: editingUser.role as Role,
          programId: editingUser.programId || '',
          year: Number(editingUser.year),
          password: editingUser.password || userId // Default password is ID
      };
      if (editingUser.id) { await updateUserProfile(editingUser.id, newUser); } else { addUser(newUser); }
      setIsUserModalOpen(false); setEditingUser({});
  };

  const handleDeleteUser = async (id: string) => { if (confirm("Delete this user?")) { await deleteUser(id); } };

  const filteredUsers = useMemo(() => {
      return users.filter(u => 
          u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
          u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.id.toLowerCase().includes(userSearch.toLowerCase())
      );
  }, [users, userSearch]);

  const filteredLessonTrackingData = useMemo(() => {
      return lessonTrackingData.filter(item => {
          const progMatch = lessonFilterProgram === 'All' || item.module.programTitle === lessonFilterProgram;
          const yearMatch = lessonFilterYear === 'All' || item.module.year.toString() === lessonFilterYear;
          const tutorMatch = lessonFilterTutor === 'All' || item.tutorName === lessonFilterTutor;
          return progMatch && yearMatch && tutorMatch;
      });
  }, [lessonTrackingData, lessonFilterProgram, lessonFilterYear, lessonFilterTutor]);

  // Derived options for filters (Calculated from the pre-fetched data)
  const uniquePrograms = useMemo(() => Array.from(new Set(lessonTrackingData.map(d => d.module.programTitle))).sort(), [lessonTrackingData]);
  const uniqueTutors = useMemo(() => Array.from(new Set(lessonTrackingData.map(d => d.tutorName))).sort(), [lessonTrackingData]);

  // --- COURSEWORK APPROVAL HANDLERS ---
  const pendingBriefs = useMemo(() => {
      return briefs.filter(b => b.status === 'Pending Approval').sort((a,b) => b.createdAt - a.createdAt);
  }, [briefs]);

  const handleApproveBrief = (brief: AssignmentBrief) => {
      updateBrief({ ...brief, status: 'Published' });
      setIsReviewModalOpen(false);
      setSelectedBrief(null);
      alert(`Brief "${brief.title}" has been published.`);
  };

  const handleRejectBrief = () => {
      if (!selectedBrief || !rejectionReason) return;
      updateBrief({ ...selectedBrief, status: 'Rejected', feedback: rejectionReason });
      setIsRejectModalOpen(false);
      setIsReviewModalOpen(false);
      setRejectionReason('');
      setSelectedBrief(null);
      alert("Brief rejected and feedback sent to tutor.");
  };

  const handleOpenReview = (brief: AssignmentBrief) => {
      setSelectedBrief(brief);
      setIsReviewModalOpen(true);
  };

  // Calendar Logic
  const handleAddHoliday = () => {
      if (!newHolidayName || !newHolidayDate) return;
      addHoliday({ id: `hol-${Date.now()}`, name: newHolidayName, date: newHolidayDate });
      setNewHolidayName(''); setNewHolidayDate('');
  };
  const calendarDays = useMemo(() => {
      const year = currentCalDate.getFullYear();
      const month = currentCalDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startDay = firstDay.getDay();
      const days = [];
      for (let i = 0; i < startDay; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) {
          const d = new Date(year, month, i);
          const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dayVal = String(d.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${dayVal}`;
          const hol = holidays.find(h => h.date === dateStr);
          days.push({ day: i, dateStr, holiday: hol });
      }
      return days;
  }, [currentCalDate, holidays]);

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="bg-white shadow rounded-lg p-2 flex gap-4 w-full justify-between items-center">
        <div className="flex gap-2 overflow-x-auto">
            {['analytics', 'dept_performance', 'lesson_tracking', 'coursework', 'users', 'settings', 'calendar'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex items-center px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap capitalize ${activeTab === tab ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>{tab.replace('_', ' ')}</button>
            ))}
        </div>
        <button 
            onClick={refreshAnalytics} 
            disabled={isRefreshing}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 px-3 py-1 bg-gray-50 hover:bg-indigo-50 rounded-full border border-gray-200 transition-colors"
            title="Recalculate dashboard metrics"
        >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? 'Refreshing...' : `Updated: ${new Date(lastRefreshed).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
        </button>
      </div>

      {activeTab === 'analytics' && (
          <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Overview Chart */}
                  <div className="bg-white p-6 rounded-lg shadow">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">Module Feedback Overview</h3>
                      <div className="h-64">
                          {isRefreshing ? (
                              <div className="flex items-center justify-center h-full text-gray-400"><Loader2 className="animate-spin mr-2"/> Updating...</div>
                          ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={modulePerformance} onClick={(data: any) => data && setSelectedAnalysisModule(data.activePayload?.[0]?.payload?.code)}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey="name" fontSize={12} tick={{dy: 5}} />
                                      <YAxis domain={[0, 5]} />
                                      <Tooltip />
                                      <Bar dataKey="avg" fill="#4F46E5" radius={[4, 4, 0, 0]} cursor="pointer" />
                                  </BarChart>
                              </ResponsiveContainer>
                          )}
                      </div>
                      <p className="text-xs text-gray-500 text-center mt-2">Click a bar to view detailed feedback analysis.</p>
                  </div>

                  {/* Detailed Radar Chart */}
                  <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                      <h3 className="text-lg font-bold text-gray-800 mb-1">Detailed Feedback Analysis</h3>
                      <p className="text-sm text-gray-500 mb-4">
                          {selectedAnalysisModule 
                              ? `Performance Breakdown: ${curriculum.find(m => m.code === selectedAnalysisModule)?.title || selectedAnalysisModule}` 
                              : "Select a module from the chart on the left to view details."}
                      </p>
                      
                      {selectedAnalysisModule && detailedAnalysisData.length > 0 ? (
                          <div className="h-64 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={detailedAnalysisData}>
                                      <PolarGrid />
                                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                                      <PolarRadiusAxis angle={30} domain={[0, 5]} />
                                      <Radar name="Feedback Score" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                                      <Tooltip />
                                  </RadarChart>
                              </ResponsiveContainer>
                          </div>
                      ) : (
                          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg text-gray-400">
                              <BarChart2 size={48} className="opacity-20" />
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
      
      {activeTab === 'dept_performance' && (
          isRefreshing ? (
              <div className="text-center py-20 text-gray-500"><Loader2 className="animate-spin inline mr-2"/> Aggregating department data...</div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {departmentPerformance.map((dept) => (
                      <div key={dept.hod.id} className="bg-white rounded-lg shadow p-5 border border-gray-100 hover:shadow-md transition-shadow flex flex-col">
                          <div className="flex flex-col mb-4 border-b pb-4">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <h4 className="font-bold text-gray-900 text-lg flex items-center gap-2"><Users size={20} className="text-indigo-600"/> {dept.hod.name}</h4>
                                      <p className="text-xs text-gray-500 mt-1 line-clamp-1" title={dept.departments}>{dept.departments}</p>
                                  </div>
                              </div>
                              <div className="flex gap-2 mt-3">
                                  <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold border border-indigo-100 flex-1 text-center">{dept.totalModules} Modules</span>
                                  <span className="bg-gray-50 text-gray-700 px-2 py-1 rounded text-xs font-bold border border-gray-200 flex-1 text-center">{dept.totalBatches} Batches</span>
                              </div>
                          </div>
                          
                          <div className="space-y-4 flex-1">
                              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide">Planning</span>
                                      <span className="text-xs font-bold text-blue-600">{dept.planningProgress}%</span>
                                  </div>
                                  <div className="w-full bg-blue-200 rounded-full h-1.5 mb-1"><div className={`h-1.5 rounded-full ${dept.planningProgress === 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${dept.planningProgress}%` }}></div></div>
                                  <div className="text-xs text-blue-700 text-right">{dept.plannedBatches} / {dept.totalBatches} Batches</div>
                              </div>
                              
                              <div className="bg-teal-50 p-3 rounded-lg border border-teal-100">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wide">Staffing</span>
                                      <span className="text-xs font-bold text-teal-600">{dept.tutorAllocProgress}%</span>
                                  </div>
                                  <div className="w-full bg-teal-200 rounded-full h-1.5 mb-1"><div className={`h-1.5 rounded-full ${dept.tutorAllocProgress === 100 ? 'bg-green-500' : 'bg-teal-600'}`} style={{ width: `${dept.tutorAllocProgress}%` }}></div></div>
                                  <div className="text-xs text-teal-700 text-right">{dept.allocatedTutors} / {dept.totalModules} Modules</div>
                              </div>
                              
                              <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wide">Rooms</span>
                                      <span className="text-xs font-bold text-orange-600">{dept.roomAllocProgress}%</span>
                                  </div>
                                  <div className="w-full bg-orange-200 rounded-full h-1.5 mb-1"><div className={`h-1.5 rounded-full ${dept.roomAllocProgress === 100 ? 'bg-green-500' : 'bg-orange-600'}`} style={{ width: `${dept.roomAllocProgress}%` }}></div></div>
                                  <div className="text-xs text-orange-700 text-right">{dept.allocatedRooms} / {dept.totalModules} Modules</div>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          )
      )}

      {activeTab === 'lesson_tracking' && (
          <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow border-l-4 border-teal-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                      <h3 className="text-lg font-bold text-gray-900">Lesson Readiness Tracker</h3>
                      <p className="text-sm text-gray-500">Monitoring Lesson Plan structure and AI Content generation.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                        <div className="relative">
                            <select value={lessonFilterProgram} onChange={e => setLessonFilterProgram(e.target.value)} className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md border">
                                <option value="All">All Programs</option>
                                {uniquePrograms.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div className="relative">
                            <select value={lessonFilterYear} onChange={e => setLessonFilterYear(e.target.value)} className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md border">
                                <option value="All">All Years</option>
                                <option value="1">Year 1</option>
                                <option value="2">Year 2</option>
                                <option value="3">Year 3</option>
                                <option value="4">Year 4</option>
                            </select>
                        </div>
                        <div className="relative">
                            <select value={lessonFilterTutor} onChange={e => setLessonFilterTutor(e.target.value)} className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md border">
                                <option value="All">All Tutors</option>
                                {uniqueTutors.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <button onClick={() => { setLessonFilterProgram('All'); setLessonFilterYear('All'); setLessonFilterTutor('All'); }} className="p-2 text-gray-500 hover:text-red-500" title="Reset Filters"><Filter size={16}/></button>
                  </div>
              </div>
              
              {isRefreshing ? (
                  <div className="text-center py-20 text-gray-500"><Loader2 className="animate-spin inline mr-2"/> Calculating session data...</div>
              ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {filteredLessonTrackingData.map((item) => (
                          <div key={item.module.code} className="bg-white rounded-lg shadow overflow-hidden p-5 border border-gray-100 hover:border-indigo-200 transition-colors">
                              <div className="flex flex-col justify-between mb-4">
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-gray-900 text-lg flex items-center">{item.module.title}</h4>
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border">{item.module.code}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-gray-500">
                                      <span className="flex items-center gap-1"><Users size={14}/> {item.tutorName}</span>
                                      <span className="flex items-center gap-1"><Clock size={14}/> Year {item.module.year}</span>
                                  </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg mb-3">
                                  <div>
                                      <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1"><Layout size={10}/> Structure</span><span className="text-xs font-bold text-indigo-600">{item.chunkProgress}%</span></div>
                                      <div className="w-full bg-gray-200 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${item.chunkProgress===100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{width: `${item.chunkProgress}%`}}></div></div>
                                      <div className="mt-1 text-xs text-gray-600">{item.sessionsChunked} / {item.totalSessions} Sessions</div>
                                  </div>
                                  <div>
                                      <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1"><Zap size={10}/> Content</span><span className="text-xs font-bold text-teal-600">{item.contentProgress}%</span></div>
                                      <div className="w-full bg-gray-200 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${item.contentProgress===100 ? 'bg-green-500' : 'bg-teal-500'}`} style={{width: `${item.contentProgress}%`}}></div></div>
                                      <div className="mt-1 text-xs text-gray-600">{item.contentReadyChunks} / {item.totalActivities} Parts</div>
                                  </div>
                              </div>
                              
                              <div className="flex gap-2">
                                  <div className={`flex-1 px-2 py-1 rounded text-[10px] font-bold border text-center ${item.statusColor}`}>{item.statusLabel}</div>
                                  <div className={`flex-1 px-2 py-1 rounded text-[10px] font-bold border text-center ${item.contentStatusColor}`}>{item.contentStatusLabel}</div>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {activeTab === 'coursework' && (
          <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2"><FileText className="text-indigo-600"/> Brief Approvals</h2>
                  <p className="text-sm text-gray-500 mb-6">Review pending assignment briefs submitted by tutors.</p>
                  
                  {pendingBriefs.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                          <CheckCircle className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                          <h3 className="text-lg font-medium text-gray-900">All Caught Up!</h3>
                          <p className="text-gray-500">No pending briefs to review.</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 gap-4">
                          {pendingBriefs.map(brief => {
                              const tutor = users.find(u => u.id === brief.tutorId);
                              return (
                                  <div key={brief.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between gap-4">
                                      <div className="flex-1 flex gap-4">
                                          {brief.coverImageUrl && (
                                              <img src={brief.coverImageUrl} alt="Cover" className="w-20 h-20 object-cover rounded-md shadow-sm border border-gray-100 flex-shrink-0" />
                                          )}
                                          <div>
                                              <div className="flex items-center gap-2 mb-1">
                                                  <h3 className="text-lg font-bold text-gray-900">{brief.title}</h3>
                                                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full border border-yellow-200 font-bold">Pending Approval</span>
                                              </div>
                                              <div className="text-sm text-gray-600 mb-2">
                                                  <span className="font-semibold">{brief.moduleCode}</span> • Submitted by {tutor?.name || brief.tutorId}
                                              </div>
                                              <div className="flex gap-4 text-xs text-gray-500">
                                                  <span className="flex items-center gap-1"><Clock size={12}/> {new Date(brief.createdAt).toLocaleDateString()}</span>
                                                  <span className="flex items-center gap-1"><Calendar size={12}/> {brief.weeks} Weeks</span>
                                              </div>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <button 
                                              onClick={() => handleOpenReview(brief)}
                                              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-medium flex items-center"
                                          >
                                              <BookOpen size={16} className="mr-1"/> Review
                                          </button>
                                          <button 
                                              onClick={() => { setSelectedBrief(brief); setIsRejectModalOpen(true); }}
                                              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-sm font-medium flex items-center"
                                          >
                                              <ThumbsDown size={16} className="mr-1"/> Reject
                                          </button>
                                          <button 
                                              onClick={() => handleApproveBrief(brief)}
                                              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium flex items-center shadow-sm"
                                          >
                                              <ThumbsUp size={16} className="mr-1"/> Approve
                                          </button>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'users' && (
          <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900">User Management</h2>
                  <button onClick={() => { setEditingUser({}); setIsUserModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center"><UserPlus size={16} className="mr-2"/> Add User</button>
              </div>
              <div className="mb-4">
                  <input type="text" placeholder="Search users..." className="w-full border border-gray-300 rounded p-2" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              </div>
              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {filteredUsers.slice(0, 50).map(u => (
                              <tr key={u.id}>
                                  <td className="px-6 py-4 whitespace-nowrap"><div className="font-medium text-gray-900">{u.name}</div><div className="text-xs text-gray-500">{u.id}</div></td>
                                  <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">{u.role}</span></td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <button onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }} className="text-indigo-600 hover:text-indigo-900 mr-4"><Edit size={16}/></button>
                                      <button onClick={() => handleDeleteUser(u.id)} className="text-red-600 hover:text-red-900"><Trash2 size={16}/></button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === 'settings' && (
          <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Settings className="text-indigo-600"/> Semester Settings</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                      <h3 className="font-medium text-gray-700 border-b pb-2">Academic Calendar Period</h3>
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Active Semester Type</label>
                          <select 
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2"
                              value={configState.activeType}
                              onChange={e => setConfigState({...configState, activeType: e.target.value as any})}
                          >
                              <option value="Odd">Odd Semester</option>
                              <option value="Even">Even Semester</option>
                          </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-medium text-gray-500">Odd Sem Start</label>
                              <input type="date" className="mt-1 w-full border rounded p-2 text-sm" value={configState.oddStartDate} onChange={e => setConfigState({...configState, oddStartDate: e.target.value})}/>
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-gray-500">Odd Sem End</label>
                              <input type="date" className="mt-1 w-full border rounded p-2 text-sm" value={configState.oddEndDate} onChange={e => setConfigState({...configState, oddEndDate: e.target.value})}/>
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-gray-500">Even Sem Start</label>
                              <input type="date" className="mt-1 w-full border rounded p-2 text-sm" value={configState.evenStartDate} onChange={e => setConfigState({...configState, evenStartDate: e.target.value})}/>
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-gray-500">Even Sem End</label>
                              <input type="date" className="mt-1 w-full border rounded p-2 text-sm" value={configState.evenEndDate} onChange={e => setConfigState({...configState, evenEndDate: e.target.value})}/>
                          </div>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <h3 className="font-medium text-gray-700 border-b pb-2">System Controls</h3>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                              <div className="text-sm font-medium text-gray-900">Module Feedback (Odd Sem)</div>
                              <div className="text-xs text-gray-500">Allow students to submit surveys</div>
                          </div>
                          <input type="checkbox" className="h-5 w-5 text-indigo-600 rounded" checked={configState.feedbackOpenOdd} onChange={e => setConfigState({...configState, feedbackOpenOdd: e.target.checked})} />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                              <div className="text-sm font-medium text-gray-900">Module Feedback (Even Sem)</div>
                              <div className="text-xs text-gray-500">Allow students to submit surveys</div>
                          </div>
                          <input type="checkbox" className="h-5 w-5 text-indigo-600 rounded" checked={configState.feedbackOpenEven} onChange={e => setConfigState({...configState, feedbackOpenEven: e.target.checked})} />
                      </div>
                  </div>
              </div>
              
              <div className="mt-8 flex justify-end">
                  <button onClick={handleSaveSettings} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2">
                      <Save size={18}/> Save Configuration
                  </button>
              </div>
          </div>
      )}

      {activeTab === 'calendar' && (
          <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Calendar className="text-indigo-600"/> Academic Calendar</h2>
                  <div className="flex gap-2">
                      <button onClick={() => setCurrentCalDate(new Date(currentCalDate.getFullYear(), currentCalDate.getMonth() - 1, 1))} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft/></button>
                      <span className="text-lg font-bold min-w-[150px] text-center">{currentCalDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                      <button onClick={() => setCurrentCalDate(new Date(currentCalDate.getFullYear(), currentCalDate.getMonth() + 1, 1))} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight/></button>
                  </div>
              </div>

              <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden mb-6">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                      <div key={d} className="bg-gray-50 p-2 text-center text-xs font-bold text-gray-500 uppercase">{d}</div>
                  ))}
                  {calendarDays.map((day, idx) => (
                      <div key={idx} className={`bg-white min-h-[100px] p-2 relative group ${!day ? 'bg-gray-50' : ''}`}>
                          {day && (
                              <>
                                  <span className={`text-sm font-medium ${day.holiday ? 'text-red-600' : 'text-gray-700'}`}>{day.day}</span>
                                  {day.holiday && (
                                      <div className="mt-1 text-xs bg-red-100 text-red-800 p-1 rounded border border-red-200 truncate">
                                          {day.holiday.name}
                                          <button onClick={() => removeHoliday(day.holiday.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800"><X size={12}/></button>
                                      </div>
                                  )}
                              </>
                          )}
                      </div>
                  ))}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg flex gap-4 items-end">
                  <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Holiday Name</label>
                      <input type="text" className="w-full border rounded p-2 text-sm" placeholder="e.g. Republic Day" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} />
                  </div>
                  <div className="w-48">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Date</label>
                      <input type="date" className="w-full border rounded p-2 text-sm" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} />
                  </div>
                  <button onClick={handleAddHoliday} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-indigo-700">Add Holiday</button>
              </div>
          </div>
      )}
      
      {/* Modals remain same */}
      {isUserModalOpen && (
          <div className="fixed z-50 inset-0 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-lg p-6 max-w-lg w-full">
                  <h3 className="text-lg font-bold mb-4">{editingUser.id ? 'Edit User' : 'Add New User'}</h3>
                  <div className="space-y-3">
                      <div><label className="block text-sm font-medium">Full Name</label><input className="w-full border p-2 rounded" value={editingUser.name || ''} onChange={e => setEditingUser({...editingUser, name: e.target.value})} /></div>
                      <div><label className="block text-sm font-medium">Email</label><input className="w-full border p-2 rounded" value={editingUser.email || ''} onChange={e => setEditingUser({...editingUser, email: e.target.value})} /></div>
                      <div>
                          <label className="block text-sm font-medium">Role</label>
                          <select className="w-full border p-2 rounded" value={editingUser.role || ''} onChange={e => setEditingUser({...editingUser, role: e.target.value as Role})}>
                              <option value="">Select Role...</option>
                              {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                      </div>
                      {editingUser.role === Role.Student && (
                          <>
                              <div><label className="block text-sm font-medium">Program ID</label><input className="w-full border p-2 rounded" value={editingUser.programId || ''} onChange={e => setEditingUser({...editingUser, programId: e.target.value})} /></div>
                              <div><label className="block text-sm font-medium">Year</label><input type="number" className="w-full border p-2 rounded" value={editingUser.year || ''} onChange={e => setEditingUser({...editingUser, year: parseInt(e.target.value)})} /></div>
                          </>
                      )}
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                      <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                      <button onClick={handleSaveUser} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Save User</button>
                  </div>
              </div>
          </div>
      )}
      
      {isReviewModalOpen && selectedBrief && (
          <div className="fixed z-50 inset-0 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-start mb-6 border-b pb-4">
                      <div>
                          <h3 className="text-xl font-bold">{selectedBrief.title}</h3>
                          <p className="text-sm text-gray-500">{selectedBrief.moduleCode} • Week {selectedBrief.weeks}</p>
                      </div>
                      <button onClick={() => { setIsReviewModalOpen(false); setSelectedBrief(null); }}><X size={24} className="text-gray-400 hover:text-gray-600"/></button>
                  </div>
                  
                  <div className="space-y-6">
                      <div>
                          <h4 className="font-bold text-sm text-gray-500 uppercase mb-2">Learning Outcomes</h4>
                          <ul className="list-disc pl-5 space-y-1 text-sm">{selectedBrief.learningOutcomes.map((lo, i) => <li key={i}>{lo}</li>)}</ul>
                      </div>
                      
                      <div>
                          <h4 className="font-bold text-sm text-gray-500 uppercase mb-2">Weekly Schedule</h4>
                          <div className="grid gap-2">
                              {selectedBrief.weeklySchedule.map((w, i) => (
                                  <div key={i} className="bg-gray-50 p-3 rounded border border-gray-100">
                                      <div className="text-xs font-bold text-indigo-600">Week {w.weekNumber}</div>
                                      <div className="font-medium text-sm">{w.topic}</div>
                                      <div className="text-xs text-gray-500">{w.description}</div>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div>
                          <h4 className="font-bold text-sm text-gray-500 uppercase mb-2">Deliverables</h4>
                          {selectedBrief.deliverables.map(d => (
                              <div key={d.id} className="border rounded p-3 mb-2">
                                  <div className="flex justify-between font-bold text-sm"><span>{d.title}</span><span>Week {d.weekNumber}</span></div>
                                  <div className="text-xs text-gray-500 mt-1">{d.type} Submission</div>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="mt-8 flex justify-end gap-3 pt-4 border-t">
                      <button onClick={() => { setIsRejectModalOpen(true); setIsReviewModalOpen(false); }} className="px-4 py-2 border border-red-200 text-red-600 rounded hover:bg-red-50 font-bold">Reject</button>
                      <button onClick={() => handleApproveBrief(selectedBrief)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold">Approve & Publish</button>
                  </div>
              </div>
          </div>
      )}

      {isRejectModalOpen && (
          <div className="fixed z-50 inset-0 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <h3 className="text-lg font-bold mb-4">Reject Brief</h3>
                  <p className="text-sm text-gray-500 mb-4">Please provide a reason for rejection. This will be sent to the tutor.</p>
                  <textarea 
                      className="w-full border rounded p-2 h-32 text-sm"
                      placeholder="e.g. Learning outcomes need to be more specific..."
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                  />
                  <div className="flex justify-end gap-3 mt-4">
                      <button onClick={() => setIsRejectModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                      <button onClick={handleRejectBrief} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold">Send Feedback</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
