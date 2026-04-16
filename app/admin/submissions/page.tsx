'use client';

import { useState, useEffect } from 'react';
import SubmissionDetailModal from '../../../components/SubmissionDetailModal';

type SourceType = 'catalog' | 'bulk_upload' | 'custom';

function getSourceType(s: any): SourceType {
 if (s.source === 'bulk_upload') return 'bulk_upload';
 if (s.source === 'catalog' || (!s.source && s.shopifyProductId)) return 'catalog';
 return 'custom';
}

function getDisplayName(s: any): string {
 const t = getSourceType(s);
 if (t === 'catalog') return s.shopifyTitle || s.productName || 'Untitled';
 return s.productName || s.shopifyTitle || 'Untitled';
}

function getDisplayImage(s: any): string | undefined {
 const t = getSourceType(s);
 if (t === 'catalog') return s.shopifyImage;
 if (t === 'bulk_upload') return undefined;
 return s.productImages?.[0];
}

function SourceBadge({ source }: { source: SourceType }) {
 const styles: Record<SourceType, string> = {
 catalog: 'bg-accent/10 text-accent',
 custom: 'bg-purple-500/10 text-purple-400',
 bulk_upload: 'bg-teal-500/10 text-teal-400',
 };
 const labels: Record<SourceType, string> = {
 catalog: 'Catalog',
 custom: 'Custom',
 bulk_upload: 'Bulk Upload',
 };
 return (
 <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded ${styles[source]}`}>
 {labels[source]}
 </span>
 );
}

export default function AdminSubmissionsPage() {
 const [submissions, setSubmissions] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [approving, setApproving] = useState<string | null>(null);
 const [viewSubmission, setViewSubmission] = useState<any>(null);
 const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
 const [search, setSearch] = useState('');

 const fetchSubmissions = async () => {
 setLoading(true);
 try {
 const res = await fetch('/api/supplier-products');
 const data = await res.json();
 setSubmissions(data.products || []);
 } catch (err) { console.error(err); }
 finally { setLoading(false); }
 };

 useEffect(() => { fetchSubmissions(); }, []);

 const handleApprove = async (id: string) => {
 setApproving(id);
 try {
 const res = await fetch('/api/supplier-products', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ productId: id, action: 'approve' }),
 });
 if (res.ok) { fetchSubmissions(); }
 else { const d = await res.json(); alert(d.error || 'Failed to approve'); }
 } catch { alert('Error approving'); }
 finally { setApproving(null); }
 };

 const handleReject = async (id: string) => {
 if (!confirm('Reject this submission?')) return;
 try {
 const res = await fetch('/api/supplier-products', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ productId: id, action: 'reject' }),
 });
 if (res.ok) { fetchSubmissions(); }
 else { const d = await res.json(); alert(d.error || 'Failed to reject'); }
 } catch { alert('Error rejecting'); }
 };

 // Filter & search
 const filtered = submissions.filter(s => {
 if (filterStatus !== 'all' && s.status !== filterStatus) return false;
 if (search.length >= 2) {
 const q = search.toLowerCase();
 const name = (s.shopifyTitle || s.productName || '').toLowerCase();
 const supplier = (s.supplierName || '').toLowerCase();
 const sku = (s.skuCode || '').toLowerCase();
 if (!name.includes(q) && !supplier.includes(q) && !sku.includes(q)) return false;
 }
 return true;
 });

 const pending = filtered.filter(s => s.status === 'pending');
 const approved = filtered.filter(s => s.status === 'approved');
 const rejected = filtered.filter(s => s.status === 'rejected');

 // Group approved by supplier
 const bySupplier: Record<string, any[]> = {};
 approved.forEach(s => {
 const name = s.supplierName || 'Unknown Supplier';
 if (!bySupplier[name]) bySupplier[name] = [];
 bySupplier[name].push(s);
 });

 const kpis = [
 { label: 'Total', value: submissions.length, color: 'text-purple-400' },
 { label: 'Pending', value: submissions.filter(s => s.status === 'pending').length, color: 'text-yellow-400' },
 { label: 'Approved', value: submissions.filter(s => s.status === 'approved').length, color: 'text-green-400' },
 { label: 'Rejected', value: submissions.filter(s => s.status === 'rejected').length, color: 'text-red-400' },
 ];

 const inputClass = 'w-full px-3 py-2 border-2 border-white/10 text-sm focus:outline-none focus:border-accent transition-colors';

 if (loading) {
 return (
 <div className="p-6">
 <div className="animate-pulse space-y-4">
 <div className="h-8 bg-gray-200 rounded w-48"></div>
 <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 "></div>)}</div>
 <div className="h-64 bg-gray-200 "></div>
 </div>
 </div>
 );
 }

 // ── Reusable submission card ──
 function SubmissionCard({ s, borderColor = 'border-yellow-500/10', dimmed = false }: { s: any; borderColor?: string; dimmed?: boolean }) {
 const sourceType = getSourceType(s);
 const displayName = getDisplayName(s);
 const displayImage = getDisplayImage(s);
 const isBulk = sourceType === 'bulk_upload';

 return (
 <div
 className={`bg-white/5 border ${borderColor} p-4 flex items-start gap-4 cursor-pointer hover: transition-all ${dimmed ? 'opacity-60 hover:opacity-80' : ''}`}
 onClick={() => setViewSubmission(s)}
 >
 {displayImage ? (
 <img src={displayImage} alt="" className="w-14 h-14 object-contain bg-white/5 border-2 border-white/5 shrink-0" />
 ) : isBulk ? (
 <div className="w-14 h-14 bg-teal-500/10 border border-teal-100 flex items-center justify-center shrink-0">
 <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 </div>
 ) : null}

 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <h3 className="font-semibold text-white text-sm">{displayName}</h3>
 <SourceBadge source={sourceType} />
 {dimmed && (
 <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-red-500/10 text-red-400">Rejected</span>
 )}
 </div>
 <div className="flex items-center gap-3 mt-1 text-xs text-white/50 flex-wrap">
 <span>Qty: <strong className="text-white">{s.quantity}</strong></span>
 <span>Price: <strong className="text-white">₹{s.sellingPrice}</strong></span>
 {s.mrp && s.mrp > s.sellingPrice && (
 <span className="text-white/40">
 MRP: <span className="line-through">₹{s.mrp}</span>{' '}
 <span className="text-red-400 font-medium">{Math.round((1 - s.sellingPrice / s.mrp) * 100)}% off</span>
 </span>
 )}
 {s.skuCode && <span>SKU: <strong className="text-white font-mono">{s.skuCode}</strong></span>}
 {s.brand && <span>Brand: <strong className="text-white">{s.brand}</strong></span>}
 <span>By: <strong className="text-white">{s.supplierName || 'Unknown'}</strong></span>
 </div>
 <span className="inline-block mt-1.5 text-[10px] text-white/40">
 {new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
 </span>
 {!dimmed && s.variants?.length > 0 && (
 <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
 <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Variants ({s.variants.length})</p>
 {s.variants.slice(0, 3).map((v: any, vi: number) => (
 <div key={vi} className="flex items-center justify-between text-[11px] bg-white/5 rounded px-2 py-1">
 <span className="text-white/60 truncate">{v.title || 'Default'}{v.color ? ` · ${v.color}` : ''}</span>
 <span className="text-white font-medium shrink-0 ml-2">₹{v.sellingPrice} × {v.quantity}</span>
 </div>
 ))}
 {s.variants.length > 3 && <p className="text-[10px] text-white/40">+{s.variants.length - 3} more</p>}
 </div>
 )}
 </div>

 {!dimmed && s.status === 'pending' && (
 <div className="flex gap-2 shrink-0">
 <button onClick={(e) => { e.stopPropagation(); handleApprove(s._id); }} disabled={approving === s._id}
 className="px-3 py-1.5 text-xs bg-green-500/100/10 text-green-400 font-medium hover:bg-green-500/100/20 disabled:opacity-50">
 {approving === s._id ? '...' : 'Approve'}
 </button>
 <button onClick={(e) => { e.stopPropagation(); handleReject(s._id); }}
 className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 font-medium hover:bg-red-500/100/20">
 Reject
 </button>
 </div>
 )}
 </div>
 );
 }

 return (
 <div className="p-6 space-y-6">
 {/* ── Header ── */}
 <div>
 <h1 className="text-2xl font-bold text-white">Supplier Submissions</h1>
 <p className="text-sm text-white/40 mt-1">{filtered.length} submissions from suppliers</p>
 </div>

 {/* ── KPI Cards ── */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {kpis.map((k, i) => (
 <div
 key={k.label}
 className={`bg-white/5 border-2 border-white/10 p-5 ${i > 0 ? 'cursor-pointer hover:border-white/20 transition-colors' : ''}`}
 onClick={i === 1 ? () => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')
 : i === 2 ? () => setFilterStatus(filterStatus === 'approved' ? 'all' : 'approved')
 : i === 3 ? () => setFilterStatus(filterStatus === 'rejected' ? 'all' : 'rejected')
 : undefined}
 >
 <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{k.label}</p>
 <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
 </div>
 ))}
 </div>

 {/* ── Filters ── */}
 <div className="bg-white/5 border-2 border-white/10 p-4 ">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <input
 type="text"
 placeholder="Search by product, supplier, or SKU..."
 className={inputClass} value={search} onChange={e => setSearch(e.target.value)}
 />
 <select className={inputClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
 <option value="all">All Statuses</option>
 <option value="pending">Pending</option>
 <option value="approved">Approved</option>
 <option value="rejected">Rejected</option>
 </select>
 </div>
 </div>

 {/* ── Content ── */}
 {filtered.length === 0 ? (
 <div className="bg-white/5 border-2 border-white/10 p-12 text-center ">
 <svg className="w-12 h-12 mx-auto text-white/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
 <p className="text-white/40 text-lg">No submissions found.</p>
 </div>
 ) : (
 <div className="space-y-8">

 {/* Pending */}
 {pending.length > 0 && (
 <div>
 <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-yellow-500/100/100" />
 Pending Review ({pending.length})
 </h3>
 <div className="space-y-3">
 {pending.map((s: any) => (
 <SubmissionCard key={s._id} s={s} borderColor="border-yellow-500/10" />
 ))}
 </div>
 </div>
 )}

 {/* Approved — grouped by supplier */}
 {Object.keys(bySupplier).length > 0 && (
 <div>
 <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-green-500/100/100" />
 Approved Products
 </h3>
 <div className="space-y-6">
 {Object.entries(bySupplier).map(([supplierName, products]) => (
 <div key={supplierName}>
 <div className="flex items-center gap-2 mb-3">
 <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
 {supplierName.charAt(0).toUpperCase()}
 </div>
 <span className="text-sm font-semibold text-white/80">{supplierName}</span>
 <span className="text-[10px] text-white/40 bg-white/10 px-2 py-0.5 rounded-full">{products.length} product{products.length > 1 ? 's' : ''}</span>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
 {products.map((s: any) => {
 const sourceType = getSourceType(s);
 const displayName = getDisplayName(s);
 const displayImage = getDisplayImage(s);
 return (
 <div key={s._id} className="bg-white/5 border border-green-500/10 overflow-hidden hover: transition-all cursor-pointer" onClick={() => setViewSubmission(s)}>
 <div className="aspect-[4/3] bg-white/5 overflow-hidden">
 {displayImage ? (
 <img src={displayImage} alt={displayName} className="w-full h-full object-contain" />
 ) : (
 <div className="w-full h-full flex items-center justify-center text-white/30">
 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
 </div>
 )}
 </div>
 <div className="p-3">
 <h4 className="text-sm font-medium text-white line-clamp-2 leading-tight mb-1.5">{displayName}</h4>
 <div className="flex items-center justify-between">
 <div className="flex items-baseline gap-1.5">
 <span className="text-sm font-bold text-white">₹{s.sellingPrice}</span>
 {s.mrp && s.mrp > s.sellingPrice && <span className="text-[10px] text-white/40 line-through">₹{s.mrp}</span>}
 </div>
 <span className="text-[11px] text-white/40">Qty: {s.quantity}</span>
 </div>
 {s.variants?.length > 0 && (
 <p className="mt-1.5 text-[10px] text-white/40">{s.variants.length} variant{s.variants.length > 1 ? 's' : ''}</p>
 )}
 <div className="flex items-center gap-1.5 mt-2">
 <SourceBadge source={sourceType} />
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Rejected */}
 {rejected.length > 0 && (
 <div>
 <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-red-500/100" />
 Rejected ({rejected.length})
 </h3>
 <div className="space-y-3">
 {rejected.map((s: any) => (
 <SubmissionCard key={s._id} s={s} borderColor="border-white/10" dimmed />
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Submission Detail Modal */}
 {viewSubmission && (
 <SubmissionDetailModal
 submission={viewSubmission}
 onClose={() => setViewSubmission(null)}
 onApprove={handleApprove}
 onReject={handleReject}
 approving={approving}
 />
 )}
 </div>
 );
}
