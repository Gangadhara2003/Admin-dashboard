'use client';

import React, { useState, useEffect } from 'react';

function formatCurrency(val: number) {
 return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatDate(d: string) {
 return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const statusColors: Record<string, string> = {
 pending: 'bg-yellow-500/100/10 text-yellow-400',
 accepted: 'bg-accent/10 text-accent',
 rejected: 'bg-red-500/10 text-red-400',
 cancelled: 'bg-white/10 text-white/50',
 delivered: 'bg-green-500/100/10 text-green-400',
 completed: 'bg-green-500/100/10 text-green-400',
};

export default function AdminGstRequestsPage() {
 const [orders, setOrders] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
 const [sendingGst, setSendingGst] = useState<string | null>(null);

 useEffect(() => {
 fetch('/api/supplier-orders?limit=500&gstRequested=true')
 .then(r => r.json())
 .then(data => setOrders(data.orders || []))
 .catch(() => {})
 .finally(() => setLoading(false));
 }, []);

 const handleGstSent = async (order: any) => {
 setSendingGst(order._id);
 try {
 await Promise.all([
 fetch('/api/notifications', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 type: 'order_response',
 title: 'GST Invoice Sent',
 message: `Your GST invoice for order ${order.shopifyOrderRef || order._id} has been sent to your email. Please check your inbox.`,
 to: order.supplierId?.toString() || order.supplierId,
 link: '/supplier/orders',
 }),
 }),
 fetch('/api/supplier-orders', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ orderId: order._id, action: 'mark_gst_sent', changedBy: 'Admin' }),
 }),
 ]);
 setOrders(prev => prev.map(o => o._id === order._id ? { ...o, gstInvoiceSent: true, gstInvoiceSentAt: new Date().toISOString() } : o));
 alert('Notification sent to supplier!');
 } catch {
 alert('Failed to send notification');
 } finally {
 setSendingGst(null);
 }
 };

 const gstRequests = orders;

 if (loading) {
 return (
 <div className="p-6 space-y-4">
 <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
 {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 animate-pulse" />)}
 </div>
 );
 }

 return (
 <div className="p-6">
 <div className="flex items-start justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold text-white">GST Invoice Requests</h1>
 <p className="text-sm text-white/40 mt-1">{gstRequests.length} request{gstRequests.length !== 1 ? 's' : ''} from suppliers</p>
 </div>
 <div className="bg-white/5 border-2 border-white/10 px-4 py-2 text-center">
 <p className="text-[10px] text-white/40 uppercase">Total Requests</p>
 <p className="text-lg font-bold text-accent">{gstRequests.length}</p>
 </div>
 </div>

 {gstRequests.length === 0 ? (
 <div className="bg-white/5 border-2 border-white/10 p-12 text-center ">
 <svg className="w-12 h-12 mx-auto text-white/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 <p className="text-white/40 text-lg">No GST invoice requests</p>
 </div>
 ) : (
 <div className="bg-white/5 border-2 border-white/10 overflow-hidden">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-white/5 border-b border-white/10">
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Supplier</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Order Ref</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Items</th>
 <th className="text-right px-4 py-3 text-xs text-white/50 font-medium">Amount</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Status</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Payment</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Requested On</th>
 <th className="text-center px-4 py-3 text-xs text-white/50 font-medium">Actions</th>
 </tr>
 </thead>
 <tbody>
 {gstRequests.map((o: any) => {
 const isExpanded = expandedOrder === o._id;
 return (
 <React.Fragment key={o._id}>
 <tr className="border-b border-white/5 cursor-pointer hover:bg-white/5/50" onClick={() => setExpandedOrder(isExpanded ? null : o._id)}>
 <td className="px-4 py-3 font-medium text-white">{o.supplierName || 'Unknown'}</td>
 <td className="px-4 py-3 text-xs font-mono text-white/50">{o.shopifyOrderRef || o._id.slice(-6)}</td>
 <td className="px-4 py-3 text-xs text-white/60">{o.items?.map((i: any) => i.productName).join(', ')}</td>
 <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(o.supplierReply?.totalAmount || 0)}</td>
 <td className="px-4 py-3">
 <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${statusColors[o.status] || 'bg-white/10 text-white/50'}`}>
 {o.status.replace(/_/g, ' ')}
 </span>
 </td>
 <td className="px-4 py-3">
 <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${o.paymentStatus === 'paid' ? 'bg-green-500/100/10 text-green-400' : 'bg-yellow-500/100/10 text-yellow-400'}`}>
 {o.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
 </span>
 </td>
 <td className="px-4 py-3 text-xs text-white/40">{o.gstInvoiceRequestedAt ? formatDate(o.gstInvoiceRequestedAt) : '—'}</td>
 <td className="px-4 py-3 text-center">
 <button
 onClick={(e) => { e.stopPropagation(); handleGstSent(o); }}
 disabled={sendingGst === o._id}
 className="px-3 py-1.5 bg-green-500/100/100 text-white text-xs font-medium hover:bg-green-500/100/30 disabled:opacity-60 transition-all"
 >
 {sendingGst === o._id ? 'Sending...' : o.gstInvoiceSent ? 'Send Again' : 'Send'}
 </button>
 </td>
 </tr>
 {isExpanded && (
 <tr>
 <td colSpan={8} className="bg-gray-50/80 px-6 py-5 border-b border-white/10">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {/* Items */}
 <div>
 <h4 className="text-xs font-semibold text-white/50 uppercase mb-2">Order Items</h4>
 <div className="space-y-1.5">
 {o.items?.map((item: any, idx: number) => (
 <div key={idx} className="flex justify-between bg-white/5 px-3 py-2 border-2 border-white/5">
 <span className="text-sm text-white/80">{item.productName}</span>
 <span className="text-sm font-medium text-white/50">×{item.quantity}</span>
 </div>
 ))}
 </div>
 </div>

 {/* Supplier Quote & Payment */}
 <div className="space-y-4">
 <div>
 <h4 className="text-xs font-semibold text-white/50 uppercase mb-2">Supplier Quote</h4>
 <div className="bg-white/5 px-3 py-2 border-2 border-white/5">
 <p className="text-lg font-bold text-white">{formatCurrency(o.supplierReply?.totalAmount || 0)}</p>
 {o.supplierReply?.note && <p className="text-xs text-white/40 mt-1">{o.supplierReply.note}</p>}
 </div>
 </div>
 <div>
 <h4 className="text-xs font-semibold text-white/50 uppercase mb-2">Payment Info</h4>
 <div className="bg-white/5 px-3 py-2 border-2 border-white/5 space-y-1">
 <div className="flex items-center gap-2">
 <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${o.paymentStatus === 'paid' ? 'bg-green-500/100/10 text-green-400' : 'bg-yellow-500/100/10 text-yellow-400'}`}>
 {o.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
 </span>
 {o.paidAt && <span className="text-xs text-white/40">{formatDate(o.paidAt)}</span>}
 </div>
 {o.paidAmount != null && <p className="text-sm text-white/60">Amount: {formatCurrency(o.paidAmount)}</p>}
 {o.paymentRefNumber && (
 <p className="text-xs text-white/50">
 {o.paymentRefType === 'utr' ? 'UTR' : 'Txn ID'}: <span className="font-mono">{o.paymentRefNumber}</span>
 </p>
 )}
 </div>
 </div>
 </div>

 {/* Timeline */}
 <div>
 <h4 className="text-xs font-semibold text-white/50 uppercase mb-2">Timeline</h4>
 <div className="bg-white/5 border-2 border-white/5 max-h-48 overflow-y-auto">
 {o.timeline && o.timeline.length > 0 ? (
 <div className="divide-y divide-gray-50">
 {[...o.timeline].reverse().map((t: any, idx: number) => (
 <div key={idx} className="px-3 py-2">
 <div className="flex items-center gap-2">
 <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
 <span className="text-xs font-medium text-white/80 capitalize">{t.status?.replace(/_/g, ' ')}</span>
 </div>
 {t.note && <p className="text-[11px] text-white/40 ml-3.5 mt-0.5">{t.note}</p>}
 <p className="text-[10px] text-white/30 ml-3.5">{t.timestamp ? formatDate(t.timestamp) : ''}</p>
 </div>
 ))}
 </div>
 ) : (
 <p className="px-3 py-2 text-xs text-white/40">No timeline entries</p>
 )}
 </div>
 </div>
 </div>

 {/* Order meta */}
 <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/40">
 {o.shopifyOrderRef && <span>Shopify Ref: <span className="font-mono text-white/50">{o.shopifyOrderRef}</span></span>}
 {o.deliveryBoyName && <span>Delivery: {o.deliveryBoyName} {o.deliveryBoyPhone ? `(${o.deliveryBoyPhone})` : ''}</span>}
 <span>Order ID: <span className="font-mono text-white/50">{o._id}</span></span>
 </div>
 </td>
 </tr>
 )}
 </React.Fragment>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </div>
 );
}
