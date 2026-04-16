'use client';

import { useState, useEffect } from 'react';

interface Order {
 _id: string;
 shopifyOrderRef?: string;
 supplierName?: string;
 supplierId?: string;
 items: { productName: string; quantity: number }[];
 status: string;
 customerFeedback?: string;
 supplierReply?: { totalAmount?: number; note?: string };
 paymentStatus?: string;
 paidAmount?: number;
 createdAt: string;
}

const statusColors: Record<string, string> = {
 pending: 'bg-yellow-500/100/10 text-yellow-400',
 accepted: 'bg-accent/10 text-accent',
 rejected: 'bg-red-500/10 text-red-400',
 cancelled: 'bg-white/10 text-white/50',
 delivery_boy_coming: 'bg-indigo-500/10 text-indigo-400',
 given_to_delivery: 'bg-indigo-500/10 text-indigo-400',
 in_transit: 'bg-purple-500/10 text-purple-400',
 delivered: 'bg-green-500/100/10 text-green-400',
 completed: 'bg-green-500/100/10 text-green-400',
};

function formatStatus(s: string) {
 return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(d: string) {
 return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminFeedbackPage() {
 const [orders, setOrders] = useState<Order[]>([]);
 const [loading, setLoading] = useState(true);
 const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
 const [search, setSearch] = useState('');
 const [filterSupplier, setFilterSupplier] = useState('all');

 useEffect(() => {
 fetch('/api/supplier-orders?limit=500')
 .then(r => r.json())
 .then(data => setOrders(data.orders || []))
 .catch(() => {})
 .finally(() => setLoading(false));
 }, []);

 // Only orders with customerFeedback filled by admin
 const withFeedback = orders.filter(o => o.customerFeedback?.trim());

 const suppliers = Array.from(new Set(withFeedback.map(o => o.supplierName || 'Unknown'))).sort();

 const filtered = withFeedback.filter(o => {
 if (filterSupplier !== 'all' && (o.supplierName || 'Unknown') !== filterSupplier) return false;
 if (search.length < 2) return true;
 const q = search.toLowerCase();
 return (o.shopifyOrderRef || '').toLowerCase().includes(q)
 || (o.supplierName || '').toLowerCase().includes(q)
 || o.items.some(i => i.productName.toLowerCase().includes(q))
 || (o.customerFeedback || '').toLowerCase().includes(q);
 });

 // Group by supplier
 const bySupplier: Record<string, Order[]> = {};
 filtered.forEach(o => {
 const name = o.supplierName || 'Unknown';
 if (!bySupplier[name]) bySupplier[name] = [];
 bySupplier[name].push(o);
 });

 if (loading) {
 return (
 <div className="p-6 space-y-4">
 <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
 {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-200 animate-pulse" />)}
 </div>
 );
 }

 return (
 <div className="p-6">
 <div className="flex items-start justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold text-white">Supplier Feedback</h1>
 <p className="text-sm text-white/40 mt-1">Customer feedback sent to suppliers across {filtered.length} order{filtered.length !== 1 ? 's' : ''}</p>
 </div>
 <div className="flex gap-3">
 <div className="bg-white/5 border-2 border-white/10 px-4 py-2 text-center">
 <p className="text-[10px] text-white/40 uppercase">Feedback Sent</p>
 <p className="text-lg font-bold text-accent">{withFeedback.length}</p>
 </div>
 <div className="bg-white/5 border-2 border-white/10 px-4 py-2 text-center">
 <p className="text-[10px] text-white/40 uppercase">Suppliers</p>
 <p className="text-lg font-bold text-purple-400">{suppliers.length}</p>
 </div>
 </div>
 </div>

 {/* Filters */}
 <div className="flex gap-3 mb-6">
 <input
 type="text"
 placeholder="Search by order, supplier, product, or feedback..."
 value={search}
 onChange={e => setSearch(e.target.value)}
 className="flex-1 max-w-md px-4 py-2.5 border-2 border-white/10 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-blue-100 transition-all"
 />
 <select
 value={filterSupplier}
 onChange={e => setFilterSupplier(e.target.value)}
 className="px-4 py-2.5 border-2 border-white/10 text-sm focus:outline-none focus:border-accent transition-all"
 >
 <option value="all">All Suppliers</option>
 {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
 </select>
 </div>

 {filtered.length === 0 ? (
 <div className="bg-white/5 border-2 border-white/10 p-12 text-center ">
 <svg className="w-12 h-12 mx-auto text-white/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
 </svg>
 <p className="text-white/40 text-lg">No feedback sent yet</p>
 </div>
 ) : (
 <div className="space-y-8">
 {Object.entries(bySupplier).map(([supplierName, supplierOrders]) => (
 <div key={supplierName}>
 {/* Supplier header */}
 <div className="flex items-center gap-2 mb-3">
 <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-[10px] font-bold shrink-0">
 {supplierName.charAt(0).toUpperCase()}
 </div>
 <span className="text-sm font-semibold text-white/80">{supplierName}</span>
 <span className="text-[10px] text-white/40 bg-white/10 px-2 py-0.5 rounded-full">
 {supplierOrders.length} feedback{supplierOrders.length > 1 ? 's' : ''}
 </span>
 </div>

 <div className="space-y-3">
 {supplierOrders.map(order => {
 const isExpanded = expandedOrder === order._id;
 const itemsSummary = order.items.map(i => `${i.productName} x${i.quantity}`).join(', ');

 return (
 <div key={order._id} className="bg-white/5 border-2 border-white/10 overflow-hidden">
 {/* Header */}
 <div
 className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/5/50 transition-colors"
 onClick={() => setExpandedOrder(isExpanded ? null : order._id)}
 >
 <div className="w-10 h-10 bg-accent/10 flex items-center justify-center shrink-0">
 <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
 </svg>
 </div>

 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 {order.shopifyOrderRef && (
 <span className="text-sm font-bold text-white">#{order.shopifyOrderRef}</span>
 )}
 <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${statusColors[order.status] || 'bg-white/10 text-white/50'}`}>
 {formatStatus(order.status)}
 </span>
 </div>
 <p className="text-xs text-white/50 mt-0.5 truncate">{itemsSummary}</p>
 <p className="text-xs text-white/40 mt-1 truncate italic">&ldquo;{order.customerFeedback}&rdquo;</p>
 </div>

 <div className="flex items-center gap-3 shrink-0">
 <span className="text-[10px] text-white/40">{formatDate(order.createdAt)}</span>
 <svg className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </div>
 </div>

 {/* Expanded */}
 {isExpanded && (
 <div className="border-t border-white/5">
 {/* Customer Feedback */}
 <div className="px-5 py-4">
 <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-2">Customer Feedback</p>
 <div className="bg-accent/10 border border-accent/20 p-4">
 <p className="text-sm text-white/80 leading-relaxed">{order.customerFeedback}</p>
 </div>
 </div>

 {/* Order details */}
 <div className="px-5 py-4 border-t border-white/5 bg-gray-50/50">
 <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-3">Order Details</p>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
 <div className="bg-white/5 p-3 border-2 border-white/5">
 <p className="text-[10px] text-white/40 uppercase">Order</p>
 <p className="text-sm font-semibold text-white mt-0.5">#{order.shopifyOrderRef || '—'}</p>
 </div>
 <div className="bg-white/5 p-3 border-2 border-white/5">
 <p className="text-[10px] text-white/40 uppercase">Status</p>
 <p className="text-sm font-semibold text-white mt-0.5">{formatStatus(order.status)}</p>
 </div>
 {order.supplierReply?.totalAmount && (
 <div className="bg-white/5 p-3 border-2 border-white/5">
 <p className="text-[10px] text-white/40 uppercase">Supplier Quote</p>
 <p className="text-sm font-semibold text-white mt-0.5">₹{order.supplierReply.totalAmount}</p>
 </div>
 )}
 <div className="bg-white/5 p-3 border-2 border-white/5">
 <p className="text-[10px] text-white/40 uppercase">Payment</p>
 <p className={`text-sm font-semibold mt-0.5 ${order.paymentStatus === 'paid' ? 'text-green-400' : 'text-yellow-400'}`}>
 {order.paymentStatus === 'paid' ? `Paid ₹${order.paidAmount || ''}` : 'Unpaid'}
 </p>
 </div>
 </div>
 <div className="space-y-1">
 {order.items.map((item, i) => (
 <div key={i} className="flex justify-between text-xs bg-white/5 rounded px-3 py-1.5 border-2 border-white/5">
 <span className="text-white/80">{item.productName}</span>
 <span className="text-white/50 font-medium">x{item.quantity}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
