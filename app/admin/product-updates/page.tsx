'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import KPICard from '../../../components/KPICard';
import StatusBadge from '../../../components/StatusBadge';

function formatCurrency(val: number) {
 return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function timeAgo(date: string) {
 const diff = Date.now() - new Date(date).getTime();
 const mins = Math.floor(diff / 60000);
 if (mins < 1) return 'Just now';
 if (mins < 60) return `${mins}m ago`;
 const hrs = Math.floor(mins / 60);
 if (hrs < 24) return `${hrs}h ago`;
 const days = Math.floor(hrs / 24);
 if (days < 7) return `${days}d ago`;
 return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ProductUpdatesPage() {
 const [notifications, setNotifications] = useState<any[]>([]);
 const [suppliers, setSuppliers] = useState<Record<string, any>>({});
 const [products, setProducts] = useState<Record<string, any>>({});
 const [loading, setLoading] = useState(true);
 const [selectedNotif, setSelectedNotif] = useState<any>(null);
 const [filter, setFilter] = useState<'all' | 'product_update' | 'low_stock'>('all');
 const [search, setSearch] = useState('');

 useEffect(() => {
 async function fetchData() {
 try {
 const [notifRes, supRes, spRes] = await Promise.all([
 fetch('/api/notifications?limit=500'),
 fetch('/api/admin/suppliers'),
 fetch('/api/supplier-products'),
 ]);
 const notifData = await notifRes.json();
 const supData = await supRes.json();
 const spData = await spRes.json();

 // Filter to product update types only
 const updateNotifs = (notifData.notifications || []).filter((n: any) =>
 ['product_update', 'low_stock', 'price_update', 'quantity_update'].includes(n.type)
 );
 setNotifications(updateNotifs);

 // Build supplier lookup
 const supMap: Record<string, any> = {};
 (supData.suppliers || []).forEach((s: any) => { supMap[s._id] = s; });
 setSuppliers(supMap);

 // Build product lookup
 const prodMap: Record<string, any> = {};
 (spData.products || []).forEach((p: any) => { prodMap[p._id] = p; });
 setProducts(prodMap);
 } catch (err) { console.error(err); }
 finally { setLoading(false); }
 }
 fetchData();
 }, []);

 // Mark notification as read
 const markRead = async (id: string) => {
 try {
 await fetch('/api/notifications', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ id }),
 });
 setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
 } catch { }
 };

 // Filtered notifications
 const filtered = notifications.filter(n => {
 if (filter !== 'all' && n.type !== filter) return false;
 if (search) {
 const q = search.toLowerCase();
 return (n.title?.toLowerCase().includes(q) || n.message?.toLowerCase().includes(q) || n.fromName?.toLowerCase().includes(q));
 }
 return true;
 });

 const unreadCount = notifications.filter(n => !n.isRead).length;
 const stockAlerts = notifications.filter(n => n.type === 'low_stock').length;
 const priceUpdates = notifications.filter(n => n.message?.includes('Price') || n.message?.includes('price')).length;
 const stockUpdates = notifications.filter(n => n.message?.includes('stock') || n.message?.includes('Stock') || n.message?.includes('Quantity') || n.message?.includes('quantity')).length;

 // Get product and supplier for selected notification
 const selectedProduct = selectedNotif?.data?.productId ? products[selectedNotif.data.productId] : null;
 const selectedSupplier = selectedNotif?.data?.supplierId
 ? suppliers[selectedNotif.data.supplierId]
 : selectedNotif?.from ? suppliers[selectedNotif.from] : null;

 const inputClass = 'w-full px-3 py-2 border-2 border-white/10 text-sm focus:outline-none focus:border-accent bg-white/5';

 const getTypeBadge = (type: string) => {
 const map: Record<string, { bg: string; text: string; label: string }> = {
 product_update: { bg: 'bg-accent/10', text: 'text-blue-700', label: 'Update' },
 low_stock: { bg: 'bg-red-500/10', text: 'text-red-700', label: 'Low Stock' },
 price_update: { bg: 'bg-yellow-500/100/10', text: 'text-yellow-400', label: 'Price' },
 quantity_update: { bg: 'bg-indigo-500/10', text: 'text-indigo-700', label: 'Quantity' },
 };
 const s = map[type] || { bg: 'bg-white/10', text: 'text-white/60', label: type };
 return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-64">
 <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
 </div>
 );
 }

 return (
 <div>
 <div className="flex justify-between items-start mb-6">
 <div>
 <h1 className="text-2xl font-bold text-white">Product Updates</h1>
 <p className="text-sm text-white/50 mt-1">Updates from suppliers — stock adjustments, price changes, availability.</p>
 </div>
 </div>

 {/* KPIs */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 <KPICard title="Total Updates" value={notifications.length} color="blue" />
 <KPICard title="Unread" value={unreadCount} color="amber" />
 <KPICard title="Stock Alerts" value={stockAlerts} color="red" />
 <KPICard title="Today" value={notifications.filter(n => new Date(n.createdAt).toDateString() === new Date().toDateString()).length} color="emerald" />
 </div>

 {/* Filters */}
 <div className="bg-white/5 border-2 border-white/10 p-4 mb-6">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <input type="text" placeholder="Search updates..." className={inputClass} value={search} onChange={e => setSearch(e.target.value)} />
 <select className={inputClass} value={filter} onChange={e => setFilter(e.target.value as any)}>
 <option value="all">All Types</option>
 <option value="product_update">Product Updates</option>
 <option value="low_stock">Low Stock / Out of Stock</option>
 </select>
 <select className={inputClass} onChange={e => {
 if (e.target.value === 'unread') setNotifications(prev => [...prev].sort((a, b) => (a.isRead === b.isRead ? 0 : a.isRead ? 1 : -1)));
 else setNotifications(prev => [...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
 }}>
 <option value="newest">Newest First</option>
 <option value="unread">Unread First</option>
 </select>
 </div>
 </div>

 <div className="flex gap-6">
 {/* Updates List */}
 <div className={`${selectedNotif ? 'w-1/2' : 'w-full'} transition-all`}>
 {filtered.length === 0 ? (
 <div className="bg-white/5 border-2 border-white/10 p-12 text-center">
 <svg className="w-12 h-12 text-white/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
 <p className="text-white/40 text-lg">No product updates found.</p>
 </div>
 ) : (
 <div className="space-y-2">
 {filtered.map((n: any) => (
 <div
 key={n._id}
 onClick={() => {
 setSelectedNotif(n);
 if (!n.isRead) markRead(n._id);
 }}
 className={`bg-white/5 border p-4 cursor-pointer transition-all hover: ${
 selectedNotif?._id === n._id ? 'border-blue-400 ring-2 ring-blue-100' : 'border-white/10'
 } ${!n.isRead ? 'border-l-4 border-l-blue-500' : ''}`}
 >
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 {getTypeBadge(n.type)}
 {!n.isRead && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
 <span className="text-xs text-white/40 ml-auto shrink-0">{timeAgo(n.createdAt)}</span>
 </div>
 <p className="text-sm font-semibold text-white truncate">{n.title}</p>
 {n.data?.changes?.length > 0 ? (
 <div className="flex flex-wrap gap-1.5 mt-1">
 {n.data.changes.filter((c: any) => c.from).slice(0, 3).map((c: any, i: number) => (
 <span key={i} className="inline-flex items-center gap-1 text-xs bg-white/5 rounded px-1.5 py-0.5">
 <span className="text-white/40">{c.field}:</span>
 <span className="text-red-400 line-through">{c.from}</span>
 <span className="text-white/30">&rarr;</span>
 <span className="text-green-400 font-medium">{c.to}</span>
 </span>
 ))}
 </div>
 ) : (
 <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{n.message}</p>
 )}
 {n.fromName && (
 <p className="text-xs text-white/40 mt-1">by <span className="font-medium text-white/60">{n.fromName}</span></p>
 )}
 </div>
 <svg className="w-4 h-4 text-white/30 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Detail Panel */}
 {selectedNotif && (
 <div className="w-1/2 sticky top-0">
 <div className="bg-white/5 border-2 border-white/10 overflow-hidden">
 {/* Header */}
 <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
 <div>
 <div className="flex items-center gap-2 mb-1">
 {getTypeBadge(selectedNotif.type)}
 <span className="text-xs text-white/40">{new Date(selectedNotif.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
 </div>
 <h3 className="text-lg font-semibold text-white">{selectedNotif.title}</h3>
 </div>
 <button onClick={() => setSelectedNotif(null)} className="p-1.5 hover:bg-white/10 text-white/40 hover:text-white/60">
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
 </button>
 </div>

 {/* Update Details */}
 <div className="px-6 py-4 border-b border-white/5">
 <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">What Changed</h4>
 {selectedNotif.data?.changes?.length > 0 ? (
 <div className="space-y-2">
 {selectedNotif.data.changes.map((c: any, i: number) => (
 <div key={i} className="flex items-center gap-2 bg-white/5 px-3 py-2.5">
 <span className="text-xs font-semibold text-white/50 w-32 shrink-0">{c.field}</span>
 {c.from ? (
 <>
 <span className={`text-sm font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded ${c.from === 'N/A' ? '' : 'line-through'}`}>{c.from}</span>
 <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
 <span className="text-sm font-mono text-green-400 bg-green-500/100/10 px-2 py-0.5 rounded font-semibold">{c.to}</span>
 </>
 ) : (
 <span className="text-sm text-white/80">{c.to}</span>
 )}
 </div>
 ))}
 </div>
 ) : (
 <p className="text-sm text-white/80 leading-relaxed">{selectedNotif.message}</p>
 )}
 </div>

 {/* Product Details */}
 {selectedProduct && (
 <div className="px-6 py-4 border-b border-white/5">
 <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Product Details</h4>
 <div className="flex items-start gap-3">
 {(selectedProduct.shopifyImage || selectedProduct.productImages?.[0]) && (
 <img
 src={selectedProduct.shopifyImage || selectedProduct.productImages[0]}
 alt=""
 className="w-16 h-16 object-cover border-2 border-white/10"
 />
 )}
 <div className="flex-1">
 <p className="text-sm font-semibold text-white">
 {selectedProduct.source === 'catalog' ? selectedProduct.shopifyTitle : selectedProduct.productName}
 </p>
 <div className="flex items-center gap-2 mt-1">
 <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
 selectedProduct.source === 'catalog' ? 'bg-accent/10 text-blue-700' : selectedProduct.source === 'bulk_upload' ? 'bg-purple-500/10 text-purple-400' : 'bg-green-500/100/10 text-green-400'
 }`}>
 {selectedProduct.source === 'catalog' ? 'Catalog' : selectedProduct.source === 'bulk_upload' ? 'Bulk Upload' : 'Custom'}
 </span>
 <StatusBadge status={selectedProduct.status} />
 </div>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-3 mt-4">
 {!(selectedProduct.variants?.length > 0) && (
 <>
 <div className="bg-white/5 p-3">
 <p className="text-xs text-white/40">Current Stock</p>
 <p className={`text-lg font-bold ${selectedProduct.quantity === 0 ? 'text-red-400' : selectedProduct.quantity <= (selectedProduct.lowStockThreshold || 10) ? 'text-yellow-400' : 'text-white'}`}>
 {selectedProduct.quantity}
 </p>
 </div>
 <div className="bg-white/5 p-3">
 <p className="text-xs text-white/40">Selling Price</p>
 <p className="text-lg font-bold text-white">{formatCurrency(selectedProduct.sellingPrice || 0)}</p>
 </div>
 {selectedProduct.mrp && (
 <div className="bg-white/5 p-3">
 <p className="text-xs text-white/40">MRP</p>
 <p className="text-lg font-bold text-white">{formatCurrency(selectedProduct.mrp)}</p>
 </div>
 )}
 </>
 )}
 <div className="bg-white/5 p-3">
 <p className="text-xs text-white/40">Availability</p>
 <StatusBadge status={selectedProduct.availability?.replace(/_/g, ' ') || 'available'} />
 </div>
 </div>

 {/* Variants */}
 {selectedProduct.variants?.length > 0 && (
 <div className="mt-4">
 <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Variants ({selectedProduct.variants.length})</p>
 <div className="space-y-1.5">
 {selectedProduct.variants.map((v: any, i: number) => (
 <div key={i} className="flex items-center justify-between bg-white/5 px-3 py-2 text-sm">
 <span className="text-white/80">{v.title || 'Default'}{v.color ? ` (${v.color})` : ''}</span>
 <span className="flex items-center gap-3">
 {v.mrp && v.mrp > (v.sellingPrice || 0) && (
 <span className="text-white/40 line-through text-xs">₹{v.mrp}</span>
 )}
 <span className="text-white/50">{formatCurrency(v.sellingPrice || 0)}</span>
 <span className={`font-medium ${(v.quantity || 0) === 0 ? 'text-red-400' : 'text-white'}`}>x{v.quantity || 0}</span>
 </span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* SKU & Brand */}
 {(selectedProduct.skuCode || selectedProduct.brand) && (
 <div className="flex items-center gap-4 mt-3 text-xs text-white/50">
 {selectedProduct.skuCode && <span>SKU: <span className="font-mono text-white/80">{selectedProduct.skuCode}</span></span>}
 {selectedProduct.brand && <span>Brand: <span className="font-medium text-white/80">{selectedProduct.brand}</span></span>}
 </div>
 )}

 {/* Stock Adjustment Log */}
 {selectedProduct.stockAdjustmentLog?.length > 0 && (
 <div className="mt-4">
 <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Recent Stock Changes</p>
 <div className="space-y-1.5 max-h-40 overflow-y-auto">
 {[...selectedProduct.stockAdjustmentLog].reverse().slice(0, 5).map((log: any, i: number) => (
 <div key={i} className="flex items-center justify-between bg-white/5 px-3 py-2 text-xs">
 <div>
 <span className="font-medium text-white/80 capitalize">{(log.reason || '').replace(/_/g, ' ')}</span>
 {log.note && <span className="text-white/40 ml-1">— {log.note}</span>}
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <span className="text-white/40">{log.previousQty}</span>
 <svg className="w-3 h-3 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
 <span className={`font-medium ${log.newQty === 0 ? 'text-red-400' : 'text-white'}`}>{log.newQty}</span>
 <span className="text-white/30 ml-1">{log.timestamp ? timeAgo(log.timestamp) : ''}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Supplier Details */}
 {selectedSupplier && (
 <div className="px-6 py-4">
 <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Supplier</h4>
 <Link
 href={`/admin/suppliers/${selectedSupplier._id}`}
 className="flex items-center gap-3 p-3 bg-white/5 hover:bg-accent/10 transition-colors group"
 >
 <div className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold shrink-0">
 {(selectedSupplier.name || '?')[0].toUpperCase()}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-white group-hover:text-accent transition-colors truncate">{selectedSupplier.name}</p>
 <p className="text-xs text-white/50 truncate">{selectedSupplier.businessName}</p>
 <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
 {selectedSupplier.phone && <span>{selectedSupplier.phone}</span>}
 {selectedSupplier.city && <span>{selectedSupplier.city}</span>}
 <StatusBadge status={selectedSupplier.isActive ? 'Active' : 'Inactive'} />
 </div>
 </div>
 <svg className="w-4 h-4 text-white/30 group-hover:text-blue-400 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
 </Link>
 </div>
 )}

 {/* Fallback if no product/supplier data */}
 {!selectedProduct && !selectedSupplier && (
 <div className="px-6 py-4">
 <div className="bg-white/5 p-4 text-center">
 <p className="text-sm text-white/40">
 {selectedNotif.fromName && (
 <span>From: <span className="font-medium text-white/60">{selectedNotif.fromName}</span></span>
 )}
 </p>
 {selectedNotif.from && (
 <Link
 href={`/admin/suppliers/${selectedNotif.from}`}
 className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 transition-colors"
 >
 View Supplier Profile
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
 </Link>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
