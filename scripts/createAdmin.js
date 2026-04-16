const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PHONE = '9686231591';
const PASSWORD = 'Sujan@2003';

const AdminSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'admin' },
  },
  { timestamps: true }
);

const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const result = await Admin.findOneAndUpdate(
    { phone: PHONE },
    { phone: PHONE, passwordHash, role: 'admin' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log('Admin upserted:', { id: result._id.toString(), phone: result.phone, role: result.role });
  await mongoose.disconnect();
})().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});
