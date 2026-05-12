'use client';

import { useState, useEffect } from 'react';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import KPICard from '../../../components/KPICard';

function formatCurrency(val: number) {
    return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const RETURN_STATUS_COLORS: Record<string, string> = {
    requested: 'bg-yellow-500/100/10 text-yellow-400', approved: 'bg-green-500/100/10 text-green-400',
    picked_up: 'bg-accent/10 text-accent', refunded: 'bg-purple-500/10 text-purple-400', disputed: 'bg-red-500/10 text-red-400',
};

export default function AdminReturnsPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [supplierReturns, setSupplierReturns] = useState<any[]>([]);
    const [supplierOrders, setSupplierOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'supplier' | 'shopify'>('supplier');
    // Create return modal
    const [returnModal, setReturnModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState('');
    const [returnReason, setReturnReason] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const [ordersRes, returnsRes, soRes] = await Promise.all([
                    fetch('/api/shopify/orders?limit=250'),
                    fetch('/api/supplier-returns'),
                    fetch('/api/supplier-orders?limit=500'),
                ]);
                const all = (await ordersRes.json()).orders || [];
                setOrders(all.filter((o: any) => o.financial_status === 'refunded' || o.financial_status === 'partially_refunded' || o.cancelled_at));
                setSupplierReturns((await returnsRes.json()).returns || []);
                setSupplierOrders((await soRes.json()).orders || []);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        }
        fetchData();
    }, []);

    const handleCreateReturn = async () => {
        if (!selectedOrder || !returnReason) return;
        setCreating(true);
        try {
            const res = await fetch('/api/supplier-returns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: selectedOrder, reason: returnReason }),
            });
            if (res.ok) {
                const data = await res.json();
                setSupplierReturns(prev => [data.return, ...prev]);
                setReturnModal(false);
                setSelectedOrder('');
                setReturnReason('');
            } else alert('Failed to create return');
        } catch { alert('Error'); }
        finally { setCreating(false); }
    };

    const handleUpdateReturn = async (returnId: string, action: string, note?: string) => {
        try {
            const res = await fetch('/api/supplier-returns', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ returnId, action, adminNote: note }),
            });
            if (res.ok) {
                const data = await res.json();
                setSupplierReturns(prev => prev.map(r => r._id === returnId ? data.return : r));
            }
        } catch { alert('Error'); }
    };

    // Shopify returns
    const refunded = orders.filter(o => o.financial_status === 'refunded');
    const partialRefund = orders.filter(o => o.financial_status === 'partially_refunded');
    const cancelled = orders.filter(o => o.cancelled_at && o.financial_status !== 'refunded');
    const totalRefundAmount = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);

    const shopifyKpis = [
        { title: 'Full Refunds', value: refunded.length, color: 'red' as const },
        { title: 'Partial Refunds', value: partialRefund.length, color: 'amber' as const },
        { title: 'Cancelled', value: cancelled.length, color: 'blue' as const },
        { title: 'Total Value', value: formatCurrency(totalRefundAmount), color: 'purple' as const },
    ];

    const shopifyTableData = orders.map((o: any) => ({
        order: o.name || `#${o.id}`,
        customer: o.customer ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim() || 'Guest' : 'Guest',
        amount: formatCurrency(parseFloat(o.total_price || 0)),
        reason: o.cancel_reason || 'N/A',
        status: o.financial_status === 'refunded' ? 'Refunded' : o.financial_status === 'partially_refunded' ? 'Partial Refund' : 'Cancelled',
        date: new Date(o.cancelled_at || o.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    }));

    const shopifyColumns = [
        { key: 'order', label: 'Order', render: (val: string) => <span className="font-semibold text-accent">{val}</span> },
        { key: 'customer', label: 'Customer' },
        { key: 'amount', label: 'Amount' },
        { key: 'reason', label: 'Reason' },
        { key: 'date', label: 'Date' },
        { key: 'status', label: 'Status', render: (val: string) => <StatusBadge status={val} /> },
    ];

    // Eligible supplier orders for returns
    const eligibleOrders = supplierOrders.filter(o => ['delivered', 'completed'].includes(o.status));

    return (
        <div>
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Returns & Refunds</h1>
                    <p className="text-sm text-white/50 mt-1">Manage Shopify and supplier returns.</p>
                </div>
                <div className="flex items-center gap-2">
                    {activeTab === 'supplier' && (
                        <button onClick={() => setReturnModal(true)} className="px-4 py-2 text-sm bg-red-500/10 text-red-400 font-medium hover:bg-red-500/100/20">
                            + Create Return
                        </button>
                    )}
                    <div className="flex items-center gap-1 bg-white/10 p-1">
                        <button onClick={() => setActiveTab('supplier')} className={`px-4 py-2 text-sm font-medium transition-all ${activeTab === 'supplier' ? 'bg-white/5 text-accent ' : 'text-white/50'}`}>
                            Supplier Returns
                        </button>
                        <button onClick={() => setActiveTab('shopify')} className={`px-4 py-2 text-sm font-medium transition-all ${activeTab === 'shopify' ? 'bg-white/5 text-accent ' : 'text-white/50'}`}>
                            Shopify Returns
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'supplier' && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <KPICard title="Total Returns" value={supplierReturns.length} color="red" />
                        <KPICard title="Requested" value={supplierReturns.filter(r => r.status === 'requested').length} color="amber" />
                        <KPICard title="Approved" value={supplierReturns.filter(r => r.status === 'approved').length} color="emerald" />
                        <KPICard title="Disputed" value={supplierReturns.filter(r => r.status === 'disputed').length} color="purple" />
                    </div>

                    {supplierReturns.length === 0 ? (
                        <div className="bg-white/5 border-2 border-white/10 p-12 text-center ">
                            <p className="text-white/40">No supplier returns yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {supplierReturns.map((r: any) => (
                                <div key={r._id} className="bg-white/5 border-2 border-white/10 p-5 ">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${RETURN_STATUS_COLORS[r.status] || ''}`}>{r.status}</span>
                                            <span className="text-sm font-medium text-white/80">{r.supplierName || 'Unknown'}</span>
                                            {r.shopifyOrderRef && <span className="text-xs text-white/40 font-mono">{r.shopifyOrderRef}</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {r.status === 'requested' && (
                                                <>
                                                    <button onClick={() => handleUpdateReturn(r._id, 'approve')} className="px-3 py-1 text-xs bg-green-500/100/10 text-green-400 font-medium hover:bg-green-500/100/20">Approve</button>
                                                </>
                                            )}
                                            {r.status === 'approved' && (
                                                <button onClick={() => handleUpdateReturn(r._id, 'picked_up')} className="px-3 py-1 text-xs bg-accent/10 text-accent font-medium hover:bg-accent/20">Mark Picked Up</button>
                                            )}
                                            {r.status === 'picked_up' && (
                                                <button onClick={() => handleUpdateReturn(r._id, 'refunded')} className="px-3 py-1 text-xs bg-purple-500/10 text-purple-400 font-medium hover:bg-purple-100">Mark Refunded</button>
                                            )}
                                            <span className="text-xs text-white/40">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-white/60 mb-2"><strong>Reason:</strong> {r.reason}</p>
                                    <div className="bg-white/5 p-3">
                                        {r.items?.map((item: any, i: number) => (
                                            <div key={i} className="flex justify-between py-1">
                                                <span className="text-sm text-white/80">{item.productName}</span>
                                                <span className="text-sm text-white/50">× {item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {r.supplierNote && <p className="text-xs text-red-400 mt-2">Supplier disputed: {r.supplierNote}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {activeTab === 'shopify' && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{shopifyKpis.map((k, i) => <KPICard key={i} {...k} />)}</div>
                    <DataTable columns={shopifyColumns} data={shopifyTableData} loading={loading} emptyMessage="No returns or refunds yet." />
                </>
            )}

            {/* Create Return Modal */}
            {returnModal && (
                <div className="fixed inset-0 bg-black flex items-center justify-center z-[1000]" onClick={() => !creating && setReturnModal(false)}>
                    <div className="w-full max-w-md bg-white/5 p-6" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold text-white mb-4">Create Return Request</h2>
                        <div className="mb-4">
                            <label className="block mb-1.5 text-sm text-white/50 font-medium">Select Supplier Order</label>
                            <select className="w-full px-3 py-2.5 border-2 border-white/10 text-sm bg-white/5" value={selectedOrder} onChange={e => setSelectedOrder(e.target.value)}>
                                <option value="">Select an order...</option>
                                {eligibleOrders.map((o: any) => (
                                    <option key={o._id} value={o._id}>
                                        {o.supplierName} — {o.items?.map((i: any) => i.productName).join(', ')} ({o.shopifyOrderRef || 'No ref'})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="mb-6">
                            <label className="block mb-1.5 text-sm text-white/50 font-medium">Reason for Return *</label>
                            <textarea className="w-full px-3 py-2.5 border-2 border-white/10 text-sm" rows={3}
                                value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="Describe the reason..." />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setReturnModal(false)} className="px-4 py-2 bg-white/10 text-white/80 text-sm font-medium">Cancel</button>
                            <button onClick={handleCreateReturn} disabled={creating || !selectedOrder || !returnReason}
                                className="px-4 py-2 bg-red-500/100 text-white text-sm font-medium disabled:opacity-70">
                                {creating ? 'Creating...' : 'Create Return'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
