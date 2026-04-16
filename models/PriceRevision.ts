import mongoose, { Model } from 'mongoose';

const PriceRevisionSchema = new mongoose.Schema(
  {
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierName: { type: String },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupplierProduct', required: true },
    productName: { type: String, required: true },
    currentPrice: { type: Number, required: true },
    requestedPrice: { type: Number, required: true },
    reason: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    adminNote: { type: String, default: '' },
    reviewedAt: { type: Date },
    reviewedBy: { type: String },
    history: [{
      price: { type: Number },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: String },
      action: { type: String }, // 'requested', 'approved', 'rejected'
    }],
  },
  { timestamps: true }
);

PriceRevisionSchema.index({ supplierId: 1, status: 1 });
PriceRevisionSchema.index({ productId: 1 });

const PriceRevision: Model<any> = mongoose.models.PriceRevision || mongoose.model('PriceRevision', PriceRevisionSchema);
export default PriceRevision;
