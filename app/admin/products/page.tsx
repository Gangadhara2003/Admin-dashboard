'use client';

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import KPICard from '../../../components/KPICard';
import TabBar from '../../../components/TabBar';


function formatCurrency(val: number) {
 return '₹' + parseFloat(String(val)).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function AdminProductsPage() {
 // --- Data Source Toggle ---
 const [source, setSource] = useState<'shopify' | 'mongodb'>('shopify');

 // --- Shopify State ---
 const [shopifyProducts, setShopifyProducts] = useState<any[]>([]);
 const [shopifyLoading, setShopifyLoading] = useState(true);

 // --- MongoDB State ---
 const [mongoProducts, setMongoProducts] = useState<any[]>([]);
 const [mongoLoading, setMongoLoading] = useState(true);

 // --- Supplier Products & Suppliers (for cross-referencing Shopify ↔ Supplier) ---
 const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
 const [allSuppliers, setAllSuppliers] = useState<any[]>([]);



 // --- Shared State ---
 const [activeTab, setActiveTab] = useState('all');
 const [search, setSearch] = useState('');
 const [selectedSupplier, setSelectedSupplier] = useState('');
 const [selectedVendor, setSelectedVendor] = useState('');
 const [selectedType, setSelectedType] = useState('');
 const [sortOption, setSortOption] = useState('newest');
 const [viewProduct, setViewProduct] = useState<any>(null);
 const [currentImageIndex, setCurrentImageIndex] = useState(0);

 // --- MongoDB Edit Modal ---
 const [isEditOpen, setIsEditOpen] = useState(false);
 const [editProduct, setEditProduct] = useState<any>(null);
 const [editForm, setEditForm] = useState({ name: '', description: '', price: '', stock: '', category: '', unit: 'pcs', isAvailable: true });
 const [editImages, setEditImages] = useState<{ url: string; file: File | null; isNew: boolean }[]>([]);
 const [saving, setSaving] = useState(false);
 const [editError, setEditError] = useState('');

 // --- Shopify Edit Modal ---
 const [isShopifyModalOpen, setIsShopifyModalOpen] = useState(false);
 const [shopifyEditProduct, setShopifyEditProduct] = useState<any>(null);
 const [shopifyForm, setShopifyForm] = useState({ title: '', description: '', price: '', stock: '', vendor: '', type: '', comparePrice: '', sku: '' });
 const [shopifyImages, setShopifyImages] = useState<string>(''); // comma separated URLs for simplicity
 const [shopifySaving, setShopifySaving] = useState(false);
 const [shopifyError, setShopifyError] = useState('');

 // Fetch Shopify products
 const fetchShopify = async () => {
 setShopifyLoading(true);
 try {
 const res = await fetch('/api/shopify/products');
 const data = await res.json();
 setShopifyProducts(data.products || []);
 } catch (err) { console.error(err); }
 finally { setShopifyLoading(false); }
 };
 useEffect(() => { fetchShopify(); }, []);

 // Fetch MongoDB products
 const fetchMongo = async () => {
 setMongoLoading(true);
 try {
 const res = await fetch('/api/admin/products');
 const data = await res.json();
 setMongoProducts(data.products || []);
 } catch (err) { console.error(err); }
 finally { setMongoLoading(false); }
 };
 useEffect(() => { fetchMongo(); }, []);

 // Fetch Supplier Products & Suppliers (for Shopify ↔ Supplier cross-reference)
 const fetchSupplierProducts = async () => {
 try {
 const [spRes, supRes] = await Promise.all([
 fetch('/api/supplier-products'),
 fetch('/api/admin/suppliers'),
 ]);
 const spData = await spRes.json();
 const supData = await supRes.json();
 setSupplierProducts(spData.products || []);
 setAllSuppliers(supData.suppliers || []);
 } catch (err) { console.error(err); }
 };
 useEffect(() => { fetchSupplierProducts(); }, []);



 const loading = source === 'shopify' ? shopifyLoading : mongoLoading;

 // ========== SHOPIFY HELPERS ==========
 const getShopifyData = () => {
 const products = shopifyProducts;
 const active = products.filter(p => p.status === 'active');
 const draft = products.filter(p => p.status === 'draft');
 const lowStock = products.filter(p => p.total_inventory > 0 && p.total_inventory <= 10);
 const outOfStock = products.filter(p => (p.total_inventory || 0) <= 0);
 const vendors = [...new Set(products.map(p => p.vendor).filter(Boolean))] as string[];
 const types = [...new Set(products.map(p => p.product_type).filter(Boolean))] as string[];

 // Build supplier options from SupplierProduct records linked to Shopify, with real name + businessName
 const supplierLookup = new Map<string, { name: string; businessName: string }>();
 allSuppliers.forEach(s => supplierLookup.set(s._id, { name: s.name, businessName: s.businessName }));

 const spSupplierMap = new Map<string, { _id: string; name: string; businessName: string }>();
 supplierProducts.forEach(sp => {
 const id = sp.supplierId?._id || sp.supplierId;
 if (id && !spSupplierMap.has(id)) {
 const info = supplierLookup.get(id);
 spSupplierMap.set(id, { _id: id, name: info?.name || sp.supplierName || '', businessName: info?.businessName || sp.supplierName || '' });
 }
 });
 const supplierOptions = Array.from(spSupplierMap.values());

 // Build set of Shopify product IDs belonging to selected supplier
 let supplierShopifyIds: Set<string> | null = null;
 if (selectedSupplier) {
 supplierShopifyIds = new Set(
 supplierProducts
 .filter(sp => (sp.supplierId._id || sp.supplierId) === selectedSupplier && sp.shopifyProductId)
 .map(sp => String(sp.shopifyProductId))
 );
 }

 let filtered = activeTab === 'all' ? products : activeTab === 'active' ? active : activeTab === 'draft' ? draft : activeTab === 'low' ? lowStock : activeTab === 'out' ? outOfStock : products;
 if (search) { const q = search.toLowerCase(); filtered = filtered.filter(p => p.title?.toLowerCase().includes(q) || p.vendor?.toLowerCase().includes(q) || p.product_type?.toLowerCase().includes(q)); }
 if (supplierShopifyIds) filtered = filtered.filter(p => supplierShopifyIds!.has(String(p.id)));
 if (selectedVendor) filtered = filtered.filter(p => p.vendor === selectedVendor);
 if (selectedType) filtered = filtered.filter(p => p.product_type === selectedType);
 filtered = [...filtered].sort((a, b) => {
 if (sortOption === 'priceAsc') return parseFloat(a.variants?.[0]?.price || 0) - parseFloat(b.variants?.[0]?.price || 0);
 if (sortOption === 'priceDesc') return parseFloat(b.variants?.[0]?.price || 0) - parseFloat(a.variants?.[0]?.price || 0);
 if (sortOption === 'stockAsc') return (a.total_inventory || 0) - (b.total_inventory || 0);
 return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
 });

 const tabs = [
 { key: 'all', label: 'All', count: products.length },
 { key: 'active', label: 'Active', count: active.length },
 { key: 'draft', label: 'Draft', count: draft.length },
 { key: 'low', label: 'Low Stock', count: lowStock.length },
 { key: 'out', label: 'Out of Stock', count: outOfStock.length },
 ];
 const kpis = [
 { title: 'Total Products', value: products.length, color: 'blue' as const },
 { title: 'Active', value: active.length, color: 'emerald' as const },
 { title: 'Total Inventory', value: products.reduce((s, p) => s + (p.total_inventory || 0), 0).toLocaleString(), color: 'indigo' as const },
 { title: 'Out of Stock', value: outOfStock.length, color: 'red' as const },
 ];
 return { filtered, tabs, kpis, vendors, types, supplierOptions };
 };

 const openShopifyCreate = () => {
 setShopifyEditProduct(null);
 setShopifyForm({ title: '', description: '', price: '', stock: '', vendor: '', type: '', comparePrice: '', sku: '' });
 setShopifyImages('');
 setShopifyError('');
 setIsShopifyModalOpen(true);
 };

 const openShopifyEdit = (product: any) => {
 setShopifyEditProduct(product);
 const v = product.variants?.[0] || {};
 setShopifyForm({
 title: product.title || '',
 description: '', // GQL doesn't fetch body_html by default, so leave empty/ignore
 price: v.price || '',
 comparePrice: v.compare_at_price || '',
 sku: v.sku || '',
 stock: v.inventory_quantity?.toString() || '0',
 vendor: product.vendor || '',
 type: product.product_type || '',
 });
 setShopifyImages((product.images || []).map((img: any) => img.src).join('\n'));
 setShopifyError('');
 setIsShopifyModalOpen(true);
 };

 const handleShopifySave = async (e: FormEvent) => {
 e.preventDefault();
 setShopifySaving(true);
 setShopifyError('');
 try {
 const payload: any = {
 title: shopifyForm.title,
 description: shopifyForm.description,
 vendor: shopifyForm.vendor,
 product_type: shopifyForm.type,
 variants: [{
 price: shopifyForm.price,
 compare_at_price: shopifyForm.comparePrice || null,
 sku: shopifyForm.sku,
 inventory_quantity: Number(shopifyForm.stock),
 }],
 };

 if (shopifyImages.trim()) {
 payload.images = shopifyImages.split('\n').map(url => url.trim()).filter(Boolean);
 }

 if (shopifyEditProduct) {
 payload.product_id = shopifyEditProduct.id;
 const res = await fetch('/api/shopify/products', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to update Shopify product');
 } else {
 const res = await fetch('/api/shopify/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to create Shopify product');
 }

 setIsShopifyModalOpen(false);
 fetchShopify(); // Refresh list
 } catch (err: any) {
 setShopifyError(err.message);
 } finally {
 setShopifySaving(false);
 }
 };

 const handleShopifyDelete = async (id: string) => {
 if (!confirm('Are you sure you want to delete this product from Shopify?')) return;
 try {
 const res = await fetch(`/api/shopify/products?id=${id}`, { method: 'DELETE' });
 if (res.ok) fetchShopify();
 else alert('Failed to delete Shopify product');
 } catch { alert('Error deleting product'); }
 };


 // ========== MONGODB HELPERS ==========
 const getMongoData = () => {
 const products = mongoProducts;
 const inStock = products.filter(p => p.isAvailable && p.stock > 0);
 const outOfStock = products.filter(p => !p.isAvailable || p.stock <= 0);
 const suppliers = [...new Set(products.map(p => p.supplier?.businessName).filter(Boolean))] as string[];
 const categories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];

 // Build unique supplier options with name + businessName
 const supplierMap = new Map<string, { _id: string; name: string; businessName: string }>();
 products.forEach(p => {
 if (p.supplier?._id && !supplierMap.has(p.supplier._id)) {
 supplierMap.set(p.supplier._id, { _id: p.supplier._id, name: p.supplier.name, businessName: p.supplier.businessName });
 }
 });
 const supplierOptions = Array.from(supplierMap.values());

 let filtered = activeTab === 'all' ? products : activeTab === 'active' ? inStock : activeTab === 'out' ? outOfStock : products;
 if (search) { const q = search.toLowerCase(); filtered = filtered.filter(p => p.name?.toLowerCase().includes(q) || p.supplier?.businessName?.toLowerCase().includes(q) || p.supplier?.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)); }
 if (selectedSupplier) filtered = filtered.filter(p => p.supplier?._id === selectedSupplier);
 if (selectedType) filtered = filtered.filter(p => p.category === selectedType);
 filtered = [...filtered].sort((a, b) => {
 if (sortOption === 'priceAsc') return (a.price || 0) - (b.price || 0);
 if (sortOption === 'priceDesc') return (b.price || 0) - (a.price || 0);
 if (sortOption === 'stockAsc') return (a.stock || 0) - (b.stock || 0);
 return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
 });

 const tabs = [
 { key: 'all', label: 'All', count: products.length },
 { key: 'active', label: 'In Stock', count: inStock.length },
 { key: 'out', label: 'Out of Stock', count: outOfStock.length },
 ];
 const kpis = [
 { title: 'Total Products', value: products.length, color: 'blue' as const },
 { title: 'In Stock', value: inStock.length, color: 'emerald' as const },
 { title: 'Total Stock', value: products.reduce((s, p) => s + (p.stock || 0), 0).toLocaleString(), color: 'indigo' as const },
 { title: 'Out of Stock', value: outOfStock.length, color: 'red' as const },
 ];
 return { filtered, tabs, kpis, vendors: suppliers, types: categories, supplierOptions };
 };

 const data = source === 'shopify' ? getShopifyData() : getMongoData();

 // MongoDB edit handlers
 const openEditModal = (product: any) => {
 setEditProduct(product);
 setEditForm({ name: product.name || '', description: product.description || '', price: product.price || '', stock: product.stock || '', category: product.category || '', unit: product.unit || 'pcs', isAvailable: product.isAvailable !== false });
 setEditImages((product.images || []).map((url: string) => ({ url, file: null, isNew: false })));
 setEditError(''); setIsEditOpen(true);
 };
 const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) setEditImages(prev => [...prev, ...Array.from(e.target.files!).map(file => ({ url: URL.createObjectURL(file), file, isNew: true }))]); };
 const removeImage = (i: number) => setEditImages(prev => { const u = [...prev]; u.splice(i, 1); return u; });
 const handleSave = async (e: FormEvent) => {
 e.preventDefault(); setSaving(true); setEditError('');
 try {
 const finalImages: string[] = [];
 for (const img of editImages) { if (img.isNew && img.file) { const fd = new FormData(); fd.append('file', img.file); const res = await fetch('/api/upload', { method: 'POST', body: fd }); const d = await res.json(); if (res.ok && d.url) finalImages.push(d.url); } else finalImages.push(img.url); }
 const payload = { ...editForm, price: Number(editForm.price), stock: Number(editForm.stock), images: finalImages };
 const res = await fetch(`/api/admin/products/${editProduct._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
 if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
 setIsEditOpen(false); fetchMongo();
 } catch (err: any) { setEditError(err.message); } finally { setSaving(false); }
 };
 const handleDelete = async (id: string) => { if (!confirm('Delete this product?')) return; try { const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' }); if (res.ok) fetchMongo(); else alert('Delete failed'); } catch { alert('Error'); } };
 const handleDownload = async (url: string, filename: string) => {
 try { const res = await fetch(url); const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href); } catch { alert('Download failed'); }
 };

 const [addingToShopify, setAddingToShopify] = useState<string | null>(null);
 const handleAddToShopify = async (product: any) => {
 if (!confirm(`Add "${product.name}" to Shopify as a draft product?`)) return;
 setAddingToShopify(product._id);
 try {
 const payload: any = {
 title: product.name,
 description: product.description || '',
 vendor: product.supplier?.businessName || '',
 product_type: product.category || '',
 variants: [{
 price: String(product.price || 0),
 inventory_quantity: product.stock || 0,
 }],
 };
 // Images are intentionally omitted to prevent Shopify "Image URL is invalid" errors for local paths.
 const res = await fetch('/api/shopify/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to add to Shopify');
 alert(`"${product.name}" added to Shopify as draft!`);
 fetchShopify();
 } catch (err: any) { alert(err.message); }
 finally { setAddingToShopify(null); }
 };

 // Shared badge helpers
 const getStockBadge = (p: any) => {
 if (source === 'shopify') {
 const qty = p.total_inventory || 0;
 if (qty <= 0) return <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-red-500/10 text-red-400 border border-red-500/10">Out of Stock</span>;
 if (qty <= 10) return <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-yellow-500/100/10 text-yellow-400 border border-yellow-500/10">Low ({qty})</span>;
 return <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-green-500/100/10 text-green-400 border border-green-500/10">{qty} in stock</span>;
 } else {
 const inStock = p.isAvailable && p.stock > 0;
 return inStock
 ? <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-green-500/100/10 text-green-400 border border-green-500/10">{p.stock} {p.unit || 'pcs'}</span>
 : <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-red-500/10 text-red-400 border border-red-500/10">Out of Stock</span>;
 }
 };
 const getStatusBadge = (status: string) => {
 if (status === 'active') return <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-green-500/100/20 text-green-400">Active</span>;
 if (status === 'draft') return <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-white/10 text-white/50">Draft</span>;
 return <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-yellow-500/100/20 text-yellow-400">{status}</span>;
 };

 const inputClass = "w-full px-3 py-2.5 bg-white/5 border-2 border-white/10 text-sm text-white transition-all focus:outline-none focus:border-accent ";

 // Loading skeleton
 if (loading) {
 return (
 <div>
 <h1 className="text-2xl font-bold text-white mb-6">Products</h1>
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white/5 border-2 border-white/10 p-5 animate-pulse"><div className="h-4 bg-white/10 rounded w-2/3 mb-2" /><div className="h-6 bg-white/10 rounded w-1/2" /></div>)}</div>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-white/5 border-2 border-white/10 overflow-hidden animate-pulse"><div className="w-full aspect-square bg-white/10" /><div className="p-4"><div className="h-4 bg-white/10 rounded w-3/4 mb-2" /><div className="h-3 bg-white/10 rounded w-1/2" /></div></div>)}</div>
 </div>
 );
 }

 return (
 <div>
 {/* Header with Source Toggle \& Add Shopify Product Button */}
 <div className="flex justify-between items-center mb-6">
 <div>
 <h1 className="text-2xl font-bold text-white mb-2">Products</h1>
 <div className="flex items-center gap-4">
 <p className="text-sm text-white/50 mt-1">{data.filtered.length} products from {source === 'shopify' ? 'Shopify' : 'Local Database'}</p>
 {source === 'shopify' && (
 <button onClick={openShopifyCreate} className="px-3 py-1.5 bg-green-500/100/10 text-green-400 text-xs font-bold uppercase tracking-wider rounded hover:bg-green-500/100/20 transition-colors">
 + Draft Product
 </button>
 )}
 </div>
 </div>
 <div className="flex items-center gap-1 bg-white/10 p-1">
 <button onClick={() => { setSource('shopify'); setActiveTab('all'); setSelectedSupplier(''); setSelectedVendor(''); setSelectedType(''); }} className={`px-4 py-2 text-sm font-medium transition-all ${source === 'shopify' ? 'bg-white/5 text-accent ' : 'text-white/50 hover:text-white/80'}`}>
 <span className="flex items-center gap-1.5">
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M15.337 3.2c-.157-.02-.312.06-.39.2l-.93 1.6a5.2 5.2 0 00-1.57-.25c-2.84 0-5.15 2.47-5.15 5.52 0 2.12 1.15 3.56 2.84 3.56.8 0 1.5-.37 2.1-1.1l-.1.4c-.06.24.06.48.28.56l1.42.5c.22.08.46-.04.54-.28l2.2-8.13c.3-1.12.1-1.9-.36-2.42-.1-.1-.2-.17-.3-.22zm-3.6 3.1c.35 0 .65.08.9.22l-1.37 5.03c-.32.37-.65.55-.96.55-.6 0-.96-.6-.96-1.6 0-2.03 1.13-4.2 2.4-4.2z"/></svg>
 Shopify
 </span>
 </button>
 <button onClick={() => { setSource('mongodb'); setActiveTab('all'); setSelectedSupplier(''); setSelectedVendor(''); setSelectedType(''); }} className={`px-4 py-2 text-sm font-medium transition-all ${source === 'mongodb' ? 'bg-white/5 text-green-400 ' : 'text-white/50 hover:text-white/80'}`}>
 <span className="flex items-center gap-1.5">
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
 Local DB
 </span>
 </button>
 </div>
 </div>

 {/* KPI Cards */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 {data.kpis.map((k, i) => <KPICard key={i} {...k} />)}
 </div>

 {/* Tabs */}
 <TabBar tabs={data.tabs} activeTab={activeTab} onTabChange={setActiveTab} />

 {/* Filters */}
 <div className="bg-white/5 border-2 border-white/10 p-4 mb-6">
 <div className={`grid grid-cols-1 sm:grid-cols-2 ${source === 'shopify' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
 <input type="text" placeholder="Search products..." className={inputClass} value={search} onChange={e => setSearch(e.target.value)} />
 <select className={inputClass} value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
 <option value="">All Suppliers</option>
 {data.supplierOptions.map(s => <option key={s._id} value={s._id}>{s.name} — {s.businessName}</option>)}
 </select>
 {source === 'shopify' && (
 <select className={inputClass} value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)}>
 <option value="">All Vendors</option>
 {data.vendors.map(v => <option key={v} value={v}>{v}</option>)}
 </select>
 )}
 <select className={inputClass} value={selectedType} onChange={e => setSelectedType(e.target.value)}>
 <option value="">{source === 'shopify' ? 'All Types' : 'All Categories'}</option>
 {data.types.map(t => <option key={t} value={t}>{t}</option>)}
 </select>
 <select className={inputClass} value={sortOption} onChange={e => setSortOption(e.target.value)}>
 <option value="newest">Newest First</option>
 <option value="priceAsc">Price: Low → High</option>
 <option value="priceDesc">Price: High → Low</option>
 <option value="stockAsc">Stock: Low → High</option>
 </select>
 </div>
 </div>

 {/* Product Grid */}
 {data.filtered.length === 0 ? (
 <div className="bg-white/5 border-2 border-white/10 p-12 text-center">
 <p className="text-white/40 text-lg">No products match your filters.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
 {data.filtered.map((p: any) => {
 if (source === 'shopify') {
 return (
 <ShopifyCard 
 key={p.id} 
 p={p} 
 getStatusBadge={getStatusBadge} 
 getStockBadge={getStockBadge} 
 onView={() => { setViewProduct(p); setCurrentImageIndex(0); }}
 onEdit={() => openShopifyEdit(p)}
 onDelete={() => handleShopifyDelete(p.id)}
 />
 );
 }
 return <MongoCard key={p._id} p={p} getStockBadge={getStockBadge} onEdit={() => openEditModal(p)} onDelete={() => handleDelete(p._id)} onView={() => { setViewProduct(p); setCurrentImageIndex(0); }} onAddToShopify={() => handleAddToShopify(p)} addingToShopify={addingToShopify === p._id} onDownload={handleDownload} />;
 })}
 </div>
 )}

 {/* ===== Shopify Product Edit/Create Modal ===== */}
 {isShopifyModalOpen && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]" onClick={() => !shopifySaving && setIsShopifyModalOpen(false)}>
 <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white/5 border-2 border-white/10 p-6" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-6">
 <h2 className="text-xl font-semibold">{shopifyEditProduct ? 'Edit Shopify Product' : 'Create Draft Product'}</h2>
 <button onClick={() => !shopifySaving && setIsShopifyModalOpen(false)} className="text-white/40 text-2xl hover:text-white">&times;</button>
 </div>
 
 {!shopifyEditProduct && (
 <div className="mb-4 bg-yellow-500/100/10 border border-yellow-500/20 p-3 text-sm text-yellow-400">
 <strong>Important:</strong> Products are always created as <strong>Draft</strong> and cannot be published from this dashboard. Use the Shopify admin panel to make them active.
 </div>
 )}

 {shopifyError && <div className="text-red-400 text-sm mb-4">{shopifyError}</div>}
 <form onSubmit={handleShopifySave}>
 <div className="mb-4">
 <label className="block mb-1 text-white/50 text-sm font-medium">Title *</label>
 <input required type="text" className={inputClass} value={shopifyForm.title} onChange={e => setShopifyForm({ ...shopifyForm, title: e.target.value })} />
 </div>
 <div className="grid grid-cols-2 gap-4 mb-4">
 <div>
 <label className="block mb-1 text-white/50 text-sm font-medium">Price (₹) *</label>
 <input required min="0" step="0.01" type="number" className={inputClass} value={shopifyForm.price} onChange={e => setShopifyForm({ ...shopifyForm, price: e.target.value })} />
 </div>
 <div>
 <label className="block mb-1 text-white/50 text-sm font-medium">Compare At Price</label>
 <input min="0" step="0.01" type="number" className={inputClass} value={shopifyForm.comparePrice} onChange={e => setShopifyForm({ ...shopifyForm, comparePrice: e.target.value })} />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4 mb-4">
 <div>
 <label className="block mb-1 text-white/50 text-sm font-medium">Stock Quantity *</label>
 <input required min="0" type="number" className={inputClass} value={shopifyForm.stock} onChange={e => setShopifyForm({ ...shopifyForm, stock: e.target.value })} />
 </div>
 <div>
 <label className="block mb-1 text-white/50 text-sm font-medium">SKU</label>
 <input type="text" className={inputClass} value={shopifyForm.sku} onChange={e => setShopifyForm({ ...shopifyForm, sku: e.target.value })} />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4 mb-4">
 <div>
 <label className="block mb-1 text-white/50 text-sm font-medium">Vendor</label>
 <input type="text" className={inputClass} value={shopifyForm.vendor} onChange={e => setShopifyForm({ ...shopifyForm, vendor: e.target.value })} />
 </div>
 <div>
 <label className="block mb-1 text-white/50 text-sm font-medium">Product Type</label>
 <input type="text" className={inputClass} value={shopifyForm.type} onChange={e => setShopifyForm({ ...shopifyForm, type: e.target.value })} />
 </div>
 </div>
 {!shopifyEditProduct && ( // Hide description on edit since GQL didn't fetch it
 <div className="mb-4">
 <label className="block mb-1 text-white/50 text-sm font-medium">Description (HTML)</label>
 <textarea className={inputClass} rows={3} value={shopifyForm.description} onChange={e => setShopifyForm({ ...shopifyForm, description: e.target.value })} />
 </div>
 )}
 <div className="mb-4">
 <label className="block mb-1 text-white/50 text-sm font-medium">Image URLs (one per line)</label>
 <textarea className={inputClass} rows={3} placeholder="https://example.com/image1.jpg" value={shopifyImages} onChange={e => setShopifyImages(e.target.value)} />
 </div>
 
 <div className="flex justify-end gap-2 pt-4">
 <button type="button" className="px-5 py-2.5 bg-white/10 text-white font-medium hover:bg-white/10" onClick={() => setIsShopifyModalOpen(false)}>Cancel</button>
 <button type="submit" className="px-5 py-2.5 bg-accent text-white font-medium shadow hover:bg-accent/80 disabled:opacity-70" disabled={shopifySaving}>
 {shopifySaving ? 'Saving...' : (shopifyEditProduct ? 'Save Updates' : 'Create Draft Product')}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* ===== Shopify Product Detail Modal (View Only) ===== */}
 {viewProduct && source === 'shopify' && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]" onClick={() => setViewProduct(null)}>
 <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white/5 border-2 border-white/10" onClick={e => e.stopPropagation()}>
 <div className="flex items-center justify-between p-5 border-b border-white/5">
 <div className="flex items-center gap-3 min-w-0">{getStatusBadge(viewProduct.status)}<h2 className="text-lg font-bold text-white truncate">{viewProduct.title}</h2></div>
 <button onClick={() => setViewProduct(null)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white text-xl shrink-0">&times;</button>
 </div>
 {viewProduct.images?.length > 0 && (
 <div className="relative bg-white/5">
 <img src={viewProduct.images[currentImageIndex]?.src} alt={viewProduct.title} className="w-full aspect-video object-contain" />
 {viewProduct.images.length > 1 && (
 <>
 <button onClick={() => setCurrentImageIndex(i => Math.max(0, i - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow" disabled={currentImageIndex === 0}>‹</button>
 <button onClick={() => setCurrentImageIndex(i => Math.min(viewProduct.images.length - 1, i + 1))} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow" disabled={currentImageIndex === viewProduct.images.length - 1}>›</button>
 <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">{viewProduct.images.map((_: any, i: number) => <button key={i} onClick={() => setCurrentImageIndex(i)} className={`w-2 h-2 rounded-full transition-all ${i === currentImageIndex ? 'bg-accent scale-125' : 'bg-white/60'}`} />)}</div>
 </>
 )}
 </div>
 )}
 <div className="p-5 space-y-5">
 <div className="flex items-center justify-between">
 <div className="flex items-baseline gap-2">
 <span className="text-2xl font-bold text-white">{formatCurrency(viewProduct.variants?.[0]?.price)}</span>
 {viewProduct.variants?.[0]?.compare_at_price && parseFloat(viewProduct.variants[0].compare_at_price) > parseFloat(viewProduct.variants[0].price) && <span className="text-base text-white/40 line-through">{formatCurrency(viewProduct.variants[0].compare_at_price)}</span>}
 </div>
 {getStockBadge(viewProduct)}
 </div>
 {viewProduct.body_html && (
 <div>
 <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Description</p>
 <div className="text-sm text-white/60 leading-relaxed" dangerouslySetInnerHTML={{ __html: viewProduct.body_html }} />
 </div>
 )}
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 {[
 { label: 'Vendor', val: viewProduct.vendor },
 { label: 'Type', val: viewProduct.product_type },
 { label: 'Total Inventory', val: viewProduct.total_inventory },
 { label: 'Variants', val: viewProduct.variants?.length },
 { label: 'Status', val: viewProduct.status?.charAt(0).toUpperCase() + viewProduct.status?.slice(1) },
 { label: 'Created', val: viewProduct.created_at ? new Date(viewProduct.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null },
 ].map((m, i) => (
 <div key={i} className="bg-white/5 p-3"><p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{m.label}</p><p className="text-sm font-medium text-white">{m.val ?? 'N/A'}</p></div>
 ))}
 </div>
 {viewProduct.tags?.length > 0 && <div><p className="text-[11px] text-white/40 uppercase tracking-wider mb-2">Tags</p><div className="flex flex-wrap gap-1.5">{viewProduct.tags.map((t: string, i: number) => <span key={i} className="px-2 py-0.5 text-xs bg-white/10 text-white/60 rounded-full">{t}</span>)}</div></div>}
 {viewProduct.variants?.length > 0 && (
 <div>
 <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2">Variants ({viewProduct.variants.length})</p>
 <div className="border-2 border-white/10 overflow-hidden">
 <table className="w-full text-sm">
 <thead><tr className="bg-white/5"><th className="text-left px-3 py-2 text-[11px] text-white/50 font-medium">Variant</th><th className="text-left px-3 py-2 text-[11px] text-white/50 font-medium">SKU</th><th className="text-right px-3 py-2 text-[11px] text-white/50 font-medium">Price</th><th className="text-right px-3 py-2 text-[11px] text-white/50 font-medium">Stock</th></tr></thead>
 <tbody>{viewProduct.variants.map((v: any, i: number) => <tr key={i} className="border-t border-white/5"><td className="px-3 py-2 text-white/80">{v.title || 'Default'}</td><td className="px-3 py-2 text-white/40 font-mono text-xs">{v.sku || '—'}</td><td className="px-3 py-2 text-right font-medium">{formatCurrency(v.price)}</td><td className={`px-3 py-2 text-right font-bold ${(v.inventory_quantity || 0) <= 0 ? 'text-red-400' : v.inventory_quantity <= 10 ? 'text-yellow-400' : 'text-white'}`}>{v.inventory_quantity ?? '—'}</td></tr>)}</tbody>
 </table>
 </div>
 </div>
 )}
 <div className="flex gap-2 pt-3 border-t border-white/5">
 <button onClick={() => { setViewProduct(null); openShopifyEdit(viewProduct); }} className="flex-1 px-4 py-2 text-sm bg-accent/10 text-accent font-medium hover:bg-accent/20">Edit Product</button>
 <button onClick={() => { setViewProduct(null); handleShopifyDelete(viewProduct.id); }} className="px-4 py-2 text-sm bg-red-500/10 text-red-400 font-medium hover:bg-red-500/100/20">Delete</button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* ===== MongoDB Product Detail Modal ===== */}
 {viewProduct && source === 'mongodb' && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]" onClick={() => setViewProduct(null)}>
 <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white/5 border-2 border-white/10" onClick={e => e.stopPropagation()}>
 <div className="flex items-center justify-between p-5 border-b border-white/5">
 <h2 className="text-lg font-bold text-white">{viewProduct.name}</h2>
 <button onClick={() => setViewProduct(null)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white text-xl">&times;</button>
 </div>
 {viewProduct.images?.length > 0 && (
 <div className="relative">
 <img src={viewProduct.images[currentImageIndex]} alt={viewProduct.name} className="w-full aspect-video object-contain bg-white/5" />
 {viewProduct.images.length > 1 && (
 <>
 <button onClick={() => setCurrentImageIndex(i => Math.max(0, i - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow" disabled={currentImageIndex === 0}>‹</button>
 <button onClick={() => setCurrentImageIndex(i => Math.min(viewProduct.images.length - 1, i + 1))} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow" disabled={currentImageIndex === viewProduct.images.length - 1}>›</button>
 </>
 )}
 </div>
 )}
 <div className="p-5 space-y-3">
 <div className="flex items-center justify-between"><span className="text-2xl font-bold text-white">₹{viewProduct.price}</span>{getStockBadge(viewProduct)}</div>
 <p className="text-sm text-white/60">{viewProduct.description || 'No description'}</p>
 <div className="grid grid-cols-2 gap-3">
 {[{ label: 'Supplier', val: viewProduct.supplier?.businessName }, { label: 'Category', val: viewProduct.category }, { label: 'Stock', val: `${viewProduct.stock} ${viewProduct.unit || 'pcs'}` }, { label: 'Phone', val: viewProduct.supplier?.phone }].map((m, i) => (
 <div key={i} className="bg-white/5 p-3"><p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">{m.label}</p><p className="text-sm font-medium text-white">{m.val || 'N/A'}</p></div>
 ))}
 </div>
 <div className="flex gap-2 pt-3 border-t border-white/5">
 <button onClick={() => { setViewProduct(null); openEditModal(viewProduct); }} className="flex-1 px-4 py-2 text-sm bg-accent/10 text-accent font-medium hover:bg-accent/20">Edit</button>
 {viewProduct.images?.length > 0 && (
 <button
 onClick={() => handleDownload(viewProduct.images[currentImageIndex], `${viewProduct.name || 'product'}-${currentImageIndex + 1}.jpg`)}
 className="px-4 py-2 text-sm text-white/60 bg-white/5 border-2 border-white/10 font-medium hover:bg-white/10 flex items-center gap-1.5"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
 Image
 </button>
 )}
 <button onClick={() => { setViewProduct(null); handleAddToShopify(viewProduct); }} disabled={addingToShopify === viewProduct._id} className="px-4 py-2 text-sm bg-green-500/100/10 text-green-400 font-medium hover:bg-green-500/100/20 disabled:opacity-50 whitespace-nowrap">
 {addingToShopify === viewProduct._id ? '...' : '+ Shopify'}
 </button>
 <button onClick={() => { setViewProduct(null); handleDelete(viewProduct._id); }} className="px-4 py-2 text-sm bg-red-500/10 text-red-400 font-medium hover:bg-red-500/100/20">Delete</button>
 </div>
 </div>
 </div>
 </div>
 )}


 {/* ===== MongoDB Edit Modal ===== */}
 {isEditOpen && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]" onClick={() => !saving && setIsEditOpen(false)}>
 <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white/5 border-2 border-white/10 p-6" onClick={e => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-semibold">Edit Product</h2><button onClick={() => !saving && setIsEditOpen(false)} className="text-white/40 text-2xl hover:text-white">&times;</button></div>
 {editError && <div className="text-red-400 text-sm mb-4">{editError}</div>}
 <form onSubmit={handleSave}>
 <div className="mb-4"><label className="block mb-1 text-white/50 text-sm font-medium">Product Name *</label><input required type="text" className={inputClass} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
 <div className="grid grid-cols-2 gap-4 mb-4">
 <div><label className="block mb-1 text-white/50 text-sm font-medium">Price (₹) *</label><input required min="0" step="0.01" type="number" className={inputClass} value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} /></div>
 <div><label className="block mb-1 text-white/50 text-sm font-medium">Stock *</label><input required min="0" type="number" className={inputClass} value={editForm.stock} onChange={e => setEditForm({ ...editForm, stock: e.target.value })} /></div>
 </div>
 <div className="grid grid-cols-2 gap-4 mb-4">
 <div><label className="block mb-1 text-white/50 text-sm font-medium">Unit</label><input type="text" className={inputClass} value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} /></div>
 <div><label className="block mb-1 text-white/50 text-sm font-medium">Category</label><input type="text" className={inputClass} value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} /></div>
 </div>
 <div className="mb-4"><label className="block mb-1 text-white/50 text-sm font-medium">Description</label><textarea className={inputClass} rows={3} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} /></div>
 <div className="mb-4"><label className="block mb-1 text-white/50 text-sm font-medium">Status</label><select className={inputClass} value={editForm.isAvailable ? 'true' : 'false'} onChange={e => setEditForm({ ...editForm, isAvailable: e.target.value === 'true' })}><option value="true">Available</option><option value="false">Unavailable</option></select></div>
 <div className="mb-4 border-t pt-4"><label className="text-white/50 text-sm font-medium mb-2 block">Images</label>
 <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3">
 {editImages.map((img, i) => <div key={i} className="relative"><img src={img.url} alt="" className="w-full aspect-square object-cover border" /><button type="button" onClick={() => removeImage(i)} className="absolute -top-1.5 -right-1.5 bg-red-500/100 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">&times;</button></div>)}
 <label className="aspect-square border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-accent bg-white/5"><input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" /><svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></label>
 </div>
 </div>
 <div className="flex justify-end gap-2"><button type="button" className="px-5 py-2.5 bg-white/10 text-white font-medium hover:bg-white/10" onClick={() => setIsEditOpen(false)}>Cancel</button><button type="submit" className="px-5 py-2.5 bg-accent text-white font-medium shadow hover:bg-accent/80 disabled:opacity-70" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></div>
 </form>
 </div>
 </div>
 )}


 </div>
 );
}

