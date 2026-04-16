'use client';

import { useState, useEffect, useRef, DragEvent, ChangeEvent } from 'react';

interface ShopifyVariant {
 id: string;
 title: string;
 price: string;
 sku: string;
 selectedOptions?: { name: string; value: string }[];
}

interface ShopifyMatchDetail {
 id: string;
 title: string;
 vendor?: string;
 image?: string;
 variants?: ShopifyVariant[];
}

interface ParsedProduct {
 productName: string;
 skuCode: string;
 unit: string;
 brand: string;
 category: string;
 quantity: number;
 mrp: number;
 sellingPrice: number;
 row: number;
 error?: string;
 shopifyMatch?: ShopifyMatchDetail;
 shopifyMatches?: ShopifyMatchDetail[];
}

interface UploadResult {
 newProducts: ParsedProduct[];
 duplicates: ParsedProduct[];
 existingInCatalog: ParsedProduct[];
 errors: (ParsedProduct & { error: string })[];
}

interface VariantForm {
 variantId: string;
 title: string;
 sku: string;
 shopifyPrice: string;
 isCustom: boolean;
 quantity: string;
 sellingPrice: string;
 color: string;
}

export default function AdminCatalogUploadPage() {
 const [suppliers, setSuppliers] = useState<any[]>([]);
 const [selectedSupplier, setSelectedSupplier] = useState('');
 const [file, setFile] = useState<File | null>(null);
 const [dragging, setDragging] = useState(false);
 const [uploading, setUploading] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [result, setResult] = useState<UploadResult | null>(null);
 const [submitted, setSubmitted] = useState(false);
 const [submitResult, setSubmitResult] = useState<{ created: number; updated: number; errors: number } | null>(null);
 const [error, setError] = useState('');
 const [selectedMatches, setSelectedMatches] = useState<Record<number, string>>({});
 const fileRef = useRef<HTMLInputElement>(null);

 const [catalogVariants, setCatalogVariants] = useState<Record<number, VariantForm[]>>({});
 const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
 const [editedNewProducts, setEditedNewProducts] = useState<Record<number, { quantity?: string; sellingPrice?: string; mrp?: string }>>({});

 useEffect(() => {
 fetch('/api/admin/suppliers')
 .then(r => r.json())
 .then(d => setSuppliers((d.suppliers || []).filter((s: any) => s.isActive !== false)))
 .catch(() => {});
 }, []);

 const selectedSupplierData = suppliers.find(s => s._id === selectedSupplier);

 const initVariantsForRow = (row: number, match: ShopifyMatchDetail, excelQty: number, excelPrice: number) => {
 const shopifyVars = match.variants || [];
 let forms: VariantForm[];
 if (shopifyVars.length <= 1) {
 const sv = shopifyVars[0];
 forms = [{ variantId: sv?.id || '', title: sv?.title || 'Default', sku: sv?.sku || '', shopifyPrice: sv?.price || '', isCustom: false, quantity: String(excelQty), sellingPrice: String(excelPrice), color: '' }];
 } else {
 forms = shopifyVars.map((sv, i) => ({
 variantId: sv.id, title: sv.title || 'Default', sku: sv.sku || '', shopifyPrice: sv.price || '', isCustom: false,
 quantity: i === 0 ? String(excelQty) : '', sellingPrice: i === 0 ? String(excelPrice) : '',
 color: sv.selectedOptions?.find(o => o.name.toLowerCase() === 'color')?.value || '',
 }));
 }
 setCatalogVariants(prev => ({ ...prev, [row]: forms }));
 };

 const addCustomVariant = (row: number) => {
 setCatalogVariants(prev => {
 const existing = prev[row] || [];
 const cc = existing.filter(v => v.isCustom).length;
 return { ...prev, [row]: [...existing, { variantId: `custom_${cc + 1}`, title: '', sku: '', shopifyPrice: '', isCustom: true, quantity: '', sellingPrice: '', color: '' }] };
 });
 };

 const removeVariant = (row: number, index: number) => {
 setCatalogVariants(prev => { const u = [...(prev[row] || [])]; u.splice(index, 1); return { ...prev, [row]: u }; });
 };

 const updateVariant = (row: number, index: number, field: keyof VariantForm, value: string) => {
 setCatalogVariants(prev => { const u = [...(prev[row] || [])]; u[index] = { ...u[index], [field]: value }; return { ...prev, [row]: u }; });
 };

 const toggleRow = (row: number, match: ShopifyMatchDetail, eq: number, ep: number) => {
 setExpandedRows(prev => {
 const next = new Set(prev);
 if (next.has(row)) { next.delete(row); } else { next.add(row); if (!catalogVariants[row]) initVariantsForRow(row, match, eq, ep); }
 return next;
 });
 };

 const handleMatchChange = (row: number, newId: string, matches: ShopifyMatchDetail[], eq: number, ep: number) => {
 setSelectedMatches(prev => ({ ...prev, [row]: newId }));
 const m = matches.find(x => x.id === newId);
 if (m) initVariantsForRow(row, m, eq, ep);
 };

 const handleFileSelect = (f: File) => {
 if (!f.name.match(/\.(xlsx|xls|csv)$/i)) { setError('Upload an Excel (.xlsx, .xls) or CSV file'); return; }
 setFile(f); setResult(null); setSubmitted(false); setSubmitResult(null); setError('');
 setCatalogVariants({}); setExpandedRows(new Set()); setEditedNewProducts({});
 };

 const handleDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]); };
 const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); };

 const handlePreview = async () => {
 if (!file || !selectedSupplier) return;
 setUploading(true); setError('');
 try {
 const fd = new FormData();
 fd.append('file', file);
 fd.append('action', 'preview');
 fd.append('supplierId', selectedSupplier);
 const res = await fetch('/api/supplier-products/bulk-upload', { method: 'POST', body: fd });
 const data = await res.json();
 if (!res.ok) { setError(data.error || 'Failed to parse'); return; }
 setResult(data.result);

 const catalog = data.result?.existingInCatalog || [];
 const ne = new Set<number>();
 const nv: Record<number, VariantForm[]> = {};
 for (const p of catalog) {
 const ms = p.shopifyMatches || (p.shopifyMatch ? [p.shopifyMatch] : []);
 const m = ms[0];
 if (m) {
 ne.add(p.row);
 const sv = m.variants || [];
 if (sv.length <= 1) {
 const v = sv[0];
 nv[p.row] = [{ variantId: v?.id || '', title: v?.title || 'Default', sku: v?.sku || '', shopifyPrice: v?.price || '', isCustom: false, quantity: String(p.quantity), sellingPrice: String(p.sellingPrice), color: '' }];
 } else {
 nv[p.row] = sv.map((v: ShopifyVariant, i: number) => ({
 variantId: v.id, title: v.title || 'Default', sku: v.sku || '', shopifyPrice: v.price || '', isCustom: false,
 quantity: i === 0 ? String(p.quantity) : '', sellingPrice: i === 0 ? String(p.sellingPrice) : '',
 color: v.selectedOptions?.find((o: { name: string; value: string }) => o.name.toLowerCase() === 'color')?.value || '',
 }));
 }
 }
 }
 setExpandedRows(ne); setCatalogVariants(nv);
 } catch { setError('Error processing file'); }
 finally { setUploading(false); }
 };

 const handleSubmit = async () => {
 if (!file || !result || !selectedSupplier) return;
 setSubmitting(true); setError('');
 try {
 const fd = new FormData();
 fd.append('file', file);
 fd.append('action', 'submit');
 fd.append('supplierId', selectedSupplier);
 fd.append('supplierName', selectedSupplierData?.name || selectedSupplierData?.businessName || 'Supplier');
 if (Object.keys(selectedMatches).length > 0) fd.append('selectedMatches', JSON.stringify(selectedMatches));
 if (Object.keys(catalogVariants).length > 0) fd.append('catalogVariants', JSON.stringify(catalogVariants));
 if (Object.keys(editedNewProducts).length > 0) fd.append('editedNewProducts', JSON.stringify(editedNewProducts));
 const res = await fetch('/api/supplier-products/bulk-upload', { method: 'POST', body: fd });
 const data = await res.json();
 if (!res.ok) { setError(data.error || 'Failed to submit'); return; }
 setSubmitted(true); setSubmitResult({ created: data.created, updated: data.updated, errors: data.errors });
 } catch { setError('Error submitting'); }
 finally { setSubmitting(false); }
 };

 const handleReset = () => {
 setFile(null); setResult(null); setSubmitted(false); setSubmitResult(null); setError('');
 setCatalogVariants({}); setExpandedRows(new Set()); setEditedNewProducts({});
 if (fileRef.current) fileRef.current.value = '';
 };

 const totalNew = result?.newProducts?.length || 0;
 const totalCatalog = result?.existingInCatalog?.length || 0;
 const totalDuplicates = result?.duplicates?.length || 0;
 const totalErrors = result?.errors?.length || 0;
 const inputSmall = 'px-2 py-1.5 bg-white/5 border-2 border-white/10 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-blue-100 transition-all';

 return (
 <div className="p-6">
 <div className="flex items-start justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold text-white">First Catalog Upload</h1>
 <p className="text-sm text-white/40 mt-1">Digitize a new supplier&apos;s catalog during onboarding. Products are matched with Shopify.</p>
 </div>
 </div>

 {/* Success */}
 {submitted && submitResult && (
 <div className="bg-white/5 border-2 border-white/10 p-8 text-center">
 <div className="w-16 h-16 bg-green-500/100/10 rounded-full flex items-center justify-center mx-auto mb-4">
 <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
 </div>
 <h2 className="text-xl font-bold text-white mb-2">Catalog Uploaded!</h2>
 <p className="text-white/50 mb-1">Products for <strong>{selectedSupplierData?.name || selectedSupplierData?.businessName}</strong> submitted for review.</p>
 <div className="flex items-center justify-center gap-6 my-6">
 <div className="text-center"><p className="text-2xl font-bold text-green-400">{submitResult.created}</p><p className="text-xs text-white/40">Created</p></div>
 <div className="text-center"><p className="text-2xl font-bold text-accent">{submitResult.updated}</p><p className="text-xs text-white/40">Updated</p></div>
 {submitResult.errors > 0 && <div className="text-center"><p className="text-2xl font-bold text-red-400">{submitResult.errors}</p><p className="text-xs text-white/40">Skipped</p></div>}
 </div>
 <div className="flex gap-3 justify-center">
 <button onClick={() => { handleReset(); setSelectedSupplier(''); }} className="px-5 py-2.5 bg-white/10 text-white/80 text-sm font-medium hover:bg-white/10">Upload for Another</button>
 <a href="/admin/submissions" className="px-5 py-2.5 bg-accent text-white text-sm font-medium shadow-blue-500/20 hover:bg-accent/80">View Submissions</a>
 </div>
 </div>
 )}

 {!submitted && (
 <div className="space-y-6">
 {/* Step 1: Select Supplier */}
 <div className="bg-white/5 border-2 border-white/10 p-6 ">
 <div className="flex items-start gap-4">
 <div className="w-10 h-10 bg-purple-500/10 flex items-center justify-center shrink-0">
 <span className="text-purple-400 font-bold text-sm">1</span>
 </div>
 <div className="flex-1">
 <h3 className="text-base font-semibold text-white">Select Supplier</h3>
 <p className="text-sm text-white/50 mt-1 mb-4">Choose the supplier to digitize their catalog for.</p>
 <select value={selectedSupplier} onChange={e => { setSelectedSupplier(e.target.value); handleReset(); }}
 className="w-full max-w-sm px-4 py-2.5 border-2 border-white/10 text-sm focus:outline-none focus:border-accent transition-all">
 <option value="">— Select a supplier —</option>
 {suppliers.map(s => (
 <option key={s._id} value={s._id}>{s.name} {s.businessName ? `(${s.businessName})` : ''}</option>
 ))}
 </select>
 {selectedSupplierData && (
 <div className="mt-3 flex items-center gap-3 bg-purple-500/10 border border-purple-100 px-4 py-2">
 <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
 {(selectedSupplierData.name || 'S').charAt(0).toUpperCase()}
 </div>
 <div>
 <p className="text-sm font-semibold text-white">{selectedSupplierData.name}</p>
 <p className="text-xs text-white/50">{selectedSupplierData.businessName} · {selectedSupplierData.phone}</p>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Step 2: Upload File */}
 {selectedSupplier && (
 <div className="bg-white/5 border-2 border-white/10 p-6 ">
 <div className="flex items-start gap-4">
 <div className="w-10 h-10 bg-accent/10 flex items-center justify-center shrink-0">
 <span className="text-accent font-bold text-sm">2</span>
 </div>
 <div className="flex-1">
 <h3 className="text-base font-semibold text-white mb-4">Upload Catalog Excel</h3>
 <div
 onDragEnter={e => { e.preventDefault(); setDragging(true); }}
 onDragLeave={e => { e.preventDefault(); setDragging(false); }}
 onDragOver={e => e.preventDefault()}
 onDrop={handleDrop}
 className={`border-2 border-dashed p-8 text-center transition-all cursor-pointer ${dragging ? 'border-blue-400 bg-accent/10/50' : file ? 'border-emerald-300 bg-green-500/100/10/30' : 'border-white/10 hover:border-blue-300'}`}
 onClick={() => fileRef.current?.click()}
 >
 <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleInputChange} className="hidden" />
 {file ? (
 <div className="flex items-center justify-center gap-3">
 <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
 <span className="text-sm font-medium text-white">{file.name}</span>
 <button onClick={e => { e.stopPropagation(); handleReset(); }} className="ml-4 text-white/40 hover:text-red-400">
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
 </button>
 </div>
 ) : (
 <>
 <svg className="w-10 h-10 mx-auto text-white/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
 <p className="text-sm text-white/50">Drop Excel or <span className="text-accent font-medium">browse</span></p>
 <p className="text-xs text-white/40 mt-1">Columns: Product Name, SKU, Unit, Brand, Category, Qty, MRP, Price</p>
 </>
 )}
 </div>
 {file && !result && (
 <button onClick={handlePreview} disabled={uploading}
 className="mt-4 px-5 py-2.5 bg-accent text-white text-sm font-medium shadow-blue-500/20 hover:bg-accent/80 disabled:opacity-70">
 {uploading ? 'Analyzing...' : 'Preview & Match'}
 </button>
 )}
 </div>
 </div>
 </div>
 )}

 {error && (
 <div className="bg-red-500/10 border border-red-200 p-4 text-sm text-red-400 flex items-center gap-2">
 <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
 {error}
 </div>
 )}

 {/* Step 3: Review */}
 {result && (
 <div className="bg-white/5 border-2 border-white/10 overflow-hidden">
 <div className="flex items-start gap-4 p-6 border-b border-white/5">
 <div className="w-10 h-10 bg-accent/10 flex items-center justify-center shrink-0">
 <span className="text-accent font-bold text-sm">3</span>
 </div>
 <div>
 <h3 className="text-base font-semibold text-white">Review & Submit</h3>
 <p className="text-sm text-white/50 mt-1">Review Shopify matches and fill variant details.</p>
 </div>
 </div>

 {/* Summary */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6">
 <div className="bg-green-500/100/10 border border-green-500/10 p-4">
 <p className="text-xs text-green-400 uppercase tracking-wider font-medium">New</p>
 <p className="text-2xl font-bold text-green-400 mt-1">{totalNew}</p>
 </div>
 <div className="bg-accent/10 border border-accent/20 p-4">
 <p className="text-xs text-accent uppercase tracking-wider font-medium">Shopify Match</p>
 <p className="text-2xl font-bold text-accent mt-1">{totalCatalog}</p>
 </div>
 <div className="bg-yellow-500/100/10 border border-yellow-500/10 p-4">
 <p className="text-xs text-yellow-400 uppercase tracking-wider font-medium">Duplicates</p>
 <p className="text-2xl font-bold text-yellow-400 mt-1">{totalDuplicates}</p>
 </div>
 <div className="bg-red-500/10 border border-red-500/10 p-4">
 <p className="text-xs text-red-400 uppercase tracking-wider font-medium">Errors</p>
 <p className="text-2xl font-bold text-red-400 mt-1">{totalErrors}</p>
 </div>
 </div>

 {/* Catalog Matches */}
 {result.existingInCatalog.length > 0 && (
 <div className="px-6 pb-6">
 <h4 className="text-xs text-accent uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
 <span className="w-2 h-2 bg-blue-400 rounded-full" />
 Shopify Matches ({result.existingInCatalog.length})
 </h4>
 <div className="space-y-4">
 {result.existingInCatalog.map((p: any) => {
 const matches: ShopifyMatchDetail[] = p.shopifyMatches || (p.shopifyMatch ? [p.shopifyMatch] : []);
 const selectedId = selectedMatches[p.row] || matches[0]?.id;
 const selectedMatch = matches.find(m => m.id === selectedId) || matches[0];
 const isExpanded = expandedRows.has(p.row);
 const variants = catalogVariants[p.row] || [];
 const filledVariants = variants.filter(v => Number(v.quantity) > 0 || Number(v.sellingPrice) > 0);
 const totalQty = filledVariants.reduce((s, v) => s + (Number(v.quantity) || 0), 0);

 return (
 <div key={p.row} className="border border-blue-200 overflow-hidden">
 <div className="flex items-center gap-3 px-4 py-3 bg-accent/10/50 cursor-pointer hover:bg-accent/10 transition-colors"
 onClick={() => toggleRow(p.row, selectedMatch, p.quantity, p.sellingPrice)}>
 {selectedMatch?.image ? (
 <img src={selectedMatch.image} alt="" className="w-10 h-10 object-contain bg-white/5 border border-accent/20 shrink-0" />
 ) : (
 <div className="w-10 h-10 bg-accent/20 flex items-center justify-center shrink-0">
 <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
 </div>
 )}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="text-xs text-white/40">Row {p.row}</span>
 <span className="text-sm font-semibold text-white truncate">{p.productName}</span>
 </div>
 <span className="text-[11px] text-accent font-medium">→ {selectedMatch?.title}</span>
 </div>
 {matches.length > 1 && (
 <select value={selectedId} onChange={e => { e.stopPropagation(); handleMatchChange(p.row, e.target.value, matches, p.quantity, p.sellingPrice); }}
 onClick={e => e.stopPropagation()}
 className="px-2 py-1 text-[11px] bg-white/5 border border-blue-200 max-w-[180px]">
 {matches.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
 </select>
 )}
 <div className="flex items-center gap-3 shrink-0">
 {filledVariants.length > 0 && <span className="text-xs text-green-400 font-medium">{totalQty} units</span>}
 <svg className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
 </div>
 </div>

 {isExpanded && (
 <div className="px-4 py-4 border-t border-accent/20">
 <div className="space-y-2">
 {variants.map((v, vi) => (
 <div key={vi} className={`flex items-center gap-2 p-2.5 ${v.isCustom ? 'bg-purple-500/10 border border-purple-100' : 'bg-white/5 border-2 border-white/5'}`}>
 <div className="w-[160px] shrink-0">
 {v.isCustom ? (
 <input type="text" value={v.title} onChange={e => updateVariant(p.row, vi, 'title', e.target.value)} placeholder="Variant name" className={`${inputSmall} w-full text-purple-400`} />
 ) : (
 <div><p className="text-sm font-medium text-white/80">{v.title}</p>{v.shopifyPrice && <p className="text-[10px] text-white/40">Shopify: ₹{v.shopifyPrice}</p>}</div>
 )}
 </div>
 <div className="flex-1 min-w-[70px]">
 <label className="text-[9px] text-white/40 uppercase block mb-0.5">Qty</label>
 <input type="number" min="0" value={v.quantity} onChange={e => updateVariant(p.row, vi, 'quantity', e.target.value)} className={`${inputSmall} w-full`} />
 </div>
 <div className="flex-1 min-w-[80px]">
 <label className="text-[9px] text-white/40 uppercase block mb-0.5">Price ₹</label>
 <input type="number" min="0" value={v.sellingPrice} onChange={e => updateVariant(p.row, vi, 'sellingPrice', e.target.value)} className={`${inputSmall} w-full`} />
 </div>
 <div className="flex-1 min-w-[70px]">
 <label className="text-[9px] text-white/40 uppercase block mb-0.5">Color</label>
 <input type="text" value={v.color} onChange={e => updateVariant(p.row, vi, 'color', e.target.value)} className={`${inputSmall} w-full`} />
 </div>
 {(v.isCustom || variants.length > 1) && (
 <button onClick={() => removeVariant(p.row, vi)} className="p-1 text-white/40 hover:text-red-400 mt-3 shrink-0">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
 </button>
 )}
 </div>
 ))}
 </div>
 <button onClick={() => addCustomVariant(p.row)}
 className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-100 hover:bg-purple-100">
 + Add Custom Variant
 </button>
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* New Products */}
 {result.newProducts.length > 0 && (
 <div className="px-6 pb-6">
 <h4 className="text-xs text-green-400 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
 <span className="w-2 h-2 bg-emerald-400 rounded-full" />
 New Products ({result.newProducts.length})
 </h4>
 <div className="overflow-x-auto border-2 border-white/10 ">
 <table className="w-full text-sm">
 <thead><tr className="bg-white/5 border-b border-white/10">
 <th className="text-left px-3 py-2 text-[10px] text-white/40 uppercase font-medium">Product</th>
 <th className="text-left px-3 py-2 text-[10px] text-white/40 uppercase font-medium">SKU</th>
 <th className="text-left px-3 py-2 text-[10px] text-white/40 uppercase font-medium">Brand</th>
 <th className="text-right px-3 py-2 text-[10px] text-white/40 uppercase font-medium w-[80px]">Qty</th>
 <th className="text-right px-3 py-2 text-[10px] text-white/40 uppercase font-medium w-[90px]">Price</th>
 </tr></thead>
 <tbody>
 {result.newProducts.map((p, i) => {
 const edited = editedNewProducts[p.row] || {};
 return (
 <tr key={i} className="border-b border-gray-50 hover:bg-white/5/50">
 <td className="px-3 py-2 font-medium text-white">{p.productName}</td>
 <td className="px-3 py-2 text-xs font-mono text-white/50">{p.skuCode}</td>
 <td className="px-3 py-2 text-white/60">{p.brand || '—'}</td>
 <td className="px-3 py-2 text-right">
 <input type="number" min="0" value={edited.quantity ?? p.quantity}
 onChange={e => setEditedNewProducts(prev => ({ ...prev, [p.row]: { ...prev[p.row], quantity: e.target.value } }))}
 className={`${inputSmall} w-full text-right`} />
 </td>
 <td className="px-3 py-2 text-right">
 <input type="number" min="0" value={edited.sellingPrice ?? p.sellingPrice}
 onChange={e => setEditedNewProducts(prev => ({ ...prev, [p.row]: { ...prev[p.row], sellingPrice: e.target.value } }))}
 className={`${inputSmall} w-full text-right font-medium`} />
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Errors */}
 {result.errors.length > 0 && (
 <div className="px-6 pb-6">
 <h4 className="text-xs text-red-400 uppercase tracking-wider font-semibold mb-3">Errors ({result.errors.length})</h4>
 <div className="overflow-x-auto border border-red-200 ">
 <table className="w-full text-sm">
 <thead><tr className="bg-red-500/10/50 border-b border-red-200">
 <th className="text-left px-3 py-2 text-[10px] text-white/40 uppercase">Row</th>
 <th className="text-left px-3 py-2 text-[10px] text-white/40 uppercase">Product</th>
 <th className="text-left px-3 py-2 text-[10px] text-white/40 uppercase">Error</th>
 </tr></thead>
 <tbody>
 {result.errors.map((p, i) => (
 <tr key={i} className="border-b border-gray-50">
 <td className="px-3 py-2 text-xs text-white/40">{p.row}</td>
 <td className="px-3 py-2 text-white/60">{p.productName || '—'}</td>
 <td className="px-3 py-2 text-red-400 text-xs">{p.error}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Submit */}
 <div className="flex items-center justify-between p-6 border-t border-white/5 bg-gray-50/50">
 <p className="text-xs text-white/40">
 {totalNew} new + {totalCatalog} catalog + {totalDuplicates} updates = {totalNew + totalCatalog + totalDuplicates} products
 </p>
 <div className="flex gap-3">
 <button onClick={handleReset} className="px-4 py-2.5 bg-white/5 border-2 border-white/10 text-white/80 text-sm font-medium hover:bg-white/5">Cancel</button>
 <button onClick={handleSubmit} disabled={submitting || (totalNew + totalDuplicates + totalCatalog === 0)}
 className="px-6 py-2.5 bg-accent text-white text-sm font-medium shadow-blue-500/20 hover:bg-accent/80 disabled:opacity-70">
 {submitting ? 'Submitting...' : `Submit ${totalNew + totalDuplicates + totalCatalog} Products`}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
}
