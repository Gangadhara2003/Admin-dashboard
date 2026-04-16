import mongoose from 'mongoose';

const CompanyInfoSchema = new mongoose.Schema({
  name: { type: String, default: 'VCNITI' },
  description: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  website: { type: String, default: '' },
  address: { type: String, default: '' },
  gst: { type: String, default: '' },
  logo: { type: String, default: '' },
  tagline: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.CompanyInfo || mongoose.model('CompanyInfo', CompanyInfoSchema);
