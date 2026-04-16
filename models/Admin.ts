import mongoose, { Model } from 'mongoose';

const AdminSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'admin' },
  },
  { timestamps: true }
);

const Admin: Model<any> = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
export default Admin;
