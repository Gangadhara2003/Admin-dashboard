'use client';

import { useState, useEffect, use, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import StatusBadge from '../../../../components/StatusBadge';

export default function SupplierDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const [supplier, setSupplier] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [supplierOrders, setSupplierOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderUpdating, setOrderUpdating] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'orders' | 'products'>('orders');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: '', stock: '', category: '', unit: 'pcs', isAvailable: true });
  const [productImages, setProductImages] = useState<{ url: string; file: File | null; isNew: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Supplier product detail modal
  const [spDetail, setSpDetail] = useState<any>(null);

  // Edit Supplier state
  const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false);
  const [supplierFormData, setSupplierFormData] = useState({ name: '', businessName: '', phone: '', password: '', email: '', address: '', city: '', state: '', pincode: '', isActive: true });
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [supplierError, setSupplierError] = useState('');

  const fetchSupplierData = async () => {
    try {
      const id = unwrappedParams.id;
      const [supRes, prodRes, spRes, ordRes] = await Promise.all([
        fetch(`/api/admin/suppliers/${id}`),
        fetch(`/api/admin/products?supplierId=${id}`),
        fetch(`/api/supplier-products?supplierId=${id}`),
        fetch(`/api/supplier-orders?supplierId=${id}`),
      ]);
      if (supRes.ok) { const d = await supRes.json(); setSupplier(d.supplier); }
      if (prodRes.ok) { const d = await prodRes.json(); setProducts(d.products || []); }
      if (spRes.ok) { const d = await spRes.json(); setSupplierProducts(d.products || []); }
      if (ordRes.ok) { const d = await ordRes.json(); setSupplierOrders(d.orders || []); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleOrderStatusUpdate = async (orderId: string, action: string) => {
    setOrderUpdating(orderId);
    try {
      const res = await fetch('/api/supplier-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action }),
      });
      if (res.ok) fetchSupplierData();
      else alert('Failed to update');
    } catch { alert('Error'); }
    finally { setOrderUpdating(null); }
  };

  useEffect(() => { if (unwrappedParams?.id) fetchSupplierData(); }, [unwrappedParams.id]);

  // --- Supplier Actions ---
  const openEditSupplierModal = () => {
    setSupplierFormData({
      name: supplier.name || '', businessName: supplier.businessName || '', phone: supplier.phone || '',
      password: '', email: supplier.email || '', address: supplier.address || '',
      city: supplier.city || '', state: supplier.state || '', pincode: supplier.pincode || '',
      isActive: supplier.isActive !== false,
    });
    setSupplierError('');
    setIsEditSupplierOpen(true);
  };

  const handleSaveSupplier = async (e: FormEvent) => {
    e.preventDefault(); setSupplierSaving(true); setSupplierError('');
    try {
      const res = await fetch(`/api/admin/suppliers/${unwrappedParams.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(supplierFormData) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update supplier');
      setIsEditSupplierOpen(false); fetchSupplierData();
    } catch (err: any) { setSupplierError(err.message); }
    finally { setSupplierSaving(false); }
  };

  const handleToggleActive = async () => {
    try {
      await fetch(`/api/admin/suppliers/${unwrappedParams.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !supplier.isActive }) });
      fetchSupplierData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteSupplier = async () => {
    if (!confirm('Are you sure you want to completely delete this supplier? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/suppliers/${unwrappedParams.id}`, { method: 'DELETE' });
      if (res.ok) { window.location.href = '/admin/suppliers'; }
      else { const d = await res.json(); alert(d.error || 'Failed to delete'); }
    } catch (err) { alert('Error connecting to server'); }
  };

  // --- Product Actions ---
  const openEditModal = (product: any) => {
    setCurrentProduct(product);
    setFormData({ name: product.name || '', description: product.description || '', price: product.price || '', stock: product.stock || '', category: product.category || '', unit: product.unit || 'pcs', isAvailable: product.isAvailable !== false });
    setProductImages((product.images || []).map((url: string) => ({ url, file: null, isNew: false })));
    setError(''); setIsModalOpen(true);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const n = Array.from(e.target.files).map(file => ({ url: URL.createObjectURL(file), file, isNew: true }));
      setProductImages(prev => [...prev, ...n]);
    }
  };

  const removeImage = (index: number) => { setProductImages(prev => { const u = [...prev]; u.splice(index, 1); return u; }); };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const finalImages: string[] = [];
      for (const img of productImages) {
        if (img.isNew && img.file) {
          const fd = new FormData(); fd.append('file', img.file);
          const res = await fetch('/api/upload', { method: 'POST', body: fd });
          const data = await res.json();
          if (res.ok && data.url) finalImages.push(data.url);
        } else { finalImages.push(img.url); }
      }
      const payload = { ...formData, price: Number(formData.price), stock: Number(formData.stock), images: finalImages };
      const res = await fetch(`/api/admin/products/${currentProduct._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save product');
      setIsModalOpen(false); fetchSupplierData();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDownload = async (url: string, filename: string) => {
    try { const response = await fetch(url); const blob = await response.blob(); const blobUrl = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = blobUrl; link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(blobUrl); }
    catch (err) { alert('Failed to download image'); }
  };

  const handleDownloadAllImages = async (product: any) => {
    if (!product.images || product.images.length === 0) return;
    try {
      setSaving(true);
      const zip = new JSZip();
      const folder = zip.folder(`${product.name}-images`)!;
      for (let i = 0; i < product.images.length; i++) {
        const response = await fetch(product.images[i]);
        const blob = await response.blob();
        folder.file(`${product.name}-${i + 1}.jpg`, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a'); link.href = url; link.download = `${product.name}-images.zip`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    } catch (err) { alert('Failed to generate ZIP'); }
    finally { setSaving(false); }
  };

  const handleDownloadAll = async () => {
    const existing = productImages.filter(img => !img.isNew);
    if (existing.length === 0) return;
    handleDownloadAllImages({ name: formData.name, images: existing.map(img => img.url) });
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try { const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' }); if (res.ok) fetchSupplierData(); else { const d = await res.json(); alert(d.error || 'Failed'); } }
    catch (err) { alert('Error'); }
  };

  const handleExportExcel = () => {
    if (products.length === 0) { alert('No products.'); return; }
    const d = products.map((p: any) => ({ 'Product Name': p.name, 'Description': p.description || '', 'Category': p.category || '', 'Price': p.price, 'Stock': p.stock, 'Unit': p.unit, 'Status': p.isAvailable && p.stock > 0 ? 'In Stock' : 'Out of Stock', 'Last Updated': p.lastUpdated ? new Date(p.lastUpdated).toLocaleDateString() : 'N/A' }));
    const ws = XLSX.utils.json_to_sheet(d); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `${supplier.businessName.replace(/[^a-z0-9]/gi, '_')}_all_products.xlsx`);
  };

  const handleExportSingleProduct = (p: any) => {
    const d = [{ 'Product Name': p.name, 'Supplier': supplier.businessName, 'Category': p.category || 'N/A', 'Price': p.price, 'Stock': p.stock, 'Unit': p.unit || 'pcs', 'Status': p.isAvailable && p.stock > 0 ? 'In Stock' : 'Out of Stock', 'Description': p.description || '', 'Last Updated': p.lastUpdated ? new Date(p.lastUpdated).toLocaleString() : 'N/A' }];
    const ws = XLSX.utils.json_to_sheet(d); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Product Detail');
    XLSX.writeFile(wb, `${p.name.replace(/[^a-z0-9]/gi, '_')}_details.xlsx`);
  };

  const inputClass = "w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const labelClass = "block mb-1.5 text-sm text-gray-500 font-medium";

  if (loading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 bg-gray-100 rounded w-1/4" />
      <div className="h-8 bg-gray-100 rounded w-1/3" />
      <div className="grid grid-cols-2 gap-6"><div className="h-40 bg-gray-100 rounded-xl" /><div className="h-40 bg-gray-100 rounded-xl" /></div>
    </div>
  );
  if (!supplier) return <div className="text-gray-500">Supplier not found.</div>;

  const inStockCount = products.filter(p => p.isAvailable && p.stock > 0).length;
  const outOfStockCount = products.filter(p => !p.isAvailable || p.stock <= 0).length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 mb-6">
        <div>
          <Link href="/admin/suppliers" className="text-gray-400 hover:text-gray-600 inline-flex items-center gap-1 mb-3 text-sm transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Suppliers
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {supplier.businessName?.charAt(0)?.toUpperCase() || 'S'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-800">{supplier.businessName}</h1>
                <StatusBadge status={supplier.isActive !== false ? 'Active' : 'Inactive'} />
              </div>
              <p className="text-sm text-gray-500">{supplier.name}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openEditSupplierModal} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Edit
          </button>
          <button onClick={handleToggleActive} className={`px-4 py-2 border rounded-lg text-sm font-medium transition-all ${supplier.isActive ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`}>
            {supplier.isActive ? 'Disable' : 'Enable'}
          </button>
          <button onClick={handleExportExcel} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
          <button onClick={handleDeleteSupplier} className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-100 transition-all flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete
          </button>
        </div>
      </div>

      {/* Supplier Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Contact Information
          </h3>
          <div className="space-y-3.5">
            <div><p className="text-xs text-gray-400 mb-0.5">Representative Name</p><p className="text-sm font-medium text-gray-700">{supplier.name}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Phone Number</p><p className="text-sm font-medium text-gray-700">{supplier.phone}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Email Address</p><p className="text-sm font-medium text-gray-700">{supplier.email || 'Not provided'}</p></div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Location Details
          </h3>
          <div className="space-y-3.5">
            <div><p className="text-xs text-gray-400 mb-0.5">Full Address</p><p className="text-sm font-medium text-gray-700">{supplier.address || 'Not provided'}</p></div>
            <div className="grid grid-cols-3 gap-4">
              <div><p className="text-xs text-gray-400 mb-0.5">City</p><p className="text-sm font-medium text-gray-700">{supplier.city || 'N/A'}</p></div>
              <div><p className="text-xs text-gray-400 mb-0.5">State</p><p className="text-sm font-medium text-gray-700">{supplier.state || 'N/A'}</p></div>
              <div><p className="text-xs text-gray-400 mb-0.5">Pincode</p><p className="text-sm font-medium text-gray-700">{supplier.pincode || 'N/A'}</p></div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{products.length}</p>
          <p className="text-xs text-blue-700 mt-1">Products</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{inStockCount}</p>
          <p className="text-xs text-emerald-700 mt-1">In Stock</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{outOfStockCount}</p>
          <p className="text-xs text-red-700 mt-1">Out of Stock</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{supplierOrders.length}</p>
          <p className="text-xs text-amber-700 mt-1">Total Orders</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{supplierOrders.filter(o => ['accepted','delivery_boy_coming','given_to_delivery','in_transit'].includes(o.status)).length}</p>
          <p className="text-xs text-indigo-700 mt-1">In Progress</p>
        </div>
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-teal-600">{supplierOrders.filter(o => o.status === 'delivered' || o.status === 'completed').length}</p>
          <p className="text-xs text-teal-700 mt-1">Delivered</p>
        </div>
      </div>

      {/* Supplier Performance Ratings */}
      {supplierOrders.length > 0 && (() => {
        const responded = supplierOrders.filter((o: any) => ['accepted', 'rejected', 'delivery_boy_coming', 'given_to_delivery', 'in_transit', 'delivered', 'completed'].includes(o.status));
        const accepted = supplierOrders.filter((o: any) => o.status !== 'rejected' && o.status !== 'pending');
        const acceptRate = responded.length > 0 ? Math.round((accepted.length / responded.length) * 100) : 0;
        const delivered = supplierOrders.filter((o: any) => ['delivered', 'completed'].includes(o.status));
        const totalQuoted = supplierOrders.reduce((s: number, o: any) => s + (o.supplierReply?.totalAmount || 0), 0);
        const avgResponse = responded.filter((o: any) => o.respondedAt && o.assignedAt).reduce((s: number, o: any) => {
          return s + (new Date(o.respondedAt).getTime() - new Date(o.assignedAt).getTime());
        }, 0);
        const respondedWithTime = responded.filter((o: any) => o.respondedAt && o.assignedAt);
        const avgResponseHours = respondedWithTime.length > 0 ? Math.round(avgResponse / respondedWithTime.length / 3600000) : 0;
        const paid = supplierOrders.filter((o: any) => o.paymentStatus === 'paid');
        const totalPaid = paid.reduce((s: number, o: any) => s + (o.paidAmount || o.supplierReply?.totalAmount || 0), 0);

        return (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              Supplier Performance
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="text-center"><p className="text-2xl font-bold text-emerald-600">{acceptRate}%</p><p className="text-[10px] text-gray-400 mt-1">Accept Rate</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-blue-600">{avgResponseHours}h</p><p className="text-[10px] text-gray-400 mt-1">Avg Response</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-teal-600">{delivered.length}</p><p className="text-[10px] text-gray-400 mt-1">Delivered</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-purple-600">₹{totalQuoted.toLocaleString('en-IN')}</p><p className="text-[10px] text-gray-400 mt-1">Total Quoted</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-emerald-600">₹{totalPaid.toLocaleString('en-IN')}</p><p className="text-[10px] text-gray-400 mt-1">Total Paid</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-red-500">{supplierOrders.filter((o: any) => o.status === 'cancelled').length}</p><p className="text-[10px] text-gray-400 mt-1">Cancelled</p></div>
            </div>
          </div>
        );
      })()}

      {/* Section Toggle: Orders | Products */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        <button
          onClick={() => setActiveSection('orders')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${activeSection === 'orders' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Orders ({supplierOrders.length})
        </button>
        <button
          onClick={() => setActiveSection('products')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${activeSection === 'products' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Products ({supplierProducts.length + products.length})
        </button>
      </div>

      {/* Orders Section */}
      {activeSection === 'orders' && supplierOrders.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6">
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Orders ({supplierOrders.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {supplierOrders.map((o: any) => {
              const statusColors: Record<string,string> = {
                pending: 'bg-gray-50 text-gray-500 border-gray-200',
                accepted: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                rejected: 'bg-red-50 text-red-600 border-red-100',
                delivery_boy_coming: 'bg-cyan-50 text-cyan-600 border-cyan-100',
                given_to_delivery: 'bg-blue-50 text-blue-600 border-blue-100',
                in_transit: 'bg-indigo-50 text-indigo-600 border-indigo-100',
                delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                completed: 'bg-purple-50 text-purple-600 border-purple-100',
              };
              const statusLabels: Record<string,string> = {
                pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected',
                delivery_boy_coming: 'Delivery Boy Coming', given_to_delivery: 'Given to Delivery', in_transit: 'In Transit',
                delivered: 'Delivered', completed: 'Completed',
              };
              return (
                <div key={o._id} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${statusColors[o.status] || ''}`}>
                        {statusLabels[o.status] || o.status}
                      </span>
                      {o.shopifyOrderRef && <span className="text-xs text-gray-400">Ref: {o.shopifyOrderRef}</span>}
                    </div>
                    <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    {o.items?.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between py-0.5">
                        <span className="text-sm text-gray-700 font-medium">{item.productName}</span>
                        <span className="text-sm text-gray-500">× {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      {o.supplierReply?.totalAmount && (
                        <span className="text-gray-500">Quoted: <strong className="text-gray-800">₹{o.supplierReply.totalAmount.toLocaleString('en-IN')}</strong></span>
                      )}
                      {o.supplierReply?.note && <span className="text-xs text-gray-400">Note: {o.supplierReply.note}</span>}
                    </div>
                    <div className="flex gap-2">
                      {o.status === 'accepted' && (
                        <button onClick={() => handleOrderStatusUpdate(o._id, 'delivery_boy_coming')} disabled={orderUpdating === o._id}
                          className="px-3 py-1.5 text-xs bg-cyan-50 text-cyan-600 rounded-lg font-medium hover:bg-cyan-100 transition-colors disabled:opacity-60">
                          {orderUpdating === o._id ? '...' : '🚚 Notify Delivery Boy Coming'}
                        </button>
                      )}
                      {o.status === 'given_to_delivery' && (
                        <button onClick={() => handleOrderStatusUpdate(o._id, 'in_transit')} disabled={orderUpdating === o._id}
                          className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100 transition-colors disabled:opacity-60">
                          {orderUpdating === o._id ? '...' : '🚚 In Transit'}
                        </button>
                      )}
                      {o.status === 'in_transit' && (
                        <button onClick={() => handleOrderStatusUpdate(o._id, 'delivered')} disabled={orderUpdating === o._id}
                          className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-600 rounded-lg font-medium hover:bg-emerald-100 transition-colors disabled:opacity-60">
                          {orderUpdating === o._id ? '...' : '✅ Delivered'}
                        </button>
                      )}
                      {o.status === 'delivered' && (
                        <button onClick={() => handleOrderStatusUpdate(o._id, 'complete')} disabled={orderUpdating === o._id}
                          className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-lg font-medium hover:bg-purple-100 transition-colors disabled:opacity-60">
                          {orderUpdating === o._id ? '...' : '✓ Complete'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {activeSection === 'orders' && supplierOrders.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">No orders assigned to this supplier yet.</p>
        </div>
      )}

      {/* Products Section */}
      {activeSection === 'products' && (
        <>
        {/* Supplier Products (Catalog + Custom) */}
        {supplierProducts.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6">
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Supplier Products ({supplierProducts.length})</h2>
              <p className="text-xs text-gray-400 mt-1">Catalog products added from Shopify and custom submitted products</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-5">
              {supplierProducts.map((sp: any) => {
                const name = sp.source === 'catalog' ? sp.shopifyTitle : sp.productName;
                const image = sp.shopifyImage || sp.productImages?.[0];
                const statusMap: Record<string,string> = { approved: 'Approved', pending: 'Pending', rejected: 'Rejected' };
                return (
                  <div key={sp._id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-gray-300 transition-all group flex flex-col h-full cursor-pointer" onClick={() => setSpDetail(sp)}>
                    <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
                      {image ? (
                        <img src={image} alt={name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                      )}
                      {sp.productImages && sp.productImages.length > 1 && <span className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-[10px] font-bold rounded-md backdrop-blur-sm">{sp.productImages.length} imgs</span>}
                    </div>
                    <div className="p-4 flex flex-col flex-grow">
                      <h3 className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2 mb-1">{name}</h3>
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <StatusBadge status={statusMap[sp.status] || sp.status} />
                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded ${sp.source === 'catalog' ? 'bg-blue-50 text-blue-600' : sp.source === 'bulk_upload' ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>
                          {sp.source === 'catalog' ? 'Catalog' : sp.source === 'bulk_upload' ? 'Bulk' : 'Custom'}
                        </span>
                        {sp.productCategory && <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded">{sp.productCategory}</span>}
                      </div>

                      {sp.variants?.length > 0 ? (
                        <>
                          <p className="text-[10px] text-gray-400 mb-0.5 mt-auto">{sp.variants[0].title || 'Default'}</p>
                          <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-lg font-bold text-gray-900">₹{(sp.variants[0].sellingPrice || 0).toLocaleString('en-IN')}</span>
                            {sp.variants[0].mrp && sp.variants[0].mrp > sp.variants[0].sellingPrice && (
                              <span className="text-sm text-gray-400 line-through">₹{sp.variants[0].mrp.toLocaleString('en-IN')}</span>
                            )}
                            {sp.variants.length > 1 && (
                              <span className="text-[10px] text-gray-400">+{sp.variants.length - 1} more</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-baseline gap-2 mb-2 mt-auto">
                          <span className="text-lg font-bold text-gray-900">₹{(sp.sellingPrice || 0).toLocaleString('en-IN')}</span>
                          {sp.mrp && sp.mrp > sp.sellingPrice && (
                            <span className="text-sm text-gray-400 line-through">₹{sp.mrp.toLocaleString('en-IN')}</span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-1 pt-3 border-t border-gray-100">
                        {sp.variants?.length > 0 ? (
                          <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-blue-50 text-blue-600 border-blue-100">
                            {sp.variants.length} variant{sp.variants.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${(sp.quantity || 0) > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                            {(sp.quantity || 0) > 0 ? `${sp.quantity} in stock` : 'Out of Stock'}
                          </span>
                        )}
                        {sp.skuCode && <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{sp.skuCode}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legacy Products (old Product model) */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Products ({products.length})</h2>
          <button onClick={handleExportExcel} className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors">
            Export All (Excel)
          </button>
        </div>

        {products.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            <p className="text-sm text-gray-400">This supplier has not added any products yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-5">
            {products.map((p: any) => (
              <div key={p._id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-gray-300 transition-all group flex flex-col h-full">
                {/* Product Image */}
                <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden cursor-pointer" onClick={() => openEditModal(p)}>
                  {p.images && p.images.length > 0 ? (
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                  )}
                  {p.images && p.images.length > 1 && (
                    <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm">{p.images.length} imgs</span>
                  )}
                  <div className="absolute top-2 left-2">
                    <StatusBadge status={p.isAvailable && p.stock > 0 ? 'In Stock' : 'Out of Stock'} />
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-4 flex flex-col flex-grow">
                  <h3 className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2 mb-2 cursor-pointer" onClick={() => openEditModal(p)}>{p.name}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {p.category && <span className="text-[11px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">{p.category}</span>}
                  </div>

                  <div className="flex items-baseline gap-2 mb-2 mt-auto">
                    <span className="text-lg font-bold text-gray-900">₹{p.price?.toLocaleString()}</span>
                    <span className="text-[11px] text-gray-400">/ {p.unit || 'pcs'}</span>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${p.isAvailable && p.stock > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                      {p.isAvailable && p.stock > 0 ? `${p.stock} in stock` : 'Out of Stock'}
                    </span>
                  </div>

                  {/* Product Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100 mt-auto">
                    <button onClick={() => openEditModal(p)} className="flex-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors text-center">
                      Edit
                    </button>
                    <button
                      onClick={() => p.images && p.images.length > 1 ? handleDownloadAllImages(p) : (p.images && p.images.length > 0 ? handleDownload(p.images[0], `${p.name}.jpg`) : null)}
                      disabled={!p.images || p.images.length === 0}
                      className="px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-40 flex items-center justify-center gap-1"
                      title="Download Image(s)"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                    <button onClick={() => handleExportSingleProduct(p)} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center justify-center" title="Export Excel">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                    <button onClick={() => handleDeleteProduct(p._id)} className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center justify-center">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      {/* Edit Supplier Modal */}
      {isEditSupplierOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] animate-fadeIn" onClick={() => !supplierSaving && setIsEditSupplierOpen(false)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-200 p-6 animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-800">Edit Supplier</h2>
              <button className="bg-transparent border-none text-gray-400 text-2xl cursor-pointer hover:text-gray-800" onClick={() => !supplierSaving && setIsEditSupplierOpen(false)}>&times;</button>
            </div>
            {supplierError && <div className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{supplierError}</div>}
            <form onSubmit={handleSaveSupplier}>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>Representative Name *</label><input required type="text" className={inputClass} value={supplierFormData.name} onChange={e => setSupplierFormData({...supplierFormData, name: e.target.value})} /></div>
                <div><label className={labelClass}>Business / Shop Name *</label><input required type="text" className={inputClass} value={supplierFormData.businessName} onChange={e => setSupplierFormData({...supplierFormData, businessName: e.target.value})} /></div>
                <div><label className={labelClass}>Login Phone *</label><input required type="tel" className={inputClass} value={supplierFormData.phone} onChange={e => setSupplierFormData({...supplierFormData, phone: e.target.value})} /></div>
                <div><label className={labelClass}>Password (blank = keep)</label><input type="text" className={inputClass} value={supplierFormData.password} onChange={e => setSupplierFormData({...supplierFormData, password: e.target.value})} /></div>
              </div>
              <div className="mt-4"><label className={labelClass}>Email</label><input type="email" className={inputClass} value={supplierFormData.email} onChange={e => setSupplierFormData({...supplierFormData, email: e.target.value})} /></div>
              <div className="mt-4"><label className={labelClass}>Address *</label><textarea required className={inputClass} rows={2} value={supplierFormData.address} onChange={e => setSupplierFormData({...supplierFormData, address: e.target.value})} /></div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div><label className={labelClass}>City</label><input type="text" className={inputClass} value={supplierFormData.city} onChange={e => setSupplierFormData({...supplierFormData, city: e.target.value})} /></div>
                <div><label className={labelClass}>State</label><input type="text" className={inputClass} value={supplierFormData.state} onChange={e => setSupplierFormData({...supplierFormData, state: e.target.value})} /></div>
                <div><label className={labelClass}>Pincode</label><input type="text" className={inputClass} value={supplierFormData.pincode} onChange={e => setSupplierFormData({...supplierFormData, pincode: e.target.value})} /></div>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
                <button type="button" className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all" onClick={() => setIsEditSupplierOpen(false)}>Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium shadow-md shadow-blue-500/30 hover:bg-blue-600 transition-all disabled:opacity-70" disabled={supplierSaving}>{supplierSaving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Product Detail Modal */}
      {spDetail && (() => {
        const sp = spDetail;
        const name = sp.source === 'catalog' ? sp.shopifyTitle : sp.productName;
        const image = sp.shopifyImage || sp.productImages?.[0];
        const allImages = sp.source === 'catalog' ? (sp.shopifyImage ? [sp.shopifyImage] : []) : (sp.productImages || []);
        const hasVariants = sp.variants?.length > 0;
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000]" onClick={() => setSpDetail(null)}>
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-200" onClick={e => e.stopPropagation()}>
              {/* Header with image */}
              <div className="relative">
                {image ? (
                  <div className="bg-gray-50 aspect-video">
                    <img src={image} alt={name} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="bg-gray-50 aspect-video flex items-center justify-center">
                    <svg className="w-16 h-16 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                )}
                <button onClick={() => setSpDetail(null)} className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-800 shadow">&times;</button>
                <div className="absolute top-3 left-3 flex gap-1.5">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${sp.source === 'catalog' ? 'bg-blue-500 text-white' : sp.source === 'bulk_upload' ? 'bg-emerald-500 text-white' : 'bg-purple-500 text-white'}`}>
                    {sp.source === 'catalog' ? 'Catalog' : sp.source === 'bulk_upload' ? 'Bulk Upload' : 'Custom'}
                  </span>
                  <StatusBadge status={sp.status} />
                </div>
              </div>

              <div className="p-5 space-y-5">
                <h2 className="text-lg font-bold text-gray-800">{name}</h2>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Supplier</p>
                    <p className="text-sm font-medium text-gray-800">{sp.supplierName || 'Unknown'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Availability</p>
                    <p className={`text-sm font-semibold ${sp.availability === 'available' ? 'text-emerald-600' : sp.availability === 'out_of_stock' ? 'text-red-500' : 'text-gray-500'}`}>
                      {(sp.availability || 'available').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </p>
                  </div>
                  {!hasVariants && (
                    <>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Selling Price</p>
                        <p className="text-sm font-bold text-gray-900">₹{(sp.sellingPrice || 0).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Quantity</p>
                        <p className={`text-sm font-bold ${sp.quantity > 0 ? 'text-gray-900' : 'text-red-600'}`}>{sp.quantity || 0}</p>
                      </div>
                      {sp.mrp && sp.mrp > sp.sellingPrice && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">MRP</p>
                          <p className="text-sm font-medium text-gray-800">₹{sp.mrp.toLocaleString('en-IN')}</p>
                        </div>
                      )}
                    </>
                  )}
                  {sp.skuCode && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">SKU</p>
                      <p className="text-sm font-mono font-medium text-gray-700">{sp.skuCode}</p>
                    </div>
                  )}
                  {sp.brand && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Brand</p>
                      <p className="text-sm font-medium text-gray-700">{sp.brand}</p>
                    </div>
                  )}
                  {sp.productCategory && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Category</p>
                      <p className="text-sm font-medium text-gray-700">{sp.productCategory}</p>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Submitted</p>
                    <p className="text-sm font-medium text-gray-700">{new Date(sp.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>

                {/* Description */}
                {sp.productDescription && (
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">Description</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{sp.productDescription}</p>
                  </div>
                )}

                {/* Variants Table */}
                {hasVariants && (
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">Variants ({sp.variants.length})</p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left px-3 py-2 text-[11px] text-gray-500 font-medium">Variant</th>
                            <th className="text-left px-3 py-2 text-[11px] text-gray-500 font-medium">Color</th>
                            <th className="text-right px-3 py-2 text-[11px] text-gray-500 font-medium">MRP</th>
                            <th className="text-right px-3 py-2 text-[11px] text-gray-500 font-medium">Price</th>
                            <th className="text-right px-3 py-2 text-[11px] text-gray-500 font-medium">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sp.variants.map((v: any, vi: number) => (
                            <tr key={vi} className="border-t border-gray-100">
                              <td className="px-3 py-2 text-gray-700">{v.title || 'Default'}</td>
                              <td className="px-3 py-2 text-gray-500">{v.color || '—'}</td>
                              <td className="px-3 py-2 text-right text-gray-400">{v.mrp ? `₹${v.mrp}` : '—'}</td>
                              <td className="px-3 py-2 text-right font-medium">₹{v.sellingPrice}</td>
                              <td className={`px-3 py-2 text-right font-bold ${(v.quantity || 0) === 0 ? 'text-red-600' : 'text-gray-800'}`}>{v.quantity || 0}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                            <td className="px-3 py-2 text-gray-600" colSpan={3}>Total</td>
                            <td className="px-3 py-2 text-right text-gray-800">₹{sp.variants.reduce((a: number, v: any) => a + (v.sellingPrice || 0), 0)}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{sp.variants.reduce((a: number, v: any) => a + (v.quantity || 0), 0)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Additional Images */}
                {allImages.length > 1 && (
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">All Images ({allImages.length})</p>
                    <div className="flex gap-2 flex-wrap">
                      {allImages.map((img: string, i: number) => (
                        <img key={i} src={img} alt="" className="w-16 h-16 rounded-lg object-contain bg-gray-50 border border-gray-200" />
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-100">
                  <button onClick={() => setSpDetail(null)} className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Close</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] animate-fadeIn" onClick={() => !saving && setIsModalOpen(false)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-200 p-6 animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-800">Edit Product</h2>
              <button className="bg-transparent border-none text-gray-400 text-2xl cursor-pointer hover:text-gray-800" onClick={() => !saving && setIsModalOpen(false)}>&times;</button>
            </div>
            {error && <div className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</div>}
            <form onSubmit={handleSave}>
              <div><label className={labelClass}>Product Name *</label><input required type="text" className={inputClass} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div><label className={labelClass}>Price (₹) *</label><input required min="0" step="0.01" type="number" className={inputClass} value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} /></div>
                <div><label className={labelClass}>Stock Quantity *</label><input required min="0" type="number" className={inputClass} value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div><label className={labelClass}>Unit</label><input type="text" className={inputClass} placeholder="e.g. pcs, kg, boxes" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} /></div>
                <div><label className={labelClass}>Category</label><input type="text" className={inputClass} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} /></div>
              </div>
              <div className="mt-4"><label className={labelClass}>Description</label><textarea className={inputClass} rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
              <div className="mt-4"><label className={labelClass}>Status</label><select className={inputClass} value={formData.isAvailable ? 'true' : 'false'} onChange={e => setFormData({...formData, isAvailable: e.target.value === 'true'})}><option value="true">Available</option><option value="false">Unavailable</option></select></div>

              {/* Product Images */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <label className={labelClass}>Product Images</label>
                  {productImages.filter(img => !img.isNew).length > 1 && (
                    <button type="button" onClick={handleDownloadAll} className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 transition-all">
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Download All
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
                  {productImages.map((img, index) => (
                    <div key={index} className="relative">
                      <img src={img.url} alt={`preview ${index}`} className="w-full aspect-square rounded-lg object-cover border border-gray-200" />
                      {!img.isNew && (
                        <button type="button" className="absolute top-1 right-8 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center cursor-pointer text-sm border-none hover:bg-blue-500 transition-all" onClick={() => handleDownload(img.url, `${formData.name || 'product'}-${index}.jpg`)}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                      )}
                      <button type="button" className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center cursor-pointer text-sm border-none hover:bg-red-600 transition-all" onClick={() => removeImage(index)}>&times;</button>
                    </div>
                  ))}
                  <label className="w-full aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-all text-gray-400 bg-gray-50 hover:border-blue-500 hover:text-blue-500">
                    <input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    <span className="text-[0.65rem] font-medium">Add Image</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
                <button type="button" className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium shadow-md shadow-blue-500/30 hover:bg-blue-600 transition-all disabled:opacity-70" disabled={saving}>{saving ? 'Saving...' : 'Save Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
