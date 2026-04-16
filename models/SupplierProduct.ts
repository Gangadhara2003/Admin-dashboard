import mongoose, { Model } from 'mongoose';

const SupplierProductSchema = new mongoose.Schema(
  {
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierName: { type: String },
    source: { type: String, enum: ['catalog', 'direct', 'bulk_upload'], default: 'catalog' },
    // Catalog submission fields
    shopifyProductId: { type: String },
    shopifyTitle: { type: String },
    shopifyImage: { type: String },
    // Direct add fields
    productName: { type: String },
    productDescription: { type: String },
    productImages: [{ type: String }],
    productCategory: { type: String },
    productUnit: { type: String },
    // SKU & Brand fields
    skuCode: { type: String, trim: true },
    brand: { type: String, trim: true },
    // Availability toggle
    availability: {
      type: String,
      enum: ['available', 'unavailable', 'out_of_stock'],
      default: 'available',
    },
    // Common fields
    quantity: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0 },
    variants: [{
      variantId: { type: String },
      title: { type: String },
      sku: { type: String },
      shopifyPrice: { type: String },
      color: { type: String },
      quantity: { type: Number, min: 0 },
      sellingPrice: { type: Number, min: 0 },
      mrp: { type: Number, min: 0 },
    }],
    lowStockThreshold: { type: Number, default: 10 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    // Stock adjustment log
    stockAdjustmentLog: [{
      reason: {
        type: String,
        enum: ['new_stock_received', 'correction', 'damaged', 'returned', 'order_fulfilled', 'other'],
      },
      note: { type: String },
      previousQty: { type: Number },
      newQty: { type: Number },
      adjustedBy: { type: String },
      timestamp: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

SupplierProductSchema.index({ supplierId: 1, status: 1 });
SupplierProductSchema.index({ skuCode: 1, supplierId: 1 });

const SupplierProduct: Model<any> = mongoose.models.SupplierProduct || mongoose.model('SupplierProduct', SupplierProductSchema);
export default SupplierProduct;
