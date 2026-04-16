import mongoose, { Model } from 'mongoose';

const SupplierOrderSchema = new mongoose.Schema(
  {
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierName: { type: String },
    items: [
      {
        productName: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled', 'delivery_boy_coming', 'given_to_delivery', 'in_transit', 'delivered', 'completed'],
      default: 'pending',
    },
    supplierReply: {
      totalAmount: { type: Number },
      note: { type: String },
    },
    shopifyOrderRef: { type: String },
    // Delivery boy info
    deliveryBoyName: { type: String },
    deliveryBoyPhone: { type: String },
    // Timeline audit trail
    timeline: [
      {
        status: { type: String },
        changedBy: { type: String },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
    // Payment tracking
    paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
    paidAt: { type: Date },
    paidAmount: { type: Number },
    paymentRefType: { type: String, enum: ['transaction_id', 'utr'], default: 'transaction_id' },
    paymentRefNumber: { type: String },
    // GST invoice request
    gstInvoiceRequested: { type: Boolean },
    gstInvoiceRequestedAt: { type: Date },
    gstInvoiceSent: { type: Boolean, default: false },
    gstInvoiceSentAt: { type: Date },
    // SLA tracking
    slaStatus: {
      type: String,
      enum: ['on_track', 'warning', 'breached'],
      default: 'on_track',
    },
    slaBreachedAt: { type: Date },
    confirmedAt: { type: Date },
    // Escalation log
    escalationLog: [{
      action: { type: String, enum: ['reassign_supplier', 'redispatch_fleet', 'call_customer', 'call_supplier', 'mark_resolved'] },
      reason: { type: String },
      performedBy: { type: String },
      previousSupplierId: { type: mongoose.Schema.Types.ObjectId },
      newSupplierId: { type: mongoose.Schema.Types.ObjectId },
      timestamp: { type: Date, default: Date.now },
    }],
    // Refund tracking
    refundStatus: { type: String, enum: ['none', 'requested', 'initiated', 'processed', 'failed'], default: 'none' },
    refundAmount: { type: Number },
    refundedAt: { type: Date },
    refundNote: { type: String },
    // Customer feedback (admin shares with supplier)
    customerFeedback: { type: String },
    // Timestamps
    assignedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date },
    deliveryUpdatedAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
    rejectReason: { type: String },
  },
  { timestamps: true }
);

SupplierOrderSchema.index({ supplierId: 1, status: 1 });
SupplierOrderSchema.index({ shopifyOrderRef: 1, supplierId: 1 });
SupplierOrderSchema.index({ slaStatus: 1 });

const SupplierOrder: Model<any> = mongoose.models.SupplierOrder || mongoose.model('SupplierOrder', SupplierOrderSchema);
export default SupplierOrder;

