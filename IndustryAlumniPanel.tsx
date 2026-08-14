import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from './AppContext';
import { Module, IndustryEngagement, IndustryPipelineStage, AlumniRecord } from './types';
import { INDUSTRY_ENGAGEMENT_TYPES, INDUSTRY_PIPELINE_STAGES, INDUSTRY_ENGAGEMENT_COUNTED_STAGES } from './data';
import { calculateIndustryEngagementCoverage, ModuleIndustryEngagementCoverage } from './kpiService';
import {
    Building2, Plus, X, Save, CheckCircle, Users, Search, Star,
    Briefcase, GraduationCap, Loader2
} from 'lucide-react';

interface IndustryAlumniPanelProps {
    scopedModules: Module[];
    title?: string;
}

const stageColor = (stage: IndustryPipelineStage) => {
    const idx = INDUSTRY_PIPELINE_STAGES.indexOf(stage);
    if (INDUSTRY_ENGAGEMENT_COUNTED_STAGES.includes(stage)) return 'bg-green-100 text-green-700';
    if (idx >= 2) return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
};

const WillingnessBadge: React.FC<{ active: boolean; label: string; icon: React.ReactNode }> = ({ active, label, icon }) => (
    <span title={label} className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-300'}`}>
        {icon} {label}
    </span>
);

