import mongoose, { Model } from 'mongoose';

const SupplierSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    businessName: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    address: { type: String, required: true },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    isActive: { type: Boolean, default: true },
    role: { type: String, default: 'supplier' },
    // Pincodes this supplier can serve (for zone-based order routing)
    servicePincodes: { type: [String], default: [] },
    // Warehouse operating hours
    warehouseHours: {
      openTime: { type: String, default: '09:00' },
      closeTime: { type: String, default: '18:00' },
      daysOfWeek: { type: [Number], default: [1, 2, 3, 4, 5, 6] }, // 0=Sun, 1=Mon...6=Sat
    },
    // Closed today override
    closedToday: {
      isClosed: { type: Boolean, default: false },
      reason: { type: String, default: '' },
      closedAt: { type: Date },
    },
    // Advance holiday calendar
    holidays: [{
      date: { type: Date, required: true },
      reason: { type: String, default: '' },
    }],
  },
  { timestamps: true }
);

const Supplier: Model<any> = mongoose.models.Supplier || mongoose.model('Supplier', SupplierSchema);
export default Supplier;
