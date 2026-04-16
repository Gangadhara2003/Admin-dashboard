import mongoose, { Model } from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['product_request', 'product_update', 'price_update', 'quantity_update', 'low_stock', 'password_change', 'support_message', 'order_response', 'order_cancelled', 'return_action', 'dispatch_action', 'order_assigned', 'payment_update', 'return_request'],
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    fromName: { type: String },
    to: { type: String, default: 'admin' }, // 'admin' or a supplierId
    isRead: { type: Boolean, default: false },
    link: { type: String, default: '' },
  },
  { timestamps: true }
);

NotificationSchema.index({ to: 1, isRead: 1, createdAt: -1 });

const Notification: Model<any> = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
export default Notification;
