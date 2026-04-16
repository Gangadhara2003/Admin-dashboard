import mongoose, { Model } from 'mongoose';

const ShiftReportSchema = new mongoose.Schema(
  {
    shiftDate: { type: Date, required: true },
    shiftType: { type: String, enum: ['morning', 'evening', 'night', 'full_day'], default: 'full_day' },
    generatedAt: { type: Date, default: Date.now },
    ordersReceived: { type: Number, default: 0 },
    ordersCompleted: { type: Number, default: 0 },
    ordersRejected: { type: Number, default: 0 },
    ordersCancelled: { type: Number, default: 0 },
    slaBreaches: { type: Number, default: 0 },
    exceptionsHandled: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    supplierIssues: [{
      supplierId: { type: mongoose.Schema.Types.ObjectId },
      supplierName: { type: String },
      issue: { type: String },
    }],
    summary: { type: String, default: '' },
    generatedBy: { type: String, default: 'system' },
  },
  { timestamps: true }
);

ShiftReportSchema.index({ shiftDate: -1 });

const ShiftReport: Model<any> = mongoose.models.ShiftReport || mongoose.model('ShiftReport', ShiftReportSchema);
export default ShiftReport;