// ===== SHOPIFY PRODUCT CARD =====
function ShopifyCard({ p, getStatusBadge, getStockBadge, onView, onEdit, onDelete }: { p: any; getStatusBadge: (s: string) => React.ReactNode; getStockBadge: (p: any) => React.ReactNode; onView: () => void; onEdit: () => void; onDelete: () => void; }) {
 const price = p.variants?.[0]?.price;
 const comparePrice = p.variants?.[0]?.compare_at_price;
 const hasDiscount = comparePrice && parseFloat(comparePrice) > parseFloat(price);

 return (
 <div className="bg-white/5 border-2 border-white/10 overflow-hidden hover: hover:border-white/20 transition-all group flex flex-col h-full" onClick={onView}>
 <div className="relative aspect-[4/3] bg-white/5 overflow-hidden cursor-pointer">
 {p.images?.[0]?.src ? <img src={p.images[0].src} alt={p.title} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center text-white/30"><svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>}
 {p.images?.length > 1 && <span className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-[10px] font-bold ">{p.images.length} imgs</span>}
 <div className="absolute top-2 left-2">{getStatusBadge(p.status)}</div>
 {hasDiscount && <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-red-500/100 text-white text-[10px] font-bold rounded">{Math.round((1 - parseFloat(price) / parseFloat(comparePrice)) * 100)}% OFF</span>}
 </div>
 <div className="p-4 flex flex-col flex-grow">
 <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 mb-2 cursor-pointer">{p.title}</h3>
 <div className="flex items-center gap-2 mb-2">
 {p.vendor && <span className="text-[11px] text-white/50 bg-white/5 px-1.5 py-0.5 rounded">{p.vendor}</span>}
 {p.product_type && <span className="text-[11px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">{p.product_type}</span>}
 </div>
 <div className="flex items-baseline gap-2 mb-2 mt-auto">
 <span className="text-lg font-bold text-white">{formatCurrency(price)}</span>
 {hasDiscount && <span className="text-sm text-white/40 line-through">{formatCurrency(comparePrice)}</span>}
 </div>
 <div className="flex items-center justify-between mb-3">{getStockBadge(p)}{(p.variants?.length || 0) > 1 && <span className="text-[11px] text-white/40">{p.variants.length} variants</span>}</div>
 
 {/* Shopify Edit & Delete Actions */}
 <div className="flex gap-2 pt-3 border-t border-white/5">
 <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="flex-1 px-3 py-1.5 text-xs bg-accent/10 text-accent font-medium hover:bg-accent/20">Edit</button>
 <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 font-medium hover:bg-red-500/100/20">Delete</button>
 </div>
 </div>
 </div>
 );
}

// ===== MONGODB PRODUCT CARD =====
function MongoCard({ p, getStockBadge, onEdit, onDelete, onView, onAddToShopify, addingToShopify, onDownload }: { p: any; getStockBadge: (p: any) => React.ReactNode; onEdit: () => void; onDelete: () => void; onView: () => void; onAddToShopify: () => void; addingToShopify?: boolean; onDownload: (url: string, filename: string) => void }) {
 return (
 <div className="bg-white/5 border-2 border-white/10 overflow-hidden hover: hover:border-white/20 transition-all group flex flex-col h-full">
 <div className="relative aspect-[4/3] bg-white/5 overflow-hidden cursor-pointer" onClick={onView}>
 {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center text-white/30"><svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>}
 {p.images?.length > 1 && <span className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-[10px] font-bold ">{p.images.length} imgs</span>}
 </div>
 <div className="p-4 flex flex-col flex-grow">
 <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 mb-1 cursor-pointer" onClick={onView}>{p.name}</h3>
 <div className="flex items-center gap-2 mb-2">
 {p.supplier?.businessName && <span className="text-[11px] text-white/50 bg-white/5 px-1.5 py-0.5 rounded">{p.supplier.businessName}</span>}
 {p.category && <span className="text-[11px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">{p.category}</span>}
 </div>
 <div className="flex items-baseline gap-2 mb-2 mt-auto"><span className="text-lg font-bold text-white">₹{p.price}</span></div>
 <div className="flex items-center justify-between mb-3">{getStockBadge(p)}</div>
 <div className="flex gap-2 pt-3 border-t border-white/5">
 <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="flex-1 px-3 py-1.5 text-xs bg-accent/10 text-accent font-medium hover:bg-accent/20">Edit</button>
 <button onClick={(e) => { e.stopPropagation(); onAddToShopify(); }} disabled={addingToShopify} className="flex-1 px-3 py-1.5 text-xs bg-green-500/100/10 text-green-400 font-medium hover:bg-green-500/100/20 disabled:opacity-50 whitespace-nowrap">
 {addingToShopify ? '...' : '+ Shopify'}
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); if (p.images?.length > 0) onDownload(p.images[0], `${p.name || 'product'}.jpg`); }}
 disabled={!p.images || p.images.length === 0}
 className="px-3 py-1.5 text-xs text-white/60 bg-white/5 border-2 border-white/10 font-medium hover:bg-white/10 disabled:opacity-40 flex items-center justify-center gap-1"
 title="Download Image"
 >
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
 Image
 </button>
 <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 font-medium hover:bg-red-500/100/20">Delete</button>
 </div>
 </div>
 </div>
 );
}
