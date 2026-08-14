
import React, { useState, useMemo } from 'react';
import { useApp } from './AppContext';
import { Room } from './types';
import { Building, Plus, Trash2, Edit, X, Users, LayoutGrid, Check, MapPin } from 'lucide-react';

// Fixed Departments based on HODs
const DEPARTMENTS = [
    { id: 'Animation', name: 'Animation', color: 'bg-pink-100 text-pink-800 border-pink-300' },
    { id: 'Game Design', name: 'Game Design', color: 'bg-orange-100 text-orange-800 border-orange-300' },
    { id: 'Graphic Design', name: 'Graphic Design', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    { id: 'Interior Design', name: 'Interior Design', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    { id: 'Multimedia', name: 'Multimedia', color: 'bg-amber-100 text-amber-800 border-amber-300' },
    { id: 'Photography', name: 'Photography', color: 'bg-stone-100 text-stone-800 border-stone-300' },
    { id: 'UI/UX', name: 'UI/UX', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    { id: 'Visual Effects', name: 'Visual Effects', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
];

export const SystemAdminDashboard = () => {
    const { rooms, addRoom, updateRoom, deleteRoom } = useApp();
    const [activeTab, setActiveTab] = useState<'rooms' | 'allocations'>('rooms');
    
    // Room State
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Partial<Room>>({});
    
    // Allocation State
    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

    // Stats
    const stats = useMemo(() => {
        const totalRooms = rooms.length;
        const totalCapacity = rooms.reduce((acc, r) => acc + r.capacity, 0);
        return { totalRooms, totalCapacity, totalDepartments: DEPARTMENTS.length };
    }, [rooms]);

    // Group Rooms by Floor
    const floorMap = useMemo(() => {
        const floors: Record<number, Room[]> = {};
        rooms.forEach(r => {
            const f = r.floor || 0;
            if (!floors[f]) floors[f] = [];
            floors[f].push(r);
        });
        // Sort floors
        return Object.entries(floors)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([f, rList]) => ({ floor: parseInt(f), rooms: rList.sort((a,b) => a.number.localeCompare(b.number)) }));
    }, [rooms]);

    // Helper: Get styles for a department
    const getDepartmentStyle = (deptName?: string) => {
        if (!deptName) return { bg: 'bg-white', border: 'border-gray-200', text: 'text-gray-500', header: 'bg-gray-100 text-gray-500' };
        
        const dept = DEPARTMENTS.find(d => d.name === deptName);
        if (dept) {
            // Parse tailwind classes for reuse in different contexts if needed, 
            // but for now we apply the combined string to the card container/text
            return {
                container: `${dept.color} border-2`,
                text: 'text-gray-900',
                badge: dept.color
            };
        }

        // Fallback for unknown departments (e.g. from old data)
        return {
            container: 'bg-gray-50 border-gray-300 border-2',
            text: 'text-gray-600',
            badge: 'bg-gray-200 text-gray-700'
        };
    };

    // Handlers
    const handleSaveRoom = () => {
        if (!editingRoom.number || !editingRoom.capacity) return;
        
        const room: Room = {
            id: editingRoom.id || `room-${Date.now()}`,
            number: editingRoom.number,
            name: editingRoom.name || `Room ${editingRoom.number}`,
            capacity: Number(editingRoom.capacity),
            floor: Number(editingRoom.floor || 0),
            allocatedDepartment: editingRoom.allocatedDepartment
        };

        if (editingRoom.id) {
            updateRoom(room);
        } else {
            addRoom(room);
        }
        setIsRoomModalOpen(false);
        setEditingRoom({});
    };

    const handleDeleteRoom = (id: string) => {
        if(window.confirm("Are you sure you want to delete this room?")) {
            deleteRoom(id);
        }
    };

    const handleRoomClick = (room: Room) => {
        if (!selectedDepartment) return;

        let newAllocatedDept: string | undefined = selectedDepartment;
        
        // Common Area clears the allocation
        if (selectedDepartment === 'COMMON') {
            newAllocatedDept = undefined;
        }

        updateRoom({
            ...room,
            allocatedDepartment: newAllocatedDept
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center">
                            <Building className="mr-2 text-indigo-600" /> Facility & Allocation
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Manage physical rooms and assign them to Departments (HODs).</p>
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('rooms')} 
                            className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'rooms' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Facility Management
                        </button>
                        <button 
                            onClick={() => setActiveTab('allocations')} 
                            className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'allocations' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Department Allocation
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
                    <div className="flex items-center">
                        <div className="p-3 rounded-full bg-indigo-100 text-indigo-600 mr-4">
                            <Building size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Rooms</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalRooms}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
                    <div className="flex items-center">
                        <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Capacity</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalCapacity}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
                    <div className="flex items-center">
                        <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
                            <LayoutGrid size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Departments</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalDepartments}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ROOM MANAGEMENT TAB */}
            {activeTab === 'rooms' && (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                        <h3 className="text-lg font-medium text-gray-900">Room Master List</h3>
                        <button 
                            onClick={() => { setEditingRoom({}); setIsRoomModalOpen(true); }}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center"
                        >
                            <Plus size={16} className="mr-2" /> Add Room
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room Number</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Floor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Dept</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {rooms.map(room => (
                                    <tr key={room.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{room.number}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{room.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{room.floor}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                {room.capacity} Seats
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {room.allocatedDepartment ? (
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${getDepartmentStyle(room.allocatedDepartment).badge}`}>
                                                    {room.allocatedDepartment}
                                                </span>
                                            ) : (
                                                <span className="italic text-gray-400">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button 
                                                onClick={() => { setEditingRoom(room); setIsRoomModalOpen(true); }}
                                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteRoom(room.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {rooms.length === 0 && (
                                    <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No rooms available. Add one to get started.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* GRAPHICAL ALLOCATION TAB */}
            {activeTab === 'allocations' && (
                <div className="space-y-6">
                    {/* 1. Department Chips */}
                    <div className="bg-white shadow rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">
                            Select Department to Allocate
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            <button
                                onClick={() => setSelectedDepartment('COMMON')}
                                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                                    selectedDepartment === 'COMMON' 
                                    ? 'bg-gray-800 text-white border-gray-800 shadow-md ring-2 ring-gray-300' 
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                Common Area / Unassign
                            </button>
                            {DEPARTMENTS.map(dept => {
                                const isSelected = selectedDepartment === dept.name;
                                
                                return (
                                    <button
                                        key={dept.id}
                                        onClick={() => setSelectedDepartment(dept.name)}
                                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all border flex items-center gap-2 ${
                                            isSelected
                                            ? `shadow-md ring-2 ring-indigo-300 ${dept.color}`
                                            : `bg-white hover:bg-gray-50 border-gray-300 text-gray-700`
                                        }`}
                                    >
                                        {dept.name}
                                        {isSelected && <Check size={14} />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. Floor Plan Grid */}
                    <div className="space-y-6">
                        {floorMap.map(({ floor, rooms: floorRooms }) => (
                            <div key={floor} className="bg-white shadow rounded-lg overflow-hidden">
                                <div className="bg-gray-100 px-6 py-3 border-b border-gray-200 font-bold text-gray-700 flex items-center">
                                    <MapPin size={18} className="mr-2 text-gray-500"/> 
                                    {floor === 0 ? 'Ground Floor' : `Floor ${floor}`}
                                </div>
                                <div className="p-6">
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        {floorRooms.map(room => {
                                            const isAssigned = !!room.allocatedDepartment;
                                            const deptStyle = getDepartmentStyle(room.allocatedDepartment);
                                            
                                            const isSelectedMatch = selectedDepartment && (
                                                (selectedDepartment === 'COMMON' && !isAssigned) ||
                                                (selectedDepartment === room.allocatedDepartment)
                                            );

                                            return (
                                                <div 
                                                    key={room.id} 
                                                    onClick={() => handleRoomClick(room)}
                                                    className={`rounded-lg hover:shadow-md transition-all cursor-pointer relative overflow-hidden group ${deptStyle.container} ${!isAssigned && 'bg-white'} ${isSelectedMatch ? 'ring-2 ring-offset-2 ring-indigo-400' : ''}`}
                                                >
                                                    <div className={`text-xs font-bold uppercase tracking-wider p-2 flex justify-between items-center border-b ${isAssigned ? 'border-black/5' : 'bg-gray-100 text-gray-500'}`}>
                                                        <span>{room.number}</span>
                                                        <span className="text-[10px] opacity-75">{room.capacity} Seats</span>
                                                    </div>
                                                    <div className="p-3">
                                                        <div className="text-sm font-medium text-gray-900 truncate" title={room.name}>{room.name}</div>
                                                        <div className={`text-xs mt-1 truncate font-semibold ${isAssigned ? 'opacity-90' : 'text-gray-400 italic'}`}>
                                                            {room.allocatedDepartment || "Common Area"}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Hover Overlay for Action */}
                                                    {selectedDepartment && (
                                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 flex items-center justify-center transition-all">
                                                            <div className="opacity-0 group-hover:opacity-100 bg-white shadow-sm px-2 py-1 rounded text-xs font-bold transform scale-90 group-hover:scale-100 transition-transform text-gray-800">
                                                                {selectedDepartment === 'COMMON' ? 'Clear' : 'Assign'}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Add/Edit Room Modal */}
            {isRoomModalOpen && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsRoomModalOpen(false)}></div>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <div className="bg-indigo-600 px-4 py-3 sm:px-6 flex justify-between items-center">
                                <h3 className="text-lg leading-6 font-medium text-white flex items-center">
                                    <Building size={20} className="mr-2"/> {editingRoom.id ? 'Edit Room' : 'Add New Room'}
                                </h3>
                                <button onClick={() => setIsRoomModalOpen(false)} className="text-white hover:text-gray-200">
                                    <X size={20}/>
                                </button>
                            </div>
                            <div className="px-4 py-5 sm:p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Room Number</label>
                                    <input 
                                        type="text" 
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2"
                                        value={editingRoom.number || ''}
                                        onChange={e => setEditingRoom({...editingRoom, number: e.target.value})}
                                        placeholder="e.g. 201"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Room Name (Optional)</label>
                                    <input 
                                        type="text" 
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2"
                                        value={editingRoom.name || ''}
                                        onChange={e => setEditingRoom({...editingRoom, name: e.target.value})}
                                        placeholder="e.g. Computer Lab 1"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Floor</label>
                                        <input 
                                            type="number" 
                                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2"
                                            value={editingRoom.floor || ''}
                                            onChange={e => setEditingRoom({...editingRoom, floor: parseInt(e.target.value)})}
                                            placeholder="e.g. 2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Capacity</label>
                                        <input 
                                            type="number" 
                                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2"
                                            value={editingRoom.capacity || ''}
                                            onChange={e => setEditingRoom({...editingRoom, capacity: parseInt(e.target.value)})}
                                            placeholder="e.g. 30"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Assigned Department (Optional)</label>
                                    <select 
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2"
                                        value={editingRoom.allocatedDepartment || ''}
                                        onChange={e => setEditingRoom({...editingRoom, allocatedDepartment: e.target.value || undefined})}
                                    >
                                        <option value="">-- Common Area / Unassigned --</option>
                                        {DEPARTMENTS.map(d => (
                                            <option key={d.id} value={d.name}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button 
                                    onClick={handleSaveRoom}
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Save Room
                                </button>
                                <button 
                                    onClick={() => setIsRoomModalOpen(false)}
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
