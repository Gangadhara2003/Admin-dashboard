'use client';

import { useState, useEffect, useMemo } from 'react';
import StatusBadge from '../../../components/StatusBadge';
import KPICard from '../../../components/KPICard';
import Modal from '../../../components/Modal';

function formatCurrency(val: number) {
 return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const ACTIVE_STATUSES = ['delivery_boy_coming', 'given_to_delivery', 'in_transit'];
const ALL_DELIVERY_STATUSES = ['accepted', 'delivery_boy_coming', 'given_to_delivery', 'in_transit', 'delivered', 'completed'];

export default function AdminDeliveriesPage() {
 const [supplierOrders, setSupplierOrders] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState('active');
 const [selectedOrder, setSelectedOrder] = useState<any>(null);
 const [actionLoading, setActionLoading] = useState<string | null>(null);

 // Assign delivery boy modal
 const [assignModal, setAssignModal] = useState<any>(null);
 const [deliveryBoyName, setDeliveryBoyName] = useState('');
 const [deliveryBoyPhone, setDeliveryBoyPhone] = useState('');

 // Failed modal
 const [failModal, setFailModal] = useState<any>(null);
 const [failReason, setFailReason] = useState('');

 const fetchData = async () => {
 try {
 const res = await fetch('/api/supplier-orders?limit=500');
 const data = await res.json();
 setSupplierOrders(data.orders || []);
 } catch (err) { console.error(err); }
 finally { setLoading(false); }
 };

 useEffect(() => {
 fetchData();
 const interval = setInterval(fetchData, 15000);
 return () => clearInterval(interval);
 }, []);

 // Quick actions
 const handleAction = async (orderId: string, action: string, extra?: Record<string, any>) => {
 setActionLoading(orderId);
 try {
 const res = await fetch('/api/supplier-orders', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ orderId, action, changedBy: 'Admin', ...extra }),
 });
 if (res.ok) {
 await fetchData();
 setSelectedOrder(null);
 } else {
 const d = await res.json();
 alert(d.error || 'Action failed');
 }
 } catch { alert('Error performing action'); }
 finally { setActionLoading(null); }
 };

 const handleAssignDeliveryBoy = async () => {
 if (!assignModal || !deliveryBoyName.trim()) return;
 await handleAction(assignModal._id, 'delivery_boy_coming', {
 deliveryBoyName: deliveryBoyName.trim(),
 deliveryBoyPhone: deliveryBoyPhone.trim(),
 });
 setAssignModal(null);
 setDeliveryBoyName('');
 setDeliveryBoyPhone('');
 };

 const handleMarkFailed = async () => {
 if (!failModal) return;
 await handleAction(failModal._id, 'cancel', {
 reason: failReason.trim() || 'Delivery failed',
 });
 setFailModal(null);
 setFailReason('');
 };

 const statusLabel = (s: string) => {
 const map: Record<string, string> = {
 pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', cancelled: 'Cancelled',
 delivery_boy_coming: 'Delivery Boy Coming', given_to_delivery: 'Given to Delivery',
 in_transit: 'In Transit', delivered: 'Delivered', completed: 'Completed',
 };
 return map[s] || s.replace(/_/g, ' ');
 };

 // Tab filtering
 const filtered = useMemo(() => {
 if (activeTab === 'active') return supplierOrders.filter(o => ACTIVE_STATUSES.includes(o.status));
 if (activeTab === 'all') return supplierOrders.filter(o => ALL_DELIVERY_STATUSES.includes(o.status));
 return supplierOrders.filter(o => o.status === activeTab);
 }, [supplierOrders, activeTab]);

 const countByStatus = (status: string) => supplierOrders.filter(o => o.status === status).length;
 const activeCount = supplierOrders.filter(o => ACTIVE_STATUSES.includes(o.status)).length;

 const tabs = [
 { key: 'active', label: 'Active', count: activeCount },
 { key: 'all', label: 'All', count: supplierOrders.filter(o => ALL_DELIVERY_STATUSES.includes(o.status)).length },
 { key: 'accepted', label: 'Ready', count: countByStatus('accepted') },
 { key: 'delivery_boy_coming', label: 'Boy Coming', count: countByStatus('delivery_boy_coming') },
 { key: 'given_to_delivery', label: 'Given', count: countByStatus('given_to_delivery') },
 { key: 'in_transit', label: 'In Transit', count: countByStatus('in_transit') },
 { key: 'delivered', label: 'Delivered', count: countByStatus('delivered') },
 ];

 // SLA color
 const slaColor = (sla: string) => {
 if (sla === 'breached') return 'bg-red-500/20 text-red-700 border-red-200';
 if (sla === 'warning') return 'bg-yellow-500/100/20 text-yellow-400 border-yellow-500/20';
 return 'bg-green-500/100/20 text-green-400 border-green-500/20';
 };

 // Get inline action for an order
 const getQuickActions = (order: any) => {
 const actions: { label: string; action: string; color: string; onClick: () => void }[] = [];
 if (order.status === 'accepted') {
 actions.push({
 label: 'Assign Delivery Boy',
 action: 'assign',
 color: 'bg-cyan-500/100 hover:bg-cyan-600',
 onClick: () => { setAssignModal(order); setDeliveryBoyName(''); setDeliveryBoyPhone(''); },
 });
 }
 if (order.status === 'given_to_delivery') {
 actions.push({
 label: 'Mark Picked Up',
 action: 'in_transit',
 color: 'bg-indigo-500/100 hover:bg-indigo-500/30',
 onClick: () => handleAction(order._id, 'in_transit'),
 });
 }
 if (order.status === 'in_transit') {
 actions.push({
 label: 'Mark Delivered',
 action: 'delivered',
 color: 'bg-green-500/100/100 hover:bg-green-500/100/30',
 onClick: () => handleAction(order._id, 'delivered'),
 });
 }
 if (['delivery_boy_coming', 'given_to_delivery', 'in_transit'].includes(order.status)) {
 actions.push({
 label: 'Mark Failed',
 action: 'fail',
 color: 'bg-red-500/100 hover:bg-red-500/30',
 onClick: () => { setFailModal(order); setFailReason(''); },
 });
 }
 return actions;
 };

 // Time since assigned
 const timeSince = (dateStr: string) => {
 if (!dateStr) return '—';
 const diff = Date.now() - new Date(dateStr).getTime();
 const m = Math.floor(diff / 60000);
 if (m < 1) return 'Just now';
 if (m < 60) return `${m}m ago`;
 const h = Math.floor(m / 60);
 if (h < 24) return `${h}h ago`;
 return `${Math.floor(h / 24)}d ago`;
 };

 // Last timeline entry
 const lastTimeline = (order: any) => {
 if (!order.timeline || order.timeline.length === 0) return null;
 return order.timeline[order.timeline.length - 1];
 };

 // Compute SLA client-side: warning if active order > 2h since assignedAt, breached if > 4h
 const SLA_WARNING_MS = 2 * 60 * 60 * 1000; // 2 hours
 const SLA_BREACH_MS = 4 * 60 * 60 * 1000; // 4 hours
 const now = Date.now();
 const computeSla = (order: any) => {
 if (!ACTIVE_STATUSES.includes(order.status)) return 'on_track';
 const age = now - new Date(order.assignedAt || order.createdAt).getTime();
 if (age >= SLA_BREACH_MS) return 'breached';
 if (age >= SLA_WARNING_MS) return 'warning';
 return 'on_track';
 };

 const slaBreachedCount = supplierOrders.filter(o => computeSla(o) === 'breached').length;
 const todayStr = new Date().toDateString();
 const deliveredTodayCount = supplierOrders.filter(o =>
 (o.status === 'delivered' || o.status === 'completed') &&
 o.deliveredAt && new Date(o.deliveredAt).toDateString() === todayStr
 ).length;
 const readyCount = countByStatus('accepted');

 const kpiData = [
 { title: 'Ready for Pickup', value: readyCount, color: 'blue' as const },
 { title: 'Active Deliveries', value: activeCount, color: 'amber' as const },
 { title: 'Boy Coming', value: countByStatus('delivery_boy_coming'), color: 'indigo' as const },
 { title: 'In Transit', value: countByStatus('given_to_delivery') + countByStatus('in_transit'), color: 'purple' as const },
 { title: 'Delivered Today', value: deliveredTodayCount, color: 'emerald' as const },
 { title: 'SLA Breached', value: slaBreachedCount, color: 'red' as const },
 ];

 if (loading) {
 return (
 <div>
 <h1 className="text-2xl font-bold text-white mb-6">Deliveries Control Board</h1>
 <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
 {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 bg-white/5 border-2 border-white/10 animate-pulse" />)}
 </div>
 <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-white/5 border-2 border-white/10 animate-pulse" />)}</div>
 </div>
 );
 }

 return (
 <div>
 <div className="flex items-start justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold text-white">Deliveries Control Board</h1>
 <p className="text-sm text-white/50 mt-1">Internal operations — track active deliveries, assign riders, update statuses.</p>
 </div>
 <div className="flex items-center gap-2">
 <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
 <span className="text-xs text-white/40">Auto-refreshing every 15s</span>
 </div>
 </div>

 {/* KPI Cards */}
 <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
 {kpiData.map((k, i) => <KPICard key={i} {...k} />)}
 </div>

 {/* Tabs */}
 <div className="flex gap-1 bg-white/10 p-1 mb-5 overflow-x-auto">
 {tabs.map(t => (
 <button key={t.key} onClick={() => setActiveTab(t.key)}
 className={`px-3 py-2 text-xs font-medium transition-all whitespace-nowrap border-none cursor-pointer ${
 activeTab === t.key ? 'bg-white/5 text-accent ' : 'bg-transparent text-white/50 hover:text-white/80'
 }`}>
 {t.label}
 <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
 activeTab === t.key ? 'bg-accent/20 text-accent' : 'bg-gray-200 text-white/50'
 }`}>{t.count}</span>
 </button>
 ))}
 </div>

 {/* Order Cards */}
 {filtered.length === 0 ? (
 <div className="bg-white/5 border-2 border-white/10 p-12 text-center">
 <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
 <p className="text-white/40">No deliveries in this view.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {filtered.map((order: any) => {
 const actions = getQuickActions(order);
 const tl = lastTimeline(order);
 return (
 <div key={order._id}
 className={`bg-white/5 border p-4 transition-all hover: cursor-pointer ${
 computeSla(order) === 'breached' ? 'border-red-200 bg-red-500/10/30' : computeSla(order) === 'warning' ? 'border-yellow-500/20 bg-yellow-500/100/10/20' : 'border-white/10'
 }`}
 onClick={() => setSelectedOrder(order)}
 >
 <div className="flex items-start justify-between gap-4">
 {/* Left: Order info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3 mb-2">
 <span className="font-bold text-accent text-sm">{order.shopifyOrderRef || order._id.slice(-8)}</span>
 <StatusBadge status={statusLabel(order.status)} />
 {computeSla(order) !== 'on_track' && (
 <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${slaColor(computeSla(order))}`}>
 SLA {computeSla(order) === 'breached' ? 'BREACHED' : 'WARNING'}
 </span>
 )}
 {order.paymentStatus === 'paid' && (
 <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-500/100/20 text-green-400 border border-green-500/20">PAID</span>
 )}
 </div>

 <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-white/50">
 <span>Supplier: <span className="font-medium text-white/80">{order.supplierName || 'Unknown'}</span></span>
 <span>Items: <span className="font-medium text-white/80">{order.items?.length || 0}</span></span>
 {order.supplierReply?.totalAmount > 0 && (
 <span>Amount: <span className="font-medium text-white/80">{formatCurrency(order.supplierReply.totalAmount)}</span></span>
 )}
 {(order.deliveryBoyName || order.deliveryBoyPhone) && (
 <span>Rider: <span className="font-medium text-white/80">{order.deliveryBoyName || '—'}{order.deliveryBoyPhone ? ` (${order.deliveryBoyPhone})` : ''}</span></span>
 )}
 <span>Assigned: <span className="font-medium text-white/80">{timeSince(order.assignedAt)}</span></span>
 </div>

 {/* Last timeline entry */}
 {tl && (
 <div className="mt-2 flex items-center gap-2 text-[11px] text-white/40">
 <span className="w-1 h-1 rounded-full bg-blue-400" />
 <span className="capitalize">{tl.status?.replace(/_/g, ' ')}</span>
 {tl.note && <span className="text-white/30">— {tl.note}</span>}
 <span>{tl.timestamp ? timeSince(tl.timestamp) : ''}</span>
 </div>
 )}
 </div>

 {/* Right: Quick actions */}
 <div className="flex flex-col gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
 {actions.map(a => (
 <button key={a.action}
 onClick={a.onClick}
 disabled={actionLoading === order._id}
 className={`px-3 py-1.5 text-xs text-white font-medium transition-all disabled:opacity-60 border-none cursor-pointer ${a.color}`}>
 {actionLoading === order._id ? '...' : a.label}
 </button>
 ))}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}

 {/* Detail Modal */}
 {selectedOrder && (
 <Modal isOpen={true} onClose={() => setSelectedOrder(null)} title={`Order — ${selectedOrder.shopifyOrderRef || selectedOrder._id.slice(-8)}`} size="xl">
 <div>
 {/* Summary */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
 <div className="bg-white/5 p-3 border-2 border-white/5">
 <p className="text-white/40 text-xs">Status</p>
 <StatusBadge status={statusLabel(selectedOrder.status)} />
 </div>
 <div className="bg-white/5 p-3 border-2 border-white/5">
 <p className="text-white/40 text-xs">Amount</p>
 <p className="font-bold text-white">{formatCurrency(selectedOrder.supplierReply?.totalAmount || 0)}</p>
 </div>
 <div className="bg-white/5 p-3 border-2 border-white/5">
 <p className="text-white/40 text-xs">Payment</p>
 <StatusBadge status={(selectedOrder.paymentStatus || 'unpaid').charAt(0).toUpperCase() + (selectedOrder.paymentStatus || 'unpaid').slice(1)} />
 </div>
 <div className="bg-white/5 p-3 border-2 border-white/5">
 <p className="text-white/40 text-xs">SLA</p>
 <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${slaColor(computeSla(selectedOrder))}`}>
 {computeSla(selectedOrder).replace(/_/g, ' ').toUpperCase()}
 </span>
 </div>
 </div>

 {/* Supplier */}
 <div className="bg-purple-500/10 p-4 mb-5 border border-purple-100">
 <p className="text-xs font-semibold text-purple-400 mb-2">Supplier</p>
 <p className="text-sm font-medium text-purple-800">{selectedOrder.supplierName || '—'}</p>
 {selectedOrder.supplierReply?.note && <p className="text-xs text-purple-500 mt-1">{selectedOrder.supplierReply.note}</p>}
 </div>

 {/* Delivery Boy */}
 {(selectedOrder.deliveryBoyName || selectedOrder.deliveryBoyPhone) && (
 <div className="bg-cyan-500/10 p-4 mb-5 border border-cyan-500/10">
 <p className="text-xs font-semibold text-cyan-400 mb-2">Delivery Person</p>
 <div className="grid grid-cols-2 gap-3 text-sm">
 <div>
 <p className="text-cyan-400 text-xs">Name</p>
 <p className="font-medium text-cyan-800">{selectedOrder.deliveryBoyName || '—'}</p>
 </div>
 <div>
 <p className="text-cyan-400 text-xs">Phone</p>
 <p className="font-medium text-cyan-800">{selectedOrder.deliveryBoyPhone || '—'}</p>
 </div>
 </div>
 </div>
 )}

 {/* Items */}
 <div className="mb-5">
 <p className="text-xs font-semibold text-white/60 mb-2">{selectedOrder.items?.length || 0} Item(s)</p>
 <div className="bg-white/5 border-2 border-white/10 divide-y divide-gray-100">
 {(selectedOrder.items || []).map((item: any, i: number) => (
 <div key={i} className="flex items-center justify-between px-4 py-3">
 <p className="text-sm font-medium text-white">{item.productName}</p>
 <p className="text-sm text-white/60">x{item.quantity}</p>
 </div>
 ))}
 {selectedOrder.supplierReply?.totalAmount > 0 && (
 <div className="flex items-center justify-between px-4 py-3 bg-white/5">
 <p className="text-sm font-bold text-white">Total</p>
 <p className="text-sm font-bold text-white">{formatCurrency(selectedOrder.supplierReply.totalAmount)}</p>
 </div>
 )}
 </div>
 </div>

 {/* Payment */}
 {selectedOrder.paymentStatus === 'paid' && (
 <div className="bg-green-500/100/10 p-3 mb-5 border border-green-500/10">
 <p className="text-xs font-semibold text-green-400 mb-1">Payment Details</p>
 <div className="text-sm text-emerald-800 space-y-0.5">
 {selectedOrder.paidAmount != null && <p>Amount: {formatCurrency(selectedOrder.paidAmount)}</p>}
 {selectedOrder.paidAt && <p>Paid on: {new Date(selectedOrder.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
 {selectedOrder.paymentRefNumber && <p>{selectedOrder.paymentRefType === 'utr' ? 'UTR' : 'Txn ID'}: <span className="font-mono">{selectedOrder.paymentRefNumber}</span></p>}
 </div>
 </div>
 )}

 {/* Delivered At */}
 {selectedOrder.deliveredAt && (
 <div className="bg-green-500/100/10 p-3 mb-5 border border-green-500/10">
 <p className="text-xs font-semibold text-green-400 mb-1">Delivered</p>
 <p className="text-sm text-emerald-800">
 {new Date(selectedOrder.deliveredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
 </p>
 </div>
 )}

 {/* SLA */}
 {computeSla(selectedOrder) !== 'on_track' && (
 <div className={` p-3 mb-5 border ${computeSla(selectedOrder) === 'breached' ? 'bg-red-500/10 border-red-500/10' : 'bg-yellow-500/100/10 border-yellow-500/10'}`}>
 <p className={`text-xs font-semibold mb-1 ${computeSla(selectedOrder) === 'breached' ? 'text-red-700' : 'text-yellow-400'}`}>
 SLA {computeSla(selectedOrder) === 'breached' ? 'Breached' : 'Warning'}
 </p>
 <p className={`text-sm ${computeSla(selectedOrder) === 'breached' ? 'text-red-400' : 'text-yellow-400'}`}>
 Assigned: {timeSince(selectedOrder.assignedAt || selectedOrder.createdAt)}
 </p>
 </div>
 )}

 {/* Escalation Log */}
 {selectedOrder.escalationLog && selectedOrder.escalationLog.length > 0 && (
 <div className="bg-orange-500/10 p-3 mb-5 border border-orange-100">
 <p className="text-xs font-semibold text-orange-700 mb-2">Escalation Log</p>
 <div className="space-y-1.5">
 {selectedOrder.escalationLog.map((e: any, i: number) => (
 <div key={i} className="text-xs text-orange-800">
 <span className="font-medium capitalize">{e.action?.replace(/_/g, ' ')}</span>
 {e.reason && <span className="text-orange-400"> — {e.reason}</span>}
 <span className="text-orange-400 ml-2">{e.timestamp ? timeSince(e.timestamp) : ''}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Timeline */}
 {selectedOrder.timeline && selectedOrder.timeline.length > 0 && (
 <div>
 <p className="text-xs font-semibold text-white/60 mb-2">Timeline</p>
 <div className="bg-white/5 border-2 border-white/10 max-h-48 overflow-y-auto divide-y divide-gray-50">
 {[...selectedOrder.timeline].reverse().map((t: any, idx: number) => (
 <div key={idx} className="px-4 py-2">
 <div className="flex items-center gap-2">
 <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
 <span className="text-xs font-medium text-white/80 capitalize">{t.status?.replace(/_/g, ' ')}</span>
 {t.changedBy && <span className="text-[10px] text-white/40">by {t.changedBy}</span>}
 <span className="text-[10px] text-white/40 ml-auto">
 {t.timestamp ? new Date(t.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
 </span>
 </div>
 {t.note && <p className="text-[11px] text-white/40 ml-3.5 mt-0.5">{t.note}</p>}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Quick Actions in Modal */}
 <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap gap-2">
 {getQuickActions(selectedOrder).map(a => (
 <button key={a.action}
 onClick={() => { a.onClick(); if (a.action !== 'assign' && a.action !== 'fail') setSelectedOrder(null); }}
 disabled={actionLoading === selectedOrder._id}
 className={`px-4 py-2 text-sm text-white font-medium transition-all disabled:opacity-60 border-none cursor-pointer ${a.color}`}>
 {actionLoading === selectedOrder._id ? 'Processing...' : a.label}
 </button>
 ))}
 </div>
 </div>
 </Modal>
 )}

 {/* Assign Delivery Boy Modal */}
 {assignModal && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]" onClick={() => setAssignModal(null)}>
 <div className="w-full max-w-md bg-white/5 border-2 border-white/10 p-6" onClick={e => e.stopPropagation()}>
 <h2 className="text-lg font-semibold text-white mb-1">Assign Delivery Boy</h2>
 <p className="text-xs text-white/40 mb-4">Order: {assignModal.shopifyOrderRef || assignModal._id.slice(-8)} — {assignModal.supplierName}</p>
 <div className="space-y-3 mb-5">
 <div>
 <label className="block mb-1 text-sm text-white/50 font-medium">Name *</label>
 <input type="text" placeholder="Delivery person name"
 className="w-full px-3 py-2.5 bg-white/5 border-2 border-white/10 text-sm focus:outline-none focus:border-accent "
 value={deliveryBoyName} onChange={e => setDeliveryBoyName(e.target.value)} />
 </div>
 <div>
 <label className="block mb-1 text-sm text-white/50 font-medium">Phone</label>
 <input type="tel" placeholder="Phone number (optional)"
 className="w-full px-3 py-2.5 bg-white/5 border-2 border-white/10 text-sm focus:outline-none focus:border-accent "
 value={deliveryBoyPhone} onChange={e => setDeliveryBoyPhone(e.target.value)} />
 </div>
 </div>
 <div className="flex justify-end gap-2">
 <button onClick={() => setAssignModal(null)} className="px-4 py-2.5 bg-white/10 text-white/80 text-sm font-medium hover:bg-white/10 border-none cursor-pointer">Cancel</button>
 <button onClick={handleAssignDeliveryBoy} disabled={!deliveryBoyName.trim() || actionLoading === assignModal._id}
 className="px-4 py-2.5 bg-cyan-500/100 text-white text-sm font-medium shadow hover:bg-cyan-600 disabled:opacity-70 border-none cursor-pointer">
 {actionLoading === assignModal._id ? 'Assigning...' : 'Assign & Notify Supplier'}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Mark Failed Modal */}
 {failModal && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]" onClick={() => setFailModal(null)}>
 <div className="w-full max-w-md bg-white/5 border-2 border-white/10 p-6" onClick={e => e.stopPropagation()}>
 <h2 className="text-lg font-semibold text-red-400 mb-1">Mark Delivery as Failed</h2>
 <p className="text-xs text-white/40 mb-4">Order: {failModal.shopifyOrderRef || failModal._id.slice(-8)} — {failModal.supplierName}</p>
 <div className="mb-5">
 <label className="block mb-1 text-sm text-white/50 font-medium">Reason</label>
 <textarea placeholder="Why did this delivery fail? (optional)"
 className="w-full px-3 py-2.5 bg-white/5 border-2 border-white/10 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
 rows={3} value={failReason} onChange={e => setFailReason(e.target.value)} />
 </div>
 <div className="flex justify-end gap-2">
 <button onClick={() => setFailModal(null)} className="px-4 py-2.5 bg-white/10 text-white/80 text-sm font-medium hover:bg-white/10 border-none cursor-pointer">Cancel</button>
 <button onClick={handleMarkFailed} disabled={actionLoading === failModal._id}
 className="px-4 py-2.5 bg-red-500/100 text-white text-sm font-medium shadow hover:bg-red-500/30 disabled:opacity-70 border-none cursor-pointer">
 {actionLoading === failModal._id ? 'Processing...' : 'Confirm Failed'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
