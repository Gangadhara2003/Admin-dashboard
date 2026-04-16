'use client';

import { useState, useEffect, useRef } from 'react';

const STATUS_LABELS: Record<string, string> = {
 pending: 'Pending',
 accepted: 'Accepted',
 rejected: 'Rejected',
 delivery_boy_coming: 'Delivery Boy Coming',
 given_to_delivery: 'Given to Delivery',
 in_transit: 'In Transit',
 delivered: 'Delivered',
 completed: 'Completed',
};
const STATUS_COLORS: Record<string, string> = {
 pending: 'bg-white/5 text-white/50 border-white/10',
 accepted: 'bg-green-500/100/10 text-green-400 border-green-500/10',
 rejected: 'bg-red-500/10 text-red-400 border-red-500/10',
 delivery_boy_coming: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/10',
 given_to_delivery: 'bg-accent/10 text-accent border-accent/20',
 in_transit: 'bg-indigo-500/10 text-indigo-400 border-indigo-100',
 delivered: 'bg-green-500/100/10 text-green-400 border-green-500/20',
 completed: 'bg-purple-500/10 text-purple-400 border-purple-100',
};

export default function AdminOrderAcceptancePage() {
 const [orders, setOrders] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState('accepted');
 const activeTabRef = useRef(activeTab);

 useEffect(() => {
 activeTabRef.current = activeTab;
 }, [activeTab]);

 const fetchOrders = async (showLoading = true) => {
 if (showLoading) setLoading(true);
 try {
 const res = await fetch('/api/supplier-orders');
 const data = await res.json();
 const fetchedOrders = data.orders || [];
 setOrders(fetchedOrders);
 
 // Auto-select the first tab that has orders if the "accepted" tab is empty
 if (fetchedOrders.length > 0) {
 const hasAccepted = fetchedOrders.some((o: any) => o.status === 'accepted');
 if (!hasAccepted && activeTabRef.current === 'accepted') {
 const statuses = ['delivery_boy_coming', 'given_to_delivery', 'in_transit', 'delivered', 'rejected', 'completed'];
 for (const st of statuses) {
 if (fetchedOrders.some((o: any) => o.status === st)) {
 setActiveTab(st);
 break;
 }
 }
 }
 }
 } catch (err) { console.error(err); }
 finally { if (showLoading) setLoading(false); }
 };

 useEffect(() => {
 fetchOrders(true);
 const interval = setInterval(() => fetchOrders(false), 15000);
 return () => clearInterval(interval);
 }, []);

 const handleUpdateStatus = async (orderId: string, action: string) => {
 try {
 const res = await fetch('/api/supplier-orders', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ orderId, action }),
 });
 if (res.ok) fetchOrders();
 else alert('Failed to update');
 } catch { alert('Error'); }
 };

 const tabs = [
 { key: 'accepted', label: 'Accepted', count: orders.filter(o => o.status === 'accepted').length },
 { key: 'delivery_boy_coming', label: 'Delivery Boy Coming', count: orders.filter(o => o.status === 'delivery_boy_coming').length },
 { key: 'given_to_delivery', label: 'Given to Delivery', count: orders.filter(o => o.status === 'given_to_delivery').length },
 { key: 'in_transit', label: 'In Transit', count: orders.filter(o => o.status === 'in_transit').length },
 { key: 'delivered', label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length },
 { key: 'rejected', label: 'Rejected', count: orders.filter(o => o.status === 'rejected').length },
 { key: 'completed', label: 'Completed', count: orders.filter(o => o.status === 'completed').length },
 ];

 const filtered = orders.filter(o => o.status === activeTab);

 // Analytics
 const totalAccepted = orders.filter(o => !['pending', 'rejected'].includes(o.status)).length;
 const totalValue = orders
 .filter(o => !['pending', 'rejected'].includes(o.status))
 .reduce((sum, o) => sum + (o.supplierReply?.totalAmount || 0), 0);
 const deliveredCount = orders.filter(o => o.status === 'delivered' || o.status === 'completed').length;
 const inProgressCount = orders.filter(o => ['accepted', 'delivery_boy_coming', 'given_to_delivery', 'in_transit'].includes(o.status)).length;

 if (loading) {
 return (
 <div>
 <h1 className="text-2xl font-bold text-white mb-6">Supplier Order Responses</h1>
 <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-white/5 border-2 border-white/10 animate-pulse" />)}</div>
 </div>
 );
 }

 return (
 <div>
 <div className="flex items-start justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold text-white">Supplier Order Responses</h1>
 <p className="text-sm text-white/50 mt-1">Track all supplier order responses, delivery progress, and completion.</p>
 </div>
 {inProgressCount > 0 && (
 <a href="/admin/deliveries" className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 text-sm font-medium hover:bg-indigo-500/20 transition-colors no-underline">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
 Deliveries Board ({inProgressCount})
 </a>
 )}
 </div>

 {/* KPI Cards */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 <div className="bg-white/5 border-2 border-white/10 p-5 ">
 <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Accepted</p>
 <p className="text-2xl font-bold text-accent">{totalAccepted}</p>
 </div>
 <div className="bg-white/5 border-2 border-white/10 p-5 ">
 <p className="text-xs text-white/40 uppercase tracking-wider mb-1">In Progress</p>
 <p className="text-2xl font-bold text-yellow-400">{inProgressCount}</p>
 </div>
 <div className="bg-white/5 border-2 border-white/10 p-5 ">
 <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Delivered</p>
 <p className="text-2xl font-bold text-green-400">{deliveredCount}</p>
 </div>
 <div className="bg-white/5 border-2 border-white/10 p-5 ">
 <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Value</p>
 <p className="text-2xl font-bold text-indigo-400">₹{totalValue.toLocaleString('en-IN')}</p>
 </div>
 </div>

 {/* Tabs */}
 <div className="flex gap-1 bg-white/10 p-1 mb-6 overflow-x-auto">
 {tabs.map(t => (
 <button key={t.key} onClick={() => setActiveTab(t.key)}
 className={`px-3 py-2 text-sm font-medium transition-all whitespace-nowrap ${
 activeTab === t.key ? 'bg-white/5 text-accent ' : 'text-white/50 hover:text-white/80'
 }`}>
 {t.label} <span className="ml-1 text-xs opacity-60">({t.count})</span>
 </button>
 ))}
 </div>

 {/* Order List */}
 {filtered.length === 0 ? (
 <div className="bg-white/5 border-2 border-white/10 p-12 text-center ">
 <p className="text-white/40">No orders with status &ldquo;{STATUS_LABELS[activeTab]}&rdquo;.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {filtered.map((o: any) => (
 <div key={o._id} className="bg-white/5 border-2 border-white/10 p-5 ">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-3">
 <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${STATUS_COLORS[o.status] || ''}`}>
 {STATUS_LABELS[o.status]}
 </span>
 <span className="text-sm font-medium text-white/80">{o.supplierName || 'Unknown Supplier'}</span>
 </div>
 <div className="flex items-center gap-3">
 {/* Editable status dropdown */}
 <select
 className="text-xs px-2 py-1 border-2 border-white/10 bg-white/5 text-white/60 focus:outline-none focus:border-accent"
 value={o.status}
 onChange={e => {
 const newStatus = e.target.value;
 if (newStatus !== o.status) {
 const actionMap: Record<string, string> = {
 delivery_boy_coming: 'delivery_boy_coming',
 given_to_delivery: 'given_to_delivery',
 in_transit: 'in_transit',
 delivered: 'delivered',
 completed: 'complete',
 };
 if (actionMap[newStatus]) handleUpdateStatus(o._id, actionMap[newStatus]);
 }
 }}
 >
 <option value="pending" disabled>Pending</option>
 <option value="accepted" disabled>Accepted</option>
 <option value="rejected" disabled>Rejected</option>
 <option value="delivery_boy_coming">Delivery Boy Coming</option>
 <option value="given_to_delivery">Given to Delivery</option>
 <option value="in_transit">In Transit</option>
 <option value="delivered">Delivered</option>
 <option value="completed">Completed</option>
 </select>
 <div className="text-right">
 <p className="text-xs text-white/40">{new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
 {o.shopifyOrderRef && <p className="text-[10px] text-white/40">Ref: {o.shopifyOrderRef}</p>}
 </div>
 </div>
 </div>

 {/* Items */}
 <div className="bg-white/5 p-3 mb-3">
 {o.items?.map((item: any, i: number) => (
 <div key={i} className="flex justify-between py-1">
 <span className="text-sm text-white/80 font-medium">{item.productName}</span>
 <span className="text-sm text-white/50">× {item.quantity}</span>
 </div>
 ))}
 </div>

 {/* Supplier reply details */}
 <div className="flex items-center gap-4 text-sm">
 {o.supplierReply?.totalAmount && (
 <span className="text-white/50">Quoted: <strong className="text-white">₹{o.supplierReply.totalAmount.toLocaleString('en-IN')}</strong></span>
 )}
 {o.supplierReply?.note && (
 <span className="text-white/40 text-xs">Note: {o.supplierReply.note}</span>
 )}
 {o.respondedAt && (
 <span className="text-xs text-white/40">Responded: {new Date(o.respondedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
 )}
 </div>

 {/* Delivery timestamps */}
 {(o.deliveryUpdatedAt || o.deliveredAt) && (
 <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
 {o.deliveryUpdatedAt && <span>Last delivery update: {new Date(o.deliveryUpdatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
 {o.deliveredAt && <span>Delivered: {new Date(o.deliveredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
 </div>
 )}

 {/* Admin actions — status progression */}
 {o.status === 'accepted' && (
 <div className="mt-3 pt-3 border-t border-white/5">
 <button onClick={() => handleUpdateStatus(o._id, 'delivery_boy_coming')}
 className="px-4 py-2 text-sm bg-cyan-500/10 text-cyan-400 font-medium hover:bg-cyan-100 transition-colors">
 🚚 Notify Delivery Boy Coming
 </button>
 </div>
 )}
 {o.status === 'given_to_delivery' && (
 <div className="mt-3 pt-3 border-t border-white/5">
 <button onClick={() => handleUpdateStatus(o._id, 'in_transit')}
 className="px-4 py-2 text-sm bg-indigo-500/10 text-indigo-400 font-medium hover:bg-indigo-500/20 transition-colors">
 🚚 Mark In Transit
 </button>
 </div>
 )}
 {o.status === 'in_transit' && (
 <div className="mt-3 pt-3 border-t border-white/5">
 <button onClick={() => handleUpdateStatus(o._id, 'delivered')}
 className="px-4 py-2 text-sm bg-green-500/100/10 text-green-400 font-medium hover:bg-green-500/100/20 transition-colors">
 ✅ Mark as Delivered
 </button>
 </div>
 )}
 {o.status === 'delivered' && (
 <div className="mt-3 pt-3 border-t border-white/5">
 <button onClick={() => handleUpdateStatus(o._id, 'complete')}
 className="px-4 py-2 text-sm bg-purple-500/10 text-purple-400 font-medium hover:bg-purple-100 transition-colors">
 ✓ Mark as Complete
 </button>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
