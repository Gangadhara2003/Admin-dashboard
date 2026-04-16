'use client';

import { useState, useEffect } from 'react';
import KPICard from '../../../components/KPICard';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';

function formatCurrency(val: number) {
 return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function AdminPaymentsPage() {
 const [orders, setOrders] = useState<any[]>([]);
 const [analytics, setAnalytics] = useState<any>(null);
 const [supplierOrders, setSupplierOrders] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState<'shopify' | 'supplier'>('supplier');
 const [payingId, setPayingId] = useState<string | null>(null);
 const [payAmount, setPayAmount] = useState('');
 const [payRefType, setPayRefType] = useState<'transaction_id' | 'utr'>('transaction_id');
 const [payRefNumber, setPayRefNumber] = useState('');
 const [firebaseUsers, setFirebaseUsers] = useState<Record<string, any>>({});

 useEffect(() => {
 async function fetchData() {
 try {
 const [ordersRes, analyticsRes, supplierRes, fbUsersRes] = await Promise.all([
 fetch('/api/shopify/orders?limit=250'),
 fetch('/api/shopify/analytics'),
 fetch('/api/supplier-orders?limit=500'),
 fetch('/api/firebase-users'),
 ]);
 setOrders((await ordersRes.json()).orders || []);
 setAnalytics(await analyticsRes.json());
 setSupplierOrders((await supplierRes.json()).orders || []);

 // Build phone + uid -> user lookup for Firebase name resolution
 const fbData = await fbUsersRes.json();
 const lookup: Record<string, any> = {};
 (fbData.users || []).forEach((u: any) => {
 if (u.uid) lookup[u.uid] = u;
 if (u.phone) {
 lookup[u.phone] = u;
 const stripped = u.phone.replace(/^\+91/, '').replace(/^0/, '').replace(/\s/g, '');
 lookup[stripped] = u;
 lookup['+91' + stripped] = u;
 const digits = u.phone.replace(/\D/g, '');
 if (digits.length >= 10) lookup[digits.slice(-10)] = u;
 }
 });
 setFirebaseUsers(lookup);
 } catch (err) { console.error(err); }
 finally { setLoading(false); }
 }
 fetchData();
 }, []);

 // Resolve customer name from Firebase users (same logic as /admin/orders)
 const resolveCustomer = (order: any) => {
 const phone = order.shipping_address?.phone || order.billing_address?.phone || order.customer?.phone || order.phone || '';
 const noteUidMatch = (order.note || '').match(/Firebase UID:\s*(\S+)/);
 const firebaseUid = noteUidMatch?.[1] || '';
 const normalize = (p: string) => { const digits = (p || '').replace(/\D/g, ''); return digits.length >= 10 ? digits.slice(-10) : digits; };

 if (phone) {
 const phoneNorm = normalize(phone);
 const fbUser = firebaseUsers[phone] || firebaseUsers['+91' + phoneNorm] || firebaseUsers[phoneNorm]
 || Object.values(firebaseUsers).find((u: any) => u.phone && normalize(u.phone) === phoneNorm);
 if (fbUser) return fbUser.displayName || fbUser.email || fbUser.phone || phone;
 }
 if (firebaseUid) {
 const fbUser = Object.values(firebaseUsers).find((u: any) => u.uid === firebaseUid);
 if (fbUser) return (fbUser as any).displayName || (fbUser as any).email || (fbUser as any).phone || phone;
 }
 const shopifyName = order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : '';
 const shippingName = order.shipping_address ? `${order.shipping_address.first_name || ''} ${order.shipping_address.last_name || ''}`.trim() : '';
 return shopifyName || shippingName || phone || 'Guest';
 };

 const handleMarkPaid = async (orderId: string) => {
 try {
 const res = await fetch('/api/supplier-orders', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ orderId, action: 'mark_paid', paidAmount: Number(payAmount), changedBy: 'Admin', paymentRefType: payRefType, paymentRefNumber: payRefNumber }),
 });
 if (res.ok) {
 setSupplierOrders(prev => prev.map(o => o._id === orderId ? { ...o, paymentStatus: 'paid', paidAmount: Number(payAmount), paidAt: new Date(), paymentRefType: payRefType, paymentRefNumber: payRefNumber } : o));
 setPayingId(null);
 setPayAmount('');
 setPayRefType('transaction_id');
 setPayRefNumber('');
 }
 } catch { alert('Error'); }
 };

 const kpis = analytics?.kpis;

 // Supplier payment stats
 const acceptedOrders = supplierOrders.filter(o => o.supplierReply?.totalAmount);
 const paidSupplierOrders = acceptedOrders.filter(o => o.paymentStatus === 'paid');
 const unpaidSupplierOrders = acceptedOrders.filter(o => o.paymentStatus !== 'paid');
 const totalOwed = unpaidSupplierOrders.reduce((s, o) => s + (o.supplierReply?.totalAmount || 0), 0);
 const totalPaid = paidSupplierOrders.reduce((s, o) => s + (o.paidAmount || o.supplierReply?.totalAmount || 0), 0);

 // Shopify payment stats
 const paidOrders = orders.filter(o => o.financial_status === 'paid');
 const pendingPayments = orders.filter(o => o.financial_status === 'pending');
 const refundedOrders = orders.filter(o => o.financial_status === 'refunded');

 const shopifyTableData = orders.slice(0, 50).map((o: any) => ({
 order: o.name || `#${o.id}`,
 customer: resolveCustomer(o),
 amount: formatCurrency(parseFloat(o.total_price || 0)),
 payment_status: (o.financial_status || 'pending').charAt(0).toUpperCase() + (o.financial_status || 'pending').slice(1),
 gateway: o.gateway || o.payment_gateway_names?.join(', ') || 'N/A',
 date: new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
 }));

 const shopifyColumns = [
 { key: 'order', label: 'Order', render: (val: string) => <span className="font-semibold text-accent">{val}</span> },
 { key: 'customer', label: 'Customer' },
 { key: 'amount', label: 'Amount', sortable: true },
 { key: 'gateway', label: 'Gateway' },
 { key: 'date', label: 'Date' },
 { key: 'payment_status', label: 'Status', render: (val: string) => <StatusBadge status={val} /> },
 ];

 return (
 <div>
 <div className="flex justify-between items-start mb-6">
 <div>
 <h1 className="text-2xl font-bold text-white">Payments</h1>
 <p className="text-sm text-white/50 mt-1">Track Shopify and supplier payments.</p>
 </div>
 <div className="flex items-center gap-1 bg-white/10 p-1">
 <button onClick={() => setActiveTab('supplier')} className={`px-4 py-2 text-sm font-medium transition-all ${activeTab === 'supplier' ? 'bg-white/5 text-accent ' : 'text-white/50'}`}>
 Supplier Payments
 </button>
 <button onClick={() => setActiveTab('shopify')} className={`px-4 py-2 text-sm font-medium transition-all ${activeTab === 'shopify' ? 'bg-white/5 text-accent ' : 'text-white/50'}`}>
 Shopify Payments
 </button>
 </div>
 </div>

 {activeTab === 'supplier' && (
 <>
 {/* Supplier KPIs */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 <KPICard title="Total Owed" value={formatCurrency(totalOwed)} color="amber" />
 <KPICard title="Total Paid" value={formatCurrency(totalPaid)} color="emerald" />
 <KPICard title="Unpaid Orders" value={unpaidSupplierOrders.length} color="red" />
 <KPICard title="Paid Orders" value={paidSupplierOrders.length} color="blue" />
 </div>

 {/* Unpaid orders */}
 <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Unpaid Orders</h3>
 {unpaidSupplierOrders.length === 0 ? (
 <div className="bg-white/5 border-2 border-white/10 p-8 text-center mb-6">
 <p className="text-white/40">All supplier payments are up to date! 🎉</p>
 </div>
 ) : (
 <div className="bg-white/5 border-2 border-white/10 overflow-hidden mb-6">
 <table className="w-full text-sm">
 <thead><tr className="bg-white/5 border-b border-white/10">
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Supplier</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Items</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Order Ref</th>
 <th className="text-right px-4 py-3 text-xs text-white/50 font-medium">Amount</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Status</th>
 <th className="text-right px-4 py-3 text-xs text-white/50 font-medium">Action</th>
 </tr></thead>
 <tbody>
 {unpaidSupplierOrders.map((o: any) => (
 <tr key={o._id} className="border-b border-white/5">
 <td className="px-4 py-3 text-white/80 font-medium">{o.supplierName || 'Unknown'}</td>
 <td className="px-4 py-3 text-white/60 text-xs">{o.items?.map((i: any) => i.productName).join(', ')}</td>
 <td className="px-4 py-3 text-white/40 text-xs font-mono">{o.shopifyOrderRef || '-'}</td>
 <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(o.supplierReply?.totalAmount || 0)}</td>
 <td className="px-4 py-3"><StatusBadge status={o.status.charAt(0).toUpperCase() + o.status.slice(1)} /></td>
 <td className="px-4 py-3 text-right">
 {payingId === o._id ? (
 <div className="space-y-2">
 <div className="flex items-center gap-2 justify-end">
 <input type="number" min="0" placeholder="₹ Amount"
 className="w-24 px-2 py-1 border-2 border-white/10 rounded text-xs focus:outline-none focus:border-accent"
 value={payAmount} onChange={e => setPayAmount(e.target.value)} />
 <select value={payRefType} onChange={e => setPayRefType(e.target.value as any)}
 className="px-2 py-1 border-2 border-white/10 rounded text-xs focus:outline-none focus:border-accent">
 <option value="transaction_id">Transaction ID</option>
 <option value="utr">UTR Number</option>
 </select>
 </div>
 <div className="flex items-center gap-2 justify-end">
 <input type="text" placeholder={payRefType === 'utr' ? 'UTR Number' : 'Transaction ID'}
 className="w-40 px-2 py-1 border-2 border-white/10 rounded text-xs focus:outline-none focus:border-accent font-mono"
 value={payRefNumber} onChange={e => setPayRefNumber(e.target.value)} />
 <button onClick={() => handleMarkPaid(o._id)} disabled={!payAmount}
 className="px-2 py-1 text-xs bg-green-500/100/100 text-white rounded font-medium hover:bg-green-500/100/30 disabled:opacity-50">Pay</button>
 <button onClick={() => { setPayingId(null); setPayRefType('transaction_id'); setPayRefNumber(''); }}
 className="px-2 py-1 text-xs bg-white/10 text-white/60 rounded">×</button>
 </div>
 </div>
 ) : (
 <button onClick={() => { setPayingId(o._id); setPayAmount(String(o.supplierReply?.totalAmount || '')); setPayRefType('transaction_id'); setPayRefNumber(''); }}
 className="px-3 py-1.5 text-xs bg-green-500/100/10 text-green-400 font-medium hover:bg-green-500/100/20">
 Mark Paid
 </button>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Paid orders */}
 <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Payment History</h3>
 {paidSupplierOrders.length === 0 ? (
 <div className="bg-white/5 border-2 border-white/10 p-8 text-center">
 <p className="text-white/40">No payments recorded yet.</p>
 </div>
 ) : (
 <div className="bg-white/5 border-2 border-white/10 overflow-hidden">
 <table className="w-full text-sm">
 <thead><tr className="bg-white/5 border-b border-white/10">
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Supplier</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Items</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Order Ref</th>
 <th className="text-right px-4 py-3 text-xs text-white/50 font-medium">Paid Amount</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Status</th>
 <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">Reference</th>
 <th className="text-right px-4 py-3 text-xs text-white/50 font-medium">Paid On</th>
 </tr></thead>
 <tbody>
 {paidSupplierOrders.map((o: any) => (
 <tr key={o._id} className="border-b border-white/5">
 <td className="px-4 py-3 text-white/80 font-medium">{o.supplierName || 'Unknown'}</td>
 <td className="px-4 py-3 text-white/60 text-xs">{o.items?.map((i: any) => i.productName).join(', ')}</td>
 <td className="px-4 py-3 text-white/40 text-xs font-mono">{o.shopifyOrderRef || '-'}</td>
 <td className="px-4 py-3 text-right font-semibold text-green-400">{formatCurrency(o.paidAmount || o.supplierReply?.totalAmount || 0)}</td>
 <td className="px-4 py-3"><StatusBadge status={o.status.charAt(0).toUpperCase() + o.status.slice(1)} /></td>
 <td className="px-4 py-3 text-xs">
 {o.paymentRefNumber ? (
 <span className="font-mono text-white/60">
 <span className="text-white/40">{o.paymentRefType === 'utr' ? 'UTR: ' : 'Txn: '}</span>
 {o.paymentRefNumber}
 </span>
 ) : <span className="text-white/30">—</span>}
 </td>
 <td className="px-4 py-3 text-right text-white/40 text-xs">{o.paidAt ? new Date(o.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </>
 )}

 {activeTab === 'shopify' && (
 <>
 {kpis && (
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 <KPICard title="Total Revenue" value={formatCurrency(kpis.totalRevenue)} color="emerald" />
 <KPICard title="Total Paid" value={paidOrders.length} color="blue" />
 <KPICard title="Pending Payments" value={pendingPayments.length} color="amber" />
 <KPICard title="Refunded" value={refundedOrders.length} color="red" />
 </div>
 )}
 <DataTable columns={shopifyColumns} data={shopifyTableData} loading={loading} emptyMessage="No payment data." />
 </>
 )}
 </div>
 );
}
