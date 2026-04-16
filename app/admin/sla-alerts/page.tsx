'use client';

import { useState, useEffect } from 'react';

export default function AdminSLAAlertsPage() {
 const [data, setData] = useState<any>(null);
 const [loading, setLoading] = useState(true);

 const fetchAlerts = async () => {
 try {
 const res = await fetch('/api/admin/sla-alerts');
 setData(await res.json());
 } catch (err) { console.error(err); }
 finally { setLoading(false); }
 };

 useEffect(() => {
 fetchAlerts();
 const interval = setInterval(fetchAlerts, 60000); // auto-refresh every 60 seconds
 return () => clearInterval(interval);
 }, []);

 const formatElapsed = (minutes: number) => {
 const h = Math.floor(minutes / 60);
 const m = minutes % 60;
 return h > 0 ? `${h}h ${m}m` : `${m}m`;
 };

 if (loading) return (
 <div>
 <h1 className="text-2xl font-bold text-white mb-6">SLA Alerts</h1>
 <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-white/5 border-2 border-white/10 animate-pulse" />)}</div>
 </div>
 );

 const breached = data?.breached || [];
 const warning = data?.warning || [];

 return (
 <div>
 <div className="flex items-start justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold text-white">SLA Alerts</h1>
 <p className="text-sm text-white/50 mt-1">Orders exceeding {data?.thresholdHours || 3.5} hour delivery SLA. Auto-refreshes every 60s.</p>
 </div>
 <button onClick={() => { setLoading(true); fetchAlerts(); }}
 className="px-4 py-2 text-sm font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors border border-accent/20">
 🔄 Refresh Now
 </button>
 </div>

 {/* Summary cards */}
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
 <div className="bg-red-500/10 border border-red-200 p-5">
 <p className="text-xs text-red-400 uppercase tracking-wider font-medium">Breached</p>
 <p className="text-3xl font-bold text-red-400 mt-1">{breached.length}</p>
 <p className="text-[10px] text-red-400 mt-0.5">Exceeded {data?.thresholdHours}h SLA</p>
 </div>
 <div className="bg-yellow-500/100/10 border border-yellow-500/20 p-5">
 <p className="text-xs text-yellow-400 uppercase tracking-wider font-medium">Warning</p>
 <p className="text-3xl font-bold text-yellow-400 mt-1">{warning.length}</p>
 <p className="text-[10px] text-amber-400 mt-0.5">Approaching SLA limit</p>
 </div>
 <div className="bg-green-500/100/10 border border-green-500/20 p-5">
 <p className="text-xs text-green-400 uppercase tracking-wider font-medium">Status</p>
 <p className="text-xl font-bold text-green-400 mt-1">{breached.length + warning.length === 0 ? '✅ All Clear' : '⚠️ Action Needed'}</p>
 </div>
 </div>

 {/* Breached orders */}
 {breached.length > 0 && (
 <>
 <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
 <span className="w-2 h-2 bg-red-500/100 rounded-full animate-pulse" />
 SLA Breached ({breached.length})
 </h2>
 <div className="bg-white/5 border border-red-200 overflow-hidden mb-6">
 <table className="w-full text-sm">
 <thead><tr className="bg-red-500/10/50 border-b border-red-500/10">
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Order Ref</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Supplier</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Items</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Status</th>
 <th className="text-right px-4 py-3 text-xs text-white/50 font-medium">Elapsed</th>
 </tr></thead>
 <tbody>
 {breached.map((o: any) => (
 <tr key={o._id} className="border-b border-white/5 bg-red-500/10/20">
 <td className="px-4 py-3 font-mono text-xs text-white/60">{o.shopifyOrderRef || '-'}</td>
 <td className="px-4 py-3 text-white/80 font-medium">{o.supplierName || '-'}</td>
 <td className="px-4 py-3 text-white/50 text-xs">{o.items?.map((i: any) => i.productName).join(', ')}</td>
 <td className="px-4 py-3"><span className="px-2 py-0.5 text-[10px] font-bold bg-white/10 text-white/60 rounded-full uppercase">{o.status?.replace(/_/g, ' ')}</span></td>
 <td className="px-4 py-3 text-right">
 <span className="px-2 py-1 text-xs font-bold bg-red-500/20 text-red-700 ">{o.elapsedHours}h</span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </>
 )}

 {/* Warning orders */}
 {warning.length > 0 && (
 <>
 <h2 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-2">
 <span className="w-2 h-2 bg-yellow-500/100/100 rounded-full" />
 Approaching SLA ({warning.length})
 </h2>
 <div className="bg-white/5 border border-yellow-500/20 overflow-hidden mb-6">
 <table className="w-full text-sm">
 <thead><tr className="bg-yellow-500/100/10/50 border-b border-yellow-500/10">
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Order Ref</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Supplier</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Items</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Status</th>
 <th className="text-right px-4 py-3 text-xs text-white/50 font-medium">Elapsed</th>
 </tr></thead>
 <tbody>
 {warning.map((o: any) => (
 <tr key={o._id} className="border-b border-white/5">
 <td className="px-4 py-3 font-mono text-xs text-white/60">{o.shopifyOrderRef || '-'}</td>
 <td className="px-4 py-3 text-white/80 font-medium">{o.supplierName || '-'}</td>
 <td className="px-4 py-3 text-white/50 text-xs">{o.items?.map((i: any) => i.productName).join(', ')}</td>
 <td className="px-4 py-3"><span className="px-2 py-0.5 text-[10px] font-bold bg-white/10 text-white/60 rounded-full uppercase">{o.status?.replace(/_/g, ' ')}</span></td>
 <td className="px-4 py-3 text-right">
 <span className="px-2 py-1 text-xs font-bold bg-yellow-500/100/20 text-yellow-400 ">{o.elapsedHours}h</span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </>
 )}

 {/* All clear */}
 {breached.length === 0 && warning.length === 0 && (
 <div className="bg-white/5 border-2 border-white/10 p-12 text-center">
 <div className="w-16 h-16 bg-green-500/100/10 rounded-full flex items-center justify-center mx-auto mb-4">
 <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
 </div>
 <h3 className="text-lg font-semibold text-white mb-1">All Clear!</h3>
 <p className="text-white/40">No SLA breaches or warnings at the moment.</p>
 </div>
 )}
 </div>
 );
}
