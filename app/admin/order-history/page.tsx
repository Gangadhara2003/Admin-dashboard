'use client';

import { useState, useEffect } from 'react';

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', cancelled: 'Cancelled',
    delivery_boy_coming: 'Delivery Boy Coming', given_to_delivery: 'Given to Delivery', in_transit: 'In Transit', delivered: 'Delivered', completed: 'Completed',
};
const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-white/5 text-white/50 border-white/10', accepted: 'bg-green-500/100/10 text-green-400 border-green-500/10',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/10', cancelled: 'bg-red-500/10 text-red-400 border-red-200',
    delivery_boy_coming: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/10', given_to_delivery: 'bg-accent/10 text-accent border-accent/20', in_transit: 'bg-indigo-500/10 text-indigo-400 border-indigo-100',
    delivered: 'bg-green-500/100/10 text-green-400 border-green-500/20', completed: 'bg-purple-500/10 text-purple-400 border-purple-100',
};

export default function AdminOrderHistoryPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterSupplier, setFilterSupplier] = useState('all');
    const [searchRef, setSearchRef] = useState('');
    const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null);
    const [cancelModal, setCancelModal] = useState<any>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelling, setCancelling] = useState(false);
    // Delivery boy modal
    const [deliveryModal, setDeliveryModal] = useState<any>(null);
    const [deliveryName, setDeliveryName] = useState('');
    const [deliveryPhone, setDeliveryPhone] = useState('');
    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    // Bulk select
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const fetchOrders = async () => {
        try {
            const params = new URLSearchParams({ page: String(page), limit: '30' });
            if (filterStatus !== 'all') params.set('status', filterStatus);
            if (searchRef) params.set('search', searchRef);
            const res = await fetch('/api/supplier-orders?' + params.toString());
            const data = await res.json();
            setOrders(data.orders || []);
            setTotalPages(data.totalPages || 1);
            setTotal(data.total || 0);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchOrders(); }, [page, filterStatus, searchRef]);

    const handleUpdateStatus = async (orderId: string, action: string, extra?: any) => {
        try {
            const res = await fetch('/api/supplier-orders', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, action, changedBy: 'Admin', ...extra }),
            });
            if (res.ok) fetchOrders();
            else alert('Failed to update');
        } catch { alert('Error'); }
    };

    const handleCancel = async () => {
        if (!cancelModal) return;
        setCancelling(true);
        await handleUpdateStatus(cancelModal._id, 'cancel', { reason: cancelReason });
        setCancelModal(null);
        setCancelReason('');
        setCancelling(false);
    };

    const handleDeliverySubmit = async () => {
        if (!deliveryModal) return;
        await handleUpdateStatus(deliveryModal._id, 'delivery_boy_coming', {
            deliveryBoyName: deliveryName, deliveryBoyPhone: deliveryPhone,
        });
        setDeliveryModal(null);
        setDeliveryName('');
        setDeliveryPhone('');
    };

    // Bulk actions
    const handleBulkAction = async (action: string) => {
        if (selected.size === 0) return;
        if (!confirm(`Apply "${action}" to ${selected.size} order(s)?`)) return;
        for (const id of selected) {
            await handleUpdateStatus(id, action);
        }
        setSelected(new Set());
    };

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selected.size === orders.length) setSelected(new Set());
        else setSelected(new Set(orders.map(o => o._id)));
    };

    // CSV Export
    const exportCSV = () => {
        const headers = ['Supplier', 'Order Ref', 'Status', 'Items', 'Quoted Amount', 'Payment', 'Created', 'Delivery Boy'];
        const rows = orders.map(o => [
            o.supplierName || '', o.shopifyOrderRef || '', o.status,
            (o.items || []).map((i: any) => `${i.productName} x${i.quantity}`).join('; '),
            o.supplierReply?.totalAmount || '', o.paymentStatus || 'unpaid',
            new Date(o.createdAt).toLocaleDateString('en-IN'),
            o.deliveryBoyName ? `${o.deliveryBoyName} (${o.deliveryBoyPhone || ''})` : '',
        ]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `order-history-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    };

    const supplierNames = [...new Set(orders.map(o => o.supplierName).filter(Boolean))];
    const displayOrders = filterSupplier === 'all' ? orders : orders.filter(o => o.supplierName === filterSupplier);

    if (loading) {
        return (
            <div>
                <h1 className="text-2xl font-bold text-white mb-6">Order History by Supplier</h1>
                <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-white/5 border-2 border-white/10 animate-pulse" />)}</div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Order History by Supplier</h1>
                    <p className="text-sm text-white/50 mt-1">Complete history with editable statuses, timeline, and bulk actions.</p>
                </div>
                <button onClick={exportCSV} className="px-4 py-2 text-sm bg-white/10 text-white/80 font-medium hover:bg-white/10 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Export CSV
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white/5 border-2 border-white/10 p-4 mb-6 flex flex-wrap gap-3 items-center">
                <input type="text" placeholder="Search by order ref..." className="px-3 py-2 border-2 border-white/10 text-sm focus:outline-none focus:border-accent w-48"
                    value={searchRef} onChange={e => { setSearchRef(e.target.value); setPage(1); }} />
                <select className="px-3 py-2 border-2 border-white/10 text-sm bg-white/5" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
                    <option value="all">All Statuses</option>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select className="px-3 py-2 border-2 border-white/10 text-sm bg-white/5" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
                    <option value="all">All Suppliers</option>
                    {supplierNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="text-xs text-white/40 ml-auto">{total} total orders</span>
            </div>

            {/* Bulk toolbar */}
            {selected.size > 0 && (
                <div className="bg-accent/10 border border-accent/20 p-3 mb-4 flex items-center gap-3">
                    <span className="text-sm font-medium text-blue-700">{selected.size} selected</span>
                    <button onClick={() => handleBulkAction('in_transit')} className="px-3 py-1.5 text-xs bg-indigo-500/100 text-white font-medium">Mark In Transit</button>
                    <button onClick={() => handleBulkAction('delivered')} className="px-3 py-1.5 text-xs bg-green-500/100/100 text-white font-medium">Mark Delivered</button>
                    <button onClick={() => handleBulkAction('complete')} className="px-3 py-1.5 text-xs bg-purple-500/100 text-white font-medium">Mark Completed</button>
                    <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 text-xs bg-gray-200 text-white/60 font-medium ml-auto">Clear</button>
                </div>
            )}

            {/* Orders list */}
            {displayOrders.length === 0 ? (
                <div className="bg-white/5 border-2 border-white/10 p-12 text-center ">
                    <p className="text-white/40">No orders match your filters.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Select all */}
                    <div className="flex items-center gap-2 px-1">
                        <input type="checkbox" checked={selected.size === orders.length && orders.length > 0} onChange={toggleSelectAll} className="rounded" />
                        <span className="text-xs text-white/40">Select all</span>
                    </div>

                    {displayOrders.map((o: any) => (
                        <div key={o._id} className={`bg-white/5 border p-5 ${selected.has(o._id) ? 'border-blue-300 bg-accent/10/30' : 'border-white/10'}`}>
                            <div className="flex items-center gap-3 mb-3">
                                <input type="checkbox" checked={selected.has(o._id)} onChange={() => toggleSelect(o._id)} className="rounded" />
                                <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${STATUS_COLORS[o.status] || ''}`}>
                                    {STATUS_LABELS[o.status]}
                                </span>
                                <span className="text-sm font-medium text-white/80">{o.supplierName || 'Unknown Supplier'}</span>
                                {o.paymentStatus === 'paid' && <span className="px-2 py-0.5 text-[10px] bg-green-500/100/20 text-green-400 rounded-full font-bold">PAID</span>}
                                {o.paymentStatus !== 'paid' && o.supplierReply?.totalAmount && <span className="px-2 py-0.5 text-[10px] bg-red-500/10 text-red-400 rounded-full font-bold">UNPAID</span>}
                                <div className="ml-auto flex items-center gap-2">
                                    {/* Status dropdown */}
                                    <select className="text-xs px-2 py-1 border-2 border-white/10 bg-white/5 text-white/60"
                                        value={o.status} onChange={e => {
                                            const ns = e.target.value;
                                            if (ns === 'delivery_boy_coming') { setDeliveryModal(o); return; }
                                            if (ns === 'cancelled') { setCancelModal(o); return; }
                                            const map: Record<string, string> = { given_to_delivery: 'given_to_delivery', in_transit: 'in_transit', delivered: 'delivered', completed: 'complete' };
                                            if (map[ns]) handleUpdateStatus(o._id, map[ns]);
                                        }}>
                                        <option value="pending" disabled>Pending</option>
                                        <option value="accepted" disabled>Accepted</option>
                                        <option value="rejected" disabled>Rejected</option>
                                        <option value="delivery_boy_coming">Delivery Boy Coming</option>
                                        <option value="given_to_delivery">Given to Delivery</option>
                                        <option value="in_transit">In Transit</option>
                                        <option value="delivered">Delivered</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancel</option>
                                    </select>
                                    <div className="text-right">
                                        <p className="text-xs text-white/40">{new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        {o.shopifyOrderRef && <p className="text-[10px] text-white/40">Ref: {o.shopifyOrderRef}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Delivery boy info */}
                            {o.deliveryBoyName && (
                                <div className="bg-accent/10 px-3 py-2 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
                                    <span className="text-xs text-blue-700 font-medium">{o.deliveryBoyName}</span>
                                    {o.deliveryBoyPhone && <span className="text-xs text-accent">({o.deliveryBoyPhone})</span>}
                                </div>
                            )}

                            {/* Items */}
                            <div className="bg-white/5 p-3 mb-3">
                                {o.items?.map((item: any, i: number) => (
                                    <div key={i} className="flex justify-between py-1">
                                        <span className="text-sm text-white/80 font-medium">{item.productName}</span>
                                        <span className="text-sm text-white/50">× {item.quantity}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Actions row */}
                            <div className="flex items-center gap-4 text-sm flex-wrap">
                                {o.supplierReply?.totalAmount && <span className="text-white/50">Quoted: <strong className="text-white">₹{o.supplierReply.totalAmount.toLocaleString('en-IN')}</strong></span>}
                                {!['completed', 'cancelled', 'rejected'].includes(o.status) && (
                                    <button onClick={() => setCancelModal(o)} className="text-xs text-red-400 hover:underline">Cancel Order</button>
                                )}
                                <button onClick={() => setExpandedTimeline(expandedTimeline === o._id ? null : o._id)}
                                    className="text-xs text-accent hover:underline ml-auto">
                                    {expandedTimeline === o._id ? 'Hide Timeline' : 'View Timeline'}
                                </button>
                            </div>

                            {/* Timeline */}
                            {expandedTimeline === o._id && (
                                <div className="mt-3 border-t border-white/5 pt-3">
                                    {(o.timeline || []).length === 0 ? (
                                        <p className="text-xs text-white/40">No timeline entries recorded.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {(o.timeline || []).map((entry: any, i: number) => (
                                                <div key={i} className="flex items-start gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                                    <div>
                                                        <p className="text-xs text-white/80 font-medium">{STATUS_LABELS[entry.status] || entry.status}
                                                            <span className="text-white/40 font-normal ml-2">by {entry.changedBy}</span>
                                                        </p>
                                                        {entry.note && <p className="text-[10px] text-white/50">{entry.note}</p>}
                                                        <p className="text-[10px] text-white/40">{new Date(entry.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-sm bg-white/5 border-2 border-white/10 disabled:opacity-50">← Prev</button>
                    <span className="text-sm text-white/50">Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-sm bg-white/5 border-2 border-white/10 disabled:opacity-50">Next →</button>
                </div>
            )}

            {/* Cancel Modal */}
            {cancelModal && (
                <div className="fixed inset-0 bg-black flex items-center justify-center z-[1000]" onClick={() => !cancelling && setCancelModal(null)}>
                    <div className="w-full max-w-md bg-white/5 p-6" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold text-white mb-4">Cancel Order</h2>
                        <p className="text-sm text-white/50 mb-4">This will cancel the order for <strong>{cancelModal.supplierName}</strong> and restore product stock.</p>
                        <textarea className="w-full px-3 py-2 border-2 border-white/10 text-sm mb-4" rows={3}
                            placeholder="Reason for cancellation (optional)" value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setCancelModal(null)} className="px-4 py-2 bg-white/10 text-white/80 text-sm font-medium">Back</button>
                            <button onClick={handleCancel} disabled={cancelling} className="px-4 py-2 bg-red-500/100 text-white text-sm font-medium disabled:opacity-70">
                                {cancelling ? 'Cancelling...' : 'Cancel Order'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delivery Boy Modal */}
            {deliveryModal && (
                <div className="fixed inset-0 bg-black flex items-center justify-center z-[1000]" onClick={() => setDeliveryModal(null)}>
                    <div className="w-full max-w-md bg-white/5 p-6" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold text-white mb-4">Delivery Boy Information</h2>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block mb-1.5 text-sm text-white/50 font-medium">Delivery Boy Name</label>
                                <input type="text" className="w-full px-3 py-2.5 border-2 border-white/10 text-sm focus:outline-none focus:border-accent"
                                    value={deliveryName} onChange={e => setDeliveryName(e.target.value)} placeholder="Enter name" />
                            </div>
                            <div>
                                <label className="block mb-1.5 text-sm text-white/50 font-medium">Phone Number</label>
                                <input type="tel" className="w-full px-3 py-2.5 border-2 border-white/10 text-sm focus:outline-none focus:border-accent"
                                    value={deliveryPhone} onChange={e => setDeliveryPhone(e.target.value)} placeholder="Enter phone number" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDeliveryModal(null)} className="px-4 py-2 bg-white/10 text-white/80 text-sm font-medium">Cancel</button>
                            <button onClick={handleDeliverySubmit} className="px-4 py-2 bg-accent text-white text-sm font-medium">
                                Update to Delivery
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
