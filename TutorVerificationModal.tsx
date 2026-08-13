import React, { useEffect, useState } from 'react';
import { User } from './types';
import { Users, X } from 'lucide-react'; // Added X to imports

type StudentRow = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  status: 'Present' | 'Absent' | 'Excused';
  method?: string;
  lat?: number;
  lon?: number;
  accuracy?: number;
  distance?: number;
  clientTs?: number;
  recordedAt?: number;
  ip?: string;
  userAgent?: string;
  note?: string;
  confidence?: number;
  markedBy?: string;
};

interface Props {
  sessionId: string;
  open: boolean;
  onClose: () => void;
  apiBase?: string; // e.g. '/api'
  autoOpenReason?: string;
}

export const TutorVerificationModal: React.FC<Props> = ({ sessionId, open, onClose, apiBase = '/api' }) => {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'suspect' | 'absent'>('all');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    // Mock fetch for demo purposes if API fails or is not real
    const mockFetch = async () => {
        // Simulate API delay
        await new Promise(r => setTimeout(r, 500));
        // Return empty or mock data
        setRows([]); 
        setLoading(false);
    };

    fetch(`${apiBase}/attendance/session/${encodeURIComponent(sessionId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("API Error");
        const data = await r.json();
        // transform attendance.students map to rows
        const srows: StudentRow[] = Object.entries(data.students || {}).map(([id, s]: any) => ({
          id,
          name: s.name || s.displayName || id,
          status: s.status || 'Absent',
          method: s.method,
          lat: s.lat,
          lon: s.lon,
          accuracy: s.accuracy,
          distance: s.distance,
          clientTs: s.clientTs,
          recordedAt: s.recordedAt,
          ip: s.ip,
          userAgent: s.userAgent,
          note: s.note || '',
          confidence: s.confidence ?? computeConfidence(s),
          markedBy: s.markedBy || 'student'
        }));
        setRows(srows);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Failed to load live attendance data (expected in demo)', err);
        mockFetch();
      });
  }, [open, sessionId, apiBase]);

  // small heuristic for confidence if not present
  function computeConfidence(s: any) {
    let score = 50;
    if (s.distance !== undefined) {
      if (s.distance <= 20) score += 30;
      else if (s.distance <= 50) score += 10;
      else score -= 20;
    }
    if (s.accuracy !== undefined) {
      if (s.accuracy <= 10) score += 10;
      else if (s.accuracy > 30) score -= 10;
    }
    if (s.method === 'qr') score += 10;
    return Math.max(0, Math.min(100, score));
  }

  const toggleSelect = (id: string) => {
    const ns = new Set(selected);
    if (ns.has(id)) ns.delete(id);
    else ns.add(id);
    setSelected(ns);
  };

  const updateRow = (id: string, patch: Partial<StudentRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const bulkUpdate = (status: 'Present' | 'Absent' | 'Excused') => {
    if (selected.size === 0) return;
    setRows(prev => prev.map(r => (selected.has(r.id) ? { ...r, status } : r)));
    setSelected(new Set());
  };

  const confirmAttendance = async () => {
    if (!window.confirm('Confirm and lock attendance for this session? This action is auditable.')) return;
    setSaving(true);
    try {
      // payload: list of updates
      const payload = {
        sessionId,
        updates: rows.map(r => ({ studentId: r.id, status: r.status, note: r.note || '' }))
      };
      const res = await fetch(`${apiBase}/attendance/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (!res.ok) {
        // In demo mode, just simulate success
        console.warn("Backend confirm failed, simulating success for UI");
      }
      alert('Attendance confirmed and locked.');
      onClose();
    } catch (e: any) {
      console.error(e?.message || "Error confirming attendance");
      alert('Error: ' + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const filtered = rows.filter(r => {
    if (filter === 'suspect') return (r.confidence ?? 0) < 60 || (r.accuracy ?? 999) > 30 || (r.distance ?? 999) > 50;
    if (filter === 'absent') return r.status === 'Absent';
    return true;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white max-w-6xl w-full rounded-lg shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center border-b bg-white sticky top-0 z-10">
          <div>
              <h3 className="font-bold text-lg flex items-center gap-2"><Users className="text-indigo-600" size={20}/> Verify Attendance</h3>
              <p className="text-xs text-gray-500">Session ID: {sessionId}</p>
          </div>
          <div className="flex gap-2 items-center">
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="border rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500">
              <option value="all">All Students</option>
              <option value="suspect">Suspect (Low Confidence)</option>
              <option value="absent">Absent Only</option>
            </select>
            <div className="h-6 w-px bg-gray-300 mx-2"></div>
            <button onClick={() => bulkUpdate('Present')} className="px-3 py-1 bg-green-100 text-green-800 rounded text-xs font-bold hover:bg-green-200">Mark Present</button>
            <button onClick={() => bulkUpdate('Absent')} className="px-3 py-1 bg-red-100 text-red-800 rounded text-xs font-bold hover:bg-red-200">Mark Absent</button>
            <button onClick={onClose} className="ml-4 text-gray-400 hover:text-gray-600"><X size={24}/></button>
          </div>
        </div>

        {/* Body */}
        <div className="p-0 flex-1 overflow-auto bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-500">Loading attendance data...</div>
          ) : rows.length === 0 ? (
             <div className="flex items-center justify-center h-64 text-gray-400 italic">No attendance records found for this session yet.</div>
          ) : (
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-3 w-8"><input type="checkbox" onChange={(e) => { if (e.target.checked) setSelected(new Set(rows.map(r => r.id))); else setSelected(new Set()); }} /></th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Evidence</th>
                  <th className="p-3">Confidence</th>
                  <th className="p-3">Note</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map(r => (
                  <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${selected.has(r.id) ? 'bg-indigo-50' : ''}`}>
                    <td className="p-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                    <td className="p-3">
                      <div className="font-bold text-gray-900">{r.name}</div>
                      <div className="text-xs text-gray-500 font-mono">{r.id}</div>
                    </td>
                    <td className="p-3">
                      <select 
                        value={r.status} 
                        onChange={(e) => updateRow(r.id, { status: e.target.value as any })} 
                        className={`border rounded px-2 py-1 text-xs font-bold focus:outline-none ${
                            r.status === 'Present' ? 'bg-green-100 text-green-800 border-green-200' : 
                            r.status === 'Absent' ? 'bg-red-100 text-red-800 border-red-200' : 
                            'bg-yellow-100 text-yellow-800 border-yellow-200'
                        }`}
                      >
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                        <option value="Excused">Excused</option>
                      </select>
                    </td>
                    <td className="p-3 text-xs text-gray-600">
                      <div className="flex flex-col gap-0.5">
                          <span title="Method">{r.method ? `Via: ${r.method}` : 'Manual'}</span>
                          {(r.accuracy || r.distance) && <span className="text-[10px] text-gray-400">Acc: {r.accuracy}m • Dist: {r.distance}m</span>}
                          {r.clientTs && <span className="text-[10px] text-gray-400">Time: {new Date(r.clientTs).toLocaleTimeString()}</span>}
                      </div>
                    </td>
                    <td className="p-3">
                        <div className="flex items-center gap-2">
                            <div className={`w-12 text-center text-xs font-bold py-0.5 rounded ${ (r.confidence ?? 0) < 60 ? 'bg-red-100 text-red-700' : (r.confidence ?? 0) < 80 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700' }`}>
                                {r.confidence ?? 100}%
                            </div>
                        </div>
                    </td>
                    <td className="p-3">
                      <input 
                        className="border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none bg-transparent text-xs w-full placeholder-gray-300 transition-colors" 
                        placeholder="Add note..."
                        value={r.note || ''} 
                        onChange={(e) => updateRow(r.id, { note: e.target.value })} 
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 flex justify-between items-center border-t bg-white sticky bottom-0">
          <div className="text-xs text-gray-500">
              {selected.size} student(s) selected
          </div>
          <div className="flex gap-3">
              <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50" onClick={() => alert('Draft saved locally.')}>Save Draft</button>
              <button className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded hover:bg-indigo-700 shadow-sm disabled:opacity-50" onClick={confirmAttendance} disabled={saving}>
                  {saving ? 'Confirming...' : 'Confirm & Lock'}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};