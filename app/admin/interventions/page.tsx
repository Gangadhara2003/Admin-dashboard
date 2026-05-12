'use client';

import { useState, useEffect } from 'react';

function formatCurrency(val: number) {
    return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function AdminInterventionsPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Action modals
    const [actionOrder, setActionOrder] = useState<any>(null);
    const [actionType, setActionType] = useState('');
    const [actionReason, setActionReason] = useState('');
    const [newSupplierId, setNewSupplierId] = useState('');
    const [customerFeedback, setCustomerFeedback] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [actionMsg, setActionMsg] = useState('');

    const fetchData = async () => {
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (statusFilter) params.set('status', statusFilter);
            params.set('limit', '100');

            const [orderRes, supplierRes] = await Promise.all([
                fetch(`/api/supplier-orders?${params}`),
                fetch('/api/admin/suppliers'),
            ]);
            const orderData = await orderRes.json();
            const supplierData = await supplierRes.json();
            setOrders(orderData.orders || []);
            setSuppliers(supplierData.suppliers || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [statusFilter]);

    const handleSearch = () => { setLoading(true); fetchData(); };

    const handleAction = async () => {
        if (!actionOrder || !actionType) return;
        setActionLoading(true);
        setActionMsg('');
        try {
            const body: any = { orderId: actionOrder._id, action: actionType, reason: actionReason };
            if (actionType === 'reassign_supplier') body.newSupplierId = newSupplierId;
            if (actionType === 'send_customer_feedback') body.feedback = customerFeedback;

            const res = await fetch('/api/admin/interventions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setActionMsg('Action completed successfully.');
                setActionOrder(null);
                setActionType('');
                setActionReason('');
                fetchData();
            } else {
                const d = await res.json();
                setActionMsg(d.error || 'Failed.');
            }
        } catch { setActionMsg('Error.'); }
        finally { setActionLoading(false); setTimeout(() => setActionMsg(''), 5000); }
    };

    // Cancel with reason
    const handleCancel = async (orderId: string, reason: string) => {
        try {
            await fetch('/api/supplier-orders', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, action: 'cancel', reason, changedBy: 'Admin' }),
            });
            fetchData();
        } catch { }
    };

    const statusColors: Record<string, string> = {
        pending: 'bg-yellow-500/100/10 text-yellow-400',
        accepted: 'bg-accent/10 text-accent',
        rejected: 'bg-red-500/10 text-red-400',
        cancelled: 'bg-white/10 text-white/50',
        delivery_boy_coming: 'bg-indigo-500/10 text-indigo-400',
        given_to_delivery: 'bg-purple-500/10 text-purple-400',
        in_transit: 'bg-cyan-500/10 text-cyan-400',
        delivered: 'bg-green-500/100/10 text-green-400',
        completed: 'bg-green-500/100/10 text-green-400',
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white">Interventions</h1>
                <p className="text-sm text-white/50 mt-1">Search orders, reassign suppliers, send feedback, and manage escalations.</p>
            </div>

            {actionMsg && (
                <div className={`p-3 text-sm mb-4 ${actionMsg.includes('success') ? 'bg-green-500/100/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{actionMsg}</div>
            )}

            {/* Search & Filter */}
            <div className="flex gap-3 mb-6">
                <div className="flex-1 relative">
                    <input
                        className="w-full pl-9 pr-3 py-2.5 bg-white/5 border-2 border-white/10 text-sm focus:outline-none focus:border-accent"
                        value={search} onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Search by order ref, supplier name..."
                    />
                    <svg className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <select className="px-3 py-2.5 bg-white/5 border-2 border-white/10 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="delivery_boy_coming">Delivery Boy Coming</option>
                    <option value="in_transit">In Transit</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <button onClick={handleSearch} className="px-4 py-2.5 bg-accent text-white text-sm font-medium hover:bg-accent/80 transition-all">Search</button>
            </div>

            {loading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-white/5 border-2 border-white/10 animate-pulse" />)}</div>
            ) : orders.length === 0 ? (
                <div className="bg-white/5 border-2 border-white/10 p-12 text-center text-white/40">No orders found.</div>
            ) : (
                <div className="space-y-3">
                    {orders.map((o: any) => (
                        <div key={o._id} className="bg-white/5 border-2 border-white/10 p-5 ">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-mono text-white/40">{o.shopifyOrderRef || o._id?.slice(-6)}</span>
                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${statusColors[o.status] || 'bg-white/10 text-white/50'}`}>
                                            {o.status?.replace(/_/g, ' ')}
                                        </span>
                                        {o.slaStatus === 'breached' && <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-700 rounded-full">SLA BREACHED</span>}
                                    </div>
                                    <p className="text-sm text-white/80 font-medium">{o.supplierName || '-'}</p>
                                    <p className="text-xs text-white/40 mt-0.5">{o.items?.map((i: any) => `${i.productName} ×${i.quantity}`).join(', ')}</p>
                                    {o.supplierReply?.totalAmount && <p className="text-xs text-white/50 mt-1">Amount: <span className="font-semibold">{formatCurrency(o.supplierReply.totalAmount)}</span></p>}
                                    {o.customerFeedback && <p className="text-xs text-accent mt-1 bg-accent/10 px-2 py-1 rounded inline-block">📝 {o.customerFeedback}</p>}
                                </div>
                                <div className="flex flex-wrap gap-1.5 shrink-0 ml-4">
                                    <button onClick={() => { setActionOrder(o); setActionType('reassign_supplier'); }}
                                        className="px-3 py-1.5 text-[10px] bg-purple-500/10 text-purple-400 font-medium hover:bg-purple-100 border border-purple-100 transition-all">
                                        🔄 Reassign
                                    </button>
                                    <button onClick={() => { setActionOrder(o); setActionType('send_customer_feedback'); setCustomerFeedback(''); }}
                                        className="px-3 py-1.5 text-[10px] bg-accent/10 text-accent font-medium hover:bg-accent/20 border border-accent/20 transition-all">
                                        {o.customerFeedback ? '📝 Send Feedback Again' : '📝 Send Feedback'}
                                    </button>
                                    <button onClick={() => { setActionOrder(o); setActionType('request_refund'); }}
                                        className="px-3 py-1.5 text-[10px] bg-yellow-500/100/10 text-yellow-400 font-medium hover:bg-yellow-500/100/20 border border-yellow-500/10 transition-all">
                                        💰 Refund
                                    </button>
                                    {!['cancelled', 'delivered', 'completed'].includes(o.status) && (
                                        <button onClick={() => {
                                            const reason = prompt('Cancel reason:');
                                            if (reason !== null) handleCancel(o._id, reason);
                                        }} className="px-3 py-1.5 text-[10px] bg-red-500/10 text-red-400 font-medium hover:bg-red-500/100/20 border border-red-500/10 transition-all">
                                            ✕ Cancel
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Escalation log */}
                            {o.escalationLog?.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-white/5">
                                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Escalation Log</p>
                                    <div className="space-y-1">
                                        {o.escalationLog.map((e: any, i: number) => (
                                            <div key={i} className="flex items-center gap-2 text-xs text-white/50">
                                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                                                <span className="font-medium capitalize">{e.action?.replace(/_/g, ' ')}</span>
                                                {e.reason && <><span className="text-white/30">—</span><span>{e.reason}</span></>}
                                                <span className="text-white/30">•</span>
                                                <span>{new Date(e.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Action Modal */}
            {actionOrder && actionType && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]" onClick={() => !actionLoading && setActionOrder(null)}>
                    <div className="w-full max-w-md bg-white/5 border-2 border-white/10 p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-white capitalize">{actionType.replace(/_/g, ' ')}</h3>
                            <button onClick={() => setActionOrder(null)} className="text-white/40 hover:text-white/60 text-xl bg-transparent border-none cursor-pointer">×</button>
                        </div>
                        <p className="text-xs text-white/40 mb-4">Order: {actionOrder.shopifyOrderRef || actionOrder._id?.slice(-8)} • {actionOrder.supplierName}</p>

                        {actionType === 'reassign_supplier' && (
                            <div className="mb-4">
                                <label className="block mb-1.5 text-sm text-white/50 font-medium">New Supplier *</label>
                                <select className="w-full px-3 py-2.5 bg-white/5 border-2 border-white/10 text-sm" value={newSupplierId} onChange={e => setNewSupplierId(e.target.value)}>
                                    <option value="">Select supplier...</option>
                                    {suppliers.filter((s: any) => s._id !== actionOrder.supplierId?.toString()).map((s: any) => (
                                        <option key={s._id} value={s._id}>{s.name} ({s.businessName})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {actionType === 'send_customer_feedback' && (
                            <div className="mb-4">
                                <label className="block mb-1.5 text-sm text-white/50 font-medium">Customer Feedback *</label>
                                <textarea className="w-full px-3 py-2.5 bg-white/5 border-2 border-white/10 text-sm" rows={3} value={customerFeedback} onChange={e => setCustomerFeedback(e.target.value)} placeholder="Enter customer feedback to share with supplier..." />
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block mb-1.5 text-sm text-white/50 font-medium">
                                {actionType === 'send_customer_feedback' ? 'Internal Note (optional)' : 'Reason'}
                            </label>
                            <textarea className="w-full px-3 py-2.5 bg-white/5 border-2 border-white/10 text-sm" rows={2} value={actionReason} onChange={e => setActionReason(e.target.value)} placeholder="Enter reason..." />
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setActionOrder(null)} className="flex-1 px-4 py-2.5 bg-white/10 text-white/80 text-sm font-medium hover:bg-white/10">Cancel</button>
                            <button onClick={handleAction} disabled={actionLoading || (actionType === 'reassign_supplier' && !newSupplierId) || (actionType === 'send_customer_feedback' && !customerFeedback)}
                                className="flex-1 px-4 py-2.5 bg-accent text-white text-sm font-medium shadow hover:bg-accent/80 disabled:opacity-70 transition-all">
                                {actionLoading ? 'Processing...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
