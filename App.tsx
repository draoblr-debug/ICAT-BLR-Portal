
import React, { useState } from 'react';
import { AppProvider, useApp } from './AppContext';
import { Login } from './Login';
import { StudentDashboard } from './StudentDashboard';
import { HodDashboard } from './HodDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { ServiceView } from './ServiceView';
import { TutorDashboard } from './TutorDashboard';
import { SystemAdminDashboard } from './SystemAdminDashboard';
import { UserProfile } from './UserProfile';
import { LiveClassSession } from './LiveClassSession';
import { Role } from './types';
import { LogOut, Calendar, Menu, User as UserIcon } from 'lucide-react';

const DashboardLayout = ({ children }: { children?: React.ReactNode }) => {
  const { currentUser, logout, currentSemesterType, activeRole, setActiveRole } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      <UserProfile isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      
      <nav className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center gap-4">
                <img 
                    src="https://lh3.googleusercontent.com/d/1sgI_sE07Tnlg-1wdXb2r8q88PWxUYmi9" 
                    alt="ICAT College" 
                    className="h-16 w-auto" 
                />
                <div className="hidden md:block h-10 w-px bg-gray-300"></div>
                <span className="text-xl font-bold text-gray-700 tracking-tight hidden md:block">BLR PORTAL</span>
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
              {/* Role Selector for Multi-Role Users */}
              {currentUser && (currentUser.role === Role.HOD || currentUser.role === Role.EducationManager) && (
                  <div className="flex items-center">
                      <span className="text-xs text-gray-500 mr-2 uppercase tracking-wide font-bold">View As</span>
                      <select
                          value={activeRole || currentUser.role}
                          onChange={(e) => setActiveRole(e.target.value as Role)}
                          className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm rounded-full focus:ring-indigo-500 focus:border-indigo-500 block px-3 py-1 font-medium cursor-pointer focus:outline-none"
                      >
                          <option value={currentUser.role}>{currentUser.role === Role.HOD ? 'HOD' : 'Manager'}</option>
                          {currentUser.role === Role.EducationManager && <option value={Role.HOD}>HOD</option>}
                          <option value={Role.Tutor}>Tutor</option>
                      </select>
                  </div>
              )}

              <div className="flex items-center text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
                 <Calendar size={14} className="mr-2" />
                 <span>Current: <strong>{currentSemesterType} Sem</strong></span>
              </div>
              <button 
                onClick={() => setProfileOpen(true)}
                className="flex items-center gap-2 px-3 py-1 hover:bg-gray-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                 <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 overflow-hidden border border-indigo-200">
                    {currentUser?.profilePicture ? (
                        <img src={currentUser.profilePicture} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                        <UserIcon size={16} />
                    )}
                 </div>
                 <div className="text-sm text-left">
                    <p className="font-medium text-gray-700">{currentUser?.name}</p>
                    <p className="text-xs text-gray-500">{currentUser?.role}</p>
                 </div>
              </button>
              <button
                onClick={logout}
                className="p-2 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                title="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </div>
            <div className="-mr-2 flex items-center sm:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
            <div className="sm:hidden bg-white border-b border-gray-200">
                <div className="pt-2 pb-3 space-y-1 px-4">
                    <div className="flex items-center gap-3 mb-4" onClick={() => setProfileOpen(true)}>
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 overflow-hidden border border-indigo-200">
                            {currentUser?.profilePicture ? (
                                <img src={currentUser.profilePicture} alt="Profile" className="h-full w-full object-cover" />
                            ) : (
                                <UserIcon size={20} />
                            )}
                        </div>
                        <div>
                            <div className="text-base font-medium text-gray-800">{currentUser?.name}</div>
                            <div className="text-sm font-medium text-gray-500">{currentUser?.role}</div>
                        </div>
                    </div>
                    {/* Mobile Role Selector */}
                    {currentUser && (currentUser.role === Role.HOD || currentUser.role === Role.EducationManager) && (
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-gray-500 mb-1">SWITCH VIEW</label>
                            <select
                                value={activeRole || currentUser.role}
                                onChange={(e) => setActiveRole(e.target.value as Role)}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            >
                                <option value={currentUser.role}>{currentUser.role === Role.HOD ? 'HOD' : 'Manager'}</option>
                                {currentUser.role === Role.EducationManager && <option value={Role.HOD}>HOD</option>}
                                <option value={Role.Tutor}>Tutor</option>
                            </select>
                        </div>
                    )}
                    
                    <button onClick={() => setProfileOpen(true)} className="block w-full text-left py-2 text-sm text-indigo-600">
                        Edit Profile
                    </button>
                    <div className="py-2 text-sm text-gray-500 flex items-center">
                        <Calendar size={14} className="mr-2"/> Current: {currentSemesterType} Sem
                    </div>
                    <button onClick={logout} className="block w-full text-left py-2 text-sm text-red-600 font-medium">
                        Sign Out
                    </button>
                </div>
            </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-4 sm:px-0">
          {children}
        </div>
      </main>
    </div>
  );
};

const MainContent = () => {
    const { currentUser, activeRole } = useApp();

    // Check for Live Session URL Params
    const urlParams = new URLSearchParams(window.location.search);
    const isLive = urlParams.get('live') === 'true';

    if (isLive) {
        return <LiveClassSession />;
    }

    if (!currentUser) {
        return <Login />;
    }

    // Use activeRole for view switching, fallback to currentUser.role if null
    const roleToRender = activeRole || currentUser.role;

    let Content: React.ReactNode = null;
    switch (roleToRender) {
        case Role.Student:
            Content = <StudentDashboard />;
            break;
        case Role.HOD:
            Content = <HodDashboard />;
            break;
        case Role.EducationManager:
            Content = <ManagerDashboard />;
            break;
        case Role.StudentService:
            Content = <ServiceView />;
            break;
        case Role.Tutor:
            Content = <TutorDashboard />;
            break;
        case Role.SystemAdministrator:
            Content = <SystemAdminDashboard />;
            break;
        default:
            Content = <div className="text-center py-20 text-gray-500">Dashboard for {roleToRender} is under construction.</div>;
    }

    return <DashboardLayout>{Content}</DashboardLayout>;
}

const App = () => {
  return (
    <AppProvider>
        <MainContent />
    </AppProvider>
  );
};

export default App;
