'use client';

import { useState, useEffect } from 'react';
import KPICard from '../../../components/KPICard';

function formatCurrency(val: number) {
 return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function AdminReportsPage() {
 const [analytics, setAnalytics] = useState<any>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 async function fetchData() {
 try {
 const res = await fetch('/api/shopify/analytics');
 setAnalytics(await res.json());
 } catch (err) { console.error(err); }
 finally { setLoading(false); }
 }
 fetchData();
 }, []);

 const kpis = analytics?.kpis;

 if (loading) {
 return (
 <div>
 <h1 className="text-2xl font-bold text-white mb-6">Reports</h1>
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="bg-white/5 border-2 border-white/10 p-5 animate-pulse"><div className="h-4 bg-white/10 rounded w-2/3 mb-2" /><div className="h-6 bg-white/10 rounded w-1/2" /></div>
 ))}
 </div>
 </div>
 );
 }

 const summaryCards = kpis ? [
 { title: 'Total Orders', value: kpis.totalOrders, color: 'blue' as const },
 { title: 'Total Revenue', value: formatCurrency(kpis.totalRevenue), color: 'emerald' as const },
 { title: 'Products', value: kpis.productCount, color: 'indigo' as const },
 { title: 'Customers', value: kpis.customerCount, color: 'purple' as const },
 { title: 'Monthly Revenue', value: formatCurrency(kpis.monthlyRevenue), color: 'blue' as const },
 { title: 'Weekly Revenue', value: formatCurrency(kpis.weeklyRevenue), color: 'emerald' as const },
 { title: 'Fulfilled', value: kpis.fulfilledOrders, color: 'emerald' as const },
 { title: 'Cancelled', value: kpis.cancelledOrders, color: 'red' as const },
 ] : [];

 const dailyRevenue = analytics?.dailyRevenue || [];
 const maxRev = Math.max(...dailyRevenue.map((d: any) => d.revenue), 1);

 return (
 <div>
 <div className="mb-6">
 <h1 className="text-2xl font-bold text-white">Reports</h1>
 <p className="text-sm text-white/50 mt-1">Business intelligence from Shopify data.</p>
 </div>

 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 {summaryCards.map((k, i) => <KPICard key={i} {...k} />)}
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
 {/* Daily Revenue */}
 <div className="bg-white/5 border-2 border-white/10 p-5 ">
 <h3 className="text-sm font-semibold text-white mb-4">Daily Revenue (Last 7 Days)</h3>
 <div className="h-40 flex items-end justify-center gap-2">
 {dailyRevenue.map((d: any, i: number) => (
 <div key={i} className="flex flex-col items-center gap-1 flex-1">
 <span className="text-[9px] text-white/50">{formatCurrency(d.revenue)}</span>
 <div className="w-full max-w-[32px] bg-accent rounded-t" style={{ height: `${Math.max(4, (d.revenue / maxRev) * 120)}px` }} />
 <span className="text-[10px] text-white/40">{new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' })}</span>
 </div>
 ))}
 </div>
 </div>

 {/* Top Products */}
 <div className="bg-white/5 border-2 border-white/10 p-5 ">
 <h3 className="text-sm font-semibold text-white mb-4">Top Products by Revenue</h3>
 <div className="space-y-3">
 {(analytics?.topProducts || []).slice(0, 8).map((p: any, i: number) => (
 <div key={i} className="flex items-center justify-between">
 <div className="flex items-center gap-2 min-w-0">
 <span className="text-xs text-white/40 w-4">{i + 1}.</span>
 <span className="text-sm text-white/80 truncate">{p.title}</span>
 </div>
 <div className="flex items-center gap-3 shrink-0">
 <span className="text-xs text-white/40">{p.qty} sold</span>
 <span className="text-sm font-bold text-white">{formatCurrency(p.revenue)}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 );
}
