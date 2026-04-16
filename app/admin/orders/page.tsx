'use client';

import { useState, useEffect, useMemo } from 'react';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import FilterBar from '../../../components/FilterBar';
import TabBar from '../../../components/TabBar';
import Modal from '../../../components/Modal';

function formatCurrency(val: number) {
 return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function AdminOrdersPage() {
 const [orders, setOrders] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState('all');
 const [filters, setFilters] = useState<Record<string, string>>({});
 const [sortBy, setSortBy] = useState<string>('newest');

 // Send to Supplier modal state
 const [showSendModal, setShowSendModal] = useState(false);
 const [sendOrderRef, setSendOrderRef] = useState('');
 const [sendOrderRaw, setSendOrderRaw] = useState<any>(null);
 const [suppliers, setSuppliers] = useState<any[]>([]);
 const [selectedSupplierId, setSelectedSupplierId] = useState('');
 const [sendItems, setSendItems] = useState<{ productName: string; quantity: string }[]>([{ productName: '', quantity: '' }]);
 const [sendLoading, setSendLoading] = useState(false);
 const [sendSuccess, setSendSuccess] = useState('');

 // Smart suggestion state
 const [suggestions, setSuggestions] = useState<any[]>([]);
 const [unmatchedProducts, setUnmatchedProducts] = useState<string[]>([]);
 const [matchLoading, setMatchLoading] = useState(false);
 const [modalTab, setModalTab] = useState<'suggest' | 'manual'>('suggest');
 const [selectedSuggestions, setSelectedSuggestions] = useState<Record<string, string[]>>({}); // supplierId -> [productName]

 // Track which orders are assigned to suppliers
 const [supplierOrders, setSupplierOrders] = useState<any[]>([]);

 // Order detail modal state
 const [selectedOrder, setSelectedOrder] = useState<any>(null);

 // Firebase users lookup map (phone -> user)
 const [firebaseUsers, setFirebaseUsers] = useState<Record<string, any>>({});

 useEffect(() => {
 async function fetchData() {
 try {
 const [ordersRes, supOrdersRes, fbUsersRes] = await Promise.all([
 fetch('/api/shopify/orders?limit=250'),
 fetch('/api/supplier-orders'),
 fetch('/api/firebase-users'),
 ]);
 const ordersData = await ordersRes.json();
 const supOrdersData = await supOrdersRes.json();
 const fbData = await fbUsersRes.json();
 setOrders(ordersData.orders || []);
 setSupplierOrders(supOrdersData.orders || []);

 // Build phone + uid -> user lookup
 const lookup: Record<string, any> = {};
 (fbData.users || []).forEach((u: any) => {
 // Index by UID
 if (u.uid) lookup[u.uid] = u;
 if (u.phone) {
 lookup[u.phone] = u;
 const stripped = u.phone.replace(/^\+91/, '').replace(/^0/, '').replace(/\s/g, '');
 lookup[stripped] = u;
 lookup['+91' + stripped] = u;
 // Also index by last 10 digits only
 const digits = u.phone.replace(/\D/g, '');
 if (digits.length >= 10) lookup[digits.slice(-10)] = u;
 }
 });
 setFirebaseUsers(lookup);
 } catch (err) { console.error(err); }
 finally { setLoading(false); }
 }
 fetchData();
 const interval = setInterval(fetchData, 15000);
 return () => clearInterval(interval);
 }, []);

 // Resolve customer name from Firebase users using order phone number
 const resolveCustomer = (order: any) => {
 // Try to get phone from Shopify order (shipping, billing, or customer)
 const phone = order.shipping_address?.phone
 || order.billing_address?.phone
 || order.customer?.phone
 || order.phone
 || '';

 // Try Firebase UID from order note (format: "Firebase UID: xxxx")
 const noteUidMatch = (order.note || '').match(/Firebase UID:\s*(\S+)/);
 const firebaseUid = noteUidMatch?.[1] || '';

 // Normalize: strip everything except digits, take last 10
 const normalize = (p: string) => {
 const digits = (p || '').replace(/\D/g, '');
 return digits.length >= 10 ? digits.slice(-10) : digits;
 };

 // Try matching by phone (multiple normalization strategies)
 if (phone) {
 const phoneNorm = normalize(phone);
 // Try exact match, +91 prefix, stripped, last-10-digits
 const fbUser = firebaseUsers[phone]
 || firebaseUsers['+91' + phoneNorm]
 || firebaseUsers[phoneNorm]
 // Search by normalized last 10 digits
 || Object.values(firebaseUsers).find((u: any) => u.phone && normalize(u.phone) === phoneNorm);

 if (fbUser) {
 return {
 name: fbUser.displayName || fbUser.email || fbUser.phone || phone,
 phone: fbUser.phone || phone,
 source: 'firebase',
 };
 }
 }

 // Try matching by Firebase UID from order note
 if (firebaseUid) {
 const fbUser = Object.values(firebaseUsers).find((u: any) => u.uid === firebaseUid);
 if (fbUser) {
 return {
 name: (fbUser as any).displayName || (fbUser as any).email || (fbUser as any).phone || phone,
 phone: (fbUser as any).phone || phone,
 source: 'firebase',
 };
 }
 }

 // Fallback to Shopify customer data
 const shopifyName = order.customer
 ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
 : '';

 // Fallback to shipping address name
 const shippingName = order.shipping_address
 ? `${order.shipping_address.first_name || ''} ${order.shipping_address.last_name || ''}`.trim()
 : '';

 return {
 name: shopifyName || shippingName || phone || 'Guest',
 phone: phone || '',
 source: shopifyName || shippingName ? 'shopify' : 'unknown',
 };
 };

 const getStatus = (o: any) => {
 if (o.cancelled_at) return 'Cancelled';
 if (o.financial_status === 'refunded') return 'Refunded';
 if (o.fulfillment_status === 'fulfilled') return 'Delivered';
 if (o.fulfillment_status === 'partial') return 'Partially Fulfilled';
 if (o.financial_status === 'paid') return 'Paid';
 return 'Pending';
 };

 const filtered = useMemo(() => {
 let result = [...orders];

 // Tab filter
 if (activeTab === 'pending') result = result.filter(o => !o.fulfillment_status && !o.cancelled_at);
 else if (activeTab === 'fulfilled') result = result.filter(o => o.fulfillment_status === 'fulfilled');
 else if (activeTab === 'cancelled') result = result.filter(o => o.cancelled_at);
 else if (activeTab === 'refunded') result = result.filter(o => o.financial_status === 'refunded');

 // Search filter
 const search = (filters.search || '').toLowerCase();
 if (search) {
 result = result.filter(o => {
 const name = o.name || '';
 const customerName = o.customer ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim() : '';
 const phone = o.shipping_address?.phone || o.billing_address?.phone || o.customer?.phone || '';
 return name.toLowerCase().includes(search) ||
 customerName.toLowerCase().includes(search) ||
 phone.includes(search);
 });
 }

 // Date range — from
 if (filters.dateFrom) {
 const from = new Date(filters.dateFrom);
 from.setHours(0, 0, 0, 0);
 result = result.filter(o => o.created_at && new Date(o.created_at) >= from);
 }

 // Date range — to
 if (filters.dateTo) {
 const to = new Date(filters.dateTo);
 to.setHours(23, 59, 59, 999);
 result = result.filter(o => o.created_at && new Date(o.created_at) <= to);
 }

 // Sort
 result.sort((a, b) => {
 switch (sortBy) {
 case 'newest':
 return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
 case 'oldest':
 return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
 case 'amountHigh':
 return parseFloat(b.total_price || 0) - parseFloat(a.total_price || 0);
 case 'amountLow':
 return parseFloat(a.total_price || 0) - parseFloat(b.total_price || 0);
 default:
 return 0;
 }
 });

 return result;
 }, [orders, activeTab, filters, sortBy]);

 const tabs = [
 { key: 'all', label: 'All', count: orders.length },
 { key: 'pending', label: 'Pending', count: orders.filter(o => !o.fulfillment_status && !o.cancelled_at).length },
 { key: 'fulfilled', label: 'Fulfilled', count: orders.filter(o => o.fulfillment_status === 'fulfilled').length },
 { key: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.cancelled_at).length },
 { key: 'refunded', label: 'Refunded', count: orders.filter(o => o.financial_status === 'refunded').length },
 ];

 const filterConfig = [
 { key: 'search', label: 'Search', type: 'text' as const, placeholder: 'Search by order #, customer, phone...' },
 { key: 'dateFrom', label: 'From', type: 'date' as const },
 { key: 'dateTo', label: 'To', type: 'date' as const },
 ];

 const handleCancel = async (orderId: number) => {
 if (!confirm('Cancel this order?')) return;
 try {
 const res = await fetch(`/api/shopify/orders/${orderId}`, {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'cancel', reason: 'other' }),
 });
 if (res.ok) {
 setOrders(prev => prev.map(o => o.id === orderId ? { ...o, cancelled_at: new Date().toISOString() } : o));
 } else { const d = await res.json(); alert(d.error || 'Cancel failed'); }
 } catch { alert('Error cancelling order'); }
 };

 const handleRefund = async (orderId: number) => {
 if (!confirm('Issue a full refund for this order?')) return;
 try {
 const res = await fetch(`/api/shopify/orders/${orderId}`, {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'refund' }),
 });
 if (res.ok) {
 setOrders(prev => prev.map(o => o.id === orderId ? { ...o, financial_status: 'refunded' } : o));
 } else { const d = await res.json(); alert(JSON.stringify(d.error) || 'Refund failed'); }
 } catch { alert('Error issuing refund'); }
 };

 const handleFulfill = async (orderId: number) => {
 if (!confirm('Mark this order as fulfilled?')) return;
 try {
 const res = await fetch(`/api/shopify/orders/${orderId}`, {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'fulfill' }),
 });
 if (res.ok) {
 setOrders(prev => prev.map(o => o.id === orderId ? { ...o, fulfillment_status: 'fulfilled' } : o));
 } else { const d = await res.json(); alert(JSON.stringify(d.error) || 'Fulfill failed'); }
 } catch { alert('Error fulfilling order'); }
 };

 const openSendModal = async (order: any) => {
 const ref = order.name || `#${order.id}`;
 const items = (order.line_items || []).map((li: any) => ({ productName: li.title || li.name || '', quantity: String(li.quantity || 1) }));
 setSendOrderRef(ref);
 setSendOrderRaw(order);
 setSendItems(items);
 setSendSuccess('');
 setSelectedSupplierId('');
 setSuggestions([]);
 setUnmatchedProducts([]);
 setSelectedSuggestions({});
 setModalTab('suggest');
 setShowSendModal(true);

 // Fetch suppliers for manual mode
 fetch('/api/admin/suppliers').then(r => r.json()).then(d => setSuppliers(d.suppliers || [])).catch(() => {});

 // Fetch smart suggestions
 setMatchLoading(true);
 try {
 const res = await fetch('/api/supplier-match', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ productNames: items.map((i: any) => i.productName) }),
 });
 const data = await res.json();
 setSuggestions(data.suggestions || []);
 setUnmatchedProducts(data.unmatchedProducts || []);
 // Smart auto-select: assign each product to only ONE supplier (first best match)
 const assigned = new Set<string>();
 const autoSelect: Record<string, string[]> = {};
 // suggestions are already sorted by most matches first
 (data.suggestions || []).forEach((s: any) => {
 autoSelect[s.supplierId] = [];
 s.matchedProducts.forEach((mp: any) => {
 if (!assigned.has(mp.orderProduct)) {
 autoSelect[s.supplierId].push(mp.orderProduct);
 assigned.add(mp.orderProduct);
 }
 });
 });
 setSelectedSuggestions(autoSelect);
 } catch { }
 finally { setMatchLoading(false); }
 };

 // Check which products are available from multiple suppliers
 const getSharedSuppliers = (productName: string) => {
 return suggestions.filter(s => s.matchedProducts.some((mp: any) => mp.orderProduct === productName));
 };

 const toggleSuggestionProduct = (supplierId: string, productName: string) => {
 setSelectedSuggestions(prev => {
 const next = { ...prev };
 const current = next[supplierId] || [];
 if (current.includes(productName)) {
 // Uncheck from this supplier
 next[supplierId] = current.filter(p => p !== productName);
 } else {
 // Check for this supplier — uncheck from all others (exclusive assignment)
 for (const sid of Object.keys(next)) {
 if (sid !== supplierId) {
 next[sid] = (next[sid] || []).filter(p => p !== productName);
 }
 }
 next[supplierId] = [...current, productName];
 }
 return next;
 });
 };

 const handleSendSuggested = async () => {
 const toSend = Object.entries(selectedSuggestions).filter(([, products]) => products.length > 0);
 if (toSend.length === 0) return;
 setSendLoading(true);
 try {
 const orderItems = sendItems;
 const duplicates: string[] = [];
 for (const [supplierId, productNames] of toSend) {
 const suggestion = suggestions.find(s => s.supplierId === supplierId);
 const items = productNames.map(pn => {
 const orig = orderItems.find(i => i.productName === pn);
 return { productName: pn, quantity: Number(orig?.quantity || 1) };
 });
 const res = await fetch('/api/supplier-orders', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 supplierId,
 supplierName: suggestion?.supplierName || '',
 shopifyOrderRef: sendOrderRef,
 items,
 }),
 });
 if (res.status === 409) {
 const data = await res.json();
 duplicates.push(data.error || `Duplicate for ${suggestion?.supplierName}`);
 }
 }
 if (duplicates.length > 0) {
 setSendSuccess(`⚠ ${duplicates.join('. ')}`);
 } else {
 setSendSuccess(`Order split and sent to ${toSend.length} supplier(s)!`);
 }
 const supOrdersRes = await fetch('/api/supplier-orders');
 const supOrdersData = await supOrdersRes.json();
 setSupplierOrders(supOrdersData.orders || []);
 setTimeout(() => setShowSendModal(false), 3000);
 } catch { alert('Error sending orders'); }
 finally { setSendLoading(false); }
 };

 const handleSendToSupplier = async () => {
 if (!selectedSupplierId || sendItems.some(i => !i.productName || !i.quantity)) return;
 const supplier = suppliers.find(s => s._id === selectedSupplierId);
 setSendLoading(true);
 try {
 const res = await fetch('/api/supplier-orders', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 supplierId: selectedSupplierId,
 supplierName: supplier?.businessName || supplier?.name || '',
 shopifyOrderRef: sendOrderRef,
 items: sendItems.map(i => ({ productName: i.productName, quantity: Number(i.quantity) })),
 }),
 });
 if (res.ok) {
 setSendSuccess('Order sent to supplier!');
 const supOrdersRes = await fetch('/api/supplier-orders');
 const supOrdersData = await supOrdersRes.json();
 setSupplierOrders(supOrdersData.orders || []);
 setTimeout(() => setShowSendModal(false), 2000);
 } else {
 const d = await res.json();
 alert(d.error || 'Failed to send');
 }
 } catch { alert('Error'); }
 finally { setSendLoading(false); }
 };

 const addItem = () => setSendItems(prev => [...prev, { productName: '', quantity: '' }]);
 const removeItem = (i: number) => setSendItems(prev => prev.filter((_, idx) => idx !== i));
 const updateItem = (i: number, field: string, value: string) => {
 setSendItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
 };

 // Map shopify order ref to ALL supplier assignments
 const getAssignments = (orderName: string) => {
 return supplierOrders.filter(so => so.shopifyOrderRef === orderName);
 };

 const tableData = useMemo(() => filtered.map((o: any) => {
 const customer = resolveCustomer(o);
 return {
 id: o.name || `#${o.id}`,
 _orderId: o.id,
 _raw: o,
 customerName: customer.name,
 customerPhone: customer.phone,
 customerSource: customer.source,
 items: o.line_items?.length || 0,
 amount: formatCurrency(parseFloat(o.total_price || 0)),
 payment: o.financial_status || 'pending',
 status: getStatus(o),
 date: new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
 };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }), [filtered, firebaseUsers]);

 const columns = [
 { key: 'id', label: 'Order', render: (val: string) => <span className="font-semibold text-accent">{val}</span> },
 { key: 'customerName', label: 'Customer', render: (_val: string, row: any) => (
 <div>
 <div className="flex items-center gap-1.5">
 <span className="font-medium text-white">{row.customerName}</span>
 {row.customerSource === 'firebase' && (
 <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/100/20 text-green-400" title="Matched from Firebase Auth">FB</span>
 )}
 </div>
 {row.customerPhone && (
 <p className="text-[11px] text-white/40 mt-0.5">{row.customerPhone}</p>
 )}
 </div>
 )},
 { key: 'items', label: 'Items' },
 { key: 'amount', label: 'Amount', sortable: true },
 { key: 'date', label: 'Date' },
 { key: 'payment', label: 'Payment', render: (val: string) => <StatusBadge status={val.charAt(0).toUpperCase() + val.slice(1)} /> },
 { key: 'status', label: 'Status', render: (val: string) => <StatusBadge status={val} /> },
 { key: '_orderId', label: 'Actions', render: (val: number, row: any) => {
 const assignments = getAssignments(row.id);
 return (
 <div className="flex gap-1.5 flex-wrap">
 {assignments.length > 0 ? (
 assignments.map((a: any, i: number) => {
 const sColor = (function(st) {
 switch(st) {
 case 'pending': return 'bg-yellow-500/100/10 text-yellow-400 border-yellow-500/10';
 case 'accepted': return 'bg-green-500/100/10 text-green-400 border-green-500/10';
 case 'rejected': return 'bg-red-500/10 text-red-400 border-red-500/10';
 case 'delivery_boy_coming': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/10';
 case 'given_to_delivery': return 'bg-accent/10 text-accent border-accent/20';
 case 'in_transit': return 'bg-indigo-500/10 text-indigo-400 border-indigo-100';
 case 'delivered': return 'bg-green-500/100/10 text-green-400 border-green-500/20';
 case 'completed': return 'bg-purple-500/10 text-purple-400 border-purple-100';
 default: return 'bg-white/5 text-white/60 border-white/10';
 }
 })(a.status);
 const sLabel = (function(st) {
 switch(st) {
 case 'pending': return 'Pending';
 case 'accepted': return 'Accepted';
 case 'rejected': return 'Rejected';
 case 'delivery_boy_coming': return 'Delivery Boy Coming';
 case 'given_to_delivery': return 'Given to Delivery';
 case 'in_transit': return 'In Transit';
 case 'delivered': return 'Delivered';
 case 'completed': return 'Completed';
 default: return st;
 }
 })(a.status);
 
 return (
 <span key={i} className={`px-2 py-1 text-xs border font-medium whitespace-nowrap ${sColor}`}>
 {a.supplierName || 'Supplier'} - {sLabel}
 </span>
 );
 })
 ) : (
 <button onClick={() => openSendModal(row._raw)} className="px-2 py-1 text-xs bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 font-medium">Send to Supplier</button>
 )}
 </div>
 );
 }},
 ];

 return (
 <div>
 <div className="mb-6">
 <h1 className="text-2xl font-bold text-white">Orders</h1>
 <p className="text-sm text-white/50 mt-1">Manage orders — fulfill, cancel, refund, or send to a supplier.</p>
 </div>

 <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

 {/* Filters + Sort Row */}
 <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 mb-1">
 <div className="flex-1 w-full">
 <FilterBar filters={filterConfig} onFilterChange={setFilters} />
 </div>
 <div className="flex items-center gap-2 mb-4">
 <label className="text-xs text-white/40 whitespace-nowrap">Sort by</label>
 <select
 value={sortBy}
 onChange={e => setSortBy(e.target.value)}
 className="px-3 py-2 bg-white/5 border-2 border-white/10 text-sm focus:outline-none focus:border-accent min-w-[160px]"
 >
 <option value="newest">Newest First</option>
 <option value="oldest">Oldest First</option>
 <option value="amountHigh">Amount: High → Low</option>
 <option value="amountLow">Amount: Low → High</option>
 </select>
 </div>
 </div>

 {/* Showing count when filtered */}
 {(filters.dateFrom || filters.dateTo || filters.search) && (
 <p className="text-xs text-white/40 mb-3">Showing {filtered.length} of {orders.length} orders</p>
 )}

 <DataTable columns={columns} data={tableData} loading={loading} emptyMessage="No orders found." onRowClick={(row: any) => setSelectedOrder(row._raw)} />

 {/* Send to Supplier Modal */}
 {showSendModal && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]" onClick={() => !sendLoading && setShowSendModal(false)}>
 <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white/5 border-2 border-white/10 p-6" onClick={e => e.stopPropagation()}>
 <h2 className="text-lg font-semibold text-white mb-1">Send Order to Supplier</h2>
 <p className="text-xs text-white/40 mb-4">Order: {sendOrderRef} · {sendItems.length} product(s)</p>

 {sendSuccess ? (
 <div className="bg-green-500/100/10 border border-green-500/20 p-4 text-center">
 <svg className="w-8 h-8 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
 <p className="text-sm font-medium text-green-400">{sendSuccess}</p>
 </div>
 ) : (
 <>
 {/* Tab toggle */}
 <div className="flex gap-1 bg-white/10 p-1 mb-5">
 <button onClick={() => setModalTab('suggest')}
 className={`flex-1 px-3 py-2 text-sm font-medium transition-all ${modalTab === 'suggest' ? 'bg-white/5 text-accent ' : 'text-white/50'}`}>
 ✨ Smart Suggestions
 </button>
 <button onClick={() => setModalTab('manual')}
 className={`flex-1 px-3 py-2 text-sm font-medium transition-all ${modalTab === 'manual' ? 'bg-white/5 text-accent ' : 'text-white/50'}`}>
 Manual Select
 </button>
 </div>

 {modalTab === 'suggest' ? (
 <div>
 {matchLoading ? (
 <div className="py-8 text-center">
 <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
 <p className="text-sm text-white/40">Finding matching suppliers...</p>
 </div>
 ) : suggestions.length === 0 ? (
 <div className="py-8 text-center">
 <p className="text-sm text-white/40 mb-2">No matching suppliers found for these products.</p>
 <button onClick={() => setModalTab('manual')} className="text-sm text-accent font-medium hover:text-accent">Use manual selection →</button>
 </div>
 ) : (
 <>
 {/* Suggestion cards */}
 <div className="space-y-3 mb-4">
 {suggestions.map((s: any) => {
 const selected = selectedSuggestions[s.supplierId] || [];
 return (
 <div key={s.supplierId} className={`border p-4 transition-all ${
 selected.length > 0 ? 'border-blue-300 bg-accent/10/30' : 'border-white/10'
 }`}>
 <div className="flex items-center justify-between mb-3">
 <div>
 <p className="text-sm font-semibold text-white">{s.supplierName}</p>
 {s.phone && <p className="text-[11px] text-white/40">{s.phone}</p>}
 </div>
 <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
 selected.length === s.matchedProducts.length ? 'bg-green-500/100/20 text-green-400' : selected.length > 0 ? 'bg-accent/20 text-blue-700' : 'bg-white/10 text-white/50'
 }`}>
 {selected.length}/{s.matchedProducts.length} products
 </span>
 </div>
 <div className="space-y-1.5">
 {s.matchedProducts.map((mp: any) => {
 const isChecked = selected.includes(mp.orderProduct);
 const item = sendItems.find(i => i.productName === mp.orderProduct);
 const shared = getSharedSuppliers(mp.orderProduct);
 const isShared = shared.length > 1;
 const assignedTo = isShared ? Object.entries(selectedSuggestions).find(([sid, prods]) => sid !== s.supplierId && prods.includes(mp.orderProduct)) : null;
 return (
 <label key={mp.orderProduct} className={`flex items-center gap-2.5 cursor-pointer group py-1 px-2 ${isChecked ? 'bg-accent/10/50' : ''}`}>
 <input type="checkbox" checked={isChecked}
 onChange={() => toggleSuggestionProduct(s.supplierId, mp.orderProduct)}
 className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-blue-500" />
 <div className="flex-1 flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <span className="text-sm text-white/80">{mp.orderProduct}</span>
 {mp.supplierProduct !== mp.orderProduct && (
 <span className="text-[10px] text-white/40">({mp.supplierProduct})</span>
 )}
 {isShared && (
 <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-yellow-500/100/20 text-yellow-400" title={`Also available from: ${shared.filter(x => x.supplierId !== s.supplierId).map(x => x.supplierName).join(', ')}`}>
 {shared.length} suppliers
 </span>
 )}
 {assignedTo && !isChecked && (
 <span className="text-[9px] text-white/40 italic">
 → {suggestions.find(x => x.supplierId === assignedTo[0])?.supplierName}
 </span>
 )}
 </div>
 <div className="flex items-center gap-3 text-xs text-white/50">
 <span>×{item?.quantity || 1}</span>
 {mp.price > 0 && <span>₹{mp.price}</span>}
 </div>
 </div>
 </label>
 );
 })}
 </div>
 </div>
 );
 })}
 </div>

 {/* Unmatched products warning */}
 {unmatchedProducts.length > 0 && (
 <div className="bg-yellow-500/100/10 border border-yellow-500/20 p-3 mb-4">
 <p className="text-xs font-semibold text-yellow-400 mb-1">⚠ No supplier found for:</p>
 <ul className="text-xs text-yellow-400 list-disc list-inside">
 {unmatchedProducts.map(p => <li key={p}>{p}</li>)}
 </ul>
 <p className="text-[10px] text-yellow-400 mt-1">Use Manual Select tab to assign these.</p>
 </div>
 )}

 <div className="flex justify-end gap-2">
 <button onClick={() => setShowSendModal(false)} className="px-4 py-2.5 bg-white/10 text-white/80 text-sm font-medium hover:bg-white/10">Cancel</button>
 <button onClick={handleSendSuggested}
 disabled={sendLoading || Object.values(selectedSuggestions).every(v => v.length === 0)}
 className="px-4 py-2.5 bg-indigo-500/100 text-white text-sm font-medium shadow hover:bg-indigo-500/30 disabled:opacity-70">
 {sendLoading ? 'Sending...' : `Send to ${Object.values(selectedSuggestions).filter(v => v.length > 0).length} Supplier(s)`}
 </button>
 </div>
 </>
 )}
 </div>
 ) : (
 /* Manual mode — existing flow */
 <>
 <div className="mb-5">
 <label className="block mb-1.5 text-sm text-white/50 font-medium">Select Supplier *</label>
 <select className="w-full px-3 py-2.5 bg-white/5 border-2 border-white/10 text-sm focus:outline-none focus:border-accent "
 value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}>
 <option value="">Choose a supplier...</option>
 {suppliers.map(s => (
 <option key={s._id} value={s._id}>{s.businessName || s.name} — {s.phone}</option>
 ))}
 </select>
 </div>
 <div className="mb-5">
 <div className="flex justify-between items-center mb-2">
 <label className="text-sm text-white/50 font-medium">Items *</label>
 <button onClick={addItem} className="text-xs text-accent hover:text-accent font-medium">+ Add Item</button>
 </div>
 <div className="space-y-2">
 {sendItems.map((item, i) => (
 <div key={i} className="flex gap-2">
 <input type="text" placeholder="Product name" className="flex-1 px-3 py-2 bg-white/5 border-2 border-white/10 text-sm focus:outline-none focus:border-accent"
 value={item.productName} onChange={e => updateItem(i, 'productName', e.target.value)} />
 <input type="number" min="1" placeholder="Qty" className="w-20 px-3 py-2 bg-white/5 border-2 border-white/10 text-sm focus:outline-none focus:border-accent"
 value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
 {sendItems.length > 1 && (
 <button onClick={() => removeItem(i)} className="px-2 text-red-400 hover:text-red-400 text-lg">&times;</button>
 )}
 </div>
 ))}
 </div>
 </div>
 <div className="flex justify-end gap-2">
 <button onClick={() => setShowSendModal(false)} className="px-4 py-2.5 bg-white/10 text-white/80 text-sm font-medium hover:bg-white/10">Cancel</button>
 <button onClick={handleSendToSupplier} disabled={sendLoading || !selectedSupplierId || sendItems.some(i => !i.productName || !i.quantity)}
 className="px-4 py-2.5 bg-indigo-500/100 text-white text-sm font-medium shadow hover:bg-indigo-500/30 disabled:opacity-70">
 {sendLoading ? 'Sending...' : 'Send to Supplier'}
 </button>
 </div>
 </>
 )}
 </>
 )}
 </div>
 </div>
 )}

 {/* Order Detail Modal */}
 {selectedOrder && (() => {
 const customer = resolveCustomer(selectedOrder);
 const assignments = getAssignments(selectedOrder.name || `#${selectedOrder.id}`);
 return (
 <Modal
 isOpen={true}
 onClose={() => setSelectedOrder(null)}
 title={`Order ${selectedOrder.name || `#${selectedOrder.id}`}`}
 size="xl"
 footer={
 <div className="flex gap-2 justify-end">
 {!selectedOrder.cancelled_at && selectedOrder.fulfillment_status !== 'fulfilled' && (
 <button
 onClick={() => { handleFulfill(selectedOrder.id); setSelectedOrder(null); }}
 className="px-4 py-2 bg-green-500/100/100 text-white text-sm font-medium hover:bg-green-500/100/30"
 >Mark Fulfilled</button>
 )}
 {!selectedOrder.cancelled_at && selectedOrder.financial_status !== 'refunded' && (
 <button
 onClick={() => { handleRefund(selectedOrder.id); setSelectedOrder(null); }}
 className="px-4 py-2 bg-yellow-500/100/100 text-white text-sm font-medium hover:bg-amber-600"
 >Refund</button>
 )}
 {!selectedOrder.cancelled_at && (
 <button
 onClick={() => { handleCancel(selectedOrder.id); setSelectedOrder(null); }}
 className="px-4 py-2 bg-red-500/100 text-white text-sm font-medium hover:bg-red-500/30"
 >Cancel Order</button>
 )}
 <button
 onClick={() => { setSelectedOrder(null); openSendModal(selectedOrder); }}
 className="px-4 py-2 bg-indigo-500/100 text-white text-sm font-medium hover:bg-indigo-500/30"
 >Send to Supplier</button>
 </div>
 }
 >
 <div>
 {/* Order Summary Header */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
 <div className="bg-white/5 p-3 border-2 border-white/5">
 <p className="text-white/40 text-xs">Date</p>
 <p className="font-medium text-white text-sm">
 {new Date(selectedOrder.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
 </p>
 <p className="text-[10px] text-white/40">
 {new Date(selectedOrder.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
 </p>
 </div>
 <div className="bg-white/5 p-3 border-2 border-white/5">
 <p className="text-white/40 text-xs">Amount</p>
 <p className="font-bold text-white">{formatCurrency(parseFloat(selectedOrder.total_price || 0))}</p>
 {parseFloat(selectedOrder.total_discounts || 0) > 0 && (
 <p className="text-[10px] text-green-400">-{formatCurrency(parseFloat(selectedOrder.total_discounts))} discount</p>
 )}
 </div>
 <div className="bg-white/5 p-3 border-2 border-white/5">
 <p className="text-white/40 text-xs">Payment</p>
 <StatusBadge status={(selectedOrder.financial_status || 'pending').charAt(0).toUpperCase() + (selectedOrder.financial_status || 'pending').slice(1)} />
 </div>
 <div className="bg-white/5 p-3 border-2 border-white/5">
 <p className="text-white/40 text-xs">Fulfillment</p>
 <StatusBadge status={getStatus(selectedOrder)} />
 </div>
 </div>

 {/* Customer Info */}
 <div className="bg-accent/10 p-4 mb-5 border border-accent/20">
 <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-2">
 Customer
 {customer.source === 'firebase' && (
 <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/100/20 text-green-400">Firebase</span>
 )}
 </p>
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
 <div>
 <p className="text-blue-400 text-xs">Name</p>
 <p className="font-semibold text-blue-800">{customer.name}</p>
 </div>
 <div>
 <p className="text-blue-400 text-xs">Phone</p>
 <p className="font-medium text-blue-700">{customer.phone || '—'}</p>
 </div>
 <div>
 <p className="text-blue-400 text-xs">Gateway</p>
 <p className="font-medium text-blue-700">{selectedOrder.gateway || '—'}</p>
 </div>
 </div>
 </div>

 {/* Supplier Assignments */}
 {assignments.length > 0 && (
 <div className="bg-teal-500/10 p-4 mb-5 border border-teal-100">
 <p className="text-xs font-semibold text-teal-700 mb-2">Assigned to Supplier(s)</p>
 <div className="flex flex-wrap gap-2">
 {assignments.map((a: any, i: number) => (
 <span key={i} className="px-3 py-1.5 text-xs bg-white/5 text-teal-700 border border-teal-200 font-medium">
 {a.supplierName || 'Supplier'} — <StatusBadge status={a.status || 'Pending'} />
 </span>
 ))}
 </div>
 </div>
 )}

 {/* Line Items */}
 <div className="mb-5">
 <p className="text-xs font-semibold text-white/60 mb-2">{selectedOrder.line_items?.length || 0} Item(s)</p>
 <div className="bg-white/5 border-2 border-white/10 divide-y divide-gray-100">
 {(selectedOrder.line_items || []).map((item: any, i: number) => (
 <div key={i} className="flex items-center justify-between px-4 py-3">
 <div className="flex-1">
 <p className="text-sm font-medium text-white">{item.title}</p>
 {item.variant_title && (
 <p className="text-[11px] text-white/40">{item.variant_title}</p>
 )}
 {item.sku && (
 <p className="text-[10px] text-white/40 font-mono">SKU: {item.sku}</p>
 )}
 </div>
 <div className="text-right">
 <p className="text-sm text-white/60">×{item.quantity}</p>
 <p className="text-sm font-semibold text-white">{formatCurrency(parseFloat(item.price || 0))}</p>
 </div>
 </div>
 ))}

 {/* Shipping line */}
 {selectedOrder.shipping_lines?.length > 0 && (
 <div className="flex items-center justify-between px-4 py-3 bg-white/5">
 <p className="text-sm text-white/50">{selectedOrder.shipping_lines[0].title || 'Shipping'}</p>
 <p className="text-sm font-medium text-white/80">{formatCurrency(parseFloat(selectedOrder.shipping_lines[0].price || 0))}</p>
 </div>
 )}

 {/* Total */}
 <div className="flex items-center justify-between px-4 py-3 bg-white/5">
 <p className="text-sm font-bold text-white">Total</p>
 <p className="text-sm font-bold text-white">{formatCurrency(parseFloat(selectedOrder.total_price || 0))}</p>
 </div>
 </div>
 </div>

 {/* Notes & Tags */}
 {(selectedOrder.note || selectedOrder.tags) && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {selectedOrder.note && (
 <div className="bg-yellow-500/10 p-3 border border-yellow-100">
 <p className="text-xs font-semibold text-yellow-400 mb-1">Order Note</p>
 <p className="text-sm text-yellow-800">{selectedOrder.note}</p>
 </div>
 )}
 {selectedOrder.tags && (
 <div className="bg-white/5 p-3 border-2 border-white/5">
 <p className="text-xs font-semibold text-white/50 mb-1">Tags</p>
 <div className="flex flex-wrap gap-1">
 {selectedOrder.tags.split(',').map((tag: string, i: number) => (
 <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-white/60">{tag.trim()}</span>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Note Attributes (Unloading, GST, Paint) */}
 {selectedOrder.note_attributes?.length > 0 && (
 <div className="mt-4 bg-indigo-500/10 p-3 border border-indigo-100">
 <p className="text-xs font-semibold text-indigo-700 mb-2">Order Attributes</p>
 <div className="grid grid-cols-2 gap-2">
 {selectedOrder.note_attributes.map((attr: any, i: number) => (
 <div key={i} className="text-sm">
 <span className="text-indigo-400 text-xs">{attr.name}: </span>
 <span className="text-indigo-800 font-medium">{attr.value}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Discount Codes */}
 {selectedOrder.discount_codes?.length > 0 && (
 <div className="mt-4 bg-green-500/100/10 p-3 border border-green-500/10">
 <p className="text-xs font-semibold text-green-400 mb-1">Discount Applied</p>
 {selectedOrder.discount_codes.map((dc: any, i: number) => (
 <p key={i} className="text-sm text-emerald-800">
 <span className="font-mono font-semibold">{dc.code}</span> — {formatCurrency(parseFloat(dc.amount || 0))} off
 </p>
 ))}
 </div>
 )}
 </div>
 </Modal>
 );
 })()}
 </div>
 );
}
