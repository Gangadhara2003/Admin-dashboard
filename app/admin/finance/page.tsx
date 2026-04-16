'use client';

import { useState, useEffect } from 'react';

function formatCurrency(val: number) {
 return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function AdminFinancePage() {
 const [data, setData] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const [period, setPeriod] = useState('daily');
 const [startDate, setStartDate] = useState('');
 const [endDate, setEndDate] = useState('');
 const [useCustomRange, setUseCustomRange] = useState(false);

 const fetchFinance = async () => {
 setLoading(true);
 try {
 let url = `/api/admin/finance?period=${period}`;
 if (useCustomRange && startDate) {
 url = `/api/admin/finance?startDate=${startDate}${endDate ? `&endDate=${endDate}` : ''}`;
 }
 const res = await fetch(url);
 setData(await res.json());
 } catch (err) { console.error(err); }
 finally { setLoading(false); }
 };

 useEffect(() => { fetchFinance(); }, [period, useCustomRange, startDate, endDate]);

 const kpis = data?.kpis;
 const suppliers = data?.supplierBreakdown || [];

 return (
 <div>
 <div className="flex items-start justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold text-white">Finance & Reconciliation</h1>
 <p className="text-sm text-white/50 mt-1">Revenue, payouts, and financial overview.</p>
 </div>
 <div className="flex items-center gap-3">
 {/* Period buttons */}
 <div className="flex gap-1 bg-white/10 p-1">
 {['daily', 'weekly', 'monthly'].map(p => (
 <button key={p} onClick={() => { setPeriod(p); setUseCustomRange(false); }}
 className={`px-3 py-1.5 text-xs font-medium transition-all border-none cursor-pointer capitalize ${!useCustomRange && period === p ? 'bg-white/5 text-accent ' : 'bg-transparent text-white/50'}`}>
 {p}
 </button>
 ))}
 <button onClick={() => setUseCustomRange(true)}
 className={`px-3 py-1.5 text-xs font-medium transition-all border-none cursor-pointer ${useCustomRange ? 'bg-white/5 text-accent ' : 'bg-transparent text-white/50'}`}>
 Custom
 </button>
 </div>
 {/* Date range inputs */}
 {useCustomRange && (
 <div className="flex items-center gap-2">
 <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
 className="px-2.5 py-1.5 border-2 border-white/10 text-xs focus:outline-none focus:border-accent transition-all" />
 <span className="text-xs text-white/40">to</span>
 <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
 className="px-2.5 py-1.5 border-2 border-white/10 text-xs focus:outline-none focus:border-accent transition-all" />
 </div>
 )}
 </div>
 </div>

 {loading ? (
 <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
 {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-white/5 border-2 border-white/10 animate-pulse" />)}
 </div>
 ) : (
 <>
 {/* KPI Cards */}
 <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
 <div className="bg-white/5 border-2 border-white/10 p-5 ">
 <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Orders</p>
 <p className="text-2xl font-bold text-white">{kpis?.totalOrders || 0}</p>
 <p className="text-xs text-white/40 mt-1">{kpis?.completedOrders || 0} completed</p>
 </div>
 <div className="bg-white/5 border-2 border-white/10 p-5 ">
 <p className="text-xs text-white/40 uppercase tracking-wider mb-1">GMV</p>
 <p className="text-2xl font-bold text-accent">{formatCurrency(kpis?.gmv || 0)}</p>
 <p className="text-xs text-white/40 mt-1">Gross merchandise value</p>
 </div>
 <div className="bg-white/5 border-2 border-white/10 p-5 ">
 <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Supplier Payouts</p>
 <p className="text-2xl font-bold text-green-400">{formatCurrency(kpis?.supplierPayouts || 0)}</p>
 <p className="text-xs text-white/40 mt-1">Already paid out</p>
 </div>
 <div className="bg-white/5 border-2 border-white/10 p-5 ">
 <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Pending Payouts</p>
 <p className="text-2xl font-bold text-yellow-400">{formatCurrency(kpis?.pendingPayouts || 0)}</p>
 <p className="text-xs text-white/40 mt-1">Awaiting settlement</p>
 </div>
 <div className="bg-white/5 border-2 border-white/10 p-5 ">
 <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Refunds</p>
 <p className="text-2xl font-bold text-red-400">{formatCurrency(kpis?.refunds || 0)}</p>
 <p className="text-xs text-white/40 mt-1">Total refunded</p>
 </div>
 </div>

 {/* Supplier Breakdown */}
 <div className="bg-white/5 border-2 border-white/10 overflow-hidden">
 <div className="px-6 py-4 border-b border-white/5">
 <h3 className="text-sm font-semibold text-white">Supplier-wise Breakdown</h3>
 </div>
 {suppliers.length === 0 ? (
 <div className="p-8 text-center text-white/40">No supplier data for this period.</div>
 ) : (
 <table className="w-full text-sm">
 <thead><tr className="bg-white/5 border-b border-white/10">
 <th className="text-left px-6 py-3 text-xs text-white/50 font-medium">Supplier</th>
 <th className="text-right px-6 py-3 text-xs text-white/50 font-medium">Orders</th>
 <th className="text-right px-6 py-3 text-xs text-white/50 font-medium">Total Amount</th>
 <th className="text-right px-6 py-3 text-xs text-white/50 font-medium">Paid</th>
 <th className="text-right px-6 py-3 text-xs text-white/50 font-medium">Pending</th>
 </tr></thead>
 <tbody>
 {suppliers.map((s: any) => (
 <tr key={s.supplierId} className="border-b border-white/5">
 <td className="px-6 py-3 font-medium text-white">{s.name}</td>
 <td className="px-6 py-3 text-right text-white/60">{s.orders}</td>
 <td className="px-6 py-3 text-right font-semibold text-white">{formatCurrency(s.amount)}</td>
 <td className="px-6 py-3 text-right text-green-400 font-medium">{formatCurrency(s.paid)}</td>
 <td className="px-6 py-3 text-right text-yellow-400 font-medium">{formatCurrency(s.amount - s.paid)}</td>
 </tr>
 ))}
 <tr className="bg-white/5 font-semibold">
 <td className="px-6 py-3 text-white">Total</td>
 <td className="px-6 py-3 text-right text-white">{suppliers.reduce((s: number, r: any) => s + r.orders, 0)}</td>
 <td className="px-6 py-3 text-right text-white">{formatCurrency(suppliers.reduce((s: number, r: any) => s + r.amount, 0))}</td>
 <td className="px-6 py-3 text-right text-green-400">{formatCurrency(suppliers.reduce((s: number, r: any) => s + r.paid, 0))}</td>
 <td className="px-6 py-3 text-right text-yellow-400">{formatCurrency(suppliers.reduce((s: number, r: any) => s + (r.amount - r.paid), 0))}</td>
 </tr>
 </tbody>
 </table>
 )}
 </div>
 </>
 )}
 </div>
 );
}
