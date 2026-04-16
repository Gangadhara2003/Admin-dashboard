import mongoose, { Model } from 'mongoose';

const SupplierReturnSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupplierOrder', required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierName: { type: String },
    items: [
      {
        productName: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        reason: { type: String },
      },
    ],
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ['requested', 'approved', 'picked_up', 'refunded', 'disputed'],
      default: 'requested',
    },
    adminNote: { type: String },
    supplierNote: { type: String },
    shopifyOrderRef: { type: String },
  },
  { timestamps: true }
);

SupplierReturnSchema.index({ supplierId: 1, status: 1 });
SupplierReturnSchema.index({ orderId: 1 });

const SupplierReturn: Model<any> = mongoose.models.SupplierReturn || mongoose.model('SupplierReturn', SupplierReturnSchema);
export default SupplierReturn;
