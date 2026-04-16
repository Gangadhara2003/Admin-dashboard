'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import StatusBadge from '../../../components/StatusBadge';
import FilterBar from '../../../components/FilterBar';
import TabBar from '../../../components/TabBar';

export default function SuppliersPage() {
 const [suppliers, setSuppliers] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [formData, setFormData] = useState({ name: '', businessName: '', phone: '', password: '', email: '', address: '', city: '', state: '', pincode: '', isActive: true });
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');
 const [activeTab, setActiveTab] = useState('all');
 const [, setActiveFilters] = useState<Record<string, string>>({});

 const fetchSuppliers = async () => {
 setLoading(true);
 try {
 const res = await fetch('/api/admin/suppliers');
 const data = await res.json();
 if (res.ok) setSuppliers(data.suppliers || []);
 } catch (err) { console.error(err); }
 finally { setLoading(false); }
 };

 useEffect(() => { fetchSuppliers(); }, []);

 const openCreateModal = () => {
 setFormData({ name: '', businessName: '', phone: '', password: '', email: '', address: '', city: '', state: '', pincode: '', isActive: true });
 setError('');
 setIsModalOpen(true);
 };

 const handleSave = async (e: FormEvent) => {
 e.preventDefault(); setSaving(true); setError('');
 try {
 const res = await fetch('/api/admin/suppliers', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(formData),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to create supplier');
 setIsModalOpen(false); fetchSuppliers();
 } catch (err: any) { setError(err.message); }
 finally { setSaving(false); }
 };

 const activeCount = suppliers.filter(s => s.isActive !== false).length;
 const disabledCount = suppliers.filter(s => s.isActive === false).length;

 const tabs = [
 { key: 'all', label: 'All Suppliers', count: suppliers.length },
 { key: 'active', label: 'Active', count: activeCount },
 { key: 'disabled', label: 'Disabled', count: disabledCount },
 ];

 const filters = [
 { key: 'search', label: 'Search', type: 'text' as const, placeholder: 'Search by name, business, phone...' },
 { key: 'city', label: 'City', type: 'select' as const, options: [...new Set(suppliers.map(s => s.city).filter(Boolean))].map(c => ({ label: c, value: c })) },
 ];

 const filteredSuppliers = activeTab === 'all'
 ? suppliers
 : activeTab === 'active'
 ? suppliers.filter(s => s.isActive !== false)
 : suppliers.filter(s => s.isActive === false);

 const inputClass = "w-full px-4 py-2.5 bg-white/5 border-2 border-white/10 text-sm text-white transition-all focus:outline-none focus:border-accent ";
 const labelClass = "block mb-1.5 text-sm text-white/50 font-medium";

 return (
 <div>
 <div className="flex justify-between items-center mb-6">
 <div>
 <h1 className="text-2xl font-bold text-white">Suppliers</h1>
 <p className="text-sm text-white/50 mt-1">View and manage all registered suppliers on the platform.</p>
 </div>
 <button
 onClick={openCreateModal}
 className="px-4 py-2 bg-accent text-white text-sm font-medium shadow-blue-500/30 hover:bg-accent/80 transition-all"
 >
 + Add Supplier
 </button>
 </div>

 {/* KPI Summary */}
 <div className="grid grid-cols-3 gap-4 mb-6">
 <div className="bg-white/5 border-2 border-white/10 p-4 text-center">
 <p className="text-2xl font-bold text-accent">{suppliers.length}</p>
 <p className="text-xs text-white/50 mt-1">Total Suppliers</p>
 </div>
 <div className="bg-white/5 border-2 border-white/10 p-4 text-center">
 <p className="text-2xl font-bold text-green-400">{activeCount}</p>
 <p className="text-xs text-white/50 mt-1">Active</p>
 </div>
 <div className="bg-white/5 border-2 border-white/10 p-4 text-center">
 <p className="text-2xl font-bold text-red-400">{disabledCount}</p>
 <p className="text-xs text-white/50 mt-1">Disabled</p>
 </div>
 </div>

 <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
 <FilterBar filters={filters} onFilterChange={setActiveFilters} />

 {/* Supplier Cards */}
 {loading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {Array.from({ length: 6 }).map((_, i) => (
 <div key={i} className="bg-white/5 border-2 border-white/10 p-5 animate-pulse">
 <div className="h-4 bg-white/10 rounded w-2/3 mb-3" />
 <div className="h-3 bg-white/10 rounded w-1/2 mb-2" />
 <div className="h-3 bg-white/10 rounded w-1/3" />
 </div>
 ))}
 </div>
 ) : filteredSuppliers.length === 0 ? (
 <div className="bg-white/5 border-2 border-white/10 p-12 text-center">
 <svg className="w-16 h-16 mx-auto text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
 </svg>
 <p className="text-white/40 text-sm">No suppliers found. Create one to get started.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {filteredSuppliers.map((s: any) => (
 <Link
 key={s._id}
 href={`/admin/suppliers/${s._id}`}
 className="block bg-white/5 border-2 border-white/10 p-5 hover: hover:border-blue-200 transition-all group"
 >
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-3">
 {/* Avatar */}
 <div className="w-10 h-10 bg-accent flex items-center justify-center text-white font-bold text-sm shrink-0">
 {s.businessName?.charAt(0)?.toUpperCase() || 'S'}
 </div>
 <div>
 <h3 className="font-semibold text-white text-sm group-hover:text-accent transition-colors">{s.businessName}</h3>
 <p className="text-xs text-white/40">{s.name}</p>
 </div>
 </div>
 <StatusBadge status={s.isActive !== false ? 'Active' : 'Inactive'} />
 </div>

 <div className="space-y-1.5 text-xs text-white/50">
 <div className="flex items-center gap-2">
 <svg className="w-3.5 h-3.5 text-white/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
 </svg>
 <span>{s.phone}</span>
 </div>
 {s.email && (
 <div className="flex items-center gap-2">
 <svg className="w-3.5 h-3.5 text-white/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
 </svg>
 <span className="truncate">{s.email}</span>
 </div>
 )}
 <div className="flex items-center gap-2">
 <svg className="w-3.5 h-3.5 text-white/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
 </svg>
 <span>{s.city ? `${s.city}, ${s.state || ''}` : s.address ? s.address.substring(0, 40) + '...' : 'No address'}</span>
 </div>
 </div>

 <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
 <span className="text-xs text-white/40">Joined {s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</span>
 <span className="text-xs font-medium text-accent group-hover:text-accent transition-colors flex items-center gap-1">
 View Details
 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </span>
 </div>
 </Link>
 ))}
 </div>
 )}

 {/* Create Supplier Modal */}
 {isModalOpen && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] animate-fadeIn" onClick={() => !saving && setIsModalOpen(false)}>
 <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white/5 border-2 border-white/10 p-6 animate-slideUp" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-6">
 <h2 className="text-lg font-semibold text-white">Create New Supplier</h2>
 <button className="bg-transparent border-none text-white/40 text-2xl cursor-pointer hover:text-white" onClick={() => !saving && setIsModalOpen(false)}>&times;</button>
 </div>
 {error && <div className="text-red-400 text-sm mb-4 bg-red-500/10 p-3 ">{error}</div>}
 <form onSubmit={handleSave}>
 <div className="grid grid-cols-2 gap-4">
 <div><label className={labelClass}>Representative Name *</label><input required type="text" className={inputClass} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
 <div><label className={labelClass}>Business / Shop Name *</label><input required type="text" className={inputClass} value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} /></div>
 <div><label className={labelClass}>Login Phone *</label><input required type="tel" className={inputClass} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
 <div><label className={labelClass}>Login Password *</label><input required type="text" className={inputClass} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
 </div>
 <div className="mt-4"><label className={labelClass}>Email Address</label><input type="email" className={inputClass} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
 <div className="mt-4"><label className={labelClass}>Full Address *</label><textarea required className={inputClass} rows={2} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
 <div className="grid grid-cols-3 gap-4 mt-4">
 <div><label className={labelClass}>City</label><input type="text" className={inputClass} value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
 <div><label className={labelClass}>State</label><input type="text" className={inputClass} value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} /></div>
 <div><label className={labelClass}>Pincode</label><input type="text" className={inputClass} value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} /></div>
 </div>
 <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/10">
 <button type="button" className="px-5 py-2.5 bg-white/5 border-2 border-white/10 text-white/60 text-sm font-medium hover:bg-white/5 transition-all" onClick={() => setIsModalOpen(false)}>Cancel</button>
 <button type="submit" className="px-5 py-2.5 bg-accent text-white text-sm font-medium shadow-blue-500/30 hover:bg-accent/80 transition-all disabled:opacity-70" disabled={saving}>{saving ? 'Creating...' : 'Create Supplier'}</button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
}
