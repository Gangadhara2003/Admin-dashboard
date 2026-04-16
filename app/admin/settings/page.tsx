'use client';

import { useState, useEffect } from 'react';
import Modal from '../../../components/Modal';
import { useUser } from '../../../contexts/UserContext';

const labelClass = "block mb-1.5 text-sm text-white/50 font-medium";
const inputClass = "w-full px-4 py-2.5 bg-white/5 border-2 border-white/10 text-sm text-white focus:outline-none focus:border-accent transition-all";

const sections = [
 { key: 'general', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
 { key: 'permissions', label: 'Permissions', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
 { key: 'system', label: 'System', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

function ComingSoonBadge() {
 return (
 <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-yellow-500/100/20 text-yellow-400 border border-yellow-500/20">
 🚧 Coming Soon
 </span>
 );
}

export default function AdminSettingsPage() {
 const [activeSection, setActiveSection] = useState('general');

 // Super Admin management
 const [admins, setAdmins] = useState<any[]>([]);
 const [adminsLoading, setAdminsLoading] = useState(true);
 const [showAddModal, setShowAddModal] = useState(false);
 const [newPhone, setNewPhone] = useState('');
 const [newPassword, setNewPassword] = useState('');
 const [addLoading, setAddLoading] = useState(false);
 const [addError, setAddError] = useState('');
 const [addSuccess, setAddSuccess] = useState('');
 const [removeLoading, setRemoveLoading] = useState<string | null>(null);

 const { user: currentUser } = useUser();
 const currentUserId = currentUser?.id || '';

 // Profile state
 const [profilePhone, setProfilePhone] = useState('');
 const [profileLoading, setProfileLoading] = useState(true);
 const [profileJoined, setProfileJoined] = useState('');
 const [currentPassword, setCurrentPassword] = useState('');
 const [newProfilePassword, setNewProfilePassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [profileSaving, setProfileSaving] = useState(false);
 const [profileMsg, setProfileMsg] = useState<{type:'success'|'error', text:string}|null>(null);
 const [passwordSaving, setPasswordSaving] = useState(false);
 const [passwordMsg, setPasswordMsg] = useState<{type:'success'|'error', text:string}|null>(null);

 // Fetch profile
 useEffect(() => {
 async function fetchProfile() {
 try {
 const res = await fetch('/api/admin/profile');
 const data = await res.json();
 if (data.admin) {
 setProfilePhone(data.admin.phone || '');
 setProfileJoined(data.admin.createdAt || '');
 }
 } catch { /* ignore */ }
 finally { setProfileLoading(false); }
 }
 fetchProfile();
 }, []);

 const handleUpdatePhone = async () => {
 if (!profilePhone.trim()) return;
 setProfileSaving(true);
 setProfileMsg(null);
 try {
 const res = await fetch('/api/admin/profile', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ phone: profilePhone.trim() }),
 });
 const data = await res.json();
 if (res.ok) {
 setProfileMsg({ type: 'success', text: 'Phone updated successfully!' });
 } else {
 setProfileMsg({ type: 'error', text: data.error || 'Failed to update' });
 }
 } catch { setProfileMsg({ type: 'error', text: 'Network error' }); }
 finally { setProfileSaving(false); }
 };

 const handleChangePassword = async () => {
 if (!currentPassword || !newProfilePassword) return;
 if (newProfilePassword !== confirmPassword) {
 setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
 return;
 }
 if (newProfilePassword.length < 6) {
 setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters' });
 return;
 }
 setPasswordSaving(true);
 setPasswordMsg(null);
 try {
 const res = await fetch('/api/admin/profile', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ currentPassword, newPassword: newProfilePassword }),
 });
 const data = await res.json();
 if (res.ok) {
 setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
 setCurrentPassword('');
 setNewProfilePassword('');
 setConfirmPassword('');
 } else {
 setPasswordMsg({ type: 'error', text: data.error || 'Failed to change password' });
 }
 } catch { setPasswordMsg({ type: 'error', text: 'Network error' }); }
 finally { setPasswordSaving(false); }
 };

 // Fetch admins
 const fetchAdmins = async () => {
 try {
 const res = await fetch('/api/admin/manage');
 const data = await res.json();
 setAdmins(data.admins || []);
 } catch { /* ignore */ }
 finally { setAdminsLoading(false); }
 };

 useEffect(() => { fetchAdmins(); }, []);

 const handleAddAdmin = async () => {
 if (!newPhone || !newPassword) return;
 setAddLoading(true);
 setAddError('');
 setAddSuccess('');

 try {
 const res = await fetch('/api/admin/manage', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ phone: newPhone, password: newPassword }),
 });
 const data = await res.json();
 if (res.ok) {
 setAddSuccess(`Admin ${newPhone} added successfully!`);
 setNewPhone('');
 setNewPassword('');
 fetchAdmins();
 setTimeout(() => { setShowAddModal(false); setAddSuccess(''); }, 2000);
 } else {
 setAddError(data.error || 'Failed to add admin');
 }
 } catch {
 setAddError('Network error');
 } finally {
 setAddLoading(false);
 }
 };

 const handleRemoveAdmin = async (adminId: string, phone: string) => {
 if (!confirm(`Remove admin ${phone}? They will lose access immediately.`)) return;
 setRemoveLoading(adminId);
 try {
 const res = await fetch(`/api/admin/manage?id=${adminId}`, { method: 'DELETE' });
 const data = await res.json();
 if (res.ok) {
 fetchAdmins();
 } else {
 alert(data.error || 'Failed to remove admin');
 }
 } catch {
 alert('Network error');
 } finally {
 setRemoveLoading(null);
 }
 };

 return (
 <div>
 <div className="mb-6">
 <h1 className="text-2xl font-bold text-white">Admin Settings</h1>
 <p className="text-sm text-white/50 mt-1">Configure platform-wide settings, permissions, and system rules.</p>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
 {/* Section Nav */}
 <div className="bg-white/5 border-2 border-white/10 p-4 h-fit">
 <nav className="space-y-1">
 {sections.map((s) => (
 <button key={s.key} onClick={() => setActiveSection(s.key)}
 className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium transition-all bg-transparent border-none cursor-pointer text-left ${activeSection === s.key ? 'bg-accent/10 text-accent' : 'text-white/50 hover:bg-white/5 hover:text-white/80'}`}>
 <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} /></svg>
 {s.label}
 </button>
 ))}
 </nav>
 </div>

 {/* Content */}
 <div className="lg:col-span-3 space-y-6">

 {/* ─── PROFILE ─── */}
 {activeSection === 'general' && (
 <div className="space-y-6">
 {/* Profile Info */}
 <div className="bg-white/5 border-2 border-white/10 p-6 ">
 <h3 className="text-lg font-semibold text-white mb-1">My Profile</h3>
 <p className="text-xs text-white/40 mb-5">Update your account information.</p>

 {profileLoading ? (
 <div className="py-8 text-center">
 <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
 <p className="text-xs text-white/40">Loading profile...</p>
 </div>
 ) : (
 <div className="space-y-5">
 {/* Avatar + Role */}
 <div className="flex items-center gap-4 pb-5 border-b border-white/5">
 <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-white text-xl font-bold shrink-0">
 {profilePhone?.slice(-2) || 'A'}
 </div>
 <div>
 <p className="text-lg font-semibold text-white">{profilePhone || '—'}</p>
 <div className="flex items-center gap-2 mt-0.5">
 <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-green-500/100/20 text-green-400">Super Admin</span>
 {profileJoined && (
 <span className="text-[11px] text-white/40">
 Since {new Date(profileJoined).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
 </span>
 )}
 </div>
 </div>
 </div>

 {/* Phone Edit */}
 <div>
 <label className={labelClass}>Phone Number</label>
 <div className="flex gap-2">
 <input
 type="tel"
 className={inputClass}
 value={profilePhone}
 onChange={e => { setProfilePhone(e.target.value); setProfileMsg(null); }}
 />
 <button
 onClick={handleUpdatePhone}
 disabled={profileSaving}
 className="px-5 py-2.5 bg-accent text-white text-sm font-medium hover:bg-accent/80 disabled:opacity-50 transition-all whitespace-nowrap"
 >
 {profileSaving ? 'Saving...' : 'Update'}
 </button>
 </div>
 {profileMsg && (
 <p className={`text-xs mt-2 ${profileMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
 {profileMsg.text}
 </p>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Change Password */}
 <div className="bg-white/5 border-2 border-white/10 p-6 ">
 <h3 className="text-lg font-semibold text-white mb-1">Change Password</h3>
 <p className="text-xs text-white/40 mb-5">Enter your current password to set a new one.</p>

 <div className="space-y-4 max-w-md">
 <div>
 <label className={labelClass}>Current Password *</label>
 <input
 type="password"
 className={inputClass}
 placeholder="Enter current password"
 autoComplete="off"
 value={currentPassword}
 onChange={e => { setCurrentPassword(e.target.value); setPasswordMsg(null); }}
 />
 </div>
 <div>
 <label className={labelClass}>New Password *</label>
 <input
 type="password"
 className={inputClass}
 placeholder="Min 6 characters"
 autoComplete="new-password"
 value={newProfilePassword}
 onChange={e => { setNewProfilePassword(e.target.value); setPasswordMsg(null); }}
 />
 </div>
 <div>
 <label className={labelClass}>Confirm New Password *</label>
 <input
 type="password"
 className={inputClass}
 placeholder="Re-enter new password"
 autoComplete="new-password"
 value={confirmPassword}
 onChange={e => { setConfirmPassword(e.target.value); setPasswordMsg(null); }}
 />
 </div>

 {passwordMsg && (
 <div className={` p-3 text-xs ${passwordMsg.type === 'success' ? 'bg-green-500/100/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-200 text-red-400'}`}>
 {passwordMsg.text}
 </div>
 )}

 <button
 onClick={handleChangePassword}
 disabled={passwordSaving || !currentPassword || !newProfilePassword || !confirmPassword}
 className="px-5 py-2.5 bg-accent text-white text-sm font-medium shadow-blue-500/30 hover:bg-accent/80 disabled:opacity-50 disabled:shadow-none transition-all"
 >
 {passwordSaving ? 'Changing...' : 'Change Password'}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ─── PERMISSIONS ─── */}
 {activeSection === 'permissions' && (
 <div className="space-y-6">
 {/* Super Admin — WORKING */}
 <div className="bg-white/5 border-2 border-white/10 p-6 ">
 <div className="flex items-center justify-between mb-5">
 <div>
 <h3 className="text-lg font-semibold text-white">Super Admin</h3>
 <p className="text-xs text-white/40 mt-0.5">Full Access · User Management · Settings</p>
 </div>
 <button
 onClick={() => { setShowAddModal(true); setAddError(''); setAddSuccess(''); setNewPhone(''); setNewPassword(''); }}
 className="px-4 py-2 text-sm font-medium bg-accent text-white hover:bg-accent/80 transition-all"
 >
 + Add Admin
 </button>
 </div>

 {/* Admin List */}
 {adminsLoading ? (
 <div className="py-6 text-center">
 <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
 <p className="text-xs text-white/40">Loading admins...</p>
 </div>
 ) : admins.length === 0 ? (
 <p className="text-sm text-white/40 text-center py-6">No admins found.</p>
 ) : (
 <div className="space-y-2">
 {admins.map((admin: any) => {
 const isCurrentUser = admin._id === currentUserId;
 return (
 <div key={admin._id} className={`flex items-center justify-between p-4 border transition-all ${isCurrentUser ? 'border-blue-200 bg-accent/10/30' : 'border-white/10 hover:border-white/20'}`}>
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white text-sm font-bold shrink-0">
 {admin.phone?.slice(-2) || 'A'}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <p className="text-sm font-semibold text-white">{admin.phone}</p>
 {isCurrentUser && (
 <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent">You</span>
 )}
 </div>
 <p className="text-[11px] text-white/40">
 Added {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-green-500/100/20 text-green-400">Super Admin</span>
 {!isCurrentUser && (
 <button
 onClick={() => handleRemoveAdmin(admin._id, admin.phone)}
 disabled={removeLoading === admin._id}
 className="px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/100/20 border border-red-500/10 transition-colors disabled:opacity-50"
 >
 {removeLoading === admin._id ? 'Removing...' : 'Remove'}
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Other Roles — Coming Soon */}
 <div className="bg-white/5 border-2 border-white/10 p-6 ">
 <div className="flex items-center justify-between mb-5">
 <h3 className="text-lg font-semibold text-white">Other Roles</h3>
 <ComingSoonBadge />
 </div>
 <div className="space-y-3 opacity-50 pointer-events-none">
 {[
 { role: 'Operations Manager', perms: 'Orders · Delivery · Support', color: 'bg-indigo-500/20 text-indigo-700' },
 { role: 'Finance Manager', perms: 'Payments · Reports · Refunds', color: 'bg-yellow-500/100/20 text-yellow-400' },
 { role: 'Content Manager', perms: 'CMS · Promotions · Products', color: 'bg-purple-100 text-purple-400' },
 ].map((r) => (
 <div key={r.role} className="flex items-center justify-between p-4 border-2 border-white/10 ">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
 <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
 </div>
 <div>
 <p className="text-sm font-medium text-white">{r.role}</p>
 <p className="text-xs text-white/40 mt-0.5">{r.perms}</p>
 </div>
 </div>
 <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${r.color}`}>{r.role.split(' ')[0]}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* ─── SYSTEM ─── */}
 {activeSection === 'system' && (
 <div className="space-y-6">
 {/* Delivery Rules — Coming Soon */}
 <div className="bg-white/5 border-2 border-white/10 p-6 ">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-semibold text-white">Delivery Rules</h3>
 <ComingSoonBadge />
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5 opacity-50 pointer-events-none">
 <div><label className={labelClass}>Max Delivery Time (hours)</label><input type="number" className={inputClass} defaultValue="4" readOnly /></div>
 <div><label className={labelClass}>Free Delivery Above (₹)</label><input type="number" className={inputClass} defaultValue="5000" readOnly /></div>
 </div>
 </div>

 {/* Payment Rules — Coming Soon */}
 <div className="bg-white/5 border-2 border-white/10 p-6 ">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-semibold text-white">Payment Rules</h3>
 <ComingSoonBadge />
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5 opacity-50 pointer-events-none">
 <div><label className={labelClass}>Commission Rate (%)</label><input type="number" className={inputClass} defaultValue="7.5" readOnly /></div>
 <div><label className={labelClass}>Settlement Cycle</label><input className={inputClass} defaultValue="Bi-weekly (Mon & Thu)" readOnly /></div>
 </div>
 </div>

 {/* Tax Settings — Coming Soon */}
 <div className="bg-white/5 border-2 border-white/10 p-6 ">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-semibold text-white">Tax Settings</h3>
 <ComingSoonBadge />
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5 opacity-50 pointer-events-none">
 <div><label className={labelClass}>Default GST Rate (%)</label><input type="number" className={inputClass} defaultValue="18" readOnly /></div>
 <div><label className={labelClass}>GST Registration Number</label><input className={inputClass} defaultValue="36XXXXX1234X1ZX" readOnly /></div>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Add Admin Modal */}
 <Modal
 isOpen={showAddModal}
 onClose={() => !addLoading && setShowAddModal(false)}
 title="Add Super Admin"
 size="sm"
 disableClose={addLoading}
 footer={
 !addSuccess ? (
 <div className="flex justify-end gap-2">
 <button onClick={() => setShowAddModal(false)} disabled={addLoading}
 className="px-4 py-2.5 bg-white/10 text-white/80 text-sm font-medium hover:bg-white/10 disabled:opacity-50">
 Cancel
 </button>
 <button onClick={handleAddAdmin} disabled={addLoading || !newPhone || !newPassword}
 className="px-4 py-2.5 bg-accent text-white text-sm font-medium shadow hover:bg-accent/80 disabled:opacity-50 transition-all">
 {addLoading ? 'Adding...' : 'Add Admin'}
 </button>
 </div>
 ) : undefined
 }
 >
 {addSuccess ? (
 <div className="text-center py-4">
 <svg className="w-10 h-10 text-green-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
 <p className="text-sm font-medium text-green-400">{addSuccess}</p>
 </div>
 ) : (
 <div className="space-y-4">
 <p className="text-xs text-white/40 mb-2">This person will get full Super Admin access. They can log in with the phone number and password you set here.</p>
 <div>
 <label className={labelClass}>Phone Number *</label>
 <input
 type="tel"
 className={inputClass}
 placeholder="e.g. 9876543210"
 value={newPhone}
 onChange={e => setNewPhone(e.target.value)}
 />
 </div>
 <div>
 <label className={labelClass}>Password *</label>
 <input
 type="password"
 className={inputClass}
 placeholder="Min 6 characters"
 value={newPassword}
 onChange={e => setNewPassword(e.target.value)}
 />
 </div>
 {addError && (
 <div className="bg-red-500/10 border border-red-200 p-3">
 <p className="text-xs text-red-400">{addError}</p>
 </div>
 )}
 </div>
 )}
 </Modal>
 </div>
 );
}