export const IndustryAlumniPanel: React.FC<IndustryAlumniPanelProps> = ({ scopedModules, title = 'Industry & Alumni Engagement' }) => {
    const {
        currentUser, currentSemesterType,
        industryEngagements, addIndustryEngagement, updateIndustryEngagement,
        alumniRecords, addAlumniRecord, updateAlumniRecord,
    } = useApp();

    const [activeTab, setActiveTab] = useState<'industry' | 'alumni'>('industry');
    const scopedModuleCodes = useMemo(() => new Set(scopedModules.map(m => m.code)), [scopedModules]);

    // Industry engagement
    const [coverage, setCoverage] = useState<{ byModule: ModuleIndustryEngagementCoverage[]; overall: Awaited<ReturnType<typeof calculateIndustryEngagementCoverage>>['overall'] } | null>(null);
    const [isEngagementModalOpen, setIsEngagementModalOpen] = useState(false);
    const [engagementDraft, setEngagementDraft] = useState<Partial<IndustryEngagement>>({});

    useEffect(() => {
        calculateIndustryEngagementCoverage(
            industryEngagements.filter(e => scopedModuleCodes.has(e.moduleCode)),
            scopedModules,
            currentSemesterType
        ).then(setCoverage);
    }, [industryEngagements, scopedModules, scopedModuleCodes, currentSemesterType]);

    const scopedEngagements = industryEngagements.filter(e => scopedModuleCodes.has(e.moduleCode)).sort((a, b) => b.updatedAt - a.updatedAt);

    const openNewEngagement = () => {
        setEngagementDraft({
            id: `ie-${Date.now()}`,
            moduleCode: scopedModules[0]?.code || '',
            type: 'Guest Lecture',
            expertName: '',
            expertOrganization: '',
            stage: 'Identify',
            outcomeDocumented: false,
        });
        setIsEngagementModalOpen(true);
    };

    const saveEngagement = () => {
        if (!currentUser || !engagementDraft.moduleCode || !engagementDraft.expertName) {
            alert('Module and expert name are required.');
            return;
        }
        const now = Date.now();
        const final: IndustryEngagement = {
            id: engagementDraft.id!,
            moduleCode: engagementDraft.moduleCode,
            type: engagementDraft.type || 'Guest Lecture',
            expertName: engagementDraft.expertName,
            expertOrganization: engagementDraft.expertOrganization || '',
            stage: engagementDraft.stage || 'Identify',
            scheduledDate: engagementDraft.scheduledDate,
            studentsExposedCount: engagementDraft.studentsExposedCount,
            outcomeDocumented: !!engagementDraft.outcomeDocumented,
            outcomeNotes: engagementDraft.outcomeNotes,
            relationshipNotes: engagementDraft.relationshipNotes,
            createdAt: engagementDraft.createdAt || now,
            createdBy: engagementDraft.createdBy || currentUser.id,
            updatedAt: now,
        };
        const exists = industryEngagements.some(e => e.id === final.id);
        if (exists) updateIndustryEngagement(final); else addIndustryEngagement(final);
        setIsEngagementModalOpen(false);
    };

    // Alumni
    const [isAlumniModalOpen, setIsAlumniModalOpen] = useState(false);
    const [alumniDraft, setAlumniDraft] = useState<Partial<AlumniRecord>>({});
    const [alumniSearch, setAlumniSearch] = useState('');

    const filteredAlumni = alumniRecords.filter(a => {
        const q = alumniSearch.toLowerCase();
        return !q || a.name.toLowerCase().includes(q) || a.currentCompany.toLowerCase().includes(q) || a.discipline.toLowerCase().includes(q);
    }).sort((a, b) => b.graduationYear - a.graduationYear);

    const openNewAlumnus = () => {
        setAlumniDraft({
            id: `alum-${Date.now()}`,
            name: '', graduationYear: new Date().getFullYear(), discipline: '', currentCompany: '', currentRole: '', location: '', areaOfExpertise: '',
            willingToMentor: false, willingToSpeak: false, willingForInternships: false, willingForPortfolioReviews: false, willingForLiveProjects: false,
            contactStatus: 'Not Contacted',
        });
        setIsAlumniModalOpen(true);
    };

    const saveAlumnus = () => {
        if (!alumniDraft.name || !alumniDraft.discipline) { alert('Name and discipline are required.'); return; }
        const now = Date.now();
        const final: AlumniRecord = {
            id: alumniDraft.id!,
            name: alumniDraft.name,
            graduationYear: alumniDraft.graduationYear || new Date().getFullYear(),
            discipline: alumniDraft.discipline,
            currentCompany: alumniDraft.currentCompany || '',
            currentRole: alumniDraft.currentRole || '',
            location: alumniDraft.location || '',
            areaOfExpertise: alumniDraft.areaOfExpertise || '',
            willingToMentor: !!alumniDraft.willingToMentor,
            willingToSpeak: !!alumniDraft.willingToSpeak,
            willingForInternships: !!alumniDraft.willingForInternships,
            willingForPortfolioReviews: !!alumniDraft.willingForPortfolioReviews,
            willingForLiveProjects: !!alumniDraft.willingForLiveProjects,
            contactStatus: alumniDraft.contactStatus || 'Not Contacted',
            createdAt: alumniDraft.createdAt || now,
            updatedAt: now,
        };
        const exists = alumniRecords.some(a => a.id === final.id);
        if (exists) updateAlumniRecord(final); else addAlumniRecord(final);
        setIsAlumniModalOpen(false);
    };

    if (!currentUser) return null;

    return (
        <div className="space-y-4">
            <div className="bg-white shadow rounded-lg p-6 flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Building2 size={18} className="text-indigo-600" /> {title}</h3>
                    <p className="text-sm text-gray-500 mt-1">Target: ≥2 meaningful industry engagements per active module per semester.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
                    <button onClick={() => setActiveTab('industry')} className={`px-3 py-1.5 text-sm font-medium rounded-md ${activeTab === 'industry' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Industry</button>
                    <button onClick={() => setActiveTab('alumni')} className={`px-3 py-1.5 text-sm font-medium rounded-md ${activeTab === 'alumni' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Alumni</button>
                </div>
            </div>

            {activeTab === 'industry' && (
                <div className="space-y-4">
                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase">Coverage This Semester</h4>
                            {coverage ? (
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${coverage.overall.status === 'On Track' ? 'bg-green-100 text-green-700' : coverage.overall.status === 'At Risk' ? 'bg-yellow-100 text-yellow-700' : coverage.overall.status === 'No Data' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700'}`}>
                                    {coverage.overall.actual}% of modules meeting target ({coverage.overall.status})
                                </span>
                            ) : <Loader2 className="animate-spin text-gray-400" size={16} />}
                        </div>
                        {coverage && coverage.byModule.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {coverage.byModule.map(m => (
                                    <div key={m.moduleCode} className={`flex items-center justify-between px-3 py-2 rounded border text-sm ${m.metTarget ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                        <span className="text-gray-800">{m.moduleTitle}</span>
                                        <span className={`font-bold ${m.metTarget ? 'text-green-700' : 'text-gray-500'}`}>{m.countedEngagements}/{m.target}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h4 className="text-sm font-bold text-gray-900 uppercase">Engagements ({scopedEngagements.length})</h4>
                            <button onClick={openNewEngagement} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2"><Plus size={14} /> New Engagement</button>
                        </div>
                        {scopedEngagements.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">No engagements logged yet.</div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {scopedEngagements.map(e => {
                                    const module = scopedModules.find(m => m.code === e.moduleCode);
                                    return (
                                        <li key={e.id} className="px-6 py-3 flex items-center justify-between flex-wrap gap-2 hover:bg-gray-50">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{e.expertName} — {e.expertOrganization}</div>
                                                <div className="text-xs text-gray-500">{e.type} • {module?.title || e.moduleCode}{e.scheduledDate ? ` • ${e.scheduledDate}` : ''}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {e.outcomeDocumented && <CheckCircle size={14} className="text-green-500" title="Outcome documented" />}
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${stageColor(e.stage)}`}>{e.stage}</span>
                                                <button onClick={() => { setEngagementDraft(e); setIsEngagementModalOpen(true); }} className="text-xs font-bold text-indigo-600 hover:underline">Edit</button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'alumni' && (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="p-6 border-b flex justify-between items-center flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                            <Search size={16} className="text-gray-400" />
                            <input className="border rounded p-2 text-sm" placeholder="Search name, company, discipline..." value={alumniSearch} onChange={e => setAlumniSearch(e.target.value)} />
                        </div>
                        <button onClick={openNewAlumnus} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2"><Plus size={14} /> Add Alumnus</button>
                    </div>
                    {filteredAlumni.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">No alumni records yet.</div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {filteredAlumni.map(a => (
                                <li key={a.id} className="px-6 py-3 flex items-center justify-between flex-wrap gap-2 hover:bg-gray-50">
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">{a.name} <span className="text-xs text-gray-400 font-normal">'{String(a.graduationYear).slice(-2)}</span></div>
                                        <div className="text-xs text-gray-500">{a.currentRole} at {a.currentCompany} • {a.discipline} • {a.location}</div>
                                        <div className="flex gap-1 mt-1 flex-wrap">
                                            <WillingnessBadge active={a.willingToMentor} label="Mentor" icon={<GraduationCap size={10} />} />
                                            <WillingnessBadge active={a.willingToSpeak} label="Speak" icon={<Users size={10} />} />
                                            <WillingnessBadge active={a.willingForInternships} label="Internships" icon={<Briefcase size={10} />} />
                                            <WillingnessBadge active={a.willingForPortfolioReviews} label="Portfolio" icon={<Star size={10} />} />
                                            <WillingnessBadge active={a.willingForLiveProjects} label="Live Projects" icon={<CheckCircle size={10} />} />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600">{a.contactStatus}</span>
                                        <button onClick={() => { setAlumniDraft(a); setIsAlumniModalOpen(true); }} className="text-xs font-bold text-indigo-600 hover:underline">Edit</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Industry Engagement modal */}
            {isEngagementModalOpen && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsEngagementModalOpen(false)}></div>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full">
                            <div className="bg-white px-6 pt-5 pb-4 border-b flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-900">{engagementDraft.createdAt ? 'Edit Engagement' : 'New Engagement'}</h3>
                                <button onClick={() => setIsEngagementModalOpen(false)} className="text-gray-500 hover:text-gray-700"><X size={22} /></button>
                            </div>
                            <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Module</label>
                                        <select className="w-full border rounded p-2 text-sm" value={engagementDraft.moduleCode || ''} onChange={e => setEngagementDraft({ ...engagementDraft, moduleCode: e.target.value })}>
                                            {scopedModules.map(m => <option key={m.code} value={m.code}>{m.title}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                                        <select className="w-full border rounded p-2 text-sm" value={engagementDraft.type || ''} onChange={e => setEngagementDraft({ ...engagementDraft, type: e.target.value as any })}>
                                            {INDUSTRY_ENGAGEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Expert Name</label>
                                        <input className="w-full border rounded p-2 text-sm" value={engagementDraft.expertName || ''} onChange={e => setEngagementDraft({ ...engagementDraft, expertName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Organization</label>
                                        <input className="w-full border rounded p-2 text-sm" value={engagementDraft.expertOrganization || ''} onChange={e => setEngagementDraft({ ...engagementDraft, expertOrganization: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pipeline Stage</label>
                                        <select className="w-full border rounded p-2 text-sm" value={engagementDraft.stage || ''} onChange={e => setEngagementDraft({ ...engagementDraft, stage: e.target.value as any })}>
                                            {INDUSTRY_PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Scheduled Date</label>
                                        <input type="date" className="w-full border rounded p-2 text-sm" value={engagementDraft.scheduledDate || ''} onChange={e => setEngagementDraft({ ...engagementDraft, scheduledDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Students Exposed</label>
                                        <input type="number" min={0} className="w-full border rounded p-2 text-sm" value={engagementDraft.studentsExposedCount ?? ''} onChange={e => setEngagementDraft({ ...engagementDraft, studentsExposedCount: e.target.value === '' ? undefined : parseInt(e.target.value) })} />
                                    </div>
                                    <div className="flex items-end">
                                        <label className="flex items-center gap-2 text-sm text-gray-700">
                                            <input type="checkbox" checked={!!engagementDraft.outcomeDocumented} onChange={e => setEngagementDraft({ ...engagementDraft, outcomeDocumented: e.target.checked })} className="rounded text-indigo-600" />
                                            Outcome documented
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Outcome Notes</label>
                                    <textarea className="w-full border rounded p-2 text-sm h-16" value={engagementDraft.outcomeNotes || ''} onChange={e => setEngagementDraft({ ...engagementDraft, outcomeNotes: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Relationship Notes</label>
                                    <textarea className="w-full border rounded p-2 text-sm h-16" value={engagementDraft.relationshipNotes || ''} onChange={e => setEngagementDraft({ ...engagementDraft, relationshipNotes: e.target.value })} />
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                                <button onClick={() => setIsEngagementModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm">Close</button>
                                <button onClick={saveEngagement} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold flex items-center gap-2"><Save size={14} /> Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Alumni modal */}
            {isAlumniModalOpen && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsAlumniModalOpen(false)}></div>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full">
                            <div className="bg-white px-6 pt-5 pb-4 border-b flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-900">{alumniDraft.createdAt ? 'Edit Alumnus' : 'Add Alumnus'}</h3>
                                <button onClick={() => setIsAlumniModalOpen(false)} className="text-gray-500 hover:text-gray-700"><X size={22} /></button>
                            </div>
                            <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                                        <input className="w-full border rounded p-2 text-sm" value={alumniDraft.name || ''} onChange={e => setAlumniDraft({ ...alumniDraft, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Graduation Year</label>
                                        <input type="number" className="w-full border rounded p-2 text-sm" value={alumniDraft.graduationYear || ''} onChange={e => setAlumniDraft({ ...alumniDraft, graduationYear: parseInt(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Discipline</label>
                                        <input className="w-full border rounded p-2 text-sm" value={alumniDraft.discipline || ''} onChange={e => setAlumniDraft({ ...alumniDraft, discipline: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Area of Expertise</label>
                                        <input className="w-full border rounded p-2 text-sm" value={alumniDraft.areaOfExpertise || ''} onChange={e => setAlumniDraft({ ...alumniDraft, areaOfExpertise: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Company / Studio</label>
                                        <input className="w-full border rounded p-2 text-sm" value={alumniDraft.currentCompany || ''} onChange={e => setAlumniDraft({ ...alumniDraft, currentCompany: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Role</label>
                                        <input className="w-full border rounded p-2 text-sm" value={alumniDraft.currentRole || ''} onChange={e => setAlumniDraft({ ...alumniDraft, currentRole: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
                                        <input className="w-full border rounded p-2 text-sm" value={alumniDraft.location || ''} onChange={e => setAlumniDraft({ ...alumniDraft, location: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contact Status</label>
                                        <select className="w-full border rounded p-2 text-sm" value={alumniDraft.contactStatus || 'Not Contacted'} onChange={e => setAlumniDraft({ ...alumniDraft, contactStatus: e.target.value as any })}>
                                            {(['Not Contacted', 'Contacted', 'Engaged', 'Unresponsive'] as const).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Willing To</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {([
                                            ['willingToMentor', 'Mentor students'],
                                            ['willingToSpeak', 'Speak at sessions'],
                                            ['willingForInternships', 'Offer internships'],
                                            ['willingForPortfolioReviews', 'Portfolio reviews'],
                                            ['willingForLiveProjects', 'Live projects'],
                                        ] as [keyof AlumniRecord, string][]).map(([key, label]) => (
                                            <label key={key} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border rounded px-2 py-1.5 cursor-pointer">
                                                <input type="checkbox" checked={!!alumniDraft[key]} onChange={e => setAlumniDraft({ ...alumniDraft, [key]: e.target.checked })} className="rounded text-indigo-600" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                                <button onClick={() => setIsAlumniModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm">Close</button>
                                <button onClick={saveAlumnus} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold flex items-center gap-2"><Save size={14} /> Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
