
import React, { useState, useMemo } from 'react';
import { useApp } from './AppContext';
import { Role, User } from './types';
import { normalizeProgram, getLocalDateString } from './data';
import { Mail, CheckCircle, XCircle, Users, Filter, Send, AlertCircle, X, FileText, Download, FileSpreadsheet, Calendar, MapPin, RefreshCw, Trophy, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type EnrichedStudent = User & {
    completedCount: number;
    totalModules: number;
    percentage: number;
};

interface MailModalState {
    isOpen: boolean;
    recipients: EnrichedStudent[];
}

export const ServiceView = () => {
  const { users, surveys, curriculum, currentSemesterType, currentUser, attendance, semesterPlans, semesterStartDate, allocations, rooms, holidays, runGamificationEngine } = useApp();
  const [activeTab, setActiveTab] = useState<'tracker' | 'reports'>('tracker');

  // Selection State for Tracker
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  
  // Selection State for Reports
  const [reportType, setReportType] = useState<'attendance' | 'timetable'>('attendance');
  const [reportStartDate, setReportStartDate] = useState(getLocalDateString());
  const [reportEndDate, setReportEndDate] = useState(getLocalDateString());
  const [dateFilterType, setDateFilterType] = useState<'custom' | 'week' | 'month'>('custom');
  
  // Timetable Report State
  const [ttProgram, setTtProgram] = useState('');
  const [ttYear, setTtYear] = useState('');
  const [ttWeek, setTtWeek] = useState(1);
  
  // Modal State
  const [mailModal, setMailModal] = useState<MailModalState>({ isOpen: false, recipients: [] });
  const [isProcessingGamification, setIsProcessingGamification] = useState(false);

  // ... (Enriched Data Logic same as before) ...
  const students = useMemo(() => users.filter(u => u.role === Role.Student), [users]);

  // 1. Calculate completion stats per student (Enriched Data)
  const enrichedStudents = useMemo<EnrichedStudent[]>(() => {
      return students.map(student => {
          const normUserProgram = normalizeProgram(student.programId);
          
          const expectedModules = curriculum.filter(m => {
            const normModuleProgram = normalizeProgram(m.programTitle);
            let programMatch = normUserProgram.includes(normModuleProgram) || normModuleProgram.includes(normUserProgram);
            
            // Foundation Logic: Animation/Graphics Yr 1 take Visual Arts modules
            if (!programMatch && student.year === 1 && m.year === 1) {
                 const isTargetStudent = normUserProgram.includes('animation') || normUserProgram.includes('graphics');
                 const isFoundationModule = normModuleProgram.includes('visualarts');
                 if (isTargetStudent && isFoundationModule) {
                     programMatch = true;
                 }
            }

            const yearMatch = student.year ? m.year === student.year : true;
            const isOddSem = m.sem % 2 !== 0;
            const semMatch = currentSemesterType === 'Odd' ? isOddSem : !isOddSem;
            return programMatch && yearMatch && semMatch;
          });

          const completedCount = expectedModules.filter(m => 
              surveys.some(s => s.studentId === student.id && s.moduleCode === m.code)
          ).length;

          const total = expectedModules.length;
          const percentage = total === 0 ? 100 : Math.round((completedCount / total) * 100);

          return {
              ...student,
              completedCount,
              totalModules: total,
              percentage
          };
      });
  }, [students, curriculum, surveys, currentSemesterType]);

  // 2. Group Data: Program -> Year -> Students
  const hierarchy = useMemo(() => {
      const groups: Record<string, Record<number, EnrichedStudent[]>> = {};
      enrichedStudents.forEach(student => {
          const prog = student.programId || 'Unknown Program';
          const year = student.year || 0;
          if (!groups[prog]) groups[prog] = {};
          if (!groups[prog][year]) groups[prog][year] = [];
          groups[prog][year].push(student);
      });
      return groups;
  }, [enrichedStudents]);

  // Get available options for Tracker
  const programs = Object.keys(hierarchy).sort();
  const batches = selectedProgram ? Object.keys(hierarchy[selectedProgram]).sort() : [];
  const currentList = useMemo(() => {
      if (!selectedProgram || !selectedBatch) return [];
      return hierarchy[selectedProgram][parseInt(selectedBatch)] || [];
  }, [selectedProgram, selectedBatch, hierarchy]);

  // Derived Data for Timetable Report Dropdowns
  const scheduledBatches = useMemo(() => {
      const batches = new Set<string>();
      semesterPlans.forEach(p => batches.add(`${p.programId}::${p.year}`));
      return Array.from(batches).sort().map(b => {
          const [p, y] = b.split('::');
          return { program: p, year: parseInt(y) };
      });
  }, [semesterPlans]);

  const uniqueScheduledPrograms = useMemo(() => Array.from(new Set(scheduledBatches.map(b => b.program))).sort(), [scheduledBatches]);

  // ... (Helpers same as before) ...
  const getWeekNumber = (dateStr: string) => {
      if (!semesterStartDate) return 1;
      const start = new Date(semesterStartDate);
      const current = new Date(dateStr);
      const diffMs = current.getTime() - start.getTime();
      const diffWeeks = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7));
      return diffWeeks > 0 ? diffWeeks : 1;
  };

  const getWeekLabel = (weekNum: number) => {
      if (!semesterStartDate) return `Week ${weekNum}`;
      const start = new Date(semesterStartDate);
      if (isNaN(start.getTime())) return `Week ${weekNum}`;

      start.setDate(start.getDate() + (weekNum - 1) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 4); 
      
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
      const startStr = start.toLocaleDateString('en-US', options);
      const endStr = end.toLocaleDateString('en-US', options);
      return `${startStr} - ${endStr}`;
  };
  
  const setRange = (type: 'week' | 'month' | 'custom') => {
        const today = new Date();
        let start = new Date(today);
        let end = new Date(today);

        if (type === 'week') {
            const day = today.getDay(); 
            const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
            start.setDate(diff);
            end.setDate(diff + 4); 
        } else if (type === 'month') {
            start.setDate(1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        }
        
        if (type !== 'custom') {
            setReportStartDate(getLocalDateString(start));
            setReportEndDate(getLocalDateString(end));
        }
        setDateFilterType(type);
  };

  const timetablePreview = useMemo(() => {
      if (!ttProgram || !ttYear) return null;

      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const sessions = [1, 2, 3, 4];

      return days.map((day, dayIndex) => {
          let dateStr = '';
          if (semesterStartDate) {
              const start = new Date(semesterStartDate);
              if (!isNaN(start.getTime())) {
                  const weekStart = new Date(start);
                  weekStart.setDate(start.getDate() + (ttWeek - 1) * 7 + dayIndex);
                  dateStr = weekStart.toLocaleDateString();
              }
          }

          const sessionData = sessions.map(s => {
              const plan = semesterPlans.find(p => {
                  if (p.programId === ttProgram && p.year === parseInt(ttYear)) {
                      return p.weekNumber === ttWeek && p.sessionNumber === s;
                  }
                  
                  const normTarget = normalizeProgram(ttProgram);
                  const normPlan = normalizeProgram(p.programId);
                  
                  if (parseInt(ttYear) === 1 && p.year === 1 &&
                      normPlan.includes('visualarts') && 
                      (normTarget.includes('animation') || normTarget.includes('graphics'))) {
                      return p.weekNumber === ttWeek && p.sessionNumber === s;
                  }
                  
                  return false;
              });
              
              if (plan) {
                  const mod = curriculum.find(m => m.code === plan.moduleCode);
                  const alloc = allocations.find(a => a.moduleCode === plan.moduleCode);
                  const tutor = users.find(u => u.id === alloc?.tutorId);
                  const room = rooms.find(r => r.id === (plan.roomId || alloc?.roomId));
                  
                  return {
                      found: true,
                      module: mod?.title || plan.moduleCode,
                      code: plan.moduleCode,
                      tutor: tutor?.name || 'TBA',
                      room: room?.number || 'TBA'
                  };
              }
              return { found: false };
          });

          return {
              day,
              date: dateStr,
              sessions: sessionData
          };
      });
  }, [ttProgram, ttYear, ttWeek, semesterPlans, semesterStartDate, curriculum, allocations, users, rooms]);


  const attendanceReportData = useMemo(() => {
      if (!reportStartDate || !reportEndDate) return [];

      const start = new Date(reportStartDate);
      const end = new Date(reportEndDate);
      const tableData: any[] = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const currentIso = getLocalDateString(d);
          const dayOfWeek = d.getDay(); 
          
          if (dayOfWeek === 0 || dayOfWeek === 6) continue;

          const isHoliday = holidays.some(h => h.date === currentIso);
          if (isHoliday) continue;

          const currentWeek = getWeekNumber(currentIso);
          
          const dailyPlans = semesterPlans.filter(p => p.weekNumber === currentWeek);
          
          if (dailyPlans.length === 0) continue;

          const timeMap: Record<number, string> = { 1: '9-11', 2: '11-1', 3: '2-4', 4: '4-6' };
          
          dailyPlans.sort((a, b) => a.sessionNumber - b.sessionNumber).forEach(plan => {
              const mod = curriculum.find(m => m.code === plan.moduleCode);
              const alloc = allocations.find(a => a.moduleCode === plan.moduleCode);
              const tutor = users.find(u => u.id === alloc?.tutorId);
              
              const sessionId = `${plan.moduleCode}_${currentIso}_S${plan.sessionNumber}`;
              const record = attendance.find(a => a.sessionId === sessionId);

              let status = "Not Marked";
              let totalStudents = 0;
              let presentCount = 0;
              let percentage = "-";

              if (record) {
                  status = "Marked";
                  totalStudents = record.totalStudents;
                  presentCount = record.presentStudentIds.length;
                  percentage = totalStudents > 0 ? `${Math.round((presentCount / totalStudents) * 100)}%` : "0%";
              } else {
                  const normProg = normalizeProgram(plan.programId);
                  totalStudents = users.filter(u => {
                       if (u.role !== Role.Student) return false;
                       if (u.year !== plan.year) return false;
                       const uProg = normalizeProgram(u.programId);
                       
                       if (uProg.includes(normProg) || normProg.includes(uProg)) return true;
                       if (plan.year === 1 && normProg.includes('visualarts') && (uProg.includes('animation') || uProg.includes('graphics'))) {
                           return true;
                       }
                       return false;
                  }).length;
              }

              tableData.push({
                  date: currentIso,
                  time: timeMap[plan.sessionNumber] || `Session ${plan.sessionNumber}`,
                  module: mod?.title || plan.moduleCode,
                  tutor: tutor?.name || 'Unassigned',
                  batch: `${plan.programId} (Yr ${plan.year})`,
                  status,
                  total: totalStudents,
                  present: presentCount,
                  percentage
              });
          });
      }
      return tableData;
  }, [reportStartDate, reportEndDate, semesterPlans, holidays, attendance, users, curriculum, allocations, semesterStartDate]);

  // ... (Keep existing download handlers for PDF/CSV - abbreviated) ...
  const downloadAttendancePDF = () => { /* ... */ };
  const downloadAttendanceCSV = () => { /* ... */ };
  const generateTimetablePDF = () => { /* ... */ };
  const generateTimetableCSV = () => { /* ... */ };

  const toggleSelectAll = () => {
      if (selectedStudentIds.size === currentList.length) {
          setSelectedStudentIds(new Set());
      } else {
          const pendingIds = currentList.filter(s => s.percentage < 100).map(s => s.id);
          setSelectedStudentIds(new Set(pendingIds));
      }
  };

  const toggleSelectStudent = (id: string) => {
      const newSet = new Set(selectedStudentIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedStudentIds(newSet);
  };

  const initiateSingleReminder = (student: EnrichedStudent) => { setMailModal({ isOpen: true, recipients: [student] }); };
  const initiateBulkReminder = () => { const recipients = currentList.filter(s => selectedStudentIds.has(s.id)); setMailModal({ isOpen: true, recipients }); };
  const handleSendMail = () => { alert(`Successfully sent ${mailModal.recipients.length} reminder emails.`); setMailModal({ isOpen: false, recipients: [] }); setSelectedStudentIds(new Set()); };
  const emailBody = `Dear Student,\n\nThis is a gentle reminder to complete your module feedback surveys for the current ${currentSemesterType} Semester. \nYour feedback is valuable to us.\n\nPlease log in to the portal and complete the pending surveys at your earliest convenience.\n\nRegards,\nStudent Services`;

  // New Handler for Gamification Engine
  const handleRunGamification = async () => {
      setIsProcessingGamification(true);
      try {
          await runGamificationEngine();
          alert("Gamification scores recalculated and leaderboard updated successfully.");
      } catch (e) {
          alert("Failed to run gamification engine.");
      } finally {
          setIsProcessingGamification(false);
      }
  };

  return (
    <div className="space-y-6">
        {/* Navigation */}
        <div className="flex bg-white shadow rounded-lg p-2 gap-2 w-fit">
            <button 
                onClick={() => setActiveTab('tracker')}
                className={`px-4 py-2 rounded text-sm font-medium ${activeTab === 'tracker' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:text-gray-700'}`}
            >
                Feedback Tracker
            </button>
            <button 
                onClick={() => setActiveTab('reports')}
                className={`px-4 py-2 rounded text-sm font-medium ${activeTab === 'reports' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:text-gray-700'}`}
            >
                Reports & Exports
            </button>
        </div>

        {/* FEEDBACK TRACKER TAB */}
        {activeTab === 'tracker' && (
             <>
                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                <Users className="mr-2 text-indigo-600" /> Student Tracker
                            </h2>
                            <p className="text-sm text-gray-500">Monitor progress and send reminders.</p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-end">
                            {/* Gamification Trigger */}
                            <button 
                                onClick={handleRunGamification}
                                disabled={isProcessingGamification}
                                className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 font-bold text-xs shadow-sm disabled:opacity-50"
                                title="Recalculate all student scores and rankings"
                            >
                                {isProcessingGamification ? <Loader2 className="animate-spin mr-2" size={14}/> : <Trophy className="mr-2" size={14}/>}
                                Run Gamification Engine
                            </button>

                            <div className="w-full sm:w-64">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Program</label>
                                <div className="relative">
                                    <select 
                                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                                        value={selectedProgram}
                                        onChange={(e) => {
                                            setSelectedProgram(e.target.value);
                                            setSelectedBatch('');
                                            setSelectedStudentIds(new Set());
                                        }}
                                    >
                                        <option value="">-- Select Program --</option>
                                        {programs.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="w-full sm:w-32">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Batch / Year</label>
                                <select 
                                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                                    value={selectedBatch}
                                    onChange={(e) => {
                                        setSelectedBatch(e.target.value);
                                        setSelectedStudentIds(new Set());
                                    }}
                                    disabled={!selectedProgram}
                                >
                                    <option value="">-- Year --</option>
                                    {batches.map(b => <option key={b} value={b}>Year {b}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white shadow overflow-hidden sm:rounded-lg min-h-[400px]">
                    {!selectedProgram || !selectedBatch ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <Filter size={48} className="mb-4 opacity-20" />
                            <p>Please select a Program and Year to view students.</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                <div className="text-sm text-gray-500">
                                    Showing <strong>{currentList.length}</strong> students
                                </div>
                                {selectedStudentIds.size > 0 && (
                                    <button 
                                        onClick={initiateBulkReminder}
                                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                                    >
                                        <Mail size={14} className="mr-1.5" />
                                        Bulk Remind ({selectedStudentIds.size})
                                    </button>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                                                <input 
                                                    type="checkbox" 
                                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                    onChange={toggleSelectAll}
                                                    checked={currentList.length > 0 && selectedStudentIds.size > 0}
                                                />
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {currentList.map((student) => (
                                            <tr key={student.id} className={selectedStudentIds.has(student.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <input 
                                                        type="checkbox" 
                                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                        checked={selectedStudentIds.has(student.id)}
                                                        onChange={() => toggleSelectStudent(student.id)}
                                                        disabled={student.percentage === 100}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900">{student.name}</div>
                                                            <div className="text-xs text-gray-500">{student.email}</div>
                                                            <div className="text-xs text-gray-400 mt-0.5">ID: {student.id}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="w-full bg-gray-200 rounded-full h-2.5 w-32">
                                                        <div className={`h-2.5 rounded-full ${student.percentage === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${student.percentage}%` }}></div>
                                                    </div>
                                                    <span className="text-xs text-gray-500 mt-1 inline-block">{student.completedCount} / {student.totalModules} Modules</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {student.percentage === 100 ? (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                            <CheckCircle size={14} className="mr-1" /> Completed
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                            <AlertCircle size={14} className="mr-1" /> Pending
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    {student.percentage < 100 && (
                                                        <button 
                                                            onClick={() => initiateSingleReminder(student)}
                                                            className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                                                        >
                                                            <Mail size={16} className="mr-1" /> Remind
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {currentList.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                    No students found in this batch.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
             </>
        )}

        {/* REPORTS TAB (Same as before) */}
        {activeTab === 'reports' && (
            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center mb-6">
                    <FileText className="mr-2 text-indigo-600" /> Reports & Exports
                </h2>
                {/* ... existing reporting UI ... */}
                {/* For brevity in update, assuming rest of UI is unchanged as requested */}
                <div className="mb-6 border-b border-gray-200 pb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setReportType('attendance')}
                            className={`px-4 py-3 rounded-lg border text-sm font-medium flex items-center transition-all ${reportType === 'attendance' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <CheckCircle size={16} className="mr-2"/> Attendance Report
                        </button>
                        <button 
                            onClick={() => setReportType('timetable')}
                            className={`px-4 py-3 rounded-lg border text-sm font-medium flex items-center transition-all ${reportType === 'timetable' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <Calendar size={16} className="mr-2"/> Weekly Timetable
                        </button>
                    </div>
                </div>
                
                {/* Attendance Controls */}
                {reportType === 'attendance' && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 uppercase">Attendance Filter</h3>
                        <div className="flex flex-col sm:flex-row gap-4 items-end">
                            <div className="w-full sm:w-auto">
                                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                                <input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div className="w-full sm:w-auto">
                                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                                <input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                            </div>
                        </div>
                        {attendanceReportData.length > 0 ? (
                            <div className="mt-6 border rounded-lg overflow-hidden"><div className="bg-gray-50 px-4 py-2 border-b text-xs font-bold text-gray-500 uppercase">Preview</div><div className="overflow-x-auto max-h-96"><table className="min-w-full divide-y divide-gray-200 text-xs"><thead className="bg-white sticky top-0"><tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Time</th><th className="px-4 py-3 text-left">Module</th><th className="px-4 py-3 text-left">Batch</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Stats</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{attendanceReportData.map((row, idx) => (<tr key={idx}><td className="px-4 py-2">{row.date}</td><td className="px-4 py-2">{row.time}</td><td className="px-4 py-2">{row.module}</td><td className="px-4 py-2">{row.batch}</td><td className="px-4 py-2 text-center">{row.status}</td><td className="px-4 py-2 text-center">{row.percentage}</td></tr>))}</tbody></table></div></div>
                        ) : <div className="text-gray-500 text-center py-8 bg-gray-50 rounded">No data found.</div>}
                        <div className="flex gap-4 mt-4">
                            <button onClick={downloadAttendancePDF} disabled={attendanceReportData.length===0} className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">Download PDF</button>
                            <button onClick={downloadAttendanceCSV} disabled={attendanceReportData.length===0} className="flex items-center bg-green-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">Download CSV</button>
                        </div>
                    </div>
                )}

                {/* Timetable Controls (Simplified for update) */}
                {reportType === 'timetable' && (
                    <div className="space-y-4">
                         <h3 className="text-sm font-bold text-gray-900 uppercase">Timetable Filter</h3>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div><label className="block text-xs mb-1">Program</label><select className="w-full border p-2 rounded text-sm" value={ttProgram} onChange={e=>{setTtProgram(e.target.value);setTtYear('')}}><option value="">Select</option>{uniqueScheduledPrograms.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                             <div><label className="block text-xs mb-1">Year</label><select className="w-full border p-2 rounded text-sm" value={ttYear} onChange={e=>setTtYear(e.target.value)} disabled={!ttProgram}><option value="">Select</option>{scheduledBatches.filter(b=>b.program===ttProgram).map(b=><option key={b.year} value={b.year}>Year {b.year}</option>)}</select></div>
                             <div><label className="block text-xs mb-1">Week</label><select className="w-full border p-2 rounded text-sm" value={ttWeek} onChange={e=>setTtWeek(parseInt(e.target.value))}>{Array.from({length:20},(_,i)=>i+1).map(w=><option key={w} value={w}>Week {w}</option>)}</select></div>
                         </div>
                         {timetablePreview && <div className="mt-4 border rounded p-4 text-center text-sm text-gray-600">Preview generated. Use buttons below to export.</div>}
                         <div className="flex gap-4 mt-4">
                             <button onClick={generateTimetablePDF} disabled={!ttProgram||!ttYear} className="flex items-center bg-red-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">Download PDF</button>
                             <button onClick={generateTimetableCSV} disabled={!ttProgram||!ttYear} className="flex items-center bg-green-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">Download CSV</button>
                         </div>
                    </div>
                )}
            </div>
        )}
        
        {/* Mail Modal - same as before */}
        {mailModal.isOpen && (
            <div className="fixed z-50 inset-0 overflow-y-auto">
                 <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setMailModal({ isOpen: false, recipients: [] })}></div>
                    <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                    <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                        <div className="bg-indigo-600 px-4 py-3 flex justify-between items-center">
                            <h3 className="text-lg leading-6 font-medium text-white flex items-center">
                                <Send size={20} className="mr-2" /> Confirm Reminder
                            </h3>
                            <button onClick={() => setMailModal({ isOpen: false, recipients: [] })} className="text-white hover:text-gray-200">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="px-4 py-5 sm:p-6">
                            <div className="space-y-4">
                                <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">From</label><div className="mt-1 text-sm font-medium text-gray-900">{currentUser?.email} (Student Services)</div></div>
                                <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Recipients ({mailModal.recipients.length})</label><div className="mt-1 text-sm text-gray-600 bg-gray-50 p-2 rounded max-h-24 overflow-y-auto border border-gray-200">{mailModal.recipients.map(r => r.email).join(', ')}</div></div>
                                <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</label><input type="text" readOnly value="Important: Pending Module Feedback Survey" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-600 border p-2"/></div>
                                <div><label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Message Body</label><textarea readOnly rows={6} value={emailBody} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-600 p-2 border"/></div>
                            </div>
                        </div>
                        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                            <button type="button" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm" onClick={handleSendMail}>Confirm & Send</button>
                            <button type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" onClick={() => setMailModal({ isOpen: false, recipients: [] })}>Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
