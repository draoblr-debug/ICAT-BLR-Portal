
import React, { useState, useRef } from 'react';
import { useApp } from './AppContext';
import { Camera, Save, X, Lock, User as UserIcon, Upload, Loader2 } from 'lucide-react';

interface UserProfileProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UserProfile = ({ isOpen, onClose }: UserProfileProps) => {
    const { currentUser, updateUserProfile } = useApp();
    const [activeTab, setActiveTab] = useState<'info' | 'security'>('info');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isProcessingImg, setIsProcessingImg] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen || !currentUser) return null;

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const validCurrent = currentUser.password || currentUser.id;
        if (currentPassword !== validCurrent) {
            setError('Incorrect current password.');
            return;
        }

        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        await updateUserProfile(currentUser.id, { password: newPassword });
        setSuccess('Password updated successfully.');
        setNewPassword('');
        setConfirmPassword('');
        setCurrentPassword('');
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError('');
        setSuccess('');
        setIsProcessingImg(true);

        // Smart Client-Side Resizing
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 300;

                // Calculate new dimensions
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    // Compress to JPEG 0.8 quality
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    
                    updateUserProfile(currentUser.id, { profilePicture: dataUrl });
                    setSuccess('Profile picture updated successfully.');
                } else {
                    setError('Failed to process image.');
                }
                setIsProcessingImg(false);
            };
            img.onerror = () => {
                setError('Invalid image file.');
                setIsProcessingImg(false);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="fixed z-50 inset-0 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    
                    {/* Header */}
                    <div className="bg-indigo-600 px-4 py-3 sm:px-6 flex justify-between items-center">
                        <h3 className="text-lg leading-6 font-medium text-white flex items-center gap-2">
                            <UserIcon size={20}/> My Profile
                        </h3>
                        <button onClick={onClose} className="text-indigo-200 hover:text-white focus:outline-none">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="px-4 py-5 sm:p-6">
                        
                        {/* Profile Picture Section */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-gray-100 flex items-center justify-center">
                                    {isProcessingImg ? (
                                        <Loader2 className="animate-spin text-indigo-500" size={32} />
                                    ) : currentUser.profilePicture ? (
                                        <img src={currentUser.profilePicture} alt="Profile" className="h-full w-full object-cover" />
                                    ) : (
                                        <UserIcon size={40} className="text-gray-400" />
                                    )}
                                </div>
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-full transition-all flex items-center justify-center">
                                    <Camera className="text-white opacity-0 group-hover:opacity-100" size={24} />
                                </div>
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleImageUpload} 
                                accept="image/*"
                                className="hidden" 
                            />
                            <p className="mt-2 text-xs text-gray-500">
                                Click to change. Auto-resized to 300x300.
                            </p>
                            <h2 className="mt-2 text-xl font-bold text-gray-900">{currentUser.name}</h2>
                            <p className="text-sm text-gray-500">{currentUser.role} • {currentUser.id}</p>
                        </div>

                        {/* Tabs */}
                        <div className="border-b border-gray-200 mb-4">
                            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                                <button
                                    onClick={() => setActiveTab('info')}
                                    className={`${activeTab === 'info' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                                >
                                    Details
                                </button>
                                <button
                                    onClick={() => setActiveTab('security')}
                                    className={`${activeTab === 'security' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                                >
                                    Security
                                </button>
                            </nav>
                        </div>

                        {/* Error/Success Messages */}
                        {error && <div className="mb-4 text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
                        {success && <div className="mb-4 text-xs text-green-600 bg-green-50 p-2 rounded">{success}</div>}

                        {/* Security Tab (Password Change) */}
                        {activeTab === 'security' && (
                            <form onSubmit={handlePasswordChange} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Current Password</label>
                                    <input 
                                        type="password" 
                                        required
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2 text-sm"
                                        placeholder="Enter current password (or ID)"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">New Password</label>
                                    <input 
                                        type="password" 
                                        required
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2 text-sm"
                                        placeholder="Min 6 characters"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                                    <input 
                                        type="password" 
                                        required
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2 text-sm"
                                        placeholder="Re-enter new password"
                                    />
                                </div>
                                <div className="pt-2">
                                    <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none">
                                        Update Password
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Info Tab */}
                        {activeTab === 'info' && (
                            <div className="space-y-3 text-sm">
                                <div className="grid grid-cols-3 gap-2">
                                    <span className="font-medium text-gray-500">Email</span>
                                    <span className="col-span-2 text-gray-900">{currentUser.email}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <span className="font-medium text-gray-500">Program</span>
                                    <span className="col-span-2 text-gray-900">{currentUser.programId || 'N/A'}</span>
                                </div>
                                {currentUser.year && (
                                    <div className="grid grid-cols-3 gap-2">
                                        <span className="font-medium text-gray-500">Year</span>
                                        <span className="col-span-2 text-gray-900">{currentUser.year}</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-3 gap-2">
                                    <span className="font-medium text-gray-500">Role</span>
                                    <span className="col-span-2 text-gray-900">{currentUser.role}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
