'use client';

import React, { useState, useEffect } from 'react';

interface SubmissionDetailModalProps {
  submission: any;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  approving: string | null;
}

export default function SubmissionDetailModal({ submission, onClose, onApprove, onReject, approving }: SubmissionDetailModalProps) {
  const s = submission;
  const isCatalog = s.source === 'catalog' || (!s.source && s.shopifyProductId);
  const isBulkUpload = s.source === 'bulk_upload';
  const displayName = isCatalog ? (s.shopifyTitle || s.productName) : s.productName;
  const allImages = isCatalog ? (s.shopifyImage ? [s.shopifyImage] : []) : (s.productImages || []);

  // Fetch Shopify variants for catalog products to compare
  const [shopifyVariants, setShopifyVariants] = useState<any[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  useEffect(() => {
    if (isCatalog && s.shopifyProductId && s.variants?.length > 0) {
      setLoadingVariants(true);
      fetch('/api/shopify/products')
        .then(res => res.json())
        .then(data => {
          const product = (data.products || []).find((p: any) => String(p.id) === String(s.shopifyProductId));
          if (product?.variants) {
            setShopifyVariants(product.variants);
          }
        })
        .catch(() => { })
        .finally(() => setLoadingVariants(false));
    }
  }, [isCatalog, s.shopifyProductId, s.variants?.length]);

  // Check if a supplier variant exists in Shopify
  const isNewVariant = (supplierVariant: any): boolean => {
    if (!isCatalog || shopifyVariants.length === 0) return false;
    const svTitle = (supplierVariant.title || '').toLowerCase().trim();
    const svColor = (supplierVariant.color || '').toLowerCase().trim();
    return !shopifyVariants.some((sv: any) => {
      const shopTitle = (sv.title || '').toLowerCase().trim();
      // Match by title
      if (svTitle && shopTitle && shopTitle === svTitle) return true;
      // Match by option value (color/size)
      if (sv.selectedOptions) {
        return sv.selectedOptions.some((opt: any) => {
          const optVal = (opt.value || '').toLowerCase().trim();
          if (svTitle && optVal === svTitle) return true;
          if (svColor && optVal === svColor) return true;
          return false;
        });
      }
      return false;
    });
  };

  const hasNewVariants = s.variants?.some((v: any) => isNewVariant(v));

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-[1000]" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#111] border-2 border-white/20" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase shrink-0 ${s.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                s.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
              }`}>{s.status}</span>
            <h2 className="text-lg font-bold text-white truncate">{displayName}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white text-xl shrink-0 transition-colors">&times;</button>
        </div>

        {/* Product Image */}
        {allImages.length > 0 ? (
          <div className="bg-white/5">
            <img src={allImages[0]} alt={displayName} className="w-full aspect-video object-contain" />
          </div>
        ) : isBulkUpload ? (
          <div className="bg-cyan-500/10 flex items-center justify-center py-8">
            <div className="text-center">
              <svg className="w-10 h-10 mx-auto text-cyan-400/50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-xs text-cyan-400/60 font-medium">Uploaded via Excel</p>
            </div>
          </div>
        ) : null}

        {/* Details */}
        <div className="p-5 space-y-5">
          {/* Price & Quantity - hidden when variants exist */}
          {!(s.variants?.length > 0) && (() => {
            const totalPrice = s.sellingPrice * s.quantity;
            return (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-display mb-0.5">Total Price</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">₹{totalPrice}</span>
                    {s.mrp && s.mrp > s.sellingPrice && (
                      <span className="text-sm text-white/30 line-through">₹{s.mrp} MRP</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-display mb-0.5">Total Quantity</p>
                  <span className="text-2xl font-black text-white">{s.quantity}</span>
                </div>
              </div>
            );
          })()}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="Supplier" value={s.supplierName || 'Unknown'} />
            <InfoCard label="Source" value={isBulkUpload ? 'Bulk Upload (Excel)' : isCatalog ? 'From Catalog' : 'Custom Product'} />
            <InfoCard label="Submitted" value={new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
            <InfoCard label="Status" value={s.status.charAt(0).toUpperCase() + s.status.slice(1)} />
            {!isCatalog && s.productCategory && <InfoCard label="Category" value={s.productCategory} />}
            {!isCatalog && s.productUnit && <InfoCard label="Unit" value={s.productUnit} />}
            {s.mrp && !(s.variants?.length > 0) && <InfoCard label="MRP" value={`₹${s.mrp}`} />}
            {s.skuCode && <InfoCard label="SKU" value={s.skuCode} mono />}
            {s.brand && <InfoCard label="Brand" value={s.brand} />}
            {isCatalog && s.shopifyProductId && <InfoCard label="Shopify ID" value={s.shopifyProductId} mono />}
          </div>

          {/* Description */}
          {!isCatalog && s.productDescription && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-display mb-1">Description</p>
              <p className="text-sm text-white/60 leading-relaxed">{s.productDescription}</p>
            </div>
          )}

          {/* New Variants Alert */}
          {hasNewVariants && !loadingVariants && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 flex items-start gap-2">
              <span className="text-yellow-400 text-lg leading-none mt-0.5">⚠️</span>
              <div>
                <p className="text-sm font-bold text-yellow-400">New Variants Detected</p>
                <p className="text-xs text-yellow-400/60 mt-0.5">Highlighted variants below don&apos;t exist in the Shopify product. Review before approving.</p>
              </div>
            </div>
          )}

          {/* Variants Table */}
          {s.variants?.length > 0 ? (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-display mb-2">
                Supplier Variants ({s.variants.length})
                {loadingVariants && <span className="ml-2 text-accent animate-pulse">comparing with Shopify...</span>}
              </p>
              <div className="border-2 border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="text-left px-3 py-2 text-[10px] text-white/40 font-display uppercase tracking-widest">Variant</th>
                      <th className="text-left px-3 py-2 text-[10px] text-white/40 font-display uppercase tracking-widest">Color</th>
                      <th className="text-right px-3 py-2 text-[10px] text-white/40 font-display uppercase tracking-widest">MRP</th>
                      <th className="text-right px-3 py-2 text-[10px] text-white/40 font-display uppercase tracking-widest">Price</th>
                      <th className="text-right px-3 py-2 text-[10px] text-white/40 font-display uppercase tracking-widest">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.variants.map((v: any, vi: number) => {
                      const isNew = isNewVariant(v);
                      return (
                        <tr key={vi} className={`border-t border-white/5 ${isNew ? 'bg-yellow-500/10' : ''}`}>
                          <td className="px-3 py-2 text-white/80">
                            <span className="flex items-center gap-1.5">
                              {v.title || 'Default'}
                              {isNew && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-400">NEW</span>
                              )}
                            </span>
                          </td>
                          <td className={`px-3 py-2 ${isNew ? 'text-yellow-400 font-medium' : 'text-white/50'}`}>{v.color || '—'}</td>
                          <td className={`px-3 py-2 text-right ${isNew ? 'text-yellow-400/60' : 'text-white/30'}`}>{v.mrp ? `₹${v.mrp}` : '—'}</td>
                          <td className={`px-3 py-2 text-right font-medium ${isNew ? 'text-yellow-400' : 'text-white/80'}`}>₹{v.sellingPrice}</td>
                          <td className={`px-3 py-2 text-right font-bold ${isNew ? 'text-yellow-400' : 'text-white'}`}>{v.quantity}</td>
                        </tr>
                      );
                    })}
                    {/* Totals row */}
                    <tr className="border-t-2 border-white/10 bg-white/5 font-bold">
                      <td className="px-3 py-2 text-white/60" colSpan={3}>Total</td>
                      <td className="px-3 py-2 text-right text-white">₹{s.variants.reduce((a: number, v: any) => a + (v.sellingPrice || 0), 0)}</td>
                      <td className="px-3 py-2 text-right text-white">{s.variants.reduce((a: number, v: any) => a + (v.quantity || 0), 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 p-4 text-center">
              <p className="text-sm text-white/50">No variant details submitted</p>
              <p className="text-[11px] text-white/30 mt-1">Supplier submitted as single product: ₹{s.sellingPrice} × {s.quantity}</p>
            </div>
          )}

          {/* Additional Images */}
          {allImages.length > 1 && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-display mb-2">All Images ({allImages.length})</p>
              <div className="flex gap-2 flex-wrap">
                {allImages.map((img: string, i: number) => (
                  <img key={i} src={img} alt="" className="w-16 h-16 object-contain bg-white/5 border border-white/10" />
                ))}
              </div>
            </div>
          )}

          {/* Approve / Reject Actions (pending only) */}
          {s.status === 'pending' && (
            <div className="flex gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => { onApprove(s._id); onClose(); }}
                disabled={approving === s._id}
                className="flex-1 px-4 py-2 text-sm bg-accent text-black font-bold hover:bg-accent/80 disabled:opacity-50 transition-colors"
              >
                {approving === s._id ? '...' : isCatalog ? 'Approve' : 'Approve & Add'}
              </button>
              <button
                onClick={() => { onReject(s._id); onClose(); }}
                className="px-4 py-2 text-sm bg-red-500/20 text-red-400 font-bold hover:bg-red-500/30 transition-colors"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-white/5 p-3 border border-white/10">
      <p className="text-[10px] text-white/40 uppercase tracking-widest font-display mb-0.5">{label}</p>
      <p className={`text-sm font-medium text-white ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}
