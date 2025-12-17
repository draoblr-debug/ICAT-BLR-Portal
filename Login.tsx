
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserCircle, Lock, Copy, KeyRound, ArrowLeft, CheckCircle } from 'lucide-react';

export const Login = () => {
  const { login, users, updateUserProfile } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Reset Password State
  const [isResetting, setIsResetting] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    // Trim inputs to handle potential copy-paste whitespace
    const success = await login(email.trim(), password.trim());
    if (!success) {
      setError('Invalid email or password (ID).');
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    const targetEmail = resetEmail.trim();
    const user = users.find(u => u.email.toLowerCase() === targetEmail.toLowerCase());

    if (user) {
        // Reset logic: Revert password to User ID (default behavior)
        try {
            await updateUserProfile(user.id, { password: user.id });
            setSuccessMsg(`Success! Password for ${user.name} has been reset to their ID: ${user.id}`);
            setIsResetting(false);
            setEmail(targetEmail); // Pre-fill login
            setPassword('');
        } catch (err) {
            setError('Failed to reset password. Please try again.');
        }
    } else {
        setError('No account found with this email address.');
    }
  };

  // Helper for demo purposes to copy email and id
  const copyToClipboard = (text: string, id: string) => {
    setEmail(text);
    setPassword(id);
    setError('');
    setSuccessMsg('');
    setIsResetting(false);
  };

  const demoUsers = [
      { label: 'Student (Animation Yr 2) - Abhishek', email: 'arkoshy006@gmail.com', id: '2024UG05001' },
      { label: 'Student (Animation Yr 2) - Ayush', email: 'singhbro1001@gmail.com', id: '2024UG05005' },
      { label: 'HOD (Animation)', email: 'sunil.pn@icat.ac.in', id: 'BLR006' },
      { label: 'Tutor (Animation)', email: 'sharan.r@icat.ac.in', id: 'BLR007' },
      { label: 'Student (Game Art Yr 2) - Abhineeth', email: 'abhineethmenon2006@gmail.com', id: '2024UG06046' },
      { label: 'Student (Game Art Yr 2) - Abijit', email: 'abijitajaykhosh@gmail.com', id: '2024UG06013' },
      { label: 'HOD (Game)', email: 'sandeep.s@icat.ac.in', id: 'BLR009' },
      { label: 'Tutor (Game)', email: 'pranav.as@icat.ac.in', id: 'BLR010' },
      { label: 'Edu Manager', email: 'drao.blr@icat.ac.in', id: 'BLR026' },
      { label: 'Student Service', email: 'pradeepa.h@icat.ac.in', id: 'BLR029' },
      { label: 'System Admin', email: 'hemachandran@icat.ac.in', id: 'BLR028' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto flex justify-center">
            <img 
              src="https://lh3.googleusercontent.com/d/1sgI_sE07Tnlg-1wdXb2r8q88PWxUYmi9" 
              alt="ICAT Logo" 
              className="h-[200px] w-[200px] object-contain"
            />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            THE ICAT BLR PORTAL
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isResetting ? 'Reset your password' : 'Sign in to access your dashboard'}
          </p>
        </div>
        
        {/* Success Message Banner */}
        {successMsg && (
            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-md">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-green-700">{successMsg}</p>
                    </div>
                </div>
            </div>
        )}

        {!isResetting ? (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
                <div className="mb-4">
                <label htmlFor="email-address" className="sr-only">Email address</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <UserCircle className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        id="email-address"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="appearance-none rounded-md relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                        placeholder="Enter your registered email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                </div>
                <div>
                <label htmlFor="password" className="sr-only">Password (College/Emp ID)</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <KeyRound className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="appearance-none rounded-md relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                        placeholder="Password (ID Number)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
                </div>
            </div>

            <div className="flex items-center justify-end">
                <button 
                    type="button"
                    onClick={() => { setIsResetting(true); setError(''); setSuccessMsg(''); }}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                    Forgot your password?
                </button>
            </div>

            {error && (
                <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">
                {error}
                </div>
            )}

            <div>
                <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-indigo-500 group-hover:text-indigo-400" />
                </span>
                Sign in
                </button>
            </div>
            </form>
        ) : (
            <form className="mt-8 space-y-6" onSubmit={handleReset}>
                <div className="rounded-md shadow-sm">
                    <div>
                        <label htmlFor="reset-email" className="sr-only">Registered Email</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <UserCircle className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="reset-email"
                                name="resetEmail"
                                type="email"
                                autoComplete="email"
                                required
                                className="appearance-none rounded-md relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                placeholder="Enter your registered email"
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="text-xs text-gray-500 text-center">
                    This will reset your password back to your College/Employee ID.
                </div>

                {error && (
                    <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">
                    {error}
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    <button
                        type="submit"
                        className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Reset Password
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsResetting(false); setError(''); setSuccessMsg(''); }}
                        className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                        <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                            <ArrowLeft className="h-4 w-4 text-gray-400" />
                        </span>
                        Back to Login
                    </button>
                </div>
            </form>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Demo Logins (Click to fill)</h3>
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                {demoUsers.map((u) => (
                    <button 
                        key={u.email}
                        onClick={() => copyToClipboard(u.email, u.id)}
                        className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        <span>{u.label}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                            {u.id} <Copy size={12} />
                        </span>
                    </button>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};
